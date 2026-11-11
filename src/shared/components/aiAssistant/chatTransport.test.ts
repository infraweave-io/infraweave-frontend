import { describe, expect, it, vi } from 'vitest';
import { parseSseFrames, streamChat, type ChatEvent } from './chatTransport';

/** Builds a fetch-like Response whose body streams the given string chunks. */
const streamedResponse = (
  chunks: string[],
  init: { ok: boolean; status?: number } = { ok: true },
) => {
  const encoder = new TextEncoder();
  let index = 0;
  const body = {
    getReader: () => ({
      read: async () => {
        if (index >= chunks.length) return { value: undefined, done: true };
        const value = encoder.encode(chunks[index]);
        index += 1;
        return { value, done: false };
      },
    }),
  };
  return {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 500),
    body: init.ok ? body : null,
  } as unknown as Response;
};

describe('parseSseFrames', () => {
  it('parses complete frames and holds back a partial tail', () => {
    const first = parseSseFrames('data: {"type":"text","text":"hel"}\n\ndata: {"type":"te', '');
    expect(first.events).toEqual([{ type: 'text', text: 'hel' }]);
    expect(first.pending).toBe('data: {"type":"te');

    const second = parseSseFrames('xt","text":"lo"}\n\n', first.pending);
    expect(second.events).toEqual([{ type: 'text', text: 'lo' }]);
    expect(second.pending).toBe('');
  });

  it('reads tool_call fields the backend actually sends', () => {
    const { events } = parseSseFrames(
      'data: {"type":"tool_call","id":"call-1","name":"list_projects","input":{"track":"dev"}}\n\n',
      '',
    );
    expect(events[0]).toEqual({
      type: 'tool_call',
      id: 'call-1',
      name: 'list_projects',
      input: { track: 'dev' },
    });
  });

  it('reads tool_result output_preview rather than falling through to the raw frame', () => {
    const { events } = parseSseFrames(
      'data: {"type":"tool_result","id":"call-1","name":"list_projects","output_preview":"2 projects","is_error":false}\n\n',
      '',
    );
    expect(events[0]).toMatchObject({
      type: 'tool_result',
      id: 'call-1',
      output_preview: '2 projects',
      is_error: false,
    });
  });

  it('surfaces history_append messages opaquely', () => {
    const { events } = parseSseFrames(
      'data: {"type":"history_append","message":{"role":"assistant","content":[{"type":"text","text":"hi"}]}}\n\n',
      '',
    );
    const event = events[0] as Extract<ChatEvent, { type: 'history_append' }>;
    expect(event.message.role).toBe('assistant');
    expect(event.message.content).toHaveLength(1);
  });

  it('ignores malformed json rather than throwing mid-stream', () => {
    const { events } = parseSseFrames('data: {not json}\n\ndata: {"type":"done"}\n\n', '');
    expect(events).toEqual([{ type: 'done' }]);
  });
});

describe('streamChat', () => {
  const body = { message: 'hi', history: [] };
  const controller = new AbortController();

  it('throws when the response is not ok', async () => {
    const fetchFn = vi.fn().mockResolvedValue(streamedResponse([], { ok: false, status: 503 }));

    const gen = streamChat(fetchFn, '/chat', body, controller.signal);
    await expect(gen.next()).rejects.toThrow('Chat request failed with 503');
  });

  it('throws when the response has no body', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, body: null } as Response);

    const gen = streamChat(fetchFn, '/chat', body, controller.signal);
    await expect(gen.next()).rejects.toThrow('Chat response had no body');
  });

  it('yields events in order across multiple chunks, including a tail split mid-frame', async () => {
    // The second chunk ends mid-frame (no trailing blank line), so the final
    // event only completes once the reader signals done and the tail is
    // flushed through decoder.decode() with no further input.
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        streamedResponse([
          'data: {"type":"text","text":"a"}\n\n',
          'data: {"type":"text","text":"b"}\n\ndata: {"type":"do',
          'ne"}\n\n',
        ]),
      );

    const events: ChatEvent[] = [];
    for await (const event of streamChat(fetchFn, '/chat', body, controller.signal)) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'text', text: 'a' },
      { type: 'text', text: 'b' },
      { type: 'done' },
    ]);
  });

  it('passes the abort signal through to fetch', async () => {
    const fetchFn = vi.fn().mockResolvedValue(streamedResponse(['data: {"type":"done"}\n\n']));

    const events: ChatEvent[] = [];
    for await (const event of streamChat(fetchFn, '/chat', body, controller.signal)) {
      events.push(event);
    }

    expect(fetchFn).toHaveBeenCalledWith(
      '/chat',
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
