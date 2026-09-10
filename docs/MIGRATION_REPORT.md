# Patient Discharge Code App migration

Local implementation and build verified on 10 September 2026. Browser acceptance, live writes and Power Automate outcomes remain unverified. Nothing has been pushed or published.

## 1. Project structure

`src/App.tsx` coordinates navigation and refresh. `src/pages/` contains the five screens; `src/components/` contains shared UI; `src/services/` contains generated-service adapters and workflow polling; `src/config/` contains reference mappings and metadata helpers; `src/presentation/` contains display helpers; `src/hooks/` contains asynchronous loading; `src/styles/app.css` retains the source design. CLI-generated files are in `src/generated/`, with metadata in `.power/schemas/dataverse/`. `scripts/` contains read-only diagnostics and reference extraction. Production output is `dist/`.

The original `Patient Discharge.html` remains unchanged. SHA256: `0CAF321F3026E27A5607501A3CB75F7793C7F225B040F03AC9B42353D39226FB`. Initial inspection and field inventory are in this directory.

## 2–3. Tables and generated services/models

Each service uses its corresponding generated model (same name without `Service`). No duplicate handwritten entity model is maintained.

| Logical table | Generated service | Use |
|---|---|---|
| crad2_patientdischarge | Crad2_patientdischargesService | Worklist, workspace and workflow parent reads |
| crad2_dischargeactivity | Crad2_dischargeactivitiesService | Actual activity rows, action updates and files |
| and_earlydischarge | And_earlydischargesService | Existing parents and submission |
| and_earlydischarge_ipdvisits | And_earlydischarge_ipdvisitsesService | Related child reads and creation |
| and_inpatientlist | And_inpatientlistsService | Search and patient details |
| and_whatsappnotification | And_whatsappnotificationsService | Related alerts and creation |
| team | TeamsService | Forward To Team lookup |
| systemuser | SystemusersService | Generated user reference source |
| and_delayreasons | And_delayreasonsesService | Required activity Delay Reason lookup |

All nine tables were verified readable. Delay Reasons came from the original implementation, not a guessed table. Runtime calls use generated services and Power Apps authentication; no organization URL or credential is embedded in runtime application code. Platform context supplies record-link organization information. Reference: [Microsoft Code Apps Dataverse guidance](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-dataverse).

## 4. Components and screens

Pages: DashboardPage, WorklistPage, PatientWorkspacePage, EarlyDischargePage and EarlyDraftPage. The dashboard is embedded in the worklist as in the source.

Components: AppShell, NavigationRail, TopBar, StatusBadge, PatientIdentity, DischargeState, ActivityTimeline, ActivityPanel, AlertsPanel, FilterBar, LoadingState, ErrorState, RecordLink, LookupInput and Modal. Original forest green, bronze, cream and compact table styling is retained in CSS. Visual equivalence still needs a browser comparison.

## 5. Migrated behavior/functions

| Source responsibility | Implementation |
|---|---|
| Dataset retrieval, filters and ordering | dischargeService.list/get, filterPatients, WorklistPage |
| KPI calculations | DashboardPage, original display helpers |
| Patient identity and additional details | PatientIdentity, DischargeState, PatientWorkspacePage |
| Related activities/current activity | activityService.list, currentActivity, ActivityTimeline |
| Initiation, medications, pharmacy, financial, physical and room-cleaning forms | activityRules, buildActivityPayload, ActivityPanel |
| Required fields and forwarding | buildActivityPayload, searchTeams, searchDelayReasons |
| Comments and attachments | activityService.save/upload/download |
| Refresh after save | captureDischargeWorkflowState, pollDischargeWorkflow |
| Early/Planned selection and submission | earlyDischargeService, EarlyDraftPage |
| Alerts | alertService, AlertsPanel |
| Safe display and labels | presentation/format.ts, metadata helpers and source mappings |

Initiation requires instructions, pharmacy return, action and delay reason. Home Medications Preparation requires delay reason. Physical clearing requires three answers, retaining valid zero values; forwarding defaults only blank answers to Not Done. Team is required for forwarding. Clearing writes the action timestamp. Failed writes are reported rather than retried with silently removed fields. Upload is a separate immediate generated file operation on `new_attachment`.

## 6. Platform differences and metadata corrections

Xrm context/navigation is replaced by Code App context and model-driven record links. Quick Create is represented by the app alert form, with an existing model-driven form link as a manual fallback; it is not an embedded Xrm Quick Create dialog. Links require runtime organization context.

Verified current fields replace stale aliases where justified: gender `new_gender`, file scan status `cr301_filescanstatus`, inpatient visit `and_visitid`, child patient lookup `_and_patientcode_value`. `crad2_patientidlookup` is a string, so it must not be queried as a synthetic lookup. Invalid/nonexistent select fields are excluded using generated metadata.

The Early Discharge count is `crda1_countofpatients`, a read-only rollup. The migrated app does not attempt the source's invalid count update. Other unavailable source fields, including `and_isdelayed`, are not invented. Missing values remain empty; this can affect delayed indicators. Original KPI formulas and their existing “Today” labels are retained; they operate on the filtered dataset and are not a newly introduced calendar-day aggregation.

