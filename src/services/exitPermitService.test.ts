import { describe, expect, it } from "vitest";
import type { And_inpatientlists } from "../generated/models/And_inpatientlistsModel";
import type { Activity } from "./activityService";
import type { Patient } from "./dischargeService";
import {
  buildExitPermitData,
  buildExitPermitHtml,
  formatArabicDateTime,
  hasClearedPhysicalDischarge,
  isExitPermitPhysicalClearEvent,
} from "./exitPermitService";

const patient = (entityId: string): Patient =>
  ({
    crad2_patientdischargeid: "11111111-1111-1111-1111-111111111111",
    crad2_dischargereference: "REF-1",
    crad2_patientname: "مريم أحمد",
    new_patientid: "MRN-42",
    new_age: "34",
    new_gender: 100000001,
    crad2_room: "214",
    crad2_bed: "B",
    new_location: "Second Floor",
    crad2_doctorname: "Dr. Salma",
    crad2_admissiondate: "2026-10-13T08:30:00Z",
    crad2_status: 408520002,
    modifiedon: "2026-10-14T12:34:00Z",
    "modifiedon@OData.Community.Display.V1.FormattedValue": "10/14/2026 3:34 PM",
    new_entityid: entityId,
    statecode: 0,
  }) as unknown as Patient;

const financialActivity = (cleared = true): Activity =>
  ({
    crad2_dischargeactivityid: "22222222-2222-2222-2222-222222222222",
    crad2_subject: "Financial Discharge",
    crad2_status: cleared ? 408520000 : 100000000,
    crad2_actiondate: cleared ? "2026-10-14T09:45:00Z" : undefined,
  }) as unknown as Activity;

const physicalActivity = (cleared = true): Activity =>
  ({
    crad2_dischargeactivityid: "33333333-3333-3333-3333-333333333333",
    crad2_subject: "Physical Discharge",
    crad2_status: cleared ? 408520000 : 100000000,
    crad2_actiondate: cleared ? "2026-10-14T10:05:00Z" : undefined,
    "crad2_actiondate@OData.Community.Display.V1.FormattedValue":
      cleared ? "10/14/2026 1:05 PM" : undefined,
  }) as unknown as Activity;

const completedActivities = (financialCleared = true) => [
  financialActivity(financialCleared),
  physicalActivity(),
];

