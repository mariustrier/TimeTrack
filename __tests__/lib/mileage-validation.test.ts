import { describe, it, expect } from "vitest";
import { createTimeEntrySchema, updateTimeEntrySchema, calculateDistanceSchema } from "@/lib/schemas";

describe("mileage fields in createTimeEntrySchema", () => {
  const baseEntry = {
    hours: 8,
    date: "2026-02-03",
    projectId: "proj123",
    comment: "Work done",
  };

  it("accepts valid mileage data", () => {
    const result = createTimeEntrySchema.safeParse({
      ...baseEntry,
      mileageKm: 45.5,
      mileageStartAddress: "Copenhagen",
      mileageEndAddress: "Aarhus",
      mileageSource: "calculated",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mileageKm).toBe(45.5);
      expect(result.data.mileageSource).toBe("calculated");
    }
  });

  it("accepts entry without mileage", () => {
    const result = createTimeEntrySchema.safeParse(baseEntry);
    expect(result.success).toBe(true);
  });

  it("accepts null mileage values", () => {
    const result = createTimeEntrySchema.safeParse({
      ...baseEntry,
      mileageKm: null,
      mileageStartAddress: null,
      mileageEndAddress: null,
      mileageSource: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts decimal mileage values", () => {
    const result = createTimeEntrySchema.safeParse({
      ...baseEntry,
      mileageKm: 12.5,
      mileageSource: "manual",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mileageKm).toBe(12.5);
    }
  });

  it("accepts zero mileage", () => {
    const result = createTimeEntrySchema.safeParse({
      ...baseEntry,
      mileageKm: 0,
      mileageSource: "manual",
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative mileage", () => {
    const result = createTimeEntrySchema.safeParse({
      ...baseEntry,
      mileageKm: -10,
      mileageSource: "manual",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mileage over 9999", () => {
    const result = createTimeEntrySchema.safeParse({
      ...baseEntry,
      mileageKm: 10000,
      mileageSource: "manual",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid mileage source", () => {
    const result = createTimeEntrySchema.safeParse({
      ...baseEntry,
      mileageKm: 50,
      mileageSource: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects address over 500 characters", () => {
    const longAddress = "A".repeat(501);
    const result = createTimeEntrySchema.safeParse({
      ...baseEntry,
      mileageKm: 50,
      mileageStartAddress: longAddress,
      mileageSource: "manual",
    });
    expect(result.success).toBe(false);
  });
});

describe("mileage fields in updateTimeEntrySchema", () => {
  it("accepts mileage update", () => {
    const result = updateTimeEntrySchema.safeParse({
      mileageKm: 100.5,
      mileageSource: "manual",
    });
    expect(result.success).toBe(true);
  });

  it("accepts clearing mileage with null", () => {
    const result = updateTimeEntrySchema.safeParse({
      mileageKm: null,
      mileageStartAddress: null,
      mileageEndAddress: null,
      mileageSource: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("calculateDistanceSchema", () => {
  it("accepts valid addresses", () => {
    const result = calculateDistanceSchema.safeParse({
      startAddress: "Copenhagen Central Station",
      endAddress: "Aarhus Town Hall",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty start address", () => {
    const result = calculateDistanceSchema.safeParse({
      startAddress: "",
      endAddress: "Aarhus",
    });
    expect(result.success).toBe(false);
  });

  it("rejects address shorter than 3 characters", () => {
    const result = calculateDistanceSchema.safeParse({
      startAddress: "AB",
      endAddress: "Aarhus",
    });
    expect(result.success).toBe(false);
  });

  it("rejects address over 500 characters", () => {
    const longAddress = "A".repeat(501);
    const result = calculateDistanceSchema.safeParse({
      startAddress: longAddress,
      endAddress: "Aarhus",
    });
    expect(result.success).toBe(false);
  });

  it("requires both addresses", () => {
    const result = calculateDistanceSchema.safeParse({
      startAddress: "Copenhagen",
    });
    expect(result.success).toBe(false);
  });
});
