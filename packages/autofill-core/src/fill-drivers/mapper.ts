import type { DriverField } from "./types";
export function elementToDriverField(element: HTMLElement, id: string): DriverField {
  const tagName = element.tagName.toLowerCase();
  let controlType: DriverField["controlType"] = "unknown";

  if (tagName === "textarea") {
    controlType = "textarea";
  } else if (tagName === "select") {
    controlType = "select";
  } else if (tagName === "input") {
    const inputType = (element as HTMLInputElement).type.toLowerCase();
    if (inputType === "email") controlType = "email";
    else if (inputType === "tel") controlType = "phone";
    else if (inputType === "number") controlType = "number";
    else if (inputType === "radio") controlType = "radioGroup";
    else if (inputType === "checkbox") controlType = "checkbox";
    else if (inputType === "file") controlType = "file";
    else controlType = "text";
  } else {
    const role = element.getAttribute("role")?.toLowerCase();
    if (role === "checkbox") controlType = "checkbox";
    else if (role === "radio") controlType = "radioGroup";
    else if (role === "combobox" || role === "listbox") controlType = "select";
  }

  return {
    id,
    element,
    controlType
  };
}
