# Migration inspection

Source: `Patient Discharge.html` (2,797 lines), read before Code App authoring. Handoff document read in full. The original file remains untouched.

## Modules and behavior

Worklist with embedded dashboard KPI cards; expanded related activity rows; patient workspace with identity, current state, current activity, activity form, timeline, and alerts; Early Discharge draft list and draft workspace; team and delay-reason lookup dropdowns; message and quick-create dialogs.

Activity selection uses the first non-cleared real activity, falling back to the last. Activities are ordered by `and_startdate`. No frontend activity creation exists. Request Initiation requires discharge instructions, pharmacy return, action, and Delay Reason. Home Medications Preparation requires action and Delay Reason. Physical Discharge clearing requires all three confirmations (0 is valid); forwarding defaults only blank confirmations to Not Done (2). Other activities use the shared action/comment/attachment form. Forwarding requires a selected team. Cleared writes `crad2_actiondate`.

## Data operations

| Table | Read | Create | Update |
|---|---|---|---|
| crad2_patientdischarge | Complete worklist, individual parent, polling | No | No |
| crad2_dischargeactivity | Related activities, current activity, polling | No | Action, comment, request fields, physical confirmations, delay/team lookups, attachment |
| and_earlydischarge | Existing drafts | No | Source attempted patient count; migration writes only and_statusnew = 1 on submit because verified count is a read-only rollup |
| and_earlydischarge_ipdvisits | Related child rows | Link draft and inpatient, type/name/visit | No |
| and_inpatientlist | Search and child hydration | No | No |
| and_whatsappnotification | Related alerts | Comment linked to existing discharge | No |
| team | Forward lookup | No | No |
| systemuser | User context/reference | No | No |
| and_delayreasons | Required lookup on initiation/home medications | No | No |

No delete operation is part of the source UI. Patient, business unit, owner, previous activity and created/submitted-by values are display-only lookups. Additional data sources should only be added when verified metadata makes them necessary.

## Platform dependencies

Replace Xrm client URL and raw fetch with generated Power Apps services. Replace Xrm user settings with Code App context. Replace Xrm Navigation.openForm with a platform-supported navigation approach, if available. Attachment column is `new_attachment`; use generated file helpers. Preserve actual backend workflow with 2-second polling and 26-second timeout; successful activity update alone is not workflow completion.

## Explicit changes requested over the HTML

- Worklist ordering is now `createdon DESC` (HTML used last activity).
- Retrieve complete pages (HTML's loadPatientDataset explicitly disabled fetching all pages).
- Alert table is explicitly `and_whatsappnotification`; no guessed alert tables.

## Preservation notes

Copy original CSS rules into the stylesheet; replace imperative DOM construction with React components. Preserve fallback choices, including boolean versus integer distinctions, and formatted names. The source KPI formulas sum pending plus delayed and use delayed-or-pending for Priority, on filtered worklist rows. Preserve those formulas while providing the complete dataset.

The original metadata retry code can silently drop rejected write fields and guesses plural table names. The migration must instead validate metadata and surface a failed operation, avoiding silently incomplete saves.
