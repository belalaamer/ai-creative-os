export type QualityTier = "fast" | "quality" | "ultra";

export interface GenerationContext {
  organizationId: string;
  projectId?: string;
  brandId?: string;
  userId: string;
  quality: QualityTier;
}

export interface TextGenerationRequest {
  prompt: string;
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface ImageGenerationRequest {
  prompt: string;
  aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9";
  referenceAssetUrls?: string[];
}

export interface VideoGenerationRequest {
  prompt: string;
  aspectRatio?: "9:16" | "16:9";
  durationSeconds?: number;
  referenceAssetUrls?: string[];
}

export interface GenerationResult {
  provider: string;
  model: string;
  externalJobId?: string;
  outputText?: string;
  assetUrls?: string[];
  rawUsage?: Record<string, unknown>;
  estimatedCostUsd?: number;
}

export interface AIProvider {
  readonly name: string;
  generateText?(req: TextGenerationRequest, ctx: GenerationContext): Promise<GenerationResult>;
  generateImage?(req: ImageGenerationRequest, ctx: GenerationContext): Promise<GenerationResult>;
  generateVideo?(req: VideoGenerationRequest, ctx: GenerationContext): Promise<GenerationResult>;
}
