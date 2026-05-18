# **Universal Application Form Parser — Refactor Plan**

## **Strategic goal**

Move from:

Thick ATS adapters

  → platform-specific selectors

  → platform-specific fill logic

  → duplicated synonym matching

  → brittle expansion

To:

Universal form parser

  → normalized FieldCandidate\[\]

  → semantic matcher

  → FillPlan

  → centralized FillDrivers

  → thin adapter hints

  → local learning / site recipes

The final architecture should make most new platforms work through the generic scanner and matcher, while adapters only patch platform quirks.

---

# **Target architecture**

packages/

├── profile-schema/

│   ├── candidateProfile.schema.ts

│   ├── valueResolver.ts

│   └── migrations/

│

├── autofill-core/

│   ├── fieldOntology.ts

│   ├── matcher.ts

│   ├── confidence.ts

│   ├── optionMatcher.ts

│   ├── fillPlanBuilder.ts

│   ├── orchestrator.ts

│   └── overrides.ts

│

├── dom-utils/

│   ├── scanner.ts

│   ├── labels.ts

│   ├── nearbyText.ts

│   ├── sections.ts

│   ├── repeatableGroups.ts

│   └── accessibility.ts

│

├── fill-drivers/

│   ├── FillDriver.ts

│   ├── driverRegistry.ts

│   ├── nativeTextDriver.ts

│   ├── nativeTextareaDriver.ts

│   ├── nativeSelectDriver.ts

│   ├── radioGroupDriver.ts

│   ├── checkboxDriver.ts

│   ├── comboboxDriver.ts

│   ├── fileUploadDriver.ts

│   └── datePickerDriver.ts

│

├── adapters/

│   ├── AtsAdapter.ts

│   ├── genericAdapter.ts

│   ├── workdayAdapter.ts

│   ├── greenhouseAdapter.ts

│   ├── personioAdapter.ts

│   ├── smartRecruitersAdapter.ts

│   └── linkedinCopyOnlyAdapter.ts

│

└── shared/

    ├── types.ts

    ├── messages.ts

    └── errors.ts

---

# **Phase 1 — Decouple execution: extract Fill Drivers**

## **Goal**

Stop adapters from mutating the DOM directly. All field writing should go through centralized drivers.

## **Target area**

packages/fill-drivers/

or, if you want fewer packages:

packages/autofill-core/src/fill-drivers/

## **Tasks**

### **1.1 Define driver interfaces**

export interface FillDriver {

  id: string;

  supports(candidate: FieldCandidate): boolean;

  fill(

    candidate: FieldCandidate,

    value: unknown,

    context: FillExecutionContext

  ): Promise\<DriverFillResult\>;

  verify?(

    candidate: FieldCandidate,

    value: unknown,

    context: FillExecutionContext

  ): Promise\<VerificationResult\>;

}

export type DriverFillResult \= {

  status: "filled" | "skipped" | "failed" | "manual";

  candidateId: string;

  driverId: string;

  actualValue?: unknown;

  error?: AutofillError;

};

export type FillExecutionContext \= {

  document: Document;

  window: Window;

  dryRun?: boolean;

  timeoutMs?: number;

  debug?: boolean;

};

### **1.2 Implement basic native drivers**

Implement:

nativeTextDriver

nativeTextareaDriver

nativeSelectDriver

radioGroupDriver

checkboxDriver

Minimum support:

\<input type="text"\>

\<input type="email"\>

\<input type="tel"\>

\<input type="number"\>

\<textarea\>

\<select\>

\<input type="radio"\>

\<input type="checkbox"\>

### **1.3 Create driver registry**

export const driverRegistry: FillDriver\[\] \= \[

  nativeTextDriver,

  nativeTextareaDriver,

  nativeSelectDriver,

  radioGroupDriver,

  checkboxDriver

\];

export function resolveDriver(candidate: FieldCandidate): FillDriver | null {

  return driverRegistry.find((driver) \=\> driver.supports(candidate)) ?? null;

}

