import { MedusaContainer } from "@medusajs/types"
import { Modules } from "@medusajs/framework/utils"
import { auth as googleAuth, sheets as sheetsClient, sheets_v4 } from "@googleapis/sheets"
import {
  ORDER_ITEM_LOCATION_FIELDS,
  resolveItemLocation,
} from "../utils/order-warehouse-items"

// ─── Warehouse config ─────────────────────────────────────────────────────────
// Columns:
//   A: Order #   B: Amount (items + shipping)   C: Date   D: Payment   E: Customer
//   F: Items     G: Notes                        H: Order Status
//   I: Tracking (empty)   J: Synced (empty)      K: Time of delivery (empty)

const WAREHOUSE_SHEETS = [
  {
    name:          "Main Warehouse",
    spreadsheetId: process.env.SHEETS_MAIN_SPREADSHEET_ID       || "",
    tabName:       process.env.SHEETS_MAIN_TAB_NAME              || "Sheet1",
    locationId:    process.env.SHEETS_MAIN_LOCATION_ID           || "",
    shipping:      31, // fixed shipping cost for this warehouse
  },
  {
    name:          "US Domestic",
    spreadsheetId: process.env.SHEETS_US_DOMESTIC_SPREADSHEET_ID || "",
    tabName:       process.env.SHEETS_US_DOMESTIC_TAB_NAME        || "Sheet1",
    locationId:    process.env.SHEETS_US_DOMESTIC_LOCATION_ID     || "",
    shipping:      20,
  },
].filter((w) => w.spreadsheetId && w.locationId)

// ─── Auth ─────────────────────────────────────────────────────────────────────

function buildAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY env var is not set")
  try {
    const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")
    return new googleAuth.GoogleAuth({
      credentials: JSON.parse(text),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY must be valid JSON or base64-encoded JSON")
  }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric" })
}

function formatPaymentProvider(providerId: string): string {
  if (providerId.includes("cash-app"))      return "BTC"
  if (providerId.includes("crypto-manual")) return "BTC"
  if (providerId.includes("paypal-manual")) return "PayPal"
  if (providerId.includes("card-manual"))   return "Card"
  return providerId
}

function formatCustomer(order: any): string {
  const a = order.shipping_address
  if (!a) return order.email ?? ""
  const name     = [a.first_name, a.last_name].filter(Boolean).join(" ")
  const line1    = a.address_1 ?? ""
  const line2    = a.address_2 ? `\n${a.address_2}` : ""
  const cityLine = [a.city, a.province, a.postal_code].filter(Boolean).join(" ")
  const country  = (a.country_code ?? "").toUpperCase()
  return [name, line1 + line2, cityLine, country].filter(Boolean).join("\n")
}

// "2x Exemestane ZPHC 25mg"
function formatItems(items: any[]): string {
  return items
    .map((i) => `${Number(i.quantity)}x ${i.product_title ?? i.title ?? ""}`.trim())
    .join("\n")
}

// Effective per-unit price from the backend-computed line total — includes
// manual discounts / promotion adjustments that unit_price doesn't (G4).
function effectiveUnitPrice(item: any): number {
  const qty = Number(item.quantity) || 1
  const total = Number(item.total)
  if (!isNaN(total)) return total / qty
  return Number(item.unit_price ?? 0)
}

// item subtotal for a list of items (quantity may be the per-warehouse share,
// so effective_unit_price is captured from the full line before any override)
function calcSubtotal(items: any[]): number {
  return items.reduce(
    (sum, i) =>
      sum + Number(i.effective_unit_price ?? effectiveUnitPrice(i)) * (Number(i.quantity) || 1),
    0
  )
}

// Build notes string from applied discounts / credits / gift cards
function buildNotes(order: any): string {
  const notes: string[] = []

  const creditLines: any[] = order.credit_lines ?? []

  const storeCredit = creditLines
    .filter((l: any) => l.reference === "store-credit")
    .reduce((s: number, l: any) => s + Number(l.amount ?? 0), 0)
  if (storeCredit > 0) notes.push(`Store credit: -$${storeCredit}`)

  const giftCard = creditLines
    .filter((l: any) => l.reference === "gift-card")
    .reduce((s: number, l: any) => s + Number(l.amount ?? 0), 0)
  if (giftCard > 0) notes.push(`Gift card: -$${giftCard}`)

  const promotions: any[] = order.promotions ?? []
  if (promotions.length > 0) {
    const codes = promotions.map((p: any) => p.code).filter(Boolean).join(", ")
    const discountTotal = Number(order.discount_total ?? 0)
    notes.push(`Promo${codes ? ` (${codes})` : ""}: -$${discountTotal}`)
  }

  return notes.length > 0 ? notes.join(" | ") : "-"
}

// Total store credit applied to an order (for deducting from Main Warehouse)
function totalStoreCredit(order: any): number {
  return (order.credit_lines ?? [])
    .filter((l: any) => l.reference === "store-credit" || l.reference === "gift-card")
    .reduce((s: number, l: any) => s + Number(l.amount ?? 0), 0)
}

// ─── Sheet helpers ────────────────────────────────────────────────────────────

type ExistingRow = { rowNumber: number; amount: string; items: string; notes: string }

// displayId → existing row (1-based row number + current B/F/G values)
async function getExistingRows(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string
): Promise<Map<string, ExistingRow>> {
  const map = new Map<string, ExistingRow>()
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A2:G`,
    })
    const values = (res.data.values ?? []) as string[][]
    values.forEach((r, i) => {
      const id = String(r[0] ?? "").trim()
      if (!id) return
      map.set(id, {
        rowNumber: i + 2, // A2 = row 2
        amount: String(r[1] ?? "").trim(),
        items: String(r[5] ?? "").trim(),
        notes: String(r[6] ?? "").trim(),
      })
    })
  } catch {
    // sheet unreadable — treat as empty, inserts will still dedupe next run
  }
  return map
}

async function insertRowsAtTop(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string,
  rows: any[][],
  logger: any
) {
  if (!rows.length) return
  try {
    // 1. Get the sheet ID by name
    const meta = await sheets.spreadsheets.get({ spreadsheetId })
    const sheet = meta.data.sheets?.find(
      (s) => s.properties?.title === tabName
    )
    if (!sheet) {
      logger.error(`  ❌ Sheet tab "${tabName}" not found`)
      return
    }
    const sheetId = sheet.properties!.sheetId!

    // 2. Insert N empty rows right after the header (index 1 = row 2)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          insertDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: 1,          // after header row (0-indexed)
              endIndex: 1 + rows.length,
            },
            inheritFromBefore: false,
          },
        }],
      },
    })

    // 3. Write data into the newly created rows
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A2`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    })
  } catch (err: any) {
    logger.error(`  ❌ Failed to insert rows in ${tabName}: ${err.message}`)
  }
}

// ─── Job ──────────────────────────────────────────────────────────────────────

