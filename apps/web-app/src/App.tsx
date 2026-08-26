import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { GraphProvider } from './context/GraphContext';
import { DiagnosticProvider } from './context/DiagnosticContext';
import { ExecutionProvider } from './context/ExecutionContext';
import { CommandPaletteProvider } from './context/CommandPaletteContext';
import { KeyboardProvider } from './context/KeyboardContext';
import { PANEL_CONSTRAINTS } from './components/docking/panelRegistry';

import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { LeftSidebar } from './components/LeftSidebar';
import { RightInspector } from './components/RightInspector';
import { BottomPanel } from './components/BottomPanel';
import { CanvasEngineHost } from './components/CanvasEngineHost';
import { StatusBar } from './components/StatusBar';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { ResizableDivider } from './components/ResizableDivider';

const AppShell: React.FC = () => {
  const {
    sidebarCollapsed,
    inspectorCollapsed,
    bottomPanelCollapsed,
    sidebarHidden,
    inspectorHidden,
    bottomPanelHidden,
    sidebarWidth,
    inspectorWidth,
    bottomPanelHeight,
    setSidebarWidth,
    setInspectorWidth,
    setBottomPanelHeight,
    resetSidebarWidth,
    resetInspectorWidth,
    resetBottomPanelHeight,
  } = useWorkspace();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-bg-base text-txt-primary select-none">
      {/* 1. Top Header Navigation */}
      <Header />

      {/* 2. Primary Tool Pod Bar */}
      <Toolbar />

      {/* 3. Central Quad-Pane Workspace Grid */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar */}
        <LeftSidebar />

        {/* Left Resizable Splitter */}
        {!sidebarCollapsed && !sidebarHidden && (
          <ResizableDivider
            direction="horizontal"
            currentSize={sidebarWidth}
            minSize={PANEL_CONSTRAINTS.sidebar.minSize}
            maxSize={PANEL_CONSTRAINTS.sidebar.maxSize}
            defaultSize={PANEL_CONSTRAINTS.sidebar.defaultSize}
            controlsPanelId="sidebar-panel"
            label="Left Sidebar Splitter"
            onResize={(newSize) => setSidebarWidth(newSize)}
            onReset={resetSidebarWidth}
          />
        )}

        {/* Center Workspace Column */}
        <div className="flex-1 flex flex-col overflow-hidden relative min-w-[300px]">
          {/* Main Visual Canvas Container */}
          <CanvasEngineHost />

          {/* Bottom Resizable Splitter */}
          {!bottomPanelCollapsed && !bottomPanelHidden && (
            <ResizableDivider
              direction="vertical"
              invert={true}
              currentSize={bottomPanelHeight}
              minSize={PANEL_CONSTRAINTS.bottomPanel.minSize}
              maxSize={PANEL_CONSTRAINTS.bottomPanel.maxSize}
              defaultSize={PANEL_CONSTRAINTS.bottomPanel.defaultSize}
              controlsPanelId="bottom-panel"
              label="Bottom Telemetry Panel Splitter"
              onResize={(newSize) => setBottomPanelHeight(newSize)}
              onReset={resetBottomPanelHeight}
            />
          )}

          {/* Bottom Panel (Execution Trace, Matrix, Math Spec) */}
          <BottomPanel />
        </div>

        {/* Right Resizable Splitter */}
        {!inspectorCollapsed && !inspectorHidden && (
          <ResizableDivider
            direction="horizontal"
            invert={true}
            currentSize={inspectorWidth}
            minSize={PANEL_CONSTRAINTS.inspector.minSize}
            maxSize={PANEL_CONSTRAINTS.inspector.maxSize}
            defaultSize={PANEL_CONSTRAINTS.inspector.defaultSize}
            controlsPanelId="inspector-panel"
            label="Right Property Inspector Splitter"
            onResize={(newSize) => setInspectorWidth(newSize)}
            onReset={resetInspectorWidth}
          />
        )}

        {/* Right Property Inspector */}
        <RightInspector />
      </div>

      {/* 4. Bottom Telemetry Status Bar */}
      <StatusBar />

      {/* 5. Command Palette Modal Overlay */}
      <CommandPaletteModal />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <WorkspaceProvider>
        <GraphProvider>
          <DiagnosticProvider>
            <ExecutionProvider>
              <CommandPaletteProvider>
                <KeyboardProvider>
                  <AppShell />
                </KeyboardProvider>
              </CommandPaletteProvider>
            </ExecutionProvider>
          </DiagnosticProvider>
        </GraphProvider>
      </WorkspaceProvider>
    </ThemeProvider>
  );
};

export default App;
