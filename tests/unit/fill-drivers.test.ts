import { describe, expect, it, vi } from "vitest";
import { resolveDriver, driverRegistry } from "@job-helper/autofill-core";

describe("Fill Drivers", () => {
  it("resolves the correct driver for a given control type", () => {
    const textDriver = resolveDriver({ id: "1", element: document.createElement("input"), controlType: "text" });
    expect(textDriver?.id).toBe("nativeTextDriver");

    const textareaDriver = resolveDriver({ id: "2", element: document.createElement("textarea"), controlType: "textarea" });
    expect(textareaDriver?.id).toBe("nativeTextareaDriver");

    const selectDriver = resolveDriver({ id: "3", element: document.createElement("select"), controlType: "select" });
    expect(selectDriver?.id).toBe("nativeSelectDriver");

    const checkboxDriver = resolveDriver({ id: "4", element: document.createElement("input"), controlType: "checkbox" });
    expect(checkboxDriver?.id).toBe("checkboxDriver");

    const radioDriver = resolveDriver({ id: "5", element: document.createElement("input"), controlType: "radioGroup" });
    expect(radioDriver?.id).toBe("radioGroupDriver");
  });

  it("nativeTextDriver dispatches input and change events", async () => {
    const input = document.createElement("input");
    input.type = "text";
    document.body.appendChild(input);

    const driver = driverRegistry.find((d) => d.id === "nativeTextDriver");
    const listener = vi.fn();
    input.addEventListener("input", listener);
    input.addEventListener("change", listener);

    const result = await driver?.fill(
      { id: "test", element: input, controlType: "text" },
      "Hello World",
      { document, window }
    );

    expect(result?.status).toBe("filled");
    expect(input.value).toBe("Hello World");
    expect(listener).toHaveBeenCalledTimes(2);

    document.body.removeChild(input);
  });

  it("nativeSelectDriver selects correct option and dispatches events", async () => {
    const select = document.createElement("select");
    select.innerHTML = `<option value="1">One</option><option value="2">Two</option>`;
    document.body.appendChild(select);

    const driver = driverRegistry.find((d) => d.id === "nativeSelectDriver");
    const listener = vi.fn();
    select.addEventListener("input", listener);
    select.addEventListener("change", listener);

    const result = await driver?.fill(
      { id: "test", element: select, controlType: "select" },
      "Two",
      { document, window }
    );

    expect(result?.status).toBe("filled");
    expect(select.value).toBe("2");
    expect(listener).toHaveBeenCalledTimes(2);

    document.body.removeChild(select);
  });

  it("nativeSelectDriver handles missing options", async () => {
    const select = document.createElement("select");
    select.innerHTML = `<option value="1">One</option>`;
    document.body.appendChild(select);

    const driver = driverRegistry.find((d) => d.id === "nativeSelectDriver");

    const result = await driver?.fill(
      { id: "test", element: select, controlType: "select" },
      "Two",
      { document, window }
    );

    expect(result?.status).toBe("failed");
    expect(result?.error?.code).toBe("OPTION_NOT_FOUND");

    document.body.removeChild(select);
  });
});
