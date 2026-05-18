import { adapterForId, adapters, buildInspectionWithAdapter } from "@job-helper/adapters";
import type { ExtensionMessage, ExtensionResponse, FillPlan, InspectionResult, PlatformDetection } from "@job-helper/shared";
import { acceptFirstRunConsent, getFirstRunConsent } from "../storage/complianceStore";
import { getExecutionMode, setExecutionMode } from "../storage/executionModeStore";
import {
  deleteAllData,
  deleteProfile,
  deleteProfileVariant,
  deleteLocalMappingOverride,
  deleteSiteOverride,
  deleteSiteRecipe,
  exportSelectedProfile,
  exportSiteRecipes,
  getEncryptionStatus,
  getSelectedProfile,
  getSiteOverride,
  importSiteRecipe,
  isProfileStoreUnlocked,
  listLocalMappingOverrides,
  listProfileVariants,
  listProfiles,
  listSiteRecipes,
  lockProfileStore,
  saveLocalMappingOverride,
  saveProfile,
  saveProfileVariant,
  saveSiteOverride,
  selectProfile,
  selectProfileVariant,
  selectedProfileVariant,
  setProfilePassphrase,
  unlockProfileStore
} from "../storage/profileStore";
import { applyProfileVariant } from "../storage/profileVariants";
import contentScript from "../content/index?script";
import { isLinkedInUrl, linkedInCopyOnlyPlatform, linkedInScanResponse } from "./linkedinGuard";
import { ensureHostPermission, hostPermissionState } from "./permissions";

async function activeTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab is available.");
  return tab;
}

async function sendToActiveTab(message: ExtensionMessage): Promise<ExtensionResponse> {
  const tab = await activeTab();
  try {
    return await chrome.tabs.sendMessage(tab.id!, message);
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id! }, files: [contentScript] });
    return chrome.tabs.sendMessage(tab.id!, message);
  }
}

function hostnameFromUrl(url: string | undefined): string {
  try {
    return new URL(url ?? "about:blank").hostname.toLowerCase();
  } catch {
    return "";
  }
}

async function detectPlatformFromUrl(url: string | undefined): Promise<PlatformDetection> {
  if (isLinkedInUrl(url)) return linkedInCopyOnlyPlatform;
  const safeUrl = url ?? "about:blank";
  const hostname = hostnameFromUrl(safeUrl);
  for (const adapter of adapters) {
    const detection = await adapter.detect({ url: safeUrl, hostname });
    if (detection.confidence > 0) return detection;
  }
  return { adapterId: "generic-html-form", label: "Generic HTML form", confidence: 0.4 };
}

async function activeTabComplianceStatus() {
  const tab = await activeTab();
  const url = tab.url ?? "about:blank";
  return {
    url,
    platform: await detectPlatformFromUrl(url),
    permissionState: await hostPermissionState(url)
  };
}

function emptyFillPlan(url: string, platform: PlatformDetection, profileId = "copy-only"): FillPlan {
  return {
    id: crypto.randomUUID?.() ?? `fill-plan-${Date.now()}`,
    adapterId: platform.adapterId,
    url,
    createdAt: new Date().toISOString(),
    profileId,
    detectedPlatform: platform.label,
    steps: [],
    warnings: []
  };
}

async function copyOnlyInspection(url: string): Promise<InspectionResult> {
  const mode = await getExecutionMode();
  const plan = emptyFillPlan(url, linkedInCopyOnlyPlatform);
  return {
    url,
    platform: linkedInCopyOnlyPlatform,
    fields: [],
    matches: [],
    plan,
    diagnostics: {
      parser: {
        scannedElements: 0,
        candidateFields: 0,
        sectionsDetected: 0,
        repeatableGroupsDetected: 0,
        ignoredHiddenElements: 0,
        highConfidenceMatches: 0,
        reviewRequiredMatches: 0,
        manualSteps: 0,
        skippedFields: 0,
        adapterId: linkedInCopyOnlyPlatform.adapterId,
        parserVersion: "phase-6",
        warnings: ["LinkedIn is copy-assist only. No page scan or fill plan was generated."]
      },
      steps: []
    },
    executionMode: mode,
    acceptedCandidateIds: []
  };
}

