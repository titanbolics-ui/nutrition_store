import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils";
import {
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types";
import { Resend, CreateEmailOptions } from "resend";
import { orderPlacedEmail } from "./emails/order-placed";
import { orderPaidEmail } from "./emails/order-paid";
import { orderFulfilledEmail } from "./emails/order-fulfilled";
import { orderShippedEmail } from "./emails/order-shipped";
import { orderDeliveredEmail } from "./emails/order-delivered";

type ResendOptions = {
  api_key: string;
  from: string;
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
}

const templates: { [key in Templates]?: (props: unknown) => React.ReactNode } =
  {
    [Templates.ORDER_PLACED]: orderPlacedEmail,
    [Templates.ORDER_PAID]: orderPaidEmail,
    [Templates.ORDER_FULFILLED]: orderFulfilledEmail,
    [Templates.ORDER_SHIPPED]: orderShippedEmail,
    [Templates.ORDER_DELIVERED]: orderDeliveredEmail,
  };

class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "notification-resend";
  static validateOptions(options: Record<any, any>) {
    if (!options.api_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `api_key` is required in the provider's options."
      );
    }
    if (!options.from) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `from` is required in the provider's options."
      );
    }
  }

  private resendClient: Resend;
  private options: ResendOptions;
  private logger: Logger;

  constructor({ logger }: InjectedDependencies, options: ResendOptions) {
    super();
    this.resendClient = new Resend(options.api_key);
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

    let emailOptions: CreateEmailOptions;
    if (typeof template === "string") {
      emailOptions = {
        ...commonOptions,
        html: template,
      };
    } else {
      emailOptions = {
        ...commonOptions,
        react: template(notification.data),
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