## 7. Choices

Raw values are retained for writes. Display prefers Dataverse formatted annotations, then generated Choice metadata, then the original reference mappings. Zero is valid. Unknown Choices receive a readable unavailable label rather than displaying raw integer codes. Boolean and Choice fields are kept distinct, including the two pharmacy-return representations.

## 8. Lookups

Lookup IDs remain internal; formatted names are displayed. Relationship navigation names come from verified metadata. Writes use `@odata.bind`, including `crad2_ForwardToTeam`, `and_DelayReason`, `and_EarlyDischarge`, `and_PatientCode` and `and_Patient`. Read-only owner, previous-activity and business-unit fields do not introduce new write behavior. Search inputs escape apostrophes for OData.

## 9. Paging and performance

`allPages` follows generated SDK `skipToken` values until exhausted, requests up to 5,000 rows per page, rejects repeated tokens and fails on incomplete reads. Worklist order is `createdon DESC` with primary-ID tie breaking. Filters and KPIs wait for the complete returned dataset. Search uses a 400 ms debounce. Activity enrichment caches requests; activity saves invalidate the worklist for refresh on return instead of repeatedly restarting the full load.

Read-only diagnostics counted **31,315 unique discharge records in seven pages** using only primary ID and Created On (`worklist-index-verification.json`). This confirms index paging, not completion of the wide screen dataset. The full display-field query returned 3,250 rows over 13 pages before the three-minute diagnostic budget expired (`dataverse-verification.json`). Loading all display fields is a material remaining performance issue. The app reports loaded rows and has no arbitrary record cap. An already-running SDK request cannot be canceled by the adapter; cancellation prevents subsequent pages and stale results.

## 10. Workflow polling

After saving, the app re-reads the parent and all related activities at approximately two-second intervals, with a nominal 26-second polling budget. It compares parent state, ownership and actual activity changes. The target action PATCH and `modifiedon` alone do not count as workflow progression. Network request duration can extend the polling budget. A timeout is displayed separately from save failure. Navigation cancels further polling. The frontend never creates next-step activities or simulates completion; existing Power Automate flows remain authoritative.

## 11. Alerts

Only `and_whatsappnotification` is used. Related reads filter `_and_patient_value` by the current discharge and order by Created On descending. Primary key is `and_whatsappnotificationid`; primary display field is `and_id`. Creation supplies required comment (`and_comment`, maximum 5,000 characters) and `and_Patient@odata.bind` to the existing discharge. Server-managed IDs/status/ownership remain server-managed. Status and flag Choices use formatted labels; no unsupported severity field was invented. Relationship evidence is in `dataverse-verification.json`.

## 12. Early Discharge

The list retrieves existing parent drafts. Users choose Early or Planned before inpatient search; suggestions preserve the source's 25-result search limit, separate from full worklist paging. Adding creates a child with the existing parent and inpatient relationships, name, visit and type. Duplicate checks and a fresh parent-status check run before writes. Submission updates only `and_statusnew` to 1. Submitted parents are read-only. The frontend creates no daily parent draft. The draft workspace counts loaded children; the parent list displays the backend rollup, which may update asynchronously.

## 13. Validation and remaining issues

- Production TypeScript/Vite build passes; all 20 regression tests pass. Tests cover paging failure/completion, valid zero Choices, conditional validation, write contracts, duplicate/submission behavior and workflow signals/timeouts. Generated calls are mocked in write tests.
- All nine table reads and six screen query contracts were accepted by live Dataverse using the signed-in CLI account. This does not verify browser platform authentication or generated-service runtime writes.
- Both local servers returned HTTP 200 on ports 3000 and 8080. No connected browser was available for visual, console or interactive validation.
- Live activity saves, attachment upload/download, forwarding, alerts, Early Discharge creation/submission and actual Power Automate outcomes remain unverified. No test record was changed.
- Full display-dataset performance and missing source metadata fields require acceptance review. The production bundle also has a non-fatal Vite warning at about 520 kB minified.
- Original HTML remains available. Build success is not full migration acceptance. No push was executed; appId remains null.

For browser acceptance, open the local preview below, confirm authenticated loading and newest-first order, inspect patient details and formatted names, then use disposable records to exercise each action, upload/download, forwarding, alerts and Early/Planned submission. Confirm resulting Dataverse rows and backend transitions independently; compare layout with the original HTML and inspect browser errors.

## 14. Exact local/build commands

Run from PowerShell:

```powershell
Set-Location C:\data\Discharge
npm.cmd test
npm.cmd run build
```

If restarting local preview after the current servers stop:

```powershell
Set-Location C:\data\Discharge
pa.cmd app run --non-interactive
```

CLI 1.0.0 starts the local app and connection server. Open:

[Local Power Apps preview](https://apps.powerapps.com/play/e/c8248b45-2429-e200-8a28-7f838b087b5b/app/local?_localAppUrl=http://localhost:3000&_localConnectionUrl=http://localhost:8080)

## 15. Later push command — not executed

Only after acceptance and the user's decision to publish:

```powershell
Set-Location C:\data\Discharge
npm.cmd run build
pa.cmd app push
```

The command is the verified installed CLI command. The local preview link is not a deployed application URL.
