import { Module } from "@medusajs/framework/utils"
import MagicTokenModuleService from "./service"

export const MAGIC_TOKEN_MODULE = "magicToken"

export default Module(MAGIC_TOKEN_MODULE, {
  service: MagicTokenModuleService,
})
