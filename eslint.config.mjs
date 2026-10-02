import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import path from "node:path";

// Cover visual locations and any module declaring "use client", including
// static imports, re-exports, dynamic imports, and CommonJS require calls.
const noServerImports = {
  meta: {
    type: "problem",
    schema: [],
    messages: { serverImport: "Client/visual code must use shared Elmo contracts instead of importing server brain/provider modules." },
  },
  create(context) {
    const filename = context.filename.replaceAll("\\", "/");
    let guarded = /\/src\/(?:components|core|elmo\/(?:client|ui|contracts))(?:\/|$)/.test(filename)
      || (/\/src\/app\//.test(filename) && !/\/src\/app\/api\//.test(filename));

    function check(source) {
      if (!guarded || typeof source?.value !== "string") return;
      const target = path.resolve(path.dirname(context.filename), source.value).replaceAll("\\", "/");
      if (/\/elmo\/(?:server|brains?|providers?)(?:\/|$)|\.server(?:\.[cm]?[jt]sx?)?$/.test(target)) {
        context.report({ node: source, messageId: "serverImport" });
      }
    }

    return {
      Program(node) {
        guarded ||= node.body.some((statement) => statement.directive === "use client");
      },
      ImportDeclaration(node) { check(node.source); },
      ExportNamedDeclaration(node) { check(node.source); },
      ExportAllDeclaration(node) { check(node.source); },
      ImportExpression(node) { check(node.source); },
      CallExpression(node) {
        if (node.callee.type === "Identifier" && node.callee.name === "require") check(node.arguments[0]);
      },
    };
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{js,jsx,ts,tsx,mjs,mts,cjs,cts}"],
    plugins: { "elmo-boundaries": { rules: { "no-server-imports": noServerImports } } },
    rules: { "elmo-boundaries/no-server-imports": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
