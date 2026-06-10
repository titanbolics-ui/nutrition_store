import { model } from "@medusajs/framework/utils"

export const MagicToken = model.define("magic_token", {
  id: model.id().primaryKey(),
  token_hash: model.text(),
  email: model.text(),
  order_id: model.text().nullable(),
  type: model.enum(["order_view", "login", "activate"]),
  expires_at: model.dateTime(),
  used_at: model.dateTime().nullable(),
})
