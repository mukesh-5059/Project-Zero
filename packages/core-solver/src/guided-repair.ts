import {
  SolverGraphInput,
  AutomataDiagnosticReport,
  AutomataDiagnostic,
  AutomataRepairSuggestion,
  RepairPreviewResult,
  RepairDiffResult,
  AutomataDiagnosticCode,
} from './types';
import { analyzeDFACompleteness } from './dfa-validator';
import { isEpsilonSymbol, normalizeSymbol } from './nfa-validator';
import { validatePDA } from './pda-validator';
import { validateTM } from './tm-validator';
import { analyzeMachine } from './machine-analyzer';
import { AutomatonType } from '@project-zero/shared';
import { StateNode, TransitionEdge } from '@project-zero/canvas-renderer';

/**
 * Pure deterministic function: Inspects graph and machine type to produce a structured,
 * mathematically sound AutomataDiagnosticReport with educational explanations and actionable repairs.
 */
export function generateDiagnostics(
  graph: SolverGraphInput,
  machineType: AutomatonType = 'DFA',
  initialStackSymbol: string = 'Z0',
  blankSymbol: string = '□'
): AutomataDiagnosticReport {
  const diagnostics: AutomataDiagnostic[] = [];
  const { nodes, edges } = graph;

  const originalMachineType = machineType;
  if (machineType === 'FA') {
    let isNFA = edges.some(e => isEpsilonSymbol(e.label));
    if (!isNFA) {
      for (const node of nodes) {
        const outgoing = edges.filter(e => e.sourceNodeId === node.id);
        const symbols = new Set<string>();
        for (const e of outgoing) {
          const norm = normalizeSymbol(e.label);
          if (norm && symbols.has(norm)) {
            isNFA = true;
            break;
          }
          if (norm) symbols.add(norm);
        }
        if (isNFA) break;
      }
    }
    machineType = isNFA ? 'NFA' : 'DFA';
  }

  // 1. Zero States (Empty Graph Q = ∅)
  if (nodes.length === 0) {
    const code: AutomataDiagnosticCode =
      machineType === 'NFA'
        ? 'NFA_NO_STATES'
        : machineType === 'PDA'
        ? 'PDA_NO_STATES'
        : machineType === 'TM'
        ? 'TM_NO_STATES'
        : 'DFA_NO_STATES';

    diagnostics.push({
      id: `diag-no-states`,
      severity: 'error',
      machineType,
      code,
      title: 'No States Defined in Automaton',
      message: 'The automaton graph contains zero state nodes (Q = ∅).',
      mathematicalExplanation:
        'An automaton is formally defined as a tuple containing a finite set of states Q. Without states, no computation or language acceptance is possible.',
      affectedStateIds: [],
      affectedTransitionIds: [],
      repairs: [],
      isAutoRepairable: false,
      changesLanguageSemantics: true,
    });

    return {
      machineType: originalMachineType,
      isValid: false,
      diagnostics,
      errorCount: 1,
      warningCount: 0,
      infoCount: 0,
    };
  }

  // 2. Initial State Checks (|q₀| = 0 or >1)
  const initialNodes = nodes.filter((n) => n.isInitial);
  if (initialNodes.length === 0) {
    const code: AutomataDiagnosticCode =
      machineType === 'NFA'
        ? 'NFA_NO_INITIAL_STATE'
        : machineType === 'PDA'
        ? 'PDA_NO_INITIAL_STATE'
        : machineType === 'TM'
        ? 'TM_NO_INITIAL_STATE'
        : 'DFA_NO_INITIAL_STATE';

    const repairs: AutomataRepairSuggestion[] = nodes.map((node) => ({
      id: `rep-init-${node.id}`,
      diagnosticId: `diag-no-init`,
      title: `Designate '${node.label || node.id}' as Initial State`,
      description: `Set '${node.label || node.id}' to be the initial start state q₀.`,
      category: 'POTENTIALLY_LANGUAGE_CHANGING',
      actionType: 'SET_INITIAL_STATE',
      targetEntityId: node.id,
    }));

    diagnostics.push({
      id: `diag-no-init`,
      severity: 'error',
      machineType,
      code,
      title: 'Missing Initial Start State (q₀)',
      message: 'No initial start state is designated in the machine.',
      mathematicalExplanation:
        'An automaton requires an initial start state q₀ ∈ Q to define where computation begins. Without a designated start state, no input string can be evaluated.',
      affectedStateIds: [],
      affectedTransitionIds: [],
      repairs,
      isAutoRepairable: repairs.length > 0,
      changesLanguageSemantics: true,
    });
  } else if (initialNodes.length > 1) {
    const code: AutomataDiagnosticCode =
      machineType === 'NFA'
        ? 'NFA_MULTIPLE_INITIAL_STATES'
        : machineType === 'PDA'
        ? 'PDA_MULTIPLE_INITIAL_STATES'
        : machineType === 'TM'
        ? 'TM_MULTIPLE_INITIAL_STATES'
        : 'DFA_MULTIPLE_INITIAL_STATES';

    const initialLabels = initialNodes.map((n) => `'${n.label || n.id}'`).join(', ');

    const repairs: AutomataRepairSuggestion[] = initialNodes.map((node) => ({
      id: `rep-keep-init-${node.id}`,
      diagnosticId: `diag-multi-init`,
      title: `Keep only '${node.label || node.id}' as Initial State`,
      description: `Unset initial status on all other start states except '${node.label || node.id}'.`,
      category: 'POTENTIALLY_LANGUAGE_CHANGING',
      actionType: 'SET_INITIAL_STATE',
      targetEntityId: node.id,
    }));

    diagnostics.push({
      id: `diag-multi-init`,
      severity: 'error',
      machineType,
      code,
      title: 'Multiple Initial States Defined',
      message: `Multiple start states found: ${initialLabels}.`,
      mathematicalExplanation:
        'Standard finite-state automata definitions require exactly one initial start state q₀. Multiple start states create ambiguous starting configurations.',
      affectedStateIds: initialNodes.map((n) => n.id),
      affectedTransitionIds: [],
      repairs,
      isAutoRepairable: true,
      changesLanguageSemantics: true,
    });
  }

  // 3. Dangling Edge Endpoints Check
  const nodeIds = new Set(nodes.map((n) => n.id));
  const danglingEdges = edges.filter((e) => !nodeIds.has(e.sourceNodeId) || !nodeIds.has(e.targetNodeId));
  if (danglingEdges.length > 0) {
    danglingEdges.forEach((edge) => {
      const code: AutomataDiagnosticCode =
        machineType === 'NFA'
          ? 'NFA_DANGLING_TRANSITION_ENDPOINT'
          : machineType === 'PDA'
          ? 'PDA_DANGLING_TRANSITION_ENDPOINT'
          : machineType === 'TM'
          ? 'TM_DANGLING_TRANSITION_ENDPOINT'
          : 'DFA_DANGLING_TRANSITION_ENDPOINT';

      const repairs: AutomataRepairSuggestion[] = [
        {
          id: `rep-del-dangling-${edge.id}`,
          diagnosticId: `diag-dangling-${edge.id}`,
          title: 'Remove Dangling Transition',
          description: 'Delete transition connecting to non-existent state.',
          category: 'POTENTIALLY_LANGUAGE_CHANGING',
          actionType: 'REMOVE_EDGE',
          targetEntityId: edge.id,
        },
      ];

      diagnostics.push({
        id: `diag-dangling-${edge.id}`,
        severity: 'error',
        machineType,
        code,
        title: 'Dangling Transition Endpoint',
        message: `Transition '${edge.label || edge.id}' connects to a non-existent state endpoint.`,
        mathematicalExplanation:
          'All transitions in an automaton relation R ⊆ Q × (Σ ∪ {ε}) × Q must connect valid, defined states in Q.',
        affectedStateIds: [],
        affectedTransitionIds: [edge.id],
        repairs,
        isAutoRepairable: true,
        changesLanguageSemantics: true,
      });
    });
  }

  // 4. Empty Symbol Transitions Check (DFA, PDA, TM only; NFAs allow empty symbol ε)
  if (machineType !== 'NFA') {
    const emptyEdges = edges.filter((e) => nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId) && (!e.label || e.label.trim().length === 0));
    if (emptyEdges.length > 0) {
      emptyEdges.forEach((edge) => {
        const src = nodes.find((n) => n.id === edge.sourceNodeId);
        const tgt = nodes.find((n) => n.id === edge.targetNodeId);
        const code: AutomataDiagnosticCode =
          machineType === 'PDA'
            ? 'PDA_EMPTY_TRANSITION_SYMBOL'
            : machineType === 'TM'
            ? 'TM_EMPTY_TRANSITION_SYMBOL'
            : 'DFA_EMPTY_TRANSITION_SYMBOL';

        const repairs: AutomataRepairSuggestion[] = [
          {
            id: `rep-del-edge-${edge.id}`,
            diagnosticId: `diag-empty-edge-${edge.id}`,
            title: `Remove Unlabelled Transition`,
            description: `Delete the transition ${src?.label || edge.sourceNodeId} → ${tgt?.label || edge.targetNodeId}.`,
            category: 'POTENTIALLY_LANGUAGE_CHANGING',
            actionType: 'REMOVE_EDGE',
            targetEntityId: edge.id,
          },
        ];

        diagnostics.push({
          id: `diag-empty-edge-${edge.id}`,
          severity: 'error',
          machineType,
          code,
          title: 'Empty Transition Symbol Label',
          message: `Transition ${src?.label || edge.sourceNodeId} → ${tgt?.label || edge.targetNodeId} has an empty input symbol.`,
          mathematicalExplanation:
            'Transition relations require an explicit symbol from alphabet Σ or an explicit epsilon symbol (ε/λ) where permitted by formalism.',
          affectedStateIds: [edge.sourceNodeId],
          affectedTransitionIds: [edge.id],
          repairs,
          isAutoRepairable: true,
          changesLanguageSemantics: true,
        });
      });
    }
  }

  // 5. DFA Specific Rules (Determinism, Epsilon Prohibition, Completeness)
  if (machineType === 'DFA') {
    // Epsilon Transitions Prohibition in DFA
    const epsilonEdges = edges.filter((e) => isEpsilonSymbol(e.label));
    epsilonEdges.forEach((edge) => {
      const src = nodes.find((n) => n.id === edge.sourceNodeId);
      const tgt = nodes.find((n) => n.id === edge.targetNodeId);

      const repairs: AutomataRepairSuggestion[] = [
        {
          id: `rep-rm-eps-${edge.id}`,
          diagnosticId: `diag-eps-${edge.id}`,
          title: `Remove Epsilon Transition`,
          description: `Delete transition ${src?.label || edge.sourceNodeId} → ${tgt?.label || edge.targetNodeId}.`,
          category: 'POTENTIALLY_LANGUAGE_CHANGING',
          actionType: 'REMOVE_EDGE',
          targetEntityId: edge.id,
        },
      ];

      diagnostics.push({
        id: `diag-eps-${edge.id}`,
        severity: 'error',
        machineType: 'DFA',
        code: 'DFA_EPSILON_TRANSITION',
        title: 'Epsilon (ε) Transition in DFA',
        message: `Transition ${src?.label || edge.sourceNodeId} → ${tgt?.label || edge.targetNodeId} uses '${edge.label}'.`,
        mathematicalExplanation:
          'A Deterministic Finite Automaton (DFA) cannot contain spontaneous ε-transitions. State transitions must be driven strictly by input symbols.',
        affectedStateIds: [edge.sourceNodeId],
        affectedTransitionIds: [edge.id],
        repairs,
        isAutoRepairable: true,
        changesLanguageSemantics: true,
      });
    });

    // Nondeterministic Transitions in DFA
    nodes.forEach((node) => {
      const outgoing = edges.filter((e) => e.sourceNodeId === node.id);
      const symbolMap = new Map<string, string[]>();

      outgoing.forEach((e) => {
        const norm = normalizeSymbol(e.label);
        if (!norm || isEpsilonSymbol(norm)) return;
        const list = symbolMap.get(norm) || [];
        list.push(e.id);
        symbolMap.set(norm, list);
      });

      symbolMap.forEach((edgeIds, symbol) => {
        if (edgeIds.length > 1) {
          const repairs: AutomataRepairSuggestion[] = edgeIds.slice(1).map((eId, idx) => ({
            id: `rep-rm-dup-${eId}`,
            diagnosticId: `diag-dup-${node.id}-${symbol}`,
            title: `Remove Duplicate Transition #${idx + 2}`,
            description: `Remove one of the conflicting outgoing transitions from '${node.label || node.id}' on symbol '${symbol}'.`,
            category: 'POTENTIALLY_LANGUAGE_CHANGING',
            actionType: 'REMOVE_EDGE',
            targetEntityId: eId,
          }));

          diagnostics.push({
            id: `diag-dup-${node.id}-${symbol}`,
            severity: 'error',
            machineType: 'DFA',
            code: 'DFA_NONDETERMINISTIC_TRANSITION',
            title: 'Nondeterministic Transition Branching',
            message: `State '${node.label || node.id}' has ${edgeIds.length} outgoing transitions for symbol '${symbol}'.`,
            mathematicalExplanation:
              `From state '${node.label || node.id}' on symbol '${symbol}', multiple destination states exist. A DFA requires transition function δ: Q × Σ → Q to be single-valued.`,
            affectedStateIds: [node.id],
            affectedTransitionIds: edgeIds,
            repairs,
            isAutoRepairable: true,
            changesLanguageSemantics: true,
          });
        }
      });
    });

    // Missing DFA Transitions (Completeness Analysis)
    const completeness = analyzeDFACompleteness(graph);
    if (!completeness.isComplete && completeness.alphabet.length > 0) {
      completeness.missingTransitions.forEach((missing) => {
        const trapNode = nodes.find((n) => !n.isAccepting && n.id !== missing.stateId);

        const repairs: AutomataRepairSuggestion[] = [];
        if (trapNode) {
          repairs.push({
            id: `rep-add-trans-${missing.stateId}-${missing.symbol}-existing`,
            diagnosticId: `diag-miss-${missing.stateId}-${missing.symbol}`,
            title: `Add Transition '${missing.stateLabel}' --${missing.symbol}--> '${trapNode.label || trapNode.id}'`,
            description: `Connect missing transition on '${missing.symbol}' to existing non-accepting state '${trapNode.label || trapNode.id}'.`,
            category: 'POTENTIALLY_LANGUAGE_CHANGING',
            actionType: 'ADD_TRANSITION',
            payload: {
              sourceNodeId: missing.stateId,
              targetNodeId: trapNode.id,
              symbol: missing.symbol,
            },
          });
        }

        repairs.push({
          id: `rep-create-trap-${missing.stateId}-${missing.symbol}`,
          diagnosticId: `diag-miss-${missing.stateId}-${missing.symbol}`,
          title: `Create Trap State (Ø) & Add Transition '${missing.symbol}'`,
          description: `Create a new explicit trap state 'Ø' with self-loops and route missing symbol '${missing.symbol}' to it.`,
          category: 'SAFE',
          actionType: 'CREATE_TRAP_STATE_AND_TRANSITION',
          payload: {
            sourceNodeId: missing.stateId,
            symbol: missing.symbol,
          },
        });

        diagnostics.push({
          id: `diag-miss-${missing.stateId}-${missing.symbol}`,
          severity: 'warning',
          machineType: 'DFA',
          code: 'DFA_MISSING_TRANSITION',
          title: `Missing DFA Transition on Symbol '${missing.symbol}'`,
          message: `State '${missing.stateLabel}' has no outgoing transition for symbol '${missing.symbol}'.`,
          mathematicalExplanation:
            `In a complete DFA, transition function δ must be defined for every state-symbol pair (q, a) ∈ Q × Σ. Missing transitions act as implicit rejection.`,
          affectedStateIds: [missing.stateId],
          affectedTransitionIds: [],
          repairs,
          isAutoRepairable: true,
          changesLanguageSemantics: false,
        });
      });
    }
  }

  // 6. PDA Specific Validation
  if (machineType === 'PDA') {
    const pdaVal = validatePDA(graph, initialStackSymbol);
    pdaVal.errors.forEach((err) => {
      if (err.code === 'MISSING_INITIAL_STATE' || err.code === 'MULTIPLE_INITIAL_STATES' || err.code === 'DANGLING_TRANSITION_ENDPOINT') {
        return; // Already covered generically
      }

      let code: AutomataDiagnosticCode = 'PDA_MALFORMED_TRANSITION';
      let title = 'PDA Validation Error';
      if (err.code === 'MISSING_INITIAL_STACK_SYMBOL') {
        code = 'PDA_MISSING_INITIAL_STACK_SYMBOL';
        title = 'Missing Initial Stack Symbol (Z₀)';
      } else if (err.code === 'MALFORMED_PDA_TRANSITION') {
        code = 'PDA_MALFORMED_TRANSITION';
        title = 'Malformed PDA Transition Format';
      }

      const affectedTransitions = err.affectedTransitionIds ? [...err.affectedTransitionIds] : [];
      const repairs: AutomataRepairSuggestion[] = affectedTransitions.map((eId) => ({
        id: `rep-pda-del-${eId}`,
        diagnosticId: `diag-pda-${err.code}-${eId}`,
        title: 'Remove Malformed PDA Transition',
        description: 'Delete transition edge with invalid PDA stack notation.',
        category: 'POTENTIALLY_LANGUAGE_CHANGING',
        actionType: 'REMOVE_EDGE',
        targetEntityId: eId,
      }));

      diagnostics.push({
        id: `diag-pda-${err.code}-${Math.random().toString(36).substr(2, 4)}`,
        severity: 'error',
        machineType: 'PDA',
        code,
        title,
        message: err.message,
        mathematicalExplanation:
          'A Pushdown Automaton requires valid transition tuples (a, X / γ) defining input consumption, stack popping, and stack pushing.',
        affectedStateIds: err.affectedStateIds ? [...err.affectedStateIds] : [],
        affectedTransitionIds: affectedTransitions,
        repairs,
        isAutoRepairable: repairs.length > 0,
        changesLanguageSemantics: true,
      });
    });
  }

  // 7. TM Specific Validation
  if (machineType === 'TM') {
    const tmVal = validateTM(graph, blankSymbol);
    tmVal.errors.forEach((err) => {
      if (err.code === 'MISSING_INITIAL_STATE' || err.code === 'MULTIPLE_INITIAL_STATES' || err.code === 'DANGLING_TRANSITION_ENDPOINT') {
        return; // Already covered generically
      }

      let code: AutomataDiagnosticCode = 'TM_MALFORMED_TRANSITION';
      let title = 'Turing Machine Validation Error';
      if (err.code === 'INVALID_BLANK_SYMBOL') {
        code = 'TM_INVALID_BLANK_SYMBOL';
        title = 'Invalid TM Blank Symbol';
      } else if (err.code === 'INVALID_MOVE_DIRECTION') {
        code = 'TM_INVALID_MOVE_DIRECTION';
        title = 'Invalid TM Head Movement Direction';
      } else if (err.code === 'MISSING_WRITE_SYMBOL') {
        code = 'TM_MISSING_WRITE_SYMBOL';
        title = 'Missing TM Tape Write Symbol';
      } else if (err.code === 'DUPLICATE_TM_TRANSITION') {
        code = 'TM_DUPLICATE_TRANSITION';
        title = 'Nondeterministic TM Transition Ambiguity';
      }

      const affectedTransitions = err.affectedTransitionIds ? [...err.affectedTransitionIds] : [];
      const repairs: AutomataRepairSuggestion[] = affectedTransitions.map((eId) => ({
        id: `rep-tm-del-${eId}`,
        diagnosticId: `diag-tm-${err.code}-${eId}`,
        title: 'Remove Invalid/Duplicate TM Transition',
        description: 'Delete transition edge violating TM 7-tuple semantics.',
        category: 'POTENTIALLY_LANGUAGE_CHANGING',
        actionType: 'REMOVE_EDGE',
        targetEntityId: eId,
      }));

      diagnostics.push({
        id: `diag-tm-${err.code}-${Math.random().toString(36).substr(2, 4)}`,
        severity: 'error',
        machineType: 'TM',
        code,
        title,
        message: err.message,
        mathematicalExplanation:
          'A Turing Machine requires deterministic transition function δ: Q × Γ → Q × Γ × {L, R, S} defining read symbol, write symbol, and head movement direction.',
        affectedStateIds: err.affectedStateIds ? [...err.affectedStateIds] : [],
        affectedTransitionIds: affectedTransitions,
        repairs,
        isAutoRepairable: repairs.length > 0,
        changesLanguageSemantics: true,
      });
    });
  }

  // 8. Reachability Analysis (Unreachable & Trap States)
  if (nodes.length > 0 && initialNodes.length === 1) {
    const analysis = analyzeMachine(graph, machineType);

    analysis.unreachableStateIds.forEach((unreachId) => {
      const node = nodes.find((n) => n.id === unreachId);
      if (!node) return;
      const code: AutomataDiagnosticCode =
        machineType === 'NFA'
          ? 'NFA_UNREACHABLE_STATE'
          : machineType === 'PDA'
          ? 'PDA_UNREACHABLE_STATE'
          : machineType === 'TM'
          ? 'TM_UNREACHABLE_STATE'
          : 'DFA_UNREACHABLE_STATE';

      const repairs: AutomataRepairSuggestion[] = [
        {
          id: `rep-rm-unreach-${unreachId}`,
          diagnosticId: `diag-unreach-${unreachId}`,
          title: `Remove Unreachable State '${node.label || unreachId}'`,
          description: `Delete state '${node.label || unreachId}' and its connected edges.`,
          category: 'SAFE',
          actionType: 'REMOVE_NODE',
          targetEntityId: unreachId,
        },
      ];

      diagnostics.push({
        id: `diag-unreach-${unreachId}`,
        severity: 'warning',
        machineType,
        code,
        title: `Unreachable State '${node.label || unreachId}'`,
        message: `State '${node.label || unreachId}' cannot be reached from initial start state q₀.`,
        mathematicalExplanation:
          `State '${node.label || unreachId}' is disconnected from all initial paths q₀ ⇝ q. Removing unreachable states never alters the language L(M).`,
        affectedStateIds: [unreachId],
        affectedTransitionIds: edges.filter((e) => e.sourceNodeId === unreachId || e.targetNodeId === unreachId).map((e) => e.id),
        repairs,
        isAutoRepairable: true,
        changesLanguageSemantics: false,
      });
    });

    analysis.trapStateIds.forEach((trapId) => {
      const node = nodes.find((n) => n.id === trapId);
      if (!node) return;
      const code: AutomataDiagnosticCode =
        machineType === 'NFA'
          ? 'NFA_DEAD_STATE'
          : machineType === 'PDA'
          ? 'PDA_DEAD_STATE'
          : machineType === 'TM'
          ? 'TM_DEAD_STATE'
          : 'DFA_DEAD_STATE';

      diagnostics.push({
        id: `diag-trap-${trapId}`,
        severity: 'info',
        machineType,
        code,
        title: `Dead / Trap State '${node.label || trapId}'`,
        message: `State '${node.label || trapId}' is non-accepting and cannot reach any accepting state in F.`,
        mathematicalExplanation:
          `State '${node.label || trapId}' is a trap configuration (q ⇥ F). Once entered during execution, the machine will reject all remaining suffixes.`,
        affectedStateIds: [trapId],
        affectedTransitionIds: edges.filter((e) => e.sourceNodeId === trapId || e.targetNodeId === trapId).map((e) => e.id),
        repairs: [],
        isAutoRepairable: false,
        changesLanguageSemantics: false,
      });
    });
  }

  // Compute counts
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;
  const infoCount = diagnostics.filter((d) => d.severity === 'info').length;

  return {
    machineType: originalMachineType,
    isValid: errorCount === 0,
    diagnostics,
    errorCount,
    warningCount,
    infoCount,
  };
}

