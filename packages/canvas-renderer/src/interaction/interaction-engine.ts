/**
 * Master Interaction Engine facade uniting spatial hit dispatching, selection, pan, zoom, drag, marquee, and edge preview.
 * Formally specified in docs/09_Canvas_Engine_Specification.md (Section 13) and docs/07_Design_System.md.
 */

import { Camera } from '../camera/camera';
import { StateRenderer } from '../state/state-renderer';
import { EdgeRenderer } from '../edge/edge-renderer';
import { TransitionEdge } from '../edge/edge-transition';
import { RenderQueue } from '../pipeline/render-queue';
import { Point2D } from '../math/point2d';
import { StateNode } from '../state/state-node';
import { SpatialIndex } from '../spatial/spatial-index';
import { CanvasThemeTokens, DARK_THEME_TOKENS } from '../theme/theme-bridge';
import { InteractionState } from './interaction-state';
import { InteractionContext } from './interaction-context';
import { CanvasPointerEvent } from './pointer-event';
import { HitDispatcher, HitResult } from './hit-dispatcher';
import { DragController, DragControllerOptions } from './drag-controller';
import { PanController } from './pan-controller';
import { ZoomController } from './zoom-controller';
import { SelectionController } from './selection-controller';
import { MarqueeController } from './marquee-controller';
import { EdgePreviewController } from './edge-preview';
import { CursorManager, CanvasCursorStyle } from './cursor-manager';

export interface InteractionEngineCallbacks {
  readonly onSelectionChanged?: (selectedNodeIds: ReadonlyArray<string>, selectedEdgeIds: ReadonlyArray<string>) => void;
  readonly onNodeMoved?: (id: string, newX: number, newY: number) => void;
  readonly onNodeDragEnd?: (id: string, finalX: number, finalY: number) => void;
  readonly onEdgeCreated?: (sourceId: string, targetId: string) => void;
  readonly onCursorChanged?: (cursor: CanvasCursorStyle) => void;
  readonly onStateChanged?: (state: InteractionState) => void;
}

export interface InteractionEngineOptions {
  readonly dragOptions?: DragControllerOptions;
  readonly callbacks?: InteractionEngineCallbacks;
}

export class InteractionEngine {
  private state: InteractionState = InteractionState.Idle;
  private readonly context: InteractionContext = new InteractionContext();
  private readonly hitDispatcher: HitDispatcher = new HitDispatcher();
  private readonly dragController: DragController;
  private readonly panController: PanController = new PanController();
  private readonly zoomController: ZoomController = new ZoomController();
  private readonly selectionController: SelectionController = new SelectionController();
  private readonly marqueeController: MarqueeController = new MarqueeController();
  private readonly edgePreviewController: EdgePreviewController = new EdgePreviewController();
  private readonly cursorManager: CursorManager;

  private readonly callbacks?: InteractionEngineCallbacks;

  private isCreatingEdgeMode: boolean = false;
  private isMarqueeMode: boolean = false;

  constructor(options?: InteractionEngineOptions) {
    this.callbacks = options?.callbacks;
    this.dragController = new DragController(options?.dragOptions);
    this.cursorManager = new CursorManager((cursor) => {
      this.context.cursor = cursor;
      if (this.callbacks?.onCursorChanged) {
        this.callbacks.onCursorChanged(cursor);
      }
    });
  }

  public getState(): InteractionState {
    return this.state;
  }

  public getContext(): InteractionContext {
    return this.context;
  }

  public getHitDispatcher(): HitDispatcher {
    return this.hitDispatcher;
  }

  public getDragController(): DragController {
    return this.dragController;
  }

  public getPanController(): PanController {
    return this.panController;
  }

  public getZoomController(): ZoomController {
    return this.zoomController;
  }

  public getSelectionController(): SelectionController {
    return this.selectionController;
  }

  public getMarqueeController(): MarqueeController {
    return this.marqueeController;
  }

  public getEdgePreviewController(): EdgePreviewController {
    return this.edgePreviewController;
  }

  public getCursorManager(): CursorManager {
    return this.cursorManager;
  }

  public setCreatingEdgeMode(enabled: boolean): void {
    this.isCreatingEdgeMode = enabled;
  }

  public isCreatingEdge(): boolean {
    return this.isCreatingEdgeMode;
  }

  public setMarqueeMode(enabled: boolean): void {
    this.isMarqueeMode = enabled;
  }

  public isMarquee(): boolean {
    return this.isMarqueeMode;
  }

