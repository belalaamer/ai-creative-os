import type { AIProvider, GenerationContext, GenerationResult, TextGenerationRequest } from "./contracts";

export class ModelRouter {
  constructor(private readonly providers: AIProvider[]) {}

  async generateText(req: TextGenerationRequest, ctx: GenerationContext): Promise<GenerationResult> {
    const candidates = this.providers.filter((p) => typeof p.generateText === "function");
    if (!candidates.length) throw new Error("No text provider configured");

    // Phase 0: deterministic first-provider strategy.
    // Phase 1+: route by quality, latency, cost, reliability and provider health.
    const selected = candidates[0];
    return selected.generateText!(req, ctx);
  }
}
