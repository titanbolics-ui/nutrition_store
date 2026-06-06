import { MedusaContainer } from "@medusajs/types"
import { auth as googleAuth, sheets as sheetsClient, sheets_v4 } from "@googleapis/sheets"

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

// item subtotal for a list of items
function calcSubtotal(items: any[]): number {
  return items.reduce((sum, i) => sum + Number(i.unit_price ?? 0) * Number(i.quantity ?? 1), 0)
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

async function getExistingOrderNumbers(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string
): Promise<Set<string>> {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A2:A`,
    })
    const values = (res.data.values ?? []) as string[][]
    return new Set(values.map((r) => String(r[0] ?? "").trim()).filter(Boolean))
  } catch {
    return new Set()
  }
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
      "+payment_status",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.captured_at",
      "payment_collections.payment_sessions.provider_id",
      "shipping_address.*",
      "items.id",
      "items.title",
      "items.product_title",
      "items.quantity",
      "items.unit_price",
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

  // 2. Pre-load existing order numbers from each sheet tab
  const existingBySheet = new Map<string, Set<string>>()
  for (const w of WAREHOUSE_SHEETS) {
    const key = `${w.spreadsheetId}::${w.tabName}`
    existingBySheet.set(key, await getExistingOrderNumbers(sheets, w.spreadsheetId, w.tabName))
  }

  const rowsBySheet = new Map<string, any[][]>()
  for (const w of WAREHOUSE_SHEETS) {
    rowsBySheet.set(`${w.spreadsheetId}::${w.tabName}`, [])
  }

  let added = 0

  for (const order of orders) {
    const displayId = String(order.display_id)

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

    if (Object.keys(warehouseMeta).length > 0) {
      for (const [locId, meta] of Object.entries(warehouseMeta)) {
        const matched = meta.items.map((mi) => {
          // Try matching by exact title, then product_title
          const full = itemByTitle.get(mi.title)
          if (full) return { ...full, quantity: mi.quantity }
          // Fallback: return metadata item (no unit_price available)
          return { product_title: mi.title, title: mi.title, quantity: mi.quantity, unit_price: 0 }
        })
        warehouseItemsMap.set(locId, matched)
      }

      // Items not in warehouse_items metadata (e.g. non-inventory items) go into whichever
      // warehouse already has the most items from this order.
      const coveredTitles = new Set<string>()
      for (const items of warehouseItemsMap.values()) {
        for (const item of items) {
          if (item.product_title) coveredTitles.add(item.product_title)
          if (item.title) coveredTitles.add(item.title)
        }
      }
      const uncovered = orderItems.filter(
        (item) => !coveredTitles.has(item.product_title) && !coveredTitles.has(item.title)
      )
      if (uncovered.length > 0) {
        let targetLocId = ""
        let maxSize = 0
        for (const [locId, items] of warehouseItemsMap) {
          if (items.length > maxSize) { maxSize = items.length; targetLocId = locId }
        }
        if (targetLocId) {
          warehouseItemsMap.get(targetLocId)!.push(...uncovered)
        }
      }
    } else {
      // No warehouse metadata — assign all items to the first configured warehouse
      if (WAREHOUSE_SHEETS[0]) {
        warehouseItemsMap.set(WAREHOUSE_SHEETS[0].locationId, orderItems)
      }
    }

    // Create a row for each warehouse that has items in this order
    for (const warehouse of WAREHOUSE_SHEETS) {
      const warehouseItems = warehouseItemsMap.get(warehouse.locationId)
      if (!warehouseItems?.length) continue

      const sheetKey = `${warehouse.spreadsheetId}::${warehouse.tabName}`
      const existing = existingBySheet.get(sheetKey)!

      if (existing.has(displayId)) {
        logger.info(`  ⏭️  Order #${displayId} already in ${warehouse.name}`)
        continue
      }

      // Amount = item subtotal for this warehouse + fixed shipping cost
      // Store credit is deducted only from Main Warehouse (first in config)
      const itemSubtotal = calcSubtotal(warehouseItems)
      const isMain = warehouse === WAREHOUSE_SHEETS[0]
      const creditDeduction = isMain ? totalStoreCredit(order) : 0
      const amount = Math.max(0, itemSubtotal + warehouse.shipping - creditDeduction)

      const notes = buildNotes(order)

      const row = [
        displayId,                              // A: Order #
        amount,                                 // B: Amount (items + shipping - credit if Main)
        formatDate(order.created_at as string), // C: Date
        paymentMethod,                          // D: Payment method
        formatCustomer(order),                  // E: Customer (multiline)
        formatItems(warehouseItems),            // F: Items (multiline)
        notes,                                  // G: Notes (credit / promo / gift card)
        "Human Review",                         // H: Order Status
        "",                                     // I: Tracking (empty)
        "",                                     // J: Synced (empty)
        "",                                     // K: Time of delivery (empty)
      ]

      rowsBySheet.get(sheetKey)!.push(row)
      existing.add(displayId)
      added++
      logger.info(
        `  ✅ Order #${displayId} → ${warehouse.name}: ` +
        `${warehouseItems.length} item(s), subtotal=${itemSubtotal}, shipping=${warehouse.shipping}, total=${amount}`
      )
    }
  }

  // 3. Append in batch per sheet
  for (const warehouse of WAREHOUSE_SHEETS) {
    const sheetKey = `${warehouse.spreadsheetId}::${warehouse.tabName}`
    const rows = rowsBySheet.get(sheetKey)!
    if (rows.length) {
      await insertRowsAtTop(sheets, warehouse.spreadsheetId, warehouse.tabName, [...rows].reverse(), logger)
      logger.info(`  📤 Inserted ${rows.length} row(s) at top of ${warehouse.name}`)
    }
  }

  logger.info(`✅ sync-orders-to-sheets done — ${added} new order(s) added`)
}

export const config = {
  name: "sync-orders-to-sheets",
  schedule: "*/15 * * * *",
}
