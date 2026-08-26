import { SolverGraphInput, NFAConversionResult, NFAConversionSubsetMap } from './types';
import { validateNFA, normalizeSymbol, isEpsilonSymbol } from './nfa-validator';
import { epsilonClosure, nfaMove } from './nfa-executor';
import { StateNode, TransitionEdge } from '@project-zero/canvas-renderer';

/**
 * Pure function: Computes canonical subset key string from NFA state nodes.
 * Orders IDs deterministically so {q1, q0} and {q0, q1} produce the exact same key.
 */
export function getCanonicalSubsetKey(states: ReadonlyArray<StateNode>): string {
  if (states.length === 0) return 'Ø';
  const sortedIds = [...states.map((s) => s.id)].sort();
  return sortedIds.join(',');
}

/**
 * Pure function: Creates a human-readable, deterministic label for a subset of NFA states.
 * E.g. {q0, q1} or Ø for empty set.
 */
export function getCanonicalSubsetLabel(states: ReadonlyArray<StateNode>): string {
  if (states.length === 0) return 'Ø';
  const sortedLabels = [...states.map((s) => s.label || s.id)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return `{${sortedLabels.join(',')}}`;
}

/**
 * Pure function: Converts a valid NFA into an equivalent deterministic DFA using standard Subset Construction.
 */
export function convertNfaToDfa(graph: SolverGraphInput): NFAConversionResult {
  const validationResult = validateNFA(graph);
  if (!validationResult.isValid) {
    return {
      success: false,
      nodes: [],
      edges: [],
      subsets: [],
      alphabet: [],
      validationResult,
      errorMessage: `NFA validation failed with ${validationResult.errors.length} error(s). ${validationResult.errors[0]?.message || 'Cannot convert invalid NFA.'}`,
    };
  }

  const initialNfaNode = graph.nodes.find((n) => n.isInitial);
  if (!initialNfaNode) {
    return {
      success: false,
      nodes: [],
      edges: [],
      subsets: [],
      alphabet: [],
      validationResult,
      errorMessage: 'No initial state defined in NFA.',
    };
  }

  // Derive DFA alphabet (exclude ε / λ symbols)
  const rawSymbols = graph.edges
    .map((e) => normalizeSymbol(e.label))
    .filter((l) => l.length > 0 && !isEpsilonSymbol(l));
  const alphabet = Array.from(new Set(rawSymbols)).sort();

  // 1. Compute initial subset: ε-closure({q0})
  const initialSubsetNodes = epsilonClosure([initialNfaNode.id], graph);

  // Map key -> generated DFA node info
  const subsetMap = new Map<
    string,
    {
      id: string;
      label: string;
      nodes: StateNode[];
      isInitial: boolean;
      isAccepting: boolean;
      gridIndex: number;
    }
  >();

  const workQueue: string[] = [];

  const createDfaState = (nodes: StateNode[], isInitial: boolean): string => {
    const key = getCanonicalSubsetKey(nodes);
    if (subsetMap.has(key)) {
      return subsetMap.get(key)!.id;
    }

    const index = subsetMap.size;
    const id = `dfa_s${index}`;
    const label = getCanonicalSubsetLabel(nodes);
    const isAccepting = nodes.some((n) => n.isAccepting);

    subsetMap.set(key, {
      id,
      label,
      nodes,
      isInitial,
      isAccepting,
      gridIndex: index,
    });

    workQueue.push(key);
    return id;
  };

  createDfaState(initialSubsetNodes, true);

  const generatedTransitions: { sourceId: string; targetId: string; symbol: string }[] = [];
  const steps: import('./types').NFAConversionStep[] = [];
  let stepCounter = 0;

  // BFS Worklist Traversal
  while (workQueue.length > 0) {
    const currentKey = workQueue.shift()!;
    const currentInfo = subsetMap.get(currentKey)!;

    for (const symbol of alphabet) {
      const movedNodes = nfaMove(currentInfo.nodes, symbol, graph);
      const targetSubsetNodes = epsilonClosure(
        movedNodes.map((n) => n.id),
        graph
      );
      const targetKey = getCanonicalSubsetKey(targetSubsetNodes);
      const isAlreadyKnown = subsetMap.has(targetKey);

      let targetId: string;
      if (isAlreadyKnown) {
        targetId = subsetMap.get(targetKey)!.id;
      } else {
        targetId = createDfaState(targetSubsetNodes, false);
      }

      const targetInfo = subsetMap.get(targetKey)!;

      steps.push({
        stepIndex: stepCounter++,
        currentDfaStateId: currentInfo.id,
        currentDfaStateLabel: currentInfo.label,
        currentNfaStateIds: currentInfo.nodes.map((n) => n.id),
        currentNfaStateLabels: currentInfo.nodes.map((n) => n.label || n.id),
        symbol,
        movedNfaStateIds: movedNodes.map((n) => n.id),
        movedNfaStateLabels: movedNodes.map((n) => n.label || n.id),
        targetEpsilonClosureIds: targetSubsetNodes.map((n) => n.id),
        targetEpsilonClosureLabels: targetSubsetNodes.map((n) => n.label || n.id),
        targetDfaStateId: targetId,
        targetDfaStateLabel: targetInfo.label,
        isNewState: !isAlreadyKnown,
        isAccepting: targetInfo.isAccepting,
        isTrap: targetSubsetNodes.length === 0,
      });

      generatedTransitions.push({
        sourceId: currentInfo.id,
        targetId,
        symbol,
      });
    }
  }

  // 2. Generate layout coordinates for output DFA StateNodes
  const totalStates = subsetMap.size;
  const cols = Math.max(2, Math.ceil(Math.sqrt(totalStates)));

  const dfaNodes: StateNode[] = [];
  const subsetsSummary: NFAConversionSubsetMap[] = [];

  for (const info of subsetMap.values()) {
    const col = info.gridIndex % cols;
    const row = Math.floor(info.gridIndex / cols);

    const x = 150 + col * 200;
    const y = 150 + row * 180;

    dfaNodes.push({
      id: info.id,
      label: info.label,
      x,
      y,
      isInitial: info.isInitial,
      isAccepting: info.isAccepting,
    });

    subsetsSummary.push({
      dfaStateId: info.id,
      dfaStateLabel: info.label,
      nfaStateIds: info.nodes.map((n) => n.id),
      nfaStateLabels: info.nodes.map((n) => n.label || n.id),
      isInitial: info.isInitial,
      isAccepting: info.isAccepting,
    });
  }

  // 3. Generate TransitionEdges (merge parallel edges where applicable)
  const dfaEdges: TransitionEdge[] = [];
  let edgeCounter = 1;

  for (const tr of generatedTransitions) {
    dfaEdges.push({
      id: `dfa_e${edgeCounter++}`,
      sourceNodeId: tr.sourceId,
      targetNodeId: tr.targetId,
      label: tr.symbol,
    });
  }

  const result: NFAConversionResult = {
    success: true,
    nodes: dfaNodes,
    edges: dfaEdges,
    subsets: subsetsSummary,
    alphabet,
    validationResult,
    trace: {
      initialSubsetIds: initialSubsetNodes.map((n) => n.id),
      initialSubsetLabels: initialSubsetNodes.map((n) => n.label || n.id),
      steps,
      conversionResult: {} as NFAConversionResult,
    },
  };

  return result;
}

export function convertNfaToDfaWithTrace(graph: SolverGraphInput): NFAConversionResult {
  return convertNfaToDfa(graph);
}