export default async function syncOrdersToSheets(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const query  = container.resolve("query")
  const orderModule = container.resolve(Modules.ORDER) as any

  if (!WAREHOUSE_SHEETS.length) {
    logger.info("sync-orders-to-sheets: no sheets configured — skipping")
    return
  }

  logger.info("📋 sync-orders-to-sheets: starting...")

  let sheets: sheets_v4.Sheets
  try {
    sheets = sheetsClient({ version: "v4", auth: buildAuth() })
  } catch (err: any) {
    logger.error(`❌ Google auth failed: ${err.message}`)
    return
  }

  // 1. Fetch orders from the last 60 days
  const since = new Date()
  since.setDate(since.getDate() - 60)

  const { data: allOrders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "created_at",
      "currency_code",
      "metadata",
      // order-level total triggers the totals decorator — without it
      // items.* comes back WITHOUT computed item.total (G4/G5)
      "total",
      "+payment_status",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.captured_at",
      "payment_collections.payment_sessions.provider_id",
      "shipping_address.*",
      // items.* — explicit subfield lists drop computed fields (quantity);
      // location fields enable live warehouse resolution for items missing
      // from the metadata snapshot (e.g. items added via order edit)
      ...ORDER_ITEM_LOCATION_FIELDS,
      "credit_lines.reference",
      "credit_lines.amount",
      "promotions.code",
      "+discount_total",
    ],
    pagination: { skip: 0, take: 500 },
  })

  // Keep only captured orders within the time window
  const orders = allOrders.filter((o: any) => {
    const captured =
      o.payment_status === "captured" ||
      (o.payment_collections ?? []).some((pc: any) =>
        (pc.payments ?? []).some((p: any) => !!p.captured_at)
      )
    return captured && new Date(o.created_at) >= since
  })

  logger.info(`  Found ${orders.length} captured order(s) in the last 60 days`)
  logger.info(`  Configured warehouses: ${WAREHOUSE_SHEETS.map((w) => `${w.name}=${w.locationId}`).join(", ")}`)
  if (!orders.length) return

  // 2. Pre-load existing rows (order # + current values) from each sheet tab
  const existingBySheet = new Map<string, Map<string, ExistingRow>>()
  for (const w of WAREHOUSE_SHEETS) {
    const key = `${w.spreadsheetId}::${w.tabName}`
    existingBySheet.set(key, await getExistingRows(sheets, w.spreadsheetId, w.tabName))
  }

  const rowsBySheet = new Map<string, any[][]>()
  // value-range updates for rows whose items changed after sync (order edits)
  const updatesBySheet = new Map<string, { range: string; values: any[][] }[]>()
  for (const w of WAREHOUSE_SHEETS) {
    rowsBySheet.set(`${w.spreadsheetId}::${w.tabName}`, [])
    updatesBySheet.set(`${w.spreadsheetId}::${w.tabName}`, [])
  }

  let added = 0
  let updated = 0

  // numeric compare tolerant to currency formatting in sheet cells
  const num = (v: any) => Number(String(v ?? "").replace(/[^0-9.-]/g, ""))
  const sameAmount = (a: any, b: any) =>
    !isNaN(num(a)) && !isNaN(num(b)) && Math.abs(num(a) - num(b)) < 0.01

  for (const order of orders) {
    const displayId = String(order.display_id)

    // What this job last wrote per warehouse ({amount, items, notes}) — used to
    // tell our own writes apart from manual sheet edits, which we never touch.
    const syncMeta = {
      ...(((order.metadata as any)?.sheets_sync ?? {}) as Record<
        string,
        {
          amount: string
          items: string
          notes: string
          // cells the admin edited by hand — the job never writes these again
          manual?: { amount?: boolean; items?: boolean; notes?: boolean }
        }
      >),
    }
    let syncMetaDirty = false

    // Payment provider
    const providerId =
      (order as any).payment_collections?.[0]?.payments?.[0]?.provider_id ||
      (order as any).payment_collections?.[0]?.payment_sessions?.[0]?.provider_id ||
      ""
    const paymentMethod = formatPaymentProvider(providerId)

    // Build index of order items: title → item (for matching with warehouse_items metadata)
    const orderItems: any[] = order.items ?? []
    const itemByTitle = new Map<string, any>()
    for (const item of orderItems) {
      // Index by both product_title and title for flexible matching
      if (item.product_title) itemByTitle.set(item.product_title, item)
      if (item.title)         itemByTitle.set(item.title, item)
    }

    // warehouse_items metadata: { [locationId]: { locationName, items: [{title, quantity}] } }
    const warehouseMeta = ((order.metadata as any)?.warehouse_items ?? {}) as Record<
      string,
      { locationName: string; items: { title: string; quantity: number }[] }
    >

    // Build warehouseItemsMap: locationId → full order items for that warehouse
    const warehouseItemsMap = new Map<string, any[]>()
    const coveredItemIds = new Set<string>()

    if (Object.keys(warehouseMeta).length > 0) {
      for (const [locId, meta] of Object.entries(warehouseMeta)) {
        const matched: any[] = []
        for (const mi of meta.items) {
          const full = itemByTitle.get(mi.title)
          if (!full) {
            // item was removed by an order edit — the snapshot is stale, skip it
            logger.warn(
              `  ⚠️ Order #${displayId}: "${mi.title}" in warehouse_items metadata but not in order — skipping (removed via edit?)`
            )
            continue
          }
          matched.push({
            ...full,
            quantity: mi.quantity,
            effective_unit_price: effectiveUnitPrice(full),
          })
          coveredItemIds.add(full.id)
        }
        if (matched.length) warehouseItemsMap.set(locId, matched)
      }
    }

    // Items not covered by the metadata snapshot (added via order edit, or no
    // snapshot at all) — resolve warehouse from live inventory levels
    for (const item of orderItems) {
      if (coveredItemIds.has(item.id)) continue
      const loc = resolveItemLocation(item)
      const locationId = loc?.locationId ?? WAREHOUSE_SHEETS[0]?.locationId
      if (!locationId) continue
      if (!loc) {
        logger.warn(
          `  ⚠️ Order #${displayId}: no inventory location for "${item.product_title ?? item.title}" — defaulting to ${WAREHOUSE_SHEETS[0]?.name}`
        )
      }
      const list = warehouseItemsMap.get(locationId) ?? []
      list.push(item)
      warehouseItemsMap.set(locationId, list)
    }

    // Create a row for each warehouse that has items in this order
    for (const warehouse of WAREHOUSE_SHEETS) {
      const warehouseItems = warehouseItemsMap.get(warehouse.locationId)
      if (!warehouseItems?.length) continue

      const sheetKey = `${warehouse.spreadsheetId}::${warehouse.tabName}`
      const existing = existingBySheet.get(sheetKey)!

      // Amount = item subtotal for this warehouse + fixed shipping cost
      // Store credit is deducted only from Main Warehouse (first in config)
      const itemSubtotal = calcSubtotal(warehouseItems)
      const isMain = warehouse === WAREHOUSE_SHEETS[0]
      const creditDeduction = isMain ? totalStoreCredit(order) : 0
      const amount = Math.max(0, itemSubtotal + warehouse.shipping - creditDeduction)

      const notes = buildNotes(order)
      const itemsText = formatItems(warehouseItems)

      const existingRow = existing.get(displayId)
      if (existingRow) {
        // Row already synced. We only ever rewrite cells that still hold what
        // WE last wrote (snapshot in order.metadata.sheets_sync) — a cell the
        // admin edited by hand is theirs from then on. H–K never touched.
        const managed = syncMeta[warehouse.locationId]

        if (!managed) {
          // legacy row from before snapshots existed — adopt current sheet
          // values as the baseline; computed corrections apply from next run
          syncMeta[warehouse.locationId] = {
            amount: existingRow.amount,
            items: existingRow.items,
            notes: existingRow.notes,
            manual: {},
          }
          syncMetaDirty = true
          logger.info(`  📌 Order #${displayId}: baseline recorded for ${warehouse.name}`)
          continue
        }

        const upd: { range: string; values: any[][] }[] = []
        const r = existingRow.rowNumber

        const cur: any = { manual: {}, ...managed }
        cur.manual = { ...(cur.manual ?? {}) }
        const textEq = (a: any, b: any) => String(a ?? "").trim() === String(b ?? "").trim()
        const cells: {
          key: "amount" | "items" | "notes"
          col: string
          sheetVal: string
          computed: any
          eq: (a: any, b: any) => boolean
        }[] = [
          { key: "amount", col: "B", sheetVal: existingRow.amount, computed: amount, eq: sameAmount },
          { key: "items",  col: "F", sheetVal: existingRow.items,  computed: itemsText, eq: textEq },
          { key: "notes",  col: "G", sheetVal: existingRow.notes,  computed: notes, eq: textEq },
        ]

        for (const c of cells) {
          if (cur.manual[c.key]) {
            // human-owned cell — never write; release the flag only if the
            // human re-aligned it with the computed value
            if (c.eq(c.sheetVal, c.computed)) {
              cur.manual[c.key] = false
              cur[c.key] = c.sheetVal
              syncMetaDirty = true
            }
            continue
          }
          if (!c.eq(c.sheetVal, cur[c.key])) {
            // sheet differs from what we last wrote → manually edited
            cur[c.key] = c.sheetVal
            syncMetaDirty = true
            if (!c.eq(c.sheetVal, c.computed)) {
              cur.manual[c.key] = true
              logger.warn(
                `  ✋ Order #${displayId} ${warehouse.name}: ${c.key} manually edited — job will not touch it ` +
                `(sheet "${String(c.sheetVal).slice(0, 40)}", computed "${String(c.computed).slice(0, 40)}")`
              )
            }
          } else if (!c.eq(cur[c.key], c.computed)) {
            upd.push({ range: `${warehouse.tabName}!${c.col}${r}`, values: [[c.computed]] })
            cur[c.key] = String(c.computed)
            syncMetaDirty = true
          }
        }

        syncMeta[warehouse.locationId] = cur

        if (upd.length) {
          updatesBySheet.get(sheetKey)!.push(...upd)
          updated++
          logger.info(`  🔄 Order #${displayId} changed — updating ${upd.length} cell(s) in row ${r} of ${warehouse.name}`)
        } else {
          logger.info(`  ⏭️  Order #${displayId} already in ${warehouse.name}`)
        }
        continue
      }

      const row = [
        displayId,                              // A: Order #
        amount,                                 // B: Amount (items + shipping - credit if Main)
        formatDate(order.created_at as string), // C: Date
        paymentMethod,                          // D: Payment method
        formatCustomer(order),                  // E: Customer (multiline)
        itemsText,                              // F: Items (multiline)
        notes,                                  // G: Notes (credit / promo / gift card)
        "Human Review",                         // H: Order Status
        "",                                     // I: Tracking (empty)
        "",                                     // J: Synced (empty)
        "",                                     // K: Time of delivery (empty)
      ]

      rowsBySheet.get(sheetKey)!.push(row)
      existing.set(displayId, { rowNumber: -1, amount: String(amount), items: itemsText, notes })
      syncMeta[warehouse.locationId] = { amount: String(amount), items: itemsText, notes, manual: {} }
      syncMetaDirty = true
      added++
      logger.info(
        `  ✅ Order #${displayId} → ${warehouse.name}: ` +
        `${warehouseItems.length} item(s), subtotal=${itemSubtotal}, shipping=${warehouse.shipping}, total=${amount}`
      )
    }

    if (syncMetaDirty) {
      try {
        await orderModule.updateOrders([{
          id: order.id,
          metadata: { ...((order.metadata as any) ?? {}), sheets_sync: syncMeta },
        }])
      } catch (err: any) {
        logger.warn(`  ⚠️ Order #${displayId}: failed to persist sheets_sync snapshot — ${err?.message}`)
      }
    }
  }

  // 3. Apply row updates first — inserting rows at the top shifts row numbers
  for (const warehouse of WAREHOUSE_SHEETS) {
    const sheetKey = `${warehouse.spreadsheetId}::${warehouse.tabName}`
    const updates = updatesBySheet.get(sheetKey)!
    if (updates.length) {
      try {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: warehouse.spreadsheetId,
          requestBody: { valueInputOption: "USER_ENTERED", data: updates },
        })
        logger.info(`  🔄 Updated ${updates.length / 2} changed row(s) in ${warehouse.name}`)
      } catch (err: any) {
        logger.error(`  ❌ Failed to update rows in ${warehouse.name}: ${err.message}`)
      }
    }
  }

  // 4. Append new rows in batch per sheet
  for (const warehouse of WAREHOUSE_SHEETS) {
    const sheetKey = `${warehouse.spreadsheetId}::${warehouse.tabName}`
    const rows = rowsBySheet.get(sheetKey)!
    if (rows.length) {
      await insertRowsAtTop(sheets, warehouse.spreadsheetId, warehouse.tabName, [...rows].reverse(), logger)
      logger.info(`  📤 Inserted ${rows.length} row(s) at top of ${warehouse.name}`)
    }
  }

  logger.info(`✅ sync-orders-to-sheets done — ${added} new, ${updated} updated`)
}

export const config = {
  name: "sync-orders-to-sheets",
  schedule: "*/15 * * * *",
}
