// Developer-only, GET-only verification. Uses the installed CLI authentication provider.
// Never bundled into the app. Never prints or persists tokens or patient records.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CONFIG } from "../src/config/reference.ts";
const org = process.argv.find((a) => a.startsWith("--org="))?.slice(6);
if (!org) throw new Error("Supply --org=<Dataverse organization URL>");
const origin = new URL(org).origin;
const cli = path.join(
  process.env.APPDATA,
  "npm/node_modules/@microsoft/power-apps-cli/dist/Authentication/NodeMsalAuthenticationProvider.js",
);
const { NodeMsalAuthenticationProvider } = await import(pathToFileURL(cli));
const auth = new NodeMsalAuthenticationProvider();
console.log("Initializing CLI authentication for read-only verification...");
await auth.initAsync("prod");
const token = await auth.getAccessTokenForResource(origin);
console.log("Authentication ready.");
async function get(relative) {
  const url = new URL(relative, origin + "/api/data/v9.2/");
  if (url.origin !== origin) throw new Error("Unexpected metadata origin");
  const response = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(45000),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      Prefer: "odata.maxpagesize=5000,odata.include-annotations=*",
    },
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(
      `${response.status}: ${result.error?.message || "Dataverse request failed"}`,
    );
  }
  return response.json();
}
if (process.argv.includes("--paging-probe")) {
  const results = [];
  for (const prefer of [
    "odata.maxpagesize=5000",
    "odata.maxpagesize=5000,odata.include-annotations=*",
    'odata.maxpagesize=5000,odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
  ]) {
    const started = Date.now();
    const response = await fetch(
      `${origin}/api/data/v9.2/crad2_patientdischarges?$select=crad2_patientdischargeid,createdon&$orderby=createdon%20desc`,
      {
        method: "GET",
        signal: AbortSignal.timeout(45000),
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          Prefer: prefer,
        },
      },
    );
    const body = await response.json();
    results.push({
      prefer,
      status: response.status,
      rows: body.value?.length,
      hasNext: !!body["@odata.nextLink"],
      applied: response.headers.get("preference-applied"),
      elapsedMs: Date.now() - started,
    });
    console.log(JSON.stringify(results.at(-1)));
  }
  fs.writeFileSync("docs/paging-probe.json", JSON.stringify(results, null, 2));
  process.exit(0);
}
if (process.argv.includes("--count-all")) {
  let url =
    "crad2_patientdischarges?$select=crad2_patientdischargeid,createdon&$orderby=createdon%20desc,crad2_patientdischargeid%20asc";
  let rows = 0,
    pages = 0;
  const ids = new Set();
  const seen = new Set();
  const result = {
    checkedAt: new Date().toISOString(),
    complete: false,
    rows: 0,
    pages: 0,
  };
  try {
    while (url) {
      if (seen.has(url)) throw new Error("Repeated nextLink");
      seen.add(url);
      const page = await get(url);
      for (const row of page.value) ids.add(row.crad2_patientdischargeid);
      rows += page.value.length;
      pages++;
      url = page["@odata.nextLink"];
      console.log(`Record index: ${rows} records, ${pages} page(s)`);
    }
    Object.assign(result, {
      complete: true,
      rows,
      pages,
      uniqueRecords: ids.size,
    });
  } catch (e) {
    Object.assign(result, { rows, pages, error: e.message });
  }
  fs.writeFileSync(
    "docs/worklist-index-verification.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
  process.exit(0);
}
const schemas = fs
  .readdirSync(".power/schemas/dataverse")
  .map((f) =>
    JSON.parse(fs.readFileSync(".power/schemas/dataverse/" + f, "utf8")),
  );
const output = {
  checkedAt: new Date().toISOString(),
  tables: [],
  relationships: [],
  fieldChecks: [],
};
for (const s of schemas) {
  console.log(`Checking table ${s.name}`);
  const entity = s.schema.items;
  const id = entity["x-ms-dataverse-primary-id"];
  try {
    const result = await get(
      `${entity["x-ms-dataverse-entityset"]}?$select=${id}&$top=1`,
    );
    output.tables.push({
      table: s.name,
      readable: true,
      hasRecords: !!result.value?.length,
    });
  } catch (e) {
    output.tables.push({ table: s.name, readable: false, error: e.message });
  }
}
for (const table of [
  "and_whatsappnotification",
  "crad2_dischargeactivity",
  "and_earlydischarge_ipdvisits",
]) {
  const result = await get(
    `EntityDefinitions(LogicalName='${table}')/ManyToOneRelationships?$select=SchemaName,ReferencingAttribute,ReferencedEntity,ReferencingEntityNavigationPropertyName`,
  );
  output.relationships.push(
    ...result.value
      .filter((r) =>
        [
          "and_patient",
          "crad2_discharge",
          "crad2_forwardtoteam",
          "and_delayreason",
          "and_earlydischarge",
          "and_patientcode",
        ].includes(r.ReferencingAttribute),
      )
      .map(
        ({
          SchemaName,
          ReferencingAttribute,
          ReferencedEntity,
          ReferencingEntityNavigationPropertyName,
        }) => ({
          table,
          SchemaName,
          ReferencingAttribute,
          ReferencedEntity,
          ReferencingEntityNavigationPropertyName,
        }),
      ),
  );
}
const patient = schemas.find((s) => s.name === "crad2_patientdischarge").schema
  .items;
const desired = [
  ...Object.values(CONFIG.fields),
  ...Object.values(CONFIG.patientAliases).flat(),
  ...Object.values(CONFIG.patientFieldAliases).flat(),
  "_ownerid_value",
  "owneridname",
  "owneridtype",
  "modifiedon",
  "statecode",
  "statuscode",
  "new_gender",
];
const select = [
  ...new Set(
    desired
      .filter((f) => {
        const a = patient.properties[f.replace(/^_(.+)_value$/, "$1")];
        return (
          a &&
          (!f.startsWith("_") ||
            /^(Lookup|Owner|Customer)Type$/.test(a["x-ms-dataverse-type"])) &&
          !/^(owneridname|owneridtype)$/.test(f) &&
          a["x-ms-dataverse-type"] !== "VirtualType"
        );
      })
      .map((f) =>
        /^(Lookup|Owner|Customer)Type$/.test(
          patient.properties[f.replace(/^_(.+)_value$/, "$1")][
            "x-ms-dataverse-type"
          ],
        ) && !f.startsWith("_")
          ? `_${f}_value`
          : f,
      ),
  ),
];
try {
  await get(
    `crad2_patientdischarges?$select=${select.join(",")}&$orderby=createdon desc&$top=1`,
  );
  output.fieldChecks.push({
    table: "crad2_patientdischarge",
    select,
    valid: true,
  });
} catch (e) {
  output.fieldChecks.push({
    table: "crad2_patientdischarge",
    select,
    valid: false,
    error: e.message,
  });
}
if (fs.existsSync(".local/query-contracts.json")) {
  const contracts = JSON.parse(
    fs.readFileSync(".local/query-contracts.json", "utf8"),
  );
  for (const contract of contracts) {
    console.log(`Checking screen query ${contract.table}`);
    try {
      const q = new URLSearchParams({
        $select: contract.select.join(","),
        $top: "1",
      });
      if (contract.orderBy.length)
        q.set("$orderby", contract.orderBy.join(","));
      const page = await get(`${contract.entitySet}?${q}`);
      output.fieldChecks.push({
        table: contract.table,
        select: contract.select,
        valid: true,
        hasRecords: !!page.value?.length,
      });
    } catch (e) {
      output.fieldChecks.push({
        table: contract.table,
        valid: false,
        error: e.message,
      });
    }
  }
  const contract = contracts.find((c) => c.table === "crad2_patientdischarge");
  const q = new URLSearchParams({
    $select: contract.select.join(","),
    $orderby: contract.orderBy.join(","),
  });
  let url = `${contract.entitySet}?${q}`;
  let rows = 0,
    pages = 0;
  const visited = new Set();
  const deadline = Date.now() + 180000;
  try {
    while (url) {
      if (Date.now() > deadline)
        throw new Error(
          "Full dataset read exceeded the three-minute diagnostic budget",
        );
      if (visited.has(url)) throw new Error("Repeated nextLink");
      visited.add(url);
      const page = await get(url);
      rows += page.value.length;
      pages++;
      console.log(`Worklist read: ${rows} records across ${pages} page(s)`);
      url = page["@odata.nextLink"];
    }
    output.completeWorklistRead = { rows, pages, complete: true };
  } catch (e) {
    output.completeWorklistRead = {
      rows,
      pages,
      complete: false,
      error: e.message,
    };
  }
}
fs.writeFileSync(
  "docs/dataverse-verification.json",
  JSON.stringify(output, null, 2),
);
console.log(
  JSON.stringify(
    {
      ...output,
      fieldChecks: output.fieldChecks.map(({ select, ...rest }) => rest),
    },
    null,
    2,
  ),
);
