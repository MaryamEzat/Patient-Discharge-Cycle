/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { MicrosoftDataverseService } from "../generated/services/MicrosoftDataverseService";
import {
  TARGET_DATAVERSE_ORG_URL,
  createRecordOrg,
  downloadFileOrg,
  getItemOrg,
  listRecordsOrg,
  updateRecordOrg,
  uploadFileOrg,
} from "./dataverseAdapter";
import { entitySet, tables } from "../config/schema";
import powerConfig from "../../power.config.json";

// The code app is hosted in org998df960, but every table and row lives in aemara.
const AEMARA = "https://aemara.crm4.dynamics.com";
const id = "11111111-1111-1111-1111-111111111111";

const sources = import.meta.glob<string>("/src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
});
const appSources = Object.entries(sources).filter(
  ([path]) => !path.startsWith("/src/generated/") && !/\.test\.tsx?$/.test(path),
);

afterEach(() => vi.restoreAllMocks());

describe("Dataverse environment", () => {
  it("targets aemara by default", () => {
    expect(TARGET_DATAVERSE_ORG_URL).toBe(AEMARA);
  });

  it("never uses generated table services, which query the app's own environment", () => {
    const offenders = appSources.filter(
      ([path, code]) =>
        /generated\/services\/(?!MicrosoftDataverseService\b)/.test(code) ||
        /\bgetClient\s*\(/.test(code) ||
        (/MicrosoftDataverseService/.test(code) &&
          path !== "/src/services/dataverseAdapter.ts"),
    );
    expect(offenders.map(([path]) => path)).toEqual([]);
  });

  it("only calls the connector's WithOrganization actions", () => {
    const adapter = sources["/src/services/dataverseAdapter.ts"];
    const calls = [...adapter.matchAll(/MicrosoftDataverseService\.(\w+)\(/g)].map((m) => m[1]);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.filter((name) => !name.endsWith("WithOrganization"))).toEqual([]);
  });

  it("does not bind any table to the app's own environment in power.config.json", () => {
    // `pa app add data-source` re-adds entries here; remove them again after adding a table.
    const refs = powerConfig.databaseReferences as Record<string, { dataSources?: object }>;
    expect(Object.values(refs).flatMap((ref) => Object.keys(ref.dataSources ?? {}))).toEqual([]);
  });

  it.each(Object.entries(tables))("sends %s requests to aemara", async (_key, table) => {
    const ok = { success: true, data: {} } as never;
    const list = vi.spyOn(MicrosoftDataverseService, "ListRecordsWithOrganization").mockResolvedValue({ success: true, data: { value: [] } });
    const get = vi.spyOn(MicrosoftDataverseService, "GetItemWithOrganization").mockResolvedValue(ok);
    const create = vi.spyOn(MicrosoftDataverseService, "CreateRecordWithOrganization").mockResolvedValue(ok);
    const update = vi.spyOn(MicrosoftDataverseService, "UpdateRecordWithOrganization").mockResolvedValue(ok);
    const upload = vi.spyOn(MicrosoftDataverseService, "UpdateEntityFileImageFieldContentWithOrganization").mockResolvedValue({ success: true } as never);
    const download = vi.spyOn(MicrosoftDataverseService, "GetEntityFileImageFieldContentWithOrganization").mockResolvedValue({ success: true, data: "" } as never);

    await listRecordsOrg(table);
    await getItemOrg(table, id);
    await createRecordOrg(table, {});
    await updateRecordOrg(table, id, {});
    await uploadFileOrg(table, id, "file", new File(["x"], "x.txt"));
    await downloadFileOrg(table, id, "file");

    expect(list.mock.calls[0][0]).toBe(AEMARA);
    expect(list.mock.calls[0][1]).toBe(entitySet(table));
    expect(get.mock.calls[0][2]).toBe(AEMARA);
    expect(create.mock.calls[0][2]).toBe(AEMARA);
    expect(update.mock.calls[0][2]).toBe(AEMARA);
    expect(upload.mock.calls[0][1]).toBe(AEMARA);
    expect(download.mock.calls[0][1]).toBe(AEMARA);
  });
});
