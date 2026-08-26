import { SolverGraphInput, DFAMinimizationResult, DFAMinimizationEquivalenceClass } from './types';
import { validateDFA } from './dfa-validator';
import { normalizeSymbol, isEpsilonSymbol } from './nfa-validator';
import { StateNode, TransitionEdge } from '@project-zero/canvas-renderer';

/**
 * Pure deterministic function: Minimizes a valid DFA using standard Partition Refinement mathematics.
 * Removes unreachable states, completes missing transitions via a trap state if required, and merges equivalent states.
 */
export function minimizeDFA(graph: SolverGraphInput): DFAMinimizationResult {
  const validationResult = validateDFA(graph);
  if (!validationResult.isValid) {
    return {
      success: false,
      nodes: [],
      edges: [],
      equivalenceClasses: [],
      originalStateCount: graph.nodes.length,
      reachableStateCount: 0,
      unreachableStateCount: graph.nodes.length,
      minimizedStateCount: 0,
      mergedStateCount: 0,
      isAlreadyMinimal: false,
      validationResult,
      errorMessage: `DFA validation failed with ${validationResult.errors.length} error(s). ${validationResult.errors[0]?.message || 'Cannot minimize invalid DFA.'}`,
    };
  }

  const initialNode = graph.nodes.find((n) => n.isInitial);
  if (!initialNode) {
    return {
      success: false,
      nodes: [],
      edges: [],
      equivalenceClasses: [],
      originalStateCount: graph.nodes.length,
      reachableStateCount: 0,
      unreachableStateCount: graph.nodes.length,
      minimizedStateCount: 0,
      mergedStateCount: 0,
      isAlreadyMinimal: false,
      validationResult,
      errorMessage: 'No initial state defined in DFA.',
    };
  }

  // Derive alphabet
  const rawSymbols = graph.edges
    .map((e) => normalizeSymbol(e.label))
    .filter((l) => l.length > 0 && !isEpsilonSymbol(l));
  const alphabet = Array.from(new Set(rawSymbols)).sort();

  // 1. Compute Reachable States from initial state q0 via BFS
  const reachableSet = new Set<string>();
  const queue = [initialNode.id];
  reachableSet.add(initialNode.id);

  while (queue.length > 0) {
    const currId = queue.shift()!;
    const outgoing = graph.edges.filter((e) => e.sourceNodeId === currId);
    for (const edge of outgoing) {
      if (!reachableSet.has(edge.targetNodeId)) {
        reachableSet.add(edge.targetNodeId);
        queue.push(edge.targetNodeId);
      }
    }
  }

  const reachableNodes = graph.nodes.filter((n) => reachableSet.has(n.id));
  const unreachableStateCount = graph.nodes.length - reachableNodes.length;

  if (reachableNodes.length === 0) {
    return {
      success: true,
      nodes: [],
      edges: [],
      equivalenceClasses: [],
      originalStateCount: graph.nodes.length,
      reachableStateCount: 0,
      unreachableStateCount,
      minimizedStateCount: 0,
      mergedStateCount: 0,
      isAlreadyMinimal: true,
      validationResult,
    };
  }

  // 2. Handle Implicit Trap State if transitions are incomplete
  const TRAP_ID = '__implicit_trap__';
  let needsImplicitTrap = false;
  for (const node of reachableNodes) {
    for (const sym of alphabet) {
      const hasEdge = graph.edges.some((e) => e.sourceNodeId === node.id && normalizeSymbol(e.label) === sym);
      if (!hasEdge) {
        needsImplicitTrap = true;
        break;
      }
    }
    if (needsImplicitTrap) break;
  }

  const augmentedNodes: StateNode[] = [...reachableNodes];
  if (needsImplicitTrap) {
    augmentedNodes.push({
      id: TRAP_ID,
      label: 'Ø',
      x: 0,
      y: 0,
      isInitial: false,
      isAccepting: false,
    });
  }

  // Helper: Transition lookup δ(stateId, symbol)
  const getNextStateId = (stateId: string, sym: string): string => {
    if (stateId === TRAP_ID) return TRAP_ID;
    const edge = graph.edges.find((e) => e.sourceNodeId === stateId && normalizeSymbol(e.label) === sym);
    if (!edge) return TRAP_ID;
    // If target node is unreachable, it redirects to trap in minimized model
    return reachableSet.has(edge.targetNodeId) ? edge.targetNodeId : TRAP_ID;
  };

  // 3. Partition Refinement Algorithm
  // Initial Partition P0 = { Accepting, Non-Accepting }
  let partitions: string[][] = [];
  const acceptingGroup = augmentedNodes.filter((n) => n.isAccepting).map((n) => n.id);
  const nonAcceptingGroup = augmentedNodes.filter((n) => !n.isAccepting).map((n) => n.id);

  if (acceptingGroup.length > 0) partitions.push(acceptingGroup);
  if (nonAcceptingGroup.length > 0) partitions.push(nonAcceptingGroup);

  const minimizationSteps: import('./types').DFAMinimizationStep[] = [];
  let stepCounter = 0;
  let iterationCounter = 0;

  const nodeMap = new Map(augmentedNodes.map((n) => [n.id, n]));
  const getLabelsForGroup = (group: string[]) => group.map((id) => nodeMap.get(id)?.label || id);

  let changed = true;
  while (changed) {
    changed = false;
    iterationCounter++;
    const newPartitions: string[][] = [];
    const allSignatures: Record<string, string> = {};

    for (const group of partitions) {
      if (group.length <= 1) {
        newPartitions.push(group);
        continue;
      }

      // Split group based on transition signatures (group indices of targets for each symbol)
      const subGroups = new Map<string, string[]>();

      for (const stateId of group) {
        const signatureParts: number[] = [];
        for (const sym of alphabet) {
          const targetId = getNextStateId(stateId, sym);
          const targetGroupIdx = partitions.findIndex((p) => p.includes(targetId));
          signatureParts.push(targetGroupIdx);
        }
        const sig = signatureParts.join(',');
        allSignatures[stateId] = sig;

        if (!subGroups.has(sig)) {
          subGroups.set(sig, []);
        }
        subGroups.get(sig)!.push(stateId);
      }

      const split = Array.from(subGroups.values());
      if (split.length > 1) {
        changed = true;
      }
      newPartitions.push(...split);
    }

    minimizationSteps.push({
      stepIndex: stepCounter++,
      iteration: iterationCounter,
      currentPartitions: newPartitions,
      currentPartitionLabels: newPartitions.map(getLabelsForGroup),
      splitOccurred: changed,
      description: changed
        ? `Iteration ${iterationCounter}: Partition split occurred based on transition signatures.`
        : `Iteration ${iterationCounter}: Partition stabilized. No further splits possible.`,
      signatures: allSignatures,
    });

    partitions = newPartitions;
  }

  // Filter out pure implicit trap partition if no transitions lead into it
  const finalPartitions = partitions.filter((group) => {
    if (group.length === 1 && group[0] === TRAP_ID) {
      // Check if any real state actually transitions into TRAP_ID
      const isTargetedByRealState = reachableNodes.some((node) =>
        alphabet.some((sym) => getNextStateId(node.id, sym) === TRAP_ID)
      );
      return isTargetedByRealState;
    }
    return true;
  });

  // 4. Construct Minimized DFA Graph
  const minNodes: StateNode[] = [];
  const equivalenceClasses: DFAMinimizationEquivalenceClass[] = [];

  // Sort partitions deterministically by smallest original state ID or initial state presence
  finalPartitions.sort((a, b) => {
    const aHasInitial = a.includes(initialNode.id);
    const bHasInitial = b.includes(initialNode.id);
    if (aHasInitial) return -1;
    if (bHasInitial) return 1;

    const minA = [...a].sort()[0];
    const minB = [...b].sort()[0];
    return minA.localeCompare(minB);
  });

  const totalMinStates = finalPartitions.length;
  const cols = Math.max(2, Math.ceil(Math.sqrt(totalMinStates)));

  finalPartitions.forEach((group, idx) => {
    const realStateIds = group.filter((id) => id !== TRAP_ID).sort();
    const realStateNodes = reachableNodes.filter((n) => realStateIds.includes(n.id));

    const isInitial = group.includes(initialNode.id);
    const isAccepting = realStateNodes.some((n) => n.isAccepting);

    const minId = `min_q${idx}`;
    let minLabel = '';
    if (realStateNodes.length === 0) {
      minLabel = 'Ø';
    } else if (realStateNodes.length === 1) {
      minLabel = realStateNodes[0].label || realStateNodes[0].id;
    } else {
      const sortedLabels = [...realStateNodes.map((n) => n.label || n.id)].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );
      minLabel = `{${sortedLabels.join(',')}}`;
    }

    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = 150 + col * 200;
    const y = 150 + row * 180;

    minNodes.push({
      id: minId,
      label: minLabel,
      x,
      y,
      isInitial,
      isAccepting,
    });

    equivalenceClasses.push({
      minimizedStateId: minId,
      minimizedStateLabel: minLabel,
      originalStateIds: realStateIds,
      originalStateLabels: realStateNodes.map((n) => n.label || n.id),
      isInitial,
      isAccepting,
    });
  });

  // Construct Minimized Edges
  const minEdges: TransitionEdge[] = [];
  let edgeCounter = 1;

  finalPartitions.forEach((sourceGroup, sourceIdx) => {
    const sourceMinId = `min_q${sourceIdx}`;
    const repStateId = sourceGroup[0];

    for (const sym of alphabet) {
      const targetId = getNextStateId(repStateId, sym);
      const targetGroupIdx = finalPartitions.findIndex((p) => p.includes(targetId));

      if (targetGroupIdx !== -1) {
        const targetMinId = `min_q${targetGroupIdx}`;
        minEdges.push({
          id: `min_e${edgeCounter++}`,
          sourceNodeId: sourceMinId,
          targetNodeId: targetMinId,
          label: sym,
        });
      }
    }
  });

  const isAlreadyMinimal =
    reachableNodes.length === minNodes.length && unreachableStateCount === 0;

  const initialPartitions = [acceptingGroup, nonAcceptingGroup].filter((g) => g.length > 0);

  const result: DFAMinimizationResult = {
    success: true,
    nodes: minNodes,
    edges: minEdges,
    equivalenceClasses,
    originalStateCount: graph.nodes.length,
    reachableStateCount: reachableNodes.length,
    unreachableStateCount,
    minimizedStateCount: minNodes.length,
    mergedStateCount: reachableNodes.length - minNodes.length,
    isAlreadyMinimal,
    validationResult,
    trace: {
      reachableStateIds: Array.from(reachableSet),
      unreachableStateIds: graph.nodes.filter((n) => !reachableSet.has(n.id)).map((n) => n.id),
      initialPartitions,
      steps: minimizationSteps,
      finalPartitions,
      minimizationResult: {} as DFAMinimizationResult,
    },
  };

  return result;
}

export function minimizeDFAWithTrace(graph: SolverGraphInput): DFAMinimizationResult {
  return minimizeDFA(graph);
}