  public pointerDown(
    event: CanvasPointerEvent,
    camera: Camera,
    stateRenderer: StateRenderer,
    edgeRenderer: EdgeRenderer,
    candidateNodes?: ReadonlyArray<StateNode>,
    candidateEdges?: ReadonlyArray<TransitionEdge>
  ): boolean {
    const allNodes = stateRenderer.getStateNodes();
    const allNodesMap = new Map(allNodes.map((n) => [n.id, n]));
    const nodes = candidateNodes && candidateNodes.length > 0 ? candidateNodes : allNodes;
    const edges = candidateEdges && candidateEdges.length > 0 ? candidateEdges : edgeRenderer.getEdges();
    const zoom = camera.getState().zoom;
    const tolerance = HitDispatcher.DEFAULT_EDGE_HIT_TOLERANCE / Math.max(0.1, zoom);
    const hitResult = this.hitDispatcher.evaluateHit(nodes, edges, event.worldPoint, tolerance, allNodesMap);
    console.log('[InteractionEngine] pointerDown hitResult:', hitResult, {
      allNodesCount: allNodes.length,
      testedNodesCount: nodes.length,
      testedEdgesCount: edges.length,
      candidateEdgesCount: candidateEdges?.length,
      tolerance,
      worldPoint: event.worldPoint,
    });

    let stateChanged = false;

    // 1. Pan gesture via middle mouse, spacebar, or touch
    if (this.panController.shouldInitiatePan(event, false)) {
      this.transitionToState(InteractionState.Panning);
      this.panController.startPan(this.context, event, camera);
      stateChanged = true;
    }
    // 2. Add transition tool mode
    else if (this.isCreatingEdgeMode && hitResult.type === 'node' && hitResult.nodeId) {
      this.transitionToState(InteractionState.CreatingEdge);
      this.edgePreviewController.startEdgePreview(this.context, hitResult.nodeId, event.worldPoint);
      stateChanged = true;
    }
    // 3. Node hit -> Drag state node
    else if (hitResult.type === 'node' && hitResult.nodeId) {
      const selectionChanged = this.selectionController.handlePointerSelection(this.context, event, hitResult);
      if (selectionChanged) {
        this.emitSelectionChanged();
      }

      const nextState =
        this.context.selectedNodeIds.size > 1
          ? InteractionState.DraggingSelection
          : InteractionState.DraggingNode;

      this.context.hoveredNodeId = hitResult.nodeId;
      this.context.hoveredEdgeId = null;
      for (const n of nodes) {
        (n as { isHovered?: boolean }).isHovered = n.id === hitResult.nodeId;
      }
      for (const e of edgeRenderer.getEdges()) {
        (e as { isHovered?: boolean }).isHovered = false;
      }

      this.transitionToState(nextState);
      this.dragController.startDrag(this.context, stateRenderer.getStateNodes(), event.worldPoint);
      stateChanged = true;
    }
    // 4. Edge hit -> Select edge
    else if (hitResult.type === 'edge' && hitResult.edgeId) {
      const selectionChanged = this.selectionController.handlePointerSelection(this.context, event, hitResult);
      if (selectionChanged) {
        this.emitSelectionChanged();
      }
      this.context.hoveredEdgeId = hitResult.edgeId;
      this.context.hoveredNodeId = null;
      for (const e of edgeRenderer.getEdges()) {
        (e as { isHovered?: boolean }).isHovered = e.id === hitResult.edgeId;
      }
      for (const n of nodes) {
        (n as { isHovered?: boolean }).isHovered = false;
      }
      this.transitionToState(InteractionState.Idle);
      stateChanged = true;
    }
    // 5. Background hit (EMPTY CANVAS SPACE)
    else if (hitResult.type === 'background') {
      const selectionChanged = this.selectionController.handlePointerSelection(this.context, event, hitResult);
      if (selectionChanged) {
        this.emitSelectionChanged();
      }
      this.context.hoveredNodeId = null;
      this.context.hoveredEdgeId = null;
      for (const e of edgeRenderer.getEdges()) {
        (e as { isHovered?: boolean }).isHovered = false;
      }
      for (const n of nodes) {
        (n as { isHovered?: boolean }).isHovered = false;
      }

      const isAdditive = event.shiftKey || event.ctrlKey || event.metaKey;
      if (isAdditive || this.isMarqueeMode) {
        this.transitionToState(InteractionState.MarqueeSelection);
        this.marqueeController.startMarquee(this.context, event.worldPoint, isAdditive);
      } else {
        this.transitionToState(InteractionState.Panning);
        this.panController.startPan(this.context, event, camera);
      }
      stateChanged = true;
    }

    this.updateCursor(hitResult);
    return stateChanged;
  }

