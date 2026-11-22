import { FACILITY } from "../config/game-balance.ts";
export interface LandCell {
  id: string;
  x: number;
  z: number;
  water: boolean;
  occupied: boolean;
  reserved: boolean;
}
export interface HousingLot {
  x: number;
  z: number;
  cells: string[];
  accessPath: string[];
}
export interface SettlementSite {
  x: number;
  z: number;
  rotated: boolean;
  cells: string[];
  roadCells: string[];
  accessPath: string[];
  housingLots: HousingLot[];
  bridgeCells: string[];
}

export function facilityScale(level: number) {
  const tier = Math.max(0, Math.min(FACILITY.maxVisualLevel, level));
  const width = FACILITY.baseWidth * (1 + tier * FACILITY.widthPerLevel);
  return {
    x: width,
    y: FACILITY.baseHeight * (1 + tier * FACILITY.heightPerLevel),
    z: width,
  };
}

// Measure from the nearest building edge, so large blocks cannot intrude even
// when their centers are outside the exclusion circle. Roads remain allowed.
export function outsideDatacenterClearance(
  x: number,
  z: number,
  halfWidth: number,
  halfDepth: number,
  center: { x: number; z: number },
): boolean {
  const dx = Math.max(0, Math.abs(x - center.x) - halfWidth);
  const dz = Math.max(0, Math.abs(z - center.z) - halfDepth);
  return Math.hypot(dx, dz) >= FACILITY.buildingClearance;
}

export function landPath(
  cells: LandCell[],
  start: string,
  goal: string,
  allowedDistrict?: Set<string>,
  roadDistrict?: Set<string>,
  allowBridges = false,
): string[] {
  const byId = new Map(cells.map((c) => [c.id, c]));
  const byPosition = new Map(cells.map((c) => [`${c.x},${c.z}`, c]));
  const queue = [start],
    previous = new Map<string, string | null>([[start, null]]);
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    if (id === goal) break;
    const cell = byId.get(id);
    if (!cell) continue;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next = byPosition.get(`${cell.x + dx},${cell.z + dz}`);
      if (
        !next ||
        (next.water && !allowBridges) ||
        previous.has(next.id) ||
        (next.occupied && next.id !== goal)
      )
        continue;
      if (allowedDistrict?.has(next.id) && !roadDistrict?.has(next.id))
        continue;
      previous.set(next.id, id);
      queue.push(next.id);
    }
  }
  if (!previous.has(goal)) return [];
  const result: string[] = [];
  let cursor: string | null = goal;
  while (cursor !== null) {
    result.push(cursor);
    cursor = previous.get(cursor) ?? null;
  }
  return result.reverse();
}

export function findSettlementSite(
  cells: LandCell[],
  starterId: string,
  facilityCenter?: { x: number; z: number },
): SettlementSite | null {
  const starter = cells.find((c) => c.id === starterId);
  if (!starter) return null;
  const center = facilityCenter ?? starter;
  const byPosition = new Map(cells.map((c) => [`${c.x},${c.z}`, c]));
  const candidates: { site: SettlementSite; score: number }[] = [];
  for (const rotated of [false, true])
    for (const origin of cells) {
      const width = rotated ? 7 : 9,
        depth = rotated ? 9 : 7;
      const district: LandCell[] = [];
      for (let x = 0; x < width; x++)
        for (let z = 0; z < depth; z++) {
          const cell = byPosition.get(`${origin.x + x},${origin.z + z}`);
          if (
            cell &&
            !cell.water &&
            !cell.occupied &&
            !cell.reserved &&
            outsideDatacenterClearance(cell.x, cell.z, 0.5, 0.5, center)
          )
            district.push(cell);
        }
      if (district.length !== width * depth) continue;
      const centerX = origin.x + (width - 1) / 2,
        centerZ = origin.z + (depth - 1) / 2;
      const roadCells = district
        .filter((c) =>
          rotated
            ? c.x === centerX || c.z === centerZ
            : c.z === centerZ || c.x === centerX,
        )
        .map((c) => c.id);
      const site: SettlementSite = {
        x: centerX,
        z: centerZ,
        rotated,
        cells: district.map((c) => c.id),
        roadCells,
        accessPath: [],
        housingLots: [],
        bridgeCells: [],
      };
      candidates.push({
        site,
        score: Math.hypot(centerX - starter.x, centerZ - starter.z),
      });
    }
  candidates.sort((a, b) => a.score - b.score);
  for (const allowBridges of [false, true])
    for (const { site } of candidates) {
      const district = new Set(site.cells),
        road = new Set(site.roadCells);
      const endpoints = site.roadCells.filter((id) => {
        const c = cells.find((t) => t.id === id)!;
        return site.rotated
          ? c.x === site.x && Math.abs(c.z - site.z) === 4
          : c.z === site.z && Math.abs(c.x - site.x) === 4;
      });
      const routes = endpoints
        .map((goal) =>
          landPath(cells, starterId, goal, district, road, allowBridges),
        )
        .filter((p) => p.length > 0)
        .sort((a, b) => a.length - b.length);
      if (routes[0]) {
        site.accessPath = routes[0];
        site.bridgeCells = site.accessPath.filter(
          (id) => cells.find((c) => c.id === id)!.water,
        );
        spreadHousing(cells, starter, site, center);
        return site;
      }
    }
  return null;
}

