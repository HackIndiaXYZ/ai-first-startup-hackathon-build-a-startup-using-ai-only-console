export type AIProvider = "openai" | "fireworks";
export type PublicAIConfig = {
  provider: AIProvider;
  label: string;
  model: string;
  available: boolean;
};
export type AIBindings = {
  AI_PROVIDER?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  FIREWORKS_API_KEY?: string;
  FIREWORKS_MODEL?: string;
};
export function aiConfig(env: AIBindings): PublicAIConfig & { key: string } {
  // An explicit choice never silently sends a document to a different provider.
  const provider =
    env.AI_PROVIDER || (env.FIREWORKS_API_KEY ? "fireworks" : "openai");
  if (provider !== "openai" && provider !== "fireworks")
    throw Error("AI_PROVIDER must be openai or fireworks.");
  const key =
    (provider === "fireworks"
      ? env.FIREWORKS_API_KEY
      : env.OPENAI_API_KEY
    )?.trim() || "";
  return {
    provider,
    label: provider === "fireworks" ? "Fireworks" : "OpenAI",
    model:
      (provider === "fireworks"
        ? env.FIREWORKS_MODEL
        : env.OPENAI_MODEL
      )?.trim() ||
      (provider === "fireworks"
        ? "accounts/fireworks/models/kimi-k2p6"
        : "gpt-5.4-mini"),
    available: !!key,
    key,
  };
}
export function publicAIConfig(env: AIBindings): PublicAIConfig {
  const { provider, label, model, available } = aiConfig(env);
  return { provider, label, model, available };
}
