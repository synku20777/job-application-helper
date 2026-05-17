import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { isSensitiveField, stepFromMatch } from "@job-helper/autofill-core";
import { sampleProfile, safeParseCandidateProfile, type CandidateProfile } from "@job-helper/profile-schema";
import type { CanonicalFieldKey, ExtensionResponse, FillPlan, FillStep, FormFieldNode, PlatformDetection, SiteMappingOverride } from "@job-helper/shared";
import { CANONICAL_FIELD_KEYS } from "@job-helper/shared";
import "../ui.css";

type ScanState = {
  fields: FormFieldNode[];
  platform: PlatformDetection;
  url: string;
};

async function send(message: unknown): Promise<ExtensionResponse> {
  return chrome.runtime.sendMessage(message);
}

function selectedAutoSteps(plan: FillPlan | null): string[] {
  return (
    plan?.steps
      .filter((step) => step.type !== "manual" && step.type !== "uploadFile" && !step.requiresReview)
      .map((step) => step.target.elementId) ?? []
  );
}

function hostnameFromUrl(url: string | undefined): string {
  try {
    return new URL(url ?? "about:blank").hostname.toLowerCase();
  } catch {
    return "";
  }
}

function stepCanonicalKey(step: FillStep): CanonicalFieldKey | undefined {
  return "canonicalKey" in step ? step.canonicalKey : undefined;
}

function stepStatus(step: FillStep): string {
  if (step.type === "uploadFile") return "upload";
  if (step.type === "manual") return "manual";
  if (step.requiresReview) return "review";
  return "auto";
}

function valuePreview(step: FillStep): string {
  if (step.type === "setText" || step.type === "selectOption") return step.value;
  if (step.type === "clickCheckbox") return step.checked ? "Yes" : "No";
  if (step.type === "uploadFile") return step.documentId;
  return step.reason;
}

function canFill(step: FillStep): boolean {
  return step.type !== "manual" && step.type !== "uploadFile";
}

