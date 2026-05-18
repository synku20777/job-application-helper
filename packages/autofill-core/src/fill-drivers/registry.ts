import type { DriverField, FillDriver } from "./types";
import { nativeTextDriver } from "./nativeTextDriver";
import { nativeTextareaDriver } from "./nativeTextareaDriver";
import { nativeSelectDriver } from "./nativeSelectDriver";
import { radioGroupDriver } from "./radioGroupDriver";
import { checkboxDriver } from "./checkboxDriver";

export const driverRegistry: FillDriver[] = [
  nativeTextDriver,
  nativeTextareaDriver,
  nativeSelectDriver,
  radioGroupDriver,
  checkboxDriver
];

export function resolveDriver(field: DriverField): FillDriver | null {
  return driverRegistry.find((driver) => driver.supports(field)) ?? null;
}
