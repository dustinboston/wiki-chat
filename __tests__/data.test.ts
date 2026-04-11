import { describe, it, expect } from "vitest";
import {
  getOrders,
  getTrackingInformation,
  ORDERS,
  TRACKING_INFORMATION,
} from "@/components/data";

describe("getOrders", () => {
  it("returns the full ORDERS array", () => {
    const result = getOrders();
    expect(result).toBe(ORDERS);
    expect(result).toHaveLength(3);
  });

  it("contains orders with expected shape", () => {
    const orders = getOrders();
    for (const order of orders) {
      expect(order).toHaveProperty("id");
      expect(order).toHaveProperty("name");
      expect(order).toHaveProperty("orderedAt");
      expect(order).toHaveProperty("image");
    }
  });
});

describe("getTrackingInformation", () => {
  it("returns tracking info for a known orderId", () => {
    const info = getTrackingInformation({ orderId: "539182" });
    expect(info).toEqual(TRACKING_INFORMATION[2]);
    expect(info?.progress).toBe("Delivered");
  });

  it("returns undefined for an unknown orderId", () => {
    const info = getTrackingInformation({ orderId: "000000" });
    expect(info).toBeUndefined();
  });

  it("finds each tracking entry by its orderId", () => {
    for (const entry of TRACKING_INFORMATION) {
      const result = getTrackingInformation({ orderId: entry.orderId });
      expect(result).toBe(entry);
    }
  });
});
