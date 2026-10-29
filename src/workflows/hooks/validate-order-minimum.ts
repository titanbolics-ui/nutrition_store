import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { MedusaError } from "@medusajs/framework/utils"
import { evaluateOrderMinimum } from "../../utils/repeat-customer"

// Hard gate for the repeat-customer order minimum. The storefront notice is
// only UX — this hook is what stops a direct /complete call below the minimum.
completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  const { applies, minimum, remaining } = await evaluateOrderMinimum(
    container,
    cart.id
  )

  if (applies && remaining > 0) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Minimum order for returning customers is $${minimum}. Add $${remaining.toFixed(2)} more to place your order.`
    )
  }
})
