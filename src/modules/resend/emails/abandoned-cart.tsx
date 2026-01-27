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
  Button,
  Hr,
} from "@react-email/components";
import { BigNumberValue, CartDTO, CustomerDTO } from "@medusajs/types";
import * as React from "react";

type AbandonedCartEmailProps = {
  cart: CartDTO & {
    customer: CustomerDTO;
  };
  storefront_url?: string;
};

function AbandonedCartEmailComponent({
  cart,
  storefront_url = process.env.NEXT_PUBLIC_STORE_URL || "https://onyxgenetics.com",
}: AbandonedCartEmailProps) {
  const currencyCode = cart.currency_code || "usd";
  
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: currencyCode.toUpperCase(),
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

  const customerName = cart.customer?.first_name || 
    cart.shipping_address?.first_name || 
    "there";

  const recoveryUrl = `${storefront_url}/cart/recover/${cart.id}`;

  // Calculate dispatch deadline based on shipping schedule
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  let nextDispatchDay = "";
  let deadlineDay = "";
  
  // Monday (1), Tuesday (2), Wednesday (3) -> Thursday dispatch, Wednesday deadline
  if (dayOfWeek >= 1 && dayOfWeek <= 3) {
    nextDispatchDay = "Thursday";
    deadlineDay = "Wednesday night";
  } 
  // Thursday (4), Friday (5), Saturday (6), Sunday (0) -> Monday dispatch, Sunday deadline
  else {
    nextDispatchDay = "Monday";
    deadlineDay = "Sunday night";
  }

  const whatsappUrl = "https://wa.link/q91b6d";

  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              brand: "#27272a",
              accent: "#3b82f6",
            },
          },
        },
      }}
    >
      <Html className="font-sans bg-gray-100">
        <Head />
        <Preview>Your cart is waiting! Complete your purchase now 🛍️</Preview>

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
                  🛒 Cart Reminder
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Greeting */}
          <Container className="p-8">
            <Heading className="text-2xl font-bold text-gray-800 m-0 mb-4">
              Hi {customerName}, your research stack is reserved! 🧬
            </Heading>
            <Text className="text-gray-600 text-base leading-relaxed m-0 mb-4">
              Your cart is ready for checkout. Complete your order before <strong>{deadlineDay}</strong> to make the <strong>{nextDispatchDay} Morning Dispatch</strong> run.
            </Text>
            <Text className="text-gray-500 text-sm m-0">
              Your pharma-grade compounds are reserved and ready for discreet shipping.
            </Text>
          </Container>

          {/* Cart Items */}
          <Container className="px-8 mb-6">
            <Heading className="text-xl font-semibold text-gray-800 mb-4">
              Items in Your Cart
            </Heading>
            {cart.items?.map((item) => (
              <Section key={item.id} className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
                <Row>
                  {/* Thumbnail */}
                  <Column className="w-[80px] align-top pr-4">
                    <Img
                      src={item.thumbnail ?? ""}
                      alt={item.product_title ?? ""}
                      className="rounded bg-gray-100 object-cover"
                      width="80"
                      height="80"
                    />
                  </Column>

                  {/* Product Details */}
                  <Column className="align-top">
                    <Text className="text-base font-semibold text-gray-900 m-0 mb-1">
                      {item.product_title}
                    </Text>
                    {item.variant_title && (
                      <Text className="text-sm text-gray-500 m-0 mb-2">
                        {item.variant_title}
                      </Text>
                    )}
                    <Text className="text-sm text-gray-600 m-0">
                      Quantity: <strong>{item.quantity}</strong>
                    </Text>
                  </Column>

                  {/* Price */}
                  <Column className="align-top text-right w-[100px]">
                    <Text className="text-sm text-gray-500 m-0 mb-1">
                      {formatPrice(item.unit_price)} each
                    </Text>
                    <Text className="text-lg font-bold text-gray-900 m-0">
                      {formatPrice(item.total)}
                    </Text>
                  </Column>
                </Row>
              </Section>
            ))}

            {/* Total */}
            {/* <Section className="border-t border-gray-300 pt-4 mt-6">
              <Row>
                <Column className="text-right">
                  <Text className="text-sm text-gray-600 m-0 mb-1">Subtotal:</Text>
                  <Text className="text-2xl font-bold text-gray-900 m-0">
                    {formatPrice(cart.total)}
                  </Text>
                </Column>
              </Row>
            </Section> */}
          </Container>

          {/* CTA Button */}
          <Container className="px-8 mb-6 text-center">
            <Button
              href={recoveryUrl}
              className="bg-accent text-white text-lg font-semibold py-4 px-8 rounded-lg"
              style={{
                backgroundColor: "#3b82f6",
                color: "#ffffff",
                textDecoration: "none",
                display: "inline-block",
                padding: "16px 32px",
                fontSize: "18px",
                fontWeight: "600",
                borderRadius: "8px",
              }}
            >
              Complete Your Purchase →
            </Button>
          </Container>

          {/* Payment Help Section */}
          <Container className="px-8 mb-8">
            <Section className="bg-blue-50 border border-blue-200 rounded-lg p-5 text-center">
              <Text className="text-gray-700 text-sm m-0 mb-3">
                <strong>Need help with the payment?</strong>
              </Text>
              <Text className="text-gray-600 text-sm m-0 mb-4">
                We accept Cash App and PayPal manually. Reply to this email or message our concierge on WhatsApp for instant setup.
              </Text>
              <Link
                href={whatsappUrl}
                className="inline-block bg-green-500 text-white px-6 py-3 rounded-lg font-semibold text-sm"
                style={{
                  backgroundColor: "#128C7E",
                  color: "#ffffff",
                  textDecoration: "none",
                  display: "inline-block",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  fontWeight: "600",
                }}
              >
                💬 Text with Max on WhatsApp
              </Link>
            </Section>
          </Container>

          <Hr className="border-gray-200 mx-8 my-6" />

          {/* Why Buy Section */}
          <Container className="px-8 mb-6">
            <Heading className="text-lg font-semibold text-gray-800 mb-4">
              Why Shop With Us?
            </Heading>
            <Row className="mb-3">
              <Column className="w-8">
                <Text className="text-2xl m-0">✓</Text>
              </Column>
              <Column>
                <Text className="text-sm text-gray-700 m-0">
                  <strong>Pharma-Grade Purity</strong> – HPLC tested compounds from ZPHC/Spectrum
                </Text>
              </Column>
            </Row>
            <Row className="mb-3">
              <Column className="w-8">
                <Text className="text-2xl m-0">✓</Text>
              </Column>
              <Column>
                <Text className="text-sm text-gray-700 m-0">
                  <strong>Discreet Logistics</strong> – 100% success rate with stealth packaging
                </Text>
              </Column>
            </Row>
            <Row>
              <Column className="w-8">
                <Text className="text-2xl m-0">✓</Text>
              </Column>
              <Column>
                <Text className="text-sm text-gray-700 m-0">
                  <strong>Concierge Support</strong> – Real-time assistance via WhatsApp and Email
                </Text>
              </Column>
            </Row>
          </Container>

          {/* Footer */}
          <Section className="bg-gray-50 p-6 mt-10">
            <Text className="text-center text-gray-500 text-sm mb-3">
              Need help? Reply to this email or reach out:
            </Text>
            <Row className="mb-3">
              <Column align="center">
                <Link href="mailto:sales@onyxgenetics.com" className="text-accent text-sm">
                  sales@onyxgenetics.com
                </Link>
              </Column>
            </Row>
            <Row className="mb-4">
              <Column align="center">
                <Link href={whatsappUrl} className="text-green-600 text-sm font-semibold">
                  💬 Text with Max on WhatsApp
                </Link>
              </Column>
            </Row>
            <Text className="text-center text-gray-400 text-xs mt-4">
              © {new Date().getFullYear()} Onyx Genetics, Inc. All rights reserved.
            </Text>
            <Text className="text-center text-gray-400 text-xs mt-2">
              Cart ID: {cart.id}
            </Text>
          </Section>
        </Body>
      </Html>
    </Tailwind>
  );
}

export const abandonedCartEmail = (props: AbandonedCartEmailProps) => (
  <AbandonedCartEmailComponent {...props} />
);

export default AbandonedCartEmailComponent;

