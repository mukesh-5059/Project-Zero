import { IPanelConstraint, IDockState } from './types';
import { PANEL_CONSTRAINTS } from './panelRegistry';

export const DEFAULT_DOCK_STATE: IDockState = {
  sidebarCollapsed: false,
  inspectorCollapsed: false,
  bottomPanelCollapsed: false,
  sidebarHidden: false,
  inspectorHidden: false,
  bottomPanelHidden: false,
  sidebarWidth: PANEL_CONSTRAINTS.sidebar.defaultSize,
  inspectorWidth: PANEL_CONSTRAINTS.inspector.defaultSize,
  bottomPanelHeight: PANEL_CONSTRAINTS.bottomPanel.defaultSize,
  activeSidebarTab: 'explorer',
  activeBottomTab: 'trace',
  activeInspectorTab: 'workspace',
  focusMode: false,
  aiWorkspaceOpen: false,
};

export class LayoutManager {
  /**
   * Clamp a size within min and max constraints
   */
  public static clampSize(size: number, minSize: number, maxSize: number): number {
    return Math.max(minSize, Math.min(maxSize, size));
  }

  /**
   * Check if target size crosses snap threshold to trigger collapse
   */
  public static shouldSnapToCollapse(size: number, minSize: number, snapThreshold: number): boolean {
    return size < minSize - snapThreshold;
  }

  /**
   * Calculate resized dimension from user drag or key step, handling snap points and bounds clamping.
   */
  public static calculateResizedDimension(
    targetSize: number,
    constraints: IPanelConstraint
  ): { size: number; collapsed: boolean } {
    const { minSize, maxSize, snapThreshold } = constraints;

    if (this.shouldSnapToCollapse(targetSize, minSize, snapThreshold)) {
      return { size: minSize, collapsed: true };
    }

    const clamped = this.clampSize(targetSize, minSize, maxSize);
    return { size: clamped, collapsed: false };
  }

  /**
   * Calculate step-based keyboard resizing (e.g. +10, -10, Home, End)
   */
  public static calculateKeyboardSize(
    currentSize: number,
    key: string,
    shiftKey: boolean,
    constraints: IPanelConstraint
  ): number | null {
    const step = shiftKey ? 50 : 10;
    const { minSize, maxSize } = constraints;

    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
        return Math.min(maxSize, currentSize + step);
      case 'ArrowLeft':
      case 'ArrowUp':
        return Math.max(minSize, currentSize - step);
      case 'Home':
        return minSize;
      case 'End':
        return maxSize;
      default:
        return null;
    }
  }

  /**
   * Reset panel layout state to default values
   */
  public static getDefaultLayout(): IDockState {
    return { ...DEFAULT_DOCK_STATE };
  }
}
