import {
  AbstractPaymentProvider,
  PaymentSessionStatus,
} from "@medusajs/framework/utils";
import { Logger } from "@medusajs/framework/types";

type Options = {
  // options
};

class PaypalManualPaymentService extends AbstractPaymentProvider {
  static identifier = "paypal-manual";

  protected logger_: Logger;
  protected options_: Options;

  constructor({ logger }: { logger: Logger }, options: Options) {
    super(arguments[0], options);
    this.logger_ = logger;
    this.options_ = options;
  }

  // 1. Initiate Payment
  async initiatePayment(input: any): Promise<any> {
    return {
      status: PaymentSessionStatus.PENDING,
      data: {
        id: "paypal_session_" + Date.now(),
        provider_id: "paypal-manual",
        created_at: new Date().toISOString(),
        ...input,
      },
    };
  }

  // 2. Authorize Payment
  async authorizePayment(input: any): Promise<any> {
    return {
      status: PaymentSessionStatus.AUTHORIZED,
      data: {
        ...input,
        status: PaymentSessionStatus.AUTHORIZED,
      },
    };
  }

  // 3. Cancel Payment
  async cancelPayment(input: any): Promise<any> {
    return {
      status: PaymentSessionStatus.CANCELED,
      data: {
        ...input,
      },
    };
  }

  // 4. Capture Payment
  async capturePayment(input: any): Promise<any> {
    return {
      status: PaymentSessionStatus.CAPTURED,
      data: {
        ...input,
      },
    };
  }

  // 5. Delete Payment
  async deletePayment(input: any): Promise<any> {
    return {};
  }

  // 6. Refund Payment
  async refundPayment(input: any): Promise<any> {
    return {
      id: "re_" + Date.now(),
    };
  }

  // 7. Retrieve Payment
  async retrievePayment(input: any): Promise<any> {
    return input;
  }

  // 8. Update Payment
  async updatePayment(input: any): Promise<any> {
    return {
      status: PaymentSessionStatus.PENDING,
      data: {
        ...input.data,
        amount: input.amount,
      },
    };
  }

  // 9. Get Status (ВИПРАВЛЕНО ТИП ПОВЕРНЕННЯ)
  async getPaymentStatus(input: any): Promise<any> {
    // Повертаємо просто рядок статусу або enum.
    // Тип any дозволяє уникнути помилки "not assignable".
    const data = input.data || input;
    return (
      (data.status as PaymentSessionStatus) || PaymentSessionStatus.PENDING
    );
  }

  // 10. Webhook
  async getWebhookActionAndData(input: any): Promise<any> {
    return {
      action: "not_supported",
    };
  }
}

export default PaypalManualPaymentService;
