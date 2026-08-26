/**
 * Project Zero Canvas Engine Subsystem.
 * Unites Camera, Viewport, LayerManager, CanvasGrid, StateRenderer, EdgeRenderer,
 * Hierarchical SpatialIndex, InteractionEngine, RenderQueue, RenderLoop, ThemeBridge,
 * DamageTracker (Section 15), AriaDomOverlaySync (Section 18), LODController (Section 1 & 17),
 * SnapEngine (Section 3.1 & 21), ToolController (Section 13), TelemetryCollector (Section 20),
 * WatermarkRenderer (Section 2.5 & 3.1), PluginRegistry & RemoteCursorRenderer (Section 21).
 * Formally specified in docs/09_Canvas_Engine_Specification.md.
 */

import { Viewport } from './camera/viewport';
import { Camera, CameraOptions } from './camera/camera';
import { LODController, LODControllerOptions } from './camera/lod-controller';
import { LayerManager, RenderLayer } from './layer/layer-manager';
import { CanvasGrid, GridConfiguration } from './grid/canvas-grid';
import { StateRenderer } from './state/state-renderer';
import { StateNode } from './state/state-node';
import { getNodeBoundingBox } from './state/state-geometry';
import { EdgeRenderer } from './edge/edge-renderer';
import { TransitionEdge } from './edge/edge-transition';
import { getEdgeBoundingBox } from './edge/edge-geometry';
import { SpatialIndex } from './spatial/spatial-index';
import { InteractionEngine, InteractionEngineOptions } from './interaction/interaction-engine';
import { createCanvasPointerEvent, CanvasPointerEvent } from './interaction/pointer-event';
import { HitDispatcher } from './interaction/hit-dispatcher';
import { SnapEngine, SnapEngineOptions } from './interaction/snap-engine';
import { GuideRenderer } from './interaction/guide-renderer';
import { ToolController, CanvasTool, ToolControllerCallbacks } from './interaction/tool-controller';
import { RenderQueue } from './pipeline/render-queue';
import { RenderLoop } from './pipeline/render-loop';
import { DamageTracker, DamageTrackerOptions } from './pipeline/damage-tracker';
import { TelemetryCollector, FrameTelemetry } from './pipeline/telemetry-collector';
import { AriaDomOverlaySync } from './accessibility/aria-dom-overlay';
import { WatermarkRenderer } from './overlay/watermark-renderer';
import { TelemetryHUD } from './overlay/telemetry-hud';
import { RemoteCursorRenderer, RemoteCursor } from './overlay/remote-cursor-renderer';
import { PluginRegistry, CustomNodeShapePlugin } from './extension/plugin-registry';
import { ThemeBridge, ThemeMode, CanvasThemeTokens } from './theme/theme-bridge';
import {
  ICanvasEngine,
  CanvasEngineLifecycleState,
} from './renderer-interfaces';

export interface CanvasEngineOptions {
  readonly width?: number;
  readonly height?: number;
  readonly devicePixelRatio?: number;
  readonly cameraOptions?: CameraOptions;
  readonly gridConfig?: GridConfiguration;
  readonly interactionOptions?: InteractionEngineOptions;
  readonly damageOptions?: DamageTrackerOptions;
  readonly lodOptions?: LODControllerOptions;
  readonly snapOptions?: SnapEngineOptions;
  readonly theme?: ThemeMode | CanvasThemeTokens;
  readonly tool?: CanvasTool;
  readonly telemetryEnabled?: boolean;
}

export class CanvasEngine implements ICanvasEngine {
  private lifecycleState: CanvasEngineLifecycleState = 'uninitialized';

  private readonly viewport: Viewport;
  private readonly camera: Camera;
  private readonly lodController: LODController;
  private readonly layerManager: LayerManager;
  private readonly grid: CanvasGrid;
  private readonly stateRenderer: StateRenderer;
  private readonly edgeRenderer: EdgeRenderer;
  private readonly spatialIndex: SpatialIndex;
  private readonly interactionEngine: InteractionEngine;
  private readonly snapEngine: SnapEngine;
  private readonly guideRenderer: GuideRenderer;
  private readonly toolController: ToolController;
  private readonly queue: RenderQueue;
  private readonly loop: RenderLoop;
  private readonly themeBridge: ThemeBridge;
  private readonly damageTracker: DamageTracker;
  private readonly telemetryCollector: TelemetryCollector;
  private readonly watermarkRenderer: WatermarkRenderer;
  private readonly telemetryHUD: TelemetryHUD;
  private readonly pluginRegistry: PluginRegistry;
  private readonly remoteCursorRenderer: RemoteCursorRenderer;
  private readonly ariaOverlay: AriaDomOverlaySync;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  private isDirty: boolean = true;

