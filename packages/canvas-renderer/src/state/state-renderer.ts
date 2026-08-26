/**
 * State Rendering Engine for Finite Automata state nodes with theme token integration and command pooling.
 * Formally specified in docs/09_Canvas_Engine_Specification.md (Section 5, 7, 10, 11) and docs/07_Design_System.md.
 */

import { Camera } from '../camera/camera';
import { Viewport } from '../camera/viewport';
import { RenderQueue, DrawCommand } from '../pipeline/render-queue';
import { RenderLayer } from '../layer/layer-manager';
import { intersectsBoundingBox } from '../math/bounding-box';
import { CanvasThemeTokens, DARK_THEME_TOKENS } from '../theme/theme-bridge';
import { LODState } from '../camera/lod-controller';
import {
  StateNode,
  DEFAULT_HOVER_HALO_WIDTH,
  DEFAULT_SELECTION_STROKE_WIDTH,
  DEFAULT_INITIAL_MARKER_SIZE,
} from './state-node';
import {
  getNodeRadius,
  getAcceptingRingRadius,
  getInitialMarkerTriangle,
  getNodeBoundingBox,
  computeAdaptiveStateLayout,
} from './state-geometry';

interface NodeCommandCache {
  baseCmd: DrawCommand;
  labelCmd: DrawCommand;
  selectionCmd: DrawCommand;
  hoverCmd: DrawCommand;
  bindContext: (cam: Camera, vp: Viewport) => void;
}

export class StateRenderer {
  private readonly nodes: Map<string, StateNode> = new Map<string, StateNode>();
  private readonly commandCache: Map<string, NodeCommandCache> = new Map<string, NodeCommandCache>();

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

  public setStateNodes(nodes: ReadonlyArray<StateNode>): void {
    this.nodes.clear();
    this.commandCache.clear();
    for (let i = 0; i < nodes.length; i++) {
      this.addStateNode(nodes[i]);
    }
  }

  public addStateNode(node: StateNode): void {
    this.nodes.set(node.id, node);
    this.createCommandCacheForNode(node);
  }

  public removeStateNode(id: string): boolean {
    this.commandCache.delete(id);
    return this.nodes.delete(id);
  }

  public getStateNode(id: string): StateNode | undefined {
    return this.nodes.get(id);
  }

  public getStateNodes(): ReadonlyArray<StateNode> {
    return Array.from(this.nodes.values());
  }

  public clear(): void {
    this.nodes.clear();
    this.commandCache.clear();
  }

  /**
   * Pre-allocates persistent DrawCommand objects per state node to eliminate allocations on the frame render hot path.
   */
  private createCommandCacheForNode(node: StateNode): NodeCommandCache {
    let currentCamera: Camera;
    let currentViewport: Viewport;

    const baseCmd: DrawCommand = {
      id: `state-base-${node.id}`,
      layer: RenderLayer.States,
      execute: (ctx) => {
        const liveNode = this.nodes.get(node.id) ?? node;
        this.drawStateBase2D(ctx, currentCamera, currentViewport, liveNode);
      },
    };

    const labelCmd: DrawCommand = {
      id: `state-label-${node.id}`,
      layer: RenderLayer.StateLabels,
      execute: (ctx) => {
        const liveNode = this.nodes.get(node.id) ?? node;
        this.drawStateLabel2D(ctx, currentCamera, currentViewport, liveNode);
      },
    };

    const selectionCmd: DrawCommand = {
      id: `state-selection-${node.id}`,
      layer: RenderLayer.Selection,
      execute: (ctx) => {
        const liveNode = this.nodes.get(node.id) ?? node;
        this.drawStateSelection2D(ctx, currentCamera, currentViewport, liveNode);
      },
    };

    const hoverCmd: DrawCommand = {
      id: `state-hover-${node.id}`,
      layer: RenderLayer.Hover,
      execute: (ctx) => {
        const liveNode = this.nodes.get(node.id) ?? node;
        this.drawStateHover2D(ctx, currentCamera, currentViewport, liveNode);
      },
    };

    const cache: NodeCommandCache = {
      baseCmd,
      labelCmd,
      selectionCmd,
      hoverCmd,
      bindContext: (cam: Camera, vp: Viewport) => {
        currentCamera = cam;
        currentViewport = vp;
      },
    };

    this.commandCache.set(node.id, cache);

    return cache;
  }

  /**
   * Evaluates visible state nodes within camera frustum and enqueues pooled draw commands.
   */
  public enqueueDrawCommands(
    queue: RenderQueue,
    camera: Camera,
    viewport: Viewport,
    candidateNodes?: ReadonlyArray<StateNode>,
    lodState?: LODState
  ): number {
    const visibleWorldRect = camera.getVisibleWorldRect();
    let enqueuedCount = 0;

    const nodesList = candidateNodes ?? this.nodes.values();
    const renderLabels = lodState?.renderLabels !== false;
    const renderDecorations = lodState?.renderDecorations !== false;

    for (const node of nodesList) {
      const bounds = getNodeBoundingBox(node);
      if (!intersectsBoundingBox(bounds, visibleWorldRect)) {
        continue;
      }

      let cache = this.commandCache.get(node.id);
      if (!cache) {
        cache = this.createCommandCacheForNode(node);
      }

      cache.bindContext(camera, viewport);

      // Layer 4: Base Node Geometry
      queue.enqueue(cache.baseCmd);

      // Layer 5: State Label Typography (Gated by LOD)
      if (renderLabels && node.label && node.label.length > 0) {
        queue.enqueue(cache.labelCmd);
      }

      // Layer 6: Selection / Execution Highlight
      if (node.isSelected || node.isExecutionHighlighted) {
        queue.enqueue(cache.selectionCmd);
      }

      // Layer 7: Hover Halo Glow (Gated by LOD)
      if (renderDecorations && node.isHovered) {
        queue.enqueue(cache.hoverCmd);
      }

      enqueuedCount++;
    }

    return enqueuedCount;
  }

