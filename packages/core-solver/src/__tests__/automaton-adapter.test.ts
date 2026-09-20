import { describe, it, expect } from 'vitest';
import { expandSolverEdges, classifyFA, isFA_NFA } from '../automaton-adapter';
import { StateNode, TransitionEdge } from '@project-zero/canvas-renderer';

describe('Automaton Adapter & Classification', () => {
  const q0: StateNode = { id: 'q0', label: 'q0', x: 0, y: 0 };
  const q1: StateNode = { id: 'q1', label: 'q1', x: 100, y: 0 };
  const q2: StateNode = { id: 'q2', label: 'q2', x: 200, y: 0 };
  const nodes = [q0, q1, q2];

  it('expands comma-separated transition labels into individual transitions', () => {
    const edge: TransitionEdge = { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q1', label: '1, 0' };
    const expanded = expandSolverEdges([edge], 'FA');

    expect(expanded).toHaveLength(2);
    expect(expanded[0].label).toBe('1');
    expect(expanded[1].label).toBe('0');
  });

  it('classifies FA as DFA when all transitions are deterministic', () => {
    const edges: TransitionEdge[] = [
      { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q1', label: '0' },
      { id: 'e2', sourceNodeId: 'q0', targetNodeId: 'q2', label: '1' },
    ];
    expect(classifyFA(nodes, edges)).toBe('DFA');
    expect(isFA_NFA(nodes, edges)).toBe(false);
  });

  it('classifies FA as NFA when aggregated self-loop shares symbol with another outgoing edge', () => {
    // Exactly the user scenario: q0 has self-loop "1, 0" and edge to q2 on "1"
    const edges: TransitionEdge[] = [
      { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q0', label: '1, 0', isSelfLoop: true },
      { id: 'e2', sourceNodeId: 'q0', targetNodeId: 'q2', label: '1' },
      { id: 'e3', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'a' },
    ];
    expect(classifyFA(nodes, edges)).toBe('NFA');
    expect(isFA_NFA(nodes, edges)).toBe(true);
  });

  it('classifies FA as NFA when aggregated edge has overlapping symbols with another edge', () => {
    // q0 -> q0 on "1, 0" and q0 -> q2 on "0, 1"
    const edges: TransitionEdge[] = [
      { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q0', label: '1, 0', isSelfLoop: true },
      { id: 'e2', sourceNodeId: 'q0', targetNodeId: 'q2', label: '0, 1' },
    ];
    expect(classifyFA(nodes, edges)).toBe('NFA');
    expect(isFA_NFA(nodes, edges)).toBe(true);
  });

  it('classifies FA as NFA when any epsilon transition exists', () => {
    const edges: TransitionEdge[] = [
      { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'ε' },
    ];
    expect(classifyFA(nodes, edges)).toBe('NFA');
    expect(isFA_NFA(nodes, edges)).toBe(true);
  });
});