### **1.4 Refactor existing adapters partially**

Update:

workdayAdapter

greenhouseAdapter

personioAdapter

smartRecruitersAdapter

So they no longer do this:

input.value \= profile.personal.firstName;

They should call:

const driver \= resolveDriver(candidate);

await driver?.fill(candidate, value, context);

## **Acceptance criteria**

\- Existing ATS support still works.

\- No adapter directly mutates input.value.

\- All fill operations route through driverRegistry.

\- Driver-level tests cover text, textarea, select, radio, and checkbox behavior.

---

# **Phase 2 — Standardize inputs: introduce FieldCandidate**

## **Goal**

Make every adapter output a normalized representation of page fields instead of performing actions immediately.

## **Target area**

packages/shared/src/types.ts

packages/adapters/

## **Core model**

export type FieldCandidate \= {

  id: string;

  element: HTMLElement;

  controlType:

    | "text"

    | "textarea"

    | "email"

    | "phone"

    | "number"

    | "date"

    | "select"

    | "combobox"

    | "radioGroup"

    | "checkbox"

    | "checkboxGroup"

    | "file"

    | "contenteditable"

    | "unknown";

  dom: {

    tagName: string;

    type?: string;

    id?: string;

    name?: string;

    className?: string;

    role?: string;

    autocomplete?: string;

    placeholder?: string;

  };

  accessibility: {

    label?: string;

    ariaLabel?: string;

    ariaLabelledBy?: string;

    describedBy?: string;

    required?: boolean;

  };

  context: {

    nearbyText: string\[\];

    previousText: string\[\];

    nextText: string\[\];

    sectionTitle?: string;

    formTitle?: string;

    pageTitle?: string;

    buttonTextsNearby?: string\[\];

  };

  options?: FieldOption\[\];

  geometry: {

    x: number;

    y: number;

    width: number;

    height: number;

    visible: boolean;

  };

  state: {

    disabled: boolean;

    readonly: boolean;

    empty: boolean;

    currentValue?: string;

  };

};

## **Semantic and plan models**

export type SemanticFieldMatch \= {

  candidateId: string;

  canonicalKey: CanonicalFieldKey;

  confidence: number;

  evidence: MatchEvidence\[\];

  requiresReview: boolean;

  sensitive: boolean;

};

export type FillPlan \= {

  id: string;

  profileId: string;

  url: string;

  adapterId: string;

  createdAt: string;

  steps: FillStep\[\];

  manualSteps: ManualStep\[\];

  warnings: FillWarning\[\];

  diagnostics: FillPlanDiagnostics;

};

export type FillStep \= {

  id: string;

  candidateId: string;

  canonicalKey: CanonicalFieldKey;

  action:

    | "setText"

    | "selectOption"

    | "clickRadio"

    | "toggleCheckbox"

    | "uploadFile"

    | "manual";

  value: unknown;

  confidence: number;

  driverId: string;

  status: "pending" | "filled" | "skipped" | "failed" | "manual";

};

## **Refactor adapter output**

Old behavior:

adapter.fill(profile);

New behavior:

const candidates \= await adapter.scan(context);

const fillPlan \= buildFillPlan(candidates, profile);

await executor.execute(fillPlan);

## **Temporary plan builder**

Build a minimal bridge so old adapters keep working during the migration:

export function buildTemporaryFillPlan(

  candidates: FieldCandidate\[\],

  profile: CandidateProfile

): FillPlan {

  // Use basic hardcoded mappings initially.

  // This gets replaced by semanticClassifier in Phase 4\.

}

## **Acceptance criteria**

\- Workday outputs FieldCandidate\[\].

\- Greenhouse outputs FieldCandidate\[\].

\- Personio outputs FieldCandidate\[\].

\- SmartRecruiters outputs FieldCandidate\[\].

\- End-to-end fill still works.

