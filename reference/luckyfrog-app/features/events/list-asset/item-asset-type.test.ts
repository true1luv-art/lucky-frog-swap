import { describe, it, expect } from "vitest";
import { getItemAssetType } from "./item-asset-type";

describe("getItemAssetType", () => {
  it("identifies seeds correctly", () => {
    expect(getItemAssetType("Potato Seed")).toBe("seed");
    expect(getItemAssetType("Carrot Seed")).toBe("seed");
  });

  it("identifies food items correctly", () => {
    expect(getItemAssetType("Potato")).toBe("food");
    expect(getItemAssetType("Egg")).toBe("food");
    expect(getItemAssetType("Milk")).toBe("food");
  });

  it("identifies fish correctly", () => {
    expect(getItemAssetType("Salmon")).toBe("fish");
    expect(getItemAssetType("Tuna")).toBe("fish");
    expect(getItemAssetType("Octopus")).toBe("fish");
  });

  it("identifies resources correctly", () => {
    expect(getItemAssetType("Wood")).toBe("resource");
    expect(getItemAssetType("Stone")).toBe("resource");
    expect(getItemAssetType("Iron Ore")).toBe("resource");
    expect(getItemAssetType("Gold Ore")).toBe("resource");
    expect(getItemAssetType("Wool")).toBe("resource");
  });

  it("identifies crafting materials correctly", () => {
    expect(getItemAssetType("Stone Block")).toBe("crafting_material");
    expect(getItemAssetType("Refined Wood")).toBe("crafting_material");
  });

  it("defaults unknown items to resource", () => {
    expect(getItemAssetType("Unknown Item XYZ")).toBe("resource");
    expect(getItemAssetType("")).toBe("resource");
  });
});
