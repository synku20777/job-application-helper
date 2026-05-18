import type { FirstRunConsentStatus } from "@job-helper/shared";

const firstRunConsentAcceptedKey = "firstRunConsentAccepted";
const firstRunConsentAcceptedAtKey = "firstRunConsentAcceptedAt";

export async function getFirstRunConsent(): Promise<FirstRunConsentStatus> {
  const values = await chrome.storage.local.get([firstRunConsentAcceptedKey, firstRunConsentAcceptedAtKey]);
  return {
    accepted: values[firstRunConsentAcceptedKey] === true,
    acceptedAt: typeof values[firstRunConsentAcceptedAtKey] === "string" ? values[firstRunConsentAcceptedAtKey] : undefined
  };
}

export async function acceptFirstRunConsent(): Promise<FirstRunConsentStatus> {
  const acceptedAt = new Date().toISOString();
  await chrome.storage.local.set({
    [firstRunConsentAcceptedKey]: true,
    [firstRunConsentAcceptedAtKey]: acceptedAt
  });
  return { accepted: true, acceptedAt };
}

export async function clearFirstRunConsent(): Promise<void> {
  await chrome.storage.local.remove([firstRunConsentAcceptedKey, firstRunConsentAcceptedAtKey]);
}