  // External event listeners
  private readonly selectionListeners: Array<(nodes: ReadonlyArray<string>, edges: ReadonlyArray<string>) => void> = [];
  private readonly nodeMovedListeners: Array<(id: string, newX: number, newY: number) => void> = [];
  private readonly nodeDragEndListeners: Array<(id: string, finalX: number, finalY: number) => void> = [];
  private readonly edgeCreatedListeners: Array<(sourceId: string, targetId: string) => void> = [];
  private readonly toolListeners: Array<(tool: CanvasTool) => void> = [];
  private readonly nodeAddedListeners: Array<(node: StateNode) => void> = [];
  private readonly nodeRemovedListeners: Array<(id: string) => void> = [];
  private readonly edgeAddedListeners: Array<(edge: TransitionEdge) => void> = [];
  private readonly edgeRemovedListeners: Array<(id: string) => void> = [];

  constructor(options?: CanvasEngineOptions) {
    this.viewport = new Viewport(
      options?.width ?? 800,
      options?.height ?? 600,
      options?.devicePixelRatio ?? 1.0
    );

    this.themeBridge = new ThemeBridge();
    if (options?.theme) {
      this.themeBridge.setTheme(options.theme);
    }
    const currentTokens = this.themeBridge.getTokens();

    this.camera = new Camera(this.viewport, options?.cameraOptions);
    this.lodController = new LODController(options?.lodOptions);
    this.layerManager = new LayerManager();
    this.grid = new CanvasGrid(options?.gridConfig, currentTokens);
    this.stateRenderer = new StateRenderer(currentTokens);
    this.edgeRenderer = new EdgeRenderer(currentTokens);
    this.spatialIndex = new SpatialIndex();
    this.damageTracker = new DamageTracker(options?.damageOptions);
    this.snapEngine = new SnapEngine(options?.snapOptions);
    this.guideRenderer = new GuideRenderer();
    this.telemetryCollector = new TelemetryCollector();
    if (options?.telemetryEnabled) {
      this.telemetryCollector.setEnabled(true);
    }
    this.watermarkRenderer = new WatermarkRenderer();
    this.telemetryHUD = new TelemetryHUD();
    this.pluginRegistry = new PluginRegistry();
    this.remoteCursorRenderer = new RemoteCursorRenderer();

    const toolCallbacks: ToolControllerCallbacks = {
      onToolChanged: (tool) => {
        this.interactionEngine.setCreatingEdgeMode(tool === 'add-transition');
        for (let i = 0; i < this.toolListeners.length; i++) {
          this.toolListeners[i](tool);
        }
        this.invalidate();
      },
      onAddStateRequest: (wx, wy) => {
        const label = `q${this.stateRenderer.getStateNodes().length}`;
        const isInitial = this.stateRenderer.getStateNodes().length === 0;
        this.addStateNode({
          id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          label,
          x: wx,
          y: wy,
          isInitial,
        });
      },
      onEraseNodeRequest: (nodeId) => {
        this.removeStateNode(nodeId);
      },
      onEraseEdgeRequest: (edgeId) => {
        this.removeTransitionEdge(edgeId);
      },
    };
    this.toolController = new ToolController(toolCallbacks);
    if (options?.tool) {
      this.toolController.setTool(options.tool);
    }

    this.ariaOverlay = new AriaDomOverlaySync({
      onNodeFocused: (nodeId) => {
        this.interactionEngine.getContext().focusedNodeId = nodeId;
        this.invalidate();
      },
      onNodeActivated: (nodeId) => {
        this.interactionEngine.getContext().clearSelection();
        this.interactionEngine.getContext().selectedNodeIds.add(nodeId);
        this.emitSelectionChanged();
        this.invalidate();
      },
    });

    this.interactionEngine = new InteractionEngine({
      ...options?.interactionOptions,
      callbacks: {
        ...options?.interactionOptions?.callbacks,
        onSelectionChanged: (selectedNodes, selectedEdges) => {
          this.emitSelectionChanged();
          options?.interactionOptions?.callbacks?.onSelectionChanged?.(selectedNodes, selectedEdges);
        },
        onNodeMoved: (id, newX, newY) => {
          const node = this.stateRenderer.getStateNode(id);
          if (node) {
            this.damageTracker.addDirtyWorldBox(getNodeBoundingBox(node));
            const connectedEdges = this.edgeRenderer.getEdges().filter(
              (e) => e.sourceNodeId === id || e.targetNodeId === id
            );
            for (let i = 0; i < connectedEdges.length; i++) {
              const geom = this.edgeRenderer.computeGeometry(connectedEdges[i], this.stateRenderer);
              if (geom) {
                this.damageTracker.addDirtyWorldBox(getEdgeBoundingBox(geom));
              }
            }
          }
          for (let i = 0; i < this.nodeMovedListeners.length; i++) {
            this.nodeMovedListeners[i](id, newX, newY);
          }
          options?.interactionOptions?.callbacks?.onNodeMoved?.(id, newX, newY);
        },
        onNodeDragEnd: (id, finalX, finalY) => {
          for (let i = 0; i < this.nodeDragEndListeners.length; i++) {
            this.nodeDragEndListeners[i](id, finalX, finalY);
          }
          options?.interactionOptions?.callbacks?.onNodeDragEnd?.(id, finalX, finalY);
        },
        onEdgeCreated: (src, tgt) => {
          this.addTransitionEdge({
            id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            sourceNodeId: src,
            targetNodeId: tgt,
            label: '0',
          });
          for (let i = 0; i < this.edgeCreatedListeners.length; i++) {
            this.edgeCreatedListeners[i](src, tgt);
          }
          options?.interactionOptions?.callbacks?.onEdgeCreated?.(src, tgt);
        },
      },
    });

    this.queue = new RenderQueue();
    this.loop = new RenderLoop((deltaTimeMs) => this.onFrameTick(deltaTimeMs));
  }

