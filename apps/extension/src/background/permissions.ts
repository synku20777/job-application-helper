export const ATS_HOST_PERMISSIONS = [
  "https://*.myworkdayjobs.com/*",
  "https://jobs.smartrecruiters.com/*",
  "https://careers.smartrecruiters.com/*",
  "https://boards.greenhouse.io/*",
  "https://job-boards.greenhouse.io/*",
  "https://*.jobs.personio.com/*",
  "https://*.jobs.personio.de/*"
] as const;

export type HostPermissionState = "notRequired" | "granted" | "missing";

export function optionalHostPermissionForUrl(url: string | undefined): string | null {
  if (!url) return null;
  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (hostname === "myworkdayjobs.com" || hostname.endsWith(".myworkdayjobs.com")) return "https://*.myworkdayjobs.com/*";
  if (hostname === "jobs.smartrecruiters.com") return "https://jobs.smartrecruiters.com/*";
  if (hostname === "careers.smartrecruiters.com") return "https://careers.smartrecruiters.com/*";
  if (hostname === "boards.greenhouse.io") return "https://boards.greenhouse.io/*";
  if (hostname === "job-boards.greenhouse.io") return "https://job-boards.greenhouse.io/*";
  if (hostname.endsWith(".jobs.personio.com")) return "https://*.jobs.personio.com/*";
  if (hostname.endsWith(".jobs.personio.de")) return "https://*.jobs.personio.de/*";

  return null;
}

export async function hostPermissionState(url: string | undefined): Promise<HostPermissionState> {
  const origin = optionalHostPermissionForUrl(url);
  if (!origin) return "notRequired";
  const granted = await chrome.permissions.contains({ origins: [origin] });
  return granted ? "granted" : "missing";
}

export async function ensureHostPermission(url: string | undefined): Promise<HostPermissionState> {
  const origin = optionalHostPermissionForUrl(url);
  if (!origin) return "notRequired";
  if (await chrome.permissions.contains({ origins: [origin] })) return "granted";
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) throw new Error("Permission is required to scan this job application site.");
  return "granted";
}
