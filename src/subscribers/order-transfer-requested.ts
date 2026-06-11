import { SubscriberArgs, type SubscriberConfig } from "@medusajs/medusa";
import { Modules, ContainerRegistrationKeys } from "@medusajs/utils";
import { INotificationModuleService } from "@medusajs/types";
import { AUTO_TRANSFER_NOTE } from "../utils/claim-guest-orders";

type TransferRequestedEvent = {
  id: string;
  order_change_id: string;
};

type OrderTransferAction = {
  details?: {
    token?: string;
    original_email?: string;
  };
  reference_id?: string;
};

export default async function orderTransferRequestedHandler({
  event,
  container,
}: SubscriberArgs<TransferRequestedEvent>) {
  const notificationService: INotificationModuleService = container.resolve(
    Modules.NOTIFICATION
  );
  const remoteQuery = container.resolve(ContainerRegistrationKeys.REMOTE_QUERY);

  const { id: orderId, order_change_id: orderChangeId } = event.data;

  const orderResult = await remoteQuery({
    entryPoint: "order",
    fields: ["id", "display_id"],
    variables: {
      id: orderId,
    },
  });

  const order = Array.isArray(orderResult) ? orderResult[0] : orderResult;

  if (!order) {
    console.warn(
      `⚠️ Order not found for order.transfer_requested (order_id: ${orderId})`
    );
    return;
  }

  const orderChangeResult = await remoteQuery({
    entryPoint: "order_change",
    fields: [
      "id",
      "internal_note",
      "actions.id",
      "actions.action",
      "actions.reference_id",
      "actions.details",
    ],
    variables: {
      id: orderChangeId,
    },
  });

  const orderChange = Array.isArray(orderChangeResult)
    ? orderChangeResult[0]
    : orderChangeResult;

  // Auto-claim transfers (email already verified) are accepted synchronously in
  // the same request — a confirmation email would arrive already dead. Skip.
  if (orderChange?.internal_note === AUTO_TRANSFER_NOTE) {
    console.log(
      `ℹ️ Skipping transfer notification for order ${orderId} — auto-claim transfer (${AUTO_TRANSFER_NOTE})`
    );
    return;
  }

  const transferCustomerAction = orderChange?.actions?.find(
    (action: { action?: string }) => action.action === "TRANSFER_CUSTOMER"
  ) as OrderTransferAction | undefined;
  const token = transferCustomerAction?.details?.token;
  const customerId = transferCustomerAction?.reference_id;

  if (!token || !customerId) {
    console.warn(
      `⚠️ Transfer action not found for order change ${orderChangeId}. Skipping notification.`
    );
    return;
  }

  const customerResult = await remoteQuery({
    entryPoint: "customer",
    fields: ["id", "email", "first_name"],
    variables: {
      id: customerId,
    },
  });

  const customer = Array.isArray(customerResult)
    ? customerResult[0]
    : customerResult;

  if (!customer?.email) {
    console.warn(
      `⚠️ Customer ${customerId} has no email. Skipping transfer notification.`
    );
    return;
  }

  const storeUrl = process.env.STORE_URL?.replace(/\/+$/, "") || "";
  const acceptUrl = storeUrl
    ? `${storeUrl}/account/orders/transfer/accept?order_id=${encodeURIComponent(order.id)}&token=${encodeURIComponent(token)}`
    : `/?order_id=${encodeURIComponent(order.id)}&token=${encodeURIComponent(token)}`;

  await notificationService.createNotifications({
    to: customer.email,
    channel: "email",
    template: "order-transfer-requested",
    data: {
      order,
      token,
      accept_url: acceptUrl,
      customer,
    },
  });
}

export const config: SubscriberConfig = {
  event: "order.transfer_requested",
};
