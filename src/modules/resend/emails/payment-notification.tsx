import {
  Text,
  Column,
  Container,
  Heading,
  Html,
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

type PaymentNotificationEmailProps = {
  order: {
    id: string
    display_id: number
    email: string
    currency_code: string
  }
  amountDue: number
  providerId?: string
  orderViewToken: string
  hasRegisteredAccount?: boolean
}

const STORE_URL = process.env.STORE_URL || "https://onyxgenetics.com"
const BTC_ADDRESS = process.env.BTC_WALLET_ADDRESS || process.env.NEXT_PUBLIC_BTC_WALLET_ADDRESS || ""
const PAYPAL_ADDRESS = process.env.PAYPAL_WALLET_ADDRESS || process.env.NEXT_PUBLIC_PAYPAL_WALLET_ADDRESS || ""

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

function PaymentNotificationEmailComponent({
  order,
  amountDue = 0,
  providerId = "",
  orderViewToken,
  hasRegisteredAccount = false,
}: PaymentNotificationEmailProps) {

  const formatter = new Intl.NumberFormat([], {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: order.currency_code || "USD",
  })

  return (
    <Tailwind config={{ theme: { extend: { colors: { brand: "#111111" } } } }}>
      <Html style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <Head />
        <Preview>Payment required for order #{`ONX-${order.display_id}`} — {formatter.format(amountDue)}</Preview>
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
                Order updated — payment required
              </Heading>
              <Text style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 4px", lineHeight: 1.6 }}>
                Your order #{`ONX-${order.display_id}`} has been updated and an additional payment is required.
              </Text>
              <Hr style={{ borderColor: "#1f1f1f", margin: "16px 0 0" }} />
            </Section>

            {/* Amount due */}
            <Section style={{ background: "#111111", padding: "20px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
              <Row>
                <Column>
                  <Text style={{ color: "#9ca3af", fontSize: 13, fontWeight: 700, margin: 0 }}>
                    Amount due
                  </Text>
                </Column>
                <Column align="right">
                  <Text style={{ color: "#b8ff2b", fontSize: 20, fontWeight: 800, margin: 0 }}>
                    {formatter.format(amountDue)}
                  </Text>
                </Column>
              </Row>
              <Hr style={{ borderColor: "#1f1f1f", margin: "16px 0 0" }} />
            </Section>

            {/* Payment instructions */}
            <Section style={{ background: "#111111", padding: "0 24px 20px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
              <PaymentInstructionsBlock
                providerId={providerId}
                amountFormatted={formatter.format(amountDue)}
                orderDisplayId={order.display_id}
              />
            </Section>

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

export const paymentNotificationEmail = (props: PaymentNotificationEmailProps) => (
  <PaymentNotificationEmailComponent {...props} />
)

export default PaymentNotificationEmailComponent
