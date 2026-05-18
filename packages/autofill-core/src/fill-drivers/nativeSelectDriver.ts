import type { DriverField, DriverFillResult, FillDriver, FillExecutionContext } from "./types";

export const nativeSelectDriver: FillDriver = {
  id: "nativeSelectDriver",
  
  supports(field: DriverField): boolean {
    return field.controlType === "select";
  },

  async fill(
    field: DriverField,
    value: unknown,
    context: FillExecutionContext
  ): Promise<DriverFillResult> {
    const element = field.element;
    
    if (!(element instanceof HTMLSelectElement)) {
      return {
        status: "failed",
        candidateId: field.id,
        driverId: this.id,
        error: {
          code: "UNKNOWN",
          message: "Element is not an HTMLSelectElement",
          candidateId: field.id
        }
      };
    }

    if (element.disabled) {
      return {
        status: "failed",
        candidateId: field.id,
        driverId: this.id,
        error: {
          code: "FIELD_DISABLED",
          message: "Element is disabled",
          candidateId: field.id
        }
      };
    }

    const strValue = String(value ?? "");
    let optionFound = false;

    // Try to find the exact option value
    for (const option of Array.from(element.options)) {
      if (option.value === strValue || option.text === strValue) {
        element.value = option.value;
        optionFound = true;
        break;
      }
    }

    if (!optionFound) {
      return {
        status: "failed",
        candidateId: field.id,
        driverId: this.id,
        error: {
          code: "OPTION_NOT_FOUND",
          message: `Option '${strValue}' not found in select`,
          candidateId: field.id
        }
      };
    }

    element.dispatchEvent(new Event("change", { bubbles: true }));
    // React 16+ uses input event for selects too sometimes
    element.dispatchEvent(new Event("input", { bubbles: true }));

    return {
      status: "filled",
      candidateId: field.id,
      driverId: this.id,
      actualValue: element.value
    };
  }
};
