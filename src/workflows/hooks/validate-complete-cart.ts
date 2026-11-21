import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { MedusaError } from "@medusajs/framework/utils"
import { evaluateOrderMinimum } from "../../utils/repeat-customer"
import { checkSurchargeConsistency } from "../../utils/payment-surcharge"

// completeCartWorkflow's validate hook can only be consumed once, so every
// checkout gate lives here. The storefront shows the same rules as UX; these
// checks are what stop a direct /complete call.
completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  // Repeat-customer order minimum.
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

  // PayPal surcharge must match the active payment session.
  const surchargeError = await checkSurchargeConsistency(container, cart.id)
  if (surchargeError) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, surchargeError)
  }
})
