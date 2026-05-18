import type { DriverField, DriverFillResult, FillDriver, FillExecutionContext } from "./types";

export const nativeTextDriver: FillDriver = {
  id: "nativeTextDriver",
  
  supports(field: DriverField): boolean {
    return [
      "text",
      "email",
      "phone",
      "number"
    ].includes(field.controlType);
  },

  async fill(
    field: DriverField,
    value: unknown,
    context: FillExecutionContext
  ): Promise<DriverFillResult> {
    const element = field.element;
    
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
      (context.window as any)?.HTMLInputElement?.prototype || HTMLInputElement.prototype,
      "value"
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, strValue);
    } else {
      element.value = strValue;
    }

    // Trigger events to notify frameworks (React, Angular, etc.)
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
