/**
 * Phase 10 — Context Engine Builder & Sanitizer Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { buildAIContextSnapshot } from '../aiContextBuilder';
import { StateNode, TransitionEdge } from '@project-zero/canvas-renderer';

describe('Phase 10 — Frontend Context Engine (aiContextBuilder)', () => {
  it('1. builds complete DFA context snapshot from canvas graph state', () => {
    const nodes: StateNode[] = [
      { id: 'node-0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: false },
      { id: 'node-1', label: 'q1', x: 100, y: 100, isInitial: false, isAccepting: true },
    ];
    const edges: TransitionEdge[] = [
      { id: 'edge-0', sourceNodeId: 'node-0', targetNodeId: 'node-1', label: 'a' },
      { id: 'edge-1', sourceNodeId: 'node-1', targetNodeId: 'node-0', label: 'b' },
    ];

    const context = buildAIContextSnapshot({
      nodes,
      edges,
      machineType: 'DFA',
      selectedNodeIds: ['node-1'],
      selectedEdgeIds: ['edge-0'],
      activeSidebarTab: 'explorer',
      activeBottomTab: 'analysis-validation',
      activeInspectorTab: 'inspect',
      focusMode: false,
      isStructurallyValid: true,
      diagnostics: [],
    });

    expect(context.version).toBe('1.0.0');
    expect(context.workspace.activeMachineType).toBe('DFA');
    expect(context.workspace.activeBottomTab).toBe('analysis-validation');
    expect(context.selection.selectedNodeLabels).toEqual(['q1']);
    expect(context.selection.selectedEdgeDescriptions).toEqual(['q0 →(a)→ q1']);
    expect(context.machine.stateCount).toBe(2);
    expect(context.machine.initialState).toBe('q0');
    expect(context.machine.acceptingStates).toEqual(['q1']);
    expect(context.machine.alphabet).toEqual(['a', 'b']);
    expect(context.machine.transitions.length).toBe(2);
  });

  it('2. builds PDA context with stack operations and acceptance mode', () => {
    const nodes: StateNode[] = [
      { id: 'n0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: true },
    ];
    const edges: TransitionEdge[] = [
      { id: 'e0', sourceNodeId: 'n0', targetNodeId: 'n0', label: '0', stackTop: 'Z0', stackReplacement: '0Z0' },
    ];

    const context = buildAIContextSnapshot({
      nodes,
      edges,
      machineType: 'PDA',
      selectedNodeIds: [],
      selectedEdgeIds: [],
      initialStackSymbol: 'Z0',
      pdaAcceptanceMode: 'EMPTY_STACK',
    });

    expect(context.machine.type).toBe('PDA');
    expect(context.machine.initialStackSymbol).toBe('Z0');
    expect(context.machine.pdaAcceptanceMode).toBe('EMPTY_STACK');
    expect(context.machine.transitions[0].stackPop).toBe('Z0');
    expect(context.machine.transitions[0].stackPush).toBe('0Z0');
  });

  it('3. builds TM context with tape blank symbol and direction', () => {
    const nodes: StateNode[] = [
      { id: 'n0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: false },
      { id: 'n1', label: 'q_acc', x: 100, y: 0, isInitial: false, isAccepting: true },
    ];
    const edges: TransitionEdge[] = [
      { id: 'e0', sourceNodeId: 'n0', targetNodeId: 'n1', label: '0', writeSymbol: '1', moveDirection: 'R' },
    ];

    const context = buildAIContextSnapshot({
      nodes,
      edges,
      machineType: 'TM',
      selectedNodeIds: [],
      selectedEdgeIds: [],
      blankSymbol: '□',
    });

    expect(context.machine.type).toBe('TM');
    expect(context.machine.blankSymbol).toBe('□');
    expect(context.machine.transitions[0].tapeWrite).toBe('1');
    expect(context.machine.transitions[0].tapeDirection).toBe('R');
  });

  it('4. deterministically caps oversized machines within bounds', () => {
    const manyNodes: StateNode[] = Array.from({ length: 60 }, (_, i) => ({
      id: `node-${i}`,
      label: `q${i}`,
      x: i * 10,
      y: i * 10,
      isInitial: i === 0,
      isAccepting: false,
    }));

    const context = buildAIContextSnapshot({
      nodes: manyNodes,
      edges: [],
      machineType: 'NFA',
      selectedNodeIds: [],
      selectedEdgeIds: [],
    });

    expect(context.machine.stateCount).toBe(60);
    expect(context.machine.states.length).toBe(40);
    expect(context.contextTruncated).toBe(true);
    expect(context.truncationReason).toContain('States capped at 40');
  });

  it('5. forwards educational evidence and tutor intent cleanly', () => {
    const context = buildAIContextSnapshot({
      nodes: [],
      edges: [],
      machineType: 'DFA',
      selectedNodeIds: [],
      selectedEdgeIds: [],
      tutorIntent: 'WHY',
      evidence: {
        validityStatus: 'INVALID',
        diagnostics: ['Missing transition for symbol "b" on state q0'],
      },
    });

    expect(context.tutorIntent).toBe('WHY');
    expect(context.evidence?.validityStatus).toBe('INVALID');
    expect(context.evidence?.diagnostics?.[0]).toContain('Missing transition');
  });
});
