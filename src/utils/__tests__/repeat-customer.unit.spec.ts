import {
  evaluateOrderMinimum,
  getRepeatOrderMinimum,
  hasPaidOrder,
  isPaidOrder,
} from "../repeat-customer"

type Customer = { id: string; email: string; phone?: string | null }
type Order = { id: string; customer_id: string; status: string; captured: boolean[] }

function makeContainer(opts: { customers?: Customer[]; orders?: Order[]; cart?: any }) {
  const customers = opts.customers ?? []
  const orders = opts.orders ?? []

  const listCustomers = jest.fn(async (filters: any) =>
    customers.filter((c) =>
      filters.email
        ? filters.email.includes(c.email)
        : filters.phone
          ? filters.phone.includes(c.phone)
          : false
    )
  )

  const graph = jest.fn(async ({ entity, filters }: any) => {
    if (entity === "cart") return { data: [opts.cart] }
    if (entity === "order") {
      return {
        data: orders
          .filter((o) => filters.customer_id.includes(o.customer_id))
          .map((o) => ({
            id: o.id,
            status: o.status,
            payment_collections: [
              { payments: o.captured.map((c) => ({ captured_at: c ? new Date() : null })) },
            ],
          })),
      }
    }
    return { data: [] }
  })

  const container: any = {
    resolve: (key: string) => (key === "customer" ? { listCustomers } : { graph }),
  }
  return { container, listCustomers, graph }
}

describe("getRepeatOrderMinimum", () => {
  const OLD_ENV = process.env
  beforeEach(() => {
    process.env = { ...OLD_ENV }
  })
  afterAll(() => {
    process.env = OLD_ENV
  })

  it("reads the env value", () => {
    process.env.REPEAT_ORDER_MINIMUM = "150"
    expect(getRepeatOrderMinimum()).toBe(150)
  })

  it.each([undefined, "", "0", "-5", "abc"])("is disabled for %p", (value) => {
    if (value === undefined) delete process.env.REPEAT_ORDER_MINIMUM
    else process.env.REPEAT_ORDER_MINIMUM = value
    expect(getRepeatOrderMinimum()).toBe(0)
  })
})

describe("isPaidOrder", () => {
  const order = (status: string, captured: (string | null)[]) => ({
    status,
    payment_collections: [{ payments: captured.map((c) => ({ captured_at: c })) }],
  })

  it("counts any captured payment, including partial", () => {
    expect(isPaidOrder(order("pending", [null, "2026-10-01"]))).toBe(true)
  })

  it("ignores unpaid orders", () => {
    expect(isPaidOrder(order("pending", [null]))).toBe(false)
    expect(isPaidOrder({ status: "pending", payment_collections: [] })).toBe(false)
  })

  it("ignores cancelled orders even if captured", () => {
    expect(isPaidOrder(order("canceled", ["2026-10-01"]))).toBe(false)
  })
})

