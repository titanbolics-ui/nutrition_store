import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Button, toast } from "@medusajs/ui"
import { CurrencyDollar } from "@medusajs/icons"
import { useState } from "react"

function parseNum(v: unknown): number {
  if (typeof v === "number") return v
  if (typeof v === "string") return parseFloat(v) || 0
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>
    if ("numeric_" in o) return parseFloat(String(o.numeric_)) || 0
    if ("value" in o) return parseFloat(String(o.value)) || 0
  }
  return 0
}

const OrderPaymentNotificationWidget = ({ data }: { data: any }) => {
  const [sending, setSending] = useState(false)

  const pendingDiff = parseNum(data?.summary?.pending_difference)
  const currencyCode: string = data?.currency_code ?? "USD"

  const payments: any[] =
    data?.payment_collections?.flatMap((pc: any) => pc.payments ?? []) ?? []
  const customerPayment = payments.find(
    (p: any) => p.provider_id && !p.provider_id.includes("system_default")
  )
  const providerId: string =
    customerPayment?.provider_id ||
    data?.payment_collections?.[0]?.payment_sessions?.[0]?.provider_id ||
    ""

  const formatter = new Intl.NumberFormat([], {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: currencyCode,
  })

  // Nothing to show if no outstanding balance in either direction
  if (pendingDiff === 0) return null

  const isRefundDue = pendingDiff < 0

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await fetch(
        `/admin/orders/${data.id}/send-payment-notification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            amount_due: pendingDiff,
            provider_id: providerId,
            currency_code: currencyCode,
          }),
        }
      )
      if (!res.ok) throw new Error(await res.text())
      toast.success("Payment notification sent")
    } catch (err: any) {
      toast.error(err.message || "Failed to send notification")
    } finally {
      setSending(false)
    }
  }

  if (isRefundDue) {
    return (
      <Container className="divide-y divide-ui-border-base p-0">
        <div className="px-6 py-4 flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ui-bg-subtle flex-shrink-0">
            <CurrencyDollar className="text-ui-fg-subtle" />
          </div>
          <div>
            <Text size="small" weight="plus" className="text-ui-fg-base leading-tight">
              Refund due
            </Text>
            <Text size="small" className="text-ui-fg-subtle leading-tight">
              {formatter.format(Math.abs(pendingDiff))} to be refunded to customer
            </Text>
          </div>
        </div>
      </Container>
    )
  }

  return (
    <Container className="divide-y divide-ui-border-base p-0">
      <div className="px-6 py-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ui-bg-subtle">
            <CurrencyDollar className="text-ui-fg-subtle" />
          </div>
          <div>
            <Text size="small" weight="plus" className="text-ui-fg-base leading-tight">
              Payment outstanding
            </Text>
            <Text size="small" className="text-ui-fg-subtle leading-tight">
              {formatter.format(pendingDiff)} due from customer
            </Text>
          </div>
        </div>
        <Button
          size="small"
          variant="secondary"
          onClick={handleSend}
          isLoading={sending}
          disabled={sending}
        >
          Send notification
        </Button>
      </div>
    </Container>
  )
}

export default OrderPaymentNotificationWidget

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
})
