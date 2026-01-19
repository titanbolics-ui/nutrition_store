import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params;
  const orderModuleService = req.scope.resolve(Modules.ORDER);

  await orderModuleService.deleteOrders([id]);

  res.status(200).json({
    id,
    object: "order",
    deleted: true,
  });
}

