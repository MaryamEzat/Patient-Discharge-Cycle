import { expect, it } from "vitest";
import {
  DELAYED_EGYPT_FILTER,
  columnFilterForView,
  filterPatients,
  isDelayedEgyptPatient,
  mergeAndSortPatients,
  sortDelayedPatients,
  type Filters,
  type Patient,
} from "./dischargeService";
import { formatDuration } from "../presentation/format";

const filters: Filters = {
  search: "",
  status: "",
  dischargeDate: "",
  businessUnit: "2",
  unit: "",
  dischargeType: "",
  dateFrom: "",
  dateTo: "",
};

it("filters Egypt business units by the Patient Discharge Entity ID", () => {
  const rows = [
    { crad2_patientdischargeid: "ash", new_entityid: "1" },
    { crad2_patientdischargeid: "smh", new_entityid: "2" },
    { crad2_patientdischargeid: "amh", new_entityid: "4" },
  ] as Patient[];

  expect(
    filterPatients(rows, filters).map((row) => row.crad2_patientdischargeid),
  ).toEqual(["smh"]);
  expect(filterPatients(rows, { ...filters, businessUnit: "" })).toHaveLength(
    3,
  );
});

it("uses the stored Current Discharge TAT and Egypt Entity IDs", () => {
  expect(DELAYED_EGYPT_FILTER).toBe(
    "cr301_currentdischargetat gt 120 and (new_entityid eq '1' or new_entityid eq '2' or new_entityid eq '4')",
  );
  expect(
    isDelayedEgyptPatient({
      new_entityid: "4",
      cr301_currentdischargetat: 121,
      crad2_status: 408520002,
    } as Patient),
  ).toBe(true);
  expect(
    isDelayedEgyptPatient({
      new_entityid: "102",
      cr301_currentdischargetat: 526909,
    } as Patient),
  ).toBe(false);
});

it("keeps the Delayed Cases base criteria when adding a column filter", () => {
  expect(
    columnFilterForView(
      "delayed",
      "cr301_longeststep eq 'Financial Discharge'",
    ),
  ).toBe(
    `(${DELAYED_EGYPT_FILTER}) and (cr301_longeststep eq 'Financial Discharge')`,
  );
  expect(columnFilterForView("all", "crad2_patientname ne null")).toBe(
    "crad2_patientname ne null",
  );
});

it("formats stored minute durations for display", () => {
  expect(formatDuration(45)).toBe("45m");
  expect(formatDuration(125)).toBe("2h 5m");
  expect(formatDuration(1771)).toBe("1d 5h 31m");
  expect(formatDuration(6425)).toBe("4d 11h 5m");
  expect(formatDuration(0)).toBe("0m");
  expect(formatDuration(undefined)).toBe("-");
  expect(formatDuration("invalid")).toBe("-");
});

it("sorts delayed durations numerically from highest to lowest", () => {
  const rows = [
    { crad2_patientdischargeid: "nine-hours", cr301_currentdischargetat: 540 },
    { crad2_patientdischargeid: "ten-hours", cr301_currentdischargetat: 600 },
  ] as Patient[];
  expect(
    sortDelayedPatients(rows).map((row) => row.crad2_patientdischargeid),
  ).toEqual(["ten-hours", "nine-hours"]);
});

it("deduplicates and sorts the normal worklist by Last Activity descending", () => {
  const rows = mergeAndSortPatients(
    [
      {
        crad2_patientdischargeid: "active",
        new_lastactivity: "2026-10-01T10:00:00Z",
        modifiedon: "2026-10-01T10:00:00Z",
        versionnumber: 1,
      },
      {
        crad2_patientdischargeid: "newer-created",
        new_lastactivity: "2026-10-01T09:00:00Z",
        createdon: "2026-10-11T10:00:00Z",
      },
    ] as Patient[],
    [
      {
        crad2_patientdischargeid: "active",
        new_lastactivity: "2026-10-01T12:00:00Z",
        modifiedon: "2026-10-01T12:00:00Z",
        versionnumber: 2,
      },
    ] as Patient[],
  );

  expect(rows.map((row) => row.crad2_patientdischargeid)).toEqual([
    "active",
    "newer-created",
  ]);
  expect(rows[0].versionnumber).toBe(2);
});

it("filters delayed cases by unit, type, status, and physician date range", () => {
  const rows = [
    {
      crad2_patientdischargeid: "match",
      new_entityid: "2",
      new_nursestation: "8th-Nurse Station",
      and_dischargetype: "IPD",
      crad2_status: 408520002,
      and_physiciandischargedate: "2026-10-03T10:00:00Z",
    },
    {
      crad2_patientdischargeid: "outside",
      new_entityid: "2",
      new_nursestation: "7th-Nurse Station",
      and_dischargetype: "IPD",
      crad2_status: 408520002,
      and_physiciandischargedate: "2026-09-20T10:00:00Z",
    },
  ] as Patient[];
  const result = filterPatients(rows, {
    ...filters,
    businessUnit: "",
    unit: "8th-Nurse Station",
    dischargeType: "IPD",
    status: "408520002",
    dateFrom: "2026-10-01",
    dateTo: "2026-10-05",
  });
  expect(result.map((row) => row.crad2_patientdischargeid)).toEqual(["match"]);
});
