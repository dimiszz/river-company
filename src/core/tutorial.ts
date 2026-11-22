import { RESOURCE_ICONS } from "../config/icons.ts";
import { TUTORIAL } from "../config/tutorial.ts";
import { UPGRADE_KEYS, upgradeCost } from "./economy.ts";
import type { GameState, UpgradeKey, TutorialLesson } from "./types.ts";
export interface TutorialGuidance {
  key: string;
  text: string;
  focus: UpgradeKey[];
  persistent: boolean;
  lesson?: TutorialLesson;
}
export function refreshTutorial(state: GameState) {
  if (!state.tutorialEnabled) {
    state.unlockedUpgrades = [...UPGRADE_KEYS];
    state.tutorialComplete = true;
    return;
  }
  if (!state.placed) return;
  const unlocked = new Set(state.unlockedUpgrades);
  if (
    state.jobs >= TUTORIAL.clicksToRevealChips &&
    state.tutorialLessons.includes("work")
  )
    unlocked.add("chip");
  if (state.completed >= 1 && state.tutorialLessons.includes("stocks"))
    unlocked.add("automation");
  if (state.upgrades.automation >= 1) unlocked.add("server");
  if (state.capacity > state.power) {
    unlocked.add("solar");
    unlocked.add("coal");
  }
  if (state.capacity > state.cooling) {
    unlocked.add("cooling");
    unlocked.add("water");
  }
  if (
    state.upgrades.chip >= 1 &&
    state.upgrades.automation >= 1 &&
    state.upgrades.server >= 1 &&
    state.power >= state.capacity &&
    state.cooling >= state.capacity
  )
    state.tutorialComplete = true;
  if (
    state.tutorialComplete &&
    state.completed >= TUTORIAL.deliveriesForEfficiency
  )
    unlocked.add("efficiency");
  if (state.tutorialComplete && state.damage >= TUTORIAL.damageForTrees)
    unlocked.add("plant");
  state.unlockedUpgrades = UPGRADE_KEYS.filter((key) => unlocked.has(key));
}
export function canSignContract(state: GameState, index: number) {
  return (
    !state.tutorialEnabled ||
    (state.upgrades.chip >= 1 &&
      state.tutorialInteriorVisited &&
      (state.completed >= 1 || index === 0))
  );
}
export function tutorialGuidance(
  state: GameState,
  mode: "valley" | "interior" = "valley",
): TutorialGuidance {
  const guide = (
    key: string,
    text: string,
    focus: UpgradeKey[] = [],
    persistent = true,
  ) => ({ key, text, focus, persistent });
  const ready = () =>
    guide(
      "ready",
      "✓ Tudo pronto! Aceite contratos maiores e escolha como expandir.",
      [],
      false,
    );
  if (!state.placed)
    return guide(
      "place",
      "⌖ Clique em um terreno perto do rio para construir seu centro de dados.",
    );
  if (state.tutorialComplete) return ready();
  if (
    state.jobs >= TUTORIAL.clicksToRevealChips &&
    !state.tutorialLessons.includes("work")
  )
    return {
      ...guide(
        "explain-work",
        "◈ representa o trabalho dos contratos. Chips aumentam o trabalho a cada clique.",
      ),
      lesson: "work",
    };
  if (state.upgrades.chip === 0) {
    if (!state.unlockedUpgrades.includes("chip"))
      return guide(
        "earn",
        "◉ é dinheiro. Clique em qualquer lugar ou pressione C para ganhar.",
      );
    return state.cash >= upgradeCost("chip", state.upgrades)
      ? guide("chips", "◈ Compre a melhoria Chips na lista à esquerda.", [
          "chip",
        ])
      : guide(
          "save-chips",
          "◈ Junte dinheiro: clique em qualquer lugar ou pressione C.",
          ["chip"],
        );
  }
  if (!state.tutorialInteriorVisited)
    return guide(
      "inspect",
      "◈ Chips instalados! Clique no centro de dados para entrar.",
    );
  if (mode === "interior" && state.completed === 0)
    return guide(
      "inside-chips",
      "Veja os novos chips nos servidores. Clique em VALE para voltar.",
    );
  if (state.completed === 0 && state.contractCooldown > 0)
    return guide(
      "first-wait",
      "◷ Novas propostas em instantes. Continue clicando para ganhar.",
    );
  if (state.completed === 0)
    return state.active
      ? guide(
          "first-job",
          "◈ preenche a barra do contrato. Clique ou pressione C para acelerar.",
        )
      : guide("sign", "◇ Assine o contrato Pequeno no centro da tela.");
  if (!state.tutorialLessons.includes("stocks"))
    return {
      ...guide(
        "explain-stocks",
        "CR é o valor da empresa. Melhorias e entregas fazem esse valor crescer.",
      ),
      lesson: "stocks",
    };
  if (state.upgrades.automation === 0)
    return guide(
      "auto",
      "↻ Compre Automação para trabalhar sem precisar clicar.",
      ["automation"],
    );
  if (state.upgrades.server === 0)
    return guide(
      "capacity",
      "▥ Junte dinheiro e compre Capacidade para ampliar os servidores.",
      ["server"],
    );
  if (state.power < state.capacity)
    return guide(
      "power",
      `${RESOURCE_ICONS.power} Escolha uma fonte de energia na lista à esquerda.`,
      ["solar", "coal"],
    );
  if (state.cooling < state.capacity)
    return guide(
      "cooling",
      `${RESOURCE_ICONS.cooling} Escolha uma melhoria de refrigeração à esquerda.`,
      ["cooling", "water"],
    );
  return ready();
}
