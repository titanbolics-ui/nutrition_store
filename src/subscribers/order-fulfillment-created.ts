import { SubscriberArgs, type SubscriberConfig } from "@medusajs/medusa";
import { Modules, ContainerRegistrationKeys } from "@medusajs/utils";
import { INotificationModuleService } from "@medusajs/types";

type FulfillmentCreatedEvent = {
  order_id: string;
  fulfillment_id: string;
  no_notification?: boolean;
};

export default async function orderFulfillmentCreatedHandler({
  event,
  container,
}: SubscriberArgs<FulfillmentCreatedEvent>) {
  console.log(
    `⚡ Event 'order.fulfillment_created' triggered with data:`,
    JSON.stringify(event.data, null, 2)
  );

  const { order_id, no_notification } = event.data;

  if (no_notification) {
    console.log(
      `⚠️ Skipping fulfillment notification (no_notification=true) for order_id: ${order_id}`
    );
    return;
  }

  const notificationService: INotificationModuleService = container.resolve(
    Modules.NOTIFICATION
  );

  const remoteQuery = container.resolve(ContainerRegistrationKeys.REMOTE_QUERY);

  const orderResult = await remoteQuery({
    entryPoint: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "total",
      "currency_code",
      "shipping_address.*",
    ],
    variables: {
      id: order_id,
    },
  });

  const order = Array.isArray(orderResult) ? orderResult[0] : orderResult;

  if (!order) {
    console.warn(
      `⚠️ Order not found for order.fulfillment_created (order_id: ${order_id})`
    );
    return;
  }

  if (!order.email) {
    console.warn(
      `⚠️ Order #${order.display_id} has no email. Skipping fulfillment notification.`
    );
    return;
  }

  console.log(
    `📧 Sending 'Order Fulfilled' email to ${order.email} for Order #${order.display_id}`
  );

  try {
    const result = await notificationService.createNotifications({
      to: order.email,
      channel: "email",
      template: "order-fulfilled",
      data: {
        order,
      },
    });

    console.log(
      `✅ Notification created successfully for Order #${order.display_id}:`,
      JSON.stringify(result, null, 2)
    );
  } catch (error) {
    console.error(
      `❌ Failed to send 'Order Fulfilled' email for Order #${order.display_id}:`,
      error
    );
    throw error;
  }
}

export const config: SubscriberConfig = {
  event: "order.fulfillment_created",
};


