import { RIVER_COOLING } from "../config/game-balance.ts";
import type { RiverCell } from "./river-diversion.ts";
export interface BarrageSite {
  x: number;
  z: number;
  width: number;
  intakeId: string;
  waterIds: string[];
  bankIds: string[];
}
// Edge-to-edge distance includes the bridge deck/abutments and dam end towers.
export function barrageBridgeDistance(
  site: BarrageSite,
  bridge: { x: number; z: number },
) {
  const dx = Math.max(
    0,
    Math.abs(bridge.x - site.x) - (site.width / 2 + 0.325) - 0.65,
  );
  const dz = Math.max(0, Math.abs(bridge.z - site.z) - 0.425 - 0.65);
  return Math.hypot(dx, dz);
}
export function planRiverBarrage(
  cells: RiverCell[],
  bridges: { x: number; z: number }[],
  center: { x: number; z: number },
) {
  const rows = new Map<number, RiverCell[]>();
  for (const cell of cells)
    if (cell.water && !cell.diverted) {
      const row = rows.get(cell.z) ?? [];
      row.push(cell);
      rows.set(cell.z, row);
    }
  const candidates: BarrageSite[] = [];
  for (const [z, row] of rows) {
    row.sort((a, b) => a.x - b.x);
    if (row.some((c) => c.protected)) continue;
    const left = row[0].x - 0.5,
      right = row[row.length - 1].x + 0.5;
    const banks = cells.filter(
      (c) =>
        c.z === z &&
        (c.x === row[0].x - 1 || c.x === row[row.length - 1].x + 1),
    );
    if (banks.length !== 2 || banks.some((c) => c.water || c.protected))
      continue;
    const x = (left + right) / 2;
    const intake = row.reduce((a, b) =>
      Math.abs(a.x - x) < Math.abs(b.x - x) ? a : b,
    );
    const site = {
      x,
      z,
      width: right - left + 0.4,
      intakeId: intake.id,
      waterIds: row.map((c) => c.id),
      bankIds: banks.map((c) => c.id),
    };
    if (
      bridges.some(
        (p) => barrageBridgeDistance(site, p) < RIVER_COOLING.bridgeClearance,
      )
    )
      continue;
    candidates.push(site);
  }
  candidates.sort(
    (a, b) =>
      Math.hypot(a.x - center.x, a.z - center.z) -
      Math.hypot(b.x - center.x, b.z - center.z),
  );
  return candidates[0] ?? null;
}
