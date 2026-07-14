import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import scryptKdf from "scrypt-kdf"

jest.setTimeout(120 * 1000)

const ADMIN_EMAIL = "content-admin@example.com"
const ADMIN_PASSWORD = "supersecret1"

const validCompoundContent = {
  type: "compound",
  overview: { what: "A testosterone ester.", howItWorks: "Binds androgen receptors." },
  dosage: {
    beginner: "300-500mg/week",
    intermediate: "500-750mg/week",
    advanced: "750-1000mg/week",
    cycleLength: "12-16 weeks",
    administration: "Intramuscular injection",
    pct: "Required",
  },
  profile: {
    anabolicRating: "100",
    androgenicRating: "100",
    ester: "Enanthate",
    halfLife: "4.5 days",
    aromatization: "Yes",
    detectionTime: "3 months",
  },
  sideEffects: {
    estrogenic: "Moderate",
    androgenic: "Moderate",
    cardiovascular: "Moderate",
    suppression: "High",
  },
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: { authorization: string } }

    beforeAll(async () => {
      const container = getContainer()
      const authModuleService = container.resolve(Modules.AUTH) as any
      const userModuleService = container.resolve(Modules.USER) as any

      const passwordHash = (
        await scryptKdf.kdf(ADMIN_PASSWORD, { logN: 15, r: 8, p: 1 })
      ).toString("base64")

      const authIdentity = await authModuleService.createAuthIdentities({
        provider_identities: [
          {
            provider: "emailpass",
            entity_id: ADMIN_EMAIL,
            provider_metadata: { password: passwordHash },
          },
        ],
      })

      const user = await userModuleService.createUsers({
        email: ADMIN_EMAIL,
        first_name: "Content",
        last_name: "Admin",
      })

      await authModuleService.updateAuthIdentities({
        id: authIdentity.id,
        app_metadata: { user_id: user.id },
      })

      const loginRes = await api.post("/auth/user/emailpass", {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      })

      adminHeaders = {
        headers: { authorization: `Bearer ${loginRes.data.token}` },
      }
    })

    const createBaseProduct = async () => {
      const res = await api.post(
        "/admin/products",
        {
          title: `Content Validation Test Product ${Date.now()}`,
          options: [{ title: "Size", values: ["Default"] }],
          variants: [
            {
              title: "Default",
              options: { Size: "Default" },
              prices: [{ currency_code: "eur", amount: 10 }],
            },
          ],
        },
        adminHeaders
      )
      return res.data.product
    }

    describe("Stage C — metadata.content validation on product save", () => {
      it("rejects invalid metadata.content with a 400 naming the bad field, product unchanged", async () => {
        const product = await createBaseProduct()

        const { dosage, ...rest } = validCompoundContent
        const { beginner, ...brokenDosage } = dosage
        const invalidContent = { ...rest, dosage: brokenDosage }

        const res = await api
          .post(
            `/admin/products/${product.id}`,
            { metadata: { content: invalidContent } },
            adminHeaders
          )
          .catch((e: any) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain("dosage.beginner")

        const after = await api.get(`/admin/products/${product.id}`, adminHeaders)
        expect(after.data.product.metadata?.content).toBeFalsy()
      })

      it("accepts valid metadata.content and persists it", async () => {
        const product = await createBaseProduct()

        const res = await api.post(
          `/admin/products/${product.id}`,
          { metadata: { content: validCompoundContent } },
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.product.metadata?.content?.type).toBe("compound")
      })

      it("succeeds exactly as today when metadata.content is absent entirely", async () => {
        const product = await createBaseProduct()

        const res = await api.post(
          `/admin/products/${product.id}`,
          { title: "Renamed, no content touched" },
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.product.title).toBe("Renamed, no content touched")
      })

      it("accepts metadata.content submitted as a JSON string (the real Admin dashboard path — its generic metadata table edits every value as a string) and persists it as a real object", async () => {
        const product = await createBaseProduct()

        const res = await api.post(
          `/admin/products/${product.id}`,
          { metadata: { content: JSON.stringify(validCompoundContent) } },
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(typeof res.data.product.metadata.content).toBe("object")
        expect(res.data.product.metadata.content.type).toBe("compound")

        const after = await api.get(`/admin/products/${product.id}`, adminHeaders)
        expect(typeof after.data.product.metadata.content).toBe("object")
      })

      it("rejects a malformed JSON string in metadata.content (e.g. a truncated Admin paste) with a 400 naming content", async () => {
        const product = await createBaseProduct()

        const truncated = JSON.stringify(validCompoundContent).slice(0, -5)

        const res = await api
          .post(
            `/admin/products/${product.id}`,
            { metadata: { content: truncated } },
            adminHeaders
          )
          .catch((e: any) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain("Invalid JSON")

        const after = await api.get(`/admin/products/${product.id}`, adminHeaders)
        expect(after.data.product.metadata?.content).toBeFalsy()
      })
    })
  },
})
