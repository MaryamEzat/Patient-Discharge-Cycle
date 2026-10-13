import { afterEach, expect, it, vi } from "vitest";
import { MicrosoftDataverseService } from "../generated/services/MicrosoftDataverseService";
import { getItemOrg, listRecordsOrg } from "./dataverseAdapter";
import { displayValue } from "../presentation/format";
import { tables } from "../config/schema";

afterEach(() => vi.restoreAllMocks());

const row = {
  and_earlydischargeid: "11111111-1111-1111-1111-111111111111",
  _and_submittedby_value: "22222222-2222-2222-2222-222222222222",
  "_and_submittedby_value@OData.Community.Display.V1.FormattedValue": "Test Submitter",
};

it("requests and preserves the saved submitter name when listing drafts", async () => {
  const request = vi.spyOn(MicrosoftDataverseService, "ListRecordsWithOrganization")
    .mockResolvedValue({ success: true, data: { value: [row] } });
  const result = await listRecordsOrg<typeof row>(tables.early);
  expect(request.mock.calls[0][2]).toContain('odata.include-annotations="OData.Community.Display.V1.FormattedValue"');
  expect(displayValue(result.data?.[0], "_and_submittedby_value")).toBe("Test Submitter");
});

it("requests and preserves the saved submitter name in draft details", async () => {
  const request = vi.spyOn(MicrosoftDataverseService, "GetItemWithOrganization")
    .mockResolvedValue({ success: true, data: row });
  const result = await getItemOrg(tables.early, row.and_earlydischargeid);
  expect(request.mock.calls[0][0]).toContain('odata.include-annotations="OData.Community.Display.V1.FormattedValue"');
  expect(displayValue(result.data as object, "_and_submittedby_value")).toBe("Test Submitter");
  expect(displayValue({ _and_submittedby_value: row._and_submittedby_value }, "_and_submittedby_value")).toBe("-");
});
