import { SubscriberArgs, type SubscriberConfig } from "@medusajs/medusa";
import { Modules, ContainerRegistrationKeys } from "@medusajs/utils";
import { INotificationModuleService } from "@medusajs/types";
import { MAGIC_TOKEN_MODULE } from "../modules/magic-token";
import { TRACKING_BASE_URL, buildTrackingUrl } from "../utils/tracking";

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
      "metadata",
      "location_id",
      "shipping_option.*",
      "items.line_item_id",
      "items.title",
      "items.quantity",
      "labels.tracking_number",
      "labels.tracking_url",
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

  // Resolve stock location name
  let locationName = "Warehouse";
  if (fulfillment?.location_id) {
    const locResult = await remoteQuery({
      entryPoint: "stock_location",
      fields: ["id", "name"],
      variables: { id: fulfillment.location_id },
    }).catch(() => null);
    const loc = Array.isArray(locResult) ? locResult[0] : locResult;
    if (loc?.name) locationName = loc.name;
  }

  // Fetch ALL fulfillments for this order (with shipped_at to detect unshipped ones)
  const allFulfillmentsResult = await remoteQuery({
    entryPoint: "fulfillment",
    fields: ["id", "shipped_at", "items.line_item_id"],
    variables: { order_id: order?.id },
  }).catch(() => []);
  const allFulfillments = Array.isArray(allFulfillmentsResult)
    ? allFulfillmentsResult
    : [allFulfillmentsResult];

  const orderItems = order?.items ?? [];

  // Remaining = items in OTHER fulfillments not yet shipped
  // (covers the two-warehouse scenario where all items are already fulfilled)
  const unshippedOtherFulfillments = allFulfillments.filter(
    (f: any) => f.id !== fulfillmentId && !f.shipped_at
  );
  const unshippedItemIds = new Set<string>(
    unshippedOtherFulfillments.flatMap((f: any) =>
      (f?.items ?? []).map((i: any) => i.line_item_id).filter(Boolean)
    )
  );

  // Also catch items not yet assigned to any fulfillment at all
  const allFulfilledItemIds = new Set<string>(
    allFulfillments.flatMap((f: any) =>
      (f?.items ?? []).map((i: any) => i.line_item_id).filter(Boolean)
    )
  );

  const remaining_items = orderItems.filter(
    (i: any) => unshippedItemIds.has(i.id) || !allFulfilledItemIds.has(i.id)
  );
  const is_partial = remaining_items.length > 0;

  // Items in THIS fulfillment only
  const fulfilledItemIds = new Set(
    (fulfillment?.items ?? []).map((i: any) => i.line_item_id)
  );

  // Build fulfilled items with product titles
  const orderItemMap: Record<string, any> = {};
  for (const item of orderItems) { orderItemMap[item.id] = item; }

  const fulfillment_items = (fulfillment?.items ?? []).map((fi: any) => {
    const oi = fi.line_item_id ? orderItemMap[fi.line_item_id] : null;
    return {
      title: oi?.product_title || fi.title,
      variant: oi?.variant_title,
      quantity: Number(fi.quantity),
      thumbnail: oi?.thumbnail,
    };
  });

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

  // Build tracking links from labels first, fallback to metadata.tracking_number
  const labels = fulfillment?.labels || [];
  let tracking_links = labels
    .filter((l: any) => l.tracking_number)
    .map((label: any) => ({
      tracking_number: label.tracking_number,
      url: buildTrackingUrl(label.tracking_number, label.tracking_url),
    }));

  if (tracking_links.length === 0 && fulfillment?.metadata?.tracking_number) {
    const tn = String(fulfillment.metadata.tracking_number);
    tracking_links = [{ tracking_number: tn, url: `${TRACKING_BASE_URL}${tn}` }];
  }

  // Token must be generated here — raw value only exists at generateToken return
  const magicTokenSvc = container.resolve(MAGIC_TOKEN_MODULE) as any;
  const orderViewToken: string = await magicTokenSvc.generateToken({
    email: order.email,
    type: "order_view",
    orderId: order.id,
  });

  // registered account → templates hide the "Activate account" block
  const customerSvc = container.resolve(Modules.CUSTOMER) as any;
  const hasRegisteredAccount =
    (await customerSvc.listCustomers({ email: order.email, has_account: true }))
      .length > 0;

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
        orderViewToken,
        hasRegisteredAccount,
        tracking_links,
        fulfillment_items,
        location_name: locationName,
        is_partial,
        remaining_items,
        subject_override: is_partial
          ? `Partial Shipment — Order #ONX-${order.display_id}`
          : undefined,
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


