import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CapabilityRegistry } from "../../src/elmo/registry/capability-registry";
import { ElmoErrorSchema, type CapabilityDefinition } from "../../src/elmo/contracts";

function fixture(id = "test.first") {
  let calls = 0;
  const definition: CapabilityDefinition<string, string> = {
    id, description: "Test-only definition", inputSchema: z.string(), outputSchema: z.string(),
    permission: { scopes: ["test.read"], requiresConfirmation: true },
    async execute(input) { calls++; return { ok: true, value: input }; },
  };
  return { definition, calls: () => calls };
}

describe("CapabilityRegistry", () => {
  it("starts empty with no known capabilities", () => {
    const registry = new CapabilityRegistry();
    expect(registry.list()).toEqual([]);
    expect(registry.has("test.first")).toBe(false);
  });

  it("registers and discovers definitions without executing them", () => {
    const registry = new CapabilityRegistry();
    const first = fixture();
    const second = fixture("test.second");
    expect(registry.register(first.definition)).toEqual({ ok: true, value: undefined });
    expect(registry.list().map((definition) => definition.id)).toEqual(["test.first"]);
    expect(registry.register(second.definition).ok).toBe(true);
    expect(registry.has("test.first")).toBe(true);
    expect(registry.has("missing")).toBe(false);
    expect(registry.list().map((definition) => definition.id)).toEqual(["test.first", "test.second"]);
    const resolved = registry.resolve("test.first");
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) throw new Error("Expected registered capability");
    expect(resolved.value).toEqual(first.definition);
    expect(resolved.value.inputSchema).toBe(first.definition.inputSchema);
    expect(resolved.value.outputSchema).toBe(first.definition.outputSchema);
    expect(resolved.value.execute).toBe(first.definition.execute);
    expect(first.calls()).toBe(0);
    expect(second.calls()).toBe(0);
  });

  it("rejects duplicates and preserves the original", () => {
    const registry = new CapabilityRegistry();
    const original = fixture();
    const duplicate = fixture();
    duplicate.definition.permission.scopes.push("test.write");
    registry.register(original.definition);
    const result = registry.register(duplicate.definition);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected duplicate error");
    expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(result.error.retryable).toBe(false);
    expect(ElmoErrorSchema.safeParse(result.error).success).toBe(true);
    expect(registry.resolve("test.first")).toEqual({ ok: true, value: original.definition });
    expect(registry.list()).toHaveLength(1);
    expect(original.calls() + duplicate.calls()).toBe(0);
  });

  it("returns a standardized non-retryable error for unknown ids", () => {
    const registry = new CapabilityRegistry();
    const result = registry.resolve("missing");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected unknown-id error");
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.retryable).toBe(false);
    expect(ElmoErrorSchema.safeParse(result.error).success).toBe(true);
  });

  it("uses the validated getter id for insertion without overwriting another registration", () => {
    const registry = new CapabilityRegistry();
    const original = fixture("test.first");
    registry.register(original.definition);
    const originalResult = registry.resolve("test.first");
    const incoming = fixture("test.new");
    const ids = ["test.new", "test.absent", "test.first"];
    let reads = 0;
    Object.defineProperty(incoming.definition, "id", { get: () => ids[reads++] ?? "test.first" });

    expect(registry.register(incoming.definition).ok).toBe(true);
    expect(registry.resolve("test.first")).toEqual(originalResult);
    expect(registry.has("test.new")).toBe(true);
    expect(registry.list().map((definition) => definition.id)).toEqual(["test.first", "test.new"]);
    expect(original.calls() + incoming.calls()).toBe(0);
  });

  it("rejects the validated duplicate id even when later getter reads change", () => {
    const registry = new CapabilityRegistry();
    const original = fixture("test.first");
    registry.register(original.definition);
    const originalResult = registry.resolve("test.first");
    const incoming = fixture();
    let reads = 0;
    Object.defineProperty(incoming.definition, "id", {
      get: () => reads++ === 0 ? "test.first" : "test.absent",
    });

    const result = registry.register(incoming.definition);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected duplicate rejection");
    expect(result.error.details?.capabilityId).toBe("test.first");
    expect(registry.resolve("test.first")).toEqual(originalResult);
    expect(registry.has("test.absent")).toBe(false);
    expect(registry.list()).toHaveLength(1);
    expect(original.calls() + incoming.calls()).toBe(0);
  });

  it.each(["inputSchema", "outputSchema", "execute"] as const)(
    "preserves the validated %s reference when subsequent getter reads change", (field) => {
      const registry = new CapabilityRegistry();
      const incoming = fixture();
      const alternate = fixture("test.alternate");
      const validatedReference = incoming.definition[field];
      let reads = 0;
      Object.defineProperty(incoming.definition, field, {
        get: () => reads++ === 0 ? validatedReference : alternate.definition[field],
      });

      expect(registry.register(incoming.definition).ok).toBe(true);
      const result = registry.resolve("test.first");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected registered capability");
      expect(result.value[field]).toBe(validatedReference);
      expect(incoming.calls() + alternate.calls()).toBe(0);
    },
  );

  it.each([
    { id: "" }, { id: "invalid id" }, { id: 42 }, { description: undefined },
    { inputSchema: {} }, { outputSchema: {} }, { execute: undefined },
    { permission: { scopes: [""], requiresConfirmation: true } },
    { permission: { scopes: [], requiresConfirmation: "yes" } },
    { permission: { scopes: [], requiresConfirmation: false, extra: true } },
  ])("rejects malformed definition fields %j without storing or executing", (override) => {
    const registry = new CapabilityRegistry();
    const sample = fixture();
    const result = registry.register({ ...sample.definition, ...override } as unknown as CapabilityDefinition);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected validation error");
    expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(ElmoErrorSchema.safeParse(result.error).success).toBe(true);
    expect(registry.list()).toEqual([]);
    expect(sample.calls()).toBe(0);
  });

  it("protects stored metadata and order against caller mutation and isolates registries", () => {
    const registry = new CapabilityRegistry();
    const sample = fixture();
    registry.register(sample.definition);
    sample.definition.permission.scopes.push("test.write");
    Object.assign(sample.definition, { id: "changed", description: "changed" });
    const listed = registry.list();
    expect(listed[0].id).toBe("test.first");
    expect(listed[0].description).toBe("Test-only definition");
    expect(listed[0].permission).toEqual({ scopes: ["test.read"], requiresConfirmation: true });
    expect(() => Object.assign(listed[0], { id: "corrupted" })).toThrow();
    expect(() => listed[0].permission.scopes.push("corrupted")).toThrow();
    (listed as CapabilityDefinition[]).pop();
    expect(registry.has("test.first")).toBe(true);
    expect(registry.list()).toHaveLength(1);
    expect(new CapabilityRegistry().list()).toEqual([]);
    expect(sample.calls()).toBe(0);
  });

  // Architecture verification: keep this local boundary free of SDK dependencies.
  it("imports only Zod and shared contracts, with no provider-specific types", () => {
    const source = readFileSync(new URL("../../src/elmo/registry/capability-registry.ts", import.meta.url), "utf8");
    const file = ts.createSourceFile("capability-registry.ts", source, ts.ScriptTarget.Latest, true);
    function check(node: ts.Node) {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const specifier = node.moduleSpecifier;
        if (specifier && ts.isStringLiteral(specifier)) {
          expect(specifier.text === "zod" || specifier.text.startsWith("../contracts/")).toBe(true);
        }
      }
      if (ts.isImportTypeNode(node) || ts.isCallExpression(node) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
           ts.isIdentifier(node.expression) && node.expression.text === "require")) {
        throw new Error("Registry must use static contract imports");
      }
      if (ts.isTypeReferenceNode(node)) {
        expect(node.typeName.getText(file)).not.toMatch(/provider|sdk|openai|anthropic|google|supabase|vercel/i);
      }
      ts.forEachChild(node, check);
    }
    check(file);
  });
});
