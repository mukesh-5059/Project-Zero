import React, { useEffect, useState, useCallback } from 'react';
import { PanelRegionId, IDockState } from './types';
import { BottomTabId } from '../bottompanel/types';
import { PANEL_CONSTRAINTS } from './panelRegistry';
import { LayoutManager } from './LayoutManager';
import { LayoutPersistence } from './LayoutPersistence';
import { DockContext } from './DockContext';

export const DockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [layout, setLayout] = useState<IDockState>(() => LayoutPersistence.load());

  useEffect(() => {
    LayoutPersistence.save(layout);
  }, [layout]);

  const toggleSidebar = useCallback(() => {
    setLayout((prev) => ({ ...prev, sidebarCollapsed: !prev.sidebarCollapsed }));
  }, []);

  const toggleInspector = useCallback(() => {
    setLayout((prev) => ({ ...prev, inspectorCollapsed: !prev.inspectorCollapsed }));
  }, []);

  const toggleBottomPanel = useCallback(() => {
    setLayout((prev) => ({ ...prev, bottomPanelCollapsed: !prev.bottomPanelCollapsed }));
  }, []);

  const collapsePanel = useCallback((id: PanelRegionId) => {
    if (id === 'sidebar') setLayout((prev) => ({ ...prev, sidebarCollapsed: true }));
    else if (id === 'inspector') setLayout((prev) => ({ ...prev, inspectorCollapsed: true }));
    else if (id === 'bottomPanel') setLayout((prev) => ({ ...prev, bottomPanelCollapsed: true }));
  }, []);

  const expandPanel = useCallback((id: PanelRegionId) => {
    if (id === 'sidebar') setLayout((prev) => ({ ...prev, sidebarCollapsed: false, sidebarHidden: false }));
    else if (id === 'inspector') setLayout((prev) => ({ ...prev, inspectorCollapsed: false, inspectorHidden: false }));
    else if (id === 'bottomPanel') setLayout((prev) => ({ ...prev, bottomPanelCollapsed: false, bottomPanelHidden: false }));
  }, []);

  const hidePanel = useCallback((id: PanelRegionId) => {
    if (id === 'sidebar') setLayout((prev) => ({ ...prev, sidebarHidden: true }));
    else if (id === 'inspector') setLayout((prev) => ({ ...prev, inspectorHidden: true }));
    else if (id === 'bottomPanel') setLayout((prev) => ({ ...prev, bottomPanelHidden: true }));
  }, []);

  const showPanel = useCallback((id: PanelRegionId) => {
    if (id === 'sidebar') setLayout((prev) => ({ ...prev, sidebarHidden: false }));
    else if (id === 'inspector') setLayout((prev) => ({ ...prev, inspectorHidden: false }));
    else if (id === 'bottomPanel') setLayout((prev) => ({ ...prev, bottomPanelHidden: false }));
  }, []);

  const setSidebarWidth = useCallback((width: number) => {
    const { size, collapsed } = LayoutManager.calculateResizedDimension(
      width,
      PANEL_CONSTRAINTS.sidebar
    );
    setLayout((prev) => ({
      ...prev,
      sidebarWidth: size,
      sidebarCollapsed: collapsed,
    }));
  }, []);

  const setInspectorWidth = useCallback((width: number) => {
    const { size, collapsed } = LayoutManager.calculateResizedDimension(
      width,
      PANEL_CONSTRAINTS.inspector
    );
    setLayout((prev) => ({
      ...prev,
      inspectorWidth: size,
      inspectorCollapsed: collapsed,
    }));
  }, []);

  const setBottomPanelHeight = useCallback((height: number) => {
    const { size, collapsed } = LayoutManager.calculateResizedDimension(
      height,
      PANEL_CONSTRAINTS.bottomPanel
    );
    setLayout((prev) => ({
      ...prev,
      bottomPanelHeight: size,
      bottomPanelCollapsed: collapsed,
    }));
  }, []);

  const resetSidebarWidth = useCallback(() => {
    setLayout((prev) => ({
      ...prev,
      sidebarWidth: PANEL_CONSTRAINTS.sidebar.defaultSize,
      sidebarCollapsed: false,
      sidebarHidden: false,
    }));
  }, []);

  const resetInspectorWidth = useCallback(() => {
    setLayout((prev) => ({
      ...prev,
      inspectorWidth: PANEL_CONSTRAINTS.inspector.defaultSize,
      inspectorCollapsed: false,
      inspectorHidden: false,
    }));
  }, []);

  const resetBottomPanelHeight = useCallback(() => {
    setLayout((prev) => ({
      ...prev,
      bottomPanelHeight: PANEL_CONSTRAINTS.bottomPanel.defaultSize,
      bottomPanelCollapsed: false,
      bottomPanelHidden: false,
    }));
  }, []);

  const setActiveSidebarTab = useCallback((activeSidebarTab: 'explorer' | 'syllabus' | 'quizzes') => {
    setLayout((prev) => ({ ...prev, activeSidebarTab }));
  }, []);

  const setActiveBottomTab = useCallback((activeBottomTab: BottomTabId) => {
    setLayout((prev) => ({ ...prev, activeBottomTab }));
  }, []);

  const setActiveInspectorTab = useCallback((activeInspectorTab: 'inspect' | 'state' | 'transition' | 'workspace' | 'analysis' | 'diagnostics' | 'explanation') => {
    setLayout((prev) => ({ ...prev, activeInspectorTab, inspectorCollapsed: false, inspectorHidden: false }));
  }, []);

  const resetLayout = useCallback(() => {
    const defaults = LayoutManager.getDefaultLayout();
    setLayout(defaults);
    LayoutPersistence.clear();
  }, []);

  return (
    <DockContext.Provider
      value={{
        ...layout,
        toggleSidebar,
        toggleInspector,
        toggleBottomPanel,
        collapsePanel,
        expandPanel,
        hidePanel,
        showPanel,
        setSidebarWidth,
        setInspectorWidth,
        setBottomPanelHeight,
        resetSidebarWidth,
        resetInspectorWidth,
        resetBottomPanelHeight,
        setActiveSidebarTab,
        setActiveBottomTab,
        setActiveInspectorTab,
        resetLayout,
      }}
    >
      {children}
    </DockContext.Provider>
  );
};
