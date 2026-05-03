import { inject } from "vue";
import { PARTY_TOOL_PANELS_KEY } from "./partyToolPanelsKeys.js";

/** Parent (`Party.vue`) で provide されたツールパネル用コンテキストを取得する */
export function usePartyToolPanelsContext() {
  const ctx = inject(PARTY_TOOL_PANELS_KEY);
  if (!ctx) {
    throw new Error(
      "Party tool panels: missing provide(PARTY_TOOL_PANELS_KEY) from Party.vue",
    );
  }
  return ctx;
}