/**
 * Pure deterministic function: Calculates hypothetical mutated machine graph { nodes, edges }
 * after applying a suggested repair, computing the explicit diff without touching GraphContext state.
 */
export function computeRepairPreview(
  graph: SolverGraphInput,
  repair: AutomataRepairSuggestion,
  machineType: AutomatonType = 'DFA',
  initialStackSymbol: string = 'Z0',
  blankSymbol: string = '□'
): RepairPreviewResult {
  const beforeNodes = graph.nodes;
  const beforeEdges = graph.edges;

  let afterNodes: StateNode[] = beforeNodes.map((n) => ({ ...n }));
  let afterEdges: TransitionEdge[] = beforeEdges.map((e) => ({ ...e }));

  if (repair.actionType === 'SET_INITIAL_STATE' && repair.targetEntityId) {
    afterNodes = afterNodes.map((n) => ({
      ...n,
      isInitial: n.id === repair.targetEntityId,
    }));
  } else if (repair.actionType === 'REMOVE_NODE' && repair.targetEntityId) {
    afterNodes = afterNodes.filter((n) => n.id !== repair.targetEntityId);
    afterEdges = afterEdges.filter(
      (e) => e.sourceNodeId !== repair.targetEntityId && e.targetNodeId !== repair.targetEntityId
    );
  } else if (repair.actionType === 'REMOVE_EDGE' && repair.targetEntityId) {
    afterEdges = afterEdges.filter((e) => e.id !== repair.targetEntityId);
  } else if (repair.actionType === 'ADD_TRANSITION' && repair.payload) {
    const newEdge: TransitionEdge = {
      id: `edge-rep-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sourceNodeId: repair.payload.sourceNodeId as string,
      targetNodeId: repair.payload.targetNodeId as string,
      label: repair.payload.symbol as string,
    };
    afterEdges = [...afterEdges, newEdge];
  } else if (repair.actionType === 'CREATE_TRAP_STATE_AND_TRANSITION' && repair.payload) {
    const trapNodeId = `node-trap-${Date.now()}`;
    const newTrapNode: StateNode = {
      id: trapNodeId,
      label: 'Ø',
      x: 350,
      y: 250,
      isInitial: false,
      isAccepting: false,
    };
    const newEdge: TransitionEdge = {
      id: `edge-trap-${Date.now()}`,
      sourceNodeId: repair.payload.sourceNodeId as string,
      targetNodeId: trapNodeId,
      label: repair.payload.symbol as string,
    };

    // Extract alphabet Σ from beforeEdges + repair payload symbol
    const rawSymbols = beforeEdges
      .map((e) => normalizeSymbol(e.label))
      .filter((l) => l.length > 0 && !isEpsilonSymbol(l));
    if (repair.payload.symbol) {
      const payloadNorm = normalizeSymbol(repair.payload.symbol as string);
      if (payloadNorm && !isEpsilonSymbol(payloadNorm)) {
        rawSymbols.push(payloadNorm);
      }
    }
    const alphabet = Array.from(new Set(rawSymbols)).sort();

    // Create self-loop edges on trap state for every symbol in Σ
    const trapSelfLoops: TransitionEdge[] = alphabet.map((sym, idx) => ({
      id: `edge-trap-loop-${Date.now()}-${idx}`,
      sourceNodeId: trapNodeId,
      targetNodeId: trapNodeId,
      label: sym,
    }));

    afterNodes = [...afterNodes, newTrapNode];
    afterEdges = [...afterEdges, newEdge, ...trapSelfLoops];
  }

  // Calculate explicit diff
  const beforeNodeIds = new Set(beforeNodes.map((n) => n.id));
  const afterNodeIds = new Set(afterNodes.map((n) => n.id));

  const addedNodes = afterNodes.filter((n) => !beforeNodeIds.has(n.id));
  const removedNodes = beforeNodes.filter((n) => !afterNodeIds.has(n.id));

  const beforeEdgeIds = new Set(beforeEdges.map((e) => e.id));
  const afterEdgeIds = new Set(afterEdges.map((e) => e.id));

  const addedEdges = afterEdges.filter((e) => !beforeEdgeIds.has(e.id));
  const removedEdges = beforeEdges.filter((e) => !afterEdgeIds.has(e.id));

  const modifiedEdges = afterEdges.filter((ae) => {
    if (!beforeEdgeIds.has(ae.id)) return false;
    const be = beforeEdges.find((e) => e.id === ae.id);
    if (!be) return false;
    return (
      be.sourceNodeId !== ae.sourceNodeId ||
      be.targetNodeId !== ae.targetNodeId ||
      be.label !== ae.label ||
      be.inputSymbol !== ae.inputSymbol ||
      be.stackTop !== ae.stackTop ||
      be.stackReplacement !== ae.stackReplacement ||
      be.readSymbol !== ae.readSymbol ||
      be.writeSymbol !== ae.writeSymbol ||
      be.moveDirection !== ae.moveDirection
    );
  });

  const diff: RepairDiffResult = {
    addedNodes,
    removedNodes,
    addedEdges,
    removedEdges,
    modifiedEdges,
  };

  // Run post-preview validation check using actual machineType
  const postReport = generateDiagnostics(
    { nodes: afterNodes, edges: afterEdges },
    machineType,
    initialStackSymbol,
    blankSymbol
  );

  const mathematicalSafetyExplanation =
    repair.category === 'SAFE'
      ? 'Structural modification (e.g. removing unreachable state or routing to dead state) is mathematically proven not to alter accepted language L(M).'
      : 'This repair modifies initial or transition assignments and may alter the recognized regular language L(M).';

  return {
    repairId: repair.id,
    diagnosticId: repair.diagnosticId,
    beforeNodes,
    beforeEdges,
    afterNodes,
    afterEdges,
    diff,
    isAfterValid: postReport.isValid,
    languageSafetyCategory: repair.category,
    mathematicalSafetyExplanation,
  };
}

/**
 * Pure deterministic function: Returns updated { nodes, edges } after applying repair.
 */
export function applyRepairToGraph(
  graph: SolverGraphInput,
  repair: AutomataRepairSuggestion,
  machineType: AutomatonType = 'DFA',
  initialStackSymbol: string = 'Z0',
  blankSymbol: string = '□'
): { nodes: StateNode[]; edges: TransitionEdge[] } {
  if (!repair || typeof repair !== 'object' || !repair.actionType) {
    return {
      nodes: graph.nodes.map((n) => ({ ...n })),
      edges: graph.edges.map((e) => ({ ...e })),
    };
  }
  const preview = computeRepairPreview(graph, repair, machineType, initialStackSymbol, blankSymbol);
  return {
    nodes: preview.afterNodes as StateNode[],
    edges: preview.afterEdges as TransitionEdge[],
  };
}
