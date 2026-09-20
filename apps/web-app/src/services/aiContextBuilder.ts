import type { StateNode, TransitionEdge } from '@project-zero/canvas-renderer';
import type { AutomatonType } from '@project-zero/shared';
import type { AIContextSnapshot, EducationalEvidence, TutorIntent } from '@project-zero/ai-gateway';
import {
  MAX_CONTEXT_STATES,
  MAX_CONTEXT_TRANSITIONS,
  MAX_CONTEXT_DIAGNOSTICS,
} from '@project-zero/ai-gateway';

export interface BuildContextParams {
  nodes: StateNode[];
  edges: TransitionEdge[];
  machineType: AutomatonType;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  activeSidebarTab?: string;
  activeBottomTab?: string;
  activeInspectorTab?: string;
  focusMode?: boolean;
  initialStackSymbol?: string;
  blankSymbol?: string;
  pdaAcceptanceMode?: string;
  isStructurallyValid?: boolean;
  observations?: string[];
  diagnostics?: string[];
  evidence?: EducationalEvidence;
  tutorIntent?: TutorIntent;
}

/**
 * Builds a sanitized, bounded, deterministic AIContextSnapshot from active frontend application state.
 */
export function buildAIContextSnapshot(params: BuildContextParams): AIContextSnapshot {
  let contextTruncated = false;
  const truncationReasons: string[] = [];

  // 1. Compute & sanitize states
  const totalStates = params.nodes.length;
  let statesToProcess = params.nodes;
  if (statesToProcess.length > MAX_CONTEXT_STATES) {
    statesToProcess = statesToProcess.slice(0, MAX_CONTEXT_STATES);
    contextTruncated = true;
    truncationReasons.push(`States capped at ${MAX_CONTEXT_STATES}`);
  }

  const nodeMap = new Map<string, string>();
  const stateLabels: string[] = [];
  const acceptingLabels: string[] = [];
  let initialStateLabel: string | null = null;

  for (const node of statesToProcess) {
    const label = node.label || node.id;
    nodeMap.set(node.id, label);
    stateLabels.push(label);
    if (node.isInitial && !initialStateLabel) {
      initialStateLabel = label;
    }
    if (node.isAccepting) {
      acceptingLabels.push(label);
    }
  }

  // 2. Compute & sanitize transitions
  const totalTransitions = params.edges.length;
  let edgesToProcess = params.edges;
  if (edgesToProcess.length > MAX_CONTEXT_TRANSITIONS) {
    edgesToProcess = edgesToProcess.slice(0, MAX_CONTEXT_TRANSITIONS);
    contextTruncated = true;
    truncationReasons.push(`Transitions capped at ${MAX_CONTEXT_TRANSITIONS}`);
  }

  const alphabetSet = new Set<string>();
  const transitionsList: Array<{
    from: string;
    symbol: string;
    to: string;
    stackPop?: string;
    stackPush?: string;
    tapeWrite?: string;
    tapeDirection?: string;
  }> = [];

  for (const edge of edgesToProcess) {
    const fromLabel = nodeMap.get(edge.sourceNodeId) || edge.sourceNodeId;
    const toLabel = nodeMap.get(edge.targetNodeId) || edge.targetNodeId;
    const sym = edge.label || 'ε';
    if (sym !== 'ε' && sym.length > 0) {
      alphabetSet.add(sym);
    }

    transitionsList.push({
      from: fromLabel,
      symbol: sym,
      to: toLabel,
      stackPop: edge.stackTop,
      stackPush: edge.stackReplacement,
      tapeWrite: edge.writeSymbol,
      tapeDirection: edge.moveDirection,
    });
  }

  // 3. Selection
  const selectedNodeLabels = params.selectedNodeIds
    .map((id) => nodeMap.get(id) || id)
    .filter(Boolean);

  const selectedEdgeDescriptions = params.selectedEdgeIds
    .map((id) => {
      const edge = params.edges.find((e) => e.id === id);
      if (!edge) return null;
      const src = nodeMap.get(edge.sourceNodeId) || edge.sourceNodeId;
      const tgt = nodeMap.get(edge.targetNodeId) || edge.targetNodeId;
      return `${src} →(${edge.label || 'ε'})→ ${tgt}`;
    })
    .filter((v): v is string => v !== null);

  // 4. Diagnostics & Analysis
  let diagnosticsList = params.diagnostics || [];
  if (diagnosticsList.length > MAX_CONTEXT_DIAGNOSTICS) {
    diagnosticsList = diagnosticsList.slice(0, MAX_CONTEXT_DIAGNOSTICS);
    contextTruncated = true;
    truncationReasons.push(`Diagnostics capped at ${MAX_CONTEXT_DIAGNOSTICS}`);
  }

  return {
    version: '1.0.0',
    workspace: {
      activeMachineType: params.machineType,
      activeSidebarTab: params.activeSidebarTab,
      activeBottomTab: params.activeBottomTab,
      activeInspectorTab: params.activeInspectorTab,
      focusMode: params.focusMode,
    },
    selection: {
      selectedNodeLabels,
      selectedEdgeDescriptions,
    },
    machine: {
      type: params.machineType,
      stateCount: totalStates,
      states: stateLabels,
      initialState: initialStateLabel,
      acceptingStates: acceptingLabels,
      alphabet: Array.from(alphabetSet).sort(),
      transitionCount: totalTransitions,
      transitions: transitionsList,
      initialStackSymbol: params.initialStackSymbol,
      blankSymbol: params.blankSymbol,
      pdaAcceptanceMode: params.pdaAcceptanceMode,
    },
    analysis: {
      isStructurallyValid: params.isStructurallyValid,
      observations: params.observations,
      diagnosticsCount: params.diagnostics?.length ?? 0,
      diagnostics: diagnosticsList,
    },
    evidence: params.evidence,
    tutorIntent: params.tutorIntent,
    contextTruncated: contextTruncated || undefined,
    truncationReason: truncationReasons.length > 0 ? truncationReasons.join(', ') : undefined,
  };
}