describe("Egypt Exit Permit", () => {
  it("formats permit timestamps with Arabic digits and Arabic AM/PM", () => {
    expect(formatArabicDateTime("2026-10-07T15:43:00")).toBe(
      "٧/١٠/٢٠٢٦ ٣:٤٣ م",
    );
  });

  it.each([
    ["1", "ASH", "الشلالات"],
    ["2", "SMH", "سموحة"],
    ["4", "AMH", "المعادي"],
  ])("maps Entity ID %s to %s / %s", (entityId, businessUnit, hospital) => {
    const permit = buildExitPermitData(patient(entityId), completedActivities());
    expect(permit?.businessUnit).toBe(businessUnit);
    expect(permit?.hospitalNameArabic).toBe(hospital);
    expect(permit?.canGenerate).toBe(true);
  });

  it("does not make an Exit Permit available for AHJ / Entity ID 102", () => {
    expect(buildExitPermitData(patient("102"), completedActivities())).toBeNull();
  });

  it("maps existing patient fields and leaves unavailable height and weight blank", () => {
    const permit = buildExitPermitData(
      patient("1"),
      completedActivities(),
      undefined,
    );
    expect(permit).toMatchObject({
      patientName: "مريم أحمد",
      patientFileNumber: "MRN-42",
      age: "34",
      sex: "Female",
      height: "",
      weight: "",
      room: "B",
      treatingPhysician: "Dr. Salma",
      financialStatus: "Cleared",
      canGenerate: true,
    });
    expect(permit?.location).toContain("Second Floor");
    expect(permit?.admissionDateTime).toBeTruthy();
    expect(permit?.financialClearanceDateTime).toBeTruthy();
  });

  it("fills the Arabic room field from the Bed column", () => {
    const permit = buildExitPermitData(patient("1"), completedActivities());
    expect(permit?.room).toBe("B");
    expect(buildExitPermitHtml(permit!)).toContain(
      '<span class="writing-space"><bdi dir="auto">B</bdi></span>',
    );
  });

  it("accepts the verified inpatient Financial Discharge Date as clearance evidence", () => {
    const inpatient = {
      and_inpatientlistid: "33333333-3333-3333-3333-333333333333",
      and_name: "MRN-42",
      and_financialdischargedate: "2026-10-14T10:00:00Z",
      statecode: 0,
    } as And_inpatientlists;
    const permit = buildExitPermitData(
      patient("2"),
      completedActivities(false),
      inpatient,
    );
    expect(permit?.canGenerate).toBe(true);
    expect(permit?.financialStatus).toBe("Cleared");
    expect(permit?.financialClearanceDateTime).toBeTruthy();
  });

  it("blocks generation when existing data does not prove financial clearance", () => {
    const permit = buildExitPermitData(
      patient("4"),
      completedActivities(false),
    );
    expect(permit?.canGenerate).toBe(false);
    expect(permit?.financialStatus).toBe("");
    expect(permit?.financialClearanceDateTime).toBe("");
  });

  it("uses the persisted Physical Discharge completion time without waiting for parent completion", () => {
    const completed = buildExitPermitData(patient("1"), completedActivities());
    const inProgress = buildExitPermitData(
      { ...patient("1"), crad2_status: 408520001 },
      completedActivities(),
    );
    expect(completed?.completionDateTime).toMatch(/[٠-٩]+\/[٠-٩]+\/[٠-٩]+/);
    expect(completed?.completionDateTime).not.toMatch(/AM|PM/);
    expect(inProgress?.completionDateTime).toBe(completed?.completionDateTime);
    expect(inProgress?.canGenerate).toBe(true);
    expect(hasClearedPhysicalDischarge(completedActivities())).toBe(true);
  });

  it("does not allow generation after Financial Discharge alone", () => {
    const permit = buildExitPermitData(
      { ...patient("1"), crad2_status: 408520001 },
      [financialActivity(), physicalActivity(false)],
    );
    expect(permit?.financialStatus).toBe("Cleared");
    expect(permit?.financialClearanceDateTime).toBeTruthy();
    expect(permit?.completionDateTime).toBe("");
    expect(permit?.canGenerate).toBe(false);
  });

  it("recognizes only a new successful Egypt Physical Discharge clear event", () => {
    expect(
      isExitPermitPhysicalClearEvent(
        physicalActivity(false),
        "408520000",
        true,
      ),
    ).toBe(true);
    expect(
      isExitPermitPhysicalClearEvent(
        physicalActivity(),
        "408520000",
        true,
      ),
    ).toBe(false);
    expect(
      isExitPermitPhysicalClearEvent(
        physicalActivity(),
        "408520000",
        false,
      ),
    ).toBe(false);
  });

  it("builds a fixed RTL print form with the required Arabic wording and monochrome logo asset", () => {
    const permit = buildExitPermitData(patient("1"), completedActivities());
    expect(permit).not.toBeNull();
    const html = buildExitPermitHtml(permit!);
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain("@page { size: A5 landscape");
    expect(html).toContain("المكاتب الأمامية");
    expect(html).toContain("خروج للسيد / السيدة:");
    expect(html).toContain("ولذا يصرح له / لها بالخروج");
    expect(html).toMatch(/[٠-٩]+\/[٠-٩]+\/[٠-٩]+/);
    expect(permit?.financialClearanceDateTime).not.toMatch(/\b(?:AM|PM)\b/);
    expect(permit?.completionDateTime).not.toMatch(/\b(?:AM|PM)\b/);
    expect(html).toContain(permit!.financialClearanceDateTime);
    expect(html).toContain(permit!.completionDateTime);
    expect(html).toContain("موظف الحسابات");
    expect(html).toContain("الشلالات");
    expect(html).toContain('<img src="assets/andalusia-hospitals-bw.png" alt="Andalusia Hospitals">');
    expect(html).toContain("filter: grayscale(1) contrast(1.2)");
    expect(html).not.toContain("background-image");
    expect(html).not.toContain("blue");
  });

  it("escapes long dynamic patient values in the printable document", () => {
    const longName = `${"A".repeat(120)} <script>alert(1)</script>`;
    const permit = buildExitPermitData(
      { ...patient("1"), crad2_patientname: longName },
      completedActivities(),
    );
    const html = buildExitPermitHtml(permit!);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
