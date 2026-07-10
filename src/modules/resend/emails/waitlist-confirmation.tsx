import { Body, Container, Head, Html, Preview, Section, Text, Tailwind } from "@react-email/components"
import * as React from "react"

type WaitlistConfirmationEmailProps = {
  productTitle: string
}

function WaitlistConfirmationEmailComponent({ productTitle }: WaitlistConfirmationEmailProps) {
  return (
    <Tailwind>
      <Html style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <Head />
        <Preview>You're on the waitlist for {productTitle}</Preview>
        <Body style={{ background: "#0a0a0a", margin: 0, padding: "32px 0" }}>
          <Container style={{ maxWidth: 480, margin: "0 auto" }}>

            <Section style={{ background: "#000000", borderRadius: "12px 12px 0 0", padding: "20px 24px" }}>
              <Text style={{ color: "#b8ff2b", fontSize: 18, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
                ONYX GENETICS
              </Text>
            </Section>

            <Section style={{ background: "#111111", padding: "28px 24px", border: "1px solid #1f1f1f", borderTop: "none" }}>
              <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
                You're on the waitlist
              </Text>
              <Text style={{ color: "#9ca3af", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
                You're on the waitlist for {productTitle}. When it's back in stock we'll email you a 10% code.
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

export const waitlistConfirmationEmail = (props: WaitlistConfirmationEmailProps) => (
  <WaitlistConfirmationEmailComponent {...props} />
)

export default WaitlistConfirmationEmailComponent
