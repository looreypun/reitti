import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ArrowUpRight, RotateCcw, Sparkles, Square, X } from 'lucide-react';
import type { Place } from '../types';
import type { DataIndex } from '../data/DataProvider';
import { buildContext, SYSTEM_PROMPT } from '../lib/ai/context';
import { citedPlaceIds, parseAnswer, type Inline } from '../lib/ai/answer';
import { listChatModels, OLLAMA_URL, OllamaError, pickDefaultModel, streamChat, type ChatMessage } from '../lib/ai/ollama';
import { todayISO } from '../lib/dates';
import { formatEUR } from '../lib/format';

interface Turn {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  /** place ids sent as context for this answer */
  related?: string[];
  error?: string;
  pending?: boolean;
}

const MODEL_KEY = 'reitti:ai-model';
const HISTORY_TURNS = 6;
const SUGGESTIONS = [
  'Free things to do in Helsinki',
  'A rainy day in Tampere, what can we do indoors?',
  'Where can I see the northern lights?',
  'Family weekend in Turku under €20 per person',
];

function readModel(): string | null {
  try {
    return localStorage.getItem(MODEL_KEY);
  } catch {
    return null;
  }
}
function saveModel(model: string) {
  try {
    localStorage.setItem(MODEL_KEY, model);
  } catch {
    /* storage unavailable */
  }
}

type ModelState = { status: 'loading' } | { status: 'ready'; models: string[] } | { status: 'error'; error: OllamaError | Error };

