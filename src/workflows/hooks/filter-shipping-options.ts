import { ICartModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  listShippingOptionsForCartWithPricingWorkflow,
  listShippingOptionsForCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { StepResponse } from "@medusajs/workflows-sdk"

export type WarehouseItemsMetadata = Record<
  string,
  { locationName: string; items: { title: string; quantity: number }[] }
>

async function buildProfileToLocationMap(
  fulfillmentSetIds: string[],
  container: any
): Promise<Map<string, { locationId: string; locationName: string }>> {
  if (!fulfillmentSetIds.length) return new Map()

  const query = container.resolve("query")

  // Get stock locations with their fulfillment sets
  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name", "fulfillment_sets.id"],
  })

  // fulfillmentSetId → { locationId, locationName }
  const fsToLocation = new Map<
    string,
    { locationId: string; locationName: string }
  >()
  for (const loc of locations) {
    for (const fs of loc.fulfillment_sets ?? []) {
      if (fulfillmentSetIds.includes(fs.id)) {
        fsToLocation.set(fs.id, { locationId: loc.id, locationName: loc.name })
      }
    }
  }

  if (!fsToLocation.size) return new Map()

  // Get shipping options to map shipping_profile_id → fulfillment_set_id
  const { data: sos } = await query.graph({
    entity: "shipping_option",
    filters: { service_zone: { fulfillment_set_id: Array.from(fsToLocation.keys()) } },
    fields: ["shipping_profile_id", "service_zone.fulfillment_set_id"],
  })

  const profileToLocation = new Map<
    string,
    { locationId: string; locationName: string }
  >()
  for (const so of sos) {
    const fsId = (so as any).service_zone?.fulfillment_set_id
    const profileId = so.shipping_profile_id
    if (profileId && fsId && fsToLocation.has(fsId)) {
      profileToLocation.set(profileId, fsToLocation.get(fsId)!)
    }
  }

  return profileToLocation
}

async function buildWarehouseMapping(
  cartId: string,
  fulfillmentSetIds: string[],
  container: any
): Promise<WarehouseItemsMetadata> {
  const query = container.resolve("query")

  let profileToLocation = new Map<string, { locationId: string; locationName: string }>()
  try {
    profileToLocation = await buildProfileToLocationMap(fulfillmentSetIds, container)
  } catch (e) {
    // profile lookup is best-effort; non-inventory items may not be mapped
  }

  const { data: carts } = await query.graph({
    entity: "cart",
    filters: { id: cartId },
    fields: [
      "items.title",
      "items.quantity",
      "items.variant.manage_inventory",
      "items.variant.product.shipping_profile_id",
      "items.variant.inventory_items.inventory.location_levels.location_id",
      "items.variant.inventory_items.inventory.location_levels.stock_locations.id",
      "items.variant.inventory_items.inventory.location_levels.stock_locations.name",
    ],
  })

  const cart = carts[0]
  if (!cart?.items?.length) return {}

  const warehouseItems: WarehouseItemsMetadata = {}

  for (const item of cart.items) {
    let locationId: string | null = null
    let locationName: string | null = null

    // Use inventory levels to determine warehouse.
    // Non-inventory items are skipped here — with a single shared shipping profile
    // across multiple warehouses the profile→location map is ambiguous.
    // sync-orders-to-sheets consolidates unmatched items with the rest of the order.
    if (item.variant?.manage_inventory) {
      for (const invItem of item.variant?.inventory_items ?? []) {
        const level = invItem.inventory?.location_levels?.[0]
        if (level?.location_id) {
          locationId = level.location_id
          locationName = level.stock_locations?.[0]?.name ?? level.location_id
          break
        }
      }
    }

    if (!locationId) continue

    if (!warehouseItems[locationId]) {
      warehouseItems[locationId] = {
        locationName: locationName ?? locationId,
        items: [],
      }
    }
    warehouseItems[locationId].items.push({
      title: item.title,
      quantity: item.quantity,
    })
  }

  return warehouseItems
}

const hookHandler = async (
  { cart, fulfillmentSetIds }: { cart: any; fulfillmentSetIds: string[] },
  { container }: any
) => {
  try {
    const warehouseItems = await buildWarehouseMapping(cart.id, fulfillmentSetIds, container)

    if (Object.keys(warehouseItems).length) {
      const cartService: ICartModuleService = container.resolve(Modules.CART)
      await cartService.updateCarts([
        { id: cart.id, metadata: { warehouse_items: warehouseItems } },
      ])
    }

    const locationIds = Object.keys(warehouseItems)
    if (!locationIds.length) return new StepResponse(undefined)
    return new StepResponse({ available_location_ids: locationIds })
  } catch (err) {
    console.error("[filter-shipping-options hook] error:", err)
    return new StepResponse(undefined)
  }
}

listShippingOptionsForCartWithPricingWorkflow.hooks.setShippingOptionsContext(
  hookHandler
)

listShippingOptionsForCartWorkflow.hooks.setShippingOptionsContext(hookHandler)
