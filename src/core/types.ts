export type AssistantState =
  | "IDLE"
  | "LISTENING"
  | "THINKING"
  | "TOOL_EXECUTION"
  | "SPEAKING"
  | "ERROR";

export type Capability = "weather" | "calendar" | "gmail";

export type SceneRole = "primary" | "secondary" | "compact";
export type SceneLifecycle = "entering" | "active" | "exiting";
export type ScenePlacement = "primary" | "secondary-a" | "secondary-b";

export type WeatherContent = {
  kind: "weather";
  location: string;
  temperature: number;
  minimum: number;
  rainChance: number;
  condition: string;
};

export type CalendarContent = {
  kind: "calendar";
  dateLabel: string;
  items: Array<{ id: string; time: string; title: string }>;
};

export type GmailContent = {
  kind: "gmail";
  items: Array<{ id: string; sender: string; subject: string; time: string }>;
};

export type SceneContent =
  | WeatherContent
  | CalendarContent
  | GmailContent;

export type SceneEntity = {
  stableId: string;
  capability: Capability;
  sourceToolCallId: string;
  relevance: number;
  role: SceneRole;
  lifecycle: SceneLifecycle;
  previousPlacement?: ScenePlacement;
  currentPlacement: ScenePlacement;
  lastReferencedTurn: number;
  accessibilitySummary: string;
  content: SceneContent;
};

export type SceneState = {
  entities: SceneEntity[];
  focusedId?: string;
  turn: number;
};

export type SceneOperation =
  | {
      type: "present";
      entity: Omit<
        SceneEntity,
        "role" | "lifecycle" | "currentPlacement" | "lastReferencedTurn"
      >;
      role: SceneRole;
    }
  | { type: "promote"; stableId: string }
  | { type: "clear" };

export type DemoIntent =
  | "morning"
  | "weather"
  | "calendar"
  | "gmail"
  | "error";
