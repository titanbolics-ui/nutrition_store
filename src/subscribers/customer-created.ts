import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/utils";
import { INotificationModuleService } from "@medusajs/types";

export default async function handleCustomerCreated({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const notificationService: INotificationModuleService = container.resolve(
    Modules.NOTIFICATION
  );
  const remoteQuery = container.resolve(ContainerRegistrationKeys.REMOTE_QUERY);

  const customerResult = await remoteQuery({
    entryPoint: "customer",
    fields: ["id", "email", "first_name", "last_name"],
    variables: {
      id: event.data.id,
    },
  });

  const customer = Array.isArray(customerResult)
    ? customerResult[0]
    : customerResult;

  if (!customer) {
    console.warn(`⚠️ Customer not found for ID: ${event.data.id}`);
    return;
  }

  if (!customer.email) return;

  const storeUrl = process.env.STORE_URL?.replace(/\/+$/, "") || "";
  const storefrontUrl = storeUrl ? `${storeUrl}/store` : "http://localhost:8000";

  try {
    const data = await notificationService.createNotifications({
      to: customer.email,
      channel: "email",
      template: "customer-welcome",
      data: {
        customer,
        store_url: storefrontUrl,
      },
    });

    console.log("Welcome Email Sent:", data);
  } catch (err) {
    console.error("Email sending failed:", err);
  }
}

export const config: SubscriberConfig = {
  event: "customer.created",
};
