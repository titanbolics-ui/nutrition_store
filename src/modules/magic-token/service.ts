import { MedusaService } from "@medusajs/framework/utils"
import { MagicToken } from "./models/magic-token"

class MagicTokenModuleService extends MedusaService({ MagicToken }) {}

export default MagicTokenModuleService
