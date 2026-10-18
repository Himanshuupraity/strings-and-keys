// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readAIConfig } from "./config";

describe("AI config", () => {
  it("is unconfigured with no env", () => {
    expect(readAIConfig({}).config).toBeNull();
  });
  it("defaults anthropic model and requires model for openai", () => {
    expect(readAIConfig({ ANTHROPIC_API_KEY: "k" }).config?.model).toBe("claude-opus-5-5");
    expect(readAIConfig({ AI_PROVIDER: "openai", AI_API_KEY: "k" }).config).toBeNull();
    expect(readAIConfig({ AI_PROVIDER: "openai", AI_API_KEY: "k", AI_MODEL: "m" }).config?.baseUrl).toBe("https://api.openai.com/v1");
    expect(readAIConfig({ AI_PROVIDER: "openai-compatible", AI_API_KEY: "k", AI_MODEL: "m" }).config).toBeNull();
    expect(readAIConfig({ AI_PROVIDER: "nope" }).reason).toContain("Unknown");
  });
});
