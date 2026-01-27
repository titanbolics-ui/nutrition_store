import { 
  createStep,
  StepResponse, 
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { CartDTO, CustomerDTO } from "@medusajs/types"

type SendAbandonedNotificationsStepInput = {
  carts: (CartDTO & {
    customer: CustomerDTO
  })[]
}

export const sendAbandonedNotificationsStep = createStep(
  "send-abandoned-notifications",
  async (input: SendAbandonedNotificationsStepInput, { container }) => {
    const notificationModuleService = container.resolve(
      Modules.NOTIFICATION
    )

    const notificationData = input.carts.map((cart) => ({
      to: cart.email!,
      channel: "email", 
      template: "abandoned-cart",
      data: {
        cart,
        storefront_url: process.env.STORE_URL || "https://onyxgenetics.com",
      },
    }))

    const notifications = await notificationModuleService.createNotifications(
      notificationData
    )

    return new StepResponse({
      notifications,
    })
  }
)