  // ---------------------------------------------------------------------------
  // Lifecycle Contracts (Section 19)
  // ---------------------------------------------------------------------------

  public getLifecycleState(): CanvasEngineLifecycleState {
    return this.lifecycleState;
  }

  public isAttached(): boolean {
    return this.lifecycleState === 'attached';
  }

  public isSuspended(): boolean {
    return this.lifecycleState === 'suspended';
  }

  public attach(canvas: HTMLCanvasElement, container?: HTMLElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.updateCanvasSize();

    const hostContainer = container ?? canvas.parentElement;
    if (hostContainer) {
      this.ariaOverlay.attach(hostContainer);
      this.syncAccessibilityDOM();
    }

    this.lifecycleState = 'attached';
    this.damageTracker.invalidateAll();
    this.invalidate();
    this.loop.start();
  }

  public detach(): void {
    this.loop.stop();
    this.ariaOverlay.detach();
    this.canvas = null;
    this.ctx = null;
    this.lifecycleState = 'uninitialized';
  }

  public suspend(): void {
    this.loop.stop();
    this.lifecycleState = 'suspended';
  }

  public resume(): void {
    if (this.canvas && this.ctx) {
      this.lifecycleState = 'attached';
      this.damageTracker.invalidateAll();
      this.invalidate();
      this.loop.start();
    }
  }

  public destroy(): void {
    this.detach();
    this.lifecycleState = 'destroyed';
    this.stateRenderer.clear();
    this.edgeRenderer.clear();
    this.spatialIndex.clear();
    this.interactionEngine.reset();
    this.snapEngine.clearGuides();
    this.pluginRegistry.clear();
    this.remoteCursorRenderer.clear();
    this.damageTracker.reset();
    this.telemetryCollector.reset();
    this.lodController.reset();
    this.queue.clear();
    this.selectionListeners.length = 0;
    this.nodeMovedListeners.length = 0;
    this.edgeCreatedListeners.length = 0;
    this.toolListeners.length = 0;
    this.nodeAddedListeners.length = 0;
    this.nodeRemovedListeners.length = 0;
    this.edgeAddedListeners.length = 0;
    this.edgeRemovedListeners.length = 0;
  }

  // ---------------------------------------------------------------------------
  // Event Sink Subscriptions (Section 19)
  // ---------------------------------------------------------------------------

  public subscribeSelection(callback: (selectedNodes: ReadonlyArray<string>, selectedEdges: ReadonlyArray<string>) => void): () => void {
    this.selectionListeners.push(callback);
    return () => {
      const idx = this.selectionListeners.indexOf(callback);
      if (idx !== -1) this.selectionListeners.splice(idx, 1);
    };
  }

  public subscribeNodeMoved(callback: (id: string, newX: number, newY: number) => void): () => void {
    this.nodeMovedListeners.push(callback);
    return () => {
      const idx = this.nodeMovedListeners.indexOf(callback);
      if (idx !== -1) this.nodeMovedListeners.splice(idx, 1);
    };
  }

  public subscribeNodeDragEnd(callback: (id: string, finalX: number, finalY: number) => void): () => void {
    this.nodeDragEndListeners.push(callback);
    return () => {
      const idx = this.nodeDragEndListeners.indexOf(callback);
      if (idx !== -1) this.nodeDragEndListeners.splice(idx, 1);
    };
  }

  public subscribeEdgeCreated(callback: (sourceId: string, targetId: string) => void): () => void {
    this.edgeCreatedListeners.push(callback);
    return () => {
      const idx = this.edgeCreatedListeners.indexOf(callback);
      if (idx !== -1) this.edgeCreatedListeners.splice(idx, 1);
    };
  }

  public subscribeToolChanged(callback: (tool: CanvasTool) => void): () => void {
    this.toolListeners.push(callback);
    return () => {
      const idx = this.toolListeners.indexOf(callback);
      if (idx !== -1) this.toolListeners.splice(idx, 1);
    };
  }

  public subscribeNodeAdded(callback: (node: StateNode) => void): () => void {
    this.nodeAddedListeners.push(callback);
    return () => {
      const idx = this.nodeAddedListeners.indexOf(callback);
      if (idx !== -1) this.nodeAddedListeners.splice(idx, 1);
    };
  }

  public subscribeNodeRemoved(callback: (id: string) => void): () => void {
    this.nodeRemovedListeners.push(callback);
    return () => {
      const idx = this.nodeRemovedListeners.indexOf(callback);
      if (idx !== -1) this.nodeRemovedListeners.splice(idx, 1);
    };
  }

