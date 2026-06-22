import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

// Mock the EasyPost HTTP client + the delivery workflow; keep resolveCarrier real.
jest.mock("../easypost-client", () => ({
  isConfigured: jest.fn(() => true),
  createTracker: jest.fn(),
}))
const runMock = jest.fn().mockResolvedValue({})
jest.mock("@medusajs/core-flows", () => ({
  markOrderFulfillmentAsDeliveredWorkflow: jest.fn(() => ({ run: runMock })),
}))

import { createTracker, isConfigured } from "../easypost-client"
import { markOrderFulfillmentAsDeliveredWorkflow } from "@medusajs/core-flows"
import {
  registerTrackerForFulfillment,
  markDeliveredByTrackingNumber,
} from "../easypost-tracker"

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

function makeContainer(graphData: any[], updateFulfillment = jest.fn()) {
  const query = { graph: jest.fn().mockResolvedValue({ data: graphData }) }
  const fulfillmentModule = { updateFulfillment }
  const container: any = {
    resolve: (key: string) => {
      if (key === ContainerRegistrationKeys.LOGGER) return logger
      if (key === ContainerRegistrationKeys.QUERY) return query
      if (key === Modules.FULFILLMENT) return fulfillmentModule
      return undefined
    },
  }
  return { container, query, updateFulfillment }
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(isConfigured as jest.Mock).mockReturnValue(true)
})

describe("registerTrackerForFulfillment", () => {
  it("registers once with the explicitly resolved carrier (USPS)", async () => {
    ;(createTracker as jest.Mock).mockResolvedValue({ id: "trk_1" })
    const { container, updateFulfillment } = makeContainer([
      {
        id: "ful_1",
        metadata: {},
        labels: [{ tracking_number: "9205590327908752271203" }],
        order: { display_id: 42 },
      },
    ])

    await registerTrackerForFulfillment(container, "ful_1")

    expect(createTracker).toHaveBeenCalledTimes(1)
    expect(createTracker).toHaveBeenCalledWith("9205590327908752271203", "USPS")
    expect(updateFulfillment).toHaveBeenCalledWith("ful_1", {
      metadata: { easypost_tracker_id: "trk_1", easypost_carrier: "USPS" },
    })
  })

  it("flags carrier_unresolved and does NOT register when the carrier is unknown", async () => {
    const { container, updateFulfillment } = makeContainer([
      {
        id: "ful_2",
        metadata: { foo: "bar" },
        labels: [{ tracking_number: "1Z999AA10123456784" }],
        order: { display_id: 7 },
      },
    ])

    await registerTrackerForFulfillment(container, "ful_2")

    expect(createTracker).not.toHaveBeenCalled()
    expect(updateFulfillment).toHaveBeenCalledWith("ful_2", {
      metadata: { foo: "bar", carrier_unresolved: true },
    })
  })

  it("is idempotent — skips when a tracker id is already stored", async () => {
    const { container, updateFulfillment } = makeContainer([
      {
        id: "ful_3",
        metadata: { easypost_tracker_id: "trk_existing" },
        labels: [{ tracking_number: "9205590327908752271203" }],
        order: { display_id: 1 },
      },
    ])

    await registerTrackerForFulfillment(container, "ful_3")

    expect(createTracker).not.toHaveBeenCalled()
    expect(updateFulfillment).not.toHaveBeenCalled()
  })

  it("uses the explicit tracking-number override (admin manual entry)", async () => {
    ;(createTracker as jest.Mock).mockResolvedValue({ id: "trk_9" })
    const { container } = makeContainer([
      { id: "ful_4", metadata: {}, labels: [], order: { display_id: 9 } },
    ])

    await registerTrackerForFulfillment(container, "ful_4", "9205590327908752271197")

    expect(createTracker).toHaveBeenCalledWith("9205590327908752271197", "USPS")
  })

  it("flags GoFo as carrier_unresolved (CirroECommerce blocked until verified)", async () => {
    const { container, updateFulfillment } = makeContainer([
      {
        id: "ful_5",
        metadata: {},
        labels: [{ tracking_number: "CR010177799525" }],
        order: { display_id: 5 },
      },
    ])

    await registerTrackerForFulfillment(container, "ful_5")

    expect(createTracker).not.toHaveBeenCalled()
    expect(updateFulfillment).toHaveBeenCalledWith("ful_5", {
      metadata: { carrier_unresolved: true },
    })
  })

  it("does nothing when EasyPost is not configured", async () => {
    ;(isConfigured as jest.Mock).mockReturnValue(false)
    const { container, query } = makeContainer([])

    await registerTrackerForFulfillment(container, "ful_x")

    expect(query.graph).not.toHaveBeenCalled()
    expect(createTracker).not.toHaveBeenCalled()
  })
})

describe("markDeliveredByTrackingNumber", () => {
  it("runs the delivery workflow once for a shipped, undelivered fulfillment", async () => {
    const { container } = makeContainer([
      {
        id: "ful_1",
        shipped_at: new Date(),
        delivered_at: null,
        canceled_at: null,
        labels: [{ tracking_number: "9205590327908752271203" }],
        order: { id: "order_1", display_id: 42 },
      },
    ])

    await markDeliveredByTrackingNumber(container, "9205590327908752271203")

    expect(markOrderFulfillmentAsDeliveredWorkflow).toHaveBeenCalledTimes(1)
    expect(runMock).toHaveBeenCalledWith({
      input: { orderId: "order_1", fulfillmentId: "ful_1" },
    })
  })

  it("is a no-op on replay when already delivered", async () => {
    const { container } = makeContainer([
      {
        id: "ful_1",
        shipped_at: new Date(),
        delivered_at: new Date(),
        canceled_at: null,
        labels: [{ tracking_number: "9205590327908752271203" }],
        order: { id: "order_1", display_id: 42 },
      },
    ])

    await markDeliveredByTrackingNumber(container, "9205590327908752271203")

    expect(runMock).not.toHaveBeenCalled()
  })

  it("is a no-op when no fulfillment matches the tracking code", async () => {
    const { container } = makeContainer([
      {
        id: "ful_1",
        shipped_at: new Date(),
        delivered_at: null,
        canceled_at: null,
        labels: [{ tracking_number: "9999999999999999999999" }],
        order: { id: "order_1", display_id: 42 },
      },
    ])

    await markDeliveredByTrackingNumber(container, "9205590327908752271203")

    expect(runMock).not.toHaveBeenCalled()
  })
})
