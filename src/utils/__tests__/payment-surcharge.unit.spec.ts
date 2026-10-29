jest.mock("@medusajs/medusa/core-flows", () => ({
  refreshPaymentCollectionForCartWorkflow: () => ({ run: refreshRun }),
}))

const refreshRun = jest.fn(async () => ({}))

import {
  PAYPAL_PROVIDER_ID,
  checkSurchargeConsistency,
  computeSurcharge,
  getSurchargePercent,
  isSurchargeMethod,
  syncPaymentSurcharge,
} from "../payment-surcharge"

const DELIVERY = { id: "sm_delivery", amount: 31, data: {}, metadata: null }
const fee = (amount: number) => ({
  id: `sm_fee_${amount}`,
  amount,
  data: { payment_surcharge: "paypal", percent: 5 },
  metadata: { payment_surcharge: "paypal", percent: 5 },
})

function makeCart(opts: { items?: number; methods?: any[]; provider?: string | null }) {
  const methods = opts.methods ?? [DELIVERY]
  return {
    id: "cart_1",
    item_total: opts.items ?? 120,
    // Medusa's shipping_total includes every method, surcharge too
    shipping_total: methods.reduce((s, m) => s + m.amount, 0),
    shipping_methods: methods,
    payment_collection: opts.provider
      ? { payment_sessions: [{ provider_id: opts.provider }] }
      : null,
  }
}

function makeContainer(cart: any) {
  const cartModule = {
    deleteShippingMethods: jest.fn(async () => {}),
    addShippingMethods: jest.fn(async () => ({})),
  }
  const query = { graph: jest.fn(async () => ({ data: [cart] })) }
  const container: any = {
    resolve: (key: string) => (key === "cart" ? cartModule : query),
  }
  return { container, cartModule }
}

describe("payment surcharge", () => {
  const OLD_ENV = process.env
  beforeEach(() => {
    process.env = { ...OLD_ENV, PAYPAL_SURCHARGE_PERCENT: "5" }
    refreshRun.mockClear()
  })
  afterAll(() => {
    process.env = OLD_ENV
  })

  describe("getSurchargePercent", () => {
    it.each([undefined, "", "0", "-1", "abc"])("is disabled for %p", (value) => {
      if (value === undefined) delete process.env.PAYPAL_SURCHARGE_PERCENT
      else process.env.PAYPAL_SURCHARGE_PERCENT = value
      expect(getSurchargePercent()).toBe(0)
    })
  })

  describe("isSurchargeMethod", () => {
    it("recognises the marker in data or metadata", () => {
      expect(isSurchargeMethod(fee(5))).toBe(true)
      expect(isSurchargeMethod({ data: { payment_surcharge: "paypal" } })).toBe(true)
      expect(isSurchargeMethod({ metadata: { payment_surcharge: "paypal" } })).toBe(true)
      expect(isSurchargeMethod(DELIVERY)).toBe(false)
    })
  })

  describe("computeSurcharge", () => {
    it("takes 5% of items + delivery", () => {
      expect(computeSurcharge(makeCart({}), 5)).toBe(7.55)
    })

    it("ignores an existing surcharge in the base", () => {
      expect(computeSurcharge(makeCart({ methods: [DELIVERY, fee(7.55)] }), 5)).toBe(7.55)
    })

    it("rounds to cents", () => {
      expect(computeSurcharge(makeCart({ items: 99.99, methods: [] }), 5)).toBe(5)
      expect(computeSurcharge(makeCart({ items: 10.1, methods: [] }), 5)).toBe(0.51)
    })

    it("is zero when disabled", () => {
      expect(computeSurcharge(makeCart({}), 0)).toBe(0)
    })
  })

  describe("syncPaymentSurcharge", () => {
    it("adds one surcharge method for PayPal and refreshes the payment collection", async () => {
      const { container, cartModule } = makeContainer(makeCart({}))
      await syncPaymentSurcharge(container, "cart_1", PAYPAL_PROVIDER_ID)
      expect(cartModule.deleteShippingMethods).not.toHaveBeenCalled()
      expect(cartModule.addShippingMethods).toHaveBeenCalledWith(
        expect.objectContaining({
          cart_id: "cart_1",
          name: "PayPal fee (5%)",
          amount: 7.55,
          data: { payment_surcharge: "paypal", percent: 5 },
        })
      )
      expect(refreshRun).toHaveBeenCalledWith({ input: { cart_id: "cart_1" } })
    })

    it("is a no-op when the surcharge is already correct", async () => {
      const { container, cartModule } = makeContainer(makeCart({ methods: [DELIVERY, fee(7.55)] }))
      await syncPaymentSurcharge(container, "cart_1", PAYPAL_PROVIDER_ID)
      expect(cartModule.addShippingMethods).not.toHaveBeenCalled()
      expect(cartModule.deleteShippingMethods).not.toHaveBeenCalled()
      expect(refreshRun).not.toHaveBeenCalled()
    })

    it("replaces a stale amount", async () => {
      const { container, cartModule } = makeContainer(makeCart({ methods: [DELIVERY, fee(3)] }))
      await syncPaymentSurcharge(container, "cart_1", PAYPAL_PROVIDER_ID)
      expect(cartModule.deleteShippingMethods).toHaveBeenCalledWith(["sm_fee_3"])
      expect(cartModule.addShippingMethods).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 7.55 })
      )
    })

    it.each(["pp_crypto-manual_crypto-manual", null])(
      "removes the surcharge for provider %p",
      async (provider) => {
        const { container, cartModule } = makeContainer(makeCart({ methods: [DELIVERY, fee(7.55)] }))
        await syncPaymentSurcharge(container, "cart_1", provider)
        expect(cartModule.deleteShippingMethods).toHaveBeenCalledWith(["sm_fee_7.55"])
        expect(cartModule.addShippingMethods).not.toHaveBeenCalled()
        expect(refreshRun).toHaveBeenCalled()
      }
    )

    it("never adds a surcharge when disabled", async () => {
      process.env.PAYPAL_SURCHARGE_PERCENT = "0"
      const { container, cartModule } = makeContainer(makeCart({}))
      await syncPaymentSurcharge(container, "cart_1", PAYPAL_PROVIDER_ID)
      expect(cartModule.addShippingMethods).not.toHaveBeenCalled()
    })
  })

  describe("checkSurchargeConsistency", () => {
    it("passes PayPal with the correct surcharge", async () => {
      const { container } = makeContainer(
        makeCart({ methods: [DELIVERY, fee(7.55)], provider: PAYPAL_PROVIDER_ID })
      )
      expect(await checkSurchargeConsistency(container, "cart_1")).toBeNull()
    })

    it("fails PayPal without the surcharge", async () => {
      const { container } = makeContainer(makeCart({ provider: PAYPAL_PROVIDER_ID }))
      expect(await checkSurchargeConsistency(container, "cart_1")).toMatch(/re-select/)
    })

    it("fails a leftover surcharge after switching away from PayPal", async () => {
      const { container } = makeContainer(
        makeCart({ methods: [DELIVERY, fee(7.55)], provider: "pp_crypto-manual_crypto-manual" })
      )
      expect(await checkSurchargeConsistency(container, "cart_1")).toMatch(/re-select/)
    })

    it("passes other providers without a surcharge", async () => {
      const { container } = makeContainer(
        makeCart({ provider: "pp_crypto-manual_crypto-manual" })
      )
      expect(await checkSurchargeConsistency(container, "cart_1")).toBeNull()
    })
  })
})
