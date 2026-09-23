import {
  SolverGraphInput,
  MachineAnalysisResult,
  ExecutionExplanationResult,
  StepDerivation,
  DFAExecutionStep,
  NFAExecutionStep,
} from './types';
import { validateDFA } from './dfa-validator';
import { validateNFA, normalizeSymbol, isEpsilonSymbol } from './nfa-validator';
import { validatePDA } from './pda-validator';
import { validateTM } from './tm-validator';
import { analyzeDFACompleteness } from './dfa-validator';
import { executeDFA } from './dfa-executor';
import { executeNFA, epsilonClosure } from './nfa-executor';
import { AutomatonType } from '@project-zero/shared';

/**
 * Pure deterministic function: Inspects a graph and computes structured analysis facts.
 */
export function analyzeMachine(
  graph: SolverGraphInput,
  machineType: AutomatonType = 'DFA'
): MachineAnalysisResult {
  const { nodes, edges } = graph;

  const rawSymbols = edges
    .map((e) => normalizeSymbol(e.label))
    .filter((l) => l.length > 0 && !isEpsilonSymbol(l));
  const alphabet = Array.from(new Set(rawSymbols)).sort();

  const initialNode = nodes.find((n) => n.isInitial);
  const acceptingNodes = nodes.filter((n) => n.isAccepting);

  // Compute Reachable States from initial state via BFS
  const reachableSet = new Set<string>();
  if (initialNode) {
    const queue = [initialNode.id];
    reachableSet.add(initialNode.id);

    while (queue.length > 0) {
      const currId = queue.shift()!;
      const outgoingEdges = edges.filter((e) => e.sourceNodeId === currId);
      for (const edge of outgoingEdges) {
        if (!reachableSet.has(edge.targetNodeId)) {
          reachableSet.add(edge.targetNodeId);
          queue.push(edge.targetNodeId);
        }
      }
    }
  }

  const reachableStateIds = Array.from(reachableSet);
  const unreachableStateIds = nodes.filter((n) => !reachableSet.has(n.id)).map((n) => n.id);

  // Identify Dead / Trap States (Non-accepting states with self-loops on all alphabet symbols and no outgoing path to an accepting state)
  const trapStateIds: string[] = [];
  for (const node of nodes) {
    if (node.isAccepting) continue;

    // Check if any path exists from node to an accepting state
    const canReachAccepting = (() => {
      const visited = new Set<string>([node.id]);
      const queue = [node.id];
      while (queue.length > 0) {
        const currId = queue.shift()!;
        const currNode = nodes.find((n) => n.id === currId);
        if (currNode?.isAccepting) return true;

        const out = edges.filter((e) => e.sourceNodeId === currId);
        for (const e of out) {
          if (!visited.has(e.targetNodeId)) {
            visited.add(e.targetNodeId);
            queue.push(e.targetNodeId);
          }
        }
      }
      return false;
    })();

    if (!canReachAccepting && reachableSet.has(node.id)) {
      trapStateIds.push(node.id);
    }
  }

  // Compute Co-accessible States (states that can reach at least one accepting state)
  const coaccessibleSet = new Set<string>();
  const acceptingIds = acceptingNodes.map((n) => n.id);
  const revQueue = [...acceptingIds];
  acceptingIds.forEach((id) => coaccessibleSet.add(id));

  while (revQueue.length > 0) {
    const currId = revQueue.shift()!;
    const incomingEdges = edges.filter((e) => e.targetNodeId === currId);
    for (const edge of incomingEdges) {
      if (!coaccessibleSet.has(edge.sourceNodeId)) {
        coaccessibleSet.add(edge.sourceNodeId);
        revQueue.push(edge.sourceNodeId);
      }
    }
  }
  const coaccessibleStateIds = Array.from(coaccessibleSet);

  // Language Emptiness Detection: L(M) = ∅ iff no accepting state is reachable from q₀
  const isLanguageEmpty = !acceptingNodes.some((acc) => reachableSet.has(acc.id));

  // Detect Epsilon Transitions & Cycles
  const hasEpsilonTransitions = edges.some((e) => isEpsilonSymbol(e.label));
  let hasEpsilonCycles = false;
  if (hasEpsilonTransitions) {
    for (const node of nodes) {
      const closure = epsilonClosure([node.id], graph);
      const epsOut = edges.filter((e) => isEpsilonSymbol(e.label) && e.sourceNodeId === node.id);
      if (epsOut.some((e) => closure.some((c) => c.id === e.targetNodeId && c.id === node.id))) {
        hasEpsilonCycles = true;
        break;
      }
    }
  }

  // Detect Nondeterministic Branching
  let hasNondeterministicBranching = hasEpsilonTransitions;
  if (!hasNondeterministicBranching) {
    for (const node of nodes) {
      const symbolsSeen = new Set<string>();
      const outEdges = edges.filter((e) => e.sourceNodeId === node.id);
      for (const e of outEdges) {
        const norm = normalizeSymbol(e.label);
        if (symbolsSeen.has(norm)) {
          hasNondeterministicBranching = true;
          break;
        }
        symbolsSeen.add(norm);
      }
      if (hasNondeterministicBranching) break;
    }
  }

  const effectiveMachineType =
    machineType === 'FA'
      ? (hasNondeterministicBranching ? 'NFA' : 'DFA')
      : machineType;

  const valRes =
    effectiveMachineType === 'TM'
      ? validateTM(graph)
      : effectiveMachineType === 'PDA'
      ? validatePDA(graph)
      : effectiveMachineType === 'NFA'
      ? validateNFA(graph)
      : validateDFA(graph);
  const completenessRes = analyzeDFACompleteness(graph);

  // Generate Observations based strictly on deterministic facts
  const observations: string[] = [];

  if (machineType === 'FA') {
    observations.push(
      hasNondeterministicBranching
        ? 'Finite Automaton Classification: Nondeterministic (NFA) — contains non-deterministic branching or ε-transitions.'
        : 'Finite Automaton Classification: Deterministic (DFA) — single deterministic transition per symbol with no ε-transitions.'
    );
  }

  if (!initialNode) {
    observations.push('No initial start state (q₀) is designated.');
  } else {
    observations.push(`Initial state is '${initialNode.label}'.`);
    if (initialNode.isAccepting) {
      observations.push(`The initial state '${initialNode.label}' is also an accepting state (accepts empty string ε).`);
    }
  }

  if (acceptingNodes.length === 0) {
    observations.push('The automaton has no accepting states (F = ∅). All inputs will be rejected.');
  } else {
    observations.push(`Accepting set contains ${acceptingNodes.length} state(s): { ${acceptingNodes.map((n) => n.label).join(', ')} }.`);
  }

  if (isLanguageEmpty) {
    observations.push('Language Emptiness: L(M) = ∅ (No accepting state is reachable from initial start state).');
  }

  if (unreachableStateIds.length > 0) {
    const unLabels = nodes.filter((n) => unreachableStateIds.includes(n.id)).map((n) => n.label);
    observations.push(`Unreachable states detected (${unreachableStateIds.length}): { ${unLabels.join(', ')} }.`);
  } else if (nodes.length > 0 && initialNode) {
    observations.push('All states are reachable from the initial start state.');
  }

  if (trapStateIds.length > 0) {
    const trapLabels = nodes.filter((n) => trapStateIds.includes(n.id)).map((n) => n.label);
    observations.push(`Trap/Dead state(s) detected: { ${trapLabels.join(', ')} }.`);
  }

  if (machineType === 'DFA') {
    if (completenessRes.isComplete) {
      observations.push('The DFA is complete: every state defines transitions for all symbols in Σ.');
    } else if (alphabet.length > 0) {
      observations.push(`Incomplete DFA: missing ${completenessRes.missingTransitions.length} transition mapping(s).`);
    }
  } else {
    if (hasEpsilonTransitions) {
      observations.push('Contains ε/λ transitions (nondeterministic state jumps).');
    }
    if (hasNondeterministicBranching) {
      observations.push('Contains nondeterministic branching (multiple paths on the same symbol).');
    }
  }

  return {
    machineType,
    stateCount: nodes.length,
    transitionCount: edges.length,
    alphabet,
    initialStateId: initialNode?.id,
    initialStateLabel: initialNode?.label,
    acceptingStateIds: acceptingNodes.map((n) => n.id),
    acceptingStateLabels: acceptingNodes.map((n) => n.label),
    reachableStateIds,
    unreachableStateIds,
    coaccessibleStateIds,
    trapStateIds,
    missingDFATransitionCount: completenessRes.missingTransitions.length,
    hasNondeterministicBranching,
    hasEpsilonTransitions,
    hasEpsilonCycles,
    isStructurallyValid: valRes.isValid,
    isCompleteDFA: completenessRes.isComplete,
    isLanguageEmpty,
    observations,
  };
}

