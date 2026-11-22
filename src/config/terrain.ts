// Terrain generation. Map dimensions should be even so the tile grid stays
// centered on half-block coordinates. Probabilities range from 0 to 1.
export const TERRAIN = {
  width: 28,
  depth: 24,
  seed: 13,
  river: {
    halfWidth: 1.35,
    bendAmplitude: 2.1,
    bendFrequency: 0.24,
    offsetX: 0.7,
    color: "#649d9a",
  },
  vegetation: { treeChance: 0.39, palmChance: 0.14, rockChance: 0.06 },
  initialClearing: { minX: 3, maxX: 8, minZ: -3, maxZ: 2 },
  grassColors: ["#6a8850", "#738e56", "#789354", "#5e8049"],
  soilColor: "#544d35",
  islandBaseColor: "#333c2c",
};

// Higher values raise the surface. Keep the bed below all water levels and
// upstream water below landSurface to avoid overflowing the entire island.
export const RIVER_TERRAIN = {
  landSurface: 0.1,
  bedY: -0.95,
  normalSurface: -0.45,
  upstreamSurface: -0.08,
  downstreamSurface: -0.78,
};

export const RIVER_DRAINAGE = {
  drainSeconds: 45,
  delayPerBlock: 0.8,
  mudColor: "#785d43",
};
