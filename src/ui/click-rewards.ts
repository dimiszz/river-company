import type { WorkResult } from "../core/types.ts";
import { format } from "./dom.ts";
export function showClickReward(container: HTMLElement, result: WorkResult) {
  const popup = document.createElement("span");
  popup.className = "click-reward";
  popup.textContent = `+${format(result.work)} ◈  +${format(result.cash)} ◉`;
  container.append(popup);
  // Human rapid clicking stays responsive without accumulating DOM elements.
  while (container.children.length > 12) container.firstElementChild?.remove();
  setTimeout(() => popup.remove(), 850);
}
