import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ExtensionResponse } from "@job-helper/shared";
import "../ui.css";

function Popup() {
  const [profileLabel, setProfileLabel] = useState("No profile selected");
  const [platform, setPlatform] = useState("Unknown");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void chrome.runtime.sendMessage({ type: "LIST_PROFILES" }).then((response: ExtensionResponse) => {
      if (response.ok && response.type === "LIST_PROFILES") {
        setProfileLabel(response.profiles.find((profile) => profile.selected)?.label ?? "No profile selected");
      }
    });
    void chrome.runtime.sendMessage({ type: "GET_ACTIVE_TAB_STATUS" }).then((response: ExtensionResponse) => {
      if (response.ok && response.type === "GET_ACTIVE_TAB_STATUS") setPlatform(response.status.platform.label);
      if (!response.ok) setError(response.error);
    });
  }, []);

  async function openPanel() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId) await chrome.sidePanel.open({ windowId: tab.windowId });
    window.close();
  }

  return (
    <main className="popup-shell">
      <header>
        <h1>Job Autofill</h1>
        <p>{platform}</p>
      </header>
      <dl className="meta-list">
        <div>
          <dt>Profile</dt>
          <dd>{profileLabel}</dd>
        </div>
      </dl>
      {error ? <p className="notice error">{error}</p> : null}
      <button className="primary" onClick={openPanel}>
        Open workflow
      </button>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
