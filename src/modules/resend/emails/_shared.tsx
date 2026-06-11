import { Section, Text, Link } from "@react-email/components"
import * as React from "react"

const STORE_URL = process.env.STORE_URL || "https://onyxgenetics.com"

export function ViewOrderButton({ token }: { token: string }) {
  const href = `${STORE_URL}/orders/${token}`
  return (
    <Section style={{ textAlign: "center", margin: "20px 0" }}>
      {/* Bulletproof button — table-based for Outlook compatibility */}
      <Link
        href={href}
        style={{
          background: "#1f1f1f",
          color: "#9ca3af",
          textDecoration: "none",
          display: "inline-block",
          padding: "12px 32px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          border: "1px solid #2a2a2a",
          msoHide: "none",
        } as React.CSSProperties}
      >
        View your order →
      </Link>
      {/* Plain-text fallback visible in clients that strip HTML */}
      <Text style={{ color: "#374151", fontSize: 11, margin: "6px 0 0", textAlign: "center" }}>
        Or copy: {href}
      </Text>
    </Section>
  )
}

export function ActivateAccountBlock({ token }: { token: string }) {
  const href = `${STORE_URL}/orders/${token}`
  return (
    <Section style={{
      background: "#0d1700",
      border: "1px solid #b8ff2b22",
      borderRadius: 10,
      padding: "16px 20px",
      margin: "20px 0 0",
    }}>
      <Text style={{ color: "#b8ff2b", fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>
        Track all your orders in one place
      </Text>
      <Text style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 14px", lineHeight: 1.6 }}>
        Activate your account — no password, one click. Every order you've placed will appear in your account automatically.
      </Text>
      <Section style={{ textAlign: "center" }}>
        <Link
          href={href}
          style={{
            background: "#b8ff2b",
            color: "#000000",
            textDecoration: "none",
            display: "inline-block",
            padding: "12px 28px",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          Activate account →
        </Link>
      </Section>
      <Text style={{ color: "#374151", fontSize: 11, margin: "8px 0 0", textAlign: "center" }}>
        Or open your order page: {href}
      </Text>
    </Section>
  )
}
