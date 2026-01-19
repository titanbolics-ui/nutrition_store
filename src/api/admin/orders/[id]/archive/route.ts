import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const orderModuleService = req.scope.resolve(Modules.ORDER);

  try {
    const order = await orderModuleService.archive(id);

    res.status(200).json({
      order,
      message: "Order archived successfully",
    });
  } catch (error) {
    console.error("Error archiving order:", error);
    res.status(400).json({
      error: "Failed to archive order",
      message: error.message || "Unknown error occurred",
    });
  }
}