  /**
   * Renders Base State Node Geometry (Layer 4: States).
   */
  private drawStateBase2D(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    viewport: Viewport,
    node: StateNode
  ): void {
    const screenCenter = camera.worldToScreen({ x: node.x, y: node.y });
    const zoom = camera.getState().zoom;
    const radius = getNodeRadius(node) * zoom;
    const dpr = viewport.getDevicePixelRatio();

    const fillColor = node.fillColor ?? this.theme.stateFill;
    const strokeColor = node.isExecutionAccepting
      ? '#10B981'
      : node.isExecutionHighlighted
      ? '#F97316'
      : node.strokeColor ?? this.theme.stateStroke;
    const strokeWidth = Math.max(1, (node.isExecutionHighlighted || node.isExecutionAccepting ? 3 : 2) * dpr);

    // 1. Initial State Indicator Arrow Marker (if isInitial)
    if (node.isInitial) {
      const triangle = getInitialMarkerTriangle(
        screenCenter,
        radius,
        DEFAULT_INITIAL_MARKER_SIZE * zoom
      );
      ctx.beginPath();
      ctx.moveTo(triangle[0].x, triangle[0].y);
      ctx.lineTo(triangle[1].x, triangle[1].y);
      ctx.lineTo(triangle[2].x, triangle[2].y);
      ctx.closePath();
      ctx.fillStyle = node.isExecutionAccepting
        ? '#10B981'
        : node.isExecutionHighlighted
        ? '#F97316'
        : this.theme.accentPrimary;
      ctx.fill();
    }

    // 2. Node Circle Fill & Outer Stroke
    ctx.beginPath();
    ctx.arc(screenCenter.x, screenCenter.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();

    // 3. Accepting State Concentric Inner Ring (if isAccepting)
    if (node.isAccepting) {
      const innerRadius = getAcceptingRingRadius(getNodeRadius(node)) * zoom;
      ctx.beginPath();
      ctx.arc(screenCenter.x, screenCenter.y, innerRadius, 0, Math.PI * 2);
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
    }
  }

  /**
   * Renders State Label Typography (Layer 5: StateLabels) with adaptive multiline formatting.
   */
  private drawStateLabel2D(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    _viewport: Viewport,
    node: StateNode
  ): void {
    const screenCenter = camera.worldToScreen({ x: node.x, y: node.y });
    const zoom = camera.getState().zoom;
    const layout = computeAdaptiveStateLayout(node.label, !!node.isAccepting, node.radius);
    const textColor = node.isExecutionAccepting
      ? '#34D399'
      : node.isExecutionHighlighted
      ? '#FDBA74'
      : node.textColor ?? this.theme.textPrimary;

    const fontSize = Math.max(9, Math.round(layout.baseFontSize * Math.sqrt(zoom)));
    const lineHeight = fontSize * 1.25;
    const lines = layout.lines;
    const totalHeight = (lines.length - 1) * lineHeight;

    ctx.font = `600 ${fontSize}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;

    const startY = screenCenter.y - totalHeight / 2;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], screenCenter.x, startY + i * lineHeight);
    }
  }

  /**
   * Renders Selection Accent Ring (Layer 6: Selection).
   */
  private drawStateSelection2D(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    viewport: Viewport,
    node: StateNode
  ): void {
    const screenCenter = camera.worldToScreen({ x: node.x, y: node.y });
    const zoom = camera.getState().zoom;
    const dpr = viewport.getDevicePixelRatio();
    const selectionRadius = (getNodeRadius(node) + 2) * zoom;
    const strokeWidth = (node.isExecutionHighlighted || node.isExecutionAccepting ? 4 : DEFAULT_SELECTION_STROKE_WIDTH) * dpr;

    const strokeColor = node.isExecutionAccepting
      ? '#10B981'
      : node.isExecutionHighlighted
      ? '#F97316'
      : this.theme.borderFocus;

    ctx.beginPath();
    ctx.arc(screenCenter.x, screenCenter.y, selectionRadius, 0, Math.PI * 2);
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
  }

  /**
   * Renders Hover Halo Glow (Layer 7: Hover).
   */
  private drawStateHover2D(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    viewport: Viewport,
    node: StateNode
  ): void {
    const screenCenter = camera.worldToScreen({ x: node.x, y: node.y });
    const zoom = camera.getState().zoom;
    const dpr = viewport.getDevicePixelRatio();
    const hoverRadius = (getNodeRadius(node) + 3) * zoom;
    const strokeWidth = DEFAULT_HOVER_HALO_WIDTH * dpr;

    ctx.save();
    ctx.beginPath();
    ctx.arc(screenCenter.x, screenCenter.y, hoverRadius, 0, Math.PI * 2);
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = this.theme.accentHover;
    ctx.globalAlpha = 0.3; // 30% semi-transparent halo opacity
    ctx.stroke();
    ctx.restore();
  }
}
