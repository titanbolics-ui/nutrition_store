import {
  Body, Container, Head, Html, Preview,
  Section, Text, Tailwind, Hr, Row, Column, Link, Img,
} from "@react-email/components";
import { BigNumberValue, OrderDTO } from "@medusajs/types";
import * as React from "react";

type ShippedItem = {
  title: string;
  variant?: string;
  quantity: number;
  thumbnail?: string;
};

type RemainingItem = {
  id: string;
  product_title?: string;
  variant_title?: string;
  quantity: number;
  thumbnail?: string;
};

type OrderShippedEmailProps = {
  order: OrderDTO;
  tracking_links?: { url?: string; tracking_number?: string }[];
  fulfillment_items?: ShippedItem[];
  location_name?: string;
  is_partial?: boolean;
  remaining_items?: RemainingItem[];
};

const STORE_URL = process.env.STORE_URL || "https://onyxgenetics.com";

function OrderShippedEmailComponent({
  order,
  tracking_links = [],
  fulfillment_items = [],
  location_name = "Warehouse",
  is_partial = false,
  remaining_items = [],
}: OrderShippedEmailProps) {
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
  const orderUrl = `${STORE_URL}/us/account/orders/details/${order.id}`;
  const hasTracking = tracking_links.length > 0 && tracking_links[0].tracking_number;

  return (
    <Tailwind config={{ theme: { extend: { colors: { brand: "#111111" } } } }}>
      <Html style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <Head />
        <Preview>
          {is_partial
            ? `Partial shipment from ${location_name} is on its way — #ONX-${order.display_id}`
            : `Your order #ONX-${order.display_id} has shipped from ${location_name}`}
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
                {is_partial ? "Partial shipment on its way 🚚" : "Your order has shipped 🚚"}
              </Text>
              <Text style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>
                Hi {customerName},{" "}
                {is_partial
                  ? `part of your order has left ${location_name}. The remaining items will follow in a separate shipment.`
                  : `your package has left ${location_name} and is on its way to you.`}
              </Text>
              <Hr style={{ borderColor: "#1f1f1f", margin: 0 }} />
            </Section>

            {/* Tracking */}
            <Section style={{ background: "#111111", padding: "20px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
              {hasTracking ? (
                <>
                  <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>
                    Tracking
                  </Text>
                  {tracking_links.map((t, i) => (
                    <Section key={i} style={{ background: "#0a1a0a", border: "1px solid #10b98133", borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>
                      <Row>
                        <Column>
                          <Text style={{ color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 4px" }}>
                            Tracking number
                          </Text>
                          <Text style={{ color: "#ffffff", fontFamily: "monospace", fontSize: 14, fontWeight: 700, margin: "0 0 8px", letterSpacing: 0.5 }}>
                            {t.tracking_number}
                          </Text>
                          {t.url && (
                            <Link
                              href={t.url}
                              style={{ background: "#b8ff2b", color: "#000000", textDecoration: "none", display: "inline-block", padding: "8px 20px", borderRadius: 6, fontSize: 13, fontWeight: 700 }}
                            >
                              Track package →
                            </Link>
                          )}
                        </Column>
                      </Row>
                    </Section>
                  ))}
                  <Text style={{ color: "#4b5563", fontSize: 12, margin: "10px 0 0", lineHeight: 1.6 }}>
                    If the tracking page shows no updates yet, check back in <strong style={{ color: "#6b7280" }}>5–8 days</strong> — numbers activate once the package clears customs.
                  </Text>
                </>
              ) : (
                <Section style={{ background: "#1a1200", border: "1px solid #f59e0b33", borderRadius: 10, padding: "14px 16px" }}>
                  <Text style={{ color: "#fbbf24", fontSize: 13, fontWeight: 600, margin: "0 0 4px" }}>
                    📬 Tracking number not yet assigned
                  </Text>
                  <Text style={{ color: "#9ca3af", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                    Your tracking number will be emailed to you <strong style={{ color: "#d1d5db" }}>5–8 days after dispatch</strong>, once the package has cleared customs and is scanned into the carrier network.
                  </Text>
                </Section>
              )}
            </Section>

            <Hr style={{ borderColor: "#1f1f1f", margin: 0 }} />

            {/* Items in this shipment */}
            {fulfillment_items.length > 0 && (
              <Section style={{ background: "#111111", padding: "20px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
                <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 14px" }}>
                  {is_partial ? "Items in this shipment" : "Your items"}
                </Text>
                {fulfillment_items.map((item, i) => (
                  <Row key={i} style={{ marginBottom: i < fulfillment_items.length - 1 ? 12 : 0, paddingBottom: i < fulfillment_items.length - 1 ? 12 : 0, borderBottom: i < fulfillment_items.length - 1 ? "1px solid #1f1f1f" : "none" }}>
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
            )}

            {/* Remaining items */}
            {is_partial && remaining_items.length > 0 && (
              <>
                <Hr style={{ borderColor: "#1f1f1f", margin: 0 }} />
                <Section style={{ background: "#111111", padding: "20px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
                  <Section style={{ background: "#1a1200", border: "1px solid #f59e0b33", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                    <Text style={{ color: "#fbbf24", fontSize: 12, fontWeight: 700, margin: "0 0 2px" }}>
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
                          ? <Img src={item.thumbnail} alt={item.product_title ?? ""} width="40" height="40" style={{ borderRadius: 6, background: "#1a1a1a", display: "block", opacity: 0.5 }} />
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

            {/* Delivery address */}
            {order.shipping_address && (
              <>
                <Hr style={{ borderColor: "#1f1f1f", margin: 0 }} />
                <Section style={{ background: "#111111", padding: "16px 24px", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
                  <Text style={{ color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 6px" }}>
                    Delivering to
                  </Text>
                  <Text style={{ color: "#9ca3af", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                    {order.shipping_address.first_name} {order.shipping_address.last_name},{" "}
                    {order.shipping_address.address_1},{" "}
                    {order.shipping_address.city}, {order.shipping_address.postal_code},{" "}
                    {(order.shipping_address.country_code ?? "").toUpperCase()}
                  </Text>
                </Section>
              </>
            )}

            {/* CTA */}
            <Section style={{ background: "#111111", padding: "20px 24px", textAlign: "center", borderLeft: "1px solid #1f1f1f", borderRight: "1px solid #1f1f1f" }}>
              <Link
                href={orderUrl}
                style={{ background: "#1f1f1f", color: "#9ca3af", textDecoration: "none", display: "inline-block", padding: "11px 28px", borderRadius: 8, fontSize: 13, border: "1px solid #2a2a2a" }}
              >
                View order details
              </Link>
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

export const orderShippedEmail = (props: OrderShippedEmailProps) => (
  <OrderShippedEmailComponent {...props} />
);

export default OrderShippedEmailComponent;
