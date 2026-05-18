import type { AutofillError, FieldCandidate } from "@job-helper/shared";

export type DriverField = Pick<FieldCandidate, "id" | "element" | "controlType" | "options"> & {
  metadata?: {
    label?: string;
    name?: string;
    id?: string;
    platform?: string;
  };
};

export interface FillDriver {
  id: string;
  supports(field: DriverField): boolean;
  fill(
    field: DriverField,
    value: unknown,
    context: FillExecutionContext
  ): Promise<DriverFillResult>;
  verify?(
    field: DriverField,
    value: unknown,
    context: FillExecutionContext
  ): Promise<VerificationResult>;
}

export type DriverFillResult = {
  status: "filled" | "skipped" | "failed" | "manual";
  candidateId: string;
  driverId: string;
  actualValue?: unknown;
  error?: AutofillError;
};

export type VerificationResult = {
  verified: boolean;
  actualValue?: unknown;
  error?: string;
};

export type FillExecutionContext = {
  document: Document;
  window?: Window;
  dryRun?: boolean;
  timeoutMs?: number;
  debug?: boolean;
};
