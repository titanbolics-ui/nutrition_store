import { Module } from "@medusajs/framework/utils"
import SeventeenTrackModuleService from "./service"

export const SEVENTEEN_TRACK_MODULE = "seventeenTrack"

export default Module(SEVENTEEN_TRACK_MODULE, {
  service: SeventeenTrackModuleService,
})
