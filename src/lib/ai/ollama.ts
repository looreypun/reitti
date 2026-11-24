/**
 * Ollama client.
 * Settings come from window.__REITTI_CONFIG__ (public/config.js, rewritten by the Docker
 * container at startup), then VITE_OLLAMA_URL / VITE_OLLAMA_MODEL, then defaults.
 */
declare global {
  interface Window {
    __REITTI_CONFIG__?: { ollamaUrl?: string; ollamaModel?: string };
  }
}
const runtime = (typeof window !== 'undefined' && window.__REITTI_CONFIG__) || {};

export const OLLAMA_URL = (
  runtime.ollamaUrl ||
  (import.meta.env.VITE_OLLAMA_URL as string | undefined) ||
  'http://localhost:11434'
).replace(/\/$/, '');
/** The chat model set in .env.local (VITE_OLLAMA_MODEL) or the container's OLLAMA_MODEL. */
export const OLLAMA_MODEL = (runtime.ollamaModel || (import.meta.env.VITE_OLLAMA_MODEL as string | undefined) || '').trim();

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class OllamaError extends Error {
  constructor(
    message: string,
    readonly kind: 'unreachable' | 'no-models' | 'model' | 'other',
  ) {
    super(message);
  }
}

/** Models that cannot hold a text conversation (vision-only, embeddings). */
const NON_CHAT = /moondream|embed|llava|clip|bge|minilm/i;

export async function listChatModels(signal?: AbortSignal): Promise<string[]> {
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_URL}/api/tags`, { signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new OllamaError(`Can't reach Ollama at ${OLLAMA_URL}.`, 'unreachable');
  }
  if (!res.ok) throw new OllamaError(`Ollama responded with HTTP ${res.status}.`, 'other');
  const json = (await res.json()) as { models?: { name: string }[] };
  const models = (json.models ?? []).map((m) => m.name).filter((n) => !NON_CHAT.test(n));
  if (!models.length) throw new OllamaError('Ollama is running but has no chat models installed.', 'no-models');
  return models;
}

/** Checks that Ollama is reachable and returns the model to chat with. */
export async function resolveModel(signal?: AbortSignal): Promise<string> {
  const models = await listChatModels(signal);
  if (!OLLAMA_MODEL) return models.find((m) => /granite|llama|qwen|mistral|gemma|phi/i.test(m)) ?? models[0];
  // "granite4.2" matches the installed "granite4.2:latest"
  const found = models.find((m) => m === OLLAMA_MODEL || m === `${OLLAMA_MODEL}:latest`);
  if (!found) throw new OllamaError(`The model "${OLLAMA_MODEL}" isn't installed in Ollama.`, 'model');
  return found;
}

/** Streams a chat completion, calling onToken with each new piece of text. Resolves with the full reply. */
export async function streamChat(opts: {
  model: string;
  messages: ChatMessage[];
  onToken: (text: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: opts.signal,
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        stream: true,
        think: false,
        options: { temperature: 0.3, num_ctx: 8192 },
      }),
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new OllamaError(`Can't reach Ollama at ${OLLAMA_URL}.`, 'unreachable');
  }
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    const message = safeJson<{ error?: string }>(detail)?.error ?? `HTTP ${res.status}`;
    throw new OllamaError(`Ollama error: ${message}`, res.status === 404 ? 'model' : 'other');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const chunk = safeJson<{ message?: { content?: string }; error?: string }>(line);
      if (!chunk) continue;
      if (chunk.error) throw new OllamaError(`Ollama error: ${chunk.error}`, 'other');
      const piece = chunk.message?.content ?? '';
      if (piece) {
        full += piece;
        opts.onToken(piece);
      }
    }
  }
  return full;
}

function safeJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
