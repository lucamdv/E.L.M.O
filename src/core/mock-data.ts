import type { SceneEntity } from "./types";

type EntitySeed = Omit<
  SceneEntity,
  "role" | "lifecycle" | "currentPlacement" | "lastReferencedTurn"
>;

export const MOCK_ENTITIES: Record<"weather" | "calendar" | "gmail", EntitySeed> = {
  weather: {
    stableId: "context-weather-recife",
    capability: "weather",
    sourceToolCallId: "mock-weather-recife",
    relevance: 0.72,
    accessibilitySummary:
      "Previsão para Recife: 29 graus, mínima de 25 e possibilidade de chuva no fim da tarde.",
    content: {
      kind: "weather",
      location: "Recife",
      temperature: 29,
      minimum: 25,
      rainChance: 35,
      condition: "Quente, com chuva possível no fim da tarde.",
    },
  },
  calendar: {
    stableId: "context-calendar-tomorrow",
    capability: "calendar",
    sourceToolCallId: "mock-calendar-tomorrow",
    relevance: 0.84,
    accessibilitySummary:
      "Agenda de amanhã com três compromissos: consulta às 9 e 30, almoço com um amigo às 14 horas e aula às 18 horas.",
    content: {
      kind: "calendar",
      dateLabel: "Amanhã",
      items: [
        { id: "appointment", time: "09:30", title: "Consulta" },
        { id: "lunch", time: "14:00", title: "Almoço com um amigo" },
        { id: "class", time: "18:00", title: "Aula" },
      ],
    },
  },
  gmail: {
    stableId: "context-gmail-attention",
    capability: "gmail",
    sourceToolCallId: "mock-gmail-attention",
    relevance: 0.68,
    accessibilitySummary:
      "Dois e-mails podem merecer atenção: um de Marina e outro do Clube de leitura.",
    content: {
      kind: "gmail",
      items: [
        {
          id: "marina-weekend",
          sender: "Marina",
          subject: "Planos para o fim de semana",
          time: "09:12",
        },
        {
          id: "book-club",
          sender: "Clube de leitura",
          subject: "Encontro deste mês",
          time: "08:47",
        },
      ],
    },
  },
};

export const RESPONSES = {
  morning:
    "Bom dia. Amanhã continua quente em Recife, você tem três compromissos e dois e-mails que podem merecer atenção.",
  weather:
    "Amanhã deve fazer 29 graus em Recife, com possibilidade de chuva no fim da tarde.",
  calendar: "Você tem três compromissos. O período mais ocupado é a tarde.",
  gmail:
    "Há dois e-mails que podem pedir sua atenção. O mais recente é da Marina.",
  error:
    "Não consegui concluir essa consulta agora. Podemos tentar novamente em um instante.",
} as const;

export const USER_UTTERANCES = {
  morning: "Bom dia, chat.",
  weather: "Como está o tempo amanhã?",
  calendar: "E meus compromissos?",
  gmail: "Tenho algum e-mail importante?",
  error: "Tenta consultar de novo.",
} as const;
