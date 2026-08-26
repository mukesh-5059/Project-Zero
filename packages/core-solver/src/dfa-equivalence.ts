import {
  SolverGraphInput,
  DFAEquivalenceResult,
  AutomataEquivalenceResult,
  ProductAutomatonStep,
  ProductDistinguishingConfig,
  DFAEquivalenceTrace,
} from './types';
import { validateDFA } from './dfa-validator';
import { validateNFA, normalizeSymbol, isEpsilonSymbol } from './nfa-validator';
import { convertNfaToDfa } from './nfa-to-dfa';
import { executeDFA } from './dfa-executor';
import { AutomatonType } from '@project-zero/shared';

const IMPLICIT_TRAP = '__implicit_trap__';

/**
 * Pure deterministic function: Performs product-automaton BFS over DFA A and DFA B
 * to test language equivalence L(M_A) = L(M_B).
 *
 * If not equivalent, returns the shortest counterexample string w ∈ L(M_A) ⊕ L(M_B).
 */
export function compareDFALanguages(
  graphA: SolverGraphInput,
  graphB: SolverGraphInput
): DFAEquivalenceResult {
  const isFatalError = (val: ReturnType<typeof validateDFA>) =>
    val.errors.some((e) => e.code !== 'MISSING_ACCEPTING_STATE');

  const valA = validateDFA(graphA);
  if (isFatalError(valA)) {
    return {
      isEquivalent: false,
      productStatesExplored: 0,
      errorMessage: `DFA A validation failed: ${valA.errors[0]?.message || 'Invalid machine'}`,
    };
  }

  const valB = validateDFA(graphB);
  if (isFatalError(valB)) {
    return {
      isEquivalent: false,
      productStatesExplored: 0,
      errorMessage: `DFA B validation failed: ${valB.errors[0]?.message || 'Invalid machine'}`,
    };
  }

  const initA = graphA.nodes.find((n) => n.isInitial);
  const initB = graphB.nodes.find((n) => n.isInitial);

  if (!initA || !initB) {
    return {
      isEquivalent: false,
      productStatesExplored: 0,
      errorMessage: 'Initial state missing in one of the DFAs.',
    };
  }

  // Combined Alphabet Σ = Σ_A ∪ Σ_B
  const extractAlphabet = (g: SolverGraphInput) =>
    g.edges
      .map((e) => normalizeSymbol(e.label))
      .filter((l) => l.length > 0 && !isEpsilonSymbol(l));

  const alphabetSet = new Set<string>([...extractAlphabet(graphA), ...extractAlphabet(graphB)]);
  // Sort symbols by length descending then alphabetically for deterministic longest-prefix evaluation
  const alphabet = Array.from(alphabetSet).sort((a, b) => b.length - a.length || a.localeCompare(b));

  const nodeMapA = new Map(graphA.nodes.map((n) => [n.id, n]));
  const nodeMapB = new Map(graphB.nodes.map((n) => [n.id, n]));

  const getLabelA = (id: string) => (id === IMPLICIT_TRAP ? 'Ø' : nodeMapA.get(id)?.label || id);
  const getLabelB = (id: string) => (id === IMPLICIT_TRAP ? 'Ø' : nodeMapB.get(id)?.label || id);

  const isAcceptingA = (id: string) => (id === IMPLICIT_TRAP ? false : Boolean(nodeMapA.get(id)?.isAccepting));
  const isAcceptingB = (id: string) => (id === IMPLICIT_TRAP ? false : Boolean(nodeMapB.get(id)?.isAccepting));

  const getNextStateA = (currId: string, sym: string): string => {
    if (currId === IMPLICIT_TRAP) return IMPLICIT_TRAP;
    const match = graphA.edges.find((e) => e.sourceNodeId === currId && normalizeSymbol(e.label) === sym);
    return match ? match.targetNodeId : IMPLICIT_TRAP;
  };

  const getNextStateB = (currId: string, sym: string): string => {
    if (currId === IMPLICIT_TRAP) return IMPLICIT_TRAP;
    const match = graphB.edges.find((e) => e.sourceNodeId === currId && normalizeSymbol(e.label) === sym);
    return match ? match.targetNodeId : IMPLICIT_TRAP;
  };

  // Product Automaton BFS State
  interface QueueItem {
    stateA: string;
    stateB: string;
    path: string[];
    historySteps: ProductAutomatonStep[];
  }

  const startKey = `${initA.id}|${initB.id}`;
  const visited = new Set<string>([startKey]);
  const queue: QueueItem[] = [
    {
      stateA: initA.id,
      stateB: initB.id,
      path: [],
      historySteps: [],
    },
  ];

  let exploredCount = 0;
  const maxProductStates = 5000;
  const initialPairLabel = `(${getLabelA(initA.id)}, ${getLabelB(initB.id)})`;
  let distinguishingConfig: ProductDistinguishingConfig | undefined;
  let recordedSteps: ProductAutomatonStep[] = [];

  while (queue.length > 0) {
    if (exploredCount >= maxProductStates) {
      return {
        isEquivalent: false,
        productStatesExplored: exploredCount,
        errorMessage: `Product automaton search limit reached (${maxProductStates} states explored).`,
      };
    }

    const current = queue.shift()!;
    exploredCount++;

    const accA = isAcceptingA(current.stateA);
    const accB = isAcceptingB(current.stateB);

    // Mismatch Condition: one accepts and the other rejects
    if (accA !== accB) {
      const counterexample = current.path.join('');
      const pairLabel = `(${getLabelA(current.stateA)}, ${getLabelB(current.stateB)})`;

      distinguishingConfig = {
        pairLabel,
        stateA: current.stateA,
        labelA: getLabelA(current.stateA),
        isAcceptingA: accA,
        stateB: current.stateB,
        labelB: getLabelB(current.stateB),
        isAcceptingB: accB,
        differentiatingSymbol: current.path[current.path.length - 1] || null,
      };

      // Verify counterexample execution against DFA A and DFA B
      const execA = executeDFA(graphA, counterexample);
      const execB = executeDFA(graphB, counterexample);

      const trace: DFAEquivalenceTrace = {
        initialPair: initialPairLabel,
        productStatesExplored: exploredCount,
        derivationSteps: current.historySteps,
        distinguishingConfig,
      };

      return {
        isEquivalent: false,
        counterexample,
        acceptsA: execA.isAccepted,
        acceptsB: execB.isAccepted,
        productStatesExplored: exploredCount,
        trace,
      };
    }

    // Expand product state transitions across combined alphabet Σ
    for (const sym of alphabet) {
      const nextA = getNextStateA(current.stateA, sym);
      const nextB = getNextStateB(current.stateB, sym);
      const key = `${nextA}|${nextB}`;

      const nextAccA = isAcceptingA(nextA);
      const nextAccB = isAcceptingB(nextB);
      const isMismatch = nextAccA !== nextAccB;

      const step: ProductAutomatonStep = {
        stepIndex: current.historySteps.length + 1,
        stateA: current.stateA,
        labelA: getLabelA(current.stateA),
        stateB: current.stateB,
        labelB: getLabelB(current.stateB),
        symbol: sym,
        nextStateA: nextA,
        nextLabelA: getLabelA(nextA),
        nextStateB: nextB,
        nextLabelB: getLabelB(nextB),
        isMismatch,
        productPairLabel: `(${getLabelA(current.stateA)}, ${getLabelB(current.stateB)})`,
        nextProductPairLabel: `(${getLabelA(nextA)}, ${getLabelB(nextB)})`,
      };

      if (!visited.has(key)) {
        visited.add(key);
        const nextHistory = [...current.historySteps, step];
        recordedSteps = nextHistory;
        queue.push({
          stateA: nextA,
          stateB: nextB,
          path: [...current.path, sym],
          historySteps: nextHistory,
        });
      }
    }
  }

  // If search completes with zero mismatches, L(M_A) = L(M_B)
  const trace: DFAEquivalenceTrace = {
    initialPair: initialPairLabel,
    productStatesExplored: exploredCount,
    derivationSteps: recordedSteps,
  };

  return {
    isEquivalent: true,
    productStatesExplored: exploredCount,
    trace,
  };
}

