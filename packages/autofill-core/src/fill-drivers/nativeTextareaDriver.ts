import type { DriverField, DriverFillResult, FillDriver, FillExecutionContext } from "./types";

export const nativeTextareaDriver: FillDriver = {
  id: "nativeTextareaDriver",
  
  supports(field: DriverField): boolean {
    return field.controlType === "textarea";
  },

  async fill(
    field: DriverField,
    value: unknown,
    context: FillExecutionContext
  ): Promise<DriverFillResult> {
    const element = field.element;
    
    if (!(element instanceof HTMLTextAreaElement)) {
      return {
        status: "failed",
        candidateId: field.id,
        driverId: this.id,
        error: {
          code: "UNKNOWN",
          message: "Element is not an HTMLTextAreaElement",
          candidateId: field.id
        }
      };
    }

    if (element.disabled || element.readOnly) {
      return {
        status: "failed",
        candidateId: field.id,
        driverId: this.id,
        error: {
          code: "FIELD_DISABLED",
          message: "Element is disabled or read-only",
          candidateId: field.id
        }
      };
    }

    const strValue = String(value ?? "");

    // React specific setter if present
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      (context.window as any)?.HTMLTextAreaElement?.prototype || HTMLTextAreaElement.prototype,
      "value"
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, strValue);
    } else {
      element.value = strValue;
    }

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));

    return {
      status: "filled",
      candidateId: field.id,
      driverId: this.id,
      actualValue: strValue
    };
  }
};
