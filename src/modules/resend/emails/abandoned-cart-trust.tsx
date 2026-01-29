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

type AbandonedCartTrustEmailProps = {
  cart: CartDTO & {
    customer: CustomerDTO;
  };
  storefront_url?: string;
};

function AbandonedCartTrustEmailComponent({
  cart,
  storefront_url = process.env.NEXT_PUBLIC_STORE_URL || "https://onyxgenetics.com",
}: AbandonedCartTrustEmailProps) {
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

  // Calculate next dispatch day
  const now = new Date();
  const dayOfWeek = now.getDay();
  let nextDispatchDay = "";
  
  if (dayOfWeek >= 1 && dayOfWeek <= 3) {
    nextDispatchDay = "Thursday";
  } else {
    nextDispatchDay = "Monday";
  }

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
        <Preview>Your research compounds are still reserved - HPLC verified quality</Preview>

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
                  🧬 Quality Assured
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Main Content */}
          <Container className="p-8">
            <Heading className="text-2xl font-bold text-gray-800 m-0 mb-4">
              Hi {customerName},
            </Heading>
            <Text className="text-gray-600 text-base leading-relaxed m-0 mb-4">
              We noticed your research compounds are still reserved in your cart. We understand that in this industry, <strong>trust is the most important factor</strong>.
            </Text>
            <Text className="text-gray-600 text-base leading-relaxed m-0 mb-6">
              At Onyx Genetics, we don't ask for blind trust—<strong>we provide proof</strong>.
            </Text>
          </Container>

          {/* Trust Section */}
          <Container className="px-8 mb-6">
            <Section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <Heading className="text-lg font-bold text-gray-800 m-0 mb-4">
                Why researchers choose our laboratory materials:
              </Heading>
              
              <Row className="mb-4">
                <Column className="w-10 align-top">
                  <Text className="text-2xl m-0">🔐</Text>
                </Column>
                <Column>
                  <Text className="text-sm text-gray-800 m-0 font-semibold mb-1">
                    Factory Authentication
                  </Text>
                  <Text className="text-sm text-gray-600 m-0">
                    Every single box from ZPHC or Spectrum comes with an <strong>official scratch-off security code</strong>. You can verify your batch directly on the manufacturer's website the moment it arrives.
                  </Text>
                </Column>
              </Row>

              <Row className="mb-4">
                <Column className="w-10 align-top">
                  <Text className="text-2xl m-0">🔬</Text>
                </Column>
                <Column>
                  <Text className="text-sm text-gray-800 m-0 font-semibold mb-1">
                    HPLC Verified
                  </Text>
                  <Text className="text-sm text-gray-600 m-0">
                    We only stock pharma-grade compounds that have undergone <strong>high-performance liquid chromatography (HPLC) testing</strong> to ensure <strong>99%+ purity</strong>.
                  </Text>
                </Column>
              </Row>

              <Row>
                <Column className="w-10 align-top">
                  <Text className="text-2xl m-0">📦</Text>
                </Column>
                <Column>
                  <Text className="text-sm text-gray-800 m-0 font-semibold mb-1">
                    100% Reship Guarantee
                  </Text>
                  <Text className="text-sm text-gray-600 m-0">
                    Your investment is protected. If a package is lost or seized during transit, <strong>we ship the entire order again at our expense</strong>. No questions asked.
                  </Text>
                </Column>
              </Row>
            </Section>
          </Container>

          {/* Dispatch Notice */}
          <Container className="px-8 mb-6">
            <Section className="bg-gray-50 border-l-4 border-blue-500 p-4">
              <Text className="text-sm text-gray-700 m-0">
                Your items are currently held at the packing station. To ensure they make the <strong>{nextDispatchDay} shipment</strong>, please finalize your checkout today.
              </Text>
            </Section>
          </Container>

          {/* CTA */}
          <Container className="px-8 mb-6 text-center">
            <Button
              href={recoveryUrl}
              style={{
                backgroundColor: "#3b82f6",
                color: "#ffffff",
                textDecoration: "none",
                display: "inline-block",
                padding: "16px 32px",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "18px",
              }}
            >
              Complete My Order
            </Button>
          </Container>

          <Container className="px-8 mb-8">
            <Text className="text-center text-gray-600 text-sm m-0">
              Need a custom protocol or help with the payment?<br />
              Just reply to this email or message our concierge directly on WhatsApp.
            </Text>
          </Container>

          <Hr className="border-gray-200 mx-8 my-6" />

          {/* Reserved Items Preview */}
          <Container className="px-8 mb-6">
            <Heading className="text-lg font-semibold text-gray-800 mb-4">
              Your Reserved Items ({cart.items?.length || 0})
            </Heading>
            {cart.items?.slice(0, 3).map((item) => (
              <Row key={item.id} className="mb-3">
                <Column className="w-16">
                  {item.thumbnail && (
                    <Img
                      src={item.thumbnail}
                      alt={item.product_title || ""}
                      width="50"
                      height="50"
                      className="rounded"
                    />
                  )}
                </Column>
                <Column>
                  <Text className="text-sm font-semibold text-gray-800 m-0">
                    {item.product_title}
                  </Text>
                  <Text className="text-xs text-gray-500 m-0">
                    Qty: {item.quantity} × {formatPrice(item.unit_price)}
                  </Text>
                </Column>
              </Row>
            ))}
          </Container>

          {/* Footer */}
          <Section className="bg-gray-50 p-6">
            <Text className="text-center text-gray-600 text-sm font-semibold mb-3">
              The Onyx Team
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
                  💬 WhatsApp Concierge
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

export const abandonedCartTrustEmail = (props: AbandonedCartTrustEmailProps) => (
  <AbandonedCartTrustEmailComponent {...props} />
);

export default AbandonedCartTrustEmailComponent;

