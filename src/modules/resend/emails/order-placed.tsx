import {
  Text,
  Column,
  Container,
  Heading,
  Html,
  Img,
  Row,
  Section,
  Tailwind,
  Head,
  Preview,
  Body,
  Link,
  Hr,
} from "@react-email/components";
import {
  BigNumberValue,
  CustomerDTO,
  OrderDTO,
} from "@medusajs/types";
import * as React from "react";

type OrderPlacedEmailProps = {
  order: OrderDTO & {
    customer: CustomerDTO;
  };
  email_banner?: {
    body: string;
    title: string;
    url: string;
  };
  paymentProviderID?: string;
};

type PaymentInstructionProps = {
  order: OrderDTO;
  formatPrice: (price: BigNumberValue) => string;
  btcAmount: string | null;
};

// Payment Confirmation Request Component
const PaymentConfirmationSection = () => (
  <Container className="px-8 mb-8">
    <Section className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
      <Heading className="text-lg font-bold text-yellow-800 m-0 mb-3">
        📸 Payment Confirmation Required
      </Heading>
      <Text className="text-gray-700 text-sm mb-2">
        Once you've completed the payment, please reply to this email with a screenshot or proof of payment. This helps us process your order faster.
      </Text>
      <Text className="text-xs text-gray-600 m-0">
        Simply hit "Reply" and attach your payment screenshot.
      </Text>
    </Section>
  </Container>
);

// Wallet Display Component
const WalletAddress = ({ label, address, colorClass = "text-gray-800" }: { label: string; address: string; colorClass?: string }) => (
  <Section className="bg-white border border-gray-200 rounded p-3">
    <Text className={`text-xs font-bold uppercase tracking-wider m-0 mb-1 ${colorClass}`}>
      {label}
    </Text>
    <Text className="font-mono text-sm text-gray-800 break-all m-0">
      {address}
    </Text>
  </Section>
);

// Crypto Payment Instructions
const CryptoPaymentInstructions = ({ order, formatPrice, btcAmount }: PaymentInstructionProps) => (
  <Container className="px-8 mb-8">
    <Section className="bg-orange-50 border border-orange-200 rounded-lg p-6">
      <Heading className="text-lg font-bold text-orange-800 m-0 mb-3">
        ₿ Crypto Payment Required
      </Heading>
      <Text className="text-gray-700 text-sm mb-4">
        Please send exactly{" "}
        {btcAmount && btcAmount !== "0" ? (
          <strong>{btcAmount} BTC</strong>
        ) : (
          <strong>{formatPrice(order.total)}</strong>
        )}{" "}
        to the wallet address below:
      </Text>
      <WalletAddress 
        label="Bitcoin (BTC)" 
        address={process.env.NEXT_PUBLIC_BTC_WALLET_ADDRESS || ""} 
        colorClass="text-btc"
      />
    </Section>
  </Container>
);

// Manual/System Payment Instructions
const ManualPaymentInstructions = () => (
  <Container className="px-8 mb-8">
    <Section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <Heading className="text-lg font-bold text-blue-800 m-0 mb-2">
        ℹ️ Manual Payment (Default)
      </Heading>
      <Text className="text-blue-900 text-sm m-0 mb-4">
        This order was placed using the default System Provider
      </Text>
      <Section className="bg-white/50 border border-blue-100 rounded p-3">
        <Text className="text-xs text-blue-800 m-0">
          If this is a real order, please contact support for payment details (Crypto / PayPal / Cash App).
          <br /><br />
          <i>(Admin Note: This is separate from the Crypto logic)</i>
        </Text>
      </Section>
    </Section>
  </Container>
);

// PayPal Payment Instructions
const PayPalPaymentInstructions = ({ order, formatPrice }: PaymentInstructionProps) => (
  <Container className="px-8 mb-8">
    <Section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <Heading className="text-lg font-bold text-blue-800 m-0 mb-3">
        💳 PayPal Payment Instructions
      </Heading>
      <Text className="text-blue-900 text-sm mb-3">
        To complete your payment, please send{" "}
        <strong>{formatPrice(order.total)}</strong> via PayPal to the wallet below.{" "}
        <strong>You must select "Send to friends and family" option.</strong>{" "}
        Do not include any additional notes or comments.
      </Text>
      <WalletAddress 
        label="PayPal Wallet" 
        address={`Paypal email (COPY ONLY)\n${process.env.NEXT_PUBLIC_PAYPAL_WALLET_ADDRESS || ""}`}
        colorClass="text-blue-800"
      />
      <Text className="text-blue-900 text-xs mt-3 m-0">
        Order reference: <strong>#ONX-{order.display_id}</strong>
      </Text>
    </Section>
  </Container>
);

