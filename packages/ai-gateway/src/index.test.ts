/**
 * Phase 9, 10 & 11 — Real NVIDIA Nemotron AI Gateway, Context Engine & AI Tutor Unit Tests
 *
 * Verifies:
 * 1. Security: Model pinning strictly enforces nvidia/nemotron-3-ultra-550b-a55b.
 * 2. Security: Missing API key produces structured error.
 * 3. Validation: Rejects malformed requests, empty messages, invalid roles, and oversized payloads.
 * 4. Context Engine: Validates and bounds AIContextSnapshot (states, transitions, diagnostics).
 * 5. Educational Evidence: Serializes deterministic evidence (diagnostics, minimization equivalence, execution proofs).
 * 6. Tutor Intent Modes: Supports EXPLAIN, WHY, STEP_BY_STEP, CONCEPT, and DEBUG.
 * 7. Provider: Injects Tutor system instructions and grounded evidence upstream.
 * 8. Gateway: Converts upstream responses into structured ChatResponse and errors into GatewayErrorResponse.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  NvidiaProvider,
  validateChatRequest,
  validateContextSnapshot,
  RequestValidationError,
  handleChatRequest,
  serializeContextForPrompt,
  REQUIRED_NVIDIA_MODEL,
  AIContextSnapshot,
  extractActionProposal,
  ChatResponse,
  GatewayErrorResponse,
  ChatMessage,
} from './index';

describe('Phase 9, 10 & 11 — NVIDIA Nemotron AI Gateway & AI Tutor', () => {
  describe('Model Pinning & Configuration', () => {
    it('1. pins required model exactly to nvidia/nemotron-3-ultra-550b-a55b', () => {
      expect(REQUIRED_NVIDIA_MODEL).toBe('nvidia/nemotron-3-ultra-550b-a55b');
    });

    it('2. throws error if provider initialized with unauthorized model', () => {
      expect(() => {
        new NvidiaProvider({
          apiKey: 'test-key',
          model: 'openai/gpt-4',
        });
      }).toThrow('is not authorized or enabled in Project Zero model registry');
    });

    it('3. rejects request when API key is missing', async () => {
      const provider = new NvidiaProvider({
        apiKey: '',
      });

      await expect(
        provider.chat({
          messages: [{ role: 'user', content: 'What is a DFA?' }],
        })
      ).rejects.toThrow('NVIDIA_API_KEY is not configured');
    });
  });

  describe('Request & Context Validation', () => {
    it('4. rejects non-object or null request', () => {
      expect(() => validateChatRequest(null)).toThrow(RequestValidationError);
      expect(() => validateChatRequest('invalid')).toThrow(RequestValidationError);
    });

    it('5. rejects empty messages array', () => {
      expect(() => validateChatRequest({ messages: [] })).toThrow('Field "messages" must contain at least one message');
    });

    it('6. rejects invalid message roles', () => {
      expect(() =>
        validateChatRequest({
          messages: [{ role: 'hacker' as unknown as ChatMessage['role'], content: 'Hello' }],
        })
      ).toThrow('Invalid role "hacker"');
    });

    it('7. rejects empty or blank message content', () => {
      expect(() =>
        validateChatRequest({
          messages: [{ role: 'user', content: '   ' }],
        })
      ).toThrow('cannot be empty');
    });

    it('8. accepts valid multi-turn conversations', () => {
      expect(() =>
        validateChatRequest({
          messages: [
            { role: 'user', content: 'Explain DFA.' },
            { role: 'assistant', content: 'A DFA is a 5-tuple...' },
            { role: 'user', content: 'What about NFA?' },
          ],
        })
      ).not.toThrow();
    });

    it('9. validates valid AIContextSnapshot structure', () => {
      const validCtx: AIContextSnapshot = {
        version: '1.0.0',
        workspace: { activeMachineType: 'DFA' },
        selection: { selectedNodeLabels: ['q0'], selectedEdgeDescriptions: [] },
        machine: {
          type: 'DFA',
          stateCount: 2,
          states: ['q0', 'q1'],
          initialState: 'q0',
          acceptingStates: ['q1'],
          alphabet: ['a', 'b'],
          transitionCount: 2,
          transitions: [
            { from: 'q0', symbol: 'a', to: 'q1' },
            { from: 'q1', symbol: 'b', to: 'q0' },
          ],
        },
      };

      expect(() => validateContextSnapshot(validCtx)).not.toThrow();
    });

    it('10. rejects invalid context snapshot (wrong version or missing machine)', () => {
      expect(() => validateContextSnapshot({ version: '2.0.0' })).toThrow('Context version must be "1.0.0"');
      expect(() => validateContextSnapshot({ version: '1.0.0', workspace: {} })).toThrow('Context must have a valid machine object');
    });
  });

  describe('Tutor Evidence Serialization & Intent Modes', () => {
    it('11. deterministically serializes context with deterministic educational evidence', () => {
      const sampleCtx: AIContextSnapshot = {
        version: '1.0.0',
        workspace: {
          activeMachineType: 'DFA',
          activeBottomTab: 'minimization',
          activeInspectorTab: 'inspect',
        },
        tutorIntent: 'STEP_BY_STEP',
        selection: {
          selectedNodeLabels: ['q1'],
          selectedEdgeDescriptions: ['q0 →(0)→ q1'],
        },
        machine: {
          type: 'DFA',
          stateCount: 3,
          states: ['q0', 'q1', 'q2'],
          initialState: 'q0',
          acceptingStates: ['q2'],
          alphabet: ['0', '1'],
          transitionCount: 2,
          transitions: [
            { from: 'q0', symbol: '0', to: 'q1' },
            { from: 'q1', symbol: '1', to: 'q2' },
          ],
        },
        evidence: {
          validityStatus: 'VALID',
          diagnostics: [],
          minimization: {
            isAlreadyMinimal: false,
            equivalenceClasses: [['q0'], ['q1', 'q2']],
            mergedStateCount: 1,
          },
        },
      };

      const serialized = serializeContextForPrompt(sampleCtx);
      expect(serialized).toContain('### [Project Zero Workspace Context]');
      expect(serialized).toContain('Active Machine Type: DFA');
      expect(serialized).toContain('Educational Mode Intent: STEP_BY_STEP');
      expect(serialized).toContain('Selected States (Focus): [q1]');
      expect(serialized).toContain('### [Deterministic Educational Evidence]');
      expect(serialized).toContain('Verified Validity Status: VALID');
      expect(serialized).toContain('isAlreadyMinimal=false');
      expect(serialized).toContain('Equivalence Classes: [q0], [q1,q2]');
      expect(serialized).not.toContain('NVIDIA_API_KEY');
    });
  });

  describe('NVIDIA Provider Inference with AI Tutor System Instruction', () => {
    it('12. constructs valid upstream request injecting Tutor instructions & evidence', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'test-id-123',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'States q1 and q2 are equivalent because they transition to indistinguishable states under alphabet {0, 1}.',
              },
            },
          ],
          usage: { prompt_tokens: 60, completion_tokens: 25, total_tokens: 85 },
        }),
      });

      const provider = new NvidiaProvider({
        apiKey: 'nvapi-mock-token',
        model: REQUIRED_NVIDIA_MODEL,
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Why are q1 and q2 merged in minimization?' }],
        context: {
          version: '1.0.0',
          workspace: { activeMachineType: 'DFA' },
          tutorIntent: 'WHY',
          selection: { selectedNodeLabels: ['q1', 'q2'], selectedEdgeDescriptions: [] },
          machine: {
            type: 'DFA',
            stateCount: 3,
            states: ['q0', 'q1', 'q2'],
            initialState: 'q0',
            acceptingStates: ['q2'],
            alphabet: ['0', '1'],
            transitionCount: 2,
            transitions: [
              { from: 'q0', symbol: '0', to: 'q1' },
              { from: 'q1', symbol: '1', to: 'q2' },
            ],
          },
          evidence: {
            minimization: {
              equivalenceClasses: [['q0'], ['q1', 'q2']],
            },
          },
        },
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.model).toBe(REQUIRED_NVIDIA_MODEL);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toContain('You are the authoritative AI Assistant and Tutor for Project Zero');
      expect(body.messages[0].content).toContain('Equivalence Classes: [q0], [q1,q2]');
      expect(body.messages[1].role).toBe('user');
      expect(body.messages[1].content).toBe('Why are q1 and q2 merged in minimization?');


      expect(result.message.content).toContain('States q1 and q2 are equivalent');
    });

    it('13. safely handles upstream HTTP error codes', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      });

      const provider = new NvidiaProvider({
        apiKey: 'nvapi-mock-token',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(
        provider.chat({
          messages: [{ role: 'user', content: 'Hello' }],
        })
      ).rejects.toThrow('NVIDIA rate limit reached');
    });
  });

  describe('Gateway Router Handler', () => {
    it('14. returns 400 for validation errors', async () => {
      const response = await handleChatRequest({ messages: [] });
      expect(response.status).toBe(400);
      expect((response.body as GatewayErrorResponse).error.type).toBe('validation_error');
    });

    it('15. returns 500 for missing API key configuration', async () => {
      const response = await handleChatRequest(
        { messages: [{ role: 'user', content: 'Hi' }] },
        { providerConfig: { apiKey: '' } }
      );
      expect(response.status).toBe(500);
      expect((response.body as GatewayErrorResponse).error.type).toBe('config_error');
    });

    it('16. returns 200 with chat response on success', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { role: 'assistant', content: 'Hello from Nemotron AI Tutor!' } }],
        }),
      });

      const response = await handleChatRequest(
        { messages: [{ role: 'user', content: 'Hi' }] },
        { providerConfig: { apiKey: 'nvapi-mock-token', fetchFn: mockFetch as unknown as typeof fetch } }
      );

      expect(response.status).toBe(200);
      expect((response.body as ChatResponse).message.content).toBe('Hello from Nemotron AI Tutor!');
    });
  });

  describe('Phase 13 Structured Action Protocol & Validation', () => {
    it('17. parses and extracts valid JSON action block from AI response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: `I will create state q2 for you.\n\n\`\`\`json:project-zero-actions\n{\n  "version": "1.0.0",\n  "summary": "Create state q2",\n  "actions": [\n    {\n      "id": "act_1",\n      "type": "CREATE_STATE",\n      "parameters": { "label": "q2", "isAccepting": true }\n    }\n  ]\n}\n\`\`\``,
              },
            },
          ],
        }),
      });

      const provider = new NvidiaProvider({
        apiKey: 'nvapi-mock-token',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const res = await provider.chat({
        messages: [{ role: 'user', content: 'Add state q2' }],
      });

      expect(res.message.content).toBe('I will create state q2 for you.');
      expect(res.actionProposal).toBeDefined();
      expect(res.actionProposal?.actions.length).toBe(1);
      expect(res.actionProposal?.actions[0].type).toBe('CREATE_STATE');
      expect(res.actionProposal?.actions[0].parameters.label).toBe('q2');
    });

    it('18. rejects malformed or bounded action envelopes safely without crashing', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: `Here is invalid json:\n\`\`\`json:project-zero-actions\n{ "version": "2.0.0" }\n\`\`\``,
              },
            },
          ],
        }),
      });

      const provider = new NvidiaProvider({
        apiKey: 'nvapi-mock-token',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const res = await provider.chat({
        messages: [{ role: 'user', content: 'Bad actions' }],
      });

      // Malformed actions fall back gracefully to regular text response
      expect(res.message.content).toContain('Here is invalid json');
      expect(res.actionProposal).toBeUndefined();
    });

    it('19. extracts multi-action automaton construction proposal from complex response', () => {
      const responseText = `Here is the constructed DFA:

\`\`\`json:project-zero-actions
{
  "version": "1.0.0",
  "summary": "Construct DFA for {0,1} ending in 01",
  "actions": [
    { "id": "a1", "type": "CREATE_STATE", "parameters": { "label": "q0", "isInitial": true } },
    { "id": "a2", "type": "CREATE_STATE", "parameters": { "label": "q1" } },
    { "id": "a3", "type": "CREATE_STATE", "parameters": { "label": "q2", "isAccepting": true } },
    { "id": "a4", "type": "CREATE_TRANSITION", "parameters": { "from": "q0", "to": "q1", "symbol": "0" } },
    { "id": "a5", "type": "CREATE_TRANSITION", "parameters": { "from": "q0", "to": "q0", "symbol": "1" } },
    { "id": "a6", "type": "CREATE_TRANSITION", "parameters": { "from": "q1", "to": "q1", "symbol": "0" } },
    { "id": "a7", "type": "CREATE_TRANSITION", "parameters": { "from": "q1", "to": "q2", "symbol": "1" } },
    { "id": "a8", "type": "CREATE_TRANSITION", "parameters": { "from": "q2", "to": "q1", "symbol": "0" } },
    { "id": "a9", "type": "CREATE_TRANSITION", "parameters": { "from": "q2", "to": "q0", "symbol": "1" } }
  ]
}
\`\`\``;

      const res = extractActionProposal(responseText);
      expect(res.actionProposal).toBeDefined();
      expect(res.actionProposal?.actions.length).toBe(9);
      expect(res.cleanedText).toBe('Here is the constructed DFA:');
    });

    it('20. recovers unclosed action envelopes when response is cut off', () => {
      const truncatedText = `Here is the DFA:
\`\`\`json:project-zero-actions
{
  "version": "1.0.0",
  "summary": "Partial DFA",
  "actions": [
    { "id": "a1", "type": "CREATE_STATE", "parameters": { "label": "q0" } },
    { "id": "a2", "type": "CREATE_STATE", "parameters": { "label": "q1" } }
`;

      const res = extractActionProposal(truncatedText);
      expect(res.actionProposal).toBeDefined();
      expect(res.actionProposal?.actions.length).toBe(2);
    });
  });

  describe('Bounded Message & Context Safety Invariants', () => {
    it('21. guarantees every outbound message to NVIDIA is <= 4000 characters (Invariant H)', async () => {
      let interceptedMessages: { role: string; content: string }[] = [];
      const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string);
        interceptedMessages = body.messages;
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { role: 'assistant', content: 'Inference response' } }],
          }),
        };
      });

      const provider = new NvidiaProvider({
        apiKey: 'nvapi-mock-token',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      // Send with large context and long messages
      await provider.chat({
        messages: [
          { role: 'user', content: 'What is a DFA?' },
          { role: 'assistant', content: 'A'.repeat(4500) }, // Prior long assistant reply in history
          { role: 'user', content: 'Explain it further.' },
        ],
        context: {
          version: '1.0.0',
          workspace: { activeMachineType: 'DFA' },
          machine: {
            type: 'DFA',
            stateCount: 30,
            states: Array.from({ length: 30 }, (_, i) => `q${i}`),
            initialState: 'q0',
            acceptingStates: ['q29'],
            alphabet: ['0', '1'],
            transitionCount: 60,
            transitions: Array.from({ length: 60 }, (_, i) => ({
              from: `q${i % 30}`,
              symbol: i % 2 === 0 ? '0' : '1',
              to: `q${(i + 1) % 30}`,
            })),
          },
        },
      });

      expect(interceptedMessages.length).toBeGreaterThan(0);
      const allBounded = interceptedMessages.every((m) => m.content.length <= 4000);
      expect(allBounded).toBe(true);
    });

    it('22. handles long conversation history without index 5 exceeding length error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { role: 'assistant', content: 'Response to turn 7' } }],
        }),
      });

      // Simulate a 7-turn conversation where history turn 5 had length > 4000
      const historyWithLongTurn5: ChatMessage[] = [
        { role: 'user', content: 'What is a DFA?' },
        { role: 'assistant', content: 'A DFA is a deterministic finite automaton...' },
        { role: 'user', content: 'Explain the pumping lemma simply.' },
        { role: 'assistant', content: 'The pumping lemma states that...' },
        { role: 'user', content: 'Give me an example.' },
        { role: 'assistant', content: 'Here is a detailed proof and explanation: ' + 'X'.repeat(4200) }, // Index 5 > 4000 chars!
        {
          role: 'user',
          content:
            'Construct a 5-state DFA over {0,1} that accepts strings ending in 101 or 010. Use states q0 through q4, q0 as initial, and appropriate accepting states. Add all transitions required and explain how the DFA remembers the necessary suffix.',
        },
      ];

      const res = await handleChatRequest(
        { messages: historyWithLongTurn5 },
        { providerConfig: { apiKey: 'test-nvapi', fetchFn: mockFetch as unknown as typeof fetch } }
      );

      expect(res.status).toBe(200);
      expect((res.body as ChatResponse).message.content).toBe('Response to turn 7');
    });

    it('23. handles the exact 5-state DFA construction request with existing graph context', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content:
                  'Here is the 5-state DFA accepting strings ending in 101 or 010:\n\n```json:project-zero-actions\n{\n  "version": "1.0.0",\n  "summary": "Construct 5-state DFA for strings ending in 101 or 010",\n  "actions": [\n    { "id": "a1", "type": "CREATE_STATE", "parameters": { "label": "q0", "isInitial": true } },\n    { "id": "a2", "type": "CREATE_STATE", "parameters": { "label": "q1" } },\n    { "id": "a3", "type": "CREATE_STATE", "parameters": { "label": "q2" } },\n    { "id": "a4", "type": "CREATE_STATE", "parameters": { "label": "q3", "isAccepting": true } },\n    { "id": "a5", "type": "CREATE_STATE", "parameters": { "label": "q4", "isAccepting": true } },\n    { "id": "a6", "type": "CREATE_TRANSITION", "parameters": { "from": "q0", "to": "q1", "symbol": "0" } },\n    { "id": "a7", "type": "CREATE_TRANSITION", "parameters": { "from": "q0", "to": "q2", "symbol": "1" } }\n  ]\n}\n```',
              },
            },
          ],
        }),
      });

      const res = await handleChatRequest(
        {
          messages: [
            {
              role: 'user',
              content:
                'Construct a 5-state DFA over {0,1} that accepts strings ending in 101 or 010. Use states q0 through q4, q0 as initial, and appropriate accepting states. Add all transitions required and explain how the DFA remembers the necessary suffix.',
            },
          ],
          context: {
            version: '1.0.0',
            workspace: { activeMachineType: 'DFA' },
            selection: { selectedNodeLabels: [], selectedEdgeDescriptions: [] },
            machine: {
              type: 'DFA',
              stateCount: 0,
              states: [],
              initialState: null,
              acceptingStates: [],
              alphabet: ['0', '1'],
              transitionCount: 0,
              transitions: [],
            },
          },
        },
        { providerConfig: { apiKey: 'test-nvapi', fetchFn: mockFetch as unknown as typeof fetch } }
      );

      expect(res.status).toBe(200);
      const body = res.body as ChatResponse;
      expect(body.actionProposal).toBeDefined();
      expect(body.actionProposal?.actions.length).toBe(7);
      expect(body.routingInfo?.taskCategory).toBe('AUTOMATON_CONSTRUCTION');
    });
  });
});
