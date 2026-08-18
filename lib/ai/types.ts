import type { z } from "zod";

/**
 * The provider-agnostic contract every model backend must satisfy.
 *
 * REQUIREMENTS.md §5 makes this a hard rule: swapping Groq for Claude has to be a
 * one-line change. That is only true if nothing outside `lib/ai/` knows which
 * provider is in use, so this file deliberately mentions no vendor.
 */

/**
 * Which class of model a call needs.
 *
 * `judgment` is for work where being wrong is the whole failure — drift verdicts (F4)
 * and weekly reviews (F7). `bulk` is for cheap, high-volume calls where a smaller
 * model is fine. Callers pick the tier; `lib/ai/groq.ts` maps it to a model id.
 */
export type ModelTier = "judgment" | "bulk";

export interface GenerateOptions<T> {
  /** What the model is being asked to do. */
  prompt: string;
  /** Shapes the response. The provider enforces it and the result is parsed against it. */
  schema: z.ZodType<T>;
  /** Names the schema for the provider. Lowercase, no spaces, e.g. `drift_verdict`. */
  schemaName: string;
  /** Steers behaviour and tone. Optional, but F4's honesty rules belong here. */
  system?: string;
  /** Defaults to `judgment` — the safer default when a caller does not say. */
  tier?: ModelTier;
  /**
   * Upper bound on generated tokens. Must be generous: reasoning models spend tokens
   * thinking before they emit any JSON, and a low cap truncates mid-object.
   */
  maxTokens?: number;
}

/** Thrown for every failure in this layer, so callers catch one type. */
export class ModelError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
    /** True when retrying later could plausibly succeed (rate limit, 5xx, timeout). */
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ModelError";
  }
}

export interface ModelProvider {
  generate<T>(options: GenerateOptions<T>): Promise<T>;
}
