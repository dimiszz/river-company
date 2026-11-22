export const TUTORIAL = {
  enabled: true,
  clicksToRevealChips: 5,
  deliveriesForEfficiency: 3,
  damageForTrees: 5,
  completionHintSeconds: 4,
};

export const TUTORIAL_STEPS: Record<string, { title: string; step: number }> = {
  place: { title: "Escolha o terreno", step: 1 },
  earn: { title: "Faça seus primeiros ganhos", step: 2 },
  "explain-work": { title: "Entenda o trabalho ◈", step: 3 },
  chips: { title: "Instale seus primeiros chips", step: 4 },
  "save-chips": { title: "Junte dinheiro para os chips", step: 4 },
  inspect: { title: "Entre no centro de dados", step: 5 },
  "inside-chips": { title: "Conheça seus servidores", step: 5 },
  sign: { title: "Escolha seu primeiro contrato", step: 6 },
  "first-job": { title: "Conclua sua primeira entrega", step: 6 },
  "first-wait": { title: "Prepare a próxima tentativa", step: 6 },
  "explain-stocks": { title: "Acompanhe o valor da empresa", step: 7 },
  auto: { title: "Automatize o trabalho", step: 8 },
  capacity: { title: "Amplie sua capacidade", step: 9 },
  power: { title: "Forneça mais energia", step: 10 },
  cooling: { title: "Mantenha os servidores frios", step: 11 },
  ready: { title: "Agora a escolha é sua", step: 12 },
};
export const TUTORIAL_STEP_COUNT = 12;
