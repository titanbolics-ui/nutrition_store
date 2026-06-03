import {
  Body, Container, Head, Html, Preview,
  Section, Text, Tailwind, Hr, Row, Column, Link,
} from "@react-email/components";
import * as React from "react";

type OrderTransferRequestedEmailProps = {
  order: {
    id: string;
    display_id?: number | string;
    email?: string;
  };
  token: string;
  accept_url: string;
  customer?: {
    first_name?: string;
    email?: string;
  };
};

function OrderTransferRequestedEmailComponent({
  order,
  token,
  accept_url,
  customer,
}: OrderTransferRequestedEmailProps) {
  const customerName = customer?.first_name || customer?.email || "there";
  const orderLabel = order.display_id ? `#ONX-${order.display_id}` : order.id;

  return (
    <Tailwind config={{ theme: { extend: { colors: { brand: "#111111" } } } }}>
      <Html style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <Head />
        <Preview>{`Confirm transfer for order ${orderLabel}`}</Preview>
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
                    {orderLabel}
                  </Text>
                </Column>
              </Row>
            </Section>

            {/* Hero */}
            <Section style={{ background: "#111111", padding: "28px 24px 20px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
              <Text style={{ color: "#ffffff", fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>
                Order transfer request
              </Text>
              <Text style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 4px", lineHeight: 1.6 }}>
                Hi {customerName}, a request has been made to transfer order{" "}
                <strong style={{ color: "#ffffff" }}>{orderLabel}</strong> to your customer account.
              </Text>
              <Text style={{ color: "#9ca3af", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
                Use the token below or click the button to confirm the transfer.
              </Text>
              <Hr style={{ borderColor: "#1f1f1f", margin: "20px 0 0" }} />
            </Section>

            {/* Token */}
            <Section style={{ background: "#111111", padding: "20px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
              <Section style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, padding: "14px 16px", marginBottom: 20 }}>
                <Text style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, margin: "0 0 6px" }}>
                  Transfer token
                </Text>
                <Text style={{ color: "#ffffff", fontFamily: "monospace", fontSize: 15, fontWeight: 700, wordBreak: "break-all", margin: 0, letterSpacing: 0.5 }}>
                  {token}
                </Text>
              </Section>

              <Section style={{ textAlign: "center", marginBottom: 20 }}>
                <Link
                  href={accept_url}
                  style={{ background: "#b8ff2b", color: "#000000", textDecoration: "none", display: "inline-block", padding: "13px 32px", borderRadius: 8, fontWeight: 700, fontSize: 14 }}
                >
                  Confirm transfer →
                </Link>
              </Section>

              <Text style={{ color: "#4b5563", fontSize: 12, margin: "0 0 4px" }}>
                Or open this link directly:
              </Text>
              <Link
                href={accept_url}
                style={{ color: "#6b7280", fontSize: 12, wordBreak: "break-all" }}
              >
                {accept_url}
              </Link>
            </Section>

            {/* Footer */}
            <Section style={{ background: "#000000", borderRadius: "0 0 12px 12px", padding: "20px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f", borderBottom: "1px solid #1f1f1f" }}>
              <Text style={{ color: "#4b5563", fontSize: 12, textAlign: "center", margin: "0 0 6px", lineHeight: 1.6 }}>
                If you did not expect this request, you can safely ignore this email.
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

export const orderTransferRequestedEmail = (
  props: OrderTransferRequestedEmailProps
) => <OrderTransferRequestedEmailComponent {...props} />;

export default OrderTransferRequestedEmailComponent;
