import { StateNode, TransitionEdge } from '@project-zero/canvas-renderer';
import { AutomatonType } from '@project-zero/shared';

export interface SerializedMachineMetadata {
  name?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SerializedDFA {
  schemaVersion: 1;
  machineType: AutomatonType;
  metadata?: SerializedMachineMetadata;
  nodes: StateNode[];
  edges: TransitionEdge[];
  initialStackSymbol?: string;
  blankSymbol?: string;
}

/**
 * Deterministically serializes an automaton graph state into a JSON string.
 */
export function serializeMachine(
  nodes: ReadonlyArray<StateNode>,
  edges: ReadonlyArray<TransitionEdge>,
  machineType: AutomatonType = 'DFA',
  metadata?: SerializedMachineMetadata,
  initialStackSymbol?: string,
  blankSymbol?: string
): string {
  const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  const sortedEdges = [...edges].sort((a, b) => a.id.localeCompare(b.id));

  const machine: SerializedDFA = {
    schemaVersion: 1,
    machineType,
    metadata,
    nodes: sortedNodes,
    edges: sortedEdges,
    ...(initialStackSymbol !== undefined
      ? { initialStackSymbol }
      : machineType === 'PDA'
      ? { initialStackSymbol: 'Z0' }
      : {}),
    ...(blankSymbol !== undefined
      ? { blankSymbol }
      : machineType === 'TM'
      ? { blankSymbol: '□' }
      : {}),
  };

  return JSON.stringify(machine, null, 2);
}

interface RawStateNode {
  id?: string;
  label?: string;
  x?: number;
  y?: number;
  isInitial?: boolean;
  isAccepting?: boolean;
  isSelected?: boolean;
}

interface RawTransitionEdge {
  id?: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  label?: string;
  inputSymbol?: string;
  stackTop?: string;
  stackReplacement?: string;
  readSymbol?: string;
  writeSymbol?: string;
  moveDirection?: 'L' | 'R' | 'S';
  isSelfLoop?: boolean;
  parallelIndex?: number;
  isSelected?: boolean;
}

/**
 * Safely deserializes and validates a serialized automaton graph structure.
 */
export function deserializeMachine(jsonInput: string | object): SerializedDFA {
  const data = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;

  if (!data || typeof data !== 'object') {
    throw new Error('Malformed machine data: expected object');
  }

  if (data.schemaVersion !== 1) {
    throw new Error(`Unsupported schema version: ${data.schemaVersion}`);
  }

  if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    throw new Error('Malformed machine data: missing nodes or edges array');
  }

  if (data.machineType !== undefined) {
    const raw = String(data.machineType).toUpperCase();
    if (raw !== 'DFA' && raw !== 'NFA' && raw !== 'PDA' && raw !== 'TM' && raw !== 'FA') {
      throw new Error(`Unsupported or invalid machine type: ${data.machineType}`);
    }
  }

  const rawType = data.machineType !== undefined ? String(data.machineType).toUpperCase() : 'DFA';
  const machineType: AutomatonType = rawType as AutomatonType;

  if (data.initialStackSymbol !== undefined) {
    if (typeof data.initialStackSymbol !== 'string' || data.initialStackSymbol.trim() === '') {
      throw new Error('Malformed machine data: invalid initialStackSymbol');
    }
  }

  if (data.blankSymbol !== undefined) {
    if (typeof data.blankSymbol !== 'string' || data.blankSymbol.trim() === '') {
      throw new Error('Malformed machine data: invalid blankSymbol');
    }
  }

  const nodeIds = new Set<string>();

  const nodes: StateNode[] = data.nodes.map((n: RawStateNode) => {
    if (
      !n ||
      typeof n.id !== 'string' ||
      typeof n.x !== 'number' ||
      typeof n.y !== 'number' ||
      !Number.isFinite(n.x) ||
      !Number.isFinite(n.y)
    ) {
      throw new Error('Malformed state node in serialized machine: invalid id or coordinates');
    }
    const id = String(n.id);
    nodeIds.add(id);
    return {
      id,
      label: String(n.label ?? n.id),
      x: Number(n.x),
      y: Number(n.y),
      isInitial: Boolean(n.isInitial),
      isAccepting: Boolean(n.isAccepting),
      ...(n.isSelected !== undefined ? { isSelected: Boolean(n.isSelected) } : {}),
    };
  });

