import { describe, it, expect, vi } from "vitest";
import { allPages, unwrap } from "./data";
import {
  buildActivityPayload,
  type Activity,
  type ActivityInput,
} from "./activityService";
import {
  workflowSignal,
  pollDischargeWorkflow,
  type WorkflowSnapshot,
} from "./workflowPollingService";
import { displayChoice, displayValue } from "../presentation/format";
import { attribute, binding, selectFields, tables } from "../config/schema";
import type { IGetAllOptions } from "../generated/models/CommonModels";
const id = "11111111-1111-1111-1111-111111111111";
const other = "22222222-2222-2222-2222-222222222222";
const activity = (subject: string) =>
  ({
    crad2_dischargeactivityid: id,
    crad2_subject: subject,
    crad2_status: 100000000,
  }) as Activity;
const input = (): ActivityInput => ({
  action: "408520000",
  instructions: "",
  pharmacyReturn: "",
  followUp: "",
  comment: "",
  physical: {},
});
describe("complete paging", () => {
  it("collects more than 5000 rows and preserves filter/order on every page", async () => {
    const seen: IGetAllOptions[] = [];
    const result = await allPages(
      async (options) => {
        seen.push(options);
        return options.skipToken
          ? { success: true, data: [5001, 5002] }
          : {
              success: true,
              data: Array.from({ length: 5000 }, (_, i) => i + 1),
              skipToken: "opaque+token",
            };
      },
      { filter: "statecode eq 0", orderBy: ["createdon desc"], top: 25 },
    );
    expect(result).toHaveLength(5002);
    expect(seen[1]).toMatchObject({
      filter: "statecode eq 0",
      orderBy: ["createdon desc"],
      skipToken: "opaque+token",
    });
    expect(seen[0].top).toBeUndefined();
  });
  it("fails instead of returning misleading partial totals", async () => {
    let page = 0;
    await expect(
      allPages(async () =>
        ++page === 1
          ? { success: true, data: [1], skipToken: "next" }
          : { success: false, data: [], error: new Error("denied") },
      ),
    ).rejects.toThrow();
  });
  it("rejects repeated continuation tokens", async () => {
    await expect(
      allPages(async () => ({ success: true, data: [1], skipToken: "same" })),
    ).rejects.toThrow("completely");
  });
});
describe("activity business validation", () => {
  it("preserves zero for physical No", () => {
    const i = input();
    i.physical = Object.fromEntries(
      [
        "and_didyoureceivethedischargesummary",
        "and_didyoureceiveyourhomemedications",
        "and_doyouhaveafollowupappointment",
      ].map((f) => [f, "0"]),
    );
    const p = buildActivityPayload(activity("Physical Discharge"), i);
    expect(p.and_didyoureceiveyourhomemedications).toBe(0);
    expect(p.crad2_actiondate).toBeTruthy();
  });
  it("rejects missing confirmations and required delay/team choices", () => {
    expect(() =>
      buildActivityPayload(activity("Physical Discharge"), input()),
    ).toThrow("confirmations");
    expect(() =>
      buildActivityPayload(activity("Request Initiation"), input()),
    ).toThrow("Delay Reason");
    expect(() =>
      buildActivityPayload(activity("Financial Discharge"), {
        ...input(),
        action: "2",
      }),
    ).toThrow("team");
  });
  it("preserves request booleans and integer pharmacy choices", () => {
    const p = buildActivityPayload(activity("Request Initiation"), {
      ...input(),
      instructions: "true",
      pharmacyReturn: "false",
      delayReason: { id: other, name: "Reason" },
    });
    expect(p.new_dischargeinstructions).toBe(true);
    expect(p.crad2_pharmacyreturn).toBe(false);
    expect(p.new_pharmacyreturn).toBe(2);
    expect(p["and_DelayReason@odata.bind"]).toBe(
      `/and_delayreasonses(${other})`,
    );
    expect(p).not.toHaveProperty("new_dischargeinstructionsss");
  });
  it("defaults only blank physical confirmations when forwarding", () => {
    const a = {
      ...activity("Physical Discharge"),
      and_didyoureceivethedischargesummary: 0 as const,
    };
    const p = buildActivityPayload(a, {
      ...input(),
      action: "2",
      team: { id: other, name: "Team" },
    });
    expect(p.and_didyoureceivethedischargesummary).toBeUndefined();
    expect(p.and_didyoureceiveyourhomemedications).toBe(2);
    expect(p["crad2_ForwardToTeam@odata.bind"]).toBe(`/teams(${other})`);
    expect(p.crad2_actiondate).toBeUndefined();
  });
});
describe("generated schema and labels", () => {
  it("keeps valid choice zero and uses labels, never GUIDs", () => {
    expect(
      displayChoice({ and_statusnew: 0 }, tables.early, "and_statusnew"),
    ).toBe("Draft");
    expect(
      displayChoice({ crad2_status: 999 }, tables.patient, "crad2_status"),
    ).toBe("Label unavailable");
    expect(displayValue({ _ownerid_value: id }, "_ownerid_value")).toBe("-");
    expect(
      displayValue(
        {
          _ownerid_value: id,
          "_ownerid_value@OData.Community.Display.V1.FormattedValue": "Nursing",
        },
        "_ownerid_value",
      ),
    ).toBe("Nursing");
  });
  it("uses generated alert fallback and verified binding", () => {
    expect(
      displayValue(
        { crad2_patientdischargeid: id, crda1_whatsappflag: 382720000 },
        "crda1_whatsappflag",
      ),
    ).not.toBe("382720000");
    expect(binding(tables.alert, "and_patient", tables.patient, id)).toEqual({
      "and_Patient@odata.bind": `/crad2_patientdischarges(${id})`,
    });
  });
  it("excludes invalid synthetic lookups and respects read-only count metadata", () => {
    expect(
      selectFields(tables.patient, [
        "_crad2_patientidlookup_value",
        "_ownerid_value",
        "owneridname",
      ]),
    ).toEqual(["_ownerid_value"]);
    expect(
      attribute(tables.early, "crda1_countofpatients")["x-ms-read-only"],
    ).toBe(true);
  });
  it("does not treat a failed SDK operation as success", () => {
    expect(() =>
      unwrap({
        success: false,
        data: undefined,
        error: new Error("raw error"),
      }),
    ).toThrow("could not");
  });
});
describe("backend workflow observation", () => {
  const snapshot = () =>
    ({
      parent: {
        crad2_patientdischargeid: other,
        crad2_status: 408520001,
        crda1_currentstepf: "Request Initiation",
        modifiedon: "2026-09-01",
      },
      activities: [activity("Request Initiation")],
    }) as WorkflowSnapshot;
  it("does not interpret PATCH confirmation or modifiedon as workflow completion", () => {
    const before = snapshot(),
      after = snapshot();
    after.parent.modifiedon = "2026-09-02";
    after.activities[0].crad2_status = 408520000;
    after.activities[0].crad2_actiondate = "2026-09-02";
    expect(workflowSignal(before, id)).toBe(workflowSignal(after, id));
  });
  it("detects new actual activities", () => {
    const before = snapshot(),
      after = snapshot();
    after.activities.push({
      ...activity("Financial Discharge"),
      crad2_dischargeactivityid: other,
    });
    expect(workflowSignal(before, id)).not.toBe(workflowSignal(after, id));
  });
  it("polls until backend state changes and reports timeouts honestly", async () => {
    vi.useFakeTimers();
    try {
      const baseline = snapshot(),
        next = snapshot();
      next.parent.crad2_pendingon = 408520002;
      const read = vi
        .fn()
        .mockResolvedValueOnce(baseline)
        .mockResolvedValueOnce(next);
      const onSnapshot = vi.fn();
      const promise = pollDischargeWorkflow(
        other,
        baseline,
        id,
        onSnapshot,
        new AbortController().signal,
        { read, intervalMs: 10, timeoutMs: 50 },
      );
      await vi.advanceTimersByTimeAsync(20);
      expect((await promise).changed).toBe(true);
      expect(onSnapshot).toHaveBeenCalledTimes(2);
      const timeout = pollDischargeWorkflow(
        other,
        baseline,
        id,
        () => {},
        new AbortController().signal,
        { read: async () => baseline, intervalMs: 10, timeoutMs: 20 },
      );
      await vi.advanceTimersByTimeAsync(20);
      expect((await timeout).changed).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
