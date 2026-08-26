/**
 * Edge & Transition Rendering Engine for Finite Automata transition paths.
 * Formally specified in docs/09_Canvas_Engine_Specification.md (Section 5, 8, 9, 10) and docs/07_Design_System.md.
 */

import { Camera } from '../camera/camera';
import { Viewport } from '../camera/viewport';
import { RenderQueue, DrawCommand } from '../pipeline/render-queue';
import { RenderLayer } from '../layer/layer-manager';
import { StateRenderer } from '../state/state-renderer';
import { getNodeRadius } from '../state/state-geometry';
import { intersectsBoundingBox } from '../math/bounding-box';
import { CanvasThemeTokens, DARK_THEME_TOKENS } from '../theme/theme-bridge';
import { LODState } from '../camera/lod-controller';
import {
  TransitionEdge,
  DEFAULT_EDGE_STROKE_WIDTH,
  DEFAULT_SELECTED_EDGE_STROKE_WIDTH,
  DEFAULT_ARROWHEAD_LENGTH,
  DEFAULT_ARROWHEAD_WIDTH,
  DEFAULT_LABEL_NORMAL_OFFSET,
  DEFAULT_LABEL_BACKGROUND_PILL_PADDING,
  DEFAULT_LABEL_BACKGROUND_OPACITY,
} from './edge-transition';
import {
  EdgePathGeometry,
  computeStraightEdgeGeometry,
  computeCurvedEdgeGeometry,
  computeSelfLoopGeometry,
  getArrowheadTriangle,
  getEdgeBoundingBox,
} from './edge-geometry';

interface EdgeCommandCache {
  pathCmd: DrawCommand;
  labelCmd: DrawCommand;
  bindContext: (cam: Camera, vp: Viewport, geom: EdgePathGeometry) => void;
}

export class EdgeRenderer {
  private readonly edges: Map<string, TransitionEdge> = new Map<string, TransitionEdge>();
  private readonly commandCache: Map<string, EdgeCommandCache> = new Map<string, EdgeCommandCache>();

  private theme: CanvasThemeTokens;

  constructor(tokens: CanvasThemeTokens = DARK_THEME_TOKENS) {
    this.theme = tokens;
  }

  public applyTheme(tokens: CanvasThemeTokens): void {
    this.theme = tokens;
  }

  public getTheme(): CanvasThemeTokens {
    return this.theme;
  }

  public setEdges(edges: ReadonlyArray<TransitionEdge>): void {
    this.edges.clear();
    this.commandCache.clear();
    for (let i = 0; i < edges.length; i++) {
      this.addEdge(edges[i]);
    }
  }

  public addEdge(edge: TransitionEdge): void {
    this.edges.set(edge.id, edge);
    this.createCommandCacheForEdge(edge);
  }

  public removeEdge(id: string): boolean {
    this.commandCache.delete(id);
    return this.edges.delete(id);
  }

  public getEdge(id: string): TransitionEdge | undefined {
    return this.edges.get(id);
  }

  public getEdges(): ReadonlyArray<TransitionEdge> {
    return Array.from(this.edges.values());
  }

  public clear(): void {
    this.edges.clear();
    this.commandCache.clear();
  }

  private createCommandCacheForEdge(edge: TransitionEdge): EdgeCommandCache {
    let currentCamera: Camera;
    let currentViewport: Viewport;
    let currentGeometry: EdgePathGeometry;

    const pathCmd: DrawCommand = {
      id: `edge-path-${edge.id}`,
      layer: RenderLayer.Edges,
      execute: (ctx) => {
        const liveEdge = this.edges.get(edge.id) ?? edge;
        this.drawEdgePath2D(ctx, currentCamera, currentViewport, liveEdge, currentGeometry);
      },
    };

    const labelCmd: DrawCommand = {
      id: `edge-label-${edge.id}`,
      layer: RenderLayer.EdgeLabels,
      execute: (ctx) => {
        const liveEdge = this.edges.get(edge.id) ?? edge;
        this.drawEdgeLabel2D(ctx, currentCamera, currentViewport, liveEdge, currentGeometry);
      },
    };

    const cache: EdgeCommandCache = {
      pathCmd,
      labelCmd,
      bindContext: (cam: Camera, vp: Viewport, geom: EdgePathGeometry) => {
        currentCamera = cam;
        currentViewport = vp;
        currentGeometry = geom;
      },
    };
    this.commandCache.set(edge.id, cache);

    return cache;
  }

  /**
   * Computes edge geometry for a given transition edge.
   */
  public computeGeometry(
    edge: TransitionEdge,
    stateRenderer: StateRenderer
  ): EdgePathGeometry | null {
    const sourceNode = stateRenderer.getStateNode(edge.sourceNodeId);
    const targetNode = stateRenderer.getStateNode(edge.targetNodeId);

    if (!sourceNode || !targetNode) {
      return null;
    }

    const sourceRadius = getNodeRadius(sourceNode);
    const targetRadius = getNodeRadius(targetNode);

    if (edge.isSelfLoop || edge.sourceNodeId === edge.targetNodeId) {
      return computeSelfLoopGeometry(sourceNode, sourceRadius);
    } else if (edge.parallelIndex && edge.parallelIndex !== 0) {
      return computeCurvedEdgeGeometry(
        sourceNode,
        sourceRadius,
        targetNode,
        targetRadius,
        edge.parallelIndex
      );
    } else {
      return computeStraightEdgeGeometry(
        sourceNode,
        sourceRadius,
        targetNode,
        targetRadius
      );
    }
  }

