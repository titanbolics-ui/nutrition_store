import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { MAGIC_TOKEN_MODULE } from "../../modules/magic-token"

export type OrderEmailContext = {
  token: string
  // registered account exists for this email → templates hide "Activate account"
  hasRegisteredAccount: boolean
}

export const generateOrderViewTokenStep = createStep(
  "generate-order-view-token",
  async (input: { orderId: string; email: string }, { container }) => {
    const magicTokenSvc = container.resolve(MAGIC_TOKEN_MODULE) as any
    const customerSvc = container.resolve(Modules.CUSTOMER) as any

    const token: string = await magicTokenSvc.generateToken({
      email: input.email,
      type: "order_view",
      orderId: input.orderId,
    })

    const registered = await customerSvc.listCustomers({
      email: input.email,
      has_account: true,
    })

    return new StepResponse({
      token,
      hasRegisteredAccount: registered.length > 0,
    } satisfies OrderEmailContext)
  }
)
