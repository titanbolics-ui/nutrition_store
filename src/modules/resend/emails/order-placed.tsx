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
} from "@medusajs/framework/types";
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

function OrderPlacedEmailComponent({
  order,
  email_banner,
  paymentProviderID = "unknown",
}: OrderPlacedEmailProps) {
  // 1. Logic for CRYPTO (Only our new provider)
  const isCrypto =
    paymentProviderID === "crypto-manual" ||
    paymentProviderID === "pp_crypto-manual_crypto-manual";

  // 2. Logic for STANDARD MANUAL (pp_system_default) PayPal
  const isManualSystem = paymentProviderID === "pp_system_default";

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
            },
          },
        },
      }}
    >
      <Html className="font-sans bg-gray-100">
        <Head />
        {/* Using a template string to avoid type errors */}
        <Preview>{`Order Confirmation #${order.display_id}`}</Preview>

        <Body className="bg-white my-10 mx-auto w-full max-w-2xl shadow-sm rounded-md overflow-hidden">
          {/* Header */}
          <Section className="bg-brand text-white px-6 py-6">
            <Row>
              <Column>
                <Text className="text-xl font-bold m-0 tracking-wide uppercase">
                  MEDUSA STORE
                </Text>
              </Column>
              <Column align="right">
                <Text className="text-gray-400 text-xs m-0">
                  Order #{order.display_id}
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

          {/* 👇 MAIN LOGIC FOR BLOCK DISPLAY 👇 */}

          {/* VARIANT 1: CRYPTO (Orange, only BTC) */}
          {isCrypto ? (
            <Container className="px-8 mb-8">
              <Section className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                <Heading className="text-lg font-bold text-orange-800 m-0 mb-3 flex items-center">
                  ₿ Crypto Payment Required
                </Heading>
                <Text className="text-gray-700 text-sm mb-4">
                  Please send exactly{" "}
                  <strong>{formatPrice(order.total)}</strong> to the wallet
                  address below:
                </Text>

                {/* BTC Wallet */}
                <Section className="bg-white border border-gray-200 rounded p-3">
                  <Text className="text-xs font-bold text-btc uppercase tracking-wider m-0 mb-1">
                    Bitcoin (BTC)
                  </Text>
                  <Text className="font-mono text-sm text-gray-800 break-all m-0">
                    bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
                  </Text>
                </Section>
              </Section>
            </Container>
          ) : /* VARIANT 2: SYSTEM MANUAL / TEST (Blue) */
          isManualSystem ? (
            <Container className="px-8 mb-8">
              <Section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <Heading className="text-lg font-bold text-blue-800 m-0 mb-2">
                  ℹ️ Manual Payment (Default)
                </Heading>
                <Text className="text-blue-900 text-sm m-0 mb-4">
                  This order was placed using the default System Provider (
                  <b>pp_system_default</b>).
                </Text>
                <Section className="bg-white/50 border border-blue-100 rounded p-3">
                  <Text className="text-xs text-blue-800 m-0">
                    If this is a real order, please contact support for payment
                    details (Bank Transfer / Zelle).
                    <br />
                    <br />
                    <i>(Admin Note: This is separate from the Crypto logic)</i>
                  </Text>
                </Section>
              </Section>
            </Container>
          ) : (
            /* VARIANT 3: DEFAULT (Blue + PayPal) */
            <Container className="px-8 mb-8">
              <Section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <Heading className="text-lg font-bold text-blue-800 m-0 mb-3">
                  💳 PayPal Payment Instructions
                </Heading>
                <Text className="text-blue-900 text-sm mb-3">
                  To complete your payment, please send{" "}
                  <strong>{formatPrice(order.total)}</strong> via PayPal to the
                  wallet below and include your order number in the note:
                </Text>
                <Section className="bg-white border border-blue-100 rounded p-3 mt-1">
                  <Text className="text-xs font-bold text-blue-800 uppercase tracking-wider m-0 mb-1">
                    PayPal Wallet
                  </Text>
                  <Text className="font-mono text-sm text-gray-800 break-all m-0">
                    paypal-wallet@example.com
                  </Text>
                </Section>
                <Text className="text-blue-900 text-xs mt-3 m-0">
                  Order reference: <strong>#{order.display_id}</strong>
                </Text>
              </Section>
            </Container>
          )}

          {/* 👆 END OF LOGIC BLOCK 👆 */}

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
                  Order ID: #{order.display_id}
                </Text>
              </Column>
            </Row>
            {order.items?.map((item) => (
              <Section key={item.id} className="border-b border-gray-200 py-4">
                <Row>
                  <Column className="w-1/3">
                    <Img
                      src={item.thumbnail ?? ""}
                      alt={item.product_title ?? ""}
                      className="rounded-lg"
                      width="100%"
                    />
                  </Column>
                  <Column className="w-2/3 pl-4">
                    <Text className="text-lg font-semibold text-gray-800">
                      {item.product_title}
                    </Text>
                    <Text className="text-gray-600">{item.variant_title}</Text>
                    <Text className="text-gray-800 mt-2 font-bold">
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
              support team at support@medusajs.com.
            </Text>
            <Text className="text-center text-gray-500 text-sm">
              Order Token: {order.id}
            </Text>
            <Text className="text-center text-gray-400 text-xs mt-4">
              © {new Date().getFullYear()} Medusajs, Inc. All rights reserved.
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
