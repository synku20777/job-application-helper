import type { AtsAdapter } from "./baseAdapter";
import { genericHtmlFormAdapter } from "./genericHtmlForm.adapter";
import { greenhouseAdapter } from "./greenhouse.adapter";
import { personioAdapter } from "./personio.adapter";
import { smartRecruitersAdapter } from "./smartRecruiters.adapter";
import { linkedinCopyOnlyAdapter, talentScoutGenericAdapter } from "./stubAdapters";
import { workdayAdapter } from "./workday.adapter";

export const adapters: AtsAdapter[] = [
  linkedinCopyOnlyAdapter,
  workdayAdapter,
  smartRecruitersAdapter,
  greenhouseAdapter,
  personioAdapter,
  talentScoutGenericAdapter,
  genericHtmlFormAdapter
].sort((a, b) => b.priority - a.priority);

export function adapterForId(adapterId: string): AtsAdapter {
  return adapters.find((adapter) => adapter.id === adapterId) ?? genericHtmlFormAdapter;
}
