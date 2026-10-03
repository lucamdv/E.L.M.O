import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();
async function boundaryMessages(source: string, filePath: string) {
  const [result] = await eslint.lintText(source, { filePath });
  return result.messages.filter((message) => message.ruleId === "elmo-boundaries/no-server-imports");
}

describe("client/server import guards", () => {
  it.each([
    'import "@/elmo/brain/basic-brain";',
    'import "@/elmo/providers/vendor";',
    'export * from "../../elmo/server/brain";',
    'const provider = import("@/elmo/providers/vendor");',
    'const provider = require("../../elmo/providers/vendor");',
    'import "./secret.server";',
  ])("blocks visual server import %s", async (source) => {
    expect(await boundaryMessages(source, "src/components/elmo/boundary-fixture.tsx")).toHaveLength(1);
  }, 60_000);

  it("blocks server imports in client modules outside visual directories", async () => {
    expect(await boundaryMessages('"use client"; import "./providers/vendor";', "src/elmo/boundary-fixture.ts")).toHaveLength(1);
  });

  it("blocks relative server imports from the reserved client directory", async () => {
    expect(await boundaryMessages('import "../brain/basic-brain";', "src/elmo/client/boundary-fixture.ts")).toHaveLength(1);
  });

  it("keeps shared contracts available to visual code", async () => {
    expect(await boundaryMessages('import "@/elmo/contracts";', "src/components/elmo/boundary-fixture.tsx")).toHaveLength(0);
  });

  it("keeps server imports out of shared contracts", async () => {
    expect(await boundaryMessages('import "../providers/vendor";', "src/elmo/contracts/boundary-fixture.ts")).toHaveLength(1);
  });

  it("allows future server modules to import providers", async () => {
    expect(await boundaryMessages('import "../providers/vendor";', "src/elmo/brain/boundary-fixture.ts")).toHaveLength(0);
  });
});