  public subscribeEdgeAdded(callback: (edge: TransitionEdge) => void): () => void {
    this.edgeAddedListeners.push(callback);
    return () => {
      const idx = this.edgeAddedListeners.indexOf(callback);
      if (idx !== -1) this.edgeAddedListeners.splice(idx, 1);
    };
  }

  public subscribeEdgeRemoved(callback: (id: string) => void): () => void {
    this.edgeRemovedListeners.push(callback);
    return () => {
      const idx = this.edgeRemovedListeners.indexOf(callback);
      if (idx !== -1) this.edgeRemovedListeners.splice(idx, 1);
    };
  }

  private emitSelectionChanged(): void {
    const nodes = this.interactionEngine.getContext().getSelectedNodeIds();
    const edges = this.interactionEngine.getContext().getSelectedEdgeIds();
    for (let i = 0; i < this.selectionListeners.length; i++) {
      this.selectionListeners[i](nodes, edges);
    }
    this.syncAccessibilityDOM();
  }

  // ---------------------------------------------------------------------------
  // Tool & Extension Controls (Section 13 & 21)
  // ---------------------------------------------------------------------------

  public getTool(): CanvasTool {
    return this.toolController.getTool();
  }

  public setTool(tool: CanvasTool): void {
    this.toolController.setTool(tool);
    this.interactionEngine.setCreatingEdgeMode(tool === 'add-transition');
    this.interactionEngine.setMarqueeMode(tool === 'box');
  }

  public getSnapEngine(): SnapEngine {
    return this.snapEngine;
  }

  public setTelemetryEnabled(enabled: boolean): void {
    this.telemetryCollector.setEnabled(enabled);
    this.invalidate();
  }

  public isTelemetryEnabled(): boolean {
    return this.telemetryCollector.isTelemetryEnabled();
  }

  public getTelemetry(): FrameTelemetry {
    return this.telemetryCollector.getTelemetry();
  }

  public registerNodeShapePlugin(plugin: CustomNodeShapePlugin): void {
    this.pluginRegistry.registerNodeShapePlugin(plugin);
  }

  public getPluginRegistry(): PluginRegistry {
    return this.pluginRegistry;
  }

  public setRemoteCursors(cursors: ReadonlyArray<RemoteCursor>): void {
    this.remoteCursorRenderer.setCursors(cursors);
    this.invalidate();
  }

  public updateRemoteCursor(cursor: RemoteCursor): void {
    this.remoteCursorRenderer.updateCursor(cursor);
    this.invalidate();
  }

  public removeRemoteCursor(id: string): boolean {
    const removed = this.remoteCursorRenderer.removeCursor(id);
    if (removed) this.invalidate();
    return removed;
  }

  public getRemoteCursors(): ReadonlyArray<RemoteCursor> {
    return this.remoteCursorRenderer.getCursors();
  }

  // ---------------------------------------------------------------------------
  // Theme Management
  // ---------------------------------------------------------------------------

  public getTheme(): CanvasThemeTokens {
    return this.themeBridge.getTokens();
  }

  public getThemeMode(): ThemeMode {
    return this.themeBridge.getMode();
  }

  public setTheme(theme: ThemeMode | CanvasThemeTokens): void {
    this.themeBridge.setTheme(theme);
    const tokens = this.themeBridge.getTokens();
    this.grid.applyTheme(tokens);
    this.stateRenderer.applyTheme(tokens);
    this.edgeRenderer.applyTheme(tokens);
    this.damageTracker.invalidateAll();
    this.invalidate();
  }

  // ---------------------------------------------------------------------------
  // Viewport & Component Accessors
  // ---------------------------------------------------------------------------

  public resize(width: number, height: number, dpr?: number): void {
    const oldCenter = this.viewport.getCenter();
    this.viewport.resize(width, height);
    if (dpr !== undefined) {
      this.viewport.setDevicePixelRatio(dpr);
    }
    const newCenter = this.viewport.getCenter();
    const deltaX = newCenter.x - oldCenter.x;
    const deltaY = newCenter.y - oldCenter.y;
    if (deltaX !== 0 || deltaY !== 0) {
      const zoom = this.camera.getState().zoom;
      const currentCamera = this.camera.getState();
      this.camera.setPosition(
        currentCamera.x + deltaX / zoom,
        currentCamera.y + deltaY / zoom,
        true
      );
    }
    this.updateCanvasSize();
    this.damageTracker.invalidateAll();
    this.invalidate();
  }

