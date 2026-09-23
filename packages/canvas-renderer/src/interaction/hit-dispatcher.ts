/**
 * Hit Dispatcher & Spatial Containment Evaluator with adaptive Bézier point-to-segment sampling and deterministic tie-breaking.
 * Formally specified in docs/09_Canvas_Engine_Specification.md (Section 12 & 16).
 *
 * Deterministic Tie-Breaking Rule:
 * 1. Topmost rendered candidate (highest render index) takes primary precedence.
 * 2. Lexicographical ID comparison serves as secondary deterministic tie-breaker.
 */

import { Point2D, distanceBetween, pointToSegmentDistance } from '../math/point2d';
import { containsPoint } from '../math/bounding-box';
import { StateNode } from '../state/state-node';
import { containsPointInNode, getNodeRadius } from '../state/state-geometry';
import { TransitionEdge } from '../edge/edge-transition';
import {
  computeStraightEdgeGeometry,
  computeCurvedEdgeGeometry,
  computeSelfLoopGeometry,
  computeEdgeLabelBoundingBox,
  evaluateCubicBezierPoint,
  estimateCubicBezierArcLength,
  EdgePathGeometry,
} from '../edge/edge-geometry';

export type HitTargetType = 'node' | 'edge' | 'background';

export interface HitResult {
  readonly type: HitTargetType;
  readonly nodeId?: string;
  readonly edgeId?: string;
}

export class HitDispatcher {
  public static readonly DEFAULT_EDGE_HIT_TOLERANCE = 8; // 8px orthogonal distance per Section 12 Rule 2
  public static readonly MIN_BEZIER_STEPS = 16; // Lower bound for short/straight curves
  public static readonly MAX_BEZIER_STEPS = 100; // Upper bound for ultra-long curves