  public pointerMove(
    event: CanvasPointerEvent,
    camera: Camera,
    stateRenderer: StateRenderer,
    edgeRenderer: EdgeRenderer,
    candidateNodes?: ReadonlyArray<StateNode>,
    candidateEdges?: ReadonlyArray<TransitionEdge>,
    spatialIndex?: SpatialIndex
  ): boolean {
    const nodes = stateRenderer.getStateNodes();
    let invalidated = false;

    switch (this.state) {
      case InteractionState.Panning:
        invalidated = this.panController.updatePan(this.context, event, camera);
        break;

      case InteractionState.DraggingNode:
      case InteractionState.DraggingSelection: {
        invalidated = this.dragController.updateDrag(
          this.context,
          nodes,
          event.worldPoint,
          (id, newX, newY) => {
            if (spatialIndex) {
              const node = stateRenderer.getStateNode(id);
              if (node) {
                spatialIndex.updateNode(node);
              }
            }
            if (this.callbacks?.onNodeMoved) {
              this.callbacks.onNodeMoved(id, newX, newY);
            }
          }
        );
        break;
      }

      case InteractionState.MarqueeSelection: {
        const isAdditive = event.shiftKey || event.ctrlKey || event.metaKey;
        invalidated = this.marqueeController.updateMarquee(
          this.context,
          event.worldPoint,
          nodes,
          isAdditive
        );
        if (invalidated) {
          this.emitSelectionChanged();
        }
        break;
      }

      case InteractionState.CreatingEdge:
        this.edgePreviewController.updateEdgePreview(this.context, event.worldPoint);
        invalidated = true;
        break;

      case InteractionState.Idle:
      case InteractionState.Hover:
      default: {
        const allNodes = stateRenderer.getStateNodes();
        const allNodesMap = new Map(allNodes.map((n) => [n.id, n]));
        const queryNodes = candidateNodes && candidateNodes.length > 0 ? candidateNodes : allNodes;
        const queryEdges = candidateEdges && candidateEdges.length > 0 ? candidateEdges : edgeRenderer.getEdges();
        const zoom = camera.getState().zoom;
        const tolerance = HitDispatcher.DEFAULT_EDGE_HIT_TOLERANCE / Math.max(0.1, zoom);
        const hitResult = this.hitDispatcher.evaluateHit(queryNodes, queryEdges, event.worldPoint, tolerance, allNodesMap);
        const newHoveredNode = hitResult.type === 'node' ? hitResult.nodeId ?? null : null;
        const newHoveredEdge = hitResult.type === 'edge' ? hitResult.edgeId ?? null : null;

        if (this.context.hoveredNodeId !== newHoveredNode || this.context.hoveredEdgeId !== newHoveredEdge) {
          this.context.hoveredNodeId = newHoveredNode;
          this.context.hoveredEdgeId = newHoveredEdge;

          for (const n of nodes) {
            (n as { isHovered?: boolean }).isHovered = n.id === newHoveredNode;
          }
          for (const e of edgeRenderer.getEdges()) {
            (e as { isHovered?: boolean }).isHovered = e.id === newHoveredEdge;
          }

          this.transitionToState(newHoveredNode || newHoveredEdge ? InteractionState.Hover : InteractionState.Idle);
          invalidated = true;
        }

        this.updateCursor(hitResult);
        break;
      }
    }

    return invalidated;
  }

