import { describe, it, expect, vi } from 'vitest';
import {
  selectModel,
  handleChatRequest,
  NvidiaProvider,
  isModelAllowed,
  REGISTERED_MODELS,
  ChatRequest,
  ChatResponse,
  GatewayErrorResponse,
} from './index';

describe('Phase 14A — Intelligent Server-Side NVIDIA Model Router', () => {
  // --------------------------------------------------------------------------
  // TEST 1: Simple Explanation
  // --------------------------------------------------------------------------
  it('TEST 1: routes simple explanation query ("What is a DFA?") to fast capable model', () => {
    const req: ChatRequest = {
      messages: [{ role: 'user', content: 'What is a DFA?' }],
    };

    const decision = selectModel(req);
    expect(decision.selectedModel).toBe('nvidia/nemotron-3-super-120b-a12b');
    expect(decision.taskProfile.category).toBe('SIMPLE_EXPLANATION');
    expect(decision.taskProfile.reasoningComplexity).toBe('LOW');
    expect(decision.taskProfile.requiresStructuredActions).toBe(false);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Educational Reasoning
  // --------------------------------------------------------------------------
  it('TEST 2: routes educational reasoning query ("Explain the pumping lemma with an example") to fast capable reasoning model', () => {
    const req: ChatRequest = {
      messages: [{ role: 'user', content: 'Explain the pumping lemma with an example.' }],
      context: {
        version: '1.0.0',
        workspace: { activeMachineType: 'DFA' },
        tutorIntent: 'WHY',
        selection: { selectedNodeLabels: [], selectedEdgeDescriptions: [] },
        machine: {
          type: 'DFA',
          stateCount: 2,
          states: ['q0', 'q1'],
          initialState: 'q0',
          acceptingStates: ['q1'],
          alphabet: ['0', '1'],
          transitionCount: 2,
          transitions: [
            { from: 'q0', symbol: '0', to: 'q1' },
            { from: 'q1', symbol: '1', to: 'q0' },
          ],
        },
      },
    };

    const decision = selectModel(req);
    expect(decision.selectedModel).toBe('nvidia/nemotron-3-super-120b-a12b');
    expect(decision.taskProfile.category).toBe('EDUCATIONAL_REASONING');
    expect(decision.taskProfile.reasoningComplexity).toBe('MEDIUM');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Automaton Construction
  // --------------------------------------------------------------------------
  it('TEST 3: routes automaton construction query ("Create a DFA that accepts binary strings ending in 01") to structured-action capable model', () => {
    const req: ChatRequest = {
      messages: [{ role: 'user', content: 'Create a DFA that accepts binary strings ending in 01.' }],
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
    };

    const decision = selectModel(req);
    expect(decision.selectedModel).toBe('nvidia/nemotron-3-super-120b-a12b');
    expect(decision.taskProfile.category).toBe('AUTOMATON_CONSTRUCTION');
    expect(decision.taskProfile.requiresStructuredActions).toBe(true);
    expect(decision.taskProfile.requiresGraphConstruction).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST 4: Graph Editing
  // --------------------------------------------------------------------------
  it('TEST 4: routes graph editing query ("Modify the transition from q0 to q1") to action + editing capable model', () => {
    const req: ChatRequest = {
      messages: [{ role: 'user', content: 'Modify the transition from q0 to q1 so it uses symbol b.' }],
      context: {
        version: '1.0.0',
        workspace: { activeMachineType: 'DFA' },
        selection: { selectedNodeLabels: ['q0'], selectedEdgeDescriptions: ['q0 →(a)→ q1'] },
        machine: {
          type: 'DFA',
          stateCount: 2,
          states: ['q0', 'q1'],
          initialState: 'q0',
          acceptingStates: ['q1'],
          alphabet: ['a', 'b'],
          transitionCount: 1,
          transitions: [{ from: 'q0', symbol: 'a', to: 'q1' }],
        },
      },
    };

    const decision = selectModel(req);
    expect(decision.selectedModel).toBe('nvidia/nemotron-3-super-120b-a12b');
    expect(decision.taskProfile.category).toBe('GRAPH_EDITING');
    expect(decision.taskProfile.requiresStructuredActions).toBe(true);
    expect(decision.taskProfile.requiresGraphEditing).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST 5: Complex Formal Reasoning (Ultra Escalation)
  // --------------------------------------------------------------------------
  it('TEST 5: escalates complex formal reduction/proof task to Nemotron-3 Ultra 550B', () => {
    const req: ChatRequest = {
      messages: [
        {
          role: 'user',
          content:
            "Construct a reduction proof from the Halting Problem to prove Rice's theorem for undecidable language properties with full formal verification of the reduction function.",
        },
      ],
      context: {
        version: '1.0.0',
        workspace: { activeMachineType: 'TM' },
        selection: { selectedNodeLabels: [], selectedEdgeDescriptions: [] },
        machine: {
          type: 'TM',
          stateCount: 4,
          states: ['q0', 'q1', 'q_accept', 'q_reject'],
          initialState: 'q0',
          acceptingStates: ['q_accept'],
          alphabet: ['0', '1'],
          transitionCount: 3,
          transitions: [],
        },
      },
    };

    const decision = selectModel(req);
    expect(decision.selectedModel).toBe('nvidia/nemotron-3-ultra-550b-a55b');
    expect(decision.taskProfile.category).toBe('COMPLEX_FORMAL_REASONING');
    expect(decision.taskProfile.reasoningComplexity).toBe('HIGH');
    expect(decision.taskProfile.isComplexProofOrVerification).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST 6: Client Model Override Is Ignored
  // --------------------------------------------------------------------------
  it('TEST 6: ignores arbitrary client-supplied model and enforces deterministic server selection', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'msg-1',
        choices: [{ message: { role: 'assistant', content: 'A DFA is a 5-tuple.' } }],
      }),
    });

    const maliciousClientPayload = {
      messages: [{ role: 'user', content: 'What is a DFA?' }],
      model: 'unauthorized/hacked-model-999b', // Client tries to supply arbitrary model
    };

    const response = await handleChatRequest(maliciousClientPayload, {
      providerConfig: {
        apiKey: 'test-nvapi-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      },
    });

    expect(response.status).toBe(200);
    const body = response.body as ChatResponse;
    // Verified: the router chose Super 120b, NOT the malicious client model
    expect(body.model).toBe('nvidia/nemotron-3-super-120b-a12b');
    expect(body.routingInfo?.selectedModel).toBe('nvidia/nemotron-3-super-120b-a12b');
  });

  // --------------------------------------------------------------------------
  // TEST 7: Disabled Model Is Never Selected Or Instantiated
  // --------------------------------------------------------------------------
  it('TEST 7: rejects instantiation of unauthorized/disabled models and never routes to them', () => {
    // 1. Verify unknown model rejection in provider
    expect(() => {
      new NvidiaProvider({
        apiKey: 'test-key',
        model: 'unknown/random-model',
      });
    }).toThrow('is not authorized or enabled in Project Zero model registry');

    // 2. Verify disabled model check
    const originalState = REGISTERED_MODELS['google/gemma-4-31b-it'].enabled;
    try {
      REGISTERED_MODELS['google/gemma-4-31b-it'].enabled = false;
      expect(isModelAllowed('google/gemma-4-31b-it')).toBe(false);

      expect(() => {
        new NvidiaProvider({
          apiKey: 'test-key',
          model: 'google/gemma-4-31b-it',
        });
      }).toThrow('is not authorized or enabled in Project Zero model registry');
    } finally {
      REGISTERED_MODELS['google/gemma-4-31b-it'].enabled = originalState;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: Primary Model Failure Triggers Exactly One Fallback
  // --------------------------------------------------------------------------
  it('TEST 8: performs exactly ONE capability-aware fallback when primary model fails with upstream error', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (_url: string, opts?: RequestInit) => {
      callCount++;
      const body = JSON.parse(opts?.body as string);

      if (callCount === 1) {
        // Primary attempt (Super 120b) fails with 503 upstream error
        expect(body.model).toBe('nvidia/nemotron-3-super-120b-a12b');
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: { message: 'Service Temporarily Unavailable' } }),
        };
      }

      if (callCount === 2) {
        // Fallback attempt succeeds
        expect(body.model).toBeDefined();
        return {
          ok: true,
          json: async () => ({
            id: 'fallback-response-1',
            choices: [{ message: { role: 'assistant', content: 'Fallback response: A DFA recognizes regular languages.' } }],
          }),
        };
      }

      throw new Error('Should not make more than 2 calls (1 primary + 1 fallback)');
    });

    const response = await handleChatRequest(
      { messages: [{ role: 'user', content: 'What is a DFA?' }] },
      {
        providerConfig: {
          apiKey: 'test-nvapi-key',
          fetchFn: mockFetch as unknown as typeof fetch,
        },
      }
    );

    expect(response.status).toBe(200);
    expect(callCount).toBe(2);
    const body = response.body as ChatResponse;
    expect(body.routingInfo?.fallbackUsed).toBe(true);
    expect(body.message.content).toContain('Fallback response');
  });

  // --------------------------------------------------------------------------
  // TEST 9: Fallback Failure Returns Clean Error Without Infinite Loops
  // --------------------------------------------------------------------------
  it('TEST 9: cleanly returns 502 error when both primary and fallback fail (no retry loops)', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: false,
        status: 502,
        json: async () => ({ error: { message: 'Bad Gateway' } }),
      };
    });

    const response = await handleChatRequest(
      { messages: [{ role: 'user', content: 'What is a DFA?' }] },
      {
        providerConfig: {
          apiKey: 'test-nvapi-key',
          fetchFn: mockFetch as unknown as typeof fetch,
        },
      }
    );

    expect(response.status).toBe(502);
    // Bounded: 1 primary call + 1 fallback call = exactly 2 calls, no recursion
    expect(callCount).toBe(2);
    expect((response.body as GatewayErrorResponse).error.type).toBe('upstream_error');
  });

  // --------------------------------------------------------------------------
  // TEST 10: Phase 13 Action Safety Intact Across Routed Responses
  // --------------------------------------------------------------------------
  it('TEST 10: extracts and preserves structured action proposals across routed responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'resp-act-1',
        choices: [
          {
            message: {
              role: 'assistant',
              content:
                'I have designed the DFA for you.\n\n```json:project-zero-actions\n{\n  "version": "1.0.0",\n  "summary": "Create state q0",\n  "actions": [\n    {\n      "id": "act_1",\n      "type": "CREATE_STATE",\n      "parameters": { "label": "q0", "isInitial": true }\n    }\n  ]\n}\n```',
            },
          },
        ],
      }),
    });

    const response = await handleChatRequest(
      {
        messages: [{ role: 'user', content: 'Create a DFA with state q0' }],
      },
      {
        providerConfig: {
          apiKey: 'test-nvapi-key',
          fetchFn: mockFetch as unknown as typeof fetch,
        },
      }
    );

    expect(response.status).toBe(200);
    const body = response.body as ChatResponse;
    expect(body.actionProposal).toBeDefined();
    expect(body.actionProposal?.version).toBe('1.0.0');
    expect(body.actionProposal?.actions.length).toBe(1);
    expect(body.actionProposal?.actions[0].type).toBe('CREATE_STATE');
    expect(body.actionProposal?.actions[0].parameters.label).toBe('q0');
    expect(body.message.content).toBe('I have designed the DFA for you.');
  });

  // --------------------------------------------------------------------------
  // TEST 11: Exact 5-State DFA Construction Query
  // --------------------------------------------------------------------------
  it('TEST 11: correctly profiles exact 5-state DFA construction prompt as AUTOMATON_CONSTRUCTION', () => {
    const prompt =
      'Construct a 5-state DFA over {0,1} that accepts strings ending in 101 or 010. Use states q0 through q4, q0 as initial, and appropriate accepting states. Add all transitions required and explain how the DFA remembers the necessary suffix.';

    const decision = selectModel({
      messages: [{ role: 'user', content: prompt }],
    });

    expect(decision.selectedModel).toBe('nvidia/nemotron-3-super-120b-a12b');
    expect(decision.taskProfile.category).toBe('AUTOMATON_CONSTRUCTION');
    expect(decision.taskProfile.requiresStructuredActions).toBe(true);
    expect(decision.taskProfile.requiresGraphConstruction).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST 12: All Construction Phrase Variations
  // --------------------------------------------------------------------------
  it('TEST 12: accurately profiles all standard construction phrase variations as AUTOMATON_CONSTRUCTION', () => {
    const phrases = [
      'construct a DFA that recognizes even binary numbers',
      'build a DFA for strings with alternating bits',
      'create states q0 and q1',
      'add transitions between initial and accepting states',
      'make an automaton for L = {w | w has 00}',
      'construct an NFA for (01)*',
      'build a PDA for 0^n 1^n',
      'create a TM for binary increment',
    ];

    for (const phrase of phrases) {
      const decision = selectModel({
        messages: [{ role: 'user', content: phrase }],
      });
      expect(decision.taskProfile.category).toBe('AUTOMATON_CONSTRUCTION');
      expect(decision.taskProfile.requiresStructuredActions).toBe(true);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 13: Graph Editing Phrase Variations
  // --------------------------------------------------------------------------
  it('TEST 13: accurately profiles graph editing phrases as GRAPH_EDITING', () => {
    const phrases = [
      'modify the transition from q0 to q1',
      'delete state q2',
      'remove transition on symbol 0',
      'toggle accepting state on q3',
      'set initial state to q1',
      'rename state q0 to start',
    ];

    for (const phrase of phrases) {
      const decision = selectModel({
        messages: [{ role: 'user', content: phrase }],
      });
      expect(decision.taskProfile.category).toBe('GRAPH_EDITING');
      expect(decision.taskProfile.requiresStructuredActions).toBe(true);
    }
  });
});
