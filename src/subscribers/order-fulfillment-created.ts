import { SubscriberArgs, type SubscriberConfig } from "@medusajs/medusa";
import { Modules, ContainerRegistrationKeys } from "@medusajs/utils";
import { INotificationModuleService } from "@medusajs/types";
import { MAGIC_TOKEN_MODULE } from "../modules/magic-token";

type FulfillmentCreatedEvent = {
  order_id: string;
  fulfillment_id: string;
  no_notification?: boolean;
};

export default async function orderFulfillmentCreatedHandler({
  event,
  container,
}: SubscriberArgs<FulfillmentCreatedEvent>) {
  const { order_id, fulfillment_id, no_notification } = event.data;

  if (no_notification) return;

  const notificationService: INotificationModuleService = container.resolve(
    Modules.NOTIFICATION
  );
  const remoteQuery = container.resolve(ContainerRegistrationKeys.REMOTE_QUERY);

  // 1. Fetch order with all items
  const orderResult = await remoteQuery({
    entryPoint: "order",
    fields: [
      "id", "display_id", "email", "total", "currency_code",
      "fulfillment_status", "shipping_address.*",
      "items.id", "items.product_title", "items.variant_title",
      "items.quantity", "items.thumbnail",
    ],
    variables: { id: order_id },
  });
  const order = Array.isArray(orderResult) ? orderResult[0] : orderResult;
  if (!order?.email) return;

  // 2. Fetch this specific fulfillment with items + location
  const fulfillmentResult = await remoteQuery({
    entryPoint: "fulfillment",
    fields: [
      "id", "location_id",
      "items.line_item_id", "items.title", "items.quantity",
    ],
    variables: { id: fulfillment_id },
  });
  const fulfillment = Array.isArray(fulfillmentResult)
    ? fulfillmentResult[0]
    : fulfillmentResult;

  // 3. Resolve stock location name
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

  // 4. Fetch ALL fulfillments for this order to determine truly remaining items
  const allFulfillmentsResult = await remoteQuery({
    entryPoint: "fulfillment",
    fields: ["id", "items.line_item_id"],
    variables: { order_id: order.id },
  }).catch(() => []);
  const allFulfillments = Array.isArray(allFulfillmentsResult)
    ? allFulfillmentsResult
    : [allFulfillmentsResult];

  const allFulfilledIds = new Set<string>(
    allFulfillments.flatMap((f: any) =>
      (f?.items ?? []).map((i: any) => i.line_item_id).filter(Boolean)
    )
  );

  const remainingItems = (order.items ?? []).filter(
    (item: any) => !allFulfilledIds.has(item.id)
  );
  const isPartial = remainingItems.length > 0;

  // Generate order_view token in the same flow so the email has a working link
  const magicTokenSvc = container.resolve(MAGIC_TOKEN_MODULE) as any;
  let orderViewToken: string | undefined;
  try {
    orderViewToken = await magicTokenSvc.generateToken({
      email: order.email,
      type: "order_view",
      orderId: order_id,
    });
  } catch {
    // Missing token degrades gracefully — template will throw (by design, not silently)
  }

  // registered account → templates hide the "Activate account" block
  const customerSvc = container.resolve(Modules.CUSTOMER) as any;
  const hasRegisteredAccount =
    (await customerSvc.listCustomers({ email: order.email, has_account: true }))
      .length > 0;

  console.log(
    `📧 Sending 'Order Fulfilled' email to ${order.email} for Order #${order.display_id} (partial: ${isPartial})`
  );

  await notificationService.createNotifications({
    to: order.email,
    channel: "email",
    template: "order-fulfilled",
    data: {
      order,
      fulfillment: {
        ...fulfillment,
        location_name: locationName,
      },
      is_partial: isPartial,
      remaining_items: remainingItems,
      orderViewToken,
      hasRegisteredAccount,
    },
  });
}

export const config: SubscriberConfig = {
  event: "order.fulfillment_created",
};
