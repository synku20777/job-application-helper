import { adapterForId } from "@job-helper/adapters";
import { detectPlatform } from "@job-helper/dom-utils";
import type { ExtensionMessage, ExtensionResponse } from "@job-helper/shared";

if (!window.__JOB_AUTOFILL_CONTENT_LOADED__) {
  window.__JOB_AUTOFILL_CONTENT_LOADED__ = true;

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    void (async () => {
      try {
        if (message.type === "SCAN_PAGE") {
          const initialPlatform = detectPlatform(window.location.href);
          const adapter = adapterForId(initialPlatform.adapterId);
          const platform = await adapter.detect({
            url: window.location.href,
            hostname: window.location.hostname
          });

          sendResponse({
            ok: true,
            type: "SCAN_PAGE",
            fields: await adapter.scan({ document }),
            platform: platform.confidence >= initialPlatform.confidence ? platform : initialPlatform,
            url: window.location.href
          } satisfies ExtensionResponse);
          return;
        }

        if (message.type === "EXECUTE_FILL_PLAN") {
          const adapter = adapterForId(message.plan.adapterId);
          sendResponse({
            ok: true,
            type: "EXECUTE_FILL_PLAN",
            result: await adapter.executeFillPlan(message.plan, { document }, message.acceptedElementIds)
          } satisfies ExtensionResponse);
          return;
        }
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unknown content-script error." } satisfies ExtensionResponse);
      }
    })();

    return true;
  });
}
