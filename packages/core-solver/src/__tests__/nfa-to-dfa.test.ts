import { describe, it, expect } from 'vitest';
import { convertNfaToDfa, getCanonicalSubsetKey, getCanonicalSubsetLabel } from '../nfa-to-dfa';
import { executeNFA } from '../nfa-executor';
import { executeDFA } from '../dfa-executor';
import { validateDFA } from '../dfa-validator';
import { SolverGraphInput } from '../types';

describe('NFA → DFA Subset Construction Pure Core Solver Tests', () => {
  it('Phase 4 — Canonical Subset Identity & Labeling', () => {
    const nodes = [
      { id: 'q1', label: 'q1', x: 0, y: 0 },
      { id: 'q0', label: 'q0', x: 0, y: 0 },
    ];
    // Order of input elements does not change key or label
    expect(getCanonicalSubsetKey(nodes)).toBe('q0,q1');
    expect(getCanonicalSubsetLabel(nodes)).toBe('{q0,q1}');
    expect(getCanonicalSubsetLabel([])).toBe('Ø');
  });

  it('Phase 18 — Canonical Test Case (NFA with nondeterministic branching)', () => {
    // q0 --a--> q1, q0 --a--> q2
    // q1 --b--> q3, q2 --c--> q4
    // q0 initial, q3 & q4 accepting
    const nfaGraph: SolverGraphInput = {
      nodes: [
        { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: false },
        { id: 'q1', label: 'q1', x: 100, y: 0, isInitial: false, isAccepting: false },
        { id: 'q2', label: 'q2', x: 100, y: 100, isInitial: false, isAccepting: false },
        { id: 'q3', label: 'q3', x: 200, y: 0, isInitial: false, isAccepting: true },
        { id: 'q4', label: 'q4', x: 200, y: 100, isInitial: false, isAccepting: true },
      ],
      edges: [
        { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'a' },
        { id: 'e2', sourceNodeId: 'q0', targetNodeId: 'q2', label: 'a' },
        { id: 'e3', sourceNodeId: 'q1', targetNodeId: 'q3', label: 'b' },
        { id: 'e4', sourceNodeId: 'q2', targetNodeId: 'q4', label: 'c' },
      ],
    };

    const res = convertNfaToDfa(nfaGraph);
    expect(res.success).toBe(true);
    expect(res.alphabet).toEqual(['a', 'b', 'c']);

    // Check generated DFA validity with validateDFA
    const dfaValidation = validateDFA({ nodes: res.nodes, edges: res.edges });
    expect(dfaValidation.isValid).toBe(true);

    // Verify equivalence on input strings
    const testStrings = ['ab', 'ac', 'aa', 'a', 'b', 'c', 'abc'];
    for (const str of testStrings) {
      const nfaRes = executeNFA(nfaGraph, str);
      const dfaRes = executeDFA({ nodes: res.nodes, edges: res.edges }, str);
      expect(dfaRes.isAccepted).toBe(nfaRes.isAccepted);
    }
  });

  it('Phase 19 — Epsilon Test (NFA with epsilon transitions)', () => {
    // q0 --ε--> q1, q1 --a--> q2
    // q0 initial, q2 accepting
    const nfaGraph: SolverGraphInput = {
      nodes: [
        { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: false },
        { id: 'q1', label: 'q1', x: 100, y: 0, isInitial: false, isAccepting: false },
        { id: 'q2', label: 'q2', x: 200, y: 0, isInitial: false, isAccepting: true },
      ],
      edges: [
        { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'ε' },
        { id: 'e2', sourceNodeId: 'q1', targetNodeId: 'q2', label: 'a' },
      ],
    };

    const res = convertNfaToDfa(nfaGraph);
    expect(res.success).toBe(true);

    // Initial state of generated DFA must be {q0,q1}
    const initialDfaNode = res.nodes.find((n) => n.isInitial);
    expect(initialDfaNode?.label).toBe('{q0,q1}');

    // No epsilon edges should exist in generated DFA
    expect(res.edges.some((e) => e.label === 'ε' || e.label === 'λ')).toBe(false);

    // Validate generated DFA
    const dfaValidation = validateDFA({ nodes: res.nodes, edges: res.edges });
    expect(dfaValidation.isValid).toBe(true);

    // Verify equivalence
    expect(executeDFA({ nodes: res.nodes, edges: res.edges }, 'a').isAccepted).toBe(true);
    expect(executeDFA({ nodes: res.nodes, edges: res.edges }, '').isAccepted).toBe(false);
  });

  it('Phase 20 — Classic NFA → DFA Branching Test', () => {
    // q0 --0--> q0, q0 --0--> q1, q0 --1--> q0, q1 --1--> q2 (q2 accepting)
    const nfaGraph: SolverGraphInput = {
      nodes: [
        { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: false },
        { id: 'q1', label: 'q1', x: 100, y: 0, isInitial: false, isAccepting: false },
        { id: 'q2', label: 'q2', x: 200, y: 0, isInitial: false, isAccepting: true },
      ],
      edges: [
        { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q0', label: '0' },
        { id: 'e2', sourceNodeId: 'q0', targetNodeId: 'q1', label: '0' },
        { id: 'e3', sourceNodeId: 'q0', targetNodeId: 'q0', label: '1' },
        { id: 'e4', sourceNodeId: 'q1', targetNodeId: 'q2', label: '1' },
      ],
    };

    const res = convertNfaToDfa(nfaGraph);
    expect(res.success).toBe(true);
    const dfaValidation = validateDFA({ nodes: res.nodes, edges: res.edges });
    expect(dfaValidation.isValid).toBe(true);

    const testCases = ['01', '001', '101', '0', '1', '11'];
    for (const str of testCases) {
      const nfaExec = executeNFA(nfaGraph, str);
      const dfaExec = executeDFA({ nodes: res.nodes, edges: res.edges }, str);
      expect(dfaExec.isAccepted).toBe(nfaExec.isAccepted);
    }
  });

  it('Phase 21 — Dead/Trap State (Ø) Handling', () => {
    // q0 --a--> q1 (q0 initial, q1 accepting, symbol 'b' has no transition from q0 or q1)
    const nfaGraph: SolverGraphInput = {
      nodes: [
        { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: false },
        { id: 'q1', label: 'q1', x: 100, y: 0, isInitial: false, isAccepting: true },
      ],
      edges: [
        { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'a' },
        { id: 'e2', sourceNodeId: 'q0', targetNodeId: 'q0', label: 'b' },
      ],
    };

    const res = convertNfaToDfa(nfaGraph);
    expect(res.success).toBe(true);
    expect(res.alphabet).toEqual(['a', 'b']);

    // Check if dead state Ø was created for missing transition q1 on 'a' or 'b'
    const deadNode = res.nodes.find((n) => n.label === 'Ø');
    if (deadNode) {
      expect(deadNode.isAccepting).toBe(false);
      // Dead state must self-loop on all alphabet symbols
      const deadLoops = res.edges.filter((e) => e.sourceNodeId === deadNode.id && e.targetNodeId === deadNode.id);
      expect(deadLoops.flatMap((e) => e.label.split(',').map((s) => s.trim())).sort()).toEqual(['a', 'b']);
    }
  });

  it('Fails gracefully when attempting to convert an invalid NFA', () => {
    const invalidNfaGraph: SolverGraphInput = {
      nodes: [
        { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: false }, // Missing initial state!
      ],
      edges: [],
    };

    const res = convertNfaToDfa(invalidNfaGraph);
    expect(res.success).toBe(false);
    expect(res.errorMessage).toContain('NFA validation failed');
  });
});
