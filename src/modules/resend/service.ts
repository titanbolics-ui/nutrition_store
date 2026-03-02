import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils";
import {
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/types";
import { Resend, CreateEmailOptions } from "resend";
import { render } from "@react-email/render";
import nodemailer, { Transporter } from "nodemailer";
import { orderPlacedEmail } from "./emails/order-placed";
import { orderPaidEmail } from "./emails/order-paid";
import { orderFulfilledEmail } from "./emails/order-fulfilled";
import { orderShippedEmail } from "./emails/order-shipped";
import { orderDeliveredEmail } from "./emails/order-delivered";
import { passwordResetEmail } from "./emails/password-reset";
import { abandonedCartEmail } from "./emails/abandoned-cart";
import { abandonedCartHelpEmail } from "./emails/abandoned-cart-help";
import { abandonedCartTrustEmail } from "./emails/abandoned-cart-trust";
import { abandonedCartFinalEmail } from "./emails/abandoned-cart-final";
import { orderTransferRequestedEmail } from "./emails/order-transfer-requested";
import { customerWelcomeEmail } from "./emails/customer-welcome";

type ResendOptions = {
  api_key?: string;
  from: string;
  transport?: "resend" | "smtp";
  smtp_host?: string;
  smtp_port?: number;
  smtp_secure?: boolean;
  smtp_user?: string;
  smtp_pass?: string;
  html_templates?: Record<
    string,
    {
      subject?: string;
      content: string;
    }
  >;
};

type InjectedDependencies = {
  logger: Logger;
};

enum Templates {
  ORDER_PLACED = "order-placed",
  ORDER_PAID = "order-paid",
  ORDER_FULFILLED = "order-fulfilled",
  ORDER_SHIPPED = "order-shipped",
  ORDER_DELIVERED = "order-delivered",
  PASSWORD_RESET = "password-reset",
  ABANDONED_CART = "abandoned-cart",
  ABANDONED_CART_HELP = "abandoned-cart-help",
  ABANDONED_CART_TRUST = "abandoned-cart-trust",
  ABANDONED_CART_FINAL = "abandoned-cart-final",
  ORDER_TRANSFER_REQUESTED = "order-transfer-requested",
  CUSTOMER_WELCOME = "customer-welcome",
}

const templates: { [key in Templates]?: (props: unknown) => React.ReactNode } =
  {
    [Templates.ORDER_PLACED]: orderPlacedEmail,
    [Templates.ORDER_PAID]: orderPaidEmail,
    [Templates.ORDER_FULFILLED]: orderFulfilledEmail,
    [Templates.ORDER_SHIPPED]: orderShippedEmail,
    [Templates.ORDER_DELIVERED]: orderDeliveredEmail,
    [Templates.PASSWORD_RESET]: passwordResetEmail,
    [Templates.ABANDONED_CART]: abandonedCartEmail,
    [Templates.ABANDONED_CART_HELP]: abandonedCartHelpEmail,
    [Templates.ABANDONED_CART_TRUST]: abandonedCartTrustEmail,
    [Templates.ABANDONED_CART_FINAL]: abandonedCartFinalEmail,
    [Templates.ORDER_TRANSFER_REQUESTED]: orderTransferRequestedEmail,
    [Templates.CUSTOMER_WELCOME]: customerWelcomeEmail,
  };

class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "notification-resend";
  static validateOptions(options: Record<any, any>) {
    const transport = options.transport || "resend";

    if (transport === "resend" && !options.api_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `api_key` is required in the provider's options."
      );
    }
    if (transport === "smtp" && !options.smtp_host) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `smtp_host` is required when `transport` is `smtp`."
      );
    }
    if (transport === "smtp" && !options.smtp_port) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `smtp_port` is required when `transport` is `smtp`."
      );
    }
    if (!options.from) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `from` is required in the provider's options."
      );
    }
  }

  private resendClient?: Resend;
  private smtpTransporter?: Transporter;
  private options: ResendOptions;
  private logger: Logger;

  constructor({ logger }: InjectedDependencies, options: ResendOptions) {
    super();
    const transport = options.transport || "resend";
    if (transport === "smtp") {
      this.smtpTransporter = nodemailer.createTransport({
        host: options.smtp_host,
        port: options.smtp_port,
        secure: options.smtp_secure || false,
        auth: options.smtp_user
          ? {
              user: options.smtp_user,
              pass: options.smtp_pass,
            }
          : undefined,
      });
    } else {
      this.resendClient = new Resend(options.api_key);
    }
    this.options = options;
    this.logger = logger;
  }

  getTemplate(template: Templates) {
    if (this.options.html_templates?.[template]) {
      return this.options.html_templates[template].content;
    }
    const allowedTemplates = Object.keys(templates);

    if (!allowedTemplates.includes(template)) {
      return null;
    }

    return templates[template];
  }

  getTemplateSubject(template: Templates) {
    if (this.options.html_templates?.[template]?.subject) {
      return this.options.html_templates[template].subject;
    }
    switch (template) {
      case Templates.ORDER_PLACED:
        return "Order Confirmation";
      case Templates.ORDER_PAID:
        return "Payment Received - Order Processing";
      case Templates.ORDER_FULFILLED:
        return "Your Order is Being Prepared";
      case Templates.ORDER_SHIPPED:
        return "Your Order Has Been Shipped";
      case Templates.ORDER_DELIVERED:
        return "Your Order Has Been Delivered";
      case Templates.PASSWORD_RESET:
        return "Reset your password";
      case Templates.ABANDONED_CART:
        return "[Onyx Genetics] Your research stack is reserved for dispatch 🧬";
      case Templates.ABANDONED_CART_HELP:
        return "Did you have trouble with checkout?";
      case Templates.ABANDONED_CART_TRUST:
        return "[Onyx Genetics] Quality Assurance & Delivery Guarantee";
      case Templates.ABANDONED_CART_FINAL:
        return "⏰ Final call for dispatch! Don't miss this window";
      case Templates.ORDER_TRANSFER_REQUESTED:
        return "Confirm order transfer request";
      case Templates.CUSTOMER_WELCOME:
        return "Welcome to Onyx Genetics";
      default:
        return "New Email";
    }
  }

  async send(
    notification: ProviderSendNotificationDTO
  ): Promise<ProviderSendNotificationResultsDTO> {
    console.log(
      `📨 Resend service: Attempting to send email template '${notification.template}' to ${notification.to}`
    );

    const template = this.getTemplate(notification.template as Templates);

    if (!template) {
      const errorMsg = `Couldn't find an email template for ${notification.template}. The valid options are ${Object.values(Templates)}`;
      console.error(`❌ ${errorMsg}`);
      this.logger.error(errorMsg);
      return {};
    }

    const commonOptions = {
      from: this.options.from,
      to: [notification.to],
      subject: this.getTemplateSubject(notification.template as Templates),
    };

    const reactTemplate =
      typeof template === "string" ? undefined : template(notification.data);

    const htmlTemplate =
      typeof template === "string"
        ? template
        : await render(reactTemplate as React.ReactElement);

    if ((this.options.transport || "resend") === "smtp") {
      if (!this.smtpTransporter) {
        this.logger.error("SMTP transporter is not initialized");
        return {};
      }

      const info = await this.smtpTransporter.sendMail({
        from: commonOptions.from,
        to: commonOptions.to[0],
        subject: commonOptions.subject,
        html: htmlTemplate,
      });

      console.log(`✅ SMTP service: Email sent successfully! ID: ${info.messageId}`);
      return { id: info.messageId };
    }

    if (!this.resendClient) {
      this.logger.error("Resend client is not initialized");
      return {};
    }

    let emailOptions: CreateEmailOptions;
    if (typeof template === "string") {
      emailOptions = {
        ...commonOptions,
        html: template,
      };
    } else {
      emailOptions = {
        ...commonOptions,
        react: reactTemplate,
      };
    }

    console.log(
      `📤 Resend service: Sending email via Resend API (from: ${commonOptions.from}, to: ${commonOptions.to[0]}, subject: ${commonOptions.subject})`
    );

    const { data, error } = await this.resendClient.emails.send(emailOptions);

    if (error || !data) {
      if (error) {
        const errorMsg = `Failed to send email: ${JSON.stringify(error, null, 2)}`;
        console.error(`❌ ${errorMsg}`);
        this.logger.error("Failed to send email", error);
      } else {
        const errorMsg =
          "Failed to send email: unknown error (no data returned)";
        console.error(`❌ ${errorMsg}`);
        this.logger.error(errorMsg);
      }
      return {};
    }

    console.log(`✅ Resend service: Email sent successfully! ID: ${data.id}`);

    return { id: data.id };
  }
}

export default ResendNotificationProviderService;
