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

type OrderEditRequestedEmailProps = {
  order: {
    id: string
    display_id: number
    email: string
    currency_code: string
    total?: number
    items?: { product_title?: string; title?: string; variant_title?: string; quantity: number; unit_price: number }[]
  }
  changes?: ResolvedChange[]
  amountDue?: number
  paidTotal?: number
  paymentMethod?: string
  orderViewToken: string
  hasRegisteredAccount?: boolean
}

const STORE_URL = process.env.STORE_URL || "https://onyxgenetics.com"

const ACTION_COLORS = {
  add:    { text: "#6ee7b7", bg: "#031a0e", border: "#10b98133", badge: "+ Added" },
  remove: { text: "#fca5a5", bg: "#1a0000", border: "#ef444433", badge: "− Removed" },
  update: { text: "#93c5fd", bg: "#00071a", border: "#3b82f633", badge: "↻ Updated" },
}

function ChangeItem({ c, formatter }: { c: ResolvedChange; formatter: Intl.NumberFormat }) {
  const color  = ACTION_COLORS[c.action_type]
  const strike = c.action_type === "remove"

  return (
    <Row style={{ marginBottom: 12 }}>
      {/* Thumbnail */}
      <Column style={{ width: 44, verticalAlign: "top" }}>
        {c.thumbnail ? (
          <Img src={c.thumbnail} width="36" height="36" alt="" style={{ borderRadius: 6, background: "#1a1a1a", display: "block" }} />
        ) : (
          <Section style={{ width: 36, height: 36, background: "#1a1a1a", borderRadius: 6 }} />
        )}
      </Column>

      {/* Title + variant */}
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

      {/* Amount diff */}
      <Column align="right" style={{ width: 80, verticalAlign: "top" }}>
        <Text style={{ color: color.text, fontSize: 13, fontWeight: 700, margin: 0 }}>
          {c.amount >= 0 ? "+" : ""}{formatter.format(c.amount)}
        </Text>
      </Column>
    </Row>
  )
}

function OrderEditRequestedEmailComponent({
  order,
  changes = [],
  amountDue = 0,
  paidTotal = 0,
  paymentMethod = "",
  orderViewToken,
  hasRegisteredAccount = false,
}: OrderEditRequestedEmailProps) {
  const formatter = new Intl.NumberFormat([], {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: order.currency_code || "USD",
  })

  const owes       = amountDue > 0                   // customer needs to pay more
  const canRefund  = amountDue < 0 && paidTotal > 0  // decrease AND something was paid
  const justLower  = amountDue < 0 && paidTotal === 0 // decrease but nothing paid yet

  return (
    <Tailwind config={{ theme: { extend: { colors: { brand: "#111111" } } } }}>
      <Html style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <Head />
        <Preview>Action required: confirm changes to order #{`ONX-${order.display_id}`}</Preview>
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
                Order update requested
              </Heading>
              <Text style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 16px", lineHeight: 1.6 }}>
                We've proposed changes to order #{`ONX-${order.display_id}`}. Please review and confirm or decline via your account.
              </Text>
              <Hr style={{ borderColor: "#1f1f1f", margin: 0 }} />
            </Section>

            {/* Proposed changes */}
            {changes.length > 0 && (
              <Section style={{ background: "#111111", padding: "20px 24px 4px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
                <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: 700, margin: "0 0 16px" }}>
                  Proposed changes
                </Text>
                {changes.map((c, i) => (
                  <ChangeItem key={i} c={c} formatter={formatter} />
                ))}

                {amountDue !== 0 && (
                  <Section style={{ borderTop: "1px solid #2a2a2a", marginTop: 4, paddingTop: 12, marginBottom: 16 }}>
                    <Row>
                      <Column>
                        <Text style={{ color: "#9ca3af", fontSize: 13, fontWeight: 700, margin: 0 }}>
                          {owes ? "Additional amount due if confirmed" : "Order total decrease"}
                        </Text>
                      </Column>
                      <Column align="right">
                        <Text style={{ color: owes ? "#b8ff2b" : "#6ee7b7", fontSize: 15, fontWeight: 800, margin: 0 }}>
                          {owes ? "+" : ""}{formatter.format(amountDue)}
                        </Text>
                      </Column>
                    </Row>
                  </Section>
                )}
              </Section>
            )}

            {/* Payment notice */}
            {owes && (
              <Section style={{ background: "#111111", padding: "0 24px 20px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
                <Section style={{ background: "#1a1200", border: "1px solid #b8ff2b33", borderRadius: 10, padding: "14px 16px" }}>
                  <Text style={{ color: "#b8ff2b", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>
                    💳 Additional payment required if confirmed
                  </Text>
                  <Text style={{ color: "#d1d5db", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                    If you confirm, please send{" "}
                    <strong style={{ color: "#ffffff" }}>{formatter.format(amountDue)}</strong>
                    {paymentMethod ? ` via ${paymentMethod}` : ""} — the same method as your original payment. Reply to this email with confirmation once sent.
                  </Text>
                </Section>
              </Section>
            )}

            {/* Note when order was paid and total decreased */}
            {canRefund && (
              <Section style={{ background: "#111111", padding: "0 24px 20px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
                <Section style={{ background: "#111820", border: "1px solid #3b82f633", borderRadius: 10, padding: "14px 16px" }}>
                  <Text style={{ color: "#93c5fd", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>
                    📌 Note: your order has already been paid
                  </Text>
                  <Text style={{ color: "#d1d5db", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                    Your order total will decrease by{" "}
                    <strong style={{ color: "#ffffff" }}>{formatter.format(Math.abs(amountDue))}</strong>.
                    {" "}Since your order has already been paid, a refund or store credit will be initiated for the difference.
                  </Text>
                </Section>
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

export const orderEditRequestedEmail = (props: OrderEditRequestedEmailProps) => (
  <OrderEditRequestedEmailComponent {...props} />
)

export default OrderEditRequestedEmailComponent
