import { BottomTabId } from '../bottompanel/types';

export type PanelRegionId = 'sidebar' | 'inspector' | 'bottomPanel' | 'center';

export type DockTargetRegion = 'left' | 'right' | 'bottom' | 'center' | 'top' | 'floating';

export type PanelDockMode = 'docked' | 'floating';

export interface IPanelConstraint {
  minSize: number;
  maxSize: number;
  defaultSize: number;
  snapThreshold: number;
}

export interface IPanelDefinition {
  id: PanelRegionId | string;
  title: string;
  region: DockTargetRegion;
  constraints: IPanelConstraint;
  defaultVisibility: boolean;
  mode: PanelDockMode;
  order?: number;
  metadata?: Record<string, unknown>;
}

export interface IDockState {
  sidebarWidth: number;
  inspectorWidth: number;
  bottomPanelHeight: number;
  sidebarCollapsed: boolean;
  inspectorCollapsed: boolean;
  bottomPanelCollapsed: boolean;
  sidebarHidden: boolean;
  inspectorHidden: boolean;
  bottomPanelHidden: boolean;
  activeSidebarTab: 'explorer' | 'syllabus' | 'quizzes';
  activeBottomTab: BottomTabId;
  activeInspectorTab: 'inspect' | 'state' | 'transition' | 'workspace' | 'analysis' | 'diagnostics' | 'explanation';
  focusMode?: boolean;
  aiWorkspaceOpen?: boolean;
}

export interface IDockControls {
  toggleSidebar: () => void;
  toggleInspector: () => void;
  toggleBottomPanel: () => void;
  collapsePanel: (id: PanelRegionId) => void;
  expandPanel: (id: PanelRegionId) => void;
  hidePanel: (id: PanelRegionId) => void;
  showPanel: (id: PanelRegionId) => void;
  setSidebarWidth: (width: number) => void;
  setInspectorWidth: (width: number) => void;
  setBottomPanelHeight: (height: number) => void;
  resetSidebarWidth: () => void;
  resetInspectorWidth: () => void;
  resetBottomPanelHeight: () => void;
  setActiveSidebarTab: (tab: 'explorer' | 'syllabus' | 'quizzes') => void;
  setActiveBottomTab: (tab: BottomTabId) => void;
  setActiveInspectorTab: (tab: 'inspect' | 'state' | 'transition' | 'workspace' | 'analysis' | 'diagnostics' | 'explanation') => void;
  toggleFocusMode: () => void;
  enterFocusMode: () => void;
  exitFocusMode: () => void;
  openAIWorkspace: () => void;
  closeAIWorkspace: () => void;
  toggleAIWorkspace: () => void;
  resetLayout: () => void;
}