// Satellite housing stays clear of the campus and each other. A bridge permits
// workers to live across the river instead of forcing one dense district.
function spreadHousing(
  cells: LandCell[],
  starter: LandCell,
  site: SettlementSite,
  facilityCenter: { x: number; z: number },
) {
  const byPosition = new Map(cells.map((c) => [`${c.x},${c.z}`, c]));
  const blocked = new Set(site.cells);
  const plannedRoads = new Set(site.accessPath);
  for (let index = 0; index < 3; index++) {
    const candidates: { lot: HousingLot; score: number }[] = [];
    for (const center of cells) {
      if (
        !outsideDatacenterClearance(
          center.x,
          center.z,
          2.5,
          1.5,
          facilityCenter,
        ) ||
        Math.hypot(center.x - site.x, center.z - site.z) < 6 ||
        site.housingLots.some(
          (l) => Math.hypot(l.x - center.x, l.z - center.z) < 6,
        )
      )
        continue;
      const lotCells: LandCell[] = [];
      for (let dx = -2; dx <= 2; dx++)
        for (let dz = -1; dz <= 1; dz++) {
          const c = byPosition.get(`${center.x + dx},${center.z + dz}`);
          if (
            c &&
            !c.water &&
            !c.occupied &&
            !c.reserved &&
            !blocked.has(c.id) &&
            !plannedRoads.has(c.id)
          )
            lotCells.push(c);
        }
      if (lotCells.length !== 15) continue;
      const entrance = byPosition.get(`${center.x},${center.z + 2}`);
      if (
        !entrance ||
        entrance.water ||
        entrance.occupied ||
        entrance.reserved ||
        blocked.has(entrance.id)
      )
        continue;
      const routing = cells.map((c) => ({
        ...c,
        occupied:
          c.occupied ||
          (blocked.has(c.id) && !site.roadCells.includes(c.id)) ||
          lotCells.some((l) => l.id === c.id),
      }));
      let path = landPath(routing, starter.id, entrance.id);
      if (!path.length)
        path = landPath(
          routing,
          starter.id,
          entrance.id,
          undefined,
          undefined,
          true,
        );
      if (!path.length) continue;
      const crossing = path.some((id) => cells.find((c) => c.id === id)!.water);
      candidates.push({
        lot: {
          x: center.x,
          z: center.z,
          cells: lotCells.map((c) => c.id),
          accessPath: path,
        },
        score: path.length + (index === 0 && !crossing ? 100 : 0),
      });
    }
    candidates.sort((a, b) => a.score - b.score);
    const chosen = candidates[0]?.lot;
    if (!chosen) break;
    site.housingLots.push(chosen);
    chosen.cells.forEach((id) => blocked.add(id));
    chosen.accessPath.forEach((id) => plannedRoads.add(id));
    for (const id of chosen.accessPath) {
      if (
        cells.find((c) => c.id === id)!.water &&
        !site.bridgeCells.includes(id)
      )
        site.bridgeCells.push(id);
    }
  }
}
