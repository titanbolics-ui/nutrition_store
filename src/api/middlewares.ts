import { defineMiddlewares } from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    {
      // 17track webhook signature = sha256(rawBody + "/" + key) — needs the raw bytes
      matcher: "/hooks/seventeen-track",
      method: ["POST"],
      bodyParser: { preserveRawBody: true },
    },
  ],
})