  public pointerUp(
    event: CanvasPointerEvent,
    _camera: Camera,
    stateRenderer: StateRenderer,
    edges: ReadonlyArray<TransitionEdge>,
    candidateNodes?: ReadonlyArray<StateNode>,
    candidateEdges?: ReadonlyArray<TransitionEdge>
  ): boolean {
    let invalidated = false;

    if (this.state === InteractionState.Panning) {
      this.panController.endPan(this.context);
      invalidated = true;
    } else if (this.state === InteractionState.DraggingNode || this.state === InteractionState.DraggingSelection) {
      this.dragController.endDrag(
        this.context,
        (id, finalX, finalY) => {
          if (this.callbacks?.onNodeDragEnd) {
            this.callbacks.onNodeDragEnd(id, finalX, finalY);
          }
        },
        stateRenderer.getStateNodes()
      );
      invalidated = true;
    } else if (this.state === InteractionState.MarqueeSelection) {
      this.marqueeController.endMarquee(this.context);
      invalidated = true;
    } else if (this.state === InteractionState.CreatingEdge) {
      const allNodes = stateRenderer.getStateNodes();
      const allNodesMap = new Map(allNodes.map((n) => [n.id, n]));
      const nodes = candidateNodes && candidateNodes.length > 0 ? candidateNodes : allNodes;
      const queryEdges = candidateEdges && candidateEdges.length > 0 ? candidateEdges : edges;
      const zoom = _camera.getState().zoom;
      const tolerance = HitDispatcher.DEFAULT_EDGE_HIT_TOLERANCE / Math.max(0.1, zoom);
      const hitResult = this.hitDispatcher.evaluateHit(nodes, queryEdges, event.worldPoint, tolerance, allNodesMap);

      if (hitResult.type === 'node' && hitResult.nodeId) {
        this.edgePreviewController.commitEdgePreview(this.context, hitResult.nodeId, this.callbacks?.onEdgeCreated);
      } else {
        this.edgePreviewController.cancelEdgePreview(this.context);
      }
      invalidated = true;
    }

    this.transitionToState(InteractionState.Idle);
    return invalidated;
  }

  public pointerCancel(): void {
    this.context.resetDrag();
    this.edgePreviewController.cancelEdgePreview(this.context);
    this.transitionToState(InteractionState.Idle);
  }

  public wheel(event: WheelEvent, screenPoint: Point2D, camera: Camera): void {
    this.zoomController.handleWheel(event, screenPoint, camera);
  }

  public keyDown(event: KeyboardEvent, _camera: Camera, stateRenderer: StateRenderer): boolean {
    if (event.key === ' ') {
      this.panController.setSpacePressed(true);
      this.cursorManager.setCursor('grab');
      return true;
    }

    if (event.key === 'Escape') {
      if (this.state === InteractionState.CreatingEdge) {
        this.edgePreviewController.cancelEdgePreview(this.context);
        this.transitionToState(InteractionState.Idle);
        return true;
      }
    }

    const navHandled = this.selectionController.handleKeyboardNavigation(
      this.context,
      event,
      stateRenderer.getStateNodes()
    );

    if (navHandled) {
      this.emitSelectionChanged();
      const selected = this.context.selectedNodeIds;
      for (const n of stateRenderer.getStateNodes()) {
        (n as { isSelected?: boolean }).isSelected = selected.has(n.id);
      }
      return true;
    }

    return false;
  }

  public keyUp(event: KeyboardEvent): void {
    if (event.key === ' ') {
      this.panController.setSpacePressed(false);
      this.cursorManager.setCursor('default');
    }
  }

  public tick(deltaTimeMs: number, camera: Camera): boolean {
    return camera.update(deltaTimeMs);
  }

  public reset(): void {
    this.context.reset();
    this.edgePreviewController.cancelEdgePreview(this.context);
    this.transitionToState(InteractionState.Idle);
  }

  public enqueueDrawCommands(
    queue: RenderQueue,
    camera: Camera,
    stateRenderer: StateRenderer,
    theme: CanvasThemeTokens = DARK_THEME_TOKENS
  ): void {
    this.marqueeController.enqueueDrawCommands(queue, this.context, camera, theme);

    const nodesMap = new Map<string, StateNode>();
    for (const n of stateRenderer.getStateNodes()) {
      nodesMap.set(n.id, n);
    }
    this.edgePreviewController.enqueueDrawCommands(queue, this.context, camera, nodesMap, theme);
  }

  private transitionToState(newState: InteractionState): void {
    if (this.state !== newState) {
      this.state = newState;
      if (this.callbacks?.onStateChanged) {
        this.callbacks.onStateChanged(newState);
      }
    }
  }

  private updateCursor(hitResult: HitResult): void {
    this.cursorManager.updateCursorForState(
      this.state,
      hitResult.type !== 'background',
      hitResult.type === 'node',
      this.isMarqueeMode
    );
  }

  private emitSelectionChanged(): void {
    const nodeIds = this.context.getSelectedNodeIds();
    const edgeIds = this.context.getSelectedEdgeIds();
    console.log('[InteractionEngine] emitSelectionChanged:', { nodeIds, edgeIds });
    if (this.callbacks?.onSelectionChanged) {
      this.callbacks.onSelectionChanged(nodeIds, edgeIds);
    }
  }
}