// Card Payment Instructions
const CardPaymentInstructions = ({ order }: { order: OrderDTO }) => {
  const paymentUrl = `${process.env.NEXT_PUBLIC_STORE_URL || "https://onyxgenetics.com"}/us/order/${order.id}/confirmed`;
  const whatsappUrl = "https://wa.link/q91b6d";

  // Calculate next dispatch day
  const now = new Date();
  const dayOfWeek = now.getDay();
  let nextDispatchDay = "";
  
  if (dayOfWeek >= 1 && dayOfWeek <= 3) {
    nextDispatchDay = "Thursday Morning";
  } else {
    nextDispatchDay = "Monday Morning";
  }

  const customerName = order.customer?.first_name || 
    order.shipping_address?.first_name || 
    "there";

  return (
    <Container className="px-8 mb-8">
      <Section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <Heading className="text-xl font-bold text-gray-800 m-0 mb-4">
          Hi {customerName},
        </Heading>
        <Text className="text-gray-700 text-base leading-relaxed mb-4">
          Your research protocol is ready and reserved for the <strong>{nextDispatchDay} Dispatch</strong>.
        </Text>
        <Text className="text-gray-700 text-base leading-relaxed mb-6">
          To finalize your order and secure your items, please use our secure payment terminal via the button below.
        </Text>
        
        {/* Payment Button */}
        <Section className="text-center mb-6">
          <Link
            href={paymentUrl}
            className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg font-bold text-base"
            style={{
              backgroundColor: "#2563eb",
              color: "#ffffff",
              textDecoration: "none",
              display: "inline-block",
              padding: "16px 32px",
              borderRadius: "8px",
              fontWeight: "700",
              fontSize: "16px",
            }}
          >
            💳 PAY SECURELY WITH CARD
          </Link>
        </Section>

        {/* Alternative Methods */}
        <Section className="bg-white/50 border border-blue-100 rounded p-4">
          <Text className="text-sm text-gray-700 m-0">
            <strong>Note:</strong> If you prefer Cash App, PayPal or direct BTC, just reply to this email or{" "}
            <Link href={whatsappUrl} className="text-blue-600 font-semibold">
              message Max on WhatsApp
            </Link>.
          </Text>
        </Section>
      </Section>
    </Container>
  );
};

// Cash App Payment Instructions
const CashAppPaymentInstructions = ({ order, formatPrice }: PaymentInstructionProps) => (
  <Container className="px-8 mb-8">
    <Section className="bg-[#f0fdf4] border border-green-200 rounded-lg p-6">
      <Row className="mb-4">
        <Column>
          <Heading className="text-xl font-bold text-gray-800 m-0 flex items-center">
            <span className="text-cashapp mr-2">●</span> Pay via Cash App
          </Heading>
        </Column>
        <Column align="right">
          <Text className="text-xs font-bold text-gray-400 m-0">
            FASTEST METHOD
          </Text>
        </Column>
      </Row>

      <Text className="text-gray-800 text-sm mb-4 font-medium">
        Complete your order in 60 seconds using Bitcoin on Cash App.
      </Text>

      <Section className="bg-white border border-green-100 rounded-lg p-4 mb-4">
        {[
          { num: 1, text: 'Open Cash App and tap the "Bitcoin" tab.' },
          { num: 2, text: `Buy ${formatPrice(order.total)} worth of BTC.` },
          { num: 3, text: 'Tap the "Paper Airplane" (Send) icon.' },
          { num: 4, text: 'Copy the address below and paste it in the "To" field.' },
        ].map(({ num, text }) => (
          <Row key={num} className={num < 4 ? "mb-3" : ""}>
            <Column className="w-8 align-top">
              <Text className="text-base font-bold text-gray-800 m-0">{num}.</Text>
            </Column>
            <Column>
              <Text className="text-sm text-gray-600 m-0 leading-6" dangerouslySetInnerHTML={{ __html: text }} />
            </Column>
          </Row>
        ))}
      </Section>

      <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider m-0 mb-2">
        Copy this address:
      </Text>
      <Section className="bg-white border-2 border-dashed border-gray-300 rounded p-4 text-center">
        <Text className="font-mono text-sm text-gray-800 break-all m-0 select-all">
          {process.env.NEXT_PUBLIC_BTC_WALLET_ADDRESS}
        </Text>
      </Section>

      <Text className="text-xs text-center text-gray-400 mt-2">
        Order status will update automatically once payment is detected.
      </Text>
    </Section>
  </Container>
);

