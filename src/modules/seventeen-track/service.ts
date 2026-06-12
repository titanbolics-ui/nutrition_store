import { MedusaService } from "@medusajs/framework/utils"
import { TrackedNumber } from "./models/tracked-number"

class SeventeenTrackModuleService extends MedusaService({ TrackedNumber }) {}

export default SeventeenTrackModuleService
