import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ICustomerModuleService } from "@medusajs/types"
import { normalizePhone } from "../utils/phone"

// Copies the shipping-address phone onto the guest customer record so the
// WhatsApp bot can match the buyer by E.164 phone. Guards make replays no-ops:
// guests only (a registered customer's profile phone is authoritative — the
// shipping phone may belong to a recipient, not the buyer), only when
// customer.phone is empty, and only a confidently parsed E.164 is written.
export default async function orderPlacedCustomerPhoneHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const customerModuleSvc = container.resolve(
    Modules.CUSTOMER
  ) as ICustomerModuleService

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    filters: { id: data.id },
    fields: [
      "id",
      "customer_id",
      "shipping_address.phone",
      "shipping_address.country_code",
    ],
  })

  const rawPhone = order?.shipping_address?.phone
  if (!order?.customer_id || !rawPhone) return

  const phone = normalizePhone(
    String(rawPhone),
    order.shipping_address?.country_code ?? undefined
  )
  if (!phone) return

  const [customer] = await customerModuleSvc.listCustomers({
    id: order.customer_id,
  })
  if (!customer || customer.has_account || customer.phone) return

  await customerModuleSvc.updateCustomers(customer.id, { phone })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
