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

type AbandonedCartHelpEmailProps = {
  cart: CartDTO & {
    customer: CustomerDTO;
  };
  storefront_url?: string;
};

function AbandonedCartHelpEmailComponent({
  cart,
  storefront_url = process.env.NEXT_PUBLIC_STORE_URL || "https://onyxgenetics.com",
}: AbandonedCartHelpEmailProps) {
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
        <Preview>Did you have trouble with checkout? We're here to help</Preview>

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
                  💬 Support
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Main Content */}
          <Container className="p-8">
            <Heading className="text-2xl font-bold text-gray-800 m-0 mb-4">
              Hi {customerName}, did you have trouble with the checkout?
            </Heading>
            <Text className="text-gray-600 text-base leading-relaxed m-0 mb-4">
              We noticed you didn't finish your order. No worries — it happens!
            </Text>
            <Text className="text-gray-600 text-base leading-relaxed m-0 mb-6">
              If you need help with Cash App, PayPal, or crypto payment, just reply to this email or text us on WhatsApp. We'll walk you through it step by step.
            </Text>

            {/* CTA Buttons */}
            <Section className="mb-6">
              <Row>
                <Column align="center">
                  <Button
                    href={recoveryUrl}
                    style={{
                      backgroundColor: "#3b82f6",
                      color: "#ffffff",
                      textDecoration: "none",
                      display: "inline-block",
                      padding: "14px 28px",
                      borderRadius: "8px",
                      fontWeight: "600",
                      fontSize: "16px",
                      marginBottom: "12px",
                    }}
                  >
                    Return to Cart →
                  </Button>
                </Column>
              </Row>
              <Row>
                <Column align="center">
                  <Link
                    href={whatsappUrl}
                    style={{
                      backgroundColor: "#128C7E",
                      color: "#ffffff",
                      textDecoration: "none",
                      display: "inline-block",
                      padding: "14px 28px",
                      borderRadius: "8px",
                      fontWeight: "600",
                      fontSize: "16px",
                    }}
                  >
                    💬 Get Help on WhatsApp
                  </Link>
                </Column>
              </Row>
            </Section>

            <Text className="text-gray-500 text-sm text-center m-0">
              Your cart is saved and ready whenever you are.
            </Text>
          </Container>

          {/* Footer */}
          <Section className="bg-gray-50 p-6">
            <Text className="text-center text-gray-500 text-sm mb-2">
              Questions? Reply to this email or reach out:
            </Text>
            <Row>
              <Column align="center">
                <Link href="mailto:sales@onyxgenetics.com" className="text-accent text-sm">
                  sales@onyxgenetics.com
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

export const abandonedCartHelpEmail = (props: AbandonedCartHelpEmailProps) => (
  <AbandonedCartHelpEmailComponent {...props} />
);

export default AbandonedCartHelpEmailComponent;

