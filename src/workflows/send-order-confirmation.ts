import {
  createWorkflow,
  when,
  WorkflowResponse,
  transform, // <--- 1. ДОДАЛИ ЦЕЙ ІМПОРТ
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { sendNotificationStep } from "./steps/send-notification";

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
        "items.*",
        "shipping_address.*",
        "billing_address.*",
        "shipping_methods.*",
        "customer.*",
        "total",
        "subtotal",
        "discount_total",
        "shipping_total",
        "tax_total",
        "item_subtotal",
        "item_total",
        "item_tax_total",
        "payment_collections.payment_sessions.provider_id",
        "payment_collections.payment_sessions.status",
      ],
      filters: {
        id,
      },
      options: {
        throwIfKeyNotFound: true,
      },
    });

    const notification = when(
      { orders },
      (data) => !!data.orders[0].email
    ).then(() => {
      // 👇 2. ВИКОРИСТОВУЄМО TRANSFORM (Тут дані стають реальними)
      const notificationInput = transform({ orders }, (data) => {
        // 👇 ХАК ТУТ: Примусово кажемо TS, що це просто масив any.
        // Це миттєво прибирає помилку "Excessive stack depth"
        const allOrders = data.orders as any[];
        const order = allOrders[0];

        const sessions = order.payment_collections?.[0]?.payment_sessions || [];

        // Тепер .find працює без проблем
        let activeSession = sessions.find(
          (s: any) => s.status === "authorized"
        );

        if (!activeSession) {
          activeSession = sessions.find((s: any) => s.status === "pending");
        }

        if (!activeSession && sessions.length > 0) {
          activeSession = sessions[sessions.length - 1];
        }

        const providerId = activeSession?.provider_id || "unknown";

        return {
          to: order.email!,
          channel: "email",
          template: "order-placed",
          data: {
            order: order,
            paymentProviderID: providerId,
          },
        };
      });

      // Передаємо результат трансформації у крок відправки
      return sendNotificationStep([notificationInput]);
    });

    return new WorkflowResponse({
      notification,
    });
  }
);
