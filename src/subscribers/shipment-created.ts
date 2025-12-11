import { SubscriberArgs, type SubscriberConfig } from "@medusajs/medusa";
import { Modules, ContainerRegistrationKeys } from "@medusajs/utils";
import { INotificationModuleService } from "@medusajs/types";

type ShipmentCreatedEvent = {
  id: string; // fulfillment id
  no_notification?: boolean;
};

export default async function shipmentCreatedHandler({
  event,
  container,
}: SubscriberArgs<ShipmentCreatedEvent>) {
  console.log(
    `⚡ Event 'shipment.created' triggered with data:`,
    JSON.stringify(event.data, null, 2)
  );

  const { id: fulfillmentId, no_notification } = event.data;

  if (no_notification) {
    console.log(
      `⚠️ Skipping shipment notification (no_notification=true) for fulfillment_id: ${fulfillmentId}`
    );
    return;
  }

  const notificationService: INotificationModuleService = container.resolve(
    Modules.NOTIFICATION
  );

  const remoteQuery = container.resolve(ContainerRegistrationKeys.REMOTE_QUERY);

  // 1. Load fulfillment to get order + tracking info
  const fulfillmentResult = await remoteQuery({
    entryPoint: "fulfillment",
    fields: [
      "id",
      "shipping_option.*",
      "order.id",
      "order.display_id",
      "order.email",
      "order.total",
      "order.currency_code",
      "order.shipping_address.*",
      "labels.tracking_number",
      "labels.tracking_url",
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
      `⚠️ Order not found for shipment.created (fulfillment_id: ${fulfillmentId})`
    );
    return;
  }

  if (!order.email) {
    console.warn(
      `⚠️ Order #${order.display_id} has no email. Skipping shipment notification.`
    );
    return;
  }

  // Convert labels to tracking_links format for email template
  const labels = fulfillment?.labels || [];
  const tracking_links = labels.map((label: any) => ({
    tracking_number: label.tracking_number,
    url: label.tracking_url,
  }));

  console.log(
    `📧 Sending 'Order Shipped' email to ${order.email} for Order #${order.display_id} with ${tracking_links.length} tracking link(s)`
  );

  try {
    const result = await notificationService.createNotifications({
      to: order.email,
      channel: "email",
      template: "order-shipped",
      data: {
        order,
        tracking_links,
      },
    });

    console.log(
      `✅ Notification created successfully for Order #${order.display_id}:`,
      JSON.stringify(result, null, 2)
    );
  } catch (error) {
    console.error(
      `❌ Failed to send 'Order Shipped' email for Order #${order.display_id}:`,
      error
    );
    throw error;
  }
}

export const config: SubscriberConfig = {
  event: "shipment.created",
};


