import { StateNode, TransitionEdge } from '@project-zero/canvas-renderer';
import { AutomatonType } from '@project-zero/shared';
import { AIActionEnvelope } from '@project-zero/ai-gateway';

export interface SemanticValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates whether proposed AI actions are semantically valid against the active machine and canvas state.
 * Performs deep structural and deterministic DFA validation.
 */
export function validateActionsSemantics(
  envelope: AIActionEnvelope,
  currentNodes: StateNode[],
  currentEdges: TransitionEdge[],
  machineType: AutomatonType
): SemanticValidationResult {
  const errors: string[] = [];
  const stateLabels = new Set<string>();

  for (const node of currentNodes) {
    const label = node.label || node.id;
    stateLabels.add(label);
  }

  // Simulated virtual labels created during batch execution
  const virtualStateLabels = new Set<string>(stateLabels);

  // Virtual transition tracking for determinism and collision checks:
  // Map of "fromState:symbol" -> destinationState
  const virtualTransitions = new Map<string, string>();

  // Map existing edges into virtual transitions
  for (const edge of currentEdges) {
    const srcNode = currentNodes.find((n) => n.id === edge.sourceNodeId);
    const tgtNode = currentNodes.find((n) => n.id === edge.targetNodeId);
    if (srcNode && tgtNode && edge.label) {
      const srcLabel = srcNode.label || srcNode.id;
      const tgtLabel = tgtNode.label || tgtNode.id;
      virtualTransitions.set(`${srcLabel}:${edge.label}`, tgtLabel);
    }
  }

  for (let i = 0; i < envelope.actions.length; i++) {
    const action = envelope.actions[i];
    const p = action.parameters;

    switch (action.type) {
      case 'CREATE_STATE': {
        const label = String(p.label || '').trim();
        if (!label) {
          errors.push(`Action ${i + 1} (${action.type}): State label cannot be empty.`);
        } else if (virtualStateLabels.has(label)) {
          errors.push(`Action ${i + 1} (${action.type}): State label "${label}" already exists.`);
        } else {
          virtualStateLabels.add(label);
        }
        break;
      }

      case 'DELETE_STATE': {
        const label = String(p.label || '').trim();
        if (!virtualStateLabels.has(label)) {
          errors.push(`Action ${i + 1} (${action.type}): State "${label}" does not exist to delete.`);
        } else {
          virtualStateLabels.delete(label);
          // Remove virtual transitions incident on deleted state
          for (const key of Array.from(virtualTransitions.keys())) {
            const [src] = key.split(':');
            const tgt = virtualTransitions.get(key);
            if (src === label || tgt === label) {
              virtualTransitions.delete(key);
            }
          }
        }
        break;
      }

      case 'SET_INITIAL_STATE':
      case 'TOGGLE_ACCEPTING_STATE': {
        const label = String(p.label || '').trim();
        if (!virtualStateLabels.has(label)) {
          errors.push(`Action ${i + 1} (${action.type}): State "${label}" does not exist.`);
        }
        break;
      }

      case 'CREATE_TRANSITION': {
        const from = String(p.from || '').trim();
        const to = String(p.to || '').trim();
        const sym = String(p.symbol || '').trim();

        if (!virtualStateLabels.has(from)) {
          errors.push(`Action ${i + 1} (${action.type}): Source state "${from}" does not exist.`);
        }
        if (!virtualStateLabels.has(to)) {
          errors.push(`Action ${i + 1} (${action.type}): Target state "${to}" does not exist.`);
        }

        // DFA Determinism Check
        if (machineType === 'DFA') {
          if (sym === 'ε' || sym === 'λ' || sym === '') {
            errors.push(`Action ${i + 1} (${action.type}): DFA does not permit epsilon (ε) transitions.`);
          } else {
            const transKey = `${from}:${sym}`;
            const existingTarget = virtualTransitions.get(transKey);
            if (existingTarget !== undefined && existingTarget !== to) {
              errors.push(
                `Action ${i + 1} (${action.type}): DFA determinism violation: state "${from}" already has a transition on "${sym}" to "${existingTarget}".`
              );
            } else {
              virtualTransitions.set(transKey, to);
            }
          }
        }
        break;
      }

      case 'EDIT_TRANSITION': {
        const from = String(p.from || '').trim();
        const to = String(p.to || '').trim();
        const oldSym = String(p.oldSymbol || '').trim();
        const newSym = String(p.newSymbol || '').trim();

        if (!virtualStateLabels.has(from) || !virtualStateLabels.has(to)) {
          errors.push(`Action ${i + 1} (${action.type}): State endpoints must exist.`);
        }

        if (machineType === 'DFA') {
          if (newSym === 'ε' || newSym === 'λ' || newSym === '') {
            errors.push(`Action ${i + 1} (${action.type}): DFA does not permit epsilon (ε) transitions.`);
          }
          virtualTransitions.delete(`${from}:${oldSym}`);
          virtualTransitions.set(`${from}:${newSym}`, to);
        }
        break;
      }

      case 'DELETE_TRANSITION': {
        const from = String(p.from || '').trim();
        const to = String(p.to || '').trim();
        const sym = String(p.symbol || '').trim();

        if (!virtualStateLabels.has(from) || !virtualStateLabels.has(to)) {
          errors.push(`Action ${i + 1} (${action.type}): State endpoints must exist.`);
        } else {
          virtualTransitions.delete(`${from}:${sym}`);
        }
        break;
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export interface ExecuteActionsParams {
  envelope: AIActionEnvelope;
  currentNodes: StateNode[];
  currentEdges: TransitionEdge[];
  machineType: AutomatonType;
  onAddNode?: (node: StateNode) => void;
  onRemoveNode?: (id: string) => void;
  onUpdateNode?: (id: string, patch: Partial<StateNode>) => void;
  onAddEdge?: (edge: TransitionEdge) => void;
  onRemoveEdge?: (id: string) => void;
  onUpdateEdge?: (id: string, patch: Partial<TransitionEdge>) => void;
  onBatchMutate?: (nodes: StateNode[], edges: TransitionEdge[]) => void;
}

/**
 * Calculates deterministic layout coordinates for newly proposed AI states to prevent overlap.
 */
function calculateDeterministicStatePosition(index: number, existingCount: number): { x: number; y: number } {
  const totalOffset = existingCount + index;
  // Clean grid layout across canvas
  const col = totalOffset % 4;
  const row = Math.floor(totalOffset / 4);
  return {
    x: 160 + col * 170,
    y: 180 + row * 150,
  };
}

/**
 * Executes a verified, user-confirmed AI action envelope using canonical GraphContext methods.
 * Supports atomic batch mutation with single-step undo/redo.
 */
export function executeAIActions(params: ExecuteActionsParams): {
  success: boolean;
  appliedCount: number;
  error?: string;
  finalNodes?: StateNode[];
  finalEdges?: TransitionEdge[];
} {
  const validation = validateActionsSemantics(
    params.envelope,
    params.currentNodes,
    params.currentEdges,
    params.machineType
  );

  if (!validation.isValid) {
    return {
      success: false,
      appliedCount: 0,
      error: validation.errors.join(' | '),
    };
  }

  let finalNodes = params.currentNodes.map((n) => ({ ...n }));
  let finalEdges = params.currentEdges.map((e) => ({ ...e }));
  let appliedCount = 0;
  let createdStateCount = 0;

  const labelToId = new Map<string, string>();
  for (const n of finalNodes) {
    labelToId.set(n.label || n.id, n.id);
  }

  for (const action of params.envelope.actions) {
    const p = action.parameters;

    switch (action.type) {
      case 'CREATE_STATE': {
        const label = String(p.label || '').trim();
        const newId = `node_${label}`;
        labelToId.set(label, newId);

        const defaultPos = calculateDeterministicStatePosition(createdStateCount, params.currentNodes.length);
        createdStateCount++;

        const node: StateNode = {
          id: newId,
          label,
          x: typeof p.x === 'number' ? p.x : defaultPos.x,
          y: typeof p.y === 'number' ? p.y : defaultPos.y,
          isInitial: Boolean(p.isInitial ?? p.isStart ?? p.start ?? p.initial ?? p.is_initial ?? p.is_start),
          isAccepting: Boolean(p.isAccepting ?? p.isFinal ?? p.accepting ?? p.final ?? p.is_accepting ?? p.is_final),
        };

        finalNodes.push(node);
        params.onAddNode?.(node);
        appliedCount++;
        break;
      }

      case 'DELETE_STATE': {
        const label = String(p.label || '').trim();
        const id = labelToId.get(label);
        if (id) {
          finalNodes = finalNodes.filter((n) => n.id !== id);
          finalEdges = finalEdges.filter((e) => e.sourceNodeId !== id && e.targetNodeId !== id);
          params.onRemoveNode?.(id);
          labelToId.delete(label);
          appliedCount++;
        }
        break;
      }

      case 'SET_INITIAL_STATE': {
        const label = String(p.label || '').trim();
        const id = labelToId.get(label);
        if (id) {
          finalNodes = finalNodes.map((n) => ({
            ...n,
            isInitial: n.id === id,
          }));
          params.onUpdateNode?.(id, { isInitial: true });
          appliedCount++;
        }
        break;
      }

      case 'TOGGLE_ACCEPTING_STATE': {
        const label = String(p.label || '').trim();
        const id = labelToId.get(label);
        if (id) {
          finalNodes = finalNodes.map((n) =>
            n.id === id ? { ...n, isAccepting: !n.isAccepting } : n
          );
          const target = finalNodes.find((n) => n.id === id);
          if (target) {
            params.onUpdateNode?.(id, { isAccepting: target.isAccepting });
          }
          appliedCount++;
        }
        break;
      }

      case 'CREATE_TRANSITION': {
        const from = String(p.from || '').trim();
        const to = String(p.to || '').trim();
        const sym = String(p.symbol || '').trim();
        const srcId = labelToId.get(from);
        const tgtId = labelToId.get(to);

        if (srcId && tgtId) {
          const newEdgeId = `edge_${from}_${to}_${sym || 'eps'}`;
          const edge: TransitionEdge = {
            id: newEdgeId,
            sourceNodeId: srcId,
            targetNodeId: tgtId,
            label: sym,
            stackTop: typeof p.stackTop === 'string' ? p.stackTop : undefined,
            stackReplacement: typeof p.stackReplacement === 'string' ? p.stackReplacement : undefined,
            writeSymbol: typeof p.writeSymbol === 'string' ? p.writeSymbol : undefined,
            moveDirection: (p.moveDirection as 'L' | 'R' | 'S') || undefined,
          };
          finalEdges.push(edge);
          params.onAddEdge?.(edge);
          appliedCount++;
        }
        break;
      }

      case 'DELETE_TRANSITION': {
        const from = String(p.from || '').trim();
        const to = String(p.to || '').trim();
        const sym = String(p.symbol || '').trim();
        const srcId = labelToId.get(from);
        const tgtId = labelToId.get(to);

        if (srcId && tgtId) {
          const edgeIndex = finalEdges.findIndex(
            (e) => e.sourceNodeId === srcId && e.targetNodeId === tgtId && e.label === sym
          );
          if (edgeIndex !== -1) {
            const edgeId = finalEdges[edgeIndex].id;
            finalEdges.splice(edgeIndex, 1);
            params.onRemoveEdge?.(edgeId);
            appliedCount++;
          }
        }
        break;
      }

      case 'EDIT_TRANSITION': {
        const from = String(p.from || '').trim();
        const to = String(p.to || '').trim();
        const oldSym = String(p.oldSymbol || '').trim();
        const newSym = String(p.newSymbol || '').trim();
        const srcId = labelToId.get(from);
        const tgtId = labelToId.get(to);

        if (srcId && tgtId) {
          const edge = finalEdges.find(
            (e) => e.sourceNodeId === srcId && e.targetNodeId === tgtId && e.label === oldSym
          );
          if (edge) {
            edge.label = newSym;
            if (typeof p.stackTop === 'string') edge.stackTop = p.stackTop;
            if (typeof p.stackReplacement === 'string') edge.stackReplacement = p.stackReplacement;
            if (typeof p.writeSymbol === 'string') edge.writeSymbol = p.writeSymbol;
            if (p.moveDirection) edge.moveDirection = p.moveDirection as 'L' | 'R' | 'S';

            params.onUpdateEdge?.(edge.id, {
              label: newSym,
              stackTop: edge.stackTop,
              stackReplacement: edge.stackReplacement,
              writeSymbol: edge.writeSymbol,
              moveDirection: edge.moveDirection,
            });
            appliedCount++;
          }
        }
        break;
      }
    }
  }

  // If atomic batch mutator provided, apply all changes in a single state snapshot
  if (params.onBatchMutate) {
    params.onBatchMutate(finalNodes, finalEdges);
  }

  return {
    success: true,
    appliedCount,
    finalNodes,
    finalEdges,
  };
}
