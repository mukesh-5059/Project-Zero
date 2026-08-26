import {
  SolverGraphInput,
  DFAExecutionResult,
  DFAExecutionStep,
  DFATransitionMatrix,
  DFATransitionMatrixEntry,
} from './types';
import { validateDFA } from './dfa-validator';
import { tokenizeInputStringStrict } from './tokenization';

/**
 * Executes a deterministic finite automaton (DFA) on a given input string.
 *
 * Algorithm:
 *  1. Validate DFA. If invalid, halt immediately with INVALID_MACHINE.
 *  2. Locate initial start state q₀.
 *  3. Tokenize input string.
 *  4. For each token:
 *      - Record step details.
 *      - Resolve δ(currentState, token).
 *      - If no transition exists, halt & reject with NO_TRANSITION.
 *      - Advance to target state.
 *  5. After final token:
 *      - If final state ∈ F, ACCEPT.
 *      - Else, REJECT with NON_ACCEPTING_FINAL_STATE.
 */
export function executeDFA(graph: SolverGraphInput, inputString: string): DFAExecutionResult {
  const validation = validateDFA(graph);
  if (!validation.isValid) {
    return {
      isAccepted: false,
      finalStateId: null,
      finalStateLabel: null,
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
      finalStateId: null,
      finalStateLabel: null,
      rejectionReason: 'INVALID_MACHINE',
      steps: [],
      inputString,
      validationResult: validation,
    };
  }

  // Derive alphabet
  const rawSymbols = graph.edges
    .map((e) => e.label)
    .filter((l) => l && l.trim().length > 0 && l !== 'ε' && l !== 'λ');
  const alphabet = Array.from(new Set(rawSymbols)).sort();

  const tokenRes = tokenizeInputStringStrict(inputString, alphabet);
  if (!tokenRes.success) {
    return {
      isAccepted: false,
      finalStateId: initialStateNode.id,
      finalStateLabel: initialStateNode.label || initialStateNode.id,
      rejectionReason: 'NO_TRANSITION',
      steps: [],
      inputString,
      validationResult: validation,
    };
  }

  const tokens = [...tokenRes.tokens];
  const steps: DFAExecutionStep[] = [];

  let currentState = initialStateNode;
  let remainingTokens = [...tokens];

  // If input string is empty
  if (tokens.length === 0) {
    const isAccepting = Boolean(currentState.isAccepting);
    steps.push({
      stepIndex: 0,
      currentStateId: currentState.id,
      currentStateLabel: currentState.label || currentState.id,
      readSymbol: null,
      remainingInput: 'ε',
      isHalted: true,
      isAccepting,
    });

    const hasAcceptingStates = graph.nodes.some((n) => n.isAccepting);
    return {
      isAccepted: isAccepting,
      finalStateId: currentState.id,
      finalStateLabel: currentState.label || currentState.id,
      rejectionReason: isAccepting ? undefined : hasAcceptingStates ? 'NON_ACCEPTING_FINAL_STATE' : 'NO_ACCEPTING_STATE',
      steps,
      inputString,
      validationResult: validation,
    };
  }

  for (let stepIndex = 0; stepIndex < tokens.length; stepIndex++) {
    const token = tokens[stepIndex];
    remainingTokens = tokens.slice(stepIndex + 1);
    const remainingStr = remainingTokens.length > 0 ? remainingTokens.join('') : 'ε';

    // Lookup δ(currentState, token)
    const outgoing = graph.edges.filter(
      (e) => e.sourceNodeId === currentState.id && e.label === token
    );

    if (outgoing.length === 0) {
      // Halted due to missing transition
      steps.push({
        stepIndex,
        currentStateId: currentState.id,
        currentStateLabel: currentState.label || currentState.id,
        readSymbol: token,
        remainingInput: remainingStr,
        isHalted: true,
        isAccepting: false,
      });

      return {
        isAccepted: false,
        finalStateId: currentState.id,
        finalStateLabel: currentState.label || currentState.id,
        rejectionReason: 'NO_TRANSITION',
        steps,
        inputString,
        validationResult: validation,
      };
    }

    const transition = outgoing[0];
    const targetNode = graph.nodes.find((n) => n.id === transition.targetNodeId);

    if (!targetNode) {
      steps.push({
        stepIndex,
        currentStateId: currentState.id,
        currentStateLabel: currentState.label || currentState.id,
        readSymbol: token,
        remainingInput: remainingStr,
        isHalted: true,
        isAccepting: false,
      });

      return {
        isAccepted: false,
        finalStateId: currentState.id,
        finalStateLabel: currentState.label || currentState.id,
        rejectionReason: 'NO_TRANSITION',
        steps,
        inputString,
        validationResult: validation,
      };
    }

    const isFinalStep = stepIndex === tokens.length - 1;
    const isAccepting = isFinalStep ? Boolean(targetNode.isAccepting) : false;

    steps.push({
      stepIndex,
      currentStateId: currentState.id,
      currentStateLabel: currentState.label || currentState.id,
      readSymbol: token,
      remainingInput: remainingStr,
      transitionId: transition.id,
      nextStateId: targetNode.id,
      nextStateLabel: targetNode.label || targetNode.id,
      isHalted: isFinalStep,
      isAccepting,
    });

    currentState = targetNode;
  }

  const isAccepted = Boolean(currentState.isAccepting);
  const hasAcceptingStates = graph.nodes.some((n) => n.isAccepting);

  return {
    isAccepted,
    finalStateId: currentState.id,
    finalStateLabel: currentState.label || currentState.id,
    rejectionReason: isAccepted ? undefined : hasAcceptingStates ? 'NON_ACCEPTING_FINAL_STATE' : 'NO_ACCEPTING_STATE',
    steps,
    inputString,
    validationResult: validation,
  };
}

/**
 * Computes a deterministic transition matrix (δ: Q × Σ → Q) for the given graph.
 */
export function computeTransitionMatrix(graph: SolverGraphInput): DFATransitionMatrix {
  const rawSymbols = graph.edges
    .map((e) => e.label)
    .filter((l) => l && l.trim().length > 0 && l !== 'ε' && l !== 'λ');
  const symbols = Array.from(new Set(rawSymbols)).sort();

  let hasAmbiguity = false;
  const entries: DFATransitionMatrixEntry[] = [];

  for (const node of graph.nodes) {
    const transitions: Record<string, string | null> = {};
    const ambiguityMap: Record<string, boolean> = {};

    for (const sym of symbols) {
      const matches = graph.edges.filter(
        (e) => e.sourceNodeId === node.id && e.label === sym
      );

      if (matches.length === 0) {
        transitions[sym] = null;
        ambiguityMap[sym] = false;
      } else if (matches.length === 1) {
        const targetNode = graph.nodes.find((n) => n.id === matches[0].targetNodeId);
        transitions[sym] = targetNode ? targetNode.label || targetNode.id : matches[0].targetNodeId;
        ambiguityMap[sym] = false;
      } else {
        // NFA duplicate transitions
        const targets = matches
          .map((m) => graph.nodes.find((n) => n.id === m.targetNodeId)?.label || m.targetNodeId)
          .join(', ');
        transitions[sym] = `{${targets}}`;
        ambiguityMap[sym] = true;
        hasAmbiguity = true;
      }
    }

    entries.push({
      stateId: node.id,
      stateLabel: node.label || node.id,
      isInitial: Boolean(node.isInitial),
      isAccepting: Boolean(node.isAccepting),
      transitions,
      hasAmbiguity: ambiguityMap,
    });
  }

  return {
    symbols,
    entries,
    hasAmbiguity,
  };
}
