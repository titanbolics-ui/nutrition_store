import {
  Body, Container, Head, Html, Preview,
  Section, Text, Tailwind, Row, Column, Link,
} from "@react-email/components";
import * as React from "react";

type CustomerWelcomeEmailProps = {
  customer: {
    first_name?: string;
  };
  store_url: string;
};

function CustomerWelcomeEmailComponent({
  customer,
  store_url,
}: CustomerWelcomeEmailProps) {
  const name = customer.first_name || "Athlete";

  return (
    <Tailwind config={{ theme: { extend: { colors: { brand: "#111111" } } } }}>
      <Html style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <Head />
        <Preview>Welcome to Onyx Genetics, {name} 💪</Preview>
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
              </Row>
            </Section>

            {/* Hero */}
            <Section style={{ background: "#111111", padding: "32px 24px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
              <Text style={{ color: "#b8ff2b", fontSize: 28, fontWeight: 800, margin: "0 0 6px", letterSpacing: -0.5 }}>
                Welcome to the club 💪
              </Text>
              <Text style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
                Hi {name}, your account is ready. Browse our full lineup of tested, transparent products and build the stack that actually works for you.
              </Text>
              <Section style={{ textAlign: "center" }}>
                <Link
                  href={store_url}
                  style={{ background: "#b8ff2b", color: "#000000", textDecoration: "none", display: "inline-block", padding: "13px 32px", borderRadius: 8, fontWeight: 700, fontSize: 14 }}
                >
                  Shop now →
                </Link>
              </Section>
            </Section>

            {/* Perks */}
            <Section style={{ background: "#111111", padding: "20px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
              {[
                { icon: "🧪", title: "Lab tested", body: "Every batch tested for purity and potency. Results published." },
                { icon: "📦", title: "Two-warehouse dispatch", body: "Orders ship from the closest warehouse — faster delivery, lower risk." },
                { icon: "💬", title: "Real support", body: "Reply to any email and a real person gets back to you." },
              ].map(({ icon, title, body }) => (
                <Row key={title} style={{ marginBottom: 16 }}>
                  <Column style={{ width: 32 }}>
                    <Text style={{ fontSize: 18, margin: 0 }}>{icon}</Text>
                  </Column>
                  <Column>
                    <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: 600, margin: "0 0 2px" }}>{title}</Text>
                    <Text style={{ color: "#6b7280", fontSize: 12, margin: 0, lineHeight: 1.5 }}>{body}</Text>
                  </Column>
                </Row>
              ))}
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

export const customerWelcomeEmail = (props: CustomerWelcomeEmailProps) => (
  <CustomerWelcomeEmailComponent {...props} />
);

export default CustomerWelcomeEmailComponent;
