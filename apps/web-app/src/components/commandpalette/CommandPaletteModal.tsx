import React, { useState, useEffect, useRef } from 'react';
import { useCommandPalette } from '../../context/CommandPaletteContext';
import { useTheme } from '../../context/ThemeContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { COMMAND_REGISTRY } from './commandRegistry';
import { ICommand } from './types';
import { CommandItem } from './CommandItem';
import { Search, Command as CommandIcon, X, Clock } from 'lucide-react';

const RECENT_STORAGE_KEY = 'v1_recent_commands';

export const CommandPaletteModal: React.FC = () => {
  const { isOpen, closePalette } = useCommandPalette();
  const {
    toggleSidebar,
    toggleInspector,
    toggleBottomPanel,
    resetLayout,
    setActiveSidebarTab,
    setActiveInspectorTab,
    expandPanel,
  } = useWorkspace();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : ['view-toggle-sidebar', 'ws-save'];
    } catch {
      return ['view-toggle-sidebar', 'ws-save'];
    }
  });

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus trap & auto-focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter commands by fuzzy match title, category, or keywords
  const filterCommands = (): ICommand[] => {
    if (!query.trim()) return COMMAND_REGISTRY;
    const lower = query.toLowerCase();
    return COMMAND_REGISTRY.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(lower) ||
        cmd.category.toLowerCase().includes(lower) ||
        cmd.keywords?.some((k) => k.toLowerCase().includes(lower)),
    );
  };

  const filtered = filterCommands();

  // Execute selected command
  const executeCommand = (cmd: ICommand) => {
    if (cmd.isDisabled) return;

    // Record recent command ID
    const updatedRecents = [cmd.id, ...recentIds.filter((id) => id !== cmd.id)].slice(0, 5);
    setRecentIds(updatedRecents);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updatedRecents));

    // Dynamic action dispatch
    switch (cmd.id) {
      case 'nav-explorer':
        setActiveSidebarTab('explorer');
        break;
      case 'nav-syllabus':
        setActiveSidebarTab('syllabus');
        break;
      case 'nav-quizzes':
        setActiveSidebarTab('quizzes');
        break;
      case 'view-toggle-sidebar':
        toggleSidebar();
        break;
      case 'view-toggle-inspector':
        toggleInspector();
        break;
      case 'view-toggle-bottom':
        toggleBottomPanel();
        break;
      case 'view-reset-layout':
        resetLayout();
        break;
      case 'theme-dark':
        setTheme('dark');
        break;
      case 'theme-light':
        setTheme('light');
        break;
      case 'theme-contrast':
        setTheme('high-contrast');
        break;
      case 'solver-nfa-dfa': {
        const nfaBtn = document.getElementById('btn-conv-subset');
        if (nfaBtn) nfaBtn.click();
        break;
      }
      case 'solver-hopcroft': {
        const minBtn = document.getElementById('btn-conv-hopcroft');
        if (minBtn) minBtn.click();
        break;
      }
      case 'solver-regex': {
        const regexBtn = document.getElementById('btn-conv-regex');
        if (regexBtn) regexBtn.click();
        break;
      }
      case 'solver-analyze':
      case 'ai-tutor-explain':
      case 'ai-tutor-ask': {
        setActiveInspectorTab('analysis');
        expandPanel('inspector');
        const analyzeBtn = document.getElementById('btn-ai-analyze');
        if (analyzeBtn) analyzeBtn.click();
        break;
      }
      default:
        break;
    }

    closePalette();
  };

  // Keyboard navigation inside listbox
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        executeCommand(filtered[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  };

  if (!isOpen) return null;

  const recentCommands = COMMAND_REGISTRY.filter((c) => recentIds.includes(c.id));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette Modal"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 px-4 select-none"
      onClick={closePalette}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="bg-bg-surface1 border border-border-strong w-full max-w-xl rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
      >
        {/* Search Header */}
        <div className="flex items-center px-4 py-3 border-b border-border-subtle bg-bg-surface2/50">
          <Search size={18} className="text-txt-muted shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search workspace..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full bg-transparent text-txt-primary placeholder-txt-muted text-sm border-none outline-none font-sans"
          />
          <button
            type="button"
            onClick={closePalette}
            aria-label="Close Command Palette"
            className="p-1 text-txt-muted hover:text-txt-primary rounded"
          >
            <X size={16} />
          </button>
        </div>

        {/* Command List Container */}
        <div role="listbox" aria-label="Commands List" className="max-h-80 overflow-y-auto p-2 space-y-3">
          {/* Recent Commands Section (when search is empty) */}
          {!query.trim() && recentCommands.length > 0 && (
            <div>
              <span className="font-mono text-[10px] uppercase text-txt-muted tracking-wider block mb-1 px-2 flex items-center space-x-1">
                <Clock size={11} className="mr-1 inline" />
                Recent Commands
              </span>
              <div className="space-y-0.5">
                {recentCommands.map((cmd) => (
                  <CommandItem
                    key={`recent-${cmd.id}`}
                    command={cmd}
                    isSelected={false}
                    onSelect={executeCommand}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Main Filtered Commands */}
          <div>
            {!query.trim() && (
              <span className="font-mono text-[10px] uppercase text-txt-muted tracking-wider block mb-1 px-2">
                All Available Commands
              </span>
            )}

            {filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-txt-muted">
                No matching commands found for "{query}"
              </div>
            ) : (
              <div className="space-y-0.5">
                {filtered.map((cmd, idx) => (
                  <CommandItem
                    key={cmd.id}
                    command={cmd}
                    isSelected={idx === selectedIndex}
                    onSelect={executeCommand}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Command Footer */}
        <div className="h-8 border-t border-border-subtle bg-bg-surface2/40 px-4 flex items-center justify-between text-[11px] text-txt-muted font-mono">
          <span className="flex items-center space-x-1">
            <CommandIcon size={12} />
            <span>Raycast / VS Code Command Navigation</span>
          </span>
          <div className="flex items-center space-x-2">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
        </div>
      </div>
    </div>
  );
};
