import {
  defineMiddlewares,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { normalizeBodyPhone } from "../utils/phone"

export default defineMiddlewares({
  routes: [
    {
      // 17track webhook signature = sha256(rawBody + "/" + key) — needs the raw bytes
      matcher: "/hooks/seventeen-track",
      method: ["POST"],
      bodyParser: { preserveRawBody: true },
    },
    {
      // Profile updates write customer.phone via the core route — normalize at the source
      matcher: "/store/customers/me",
      method: ["POST"],
      middlewares: [
        (req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) => {
          normalizeBodyPhone(req.body)
          next()
        },
      ],
    },
  ],
})
