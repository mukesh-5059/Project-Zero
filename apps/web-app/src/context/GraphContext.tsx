import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import type { StateNode, TransitionEdge, CanvasTool } from '@project-zero/canvas-renderer';
import { FiniteAutomaton5Tuple, AutomatonType } from '@project-zero/shared';
import { analyzeDFACompleteness, DFACompletenessResult, DFAMinimizationResult, RegexToNFAResult } from '@project-zero/core-solver';

// ---------------------------------------------------------------------------
// State shape & History snapshot
// ---------------------------------------------------------------------------

export interface GraphSnapshot {
  nodes: StateNode[];
  edges: TransitionEdge[];
  machineType: AutomatonType;
  initialStackSymbol: string;
  blankSymbol: string;
}

export interface GraphState {
  nodes: StateNode[];
  edges: TransitionEdge[];
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  activeTool: CanvasTool;
  machineType: AutomatonType;
  initialStackSymbol: string;
  blankSymbol: string;
  past: GraphSnapshot[];
  future: GraphSnapshot[];
  lastMinimizationResult?: DFAMinimizationResult | null;
  lastRegexResult?: { inputRegex: string; result: RegexToNFAResult } | null;
  activeExplanationSource?: 'minimization' | 'regex' | null;
}

const initialState: GraphState = {
  nodes: [],
  edges: [],
  selectedNodeIds: [],
  selectedEdgeIds: [],
  activeTool: 'select',
  machineType: 'DFA',
  initialStackSymbol: 'Z0',
  blankSymbol: '□',
  past: [],
  future: [],
  lastMinimizationResult: null,
  lastRegexResult: null,
  activeExplanationSource: null,
};

// ---------------------------------------------------------------------------
// Helper: Recompute parallel indices for overlapping/opposite transition edges
// ---------------------------------------------------------------------------

function recomputeParallelIndices(edges: TransitionEdge[]): TransitionEdge[] {
  const pairGroups = new Map<string, TransitionEdge[]>();

  for (const edge of edges) {
    const key = [edge.sourceNodeId, edge.targetNodeId].sort().join('<->');
    const list = pairGroups.get(key) ?? [];
    list.push(edge);
    pairGroups.set(key, list);
  }

  const result: TransitionEdge[] = [];

  for (const group of pairGroups.values()) {
    if (group.length === 1) {
      const edge = group[0];
      const isSelfLoop = edge.sourceNodeId === edge.targetNodeId;
      result.push(isSelfLoop ? { ...edge, isSelfLoop: true } : { ...edge, parallelIndex: 0 });
    } else {
      group.forEach((edge, idx) => {
        let parallelIndex = 0;
        if (idx > 0) {
          const step = Math.ceil(idx / 2);
          parallelIndex = idx % 2 === 1 ? step : -step;
        }
        const isSelfLoop = edge.sourceNodeId === edge.targetNodeId;
        result.push({
          ...edge,
          parallelIndex,
          isSelfLoop,
        });
      });
    }
  }

  return result;
}

