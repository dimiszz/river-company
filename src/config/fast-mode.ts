/** Fast playtesting sessions; contract deadlines and render frame rate stay unchanged. */
export const FAST_MODE = {
  workMultiplier: 3,
  earningsMultiplier: 3,
  environmentMultiplier: 3,
  greenEarnings: 7500,
  greenContracts: 8,
  contractCooldownSeconds: 2,
} as const;
