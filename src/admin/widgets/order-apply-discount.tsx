import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Text, Button, Input, toast } from "@medusajs/ui"
import { Tag, Trash } from "@medusajs/icons"
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

const OrderApplyDiscountWidget = ({ data }: { data: any }) => {
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  const currencyCode: string = data?.currency_code ?? "USD"
  const currentDiscount = parseNum(data?.discount_total)
  const isCanceled = data?.status === "canceled"

  if (isCanceled) return null

  const formatter = new Intl.NumberFormat([], {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: currencyCode,
  })

  const sendRequest = async (payload: object, isRemove = false) => {
    const res = await fetch(`/admin/orders/${data.id}/apply-discount`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    toast.success(isRemove ? "Discount removed" : "Discount applied")
    setTimeout(() => window.location.reload(), 800)
  }

  const handleApply = async () => {
    const numAmount = parseFloat(amount)
    if (!numAmount || numAmount <= 0) {
      toast.error("Enter a valid discount amount")
      return
    }
    setSaving(true)
    try {
      await sendRequest({ amount: numAmount, reason: reason.trim() || undefined })
      setAmount("")
      setReason("")
    } catch (err: any) {
      toast.error(err.message || "Failed to apply discount")
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    try {
      await sendRequest({ amount: 0 }, true)
    } catch (err: any) {
      toast.error(err.message || "Failed to remove discount")
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Container className="divide-y divide-ui-border-base p-0">
      <div className="px-6 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="text-ui-fg-subtle" />
          <Text size="small" weight="plus" className="text-ui-fg-base">
            Manual Discount
          </Text>
          {currentDiscount > 0 && (
            <span className="ml-auto text-xs font-semibold text-emerald-400">
              Active: -{formatter.format(currentDiscount)}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Input
            type="number"
            placeholder={`Amount (${currencyCode})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={0}
            step="0.01"
          />
          <Input
            placeholder="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="small"
              variant="secondary"
              onClick={handleApply}
              isLoading={saving}
              disabled={saving || removing || !amount}
              className="flex-1"
            >
              {currentDiscount > 0 ? "Update discount" : "Apply discount"}
            </Button>
            {currentDiscount > 0 && (
              <Button
                size="small"
                variant="transparent"
                onClick={handleRemove}
                isLoading={removing}
                disabled={saving || removing}
              >
                <Trash />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Container>
  )
}

export default OrderApplyDiscountWidget

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
})