/**
 * Pure deterministic function: Generates a human-readable explanation and formal derivation proof for an execution run.
 */
export function explainExecutionRun(
  graph: SolverGraphInput,
  inputString: string,
  machineType: AutomatonType = 'DFA'
): ExecutionExplanationResult {
  const isNFA = machineType === 'NFA';
  const execResult = isNFA ? executeNFA(graph, inputString) : executeDFA(graph, inputString);

  const stepSummaries: string[] = [];
  const derivations: StepDerivation[] = [];

  if (isNFA) {
    execResult.steps.forEach((step, idx) => {
      const nfaStep = step as NFAExecutionStep;
      const stateLabels = nfaStep.nextStates.map((s) => s.label).join(', ');
      const symbol = nfaStep.readSymbol ? `'${nfaStep.readSymbol}'` : 'ε';
      stepSummaries.push(
        `Step ${idx}: Read ${symbol} → Active State Set = { ${stateLabels} }`
      );
    });
  } else {
    execResult.steps.forEach((step, idx) => {
      const dfaStep = step as DFAExecutionStep;
      const fromLabel = dfaStep.currentStateLabel || dfaStep.currentStateId;
      const toLabel = dfaStep.nextStateLabel || dfaStep.nextStateId;
      const sym = dfaStep.readSymbol;

      if (dfaStep.readSymbol === null) {
        stepSummaries.push(`Step ${idx}: Start at initial state '${fromLabel}'`);
      } else {
        stepSummaries.push(
          `Step ${idx + 1}: Read '${sym}' from '${fromLabel}' → Move to '${toLabel}'`
        );

        derivations.push({
          stepIndex: idx + 1,
          fromState: fromLabel,
          symbol: String(sym ?? ''),
          toState: toLabel || '',
          formalNotation: `δ(${fromLabel}, ${sym}) = ${toLabel}`,
        });
      }
    });
  }

  // Build Formal Derivation Proof Text
  let formalProofText = '';
  if (execResult.steps.length > 0) {
    if (!isNFA && derivations.length > 0) {
      const derivStr = derivations.map((d) => d.formalNotation).join('\n');
      const finalStep = execResult.steps[execResult.steps.length - 1] as DFAExecutionStep;
      const finalStateLabel =
        ('finalStateLabel' in execResult ? (execResult as any).finalStateLabel : undefined) ||
        finalStep.nextStateLabel ||
        finalStep.nextStateId ||
        finalStep.currentStateLabel ||
        finalStep.currentStateId ||
        'q_final';

      formalProofText = `${derivStr}\n\nδ*(${graph.nodes.find((n) => n.isInitial)?.label || 'q₀'}, "${inputString}") = ${finalStateLabel}\n\nSince '${finalStateLabel}' ${
        execResult.isAccepted ? '∈ F (Accepting Set), therefore string is ACCEPTED.' : '∉ F (Accepting Set), therefore string is REJECTED.'
      }`;
    } else {
      const finalStep = execResult.steps[execResult.steps.length - 1] as NFAExecutionStep;
      const activeLabels = isNFA
        ? finalStep.nextStates?.map((s) => s.label).join(', ')
        : (finalStep as unknown as DFAExecutionStep).currentStateLabel;

      formalProofText = `Active state set after consuming "${inputString}": { ${activeLabels} }\n\nIntersection with Accepting Set F: ${
        execResult.isAccepted ? 'Non-empty (✓ ACCEPTED)' : 'Empty ∅ (✕ REJECTED)'
      }`;
    }
  } else {
    formalProofText = `Execution halted due to invalid machine structure.`;
  }

  const intuitionSummary = execResult.isAccepted
    ? `Input "${inputString}" successfully reaches an accepting state in ${execResult.steps.length - 1} step(s).`
    : `Input "${inputString}" fails to reach an accepting state (${execResult.rejectionReason || 'Non-accepting state'}).`;

  return {
    inputString,
    machineType: isNFA ? 'NFA' : 'DFA',
    isAccepted: execResult.isAccepted,
    rejectionReason: execResult.rejectionReason,
    stepSummaries,
    derivations,
    formalProofText,
    intuitionSummary,
  };
}
