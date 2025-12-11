import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handlePasswordReset({
  event,
  container,
}: SubscriberArgs<{ id: string; email: string; token: string }>) {
  const { email, token } = event.data;

  // Формуємо посилання на ваш Фронтенд
  // Переконайтеся, що на фронті існує сторінка /account/reset-password
  const resetLink = `${process.env.STORE_URL}/account/reset-password?token=${token}&email=${email}`;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Acme <onboarding@resend.dev>",
      to: [email],
      subject: "Reset your password - Onyx Genetics",
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h2>Password Reset Request</h2>
          <p>Someone requested a password reset for your account.</p>
          <p>Click the link below to set a new password:</p>
          <br/>
          <a href="${resetLink}" style="background-color: #d90429; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
          <br/><br/>
          <p style="font-size: 12px; color: #666;">If you didn't request this, just ignore this email.</p>
        </div>
      `,
    });

    if (error) console.error("Resend Error:", error);
  } catch (err) {
    console.error("Email sending failed:", err);
  }
}

// Medusa стандартно використовує цю подію для скидання паролю
export const config: SubscriberConfig = {
  event: "customer.password_reset",
};
