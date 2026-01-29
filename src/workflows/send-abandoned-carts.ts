import {
  createWorkflow,
  WorkflowResponse,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { 
  sendAbandonedNotificationsStep,
} from "./steps/send-abandoned-notifications"
import { updateCartsStep } from "@medusajs/medusa/core-flows"
import { CartDTO, CustomerDTO } from "@medusajs/types"

export type SendAbandonedCartsWorkflowInput = {
  carts: (CartDTO & {
    customer: CustomerDTO
  })[]
}

export const sendAbandonedCartsWorkflow = createWorkflow(
  "send-abandoned-carts",
  function (input: SendAbandonedCartsWorkflowInput) {
    sendAbandonedNotificationsStep(input)

    const updateCartsData = transform(
      input,
      (data) => {
        return data.carts.map((cart) => ({
          id: cart.id,
          metadata: {
            ...cart.metadata,
            abandoned_notification: new Date().toISOString(),
          },
        }))
      }
    )

    const updatedCarts = updateCartsStep(updateCartsData)

    return new WorkflowResponse(updatedCarts)
  }
)

