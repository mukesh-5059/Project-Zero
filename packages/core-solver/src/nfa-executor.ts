import { SolverGraphInput, NFAExecutionResult, NFAExecutionStep, DFAValidationResult } from './types';
import { validateNFA, normalizeSymbol, isEpsilonSymbol } from './nfa-validator';
import { tokenizeInputStringStrict } from './tokenization';
import { StateNode } from '@project-zero/canvas-renderer';

/**
 * Pure function: Computes the ε-closure of a set of state IDs.
 *
 * ε-closure(S) includes:
 *  - every state already in S
 *  - every state reachable through 0 or more ε-transitions
 *
 * Prevents infinite loops on cyclic ε-transitions. Returns state nodes in deterministic graph order.
 */
export function epsilonClosure(
  stateIds: ReadonlyArray<string>,
  graph: SolverGraphInput
): StateNode[] {
  const visitedIds = new Set<string>();
  const queue: string[] = [];

  for (const id of stateIds) {
    if (graph.nodes.some((n) => n.id === id)) {
      visitedIds.add(id);
      queue.push(id);
    }
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const outgoingEpsilon = graph.edges.filter(
      (e) => e.sourceNodeId === currentId && isEpsilonSymbol(e.label)
    );

    for (const edge of outgoingEpsilon) {
      if (!visitedIds.has(edge.targetNodeId)) {
        if (graph.nodes.some((n) => n.id === edge.targetNodeId)) {
          visitedIds.add(edge.targetNodeId);
          queue.push(edge.targetNodeId);
        }
      }
    }
  }

  return graph.nodes.filter((n) => visitedIds.has(n.id));
}

/**
 * Pure function: Computes MOVE(S, a)
 *
 * MOVE(S, a) = set of all states reachable from any state in S using input symbol a.
 */
export function nfaMove(
  states: ReadonlyArray<StateNode>,
  symbol: string,
  graph: SolverGraphInput
): StateNode[] {
  const normSym = normalizeSymbol(symbol);
  if (!normSym || isEpsilonSymbol(normSym)) {
    return [];
  }

  const stateIds = new Set(states.map((s) => s.id));
  const targetIds = new Set<string>();

  for (const edge of graph.edges) {
    if (stateIds.has(edge.sourceNodeId) && normalizeSymbol(edge.label) === normSym) {
      if (graph.nodes.some((n) => n.id === edge.targetNodeId)) {
        targetIds.add(edge.targetNodeId);
      }
    }
  }

  return graph.nodes.filter((n) => targetIds.has(n.id));
}

/**
 * Pure function: Executes a Nondeterministic Finite Automaton (NFA) on an input string.
 */
