import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export type WarehouseItemsMetadata = Record<
  string,
  { locationName: string; items: { title: string; quantity: number }[] }
>

export type ItemLocation = { locationId: string; locationName: string }

// First inventory level of the variant decides the warehouse — same rule the
// checkout hook (filter-shipping-options) uses for carts.
export function resolveItemLocation(item: any): ItemLocation | null {
  if (!item?.variant?.manage_inventory) return null
  for (const invItem of item.variant?.inventory_items ?? []) {
    const level = invItem.inventory?.location_levels?.[0]
    if (level?.location_id) {
      return {
        locationId: level.location_id,
        locationName:
          level.stock_locations?.[0]?.name ?? level.location_id,
      }
    }
  }
  return null
}

export const ORDER_ITEM_LOCATION_FIELDS = [
  "items.*",
  "items.variant.manage_inventory",
  "items.variant.inventory_items.inventory.location_levels.location_id",
  "items.variant.inventory_items.inventory.location_levels.stock_locations.name",
]

/**
 * Recompute order.metadata.warehouse_items from the CURRENT order items.
 * The checkout hook writes this snapshot at cart time; order edits change the
 * items but never the snapshot — this brings it back in sync.
 *
 * Non-inventory items keep their previous assignment from the old snapshot.
 */
export async function rebuildOrderWarehouseItems(
  container: MedusaContainer,
  orderId: string
): Promise<WarehouseItemsMetadata | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "metadata", ...ORDER_ITEM_LOCATION_FIELDS],
    filters: { id: orderId },
  })
  const order = orders[0] as any
  if (!order?.items?.length) return null

  const oldMeta = ((order.metadata as any)?.warehouse_items ??
    {}) as WarehouseItemsMetadata
  const oldLocationByTitle = new Map<string, ItemLocation>()
  for (const [locId, m] of Object.entries(oldMeta)) {
    for (const it of m.items) {
      oldLocationByTitle.set(it.title, {
        locationId: locId,
        locationName: m.locationName,
      })
    }
  }

  const result: WarehouseItemsMetadata = {}
  for (const item of order.items.filter(Boolean)) {
    const loc =
      resolveItemLocation(item) ??
      oldLocationByTitle.get(item.title) ??
      (item.product_title ? oldLocationByTitle.get(item.product_title) : undefined) ??
      null
    if (!loc) continue

    if (!result[loc.locationId]) {
      result[loc.locationId] = { locationName: loc.locationName, items: [] }
    }
    result[loc.locationId].items.push({
      title: item.title,
      quantity: Number(item.quantity) || 0,
    })
  }

  if (!Object.keys(result).length) return null

  const orderModule = container.resolve(Modules.ORDER) as any
  await orderModule.updateOrders([
    {
      id: orderId,
      metadata: { ...(order.metadata ?? {}), warehouse_items: result },
    },
  ])

  return result
}
