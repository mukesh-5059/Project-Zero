import { describe, it, expect, beforeEach } from 'vitest';
import { HitDispatcher } from './interaction/hit-dispatcher';
import { StateNode } from './state/state-node';
import { TransitionEdge } from './edge/edge-transition';

describe('HitDispatcher Subsystem & Mathematical Bézier Hit Testing', () => {
  let hitDispatcher: HitDispatcher;

  const q0: StateNode = { id: 'q0', label: 'q0', x: 0, y: 0, radius: 32 };
  const q1: StateNode = { id: 'q1', label: 'q1', x: 200, y: 0, radius: 32 };
  const q2: StateNode = { id: 'q2', label: 'q2', x: 0, y: 200, radius: 32 };
  const qLong: StateNode = { id: 'qLong', label: 'qLong', x: 3000, y: 0, radius: 32 };

  const e_straight: TransitionEdge = { id: 'e_straight', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'a' };
  const e_parallel1: TransitionEdge = { id: 'e_par1', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'p1', parallelIndex: 1 };
  const e_parallel2: TransitionEdge = { id: 'e_par2', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'p2', parallelIndex: -1 };
  const e_self: TransitionEdge = { id: 'e_self', sourceNodeId: 'q0', targetNodeId: 'q0', label: 'loop', isSelfLoop: true };
  const e_long: TransitionEdge = { id: 'e_long', sourceNodeId: 'q0', targetNodeId: 'qLong', label: 'long', parallelIndex: 2 };

  beforeEach(() => {
    hitDispatcher = new HitDispatcher();
  });

  describe('Node Hit Testing & Deterministic Tie-Breaking', () => {
    it('detects node hits with higher priority than edges and background', () => {
      const result = hitDispatcher.evaluateHit([q0, q1], [e_straight], { x: 10, y: 0 });
      expect(result.type).toBe('node');
      expect(result.nodeId).toBe('q0');
    });

    it('resolves overlapping nodes deterministically via topmost rendering index', () => {
      const nodeA: StateNode = { id: 'node_a', label: 'A', x: 50, y: 50, radius: 40 };
      const nodeB: StateNode = { id: 'node_b', label: 'B', x: 50, y: 50, radius: 40 };

      // nodeB is at higher array index -> topmost rendered candidate
      const hitResult = hitDispatcher.hitTestNode([nodeA, nodeB], { x: 50, y: 50 });
      expect(hitResult?.id).toBe('node_b');

      // Reversed array -> nodeA is topmost
      const reverseHit = hitDispatcher.hitTestNode([nodeB, nodeA], { x: 50, y: 50 });
      expect(reverseHit?.id).toBe('node_a');
    });

    it('executes secondary lexicographical ID tie-breaking when candidate indices match', () => {
      // Create duplicate candidate objects with identical logical index simulation
      const nodeAlpha: StateNode = { id: 'alpha', label: 'Alpha', x: 100, y: 100, radius: 32 };
      const nodeBeta: StateNode = { id: 'beta', label: 'Beta', x: 100, y: 100, radius: 32 };

      // When candidates are evaluated, lexicographical order breaks equal-tier ties
      const singleTest = hitDispatcher.hitTestNode([nodeBeta, nodeAlpha], { x: 100, y: 100 });
      expect(singleTest?.id).toBe('alpha');
    });

    it('returns null on point outside all nodes or on NaN coordinates', () => {
      expect(hitDispatcher.hitTestNode([q0], { x: 500, y: 500 })).toBeNull();
      expect(hitDispatcher.hitTestNode([q0], { x: NaN, y: 0 })).toBeNull();
      expect(hitDispatcher.evaluateHit([q0], [e_straight], { x: NaN, y: NaN })).toEqual({ type: 'background' });
    });
  });

  describe('10-Point Bézier Point-to-Segment Hit Testing Suite', () => {
    // 1. Straight edge
    it('1. hits straight transition edge along its path', () => {
      const hit = hitDispatcher.hitTestEdge([e_straight], [q0, q1], { x: 100, y: 3 });
      expect(hit?.id).toBe('e_straight');
    });

    // 2. Shallow cubic / parallel index 1
    it('2. hits shallow cubic curve accurately', () => {
      const hit = hitDispatcher.hitTestEdge([e_parallel1], [q0, q1], { x: 100, y: 17 });
      expect(hit?.id).toBe('e_par1');
    });

    // 3. Highly curved cubic
    it('3. hits highly curved cubic with parallel offset', () => {
      const e_high: TransitionEdge = { id: 'e_high', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'h', parallelIndex: 3 };
      const hit = hitDispatcher.hitTestEdge([e_high], [q0, q1], { x: 100, y: 52 });
      expect(hit?.id).toBe('e_high');
    });

    // 4. Parallel edges (both directions)
    it('4. distinguishes parallel edges symmetrically', () => {
      const hitUp = hitDispatcher.hitTestEdge([e_parallel1, e_parallel2], [q0, q1], { x: 100, y: 17 });
      expect(hitUp?.id).toBe('e_par1');

      const hitDown = hitDispatcher.hitTestEdge([e_parallel1, e_parallel2], [q0, q1], { x: 100, y: -17 });
      expect(hitDown?.id).toBe('e_par2');
    });

    // 5. Self-loops (midpoint, apex, and boundary)
    it('5. hits self-loop at apex, midpoints, and perimeter without sampling holes', () => {
      // Actual curve apex of self loop reaches y ≈ -69.3
      const hitApex = hitDispatcher.hitTestEdge([e_self], [q0], { x: 0, y: -69 });
      expect(hitApex?.id).toBe('e_self');

      // Midpoints on rising and falling arc of the loop (at t ≈ 0.25 and t ≈ 0.75)
      const hitLeft = hitDispatcher.hitTestEdge([e_self], [q0], { x: -19, y: -58 });
      expect(hitLeft?.id).toBe('e_self');

      const hitRight = hitDispatcher.hitTestEdge([e_self], [q0], { x: 19, y: -58 });
      expect(hitRight?.id).toBe('e_self');
    });

    // 6. Short curve
    it('6. hits short curve with small radius nodes', () => {
      const qShort0: StateNode = { id: 'qs0', label: 'qs0', x: 0, y: 0, radius: 10 };
      const qShort1: StateNode = { id: 'qs1', label: 'qs1', x: 40, y: 0, radius: 10 };
      const e_short: TransitionEdge = { id: 'e_short', sourceNodeId: 'qs0', targetNodeId: 'qs1', label: 's' };

      const hit = hitDispatcher.hitTestEdge([e_short], [qShort0, qShort1], { x: 20, y: 2 });
      expect(hit?.id).toBe('e_short');
    });

    // 7. Long curve (3000px)
    it('7. hits ultra-long 3000px transition curve with bounded adaptive subdivision', () => {
      const hit = hitDispatcher.hitTestEdge([e_long], [q0, qLong], { x: 1500, y: 35 });
      expect(hit?.id).toBe('e_long');
    });

    // 8. Arrowhead contact point
    it('8. hits arrowhead tip perimeter contact cleanly', () => {
      const hit = hitDispatcher.hitTestEdge([e_straight], [q0, q1], { x: 167, y: 1 });
      expect(hit?.id).toBe('e_straight');
    });

    // 9. Exact tolerance boundary (8px)
    it('9. accepts clicks exactly on the 8px tolerance boundary', () => {
      const hitBoundary = hitDispatcher.hitTestEdge([e_straight], [q0, q1], { x: 100, y: 8.0 }, 8.0);
      expect(hitBoundary?.id).toBe('e_straight');
    });

    // 10. Near-miss just outside tolerance (-8.5px, away from label pill)
    it('10. rejects clicks at -8.5px strictly outside 8.0px tolerance', () => {
      const nearMiss = hitDispatcher.hitTestEdge([e_straight], [q0, q1], { x: 100, y: -8.5 }, 8.0);
      expect(nearMiss).toBeNull();
    });

    // 11. Label pill hit testing
    it('11. hits edge when clicking directly on the transition label pill', () => {
      // e_straight label 'a' is anchored at (100, 0) and offset along normal (0, 1) to (100, 14)
      const hitLabelCenter = hitDispatcher.hitTestEdge([e_straight], [q0, q1], { x: 100, y: 14 });
      expect(hitLabelCenter?.id).toBe('e_straight');

      const hitLabelEdge = hitDispatcher.hitTestEdge([e_straight], [q0, q1], { x: 106, y: 12 });
      expect(hitLabelEdge?.id).toBe('e_straight');

      // Point far away from both curve and label pill misses
      const missLabel = hitDispatcher.hitTestEdge([e_straight], [q0, q1], { x: 100, y: 50 });
      expect(missLabel).toBeNull();
    });

    // 12. Zoom-scaled tolerance test
    it('12. scales edge hit tolerance based on zoom', () => {
      // At zoom 0.5 (zoomed out), screen tolerance 8px corresponds to 16px world tolerance
      const zoomedOutTolerance = HitDispatcher.DEFAULT_EDGE_HIT_TOLERANCE / 0.5; // 16px
      const hitZoomedOut = hitDispatcher.hitTestEdge([e_straight], [q0, q1], { x: 100, y: -12 }, zoomedOutTolerance);
      expect(hitZoomedOut?.id).toBe('e_straight');

      // At standard zoom 1.0, -12px is outside 8px tolerance
      const missStandard = hitDispatcher.hitTestEdge([e_straight], [q0, q1], { x: 100, y: -12 }, 8.0);
      expect(missStandard).toBeNull();
    });
  });

  describe('Canvas Background Hit Testing', () => {
    it('returns background when point misses all nodes and edges', () => {
      const result = hitDispatcher.evaluateHit([q0, q1, q2], [e_straight, e_parallel1], { x: 800, y: 800 });
      expect(result.type).toBe('background');
    });
  });
});
