import { MedusaContainer } from "@medusajs/types"
import { Modules } from "@medusajs/framework/utils"
import { createOrderShipmentWorkflow } from "@medusajs/core-flows"
import { auth as googleAuth, sheets as sheetsClient, sheets_v4 } from "@googleapis/sheets"
import { TRACKING_BASE_URL } from "../utils/tracking"
import { registerTrackerForFulfillment } from "../utils/easypost-tracker"

// Official USPS tracking page — the domestic warehouse ships via USPS, so its
// links point here instead of the default carrier page used by Main.
const USPS_TRACKING_BASE_URL = "https://tools.usps.com/go/TrackConfirmAction?tLabels="

// ─── Warehouse sheet configs ──────────────────────────────────────────────────
// One block per warehouse; keep these in sync with sync-orders-to-sheets.ts
// (same env vars → read and write target the same sheet/location).
// Leave SPREADSHEET_ID empty to skip a warehouse.
//
// Sheet structure (row 1 = header, data starts row 2):
//   A: Order #        B: Amount      C: Date         D: Payment method
//   E: Customer       F: Order       G: Notes        H: Order Status
//   I: Tracking number               J: Synced        K: Time of delivery

const WAREHOUSE_SHEETS = [
  {
    name: "Main Warehouse",
    spreadsheetId:   process.env.SHEETS_MAIN_SPREADSHEET_ID      || "",
    tabName:         process.env.SHEETS_MAIN_TAB_NAME             || "Sheet1",
    locationId:      process.env.SHEETS_MAIN_LOCATION_ID          || "", // stock_location id in Medusa
    trackingBaseUrl: process.env.SHEETS_MAIN_TRACKING_BASE_URL    || TRACKING_BASE_URL,
  },
  {
    name: "US Domestic",
    spreadsheetId:   process.env.SHEETS_US_DOMESTIC_SPREADSHEET_ID || "",
    tabName:         process.env.SHEETS_US_DOMESTIC_TAB_NAME        || "Sheet1",
    locationId:      process.env.SHEETS_US_DOMESTIC_LOCATION_ID     || "",
    trackingBaseUrl: process.env.SHEETS_US_DOMESTIC_TRACKING_BASE_URL || USPS_TRACKING_BASE_URL,
  },
].filter((w) => w.spreadsheetId) // skip warehouses with no sheet configured

// ─── Column indices (0-based, matching the existing sheet) ───────────────────
const COL = {
  ORDER_NUMBER: 0, // A
  TRACKING:     8, // I
  SYNCED:       9, // J
} as const

// ─── Google auth ──────────────────────────────────────────────────────────────

function buildAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY env var is not set")

  let credentials: object
  try {
    const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")
    credentials = JSON.parse(text)
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY must be a JSON string or base64-encoded JSON")
  }

  return new googleAuth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
}

// ─── Sheet batch write ────────────────────────────────────────────────────────

async function flushResults(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string,
  results: { rowIdx: number; value: string }[],
  logger: any
) {
  if (!results.length) return
  try {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: results.map(({ rowIdx, value }) => ({
          range: `${tabName}!J${rowIdx}`,
          values: [[value]],
        })),
      },
    })
  } catch (err: any) {
    logger.error(`  ⚠️  Failed to write results to sheet: ${err.message}`)
  }
}

// ─── Per-warehouse processing ─────────────────────────────────────────────────

