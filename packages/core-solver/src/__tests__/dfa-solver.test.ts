import { describe, it, expect } from 'vitest';
import { StateNode, TransitionEdge } from '@project-zero/canvas-renderer';
import { validateDFA, executeDFA, computeTransitionMatrix, tokenizeInputString } from '../index';

describe('DFA Validation & Deterministic Execution Engine', () => {
  // Canonical DFA: L = { w ∈ {0,1}* | w ends in 1 }
  const canonicalNodes: StateNode[] = [
    { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: false },
    { id: 'q1', label: 'q1', x: 100, y: 0, isInitial: false, isAccepting: true },
  ];

  const canonicalEdges: TransitionEdge[] = [
    { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q0', label: '0' },
    { id: 'e2', sourceNodeId: 'q0', targetNodeId: 'q1', label: '1' },
    { id: 'e3', sourceNodeId: 'q1', targetNodeId: 'q0', label: '0' },
    { id: 'e4', sourceNodeId: 'q1', targetNodeId: 'q1', label: '1' },
  ];

  const canonicalGraph = { nodes: canonicalNodes, edges: canonicalEdges };

  it('1. Validates canonical DFA as valid', () => {
    const val = validateDFA(canonicalGraph);
    expect(val.isValid).toBe(true);
    expect(val.errors.length).toBe(0);
  });

  it('2. Detects missing initial state', () => {
    const noInitNodes = canonicalNodes.map((n) => ({ ...n, isInitial: false }));
    const val = validateDFA({ nodes: noInitNodes, edges: canonicalEdges });
    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.code === 'MISSING_INITIAL_STATE')).toBe(true);
  });

  it('3. Detects multiple initial states', () => {
    const multiInitNodes = canonicalNodes.map((n) => ({ ...n, isInitial: true }));
    const val = validateDFA({ nodes: multiInitNodes, edges: canonicalEdges });
    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.code === 'MULTIPLE_INITIAL_STATES')).toBe(true);
  });

  it('4. Detects epsilon transition', () => {
    const epsEdges = [
      ...canonicalEdges,
      { id: 'e_eps', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'ε' },
    ];
    const val = validateDFA({ nodes: canonicalNodes, edges: epsEdges });
    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.code === 'EPSILON_TRANSITION')).toBe(true);
  });

  it('5. Detects duplicate same-symbol transitions (NFA ambiguity)', () => {
    const dupEdges = [
      ...canonicalEdges,
      { id: 'e_dup', sourceNodeId: 'q0', targetNodeId: 'q1', label: '0' },
    ];
    const val = validateDFA({ nodes: canonicalNodes, edges: dupEdges });
    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.code === 'DUPLICATE_SYMBOL_TRANSITION')).toBe(true);
  });

  it('6. Detects empty transition symbol', () => {
    const emptySymEdges = [
      ...canonicalEdges,
      { id: 'e_empty', sourceNodeId: 'q0', targetNodeId: 'q1', label: '  ' },
    ];
    const val = validateDFA({ nodes: canonicalNodes, edges: emptySymEdges });
    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.code === 'EMPTY_TRANSITION_SYMBOL')).toBe(true);
  });

  it('7 & 8. Zero and multiple accepting states', () => {
    const zeroAccNodes = canonicalNodes.map((n) => ({ ...n, isAccepting: false }));
    const zeroVal = validateDFA({ nodes: zeroAccNodes, edges: canonicalEdges });
    expect(zeroVal.isValid).toBe(false);
    expect(zeroVal.errors.some((e) => e.code === 'MISSING_ACCEPTING_STATE')).toBe(true);

    const multiAccNodes = canonicalNodes.map((n) => ({ ...n, isAccepting: true }));
    expect(validateDFA({ nodes: multiAccNodes, edges: canonicalEdges }).isValid).toBe(true);
  });

  it('9. Missing transition during execution (rejection NO_TRANSITION)', () => {
    const sparseGraph = {
      nodes: canonicalNodes,
      edges: [{ id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q1', label: '1' }],
    };
    const res = executeDFA(sparseGraph, '0');
    expect(res.isAccepted).toBe(false);
    expect(res.rejectionReason).toBe('NO_TRANSITION');
  });

  it('10. Non-accepting final state rejection (NON_ACCEPTING_FINAL_STATE)', () => {
    const res = executeDFA(canonicalGraph, '10');
    expect(res.isAccepted).toBe(false);
    expect(res.finalStateLabel).toBe('q0');
    expect(res.rejectionReason).toBe('NON_ACCEPTING_FINAL_STATE');
  });

  it('11. Accepting final state acceptance', () => {
    const res = executeDFA(canonicalGraph, '1011');
    expect(res.isAccepted).toBe(true);
    expect(res.finalStateLabel).toBe('q1');
    expect(res.rejectionReason).toBeUndefined();
  });

  it('12. Empty input string execution', () => {
    const res = executeDFA(canonicalGraph, '');
    expect(res.isAccepted).toBe(false);
    expect(res.finalStateLabel).toBe('q0');
    expect(res.steps.length).toBe(1);
    expect(res.steps[0].remainingInput).toBe('ε');
  });

  it('14. Phase 11 Canonical Test Suite: L = { w | w ends in 1 }', () => {
    const testCases = [
      { input: '', expected: false },
      { input: '0', expected: false },
      { input: '1', expected: true },
      { input: '10', expected: false },
      { input: '11', expected: true },
      { input: '1010', expected: false },
      { input: '1011', expected: true },
      { input: '111', expected: true },
      { input: '100', expected: false },
    ];

    for (const tc of testCases) {
      const res = executeDFA(canonicalGraph, tc.input);
      expect(res.isAccepted).toBe(tc.expected);
    }
  });

  it('15. Trace steps structure correctness', () => {
    const res = executeDFA(canonicalGraph, '101');
    expect(res.steps.length).toBe(3);
    expect(res.steps[0].currentStateLabel).toBe('q0');
    expect(res.steps[0].readSymbol).toBe('1');
    expect(res.steps[0].nextStateLabel).toBe('q1');

    expect(res.steps[1].currentStateLabel).toBe('q1');
    expect(res.steps[1].readSymbol).toBe('0');
    expect(res.steps[1].nextStateLabel).toBe('q0');

    expect(res.steps[2].currentStateLabel).toBe('q0');
    expect(res.steps[2].readSymbol).toBe('1');
    expect(res.steps[2].nextStateLabel).toBe('q1');
    expect(res.steps[2].isAccepting).toBe(true);
  });

  it('16. Transition matrix computation correctness', () => {
    const matrix = computeTransitionMatrix(canonicalGraph);
    expect(matrix.symbols).toEqual(['0', '1']);
    expect(matrix.entries.length).toBe(2);

    const q0Entry = matrix.entries.find((e) => e.stateLabel === 'q0');
    expect(q0Entry?.transitions['0']).toBe('q0');
    expect(q0Entry?.transitions['1']).toBe('q1');

    const q1Entry = matrix.entries.find((e) => e.stateLabel === 'q1');
    expect(q1Entry?.transitions['0']).toBe('q0');
    expect(q1Entry?.transitions['1']).toBe('q1');
  });

  it('17. Invalid DFA does not execute', () => {
    const invalidGraph = { nodes: [], edges: [] };
    const res = executeDFA(invalidGraph, '101');
    expect(res.isAccepted).toBe(false);
    expect(res.rejectionReason).toBe('INVALID_MACHINE');
    expect(res.steps.length).toBe(0);
  });

  it('18. Tokenization for single and multi-character symbols', () => {
    expect(tokenizeInputString('1011', ['0', '1'])).toEqual(['1', '0', '1', '1']);
    expect(tokenizeInputString('a01b', ['01', 'a', 'b'])).toEqual(['a', '01', 'b']);
  });

  it('19. Tokenization strict matching & out-of-alphabet rejection', () => {
    const multiGraph: { nodes: StateNode[]; edges: TransitionEdge[] } = {
      nodes: [
        { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: true },
      ],
      edges: [
        { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q0', label: 'a1' },
        { id: 'e2', sourceNodeId: 'q0', targetNodeId: 'q0', label: 'b2' },
      ],
    };

    // Valid inputs
    expect(executeDFA(multiGraph, 'a1').isAccepted).toBe(true);
    expect(executeDFA(multiGraph, 'b2').isAccepted).toBe(true);
    expect(executeDFA(multiGraph, 'a1b2').isAccepted).toBe(true);
    expect(executeDFA(multiGraph, '').isAccepted).toBe(true);

    // Invalid input containing unknown symbol 'c' rejects with NO_TRANSITION
    const resInvalid = executeDFA(multiGraph, 'a1c');
    expect(resInvalid.isAccepted).toBe(false);
    expect(resInvalid.rejectionReason).toBe('NO_TRANSITION');

    const resUnknownOnly = executeDFA(multiGraph, 'c');
    expect(resUnknownOnly.isAccepted).toBe(false);
    expect(resUnknownOnly.rejectionReason).toBe('NO_TRANSITION');
  });
});
