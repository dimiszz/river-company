import type { Ending } from "../core/types.ts";
import { element } from "./dom.ts";

export const ENDING_SEQUENCE_SECONDS = 3;

export class EndingSequence {
  readonly reducedMotion = matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  private startedAt: number | null = null;
  private finished = false;
  summaryRequested = false;
  private readonly panels = Array.from(
    element("game").querySelectorAll<HTMLElement>(
      "header, .market, .contracts, #upgrade-shop, #click-rewards, #interior-hud, #announcements",
    ),
  );

  get started(): boolean {
    return this.startedAt !== null;
  }
  get complete(): boolean {
    return this.finished;
  }
  start(ending: Ending, now = performance.now()): void {
    if (this.started) return;
    this.startedAt = now;
    element("game").style.setProperty(
      "--ending-sequence-duration",
      `${ENDING_SEQUENCE_SECONDS}s`,
    );
    element("game").classList.add("ending-cinematic");
    for (const panel of this.panels) panel.inert = true;
    const description =
      ending === "destructive" ? "Vale destruído" : "Vale vivo";
    element("world").setAttribute(
      "aria-label",
      `${description}. Pressione Escape ou toque na paisagem para ver o final ou jogar novamente.`,
    );
    element("clicker-status").textContent =
      `${description}. Os controles estão desaparecendo. Pressione Escape ou toque na paisagem para ver o resumo e jogar novamente.`;
    element("world").focus({ preventScroll: true });
  }
  update(now: number): void {
    if (this.startedAt === null || this.finished) return;
    const duration = this.reducedMotion ? 250 : ENDING_SEQUENCE_SECONDS * 1000;
    if (now - this.startedAt < duration) return;
    this.finished = true;
    element("game").classList.add("ending-landscape");
    for (const panel of this.panels) panel.hidden = true;
  }
  toggleSummary(): void {
    if (!this.started) return;
    this.summaryRequested = !this.summaryRequested;
  }
}