describe("hasPaidOrder", () => {
  it("is false for a brand-new customer", async () => {
    const { container } = makeContainer({})
    expect(await hasPaidOrder(container, { emails: ["new@x.com"] })).toBe(false)
  })

  it("matches a paid guest order by email, case-insensitively", async () => {
    const { container } = makeContainer({
      customers: [{ id: "cus_guest", email: "buyer@x.com" }],
      orders: [{ id: "o1", customer_id: "cus_guest", status: "pending", captured: [true] }],
    })
    expect(await hasPaidOrder(container, { emails: ["  Buyer@X.com "] })).toBe(true)
  })

  it("matches across guest + registered records of the same email", async () => {
    const { container } = makeContainer({
      customers: [
        { id: "cus_reg", email: "buyer@x.com" },
        { id: "cus_guest", email: "buyer@x.com" },
      ],
      orders: [{ id: "o1", customer_id: "cus_guest", status: "completed", captured: [true] }],
    })
    expect(await hasPaidOrder(container, { emails: ["buyer@x.com"] })).toBe(true)
  })

  it("matches by phone when the email differs, whatever the phone format", async () => {
    const { container } = makeContainer({
      customers: [{ id: "cus_old", email: "old@x.com", phone: "+14155552671" }],
      orders: [{ id: "o1", customer_id: "cus_old", status: "pending", captured: [true] }],
    })
    expect(
      await hasPaidOrder(container, { emails: ["other@x.com"], phones: ["+1 (415) 555-2671"] })
    ).toBe(true)
  })

  it("does not count unpaid or cancelled orders", async () => {
    const { container } = makeContainer({
      customers: [{ id: "cus_1", email: "buyer@x.com" }],
      orders: [
        { id: "o1", customer_id: "cus_1", status: "pending", captured: [false] },
        { id: "o2", customer_id: "cus_1", status: "canceled", captured: [true] },
      ],
    })
    expect(await hasPaidOrder(container, { emails: ["buyer@x.com"] })).toBe(false)
  })

  it("skips lookups when there is no usable identity", async () => {
    const { container, listCustomers } = makeContainer({})
    expect(await hasPaidOrder(container, { emails: ["", null], phones: ["abc"] })).toBe(false)
    expect(listCustomers).not.toHaveBeenCalled()
  })
})

describe("evaluateOrderMinimum", () => {
  const OLD_ENV = process.env
  beforeEach(() => {
    process.env = { ...OLD_ENV, REPEAT_ORDER_MINIMUM: "150" }
  })
  afterAll(() => {
    process.env = OLD_ENV
  })

  const repeatCustomer = {
    customers: [{ id: "cus_1", email: "buyer@x.com" }],
    orders: [{ id: "o1", customer_id: "cus_1", status: "pending", captured: [true] }],
  }
  const cart = (item_total: unknown) => ({ id: "cart_1", email: "buyer@x.com", item_total })

  it("does not apply to a first-time customer", async () => {
    const { container } = makeContainer({ cart: { ...cart(40), email: "new@x.com" } })
    expect(await evaluateOrderMinimum(container, "cart_1")).toEqual({
      applies: false, minimum: 150, subtotal: 40, remaining: 0,
    })
  })

  it("blocks a repeat customer below the minimum", async () => {
    const { container } = makeContainer({ ...repeatCustomer, cart: cart(149.99) })
    const res = await evaluateOrderMinimum(container, "cart_1")
    expect(res.applies).toBe(true)
    expect(res.remaining).toBe(0.01)
  })

  it("lets a repeat customer through at exactly the minimum (BigNumber total)", async () => {
    const { container } = makeContainer({ ...repeatCustomer, cart: cart({ numeric_: 150 }) })
    const res = await evaluateOrderMinimum(container, "cart_1")
    expect(res).toEqual({ applies: true, minimum: 150, subtotal: 150, remaining: 0 })
  })

  it("uses the logged-in customer's email/phone too", async () => {
    const { container } = makeContainer({
      ...repeatCustomer,
      cart: { id: "cart_1", email: null, item_total: 50, customer: { email: "buyer@x.com" } },
    })
    expect((await evaluateOrderMinimum(container, "cart_1")).remaining).toBe(100)
  })

  it("resolves a national-format shipping phone with the shipping country", async () => {
    const { container } = makeContainer({
      customers: [{ id: "cus_old", email: "old@x.com", phone: "+14155552671" }],
      orders: [{ id: "o1", customer_id: "cus_old", status: "pending", captured: [true] }],
      cart: {
        id: "cart_1", email: "new@x.com", item_total: 50,
        shipping_address: { phone: "(415) 555-2671", country_code: "us" },
      },
    })
    expect((await evaluateOrderMinimum(container, "cart_1")).applies).toBe(true)
  })

  it("is fully disabled without the env var (no customer lookups)", async () => {
    delete process.env.REPEAT_ORDER_MINIMUM
    const { container, listCustomers } = makeContainer({ ...repeatCustomer, cart: cart(10) })
    expect((await evaluateOrderMinimum(container, "cart_1")).applies).toBe(false)
    expect(listCustomers).not.toHaveBeenCalled()
  })
})
