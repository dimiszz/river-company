import { outsideDatacenterClearance } from "./development-layout.ts";
export interface RiverCell {
  id: string;
  x: number;
  z: number;
  water: boolean;
  protected: boolean;
  diverted?: boolean;
}
// Find a connected channel without flooding existing roads, buildings or lots.
export function planRiverIntake(
  cells: RiverCell[],
  center: { x: number; z: number },
  intakeId?: string,
  upstreamLimit?: number,
) {
  const byPosition = new Map(cells.map((c) => [`${c.x},${c.z}`, c]));
  const sources = cells.filter(
    (c) => c.water && (intakeId ? c.id === intakeId : !c.protected),
  );
  const queue = [...sources],
    previous = new Map<string, RiverCell | null>(
      sources.map((c) => [c.id, null]),
    );
  const distance = new Map(sources.map((c) => [c.id, 0]));
  const excavationDepth = new Map(sources.map((c) => [c.id, 0]));
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i],
      depth = distance.get(cell.id)!;
    if (depth >= 14) continue;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next = byPosition.get(`${cell.x + dx},${cell.z + dz}`);
      if (
        !next ||
        next.protected ||
        previous.has(next.id) ||
        (upstreamLimit !== undefined &&
          (next.z > upstreamLimit || (!next.water && next.z >= upstreamLimit)))
      )
        continue;
      previous.set(next.id, cell);
      distance.set(next.id, depth + 1);
      excavationDepth.set(
        next.id,
        excavationDepth.get(cell.id)! + (next.water ? 0 : 1),
      );
      queue.push(next);
    }
  }
  const reachable = queue.filter(
    (c) =>
      !c.water &&
      distance.get(c.id)! >= 3 &&
      outsideDatacenterClearance(c.x, c.z, 0.85, 0.85, center),
  );
  const deeper = reachable.filter((c) => excavationDepth.get(c.id)! >= 4);
  const candidates = deeper.length ? deeper : reachable;
  candidates.sort(
    (a, b) =>
      Math.hypot(a.x - center.x, a.z - center.z) -
      Math.hypot(b.x - center.x, b.z - center.z),
  );
  const pump = candidates[0];
  if (!pump) return null;
  const channel: string[] = [];
  let cursor = previous.get(pump.id) ?? null;
  while (cursor) {
    channel.unshift(cursor.id);
    cursor = previous.get(cursor.id) ?? null;
  }
  return { pumpId: pump.id, channelIds: channel };
}
export function widenRiverIntake(
  cells: RiverCell[],
  channel: Set<string>,
  pump: { x: number; z: number },
  count: number,
  level = 1,
  upstreamLimit?: number,
) {
  if (upstreamLimit !== undefined)
    cells = cells.filter(
      (c) => c.z < upstreamLimit || (c.water && c.z === upstreamLimit),
    );
  const byId = new Map(cells.map((c) => [c.id, c]));
  const byPosition = new Map(cells.map((c) => [`${c.x},${c.z}`, c]));
  const adjacent = (c: RiverCell) =>
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
      .map(([dx, dz]) => byPosition.get(`${c.x + dx},${c.z + dz}`))
      .filter((c): c is RiverCell => !!c);
  // The existing river remains a usable water source even where the intake,
  // pump and dam protect its banks. Those reservations only forbid digging land.
  const connected = new Set<string>(),
    waterQueue = [...channel]
      .map((id) => byId.get(id))
      .filter((c): c is RiverCell => !!c && c.water);
  waterQueue.forEach((c) => connected.add(c.id));
  for (let i = 0; i < waterQueue.length; i++)
    for (const next of adjacent(waterQueue[i])) {
      if (next.water && !connected.has(next.id)) {
        connected.add(next.id);
        waterQueue.push(next);
      }
    }
  const queue = [...waterQueue],
    previous = new Map<string, RiverCell | null>(
      queue.map((c) => [c.id, null]),
    );
  const depth = new Map(queue.map((c) => [c.id, 0]));
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i],
      distance = depth.get(cell.id)!;
    if (distance >= count) continue;
    for (const next of adjacent(cell)) {
      if (previous.has(next.id) || next.protected || next.water) continue;
      previous.set(next.id, cell);
      depth.set(next.id, distance + 1);
      queue.push(next);
    }
  }
  const minX = Math.min(...cells.map((c) => c.x)),
    maxX = Math.max(...cells.map((c) => c.x));
  const minZ = Math.min(...cells.map((c) => c.z)),
    maxZ = Math.max(...cells.map((c) => c.z));
  const targetX = Math.max(
    minX,
    Math.min(maxX, pump.x + Math.sign(pump.x || 1) * Math.min(3, level * 0.6)),
  );
  const targetZ = Math.max(
    minZ,
    Math.min(maxZ, pump.z + (level % 2 === 0 ? 1 : -1) * (4 + level * 1.5)),
  );
  const land = queue.filter((c) => !c.water && !c.protected);
  const deeper = land.filter((c) => depth.get(c.id)! >= 2);
  const candidates = deeper.length ? deeper : land;
  candidates.sort(
    (a, b) =>
      Math.hypot(a.x - targetX, a.z - targetZ) -
      depth.get(a.id)! * 0.15 -
      (Math.hypot(b.x - targetX, b.z - targetZ) - depth.get(b.id)! * 0.15),
  );
  let cursor: RiverCell | null = candidates[0] ?? null;
  const result: string[] = [];
  while (cursor && !cursor.water) {
    result.unshift(cursor.id);
    cursor = previous.get(cursor.id) ?? null;
  }
  result.forEach((id) => connected.add(id));
  // Use the remaining excavation budget to widen the new bend into a visible
  // channel, always adding directly connected, unoccupied terrain.
  while (result.length < count) {
    const bank = cells.filter(
      (c) =>
        !c.water &&
        !c.protected &&
        !connected.has(c.id) &&
        adjacent(c).some((n) => connected.has(n.id)),
    );
    const end = byId.get(result[result.length - 1]) ?? pump;
    bank.sort(
      (a, b) =>
        Math.hypot(a.x - end.x, a.z - end.z) -
        Math.hypot(b.x - end.x, b.z - end.z),
    );
    if (!bank[0]) break;
    result.push(bank[0].id);
    connected.add(bank[0].id);
  }
  return result;
}

// Backed-up water spreads into an upstream tributary/reservoir. It never
// excavates a route below the wall or reconnects to the downstream river.
export function planRiverSpillway(
  cells: RiverCell[],
  dam: { x: number; z: number; width: number },
  budget: number,
) {
  const sources = cells.filter(
    (c) => c.water && c.z < dam.z && Math.hypot(c.x - dam.x, c.z - dam.z) < 4,
  );
  if (!sources.length) return [];
  return widenRiverIntake(
    cells,
    new Set(sources.map((c) => c.id)),
    { x: dam.x + Math.sign(dam.x || 1) * (dam.width / 2 + 1), z: dam.z - 2 },
    Math.min(budget, 10),
    1,
    dam.z,
  );
}