/**
 * Universal Automata Equivalence Engine:
 * Compares languages of DFA or NFA machines by safely reusing NFA → DFA subset construction.
 */
export function compareAutomataLanguages(
  graphA: SolverGraphInput,
  typeA: AutomatonType,
  graphB: SolverGraphInput,
  typeB: AutomatonType
): AutomataEquivalenceResult {
  let targetGraphA = graphA;
  let targetGraphB = graphB;
  let wasNFAConvertedA = false;
  let wasNFAConvertedB = false;

  if (typeA === 'NFA') {
    const valNfaA = validateNFA(graphA);
    if (!valNfaA.isValid) {
      return {
        isEquivalent: false,
        machineTypeA: typeA,
        machineTypeB: typeB,
        wasNFAConvertedA: false,
        wasNFAConvertedB: false,
        productStatesExplored: 0,
        errorMessage: `NFA A validation failed: ${valNfaA.errors[0]?.message || 'Invalid machine'}`,
      };
    }
    const convA = convertNfaToDfa(graphA);
    if (!convA.success) {
      return {
        isEquivalent: false,
        machineTypeA: typeA,
        machineTypeB: typeB,
        wasNFAConvertedA: false,
        wasNFAConvertedB: false,
        productStatesExplored: 0,
        errorMessage: `NFA A to DFA conversion failed: ${convA.errorMessage || 'Conversion error'}`,
      };
    }
    targetGraphA = { nodes: convA.nodes, edges: convA.edges };
    wasNFAConvertedA = true;
  }

  if (typeB === 'NFA') {
    const valNfaB = validateNFA(graphB);
    if (!valNfaB.isValid) {
      return {
        isEquivalent: false,
        machineTypeA: typeA,
        machineTypeB: typeB,
        wasNFAConvertedA,
        wasNFAConvertedB: false,
        productStatesExplored: 0,
        errorMessage: `NFA B validation failed: ${valNfaB.errors[0]?.message || 'Invalid machine'}`,
      };
    }
    const convB = convertNfaToDfa(graphB);
    if (!convB.success) {
      return {
        isEquivalent: false,
        machineTypeA: typeA,
        machineTypeB: typeB,
        wasNFAConvertedA,
        wasNFAConvertedB: false,
        productStatesExplored: 0,
        errorMessage: `NFA B to DFA conversion failed: ${convB.errorMessage || 'Conversion error'}`,
      };
    }
    targetGraphB = { nodes: convB.nodes, edges: convB.edges };
    wasNFAConvertedB = true;
  }

  const dfaResult = compareDFALanguages(targetGraphA, targetGraphB);

  return {
    isEquivalent: dfaResult.isEquivalent,
    counterexample: dfaResult.counterexample,
    acceptsA: dfaResult.acceptsA,
    acceptsB: dfaResult.acceptsB,
    machineTypeA: typeA,
    machineTypeB: typeB,
    wasNFAConvertedA,
    wasNFAConvertedB,
    productStatesExplored: dfaResult.productStatesExplored,
    trace: dfaResult.trace,
    errorMessage: dfaResult.errorMessage,
  };
}
