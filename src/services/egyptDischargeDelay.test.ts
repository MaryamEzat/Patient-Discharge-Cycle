import { describe, expect, it } from "vitest";
import { isDelayedEgyptPatient, type Patient } from "./dischargeService";
import {
  buildActivityPayload,
  type Activity,
  type ActivityInput,
} from "./activityService";
import {
  egyptDischargeDelayState,
  physicalDischargeDelayReason,
} from "./egyptDischargeDelay";

const patient = (
  dischargeType: string,
  entityId = "1",
  status = 408520001,
) =>
  ({
    crad2_patientdischargeid: "11111111-1111-1111-1111-111111111111",
    crad2_dischargereference: "REF-1",
    new_entityid: entityId,
    and_dischargetype: dischargeType,
    crad2_dischargedate: "2026-10-22T00:00:00+03:00",
    crad2_status: status,
  }) as Patient;

const cairoTime = (hour: number, minute: number) =>
  new Date(`2026-10-22T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+03:00`);

describe("Egypt discharge delay thresholds", () => {
  it.each([
    [9, 59, false, false],
    [10, 0, true, false],
    [12, 29, true, false],
    [12, 30, true, true],
    [15, 0, true, true],
  ])(
    "classifies Early at %d:%d",
    (hour, minute, clinical, physical) => {
      expect(egyptDischargeDelayState(patient("Early"), cairoTime(hour, minute))).toMatchObject({
        isClinicalDischargeDelayed: clinical,
        isPhysicalDischargeDelayReasonRequired: physical,
      });
    },
  );

  it.each(["1", "2", "4"])(
    "applies to Egypt Entity ID %s",
    (entityId) => {
      expect(
        egyptDischargeDelayState(
          patient("Early", entityId),
          cairoTime(12, 30),
        ).isPhysicalDischargeDelayReasonRequired,
      ).toBe(true);
    },
  );

  it.each([
    [15, 59, false, false],
    [16, 0, true, false],
    [17, 59, true, false],
    [18, 0, true, true],
    [21, 0, true, true],
  ])(
    "classifies Planned at %d:%d",
    (hour, minute, clinical, physical) => {
      expect(egyptDischargeDelayState(patient("2"), cairoTime(hour, minute))).toMatchObject({
        isClinicalDischargeDelayed: clinical,
        isPhysicalDischargeDelayReasonRequired: physical,
      });
    },
  );

  it.each([
    ["102", 408520001, "Early"],
    ["1", 408520002, "Early"],
    ["2", 749510001, "Planned"],
    ["4", 408520001, ""],
  ])(
    "does not classify inapplicable or incomplete data",
    (entityId, status, type) => {
      expect(
        egyptDischargeDelayState(
          patient(type, entityId, Number(status)),
          cairoTime(20, 0),
        ),
      ).toMatchObject({
        isClinicalDischargeDelayed: false,
        isPhysicalDischargeDelayReasonRequired: false,
      });
    },
  );

  it("uses the full applicable date instead of the clock alone", () => {
    const future = {
      ...patient("Early"),
      crad2_dischargedate: "2026-10-23T00:00:00+03:00",
    };
    expect(
      egyptDischargeDelayState(future, cairoTime(20, 0))
        .isClinicalDischargeDelayed,
    ).toBe(false);
  });

  it("keeps an earlier day's case delayed before today's threshold", () => {
    const yesterday = {
      ...patient("Early"),
      crad2_dischargedate: "2026-10-21T00:00:00+03:00",
    };
    expect(egyptDischargeDelayState(yesterday, cairoTime(9, 0))).toMatchObject({
      isClinicalDischargeDelayed: true,
      isPhysicalDischargeDelayReasonRequired: true,
    });
  });

  it("dates the case from the corrected physician discharge date", () => {
    // 22:30 Cairo on 22 Oct; the raw column holds that wall-clock time as UTC.
    const lateEvening = {
      ...patient("Early"),
      crad2_dischargedate: "2026-10-22T22:30:00Z",
      and_physiciandischargedate: "2026-10-22T19:30:00Z",
    };
    expect(
      egyptDischargeDelayState(
        lateEvening,
        new Date("2026-10-23T08:00:00+03:00"),
      ).isPhysicalDischargeDelayReasonRequired,
    ).toBe(true);
  });

  it("converts UTC to Cairo time outside daylight saving", () => {
    const winter = {
      ...patient("Early"),
      crad2_dischargedate: undefined,
      and_physiciandischargedate: "2026-12-14T22:30:00Z", // 00:30 Cairo, 15 Dec
    };
    const state = (utc: string) => egyptDischargeDelayState(winter, new Date(utc));
    expect(state("2026-12-15T07:59:00Z")).toMatchObject({
      isClinicalDischargeDelayed: false,
      isPhysicalDischargeDelayReasonRequired: false,
    });
    expect(state("2026-12-15T08:00:00Z")).toMatchObject({
      isClinicalDischargeDelayed: true,
      isPhysicalDischargeDelayReasonRequired: false,
    });
    expect(state("2026-12-15T10:30:00Z").isPhysicalDischargeDelayReasonRequired).toBe(true);
  });

  describe.each([
    ["daylight saving (UTC+3)", "2026-07-15", 3],
    ["standard time (UTC+2)", "2026-12-15", 2],
  ])("in Egypt %s", (_period, day, offset) => {
    // Builds the true UTC instant for a Cairo wall-clock time on `day`.
    const utc = (hour: number, minute: number) =>
      new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8), hour - offset, minute));
    const onDay = (type: string) => ({
      ...patient(type),
      crad2_dischargedate: undefined,
      and_physiciandischargedate: utc(8, 0).toISOString(),
    });

    it.each([
      ["Early", 9, 59, false, false],
      ["Early", 10, 0, true, false],
      ["Early", 12, 29, true, false],
      ["Early", 12, 30, true, true],
      ["Planned", 15, 59, false, false],
      ["Planned", 16, 0, true, false],
      ["Planned", 17, 59, true, false],
      ["Planned", 18, 0, true, true],
    ])("%s at %d:%d Cairo", (type, hour, minute, clinical, required) => {
      expect(egyptDischargeDelayState(onDay(type), utc(hour, minute))).toMatchObject({
        isClinicalDischargeDelayed: clinical,
        isPhysicalDischargeDelayReasonRequired: required,
      });
    });
  });

  it.each(["", "Normal", "Other", "3"])(
    "leaves unclassified discharge type %j out of the delay rules",
    (type) => {
      expect(egyptDischargeDelayState(patient(type), cairoTime(23, 0))).toMatchObject({
        dischargeType: null,
        isClinicalDischargeDelayed: false,
        isPhysicalDischargeDelayReasonRequired: false,
      });
    },
  );

  it.each([
    [408520000, true],
    [408520001, true],
    [408520002, false],
    [749510001, false],
    [749510002, false],
  ])("keeps status %d in the Nursing delay queue: %s", (status, expected) => {
    expect(isDelayedEgyptPatient(patient("Early", "1", status), cairoTime(11, 0))).toBe(expected);
  });

  it("never applies the Egypt rules to AHJ", () => {
    expect(isDelayedEgyptPatient(patient("Planned", "102"), cairoTime(23, 0))).toBe(false);
  });
});

