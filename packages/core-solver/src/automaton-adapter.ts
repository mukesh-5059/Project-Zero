import { StateNode, TransitionEdge } from '@project-zero/canvas-renderer';
import { AutomatonType } from '@project-zero/shared';

/**
 * Expands aggregated multi-symbol (e.g. "0, 1") or multi-rule (PDA/TM newline)
 * transition edges into individual single-symbol transitions for mathematical solvers.
 */
export function expandSolverEdges(
  edges: ReadonlyArray<TransitionEdge>,
  machineType?: AutomatonType
): TransitionEdge[] {
  const result: TransitionEdge[] = [];

  for (const edge of edges) {
    if (!edge.label || edge.label.trim().length === 0) {
      result.push(edge);
      continue;
    }

    if (!machineType || machineType === 'FA' || machineType === 'DFA' || machineType === 'NFA') {
      const symbols = edge.label.split(',').map((s) => s.trim()).filter(Boolean);
      if (symbols.length <= 1) {
        result.push(edge);
      } else {
        for (const sym of symbols) {
          result.push({
            ...edge,
            label: sym,
            inputSymbol: sym,
          });
        }
      }
    } else {
      // PDA or TM newline-separated rule aggregation
      const rules = edge.label.split('\n').map((r) => r.trim()).filter(Boolean);
      if (rules.length <= 1) {
        result.push(edge);
      } else {
        for (const rule of rules) {
          result.push({
            ...edge,
            label: rule,
          });
        }
      }
    }
  }

  return result;
}

/**
 * Canonical Finite Automaton classifier.
 * Evaluates whether an FA graph is a Deterministic Finite Automaton (DFA)
 * or a Nondeterministic Finite Automaton (NFA).
 *
 * An FA is an NFA if:
 * 1. It contains any epsilon / empty transitions (ε, λ, or empty string).
 * 2. Any state has multiple outgoing transitions on the same input symbol.
 * Otherwise, it is a DFA.
 */
export function classifyFA(
  nodes: ReadonlyArray<StateNode>,
  edges: ReadonlyArray<TransitionEdge>
): 'DFA' | 'NFA' {
  const expanded = expandSolverEdges(edges, 'FA');

  // 1. Any epsilon transition => NFA
  const hasEpsilon = expanded.some(
    (e) => !e.label || e.label === 'ε' || e.label === 'λ' || e.label.trim() === ''
  );
  if (hasEpsilon) return 'NFA';

  // 2. Determinism check: multiple outgoing transitions on the same symbol => NFA
  for (const node of nodes) {
    const seen = new Set<string>();
    const outgoing = expanded.filter((e) => e.sourceNodeId === node.id);
    for (const e of outgoing) {
      const sym = e.label.trim();
      if (seen.has(sym)) {
        return 'NFA';
      }
      seen.add(sym);
    }
  }

  return 'DFA';
}

/**
 * Convenience boolean helper to check if an FA is an NFA.
 */
export function isFA_NFA(
  nodes: ReadonlyArray<StateNode>,
  edges: ReadonlyArray<TransitionEdge>
): boolean {
  return classifyFA(nodes, edges) === 'NFA';
}
