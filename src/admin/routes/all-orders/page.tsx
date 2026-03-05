import { defineRouteConfig } from "@medusajs/admin-sdk";
import {
  Container,
  Heading,
  Button,
  Badge,
  Table,
  Input,
  Switch,
  Label,
} from "@medusajs/ui";
import { ShoppingCart, MagnifyingGlass } from "@medusajs/icons";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

export const config = defineRouteConfig({
  label: "All Orders",
  icon: ShoppingCart,
});

const paymentStatusColors = {
  not_paid: { color: "red", label: "Not Paid" },
  awaiting: { color: "orange", label: "Awaiting" },
  captured: { color: "green", label: "Paid" },
  authorized: { color: "orange", label: "Awaiting" },
  refunded: { color: "purple", label: "Refunded" },
  canceled: { color: "red", label: "Canceled" },
};

const fulfillmentStatusColors = {
  not_fulfilled: { color: "red", label: "Not Fulfilled" },
  partially_fulfilled: { color: "orange", label: "Partially" },
  fulfilled: { color: "green", label: "Fulfilled" },
  shipped: { color: "blue", label: "Shipped" },
  delivered: { color: "green", label: "Delivered" },
  canceled: { color: "red", label: "Canceled" },
};

const PAGE_SIZE = 25;

export default function CustomOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setOffset(0);
  }, [showArchived]);

  useEffect(() => {
    loadOrders();
  }, [showArchived, offset]);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      let url =
        `/admin/orders?fields=id,display_id,email,status,payment_status,fulfillment_status,total,currency_code,created_at,*customer,+customer.has_account,*fulfillments,fulfillments.labels.tracking_number,fulfillments.labels.tracking_url&order=-created_at&limit=${PAGE_SIZE}&offset=${offset}`;

      if (!showArchived) {
        url += "&status[]=pending&status[]=completed&status[]=canceled&status[]=draft";
      }

      const response = await fetch(url, {
        credentials: "include",
      });
      const data = await response.json();
      setOrders(data.orders || []);
      setTotalCount(data.count ?? data.orders?.length ?? 0);
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredOrders = orders.filter((order) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      order.display_id?.toString().includes(search) ||
      order.email?.toLowerCase().includes(search) ||
      order.customer?.email?.toLowerCase().includes(search) ||
      order.id?.toLowerCase().includes(search)
    );
  });

  if (isLoading) {
    return (
      <Container>
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ui-fg-base"></div>
            <p className="text-ui-fg-subtle">Loading orders...</p>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Container>
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading level="h1" className="text-2xl font-semibold">
              Orders
            </Heading>
            <p className="text-ui-fg-subtle mt-1">
              {searchTerm
                ? `${filteredOrders.length} of ${totalCount} orders`
                : `${totalCount} orders total`}
            </p>
          </div>
          <Button onClick={() => navigate("/orders/new")} variant="primary">
            New Order
          </Button>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-ui-fg-muted" />
            <Input
              placeholder="Search by order number, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <Label htmlFor="show-archived" className="cursor-pointer">
              Show Archived
            </Label>
          </div>
        </div>
      </Container>

      {filteredOrders.length === 0 ? (
        <Container>
          <div className="flex flex-col items-center justify-center h-96 gap-y-4">
            <ShoppingCart className="text-ui-fg-subtle" />
            <div className="text-center">
              <p className="text-ui-fg-base font-medium">
                No orders found
              </p>
              <p className="text-ui-fg-subtle text-sm">
                {searchTerm
                  ? "Try changing your search parameters"
                  : "Orders will appear here"}
              </p>
            </div>
          </div>
        </Container>
      ) : (
        <Container>
          <div className="overflow-x-auto">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Order</Table.HeaderCell>
                  <Table.HeaderCell>Date</Table.HeaderCell>
                  <Table.HeaderCell>Customer</Table.HeaderCell>
                  <Table.HeaderCell>Type</Table.HeaderCell>
                  <Table.HeaderCell>Payment</Table.HeaderCell>
                  <Table.HeaderCell>Fulfillment</Table.HeaderCell>
                  <Table.HeaderCell>Tracking</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Total</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredOrders.map((order) => (
                  <Table.Row
                    key={order.id}
                    className="cursor-pointer hover:bg-ui-bg-subtle-hover transition-colors"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <Table.Cell className="font-medium">
                      #{order.display_id}
                    </Table.Cell>
                    <Table.Cell className="text-ui-fg-subtle text-sm">
                      {formatDate(order.created_at)}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {order.customer?.email || order.email || "—"}
                        </span>
                        {order.customer?.first_name && (
                          <span className="text-xs text-ui-fg-subtle">
                            {order.customer.first_name}{" "}
                            {order.customer.last_name}
                          </span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        color={order.customer?.has_account ? "blue" : "grey"}
                        size="small"
                      >
                        {order.customer?.has_account ? "Registered" : "Guest"}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        color={
                          (paymentStatusColors as any)[order.payment_status]?.color ||
                          "grey"
                        }
                        size="small"
                      >
                        {(paymentStatusColors as any)[order.payment_status]?.label ||
                          order.payment_status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        color={
                          (fulfillmentStatusColors as any)[order.fulfillment_status]
                            ?.color || "grey"
                        }
                        size="small"
                      >
                        {(fulfillmentStatusColors as any)[order.fulfillment_status]
                          ?.label || order.fulfillment_status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {order.fulfillments?.flatMap?.((f: any) =>
                        f?.labels?.map?.((l: any) => l?.tracking_number) || []
                      ).filter(Boolean).join(", ") || "—"}
                    </Table.Cell>
                    <Table.Cell className="text-right font-medium">
                      {formatPrice(order.total, order.currency_code)}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
          {totalCount > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-ui-border-base">
              <p className="text-sm text-ui-fg-subtle">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="small"
                  disabled={offset === 0}
                  onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  disabled={offset + PAGE_SIZE >= totalCount}
                  onClick={() => setOffset((o) => o + PAGE_SIZE)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Container>
      )}
    </div>
  );
}

