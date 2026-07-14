import { resolve } from "path"
import type { ProductContent } from "./product-content-schema"

/**
 * Shared file conventions for the content/ directory (the git-committed
 * source of truth for product copy). Both import-content.ts and
 * export-content.ts go through these helpers so the on-disk format can't
 * drift between the two directions — round-tripping (export → import) must
 * always report "unchanged".
 */

export const CONTENT_DIR = resolve(process.cwd(), "content")

/** Canonical file format: pretty-printed 2-space JSON + trailing newline. */
export function serializeContent(content: ProductContent): string {
  return JSON.stringify(content, null, 2) + "\n"
}

/**
 * The on-disk file mixes the content object with the optional flat
 * metadata.active_ingredient at the top level (so authors keep everything in
 * one file), even though at rest they live in different metadata keys. This
 * splits them back out on import and rejoins them here on export in a fixed
 * key order (type, active_ingredient, then the rest of content) so the round
 * trip is byte-stable and reports "unchanged".
 */
export function serializeContentFile(
  content: ProductContent,
  activeIngredient?: string | null
): string {
  const { type, ...rest } = content
  const ordered = {
    type,
    ...(activeIngredient ? { active_ingredient: activeIngredient } : {}),
    ...rest,
  }
  return JSON.stringify(ordered, null, 2) + "\n"
}

export function filenameFromHandle(handle: string): string {
  return `${handle}.json`
}

export function handleFromFilename(filename: string): string {
  return filename.replace(/\.json$/, "")
}
