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

  // Load fulfillment with items and full order
  const fulfillmentResult = await remoteQuery({
    entryPoint: "fulfillment",
    fields: [
      "id",
      "delivered_at",
      "location_id",
      "items.line_item_id",
      "items.title",
      "items.quantity",
      "order.id",
      "order.display_id",
      "order.email",
      "order.total",
      "order.currency_code",
      "order.shipping_address.*",
      "order.items.id",
      "order.items.product_title",
      "order.items.variant_title",
      "order.items.quantity",
      "order.items.thumbnail",
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

  // Fetch all fulfillments for this order to check which ones are delivered
  const allFulfillmentsResult = await remoteQuery({
    entryPoint: "fulfillment",
    fields: ["id", "delivered_at", "items.line_item_id"],
    variables: { order_id: order.id },
  }).catch(() => []);
  const allFulfillments: any[] = Array.isArray(allFulfillmentsResult)
    ? allFulfillmentsResult
    : [allFulfillmentsResult];

  // Items in OTHER fulfillments that are NOT yet delivered
  const undeliveredOtherFulfillments = allFulfillments.filter(
    (f: any) => f.id !== fulfillmentId && !f.delivered_at
  );
  const undeliveredItemIds = new Set<string>(
    undeliveredOtherFulfillments.flatMap((f: any) =>
      (f?.items ?? []).map((i: any) => i.line_item_id).filter(Boolean)
    )
  );

  const orderItems = order?.items ?? [];
  const remaining_items = orderItems.filter((i: any) =>
    undeliveredItemIds.has(i.id)
  );
  const is_partial = remaining_items.length > 0;

  // Build delivered_items for this fulfillment
  const orderItemMap: Record<string, any> = {};
  for (const item of orderItems) { orderItemMap[item.id] = item; }

  const delivered_items = (fulfillment?.items ?? []).map((fi: any) => {
    const oi = fi.line_item_id ? orderItemMap[fi.line_item_id] : null;
    return {
      title: oi?.product_title || fi.title,
      variant: oi?.variant_title,
      quantity: Number(fi.quantity),
      thumbnail: oi?.thumbnail,
    };
  });

  console.log(
    `📧 Sending 'Order Delivered' email to ${order.email} for Order #${order.display_id} (is_partial: ${is_partial})`
  );

  try {
    const result = await notificationService.createNotifications({
      to: order.email,
      channel: "email",
      template: "order-delivered",
      data: {
        order,
        delivered_items,
        is_partial,
        remaining_items,
        subject_override: is_partial
          ? `Partial Delivery — Order #ONX-${order.display_id}`
          : undefined,
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
