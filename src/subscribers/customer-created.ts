import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";
import { Resend } from "resend";

// Ініціалізація Resend
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handleCustomerCreated({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  // Отримуємо сервіс клієнтів, щоб дізнатися деталі (email, ім'я)
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

  // Відправляємо лист
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Acme <onboarding@resend.dev>",
      to: [customer.email],
      subject: "Welcome to Onyx Genetics! 💪",
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h1>Welcome to the Club!</h1>
          <p>Hi ${customer.first_name || "Athlete"},</p>
          <p>Thank you for registering at <strong>Onyx Genetics</strong>.</p>
          <p>We are glad to have you with us. Check out our latest products for your cycle.</p>
          <br/>
          <a href="${process.env.STORE_URL}/store" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Store</a>
        </div>
      `,
    });

    if (error) {
      console.error("Resend Error:", error);
    } else {
      console.log("Welcome Email Sent:", data);
    }
  } catch (err) {
    console.error("Email sending failed:", err);
  }
}

// Конфігурація: слухаємо подію створення клієнта
export const config: SubscriberConfig = {
  event: "customer.created",
};
