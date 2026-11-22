import { RESOURCE_ICONS } from "./config/icons.ts";
import { PERFORMANCE } from "./config/game-balance.ts";
import {
  EndingSequence,
  ENDING_SEQUENCE_SECONDS,
} from "./ui/ending-sequence.ts";
import * as THREE from "three";
import "./styles.css";
import { GameEngine } from "./core/engine.ts";
import {
  isUpgradeKey,
  production,
  UPGRADES,
  upgradeCost,
} from "./core/economy.ts";
import type { ViewState } from "./core/types.ts";
import { createRiverWorld } from "./rendering/world.ts";
import { createDatacenterInterior } from "./rendering/interior.ts";
import type { SceneTile } from "./rendering/types.ts";
import { GameInterface } from "./ui/interface.ts";
import { element } from "./ui/dom.ts";

const view: ViewState = {
  mode: "valley",
  selectedCenterId: null,
  upgradesExpanded: true,
};
let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: false });
} catch (error) {
  element("fallback").hidden = false;
  throw error;
}
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
element("world").append(renderer.domElement);
const world = createRiverWorld(renderer, onTileSelected);
const engine = new GameEngine(world.actions);
let interior: ReturnType<typeof createDatacenterInterior> | null = null;
let audio: AudioContext | null = null;
let soundEnabled = false;
const cinematic = new EndingSequence();
const ui = new GameInterface(
  {
    acknowledgeTutorial: (lesson) => {
      engine.acknowledgeTutorial(lesson);
      render();
    },
    accept: (index) => {
      if (engine.acceptContract(index)) {
        tone(440);
        render();
      }
    },
    buy: (key) => {
      if (!engine.buyUpgrade(key)) {
        const affordable =
          engine.state.cash >= upgradeCost(key, engine.state.upgrades);
        ui.notify(
          !affordable
            ? "Dinheiro insuficiente"
            : key === "water"
              ? "Não há caminho livre até o rio"
              : "Não há espaço para esta melhoria",
        );
      }
      render();
    },
    leave: leaveInterior,
    pause: () => {
      engine.togglePause();
      render();
    },
    fastMode: () => {
      engine.toggleFastMode();
      render();
    },
    speed: () => {
      engine.cycleSpeed();
      render();
    },
    zoom: (direction) => {
      if (interior) interior.setZoom(interior.zoom + direction * 0.12);
    },
    toggleUpgrades: () => {
      view.upgradesExpanded = !view.upgradesExpanded;
      render();
    },
    sound: toggleSound,
  },
  cinematic,
);
engine.onEvent((event) => {
  if (event.type === "boosted") {
    ui.notifyBoost(event.result);
    tone(380 + (engine.state.jobs % 4) * 40);
  }
  if (event.type === "upgraded") {
    if (event.key === "chip" && interior) interior.setChipLevel(event.level);
    if (event.key === "chip" && view.mode === "interior")
      engine.visitInterior();
    ui.notify(`${UPGRADES[event.key].label} · NÍV ${event.level}`);
    tone(520);
  }
  if (event.type === "placed") {
    tone(330);
  }
  if (event.type === "delivered") {
    ui.revealContracts();
    ui.notify(
      event.success
        ? "✓ Entregue · novas propostas em instantes"
        : "◷ Prazo esgotado · novas propostas em instantes",
    );
    tone(event.success ? 660 : 110);
  }
  if (event.type === "ended") {
    world.update(engine.state, 0);
    leaveInterior();
    cinematic.start(event.ending);
    world.setActive(false);
    world.beginEndingShot(cinematic.reducedMotion, ENDING_SEQUENCE_SECONDS);
    render();
    tone(event.ending === "green" ? 520 : 90);
  }
});
function onTileSelected(tile: SceneTile): void {
  if (!engine.state.placed) {
    engine.placeDatacenter(tile.id);
    render();
    return;
  }
  if (tile.building && ["datacenter", "server"].includes(tile.building.kind))
    enterInterior(tile.id);
}
function enterInterior(id: string): void {
  const tile = world.tile(id);
  if (
    engine.state.ending ||
    !tile?.building ||
    !["datacenter", "server"].includes(tile.building.kind)
  )
    return;
  interior ??= createDatacenterInterior();
  interior.setChipLevel(engine.state.upgrades.chip);
  engine.visitInterior();
  view.mode = "interior";
  view.selectedCenterId = id;
  world.setActive(false);
  const index = world.centerIds().indexOf(id) + 1;
  element("interior-title").textContent =
    `DADOS / ${String(index).padStart(2, "0")}`;
  element("world").setAttribute(
    "aria-label",
    "Interior do centro de dados com trabalhadores em movimento. As melhorias continuam disponíveis. Escape volta ao vale.",
  );
  interior.resize(innerWidth, innerHeight);
  render();
  element("leave-interior").focus({ preventScroll: true });
}
function leaveInterior(): void {
  if (view.mode === "valley") return;
  view.mode = "valley";
  view.selectedCenterId = null;
  world.setActive(true);
  element("world").setAttribute(
    "aria-label",
    "Vale interativo. Clique em qualquer lugar para ganhar dinheiro. Clique no centro de dados para entrar.",
  );
  render();
  element("world").focus({ preventScroll: true });
}
function render(): void {
  ui.render(engine.state, view, world.actions.openLandCount());
}
function resize(): void {
  renderer.setSize(
    Math.round(innerWidth * 0.68),
    Math.round(innerHeight * 0.68),
    false,
  );
  renderer.domElement.style.width = `${innerWidth}px`;
  renderer.domElement.style.height = `${innerHeight}px`;
  world.resize(innerWidth, innerHeight);
  interior?.resize(innerWidth, innerHeight);
}
function toggleSound(): void {
  audio ??= new AudioContext();
  void audio.resume();
  soundEnabled = !soundEnabled;
  element("sound").classList.toggle("enabled", soundEnabled);
  element("sound").setAttribute(
    "aria-label",
    soundEnabled ? "Desativar som" : "Ativar som",
  );
  tone(400);
}
function tone(frequency: number): void {
  if (!soundEnabled || !audio) return;
  const oscillator = audio.createOscillator(),
    gain = audio.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.025, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.16);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.18);
}
element("world").tabIndex = 0;
element("world").addEventListener("keydown", (event) => world.handleKey(event));
renderer.domElement.addEventListener(
  "wheel",
  (event) => {
    if (view.mode !== "interior" || !interior) return;
    event.preventDefault();
    interior.setZoom(interior.zoom + event.deltaY * 0.001);
  },
  { passive: false },
);
addEventListener("resize", resize);
addEventListener("keydown", (event) => {
  const target = event.target;
  if (engine.state.ending) {
    if (event.key === "Escape") {
      event.preventDefault();
      cinematic.toggleSummary();
      render();
      element(cinematic.summaryRequested ? "again" : "world").focus({
        preventScroll: true,
      });
    }
    return;
  }
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  )
    return;
  if (event.key.toLowerCase() === "c" && !event.repeat) {
    event.preventDefault();
    engine.boost();
    render();
  }
  if (event.key === "Escape") leaveInterior();
  // Native Space/Enter on a button activates it once; it never also toggles pause.
  if (event.code === "Space" && !(target instanceof HTMLButtonElement)) {
    event.preventDefault();
    engine.togglePause();
    render();
  }
});
let paidGestureStart: { x: number; y: number } | null = null;
let paidGestureDragged = false;
element("game").addEventListener(
  "pointerdown",
  (event) => {
    if (event.button !== 0) return;
    paidGestureStart = { x: event.clientX, y: event.clientY };
    paidGestureDragged = false;
  },
  true,
);
element("game").addEventListener(
  "pointermove",
  (event) => {
    if (
      paidGestureStart &&
      Math.hypot(
        event.clientX - paidGestureStart.x,
        event.clientY - paidGestureStart.y,
      ) > 6
    )
      paidGestureDragged = true;
  },
  true,
);
element("game").addEventListener(
  "pointerup",
  (event) => {
    if (paidGestureStart)
      paidGestureDragged ||=
        Math.hypot(
          event.clientX - paidGestureStart.x,
          event.clientY - paidGestureStart.y,
        ) > 6;
    paidGestureStart = null;
  },
  true,
);
element("game").addEventListener(
  "pointercancel",
  () => {
    paidGestureDragged = true;
    paidGestureStart = null;
  },
  true,
);
// One delegated native click earns once anywhere in the game. Disabled shop
// cards pass pointer events to their parent, so they still provide paid clicks.
element("game").addEventListener("click", (event) => {
  if (engine.state.ending) return;
  if (paidGestureDragged && event.detail > 0) return;
  engine.boost();
  render();
});
renderer.domElement.addEventListener("dblclick", () => {
  if (view.mode !== "valley") return;
  const tile = world.hoveredTile();
  if (tile?.building && ["datacenter", "server"].includes(tile.building.kind))
    enterInterior(tile.id);
});
renderer.domElement.addEventListener("pointerup", (event) => {
  if (
    event.button !== 0 ||
    !engine.state.ending ||
    !cinematic.complete ||
    cinematic.summaryRequested
  )
    return;
  cinematic.toggleSummary();
  render();
  element("again").focus({ preventScroll: true });
});
// Prevent browser selection/copy gestures on the game, without changing the clipboard.
for (const eventName of ["selectstart", "copy"]) {
  document.addEventListener(eventName, (event) => {
    const target = event.target;
    const anchor = getSelection()?.anchorNode;
    const game = element("game");
    if (
      (target instanceof Node && game.contains(target)) ||
      (anchor && game.contains(anchor))
    )
      event.preventDefault();
  });
}

