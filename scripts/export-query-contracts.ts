import { writeFileSync, mkdirSync } from "node:fs";
import { patientSelect } from "../src/services/dischargeService";
import { activitySelect } from "../src/services/activityService";
import {
  draftSelect,
  childSelect,
  inpatientSelect,
} from "../src/services/earlyDischargeService";
import { entitySet, tables } from "../src/config/schema";
const contracts = [
  {
    table: tables.patient,
    select: patientSelect,
    orderBy: ["createdon desc", "crad2_patientdischargeid asc"],
  },
  {
    table: tables.activity,
    select: activitySelect,
    orderBy: ["and_startdate asc", "crad2_dischargeactivityid asc"],
  },
  {
    table: tables.early,
    select: draftSelect,
    orderBy: ["and_dischargedate desc"],
  },
  { table: tables.earlyChild, select: childSelect, orderBy: ["createdon asc"] },
  { table: tables.inpatient, select: inpatientSelect, orderBy: [] },
  {
    table: tables.alert,
    select: [
      "and_whatsappnotificationid",
      "and_id",
      "and_comment",
      "_and_patient_value",
      "createdon",
      "_createdby_value",
      "statuscode",
      "statecode",
      "_ownerid_value",
    ],
    orderBy: ["createdon desc"],
  },
].map((c) => ({ ...c, entitySet: entitySet(c.table) }));
mkdirSync(".local", { recursive: true });
writeFileSync(
  ".local/query-contracts.json",
  JSON.stringify(contracts, null, 2),
);
console.log(
  `Exported ${contracts.length} query contracts from the application services.`,
);
