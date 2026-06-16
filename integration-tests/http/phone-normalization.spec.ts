import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import normalizePhones from "../../src/scripts/normalize-phones"
import orderPlacedCustomerPhoneHandler from "../../src/subscribers/order-placed-customer-phone"
import { MAGIC_TOKEN_MODULE } from "../../src/modules/magic-token"

jest.setTimeout(120 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    const customerSvc = () => getContainer().resolve(Modules.CUSTOMER) as any
    const orderSvc = () => getContainer().resolve(Modules.ORDER) as any

    const createOrderFor = async (
      customer_id: string,
      shipping: { phone?: string; country_code?: string }
    ) =>
      orderSvc().createOrders({
        currency_code: "eur",
        customer_id,
        email: "buyer@example.com",
        shipping_address: {
          first_name: "Test",
          last_name: "Buyer",
          address_1: "Some Str. 1",
          city: "Berlin",
          postal_code: "10115",
          ...shipping,
        },
      })

    describe("Stage 0 — normalize-phones script", () => {
      it("normalizes seeded customers, reports garbage, second run is a no-op", async () => {
        const clean = await customerSvc().createCustomers({
          email: "clean@example.com",
          phone: "+491512345678",
        })
        const messy = await customerSvc().createCustomers({
          email: "messy@example.com",
          phone: "0151 2345678",
        })
        await createOrderFor(messy.id, { country_code: "de" })
        const garbage = await customerSvc().createCustomers({
          email: "garbage@example.com",
          phone: "garbage",
        })

        const first = await normalizePhones({
          container: getContainer(),
          args: [],
        } as any)

        const [cleanAfter] = await customerSvc().listCustomers({ id: clean.id })
        const [messyAfter] = await customerSvc().listCustomers({ id: messy.id })
        const [garbageAfter] = await customerSvc().listCustomers({ id: garbage.id })

        expect(cleanAfter.phone).toBe("+491512345678")
        expect(messyAfter.phone).toBe("+491512345678")
        expect(garbageAfter.phone).toBe("garbage")
        expect(first?.reported).toBeGreaterThanOrEqual(1)

        // Idempotency: second run produces zero DB changes
        const second = await normalizePhones({
          container: getContainer(),
          args: [],
        } as any)
        expect(second?.updated).toBe(0)
      })

      it("backfills guests without phone from the latest order's shipping phone, never registered customers", async () => {
        const guest = await customerSvc().createCustomers({
          email: "guest-backfill@example.com",
          has_account: false,
        })
        await createOrderFor(guest.id, {
          phone: "0151 2345678",
          country_code: "de",
        })

        const registered = await customerSvc().createCustomers({
          email: "registered@example.com",
          has_account: true,
          phone: "+15551234567",
        })
        await createOrderFor(registered.id, {
          phone: "0151 9999999",
          country_code: "de",
        })

        await normalizePhones({ container: getContainer(), args: [] } as any)

        const [guestAfter] = await customerSvc().listCustomers({ id: guest.id })
        const [registeredAfter] = await customerSvc().listCustomers({
          id: registered.id,
        })

        expect(guestAfter.phone).toBe("+491512345678")
        expect(registeredAfter.phone).toBe("+15551234567")
      })
    })

    describe("Stage 0 — order.placed subscriber", () => {
      const fire = (orderId: string) =>
        orderPlacedCustomerPhoneHandler({
          event: { data: { id: orderId } },
          container: getContainer(),
        } as any)

      it("copies normalized shipping phone to a guest customer and is replay-safe", async () => {
        const guest = await customerSvc().createCustomers({
          email: "sub-guest@example.com",
          has_account: false,
        })
        const order = await createOrderFor(guest.id, {
          phone: "0151 2345678",
          country_code: "de",
        })

        await fire(order.id)
        const [after] = await customerSvc().listCustomers({ id: guest.id })
        expect(after.phone).toBe("+491512345678")

        // Replay: no change
        await fire(order.id)
        const [afterReplay] = await customerSvc().listCustomers({ id: guest.id })
        expect(afterReplay.phone).toBe("+491512345678")
      })

      it("never overwrites a registered customer's profile phone", async () => {
        const registered = await customerSvc().createCustomers({
          email: "sub-registered@example.com",
          has_account: true,
          phone: "+15551234567",
        })
        const order = await createOrderFor(registered.id, {
          phone: "0151 2345678",
          country_code: "de",
        })

        await fire(order.id)
        const [after] = await customerSvc().listCustomers({ id: registered.id })
        expect(after.phone).toBe("+15551234567")
      })

      it("writes nothing when the shipping phone is unparseable", async () => {
        const guest = await customerSvc().createCustomers({
          email: "sub-garbage@example.com",
          has_account: false,
        })
        const order = await createOrderFor(guest.id, {
          phone: "garbage",
          country_code: "de",
        })

        await fire(order.id)
        const [after] = await customerSvc().listCustomers({ id: guest.id })
        expect(after.phone).toBeFalsy()
      })
    })

    describe("Stage 0 — registration route normalizes phone", () => {
      let pubKeyHeader: Record<string, string>

      // beforeEach, not beforeAll: the test runner truncates tables between tests
      beforeEach(async () => {
        const apiKeySvc = getContainer().resolve(Modules.API_KEY) as any
        const key = await apiKeySvc.createApiKeys({
          title: "test",
          type: "publishable",
          created_by: "test",
        })
        pubKeyHeader = { "x-publishable-api-key": key.token }
      })

      const register = (email: string, phone: string) =>
        api.post(
          "/store/customers/register/request",
          { email, first_name: "A", last_name: "B", phone },
          { headers: pubKeyHeader, validateStatus: () => true }
        )

      const tokenPayloadFor = async (email: string) => {
        const magicTokenSvc = getContainer().resolve(MAGIC_TOKEN_MODULE) as any
        const [token] = await magicTokenSvc.listMagicTokens({
          email,
          type: "activate",
        })
        return token?.payload
      }

      it("messy phone → E.164 in the activation token payload", async () => {
        const res = await register("reg-messy@example.com", "+49 (151) 234-56-78")
        expect(res.status).toBe(200)
        const payload = await tokenPayloadFor("reg-messy@example.com")
        expect(payload?.phone).toBe("+491512345678")
      })

      it("garbage phone → stored as entered, registration still succeeds", async () => {
        const res = await register("reg-garbage@example.com", "garbage")
        expect(res.status).toBe(200)
        const payload = await tokenPayloadFor("reg-garbage@example.com")
        expect(payload?.phone).toBe("garbage")
      })
    })
  },
})