const frameInterval = 1000 / PERFORMANCE.targetFps;
let previous = performance.now();
let frameSchedule = previous;
document.addEventListener("visibilitychange", () => {
  previous = performance.now();
  frameSchedule = previous;
});
function frame(now: number): void {
  requestAnimationFrame(frame);
  const elapsed = now - frameSchedule;
  if (document.hidden || elapsed < frameInterval) return;
  // Carry the remainder so a 60 Hz display alternates two/three refreshes
  // instead of rounding the game down to 20 FPS. Never render catch-up frames.
  frameSchedule = now - (elapsed % frameInterval);
  const realSeconds = Math.min(1, Math.max(0, (now - previous) / 1000));
  previous = now;
  const simulationSeconds = realSeconds * engine.state.speed;
  engine.tick(simulationSeconds, realSeconds);
  cinematic.update(now);
  world.updateEndingShot(realSeconds);
  world.update(
    engine.state,
    engine.state.paused || engine.state.ending ? 0 : simulationSeconds,
  );
  render();
  if (view.mode === "interior" && interior && view.selectedCenterId) {
    const online = world.isOnline(view.selectedCenterId, engine.state);
    interior.animate(simulationSeconds, {
      paused: engine.state.paused || !!engine.state.ending,
      online,
      active: production(engine.state).perSecond > 0,
    });
    const needsPower = engine.state.power < engine.state.capacity;
    const needsCooling = engine.state.cooling < engine.state.capacity;
    element("interior-status").textContent =
      [
        needsPower ? RESOURCE_ICONS.power : "",
        needsCooling ? RESOURCE_ICONS.cooling : "",
      ]
        .filter(Boolean)
        .join(" ") || (online ? RESOURCE_ICONS.capacity : RESOURCE_ICONS.power);
    element("interior-status").setAttribute(
      "aria-label",
      [
        needsPower ? "Precisa de mais energia" : "",
        needsCooling ? "Precisa de mais refrigeração" : "",
      ]
        .filter(Boolean)
        .join(". ") ||
        (online ? "Centro de dados ativo" : "Centro de dados inativo"),
    );
    element("interior-status").classList.toggle(
      "offline",
      needsPower || needsCooling || !online,
    );
    renderer.render(interior.scene, interior.camera);
  } else renderer.render(world.scene, world.camera);
}
resize();
render();
requestAnimationFrame(frame);

