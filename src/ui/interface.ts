import { MARKET } from "../config/market.ts";
import { CONTRACT_PRESENTATION } from "../config/game-balance.ts";
import { showClickReward } from "./click-rewards.ts";
import { RESOURCE_ICONS } from "../config/icons.ts";
import {
  TUTORIAL,
  TUTORIAL_STEPS,
  TUTORIAL_STEP_COUNT,
} from "../config/tutorial.ts";
import { tutorialGuidance, canSignContract } from "../core/tutorial.ts";
import { EndingSequence } from "./ending-sequence.ts";
import {
  CONTRACTS,
  UPGRADES,
  UPGRADE_KEYS,
  bottleneck,
  contractOffer,
  contractClickRate,
  contractPayout,
  previewUpgrade,
  production,
  upgradeCost,
} from "../core/economy.ts";
import type {
  GameState,
  TutorialLesson,
  UpgradeKey,
  ViewState,
  WorkResult,
} from "../core/types.ts";
import { element, format, formatWhole, text } from "./dom.ts";

export interface InterfaceActions {
  acknowledgeTutorial(lesson: TutorialLesson): void;
  accept(index: number): void;
  buy(key: UpgradeKey): void;
  leave(): void;
  pause(): void;
  speed(): void;
  fastMode(): void;
  zoom(direction: -1 | 1): void;
  toggleUpgrades(): void;
  sound(): void;
}
interface ShopCard {
  button: HTMLButtonElement;
  price: HTMLElement;
  level: HTMLElement;
  fill: HTMLElement;
}
const SHORT_LABELS: Record<UpgradeKey, string> = {
  chip: "Chips",
  automation: "Automação",
  server: "Capacidade",
  solar: "Solar",
  coal: "Petróleo",
  cooling: "Refrigeração",
  water: "Rio",
  efficiency: "Eficiência",
  plant: "Árvores",
};

export class GameInterface {
  private readonly cards = new Map<UpgradeKey, ShopCard>();
  private readonly contracts: HTMLButtonElement[] = [];
  private readonly feedback = element("boost-feedback");
  private feedbackUntil = 0;
  private lastChart = "";
  private activeTutorialLesson: TutorialLesson | undefined;
  private endingShown = false;
  private lastTutorialKey = "";
  private tutorialHintUntil = 0;
  private lastPreviewSignature = "";
  private pendingOfferReveal = false;
  private offerAnimations: Animation[] = [];

  private readonly cinematic: EndingSequence;

