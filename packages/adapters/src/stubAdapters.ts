import type { AtsAdapter } from "./baseAdapter";
import { genericHtmlFormAdapter } from "./genericHtmlForm.adapter";

function stubAdapter(id: string, label: string, priority: number, copyOnly = false): AtsAdapter {
  return {
    ...genericHtmlFormAdapter,
    id,
    label,
    priority,
    copyOnly,
    async detect(context) {
      if (copyOnly) return { adapterId: id, label, confidence: 1, restricted: true, copyOnly: true };
      return { adapterId: id, label, confidence: context.hostname ? 0.8 : 0.5 };
    }
  };
}

export const talentScoutGenericAdapter = stubAdapter("talentscout-custom", "TalentScout/custom", 40);
export const linkedinCopyOnlyAdapter = stubAdapter("linkedin-copy-only", "LinkedIn copy-assist", 100, true);
