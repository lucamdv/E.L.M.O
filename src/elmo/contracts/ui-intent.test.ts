import { describe, expect, it } from "vitest";
import * as contracts from "./index";

describe("controlled UI intents", () => {
  it.each([
    { type: "message.show", payload: { text: "Hello" } },
    { type: "context.focus", payload: { contextId: "context-1" } },
  ])("accepts registered semantic intent %j", (intent) => {
    expect(contracts.UIIntentSchema?.safeParse(intent).success).toBe(true);
  });

  it.each(["html", "css", "javascript", "react"])("rejects extra %s at every intent level", (field) => {
    const intent = { type: "message.show", payload: { text: "Hello" } };
    expect(contracts.UIIntentSchema?.safeParse({ ...intent, [field]: "arbitrary" }).success).toBe(false);
    expect(contracts.UIIntentSchema?.safeParse({ ...intent, payload: { ...intent.payload, [field]: "arbitrary" } }).success).toBe(false);
  });

  it.each([
    { type: "render.html", payload: { html: "<div/>" } },
    { type: "message.show", payload: { text: "" } },
    { type: "context.focus", payload: { contextId: "" } },
    { type: "context.focus", payload: { text: "Hello" } },
    { type: "message.show", payload: { text: { html: "<div/>" } } },
  ])("rejects unregistered or malformed intent %j", (intent) => {
    expect(contracts.UIIntentSchema?.safeParse(intent).success).toBe(false);
  });

  it("exposes the same strict schemas to the controlled registry", () => {
    expect(contracts.UIIntentRegistry?.["message.show"].safeParse({ type: "message.show", payload: { text: "Hello", html: "<div/>" } }).success).toBe(false);
    expect(contracts.UIIntentRegistry?.["context.focus"].safeParse({ type: "context.focus", payload: { contextId: "context-1" } }).success).toBe(true);
  });
});
