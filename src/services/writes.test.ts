import { afterEach, describe, expect, it, vi } from "vitest";
import { alertService } from "./alertService";
import {
  earlyDischargeService,
  type Draft,
  type Inpatient,
} from "./earlyDischargeService";
import { And_whatsappnotificationsService as Alerts } from "../generated/services/And_whatsappnotificationsService";
import { And_earlydischargesService as Drafts } from "../generated/services/And_earlydischargesService";
import { And_earlydischarge_ipdvisitsesService as Children } from "../generated/services/And_earlydischarge_ipdvisitsesService";
const id = "11111111-1111-1111-1111-111111111111",
  patientId = "22222222-2222-2222-2222-222222222222";
const draft = { and_earlydischargeid: id, and_statusnew: 0 } as Draft;
const patient = {
  and_inpatientlistid: patientId,
  and_name: "TEST-CODE",
  and_visitid: "TEST-VISIT",
} as Inpatient;
afterEach(() => vi.restoreAllMocks());
describe("alert writes", () => {
  it("creates only an alert with its existing patient binding and comment", async () => {
    const create = vi
      .spyOn(Alerts, "create")
      .mockResolvedValue({ success: true, data: {} as never });
    await alertService.create(id, "  Test comment  ");
    expect(create).toHaveBeenCalledWith({
      and_comment: "Test comment",
      "and_Patient@odata.bind": `/crad2_patientdischarges(${id})`,
    });
  });
  it("rejects missing required comment before making a request", async () => {
    const create = vi.spyOn(Alerts, "create");
    await expect(alertService.create(id, " ")).rejects.toThrow("comment");
    expect(create).not.toHaveBeenCalled();
  });
});
describe("early discharge writes", () => {
  it("never creates a daily draft and rejects already-submitted parents", async () => {
    vi.spyOn(Drafts, "get").mockResolvedValue({
      success: true,
      data: { ...draft, and_statusnew: 1 },
    });
    const create = vi.spyOn(Children, "create");
    const parentCreate = vi.spyOn(Drafts, "create");
    await expect(
      earlyDischargeService.add(draft, patient, "1"),
    ).rejects.toThrow("submitted");
    expect(create).not.toHaveBeenCalled();
    expect(parentCreate).not.toHaveBeenCalled();
  });
  it("blocks duplicates before creating a row", async () => {
    vi.spyOn(Drafts, "get").mockResolvedValue({ success: true, data: draft });
    vi.spyOn(Children, "getAll").mockResolvedValue({
      success: true,
      data: [{ _and_patientcode_value: patientId } as never],
    });
    const create = vi.spyOn(Children, "create");
    await expect(
      earlyDischargeService.add(draft, patient, "1"),
    ).rejects.toThrow("already added");
    expect(create).not.toHaveBeenCalled();
  });
  it("links new child to both existing draft and verified inpatient record", async () => {
    vi.spyOn(Drafts, "get").mockResolvedValue({ success: true, data: draft });
    vi.spyOn(Children, "getAll").mockResolvedValue({ success: true, data: [] });
    const create = vi
      .spyOn(Children, "create")
      .mockResolvedValue({ success: true, data: {} as never });
    await earlyDischargeService.add(draft, patient, "2");
    expect(create).toHaveBeenCalledWith({
      and_name: "TEST-CODE",
      crda1_visitid: "TEST-VISIT",
      and_dischargetype: 2,
      "and_EarlyDischarge@odata.bind": `/and_earlydischarges(${id})`,
      "and_PatientCode@odata.bind": `/and_inpatientlists(${patientId})`,
    });
  });
  it("submits only the existing parent status; does not patch a read-only count", async () => {
    vi.spyOn(Drafts, "get").mockResolvedValue({ success: true, data: draft });
    const update = vi
      .spyOn(Drafts, "update")
      .mockResolvedValue({ success: true, data: draft });
    await earlyDischargeService.submit(id);
    expect(update).toHaveBeenCalledWith(id, { and_statusnew: 1 });
  });
});