\- Fill execution now depends on FillPlan \+ FillDrivers, not adapter-specific mutation.

---

# **Phase 3 — Build the Universal Scanner**

## **Goal**

Create the generic parser that reads unsupported ATS forms without platform-specific selectors.

## **Target area**

packages/dom-utils/src/scanner.ts

packages/dom-utils/src/labels.ts

packages/dom-utils/src/sections.ts

packages/dom-utils/src/repeatableGroups.ts

## **3.1 Build `genericScanner.scan(document)`**

export function scan(document: Document): FieldCandidate\[\] {

  const elements \= findFillableElements(document);

  return elements

    .map((element) \=\> buildFieldCandidate(element))

    .filter((candidate) \=\> candidate.geometry.visible)

    .filter((candidate) \=\> \!candidate.state.disabled);

}

Scanner should find:

input

textarea

select

button-like custom dropdowns

\[role="combobox"\]

\[role="radio"\]

\[role="checkbox"\]

\[contenteditable="true"\]

file inputs

## **3.2 Implement text and label extraction**

Extract:

\<label for="..."\>

wrapping \<label\>

aria-label

aria-labelledby

placeholder

name

id

autocomplete

nearby text

previous sibling text

fieldset legend

section heading

export function extractCandidateText(element: HTMLElement): CandidateTextSignals {

  return {

    label: getAssociatedLabel(element),

    ariaLabel: element.getAttribute("aria-label") ?? undefined,

    placeholder: getPlaceholder(element),

    name: getName(element),

    id: element.id || undefined,

    nearbyText: getNearbyText(element),

    sectionTitle: findNearestSectionTitle(element)

  };

}

## **3.3 Implement section detection v1**

Populate:

candidate.context.sectionTitle

using nearest:

h1-h4

fieldset legend

accordion header

visually prominent bold text

parent form heading

Section types:

export type SectionType \=

  | "personal"

  | "experience"

  | "education"

  | "skills"

  | "documents"

  | "demographics"

  | "screening"

  | "unknown";

## **3.4 Implement repeatable group detection v1**

Detect repeated field groups such as:

Company

Job Title

Start Date

End Date

Description

as:

export type RepeatableGroup \= {

  id: string;

  type: "experience" | "education" | "certification" | "language" | "reference";

  container: HTMLElement;

  fields: FieldCandidate\[\];

  index: number;

  addButton?: HTMLElement;

  removeButton?: HTMLElement;

  confidence: number;

};

## **Acceptance criteria**

\- Unsupported generic forms produce useful FieldCandidate\[\].

\- Basic personal/contact fields are found.

\- Native dropdowns are found.

\- Basic section titles are captured.

\- First-level experience and education groups can be detected.

---

# **Phase 4 — Build the semantic classifier and matcher**

## **Goal**

Move synonym dictionaries and matching logic out of adapters and into a central intelligence layer.

## **Target area**

packages/autofill-core/src/fieldOntology.ts

packages/autofill-core/src/matcher.ts

packages/autofill-core/src/confidence.ts

packages/autofill-core/src/optionMatcher.ts

## **4.1 Canonical ontology**

export const canonicalFieldOntology \= {

  "personal.firstName": {

    labels: \[

      "first name",

      "given name",

      "forename",

      "legal first name",

      "vorname",

      "prénom",

      "nombre"

    \],

    negativeLabels: \[

      "preferred first name",

      "reference first name",

      "manager first name"

    \],

    valueType: "string",

    sensitivity: "normal"

  },

  "personal.lastName": {

    labels: \[

      "last name",

      "surname",

      "family name",

      "legal last name",

      "nachname",

      "nom",

      "apellido"

    \],

    negativeLabels: \[

      "reference last name",

      "manager last name"

    \],

    valueType: "string",

    sensitivity: "normal"

  },

  "personal.email": {

    labels: \[

      "email",

      "email address",

      "e-mail",

      "contact email"

    \],

    negativeLabels: \[

      "reference email",

      "manager email"

    \],

    valueType: "email",

    sensitivity: "normal"

  },

  "documents.resume": {

    labels: \[

      "resume",

      "cv",

      "curriculum vitae",

      "upload resume",

      "attach cv",

      "lebenslauf"

    \],

    valueType: "file",

    sensitivity: "normal"

  },

  "demographics.gender": {

    labels: \[

      "gender",

      "sex"

    \],

    valueType: "option",

    sensitivity: "sensitive"

  }

} satisfies CanonicalFieldOntology;

