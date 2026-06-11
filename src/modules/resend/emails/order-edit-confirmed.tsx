import {
  Text,
  Column,
  Container,
  Heading,
  Html,
  Img,
  Row,
  Section,
  Tailwind,
  Head,
  Preview,
  Body,
  Link,
  Hr,
} from "@react-email/components"
import * as React from "react"
import { ViewOrderButton, ActivateAccountBlock } from "./_shared"

type ResolvedChange = {
  product_title: string
  variant_title?: string
  thumbnail?: string
  quantity: number
  unit_price: number
  amount: number
  action_type: "add" | "remove" | "update"
}

type OrderEditConfirmedEmailProps = {
  order: {
    id: string
    display_id: number
    email: string
    currency_code: string
    total?: number
    items?: {
      product_title?: string
      title?: string
      variant_title?: string
      thumbnail?: string
      quantity: number
      unit_price: number
    }[]
  }
  changes?: ResolvedChange[]
  amountDue?: number
  paidTotal?: number
  paymentMethod?: string
  providerId?: string
  orderViewToken: string
  hasRegisteredAccount?: boolean
}

const STORE_URL = process.env.STORE_URL || "https://onyxgenetics.com"
const BTC_ADDRESS = process.env.BTC_WALLET_ADDRESS || process.env.NEXT_PUBLIC_BTC_WALLET_ADDRESS || ""
const PAYPAL_ADDRESS = process.env.PAYPAL_WALLET_ADDRESS || process.env.NEXT_PUBLIC_PAYPAL_WALLET_ADDRESS || ""

// Medusa can return BigNumber objects for prices/quantities; extract numeric value safely
function parsePrice(v: unknown): number {
  if (typeof v === "number") return v
  if (typeof v === "string") return parseFloat(v) || 0
  if (v && typeof v === "object") {
    const obj = v as Record<string, unknown>
    if ("value" in obj) return parseFloat(String(obj.value)) || 0
  }
  return 0
}
function parseQty(v: unknown): number {
  const n = parsePrice(v)
  return Number.isFinite(n) ? n : 0
}

const ACTION_COLORS = {
  add:    { text: "#6ee7b7", badge: "+ Added" },
  remove: { text: "#fca5a5", badge: "− Removed" },
  update: { text: "#93c5fd", badge: "↻ Updated" },
}

function ChangeItem({ c, formatter }: { c: ResolvedChange; formatter: Intl.NumberFormat }) {
  const color  = ACTION_COLORS[c.action_type]
  const strike = c.action_type === "remove"

  return (
    <Row style={{ marginBottom: 12 }}>
      <Column style={{ width: 44, verticalAlign: "top" }}>
        {c.thumbnail ? (
          <Img src={c.thumbnail} width="36" height="36" alt="" style={{ borderRadius: 6, background: "#1a1a1a", display: "block" }} />
        ) : (
          <Section style={{ width: 36, height: 36, background: "#1a1a1a", borderRadius: 6 }} />
        )}
      </Column>
      <Column style={{ verticalAlign: "top" }}>
        <Text style={{ color: color.text, fontSize: 13, fontWeight: 600, margin: "0 0 2px", lineHeight: 1.4, textDecoration: strike ? "line-through" : "none" }}>
          {c.product_title}
        </Text>
        {c.variant_title && (
          <Text style={{ color: "#6b7280", fontSize: 12, margin: 0, textDecoration: strike ? "line-through" : "none" }}>
            {c.variant_title}
          </Text>
        )}
        <Text style={{ color: "#6b7280", fontSize: 11, margin: "3px 0 0" }}>
          <Text style={{ color: color.text, fontSize: 11, fontWeight: 700, display: "inline", margin: 0 }}>{color.badge}</Text>
          {" "}· {c.quantity}× · {formatter.format(c.unit_price)} each
        </Text>
      </Column>
      <Column align="right" style={{ width: 80, verticalAlign: "top" }}>
        <Text style={{ color: color.text, fontSize: 13, fontWeight: 700, margin: 0 }}>
          {c.amount >= 0 ? "+" : ""}{formatter.format(c.amount)}
        </Text>
      </Column>
    </Row>
  )
}

