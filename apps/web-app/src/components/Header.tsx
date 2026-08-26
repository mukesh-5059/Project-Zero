import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { useCommandPalette } from '../context/CommandPaletteContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { useGraph } from '../context/GraphContext';
import { Command, Moon, Sun, Monitor, Save, HelpCircle, Settings, Sidebar, PanelRight } from 'lucide-react';
import { AutomatonType } from '@project-zero/shared';

export const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { openPalette } = useCommandPalette();
  const { toggleSidebar, toggleInspector, sidebarCollapsed, inspectorCollapsed } = useWorkspace();
  const { nodes, edges, machineType, setMachineType } = useGraph();

  const machineTypes: AutomatonType[] = ['FA', 'PDA', 'TM'];

  // Dynamically evaluate whether an FA is currently DFA or NFA
  const faSubtype = React.useMemo(() => {
    if (machineType !== 'FA' && machineType !== 'DFA' && machineType !== 'NFA') return null;
    const hasEpsilon = edges.some((e) => !e.label || e.label === 'ε' || e.label === 'λ' || e.label.trim() === '');
    if (hasEpsilon) return 'NFA';

    for (const node of nodes) {
      const seen = new Set<string>();
      for (const e of edges.filter((edge) => edge.sourceNodeId === node.id)) {
        const sym = e.label.trim();
        if (seen.has(sym)) return 'NFA';
        seen.add(sym);
      }
    }
    return 'DFA';
  }, [nodes, edges, machineType]);

  return (
    <header className="h-10 bg-bg-surface1 border-b border-border-subtle flex items-center justify-between px-3 select-none z-30 shrink-0 w-full max-w-full overflow-hidden">
      {/* Left section: App branding, Machine Type Selector & Sidebar toggle */}
      <div className="flex items-center space-x-3 shrink-0">
        <button
          onClick={toggleSidebar}
          title="Toggle Sidebar (Ctrl+B)"
          className={`p-1.5 rounded-md hover:bg-bg-surface2 transition-colors ${
            sidebarCollapsed ? 'text-txt-muted' : 'text-txt-primary'
          }`}
          aria-label="Toggle Sidebar"
        >
          <Sidebar size={16} />
        </button>

        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded bg-accent-primary flex items-center justify-center font-bold text-xs text-white">
            Z
          </div>
          <span className="font-semibold text-sm tracking-tight text-txt-primary hidden sm:inline">Project Zero</span>
        </div>

        {/* Global Machine Type Switcher */}
        <div className="flex items-center space-x-0.5 bg-bg-surface2 border border-border-subtle p-0.5 rounded text-[11px] font-mono">
          {machineTypes.map((type) => {
            const isSelected = machineType === type || ((type === 'FA') && (machineType === 'DFA' || machineType === 'NFA'));
            return (
              <button
                key={type}
                onClick={() => setMachineType(type)}
                className={`px-2 py-0.5 rounded transition-all font-bold flex items-center space-x-1 ${
                  isSelected
                    ? 'bg-accent-primary text-white shadow-xs'
                    : 'text-txt-muted hover:text-txt-primary hover:bg-bg-surface3'
                }`}
                title={`Switch workspace to ${type} model`}
              >
                <span>{type}</span>
                {type === 'FA' && isSelected && faSubtype && (
                  <span className="text-[9px] opacity-80 font-semibold px-1 rounded bg-black/20">
                    {faSubtype}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Center section: Command Palette Trigger */}
      <button
        onClick={openPalette}
        className="flex items-center space-x-2 px-3 py-1 bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle hover:border-border-strong rounded-md text-xs text-txt-secondary transition-all w-48 lg:w-64 justify-between"
      >
        <span className="flex items-center space-x-1.5 truncate">
          <Command size={13} className="text-txt-muted shrink-0" />
          <span className="truncate">Search commands...</span>
        </span>
        <kbd className="px-1.5 py-0.5 text-[10px] bg-bg-base border border-border-subtle rounded text-txt-muted font-mono shrink-0 hidden sm:inline">
          Ctrl K
        </kbd>
      </button>

      {/* Right section: Theme switcher, save indicator, settings */}
      <div className="flex items-center space-x-1.5 shrink-0">
        <div className="hidden md:flex items-center space-x-1 text-[11px] text-semantic-accept bg-semantic-accept/10 px-2 py-0.5 rounded border border-semantic-accept/20 font-mono">
          <Save size={12} />
          <span>Saved</span>
        </div>

        <button
          onClick={toggleTheme}
          title={`Active Theme: ${theme.toUpperCase()} (Click to toggle)`}
          className="px-2 py-1 rounded-md text-txt-secondary hover:text-txt-primary hover:bg-bg-surface2 transition-colors flex items-center space-x-1 text-xs"
          aria-label={`Theme: ${theme}`}
        >
          {theme === 'dark' && <Moon size={15} className="text-accent-primary" />}
          {theme === 'light' && <Sun size={15} className="text-semantic-warning" />}
          {theme === 'high-contrast' && <Monitor size={15} className="text-accent-primary" />}
          <span className="capitalize text-[11px] font-medium hidden lg:inline">{theme}</span>
        </button>

        <button
          title="Help & Documentation"
          className="p-1.5 rounded-md text-txt-secondary hover:text-txt-primary hover:bg-bg-surface2 transition-colors"
          aria-label="Help"
        >
          <HelpCircle size={16} />
        </button>

        <button
          title="Settings"
          className="p-1.5 rounded-md text-txt-secondary hover:text-txt-primary hover:bg-bg-surface2 transition-colors"
          aria-label="Settings"
        >
          <Settings size={16} />
        </button>

        <button
          onClick={toggleInspector}
          title="Toggle Property Inspector (Ctrl+Shift+P)"
          className={`p-1.5 rounded-md hover:bg-bg-surface2 transition-colors ${
            inspectorCollapsed ? 'text-txt-muted' : 'text-txt-primary'
          }`}
          aria-label="Toggle Property Inspector"
        >
          <PanelRight size={16} />
        </button>
      </div>
    </header>
  );
};
