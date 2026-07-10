import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { WAITLIST_MODULE } from "../../src/modules/waitlist"

jest.setTimeout(120 * 1000)

const mockContactsCreate = jest.fn()
const mockSegmentsAdd = jest.fn()
const mockEmailsSend = jest.fn()

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    contacts: { create: mockContactsCreate, segments: { add: mockSegmentsAdd } },
    emails: { send: mockEmailsSend },
  })),
}))

jest.mock("../../src/utils/turnstile", () => ({
  verifyTurnstile: jest.fn().mockResolvedValue(true),
}))

import { verifyTurnstile } from "../../src/utils/turnstile"
import { _resetRateLimitsForTests } from "../../src/utils/rate-limit"
const mockVerifyTurnstile = verifyTurnstile as jest.Mock

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    const productSvc = () => getContainer().resolve(Modules.PRODUCT) as any
    const waitlistSvc = () => getContainer().resolve(WAITLIST_MODULE) as any

    let pubKeyHeader: Record<string, string>
    let variantId: string

    const createVariantProduct = async (sku: string) => {
      const product = await productSvc().createProducts({
        title: `Test Product ${sku}`,
        status: "published",
        options: [{ title: "Size", values: ["Default"] }],
        variants: [{ title: "Default", options: { Size: "Default" }, sku }],
      })
      return product.variants[0].id as string
    }

    beforeEach(async () => {
      process.env.RESEND_SEGMENT_ID = "seg_test"

      const apiKeySvc = getContainer().resolve(Modules.API_KEY) as any
      const key = await apiKeySvc.createApiKeys({
        title: "test",
        type: "publishable",
        created_by: "test",
      })
      pubKeyHeader = { "x-publishable-api-key": key.token }

      mockContactsCreate.mockReset()
      mockSegmentsAdd.mockReset()
      mockEmailsSend.mockReset()
      mockVerifyTurnstile.mockReset()
      mockVerifyTurnstile.mockResolvedValue(true)
      mockContactsCreate.mockResolvedValue({ data: { id: "contact_123" }, error: null })
      mockSegmentsAdd.mockResolvedValue({ data: {}, error: null })
      mockEmailsSend.mockResolvedValue({ data: { id: "email_123" }, error: null })
      _resetRateLimitsForTests()

      variantId = await createVariantProduct(`WL-${Date.now()}-1`)
    })

    const signup = (body: Record<string, any>) =>
      api.post(
        "/store/waitlist",
        {
          email: "waiter@example.com",
          variant_id: variantId,
          marketing_consent: false,
          turnstile_token: "tok",
          ...body,
        },
        { headers: pubKeyHeader, validateStatus: () => true }
      )

    it("duplicate signup: same email+variant twice → one row, same response", async () => {
      const first = await signup({})
      const second = await signup({})

      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      expect(second.data.message).toBe(first.data.message)

      const rows = await waitlistSvc().listWaitlists({
        email: "waiter@example.com",
        variant_id: variantId,
      })
      expect(rows.length).toBe(1)
    })

    it("caps active signups at 5 per email, rejects the 6th with a clear message", async () => {
      const email = "capped@example.com"
      const variantIds = await Promise.all(
        [1, 2, 3, 4, 5, 6].map((n) => createVariantProduct(`WL-${Date.now()}-cap-${n}`))
      )

      for (let i = 0; i < 5; i++) {
        const res = await signup({ email, variant_id: variantIds[i] })
        expect(res.status).toBe(200)
      }

      const sixth = await signup({ email, variant_id: variantIds[5] })
      expect(sixth.status).toBe(400)

      const rows = await waitlistSvc().listWaitlists({ email })
      expect(rows.length).toBe(5)
    })

    it("marketing_consent false: row created, Resend contact-create not called", async () => {
      const res = await signup({ marketing_consent: false })
      expect(res.status).toBe(200)

      const [row] = await waitlistSvc().listWaitlists({
        email: "waiter@example.com",
        variant_id: variantId,
      })
      expect(row).toBeTruthy()
      expect(row.marketing_consent).toBe(false)
      expect(row.resend_contact_id).toBeNull()
      expect(mockContactsCreate).not.toHaveBeenCalled()
    })

    it("marketing_consent true: Resend called once, contact id stored", async () => {
      const res = await signup({ marketing_consent: true })
      expect(res.status).toBe(200)

      const [row] = await waitlistSvc().listWaitlists({
        email: "waiter@example.com",
        variant_id: variantId,
      })
      expect(mockContactsCreate).toHaveBeenCalledTimes(1)
      expect(row.resend_contact_id).toBe("contact_123")
    })

    it("Resend failure: signup still succeeds, resend_contact_id stays null", async () => {
      mockContactsCreate.mockResolvedValue({ data: null, error: { message: "boom" } })

      const res = await signup({ marketing_consent: true })
      expect(res.status).toBe(200)

      const [row] = await waitlistSvc().listWaitlists({
        email: "waiter@example.com",
        variant_id: variantId,
      })
      expect(row).toBeTruthy()
      expect(row.resend_contact_id).toBeNull()
    })

    it("Resend throwing: signup still succeeds, resend_contact_id stays null", async () => {
      mockContactsCreate.mockRejectedValue(new Error("network down"))

      const res = await signup({ marketing_consent: true, email: "throws@example.com" })
      expect(res.status).toBe(200)

      const [row] = await waitlistSvc().listWaitlists({
        email: "throws@example.com",
        variant_id: variantId,
      })
      expect(row).toBeTruthy()
      expect(row.resend_contact_id).toBeNull()
    })

    it("invalid/missing Turnstile token: rejected, nothing created", async () => {
      mockVerifyTurnstile.mockResolvedValue(false)

      const res = await signup({ email: "bot@example.com" })
      expect(res.status).toBe(400)

      const rows = await waitlistSvc().listWaitlists({ email: "bot@example.com" })
      expect(rows.length).toBe(0)
    })

    it("confirmation email sent exactly once per new signup, not resent on duplicate", async () => {
      const notificationSvc = getContainer().resolve("notification") as any
      const spy = jest.spyOn(notificationSvc, "createNotifications")
      const waitlistCalls = () =>
        spy.mock.calls.filter((call) => call[0]?.template === "waitlist-confirmation")

      await signup({ email: "once@example.com" })
      expect(waitlistCalls().length).toBe(1)

      await signup({ email: "once@example.com" })
      expect(waitlistCalls().length).toBe(1)

      spy.mockRestore()
    })
  },
})
