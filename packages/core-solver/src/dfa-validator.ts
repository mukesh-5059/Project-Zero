import { SolverGraphInput, DFAValidationResult, DFAValidationError, DFACompletenessResult, DFAMissingTransition } from './types';

/**
 * Validates whether a graph qualifies as a mathematically sound Deterministic Finite Automaton (DFA).
 *
 * DFA Rules:
 *  1. Exactly 1 initial start state.
 *  2. No empty/blank transition labels.
 *  3. No epsilon transitions (ε, λ).
 *  4. For every state q and symbol a ∈ Σ, at most one outgoing transition δ(q, a).
 *  5. 0 or more accepting states allowed.
 *  6. Dead states / states without outgoing transitions allowed.
 */
export function validateDFA(graph: SolverGraphInput): DFAValidationResult {
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
      message: `Multiple initial start states defined (${initialNodes.map((n) => n.label).join(', ')}). A DFA must have exactly one initial state.`,
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

  const epsilonEdges = graph.edges.filter((e) => e.label === 'ε' || e.label === 'λ');
  if (epsilonEdges.length > 0) {
    for (const edge of epsilonEdges) {
      const srcNode = graph.nodes.find((n) => n.id === edge.sourceNodeId);
      const tgtNode = graph.nodes.find((n) => n.id === edge.targetNodeId);
      const srcLabel = srcNode?.label || edge.sourceNodeId;
      const tgtLabel = tgtNode?.label || edge.targetNodeId;
      errors.push({
        code: 'EPSILON_TRANSITION',
        message: `Transition ${srcLabel} → ${tgtLabel} uses ${edge.label}. DFAs cannot contain ε-transitions.`,
        affectedStateIds: [edge.sourceNodeId],
        affectedTransitionIds: [edge.id],
      });
    }
  }

  // Check determinism: no state q has multiple transitions for the same symbol a
  for (const node of graph.nodes) {
    const outgoing = graph.edges.filter((e) => e.sourceNodeId === node.id);
    const symbolCounts = new Map<string, string[]>(); // symbol -> edgeIds

    for (const edge of outgoing) {
      if (!edge.label || edge.label === 'ε' || edge.label === 'λ') continue;
      const list = symbolCounts.get(edge.label) ?? [];
      list.push(edge.id);
      symbolCounts.set(edge.label, list);
    }

    for (const [symbol, edgeIds] of symbolCounts.entries()) {
      if (edgeIds.length > 1) {
        errors.push({
          code: 'DUPLICATE_SYMBOL_TRANSITION',
          message: `State ${node.label || node.id} has ${edgeIds.length} outgoing transitions on symbol '${symbol}'. DFAs must be deterministic.`,
          affectedStateIds: [node.id],
          affectedTransitionIds: edgeIds,
        });
      }
    }
  }

  if (graph.nodes.length === 0) {
    warnings.push('Graph contains no state nodes.');
  }

  return {
    isValid: errors.length === 0,
    machineType: 'DFA',
    errors,
    warnings,
  };
}

/**
 * Analyzes whether a graph is a COMPLETE DFA.
 * A DFA is complete iff for every state q ∈ Q and every symbol a ∈ Σ,
 * there exists at least one transition δ(q, a).
 *
 * Σ is derived dynamically from all valid, non-empty transition symbols in the graph.
 * Structural validity and completeness are distinct concepts.
 */
export function analyzeDFACompleteness(graph: SolverGraphInput): DFACompletenessResult {
  const alphabet = Array.from(
    new Set(
      graph.edges
        .map((e) => e.label)
        .filter((l) => l && l.trim().length > 0 && l !== 'ε' && l !== 'λ')
    )
  ).sort();

  const missingTransitions: DFAMissingTransition[] = [];

  for (const node of graph.nodes) {
    const nodeOutgoingEdges = graph.edges.filter((e) => e.sourceNodeId === node.id);
    const outgoingSymbols = new Set(nodeOutgoingEdges.map((e) => e.label));

    for (const symbol of alphabet) {
      if (!outgoingSymbols.has(symbol)) {
        missingTransitions.push({
          stateId: node.id,
          stateLabel: node.label || node.id,
          symbol,
        });
      }
    }
  }

  const totalRequiredTransitions = graph.nodes.length * alphabet.length;
  const totalPresentTransitions = totalRequiredTransitions - missingTransitions.length;

  return {
    isComplete: missingTransitions.length === 0,
    alphabet,
    missingTransitions,
    totalRequiredTransitions,
    totalPresentTransitions,
  };
}

