import { RESOURCE_ICONS } from "../config/icons.ts";
import * as THREE from "three";
import type { GameState } from "../core/types.ts";
export function createFacilityWarnings(parent: THREE.Group) {
  function badge(symbol: string, color: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#192b26";
    ctx.beginPath();
    ctx.roundRect(4, 4, 88, 88, 18);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = "bold 60px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(symbol, 48, 50);
    const material = new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.85, 0.85, 1);
    sprite.renderOrder = 5;
    parent.add(sprite);
    return sprite;
  }
  const power = badge(RESOURCE_ICONS.power, "#f0bd54"),
    cooling = badge(RESOURCE_ICONS.cooling, "#83d4dc");
  power.visible = cooling.visible = false;
  return {
    update(
      state: GameState,
      center: THREE.Vector3 | null,
      height: number,
      time: number,
    ) {
      power.visible = !!center && !state.ending && state.power < state.capacity;
      cooling.visible =
        !!center && !state.ending && state.cooling < state.capacity;
      if (!center) return;
      const both = power.visible && cooling.visible;
      power.position.set(center.x - (both ? 0.52 : 0), height, center.z);
      cooling.position.set(center.x + (both ? 0.52 : 0), height, center.z);
      power.material.opacity = cooling.material.opacity =
        0.8 + Math.sin(time * 4) * 0.2;
    },
  };
}
