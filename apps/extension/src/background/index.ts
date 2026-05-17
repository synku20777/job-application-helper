import { adapterForId } from "@job-helper/adapters";
import type { ExtensionMessage, ExtensionResponse } from "@job-helper/shared";
import {
  deleteAllData,
  deleteSiteOverride,
  exportSelectedProfile,
  getSelectedProfile,
  getSiteOverride,
  saveProfile,
  saveSiteOverride
} from "../storage/profileStore";
import contentScript from "../content/index?script";

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

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  void (async () => {
    try {
      if (message.type === "GET_SELECTED_PROFILE") {
        sendResponse({ ok: true, type: message.type, profile: await getSelectedProfile() } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "SAVE_PROFILE") {
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

      if (message.type === "SCAN_PAGE") {
        sendResponse(await sendToActiveTab(message));
        return;
      }

      if (message.type === "BUILD_FILL_PLAN") {
        const tab = await activeTab();
        const adapter = adapterForId(message.platform.adapterId);
        const hostname = hostnameFromUrl(tab.url);
        const siteOverride = hostname ? await getSiteOverride(hostname, message.platform.adapterId) : null;
        const options = { siteOverride };
        const plan = await adapter.buildFillPlan(message.fields, message.profile, options, tab.url ?? "about:blank");
        sendResponse({ ok: true, type: message.type, plan, options } satisfies ExtensionResponse);
        return;
      }

      if (message.type === "EXECUTE_FILL_PLAN") {
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
