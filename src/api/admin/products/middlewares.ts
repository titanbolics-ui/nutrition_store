import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http"
import { validateProductContent } from "../../../utils/product-content-schema"

/**
 * updateProductsWorkflow/createProductsWorkflow only expose a post-persist
 * hook (productsUpdated) — too late to reject a bad save. Validating here,
 * before the built-in route handler runs, is what lets a typo in
 * metadata.content get rejected with a readable error instead of silently
 * corrupting a page. Only inspects metadata.content — every other field in
 * the body passes through untouched.
 *
 * Normalizes the value in place: the Admin dashboard's generic metadata
 * table submits every value as a plain string (including this one), so a
 * valid submission is JSON-encoded text, not an object. validateProductContent
 * parses it; on success we overwrite metadata.content with the parsed object
 * so what actually gets persisted — and what every downstream reader (this
 * backend, the storefront) sees — is always a real object, never the raw
 * string. The core route's own body validation (which populates
 * req.validatedBody from a snapshot of req.body) can run before this
 * middleware in the chain, so both req.body.metadata and
 * req.validatedBody.metadata are patched — whichever one the built-in route
 * handler actually reads ends up with the parsed object.
 */
function validateContentMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const bodyMetadata = (req.body as Record<string, any> | undefined)?.metadata
  const validatedMetadata = (req as any).validatedBody?.metadata as
    | Record<string, any>
    | undefined

  const content = bodyMetadata?.content ?? validatedMetadata?.content

  if (content === undefined || content === null || content === "") {
    return next()
  }

  const result = validateProductContent(content)
  if (!result.ok) {
    return res.status(400).json({ message: result.error })
  }

  if (bodyMetadata) {
    bodyMetadata.content = result.content
  }
  if (validatedMetadata) {
    validatedMetadata.content = result.content
  }

  next()
}

export const productContentMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/products",
    method: "POST",
    middlewares: [validateContentMiddleware],
  },
  {
    matcher: "/admin/products/:id",
    method: "POST",
    middlewares: [validateContentMiddleware],
  },
]
