import React, { useEffect, useRef, useState } from 'react';
import { CanvasEngine } from '@project-zero/canvas-renderer';
import { useTheme } from '../context/ThemeContext';
import { useGraph } from '../context/GraphContext';
import { useExecution } from '../context/ExecutionContext';
import { TransitionSymbolModal, ConfirmTransitionData } from './TransitionSymbolModal';

/**
 * CanvasEngineHost — React integration layer between GraphContext / ThemeContext
 * and the @project-zero/canvas-renderer CanvasEngine.
 */
export const CanvasEngineHost: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);

  const [pendingTransition, setPendingTransition] = useState<{
    sourceId: string;
    targetId: string;
  } | null>(null);

  const { theme } = useTheme();
  const {
    nodes,
    edges,
    activeTool,
    machineType,
    selectedNodeIds,
    selectedEdgeIds,
    addNode,
    removeNode,
    moveNode,
    addEdge,
    removeEdge,
    setSelection,
    setTool,
  } = useGraph();

  const { activeStateIds, activeEdgeId, currentStep } = useExecution();

  // Keep refs for selection IDs so event handlers inside mount effect do not cause engine recreation
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  selectedNodeIdsRef.current = selectedNodeIds;
  const selectedEdgeIdsRef = useRef(selectedEdgeIds);
  selectedEdgeIdsRef.current = selectedEdgeIds;

  // Highlight active execution state(s) on CanvasEngine transiently (decoupled from isSelected)
  useEffect(() => {
    const activeSet = new Set(activeStateIds);
    const highlightedNodes = nodes.map((n) => {
      const isActive = activeStateIds.length > 0 ? activeSet.has(n.id) : false;
      const isAccepting = isActive && Boolean(n.isAccepting);
      return {
        ...n,
        isSelected: selectedNodeIds.includes(n.id),
        isExecutionHighlighted: isActive && !isAccepting,
        isExecutionAccepting: isAccepting,
      };
    });
    engineRef.current?.setStateNodes(highlightedNodes);
  }, [nodes, activeStateIds, selectedNodeIds]);

  // Highlight active transition edge(s) transiently (decoupled from isSelected)
  useEffect(() => {
    const activeSet = new Set(activeStateIds);
    const prevActiveSet = new Set<string>();

    if (currentStep) {
      if ('epsilonClosure' in currentStep && Array.isArray(currentStep.epsilonClosure)) {
        currentStep.epsilonClosure.forEach((s) => prevActiveSet.add(s.id));
      }
      if ('currentStates' in currentStep && Array.isArray(currentStep.currentStates)) {
        currentStep.currentStates.forEach((s) => prevActiveSet.add(s.id));
      }
      if ('currentStateId' in currentStep && currentStep.currentStateId) {
        prevActiveSet.add(currentStep.currentStateId);
      }
    }

    const combinedSet = new Set([...activeSet, ...prevActiveSet]);
    const readSym = currentStep?.readSymbol ? String(currentStep.readSymbol).trim() : null;

    const highlightedEdges = edges.map((e) => {
      const isDfaMatch = activeEdgeId ? e.id === activeEdgeId : false;
      const isNfaMatch =
        combinedSet.size > 0 && combinedSet.has(e.sourceNodeId) && combinedSet.has(e.targetNodeId)
          ? !e.label ||
            e.label === 'ε' ||
            e.label === 'λ' ||
            e.label.trim() === '' ||
            (readSym !== null && e.label.trim() === readSym)
          : false;

      return {
        ...e,
        isSelected: selectedEdgeIds.includes(e.id),
        isExecutionHighlighted: isDfaMatch || isNfaMatch,
      };
    });
    console.log('[CanvasEngineHost] syncing highlightedEdges to engine:', {
      totalEdges: highlightedEdges.length,
      selectedEdgeIds,
      highlightedEdgesWithSelected: highlightedEdges.filter((e) => e.isSelected).map((e) => e.id),
    });
    engineRef.current?.setTransitionEdges(highlightedEdges);
  }, [edges, activeEdgeId, activeStateIds, selectedEdgeIds, currentStep]);

  // ---------------------------------------------------------------------------
  // Mount / Unmount — create engine, attach DOM event bridge, start observers
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const engine = new CanvasEngine();
    engineRef.current = engine;

    // Attach canvas + container (container needed for ARIA overlay)
    engine.attach(canvas, container);

    // Initial configuration
    engine.setTheme(theme);
    engine.setTool(activeTool);
    engine.setStateNodes(nodes);
    engine.setTransitionEdges(edges);

    // -----------------------------------------------------------------------
    // Canvas -> GraphContext Subscriptions
    // -----------------------------------------------------------------------

    const unsubSelect = engine.subscribeSelection((nodeIds, edgeIds) => {
      console.log('[CanvasEngineHost] engine.subscribeSelection callback received:', { nodeIds, edgeIds });
      setSelection(nodeIds, edgeIds);
    });

    const unsubNodeMoved = engine.subscribeNodeMoved((id, x, y) => {
      moveNode(id, x, y, true);
    });

    const unsubNodeDragEnd = engine.subscribeNodeDragEnd
      ? engine.subscribeNodeDragEnd((id, x, y) => {
          moveNode(id, x, y, false);
        })
      : () => {};

    // When a transition gesture is drawn between two states:
    // Prompt for the input symbol instead of silently hardcoding
    const unsubEdgeCreated = engine.subscribeEdgeCreated((sourceId, targetId) => {
      setPendingTransition({ sourceId, targetId });
    });

    const unsubToolChanged = engine.subscribeToolChanged((tool) => {
      setTool(tool);
    });

    const unsubNodeAdded = engine.subscribeNodeAdded
      ? engine.subscribeNodeAdded((node) => {
          addNode(node);
        })
      : () => {};

    const unsubNodeRemoved = engine.subscribeNodeRemoved
      ? engine.subscribeNodeRemoved((id) => {
          removeNode(id);
        })
      : () => {};

    const unsubEdgeRemoved = engine.subscribeEdgeRemoved
      ? engine.subscribeEdgeRemoved((id) => {
          removeEdge(id);
        })
      : () => {};

    // -----------------------------------------------------------------------
    // DOM -> CanvasEngine Event Bridge
    // -----------------------------------------------------------------------

    const handlePointerDown = (e: PointerEvent) => {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // pointer capture fallback
      }
      canvas.focus();
      engine.handlePointerDown(e);
    };

    const handlePointerMove = (e: PointerEvent) => {
      engine.handlePointerMove(e);
    };

    const handlePointerUp = (e: PointerEvent) => {
      try {
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch {
        // pointer capture fallback
      }
      engine.handlePointerUp(e);
    };

    const handlePointerCancel = (e: PointerEvent) => {
      try {
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch {
        // pointer capture fallback
      }
      engine.handlePointerUp(e);
    };

    const handleDblClick = (e: MouseEvent) => {
      e.preventDefault();
      engine.handleDoubleClick(e);
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      engine.handleWheel(e);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;
      const isInputActive = (el: HTMLElement | null): boolean => {
        if (!el) return false;
        const tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) {
          return true;
        }
        if (typeof el.closest === 'function') {
          return el.closest('input, textarea, select, [role="dialog"]') !== null;
        }
        return false;
      };

      if (isInputActive(target) || isInputActive(activeEl)) {
        return;
      }

      const currEdgeIds = selectedEdgeIdsRef.current;
      const currNodeIds = selectedNodeIdsRef.current;

      // Handle Delete / Backspace for edge or node removal
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (currEdgeIds.length > 0) {
          e.preventDefault();
          currEdgeIds.forEach((id) => removeEdge(id));
          return;
        } else if (currNodeIds.length > 0) {
          e.preventDefault();
          currNodeIds.forEach((id) => removeNode(id));
          return;
        }
      }

      engine.handleKeyDown(e);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      engine.handleKeyUp(e);
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerCancel);
    canvas.addEventListener('dblclick', handleDblClick);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // -----------------------------------------------------------------------
    // ResizeObserver — forward container size + DPR to engine
    // -----------------------------------------------------------------------
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.contentRect;
        if (rect.width <= 0 || rect.height <= 0) continue;
        const dpr = window.devicePixelRatio || 1;
        engine.resize(Math.round(rect.width), Math.round(rect.height), dpr);
      }
    });
    resizeObserver.observe(container);

    // Listen for Toolbar/Command Palette view control events
    const handleZoomEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ factor: number }>).detail;
      if (engineRef.current && detail?.factor) {
        const camera = engineRef.current.getCamera();
        const viewport = engineRef.current.getViewport();
        camera.zoomAtPoint(detail.factor, viewport.getCenter(), true);
        engineRef.current.invalidate();
      }
    };

    const handleFitEvent = () => {
      engineRef.current?.fitView(true);
    };

    window.addEventListener('projectzero:zoom', handleZoomEvent);
    window.addEventListener('projectzero:fitview', handleFitEvent);

    // -----------------------------------------------------------------------
    // Cleanup on unmount
    // -----------------------------------------------------------------------
    return () => {
      window.removeEventListener('projectzero:zoom', handleZoomEvent);
      window.removeEventListener('projectzero:fitview', handleFitEvent);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerCancel);
      canvas.removeEventListener('dblclick', handleDblClick);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      unsubSelect();
      unsubNodeMoved();
      unsubNodeDragEnd();
      unsubEdgeCreated();
      unsubToolChanged();
      unsubNodeAdded();
      unsubNodeRemoved();
      unsubEdgeRemoved();
      engine.destroy();
      engineRef.current = null;
    };
  }, [removeEdge, removeNode, addNode, moveNode, addEdge, setSelection, setTool]);

  // ---------------------------------------------------------------------------
  // Theme effect — runs whenever theme changes after mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    engineRef.current?.setTheme(theme);
  }, [theme]);

  // ---------------------------------------------------------------------------
  // Tool effect — runs whenever activeTool changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    engineRef.current?.setTool(activeTool);
  }, [activeTool]);


  // Handle modal confirmation
  const handleConfirmTransition = (data: ConfirmTransitionData) => {
    if (!pendingTransition) return;
    const newEdgeId = `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    addEdge({
      id: newEdgeId,
      sourceNodeId: pendingTransition.sourceId,
      targetNodeId: pendingTransition.targetId,
      label: data.label,
      inputSymbol: data.inputSymbol,
      stackTop: data.stackTop,
      stackReplacement: data.stackReplacement,
      readSymbol: data.readSymbol,
      writeSymbol: data.writeSymbol,
      moveDirection: data.moveDirection,
    });
    setSelection([], [newEdgeId]);
    setPendingTransition(null);
  };

  const handleCancelTransition = () => {
    setPendingTransition(null);
  };

  const pendingSourceNode = pendingTransition
    ? nodes.find((n) => n.id === pendingTransition.sourceId)
    : undefined;
  const pendingTargetNode = pendingTransition
    ? nodes.find((n) => n.id === pendingTransition.targetId)
    : undefined;

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden select-none outline-none"
      tabIndex={0}
      style={{ minWidth: 0, minHeight: 0 }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 outline-none" tabIndex={0} />

      {/* Transition Symbol Creation Dialog */}
      <TransitionSymbolModal
        isOpen={!!pendingTransition}
        machineType={machineType}
        sourceLabel={pendingSourceNode ? pendingSourceNode.label : pendingTransition?.sourceId || ''}
        targetLabel={pendingTargetNode ? pendingTargetNode.label : pendingTransition?.targetId || ''}
        onConfirm={handleConfirmTransition}
        onCancel={handleCancelTransition}
      />
    </div>
  );
};