## **4.2 Semantic classifier**

export function classifyFields(

  candidates: FieldCandidate\[\],

  ontology: CanonicalFieldOntology,

  context?: ClassificationContext

): SemanticFieldMatch\[\] {

  return candidates.flatMap((candidate) \=\> {

    const matches \= Object.entries(ontology)

      .map((\[canonicalKey, definition\]) \=\>

        scoreCandidateMatch(candidate, canonicalKey as CanonicalFieldKey, definition)

      )

      .filter((match) \=\> match.confidence \>= confidencePolicy.review);

    return selectBestMatches(matches);

  });

}

## **4.3 Confidence scoring**

Use deterministic multi-signal scoring first.

export function scoreCandidateMatch(

  candidate: FieldCandidate,

  canonicalKey: CanonicalFieldKey,

  definition: CanonicalFieldDefinition

): SemanticFieldMatch {

  let score \= 0;

  const evidence: MatchEvidence\[\] \= \[\];

  if (exactLabelMatch(candidate, definition)) {

    score \+= 0.45;

    evidence.push({ type: "exactLabel", weight: 0.45 });

  }

  if (autocompleteMatch(candidate, canonicalKey)) {

    score \+= 0.3;

    evidence.push({ type: "autocomplete", weight: 0.3 });

  }

  if (nameOrIdMatch(candidate, definition)) {

    score \+= 0.25;

    evidence.push({ type: "nameOrId", weight: 0.25 });

  }

  if (placeholderMatch(candidate, definition)) {

    score \+= 0.18;

    evidence.push({ type: "placeholder", weight: 0.18 });

  }

  if (sectionContextMatch(candidate, canonicalKey)) {

    score \+= 0.15;

    evidence.push({ type: "sectionContext", weight: 0.15 });

  }

  if (negativeLabelMatch(candidate, definition)) {

    score \-= 0.5;

    evidence.push({ type: "negativeLabel", weight: \-0.5 });

  }

  return {

    candidateId: candidate.id,

    canonicalKey,

    confidence: Math.max(0, Math.min(1, score)),

    evidence,

    requiresReview: score \< confidencePolicy.autoFill || definition.sensitivity \=== "sensitive",

    sensitive: definition.sensitivity \=== "sensitive"

  };

}

## **4.4 Option matcher**

export type OptionMatchResult \= {

  matched: boolean;

  option?: FieldOption;

  confidence: number;

  strategy:

    | "exact"

    | "normalizedExact"

    | "synonym"

    | "contains"

    | "fuzzy"

    | "manual";

};

Example option synonym map:

export const optionSynonyms \= {

  prefer\_not\_to\_say: \[

    "prefer not to say",

    "i do not wish to answer",

    "decline to answer",

    "decline to self-identify",

    "choose not to disclose",

    "not disclosed"

  \],

  yes: \["yes", "true", "y"\],

  no: \["no", "false", "n"\]

};

## **Confidence policy**

export const confidencePolicy \= {

  autoFill: 0.9,

  review: 0.7,

  ignore: 0.0,

  sensitiveAlwaysReview: true,

  maxAutoFillForUnknownPlatform: 0.95

};

## **Acceptance criteria**

\- FieldCandidate\[\] can be mapped to canonical profile keys.

\- Synonym lists live in fieldOntology, not adapters.

\- Negative labels prevent bad mappings.