describe("Physical Discharge completion with Egypt delay thresholds", () => {
  const physical = {
    crad2_dischargeactivityid: "33333333-3333-3333-3333-333333333333",
    crad2_subject: "Physical Discharge",
    crad2_status: 100000000,
  } as Activity;
  const complete = (delayReason?: ActivityInput["delayReason"]): ActivityInput => ({
    action: "408520000",
    instructions: "",
    pharmacyReturn: "",
    withDues: "",
    homeMedicationDispensingRequired: "",
    followUp: "",
    comment: "",
    delayReason,
    physical: {
      and_didyoureceivethedischargesummary: "1",
      and_didyoureceiveyourhomemedications: "1",
      and_doyouhaveafollowupappointment: "1",
    },
  });
  const context = (dischargeType: string, hour: number, minute: number) => ({
    physicalDelayReasonRequired: egyptDischargeDelayState(
      patient(dischargeType),
      cairoTime(hour, minute),
    ).isPhysicalDischargeDelayReasonRequired,
  });
  const reason = { id: "44444444-4444-4444-4444-444444444444", name: "Clinical" };

  it.each([
    ["Early", 11, 0],
    ["Planned", 17, 0],
  ])("does not block %s completion at %d:%d without a reason", (type, hour, minute) => {
    expect(() =>
      buildActivityPayload(physical, complete(), context(type, hour, minute)),
    ).not.toThrow();
  });

  it.each([
    ["Early", 13, 0],
    ["Planned", 19, 0],
  ])("blocks %s completion at %d:%d without a reason", (type, hour, minute) => {
    expect(() =>
      buildActivityPayload(physical, complete(), context(type, hour, minute)),
    ).toThrow("Physical Discharge Delay Reason is required");
  });

  it("allows completion once a reason is selected", () => {
    const payload = buildActivityPayload(physical, complete(reason), context("Early", 13, 0));
    expect(payload["and_DelayReason@odata.bind" as keyof typeof payload]).toBe(
      `/and_delayreasonses(${reason.id})`,
    );
  });

  it("reads the saved reason from the latest Physical Discharge activity", () => {
    const withReason = {
      ...physical,
      _and_delayreason_value: reason.id,
      "_and_delayreason_value@OData.Community.Display.V1.FormattedValue": "Awaiting family",
    } as Activity;
    expect(physicalDischargeDelayReason([physical, withReason])).toBe("Awaiting family");
    expect(physicalDischargeDelayReason([physical])).toBe("");
  });
});
