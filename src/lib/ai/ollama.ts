/** Ollama client. Configure with VITE_OLLAMA_URL and VITE_OLLAMA_MODEL. */
export const OLLAMA_URL = ((import.meta.env.VITE_OLLAMA_URL as string | undefined) || 'http://localhost:11434').replace(/\/$/, '');
const PREFERRED_MODEL = (import.meta.env.VITE_OLLAMA_MODEL as string | undefined) || undefined;

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

export function pickDefaultModel(models: string[], remembered: string | null): string {
  for (const candidate of [remembered, PREFERRED_MODEL]) {
    if (candidate && models.includes(candidate)) return candidate;
  }
  return models.find((m) => /granite|llama|qwen|mistral|gemma|phi/i.test(m)) ?? models[0];
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
