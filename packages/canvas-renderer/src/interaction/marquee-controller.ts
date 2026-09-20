/**
 * Marquee Drag Selection Controller.
 * Formally specified in docs/09_Canvas_Engine_Specification.md (Section 11 & 14).
 */

import { Point2D } from '../math/point2d';
import { createBoundingBox, intersectsBoundingBox, containsPoint } from '../math/bounding-box';
import { InteractionContext } from './interaction-context';
import { StateNode } from '../state/state-node';
import { getNodeBoundingBox } from '../state/state-geometry';
import { RenderQueue, DrawCommand } from '../pipeline/render-queue';
import { RenderLayer } from '../layer/layer-manager';
import { Camera } from '../camera/camera';
import { CanvasThemeTokens, DARK_THEME_TOKENS } from '../theme/theme-bridge';
import { normalizeMarqueeRect } from './selection-geometry';
import { TransitionEdge } from '../edge/edge-transition';
import { StateRenderer } from '../state/state-renderer';
import { EdgeRenderer } from '../edge/edge-renderer';
import { getEdgeBoundingBox, evaluateCubicBezierPoint } from '../edge/edge-geometry';

export enum MarqueeContainmentMode {
  BoundingBoxIntersection = 'BoundingBoxIntersection',
  CenterPointContainment = 'CenterPointContainment',
}

export interface MarqueeControllerOptions {
  readonly containmentMode?: MarqueeContainmentMode;
}

export class MarqueeController {
  private readonly containmentMode: MarqueeContainmentMode;
  private readonly initialSelectedNodeIds: Set<string> = new Set<string>();
  private readonly initialSelectedEdgeIds: Set<string> = new Set<string>();

  constructor(options?: MarqueeControllerOptions) {
    this.containmentMode = options?.containmentMode ?? MarqueeContainmentMode.BoundingBoxIntersection;
  }

  public getContainmentMode(): MarqueeContainmentMode {
    return this.containmentMode;
  }

  public startMarquee(
    context: InteractionContext,
    pointerWorld: Point2D,
    isAdditive: boolean = false
  ): void {
    context.dragOriginWorld = pointerWorld;
    context.marqueeRect = createBoundingBox(
      pointerWorld.x,
      pointerWorld.y,
      pointerWorld.x,
      pointerWorld.y
    );

    this.initialSelectedNodeIds.clear();
    this.initialSelectedEdgeIds.clear();
    if (isAdditive) {
      for (const id of context.selectedNodeIds) {
        this.initialSelectedNodeIds.add(id);
      }
      for (const id of context.selectedEdgeIds) {
        this.initialSelectedEdgeIds.add(id);
      }
    }
  }

  public updateMarquee(
    context: InteractionContext,
    currentWorldPoint: Point2D,
    stateNodes: ReadonlyArray<StateNode>,
    isAdditive: boolean = false,
    edges?: ReadonlyArray<TransitionEdge>,
    stateRenderer?: StateRenderer,
    edgeRenderer?: EdgeRenderer
  ): boolean {
    if (!context.dragOriginWorld) return false;

    // Normalize negative-width/height drag rectangles
    const marqueeRect = normalizeMarqueeRect(
      context.dragOriginWorld.x,
      context.dragOriginWorld.y,
      currentWorldPoint.x,
      currentWorldPoint.y
    );
    context.marqueeRect = marqueeRect;

    // Reset selection set based on mode
    context.clearSelection();
    if (isAdditive) {
      for (const id of this.initialSelectedNodeIds) {
        context.selectedNodeIds.add(id);
      }
      for (const id of this.initialSelectedEdgeIds) {
        context.selectedEdgeIds.add(id);
      }
    }

    let selectedAny = false;

    for (let i = 0; i < stateNodes.length; i++) {
      const node = stateNodes[i];
      let matches = false;

      if (this.containmentMode === MarqueeContainmentMode.CenterPointContainment) {
        matches = containsPoint(marqueeRect, { x: node.x, y: node.y });
      } else {
        const nodeBounds = getNodeBoundingBox(node);
        matches = intersectsBoundingBox(nodeBounds, marqueeRect);
      }

      if (matches) {
        context.selectedNodeIds.add(node.id);
        selectedAny = true;
      }
    }

    if (edges && stateRenderer && edgeRenderer) {
      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];
        const geom = edgeRenderer.computeGeometry(edge, stateRenderer);
        if (!geom) continue;

        const edgeBounds = getEdgeBoundingBox(geom, edge.label);
        if (!intersectsBoundingBox(edgeBounds, marqueeRect)) {
          continue;
        }

        let edgeMatched =
          containsPoint(marqueeRect, geom.curve.start) ||
          containsPoint(marqueeRect, geom.curve.end) ||
          containsPoint(marqueeRect, geom.arrowheadTip) ||
          containsPoint(marqueeRect, geom.labelAnchor);

        if (!edgeMatched) {
          const steps = 8;
          for (let s = 1; s < steps; s++) {
            const pt = evaluateCubicBezierPoint(geom.curve, s / steps);
            if (containsPoint(marqueeRect, pt)) {
              edgeMatched = true;
              break;
            }
          }
        }

        if (edgeMatched) {
          context.selectedEdgeIds.add(edge.id);
          selectedAny = true;
        }
      }
    }

    return selectedAny;
  }

  public endMarquee(context: InteractionContext): void {
    context.dragOriginWorld = null;
    context.marqueeRect = null;
    this.initialSelectedNodeIds.clear();
    this.initialSelectedEdgeIds.clear();
  }

  public enqueueDrawCommands(
    queue: RenderQueue,
    context: InteractionContext,
    camera: Camera,
    theme: CanvasThemeTokens = DARK_THEME_TOKENS
  ): void {
    if (!context.marqueeRect) return;

    const rect = context.marqueeRect;
    const cmd: DrawCommand = {
      id: 'marquee-rect-overlay',
      layer: RenderLayer.Selection,
      bounds: rect,
      execute: (ctx) => {
        const topLeft = camera.worldToScreen({ x: rect.minX, y: rect.minY });
        const bottomRight = camera.worldToScreen({ x: rect.maxX, y: rect.maxY });
        const width = bottomRight.x - topLeft.x;
        const height = bottomRight.y - topLeft.y;

        if (width === 0 && height === 0) return;

        ctx.save();
        // Render 10% opacity theme fill (Section 11 Rule 2)
        ctx.fillStyle = theme.marqueeFill;
        ctx.globalAlpha = 0.1;
        ctx.fillRect(topLeft.x, topLeft.y, width, height);

        // Render 1.5px dashed border
        ctx.strokeStyle = theme.marqueeStroke;
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(topLeft.x, topLeft.y, width, height);
        ctx.restore();
      },
    };
    queue.enqueue(cmd);
  }
}
