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
} from "@react-email/components";
import { BigNumberValue, CustomerDTO, OrderDTO } from "@medusajs/types";
import * as React from "react";

type OrderPlacedEmailProps = {
  order: OrderDTO & { customer: CustomerDTO };
  email_banner?: { body: string; title: string; url: string };
  paymentProviderID?: string;
};

type PaymentInstructionProps = {
  order: OrderDTO;
  formatPrice: (price: BigNumberValue) => string;
  btcAmount: string | null;
};

const STORE_URL = process.env.STORE_URL || "https://onyxgenetics.com";
const BTC_ADDRESS = process.env.NEXT_PUBLIC_BTC_WALLET_ADDRESS || "";
const PAYPAL_ADDRESS = process.env.NEXT_PUBLIC_PAYPAL_WALLET_ADDRESS || "";

// ─── Shared sub-components ────────────────────────────────────────────────────

const AddressBox = ({ label, value }: { label: string; value: string }) => (
  <Section style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, padding: "12px 16px", marginBottom: 0 }}>
    <Text style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, margin: "0 0 6px" }}>
      {label}
    </Text>
    <Text style={{ color: "#ffffff", fontFamily: "monospace", fontSize: 13, wordBreak: "break-all", margin: 0 }}>
      {value}
    </Text>
  </Section>
);

const PaymentConfirmationSection = () => (
  <Section style={{ background: "#1a1200", border: "1px solid #b8ff2b33", borderRadius: 10, padding: "14px 14px", marginBottom: 24 }}>
    <Text style={{ color: "#b8ff2b", fontSize: 13, fontWeight: 700, margin: "0 0 8px" }}>
      📸 Action required: send payment proof
    </Text>
    <Text style={{ color: "#d1d5db", fontSize: 13, lineHeight: 1.6, margin: "0 0 6px" }}>
      Once you've completed the payment, please <strong style={{ color: "#ffffff" }}>reply to this email</strong> with a screenshot or confirmation of your payment. This helps us process your order without delays.
    </Text>
    <Text style={{ color: "#9ca3af", fontSize: 12, margin: 0 }}>
      Simply hit "Reply" and attach your payment screenshot.
    </Text>
  </Section>
);

// ─── Payment method sections ──────────────────────────────────────────────────

