import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Button, Badge, Table } from "@medusajs/ui";
import { ArchiveBox } from "@medusajs/icons";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { sdk } from "../../lib/sdk";

export const config = defineRouteConfig({
  label: "Archived Orders",
  icon: ArchiveBox,
});

export default function ArchivedOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadArchivedOrders();
  }, []);

  const loadArchivedOrders = async () => {
    setIsLoading(true);
    try {
      // Fetch orders with archived status
      const response = await fetch(
        "/admin/orders?status=archived&fields=id,display_id,email,status,total,currency_code,created_at,*customer",
        {
          credentials: "include",
        }
      );
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error("Error loading archived orders:", error);
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
    });
  };

  if (isLoading) {
    return (
      <Container>
          <div className="flex items-center justify-center h-96">
            <p className="text-ui-fg-subtle">Loading...</p>
          </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="flex flex-col gap-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h1">Archived Orders</Heading>
            <p className="text-ui-fg-subtle mt-1">
              Total: {orders.length} orders
            </p>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 gap-y-4">
            <ArchiveBox className="text-ui-fg-subtle" size={48} />
            <div className="text-center">
              <p className="text-ui-fg-base font-medium">
                No archived orders
              </p>
              <p className="text-ui-fg-subtle text-sm">
                Archived orders will appear here
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Order</Table.HeaderCell>
                  <Table.HeaderCell>Date</Table.HeaderCell>
                  <Table.HeaderCell>Customer</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Total</Table.HeaderCell>
                  <Table.HeaderCell></Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {orders.map((order) => (
                  <Table.Row
                    key={order.id}
                    className="cursor-pointer hover:bg-ui-bg-subtle"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <Table.Cell>#{order.display_id}</Table.Cell>
                    <Table.Cell>{formatDate(order.created_at)}</Table.Cell>
                    <Table.Cell>
                      {order.customer?.email || order.email || "—"}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color="grey">Archived</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {formatPrice(order.total, order.currency_code)}
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        variant="transparent"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/orders/${order.id}`);
                        }}
                      >
                        View
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )}
      </div>
    </Container>
  );
}

