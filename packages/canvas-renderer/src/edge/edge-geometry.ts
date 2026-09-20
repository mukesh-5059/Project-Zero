/**
 * Geometry calculation utilities for edge paths, Bezier curves, arrowheads, and labels.
 * Formally specified in docs/09_Canvas_Engine_Specification.md (Section 8, 9, 10).
 */

import { Point2D, distanceBetween, normalizeVector } from '../math/point2d';
import { BoundingBox2D, createBoundingBox, mergeBoundingBoxes } from '../math/bounding-box';
import {
  DEFAULT_ARROWHEAD_LENGTH,
  DEFAULT_ARROWHEAD_WIDTH,
  DEFAULT_SELF_LOOP_RADIUS,
  DEFAULT_PARALLEL_OFFSET_STEP,
  DEFAULT_LABEL_NORMAL_OFFSET,
  DEFAULT_LABEL_BACKGROUND_PILL_PADDING,
} from './edge-transition';

export interface CubicBezierCurve {
  readonly start: Point2D;
  readonly control1: Point2D;
  readonly control2: Point2D;
  readonly end: Point2D;
}

export interface EdgePathGeometry {
  readonly curve: CubicBezierCurve;
  readonly arrowheadTip: Point2D;
  readonly arrowheadAngle: number;
  readonly labelAnchor: Point2D;
  readonly labelNormal: Point2D;
  readonly isSelfLoop: boolean;
}

export function evaluateCubicBezierPoint(curve: CubicBezierCurve, t: number): Point2D {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  const x = uuu * curve.start.x + 3 * uu * t * curve.control1.x + 3 * u * tt * curve.control2.x + ttt * curve.end.x;
  const y = uuu * curve.start.y + 3 * uu * t * curve.control1.y + 3 * u * tt * curve.control2.y + ttt * curve.end.y;

  return { x, y };
}

export function evaluateCubicBezierTangent(
  curve: CubicBezierCurve,
  t: number
): { tangent: Point2D; angle: number } {
  const u = 1 - t;

  const dx =
    3 * u * u * (curve.control1.x - curve.start.x) +
    6 * u * t * (curve.control2.x - curve.control1.x) +
    3 * t * t * (curve.end.x - curve.control2.x);

  const dy =
    3 * u * u * (curve.control1.y - curve.start.y) +
    6 * u * t * (curve.control2.y - curve.control1.y) +
    3 * t * t * (curve.end.y - curve.control2.y);

  const tangent = normalizeVector({ x: dx, y: dy });
  const angle = Math.atan2(tangent.y, tangent.x);

  return { tangent, angle };
}

/**
 * Accurately estimates cubic Bezier arc length using chord + control polygon averaging.
 */
export function estimateCubicBezierArcLength(curve: CubicBezierCurve): number {
  const chord = distanceBetween(curve.start, curve.end);
  const poly =
    distanceBetween(curve.start, curve.control1) +
    distanceBetween(curve.control1, curve.control2) +
    distanceBetween(curve.control2, curve.end);
  return (chord + poly) / 2;
}

/**
 * Calculates rotated isosceles triangle vertices for an arrowhead tip aligned with curve tangent.
 */
export function getArrowheadTriangle(
  tip: Point2D,
  angle: number,
  length: number = DEFAULT_ARROWHEAD_LENGTH,
  width: number = DEFAULT_ARROWHEAD_WIDTH
): readonly [Point2D, Point2D, Point2D] {
  const halfWidth = width / 2;

  // Base center point offset backward along approach angle vector
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const baseX = tip.x - length * cos;
  const baseY = tip.y - length * sin;

  // Normal vector perpendicular to approach angle vector
  const normX = -sin;
  const normY = cos;

  const p1: Point2D = tip;
  const p2: Point2D = {
    x: baseX + halfWidth * normX,
    y: baseY + halfWidth * normY,
  };
  const p3: Point2D = {
    x: baseX - halfWidth * normX,
    y: baseY - halfWidth * normY,
  };

  return [p1, p2, p3];
}

