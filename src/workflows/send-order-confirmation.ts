import {
  createWorkflow,
  when,
  WorkflowResponse,
  transform,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { sendNotificationStep } from "./steps/send-notification";
import { generateOrderViewTokenStep } from "./steps/generate-order-view-token-step";

type WorkflowInput = {
  id: string;
};

export const sendOrderConfirmationWorkflow = createWorkflow(
  "send-order-confirmation",
  ({ id }: WorkflowInput) => {
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "total",
        "metadata",
        "items.*",
        "shipping_address.*",
        "billing_address.*",
        "shipping_methods.*",
        "customer.*",
        "subtotal",
        "discount_total",
        "shipping_total",
        "tax_total",
        "item_subtotal",
        "item_total",
        "item_tax_total",
        "credit_line_total",
        "credit_lines.*",
        "gift_card_total",
        "summary",
        "payment_collections.payment_sessions.provider_id",
        "payment_collections.payment_sessions.status",
      ],
      filters: { id },
      options: { throwIfKeyNotFound: true },
    });

    const notification = when(
      { orders },
      (data) => !!data.orders[0].email
    ).then(() => {
      // Extract order id + email for token generation
      const tokenInput = transform({ orders }, (data) => {
        const order = (data.orders as any[])[0]
        return { orderId: order.id as string, email: order.email as string }
      })

      // Generate order_view token in a dedicated step (same execution flow as the email)
      const emailContext = generateOrderViewTokenStep(tokenInput)

      // Build notification payload with the fresh token
      const notificationInput = transform({ orders, emailContext }, (data) => {
        const allOrders = data.orders as any[];
        const order = allOrders[0];

        const sessions = order.payment_collections?.[0]?.payment_sessions || [];
        let activeSession = sessions.find((s: any) => s.status === "authorized");
        if (!activeSession) activeSession = sessions.find((s: any) => s.status === "pending");
        if (!activeSession && sessions.length > 0) activeSession = sessions[sessions.length - 1];
        const providerId = activeSession?.provider_id || "unknown";

        // summary.current_order_total is the backend truth (accounts for
        // credit lines) — never recompute totals manually
        const currentTotal = Number(order.summary?.current_order_total)
        if (!Number.isNaN(currentTotal) && currentTotal > 0) {
          order.total = currentTotal
        }

        return {
          to: order.email!,
          channel: "email",
          template: "order-placed",
          data: {
            order: order,
            paymentProviderID: providerId,
            orderViewToken: (data.emailContext as any).token,
            hasRegisteredAccount: (data.emailContext as any).hasRegisteredAccount,
          },
        };
      });

      return sendNotificationStep([notificationInput]);
    });

    return new WorkflowResponse({ notification });
  }
);