\- Sensitive fields always require review.

\- Option matcher handles equivalent dropdown values.

---

# **Phase 5 — Refactor into thin adapters**

## **Goal**

Strip adapters down to detection, hints, and edge-case patches.

## **Target area**

packages/adapters/src/\*

## **New adapter contract**

export interface AtsAdapter {

  id: string;

  label: string;

  priority: number;

  detect(context: AdapterDetectContext): AdapterDetectionResult;

  getParserHints?(): ParserHints;

  getSemanticHints?(): SemanticHints;

  getDriverHints?(): DriverHints;

  preScan?(context: AdapterRuntimeContext): Promise\<void\>;

  postProcessCandidates?(

    candidates: FieldCandidate\[\],

    context: AdapterRuntimeContext

  ): FieldCandidate\[\];

  postProcessFillPlan?(

    plan: FillPlan,

    context: AdapterRuntimeContext

  ): FillPlan;

  beforeExecute?(

    plan: FillPlan,

    context: AdapterRuntimeContext

  ): Promise\<void\>;

  afterExecute?(

    result: FillResult,

    context: AdapterRuntimeContext

  ): Promise\<void\>;

}

## **Workday adapter**

Remove:

generic synonym matching

raw DOM filling

broad field selectors that belong in the scanner

Keep:

custom combobox hints

multi-step flow hints

mutation wait hints

page-state detection

postProcessFillPlan quirks

Example:

export const workdayAdapter: AtsAdapter \= {

  id: "workday",

  label: "Workday",

  priority: 100,

  detect(ctx) {

    return {

      matched: ctx.location.hostname.includes("myworkdayjobs.com"),

      confidence: 0.98

    };

  },

  getParserHints() {

    return {

      dynamicPage: true,

      waitForMutations: true,

      scanShadowDom: false,

      usesCustomComboboxes: true,

      hasMultiStepFlow: true,

      mutationWaitMs: 1200

    };

  },

  getDriverHints() {

    return {

      preferredComboboxDriver: "ariaComboboxDriver",

      requiresReactInputSetter: true

    };

  },

  postProcessFillPlan(plan) {

    return applyWorkdayQuirks(plan);

  }

};

## **Greenhouse adapter**

Remove basic synonym matching.

Keep:

detect()

fieldBoosts

resume upload hints

custom question review policy

export const greenhouseAdapter: AtsAdapter \= {

  id: "greenhouse",

  label: "Greenhouse",

  priority: 80,

  detect(ctx) {

    const host \= ctx.location.hostname;

    return {

      matched: host.includes("greenhouse.io"),

      confidence: host.includes("greenhouse.io") ? 0.95 : 0.2

    };

  },

  getSemanticHints() {

    return {

      fieldBoosts: {

        "personal.firstName": \["first\_name", "first name"\],

        "personal.lastName": \["last\_name", "last name"\],

        "personal.email": \["email"\],

        "personal.phone": \["phone"\],

        "documents.resume": \["resume", "cv"\]

      }

    };

  }

};

## **Personio / SmartRecruiters adapters**

Reduce to:

detect()

parser hints

semantic boosts only where useful

postProcessFillPlan only if truly needed

## **Acceptance criteria**

\- Adapters are roughly 100–200 lines each.

\- Adapters no longer own generic matching.

\- Adapters no longer directly fill fields.

\- New ATS support can usually start as a detection \+ hints file.

---

# **Phase 6 — Orchestration and UI integration**

## **Goal**

Tie the whole pipeline together and expose generated fill plans to the side panel.

## **Target area**

packages/autofill-core/src/orchestrator.ts

apps/extension/src/background/

apps/extension/src/content/

apps/extension/src/sidepanel/

## **6.1 Build AutofillOrchestrator**

export class AutofillOrchestrator {

  constructor(

    private readonly adapterRegistry: AdapterRegistry,

    private readonly scanner: UniversalScanner,

    private readonly classifier: SemanticClassifier,

    private readonly fillPlanBuilder: FillPlanBuilder,

    private readonly executor: FillExecutor

  ) {}

