import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
  Hr,
  Row,
  Column,
  Link,
} from "@react-email/components";
import { BigNumberValue, OrderDTO } from "@medusajs/framework/types";
import * as React from "react";

type OrderShippedEmailProps = {
  order: OrderDTO;
  tracking_links?: { url?: string; tracking_number?: string }[];
};

function OrderShippedEmailComponent({
  order,
  tracking_links = [],
}: OrderShippedEmailProps) {
  const formatter = new Intl.NumberFormat([], {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: order.currency_code,
  });

  const formatPrice = (price: BigNumberValue) => {
    const directNum = Number(price as any);
    if (!Number.isNaN(directNum) && directNum !== 0) {
      return formatter.format(directNum);
    }

    if (typeof price === "number") {
      return formatter.format(price);
    }

    if (typeof price === "string") {
      const parsed = parseFloat(price);
      return Number.isNaN(parsed) ? price : formatter.format(parsed);
    }

    if (price && typeof (price as any).toString === "function") {
      const str = (price as any).toString();
      const parsed = parseFloat(str);
      if (!Number.isNaN(parsed)) {
        return formatter.format(parsed);
      }
    }

    return String(price ?? "");
  };

  const orderDetailsUrl = `${process.env.STORE_URL}/us/account/orders/details/${order.id}`;

  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              brand: "#27272a",
              shipped: "#0ea5e9",
            },
          },
        },
      }}
    >
      <Html className="font-sans bg-gray-100">
        <Head />
        <Preview>{`Your order #${order.display_id} has been shipped`}</Preview>
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
                  Order #{order.display_id}
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Status Banner */}
          <Section className="bg-blue-50 px-8 py-8 text-center border-b border-blue-100">
            <Heading className="text-2xl font-bold text-blue-800 m-0 mb-2">
              Your Order is On the Way
            </Heading>
            <Text className="text-blue-700 m-0 text-base">
              We&apos;ve shipped your package. You can track its progress using
              the information below.
            </Text>
          </Section>

          {/* Body */}
          <Container className="p-8">
            <Text className="text-gray-600 text-base leading-relaxed m-0 mb-6">
              Hi {order.shipping_address?.first_name || "Customer"},
            </Text>
            <Text className="text-gray-600 text-base leading-relaxed m-0 mb-6">
              Your order <strong>#{order.display_id}</strong> has left our
              warehouse and is on its way to you.
            </Text>

            <Section className="bg-gray-50 border border-gray-200 rounded p-4 mb-6">
              <Row>
                <Column>
                  <Text className="text-gray-500 text-xs uppercase tracking-wide m-0">
                    Order Total
                  </Text>
                  <Text className="text-gray-900 font-bold text-lg m-0">
                    {formatPrice(order.total)}
                  </Text>
                </Column>
              </Row>
            </Section>

            {tracking_links.length > 0 && (
              <Section className="bg-white border border-gray-200 rounded p-4 mb-6">
                <Heading className="text-lg font-semibold text-gray-800 m-0 mb-3">
                  Tracking Information
                </Heading>
                {tracking_links.map((t, index) => (
                  <Row key={index} className="mb-2">
                    <Column>
                      <Text className="text-gray-600 text-sm m-0">
                        {t.tracking_number || "Tracking number"}
                      </Text>
                      {t.url && (
                        <Link
                          href={t.url}
                          className="text-blue-600 text-sm underline"
                        >
                          Track package
                        </Link>
                      )}
                    </Column>
                  </Row>
                ))}
              </Section>
            )}

            <Hr className="border-gray-200 my-6" />

            <Section className="text-center mb-4">
              <Link
                href={orderDetailsUrl}
                className="inline-block px-4 py-2 rounded-md bg-brand text-white text-sm font-semibold no-underline"
              >
                View your order details
              </Link>
            </Section>

            <Text className="text-center text-gray-500 text-sm">
              You&apos;ll receive another email once your order is delivered.
            </Text>
          </Container>

          {/* Footer */}
          <Section className="bg-gray-50 p-8 mt-4 border-t border-gray-100">
            <Text className="text-center text-gray-400 text-xs">
              © {new Date().getFullYear()} Onyx Genetics Store. All rights
              reserved.
            </Text>
          </Section>
        </Body>
      </Html>
    </Tailwind>
  );
}

export const orderShippedEmail = (props: OrderShippedEmailProps) => (
  <OrderShippedEmailComponent {...props} />
);

export default OrderShippedEmailComponent;