/**
 * Computes straight edge path geometry between source and target node perimeter boundaries.
 */
export function computeStraightEdgeGeometry(
  sourceCenter: Point2D,
  sourceRadius: number,
  targetCenter: Point2D,
  targetRadius: number
): EdgePathGeometry {
  const dist = distanceBetween(sourceCenter, targetCenter);

  let dirX = 1;
  let dirY = 0;
  if (dist > 1e-6) {
    dirX = (targetCenter.x - sourceCenter.x) / dist;
    dirY = (targetCenter.y - sourceCenter.y) / dist;
  }

  // Clip start at source perimeter, end at target perimeter
  const start: Point2D = {
    x: sourceCenter.x + dirX * sourceRadius,
    y: sourceCenter.y + dirY * sourceRadius,
  };
  const end: Point2D = {
    x: targetCenter.x - dirX * targetRadius,
    y: targetCenter.y - dirY * targetRadius,
  };

  // Straight line control points
  const control1: Point2D = {
    x: start.x + (end.x - start.x) * 0.33,
    y: start.y + (end.y - start.y) * 0.33,
  };
  const control2: Point2D = {
    x: start.x + (end.x - start.x) * 0.66,
    y: start.y + (end.y - start.y) * 0.66,
  };

  const curve: CubicBezierCurve = { start, control1, control2, end };

  // Midpoint & normal vector for label offset
  const labelAnchor: Point2D = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };

  const labelNormal: Point2D = {
    x: -dirY,
    y: dirX,
  };

  const angle = Math.atan2(dirY, dirX);

  return {
    curve,
    arrowheadTip: end,
    arrowheadAngle: angle,
    labelAnchor,
    labelNormal,
    isSelfLoop: false,
  };
}

/**
 * Computes curved multi-edge path geometry with lateral Bezier control point displacement.
 */
export function computeCurvedEdgeGeometry(
  sourceCenter: Point2D,
  sourceRadius: number,
  targetCenter: Point2D,
  targetRadius: number,
  parallelIndex: number = 0
): EdgePathGeometry {
  if (parallelIndex === 0) {
    return computeStraightEdgeGeometry(sourceCenter, sourceRadius, targetCenter, targetRadius);
  }

  const dist = distanceBetween(sourceCenter, targetCenter);

  let dirX = 1;
  let dirY = 0;
  if (dist > 1e-6) {
    dirX = (targetCenter.x - sourceCenter.x) / dist;
    dirY = (targetCenter.y - sourceCenter.y) / dist;
  }

  // Normal vector for lateral displacement
  const normX = -dirY;
  const normY = dirX;

  const displacement = parallelIndex * DEFAULT_PARALLEL_OFFSET_STEP;

  const midX = (sourceCenter.x + targetCenter.x) / 2 + normX * displacement;
  const midY = (sourceCenter.y + targetCenter.y) / 2 + normY * displacement;

  const controlPoint: Point2D = { x: midX, y: midY };

  // Calculate perimeter intersection points relative to displaced control point
  const sourceDir = normalizeVector({
    x: controlPoint.x - sourceCenter.x,
    y: controlPoint.y - sourceCenter.y,
  });
  const targetDir = normalizeVector({
    x: controlPoint.x - targetCenter.x,
    y: controlPoint.y - targetCenter.y,
  });

  const start: Point2D = {
    x: sourceCenter.x + sourceDir.x * sourceRadius,
    y: sourceCenter.y + sourceDir.y * sourceRadius,
  };
  const end: Point2D = {
    x: targetCenter.x + targetDir.x * targetRadius,
    y: targetCenter.y + targetDir.y * targetRadius,
  };

  const control1: Point2D = {
    x: start.x + (controlPoint.x - start.x) * 0.75,
    y: start.y + (controlPoint.y - start.y) * 0.75,
  };
  const control2: Point2D = {
    x: end.x + (controlPoint.x - end.x) * 0.75,
    y: end.y + (controlPoint.y - end.y) * 0.75,
  };

  const curve: CubicBezierCurve = { start, control1, control2, end };

  const labelAnchor = evaluateCubicBezierPoint(curve, 0.5);
  const tangentInfo = evaluateCubicBezierTangent(curve, 0.5);
  const labelNormal: Point2D = {
    x: -tangentInfo.tangent.y,
    y: tangentInfo.tangent.x,
  };

  const endTangent = evaluateCubicBezierTangent(curve, 1.0);

  return {
    curve,
    arrowheadTip: end,
    arrowheadAngle: endTangent.angle,
    labelAnchor,
    labelNormal,
    isSelfLoop: false,
  };
}

