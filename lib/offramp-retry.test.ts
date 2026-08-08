import { describe, expect, it, vi } from "vitest"
import { getOrCreateOfframpOrder } from "./offramp-retry"

describe("off-ramp verification retries", () => {
  it("does not initialize another provider order after funding requests verification", async () => {
    const existingOrder = { orderId: "paycrest-order-1" }
    const createOrder = vi.fn(async () => ({ orderId: "duplicate-order" }))

    const result = await getOrCreateOfframpOrder(existingOrder, createOrder)

    expect(result).toBe(existingOrder)
    expect(createOrder).not.toHaveBeenCalled()
  })

  it("initializes the provider once when no order exists", async () => {
    const createdOrder = { orderId: "paycrest-order-1" }
    const createOrder = vi.fn(async () => createdOrder)

    await expect(getOrCreateOfframpOrder(null, createOrder)).resolves.toBe(
      createdOrder,
    )
    expect(createOrder).toHaveBeenCalledTimes(1)
  })
})