  /**
   * Evaluates active edge path geometries and enqueues pooled draw commands.
   */
  public enqueueDrawCommands(
    queue: RenderQueue,
    stateRenderer: StateRenderer,
    camera: Camera,
    viewport: Viewport,
    candidateEdges?: ReadonlyArray<TransitionEdge>,
    lodState?: LODState
  ): number {
    const visibleWorldRect = camera.getVisibleWorldRect();
    let enqueuedCount = 0;

    const edgeList = candidateEdges ?? this.edges.values();
    const renderLabels = lodState?.renderLabels !== false;

    for (const edge of edgeList) {
      const geometry = this.computeGeometry(edge, stateRenderer);
      if (!geometry) {
        continue;
      }

      // Frustum Culling Check
      const bounds = getEdgeBoundingBox(geometry);
      if (!intersectsBoundingBox(bounds, visibleWorldRect)) {
        continue;
      }

      let cache = this.commandCache.get(edge.id);
      if (!cache) {
        cache = this.createCommandCacheForEdge(edge);
      }

      cache.bindContext(camera, viewport, geometry);

      // Layer 2: Edge Path
      queue.enqueue(cache.pathCmd);

      // Layer 3: Edge Label (Gated by LOD)
      if (renderLabels && edge.label && edge.label.length > 0) {
        queue.enqueue(cache.labelCmd);
      }

      enqueuedCount++;
    }

    return enqueuedCount;
  }

  /**
   * Renders Edge Path Line/Bezier Curve and Arrowhead (Layer 2: Edges).
   */
  private drawEdgePath2D(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    viewport: Viewport,
    edge: TransitionEdge,
    geometry: EdgePathGeometry
  ): void {
    const dpr = viewport.getDevicePixelRatio();
    const zoom = camera.getState().zoom;

    const baseWidth = edge.isSelected || edge.isExecutionHighlighted
      ? DEFAULT_SELECTED_EDGE_STROKE_WIDTH
      : edge.strokeWidth ?? DEFAULT_EDGE_STROKE_WIDTH;

    const strokeWidth = Math.max(1, baseWidth * dpr);
    const strokeColor = edge.isExecutionHighlighted
      ? '#F97316'
      : edge.isSelected || edge.isHovered
      ? this.theme.borderFocus
      : edge.color ?? this.theme.edgeStroke;

    const pStart = camera.worldToScreen(geometry.curve.start);
    const pC1 = camera.worldToScreen(geometry.curve.control1);
    const pC2 = camera.worldToScreen(geometry.curve.control2);
    const pEnd = camera.worldToScreen(geometry.curve.end);

    // 1. Render Bezier / Line Edge Path
    ctx.beginPath();
    ctx.moveTo(pStart.x, pStart.y);
    ctx.bezierCurveTo(pC1.x, pC1.y, pC2.x, pC2.y, pEnd.x, pEnd.y);
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();

    // 2. Render Aligned Arrowhead
    const screenTip = camera.worldToScreen(geometry.arrowheadTip);
    const arrowheadLen = DEFAULT_ARROWHEAD_LENGTH * Math.sqrt(zoom);
    const arrowheadWid = DEFAULT_ARROWHEAD_WIDTH * Math.sqrt(zoom);

    const triangle = getArrowheadTriangle(
      screenTip,
      geometry.arrowheadAngle,
      arrowheadLen,
      arrowheadWid
    );

    ctx.beginPath();
    ctx.moveTo(triangle[0].x, triangle[0].y);
    ctx.lineTo(triangle[1].x, triangle[1].y);
    ctx.lineTo(triangle[2].x, triangle[2].y);
    ctx.closePath();
    ctx.fillStyle = strokeColor;
    ctx.fill();
  }

  /**
   * Renders Edge Label Typography and Contrast Background Pill (Layer 3: EdgeLabels).
   */
  private drawEdgeLabel2D(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    _viewport: Viewport,
    edge: TransitionEdge,
    geometry: EdgePathGeometry
  ): void {
    const zoom = camera.getState().zoom;
    const fontSize = Math.max(10, Math.round(13 * Math.sqrt(zoom)));
    const textColor = edge.textColor ?? this.theme.textPrimary;

    const worldPos = {
      x: geometry.labelAnchor.x + geometry.labelNormal.x * DEFAULT_LABEL_NORMAL_OFFSET,
      y: geometry.labelAnchor.y + geometry.labelNormal.y * DEFAULT_LABEL_NORMAL_OFFSET,
    };

    const screenPos = camera.worldToScreen(worldPos);

    ctx.font = `500 ${fontSize}px JetBrains Mono, monospace, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const metrics = ctx.measureText(edge.label);
    const textWidth = metrics.width;
    const textHeight = fontSize;

    const pillPadding = DEFAULT_LABEL_BACKGROUND_PILL_PADDING;
    const pillW = textWidth + pillPadding * 2;
    const pillH = textHeight + pillPadding;
    const pillX = screenPos.x - pillW / 2;
    const pillY = screenPos.y - pillH / 2;

    // 1. Render Rounded Semi-Opaque Background Contrast Pill
    ctx.save();
    ctx.beginPath();
    const cornerRadius = 4;
    ctx.roundRect(pillX, pillY, pillW, pillH, cornerRadius);
    ctx.fillStyle = this.theme.edgePillBackground;
    ctx.globalAlpha = DEFAULT_LABEL_BACKGROUND_OPACITY;
    ctx.fill();

    ctx.lineWidth = 1;
    ctx.strokeStyle = this.theme.edgePillBorder;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.restore();

    // 2. Render Transition Text Symbol
    ctx.fillStyle = textColor;
    ctx.fillText(edge.label, screenPos.x, screenPos.y);
  }
}
