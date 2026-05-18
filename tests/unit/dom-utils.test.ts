import { describe, expect, it } from "vitest";
import { classifySectionType, escapeCssIdentifier, executeFillPlan, scanFormFields } from "@job-helper/dom-utils";
import type { FillPlan } from "@job-helper/shared";

describe("dom utils", () => {
  it("escapes selector identifiers without a native CSS.escape", () => {
    expect(document.querySelector(`input[name="${escapeCssIdentifier("job_application[first_name]")}"]`)).toBeNull();
    document.body.innerHTML = `<input name="job_application[first_name]" />`;
    expect(document.querySelector(`input[name="${escapeCssIdentifier("job_application[first_name]")}"]`)).not.toBeNull();
  });

  it("scans labels and input metadata", () => {
    document.body.innerHTML = `<label for="first">First Name</label><input id="first" />`;
    const fields = scanFormFields(document);
    expect(fields[0]?.accessibility.label).toBe("First Name");
  });

  it("finds all phase 3 fillable control types", () => {
    document.body.innerHTML = `
      <input id="text" />
      <textarea id="textarea"></textarea>
      <select id="select"><option>One</option></select>
      <div id="combo" role="combobox"></div>
      <div id="radio" role="radio"></div>
      <div id="checkbox" role="checkbox"></div>
      <div id="textbox" role="textbox"></div>
      <div id="editable" contenteditable="true"></div>
      <input id="file" type="file" />
    `;

    const controlTypes = scanFormFields(document).map((field) => field.controlType);

    expect(controlTypes).toEqual(
      expect.arrayContaining(["text", "textarea", "select", "combobox", "radioGroup", "checkbox", "contenteditable", "file"])
    );
  });

  it("filters hidden disabled and readonly fields", () => {
    document.body.innerHTML = `
      <input id="visible" />
      <input id="hidden" style="display:none" />
      <input id="disabled" disabled />
      <input id="readonly" readonly />
    `;

    const ids = scanFormFields(document).map((field) => field.dom.id);

    expect(ids).toEqual(["visible"]);
  });

  it("extracts nearby text section signals and sibling text", () => {
    document.body.innerHTML = `
      <form>
        <h2>Education</h2>
        <p>Previous helper text</p>
        <label for="school">School</label>
        <input id="school" aria-describedby="school-help" autocomplete="organization" />
        <p>Next helper text</p>
        <span id="school-help">University name</span>
      </form>
    `;

    const [field] = scanFormFields(document);

    expect(field?.dom.autocomplete).toBe("organization");
    expect(field?.accessibility.describedBy).toBe("University name");
    expect(field?.context.sectionTitle).toBe("Education");
    expect(field?.context.sectionType).toBe("education");
    expect(field?.context.previousText).toEqual(expect.arrayContaining(["School", "Previous helper text"]));
    expect(field?.context.nextText).toEqual(expect.arrayContaining(["Next helper text"]));
  });

  it("classifies supported section types", () => {
    expect(classifySectionType("Contact information")).toBe("personal");
    expect(classifySectionType("Work Experience")).toBe("experience");
    expect(classifySectionType("Education")).toBe("education");
    expect(classifySectionType("Technical skills")).toBe("skills");
    expect(classifySectionType("Resume upload")).toBe("documents");
    expect(classifySectionType("Voluntary demographic questions")).toBe("demographics");
    expect(classifySectionType("Screening questions")).toBe("screening");
  });

  it("marks repeatable experience and education groups", () => {
    document.body.innerHTML = `
      <form>
        <section>
          <h2>Work Experience</h2>
          <label for="company">Company</label><input id="company" />
          <label for="title">Job Title</label><input id="title" />
          <label for="start">Start Date</label><input id="start" />
          <label for="end">End Date</label><input id="end" />
          <button>Add experience</button>
        </section>
        <section>
          <h2>Education</h2>
          <label for="school">School</label><input id="school" />
          <label for="degree">Degree</label><input id="degree" />
          <label for="field">Field of Study</label><input id="field" />
          <button>Add education</button>
        </section>
      </form>
    `;

    const fields = scanFormFields(document);
    const experience = fields.find((field) => field.dom.id === "company")?.context.repeatableGroup;
    const education = fields.find((field) => field.dom.id === "school")?.context.repeatableGroup;

    expect(experience).toMatchObject({ type: "experience", index: 0 });
    expect(education).toMatchObject({ type: "education", index: 0 });
  });

  it("executes accepted fill steps", async () => {
    document.body.innerHTML = `<label for="first">First Name</label><input id="first" data-job-autofill-id="first" />`;
    const plan: FillPlan = {
      id: "plan-1",
      adapterId: "generic-html-form",
      url: "https://example.test",
      createdAt: new Date().toISOString(),
      profileId: "default",
      detectedPlatform: "Generic form",
      warnings: [],
      steps: [
        {
          type: "setText",
          target: { candidateId: "first", selector: "#first", label: "First Name" },
          canonicalKey: "personal.firstName",
          value: "John",
          confidence: 0.95,
          requiresReview: false
        }
      ]
    };
    const result = await executeFillPlan(plan, ["first"]);
    expect(result.status).toBe("success");
    expect(document.querySelector<HTMLInputElement>("#first")?.value).toBe("John");
  });

  it("does not fill excluded steps", async () => {
    document.body.innerHTML = `<label for="first">First Name</label><input id="first" data-job-autofill-id="first" />`;
    const plan: FillPlan = {
      id: "plan-1",
      adapterId: "generic-html-form",
      url: "https://example.test",
      createdAt: new Date().toISOString(),
      profileId: "default",
      detectedPlatform: "Generic form",
      warnings: [],
      steps: [
        {
          type: "setText",
          target: { candidateId: "first", selector: "#first", label: "First Name" },
          canonicalKey: "personal.firstName",
          value: "John",
          confidence: 0.95,
          requiresReview: false
        }
      ]
    };
    const result = await executeFillPlan(plan, []);
    expect(result.skippedSteps).toBe(1);
    expect(document.querySelector<HTMLInputElement>("#first")?.value).toBe("");
  });
});