  /**
   * Evaluates point-in-circle containment against candidate state nodes with deterministic tie-breaking.
   */
  public hitTestNode(
    nodes: ReadonlyArray<StateNode>,
    worldPoint: Point2D
  ): StateNode | null {
    if (isNaN(worldPoint.x) || isNaN(worldPoint.y)) {
      return null;
    }

    const matches: Array<{ node: StateNode; index: number }> = [];
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (containsPointInNode(node, worldPoint)) {
        matches.push({ node, index: i });
      }
    }

    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0].node;

    // Sort matches: topmost rendered candidate (highest array index) first.
    // If indices are equal, deterministic tie-breaking by lexicographical ID.
    matches.sort((a, b) => {
      if (b.index !== a.index) {
        return b.index - a.index;
      }
      return a.node.id.localeCompare(b.node.id);
    });

    return matches[0].node;
  }

  /**
   * Computes deterministic adaptive sample steps based on estimated curve arc length and hit tolerance.
   */
  public calculateAdaptiveSteps(curveLength: number, tolerance: number): number {
    const targetStep = Math.max(2, tolerance * 0.75);
    const desiredSteps = Math.ceil(curveLength / targetStep);
    return Math.max(
      HitDispatcher.MIN_BEZIER_STEPS,
      Math.min(HitDispatcher.MAX_BEZIER_STEPS, desiredSteps)
    );
  }

  /**
   * Evaluates point-to-segment distance against transition edges with adaptive Bézier sampling,
   * arrowhead testing, and deterministic tie-breaking.
   */
  public hitTestEdge(
    edges: ReadonlyArray<TransitionEdge>,
    nodes: ReadonlyArray<StateNode> | Map<string, StateNode>,
    worldPoint: Point2D,
    tolerance: number = HitDispatcher.DEFAULT_EDGE_HIT_TOLERANCE
  ): TransitionEdge | null {
    if (isNaN(worldPoint.x) || isNaN(worldPoint.y)) {
      return null;
    }

    const getNodeById = (id: string): StateNode | undefined => {
      if (nodes instanceof Map) {
        return nodes.get(id);
      }
      return nodes.find((n) => n.id === id);
    };

    let bestEdge: TransitionEdge | null = null;
    let bestDistance = Infinity;

    for (let i = edges.length - 1; i >= 0; i--) {
      const edge = edges[i];
      const source = getNodeById(edge.sourceNodeId);
      const target = getNodeById(edge.targetNodeId);

      if (!source || !target) continue;

      const sourceRadius = getNodeRadius(source);
      const targetRadius = getNodeRadius(target);

      let geometry: EdgePathGeometry;
      if (edge.isSelfLoop || edge.sourceNodeId === edge.targetNodeId) {
        geometry = computeSelfLoopGeometry(source, sourceRadius, edge.parallelIndex);
      } else if (edge.parallelIndex && edge.parallelIndex !== 0) {
        geometry = computeCurvedEdgeGeometry(
          source,
          sourceRadius,
          target,
          targetRadius,
          edge.parallelIndex
        );
      } else {
        geometry = computeStraightEdgeGeometry(source, sourceRadius, target, targetRadius);
      }

      let edgeMinDist = Infinity;

      // 1. Direct hit on Edge Label Pill (scaled distance so closer center wins)
      if (edge.label && edge.label.trim().length > 0) {
        const labelBox = computeEdgeLabelBoundingBox(geometry, edge.label);
        if (containsPoint(labelBox, worldPoint)) {
          const labelCenter = {
            x: (labelBox.minX + labelBox.maxX) / 2,
            y: (labelBox.minY + labelBox.maxY) / 2,
          };
          const distToCenter = distanceBetween(labelCenter, worldPoint);
          // Scale by 0.001 so label pill hits take absolute priority (< 0.1) over external curves,
          // while allowing nearest label center to break ties cleanly.
          edgeMinDist = Math.min(edgeMinDist, distToCenter * 0.001);
        }
      }

      // 2. Test Arrowhead Tip distance
      const tipDist = distanceBetween(geometry.arrowheadTip, worldPoint);
      if (tipDist <= tolerance + 4) {
        edgeMinDist = Math.min(edgeMinDist, tipDist);
      }

      // 3. Early bounding box rejection with tolerance buffer
      const minX =
        Math.min(
          geometry.curve.start.x,
          geometry.curve.control1.x,
          geometry.curve.control2.x,
          geometry.curve.end.x
        ) - tolerance;
      const maxX =
        Math.max(
          geometry.curve.start.x,
          geometry.curve.control1.x,
          geometry.curve.control2.x,
          geometry.curve.end.x
        ) + tolerance;
      const minY =
        Math.min(
          geometry.curve.start.y,
          geometry.curve.control1.y,
          geometry.curve.control2.y,
          geometry.curve.end.y
        ) - tolerance;
      const maxY =
        Math.max(
          geometry.curve.start.y,
          geometry.curve.control1.y,
          geometry.curve.control2.y,
          geometry.curve.end.y
        ) + tolerance;

      if (
        worldPoint.x >= minX &&
        worldPoint.x <= maxX &&
        worldPoint.y >= minY &&
        worldPoint.y <= maxY
      ) {
        // 4. Adaptive Bézier subdivision with point-to-segment distance testing
        const curveLength = estimateCubicBezierArcLength(geometry.curve);
        const steps = this.calculateAdaptiveSteps(curveLength, tolerance);

        let prevPoint = evaluateCubicBezierPoint(geometry.curve, 0);
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const currentPoint = evaluateCubicBezierPoint(geometry.curve, t);
          const segDist = pointToSegmentDistance(worldPoint, prevPoint, currentPoint);
          if (segDist < edgeMinDist) {
            edgeMinDist = segDist;
          }
          prevPoint = currentPoint;
        }
      }

      // Update nearest candidate if within tolerance
      if (edgeMinDist <= tolerance && edgeMinDist < bestDistance) {
        bestDistance = edgeMinDist;
        bestEdge = edge;
      }
    }

    return bestEdge;
  }

  /**
   * Evaluates hierarchical hit query adhering strictly to Section 12 Rule 1:
   * Hit Priority Order: State Nodes > Transition Edges > Canvas Background.
   */
  public evaluateHit(
    nodes: ReadonlyArray<StateNode>,
    edges: ReadonlyArray<TransitionEdge>,
    worldPoint: Point2D,
    tolerance: number = HitDispatcher.DEFAULT_EDGE_HIT_TOLERANCE,
    nodesMap?: Map<string, StateNode>
  ): HitResult {
    if (isNaN(worldPoint.x) || isNaN(worldPoint.y)) {
      return { type: 'background' };
    }

    // 1. Node hit testing takes highest priority (Section 12 Rule 1)
    const hitNode = this.hitTestNode(nodes, worldPoint);
    if (hitNode) {
      return { type: 'node', nodeId: hitNode.id };
    }

    // 2. Edge hit testing takes second priority (Section 12 Rule 1)
    const map =
      nodesMap ??
      (nodes instanceof Map
        ? nodes
        : new Map(nodes.map((n) => [n.id, n])));

    const hitEdge = this.hitTestEdge(edges, map, worldPoint, tolerance);
    if (hitEdge) {
      return { type: 'edge', edgeId: hitEdge.id };
    }

    // 3. Canvas background hit
    return { type: 'background' };
  }
}
