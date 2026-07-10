import { model } from "@medusajs/framework/utils"

export const Waitlist = model.define("waitlist", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  variant_id: model.text(),
  email: model.text(),
  marketing_consent: model.boolean(),
  resend_contact_id: model.text().nullable(),
  notified_at: model.dateTime().nullable(),
})