  async inspectPage(profile: CandidateProfile): Promise\<InspectionResult\> {

    const adapter \= await this.adapterRegistry.detect({

      location: window.location,

      document

    });

    await adapter.preScan?.({ document, window });

    const candidates \= await this.scanner.scan(document, {

      parserHints: adapter.getParserHints?.()

    });

    const patchedCandidates \=

      adapter.postProcessCandidates?.(candidates, { document, window }) ??

      candidates;

    const matches \= this.classifier.classify(patchedCandidates, {

      ontology: canonicalFieldOntology,

      semanticHints: adapter.getSemanticHints?.()

    });

    const fillPlan \= this.fillPlanBuilder.build({

      profile,

      adapter,

      candidates: patchedCandidates,

      matches

    });

    const patchedPlan \=

      adapter.postProcessFillPlan?.(fillPlan, { document, window }) ??

      fillPlan;

    return {

      adapter,

      candidates: patchedCandidates,

      matches,

      fillPlan: patchedPlan,

      diagnostics: buildParserDiagnostics(patchedCandidates, matches, patchedPlan)

    };

  }

  async executePlan(plan: FillPlan): Promise\<FillResult\> {

    return this.executor.execute(plan);

  }

}

## **6.2 Expose diagnostics**

export type ParserDiagnostics \= {

  scannedElements: number;

  candidateFields: number;

  sectionsDetected: number;

  repeatableGroupsDetected: number;

  ignoredHiddenElements: number;

  highConfidenceMatches: number;

  reviewRequiredMatches: number;

  manualSteps: number;

  adapterId: string;

  parserVersion: string;

  warnings: string\[\];

};

Developer panel should show:

Detected adapter

Candidate count

Matched field count

Confidence scores

Evidence per match

Driver selected per fill step

Manual/skipped fields

Warnings

## **6.3 Introduce execution modes**

export type ExecutionMode \= "conservative" | "assisted" | "recorder";

### **Conservative**

\- Fill only confidence \>= 0.9.

\- Sensitive fields always review.

\- Unknown platform requires stricter confidence.

### **Assisted**

\- Show all guessed mappings.

\- User approves or rejects.

\- Best default for new platforms.

### **Recorder**

\- User manually maps fields.

\- Corrections are stored as LocalMappingOverride.

\- Used heavily in Phase 7\.

## **Acceptance criteria**

\- Side panel shows a generated FillPlan.

\- User can approve/reject fields.

\- User can execute approved plan.

\- Diagnostics panel explains why each field was matched.

\- Conservative and Assisted modes work.

\- Recorder mode UI hooks exist even if override persistence lands in Phase 7\.

---

# **Phase 7 — Advanced universal features V2**

## **Goal**

Make the extension self-healing and scalable for niche ATSs.

## **Target area**

packages/autofill-core/src/overrides.ts

packages/autofill-core/src/siteRecipes.ts

apps/extension/src/sidepanel/mapping-recorder/

## **7.1 Local Mapping Recorder**

When the user corrects a mapping:

Visible field: Legal Given Name

Wrong guess: personal.preferredName

User correction: personal.firstName

Save:

export type LocalMappingOverride \= {

  id: string;

  hostname: string;

  urlPattern?: string;

  fieldSignature: FieldSignature;

  canonicalKey: CanonicalFieldKey;

  confidenceBoost: number;

  createdAt: string;

  lastUsedAt: string;

  useCount: number;

};

Field signature:

export type FieldSignature \= {

  labelText?: string;

  ariaLabel?: string;

  placeholder?: string;

  name?: string;

  id?: string;

  inputType?: string;

  sectionTitle?: string;

  nearbyTextHash?: string;

  domPathHint?: string;

};

Override matching:

