import { readFileSync } from "fs"
import { join } from "path"
import { validateProductContent } from "../../utils/product-content-schema"

// Guards the copy-paste examples in content/README.md against schema drift.
describe("README examples validate against the live schema", () => {
  const md = readFileSync(join(process.cwd(), "content/README.md"), "utf-8")
  const blocks = [...md.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1])

  it("has a compound and a peptide example", () => {
    expect(blocks).toHaveLength(2)
  })

  it.each(blocks.map((b, i) => [i, b]))(
    "block %i is valid product content",
    (_i, block) => {
      const result = validateProductContent(block as string)
      expect(result.ok ? null : result.error).toBeNull()
    }
  )
})
