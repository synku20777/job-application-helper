import type { ExecutionMode } from "@job-helper/shared";

const executionModeKey = "executionMode";
const defaultExecutionMode: ExecutionMode = "conservative";

function isExecutionMode(value: unknown): value is ExecutionMode {
  return value === "conservative" || value === "assisted" || value === "recorder";
}

export async function getExecutionMode(): Promise<ExecutionMode> {
  const values = await chrome.storage.local.get(executionModeKey);
  return isExecutionMode(values[executionModeKey]) ? values[executionModeKey] : defaultExecutionMode;
}

export async function setExecutionMode(mode: ExecutionMode): Promise<ExecutionMode> {
  await chrome.storage.local.set({ [executionModeKey]: mode });
  return mode;
}