export function AiAssistant({ open, onClose, data }: { open: boolean; onClose: () => void; data: DataIndex | null }) {
  const [modelState, setModelState] = useState<ModelState>({ status: 'loading' });
  const [model, setModel] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  const loadModels = useCallback(() => {
    const ctrl = new AbortController();
    setModelState({ status: 'loading' });
    listChatModels(ctrl.signal)
      .then((models) => {
        setModelState({ status: 'ready', models });
        setModel((current) => (current && models.includes(current) ? current : pickDefaultModel(models, readModel())));
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setModelState({ status: 'error', error: err });
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (open && modelState.status !== 'ready') return loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const isKnownPlace = useCallback((id: string) => !!data?.placesById.has(id), [data]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy || !data || !model) return;
    setInput('');

    const previousQuestions = turns.filter((t) => t.role === 'user').map((t) => t.content);
    const retrieval = buildContext({
      question: text,
      previousQuestions,
      destinations: data.destinations,
      places: data.places,
      tagCatalog: data.dataset.tags_catalog,
      today: todayISO(),
    });

    const history: ChatMessage[] = turns
      .filter((t) => !t.error && !t.pending && t.content)
      .slice(-HISTORY_TURNS)
      .map((t) => ({ role: t.role, content: t.content }));
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: `CONTEXT:\n${retrieval.context}\n\nQUESTION: ${text}` },
    ];

    const userTurn: Turn = { id: nextId.current++, role: 'user', content: text };
    const replyId = nextId.current++;
    setTurns((t) => [...t, userTurn, { id: replyId, role: 'assistant', content: '', pending: true, related: retrieval.places.map((p) => p.id) }]);
    setBusy(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const update = (patch: Partial<Turn> | ((t: Turn) => Partial<Turn>)) =>
      setTurns((all) => all.map((t) => (t.id === replyId ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch) } : t)));
    try {
      await streamChat({
        model,
        messages,
        signal: ctrl.signal,
        onToken: (piece) => update((t) => ({ content: t.content + piece })),
      });
      update({ pending: false });
    } catch (err) {
      const e = err as Error;
      if (e.name === 'AbortError') update((t) => ({ pending: false, content: t.content || '_Stopped._' }));
      else update({ pending: false, error: e.message });
      if (e instanceof OllamaError && e.kind === 'unreachable') setModelState({ status: 'error', error: e });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setTurns([]);
    inputRef.current?.focus();
  };

  const offline = modelState.status === 'error';

  return (
    <>
      <div className={`ai-backdrop ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden />
      <aside className={`ai-panel ${open ? 'is-open' : ''}`} role="dialog" aria-modal="false" aria-label="Ask AI">
        <header className="ai-panel__head">
          <div className="ai-panel__title">
            <span className="ai-panel__badge" aria-hidden>
              <Sparkles size={16} />
            </span>
            <div>
              <h2>Ask AI</h2>
              <p>Answers from our places, run on your own computer</p>
            </div>
          </div>
          <div className="ai-panel__tools">
            {turns.length > 0 && (
              <button type="button" className="icon-btn" onClick={reset} aria-label="New conversation" title="New conversation">
                <RotateCcw size={17} />
              </button>
            )}
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={19} />
            </button>
          </div>
        </header>

        <div className="ai-panel__body" ref={listRef} aria-live="polite">
          {offline ? (
            <OfflineNotice error={modelState.error} onRetry={loadModels} />
          ) : turns.length === 0 ? (
            <div className="ai-empty">
              <p className="ai-empty__lead">Ask in your own words: a city, a budget, the weather, who you’re travelling with.</p>
              <div className="ai-empty__chips">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="ai-suggestion" onClick={() => ask(s)} disabled={!model || !data}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((t) =>
              t.role === 'user' ? (
                <div key={t.id} className="ai-msg ai-msg--user">
                  {t.content}
                </div>
              ) : (
                <AssistantMessage key={t.id} turn={t} data={data} isKnownPlace={isKnownPlace} onNavigate={onClose} />
              ),
            )
          )}
        </div>

        <form
          className="ai-panel__composer"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <textarea
            ref={inputRef}
            className="ai-input"
            rows={1}
            value={input}
            placeholder={offline ? 'Start Ollama to chat' : 'Ask about places in Finland…'}
            disabled={offline || !data}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                ask(input);
              }
            }}
            aria-label="Your question"
          />
          {busy ? (
            <button type="button" className="ai-send" onClick={() => abortRef.current?.abort()} aria-label="Stop answering">
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button type="submit" className="ai-send" disabled={!input.trim() || offline || !model} aria-label="Send">
              <ArrowUp size={18} />
            </button>
          )}
        </form>
        <div className="ai-panel__foot">
          {modelState.status === 'ready' && modelState.models.length > 1 ? (
            <label>
              Model
              <select
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  saveModel(e.target.value);
                }}
              >
                {modelState.models.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
          ) : (
            <span>{model ? `Model: ${model}` : modelState.status === 'loading' ? 'Connecting to Ollama…' : ''}</span>
          )}
          <span>AI can make mistakes. Check details before you go.</span>
        </div>
      </aside>
    </>
  );
}

function AssistantMessage({
  turn,
  data,
  isKnownPlace,
  onNavigate,
}: {
  turn: Turn;
  data: DataIndex | null;
  isKnownPlace: (id: string) => boolean;
  onNavigate: () => void;
}) {
  const blocks = useMemo(() => parseAnswer(turn.content, isKnownPlace), [turn.content, isKnownPlace]);
  const cited = useMemo(() => {
    const candidates = (turn.related ?? []).map((id) => data?.placesById.get(id)).filter((p): p is Place => !!p);
    return citedPlaceIds(turn.content, isKnownPlace, candidates);
  }, [turn.content, turn.related, isKnownPlace, data]);
  const cards = (cited.length ? cited : turn.pending ? [] : (turn.related ?? []).slice(0, 3))
    .map((id) => data?.placesById.get(id))
    .filter(Boolean) as Place[];

  const groups: { list: boolean; items: typeof blocks }[] = [];
  for (const b of blocks) {
    const list = b.type === 'li';
    const last = groups[groups.length - 1];
    if (last && last.list && list) last.items.push(b);
    else groups.push({ list, items: [b] });
  }

  const renderInlines = (inlines: Inline[]) =>
    inlines.map((i, k) => {
      if (i.type === 'bold') return <strong key={k}>{i.text}</strong>;
      if (i.type === 'place') {
        const p = data?.placesById.get(i.id);
        return p ? (
          <Link key={k} to={`/place/${p.id}`} className="ai-ref" onClick={onNavigate} aria-label={`Open ${p.name}`} title={`Open ${p.name}`}>
            View <ArrowUpRight size={12} aria-hidden />
          </Link>
        ) : null;
      }
      return <span key={k}>{i.text}</span>;
    });

  return (
    <div className="ai-msg ai-msg--assistant">
      {turn.pending && !turn.content && (
        <div className="ai-typing" aria-label="Thinking">
          <span />
          <span />
          <span />
        </div>
      )}
      {groups.map((g, k) =>
        g.list ? (
          <ul key={k}>
            {g.items.map((b, j) => (
              <li key={j}>{renderInlines(b.inlines)}</li>
            ))}
          </ul>
        ) : (
          g.items.map((b, j) =>
            b.type === 'h' ? (
              <h3 key={`${k}-${j}`}>{renderInlines(b.inlines)}</h3>
            ) : (
              <p key={`${k}-${j}`}>{renderInlines(b.inlines)}</p>
            ),
          )
        ),
      )}
      {turn.error && <p className="ai-error">{turn.error}</p>}
      {cards.length > 0 && (
        <div className="ai-cards">
          <span className="ai-cards__label">{cited.length ? 'Places mentioned' : 'Related places'}</span>
          {cards.map((p) => (
            <Link key={p.id} to={`/place/${p.id}`} className="ai-card" onClick={onNavigate}>
              {p.image_thumb_url ? <img src={p.image_thumb_url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="ai-card__ph" aria-hidden />}
              <span className="ai-card__text">
                <strong>{p.name}</strong>
                <span>
                  {p.city} · {formatEUR(p.estimated_cost_eur)}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function OfflineNotice({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const kind = error instanceof OllamaError ? error.kind : 'other';
  return (
    <div className="ai-offline">
      <h3>{kind === 'no-models' ? 'No chat model installed' : 'AI is offline'}</h3>
      <p>{error.message}</p>
      {kind === 'no-models' ? (
        <p>
          Install one, then try again: <code>ollama pull granite4.2:3b</code>
        </p>
      ) : (
        <p>
          Start Ollama on this computer (open the Ollama app, or run <code>ollama serve</code>). It should be listening at{' '}
          <code>{OLLAMA_URL}</code>.
        </p>
      )}
      <button type="button" className="btn btn--ghost" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