/**
 * Computes self-loop arc geometry projecting upward from top of node circle.
 */
export function computeSelfLoopGeometry(
  sourceCenter: Point2D,
  sourceRadius: number
): EdgePathGeometry {
  const loopRadius = DEFAULT_SELF_LOOP_RADIUS;

  // Arc leaves at angle -135deg (top-left) and enters at angle -45deg (top-right)
  const angleStart = -Math.PI * 0.75;
  const angleEnd = -Math.PI * 0.25;

  const start: Point2D = {
    x: sourceCenter.x + Math.cos(angleStart) * sourceRadius,
    y: sourceCenter.y + Math.sin(angleStart) * sourceRadius,
  };

  const end: Point2D = {
    x: sourceCenter.x + Math.cos(angleEnd) * sourceRadius,
    y: sourceCenter.y + Math.sin(angleEnd) * sourceRadius,
  };

  const apexY = sourceCenter.y - sourceRadius - loopRadius * 2.2;

  const control1: Point2D = {
    x: sourceCenter.x - loopRadius * 1.5,
    y: apexY,
  };

  const control2: Point2D = {
    x: sourceCenter.x + loopRadius * 1.5,
    y: apexY,
  };

  const curve: CubicBezierCurve = { start, control1, control2, end };

  const labelAnchor = evaluateCubicBezierPoint(curve, 0.5);
  const labelNormal: Point2D = { x: 0, y: -1 }; // Project label upward

  const endTangent = evaluateCubicBezierTangent(curve, 1.0);

  return {
    curve,
    arrowheadTip: end,
    arrowheadAngle: endTangent.angle,
    labelAnchor,
    labelNormal,
    isSelfLoop: true,
  };
}

/**
 * Computes World Space bounding box for an edge's label pill.
 */
export function computeEdgeLabelBoundingBox(
  geometry: EdgePathGeometry,
  label: string,
  padding: number = DEFAULT_LABEL_BACKGROUND_PILL_PADDING
): BoundingBox2D {
  const worldPos: Point2D = {
    x: geometry.labelAnchor.x + geometry.labelNormal.x * DEFAULT_LABEL_NORMAL_OFFSET,
    y: geometry.labelAnchor.y + geometry.labelNormal.y * DEFAULT_LABEL_NORMAL_OFFSET,
  };
  const textWidth = Math.max(16, label.length * 8);
  const textHeight = 13;
  const pillW = textWidth + padding * 2;
  const pillH = textHeight + padding;

  return createBoundingBox(
    worldPos.x - pillW / 2,
    worldPos.y - pillH / 2,
    worldPos.x + pillW / 2,
    worldPos.y + pillH / 2
  );
}

/**
 * Computes enclosing World Space bounding box for an edge path geometry.
 */
export function getEdgeBoundingBox(geometry: EdgePathGeometry, label?: string): BoundingBox2D {
  const c = geometry.curve;
  const points = [
    c.start,
    c.control1,
    c.control2,
    c.end,
    geometry.labelAnchor,
  ];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  // Margin buffer for stroke width and labels
  const margin = DEFAULT_LABEL_NORMAL_OFFSET + 20;
  let box = createBoundingBox(minX - margin, minY - margin, maxX + margin, maxY + margin);

  if (label && label.trim().length > 0) {
    const labelBox = computeEdgeLabelBoundingBox(geometry, label);
    box = mergeBoundingBoxes(box, labelBox);
  }

  return box;
}
