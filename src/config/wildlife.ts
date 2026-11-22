export type WildlifeSpecies =
  | "capybara"
  | "toucan"
  | "agouti"
  | "marmoset"
  | "parrot"
  | "armadillo"
  | "anteater"
  | "frog"
  | "fish";
export type Habitat = "bank" | "canopy" | "forest" | "scrub" | "water";
export const WILDLIFE: Record<
  WildlifeSpecies,
  {
    count: number;
    habitat: Habitat;
    speed: number;
    scale: number;
  }
> = {
  capybara: { count: 8, habitat: "bank", speed: 0.35, scale: 1 },
  toucan: { count: 4, habitat: "canopy", speed: 1.3, scale: 0.85 },
  agouti: { count: 8, habitat: "forest", speed: 0.65, scale: 0.7 },
  marmoset: { count: 5, habitat: "forest", speed: 0.8, scale: 0.65 },
  parrot: { count: 7, habitat: "canopy", speed: 1.6, scale: 0.8 },
  armadillo: { count: 4, habitat: "scrub", speed: 0.4, scale: 0.8 },
  anteater: { count: 3, habitat: "scrub", speed: 0.3, scale: 1 },
  frog: { count: 6, habitat: "bank", speed: 0.55, scale: 0.5 },
  fish: { count: 10, habitat: "water", speed: 0.7, scale: 0.6 },
};
export const WILDLIFE_BEHAVIOR = {
  disturbanceRadius: 3,
  fleeSeconds: 4,
  fleeSpeedMultiplier: 2.5,
  roamingRadius: 7,
  minimumPause: 0.2,
  maximumPause: 1.8,
  routeMemory: 8,
  mutationStart: 35,
  demonStart: 60,
  maxPopulation: 64,
};

export const WILDLIFE_HUNTING = {
  maxHunters: 2,
  interval: 10,
  searchRadius: 9,
  speed: 1.8,
  maxChaseSeconds: 16,
  strikeSeconds: 0.5,
  corpseSeconds: 3,
};

export const STRANDED_FISH = {
  downstreamCount: 6,
  strandAtDryness: 0.65,
  dieAtDryness: 1,
  deathDelaySeconds: 2,
  corpseSeconds: 45,
};
