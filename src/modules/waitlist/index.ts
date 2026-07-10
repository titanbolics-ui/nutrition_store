import { Module } from "@medusajs/framework/utils"
import WaitlistModuleService from "./service"

export const WAITLIST_MODULE = "waitlist"

export default Module(WAITLIST_MODULE, {
  service: WaitlistModuleService,
})
