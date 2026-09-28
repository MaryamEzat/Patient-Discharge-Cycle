import type { And_whatsappnotifications } from "../generated/models/And_whatsappnotificationsModel";
import { attribute, binding, guid, tables } from "../config/schema";
import { allPages, OperationalError, unwrap } from "./data";
import { createRecordOrg, listRecordsOrg } from "./dataverseAdapter";
export const alertService = {
  list(id: string) {
    return allPages((opts) => listRecordsOrg<And_whatsappnotifications>(tables.alert, opts), {
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
      filter: `_and_patient_value eq ${guid(id)}`,
      orderBy: ["createdon desc"],
    });
  },
  async create(id: string, comment: string) {
    if (!comment.trim())
      throw new OperationalError("Enter an alert comment before saving.");
    if (
      comment.length >
      (attribute(tables.alert, "and_comment")?.maxLength ?? 5000)
    )
      throw new OperationalError("The alert comment is too long.");
    // Both required business fields are verified in generated metadata. Server supplies ID, state and owner.
    const payload = {
      and_comment: comment.trim(),
      ...binding(tables.alert, "and_patient", tables.patient, id),
    };
    unwrap(
      await createRecordOrg(tables.alert, payload as Record<string, unknown>),
      "Saving alert",
    );
  },
};
