import { describe, it, expect, vi } from 'vitest';
import { StateNode, TransitionEdge } from '@project-zero/canvas-renderer';
import { AIActionEnvelope, validateActionEnvelope } from '@project-zero/ai-gateway';
import { validateActionsSemantics, executeAIActions } from '../aiActionExecutor';

describe('Phase 13 & Phase 14B: AI Action Semantic Validation & Safe Automaton Construction', () => {
  const initialNodes: StateNode[] = [
    { id: 'node_0', label: 'q0', x: 100, y: 100, isInitial: true, isAccepting: false },
    { id: 'node_1', label: 'q1', x: 200, y: 100, isInitial: false, isAccepting: true },
  ];

  const initialEdges: TransitionEdge[] = [
    { id: 'edge_0', sourceNodeId: 'node_0', targetNodeId: 'node_1', label: 'a' },
  ];

  it('1. validates valid CREATE_STATE action', () => {
    const envelope: AIActionEnvelope = {
      version: '1.0.0',
      actions: [
        {
          id: 'act_1',
          type: 'CREATE_STATE',
          parameters: { label: 'q2', isAccepting: false },
        },
      ],
    };

    const res = validateActionsSemantics(envelope, initialNodes, initialEdges, 'DFA');
    expect(res.isValid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it('2. rejects CREATE_STATE with duplicate label', () => {
    const envelope: AIActionEnvelope = {
      version: '1.0.0',
      actions: [
        {
          id: 'act_1',
          type: 'CREATE_STATE',
          parameters: { label: 'q0' },
        },
      ],
    };

    const res = validateActionsSemantics(envelope, initialNodes, initialEdges, 'DFA');
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('already exists');
  });

  it('3. rejects transition to nonexistent state', () => {
    const envelope: AIActionEnvelope = {
      version: '1.0.0',
      actions: [
        {
          id: 'act_1',
          type: 'CREATE_TRANSITION',
          parameters: { from: 'q0', to: 'q99', symbol: 'b' },
        },
      ],
    };

    const res = validateActionsSemantics(envelope, initialNodes, initialEdges, 'DFA');
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('Target state "q99" does not exist');
  });

  it('4. rejects epsilon transition on DFA', () => {
    const envelope: AIActionEnvelope = {
      version: '1.0.0',
      actions: [
        {
          id: 'act_1',
          type: 'CREATE_TRANSITION',
          parameters: { from: 'q0', to: 'q1', symbol: 'ε' },
        },
      ],
    };

    const res = validateActionsSemantics(envelope, initialNodes, initialEdges, 'DFA');
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('DFA does not permit epsilon');
  });

  it('5. executes valid batch modifications sequentially', () => {
    const onAddNode = vi.fn();
    const onAddEdge = vi.fn();

    const envelope: AIActionEnvelope = {
      version: '1.0.0',
      actions: [
        {
          id: 'act_1',
          type: 'CREATE_STATE',
          parameters: { label: 'q2', isAccepting: true },
        },
        {
          id: 'act_2',
          type: 'CREATE_TRANSITION',
          parameters: { from: 'q1', to: 'q2', symbol: 'b' },
        },
      ],
    };

    const res = executeAIActions({
      envelope,
      currentNodes: initialNodes,
      currentEdges: initialEdges,
      machineType: 'DFA',
      onAddNode,
      onRemoveNode: vi.fn(),
      onUpdateNode: vi.fn(),
      onAddEdge,
      onRemoveEdge: vi.fn(),
      onUpdateEdge: vi.fn(),
    });

    expect(res.success).toBe(true);
    expect(res.appliedCount).toBe(2);
    expect(onAddNode).toHaveBeenCalledTimes(1);
    expect(onAddEdge).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // Phase 14B: Multi-Action Automaton Construction Tests
  // --------------------------------------------------------------------------

  it('6. validates and executes full multi-action DFA construction (ending in 01)', () => {
    const fullDfaEnvelope: AIActionEnvelope = {
      version: '1.0.0',
      summary: 'DFA accepting binary strings ending in 01',
      actions: [
        { id: 'a1', type: 'CREATE_STATE', parameters: { label: 'q0', isInitial: true, isAccepting: false } },
        { id: 'a2', type: 'CREATE_STATE', parameters: { label: 'q1', isInitial: false, isAccepting: false } },
        { id: 'a3', type: 'CREATE_STATE', parameters: { label: 'q2', isInitial: false, isAccepting: true } },
        { id: 'a4', type: 'CREATE_TRANSITION', parameters: { from: 'q0', to: 'q1', symbol: '0' } },
        { id: 'a5', type: 'CREATE_TRANSITION', parameters: { from: 'q0', to: 'q0', symbol: '1' } },
        { id: 'a6', type: 'CREATE_TRANSITION', parameters: { from: 'q1', to: 'q1', symbol: '0' } },
        { id: 'a7', type: 'CREATE_TRANSITION', parameters: { from: 'q1', to: 'q2', symbol: '1' } },
        { id: 'a8', type: 'CREATE_TRANSITION', parameters: { from: 'q2', to: 'q1', symbol: '0' } },
        { id: 'a9', type: 'CREATE_TRANSITION', parameters: { from: 'q2', to: 'q0', symbol: '1' } },
      ],
    };

    expect(() => validateActionEnvelope(fullDfaEnvelope)).not.toThrow();

    const validation = validateActionsSemantics(fullDfaEnvelope, [], [], 'DFA');
    expect(validation.isValid).toBe(true);
    expect(validation.errors.length).toBe(0);

    const onBatchMutate = vi.fn();
    const result = executeAIActions({
      envelope: fullDfaEnvelope,
      currentNodes: [],
      currentEdges: [],
      machineType: 'DFA',
      onBatchMutate,
    });

    expect(result.success).toBe(true);
    expect(result.appliedCount).toBe(9);
    expect(result.finalNodes?.length).toBe(3);
    expect(result.finalEdges?.length).toBe(6);
    expect(onBatchMutate).toHaveBeenCalledTimes(1);

    // Verify initial and accepting states
    const q0 = result.finalNodes?.find((n) => n.label === 'q0');
    const q2 = result.finalNodes?.find((n) => n.label === 'q2');
    expect(q0?.isInitial).toBe(true);
    expect(q2?.isAccepting).toBe(true);
  });

  it('7. rejects DFA construction with conflicting non-deterministic transitions', () => {
    const conflictingEnvelope: AIActionEnvelope = {
      version: '1.0.0',
      actions: [
        { id: 'a1', type: 'CREATE_STATE', parameters: { label: 'q0' } },
        { id: 'a2', type: 'CREATE_STATE', parameters: { label: 'q1' } },
        { id: 'a3', type: 'CREATE_STATE', parameters: { label: 'q2' } },
        // Two transitions from q0 on symbol '0' to different targets
        { id: 'a4', type: 'CREATE_TRANSITION', parameters: { from: 'q0', to: 'q1', symbol: '0' } },
        { id: 'a5', type: 'CREATE_TRANSITION', parameters: { from: 'q0', to: 'q2', symbol: '0' } },
      ],
    };

    const validation = validateActionsSemantics(conflictingEnvelope, [], [], 'DFA');
    expect(validation.isValid).toBe(false);
    expect(validation.errors[0]).toContain('DFA determinism violation');
  });

  it('8. rejects multi-action sequence referencing nonexistent state endpoint', () => {
    const invalidEnvelope: AIActionEnvelope = {
      version: '1.0.0',
      actions: [
        { id: 'a1', type: 'CREATE_STATE', parameters: { label: 'q0' } },
        { id: 'a2', type: 'CREATE_TRANSITION', parameters: { from: 'q0', to: 'q_missing', symbol: '1' } },
      ],
    };

    const validation = validateActionsSemantics(invalidEnvelope, [], [], 'DFA');
    expect(validation.isValid).toBe(false);
    expect(validation.errors[0]).toContain('Target state "q_missing" does not exist');
  });

  it('9. calculates deterministic non-overlapping layout positions for constructed states', () => {
    const envelope: AIActionEnvelope = {
      version: '1.0.0',
      actions: [
        { id: 'a1', type: 'CREATE_STATE', parameters: { label: 's0' } },
        { id: 'a2', type: 'CREATE_STATE', parameters: { label: 's1' } },
        { id: 'a3', type: 'CREATE_STATE', parameters: { label: 's2' } },
      ],
    };

    const res = executeAIActions({
      envelope,
      currentNodes: [],
      currentEdges: [],
      machineType: 'DFA',
    });

    expect(res.success).toBe(true);
    const nodes = res.finalNodes!;
    expect(nodes.length).toBe(3);
    // Check non-overlapping coordinates
    expect(nodes[0].x).not.toBe(nodes[1].x);
    expect(nodes[1].x).not.toBe(nodes[2].x);
  });

  it('10. enforces maximum action count limit (30 actions)', () => {
    const hugeActions = Array.from({ length: 35 }, (_, i) => ({
      id: `act_${i}`,
      type: 'CREATE_STATE' as const,
      parameters: { label: `q${i}` },
    }));

    expect(() =>
      validateActionEnvelope({
        version: '1.0.0',
        actions: hugeActions,
      })
    ).toThrow('Action count exceeds maximum limit');
  });
});
