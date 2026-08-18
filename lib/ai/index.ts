import { groqProvider } from "./groq";
import { ModelError, type GenerateOptions, type ModelProvider } from "./types";

/**
 * The model layer — every LLM call the app makes goes through `generate()`.
 *
 * Server-only. Nothing outside this folder reads `process.env.GROQ_API_KEY`, names a
 * model id, or knows which vendor is in use. REQUIREMENTS.md §5 requires that
 * swapping to Claude be a one-line change; the line is `provider` below.
 *
 * Same seam as `lib/data/index.ts`: callers depend on the function, not the backend.
 */

/** Swap this to change providers. Nothing else in the project needs editing. */
const provider: ModelProvider = groqProvider;

/** Attempts in total, not retries after the first. */
const MAX_ATTEMPTS = 3;
/** Doubles each attempt: 1s, then 2s. Cheap insurance against the per-minute ceiling. */
const BASE_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ask the model for a structured answer.
 *
 * Retries only failures that time could fix — rate limits, 5xx, network drops. A schema
 * mismatch or a missing API key fails immediately, because retrying re-pays the latency
 * to arrive at the identical error.
 *
 * @throws {ModelError} once attempts are exhausted, or straight away if not retryable.
 */
export async function generate<T>(options: GenerateOptions<T>): Promise<T> {
  let lastError: ModelError | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await provider.generate(options);
    } catch (error) {
      // Anything that is not a ModelError is a bug in this layer, not a provider
      // failure — let it escape unwrapped rather than burning retries on it.
      if (!(error instanceof ModelError)) throw error;
      lastError = error;
      if (!error.retryable || attempt === MAX_ATTEMPTS) break;
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}

export { ModelError };
export type { GenerateOptions, ModelProvider, ModelTier } from "./types";