function OrderPlacedEmailComponent({
  order,
  email_banner,
  paymentProviderID = "unknown",
}: OrderPlacedEmailProps) {
  const metaMethod = order.metadata?.payment_method as string | undefined;

  // Payment type detection
  const isCrypto =
    paymentProviderID === "crypto-manual" ||
    paymentProviderID === "pp_crypto-manual_crypto-manual" ||
    metaMethod === "BTC" ||
    metaMethod === "CRYPTO";

  const isManualSystem =
    paymentProviderID === "pp_system_default" ||
    paymentProviderID === "manual" ||
    metaMethod === "MANUAL";

  const isCashApp =
    paymentProviderID === "cash-app" ||
    paymentProviderID === "pp_cash-app_cash-app" ||
    metaMethod === "CASHAPP";

  const isPayPal =
    paymentProviderID === "paypal-manual" ||
    paymentProviderID === "pp_paypal-manual_paypal-manual" ||
    metaMethod === "PAYPAL";

    const isCard =
    paymentProviderID === "card-manual" ||
    paymentProviderID === "pp_card-manual_card-manual" ||
    metaMethod === "CARD";

  const btcAmount =
    order.metadata?.amount_btc !== undefined &&
    order.metadata?.amount_btc !== null
      ? String(order.metadata.amount_btc)
      : null;

  const shouldDisplayBanner = email_banner && "title" in email_banner;

  const formatter = new Intl.NumberFormat([], {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: order.currency_code,
  });

  const formatPrice = (price: BigNumberValue) => {
    if (typeof price === "number") {
      return formatter.format(price);
    }
    if (typeof price === "string") {
      return formatter.format(parseFloat(price));
    }
    return price?.toString() || "";
  };

  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              brand: "#27272a",
              btc: "#F7931A",
              usdt: "#26A17B",
              cashapp: "#059669",
            },
          },
        },
      }}
    >
      <Html className="font-sans bg-gray-100">
        <Head />
        {/* Using a template string to avoid type errors */}
        <Preview>{`Order Confirmation #ONX-${order.display_id}`}</Preview>

        <Body className="bg-white my-10 mx-auto w-full max-w-2xl shadow-sm rounded-md overflow-hidden">
          {/* Header */}
          <Section className="bg-brand text-white px-6 py-6">
            <Row>
              <Column>
                <Text className="text-xl font-bold m-0 tracking-wide uppercase">
                  Onyx Genetics Store
                </Text>
              </Column>
              <Column align="right">
                <Text className="text-gray-400 text-xs m-0">
                  Order #ONX-{order.display_id}
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Greeting */}
          <Container className="p-8">
            <Heading className="text-2xl font-bold text-gray-800 m-0 mb-4">
              Hi{" "}
              {order.customer?.first_name ||
                order.shipping_address?.first_name ||
                "there"}
              ,
            </Heading>
            <Text className="text-gray-600 text-base leading-relaxed m-0">
              Thank you for your order! We have received your request.
            </Text>
          </Container>

          {/* Payment Instructions */}
          {isCrypto && <CryptoPaymentInstructions order={order} formatPrice={formatPrice} btcAmount={btcAmount} />}
          {isManualSystem && <ManualPaymentInstructions />}
          {isPayPal && <PayPalPaymentInstructions order={order} formatPrice={formatPrice} btcAmount={btcAmount} />}
          {isCashApp && <CashAppPaymentInstructions order={order} formatPrice={formatPrice} btcAmount={btcAmount} />}
          {isCard && <CardPaymentInstructions order={order} />}

          {/* Payment Confirmation Request */}
          {!isManualSystem && <PaymentConfirmationSection />}

          <Hr className="border-gray-200 mx-8 my-6" />

          {/* Promotional Banner */}
          {shouldDisplayBanner && (
            <Container
              className="mb-4 rounded-lg p-7"
              style={{
                background: "linear-gradient(to right, #3b82f6, #4f46e5)",
              }}
            >
              <Section>
                <Row>
                  <Column align="left">
                    <Heading className="text-white text-xl font-semibold">
                      {email_banner.title}
                    </Heading>
                    <Text className="text-white mt-2">{email_banner.body}</Text>
                  </Column>
                  <Column align="right">
                    <Link
                      href={email_banner.url}
                      className="font-semibold px-2 text-white underline"
                    >
                      Shop Now
                    </Link>
                  </Column>
                </Row>
              </Section>
            </Container>
          )}

          {/* Order Items */}
          <Container className="px-6">
            <Heading className="text-xl font-semibold text-gray-800 mb-4">
              Your Items
            </Heading>
            <Row>
              <Column>
                <Text className="text-sm m-0 my-2 text-gray-500">
                  Order ID: #ONX-{order.display_id}
                </Text>
              </Column>
            </Row>
            {order.items?.map((item) => (
              <Section key={item.id} className="border-b border-gray-100 py-4">
                <Row>
                  {/* 1. Thumbnail (W-16 ~ 64px) */}
                  <Column className="w-[64px] align-top pr-4">
                    <Img
                      src={item.thumbnail ?? ""}
                      alt={item.product_title ?? ""}
                      className="rounded bg-gray-100 object-cover"
                      width="64"
                      height="64"
                    />
                  </Column>

                  {/* 2. Product Details */}
                  <Column className="align-top">
                    <Text className="text-sm font-semibold text-gray-900 m-0 mb-1 leading-tight">
                      {item.product_title}
                    </Text>
                    <Text className="text-xs text-gray-500 m-0">
                      {item.variant_title}
                    </Text>
                  </Column>

                  {/* 3. Price & Quantity (Right Aligned) */}
                  <Column className="align-top text-right w-[100px]">
                    {/* Quantity x Unit Price */}
                    <Text className="text-xs text-gray-500 m-0 mb-1">
                      <span className="font-medium text-gray-800">
                        {item.quantity}
                      </span>{" "}
                      x {formatPrice(item.unit_price)}
                    </Text>

                    {/* Total Line Price */}
                    <Text className="text-sm font-bold text-gray-900 m-0">
                      {formatPrice(item.total)}
                    </Text>
                  </Column>
                </Row>
              </Section>
            ))}

            {/* Order Summary */}
            <Section className="mt-8">
              <Heading className="text-xl font-semibold text-gray-800 mb-4">
                Order Summary
              </Heading>
              <Row className="text-gray-600">
                <Column className="w-1/2">
                  <Text className="m-0">Subtotal</Text>
                </Column>
                <Column className="w-1/2 text-right">
                  <Text className="m-0">{formatPrice(order.item_total)}</Text>
                </Column>
              </Row>
              {order.shipping_methods?.map((method) => (
                <Row className="text-gray-600" key={method.id}>
                  <Column className="w-1/2">
                    <Text className="m-0">{method.name}</Text>
                  </Column>
                  <Column className="w-1/2 text-right">
                    <Text className="m-0">{formatPrice(method.total)}</Text>
                  </Column>
                </Row>
              ))}
              <Row className="text-gray-600">
                <Column className="w-1/2">
                  <Text className="m-0">Tax</Text>
                </Column>
                <Column className="w-1/2 text-right">
                  <Text className="m-0">
                    {formatPrice(order.tax_total || 0)}
                  </Text>
                </Column>
              </Row>
              <Row className="border-t border-gray-200 mt-4 text-gray-800 font-bold">
                <Column className="w-1/2">
                  <Text>Total</Text>
                </Column>
                <Column className="w-1/2 text-right">
                  <Text>{formatPrice(order.total)}</Text>
                </Column>
              </Row>
            </Section>
          </Container>

          {/* Footer */}
          <Section className="bg-gray-50 p-6 mt-10">
            <Text className="text-center text-gray-500 text-sm">
              If you have any questions, reply to this email or contact our
              support team at sales@onyxgenetics.com.
            </Text>
            <Text className="text-center text-gray-500 text-sm">
              Order Token: {order.id}
            </Text>
            <Text className="text-center text-gray-400 text-xs mt-4">
              © {new Date().getFullYear()} Onyx Genetics, Inc. All rights
              reserved.
            </Text>
          </Section>
        </Body>
      </Html>
    </Tailwind>
  );
}

export const orderPlacedEmail = (props: OrderPlacedEmailProps) => (
  <OrderPlacedEmailComponent {...props} />
);

export default OrderPlacedEmailComponent;
