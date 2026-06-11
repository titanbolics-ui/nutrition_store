import {
  Body, Container, Head, Html, Preview,
  Section, Text, Tailwind, Hr, Row, Column, Link, Img,
} from "@react-email/components";
import { BigNumberValue, OrderDTO } from "@medusajs/types";
import * as React from "react";
import { ViewOrderButton, ActivateAccountBlock } from "./_shared";

type FulfillmentItem = {
  line_item_id?: string;
  title: string;
  quantity: number;
};

type OrderItem = {
  id: string;
  product_title?: string;
  variant_title?: string;
  quantity: number;
  thumbnail?: string;
};

type OrderFulfilledEmailProps = {
  order: OrderDTO & { items?: OrderItem[] };
  fulfillment?: {
    id: string;
    location_id?: string;
    location_name?: string;
    items?: FulfillmentItem[];
  };
  is_partial?: boolean;
  remaining_items?: OrderItem[];
  orderViewToken: string;
  hasRegisteredAccount?: boolean;
};

const STORE_URL = process.env.STORE_URL || "https://onyxgenetics.com";

function OrderFulfilledEmailComponent({
  order,
  fulfillment,
  is_partial = false,
  remaining_items = [],
  orderViewToken,
  hasRegisteredAccount = false,
}: OrderFulfilledEmailProps) {
  const formatter = new Intl.NumberFormat([], {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: order.currency_code || "USD",
  });

  const formatPrice = (price: BigNumberValue): string => {
    const n = Number(price as any);
    if (!Number.isNaN(n) && n !== 0) return formatter.format(n);
    if (typeof price === "number") return formatter.format(price);
    if (typeof price === "string") {
      const p = parseFloat(price);
      return Number.isNaN(p) ? price : formatter.format(p);
    }
    return String(price ?? "");
  };

  const customerName = order.shipping_address?.first_name || "there";
  const locationName = fulfillment?.location_name || "Warehouse";

  // Map fulfillment items to order items for product titles
  const orderItemMap: Record<string, OrderItem> = {};
  for (const item of order.items ?? []) {
    orderItemMap[item.id] = item;
  }

  const fulfilledItems = (fulfillment?.items ?? []).map((fi) => {
    const orderItem = fi.line_item_id ? orderItemMap[fi.line_item_id] : null;
    return {
      title: orderItem?.product_title || fi.title,
      variant: orderItem?.variant_title,
      quantity: Number(fi.quantity),
      thumbnail: orderItem?.thumbnail,
    };
  });

  return (
    <Tailwind config={{ theme: { extend: { colors: { brand: "#111111" } } } }}>
      <Html style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <Head />
        <Preview>
          {is_partial
            ? `Partial shipment for #ONX-${order.display_id} is being prepared`
            : `Your order #ONX-${order.display_id} is being prepared for dispatch`}
        </Preview>
        <Body style={{ background: "#0a0a0a", margin: 0, padding: "32px 0" }}>
          <Container style={{ maxWidth: 580, margin: "0 auto" }}>

            {/* Header */}
            <Section style={{ background: "#000000", borderRadius: "12px 12px 0 0", padding: "20px 24px" }}>
              <Row>
                <Column>
                  <Text style={{ color: "#b8ff2b", fontSize: 18, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
                    ONYX GENETICS
                  </Text>
                </Column>
                <Column align="right">
                  <Text style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>
                    #{`ONX-${order.display_id}`}
                  </Text>
                </Column>
              </Row>
            </Section>

            {/* Hero */}
            <Section style={{ background: "#111111", padding: "28px 24px 20px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
              <Text style={{ color: "#ffffff", fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>
                {is_partial ? "Partial shipment in preparation 📦" : "Your order is being prepared 📦"}
              </Text>
              <Text style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>
                Hi {customerName},{" "}
                {is_partial
                  ? `part of your order is being packed at ${locationName}. The remaining items will follow in a separate shipment.`
                  : `your order is being packed and will ship shortly from ${locationName}.`}
              </Text>
              <Hr style={{ borderColor: "#1f1f1f", margin: 0 }} />
            </Section>

            {/* This shipment */}
            <Section style={{ background: "#111111", padding: "20px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
              <Section style={{ background: "#031a0e", border: "1px solid #10b98133", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                <Row>
                  <Column>
                    <Text style={{ color: "#6ee7b7", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 2px" }}>
                      {is_partial ? "This shipment" : "Shipment"}
                    </Text>
                    <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: 600, margin: 0 }}>
                      Ships from: {locationName}
                    </Text>
                  </Column>
                  <Column align="right">
                    <Text style={{ color: "#10b981", fontSize: 11, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>
                      Preparing
                    </Text>
                  </Column>
                </Row>
              </Section>

              {fulfilledItems.map((item, i) => (
                <Row key={i} style={{ marginBottom: i < fulfilledItems.length - 1 ? 12 : 0, paddingBottom: i < fulfilledItems.length - 1 ? 12 : 0, borderBottom: i < fulfilledItems.length - 1 ? "1px solid #1f1f1f" : "none" }}>
                  <Column style={{ width: 48 }}>
                    {item.thumbnail
                      ? <Img src={item.thumbnail} alt={item.title} width="40" height="40" style={{ borderRadius: 6, background: "#1a1a1a", display: "block" }} />
                      : <Section style={{ width: 40, height: 40, background: "#1a1a1a", borderRadius: 6 }} />
                    }
                  </Column>
                  <Column>
                    <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: 600, margin: "0 0 2px", lineHeight: 1.4 }}>
                      {item.title}
                    </Text>
                    <Text style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>
                      {item.variant} · qty {item.quantity}
                    </Text>
                  </Column>
                </Row>
              ))}
            </Section>

            {/* Remaining items (partial only) */}
            {is_partial && remaining_items.length > 0 && (
              <>
                <Hr style={{ borderColor: "#1f1f1f", margin: 0 }} />
                <Section style={{ background: "#111111", padding: "20px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
                  <Section style={{ background: "#1a1200", border: "1px solid #f59e0b33", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                    <Text style={{ color: "#fbbf24", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 2px" }}>
                      Still to ship
                    </Text>
                    <Text style={{ color: "#9ca3af", fontSize: 12, margin: 0 }}>
                      These items will be sent in a separate shipment
                    </Text>
                  </Section>
                  {remaining_items.map((item, i) => (
                    <Row key={i} style={{ marginBottom: i < remaining_items.length - 1 ? 10 : 0 }}>
                      <Column style={{ width: 48 }}>
                        {item.thumbnail
                          ? <Img src={item.thumbnail} alt={item.product_title ?? ""} width="40" height="40" style={{ borderRadius: 6, background: "#1a1a1a", display: "block", opacity: 0.6 }} />
                          : <Section style={{ width: 40, height: 40, background: "#1a1a1a", borderRadius: 6 }} />
                        }
                      </Column>
                      <Column>
                        <Text style={{ color: "#6b7280", fontSize: 13, fontWeight: 600, margin: "0 0 2px" }}>
                          {item.product_title}
                        </Text>
                        <Text style={{ color: "#4b5563", fontSize: 12, margin: 0 }}>
                          {item.variant_title} · qty {Number(item.quantity)}
                        </Text>
                      </Column>
                    </Row>
                  ))}
                </Section>
              </>
            )}

            <Hr style={{ borderColor: "#1f1f1f", margin: 0 }} />

            {/* Tracking notice */}
            <Section style={{ background: "#0d0d10", padding: "16px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
              <Text style={{ color: "#6b7280", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                📬 You will receive a shipping confirmation email once this package leaves the warehouse. Tracking numbers are sent <strong style={{ color: "#9ca3af" }}>5–8 days after dispatch</strong>.
              </Text>
            </Section>

            {/* CTA */}
            <Section style={{ background: "#111111", padding: "20px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
              <ViewOrderButton token={orderViewToken} />
              {!hasRegisteredAccount && <ActivateAccountBlock token={orderViewToken} />}
            </Section>

            {/* Footer */}
            <Section style={{ background: "#000000", borderRadius: "0 0 12px 12px", padding: "20px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f", borderBottom: "1px solid #1f1f1f" }}>
              <Text style={{ color: "#6b7280", fontSize: 12, textAlign: "center", margin: "0 0 4px", lineHeight: 1.6 }}>
                Questions? Reply to this email or contact{" "}
                <Link href="mailto:sales@onyxgenetics.com" style={{ color: "#9ca3af" }}>sales@onyxgenetics.com</Link>
              </Text>
              <Text style={{ color: "#374151", fontSize: 11, textAlign: "center", margin: 0 }}>
                © {new Date().getFullYear()} Onyx Genetics. All rights reserved.
              </Text>
            </Section>

          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

export const orderFulfilledEmail = (props: OrderFulfilledEmailProps) => (
  <OrderFulfilledEmailComponent {...props} />
);

export default OrderFulfilledEmailComponent;
