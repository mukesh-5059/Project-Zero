/**
 * Phase 9 — Frontend AI Chat Service Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendChatMessage } from '../aiChatService';
import type { ChatMessage } from '@project-zero/ai-gateway';

describe('Phase 9 — Frontend AI Chat Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. sends messages to /api/ai/chat and returns assistant reply', async () => {
    const mockResponse = {
      id: 'nemotron-123',
      model: 'nvidia/nemotron-3-ultra-550b-a55b',
      message: {
        role: 'assistant',
        content: 'A Deterministic Finite Automaton (DFA) recognizes regular languages.',
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as unknown as typeof fetch;

    const messages: ChatMessage[] = [
      { role: 'user', content: 'What language does DFA recognize?' },
    ];

    const res = await sendChatMessage(messages);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/ai/chat',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })
    );
    expect(res.message.role).toBe('assistant');
    expect(res.message.content).toBe('A Deterministic Finite Automaton (DFA) recognizes regular languages.');
  });

  it('2. throws clean error message when gateway returns structured error response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: {
          message: 'NVIDIA_API_KEY is not configured on the gateway server.',
          type: 'config_error',
        },
      }),
    }) as unknown as typeof fetch;

    const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }];

    await expect(sendChatMessage(messages)).rejects.toThrow(
      'NVIDIA_API_KEY is not configured on the gateway server.'
    );
  });

  it('3. bounds conversation history to <= 4000 characters while preserving current user query', async () => {
    let capturedBody: { messages: ChatMessage[] } | null = null;
    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        json: async () => ({
          message: { role: 'assistant', content: 'Reply to short user message' },
        }),
      };
    }) as unknown as typeof fetch;

    const longHistory: ChatMessage[] = [
      { role: 'user', content: 'What is DFA?' },
      { role: 'assistant', content: 'A'.repeat(5000) }, // Long previous assistant message
      { role: 'user', content: 'Construct a 5-state DFA' },
    ];

    await sendChatMessage(longHistory);

    expect(capturedBody).not.toBeNull();
    const sentMessages = capturedBody!.messages;
    expect(sentMessages[1].content.length).toBeLessThanOrEqual(4000);
    expect(sentMessages[1].content).toContain('[History truncated for context]');
    expect(sentMessages[2].content).toBe('Construct a 5-state DFA');
  });
});
