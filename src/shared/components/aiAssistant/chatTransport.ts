/**
 * Transport for the InfraWeave chat SSE stream.
 *
 * Split out of AiAssistantOverlay so the wire format is testable without
 * rendering. `LlmMessage` is deliberately opaque: the backend owns the
 * transcript and the client only stores and replays it.
 */

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: unknown[];
}

export type ChatEvent =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; name: string; output_preview: string; is_error: boolean }
  | { type: 'history_append'; message: LlmMessage }
  | {
      type: 'usage';
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens: number;
      cache_write_input_tokens: number;
    }
  | { type: 'truncated'; reason: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

const KNOWN_TYPES = new Set([
  'text',
  'reasoning',
  'tool_call',
  'tool_result',
  'history_append',
  'usage',
  'truncated',
  'error',
  'done',
]);

export const parseSseFrames = (
  chunk: string,
  pending: string,
): { events: ChatEvent[]; pending: string } => {
  const text = pending + chunk;
  const blocks = text.split(/\r?\n\r?\n/);
  const nextPending = blocks.pop() ?? '';
  const events: ChatEvent[] = [];

  for (const block of blocks) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');

    if (!data) continue;

    try {
      const parsed = JSON.parse(data);
      // A frame whose type we don't know is forward compatibility, not an error.
      if (parsed && typeof parsed.type === 'string' && KNOWN_TYPES.has(parsed.type)) {
        events.push(parsed as ChatEvent);
      }
    } catch {
      // A malformed frame must not abort the rest of the stream.
    }
  }

  return { events, pending: nextPending };
};

export interface ChatRequestBody {
  message: string;
  history: LlmMessage[];
  page_context?: string;
  project?: string;
  region?: string;
  environment?: string;
  track?: string;
}

/**
 * POSTs to /chat and yields events as they arrive.
 */
export async function* streamChat(
  fetchFn: typeof fetch,
  url: string,
  body: ChatRequestBody,
  signal: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const response = await fetchFn(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Chat request failed with ${response.status}`);
  }
  if (!response.body) {
    throw new Error('Chat response had no body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const parsed = parseSseFrames(decoder.decode(value, { stream: true }), pending);
    pending = parsed.pending;
    for (const event of parsed.events) yield event;
  }

  const tail = parseSseFrames(decoder.decode(), pending);
  for (const event of tail.events) yield event;
}
