import { Body, Container, Head, Html, Preview, Section, Text, Link, Tailwind } from "@react-email/components"
import * as React from "react"

const STORE_URL = process.env.STORE_URL || "https://onyxgenetics.com"

type MagicLinkLoginEmailProps = {
  loginToken: string
  email: string
}

function MagicLinkLoginEmailComponent({ loginToken }: MagicLinkLoginEmailProps) {
  const href = `${STORE_URL}/auth/verify?token=${loginToken}`

  return (
    <Tailwind>
      <Html style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <Head />
        <Preview>Your Onyx Genetics login link</Preview>
        <Body style={{ background: "#0a0a0a", margin: 0, padding: "32px 0" }}>
          <Container style={{ maxWidth: 480, margin: "0 auto" }}>

            <Section style={{ background: "#000000", borderRadius: "12px 12px 0 0", padding: "20px 24px" }}>
              <Text style={{ color: "#b8ff2b", fontSize: 18, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
                ONYX GENETICS
              </Text>
            </Section>

            <Section style={{ background: "#111111", padding: "28px 24px", border: "1px solid #1f1f1f", borderTop: "none" }}>
              <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>
                Your login link
              </Text>
              <Text style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>
                Click the button below to sign in to your account. No password needed.
              </Text>

              {/* Bulletproof CTA */}
              <Section style={{ textAlign: "center", margin: "24px 0" }}>
                <Link
                  href={href}
                  style={{
                    background: "#b8ff2b",
                    color: "#000000",
                    textDecoration: "none",
                    display: "inline-block",
                    padding: "14px 36px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  Sign in →
                </Link>
              </Section>

              <Text style={{ color: "#6b7280", fontSize: 12, textAlign: "center", margin: "0 0 8px" }}>
                This link expires in <strong style={{ color: "#9ca3af" }}>15 minutes</strong> and works only once.
              </Text>
              <Text style={{ color: "#374151", fontSize: 11, textAlign: "center", margin: 0 }}>
                If you didn't request this, ignore this email — your account remains secure.
              </Text>
              <Text style={{ color: "#374151", fontSize: 11, margin: "12px 0 0", textAlign: "center" }}>
                Or copy: {href}
              </Text>
            </Section>

            <Section style={{ background: "#000000", borderRadius: "0 0 12px 12px", padding: "16px 24px", border: "1px solid #1f1f1f", borderTop: "none" }}>
              <Text style={{ color: "#374151", fontSize: 11, textAlign: "center", margin: 0 }}>
                © {new Date().getFullYear()} Onyx Genetics
              </Text>
            </Section>

          </Container>
        </Body>
      </Html>
    </Tailwind>
  )
}

export const magicLinkLoginEmail = (props: MagicLinkLoginEmailProps) => (
  <MagicLinkLoginEmailComponent {...props} />
)

export default MagicLinkLoginEmailComponent
