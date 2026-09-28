import { useState, type ReactNode } from "react";
import {
  activityRules,
  activityService,
  searchDelayReasons,
  searchTeams,
  type Activity,
  type ActivityInput,
} from "../services/activityService";
import { choiceOptions, physicalQuestions, tables } from "../config/schema";
import { displayValue } from "../presentation/format";
import { LookupInput } from "./LookupInput";
import { errorMessage } from "./ErrorState";
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="form-row">
      <div className="label">{label}</div>
      {children}
    </div>
  );
}
function Select({
  label,
  value,
  change,
  options,
}: {
  label: string;
  value: string;
  change: (v: string) => void;
  options: Record<string, string>;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => change(e.target.value)}
    >
      <option value="">---</option>
      {Object.entries(options).map(([v, name]) => (
        <option key={v} value={v}>
          {name}
        </option>
      ))}
    </select>
  );
}
export function ActivityPanel({
  activity,
  onSave,
  busy,
  refresh,
}: {
  activity: Activity;
  onSave: (input: ActivityInput) => Promise<void>;
  busy: boolean;
  refresh: () => void;
}) {
  const rules = activityRules(activity);
  const [input, setInput] = useState<ActivityInput>({
    action: "",
    instructions: "",
    pharmacyReturn: "",
    followUp: "",
    comment: activity.new_comment || "",
    physical: {},
  });
  const [fileBusy, setFileBusy] = useState(false);
  const [message, setMessage] = useState("");
  const set = <K extends keyof ActivityInput>(
    key: K,
    value: ActivityInput[K],
  ) => setInput((i) => ({ ...i, [key]: value }));
  async function upload(file?: File) {
    if (!file) return;
    setFileBusy(true);
    setMessage("");
    try {
      await activityService.upload(activity.crad2_dischargeactivityid, file);
      setMessage("The attachment was uploaded successfully.");
      refresh();
    } catch (e) {
      console.error("Attachment upload", e);
      setMessage(errorMessage(e));
    } finally {
      setFileBusy(false);
    }
  }
  async function download() {
    setFileBusy(true);
    try {
      const file = await activityService.download(
        activity.crad2_dischargeactivityid,
      );
      const binary = atob(file.data || "");
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes]));
      const a = document.createElement("a");
      a.href = url;
      a.download = file.fileName || activity.new_attachment_name || "attachment";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error("Attachment download", e);
      setMessage(errorMessage(e));
    } finally {
      setFileBusy(false);
    }
  }
  return (
    <div className="activity-form">
      <form
        className="activity-form-inner"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(input);
        }}
      >
        <div>
          <div className="panel-label">Activity Update</div>
          <div className="activity-title">{activity.crad2_subject}</div>
        </div>
        <fieldset disabled={busy || fileBusy}>
          <Field label="Subject">
            <input
              aria-label="Subject"
              disabled
              value={activity.crad2_subject}
            />
          </Field>
          {rules.initiation && (
            <>
              <Field label="Discharge Instructions *">
                <Select
                  label="Discharge Instructions"
                  value={input.instructions}
                  change={(v) => set("instructions", v)}
                  options={{ true: "Yes", false: "No" }}
                />
              </Field>
              <Field label="Pharmacy Return *">
                <Select
                  label="Pharmacy Return"
                  value={input.pharmacyReturn}
                  change={(v) => set("pharmacyReturn", v)}
                  options={{ true: "Yes", false: "No" }}
                />
              </Field>
              <Field label="Follow Up Date">
                <input
                  aria-label="Follow Up Date"
                  type="date"
                  value={input.followUp}
                  onChange={(e) => set("followUp", e.target.value)}
                />
              </Field>
            </>
          )}
          <Field label="Action *">
            <Select
              label="Action"
              value={input.action}
              change={(v) => set("action", v)}
              options={choiceOptions(tables.activity, "crad2_status")}
            />
          </Field>
          {rules.delay && (
            <Field label="Delay Reason *">
              <LookupInput
                label="Look for Delay Reason"
                search={searchDelayReasons}
                value={input.delayReason}
                onChange={(v) => set("delayReason", v)}
              />
            </Field>
          )}
          {rules.physical &&
            input.action === "408520000" &&
            physicalQuestions.map(([field, label]) => (
              <Field label={label + " *"} key={field}>
                <Select
                  label={label}
                  value={input.physical[field] ?? ""}
                  change={(v) =>
                    set("physical", { ...input.physical, [field]: v })
                  }
                  options={choiceOptions(tables.activity, field)}
                />
              </Field>
            ))}
          <Field label="Comment">
            <textarea
              aria-label="Comment"
              rows={3}
              value={input.comment}
              onChange={(e) => set("comment", e.target.value)}
            />
          </Field>
          <Field label="Attachment">
            <div>
              <input
                aria-label="Attachment"
                type="file"
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {activity.new_attachment && (
                <button type="button" onClick={() => void download()}>
                  Download
                </button>
              )}
            </div>
          </Field>
          {input.action === "2" && (
            <Field label="Forward To *">
              <LookupInput
                label="Search team to forward..."
                search={searchTeams}
                value={input.team}
                onChange={(v) => set("team", v)}
              />
            </Field>
          )}
          <Field label="Owner">
            <input
              aria-label="Owner"
              disabled
              value={displayValue(activity, "_ownerid_value")}
            />
          </Field>
          <Field label="Previous Activity">
            <input
              aria-label="Previous Activity"
              disabled
              value={displayValue(activity, "_crad2_previousactivity_value")}
            />
          </Field>
          <div className="form-actions">
            <button className="btn-primary" type="submit">
              {busy ? "Saving..." : "Save Activity"}
            </button>
          </div>
        </fieldset>
        {message && (
          <div role="status" className="small">
            {message}
          </div>
        )}
      </form>
    </div>
  );
}
