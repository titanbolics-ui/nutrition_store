import {
  CustomerPhoneInput,
  planPhoneNormalization,
} from "../normalize-phones"

const base = {
  email: "x@example.com",
  has_account: false,
  order_country: null,
  order_shipping_phone: null,
}

describe("planPhoneNormalization", () => {
  it("seed trio: clean stays, messy-with-DE-order normalized, garbage reported", () => {
    const customers: CustomerPhoneInput[] = [
      { ...base, customer_id: "cus_clean", phone: "+491512345678" },
      {
        ...base,
        customer_id: "cus_messy",
        phone: "0151 2345678",
        order_country: "de",
      },
      { ...base, customer_id: "cus_garbage", phone: "garbage" },
    ]

    const { updates, report } = planPhoneNormalization(customers)

    expect(updates).toEqual([
      { customer_id: "cus_messy", phone: "+491512345678" },
    ])
    expect(report).toEqual([
      {
        customer_id: "cus_garbage",
        email: "x@example.com",
        raw_phone: "garbage",
        reason: "unparseable",
      },
    ])
  })

  it("is idempotent: applying its own updates yields zero further changes", () => {
    const customers: CustomerPhoneInput[] = [
      { ...base, customer_id: "c1", phone: "0151 2345678", order_country: "de" },
      { ...base, customer_id: "c2", phone: "+15551234567" },
    ]

    const first = planPhoneNormalization(customers)
    const applied = customers.map((c) => ({
      ...c,
      phone: first.updates.find((u) => u.customer_id === c.customer_id)?.phone ?? c.phone,
    }))
    const second = planPhoneNormalization(applied)

    expect(first.updates).toHaveLength(1)
    expect(second.updates).toHaveLength(0)
  })

  describe("backfill (guests without phone, from latest order shipping address)", () => {
    it("backfills a guest from the order shipping phone", () => {
      const { updates, report } = planPhoneNormalization([
        {
          ...base,
          customer_id: "guest1",
          phone: null,
          order_country: "de",
          order_shipping_phone: "0151 2345678",
        },
      ])
      expect(updates).toEqual([{ customer_id: "guest1", phone: "+491512345678" }])
      expect(report).toHaveLength(0)
    })

    it("never touches registered customers (profile phone is authoritative)", () => {
      const { updates, report } = planPhoneNormalization([
        {
          ...base,
          customer_id: "reg1",
          phone: null,
          has_account: true,
          order_country: "de",
          order_shipping_phone: "0151 2345678",
        },
      ])
      expect(updates).toHaveLength(0)
      expect(report).toHaveLength(0)
    })

    it("never overwrites an existing phone with the shipping phone", () => {
      const { updates } = planPhoneNormalization([
        {
          ...base,
          customer_id: "c1",
          phone: "+15551234567",
          order_country: "de",
          order_shipping_phone: "0151 9999999",
        },
      ])
      expect(updates).toHaveLength(0)
    })

    it("reports unparseable shipping phones as backfill_unparseable", () => {
      const { updates, report } = planPhoneNormalization([
        {
          ...base,
          customer_id: "guest2",
          phone: null,
          order_shipping_phone: "garbage",
        },
      ])
      expect(updates).toHaveLength(0)
      expect(report).toEqual([
        {
          customer_id: "guest2",
          email: "x@example.com",
          raw_phone: "garbage",
          reason: "backfill_unparseable",
        },
      ])
    })

    it("skips guests with no phone anywhere", () => {
      const { updates, report } = planPhoneNormalization([
        { ...base, customer_id: "guest3", phone: null },
      ])
      expect(updates).toHaveLength(0)
      expect(report).toHaveLength(0)
    })
  })
})
