import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Button, toast, usePrompt } from "@medusajs/ui";
import { Trash, ArchiveBox } from "@medusajs/icons";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const OrderDeleteWidget = ({ data }: any) => {
  const navigate = useNavigate();
  const prompt = usePrompt();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  // Can only archive completed and canceled orders
  const canArchive = ["completed", "canceled"].includes(data.status);

  const handleArchive = async () => {
    const confirmed = await prompt({
      title: "Archive Order?",
      description: `Order #${data.display_id} will be moved to archive. You can find it later.`,
      confirmText: "Yes, archive",
      cancelText: "Cancel",
    });

    if (!confirmed) {
      return;
    }

    setIsArchiving(true);

    try {
      const response = await fetch(`/admin/orders/${data.id}/archive`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to archive order");
      }

      toast.success("Order archived", {
        description: `Order #${data.display_id} moved to archive`,
      });

      // Reload the page to show updated status
      window.location.reload();
    } catch (error: any) {
      console.error("Archive order error:", error);
      toast.error("Error", {
        description: error?.message || "Failed to archive order",
      });
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: "Delete Order?",
      description: `This action cannot be undone. Order #${data.display_id} will be permanently deleted.`,
      confirmText: "Yes, delete",
      cancelText: "Cancel",
    });

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/admin/orders/${data.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete order");
      }

      toast.success("Order deleted", {
        description: `Order #${data.display_id} successfully deleted`,
      });
      navigate("/orders");
    } catch (error: any) {
      console.error("Delete order error:", error);
      toast.error("Error", {
        description: error?.message || "Failed to delete order",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <Heading level="h2">Danger Zone</Heading>
          <p className="text-ui-fg-subtle text-sm">
            Archive order for storage or delete it permanently
          </p>
          <p className="text-ui-fg-muted text-xs mt-1">
            Status: <span className="font-medium">{data.status}</span>
            {!canArchive && (
              <span className="text-ui-fg-subtle">
                {" "}
                (Can only archive completed and canceled orders)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="base"
            onClick={handleArchive}
            isLoading={isArchiving}
            disabled={isDeleting || !canArchive}
          >
            <ArchiveBox />
            Archive
          </Button>
          <Button
            variant="danger"
            size="base"
            onClick={handleDelete}
            isLoading={isDeleting}
            disabled={isArchiving}
          >
            <Trash />
            Delete
          </Button>
        </div>
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "order.details.after",
});

export default OrderDeleteWidget;