  constructor(actions: InterfaceActions, cinematic: EndingSequence) {
    this.cinematic = cinematic;
    text(element("energy").querySelector("span")!, RESOURCE_ICONS.power);
    text(element("water").querySelector("span")!, RESOURCE_ICONS.cooling);
    text(element("compute").querySelector("span")!, RESOURCE_ICONS.capacity);
    const list = element("upgrade-list");
    for (const key of UPGRADE_KEYS) {
      const definition = UPGRADES[key];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "upgrade-card";
      button.dataset.upgrade = key;
      if (key === "solar" || key === "coal") button.dataset.resource = "power";
      if (key === "cooling" || key === "water")
        button.dataset.resource = "cooling";
      button.setAttribute("aria-label", `Comprar ${definition.label}`);
      button.innerHTML = `<span class="upgrade-icon" aria-hidden="true">${definition.icon}</span><span class="upgrade-description"><strong>${SHORT_LABELS[key]}</strong></span><span class="upgrade-purchase"><strong class="upgrade-price"></strong><small class="upgrade-level"></small></span><span class="upgrade-afford"><i></i></span>`;
      button.addEventListener("click", () => actions.buy(key));
      list.append(button);
      this.cards.set(key, {
        button,
        price: button.querySelector<HTMLElement>(".upgrade-price")!,
        level: button.querySelector<HTMLElement>(".upgrade-level")!,
        fill: button.querySelector<HTMLElement>(".upgrade-afford i")!,
      });
    }
    element("tutorial-next").addEventListener("click", () => {
      if (this.activeTutorialLesson)
        actions.acknowledgeTutorial(this.activeTutorialLesson);
    });
    const offers = element("offers");
    CONTRACTS.forEach((contract, index) => {
      const button = document.createElement("button");
      button.className = "offer";
      button.type = "button";
      button.dataset.contract = String(index);
      button.setAttribute(
        "aria-label",
        `Aceitar contrato ${CONTRACT_PRESENTATION.labels[index]}`,
      );
      button.innerHTML = `<div class="offer-icons"><strong class="contract-size">${CONTRACT_PRESENTATION.labels[index]}</strong><span class="contract-reward"></span></div><div class="contract-terms"><span class="contract-demand"></span><span class="contract-work"></span><span class="contract-deadline"></span></div><div class="contract-readiness"></div><div class="offer-details"><span class="contract-completion">IA <strong class="progress-value">0%</strong></span><svg class="clock" viewBox="0 0 24 24" role="img"><circle cx="12" cy="12" r="9" stroke="#52654e" fill="none" stroke-width="2"/><circle class="clock-ring" cx="12" cy="12" r="9" stroke="#d8f293" fill="none" stroke-width="2" stroke-dasharray="56.55"/></svg></div><div class="contract-progress" role="progressbar" aria-label="Progresso do contrato de IA" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><div class="contract-throughput"><span class="processing-rate"></span><span class="capacity-note"></span></div>`;
      button
        .querySelector(".clock")!
        .setAttribute(
          "aria-label",
          `${contract.deadline} segundos para entregar`,
        );
      button.addEventListener("click", () => actions.accept(index));
      offers.append(button);
      this.contracts.push(button);
    });
    // Paid clicks are delegated once at the game root.

    element("leave-interior").addEventListener("click", actions.leave);
    element("pause").addEventListener("click", actions.pause);
    element("speed").addEventListener("click", actions.speed);
    element("fast-mode").addEventListener("click", actions.fastMode);
    element("interior-zoom-in").addEventListener("click", () =>
      actions.zoom(-1),
    );
    element("interior-zoom-out").addEventListener("click", () =>
      actions.zoom(1),
    );
    element("toggle-upgrades").addEventListener(
      "click",
      actions.toggleUpgrades,
    );
    element("sound").addEventListener("click", actions.sound);
    element("restart").addEventListener("click", () => location.reload());
    element("again").addEventListener("click", () => location.reload());
  }
  notifyBoost(result: WorkResult): void {
    if (this.cinematic.started) return;
    showClickReward(element("click-rewards"), result);
  }
  notify(message: string): void {
    if (this.cinematic.started) return;
    this.feedbackUntil = performance.now() + 2400;
    text(this.feedback, message);
    text(element("clicker-status"), message);
  }
  revealContracts(): void {
    this.pendingOfferReveal = true;
  }
  private cancelOfferAnimations(): void {
    for (const animation of this.offerAnimations) animation.cancel();
    this.offerAnimations = [];
  }
  private animateOffers(): void {
    this.cancelOfferAnimations();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    this.offerAnimations = this.contracts.map((button, index) =>
      button.animate(
        [
          { opacity: 0, transform: "translateY(14px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        {
          duration: 650,
          delay: index * 160,
          easing: "cubic-bezier(.2,.7,.2,1)",
          fill: "backwards",
        },
      ),
    );
  }
  render(
    state: GameState,
    view: ViewState,
    openLand: number,
    now = performance.now(),
  ): void {
    const guidance = tutorialGuidance(state, view.mode);
    if (guidance.key !== this.lastTutorialKey) {
      this.lastTutorialKey = guidance.key;
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
        element("tutorial-card").animate(
          [
            { opacity: 0.35, transform: "translateY(-8px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 350, easing: "ease-out" },
        );
      this.tutorialHintUntil = now + TUTORIAL.completionHintSeconds * 1000;
    }
    this.activeTutorialLesson = guidance.lesson;
    element("tutorial-next").hidden =
      !state.tutorialEnabled || !!state.ending || !guidance.lesson;
    text(element("hint"), guidance.text);
    const tutorialVisible =
      state.tutorialEnabled &&
      !state.ending &&
      (guidance.persistent || now <= this.tutorialHintUntil);
    element("tutorial-card").hidden = !tutorialVisible;
    element("game").classList.toggle("tutorial-visible", !!tutorialVisible);
    const tutorialStep = TUTORIAL_STEPS[guidance.key];
    text(element("tutorial-title"), tutorialStep.title);
    text(
      element("tutorial-step"),
      `${tutorialStep.step} / ${TUTORIAL_STEP_COUNT}`,
    );
    element("tutorial-progress").querySelector<HTMLElement>("i")!.style.width =
      `${(tutorialStep.step / TUTORIAL_STEP_COUNT) * 100}%`;
    element("shop-locked").hidden = state.unlockedUpgrades.length > 0;
    const output = production(state);
    text(element("cash"), formatWhole(Math.floor(state.cash)));
    text(
      element("income-rate"),
      format(state.paused || state.ending ? 0 : output.perSecond),
    );
    this.feedback.classList.toggle("visible", now < this.feedbackUntil);
    text(element("pause"), state.paused ? "▶" : "Ⅱ");
    element("pause").setAttribute(
      "aria-label",
      state.paused ? "Continuar" : "Pausar",
    );
    text(element("speed"), `${state.speed}×`);
    const fastMode = element("fast-mode") as HTMLButtonElement;
    fastMode.classList.toggle("enabled", state.fastMode);
    fastMode.setAttribute("aria-pressed", String(state.fastMode));
    fastMode.setAttribute(
      "aria-label",
      `Modo rápido ${state.fastMode ? "ativado" : "desativado"}`,
    );
    fastMode.disabled = !!state.ending;
    text(fastMode, state.fastMode ? "Rápido 3×" : "Rápido");
    text(
      element("shop-count"),
      String(UPGRADE_KEYS.reduce((sum, key) => sum + state.upgrades[key], 0)),
    );
    element("upgrade-shop").classList.toggle(
      "collapsed",
      !view.upgradesExpanded,
    );
    element("toggle-upgrades").setAttribute(
      "aria-expanded",
      String(view.upgradesExpanded),
    );
    text(element("shop-toggle-icon"), view.upgradesExpanded ? "−" : "+");
    const signature = JSON.stringify([
      state.placed,
      state.fastMode,
      state.capacity,
      state.power,
      state.cooling,
      state.active?.demand ?? 0,
      state.contractRound,
      state.upgrades,
      openLand,
    ]);
    const previewChanged = signature !== this.lastPreviewSignature;
    this.lastPreviewSignature = signature;
    for (const key of UPGRADE_KEYS) {
      const card = this.cards.get(key)!;
      const unlocked = state.unlockedUpgrades.includes(key);
      card.button.hidden = !unlocked;
      card.button.classList.toggle(
        "tutorial-focus",
        state.tutorialEnabled && guidance.focus.includes(key),
      );
      const price = upgradeCost(key, state.upgrades);
      const needsLand =
        key === "plant" ||
        (["solar", "coal", "cooling"].includes(key) &&
          state.upgrades[key] === 0);
      card.button.disabled =
        !unlocked ||
        !state.placed ||
        !!state.ending ||
        state.cash + 1e-9 < price ||
        (needsLand && openLand === 0);
      text(card.price, `◉ ${formatWhole(price)}`);
      text(card.level, `NÍV ${state.upgrades[key]}`);
      card.button.classList.toggle(
        "needed",
        state.placed &&
          !state.ending &&
          ((state.power < state.capacity &&
            (key === "solar" || key === "coal")) ||
            (state.cooling < state.capacity &&
              (key === "cooling" || key === "water"))),
      );
      card.fill.style.width = `${Math.min(100, (state.cash / price) * 100)}%`;
      if (previewChanged) {
        const p = previewUpgrade(state, key);
        let label = "";
        let limited = false;
        if (key === "chip")
          label = `◈ ${format(p.before.perClick)} → ${format(p.after.perClick)}`;
        if (key === "automation" || key === "efficiency")
          label = `↻ ${format(p.before.rate)}× → ${format(p.after.rate)}×`;
        if (key === "solar" || key === "coal")
          label = `${RESOURCE_ICONS.power} ${state.power} → ${p.next.power}`;
        if (key === "cooling" || key === "water")
          label = `≋ ${state.cooling} → ${p.next.cooling}`;
        if (key === "plant") label = `♧ +${Math.min(3, openLand)}`;
        if (key === "server") {
          limited = p.after.online === p.before.online;
          label = `▥ ${p.before.online} → ${p.after.online}${limited ? " · " + (state.power < p.next.capacity ? RESOURCE_ICONS.power : RESOURCE_ICONS.cooling) : ""}`;
        }
        card.button.classList.toggle("limited", state.placed && limited);
        card.button.title = `${UPGRADES[key].label}: ${formatWhole(price)} moedas. ${UPGRADES[key].effect}. ${label}${limited ? " — precisa de mais energia ou refrigeração" : ""}`;
      }
    }
    this.renderContracts(state, view);
    this.renderMarket(state);
    element("game").classList.toggle(
      "inside-datacenter",
      view.mode === "interior",
    );
    element("interior-hud").hidden = view.mode !== "interior";
    const ended = !!state.ending;
    element("ending").hidden = !ended || !this.cinematic.summaryRequested;
    if (ended) {
      if (!this.endingShown) {
        this.endingShown = true;
        const line = element<SVGPathElement>("chartline").cloneNode(
          true,
        ) as SVGPathElement;
        line.removeAttribute("id");
        element<SVGSVGElement>("end-chart").replaceChildren(line);
      }
      const bad = state.ending === "destructive";
      text(element("end-symbol"), bad ? "♨" : "♧");
      text(
        element("end-title"),
        bad ? "Tudo. A qualquer custo." : "O suficiente. E ainda vivo.",
      );
      text(
        element("end-copy"),
        bad
          ? "A empresa continuou crescendo. O rio não resistiu."
          : "Uma empresa menor. Um mundo que ainda respira.",
      );
    }
  }
  private renderContracts(state: GameState, view: ViewState): void {
    if (state.ending) {
      this.pendingOfferReveal = false;
      return;
    }
    const active = state.active;
    const waiting = state.contractCooldown > 0;
    const panel = element("contract-panel");
    const contractsAvailable =
      !state.tutorialEnabled ||
      (state.upgrades.chip > 0 &&
        state.tutorialInteriorVisited &&
        (view.mode === "valley" || state.completed > 0 || !!active));
    panel.hidden = !state.placed || !contractsAvailable;
    panel.classList.toggle("choosing", !active && !waiting);
    panel.classList.toggle("waiting", waiting);
    element("game").classList.toggle(
      "choosing-contract",
      state.placed && contractsAvailable && !active && !waiting,
    );
    if (active && this.offerAnimations.length) this.cancelOfferAnimations();
    text(
      element("contract-state"),
      waiting
        ? `◷ ${Math.ceil(state.contractCooldown)}s`
        : active
          ? state.paused
            ? "Ⅱ"
            : "◷"
          : "◇ ◇ ◇",
    );
    this.contracts.forEach((button, index) => {
      const offer = contractOffer(index, state.contractRound);
      const selected = active?.index === index;
      const terms = selected && active ? active : offer;
      const payout =
        selected && active
          ? active.payout
          : contractPayout(state, offer.reward);
      text(button.querySelector(".contract-reward")!, `◉ ${format(payout)}`);
      text(
        button.querySelector(".contract-demand")!,
        `${RESOURCE_ICONS.capacity} ${terms.demand}`,
      );
      text(button.querySelector(".contract-work")!, `◈ ${format(terms.work)}`);
      text(
        button.querySelector(".contract-deadline")!,
        `◷ ${Math.ceil(selected && active ? active.remaining : terms.deadline)}s`,
      );
      const required = contractClickRate(state, offer);
      text(
        button.querySelector(".contract-readiness")!,
        Number.isFinite(required)
          ? required === 0
            ? "↻"
            : `◈ ${format(required)}/s`
          : `${RESOURCE_ICONS.power} ${RESOURCE_ICONS.cooling}`,
      );
      button.classList.toggle(
        "demanding",
        !selected &&
          required > CONTRACT_PRESENTATION.comfortableClicksPerSecond,
      );
      button.hidden = waiting || (!!active && !selected);
      button.disabled =
        !state.placed ||
        !!state.ending ||
        !!active ||
        waiting ||
        !canSignContract(state, index);
      button.classList.toggle(
        "tutorial-focus",
        state.tutorialEnabled &&
          !active &&
          state.completed === 0 &&
          index === 0,
      );
      button.classList.toggle("active", selected);
      if (!selected || !active) {
        button.setAttribute(
          "aria-label",
          `Aceitar contrato ${CONTRACT_PRESENTATION.labels[index]}: ${format(payout)} moedas, ${formatWhole(offer.work)} de trabalho, ${offer.demand} de capacidade, ${offer.deadline} segundos`,
        );
        button.title = `Pagamento: ${format(payout)} moedas. Prazo de ${offer.deadline}s. ${Number.isFinite(required) ? `Cerca de ${format(required)} cliques por segundo com a capacidade atual.` : "Precisa de energia e refrigeração."}`;
        button.classList.remove("deadline-risk");
        button
          .querySelector(".clock-ring")!
          .setAttribute("stroke-dashoffset", "0");
        button
          .querySelector(".clock")!
          .setAttribute(
            "aria-label",
            `${offer.deadline} segundos para entregar`,
          );
        return;
      }
      const output = production(state);
      const progress = Math.min(100, (active.progress / active.work) * 100);
      const projectedRate =
        output.rate +
        output.perClick * CONTRACT_PRESENTATION.comfortableClicksPerSecond;
      const risky =
        projectedRate <= 0 ||
        (active.work - active.progress) / projectedRate > active.remaining;
      button.classList.toggle("deadline-risk", risky);
      text(
        button.querySelector(".progress-value")!,
        `${Math.floor(progress)}%`,
      );
      const bar = button.querySelector<HTMLElement>(".contract-progress")!;
      bar.setAttribute("aria-valuenow", String(Math.floor(progress)));
      bar.querySelector<HTMLElement>("i")!.style.width = `${progress}%`;
      text(
        button.querySelector(".processing-rate")!,
        state.paused ? "Ⅱ" : `${format(output.rate)}×`,
      );
      text(button.querySelector(".capacity-note")!, bottleneck(state) ?? "");
      button
        .querySelector(".clock-ring")!
        .setAttribute(
          "stroke-dashoffset",
          String(56.55 * (1 - Math.max(0, active.remaining / active.deadline))),
        );
      button
        .querySelector(".clock")!
        .setAttribute(
          "aria-label",
          `${Math.ceil(active.remaining)} segundos até o prazo${risky ? ". Clique ou compre melhorias para entregar a tempo." : ""}`,
        );
    });
    if (!active && !waiting && this.pendingOfferReveal) {
      this.pendingOfferReveal = false;
      this.animateOffers();
    }
  }
  private renderMarket(state: GameState): void {
    const history = state.history.slice(-MARKET.historyLength);
    const signature = history.join(",");
    if (signature !== this.lastChart) {
      this.lastChart = signature;
      const low = Math.min(...history),
        high = Math.max(...history);
      const padding = Math.max(4, (high - low) * 0.18);
      const minimum = low - padding,
        maximum = high + padding;
      const points = history.map((value, index) => [
        (index / (history.length - 1)) * 220,
        60 - ((value - minimum) / (maximum - minimum)) * 55,
      ]);
      const path = points
        .map((p, i) => (i ? "L" : "M") + p.join(","))
        .join(" ");
      element("chartline").setAttribute("d", path);
      element("chartfill").setAttribute("d", `${path} L220,65 L0,65Z`);
      const last = points[points.length - 1];
      element("chartdot").setAttribute("cx", String(last[0]));
      element("chartdot").setAttribute("cy", String(last[1]));
      text(element("trend"), history.at(-1)! >= history.at(-2)! ? "↗" : "↘");
    }
    text(
      element("stock-price"),
      state.price.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    );
    const change = (state.price / MARKET.startingPrice - 1) * 100;
    text(
      element("stock-change"),
      `${change >= 0 ? "+" : ""}${change.toFixed(0)}%`,
    );
    element("stock-change").title = "Variação desde a fundação da empresa";
    const falling = history.at(-1)! < history.at(-2)!;
    element("chart").closest(".market")!.classList.toggle("falling", falling);
    element("chart").setAttribute(
      "aria-label",
      `Valor da empresa: ${format(state.price)}. Variação de ${formatWhole(change)} por cento desde a fundação.`,
    );
    const demand = state.placed ? state.capacity : 0;
    for (const [id, supply, label] of [
      ["energy", state.power, "Energia elétrica"],
      ["compute", production(state).online, "Capacidade de IA ativa"],
      ["water", state.cooling, "Refrigeração"],
    ] as const) {
      const meter = element(id);
      meter.querySelector<HTMLElement>("i")!.style.width =
        `${demand ? Math.min(1, supply / demand) * 100 : 0}%`;
      meter.classList.toggle("shortage", demand > 0 && supply < demand);
      meter.setAttribute(
        "aria-label",
        `${label}: ${supply} disponíveis para ${demand} unidades de capacidade`,
      );
    }
  }
}