async function requireFirstRunConsent(): Promise<void> {
  const consent = await getFirstRunConsent();
  if (!consent.accepted) throw new Error("Review and accept the privacy disclosure before using autofill.");
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  void (async () => {
    try {
      if (message.type === "GET_SELECTED_PROFILE") {
        sendResponse({ ok: true, type: message.type, profile: await getSelectedProfile() } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "LIST_PROFILES") {
        sendResponse({ ok: true, type: message.type, profiles: await listProfiles() } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "SELECT_PROFILE") {
        const result = await selectProfile(message.profileId);
        sendResponse({ ok: true, type: message.type, ...result } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "DELETE_PROFILE") {
        const result = await deleteProfile(message.profileId);
        sendResponse({ ok: true, type: message.type, ...result } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "LIST_PROFILE_VARIANTS") {
        sendResponse({ ok: true, type: message.type, ...(await listProfileVariants(message.baseProfileId)) } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "SAVE_PROFILE_VARIANT") {
        sendResponse({ ok: true, type: message.type, ...(await saveProfileVariant(message.variant)) } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "SELECT_PROFILE_VARIANT") {
        sendResponse({
          ok: true,
          type: message.type,
          ...(await selectProfileVariant(message.baseProfileId, message.variantId))
        } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "DELETE_PROFILE_VARIANT") {
        sendResponse({
          ok: true,
          type: message.type,
          ...(await deleteProfileVariant(message.baseProfileId, message.variantId))
        } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "GET_FIRST_RUN_CONSENT") {
        sendResponse({ ok: true, type: message.type, consent: await getFirstRunConsent() } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "ACCEPT_FIRST_RUN_CONSENT") {
        sendResponse({ ok: true, type: message.type, consent: await acceptFirstRunConsent() } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "GET_ACTIVE_TAB_STATUS") {
        sendResponse({ ok: true, type: message.type, status: await activeTabComplianceStatus() } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "GET_EXECUTION_MODE") {
        sendResponse({ ok: true, type: message.type, mode: await getExecutionMode() } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "SET_EXECUTION_MODE") {
        sendResponse({ ok: true, type: message.type, mode: await setExecutionMode(message.mode) } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "GET_ENCRYPTION_STATUS") {
        sendResponse({ ok: true, type: message.type, status: await getEncryptionStatus() } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "SET_PASSPHRASE") {
        const result = await setProfilePassphrase(message.passphrase);
        sendResponse({ ok: true, type: message.type, ...result } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "UNLOCK_PROFILE_STORE") {
        const result = await unlockProfileStore(message.passphrase);
        sendResponse({ ok: true, type: message.type, ...result } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "LOCK_PROFILE_STORE") {
        sendResponse({ ok: true, type: message.type, status: await lockProfileStore() } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "SAVE_PROFILE") {
        await requireFirstRunConsent();
        sendResponse({ ok: true, type: message.type, profile: await saveProfile(message.profile) } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "EXPORT_PROFILE") {
        sendResponse({ ok: true, type: message.type, profile: await exportSelectedProfile() } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "DELETE_ALL_DATA") {
        await deleteAllData();
        sendResponse({ ok: true, type: message.type } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "GET_SITE_OVERRIDES") {
        const override = await getSiteOverride(message.hostname, message.adapterId);
        sendResponse({ ok: true, type: message.type, override } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "SAVE_SITE_OVERRIDE") {
        const override = await saveSiteOverride(message.hostname, message.adapterId, message.override);
        sendResponse({ ok: true, type: message.type, override } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "DELETE_SITE_OVERRIDE") {
        const override = await deleteSiteOverride(message.hostname, message.adapterId, message.overrideId);
        sendResponse({ ok: true, type: message.type, override } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "LIST_LOCAL_MAPPING_OVERRIDES") {
        const overrides = await listLocalMappingOverrides(message.hostname, message.adapterId);
        sendResponse({ ok: true, type: message.type, overrides } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "SAVE_LOCAL_MAPPING_OVERRIDE") {
        const override = await saveLocalMappingOverride(message.override);
        sendResponse({ ok: true, type: message.type, override } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "DELETE_LOCAL_MAPPING_OVERRIDE") {
        const overrides = await deleteLocalMappingOverride(message.overrideId);
        sendResponse({ ok: true, type: message.type, overrides } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "LIST_SITE_RECIPES") {
        sendResponse({ ok: true, type: message.type, recipes: await listSiteRecipes() } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "IMPORT_SITE_RECIPE") {
        sendResponse({ ok: true, type: message.type, ...(await importSiteRecipe(message.recipe)) } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "EXPORT_SITE_RECIPES") {
        sendResponse({ ok: true, type: message.type, recipes: await exportSiteRecipes() } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "DELETE_SITE_RECIPE") {
        sendResponse({ ok: true, type: message.type, recipes: await deleteSiteRecipe(message.recipeId) } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "SCAN_PAGE") {
        await requireFirstRunConsent();
        const tab = await activeTab();
        if (isLinkedInUrl(tab.url)) {
          sendResponse(linkedInScanResponse(tab.url ?? "about:blank"));
          return;
        }
        await ensureHostPermission(tab.url);
        sendResponse(await sendToActiveTab(message));
        return;
      }

      if (message.type === "INSPECT_PAGE") {
        await requireFirstRunConsent();
        const tab = await activeTab();
        const url = tab.url ?? "about:blank";
        if (isLinkedInUrl(url)) {
          sendResponse({ ok: true, type: message.type, inspection: await copyOnlyInspection(url) } satisfies ExtensionResponse);
          return;
        }

        if (!isProfileStoreUnlocked()) throw new Error("Profile store is locked. Unlock profiles before inspecting a page.");
        const selectedProfile = await getSelectedProfile();
        if (!selectedProfile) throw new Error("Select or save a profile before inspecting a page.");

        await ensureHostPermission(url);
        const scanResponse = await sendToActiveTab({ type: "SCAN_PAGE" });
        if (!scanResponse.ok) {
          sendResponse(scanResponse);
          return;
        }
        if (scanResponse.type !== "SCAN_PAGE") throw new Error("Unexpected scan response.");

        const adapter = adapterForId(scanResponse.platform.adapterId);
        const hostname = hostnameFromUrl(scanResponse.url);
        const siteOverride = hostname ? await getSiteOverride(hostname, scanResponse.platform.adapterId) : null;
        const localMappingOverrides = hostname ? await listLocalMappingOverrides(hostname, scanResponse.platform.adapterId) : [];
        const siteRecipes = hostname ? await listSiteRecipes(hostname) : [];
        const variant = await selectedProfileVariant(selectedProfile.meta.profileId);
        const mode = await getExecutionMode();
        const inspection = await buildInspectionWithAdapter(
          adapter,
          scanResponse.fields,
          applyProfileVariant(selectedProfile, variant),
          { siteOverride, localMappingOverrides, siteRecipes },
          scanResponse.url,
          mode,
          scanResponse.platform,
          scanResponse.pageActions
        );
        sendResponse({ ok: true, type: message.type, inspection } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "BUILD_FILL_PLAN") {
        await requireFirstRunConsent();
        if (!isProfileStoreUnlocked()) throw new Error("Profile store is locked. Unlock profiles before building a fill plan.");
        const tab = await activeTab();
        const adapter = adapterForId(message.platform.adapterId);
        const hostname = hostnameFromUrl(tab.url);
        const siteOverride = hostname ? await getSiteOverride(hostname, message.platform.adapterId) : null;
        const localMappingOverrides = hostname ? await listLocalMappingOverrides(hostname, message.platform.adapterId) : [];
        const siteRecipes = hostname ? await listSiteRecipes(hostname) : [];
        const options = { siteOverride, localMappingOverrides, siteRecipes };
        const variant = await selectedProfileVariant(message.profile.meta.profileId);
        const plan = await adapter.buildFillPlan(
          message.fields,
          applyProfileVariant(message.profile, variant),
          options,
          tab.url ?? "about:blank"
        );
        sendResponse({ ok: true, type: message.type, plan, options } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "EXECUTE_FILL_PLAN") {
        await requireFirstRunConsent();
        const tab = await activeTab();
        if (!isLinkedInUrl(tab.url)) await ensureHostPermission(tab.url);
        sendResponse(await sendToActiveTab(message));
        return;
      }
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unknown extension error." } satisfies ExtensionResponse);
    }
  })();

  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});