async function processWarehouseSheet(
  sheets: sheets_v4.Sheets,
  warehouse: typeof WAREHOUSE_SHEETS[number],
  container: MedusaContainer,
  query: any,
  orderService: any,
  fulfillmentModule: any,
  logger: any
) {
  logger.info(`  📋 ${warehouse.name}: reading sheet...`)

  let rawRows: string[][]
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: warehouse.spreadsheetId,
      range: `${warehouse.tabName}!A2:K`,
    })
    rawRows = (res.data.values ?? []) as string[][]
  } catch (err: any) {
    logger.error(`  ❌ ${warehouse.name}: failed to read sheet — ${err.message}`)
    return { synced: 0, errored: 0 }
  }

  // Pending = rows where Synced (col J) is blank
  const pending = rawRows
    .map((row, i) => ({ row, sheetRow: i + 2 }))
    .filter(({ row }) => {
      const synced = (row[COL.SYNCED] ?? "").trim().toLowerCase()
      return synced === "" || synced === "retry"
    })

  logger.info(`  ${pending.length} pending row(s) in ${warehouse.name}`)

  let synced = 0
  let errored = 0
  const sheetUpdates: { rowIdx: number; value: string }[] = []

  for (const { row, sheetRow } of pending) {
    const rawOrderNum    = (row[COL.ORDER_NUMBER] ?? "").trim()
    const trackingNumber = (row[COL.TRACKING]     ?? "").trim()

    if (!rawOrderNum || !trackingNumber) {
      logger.warn(`  ⚠️  Row ${sheetRow}: empty order # or tracking — skipped`)
      continue
    }

    // "ONX-1234", "1234", "ONX1234" → numeric display_id
    const displayId = parseInt(rawOrderNum.replace(/^ONX-?/i, ""), 10)
    if (isNaN(displayId)) {
      logger.warn(`  ⚠️  Row ${sheetRow}: cannot parse order number "${rawOrderNum}"`)
      sheetUpdates.push({ rowIdx: sheetRow, value: `error: invalid order # "${rawOrderNum}"` })
      errored++
      continue
    }

    try {
      // 1. Find order by display_id
      const { data: orders } = await query.graph({
        entity: "order",
        fields: [
          "id",
          "display_id",
          "metadata",
          "fulfillments.id",
          "fulfillments.location_id",
          "fulfillments.shipped_at",
          "fulfillments.metadata",
          "fulfillments.labels.tracking_number",
          "fulfillments.items.line_item_id",
          "fulfillments.items.quantity",
        ],
        filters: { display_id: displayId } as any,
      })

      const order = orders[0]
      if (!order) throw new Error(`Order ONX-${displayId} not found`)

      const fulfillments: any[] = (order as any).fulfillments ?? []
      if (!fulfillments.length) throw new Error(`Order ONX-${displayId} has no fulfillments`)

      // 2. Find the right fulfillment
      //    Priority: match by location_id (if configured) → first without tracking
      const existingTracking = (((order.metadata as any)?.tracking) ?? {}) as Record<string, string>

      const hasTracking = (f: any) =>
        !!f.labels?.[0]?.tracking_number ||
        !!f.metadata?.tracking_number ||
        !!existingTracking[f.id]

      let target: any

      if (warehouse.locationId) {
        target = fulfillments.find(
          (f: any) => f.location_id === warehouse.locationId && !hasTracking(f)
        )
        if (!target) {
          target = fulfillments.find((f: any) => f.location_id === warehouse.locationId)
        }
      }

      if (!target) {
        target = fulfillments.find((f: any) => !hasTracking(f))
      }

      if (!target) {
        throw new Error(
          `No suitable fulfillment found for ONX-${displayId}. ` +
          `All fulfillments may already have tracking numbers.`
        )
      }

      const trackingBaseUrl = warehouse.trackingBaseUrl

      if (!target.shipped_at) {
        // Not yet shipped → run the official workflow:
        //   • marks fulfillment as shipped (sets shipped_at)
        //   • attaches label so the email subscriber reads it from fulfillment.labels
        //   • fires shipment.created event → sends the customer notification
        const items = (target.items ?? [])
          .filter((i: any) => i.line_item_id)
          .map((i: any) => ({ id: i.line_item_id, quantity: Number(i.quantity) }))

        await createOrderShipmentWorkflow(container as any).run({
          input: {
            order_id: order.id,
            fulfillment_id: target.id,
            items,
            labels: [{
              tracking_number: trackingNumber,
              tracking_url: `${trackingBaseUrl}${trackingNumber}`,
              label_url: `${trackingBaseUrl}${trackingNumber}`,
            }],
          },
        })
        logger.info(
          `  ✅ Row ${sheetRow}: ONX-${displayId} → shipped + tracking ${trackingNumber}` +
          ` (fulfillment ${target.id.slice(0, 16)}…)`
        )
      } else {
        // Already shipped (e.g. marked shipped before tracking was entered).
        // Attach a real label so every surface (email, storefront, lookup)
        // builds the correct per-warehouse URL from fulfillment.labels.
        // Direct module update → no shipment.created event → no duplicate email.
        // target had no tracking label (hasTracking guard above), so this adds one.
        await fulfillmentModule.updateFulfillment(target.id, {
          labels: [{
            tracking_number: trackingNumber,
            tracking_url: `${trackingBaseUrl}${trackingNumber}`,
            label_url: `${trackingBaseUrl}${trackingNumber}`,
          }],
          metadata: {
            ...(target.metadata ?? {}),
            tracking_number: trackingNumber,
          },
        })
        // No shipment.created here → register the EasyPost tracker directly.
        await registerTrackerForFulfillment(container, target.id, trackingNumber)
        logger.info(
          `  ✅ Row ${sheetRow}: ONX-${displayId} → tracking updated (already shipped) ${trackingNumber}` +
          ` (fulfillment ${target.id.slice(0, 16)}…)`
        )
      }

      // Always also save to order metadata (used by storefront widget + admin panel)
      await orderService.updateOrders([{
        id: order.id,
        metadata: {
          ...(order.metadata as Record<string, any> ?? {}),
          tracking: {
            ...existingTracking,
            [target.id]: trackingNumber,
          },
        },
      }])

      sheetUpdates.push({ rowIdx: sheetRow, value: new Date().toISOString() })
      synced++

    } catch (err: any) {
      const msg = (err?.message ?? String(err)).slice(0, 200)
      logger.error(`  ❌ Row ${sheetRow}: ${msg}`)
      sheetUpdates.push({ rowIdx: sheetRow, value: `error: ${msg}` })
      errored++
    }
  }

  // Write all results to sheet in one batch request
  await flushResults(sheets, warehouse.spreadsheetId, warehouse.tabName, sheetUpdates, logger)

  return { synced, errored }
}

// ─── Job entry point ──────────────────────────────────────────────────────────

export default async function syncTrackingFromSheets(container: MedusaContainer) {
  const logger            = container.resolve("logger")
  const query             = container.resolve("query")
  const orderService      = container.resolve(Modules.ORDER)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)

  if (!WAREHOUSE_SHEETS.length) {
    logger.info("sync-tracking-from-sheets: no sheets configured — skipping")
    return
  }

  logger.info(`📊 sync-tracking-from-sheets: processing ${WAREHOUSE_SHEETS.length} warehouse sheet(s)...`)

  let sheets: sheets_v4.Sheets
  try {
    sheets = sheetsClient({ version: "v4", auth: buildAuth() })
  } catch (err: any) {
    logger.error(`❌ Google auth failed: ${err.message}`)
    return
  }

  let totalSynced = 0
  let totalErrored = 0

  for (const warehouse of WAREHOUSE_SHEETS) {
    const { synced, errored } = await processWarehouseSheet(
      sheets, warehouse, container, query, orderService, fulfillmentModule, logger
    )
    totalSynced  += synced
    totalErrored += errored
  }

  logger.info(`✅ sync-tracking-from-sheets done — ${totalSynced} synced, ${totalErrored} error(s)`)
}

export const config = {
  name: "sync-tracking-from-sheets",
  schedule: "*/15 * * * *",
}