// Optional browser agent API. It uses exactly the same engine actions as the UI.
interface ModelContext {
  registerTool(
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      execute(input: unknown): unknown;
    },
    options: { signal: AbortSignal },
  ): void | Promise<void>;
}
const context = (document as Document & { modelContext?: ModelContext })
  .modelContext;
if (context?.registerTool) {
  const lifecycle = new AbortController();
  Promise.resolve(
    context.registerTool(
      {
        name: "river_company_clicker_action",
        description:
          "Acelere um contrato, compre uma melhoria, aceite um contrato ou construa o centro de dados.",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: [
                "process_ai",
                "buy_upgrade",
                "accept_contract",
                "place_datacenter",
              ],
            },
            upgrade: { type: "string", enum: Object.keys(UPGRADES) },
            contract: { type: "integer", minimum: 0, maximum: 2 },
            x: { type: "number" },
            z: { type: "number" },
          },
          required: ["action"],
          additionalProperties: false,
        },
        execute(input: unknown) {
          if (!input || typeof input !== "object")
            throw new Error("Ação inválida");
          const data = input as Record<string, unknown>;
          let success = false;
          if (data.action === "process_ai") success = !!engine.boost();
          else if (data.action === "buy_upgrade" && isUpgradeKey(data.upgrade))
            success = engine.buyUpgrade(data.upgrade);
          else if (
            data.action === "accept_contract" &&
            typeof data.contract === "number"
          )
            success = engine.acceptContract(data.contract);
          else if (
            data.action === "place_datacenter" &&
            typeof data.x === "number" &&
            typeof data.z === "number"
          ) {
            const tile = world.tiles.find(
              (t) =>
                Math.abs(t.x - (data.x as number)) < 0.5 &&
                Math.abs(t.z - (data.z as number)) < 0.5,
            );
            if (tile) success = engine.placeDatacenter(tile.id);
          }
          if (!success) throw new Error("Ação indisponível");
          render();
          return {
            completed: true,
            cash: engine.state.cash,
            online: production(engine.state).online,
          };
        },
      },
      { signal: lifecycle.signal },
    ),
  ).catch(() => {});
  addEventListener("pagehide", () => lifecycle.abort(), { once: true });
}
// Development inspector. Tests use this instance instead of importing the entry
// module again, which would otherwise create a second renderer and interface.
declare global {
  interface Window {
    __riverCompany?: {
      engine: GameEngine;
      world: ReturnType<typeof createRiverWorld>;
      view: ViewState;
      enterInterior: typeof enterInterior;
      leaveInterior: typeof leaveInterior;
    };
  }
}
if (import.meta.env.DEV) {
  window.__riverCompany = { engine, world, view, enterInterior, leaveInterior };
}
