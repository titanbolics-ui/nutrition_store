import {
  planBrandAssignment,
  ProductInput,
} from "../assign-brands"

function product(
  handle: string,
  title: string,
  type_id: string | null = null
): ProductInput {
  return { id: `prod_${handle}`, handle, title, type_id }
}

describe("planBrandAssignment", () => {
  it("assigns ZPHC from title", () => {
    const [a] = planBrandAssignment([
      product("oxandrolone-zphc", "Oxandrolone ZPHC"),
    ])
    expect(a).toEqual({
      handle: "oxandrolone-zphc",
      status: "assign",
      productId: "prod_oxandrolone-zphc",
      brand: "ZPHC",
    })
  })

  it("assigns Spectrum Pharma from handle when title lacks it", () => {
    const [a] = planBrandAssignment([
      product("spectros-140iu-hgh-spectrum-pharma", "Spectros 140IU HGH"),
    ])
    expect(a).toMatchObject({ status: "assign", brand: "Spectrum Pharma" })
  })

  it("assigns CanadaBioLabs case-insensitively", () => {
    const [a] = planBrandAssignment([
      product("test-cyp-canadabiolabs", "Test Cyp CANADABIOLABS"),
    ])
    expect(a).toMatchObject({ status: "assign", brand: "CanadaBioLabs" })
  })

  it("reports unmatched products instead of guessing", () => {
    const [a] = planBrandAssignment([
      product("methandienone-10mg", "Methandienone 10mg"),
    ])
    expect(a).toEqual({ handle: "methandienone-10mg", status: "unmatched" })
  })

  it("reports ambiguous products (two brand needles) instead of guessing", () => {
    const [a] = planBrandAssignment([
      product("weird", "ZPHC vs Spectrum comparison pack"),
    ])
    expect(a).toEqual({
      handle: "weird",
      status: "ambiguous",
      brands: ["ZPHC", "Spectrum Pharma"],
    })
  })

  it("never overwrites a product that already has a type (idempotent re-run)", () => {
    const [a] = planBrandAssignment([
      product("oxandrolone-zphc", "Oxandrolone ZPHC", "ptyp_existing"),
    ])
    expect(a).toEqual({ handle: "oxandrolone-zphc", status: "already_typed" })
  })
})
