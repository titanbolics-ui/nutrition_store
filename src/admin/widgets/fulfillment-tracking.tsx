import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Input, Button, toast, Badge } from "@medusajs/ui"
import { PencilSquare, CheckMini, XMark } from "@medusajs/icons"
import { useState, useEffect } from "react"

const TRACKING_BASE_URL =
  "https://dealer-send.com/en-US/track-my-shipment?trackingNumber="

type Fulfillment = {
  id: string
  location_id?: string
  shipped_at?: string | null
  labels?: { tracking_number?: string }[]
  metadata?: Record<string, unknown>
}

type TrackingMap = Record<string, string>

const FulfillmentTrackingWidget = ({ data }: { data: any }) => {
  const fulfillments: Fulfillment[] = data?.fulfillments ?? []
  const orderMeta = (data?.metadata ?? {}) as Record<string, any>
  const savedTracking: TrackingMap = (orderMeta.tracking ?? {}) as TrackingMap

  const [inputs, setInputs] = useState<TrackingMap>({})
  const [editing, setEditing] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const init: TrackingMap = {}
    for (const f of fulfillments) {
      const existing =
        f.labels?.[0]?.tracking_number ||
        (f.metadata?.tracking_number as string) ||
        savedTracking[f.id] ||
        ""
      init[f.id] = existing
    }
    setInputs(init)
    // open edit mode for fulfillments that have no tracking yet
    setEditing((prev) => {
      const next = { ...prev }
      for (const f of fulfillments) {
        if (next[f.id] === undefined) next[f.id] = !init[f.id]
      }
      return next
    })
  }, [data])

  if (fulfillments.length === 0) return null

  const handleSave = async (fulfillmentId: string) => {
    const tn = inputs[fulfillmentId]?.trim()
    if (!tn) {
      toast.error("Enter a tracking number first")
      return
    }

    setSaving((s) => ({ ...s, [fulfillmentId]: true }))
    try {
      const res = await fetch(
        `/admin/fulfillments/${fulfillmentId}/tracking`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tracking_number: tn }),
        }
      )
      if (!res.ok) throw new Error(await res.text())
      toast.success("Tracking number saved")
      setEditing((s) => ({ ...s, [fulfillmentId]: false }))
    } catch (err: any) {
      toast.error(err.message || "Failed to save tracking")
    } finally {
      setSaving((s) => ({ ...s, [fulfillmentId]: false }))
    }
  }

  const handleCancel = (fulfillmentId: string, originalTn: string) => {
    setInputs((prev) => ({ ...prev, [fulfillmentId]: originalTn }))
    setEditing((s) => ({ ...s, [fulfillmentId]: false }))
  }

  return (
    <Container className="divide-y divide-ui-border-base p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Tracking Numbers</Heading>
      </div>

      {fulfillments.map((f) => {
        const isShipped = !!f.shipped_at
        const currentTn = inputs[f.id] ?? ""
        const originalTn =
          f.labels?.[0]?.tracking_number ||
          (f.metadata?.tracking_number as string) ||
          savedTracking[f.id] ||
          ""
        const trackingUrl = originalTn
          ? `${TRACKING_BASE_URL}${originalTn}`
          : null
        const isEditing = !!editing[f.id]

        return (
          <div key={f.id} className="px-6 py-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-ui-fg-subtle text-sm font-mono">
                {f.id.slice(0, 24)}…
              </span>
              <Badge color={isShipped ? "green" : "orange"} size="xsmall">
                {isShipped ? "Shipped" : "Preparing"}
              </Badge>
            </div>

            {isEditing ? (
              <div className="flex gap-2 items-center">
                <Input
                  autoFocus
                  value={currentTn}
                  onChange={(e) =>
                    setInputs((prev) => ({ ...prev, [f.id]: e.target.value }))
                  }
                  placeholder="e.g. CR010198293255"
                  className="flex-1 font-mono text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave(f.id)
                    if (e.key === "Escape") handleCancel(f.id, originalTn)
                  }}
                />
                <Button
                  size="small"
                  variant="primary"
                  onClick={() => handleSave(f.id)}
                  isLoading={saving[f.id]}
                  disabled={!currentTn.trim()}
                >
                  <CheckMini />
                </Button>
                {originalTn && (
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => handleCancel(f.id, originalTn)}
                  >
                    <XMark />
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {trackingUrl ? (
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ui-fg-interactive text-sm font-mono hover:underline flex-1"
                  >
                    {originalTn}
                  </a>
                ) : (
                  <span className="text-ui-fg-muted text-sm flex-1">—</span>
                )}
                <button
                  onClick={() => setEditing((s) => ({ ...s, [f.id]: true }))}
                  className="text-ui-fg-subtle hover:text-ui-fg-base transition-colors"
                  title="Edit tracking number"
                >
                  <PencilSquare />
                </button>
              </div>
            )}
          </div>
        )
      })}
    </Container>
  )
}

export default FulfillmentTrackingWidget

export const config = defineWidgetConfig({
  zone: "order.details.after",
})
