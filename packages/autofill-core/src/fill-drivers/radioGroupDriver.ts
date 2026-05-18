import type { DriverField, DriverFillResult, FillDriver, FillExecutionContext } from "./types";

export const radioGroupDriver: FillDriver = {
  id: "radioGroupDriver",
  
  supports(field: DriverField): boolean {
    return field.controlType === "radioGroup";
  },

  async fill(
    field: DriverField,
    value: unknown,
    context: FillExecutionContext
  ): Promise<DriverFillResult> {
    const element = field.element;
    
    if (!(element instanceof HTMLInputElement) || element.type !== "radio") {
      // It might be a custom radio group where `element` is the container.
      // But for the native driver, we expect the input element itself to be passed or we need to find it.
      // Assuming for native radio, field.element is the specific radio button to click,
      // or we need to handle a group. If it's a group, we'd need to find the radio with the matching value.
      
      // If it's not an input, we fail for the native driver.
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

    if (shouldBeChecked && !element.checked) {
      element.click();
      
      // Sometimes click doesn't dispatch change event in all frameworks if prevented
      if (!element.checked) {
        element.checked = true;
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