const CashAppInstructions = ({ order, formatPrice }: PaymentInstructionProps) => (
  <Section style={{ background: "#031a0e", border: "1px solid #10b98133", borderRadius: 10, padding: "16px 14px", marginBottom: 24 }}>
    <Row>
      <Column>
        <Heading style={{ color: "#ffffff", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
          Pay via Cash App
        </Heading>
      </Column>
      <Column align="right">
        <Text style={{ color: "#10b981", fontSize: 11, fontWeight: 700, margin: 0 }}>FASTEST METHOD</Text>
      </Column>
    </Row>
    <Text style={{ color: "#6ee7b7", fontSize: 13, fontWeight: 600, margin: "0 0 16px" }}>
      Amount due: {formatPrice(order.total)}
    </Text>
    <Text style={{ color: "#d1d5db", fontSize: 13, margin: "0 0 12px" }}>
      Complete your payment in 60 seconds using Bitcoin on Cash App:
    </Text>
    <Section style={{ background: "#0d1a12", border: "1px solid #10b98120", borderRadius: 8, padding: "12px 12px", marginBottom: 16 }}>
      {[
        { n: 1, t: <>Open Cash App and tap the <strong style={{ color: "#ffffff" }}>Bitcoin</strong> tab</> },
        { n: 2, t: <>Tap <strong style={{ color: "#ffffff" }}>Buy</strong>, enter exactly <strong style={{ color: "#6ee7b7" }}>{formatPrice(order.total)}</strong>, tap <strong style={{ color: "#ffffff" }}>Confirm</strong></> },
        { n: 3, t: <>After purchase tap <strong style={{ color: "#ffffff" }}>Send Bitcoin</strong> on the Bitcoin screen</> },
        { n: 4, t: <>Paste the wallet address below into the <strong style={{ color: "#ffffff" }}>To</strong> field and confirm</> },
      ].map(({ n, t }) => (
        <Row key={n} style={{ marginBottom: n < 4 ? 10 : 0 }}>
          <Column style={{ width: 24 }}>
            <Text style={{ color: "#10b981", fontSize: 13, fontWeight: 700, margin: 0 }}>{n}.</Text>
          </Column>
          <Column>
            <Text style={{ color: "#d1d5db", fontSize: 13, margin: 0, lineHeight: 1.5 }}>{t}</Text>
          </Column>
        </Row>
      ))}
    </Section>
    <AddressBox label="Bitcoin address — copy exactly" value={BTC_ADDRESS} />
    <Text style={{ color: "#6b7280", fontSize: 11, textAlign: "center", margin: "10px 0 0" }}>
      Order status updates automatically once payment is detected.
    </Text>
  </Section>
);

const CryptoInstructions = ({ order, formatPrice, btcAmount }: PaymentInstructionProps) => (
  <Section style={{ background: "#1a0d00", border: "1px solid #f9731633", borderRadius: 10, padding: "20px 24px", marginBottom: 24 }}>
    <Heading style={{ color: "#ffffff", fontSize: 18, fontWeight: 700, margin: "0 0 12px" }}>
      ₿ Bitcoin Payment
    </Heading>
    <Text style={{ color: "#d1d5db", fontSize: 13, margin: "0 0 16px", lineHeight: 1.6 }}>
      Please send exactly{" "}
      <strong style={{ color: "#fb923c" }}>
        {btcAmount && btcAmount !== "0" ? `${btcAmount} BTC` : formatPrice(order.total)}
      </strong>{" "}
      to the address below. Send only BTC — other coins will be lost.
    </Text>
    <AddressBox label="Bitcoin (BTC) wallet address" value={BTC_ADDRESS} />
  </Section>
);

const PayPalInstructions = ({ order, formatPrice }: PaymentInstructionProps) => (
  <Section style={{ background: "#00071a", border: "1px solid #3b82f633", borderRadius: 10, padding: "20px 24px", marginBottom: 24 }}>
    <Heading style={{ color: "#ffffff", fontSize: 18, fontWeight: 700, margin: "0 0 12px" }}>
      💳 PayPal Payment
    </Heading>
    <Section style={{ background: "#3b0000", border: "1px solid #ef444433", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
      <Text style={{ color: "#fca5a5", fontSize: 13, fontWeight: 700, margin: 0 }}>
        ⚠️ You must select "Friends &amp; Family" — NOT "Goods &amp; Services"
      </Text>
    </Section>
    <Text style={{ color: "#d1d5db", fontSize: 13, margin: "0 0 16px", lineHeight: 1.6 }}>
      Send <strong style={{ color: "#93c5fd" }}>{formatPrice(order.total)}</strong> via PayPal. Do not include any notes or comments in the payment.
    </Text>
    <AddressBox label="PayPal email — copy exactly" value={PAYPAL_ADDRESS} />
    <Text style={{ color: "#fbbf24", fontSize: 12, margin: "10px 0 0" }}>
      ⚠️ Do not include any notes, comments, or order references in the payment.
    </Text>
  </Section>
);

const CardInstructions = ({ order }: { order: OrderDTO }) => {
  const paymentUrl = `${STORE_URL}/us/order/${order.id}/confirmed`;
  const now = new Date();
  const day = now.getDay();
  const dispatchDay = day >= 1 && day <= 3 ? "Thursday morning" : "Monday morning";

  return (
    <Section style={{ background: "#00071a", border: "1px solid #3b82f633", borderRadius: 10, padding: "20px 24px", marginBottom: 24 }}>
      <Heading style={{ color: "#ffffff", fontSize: 18, fontWeight: 700, margin: "0 0 12px" }}>
        💳 Complete Your Payment
      </Heading>
      <Text style={{ color: "#d1d5db", fontSize: 13, margin: "0 0 6px", lineHeight: 1.6 }}>
        Your order is reserved for the <strong style={{ color: "#ffffff" }}>{dispatchDay} dispatch</strong>.
        Use the secure payment terminal to finalise your order.
      </Text>
      <Section style={{ textAlign: "center", margin: "20px 0" }}>
        <Link
          href={paymentUrl}
          style={{ background: "#b8ff2b", color: "#000000", textDecoration: "none", display: "inline-block", padding: "14px 32px", borderRadius: 8, fontWeight: 700, fontSize: 15 }}
        >
          Pay Securely →
        </Link>
      </Section>
      <Text style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>
        Prefer Cash App, PayPal, or BTC? Reply to this email and we'll assist.
      </Text>
    </Section>
  );
};

const GenericPaymentInstructions = () => (
  <Section style={{ background: "#111827", border: "1px solid #374151", borderRadius: 10, padding: "20px 24px", marginBottom: 24 }}>
    <Text style={{ color: "#d1d5db", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
      Our team will be in touch shortly with payment instructions. If you need immediate assistance, please reply to this email.
    </Text>
  </Section>
);

// ─── Main component ───────────────────────────────────────────────────────────

function OrderPlacedEmailComponent({
  order,
  email_banner,
  paymentProviderID = "unknown",
}: OrderPlacedEmailProps) {
  const meta = order.metadata?.payment_method as string | undefined;

  const isCashApp = paymentProviderID.includes("cash-app") || meta === "CASHAPP";
  const isCrypto = paymentProviderID.includes("crypto-manual") || meta === "BTC" || meta === "CRYPTO";
  const isPayPal = paymentProviderID.includes("paypal-manual") || meta === "PAYPAL";
  const isCard = paymentProviderID.includes("card-manual") || meta === "CARD";

  const btcAmount = order.metadata?.amount_btc != null ? String(order.metadata.amount_btc) : null;

  const formatter = new Intl.NumberFormat([], {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: order.currency_code || "USD",
  });

  const formatPrice = (price: BigNumberValue): string => {
    const n = Number(price as any);
    if (!Number.isNaN(n) && n !== 0) return formatter.format(n);
    if (typeof price === "number") return formatter.format(price);
    if (typeof price === "string") {
      const p = parseFloat(price);
      return Number.isNaN(p) ? price : formatter.format(p);
    }
    return String(price ?? "");
  };

  const customerName =
    order.customer?.first_name || order.shipping_address?.first_name || "there";

  const orderUrl = `${STORE_URL}/us/account/orders/details/${order.id}`;

  return (
    <Tailwind config={{ theme: { extend: { colors: { brand: "#111111" } } } }}>
      <Html style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <Head />
        <Preview>Order confirmed #{`ONX-${order.display_id}`} — complete your payment</Preview>
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
                Order confirmed ✓
              </Heading>
              <Text style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 16px", lineHeight: 1.6 }}>
                Hi {customerName}, thanks for your order. Complete the payment below to get your items dispatched.
              </Text>
              <Hr style={{ borderColor: "#1f1f1f", margin: "0" }} />
            </Section>

            {/* Payment Instructions */}
            <Section style={{ background: "#111111", padding: "16px 14px 4px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
              {isCashApp && <CashAppInstructions order={order} formatPrice={formatPrice} btcAmount={btcAmount} />}
              {isCrypto && <CryptoInstructions order={order} formatPrice={formatPrice} btcAmount={btcAmount} />}
              {isPayPal && <PayPalInstructions order={order} formatPrice={formatPrice} btcAmount={btcAmount} />}
              {isCard && <CardInstructions order={order} />}
              {!isCashApp && !isCrypto && !isPayPal && !isCard && <GenericPaymentInstructions />}

              {/* Screenshot request — all methods */}
              <PaymentConfirmationSection />
            </Section>

            <Hr style={{ borderColor: "#1f1f1f", margin: 0 }} />

            {/* Promo banner */}
            {email_banner && "title" in email_banner && (
              <Section style={{ background: "#111111", padding: "0 24px 20px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
                <Section style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%)", border: "1px solid #b8ff2b33", borderRadius: 10, padding: "16px 20px" }}>
                  <Row>
                    <Column>
                      <Text style={{ color: "#b8ff2b", fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>{email_banner.title}</Text>
                      <Text style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>{email_banner.body}</Text>
                    </Column>
                    <Column align="right" style={{ width: 80 }}>
                      <Link href={email_banner.url} style={{ color: "#b8ff2b", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                        Shop →
                      </Link>
                    </Column>
                  </Row>
                </Section>
              </Section>
            )}

            {/* Order Items */}
            <Section style={{ background: "#111111", padding: "20px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
              <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: 700, margin: "0 0 16px" }}>
                Your items
              </Text>
              {order.items?.map((item) => (
                <Section key={item.id} style={{ borderBottom: "1px solid #1f1f1f", paddingBottom: 14, marginBottom: 14 }}>
                  <Row>
                    <Column style={{ width: 56 }}>
                      <Img src={item.thumbnail ?? ""} alt={item.product_title ?? ""} width="48" height="48" style={{ borderRadius: 6, background: "#1a1a1a", display: "block" }} />
                    </Column>
                    <Column>
                      <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: 600, margin: "0 0 2px", lineHeight: 1.4 }}>
                        {item.product_title}
                      </Text>
                      <Text style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>
                        {item.variant_title}
                      </Text>
                    </Column>
                    <Column align="right" style={{ width: 90 }}>
                      <Text style={{ color: "#6b7280", fontSize: 11, margin: "0 0 2px" }}>
                        {Number(item.quantity)}× {formatPrice(item.unit_price)}
                      </Text>
                      <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: 700, margin: 0 }}>
                        {formatPrice(item.total)}
                      </Text>
                    </Column>
                  </Row>
                </Section>
              ))}

              {/* Summary */}
              <Section style={{ marginTop: 8 }}>
                {[
                  { label: "Subtotal", value: formatPrice(order.item_total) },
                  ...(order.shipping_methods?.map((m) => ({ label: m.name ?? "Shipping", value: formatPrice(m.total) })) ?? []),
                  { label: "Tax", value: formatPrice(order.tax_total || 0) },
                ].map(({ label, value }) => (
                  <Row key={label} style={{ marginBottom: 4 }}>
                    <Column><Text style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>{label}</Text></Column>
                    <Column align="right"><Text style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>{value}</Text></Column>
                  </Row>
                ))}
                <Hr style={{ borderColor: "#1f1f1f", margin: "10px 0" }} />
                <Row>
                  <Column><Text style={{ color: "#ffffff", fontSize: 15, fontWeight: 700, margin: 0 }}>Total</Text></Column>
                  <Column align="right"><Text style={{ color: "#b8ff2b", fontSize: 16, fontWeight: 800, margin: 0 }}>{formatPrice(order.total)}</Text></Column>
                </Row>
              </Section>
            </Section>

            {/* CTA */}
            <Section style={{ background: "#111111", padding: "20px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
              <Section style={{ textAlign: "center" }}>
                <Link
                  href={orderUrl}
                  style={{ background: "#1f1f1f", color: "#9ca3af", textDecoration: "none", display: "inline-block", padding: "11px 28px", borderRadius: 8, fontSize: 13, border: "1px solid #2a2a2a" }}
                >
                  View order details
                </Link>
              </Section>
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
  );
}

export const orderPlacedEmail = (props: OrderPlacedEmailProps) => (
  <OrderPlacedEmailComponent {...props} />
);

export default OrderPlacedEmailComponent;
