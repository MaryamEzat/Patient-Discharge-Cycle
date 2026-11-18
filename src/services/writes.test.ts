import { afterEach, describe, expect, it, vi } from "vitest";
import { alertService } from "./alertService";
import {
  earlyDischargeService,
  earlyDraftBusinessUnit,
  earlyDraftMatchesScope,
  draftSelect,
  type Draft,
  type Inpatient,
  type IpdVisit,
} from "./earlyDischargeService";
import { getEarlyPatientDisplayData } from "../presentation/reference";
import { displayValue } from "../presentation/format";
import { MicrosoftDataverseService } from "../generated/services/MicrosoftDataverseService";
import { TARGET_DATAVERSE_ORG_URL } from "./dataverseAdapter";

const id = "11111111-1111-1111-1111-111111111111",
  patientId = "22222222-2222-2222-2222-222222222222";
const draft = {
  and_earlydischargeid: id,
  and_statusnew: 0,
  "_owningbusinessunit_value@OData.Community.Display.V1.FormattedValue": "AHJ",
} as unknown as Draft;
const patient = {
  and_inpatientlistid: patientId,
  and_name: "TEST-CODE",
  and_visitid: "TEST-VISIT",
} as Inpatient;

afterEach(() => vi.restoreAllMocks());

describe("alert writes", () => {
  it("creates only an alert with its existing patient binding and comment", async () => {
    const create = vi
      .spyOn(MicrosoftDataverseService, "CreateRecordWithOrganization")
      .mockResolvedValue({ success: true, data: {} as never });
    await alertService.create(id, "  Test comment  ");
    expect(create).toHaveBeenCalledWith(
      "return=representation",
      "application/json",
      TARGET_DATAVERSE_ORG_URL,
      "and_whatsappnotifications",
      {
        and_comment: "Test comment",
        "and_Patient@odata.bind": `/crad2_patientdischarges(${id})`,
      },
    );
  });

  it("rejects missing required comment before making a request", async () => {
    const create = vi.spyOn(MicrosoftDataverseService, "CreateRecordWithOrganization");
    await expect(alertService.create(id, " ")).rejects.toThrow("comment");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("early discharge writes", () => {
  it("identifies BU-specific parents without treating one Egypt BU as another", () => {
    const ash = {
      ...draft,
      "_owningbusinessunit_value@OData.Community.Display.V1.FormattedValue":
        "ASH",
    } as Draft;
    const smh = {
      ...draft,
      "_owningbusinessunit_value@OData.Community.Display.V1.FormattedValue":
        "SMH",
    } as Draft;
    const amh = {
      ...draft,
      "_owningbusinessunit_value@OData.Community.Display.V1.FormattedValue":
        "AMH",
    } as Draft;
    expect(earlyDraftBusinessUnit(draft)).toBe("AHJ");
    expect(earlyDraftBusinessUnit(ash)).toBe("ASH");
    expect(earlyDraftBusinessUnit(smh)).toBe("SMH");
    expect(earlyDraftBusinessUnit(amh)).toBe("AMH");
    expect(earlyDraftMatchesScope(draft, "Saudi Arabia")).toBe(true);
    expect(earlyDraftMatchesScope(ash, "Egypt")).toBe(true);
    expect(earlyDraftMatchesScope(smh, "Egypt")).toBe(true);
    expect(earlyDraftMatchesScope(amh, "Egypt")).toBe(true);
    expect(earlyDraftMatchesScope(draft, "Egypt")).toBe(false);
  });

  it("reads the hospital from cr301_businessunit when drafts are owned by the root BU", () => {
    const owned = (hospital: string) =>
      ({
        ...draft,
        "_owningbusinessunit_value@OData.Community.Display.V1.FormattedValue": "aemara",
        _cr301_businessunit_value: patientId,
        "_cr301_businessunit_value@OData.Community.Display.V1.FormattedValue": hospital,
      }) as unknown as Draft;
    expect(earlyDraftBusinessUnit(owned("AHJ"))).toBe("AHJ");
    expect(earlyDraftMatchesScope(owned("AHJ"), "Saudi Arabia")).toBe(true);
    expect(earlyDraftMatchesScope(owned("AHJ"), "Egypt")).toBe(false);
    for (const hospital of ["ASH", "SMH", "AMH"]) {
      expect(earlyDraftBusinessUnit(owned(hospital))).toBe(hospital);
      expect(earlyDraftMatchesScope(owned(hospital), "Egypt")).toBe(true);
      expect(earlyDraftMatchesScope(owned(hospital), "Saudi Arabia")).toBe(false);
    }
    expect(earlyDraftBusinessUnit(owned(""))).toBe("");
    expect(draftSelect).toContain("_cr301_businessunit_value");
  });

  it("keeps blank automation-created child rows visible", async () => {
    vi.spyOn(
      MicrosoftDataverseService,
      "ListRecordsWithOrganization",
    ).mockResolvedValue({
      success: true,
      data: {
        value: [
          {
            and_earlydischarge_ipdvisitsid: patientId,
            and_name: "2026-10-22",
          },
        ],
      } as never,
    });
    const rows = await earlyDischargeService.children(id);
    expect(rows).toHaveLength(1);
    expect(rows[0].and_earlydischarge_ipdvisitsid).toBe(patientId);
    expect(rows[0].__inpatient).toBeUndefined();
  });

  it("never creates a daily draft and rejects already-submitted parents", async () => {
    vi.spyOn(MicrosoftDataverseService, "GetItemWithOrganization").mockResolvedValue({
      success: true,
      data: { ...draft, and_statusnew: 1 } as never,
    });
    const create = vi.spyOn(MicrosoftDataverseService, "CreateRecordWithOrganization");
    await expect(
      earlyDischargeService.add(draft, patient, "1"),
    ).rejects.toThrow("submitted");
    expect(create).not.toHaveBeenCalled();
  });

  it("blocks duplicates before creating a row", async () => {
    vi.spyOn(MicrosoftDataverseService, "GetItemWithOrganization").mockResolvedValue({
      success: true,
      data: draft as never,
    });
    vi.spyOn(MicrosoftDataverseService, "ListRecordsWithOrganization").mockResolvedValue({
      success: true,
      data: { value: [{ _and_patientcode_value: patientId }] } as never,
    });
    const create = vi.spyOn(MicrosoftDataverseService, "CreateRecordWithOrganization");
    await expect(
      earlyDischargeService.add(draft, patient, "1"),
    ).rejects.toThrow("already added");
    expect(create).not.toHaveBeenCalled();
  });

  it("links new child to both existing draft and verified inpatient record", async () => {
    vi.spyOn(MicrosoftDataverseService, "GetItemWithOrganization").mockResolvedValue({
      success: true,
      data: draft as never,
    });
    vi.spyOn(MicrosoftDataverseService, "ListRecordsWithOrganization").mockResolvedValue({
      success: true,
      data: { value: [] } as never,
    });
    const create = vi
      .spyOn(MicrosoftDataverseService, "CreateRecordWithOrganization")
      .mockResolvedValue({ success: true, data: {} as never });
    await earlyDischargeService.add(draft, patient, "2");
    expect(create).toHaveBeenCalledWith(
      "return=representation",
      "application/json",
      TARGET_DATAVERSE_ORG_URL,
      "and_earlydischarge_ipdvisitses",
      {
        and_name: "TEST-CODE",
        crda1_visitid: "TEST-VISIT",
        and_dischargetype: 2,
        "and_EarlyDischarge@odata.bind": `/and_earlydischarges(${id})`,
        "and_PatientCode@odata.bind": `/and_inpatientlists(${patientId})`,
      },
    );
  });

  describe("Egypt IPD visit rows", () => {
    const blankId = "33333333-3333-3333-3333-333333333333",
      filledId = "44444444-4444-4444-4444-444444444444",
      visitId = "55555555-5555-5555-5555-555555555555",
      buId = "66666666-6666-6666-6666-666666666666";
    const egyptDraft = {
      ...draft,
      "_owningbusinessunit_value@OData.Community.Display.V1.FormattedValue": "aemara",
      _cr301_businessunit_value: buId,
      "_cr301_businessunit_value@OData.Community.Display.V1.FormattedValue": "ASH",
    } as unknown as Draft;
    const visit = {
      ipd_visitid: visitId,
      ipd_name: "1234",
      ipd_patientcode: "00002768",
    } as IpdVisit;
    const mockGet = (rowsById: Record<string, object>, parent: Draft = egyptDraft) =>
      vi.spyOn(MicrosoftDataverseService, "GetItemWithOrganization").mockImplementation(
        (async (...args: unknown[]) => ({
          success: true,
          data: args[3] === "and_earlydischarges" ? parent : rowsById[String(args[4])],
        })) as never,
      );
    const mockRows = (rows: object[]) =>
      vi.spyOn(MicrosoftDataverseService, "ListRecordsWithOrganization").mockResolvedValue({
        success: true,
        data: { value: rows } as never,
      });

    it("fills the first blank placeholder row with the IPD visit", async () => {
      const blank = { and_earlydischarge_ipdvisitsid: blankId };
      mockRows([{ and_earlydischarge_ipdvisitsid: filledId, _cr301_patientcodeegy_value: patientId }, blank]);
      mockGet({ [blankId]: blank });
      const update = vi
        .spyOn(MicrosoftDataverseService, "UpdateRecordWithOrganization")
        .mockResolvedValue({ success: true, data: {} as never });
      const create = vi.spyOn(MicrosoftDataverseService, "CreateRecordWithOrganization");
      await earlyDischargeService.addEgypt(egyptDraft, visit, "1");
      expect(update).toHaveBeenCalledWith(
        "return=representation",
        "application/json",
        TARGET_DATAVERSE_ORG_URL,
        "and_earlydischarge_ipdvisitses",
        blankId,
        {
          crda1_visitid: "1234",
          and_dischargetype: 1,
          "cr301_PatientCodeEGY@odata.bind": `/ipd_visits(${visitId})`,
        },
      );
      expect(create).not.toHaveBeenCalled();
    });

    it("skips a placeholder another user filled in the meantime", async () => {
      const blank = { and_earlydischarge_ipdvisitsid: blankId };
      mockRows([blank]);
      mockGet({ [blankId]: { ...blank, _cr301_patientcodeegy_value: patientId } });
      const update = vi.spyOn(MicrosoftDataverseService, "UpdateRecordWithOrganization");
      const create = vi
        .spyOn(MicrosoftDataverseService, "CreateRecordWithOrganization")
        .mockResolvedValue({ success: true, data: {} as never });
      await earlyDischargeService.addEgypt(egyptDraft, visit, "2");
      expect(update).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledWith(
        "return=representation",
        "application/json",
        TARGET_DATAVERSE_ORG_URL,
        "and_earlydischarge_ipdvisitses",
        {
          crda1_visitid: "1234",
          and_dischargetype: 2,
          "cr301_PatientCodeEGY@odata.bind": `/ipd_visits(${visitId})`,
          and_name: "00002768",
          "and_EarlyDischarge@odata.bind": `/and_earlydischarges(${id})`,
          "cr301_BusinessUnit@odata.bind": `/businessunits(${buId})`,
        },
      );
    });

    it("blocks adding the same IPD visit twice", async () => {
      mockRows([{ and_earlydischarge_ipdvisitsid: filledId, _cr301_patientcodeegy_value: visitId }]);
      mockGet({});
      const update = vi.spyOn(MicrosoftDataverseService, "UpdateRecordWithOrganization");
      await expect(earlyDischargeService.addEgypt(egyptDraft, visit, "1")).rejects.toThrow(
        "already added",
      );
      expect(update).not.toHaveBeenCalled();
    });

    it("rejects AHJ and submitted drafts before writing", async () => {
      const update = vi.spyOn(MicrosoftDataverseService, "UpdateRecordWithOrganization");
      mockGet({}, draft);
      await expect(earlyDischargeService.addEgypt(draft, visit, "1")).rejects.toThrow("Egypt IPD Visit");
      vi.restoreAllMocks();
      mockGet({}, { ...egyptDraft, and_statusnew: 1 } as Draft);
      await expect(earlyDischargeService.addEgypt(egyptDraft, visit, "1")).rejects.toThrow("submitted");
      expect(update).not.toHaveBeenCalled();
    });

    it("lists added patients first in the order added, then blank placeholders", async () => {
      const list = mockRows([
        { and_earlydischarge_ipdvisitsid: "a", and_name: "2026-10-25" },
        { and_earlydischarge_ipdvisitsid: "b", _cr301_patientcodeegy_value: visitId },
        { and_earlydischarge_ipdvisitsid: "c", and_name: "2026-10-25" },
        { and_earlydischarge_ipdvisitsid: "d", _cr301_patientcodeegy_value: visitId },
        { and_earlydischarge_ipdvisitsid: "e", _and_patientcode_value: patientId },
      ]);
      mockGet({ [visitId]: visit, [patientId]: patient });
      const rows = await earlyDischargeService.children(id);
      expect(list.mock.calls[0][8]).toBe("createdon asc,and_earlydischarge_ipdvisitsid asc");
      expect(rows.map((r) => r.and_earlydischarge_ipdvisitsid)).toEqual(["b", "d", "e", "a", "c"]);
    });

    it("counts AHJ and Egypt patients per draft from linked rows only", async () => {
      const fv = "@OData.Community.Display.V1.FormattedValue";
      const other = "77777777-7777-7777-7777-777777777777";
      const list = vi
        .spyOn(MicrosoftDataverseService, "ListRecordsWithOrganization")
        .mockImplementation((async (...args: unknown[]) => ({
          success: true,
          data: {
            value:
              args[1] === "and_earlydischarges"
                ? [
                    { ...egyptDraft, crda1_countofpatients: 0, [`crda1_countofpatients${fv}`]: "0" },
                    { ...egyptDraft, and_earlydischargeid: other, crda1_countofpatients: 9, [`crda1_countofpatients${fv}`]: "9" },
                  ]
                : [
                    { _and_earlydischarge_value: id.toUpperCase(), _cr301_patientcodeegy_value: visitId },
                    { _and_earlydischarge_value: id, _cr301_patientcodeegy_value: patientId },
                  ],
          },
        })) as never);
      const drafts = await earlyDischargeService.list("Egypt");
      expect(list.mock.calls[1][7]).toBe(
        "_and_patientcode_value ne null or _cr301_patientcodeegy_value ne null",
      );
      expect(drafts.map((d) => d.crda1_countofpatients)).toEqual([2, 0]);
      // What EarlyDischargePage renders: the formatted value must not keep the stale rollup.
      expect(drafts.map((d) => displayValue(d, "crda1_countofpatients", null, "0"))).toEqual(["2", "0"]);
    });

    it("shows visit details on linked Egypt rows", async () => {
      mockRows([{ and_earlydischarge_ipdvisitsid: filledId, _cr301_patientcodeegy_value: visitId }]);
      mockGet({ [visitId]: visit });
      const [row] = await earlyDischargeService.children(id);
      expect(row.__visit?.ipd_patientcode).toBe("00002768");
      expect(getEarlyPatientDisplayData(row)).toMatchObject({
        patientCode: "00002768",
        visitId: "1234",
      });
      // Patient Code comes from ipd_patientcode, never the visit GUID.
      expect(getEarlyPatientDisplayData(row).patientCode).not.toBe(visitId);
    });

    it("shows the patient name from the visit's linked ipd_patient", async () => {
      const ipdPatientId = "88888888-8888-8888-8888-888888888888";
      mockGet({ [visitId]: { ...visit, _ipd_patient_value: ipdPatientId } });
      vi.spyOn(MicrosoftDataverseService, "ListRecordsWithOrganization").mockImplementation(
        (async (...args: unknown[]) => ({
          success: true,
          data: {
            value:
              args[1] === "ipd_patients"
                ? [{ ipd_patientid: ipdPatientId, ipd_patientname: "Mona Adel" }]
                : [{ and_earlydischarge_ipdvisitsid: filledId, _cr301_patientcodeegy_value: visitId }],
          },
        })) as never,
      );
      const [row] = await earlyDischargeService.children(id);
      expect(getEarlyPatientDisplayData(row).patientName).toBe("Mona Adel");
    });

    it("searches IPD visits by visit, patient code and patient name without a BU filter", async () => {
      const ipdPatientId = "88888888-8888-8888-8888-888888888888";
      const linkedVisit = { ...visit, ipd_visitid: buId, _ipd_patient_value: ipdPatientId };
      const list = vi
        .spyOn(MicrosoftDataverseService, "ListRecordsWithOrganization")
        .mockImplementation((async (...args: unknown[]) => {
          const filter = String(args[7]);
          const value =
            args[1] === "ipd_patients"
              ? [{ ipd_patientid: ipdPatientId, ipd_patientname: "Mona Adel" }]
              : filter.includes("_ipd_patient_value")
                ? [linkedVisit]
                : [visit];
          return { success: true, data: { value } };
        }) as never);
      const results = await earlyDischargeService.searchEgyptVisits("Mona");
      const filters = list.mock.calls.map((c) => `${c[1]}: ${c[7]}`);
      expect(filters).toContain(
        "ipd_visits: statecode eq 0 and (contains(ipd_name,'Mona') or contains(ipd_patientcode,'Mona'))",
      );
      expect(filters).toContain("ipd_patients: contains(ipd_patientname,'Mona')");
      expect(filters).toContain(`ipd_visits: statecode eq 0 and (_ipd_patient_value eq ${ipdPatientId})`);
      expect(results.map((v) => v.ipd_visitid)).toEqual([visitId, buId]);
      expect(results[1].__patient?.ipd_patientname).toBe("Mona Adel");
    });
  });

  it("submits only the existing parent status; does not patch a read-only count", async () => {
    vi.spyOn(MicrosoftDataverseService, "GetItemWithOrganization").mockResolvedValue({
      success: true,
      data: draft as never,
    });
    const update = vi
      .spyOn(MicrosoftDataverseService, "UpdateRecordWithOrganization")
      .mockResolvedValue({ success: true, data: draft as never });
    await earlyDischargeService.submit(id);
    expect(update).toHaveBeenCalledWith(
      "return=representation",
      "application/json",
      TARGET_DATAVERSE_ORG_URL,
      "and_earlydischarges",
      id,
      { and_statusnew: 1 },
    );
  });
});

describe("AHJ inpatient search", () => {
  it("finds AHJ inpatients by hospital entity, not by owner (all rows are owned by the root BU)", async () => {
    const list = vi
      .spyOn(MicrosoftDataverseService, "ListRecordsWithOrganization")
      .mockResolvedValue({
        success: true,
        data: {
          value: [
            {
              ...patient,
              and_entityid: "102",
              "_owningbusinessunit_value@OData.Community.Display.V1.FormattedValue": "aemara",
            },
          ],
        } as never,
      });
    const rows = await earlyDischargeService.search("2367177", "Saudi Arabia");
    expect(rows).toHaveLength(1);
    const filter = String(list.mock.calls[0][7]);
    expect(filter).toContain("and_entityid eq '102'");
    expect(filter).toContain("contains(and_name,'2367177')");
  });
});
