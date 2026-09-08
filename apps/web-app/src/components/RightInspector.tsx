import React, { useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useGraph } from '../context/GraphContext';
import { StateInspectorView } from './inspector/views/StateInspectorView';
import { TransitionInspectorView } from './inspector/views/TransitionInspectorView';
import { WorkspaceInspectorView } from './inspector/views/WorkspaceInspectorView';
import { MachineAnalysisView } from './inspector/views/MachineAnalysisView';
import { DiagnosticQuickFixView } from './inspector/views/DiagnosticQuickFixView';
import { MinimizationExplanationView } from './inspector/views/MinimizationExplanationView';
import { AIChatWorkspace } from './inspector/AIChatWorkspace';
import {
  SlidersHorizontal,
  Monitor,
  Sparkles,
  Activity,
  BookOpen,
  Layers,
  Trash2,
  MousePointerClick,
  Bot,
} from 'lucide-react';

export const RightInspector: React.FC = () => {
  const {
    inspectorCollapsed,
    inspectorHidden,
    inspectorWidth,
    activeInspectorTab,
    setActiveInspectorTab,
    aiWorkspaceOpen,
    openAIWorkspace,
    closeAIWorkspace,
  } = useWorkspace();
  const { selectedNodeIds, selectedEdgeIds, clearSelection, deleteSelected } = useGraph();

  // Reactively sync inspector tab when selection changes on canvas
  useEffect(() => {
    if (selectedEdgeIds.length > 0 || selectedNodeIds.length > 0) {
      if (activeInspectorTab === 'state' || activeInspectorTab === 'transition') {
        setActiveInspectorTab('inspect');
      }
    }
  }, [selectedEdgeIds, selectedNodeIds, activeInspectorTab, setActiveInspectorTab]);

  if (inspectorCollapsed || inspectorHidden) {
    return null;
  }

  const currentTab = activeInspectorTab || 'inspect';
  const isInspectActive = currentTab === 'inspect' || currentTab === 'state' || currentTab === 'transition';
  const totalSelectedCount = selectedNodeIds.length + selectedEdgeIds.length;

  const renderInspectContent = () => {
    // Multi-selection: suppress editing UI as requested
    if (totalSelectedCount > 1) {
      return (
        <div className="flex-1 p-3 select-none overflow-y-auto space-y-3 font-mono text-xs">
          <div className="p-3 bg-bg-surface2/80 border border-border-subtle rounded-lg space-y-2.5">
            <div className="flex items-center space-x-2 text-accent-primary font-bold">
              <Layers size={16} />
              <span>Multi-Selection Active</span>
            </div>
            <div className="flex items-center space-x-2 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-accent-primary/10 text-accent-primary font-bold border border-accent-primary/20">
                {selectedNodeIds.length} State{selectedNodeIds.length === 1 ? '' : 's'}
              </span>
              <span className="px-2 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan font-bold border border-accent-cyan/20">
                {selectedEdgeIds.length} Edge{selectedEdgeIds.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-[11px] text-txt-muted leading-relaxed font-sans">
              Property editing is disabled for multiple selection. Select a single state node or transition edge to inspect and edit properties.
            </p>
            <div className="pt-2 flex items-center space-x-2">
              <button
                type="button"
                onClick={() => clearSelection()}
                className="flex-1 py-1.5 px-2 bg-bg-surface3 hover:bg-bg-surface2 border border-border-subtle rounded text-txt-primary font-semibold transition-colors text-center cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => deleteSelected()}
                className="flex-1 py-1.5 px-2 bg-semantic-error/15 hover:bg-semantic-error/25 border border-semantic-error/30 rounded text-semantic-error font-semibold transition-colors text-center cursor-pointer flex items-center justify-center space-x-1"
              >
                <Trash2 size={12} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Single State selected
    if (selectedNodeIds.length === 1 && selectedEdgeIds.length === 0) {
      return <StateInspectorView />;
    }

    // Single Edge selected
    if (selectedEdgeIds.length === 1 && selectedNodeIds.length === 0) {
      return <TransitionInspectorView />;
    }

    // No selection
    return (
      <div className="flex-1 p-4 flex flex-col items-center justify-center text-center select-none space-y-3 font-mono text-xs text-txt-muted">
        <div className="p-3 bg-bg-surface2 rounded-full border border-border-subtle text-txt-muted">
          <MousePointerClick size={20} />
        </div>
        <div>
          <div className="font-bold text-txt-primary text-xs">No Element Selected</div>
          <p className="text-[11px] text-txt-muted mt-1 max-w-[200px] leading-normal font-sans">
            Click a single state node or transition edge on the canvas to inspect and edit attributes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveInspectorTab('workspace')}
          className="mt-2 px-3 py-1.5 rounded bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle text-txt-primary font-semibold transition-colors cursor-pointer text-[11px]"
        >
          Inspect Machine Overview →
        </button>
      </div>
    );
  };

  return (
    <aside
      aria-label="Property Inspector"
      id="inspector-panel"
      style={{ width: `${inspectorWidth}px` }}
      className="bg-bg-surface1 border-l border-border-subtle flex flex-col select-none z-10 shrink-0 transition-all duration-150"
    >
      {/* 1. Top AI Assistant Launcher Header Strip */}
      <div className="px-2.5 py-1.5 bg-bg-surface2/70 border-b border-border-subtle flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-1.5 text-[11px] font-medium text-txt-muted">
          <span className="font-semibold text-txt-primary">Inspector</span>
        </div>
        <button
          type="button"
          onClick={openAIWorkspace}
          title="Open Theoretical AI Assistant Workspace"
          aria-label="Open AI Assistant"
          className="px-2 py-1 rounded bg-accent-purple/10 hover:bg-accent-purple/20 border border-accent-purple/30 text-accent-purple font-medium text-[11px] flex items-center space-x-1 transition-all cursor-pointer group"
        >
          <Bot size={12} className="group-hover:scale-110 transition-transform text-accent-purple" />
          <span>AI Assistant</span>
          <span className="w-1.5 h-1.5 rounded-full bg-accent-purple animate-pulse" />
        </button>
      </div>

      {/* 2. Dedicated AI Chat Workspace Surface (if open) OR Normal Inspector */}
      {aiWorkspaceOpen ? (
        <AIChatWorkspace onClose={closeAIWorkspace} />
      ) : (
        <>
          {/* Inspector View Switcher Tab Strip */}
          <div className="flex border-b border-border-subtle bg-bg-surface2/50 text-[11px] overflow-x-auto overflow-y-hidden shrink-0">
            <button
              title="Inspect Selected Element"
              onClick={() => setActiveInspectorTab('inspect')}
              className={`flex-1 py-1.5 px-1.5 flex items-center justify-center space-x-1 border-b-2 font-medium transition-all outline-none shrink-0 ${
                isInspectActive
                  ? 'border-accent-primary text-txt-primary bg-bg-surface1 font-bold'
                  : 'border-transparent text-txt-muted hover:text-txt-secondary'
              }`}
            >
              <SlidersHorizontal size={12} className="shrink-0 text-accent-primary" />
              <span>Inspect</span>
            </button>

            <button
              title="Inspect Machine Structure"
              onClick={() => setActiveInspectorTab('workspace')}
              className={`flex-1 py-1.5 px-1.5 flex items-center justify-center space-x-1 border-b-2 font-medium transition-all outline-none shrink-0 ${
                currentTab === 'workspace'
                  ? 'border-accent-primary text-txt-primary bg-bg-surface1 font-bold'
                  : 'border-transparent text-txt-muted hover:text-txt-secondary'
              }`}
            >
              <Monitor size={12} className="shrink-0 text-accent-cyan" />
              <span>Machine</span>
            </button>

            <button
              title="Formal Machine Analysis"
              onClick={() => setActiveInspectorTab('analysis')}
              className={`flex-1 py-1.5 px-1.5 flex items-center justify-center space-x-1 border-b-2 font-medium transition-all outline-none shrink-0 ${
                currentTab === 'analysis'
                  ? 'border-accent-primary text-txt-primary bg-bg-surface1 font-bold'
                  : 'border-transparent text-txt-muted hover:text-txt-secondary'
              }`}
            >
              <Sparkles size={12} className="shrink-0 text-accent-purple" />
              <span>Analyze</span>
            </button>

            <button
              title="Formal Verification & Diagnostics"
              onClick={() => setActiveInspectorTab('diagnostics')}
              className={`flex-1 py-1.5 px-1.5 flex items-center justify-center space-x-1 border-b-2 font-medium transition-all outline-none shrink-0 ${
                currentTab === 'diagnostics'
                  ? 'border-accent-primary text-txt-primary bg-bg-surface1 font-bold'
                  : 'border-transparent text-txt-muted hover:text-txt-secondary'
              }`}
            >
              <Activity size={12} className="shrink-0 text-semantic-warning" />
              <span>Diag</span>
            </button>

            <button
              title="Hopcroft Minimization Explanation"
              onClick={() => setActiveInspectorTab('explanation')}
              className={`flex-1 py-1.5 px-1.5 flex items-center justify-center space-x-1 border-b-2 font-medium transition-all outline-none shrink-0 ${
                currentTab === 'explanation'
                  ? 'border-accent-primary text-txt-primary bg-bg-surface1 font-bold'
                  : 'border-transparent text-txt-muted hover:text-txt-secondary'
              }`}
            >
              <BookOpen size={12} className="shrink-0 text-accent-primary" />
              <span>Explanation</span>
            </button>
          </div>

          {/* Render Active Inspector View */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {isInspectActive && renderInspectContent()}
            {currentTab === 'workspace' && <WorkspaceInspectorView />}
            {currentTab === 'analysis' && <MachineAnalysisView />}
            {currentTab === 'diagnostics' && <DiagnosticQuickFixView />}
            {currentTab === 'explanation' && <MinimizationExplanationView />}
          </div>
        </>
      )}
    </aside>
  );
};