function PaymentInstructionsBlock({
  providerId,
  amountFormatted,
  orderDisplayId,
}: {
  providerId: string
  amountFormatted: string
  orderDisplayId: number
}) {
  const isCashApp = providerId.includes("cash-app")
  const isCrypto  = providerId.includes("crypto-manual")
  const isPaypal  = providerId.includes("paypal-manual")

  if (isCashApp || isCrypto) {
    const steps = [
      "Open Cash App and tap the ₿ Bitcoin tab",
      `Tap Buy, enter exactly ${amountFormatted} worth of BTC, then tap Confirm`,
      "After purchase, tap the Send button on the Bitcoin screen",
      "Paste the wallet address below into the To field and confirm",
    ]
    return (
      <Section style={{ background: "#0a1a0a", border: "1px solid #22c55e33", borderRadius: 10, padding: "16px 18px", marginBottom: 0 }}>
        <Row style={{ marginBottom: 10 }}>
          <Column>
            <Text style={{ color: "#4ade80", fontSize: 14, fontWeight: 800, margin: 0, textTransform: "uppercase", letterSpacing: 1 }}>
              ₿ Pay via {isCashApp ? "Cash App" : "Bitcoin"}
            </Text>
          </Column>
          <Column align="right">
            <Text style={{ color: "#4ade80", fontSize: 16, fontWeight: 800, margin: 0 }}>{amountFormatted}</Text>
          </Column>
        </Row>
        {steps.map((step, i) => (
          <Row key={i} style={{ marginBottom: 6 }}>
            <Column style={{ width: 22, verticalAlign: "top" }}>
              <Text style={{ color: "#4ade80", fontSize: 11, fontWeight: 700, margin: 0, background: "#16502533", borderRadius: "50%", width: 18, height: 18, textAlign: "center", lineHeight: "18px", display: "inline-block" }}>
                {i + 1}
              </Text>
            </Column>
            <Column>
              <Text style={{ color: "#d1d5db", fontSize: 12, margin: 0, lineHeight: 1.5 }}>{step}</Text>
            </Column>
          </Row>
        ))}
        <Section style={{ background: "#0d0d0d", border: "1px solid #22c55e22", borderRadius: 8, padding: "10px 14px", marginTop: 10 }}>
          <Text style={{ color: "#4ade80", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, margin: "0 0 4px" }}>
            Bitcoin Address
          </Text>
          <Text style={{ color: "#ffffff", fontFamily: "monospace", fontSize: 11, margin: 0, wordBreak: "break-all" }}>
            {BTC_ADDRESS}
          </Text>
        </Section>
        <Text style={{ color: "#6b7280", fontSize: 11, margin: "8px 0 0" }}>
          Reference: ONX-{orderDisplayId}
        </Text>
      </Section>
    )
  }

  if (isPaypal) {
    return (
      <Section style={{ background: "#0a0f1a", border: "1px solid #3b82f633", borderRadius: 10, padding: "16px 18px", marginBottom: 0 }}>
        <Text style={{ color: "#60a5fa", fontSize: 14, fontWeight: 800, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 1 }}>
          💳 Pay via PayPal — {amountFormatted}
        </Text>
        <Text style={{ color: "#fca5a5", fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>
          ⚠️ Select "Friends and Family" — do NOT use Goods &amp; Services
        </Text>
        <Section style={{ background: "#0d0d0d", border: "1px solid #3b82f622", borderRadius: 8, padding: "10px 14px", marginTop: 6 }}>
          <Text style={{ color: "#60a5fa", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, margin: "0 0 4px" }}>
            PayPal Email
          </Text>
          <Text style={{ color: "#ffffff", fontFamily: "monospace", fontSize: 12, margin: 0 }}>
            {PAYPAL_ADDRESS}
          </Text>
        </Section>
        <Text style={{ color: "#6b7280", fontSize: 11, margin: "8px 0 0" }}>
          Do not include notes or comments in the payment.
        </Text>
      </Section>
    )
  }

  // Fallback: generic text
  return (
    <Section style={{ background: "#1a0700", border: "1px solid #f9731633", borderRadius: 10, padding: "14px 16px" }}>
      <Text style={{ color: "#fb923c", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>
        💳 Additional payment required
      </Text>
      <Text style={{ color: "#d1d5db", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
        Please send <strong style={{ color: "#ffffff" }}>{amountFormatted}</strong> using your original payment method.
      </Text>
    </Section>
  )
}

function OrderEditConfirmedEmailComponent({
  order,
  changes = [],
  amountDue = 0,
  paymentMethod = "",
  providerId = "",
  orderViewToken,
  hasRegisteredAccount = false,
}: OrderEditConfirmedEmailProps) {
  const formatter = new Intl.NumberFormat([], {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: order.currency_code || "USD",
  })

  const owes = amountDue > 0

  return (
    <Tailwind config={{ theme: { extend: { colors: { brand: "#111111" } } } }}>
      <Html style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <Head />
        <Preview>Your order #{`ONX-${order.display_id}`} has been updated</Preview>
        <Body style={{ background: "#0a0a0a", margin: 0, padding: "32px 0" }}>
          <Container style={{ maxWidth: 580, margin: "0 auto" }}>

            {/* Header */}
            <Section style={{ background: "#000000", borderRadius: "12px 12px 0 0", padding: "20px 24px" }}>
              <Row>
                <Column>
                  <Text style={{ color: "#b8ff2b", fontSize: 18, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
                    ONYX GENETICS
                  </Text>
                </Column>
                <Column align="right">
                  <Text style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>
                    #{`ONX-${order.display_id}`}
                  </Text>
                </Column>
              </Row>
            </Section>

            {/* Hero */}
            <Section style={{ background: "#111111", padding: "28px 24px 20px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
              <Heading style={{ color: "#ffffff", fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>
                Order updated ✓
              </Heading>
              <Text style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 16px", lineHeight: 1.6 }}>
                Your order #{`ONX-${order.display_id}`} has been updated. Here's a summary of what changed.
              </Text>
              <Hr style={{ borderColor: "#1f1f1f", margin: 0 }} />
            </Section>

            {/* Changes */}
            {changes.length > 0 && (
              <Section style={{ background: "#111111", padding: "20px 24px 4px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
                <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: 700, margin: "0 0 16px" }}>
                  Changes applied
                </Text>
                {changes.map((c, i) => (
                  <ChangeItem key={i} c={c} formatter={formatter} />
                ))}
                <Hr style={{ borderColor: "#1f1f1f", margin: "8px 0 16px" }} />
              </Section>
            )}



            {/* CTA */}
            <Section style={{ background: "#111111", padding: "0 24px 28px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
              <ViewOrderButton token={orderViewToken} />
              {!hasRegisteredAccount && <ActivateAccountBlock token={orderViewToken} />}
            </Section>

            {/* Footer */}
            <Section style={{ background: "#000000", borderRadius: "0 0 12px 12px", padding: "20px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f", borderBottom: "1px solid #1f1f1f" }}>
              <Text style={{ color: "#6b7280", fontSize: 12, textAlign: "center", margin: "0 0 4px", lineHeight: 1.6 }}>
                Questions? Reply to this email or contact{" "}
                <Link href="mailto:sales@onyxgenetics.com" style={{ color: "#9ca3af" }}>sales@onyxgenetics.com</Link>
              </Text>
              <Text style={{ color: "#374151", fontSize: 11, textAlign: "center", margin: 0 }}>
                © {new Date().getFullYear()} Onyx Genetics. All rights reserved.
              </Text>
            </Section>

          </Container>
        </Body>
      </Html>
    </Tailwind>
  )
}

export const orderEditConfirmedEmail = (props: OrderEditConfirmedEmailProps) => (
  <OrderEditConfirmedEmailComponent {...props} />
)

export default OrderEditConfirmedEmailComponent