  public fitView(immediate: boolean = true): void {
    const nodes = this.stateRenderer.getStateNodes();
    if (nodes.length === 0) {
      this.camera.setPosition(0, 0, immediate);
      this.camera.setZoom(1.0, immediate);
      this.damageTracker.invalidateAll();
      this.invalidate();
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const padding = 40;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      minX = Math.min(minX, n.x - padding);
      minY = Math.min(minY, n.y - padding);
      maxX = Math.max(maxX, n.x + padding);
      maxY = Math.max(maxY, n.y + padding);
    }

    const edges = this.edgeRenderer.getEdges();
    for (let i = 0; i < edges.length; i++) {
      const geom = this.edgeRenderer.computeGeometry(edges[i], this.stateRenderer);
      if (geom) {
        const bounds = getEdgeBoundingBox(geom);
        minX = Math.min(minX, bounds.minX - 10);
        minY = Math.min(minY, bounds.minY - 10);
        maxX = Math.max(maxX, bounds.maxX + 10);
        maxY = Math.max(maxY, bounds.maxY + 10);
      }
    }

    const bbox = {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };

    this.camera.fitView(bbox, immediate);
    this.damageTracker.invalidateAll();
    this.invalidate();
  }

  public updateCanvasSize(): void {
    if (!this.canvas) return;
    const w = this.viewport.getWidth();
    const h = this.viewport.getHeight();
    const dpr = this.viewport.getDevicePixelRatio();

    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  public invalidate(): void {
    this.isDirty = true;
    this.loop.invalidate();
  }

  public getViewport(): Viewport {
    return this.viewport;
  }

  public getCamera(): Camera {
    return this.camera;
  }

  public getLODController(): LODController {
    return this.lodController;
  }

  public getDamageTracker(): DamageTracker {
    return this.damageTracker;
  }

  public getAriaOverlay(): AriaDomOverlaySync {
    return this.ariaOverlay;
  }

  public getLayerManager(): LayerManager {
    return this.layerManager;
  }

  public getGrid(): CanvasGrid {
    return this.grid;
  }

  public getStateRenderer(): StateRenderer {
    return this.stateRenderer;
  }

  public getEdgeRenderer(): EdgeRenderer {
    return this.edgeRenderer;
  }

  public getSpatialIndex(): SpatialIndex {
    return this.spatialIndex;
  }

  public getInteractionEngine(): InteractionEngine {
    return this.interactionEngine;
  }

  public getRenderQueue(): RenderQueue {
    return this.queue;
  }

  public getRenderLoop(): RenderLoop {
    return this.loop;
  }

  // ---------------------------------------------------------------------------
  // Graph Entity Mutations with Spatial & Accessibility Synchronization
  // ---------------------------------------------------------------------------

  public setStateNodes(nodes: ReadonlyArray<StateNode>): void {
    this.stateRenderer.setStateNodes(nodes);
    for (const node of this.spatialIndex.getAllNodes()) {
      this.spatialIndex.removeNode(node.id);
    }
    for (let i = 0; i < nodes.length; i++) {
      this.spatialIndex.insertNode(nodes[i]);
    }
    this.reindexAllEdges();
    this.syncAccessibilityDOM();
    this.damageTracker.invalidateAll();
    this.invalidate();
  }

  public addStateNode(node: StateNode): void {
    this.stateRenderer.addStateNode(node);
    this.spatialIndex.insertNode(node);
    this.damageTracker.addDirtyWorldBox(getNodeBoundingBox(node));
    this.syncAccessibilityDOM();
    for (let i = 0; i < this.nodeAddedListeners.length; i++) {
      this.nodeAddedListeners[i](node);
    }
    this.invalidate();
  }

  public removeStateNode(id: string): boolean {
    const node = this.stateRenderer.getStateNode(id);
    if (node) {
      this.damageTracker.addDirtyWorldBox(getNodeBoundingBox(node));
    }
    const removed = this.stateRenderer.removeStateNode(id);
    if (removed) {
      this.spatialIndex.removeNode(id);
      this.syncAccessibilityDOM();
      for (let i = 0; i < this.nodeRemovedListeners.length; i++) {
        this.nodeRemovedListeners[i](id);
      }
      this.invalidate();
    }
    return removed;
  }

  public getStateNodes(): ReadonlyArray<StateNode> {
    return this.stateRenderer.getStateNodes();
  }

  public clearStateNodes(): void {
    this.stateRenderer.clear();
    for (const node of this.spatialIndex.getAllNodes()) {
      this.spatialIndex.removeNode(node.id);
    }
    this.syncAccessibilityDOM();
    this.damageTracker.invalidateAll();
    this.invalidate();
  }

  public setTransitionEdges(edges: ReadonlyArray<TransitionEdge>): void {
    this.edgeRenderer.setEdges(edges);
    for (const edge of this.spatialIndex.getAllEdges()) {
      this.spatialIndex.removeEdge(edge.id);
    }
    for (let i = 0; i < edges.length; i++) {
      this.indexEdge(edges[i]);
    }
    this.syncAccessibilityDOM();
    this.damageTracker.invalidateAll();
    this.invalidate();
  }

  public addTransitionEdge(edge: TransitionEdge): void {
    this.edgeRenderer.addEdge(edge);
    this.indexEdge(edge);
    const geometry = this.edgeRenderer.computeGeometry(edge, this.stateRenderer);
    if (geometry) {
      this.damageTracker.addDirtyWorldBox(getEdgeBoundingBox(geometry));
    }
    this.syncAccessibilityDOM();
    for (let i = 0; i < this.edgeAddedListeners.length; i++) {
      this.edgeAddedListeners[i](edge);
    }
    this.invalidate();
  }

  public removeTransitionEdge(id: string): boolean {
    const edge = this.edgeRenderer.getEdge(id);
    if (edge) {
      const geometry = this.edgeRenderer.computeGeometry(edge, this.stateRenderer);
      if (geometry) {
        this.damageTracker.addDirtyWorldBox(getEdgeBoundingBox(geometry));
      }
    }
    const removed = this.edgeRenderer.removeEdge(id);
    if (removed) {
      this.spatialIndex.removeEdge(id);
      this.syncAccessibilityDOM();
      for (let i = 0; i < this.edgeRemovedListeners.length; i++) {
        this.edgeRemovedListeners[i](id);
      }
      this.invalidate();
    }
    return removed;
  }

  public getTransitionEdges(): ReadonlyArray<TransitionEdge> {
    return this.edgeRenderer.getEdges();
  }

  public clearTransitionEdges(): void {
    this.edgeRenderer.clear();
    for (const edge of this.spatialIndex.getAllEdges()) {
      this.spatialIndex.removeEdge(edge.id);
    }
    this.syncAccessibilityDOM();
    this.damageTracker.invalidateAll();
    this.invalidate();
  }

  private indexEdge(edge: TransitionEdge): void {
    const geometry = this.edgeRenderer.computeGeometry(edge, this.stateRenderer);
    if (geometry) {
      const bounds = getEdgeBoundingBox(geometry);
      this.spatialIndex.insertEdge(edge, bounds);
    }
  }

  private reindexAllEdges(): void {
    for (const edge of this.edgeRenderer.getEdges()) {
      const geometry = this.edgeRenderer.computeGeometry(edge, this.stateRenderer);
      if (geometry) {
        const bounds = getEdgeBoundingBox(geometry);
        this.spatialIndex.updateEdge(edge, bounds);
      }
    }
  }

  private syncAccessibilityDOM(): void {
    const nodes = this.stateRenderer.getStateNodes();
    const edges = this.edgeRenderer.getEdges();
    this.ariaOverlay.syncNodes(nodes, edges);

    const nodesMap = new Map<string, StateNode>();
    for (let i = 0; i < nodes.length; i++) {
      nodesMap.set(nodes[i].id, nodes[i]);
    }
    this.ariaOverlay.syncEdges(edges, nodesMap);
  }

  // ---------------------------------------------------------------------------
  // Input Handling via Broad-Phase Spatial Queries & Tool FSM
  // ---------------------------------------------------------------------------

  public toCanvasPointerEvent(rawEvent: MouseEvent | PointerEvent | TouchEvent): CanvasPointerEvent {
    let clientX = 0;
    let clientY = 0;

    if (typeof TouchEvent !== 'undefined' && rawEvent instanceof TouchEvent) {
      if (rawEvent.touches && rawEvent.touches.length > 0) {
        clientX = rawEvent.touches[0].clientX;
        clientY = rawEvent.touches[0].clientY;
      } else if (rawEvent.changedTouches && rawEvent.changedTouches.length > 0) {
        clientX = rawEvent.changedTouches[0].clientX;
        clientY = rawEvent.changedTouches[0].clientY;
      }
    } else if (rawEvent && typeof (rawEvent as MouseEvent).clientX === 'number') {
      clientX = (rawEvent as MouseEvent).clientX;
      clientY = (rawEvent as MouseEvent).clientY;
    }

    let rect = { left: 0, top: 0 };
    if (this.canvas && typeof this.canvas.getBoundingClientRect === 'function') {
      rect = this.canvas.getBoundingClientRect();
    }

    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    const worldPoint = this.camera.screenToWorld({ x: screenX, y: screenY });

    return createCanvasPointerEvent(rawEvent, { x: screenX, y: screenY }, worldPoint);
  }

  public handlePointerDown(rawEvent: MouseEvent | PointerEvent | TouchEvent): boolean {
    const event = this.toCanvasPointerEvent(rawEvent);
    const tool = this.toolController.getTool();

    const spatialResult = this.spatialIndex.queryPoint(
      event.worldPoint,
      HitDispatcher.DEFAULT_EDGE_HIT_TOLERANCE + 40
    );

    // Tool Mode 1: Add State (single click drops node)
    if (tool === 'add-state') {
      this.toolController.requestAddState(event.worldPoint.x, event.worldPoint.y);
      this.toolController.setTool('select');
      return true;
    }

    // Tool Mode 2: Erase (single click removes entity)
    if (tool === 'erase') {
      const hitDispatcher = new HitDispatcher();
      const hitNode = hitDispatcher.hitTestNode(spatialResult.nodes, event.worldPoint);
      if (hitNode) {
        this.toolController.requestEraseNode(hitNode.id);
        return true;
      }
      const hitEdge = hitDispatcher.hitTestEdge(spatialResult.edges, this.stateRenderer.getStateNodes(), event.worldPoint);
      if (hitEdge) {
        this.toolController.requestEraseEdge(hitEdge.id);
        return true;
      }
    }

    const handled = this.interactionEngine.pointerDown(
      event,
      this.camera,
      this.stateRenderer,
      this.edgeRenderer,
      spatialResult.nodes,
      spatialResult.edges
    );
    this.damageTracker.addDirtyScreenBox({
      minX: event.screenPoint.x - 50,
      minY: event.screenPoint.y - 50,
      maxX: event.screenPoint.x + 50,
      maxY: event.screenPoint.y + 50,
      width: 100,
      height: 100,
      centerX: event.screenPoint.x,
      centerY: event.screenPoint.y,
    });
    this.invalidate();
    return handled;
  }

  public handlePointerMove(rawEvent: MouseEvent | PointerEvent | TouchEvent): boolean {
    const event = this.toCanvasPointerEvent(rawEvent);

    const spatialResult = this.spatialIndex.queryPoint(
      event.worldPoint,
      HitDispatcher.DEFAULT_EDGE_HIT_TOLERANCE + 40
    );

    // Evaluate smart snap alignment if dragging a single node
    const ctx = this.interactionEngine.getContext();
    let effectiveEvent = event;
    if (this.interactionEngine.getState() === 'DraggingNode' && ctx.hoveredNodeId) {
      const snapRes = this.snapEngine.evaluateSnap(
        event.worldPoint.x,
        event.worldPoint.y,
        ctx.hoveredNodeId,
        this.stateRenderer.getStateNodes()
      );
      if (snapRes.snappedX || snapRes.snappedY) {
        const snappedScreen = this.camera.worldToScreen({ x: snapRes.x, y: snapRes.y });
        effectiveEvent = createCanvasPointerEvent(
          rawEvent,
          snappedScreen,
          { x: snapRes.x, y: snapRes.y }
        );
      }
    } else {
      this.snapEngine.clearGuides();
    }

    const changed = this.interactionEngine.pointerMove(
      effectiveEvent,
      this.camera,
      this.stateRenderer,
      this.edgeRenderer,
      spatialResult.nodes,
      spatialResult.edges,
      this.spatialIndex
    );

    if (changed || this.interactionEngine.getState() !== 'Idle') {
      const currentState = this.interactionEngine.getState();
      if (
        currentState === 'Panning' ||
        currentState === 'DraggingNode' ||
        currentState === 'DraggingSelection' ||
        currentState === 'MarqueeSelection' ||
        currentState === 'CreatingEdge'
      ) {
        this.damageTracker.invalidateAll();
      } else {
        this.damageTracker.addDirtyScreenBox({
          minX: event.screenPoint.x - 50,
          minY: event.screenPoint.y - 50,
          maxX: event.screenPoint.x + 50,
          maxY: event.screenPoint.y + 50,
          width: 100,
          height: 100,
          centerX: event.screenPoint.x,
          centerY: event.screenPoint.y,
        });
      }
      this.invalidate();
    }
    return changed;
  }

  public handlePointerUp(rawEvent: MouseEvent | PointerEvent | TouchEvent): boolean {
    const event = this.toCanvasPointerEvent(rawEvent);

    this.snapEngine.clearGuides();

    const spatialResult = this.spatialIndex.queryPoint(
      event.worldPoint,
      HitDispatcher.DEFAULT_EDGE_HIT_TOLERANCE + 40
    );

    const handled = this.interactionEngine.pointerUp(
      event,
      this.camera,
      this.stateRenderer,
      this.edgeRenderer.getEdges(),
      spatialResult.nodes,
      spatialResult.edges
    );
    this.damageTracker.invalidateAll();
    this.invalidate();
    return handled;
  }

  public handleDoubleClick(rawEvent: MouseEvent | PointerEvent | TouchEvent): boolean {
    const event = this.toCanvasPointerEvent(rawEvent);
    const tool = this.toolController.getTool();
    const nodeCount = this.stateRenderer.getStateNodes().length;
    if (tool === 'add-state' || nodeCount === 0) {
      this.toolController.requestAddState(event.worldPoint.x, event.worldPoint.y);
      this.invalidate();
      return true;
    }
    return false;
  }

  public handleWheel(event: WheelEvent): void {
    const clientX = event.clientX;
    const clientY = event.clientY;

    let rect = { left: 0, top: 0 };
    if (this.canvas && typeof this.canvas.getBoundingClientRect === 'function') {
      rect = this.canvas.getBoundingClientRect();
    }

    const screenPoint = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };

    this.interactionEngine.wheel(event, screenPoint, this.camera);
    this.damageTracker.invalidateAll();
    this.invalidate();
  }

