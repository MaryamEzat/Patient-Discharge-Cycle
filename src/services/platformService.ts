import { getContext } from "@microsoft/power-apps/app";
import { guid } from "../config/schema";
import { OperationalError } from "./data";
import { TARGET_DATAVERSE_ORG_URL } from "./dataverseAdapter";
export const platformService = {
  context: getContext,
  async recordUrl(
    table: string,
    id?: string,
    defaults?: Record<string, string>,
  ) {
    let org = TARGET_DATAVERSE_ORG_URL;
    if (!org) {
      const context = await getContext().catch(() => null);
      org = context?.app?.dataverseOrgUrl || "";
    }
    if (!org)
      throw new OperationalError(
        "The full record form is unavailable in this session.",
      );
    const url = new URL("main.aspx", org.endsWith("/") ? org : org + "/");
    url.searchParams.set("pagetype", "entityrecord");
    url.searchParams.set("etn", table);
    if (id) url.searchParams.set("id", guid(id));
    if (defaults)
      url.searchParams.set("extraqs", new URLSearchParams(defaults).toString());
    return url.toString();
  },
};
