import { TERRAIN } from "../config/terrain.ts";
import { Color } from "three";

const riverStops: [number, Color][] = [
  [0, new Color(TERRAIN.river.color)],
  [50, new Color("#728375")],
  [80, new Color("#413a2e")],
  [100, new Color("#983929")],
];
const foliageStops: [number, Color][] = [
  [0, new Color("#4b7c43")],
  [20, new Color("#788349")],
  [40, new Color("#85754a")],
  [70, new Color("#423f32")],
];

function blend(value: number, stops: [number, Color][]): Color {
  for (let index = 1; index < stops.length; index++) {
    const [start, first] = stops[index - 1],
      [end, last] = stops[index];
    if (value <= end)
      return first
        .clone()
        .lerp(last, Math.max(0, (value - start) / (end - start)));
  }
  return stops[stops.length - 1][1].clone();
}
export const riverColor = (damage: number): Color => blend(damage, riverStops);
export const foliageColor = (damage: number): Color =>
  blend(damage, foliageStops);

const skyStops: [number, Color][] = [
  [0, new Color("#2e4944")],
  [25, new Color("#62604b")],
  [50, new Color("#51483e")],
  [75, new Color("#493532")],
  [100, new Color("#392326")],
];
const sunlightStops: [number, Color][] = [
  [0, new Color("#ffefd4")],
  [35, new Color("#edce9c")],
  [65, new Color("#e9ac7a")],
  [100, new Color("#ff815b")],
];
export const skyColor = (damage: number): Color => blend(damage, skyStops);
export const sunlightColor = (damage: number): Color =>
  blend(damage, sunlightStops);

// Thin gradually across the middle of the run, rather than disappearing at 55–65%.
export const canopyScale = (damage: number): number =>
  Math.max(0, Math.min(1, (72 - damage) / 54));
