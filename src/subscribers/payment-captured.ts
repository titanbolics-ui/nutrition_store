import { SubscriberArgs, type SubscriberConfig } from "@medusajs/medusa";
import { Modules, ContainerRegistrationKeys } from "@medusajs/utils";
import { INotificationModuleService } from "@medusajs/types";

export default async function paymentCapturedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const notificationService: INotificationModuleService = container.resolve(
    Modules.NOTIFICATION
  );

  const remoteQuery = container.resolve(ContainerRegistrationKeys.REMOTE_QUERY);

  const paymentId = event.data.id;
  console.log(
    `⚡ Event 'payment.captured' triggered for Payment ID: ${paymentId}`
  );

  // 1. Get payment to retrieve its payment_collection_id
  const paymentResult = await remoteQuery({
    entryPoint: "payment",
    fields: ["id", "payment_collection_id"],
    variables: {
      id: paymentId,
    },
  });

  const payment = Array.isArray(paymentResult)
    ? paymentResult[0]
    : paymentResult;

  if (!payment) {
    console.warn(`⚠️ Payment not found for ID: ${paymentId}`);
    return;
  }

  if (!payment.payment_collection_id) {
    console.warn(
      `⚠️ Payment ${paymentId} has no payment_collection_id. Skipping notification.`
    );
    return;
  }

  // 2. Resolve the order linked to this payment collection
  const orderPaymentResult = await remoteQuery({
    entryPoint: "order_payment_collection",
    fields: ["order.id"],
    variables: {
      payment_collection_id: payment.payment_collection_id,
    },
  });

  const orderPayment = Array.isArray(orderPaymentResult)
    ? orderPaymentResult[0]
    : orderPaymentResult;

  const orderId = orderPayment?.order?.id;

  if (!orderId) {
    console.warn(
      `⚠️ Order not found for payment collection ${payment.payment_collection_id} (payment: ${paymentId})`
    );
    return;
  }

  // 3. Load the order details used in the email
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
      id: orderId,
    },
  });

  const order = Array.isArray(orderResult) ? orderResult[0] : orderResult;

  if (!order) {
    console.warn(`⚠️ Order not found for Payment ID: ${paymentId}`);
    return;
  }

  if (!order.email) {
    console.warn(
      `⚠️ Order #${order.display_id} has no email. Skipping notification.`
    );
    return;
  }

  console.log(
    `📧 Sending 'Payment Received' email to ${order.email} for Order #${order.display_id}`
  );

  await notificationService.createNotifications({
    to: order.email,
    channel: "email",
    template: "order-paid",
    data: {
      order: order,
    },
  });
}

export const config: SubscriberConfig = {
  event: "payment.captured",
};
