import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CandidateProfile } from "@job-helper/profile-schema";
import type { ExtensionResponse } from "@job-helper/shared";
import "../ui.css";

function Popup() {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [platform, setPlatform] = useState("Unknown");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void chrome.runtime.sendMessage({ type: "GET_SELECTED_PROFILE" }).then((response: ExtensionResponse) => {
      if (response.ok && response.type === "GET_SELECTED_PROFILE") setProfile(response.profile);
    });
    void chrome.runtime.sendMessage({ type: "SCAN_PAGE" }).then((response: ExtensionResponse) => {
      if (response.ok && response.type === "SCAN_PAGE") setPlatform(response.platform.label);
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
          <dd>{profile?.meta.label ?? "No profile selected"}</dd>
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