  const edges: TransitionEdge[] = data.edges.map((e: RawTransitionEdge) => {
    if (
      !e ||
      typeof e.id !== 'string' ||
      typeof e.sourceNodeId !== 'string' ||
      typeof e.targetNodeId !== 'string'
    ) {
      throw new Error('Malformed transition edge in serialized machine: missing fields');
    }

    const srcId = String(e.sourceNodeId);
    const tgtId = String(e.targetNodeId);

    if (!nodeIds.has(srcId) || !nodeIds.has(tgtId)) {
      throw new Error(`Malformed transition edge in serialized machine: dangling endpoint (${srcId} -> ${tgtId})`);
    }

    if (e.inputSymbol !== undefined && typeof e.inputSymbol !== 'string') {
      throw new Error('Malformed transition edge in serialized machine: invalid inputSymbol');
    }
    if (e.stackTop !== undefined && typeof e.stackTop !== 'string') {
      throw new Error('Malformed transition edge in serialized machine: invalid stackTop');
    }
    if (e.stackReplacement !== undefined && typeof e.stackReplacement !== 'string') {
      throw new Error('Malformed transition edge in serialized machine: invalid stackReplacement');
    }
    if (e.readSymbol !== undefined && typeof e.readSymbol !== 'string') {
      throw new Error('Malformed transition edge in serialized machine: invalid readSymbol');
    }
    if (e.writeSymbol !== undefined && typeof e.writeSymbol !== 'string') {
      throw new Error('Malformed transition edge in serialized machine: invalid writeSymbol');
    }
    if (e.moveDirection !== undefined && e.moveDirection !== 'L' && e.moveDirection !== 'R' && e.moveDirection !== 'S') {
      throw new Error('Malformed transition edge in serialized machine: invalid moveDirection');
    }

    return {
      id: String(e.id),
      sourceNodeId: srcId,
      targetNodeId: tgtId,
      label: String(e.label ?? ''),
      ...(e.inputSymbol !== undefined ? { inputSymbol: String(e.inputSymbol) } : {}),
      ...(e.stackTop !== undefined ? { stackTop: String(e.stackTop) } : {}),
      ...(e.stackReplacement !== undefined ? { stackReplacement: String(e.stackReplacement) } : {}),
      ...(e.readSymbol !== undefined ? { readSymbol: String(e.readSymbol) } : {}),
      ...(e.writeSymbol !== undefined ? { writeSymbol: String(e.writeSymbol) } : {}),
      ...(e.moveDirection !== undefined ? { moveDirection: e.moveDirection } : {}),
      ...(e.isSelfLoop !== undefined ? { isSelfLoop: Boolean(e.isSelfLoop) } : {}),
      ...(e.parallelIndex !== undefined ? { parallelIndex: Number(e.parallelIndex) } : {}),
      ...(e.isSelected !== undefined ? { isSelected: Boolean(e.isSelected) } : {}),
    };
  });

  const initialStackSymbol =
    typeof data.initialStackSymbol === 'string' && data.initialStackSymbol.trim() !== ''
      ? data.initialStackSymbol
      : machineType === 'PDA'
      ? 'Z0'
      : undefined;

  const blankSymbol =
    typeof data.blankSymbol === 'string' && data.blankSymbol.trim() !== ''
      ? data.blankSymbol
      : machineType === 'TM'
      ? '□'
      : undefined;

  return {
    schemaVersion: 1,
    machineType,
    metadata: data.metadata,
    nodes,
    edges,
    ...(initialStackSymbol !== undefined ? { initialStackSymbol } : {}),
    ...(blankSymbol !== undefined ? { blankSymbol } : {}),
  };
}