function App() {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [profileJson, setProfileJson] = useState(JSON.stringify(sampleProfile, null, 2));
  const [scan, setScan] = useState<ScanState | null>(null);
  const [plan, setPlan] = useState<FillPlan | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, CanonicalFieldKey>>({});
  const [siteOverride, setSiteOverride] = useState<SiteMappingOverride | null>(null);
  const [status, setStatus] = useState<string>("Import or create a profile, then scan the active page.");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void send({ type: "GET_SELECTED_PROFILE" }).then((response) => {
      if (response.ok && response.type === "GET_SELECTED_PROFILE") {
        setProfile(response.profile);
        if (response.profile) setProfileJson(JSON.stringify(response.profile, null, 2));
      }
    });
  }, []);

  function fieldForStep(step: FillStep): FormFieldNode | undefined {
    return scan?.fields.find((field) => field.elementId === step.target.elementId);
  }

  function applyDraftToStep(step: FillStep): FillStep {
    const draftKey = mappingDrafts[step.target.elementId];
    if (!draftKey || !profile || !plan) return step;

    const field = fieldForStep(step);
    if (!field) return step;

    return stepFromMatch(
      {
        elementId: field.elementId,
        canonicalKey: draftKey,
        confidence: 1,
        evidence: [{ type: "userOverride", text: step.target.label, weight: 1 }],
        adapterId: plan.adapterId,
        fillable: field.visible && !field.disabled,
        requiresReview: isSensitiveField(draftKey),
        node: field
      },
      profile
    );
  }

  const effectivePlan = useMemo<FillPlan | null>(() => {
    if (!plan) return null;
    return { ...plan, steps: plan.steps.map(applyDraftToStep) };
  }, [plan, mappingDrafts, profile, scan]);

  const counts = useMemo(() => {
    const steps = effectivePlan?.steps ?? [];
    return {
      auto: steps.filter((step) => canFill(step) && !step.requiresReview).length,
      review: steps.filter((step) => step.requiresReview).length,
      manual: steps.filter((step) => step.type === "manual" || step.type === "uploadFile").length
    };
  }, [effectivePlan]);

  const diagnostics = useMemo(() => {
    const hostname = hostnameFromUrl(scan?.url);
    return {
      adapterId: scan?.platform.adapterId ?? "none",
      hostname: hostname || "unknown",
      fieldCount: scan?.fields.length ?? 0,
      stepCount: effectivePlan?.steps.length ?? 0,
      warningCount: effectivePlan?.warnings.length ?? 0,
      overrideCount: siteOverride?.fields.length ?? 0
    };
  }, [scan, effectivePlan, siteOverride]);

  async function loadSiteOverrides(nextScan: ScanState): Promise<SiteMappingOverride | null> {
    const hostname = hostnameFromUrl(nextScan.url);
    if (!hostname) {
      setSiteOverride(null);
      return null;
    }

    const response = await send({ type: "GET_SITE_OVERRIDES", hostname, adapterId: nextScan.platform.adapterId });
    if (response.ok && response.type === "GET_SITE_OVERRIDES") {
      setSiteOverride(response.override);
      return response.override;
    }

    if (!response.ok) setError(response.error);
    return null;
  }

  async function saveProfileFromJson() {
    setError(null);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(profileJson) as unknown;
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Invalid JSON.");
      return;
    }

    const result = safeParseCandidateProfile(parsedJson);
    if (!result.success) {
      setError(result.error.issues.map((issue) => issue.message).join("; "));
      return;
    }
    const response = await send({ type: "SAVE_PROFILE", profile: result.data });
    if (response.ok && response.type === "SAVE_PROFILE") {
      setProfile(response.profile);
      setStatus("Profile saved locally.");
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function exportProfile() {
    const response = await send({ type: "EXPORT_PROFILE" });
    if (response.ok && response.type === "EXPORT_PROFILE" && response.profile) {
      setProfileJson(JSON.stringify(response.profile, null, 2));
      setStatus("Profile loaded into the editor for export.");
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function deleteData() {
    const response = await send({ type: "DELETE_ALL_DATA" });
    if (response.ok) {
      setProfile(null);
      setPlan(null);
      setSiteOverride(null);
      setMappingDrafts({});
      setAccepted(new Set());
      setStatus("Local profile data deleted.");
    } else {
      setError(response.error);
    }
  }

  async function scanPage() {
    setError(null);
    setPlan(null);
    setMappingDrafts({});
    const response = await send({ type: "SCAN_PAGE" });
    if (response.ok && response.type === "SCAN_PAGE") {
      const nextScan = { fields: response.fields, platform: response.platform, url: response.url };
      setScan(nextScan);
      const override = await loadSiteOverrides(nextScan);
      setStatus(`Detected ${response.fields.length} fields on ${response.platform.label}. ${override?.fields.length ?? 0} saved mappings found.`);
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function buildPlan() {
    if (!profile || !scan) {
      setError("Save a profile and scan a page first.");
      return;
    }
    const response = await send({ type: "BUILD_FILL_PLAN", profile, fields: scan.fields, platform: scan.platform });
    if (response.ok && response.type === "BUILD_FILL_PLAN") {
      setPlan(response.plan);
      setSiteOverride(response.options?.siteOverride ?? siteOverride);
      setMappingDrafts({});
      setAccepted(new Set(selectedAutoSteps(response.plan)));
      setStatus("Fill plan ready for review.");
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function fillAccepted() {
    if (!effectivePlan) return;
    const response = await send({ type: "EXECUTE_FILL_PLAN", plan: effectivePlan, acceptedElementIds: Array.from(accepted) });
    if (response.ok && response.type === "EXECUTE_FILL_PLAN") {
      const { completedSteps, skippedSteps, manualSteps, status: fillStatus } = response.result;
      setStatus(`Fill ${fillStatus}: ${completedSteps} filled, ${skippedSteps} skipped, ${manualSteps} manual.`);
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  function toggleAccepted(elementId: string) {
    setAccepted((current) => {
      const next = new Set(current);
      if (next.has(elementId)) next.delete(elementId);
      else next.add(elementId);
      return next;
    });
  }

  function changeMapping(elementId: string, canonicalKey: CanonicalFieldKey) {
    setMappingDrafts((current) => ({ ...current, [elementId]: canonicalKey }));
    setAccepted((current) => {
      const next = new Set(current);
      next.delete(elementId);
      return next;
    });
  }

  async function saveMapping(step: FillStep) {
    if (!scan) return;
    const canonicalKey = stepCanonicalKey(applyDraftToStep(step));
    const hostname = hostnameFromUrl(scan.url);
    if (!canonicalKey || !hostname) return;

    const response = await send({
      type: "SAVE_SITE_OVERRIDE",
      hostname,
      adapterId: scan.platform.adapterId,
      override: {
        canonicalKey,
        elementSelector: step.target.selector,
        label: step.target.label
      }
    });

    if (response.ok && response.type === "SAVE_SITE_OVERRIDE") {
      const savedStep = applyDraftToStep(step);
      setSiteOverride(response.override);
      setPlan((current) =>
        current
          ? {
              ...current,
              steps: current.steps.map((candidate) => (candidate.target.elementId === step.target.elementId ? savedStep : candidate))
            }
          : current
      );
      setMappingDrafts((current) => {
        const next = { ...current };
        delete next[step.target.elementId];
        return next;
      });
      setStatus("Mapping saved for this site.");
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  return (
    <main className="panel-shell">
      <header className="panel-header">
        <div>
          <h1>Job Autofill</h1>
          <p>{profile ? profile.meta.label : "No profile saved"}</p>
        </div>
        <button onClick={scanPage}>Scan page</button>
      </header>

      {error ? <p className="notice error">{error}</p> : <p className="notice">{status}</p>}

      <section className="section">
        <h2>Profile JSON</h2>
        <textarea
          className="json-editor"
          value={profileJson}
          onChange={(event) => setProfileJson(event.target.value)}
          spellCheck={false}
        />
        <div className="button-row">
          <button className="primary" onClick={saveProfileFromJson}>
            Save profile
          </button>
          <button onClick={exportProfile}>Export</button>
          <button className="danger" onClick={deleteData}>
            Delete data
          </button>
        </div>
      </section>

      <section className="section">
        <h2>Detected Fields</h2>
        <div className="summary-grid">
          <span>{scan?.platform.label ?? "No scan"}</span>
          <span>{scan?.fields.length ?? 0} fields</span>
          <button disabled={!scan || !profile} onClick={buildPlan}>
            Build fill plan
          </button>
        </div>
        <div className="field-list">
          {(scan?.fields ?? []).slice(0, 20).map((field) => (
            <div key={field.elementId} className="field-row">
              <strong>{field.associatedLabelText ?? field.ariaLabel ?? field.placeholder ?? field.name ?? field.tagName}</strong>
              <span>
                {field.tagName}
                {field.inputType ? `/${field.inputType}` : ""}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Diagnostics</h2>
        <div className="diagnostics-grid">
          <span>Adapter: {diagnostics.adapterId}</span>
          <span>Host: {diagnostics.hostname}</span>
          <span>Detected: {diagnostics.fieldCount}</span>
          <span>Planned: {diagnostics.stepCount}</span>
          <span>Warnings: {diagnostics.warningCount}</span>
          <span>Saved mappings: {diagnostics.overrideCount}</span>
        </div>
      </section>

      <section className="section">
        <h2>Fill Plan</h2>
        <div className="summary-grid">
          <span>{counts.auto} auto</span>
          <span>{counts.review} review</span>
          <span>{counts.manual} manual</span>
        </div>
        <div className="field-list">
          {(effectivePlan?.steps ?? []).map((effectiveStep) => {
            const originalStep = plan?.steps.find((step) => step.target.elementId === effectiveStep.target.elementId) ?? effectiveStep;
            const currentKey = stepCanonicalKey(effectiveStep);
            const originalKey = stepCanonicalKey(originalStep);
            const draftChanged = Boolean(mappingDrafts[effectiveStep.target.elementId] && currentKey !== originalKey);
            const fillable = canFill(effectiveStep);

            return (
              <div
                key={`${effectiveStep.target.elementId}-${effectiveStep.type}`}
                className={`plan-row plan-row-${effectiveStep.type}${effectiveStep.requiresReview ? " plan-row-review" : ""}`}
              >
                <input
                  type="checkbox"
                  disabled={!fillable}
                  checked={accepted.has(effectiveStep.target.elementId)}
                  onChange={() => toggleAccepted(effectiveStep.target.elementId)}
                  title={fillable ? "Include this field" : "Manual fields cannot be filled automatically"}
                />
                <div className="plan-row-body">
                  <div className="plan-row-main">
                    <strong>{effectiveStep.target.label}</strong>
                    <span className={`status-pill status-${stepStatus(effectiveStep)}`}>{stepStatus(effectiveStep)}</span>
                  </div>
                  <small>
                    {currentKey ?? "No mapping"} - {valuePreview(effectiveStep)}
                    {"confidence" in effectiveStep ? ` - ${Math.round(effectiveStep.confidence * 100)}%` : ""}
                    {effectiveStep.requiresReview ? " - review required" : ""}
                  </small>
                  <div className="mapping-row">
                    <select
                      value={currentKey ?? ""}
                      disabled={effectiveStep.type === "uploadFile"}
                      onChange={(event) => changeMapping(effectiveStep.target.elementId, event.target.value as CanonicalFieldKey)}
                    >
                      <option value="" disabled>
                        Select mapping
                      </option>
                      {CANONICAL_FIELD_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </select>
                    <button disabled={!draftChanged || !currentKey} onClick={() => saveMapping(originalStep)}>
                      Save mapping
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <button className="primary" disabled={!effectivePlan} onClick={fillAccepted}>
          Fill accepted fields
        </button>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
