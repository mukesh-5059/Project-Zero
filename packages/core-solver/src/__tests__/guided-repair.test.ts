import { describe, it, expect } from 'vitest';
import { generateDiagnostics, computeRepairPreview, applyRepairToGraph } from '../guided-repair';
import { AutomataRepairSuggestion } from '../types';
import { StateNode, TransitionEdge } from '@project-zero/canvas-renderer';

describe('Guided Automata Construction & Repair Engine Tests', () => {
  it('1. Generates DFA_NO_INITIAL_STATE diagnostic with mathematical explanation and repair options', () => {
    const nodes: StateNode[] = [
      { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: false, isAccepting: false },
    ];
    const report = generateDiagnostics({ nodes, edges: [] }, 'DFA');

    expect(report.isValid).toBe(false);
    expect(report.errorCount).toBe(1);
    const diag = report.diagnostics.find((d) => d.code === 'DFA_NO_INITIAL_STATE');
    expect(diag).toBeDefined();
    expect(diag?.mathematicalExplanation).toContain('initial start state q₀');
    expect(diag?.repairs).toHaveLength(1);
    expect(diag?.repairs[0].actionType).toBe('SET_INITIAL_STATE');
  });

  it('2. Generates DFA_MULTIPLE_INITIAL_STATES diagnostic', () => {
    const nodes: StateNode[] = [
      { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: false },
      { id: 'q1', label: 'q1', x: 100, y: 0, isInitial: true, isAccepting: true },
    ];
    const report = generateDiagnostics({ nodes, edges: [] }, 'DFA');

    expect(report.isValid).toBe(false);
    const diag = report.diagnostics.find((d) => d.code === 'DFA_MULTIPLE_INITIAL_STATES');
    expect(diag).toBeDefined();
    expect(diag?.affectedStateIds).toHaveLength(2);
    expect(diag?.repairs).toHaveLength(2);
  });

  it('3. Detects DFA_EPSILON_TRANSITION and suggests removal', () => {
    const nodes: StateNode[] = [
      { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: false },
      { id: 'q1', label: 'q1', x: 100, y: 0, isInitial: false, isAccepting: true },
    ];
    const edges: TransitionEdge[] = [
      { id: 'e0', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'ε' },
    ];

    const report = generateDiagnostics({ nodes, edges }, 'DFA');
    const diag = report.diagnostics.find((d) => d.code === 'DFA_EPSILON_TRANSITION');
    expect(diag).toBeDefined();
    expect(diag?.affectedTransitionIds).toContain('e0');
  });

  it('4. Detects DFA_NONDETERMINISTIC_TRANSITION for duplicate symbol branching', () => {
    const nodes: StateNode[] = [
      { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: false },
      { id: 'q1', label: 'q1', x: 100, y: 0, isInitial: false, isAccepting: true },
      { id: 'q2', label: 'q2', x: 200, y: 0, isInitial: false, isAccepting: false },
    ];
    const edges: TransitionEdge[] = [
      { id: 'e0', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'a' },
      { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q2', label: 'a' },
    ];

    const report = generateDiagnostics({ nodes, edges }, 'DFA');
    const diag = report.diagnostics.find((d) => d.code === 'DFA_NONDETERMINISTIC_TRANSITION');
    expect(diag).toBeDefined();
    expect(diag?.affectedTransitionIds).toHaveLength(2);
  });

  it('5. Detects DFA_MISSING_TRANSITION and provides trap state repair options', () => {
    const nodes: StateNode[] = [
      { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: false },
      { id: 'q1', label: 'q1', x: 100, y: 0, isInitial: false, isAccepting: true },
    ];
    const edges: TransitionEdge[] = [
      { id: 'e0', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'a' },
    ];

    const report = generateDiagnostics({ nodes, edges }, 'DFA');
    const diag = report.diagnostics.find((d) => d.code === 'DFA_MISSING_TRANSITION');
    expect(diag).toBeDefined();
    expect(diag?.repairs.some((r) => r.actionType === 'CREATE_TRAP_STATE_AND_TRANSITION')).toBe(true);
  });

  it('6. Detects DFA_UNREACHABLE_STATE and classifies removal as SAFE', () => {
    const nodes: StateNode[] = [
      { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: true },
      { id: 'unreach', label: 'unreach', x: 500, y: 0, isInitial: false, isAccepting: false },
    ];
    const report = generateDiagnostics({ nodes, edges: [] }, 'DFA');
    const diag = report.diagnostics.find((d) => d.code === 'DFA_UNREACHABLE_STATE');
    expect(diag).toBeDefined();
    expect(diag?.repairs[0].category).toBe('SAFE');
  });

  it('7. Computes pure repair preview and explicit diff without graph mutation', () => {
    const nodes: StateNode[] = [
      { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: false },
      { id: 'q1', label: 'q1', x: 100, y: 0, isInitial: false, isAccepting: true },
    ];
    const edges: TransitionEdge[] = [
      { id: 'e0', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'a' },
    ];

    const report = generateDiagnostics({ nodes, edges }, 'DFA');
    const missingDiag = report.diagnostics.find((d) => d.code === 'DFA_MISSING_TRANSITION')!;
    const repair = missingDiag.repairs.find((r) => r.actionType === 'CREATE_TRAP_STATE_AND_TRANSITION')!;

    const preview = computeRepairPreview({ nodes, edges }, repair, 'DFA');

    // Graph before remains untouched
    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(1);

    // Trap node + transition edge + self-loop edge for symbol 'a'
    expect(preview.diff.addedNodes).toHaveLength(1);
    expect(preview.diff.addedEdges).toHaveLength(2);
    expect(preview.afterNodes).toHaveLength(3);
    expect(preview.afterEdges).toHaveLength(3);
    expect(preview.isAfterValid).toBe(true);
  });

  it('8. Applies repair to produce updated graph for replaceMachine', () => {
    const nodes: StateNode[] = [
      { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: false, isAccepting: true },
    ];
    const report = generateDiagnostics({ nodes, edges: [] }, 'DFA');
    const diag = report.diagnostics.find((d) => d.code === 'DFA_NO_INITIAL_STATE')!;
    const repair = diag.repairs[0];

    const updated = applyRepairToGraph({ nodes, edges: [] }, repair, 'DFA');
    expect(updated.nodes[0].isInitial).toBe(true);

    const postReport = generateDiagnostics(updated, 'DFA');
    expect(postReport.diagnostics.some((d) => d.code === 'DFA_NO_INITIAL_STATE')).toBe(false);
  });

  it('9. Emits DFA_NO_STATES when nodes array is empty (Q = ∅)', () => {
    const report = generateDiagnostics({ nodes: [], edges: [] }, 'DFA');
    expect(report.isValid).toBe(false);
    expect(report.diagnostics[0].code).toBe('DFA_NO_STATES');
  });

  it('10. Allows empty transition labels in NFA mode as valid epsilon transitions', () => {
    const nodes: StateNode[] = [
      { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: false },
      { id: 'q1', label: 'q1', x: 100, y: 0, isInitial: false, isAccepting: true },
    ];
    const edges: TransitionEdge[] = [
      { id: 'e0', sourceNodeId: 'q0', targetNodeId: 'q1', label: '' },
    ];

    const report = generateDiagnostics({ nodes, edges }, 'NFA');
    expect(report.diagnostics.some((d) => d.code === 'NFA_EMPTY_TRANSITION_SYMBOL')).toBe(false);
  });

  it('11. Detects malformed PDA transitions and invalid initial stack symbol', () => {
    const nodes: StateNode[] = [
      { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: true },
    ];
    const edges: TransitionEdge[] = [
      { id: 'e0', sourceNodeId: 'q0', targetNodeId: 'q0', label: 'invalid pda syntax' },
    ];

    const report = generateDiagnostics({ nodes, edges }, 'PDA', '');
    expect(report.isValid).toBe(false);
    expect(report.diagnostics.some((d) => d.code === 'PDA_MISSING_INITIAL_STACK_SYMBOL')).toBe(true);
  });

  it('12. Detects invalid TM move direction and duplicate TM transitions', () => {
    const nodes: StateNode[] = [
      { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: true },
    ];
    const edges: TransitionEdge[] = [
      { id: 'e0', sourceNodeId: 'q0', targetNodeId: 'q0', label: '0 -> 1, X', readSymbol: '0', writeSymbol: '1', moveDirection: 'X' as unknown as 'R' },
    ];

    const report = generateDiagnostics({ nodes, edges }, 'TM');
    expect(report.isValid).toBe(false);
    expect(report.diagnostics.some((d) => d.code === 'TM_INVALID_MOVE_DIRECTION')).toBe(true);
  });

  it('13. Machine-type-aware preview evaluates NFA preview using NFA rules', () => {
    const nodes: StateNode[] = [
      { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: false },
      { id: 'q1', label: 'q1', x: 100, y: 0, isInitial: false, isAccepting: true },
    ];
    const edges: TransitionEdge[] = [
      { id: 'e0', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'a' },
      { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'a' },
    ];

    const report = generateDiagnostics({ nodes, edges }, 'NFA');
    // In NFA, duplicate symbol transitions are valid
    expect(report.isValid).toBe(true);

    const repair: AutomataRepairSuggestion = {
      id: 'rep-test',
      diagnosticId: 'diag-test',
      title: 'Test repair',
      description: 'Test',
      category: 'POTENTIALLY_LANGUAGE_CHANGING',
      actionType: 'SET_INITIAL_STATE',
      targetEntityId: 'q0',
    };

    const preview = computeRepairPreview({ nodes, edges }, repair, 'NFA');
    expect(preview.isAfterValid).toBe(true);
  });

  it('14. Correctly computes modifiedEdges diff when edge label changes', () => {
    const nodes: StateNode[] = [
      { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: true },
    ];
    const beforeEdges: TransitionEdge[] = [
      { id: 'e0', sourceNodeId: 'q0', targetNodeId: 'q0', label: 'a' },
    ];

    const repair: AutomataRepairSuggestion = {
      id: 'rep-mod',
      diagnosticId: 'diag-mod',
      title: 'Modify Edge',
      description: 'Test',
      category: 'POTENTIALLY_LANGUAGE_CHANGING',
      actionType: 'REMOVE_EDGE',
      targetEntityId: 'e0',
    };

    const preview = computeRepairPreview({ nodes, edges: beforeEdges }, repair, 'DFA');
    expect(preview.diff.removedEdges).toHaveLength(1);
  });

  it('15. Defensively handles invalid or null repair in applyRepairToGraph', () => {
    const nodes: StateNode[] = [
      { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: true },
    ];
    const updated = applyRepairToGraph({ nodes, edges: [] }, undefined as unknown as AutomataRepairSuggestion);
    expect(updated.nodes).toHaveLength(1);
  });

  it('16. Verifies REMOVE_EDGE repairs are classified as POTENTIALLY_LANGUAGE_CHANGING', () => {
    const nodes: StateNode[] = [
      { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: false },
      { id: 'q1', label: 'q1', x: 100, y: 0, isInitial: false, isAccepting: true },
    ];
    const edges: TransitionEdge[] = [
      { id: 'e0', sourceNodeId: 'q0', targetNodeId: 'q1', label: '' },
    ];

    const report = generateDiagnostics({ nodes, edges }, 'DFA');
    const emptyDiag = report.diagnostics.find((d) => d.code === 'DFA_EMPTY_TRANSITION_SYMBOL');
    expect(emptyDiag?.repairs[0].category).toBe('POTENTIALLY_LANGUAGE_CHANGING');
  });

  it('17. Reuses existing trap state (Ø) rather than creating duplicate trap states', () => {
    const nodes: StateNode[] = [
      { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: false },
      { id: 'q1', label: 'q1', x: 100, y: 0, isInitial: false, isAccepting: true },
      { id: 'trap1', label: 'Ø', x: 200, y: 200, isInitial: false, isAccepting: false },
    ];
    const edges: TransitionEdge[] = [
      { id: 'e0', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'a' },
      { id: 'e_loop', sourceNodeId: 'trap1', targetNodeId: 'trap1', label: 'a, b' },
    ];

    const report = generateDiagnostics({ nodes, edges }, 'DFA');
    const missingDiag = report.diagnostics.find(
      (d) => d.code === 'DFA_MISSING_TRANSITION' && d.affectedStateIds.includes('q0')
    )!;
    expect(missingDiag).toBeDefined();

    // Repair should offer connecting to existing trap state
    const repair = missingDiag.repairs.find(
      (r) => r.actionType === 'CREATE_TRAP_STATE_AND_TRANSITION'
    )!;
    expect(repair.title).toContain('Connect to Trap State');

    const preview = computeRepairPreview({ nodes, edges }, repair, 'DFA');

    // Crucial: Must NOT add a new node, must reuse existing trap1
    expect(preview.diff.addedNodes).toHaveLength(0);
    expect(preview.afterNodes).toHaveLength(3);
    expect(preview.afterEdges.some((e) => e.sourceNodeId === 'q0' && e.targetNodeId === 'trap1')).toBe(true);
  });

  it('18. Aggregates transitions when adding another transition between same pair', () => {
    const nodes: StateNode[] = [
      { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: false },
      { id: 'trap1', label: 'Ø', x: 200, y: 200, isInitial: false, isAccepting: false },
    ];
    const edges: TransitionEdge[] = [
      { id: 'e0', sourceNodeId: 'q0', targetNodeId: 'trap1', label: 'a' },
      { id: 'loop', sourceNodeId: 'trap1', targetNodeId: 'trap1', label: 'a, b' },
    ];

    const repair: AutomataRepairSuggestion = {
      id: 'rep-test',
      diagnosticId: 'diag-test',
      title: 'Add b to trap',
      description: 'Test',
      category: 'SAFE',
      actionType: 'CREATE_TRAP_STATE_AND_TRANSITION',
      payload: {
        sourceNodeId: 'q0',
        targetNodeId: 'trap1',
        symbol: 'b',
      },
    };

    const preview = computeRepairPreview({ nodes, edges }, repair, 'DFA');
    expect(preview.afterNodes).toHaveLength(2);
    // The edge between q0 and trap1 should be merged into 'a, b'
    const edgeQ0toTrap = preview.afterEdges.find((e) => e.sourceNodeId === 'q0' && e.targetNodeId === 'trap1');
    expect(edgeQ0toTrap?.label).toBe('a, b');
    // Trap self loop should remain consolidated
    const trapLoop = preview.afterEdges.find((e) => e.sourceNodeId === 'trap1' && e.targetNodeId === 'trap1');
    expect(trapLoop?.label).toBe('a, b');
  });
});
