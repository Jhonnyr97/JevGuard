import { jevApiKey } from "../rules/config.js";

export interface JevQuestion {
  type: "noul" | "choice" | "score";
  instructions: unknown;
  criteria?: unknown;
}

export type JevAnswer =
  | { type: "noul"; noul: number }
  | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
  | {
      type: "score";
      score: number;
      legend: Record<string, string>;
      probabilities: Record<string, number>;
      confidence: number;
    };

export interface JevResponse {
  model: string;
  answers: Record<string, JevAnswer>;
  usage?: { input_tokens: number; output_tokens: number };
}

/**
 * Same contract as https://api.typesafe.ai/v1/systemone: POST {state, model, questions} ->
 * {answers}. `baseUrl`/`model` are fully configurable (.jevguard/config.json's `jev.*`): this
 * client doesn't assume or bundle any particular backend.
 *
 * The API key is never read from config.json (so it never ends up in a file that could get
 * committed): see jevApiKey() in rules/config.ts for where it comes from. A local backend that
 * doesn't require auth just leaves both of those unset.
 */
export async function askJev(
  baseUrl: string,
  model: string,
  state: unknown,
  questions: Record<string, JevQuestion>,
): Promise<JevResponse> {
  const apiKey = jevApiKey();
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/systemone`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ state, model, questions }),
  });
  if (!res.ok) {
    throw new Error(`jev backend error ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as JevResponse;
}
