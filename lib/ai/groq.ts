import { z } from "zod";
import { ModelError, type GenerateOptions, type ModelProvider, type ModelTier } from "./types";

/**
 * Groq backend. The only file in the project that knows Groq exists.
 *
 * Server-only. `GROQ_API_KEY` has no `NEXT_PUBLIC_` prefix precisely so it cannot be
 * inlined into the browser bundle; importing this from a Client Component would leak
 * the key. Reach it through a Server Action instead.
 *
 * Groq speaks the OpenAI chat-completions wire format, so this is plain `fetch` — no
 * SDK. That keeps the dependency count at zero and makes the request shape visible.
 */

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Tier → model id.
 *
 * REQUIREMENTS.md §5 originally pinned `llama-3.3-70b-versatile` and
 * `llama-3.1-8b-instant`. Groq retired the Llama line; verified against the live
 * models endpoint on 2026-08-19, neither exists any more. These are the replacements.
 * They are open-weight models running on Groq hardware — inputs never reach OpenAI,
 * so §5's reason for choosing Groq (contractually barred from training on inputs)
 * still holds.
 *
 * Re-check this list if calls start failing with a 404: model ids are not stable.
 */
const MODELS: Record<ModelTier, string> = {
  judgment: "openai/gpt-oss-120b",
  bulk: "openai/gpt-oss-20b",
};

/**
 * Reasoning models spend most of their output budget thinking before emitting JSON.
 * A cap that looks generous for the answer alone truncates the response mid-object,
 * which surfaces as a JSON parse error rather than an obvious "too short".
 */
const DEFAULT_MAX_TOKENS = 2000;

/**
 * Convert a Zod schema to the JSON Schema dialect Groq's `strict` mode accepts.
 *
 * Two adjustments are required, and both are silent 400s if missed:
 *   - `z.toJSONSchema()` stamps a `$schema` key at the root. Strict mode validates the
 *     schema object itself against `additionalProperties: false`, so that annotation is
 *     read as an illegal extra property and the whole request is rejected.
 *   - Strict mode demands `additionalProperties: false` on every object, and requires
 *     every declared property to be listed in `required`. Zod only marks non-optional
 *     fields as required, so optional fields have to be promoted here. That is not a
 *     loss: the model still has to emit the key, which is what we want from a schema
 *     the eval harness will compare against.
 */
function toStrictJsonSchema(schema: z.ZodType<unknown>): Record<string, unknown> {
  const root = z.toJSONSchema(schema) as Record<string, unknown>;
  delete root.$schema;

  const harden = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(harden);
    if (!node || typeof node !== "object") return node;

    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      out[key] = harden(value);
    }
    if (out.type === "object" && out.properties && typeof out.properties === "object") {
      out.additionalProperties = false;
      out.required = Object.keys(out.properties as Record<string, unknown>);
    }
    return out;
  };

  return harden(root) as Record<string, unknown>;
}

function apiKey(): string {
  const key = process.env.GROQ_API_KEY;
  // A `!` assertion is erased at compile time, so `undefined` would travel all the way
  // to the Authorization header and come back as an opaque 401. Name the variable —
  // same rule as `proxy.ts`.
  if (!key) {
    throw new ModelError(
      "Missing env var: GROQ_API_KEY. Add it to .env.local for local work, and to the " +
        "hosting provider's environment settings (Production, Preview and Development) " +
        "for deploys. Get a key at https://console.groq.com -> API Keys.",
    );
  }
  return key;
}

/** The subset of the chat-completions response this layer reads. */
const ResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullish(),
        message: z.object({ content: z.string().nullish() }),
      }),
    )
    .min(1),
});

export const groqProvider: ModelProvider = {
  async generate<T>({
    prompt,
    schema,
    schemaName,
    system,
    tier = "judgment",
    maxTokens = DEFAULT_MAX_TOKENS,
  }: GenerateOptions<T>): Promise<T> {
    const messages = [
      ...(system ? [{ role: "system" as const, content: system }] : []),
      { role: "user" as const, content: prompt },
    ];

    // Read the key before the try block. Inside it, the ModelError this throws would be
    // caught by the network handler below and re-wrapped as a retryable transport
    // failure — losing the variable name and retrying twice to reach the same error.
    const key = apiKey();

    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODELS[tier],
          messages,
          max_completion_tokens: maxTokens,
          // `json_schema` with `strict` makes Groq enforce the shape during decoding,
          // so malformed JSON never comes back. The Zod parse below is still needed:
          // it converts the untyped object into `T` and catches schema drift.
          response_format: {
            type: "json_schema",
            json_schema: { name: schemaName, strict: true, schema: toStrictJsonSchema(schema) },
          },
        }),
      });
    } catch (cause) {
      // Network-level failure: no response at all. Always worth a retry.
      throw new ModelError("Could not reach the model provider.", cause, true);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      // 429 is the rate limit; 5xx is the provider having a bad day. Both pass with time.
      const retryable = response.status === 429 || response.status >= 500;

      // Running out of tokens mid-JSON surfaces here as a 400 about failed validation,
      // not as `finish_reason: "length"` — the truncated object never validates against
      // the schema. Without this the caller sees a schema complaint and edits the schema,
      // when the actual fix is a larger budget.
      if (response.status === 400 && /failed to validate json/i.test(body)) {
        throw new ModelError(
          `The model was cut off before completing valid JSON (max_completion_tokens: ${maxTokens}). ` +
            `Raise maxTokens — reasoning models spend much of the budget before emitting any output.`,
        );
      }

      throw new ModelError(
        `Model provider returned ${response.status}. ${body.slice(0, 300)}`,
        undefined,
        retryable,
      );
    }

    const parsed = ResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new ModelError("Unrecognised response shape from the model provider.", parsed.error);
    }

    const choice = parsed.data.choices[0];
    const content = choice.message.content;

    // Reasoning models put their thinking in a separate `reasoning` field and the answer
    // in `content`. Hitting the token cap mid-thought leaves `content` empty with
    // `finish_reason: "length"` — a bigger `maxTokens` is the fix, not a retry.
    if (!content) {
      throw new ModelError(
        choice.finish_reason === "length"
          ? `The model ran out of tokens before answering (max_completion_tokens: ${maxTokens}). Raise maxTokens.`
          : `The model returned no content (finish_reason: ${choice.finish_reason ?? "unknown"}).`,
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch (cause) {
      throw new ModelError("The model returned content that is not valid JSON.", cause);
    }

    const result = schema.safeParse(raw);
    if (!result.success) {
      throw new ModelError(
        `The model's response did not match the ${schemaName} schema.`,
        result.error,
      );
    }
    return result.data;
  },
};
