import { getContext } from "@microsoft/power-apps/app";
import { guid } from "../config/schema";
import { OperationalError } from "./data";
export const platformService = {
  context: getContext,
  async recordUrl(
    table: string,
    id?: string,
    defaults?: Record<string, string>,
  ) {
    const context = await getContext();
    const org = context.app.dataverseOrgUrl;
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
