import type { DriverField, DriverFillResult, FillDriver, FillExecutionContext } from "./types";

export const checkboxDriver: FillDriver = {
  id: "checkboxDriver",
  
  supports(field: DriverField): boolean {
    return field.controlType === "checkbox" || field.controlType === "checkboxGroup";
  },

  async fill(
    field: DriverField,
    value: unknown,
    context: FillExecutionContext
  ): Promise<DriverFillResult> {
    const element = field.element;
    
    if (!(element instanceof HTMLInputElement) || element.type !== "checkbox") {
      if (!(element instanceof HTMLInputElement)) {
        return {
          status: "failed",
          candidateId: field.id,
          driverId: this.id,
          error: {
            code: "UNKNOWN",
            message: "Element is not an HTMLInputElement",
            candidateId: field.id
          }
        };
      }
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

    const shouldBeChecked = Boolean(value);

    if (element.checked !== shouldBeChecked) {
      element.click();
      
      if (element.checked !== shouldBeChecked) {
        element.checked = shouldBeChecked;
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    return {
      status: "filled",
      candidateId: field.id,
      driverId: this.id,
      actualValue: element.checked
    };
  }
};
