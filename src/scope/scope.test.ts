import { describe, expect, it } from "vitest";
import {
  egyptBusinessUnitFromEntityId,
  isScope,
  recordMatchesScope,
  recordsForScope,
  scopeFromBusinessUnit,
} from "./scope";

describe("country scope", () => {
  it("accepts only the fixed stored values", () => {
    expect(isScope("Egypt")).toBe(true);
    expect(isScope("Saudi Arabia")).toBe(true);
    expect(isScope("KSA")).toBe(false);
    expect(isScope("egypt")).toBe(false);
    expect(isScope(null)).toBe(false);
  });

  it("maps only AHJ to Saudi Arabia and every other BU to Egypt", () => {
    expect(scopeFromBusinessUnit("AHJ")).toBe("Saudi Arabia");
    expect(scopeFromBusinessUnit(" ahj ")).toBe("Saudi Arabia");
    expect(scopeFromBusinessUnit("Cairo")).toBe("Egypt");
    expect(scopeFromBusinessUnit("")).toBe("Egypt");
  });

  it("uses the Dataverse formatted business-unit name to scope records", () => {
    const rows = [
      {
        id: "ksa",
        "_owningbusinessunit_value@OData.Community.Display.V1.FormattedValue": "AHJ",
      },
      {
        id: "egypt",
        "_owningbusinessunit_value@OData.Community.Display.V1.FormattedValue": "Cairo",
      },
    ];
    expect(recordMatchesScope(rows[0], "Saudi Arabia")).toBe(true);
    expect(recordsForScope(rows, "Egypt").map((row) => row.id)).toEqual(["egypt"]);
  });

  it("maps Egypt Entity IDs to their business units", () => {
    expect(egyptBusinessUnitFromEntityId("1")).toBe("ASH");
    expect(egyptBusinessUnitFromEntityId(2)).toBe("SMH");
    expect(egyptBusinessUnitFromEntityId(" 4 ")).toBe("AMH");
    expect(egyptBusinessUnitFromEntityId("9")).toBe("");
  });
});