export function matchOverride(

  candidate: FieldCandidate,

  override: LocalMappingOverride

): number {

  let score \= 0;

  if (candidate.accessibility.label \=== override.fieldSignature.labelText) {

    score \+= 0.4;

  }

  if (candidate.dom.name \=== override.fieldSignature.name) {

    score \+= 0.25;

  }

  if (candidate.context.sectionTitle \=== override.fieldSignature.sectionTitle) {

    score \+= 0.2;

  }

  if (candidate.dom.placeholder \=== override.fieldSignature.placeholder) {

    score \+= 0.15;

  }

  return Math.min(score, 1);

}

## **7.2 Page Actions**

Represent buttons as actions, not platform-specific code.

export type PageAction \= {

  id: string;

  type:

    | "addExperience"

    | "addEducation"

    | "addCertification"

    | "nextStep"

    | "uploadResume"

    | "uploadCoverLetter"

    | "unknown";

  label: string;

  element: HTMLElement;

  confidence: number;

};

Detect:

Add Experience

Add Work Experience

Add Employment

Add Education

Add School

Next

Continue

Save and Continue

Upload Resume

Attach CV

Default policy:

\- Do not auto-click Next.

\- Do not auto-submit.

\- Suggest page actions to the user.

\- Auto-click Add Experience/Add Education only in Assisted mode after confirmation.

## **7.3 Site Recipes**

Allow users or developers to import/export ATS support without shipping a new extension version.

export type SiteRecipe \= {

  id: string;

  label: string;

  hostnamePattern: string;

  fields: Partial\<Record\<CanonicalFieldKey, RecipeFieldSelector\[\]\>\>;

  actions?: Partial\<Record\<PageAction\["type"\], RecipeActionSelector\[\]\>\>;

  semanticHints?: SemanticHints;

  parserHints?: ParserHints;

  notes?: string;

};

Example:

{

  "id": "example-ats",

  "label": "Example ATS",

  "hostnamePattern": "\*.example-careers.com",

  "fields": {

    "personal.firstName": \[

      {

        "selector": "input\[name='firstName'\]",

        "strategy": "css"

      }

    \],

    "personal.lastName": \[

      {

        "selector": "input\[name='lastName'\]",

        "strategy": "css"

      }

    \]

  }

}

## **Acceptance criteria**

\- User can map fields manually on an unknown ATS.

\- Mapping is saved locally.

\- Next visit to the same ATS uses saved mapping.

\- Site recipes can be imported/exported.

\- PageAction detection works for Add Experience, Add Education, and Next/Continue buttons.

---

# **Final implementation order**

Use this exact order to avoid breaking your current extension:

1\. Extract FillDriver interface and native drivers.

2\. Route existing adapter fill logic through driverRegistry.

3\. Introduce FieldCandidate and FillPlan types.

4\. Make existing adapters output FieldCandidate\[\].

5\. Add temporary FillPlan builder.

6\. Build genericScanner.scan(document).

7\. Add label, aria, placeholder, nearby-text, and section extraction.

8\. Add canonicalFieldOntology.

9\. Build semanticClassifier and confidence scoring.

10\. Build optionMatcher.

11\. Refactor adapters into thin hints.

12\. Build AutofillOrchestrator.

13\. Integrate FillPlan review into side panel.

14\. Add diagnostics panel.

15\. Add Conservative and Assisted modes.

16\. Add Recorder mode UI.

17\. Persist LocalMappingOverride.

18\. Add PageAction detection.

19\. Add SiteRecipe import/export.

---

# **Updated north-star rule**

From this point on, treat these as hard architecture rules:

Adapters detect and patch quirks.

The universal scanner reads the page.

The semantic matcher understands fields.

The FillPlan explains the intended actions.

The FillDrivers perform DOM interaction.

The UI approves uncertain/sensitive actions.

The recorder learns local corrections.

Site recipes extend support without code releases.

This gives you a cleaner path from “supports several known ATSs” to “works on most job application forms by default.”

