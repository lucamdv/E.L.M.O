import { describe, expect, it } from "vitest";
import {
  AssistantIdentitySchema,
  BehavioralContextSchema,
  JsonObjectSchema,
  PersonaProfileSchema,
} from "../contracts";
import { getElmoPersona } from "./elmo-persona";
import { composePersonaContext } from "./persona-composer";

describe("getElmoPersona", () => {
  it("loads the approved stable identity and its versioned profile", () => {
    const { identity, personaProfile } = getElmoPersona();

    expect(identity).toEqual({ id: "elmo", displayName: "Elmo", version: 1 });
    expect(personaProfile.identityId).toBe(identity.id);
    expect(personaProfile.version).toBe(1);
  });

  it("preserves all five approved pillars and the relational role", () => {
    const { personaProfile } = getElmoPersona();

    expect(personaProfile.traits).toEqual([
      "empático", "interessado", "divertido", "parceiro", "inteligente",
    ]);
    expect(personaProfile.relationalRole).toBe("braço direito e melhor amigo do usuário");
  });

  it("provides approved communication defaults rather than user preferences", () => {
    const { personaProfile } = getElmoPersona();

    expect(personaProfile.communicationDefaults).toEqual([
      "comunicação clara, natural e acolhedora, sem excesso de formalidade",
      "respostas proporcionais à necessidade: não falar mais do que precisa nem entregar menos do que o usuário precisa",
      "resposta primeiro; explicação adicional quando necessária, solicitada ou claramente útil",
      "acompanhar o idioma e o estilo do usuário sem perder a personalidade",
    ]);
  });

  it("preserves interest, efficient warmth, seriousness and contextual humor", () => {
    const { personaProfile } = getElmoPersona();

    expect(personaProfile.behaviorDefaults).toEqual([
      "demonstrar interesse genuíno e curiosidade pelo usuário e pela tarefa",
      "eficiência sem frieza; quando amizade e eficiência conflitarem, eficiência vence em tom amigável",
      "tratar assuntos sérios com seriedade, reduzindo informalidade e humor",
      "usar humor contextual quando apropriado, sem bordões artificiais",
      "reconhecer erros rapidamente e corrigir sem desculpas longas",
    ]);
  });

  it("preserves the approved epistemic, relational and behavioral limits", () => {
    const { personaProfile } = getElmoPersona();

    expect(personaProfile.principles).toEqual([
      "agir com honestidade e respeito, sem preconceito, arrogância, soberba ou indiferença",
      "demonstrar competência sem arrogância",
      "humor nunca deve humilhar, ofender ou atacar; sarcasmo dirigido ao usuário é proibido",
      "tentar descobrir antes de declarar incerteza; verificar informações atuais, mutáveis ou incertas com capacidades disponíveis",
      "nunca fabricar certeza ou inventar fatos; quando não conseguir confirmar com segurança, declarar a limitação",
      "diferenciar fato, inferência e opinião quando importar e indicar dados desatualizados",
      "não fingir capacidades humanas que não possui",
      "adaptação relacional não pode apagar a identidade, os cinco pilares ou os limites comportamentais",
      "personalidade não concede nem contorna permissões, não executa capabilities, não escolhe provider e não controla rendering",
    ]);
  });

  it("returns only the stable public layers accepted by the existing strict schemas", () => {
    const persona = getElmoPersona();

    expect(Object.keys(persona).sort()).toEqual(["identity", "personaProfile"]);
    expect(AssistantIdentitySchema.parse(persona.identity)).toEqual(persona.identity);
    expect(PersonaProfileSchema.parse(persona.personaProfile)).toEqual(persona.personaProfile);
    expect(JsonObjectSchema.parse(persona)).toEqual(persona);
    expect(Object.keys(persona.identity).sort()).toEqual(["displayName", "id", "version"]);
    expect(Object.keys(persona.personaProfile).sort()).toEqual([
      "behaviorDefaults", "communicationDefaults", "identityId", "principles",
      "relationalRole", "traits", "version",
    ]);
  });

  it("preserves the canonical data through JSON serialization", () => {
    const persona = getElmoPersona();
    const restored = JSON.parse(JSON.stringify(persona));

    expect(restored).toEqual(persona);
    expect(AssistantIdentitySchema.parse(restored.identity)).toEqual(persona.identity);
    expect(PersonaProfileSchema.parse(restored.personaProfile)).toEqual(persona.personaProfile);
  });

  it("isolates identity and profile changes from existing and future consumers", () => {
    const first = getElmoPersona();
    const second = getElmoPersona();
    const before = structuredClone(second);

    first.identity.id = "changed";
    first.identity.displayName = "Changed";
    first.identity.version = 2;
    first.personaProfile.identityId = "changed";
    first.personaProfile.version = 2;
    first.personaProfile.relationalRole = "changed";

    expect(second).toEqual(before);
    expect(getElmoPersona()).toEqual(before);
  });

  it.each(["traits", "communicationDefaults", "behaviorDefaults", "principles"] as const)(
    "isolates nested %s mutations from existing and future consumers",
    (field) => {
      const first = getElmoPersona();
      const second = getElmoPersona();
      const before = structuredClone(second);

      first.personaProfile[field][0] = "changed";
      first.personaProfile[field].push("injected");

      expect(first.personaProfile[field]).not.toBe(second.personaProfile[field]);
      expect(second).toEqual(before);
      expect(getElmoPersona()).toEqual(before);
    },
  );

  it("hands the canonical layers to the real Composer without constructing other layers", () => {
    const persona = getElmoPersona();
    const before = structuredClone(persona);
    const relationalPreferences = { preferredFormOfAddress: "Lu", formality: "formal" as const };
    const interactionContext = { languageTag: "pt-BR", seriousness: "serious" as const };
    const result = composePersonaContext({ ...persona, relationalPreferences, interactionContext });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected canonical Persona composition to succeed");
    expect(BehavioralContextSchema.parse(result.value)).toEqual({
      ...before, relationalPreferences, interactionContext,
    });
    expect(result.value.identity).toEqual({ id: "elmo", displayName: "Elmo", version: 1 });
    expect(result.value.personaProfile).toEqual(before.personaProfile);
    // preferredFormOfAddress addresses the user; it is not an assistant alias.
    expect(result.value.relationalPreferences.preferredFormOfAddress).toBe("Lu");
    expect(persona).toEqual(before);
  });
});
