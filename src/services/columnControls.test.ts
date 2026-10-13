import { describe, expect, it } from "vitest";
import type { Patient } from "./dischargeService";
import {
  applyColumnFiltersLocally,
  applyManualColumnSort,
  buildColumnFilterExpression,
  buildColumnFiltersOData,
  columnControlDefinitions,
} from "./columnControls";

describe("column filter Dataverse expressions", () => {
  it("combines independent column filters with AND", () => {
    expect(
      buildColumnFiltersOData({
        patientName: { operator: "contains", value: "Ahmed" },
        physician: { operator: "beginsWith", value: "Mohamed" },
        status: { operator: "equals", values: ["408520001", "408520002"] },
      }),
    ).toBe(
      "(contains(crad2_patientname, 'Ahmed')) and (startswith(crad2_doctorname, 'Mohamed')) and ((crad2_status eq 408520001 or crad2_status eq 408520002))",
    );
  });

  it("escapes text and builds numeric filters against raw values", () => {
    expect(
      buildColumnFilterExpression(columnControlDefinitions.patientName, {
        operator: "equals",
        value: "O'Brien",
      }),
    ).toBe("crad2_patientname eq 'O''Brien'");
    expect(
      buildColumnFilterExpression(
        columnControlDefinitions.currentDischargeTAT,
        { operator: "greaterThan", value: "120" },
      ),
    ).toBe("cr301_currentdischargetat gt 120");
  });

  it("translates relative and selected dates into bounded UTC ranges", () => {
    const now = new Date("2026-10-11T10:30:00Z");
    expect(
      buildColumnFilterExpression(
        columnControlDefinitions.lastActivity,
        { operator: "nextHours", value: "2" },
        now,
      ),
    ).toBe(
      "new_lastactivity ge 2026-10-11T10:30:00.000Z and new_lastactivity lt 2026-10-11T12:30:00.000Z",
    );
    expect(
      buildColumnFilterExpression(
        columnControlDefinitions.lastActivity,
        { operator: "onOrAfter", value: "2026-10-01" },
        now,
      ),
    ).toContain("new_lastactivity ge ");
  });
});

describe("manual column sorting", () => {
  const rows = [
    {
      crad2_patientdischargeid: "two-hours",
      cr301_currentdischargetat: 120,
      crad2_patientname: "Zain",
    },
    {
      crad2_patientdischargeid: "twelve-hours",
      cr301_currentdischargetat: 720,
      crad2_patientname: "Ahmed",
    },
  ] as Patient[];

  it("does not alter the existing order without a manual sort", () => {
    expect(applyManualColumnSort(rows, null)).toBe(rows);
  });

  it("sorts durations numerically and text case-insensitively", () => {
    expect(
      applyManualColumnSort(rows, {
        key: "currentDischargeTAT",
        direction: "desc",
      }).map((row) => row.crad2_patientdischargeid),
    ).toEqual(["twelve-hours", "two-hours"]);
    expect(
      applyManualColumnSort(rows, {
        key: "patientName",
        direction: "asc",
      }).map((row) => row.crad2_patientdischargeid),
    ).toEqual(["twelve-hours", "two-hours"]);
  });
});

describe("immediate local column filtering", () => {
  const rows = [
    {
      crad2_patientdischargeid: "one",
      crad2_patientname: "Ahmed Ali",
      cr301_currentdischargetat: 90,
      new_lastactivity: "2026-10-11T09:00:00Z",
    },
    {
      crad2_patientdischargeid: "two",
      crad2_patientname: "Mona Hassan",
      cr301_currentdischargetat: 200,
      new_lastactivity: "2026-10-10T09:00:00Z",
    },
  ] as Patient[];

  it("combines text and numeric filters against loaded rows", () => {
    expect(
      applyColumnFiltersLocally(rows, {
        patientName: { operator: "contains", value: "AHMED" },
        currentDischargeTAT: { operator: "lessThan", value: "100" },
      }).map((row) => row.crad2_patientdischargeid),
    ).toEqual(["one"]);
  });

  it("matches relative dates using the same date range logic", () => {
    expect(
      applyColumnFiltersLocally(
        rows,
        { lastActivity: { operator: "lastHours", value: "3" } },
        new Date("2026-10-11T10:00:00Z"),
      ).map((row) => row.crad2_patientdischargeid),
    ).toEqual(["one"]);
  });
});