function createSnapshot(state: GraphState): GraphSnapshot {
  return {
    nodes: state.nodes.map((n) => ({ ...n })),
    edges: state.edges.map((e) => ({ ...e })),
    machineType: state.machineType,
    initialStackSymbol: state.initialStackSymbol,
    blankSymbol: state.blankSymbol,
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type GraphAction =
  | { type: 'ADD_NODE'; node: StateNode }
  | { type: 'REMOVE_NODE'; id: string }
  | { type: 'MOVE_NODE'; id: string; x: number; y: number; isTransient?: boolean }
  | { type: 'MOVE_NODES'; moves: Array<{ id: string; x: number; y: number }>; isTransient?: boolean }
  | { type: 'UPDATE_NODE'; id: string; patch: Partial<StateNode> }
  | { type: 'SET_NODES'; nodes: StateNode[]; pushHistory?: boolean }
  | { type: 'ADD_EDGE'; edge: TransitionEdge }
  | { type: 'REMOVE_EDGE'; id: string }
  | { type: 'UPDATE_EDGE'; id: string; patch: Partial<TransitionEdge> }
  | { type: 'SET_EDGES'; edges: TransitionEdge[]; pushHistory?: boolean }
  | { type: 'DELETE_SELECTED' }
  | { type: 'CLEAR_CANVAS' }
  | { type: 'PASTE_GRAPH'; nodes: StateNode[]; edges: TransitionEdge[] }
  | { type: 'SET_SELECTION'; nodeIds: string[]; edgeIds: string[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_TOOL'; tool: CanvasTool }
  | { type: 'SET_MACHINE_TYPE'; machineType: AutomatonType }
  | { type: 'SET_INITIAL_STACK_SYMBOL'; initialStackSymbol: string }
  | { type: 'SET_BLANK_SYMBOL'; blankSymbol: string }
  | { type: 'REPLACE_MACHINE'; nodes: StateNode[]; edges: TransitionEdge[]; machineType: AutomatonType; initialStackSymbol?: string; blankSymbol?: string }
  | { type: 'SET_MINIMIZATION_RESULT'; result: DFAMinimizationResult | null }
  | { type: 'SET_REGEX_RESULT'; inputRegex: string; result: RegexToNFAResult }
  | { type: 'SET_EXPLANATION_SOURCE'; source: 'minimization' | 'regex' }
  | { type: 'UNDO' }
  | { type: 'REDO' };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function graphReducer(state: GraphState, action: GraphAction): GraphState {
  switch (action.type) {
    case 'SET_MINIMIZATION_RESULT':
      return { ...state, lastMinimizationResult: action.result, activeExplanationSource: 'minimization' };
    case 'SET_REGEX_RESULT':
      return { ...state, lastRegexResult: { inputRegex: action.inputRegex, result: action.result }, activeExplanationSource: 'regex' };
    case 'SET_EXPLANATION_SOURCE':
      return { ...state, activeExplanationSource: action.source };
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, state.past.length - 1);
      const currentSnap = createSnapshot(state);

      // Clean invalid selection IDs
      const validNodeIds = new Set(previous.nodes.map((n) => n.id));
      const validEdgeIds = new Set(previous.edges.map((e) => e.id));

      return {
        ...state,
        nodes: previous.nodes,
        edges: previous.edges,
        machineType: previous.machineType ?? state.machineType,
        initialStackSymbol: previous.initialStackSymbol ?? state.initialStackSymbol,
        blankSymbol: previous.blankSymbol ?? state.blankSymbol,
        selectedNodeIds: state.selectedNodeIds.filter((id) => validNodeIds.has(id)),
        selectedEdgeIds: state.selectedEdgeIds.filter((id) => validEdgeIds.has(id)),
        past: newPast,
        future: [currentSnap, ...state.future],
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      const currentSnap = createSnapshot(state);

      const validNodeIds = new Set(next.nodes.map((n) => n.id));
      const validEdgeIds = new Set(next.edges.map((e) => e.id));

      return {
        ...state,
        nodes: next.nodes,
        edges: next.edges,
        machineType: next.machineType ?? state.machineType,
        initialStackSymbol: next.initialStackSymbol ?? state.initialStackSymbol,
        blankSymbol: next.blankSymbol ?? state.blankSymbol,
        selectedNodeIds: state.selectedNodeIds.filter((id) => validNodeIds.has(id)),
        selectedEdgeIds: state.selectedEdgeIds.filter((id) => validEdgeIds.has(id)),
        past: [...state.past, currentSnap],
        future: newFuture,
      };
    }

    case 'ADD_NODE': {
      const isFirstNode = state.nodes.length === 0;
      const newNode = {
        ...action.node,
        isInitial: action.node.isInitial ?? isFirstNode,
      };
      const isSettingInitial = newNode.isInitial === true;
      const existingNodes = isSettingInitial
        ? state.nodes.map((n) => ({ ...n, isInitial: false }))
        : state.nodes;

      return {
        ...state,
        nodes: [...existingNodes, newNode],
        past: [...state.past, createSnapshot(state)],
        future: [],
      };
    }

    case 'REMOVE_NODE': {
      const remainingEdges = state.edges.filter(
        (e) => e.sourceNodeId !== action.id && e.targetNodeId !== action.id
      );
      return {
        ...state,
        nodes: state.nodes.filter((n) => n.id !== action.id),
        edges: recomputeParallelIndices(remainingEdges),
        selectedNodeIds: state.selectedNodeIds.filter((id) => id !== action.id),
        selectedEdgeIds: state.selectedEdgeIds.filter(
          (id) => remainingEdges.some((e) => e.id === id)
        ),
        past: [...state.past, createSnapshot(state)],
        future: [],
      };
    }

    case 'MOVE_NODE': {
      const updatedNodes = state.nodes.map((n) =>
        n.id === action.id ? { ...n, x: action.x, y: action.y } : n
      );
      if (action.isTransient) {
        return { ...state, nodes: updatedNodes };
      }
      return {
        ...state,
        nodes: updatedNodes,
        past: [...state.past, createSnapshot(state)],
        future: [],
      };
    }

    case 'MOVE_NODES': {
      const moveMap = new Map(action.moves.map((m) => [m.id, { x: m.x, y: m.y }]));
      const updatedNodes = state.nodes.map((n) => {
        const move = moveMap.get(n.id);
        return move ? { ...n, x: move.x, y: move.y } : n;
      });

      if (action.isTransient) {
        return { ...state, nodes: updatedNodes };
      }
      return {
        ...state,
        nodes: updatedNodes,
        past: [...state.past, createSnapshot(state)],
        future: [],
      };
    }

    case 'UPDATE_NODE': {
      const isSettingInitial = action.patch.isInitial === true;
      const updatedNodes = state.nodes.map((n) => {
        if (n.id === action.id) {
          return { ...n, ...action.patch };
        }
        return isSettingInitial ? { ...n, isInitial: false } : n;
      });

      return {
        ...state,
        nodes: updatedNodes,
        past: [...state.past, createSnapshot(state)],
        future: [],
      };
    }

    case 'SET_NODES': {
      if (action.pushHistory) {
        return {
          ...state,
          nodes: [...action.nodes],
          past: [...state.past, createSnapshot(state)],
          future: [],
        };
      }
      return { ...state, nodes: [...action.nodes] };
    }

    case 'ADD_EDGE': {
      if (state.edges.some((e) => e.id === action.edge.id)) {
        return state;
      }
      return {
        ...state,
        edges: recomputeParallelIndices([...state.edges, action.edge]),
        past: [...state.past, createSnapshot(state)],
        future: [],
      };
    }

    case 'REMOVE_EDGE':
      return {
        ...state,
        edges: recomputeParallelIndices(state.edges.filter((e) => e.id !== action.id)),
        selectedEdgeIds: state.selectedEdgeIds.filter((id) => id !== action.id),
        past: [...state.past, createSnapshot(state)],
        future: [],
      };

    case 'UPDATE_EDGE': {
      const updated = state.edges.map((e) =>
        e.id === action.id ? { ...e, ...action.patch } : e
      );
      return {
        ...state,
        edges: recomputeParallelIndices(updated),
        past: [...state.past, createSnapshot(state)],
        future: [],
      };
    }

    case 'SET_EDGES': {
      if (action.pushHistory) {
        return {
          ...state,
          edges: recomputeParallelIndices(action.edges),
          past: [...state.past, createSnapshot(state)],
          future: [],
        };
      }
      return { ...state, edges: recomputeParallelIndices(action.edges) };
    }

    case 'DELETE_SELECTED': {
      if (state.selectedNodeIds.length === 0 && state.selectedEdgeIds.length === 0) {
        return state;
      }
      const deleteNodeIdsSet = new Set(state.selectedNodeIds);
      const deleteEdgeIdsSet = new Set(state.selectedEdgeIds);

      const remainingNodes = state.nodes.filter((n) => !deleteNodeIdsSet.has(n.id));
      const remainingEdges = state.edges.filter(
        (e) =>
          !deleteEdgeIdsSet.has(e.id) &&
          !deleteNodeIdsSet.has(e.sourceNodeId) &&
          !deleteNodeIdsSet.has(e.targetNodeId)
      );

      return {
        ...state,
        nodes: remainingNodes,
        edges: recomputeParallelIndices(remainingEdges),
        selectedNodeIds: [],
        selectedEdgeIds: [],
        past: [...state.past, createSnapshot(state)],
        future: [],
      };
    }

    case 'CLEAR_CANVAS': {
      return {
        ...state,
        nodes: [],
        edges: [],
        selectedNodeIds: [],
        selectedEdgeIds: [],
        past: state.nodes.length > 0 || state.edges.length > 0 ? [...state.past, createSnapshot(state)] : state.past,
        future: [],
      };
    }

    case 'PASTE_GRAPH': {
      const newNodes = [...state.nodes, ...action.nodes];
      const newEdges = recomputeParallelIndices([...state.edges, ...action.edges]);
      const pastedNodeIds = action.nodes.map((n) => n.id);
      const pastedEdgeIds = action.edges.map((e) => e.id);

      return {
        ...state,
        nodes: newNodes,
        edges: newEdges,
        selectedNodeIds: pastedNodeIds,
        selectedEdgeIds: pastedEdgeIds,
        past: [...state.past, createSnapshot(state)],
        future: [],
      };
    }

    case 'SET_SELECTION':
      return {
        ...state,
        selectedNodeIds: action.nodeIds,
        selectedEdgeIds: action.edgeIds,
      };

    case 'CLEAR_SELECTION':
      return { ...state, selectedNodeIds: [], selectedEdgeIds: [] };

    case 'SET_TOOL':
      return { ...state, activeTool: action.tool };

    case 'SET_MACHINE_TYPE': {
      const normalizedType = (action.machineType === 'DFA' || action.machineType === 'NFA') ? 'FA' : action.machineType;
      if (state.machineType === normalizedType) return state;
      return {
        ...state,
        machineType: normalizedType,
        past: [...state.past, createSnapshot(state)],
        future: [],
      };
    }

    case 'SET_INITIAL_STACK_SYMBOL': {
      if (state.initialStackSymbol === action.initialStackSymbol) return state;
      return {
        ...state,
        initialStackSymbol: action.initialStackSymbol,
        past: [...state.past, createSnapshot(state)],
        future: [],
      };
    }

    case 'SET_BLANK_SYMBOL': {
      if (state.blankSymbol === action.blankSymbol) return state;
      return {
        ...state,
        blankSymbol: action.blankSymbol,
        past: [...state.past, createSnapshot(state)],
        future: [],
      };
    }

    case 'REPLACE_MACHINE': {
      const normalizedType = (action.machineType === 'DFA' || action.machineType === 'NFA') ? 'FA' : action.machineType;
      return {
        ...state,
        nodes: [...action.nodes],
        edges: recomputeParallelIndices(action.edges),
        machineType: normalizedType,
        initialStackSymbol: action.initialStackSymbol ?? (action.machineType === 'PDA' ? 'Z0' : state.initialStackSymbol),
        blankSymbol: action.blankSymbol ?? (action.machineType === 'TM' ? '□' : state.blankSymbol),
        selectedNodeIds: [],
        selectedEdgeIds: [],
        past: [...state.past, createSnapshot(state)],
        future: [],
      };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Clipboard state for Copy/Paste
// ---------------------------------------------------------------------------
interface ClipboardState {
  nodes: StateNode[];
  edges: TransitionEdge[];
}
let internalClipboard: ClipboardState | null = null;

// ---------------------------------------------------------------------------
// Context value shape
// ---------------------------------------------------------------------------

export interface GraphContextValue extends GraphState {
  // Node & Edge mutations
  addNode: (node: StateNode) => void;
  removeNode: (id: string) => void;
  moveNode: (id: string, x: number, y: number, isTransient?: boolean) => void;
  moveNodes: (moves: Array<{ id: string; x: number; y: number }>, isTransient?: boolean) => void;
  updateNode: (id: string, patch: Partial<StateNode>) => void;
  setNodes: (nodes: StateNode[], pushHistory?: boolean) => void;
  addEdge: (edge: TransitionEdge) => void;
  removeEdge: (id: string) => void;
  updateEdge: (id: string, patch: Partial<TransitionEdge>) => void;
  setEdges: (edges: TransitionEdge[], pushHistory?: boolean) => void;

  // History & High Level Operations
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  deleteSelected: () => void;
  clearCanvas: () => void;
  copySelection: () => void;
  pasteSelection: () => void;

  // Selection & Tooling
  setSelection: (nodeIds: ReadonlyArray<string>, edgeIds: ReadonlyArray<string>) => void;
  clearSelection: () => void;
  setTool: (tool: CanvasTool) => void;
  // Machine metadata & Modes
  setMachineType: (type: AutomatonType) => void;
  setInitialStackSymbol: (symbol: string) => void;
  setBlankSymbol: (symbol: string) => void;
  replaceMachine: (nodes: StateNode[], edges: TransitionEdge[], machineType: AutomatonType, initialStackSymbol?: string, blankSymbol?: string) => void;
  setLastMinimizationResult: (res: DFAMinimizationResult | null) => void;
  setLastRegexResult: (data: { inputRegex: string; result: RegexToNFAResult } | null) => void;
  activeExplanationSource: 'minimization' | 'regex' | null;
  setActiveExplanationSource: (source: 'minimization' | 'regex') => void;

  // Validation & Completeness Selectors
  completenessResult: DFACompletenessResult;
  getInitialState: () => StateNode | undefined;
  getAcceptingStates: () => StateNode[];
  getAlphabet: () => string[];
  getOutgoingTransitions: (stateId: string) => TransitionEdge[];
  getTransitionsForSymbol: (stateId: string, symbol: string) => TransitionEdge[];
  getStateCount: () => number;
  getTransitionCount: () => number;
  getAcceptingStateCount: () => number;
  hasEpsilonTransitions: () => boolean;
  hasMultipleTransitionsForSymbol: (stateId: string, symbol: string) => boolean;
  to5Tuple: () => FiniteAutomaton5Tuple;
}

// ---------------------------------------------------------------------------
// Context & Provider
// ---------------------------------------------------------------------------

const GraphContext = createContext<GraphContextValue | undefined>(undefined);

export const GraphProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(graphReducer, initialState);

  const addNode = useCallback((node: StateNode) => dispatch({ type: 'ADD_NODE', node }), []);
  const removeNode = useCallback((id: string) => dispatch({ type: 'REMOVE_NODE', id }), []);
  const moveNode = useCallback(
    (id: string, x: number, y: number, isTransient?: boolean) =>
      dispatch({ type: 'MOVE_NODE', id, x, y, isTransient }),
    []
  );
  const moveNodes = useCallback(
    (moves: Array<{ id: string; x: number; y: number }>, isTransient?: boolean) =>
      dispatch({ type: 'MOVE_NODES', moves, isTransient }),
    []
  );
  const updateNode = useCallback(
    (id: string, patch: Partial<StateNode>) => dispatch({ type: 'UPDATE_NODE', id, patch }),
    []
  );
  const setNodes = useCallback(
    (nodes: StateNode[], pushHistory?: boolean) => dispatch({ type: 'SET_NODES', nodes, pushHistory }),
    []
  );
  const addEdge = useCallback((edge: TransitionEdge) => dispatch({ type: 'ADD_EDGE', edge }), []);
  const removeEdge = useCallback((id: string) => dispatch({ type: 'REMOVE_EDGE', id }), []);
  const updateEdge = useCallback(
    (id: string, patch: Partial<TransitionEdge>) => dispatch({ type: 'UPDATE_EDGE', id, patch }),
    []
  );
  const setEdges = useCallback(
    (edges: TransitionEdge[], pushHistory?: boolean) => dispatch({ type: 'SET_EDGES', edges, pushHistory }),
    []
  );

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);
  const deleteSelected = useCallback(() => dispatch({ type: 'DELETE_SELECTED' }), []);
  const clearCanvas = useCallback(() => dispatch({ type: 'CLEAR_CANVAS' }), []);

  const copySelection = useCallback(() => {
    const selectedNodes = state.nodes.filter((n) => state.selectedNodeIds.includes(n.id));
    if (selectedNodes.length === 0) return;

    const selectedNodeIdSet = new Set(selectedNodes.map((n) => n.id));
    // Include transitions only if BOTH endpoints are in copied node set
    const internalEdges = state.edges.filter(
      (e) => selectedNodeIdSet.has(e.sourceNodeId) && selectedNodeIdSet.has(e.targetNodeId)
    );

    internalClipboard = {
      nodes: selectedNodes.map((n) => ({ ...n })),
      edges: internalEdges.map((e) => ({ ...e })),
    };
  }, [state.nodes, state.edges, state.selectedNodeIds]);

  const pasteSelection = useCallback(() => {
    if (!internalClipboard || internalClipboard.nodes.length === 0) return;

    const idMap = new Map<string, string>();
    const pastedNodes: StateNode[] = internalClipboard.nodes.map((n) => {
      const newId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        x: n.x + 30,
        y: n.y + 30,
        isInitial: false, // Safely handle initial state semantics on paste
        isSelected: true,
      };
    });

    const pastedEdges: TransitionEdge[] = internalClipboard.edges.map((e) => {
      const newEdgeId = `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      return {
        ...e,
        id: newEdgeId,
        sourceNodeId: idMap.get(e.sourceNodeId)!,
        targetNodeId: idMap.get(e.targetNodeId)!,
        isSelected: true,
      };
    });

    dispatch({ type: 'PASTE_GRAPH', nodes: pastedNodes, edges: pastedEdges });
  }, []);

  const setSelection = useCallback(
    (nodeIds: ReadonlyArray<string>, edgeIds: ReadonlyArray<string>) =>
      dispatch({ type: 'SET_SELECTION', nodeIds: [...nodeIds], edgeIds: [...edgeIds] }),
    []
  );
  const clearSelection = useCallback(() => dispatch({ type: 'CLEAR_SELECTION' }), []);
  const setTool = useCallback((tool: CanvasTool) => dispatch({ type: 'SET_TOOL', tool }), []);
  const setMachineType = useCallback((machineType: AutomatonType) => {
    dispatch({ type: 'SET_MACHINE_TYPE', machineType });
  }, []);

  const setInitialStackSymbol = useCallback((initialStackSymbol: string) => {
    dispatch({ type: 'SET_INITIAL_STACK_SYMBOL', initialStackSymbol });
  }, []);

  const setBlankSymbol = useCallback((blankSymbol: string) => {
    dispatch({ type: 'SET_BLANK_SYMBOL', blankSymbol });
  }, []);

  const replaceMachine = useCallback(
    (nodes: StateNode[], edges: TransitionEdge[], machineType: AutomatonType, initialStackSymbol?: string, blankSymbol?: string) => {
      dispatch({ type: 'REPLACE_MACHINE', nodes, edges, machineType, initialStackSymbol, blankSymbol });
    },
    []
  );

  const setLastMinimizationResult = useCallback((result: DFAMinimizationResult | null) => {
    dispatch({ type: 'SET_MINIMIZATION_RESULT', result });
  }, []);

  const setLastRegexResult = useCallback((data: { inputRegex: string; result: RegexToNFAResult } | null) => {
    if (!data) {
      dispatch({ type: 'SET_REGEX_RESULT', inputRegex: '', result: { success: false, nodes: [], edges: [], alphabet: [] } });
    } else {
      dispatch({ type: 'SET_REGEX_RESULT', inputRegex: data.inputRegex, result: data.result });
    }
  }, []);

  const setActiveExplanationSource = useCallback((source: 'minimization' | 'regex') => {
    dispatch({ type: 'SET_EXPLANATION_SOURCE', source });
  }, []);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const completenessResult = useMemo(() => {
    return analyzeDFACompleteness({ nodes: state.nodes, edges: state.edges });
  }, [state.nodes, state.edges]);

  // Read-only queries
  const getInitialState = useCallback(() => state.nodes.find((n) => n.isInitial), [state.nodes]);
  const getAcceptingStates = useCallback(() => state.nodes.filter((n) => n.isAccepting), [state.nodes]);
  const getAlphabet = useCallback(() => {
    const rawSymbols = state.edges.map((e) => e.label).filter((l) => l && l.trim().length > 0);
    return Array.from(new Set(rawSymbols)).sort();
  }, [state.edges]);

  const getOutgoingTransitions = useCallback(
    (stateId: string) => state.edges.filter((e) => e.sourceNodeId === stateId),
    [state.edges]
  );
  const getTransitionsForSymbol = useCallback(
    (stateId: string, symbol: string) =>
      state.edges.filter((e) => e.sourceNodeId === stateId && e.label === symbol),
    [state.edges]
  );
  const getStateCount = useCallback(() => state.nodes.length, [state.nodes]);
  const getTransitionCount = useCallback(() => state.edges.length, [state.edges]);
  const getAcceptingStateCount = useCallback(
    () => state.nodes.filter((n) => n.isAccepting).length,
    [state.nodes]
  );
  const hasEpsilonTransitions = useCallback(
    () => state.edges.some((e) => !e.label || e.label === 'ε' || e.label === 'λ' || e.label.trim() === ''),
    [state.edges]
  );
  const hasMultipleTransitionsForSymbol = useCallback(
    (stateId: string, symbol: string) =>
      state.edges.filter((e) => e.sourceNodeId === stateId && e.label === symbol).length > 1,
    [state.edges]
  );

  const to5Tuple = useCallback((): FiniteAutomaton5Tuple => {
    const initialStateNode = state.nodes.find((n) => n.isInitial);
    const alphabet = Array.from(
      new Set(state.edges.map((e) => e.label).filter((l) => l && l.trim().length > 0))
    ).sort();

    return {
      states: state.nodes.map((n) => n.label || n.id),
      alphabet,
      initialState: initialStateNode ? initialStateNode.label || initialStateNode.id : null,
      acceptingStates: state.nodes.filter((n) => n.isAccepting).map((n) => n.label || n.id),
      transitions: state.edges.map((e) => {
        const srcNode = state.nodes.find((n) => n.id === e.sourceNodeId);
        const tgtNode = state.nodes.find((n) => n.id === e.targetNodeId);
        return {
          from: srcNode ? srcNode.label || srcNode.id : e.sourceNodeId,
          symbol: e.label,
          to: tgtNode ? tgtNode.label || tgtNode.id : e.targetNodeId,
        };
      }),
    };
  }, [state.nodes, state.edges]);

  const value: GraphContextValue = {
    ...state,
    addNode,
    removeNode,
    moveNode,
    moveNodes,
    updateNode,
    setNodes,
    addEdge,
    removeEdge,
    updateEdge,
    setEdges,
    undo,
    redo,
    canUndo,
    canRedo,
    deleteSelected,
    clearCanvas,
    copySelection,
    pasteSelection,
    setSelection,
    clearSelection,
    setTool,
    setMachineType,
    setInitialStackSymbol,
    setBlankSymbol,
    replaceMachine,
    setLastMinimizationResult,
    setLastRegexResult,
    activeExplanationSource: state.activeExplanationSource ?? null,
    setActiveExplanationSource,
    completenessResult,
    getInitialState,
    getAcceptingStates,
    getAlphabet,
    getOutgoingTransitions,
    getTransitionsForSymbol,
    getStateCount,
    getTransitionCount,
    getAcceptingStateCount,
    hasEpsilonTransitions,
    hasMultipleTransitionsForSymbol,
    to5Tuple,
  };

  return <GraphContext.Provider value={value}>{children}</GraphContext.Provider>;
};

export const useGraph = (): GraphContextValue => {
  const ctx = useContext(GraphContext);
  if (!ctx) {
    throw new Error('useGraph must be used within a GraphProvider');
  }
  return ctx;
};

