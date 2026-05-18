import type { ExtensionResponse, PlatformDetection } from "@job-helper/shared";

export const linkedInCopyOnlyPlatform: PlatformDetection = {
  adapterId: "linkedin-copy-only",
  label: "LinkedIn copy-assist",
  confidence: 1,
  restricted: true,
  copyOnly: true
};

export function isLinkedInUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
  } catch {
    return false;
  }
}

export function linkedInScanResponse(url: string): ExtensionResponse {
  return {
    ok: true,
    type: "SCAN_PAGE",
    fields: [],
    platform: linkedInCopyOnlyPlatform,
    url
  };
}
