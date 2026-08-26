import { SolverGraphInput, DFAValidationResult, DFAValidationError } from './types';

export const CANONICAL_EPSILON = 'ε';

/**
 * Normalizes input transition label to canonical epsilon ('ε') if it matches known representations ('ε', 'λ').
 * Plain letters like 'e' or strings like 'epsilon' are NOT converted to epsilon.
 */
export function normalizeSymbol(symbol: string): string {
  if (!symbol) return '';
  const trimmed = symbol.trim();
  if (trimmed === 'ε' || trimmed === 'λ') {
    return CANONICAL_EPSILON;
  }
  return trimmed;
}

export function isEpsilonSymbol(symbol: string): boolean {
  return normalizeSymbol(symbol) === CANONICAL_EPSILON;
}

/**
 * Validates whether a graph qualifies as a mathematically sound Nondeterministic Finite Automaton (NFA).
 *
 * NFA Rules:
 *  1. Exactly 1 initial start state.
 *  2. No empty/blank transition labels (must have a valid symbol or ε/λ).
 *  3. Multiple transitions on the same symbol ARE ALLOWED.
 *  4. Epsilon transitions (ε, λ) ARE ALLOWED.
 *  5. Dangling transition endpoints are invalid.
 *  6. 0 or more accepting states allowed.
 */
export function validateNFA(graph: SolverGraphInput): DFAValidationResult {
  const errors: DFAValidationError[] = [];
  const warnings: string[] = [];

  const initialNodes = graph.nodes.filter((n) => n.isInitial);
  if (initialNodes.length === 0) {
    errors.push({
      code: 'MISSING_INITIAL_STATE',
      message: 'Missing initial start state (q₀). Designate exactly one state as initial.',
    });
  } else if (initialNodes.length > 1) {
    errors.push({
      code: 'MULTIPLE_INITIAL_STATES',
      message: `Multiple initial start states defined (${initialNodes.map((n) => n.label).join(', ')}). An NFA must have exactly one initial state.`,
      affectedStateIds: initialNodes.map((n) => n.id),
    });
  }

  const acceptingNodes = graph.nodes.filter((n) => n.isAccepting);
  if (acceptingNodes.length === 0) {
    errors.push({
      code: 'MISSING_ACCEPTING_STATE',
      message: 'Missing accepting/final state (F = ∅). Designate at least one state as an accepting state.',
    });
  }

  const emptySymbolEdges = graph.edges.filter((e) => !e.label || e.label.trim().length === 0);
  if (emptySymbolEdges.length > 0) {
    for (const edge of emptySymbolEdges) {
      const srcNode = graph.nodes.find((n) => n.id === edge.sourceNodeId);
      const tgtNode = graph.nodes.find((n) => n.id === edge.targetNodeId);
      const srcLabel = srcNode?.label || edge.sourceNodeId;
      const tgtLabel = tgtNode?.label || edge.targetNodeId;
      errors.push({
        code: 'EMPTY_TRANSITION_SYMBOL',
        message: `Transition ${srcLabel} → ${tgtLabel} has an empty input symbol.`,
        affectedStateIds: [edge.sourceNodeId],
        affectedTransitionIds: [edge.id],
      });
    }
  }

  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const danglingEdges = graph.edges.filter((e) => !nodeIds.has(e.sourceNodeId) || !nodeIds.has(e.targetNodeId));
  if (danglingEdges.length > 0) {
    for (const edge of danglingEdges) {
      errors.push({
        code: 'DANGLING_TRANSITION_ENDPOINT',
        message: `Transition ${edge.id} connects to a state node that no longer exists in the graph.`,
        affectedTransitionIds: [edge.id],
      });
    }
  }

  if (graph.nodes.length === 0) {
    warnings.push('Graph contains no state nodes.');
  }

  return {
    isValid: errors.length === 0,
    machineType: 'NFA',
    errors,
    warnings,
  };
}
