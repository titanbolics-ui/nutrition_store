import {
  Text,
  Column,
  Container,
  Heading,
  Html,
  Row,
  Section,
  Tailwind,
  Head,
  Preview,
  Body,
  Link,
  Button,
} from "@react-email/components";
import { BigNumberValue, CartDTO, CustomerDTO } from "@medusajs/types";
import * as React from "react";

type AbandonedCartFinalEmailProps = {
  cart: CartDTO & {
    customer: CustomerDTO;
  };
  storefront_url?: string;
};

function AbandonedCartFinalEmailComponent({
  cart,
  storefront_url = process.env.NEXT_PUBLIC_STORE_URL || "https://onyxgenetics.com",
}: AbandonedCartFinalEmailProps) {
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
  const whatsappUrl = "https://wa.link/q91b6d";

  // Calculate dispatch deadline
  const now = new Date();
  const dayOfWeek = now.getDay();
  
  let nextDispatchDay = "";
  let deadlineDay = "";
  let hoursLeft = "";
  
  if (dayOfWeek >= 1 && dayOfWeek <= 3) {
    nextDispatchDay = "Thursday";
    deadlineDay = "Wednesday night";
    hoursLeft = "next few hours";
  } else {
    nextDispatchDay = "Monday";
    deadlineDay = "Sunday night";
    hoursLeft = "next few hours";
  }

  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              brand: "#27272a",
              accent: "#3b82f6",
              urgent: "#ef4444",
            },
          },
        },
      }}
    >
      <Html className="font-sans bg-gray-100">
        <Head />
        <Preview>Final call for the {nextDispatchDay} Dispatch! 🚛</Preview>

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
                <Text className="text-red-400 text-xs m-0 font-bold">
                  ⏰ FINAL CALL
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Urgency Banner */}
          <Section className="bg-red-500 text-white px-6 py-4">
            <Text className="text-center text-lg font-bold m-0">
              🚛 {nextDispatchDay} Morning Dispatch closes in {hoursLeft}
            </Text>
          </Section>

          {/* Main Content */}
          <Container className="p-8">
            <Heading className="text-2xl font-bold text-gray-800 m-0 mb-4">
              {customerName}, this is your final call
            </Heading>
            <Text className="text-gray-600 text-base leading-relaxed m-0 mb-4">
              Complete your order in the <strong>{hoursLeft}</strong> to ensure your pack leaves the warehouse <strong>{nextDispatchDay} morning</strong>.
            </Text>
            <Text className="text-gray-600 text-base leading-relaxed m-0 mb-6">
              Otherwise, you'll have to wait until the <strong>next dispatch run</strong>.
            </Text>

            {/* Urgency Box */}
            <Section className="bg-red-50 border-2 border-red-300 rounded-lg p-6 mb-6">
              <Row>
                <Column className="w-12 align-top">
                  <Text className="text-3xl m-0">⚠️</Text>
                </Column>
                <Column>
                  <Text className="text-sm font-bold text-red-800 m-0 mb-2">
                    Dispatch Schedule:
                  </Text>
                  <Text className="text-sm text-gray-700 m-0">
                    • Monday Morning Dispatch<br />
                    • Thursday Morning Dispatch
                  </Text>
                  <Text className="text-sm text-red-700 font-semibold m-0 mt-3">
                    Miss this window = 3-4 day delay
                  </Text>
                </Column>
              </Row>
            </Section>

            {/* CTA */}
            <Section className="text-center mb-6">
              <Button
                href={recoveryUrl}
                style={{
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  textDecoration: "none",
                  display: "inline-block",
                  padding: "18px 40px",
                  borderRadius: "8px",
                  fontWeight: "700",
                  fontSize: "18px",
                  textTransform: "uppercase",
                }}
              >
                Complete Order Now →
              </Button>
              <Text className="text-gray-500 text-sm mt-4">
                Your cart total: <strong>{formatPrice(cart.total)}</strong>
              </Text>
            </Section>

            <Text className="text-gray-600 text-sm text-center m-0">
              Need instant payment help? <Link href={whatsappUrl} className="text-accent font-semibold">Text Max on WhatsApp</Link> — we'll get you sorted in minutes.
            </Text>
          </Container>

          {/* What You're Missing */}
          <Container className="px-8 mb-8">
            <Section className="bg-gray-50 rounded-lg p-6">
              <Heading className="text-lg font-semibold text-gray-800 m-0 mb-4">
                What you're about to miss:
              </Heading>
              {cart.items?.map((item) => (
                <Row key={item.id} className="mb-2">
                  <Column className="w-8">
                    <Text className="m-0">•</Text>
                  </Column>
                  <Column>
                    <Text className="text-sm text-gray-700 m-0">
                      <strong>{item.quantity}x</strong> {item.product_title}
                    </Text>
                  </Column>
                </Row>
              ))}
            </Section>
          </Container>

          {/* Footer */}
          <Section className="bg-gray-50 p-6">
            <Text className="text-center text-gray-600 text-sm mb-2 font-semibold">
              Questions? We're here to help:
            </Text>
            <Row>
              <Column align="center">
                <Link href="mailto:sales@onyxgenetics.com" className="text-accent text-sm">
                  sales@onyxgenetics.com
                </Link>
              </Column>
            </Row>
            <Row className="mt-2">
              <Column align="center">
                <Link href={whatsappUrl} className="text-sm font-semibold" style={{ color: "#128C7E" }}>
                  💬 WhatsApp (Fastest Response)
                </Link>
              </Column>
            </Row>
            <Text className="text-center text-gray-400 text-xs mt-4">
              © {new Date().getFullYear()} Onyx Genetics, Inc.
            </Text>
          </Section>
        </Body>
      </Html>
    </Tailwind>
  );
}

export const abandonedCartFinalEmail = (props: AbandonedCartFinalEmailProps) => (
  <AbandonedCartFinalEmailComponent {...props} />
);

export default AbandonedCartFinalEmailComponent;

