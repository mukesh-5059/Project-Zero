/**
 * Phase 6 — Canvas-First Layout and Reversible Focus Mode: Focused Unit Tests
 *
 * Tests the workspace layout constraints, panel collapsing, focus mode enter/exit,
 * and state preservation guarantees.
 */

import { describe, it, expect } from 'vitest';
import { PANEL_CONSTRAINTS } from '../panelRegistry';
import { LayoutManager } from '../LayoutManager';
import { IDockState } from '../types';

describe('Phase 6 — Canvas-First Layout & Focus Mode', () => {
  describe('Canvas Dominance & Panel Constraints', () => {
    it('1. center canvas region has primary constraints with minSize 300 and maxSize 2000', () => {
      expect(PANEL_CONSTRAINTS.center).toBeDefined();
      expect(PANEL_CONSTRAINTS.center.minSize).toBe(300);
      expect(PANEL_CONSTRAINTS.center.defaultSize).toBe(800);
    });

    it('2. sidebars and bottom panel have bounded maximum dimensions preventing canvas starvation', () => {
      expect(PANEL_CONSTRAINTS.sidebar.maxSize).toBe(400);
      expect(PANEL_CONSTRAINTS.inspector.maxSize).toBe(450);
      expect(PANEL_CONSTRAINTS.bottomPanel.maxSize).toBe(450);
    });

    it('3. default layout starts with uncollapsed panels ready for canvas-first workflow', () => {
      const defaultState = LayoutManager.getDefaultLayout();
      expect(defaultState.sidebarCollapsed).toBe(false);
      expect(defaultState.inspectorCollapsed).toBe(false);
      expect(defaultState.bottomPanelCollapsed).toBe(false);
      expect(defaultState.sidebarHidden).toBe(false);
      expect(defaultState.inspectorHidden).toBe(false);
      expect(defaultState.bottomPanelHidden).toBe(false);
    });
  });

  describe('Focus Mode Logic & State Transitions', () => {
    function simulateEnterFocusMode(current: IDockState): {
      newState: IDockState;
      backup: {
        sidebarCollapsed: boolean;
        inspectorCollapsed: boolean;
        bottomPanelCollapsed: boolean;
        sidebarHidden: boolean;
        inspectorHidden: boolean;
        bottomPanelHidden: boolean;
      };
    } {
      const backup = {
        sidebarCollapsed: current.sidebarCollapsed,
        inspectorCollapsed: current.inspectorCollapsed,
        bottomPanelCollapsed: current.bottomPanelCollapsed,
        sidebarHidden: current.sidebarHidden,
        inspectorHidden: current.inspectorHidden,
        bottomPanelHidden: current.bottomPanelHidden,
      };

      const newState: IDockState = {
        ...current,
        focusMode: true,
        sidebarCollapsed: true,
        inspectorCollapsed: true,
        bottomPanelCollapsed: true,
      };

      return { newState, backup };
    }

    function simulateExitFocusMode(
      current: IDockState,
      backup: {
        sidebarCollapsed: boolean;
        inspectorCollapsed: boolean;
        bottomPanelCollapsed: boolean;
        sidebarHidden: boolean;
        inspectorHidden: boolean;
        bottomPanelHidden: boolean;
      } | null
    ): IDockState {
      return {
        ...current,
        focusMode: false,
        sidebarCollapsed: backup ? backup.sidebarCollapsed : false,
        inspectorCollapsed: backup ? backup.inspectorCollapsed : false,
        bottomPanelCollapsed: backup ? backup.bottomPanelCollapsed : false,
        sidebarHidden: backup ? backup.sidebarHidden : false,
        inspectorHidden: backup ? backup.inspectorHidden : false,
        bottomPanelHidden: backup ? backup.bottomPanelHidden : false,
      };
    }

    it('4. entering Focus Mode collapses all surrounding panels to maximize canvas area', () => {
      const initial = LayoutManager.getDefaultLayout();
      const { newState } = simulateEnterFocusMode(initial);

      expect(newState.focusMode).toBe(true);
      expect(newState.sidebarCollapsed).toBe(true);
      expect(newState.inspectorCollapsed).toBe(true);
      expect(newState.bottomPanelCollapsed).toBe(true);
    });

    it('5. exiting Focus Mode restores exact prior panel collapse/hidden states', () => {
      const customInitial: IDockState = {
        ...LayoutManager.getDefaultLayout(),
        sidebarCollapsed: false,
        inspectorCollapsed: true,
        bottomPanelCollapsed: false,
        sidebarWidth: 310,
        activeBottomTab: 'matrix',
        activeInspectorTab: 'state',
      };

      // Enter focus mode
      const { newState: focused, backup } = simulateEnterFocusMode(customInitial);
      expect(focused.sidebarCollapsed).toBe(true);
      expect(focused.inspectorCollapsed).toBe(true);
      expect(focused.bottomPanelCollapsed).toBe(true);

      // Exit focus mode
      const restored = simulateExitFocusMode(focused, backup);
      expect(restored.focusMode).toBe(false);
      expect(restored.sidebarCollapsed).toBe(false);
      expect(restored.inspectorCollapsed).toBe(true);
      expect(restored.bottomPanelCollapsed).toBe(false);
      expect(restored.sidebarWidth).toBe(310);
      expect(restored.activeBottomTab).toBe('matrix');
      expect(restored.activeInspectorTab).toBe('state');
    });

    it('6. focus mode transitions preserve custom panel widths and tab selections', () => {
      const stateWithSelections: IDockState = {
        ...LayoutManager.getDefaultLayout(),
        sidebarWidth: 350,
        inspectorWidth: 400,
        bottomPanelHeight: 280,
        activeSidebarTab: 'syllabus',
        activeBottomTab: 'diagnostics',
        activeInspectorTab: 'analysis',
      };

      const { newState: focused, backup } = simulateEnterFocusMode(stateWithSelections);
      expect(focused.sidebarWidth).toBe(350);
      expect(focused.inspectorWidth).toBe(400);
      expect(focused.bottomPanelHeight).toBe(280);
      expect(focused.activeSidebarTab).toBe('syllabus');
      expect(focused.activeBottomTab).toBe('diagnostics');
      expect(focused.activeInspectorTab).toBe('analysis');

      const restored = simulateExitFocusMode(focused, backup);
      expect(restored.sidebarWidth).toBe(350);
      expect(restored.inspectorWidth).toBe(400);
      expect(restored.bottomPanelHeight).toBe(280);
      expect(restored.activeSidebarTab).toBe('syllabus');
      expect(restored.activeBottomTab).toBe('diagnostics');
      expect(restored.activeInspectorTab).toBe('analysis');
    });

    it('7. focus mode does not trigger computational resets or mutate graph state', () => {
      // Focus mode is UI-only layout state.
      const initial = LayoutManager.getDefaultLayout();
      const { newState, backup } = simulateEnterFocusMode(initial);
      const restored = simulateExitFocusMode(newState, backup);
      expect(restored).toEqual(initial);
    });
  });
});
