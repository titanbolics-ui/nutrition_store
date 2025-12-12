import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { sendOrderConfirmationWorkflow } from "../workflows/send-order-confirmation";
import { getBtcRateInUsd } from "../lib/crypto-oracle";
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils";

const BTC_WALLET_ADDRESS =
  process.env.BTC_WALLET_ADDRESS ||
  "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderService = container.resolve(Modules.ORDER);
  const remoteQuery = container.resolve(ContainerRegistrationKeys.REMOTE_QUERY);

  // Use remoteQuery to get order with all calculated fields including total
  const orderResult = await remoteQuery({
    entryPoint: "order",
    fields: [
      "id",
      "total",
      "subtotal",
      "item_total",
      "tax_total",
      "shipping_total",
      "discount_total",
      "metadata",
    ],
    variables: {
      id: data.id,
    },
  });

  const order = Array.isArray(orderResult) ? orderResult[0] : orderResult;

  try {
    const btcRate = await getBtcRateInUsd();
    const totalCentsRaw =
      order.total ?? order.subtotal ?? order.item_total ?? 0;
    const totalCents = Number(totalCentsRaw);

    if (Number.isNaN(totalCents)) {
      throw new Error(
        `Cannot compute BTC amount: total is NaN (raw=${JSON.stringify(
          totalCentsRaw
        )})`
      );
    }

    const btcAmount = Number((totalCents / btcRate).toFixed(8));

    console.log(
      `⚡ Updating Order ${order.id}: ${btcAmount} BTC (Rate: ${btcRate})`
    );

    await orderService.updateOrders([
      {
        id: order.id,
        metadata: {
          ...order.metadata,
          payment_currency: "BTC",
          exchange_rate: btcRate,
          amount_btc: btcAmount,
          wallet_address: BTC_WALLET_ADDRESS,
        },
      },
    ]);
  } catch (e) {
    console.error("⚠️ Crypto Oracle Failed:", e);
  }

  await sendOrderConfirmationWorkflow(container).run({
    input: {
      id: data.id,
    },
  });
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
