import type { AssistantState } from "@/core/types";

export const ELMO_STATE_LABELS: Record<AssistantState, string> = {
  IDLE: "Em repouso",
  LISTENING: "Ouvindo",
  THINKING: "Pensando",
  TOOL_EXECUTION: "Buscando contexto",
  SPEAKING: "Falando",
  ERROR: "Algo não saiu como esperado",
};
