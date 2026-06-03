import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
  Hr,
  Row,
  Column,
  Link,
  Img,
} from "@react-email/components";
import { BigNumberValue, OrderDTO } from "@medusajs/types";
import * as React from "react";

type OrderPaidEmailProps = {
  order: OrderDTO;
};

const STORE_URL = process.env.STORE_URL || "https://onyxgenetics.com";

function OrderPaidEmailComponent({ order }: OrderPaidEmailProps) {
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

  const now = new Date();
  const day = now.getDay();
  const dispatchDay = day >= 1 && day <= 3 ? "Thursday" : "Monday";
  const dispatchDate = (() => {
    const d = new Date(now);
    const daysUntil = day >= 1 && day <= 3 ? 4 - day : (8 - day) % 7;
    d.setDate(d.getDate() + daysUntil);
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  })();

  const customerName = order.shipping_address?.first_name || "there";
  const orderUrl = `${STORE_URL}/us/account/orders/details/${order.id}`;

  const steps = [
    { done: true,  label: "Payment received", sub: `${formatPrice(order.total)} confirmed` },
    { done: false, label: "Warehouse preparing your items", sub: `Dispatch scheduled: ${dispatchDate}` },
    { done: false, label: "Tracking number sent", sub: "Email when your package ships" },
  ];

  return (
    <Tailwind config={{ theme: { extend: { colors: { brand: "#111111" } } } }}>
      <Html style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <Head />
        <Preview>{`Payment confirmed for #ONX-${order.display_id} — your order is being prepared`}</Preview>
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
              <Text style={{ color: "#b8ff2b", fontSize: 28, fontWeight: 800, margin: "0 0 6px", letterSpacing: -0.5 }}>
                Payment confirmed ✓
              </Text>
              <Text style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>
                Hi {customerName}, we've received your payment and your order is now in the queue.
              </Text>

              {/* Amount card */}
              <Section style={{ background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 10, padding: "14px 16px", marginBottom: 0 }}>
                <Row>
                  <Column>
                    <Text style={{ color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 4px" }}>Amount paid</Text>
                    <Text style={{ color: "#b8ff2b", fontSize: 22, fontWeight: 800, margin: 0 }}>
                      {formatPrice(order.total)}
                    </Text>
                  </Column>
                  <Column align="right">
                    <Text style={{ color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 4px" }}>Order</Text>
                    <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: 700, margin: 0 }}>
                      #{`ONX-${order.display_id}`}
                    </Text>
                  </Column>
                </Row>
              </Section>
            </Section>

            <Hr style={{ borderColor: "#1f1f1f", margin: 0 }} />

            {/* What happens next */}
            <Section style={{ background: "#111111", padding: "20px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
              <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px" }}>
                What happens next
              </Text>
              {steps.map(({ done, label, sub }, i) => (
                <Row key={i} style={{ marginBottom: i < steps.length - 1 ? 14 : 0 }}>
                  <Column style={{ width: 28 }}>
                    <Text style={{
                      color: done ? "#b8ff2b" : "#374151",
                      fontSize: 16,
                      fontWeight: 800,
                      margin: 0,
                      lineHeight: 1,
                    }}>
                      {done ? "✓" : "○"}
                    </Text>
                  </Column>
                  <Column>
                    <Text style={{ color: done ? "#ffffff" : "#9ca3af", fontSize: 13, fontWeight: done ? 600 : 400, margin: "0 0 2px" }}>
                      {label}
                    </Text>
                    <Text style={{ color: "#4b5563", fontSize: 12, margin: 0 }}>
                      {sub}
                    </Text>
                  </Column>
                </Row>
              ))}
            </Section>

            <Hr style={{ borderColor: "#1f1f1f", margin: 0 }} />

            {/* Items */}
            {order.items && order.items.length > 0 && (
              <Section style={{ background: "#111111", padding: "20px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
                <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 14px" }}>
                  Your items
                </Text>
                {order.items.map((item) => (
                  <Row key={item.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #1f1f1f" }}>
                    <Column style={{ width: 48 }}>
                      {item.thumbnail ? (
                        <Img src={item.thumbnail} alt={item.product_title ?? ""} width="40" height="40" style={{ borderRadius: 6, background: "#1a1a1a", display: "block" }} />
                      ) : (
                        <Section style={{ width: 40, height: 40, background: "#1a1a1a", borderRadius: 6 }} />
                      )}
                    </Column>
                    <Column>
                      <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: 600, margin: "0 0 2px", lineHeight: 1.4 }}>
                        {item.product_title}
                      </Text>
                      <Text style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>
                        {item.variant_title} · qty {item.quantity}
                      </Text>
                    </Column>
                  </Row>
                ))}
              </Section>
            )}

            {/* Dispatch notice */}
            <Section style={{ background: "#0d1a06", padding: "16px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f", borderTop: "1px solid #1a2e0a" }}>
              <Text style={{ color: "#86efac", fontSize: 13, margin: "0 0 4px", fontWeight: 600 }}>
                📦 Scheduled for {dispatchDay} dispatch
              </Text>
              <Text style={{ color: "#4b5563", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
                Your order will be packed and shipped on <strong style={{ color: "#6b7280" }}>{dispatchDate}</strong>. You will receive a separate email with your tracking number once it leaves the warehouse.
              </Text>
            </Section>

            {/* CTA */}
            <Section style={{ background: "#111111", padding: "20px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f", textAlign: "center" }}>
              <Link
                href={orderUrl}
                style={{ background: "#1f1f1f", color: "#9ca3af", textDecoration: "none", display: "inline-block", padding: "11px 28px", borderRadius: 8, fontSize: 13, border: "1px solid #2a2a2a" }}
              >
                View order details
              </Link>
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

export const orderPaidEmail = (props: OrderPaidEmailProps) => (
  <OrderPaidEmailComponent {...props} />
);

export default OrderPaidEmailComponent;
