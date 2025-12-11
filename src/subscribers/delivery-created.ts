import { SubscriberArgs, type SubscriberConfig } from "@medusajs/medusa";
import { Modules, ContainerRegistrationKeys } from "@medusajs/utils";
import { INotificationModuleService } from "@medusajs/types";

type DeliveryCreatedEvent = {
  id: string; // fulfillment id
};

export default async function deliveryCreatedHandler({
  event,
  container,
}: SubscriberArgs<DeliveryCreatedEvent>) {
  console.log(
    `⚡ Event 'delivery.created' triggered with data:`,
    JSON.stringify(event.data, null, 2)
  );

  const notificationService: INotificationModuleService = container.resolve(
    Modules.NOTIFICATION
  );

  const remoteQuery = container.resolve(ContainerRegistrationKeys.REMOTE_QUERY);

  const { id: fulfillmentId } = event.data;

  // Load fulfillment and its order
  const fulfillmentResult = await remoteQuery({
    entryPoint: "fulfillment",
    fields: [
      "id",
      "order.id",
      "order.display_id",
      "order.email",
      "order.total",
      "order.currency_code",
      "order.shipping_address.*",
    ],
    variables: {
      id: fulfillmentId,
    },
  });

  const fulfillment = Array.isArray(fulfillmentResult)
    ? fulfillmentResult[0]
    : fulfillmentResult;

  const order = fulfillment?.order;

  if (!order) {
    console.warn(
      `⚠️ Order not found for delivery.created (fulfillment_id: ${fulfillmentId})`
    );
    return;
  }

  if (!order.email) {
    console.warn(
      `⚠️ Order #${order.display_id} has no email. Skipping delivery notification.`
    );
    return;
  }

  console.log(
    `📧 Sending 'Order Delivered' email to ${order.email} for Order #${order.display_id}`
  );

  try {
    const result = await notificationService.createNotifications({
      to: order.email,
      channel: "email",
      template: "order-delivered",
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
      `❌ Failed to send 'Order Delivered' email for Order #${order.display_id}:`,
      error
    );
    throw error;
  }
}

export const config: SubscriberConfig = {
  event: "delivery.created",
};


