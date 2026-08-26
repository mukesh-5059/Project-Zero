/**
 * Canvas Tool State Machine & Interactive Mode Controller.
 * Formally specified in docs/09_Canvas_Engine_Specification.md (Section 13) and docs/08_UI_UX_Specification.md (Section 3.1).
 */

export type CanvasTool = 'select' | 'box' | 'add-state' | 'add-transition' | 'erase';

export interface ToolControllerCallbacks {
  readonly onToolChanged?: (tool: CanvasTool) => void;
  readonly onAddStateRequest?: (worldX: number, worldY: number) => void;
  readonly onEraseNodeRequest?: (nodeId: string) => void;
  readonly onEraseEdgeRequest?: (edgeId: string) => void;
}

export class ToolController {
  private currentTool: CanvasTool = 'select';
  private readonly callbacks?: ToolControllerCallbacks;

  constructor(callbacks?: ToolControllerCallbacks) {
    this.callbacks = callbacks;
  }

  public getTool(): CanvasTool {
    return this.currentTool;
  }

  public setTool(tool: CanvasTool): void {
    if (this.currentTool === tool) return;
    this.currentTool = tool;
    if (this.callbacks?.onToolChanged) {
      this.callbacks.onToolChanged(tool);
    }
  }

  /**
   * Handles keyboard shortcuts for quick tool switching (V, S, T, E).
   */
  public handleKeyDown(event: KeyboardEvent): boolean {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return false;
    }

    const target = event.target as HTMLElement | null;
    const activeEl = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
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
      return false;
    }

    const key = event.key.toLowerCase();
    switch (key) {
      case 'v':
        if (event.shiftKey) {
          this.setTool('box');
        } else {
          this.setTool('select');
        }
        return true;
      case 's':
        this.setTool('add-state');
        return true;
      case 't':
        this.setTool('add-transition');
        return true;
      case 'e':
        this.setTool('erase');
        return true;
      default:
        return false;
    }
  }

  public requestAddState(worldX: number, worldY: number): void {
    if (this.callbacks?.onAddStateRequest) {
      this.callbacks.onAddStateRequest(worldX, worldY);
    }
  }

  public requestEraseNode(nodeId: string): void {
    if (this.callbacks?.onEraseNodeRequest) {
      this.callbacks.onEraseNodeRequest(nodeId);
    }
  }

  public requestEraseEdge(edgeId: string): void {
    if (this.callbacks?.onEraseEdgeRequest) {
      this.callbacks.onEraseEdgeRequest(edgeId);
    }
  }
}
