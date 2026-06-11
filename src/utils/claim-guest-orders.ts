import { MedusaContainer } from "@medusajs/framework"
import {
  ChangeActionType,
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { ICustomerModuleService } from "@medusajs/types"
import {
  requestOrderTransferWorkflow,
  acceptOrderTransferWorkflow,
  cancelOrderTransferRequestWorkflow,
} from "@medusajs/core-flows"

// Marker on the order_change so the transfer-requested email subscriber knows
// this transfer was already auto-accepted in the same request — no email needed.
export const AUTO_TRANSFER_NOTE = "auto_claim_email_verified"

type TransferChange = { id: string; created_at: string; actions?: any[] }

async function findRequestedTransfer(
  query: any,
  orderId: string
): Promise<{ change: TransferChange; token?: string } | null> {
  const { data: changes } = await query.graph({
    entity: "order_change",
    filters: { order_id: orderId, status: ["requested"], change_type: "transfer" },
    fields: ["id", "created_at", "actions.action", "actions.details"],
  })
  if (!changes.length) return null
  const change = (changes as TransferChange[]).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0]
  const token = change.actions?.find(
    (a: any) => a.action === ChangeActionType.TRANSFER_CUSTOMER
  )?.details?.token
  return { change, token }
}

/**
 * Transfer every non-cancelled guest order for `email` to the registered
 * customer `customerId`. Email ownership MUST already be proven (verified
 * magic-link token) before calling this.
 *
 * Idempotent and self-healing: runs on every activation AND login, so an
 * order that failed to transfer once is retried next time. A stale
 * "requested" transfer left by a previous failed run is accepted if its
 * token is still valid, otherwise cancelled and re-requested.
 */
export async function claimGuestOrders(
  container: MedusaContainer,
  email: string,
  customerId: string
): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const customerModuleSvc = container.resolve(Modules.CUSTOMER) as ICustomerModuleService
  const logger = container.resolve("logger") as any

  // Multiple guest records can exist (one per checkout). Each is independent.
  const guestCustomers = await customerModuleSvc.listCustomers({
    email,
    has_account: false,
  })

  for (const guestCustomer of guestCustomers) {
    const { data: guestOrders } = await query.graph({
      entity: "order",
      filters: { customer_id: guestCustomer.id },
      fields: ["id", "display_id", "status"],
    })

    for (const order of guestOrders as any[]) {
      if (order.status === "cancelled") continue
      try {
        // A stale requested transfer (from a previous failed run) blocks a new
        // request — try to finish it, otherwise cancel and start fresh.
        const stale = await findRequestedTransfer(query, order.id)
        if (stale) {
          if (stale.token) {
            try {
              await acceptOrderTransferWorkflow(container).run({
                input: { order_id: order.id, token: stale.token },
              })
              logger.info(`[claim-guest-orders] Accepted stale transfer for order ${order.id}`)
              continue
            } catch (_) {
              // token no longer valid — fall through to cancel + re-request
            }
          }
          await cancelOrderTransferRequestWorkflow(container).run({
            input: {
              order_id: order.id,
              logged_in_user_id: customerId,
              actor_type: "customer",
            },
          })
        }

        await requestOrderTransferWorkflow(container).run({
          input: {
            order_id: order.id,
            customer_id: customerId,
            logged_in_user: customerId,
            internal_note: AUTO_TRANSFER_NOTE,
          },
        })

        const fresh = await findRequestedTransfer(query, order.id)
        if (!fresh?.token) {
          logger.warn(
            `[claim-guest-orders] No transfer token found for order ${order.id} (change: ${fresh?.change?.id})`
          )
          continue
        }

        await acceptOrderTransferWorkflow(container).run({
          input: { order_id: order.id, token: fresh.token },
        })
        logger.info(
          `[claim-guest-orders] Order #${order.display_id} (${order.id}) claimed by customer ${customerId}`
        )
      } catch (err: any) {
        logger.warn(
          `[claim-guest-orders] Failed to claim order ${order.id}: ${err?.message}`
        )
      }
    }
  }
}
