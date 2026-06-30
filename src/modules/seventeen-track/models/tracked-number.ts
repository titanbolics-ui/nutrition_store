import { model } from "@medusajs/framework/utils"

// One row = one tracking number currently registered in the 17track pool
// (free plan: 40 active trackings). Rows are deleted once delivered/expired.
export const TrackedNumber = model.define("seventeen_track_number", {
  id: model.id().primaryKey(),
  tracking_number: model.text().unique(),
  fulfillment_id: model.text(),
  order_id: model.text(),
  display_id: model.number().nullable(),
  carrier: model.number().nullable(),
  last_status: model.text().nullable(),
  registered_at: model.dateTime(),
})
