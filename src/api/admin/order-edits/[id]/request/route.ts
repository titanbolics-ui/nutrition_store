import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, OrderChangeStatus } from "@medusajs/framework/utils"
import { requestOrderEditRequestWorkflow } from "@medusajs/core-flows"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const { no_notification } = req.body as { no_notification?: boolean }

  if (no_notification !== undefined) {
    const orderSvc = req.scope.resolve(Modules.ORDER) as any
    const changes = await orderSvc.listOrderChanges(
      { order_id: id, status: [OrderChangeStatus.PENDING, OrderChangeStatus.REQUESTED] },
      { select: ["id", "metadata"] }
    )
    if (changes.length > 0) {
      const oc = changes[0]
      await orderSvc.updateOrderChanges([{
        id: oc.id,
        metadata: { ...(oc.metadata ?? {}), no_notification },
      }])
    }
  }

  const { result } = await requestOrderEditRequestWorkflow(req.scope).run({
    input: {
      order_id: id,
      requested_by: (req as any).auth_context?.actor_id,
    },
  })

  res.json({ order_preview: result })
}