export function executeNFA(graph: SolverGraphInput, inputString: string): NFAExecutionResult {
  const validation: DFAValidationResult = validateNFA(graph);
  if (!validation.isValid) {
    return {
      isAccepted: false,
      finalStates: [],
      acceptingStates: [],
      rejectionReason: 'INVALID_MACHINE',
      steps: [],
      inputString,
      validationResult: validation,
    };
  }

  const initialStateNode = graph.nodes.find((n) => n.isInitial);
  if (!initialStateNode) {
    return {
      isAccepted: false,
      finalStates: [],
      acceptingStates: [],
      rejectionReason: 'INVALID_MACHINE',
      steps: [],
      inputString,
      validationResult: validation,
    };
  }

  // Derive alphabet (excluding epsilon symbols)
  const rawSymbols = graph.edges
    .map((e) => normalizeSymbol(e.label))
    .filter((l) => l.length > 0 && !isEpsilonSymbol(l));
  const alphabet = Array.from(new Set(rawSymbols)).sort();

  const tokenRes = tokenizeInputStringStrict(inputString, alphabet);
  if (!tokenRes.success) {
    const initialClosure = epsilonClosure([initialStateNode.id], graph);
    return {
      isAccepted: false,
      finalStates: initialClosure.map((n) => ({ id: n.id, label: n.label || n.id })),
      acceptingStates: [],
      rejectionReason: 'NO_TRANSITION',
      steps: [],
      inputString,
      validationResult: validation,
    };
  }

  const tokens = [...tokenRes.tokens];
  const steps: NFAExecutionStep[] = [];

  let currentStates = [initialStateNode];
  let currentClosure = epsilonClosure([initialStateNode.id], graph);

  // Empty string case
  if (tokens.length === 0) {
    const accepting = currentClosure.filter((n) => n.isAccepting);
    const isAccepted = accepting.length > 0;

    steps.push({
      stepIndex: 0,
      currentStates: currentStates.map((n) => ({ id: n.id, label: n.label || n.id })),
      epsilonClosure: currentClosure.map((n) => ({ id: n.id, label: n.label || n.id })),
      readSymbol: null,
      remainingInput: 'ε',
      nextStates: currentClosure.map((n) => ({ id: n.id, label: n.label || n.id })),
      isHalted: true,
      isAccepting: isAccepted,
    });

    const hasAcceptingStates = graph.nodes.some((n) => n.isAccepting);
    return {
      isAccepted,
      finalStates: currentClosure.map((n) => ({ id: n.id, label: n.label || n.id })),
      acceptingStates: accepting.map((n) => ({ id: n.id, label: n.label || n.id })),
      rejectionReason: isAccepted ? undefined : hasAcceptingStates ? 'NON_ACCEPTING_FINAL_STATE' : 'NO_ACCEPTING_STATE',
      steps,
      inputString,
      validationResult: validation,
    };
  }

  for (let stepIndex = 0; stepIndex < tokens.length; stepIndex++) {
    const token = tokens[stepIndex];
    const remainingTokens = tokens.slice(stepIndex + 1);
    const remainingStr = remainingTokens.length > 0 ? remainingTokens.join('') : 'ε';

    // 1. Move on token from current closure
    const movedStates = nfaMove(currentClosure, token, graph);
    // 2. Expand epsilon closure of moved states
    const nextClosure = epsilonClosure(
      movedStates.map((s) => s.id),
      graph
    );

    const isFinalStep = stepIndex === tokens.length - 1;
    const acceptingInNext = nextClosure.filter((n) => n.isAccepting);
    const isHalted = movedStates.length === 0 || isFinalStep;
    const isStepAccepting = isFinalStep && acceptingInNext.length > 0;

    steps.push({
      stepIndex,
      currentStates: currentStates.map((n) => ({ id: n.id, label: n.label || n.id })),
      epsilonClosure: currentClosure.map((n) => ({ id: n.id, label: n.label || n.id })),
      readSymbol: token,
      remainingInput: remainingStr,
      nextStates: nextClosure.map((n) => ({ id: n.id, label: n.label || n.id })),
      isHalted,
      isAccepting: isStepAccepting,
    });

    if (movedStates.length === 0) {
      // Halted early: no valid transition on symbol token from any reachable state
      return {
        isAccepted: false,
        finalStates: currentClosure.map((n) => ({ id: n.id, label: n.label || n.id })),
        acceptingStates: [],
        rejectionReason: 'NO_TRANSITION',
        steps,
        inputString,
        validationResult: validation,
      };
    }

    currentStates = movedStates;
    currentClosure = nextClosure;
  }

  const finalAccepting = currentClosure.filter((n) => n.isAccepting);
  const isAccepted = finalAccepting.length > 0;
  const hasAcceptingStates = graph.nodes.some((n) => n.isAccepting);

  return {
    isAccepted,
    finalStates: currentClosure.map((n) => ({ id: n.id, label: n.label || n.id })),
    acceptingStates: finalAccepting.map((n) => ({ id: n.id, label: n.label || n.id })),
    rejectionReason: isAccepted ? undefined : hasAcceptingStates ? 'NON_ACCEPTING_FINAL_STATE' : 'NO_ACCEPTING_STATE',
    steps,
    inputString,
    validationResult: validation,
  };
}