  public handleKeyDown(event: KeyboardEvent): boolean {
    // 1. Tool switching hotkeys (V, S, T, E)
    if (this.toolController.handleKeyDown(event)) {
      this.invalidate();
      return true;
    }

    // 2. Telemetry HUD toggle (Ctrl + Shift + T)
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 't') {
      this.setTelemetryEnabled(!this.isTelemetryEnabled());
      return true;
    }

    const handled = this.interactionEngine.keyDown(event, this.camera, this.stateRenderer);
    if (handled) {
      this.damageTracker.invalidateAll();
      this.invalidate();
    }
    return handled;
  }

  public handleKeyUp(event: KeyboardEvent): void {
    this.interactionEngine.keyUp(event);
    this.invalidate();
  }

  // ---------------------------------------------------------------------------
  // Frame Rendering Execution with Scissored Dirty Regions & Overlays
  // ---------------------------------------------------------------------------

  public renderFrame(): void {
    this.render();
  }

  public render(): void {
    if (!this.ctx || !this.canvas) return;

    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const ctx = this.ctx;
    const dpr = this.viewport.getDevicePixelRatio();
    const w = this.canvas.width;
    const h = this.canvas.height;
    const theme = this.themeBridge.getTokens();

    const damageResult = this.damageTracker.computeDirtyScreenRegions(this.camera, this.viewport);

    ctx.save();

    // Partial scissored render clipping pass if partial invalidation is active (Section 15)
    if (!damageResult.isFullRepaint && damageResult.dirtyRegions.length > 0) {
      ctx.beginPath();
      for (let i = 0; i < damageResult.dirtyRegions.length; i++) {
        const pRect = this.damageTracker.computePhysicalClipRect(damageResult.dirtyRegions[i], dpr);
        ctx.rect(pRect.x, pRect.y, pRect.width, pRect.height);
      }
      ctx.clip();
      for (let i = 0; i < damageResult.dirtyRegions.length; i++) {
        const pRect = this.damageTracker.computePhysicalClipRect(damageResult.dirtyRegions[i], dpr);
        ctx.clearRect(pRect.x, pRect.y, pRect.width, pRect.height);
      }
    } else {
      ctx.clearRect(0, 0, w, h);
    }

    ctx.scale(dpr, dpr);

    // Layer 0: Background Grid
    if (this.layerManager.getLayerState(RenderLayer.Grid).visible) {
      ctx.save();
      this.grid.render2D(ctx, this.camera, this.viewport);
      ctx.restore();
    }

    // Evaluate active dynamic LOD state
    const lodState = this.lodController.evaluateLOD(this.camera.getState().zoom);

    // Build RenderQueue for active scene objects and interactions
    this.queue.clear();

    // Query visible frustum entities from spatial index for broad-phase culling
    const frustumEntities = this.spatialIndex.queryFrustum(this.camera);

    // Layer 2 & 3: Transitions and Edge Labels (gated by LOD)
    this.edgeRenderer.enqueueDrawCommands(
      this.queue,
      this.stateRenderer,
      this.camera,
      this.viewport,
      frustumEntities.edges,
      lodState
    );

    // Layer 4, 5, 6: State Nodes, Labels, and Selection (gated by LOD)
    this.stateRenderer.enqueueDrawCommands(
      this.queue,
      this.camera,
      this.viewport,
      frustumEntities.nodes,
      lodState
    );

    // Layers 6, 8, 10: Selection Marquee, Temporary Edge Preview, Interaction Overlays
    this.interactionEngine.enqueueDrawCommands(this.queue, this.camera, this.stateRenderer, theme);

    // Flush and sort draw commands strictly in Layer order
    const flushedCount = this.queue.flush(ctx);

    // Layer 10: Smart Alignment Guides
    this.guideRenderer.renderGuides(ctx, this.camera, this.snapEngine.getActiveGuides(), theme);

    // Layer 10: Multi-User Collaboration Remote Cursors
    this.remoteCursorRenderer.renderRemoteCursors(ctx, this.camera, this.viewport);

    // Screen Space Overlays (Watermark and Telemetry HUD)
    this.watermarkRenderer.renderWatermark(ctx, this.viewport, this.stateRenderer.getStateNodes().length, theme);

    if (this.telemetryCollector.isTelemetryEnabled()) {
      this.telemetryHUD.renderHUD(ctx, this.viewport, this.telemetryCollector.getTelemetry(), theme);
    }

    ctx.restore();
    this.isDirty = false;
    this.damageTracker.reset();

    const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsedMs = endTime - startTime;

    this.lodController.recordFrameTime(elapsedMs);

    const culledNodes = Math.max(0, this.stateRenderer.getStateNodes().length - frustumEntities.nodes.length);
    const culledEdges = Math.max(0, this.edgeRenderer.getEdges().length - frustumEntities.edges.length);
    this.telemetryCollector.recordFrame(
      elapsedMs,
      flushedCount,
      culledNodes,
      culledEdges,
      damageResult.dirtyRegions.length,
      this.lodController.isQualityDegraded()
    );
  }

  private onFrameTick(deltaTimeMs: number): boolean {
    const isCameraAnimating = this.camera.update(deltaTimeMs);

    if (this.interactionEngine.getState() === 'Hover') {
      this.interactionEngine.tick(deltaTimeMs, this.camera);
    }

    if (isCameraAnimating) {
      this.damageTracker.invalidateAll();
    }

    const needsRender = this.isDirty || isCameraAnimating;
    if (needsRender) {
      this.render();
    }
    return needsRender;
  }
}
