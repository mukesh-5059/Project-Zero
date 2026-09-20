/**
 * Selection Controller for single, multi-selection, and keyboard navigation.
 * Formally specified in docs/09_Canvas_Engine_Specification.md (Section 11, 18).
 */

import { CanvasPointerEvent } from './pointer-event';
import { InteractionContext } from './interaction-context';
import { StateNode } from '../state/state-node';
import { HitResult } from './hit-dispatcher';

export class SelectionController {
  public handlePointerSelection(
    context: InteractionContext,
    event: CanvasPointerEvent,
    hitResult: HitResult
  ): boolean {
    const isMultiSelect = event.ctrlKey || event.metaKey;
    const isAdditive = event.shiftKey;

    let changed = false;

    if (hitResult.type === 'node' && hitResult.nodeId) {
      const id = hitResult.nodeId;
      if (isMultiSelect) {
        context.toggleNodeSelection(id);
        changed = true;
      } else if (isAdditive) {
        context.selectNode(id, true);
        changed = true;
      } else if (!context.isNodeSelected(id)) {
        context.selectNode(id, false);
        changed = true;
      }
    } else if (hitResult.type === 'edge' && hitResult.edgeId) {
      const id = hitResult.edgeId;
      if (isMultiSelect || isAdditive) {
        context.selectEdge(id, true);
      } else {
        context.selectEdge(id, false);
      }
      changed = true;
      console.log('[SelectionController] Selected edge:', id, 'context.selectedEdgeIds:', Array.from(context.selectedEdgeIds));
    } else if (hitResult.type === 'background') {
      if (!isMultiSelect && !isAdditive) {
        if (context.selectedNodeIds.size > 0 || context.selectedEdgeIds.size > 0) {
          context.clearSelection();
          changed = true;
        }
      }
    }

    return changed;
  }

  public handleKeyboardNavigation(
    context: InteractionContext,
    event: KeyboardEvent,
    stateNodes: ReadonlyArray<StateNode>
  ): boolean {
    if (stateNodes.length === 0) return false;

    if (event.key === 'Escape') {
      if (context.selectedNodeIds.size > 0 || context.selectedEdgeIds.size > 0 || context.focusedNodeId) {
        context.clearSelection();
        context.focusedNodeId = null;
        return true;
      }
      return false;
    }

    if (event.key === 'Tab') {
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      const nodes = Array.from(stateNodes);
      const currentIndex = context.focusedNodeId
        ? nodes.findIndex((n) => n.id === context.focusedNodeId)
        : -1;

      let nextIndex = 0;
      if (event.shiftKey) {
        nextIndex = currentIndex <= 0 ? nodes.length - 1 : currentIndex - 1;
      } else {
        nextIndex = currentIndex < 0 || currentIndex >= nodes.length - 1 ? 0 : currentIndex + 1;
      }

      context.selectNode(nodes[nextIndex].id, false);
      return true;
    }

    if (event.key === 'Enter') {
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      if (context.focusedNodeId) {
        if (event.ctrlKey || event.metaKey) {
          context.toggleNodeSelection(context.focusedNodeId);
        } else if (event.shiftKey) {
          context.selectNode(context.focusedNodeId, true);
        } else {
          context.selectNode(context.focusedNodeId, false);
        }
        return true;
      }
    }

    // Arrow keys spatial navigation with deterministic tie-breaking
    if (
      event.key === 'ArrowRight' ||
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp'
    ) {
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      const nodes = Array.from(stateNodes);
      const current = context.focusedNodeId
        ? nodes.find((n) => n.id === context.focusedNodeId)
        : nodes[0];

      if (!current) return false;

      let bestNode: StateNode | null = null;
      let bestDist = Infinity;

      for (let i = 0; i < nodes.length; i++) {
        const candidate = nodes[i];
        if (candidate.id === current.id) continue;
        const dx = candidate.x - current.x;
        const dy = candidate.y - current.y;

        let isMatch = false;
        if (event.key === 'ArrowRight' && dx > 0) isMatch = true;
        if (event.key === 'ArrowLeft' && dx < 0) isMatch = true;
        if (event.key === 'ArrowDown' && dy > 0) isMatch = true;
        if (event.key === 'ArrowUp' && dy < 0) isMatch = true;

        if (isMatch) {
          const dist = dx * dx + dy * dy;
          // Deterministic tie-breaking: shorter euclidean distance, then lexicographical ID
          if (
            dist < bestDist ||
            (Math.abs(dist - bestDist) < 1e-6 && bestNode && candidate.id.localeCompare(bestNode.id) < 0)
          ) {
            bestDist = dist;
            bestNode = candidate;
          }
        }
      }

      if (bestNode) {
        if (event.shiftKey) {
          context.selectNode(bestNode.id, true);
        } else if (event.ctrlKey || event.metaKey) {
          context.toggleNodeSelection(bestNode.id);
        } else {
          context.selectNode(bestNode.id, false);
        }
        return true;
      }
    }

    return false;
  }
}
