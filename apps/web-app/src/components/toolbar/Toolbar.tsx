import React from 'react';
import { useGraph } from '../../context/GraphContext';
import { useExecution } from '../../context/ExecutionContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { serializeMachine, deserializeMachine } from '../../utils/serialization';
import { IToolbarItem } from './types';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarGroup } from './ToolbarGroup';
import {
  MousePointer,
  BoxSelect,
  CircleDot,
  ArrowUpRight,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  RefreshCw,
  Save,
  FolderOpen,
  FilePlus,
} from 'lucide-react';

export const DesktopToolbar: React.FC = () => {
  const { setActiveBottomTab, expandPanel } = useWorkspace();
  const {
    activeTool,
    setTool,
    undo,
    redo,
    canUndo,
    canRedo,
    clearCanvas,
    nodes,
    edges,
    machineType,
    initialStackSymbol,
    blankSymbol,
    replaceMachine,
  } = useGraph();

  const { run, step, back, reset, canRun, canStep, canBack, canReset, isPlaying } = useExecution();

  // Map toolbar button IDs to CanvasTool values
  const handleToolSelect = (toolId: string): void => {
    switch (toolId) {
      case 'select':
        setTool('select');
        break;
      case 'box-select':
        setTool('box');
        break;
      case 'state':
        setTool('add-state');
        break;
      case 'edge':
        setTool('add-transition');
        break;
      case 'erase':
        setTool('erase');
        break;
      default:
        setTool('select');
    }
  };

  // Map CanvasTool back to button pressed state
  const isToolActive = (toolId: string): boolean => {
    switch (toolId) {
      case 'select':      return activeTool === 'select';
      case 'box-select':  return activeTool === 'box';
      case 'state':       return activeTool === 'add-state';
      case 'edge':        return activeTool === 'add-transition';
      case 'erase':       return activeTool === 'erase';
      default:            return false;
    }
  };

  // 1. Selection Tools Pod
  const selectionTools: IToolbarItem[] = [
    {
      id: 'select',
      label: 'Select',
      category: 'selection',
      icon: MousePointer,
      shortcut: 'V',
      tooltip: 'Pointer Selection Tool',
      isActive: isToolActive('select'),
      onClick: () => handleToolSelect('select'),
    },
    {
      id: 'box-select',
      label: 'Box',
      category: 'selection',
      icon: BoxSelect,
      shortcut: 'Shift+V',
      tooltip: 'Box Marquee Multi-Select',
      isActive: isToolActive('box-select'),
      onClick: () => handleToolSelect('box-select'),
    },
  ];

  // 2. Creation Tools & History Pod
  const creationTools: IToolbarItem[] = [
    {
      id: 'state',
      label: 'State',
      category: 'creation',
      icon: CircleDot,
      shortcut: 'S',
      tooltip: 'Place State Node',
      isActive: isToolActive('state'),
      onClick: () => handleToolSelect('state'),
    },
    {
      id: 'edge',
      label: 'Edge',
      category: 'creation',
      icon: ArrowUpRight,
      shortcut: 'T',
      tooltip: 'Draw Transition Edge',
      isActive: isToolActive('edge'),
      onClick: () => handleToolSelect('edge'),
    },
    {
      id: 'undo',
      label: 'Undo',
      category: 'creation',
      icon: RotateCcw,
      shortcut: 'Ctrl+Z',
      tooltip: 'Undo Last Mutation (Ctrl+Z)',
      isDisabled: !canUndo,
      onClick: undo,
    },
    {
      id: 'redo',
      label: 'Redo',
      category: 'creation',
      icon: RefreshCw,
      shortcut: 'Ctrl+Shift+Z',
      tooltip: 'Redo Undone Mutation (Ctrl+Shift+Z)',
      isDisabled: !canRedo,
      onClick: redo,
    },
    {
      id: 'clear',
      label: 'New',
      category: 'creation',
      icon: FilePlus,
      shortcut: '',
      tooltip: 'New Machine / Clear Canvas',
      onClick: clearCanvas,
    },
    {
      id: 'save',
      label: 'Save',
      category: 'creation',
      icon: Save,
      shortcut: 'Ctrl+S',
      tooltip: 'Save Machine to File (.projectzero)',
      onClick: () => handleSaveMachine(),
    },
    {
      id: 'open',
      label: 'Open',
      category: 'creation',
      icon: FolderOpen,
      shortcut: 'Ctrl+O',
      tooltip: 'Open Machine File (.projectzero)',
      onClick: () => handleOpenMachine(),
    },
  ];

  // 3. Simulation Controls Pod
  const simulationControls: IToolbarItem[] = [
    {
      id: 'sim-play',
      label: isPlaying ? 'Pause' : 'Run',
      category: 'simulation',
      icon: isPlaying ? Pause : Play,
      shortcut: 'Space',
      tooltip: 'Simulate Automaton Execution (Space)',
      isDisabled: !canRun,
      onClick: () => {
        expandPanel('bottomPanel');
        setActiveBottomTab('trace');
        run();
      },
    },
    {
      id: 'sim-back',
      label: 'Back',
      category: 'simulation',
      icon: SkipBack,
      shortcut: '←',
      tooltip: 'Step Back 1 Character (Left Arrow)',
      isDisabled: !canBack,
      onClick: () => {
        expandPanel('bottomPanel');
        setActiveBottomTab('trace');
        back();
      },
    },
    {
      id: 'sim-forward',
      label: 'Step',
      category: 'simulation',
      icon: SkipForward,
      shortcut: '→',
      tooltip: 'Step Forward 1 Character (Right Arrow)',
      isDisabled: !canStep,
      onClick: () => {
        expandPanel('bottomPanel');
        setActiveBottomTab('trace');
        step();
      },
    },
    {
      id: 'sim-reset',
      label: 'Reset',
      category: 'simulation',
      icon: RotateCcw,
      shortcut: 'R',
      tooltip: 'Reset Execution Trace (R)',
      isDisabled: !canReset,
      onClick: () => {
        expandPanel('bottomPanel');
        setActiveBottomTab('trace');
        reset();
      },
    },
  ];

  const handleSaveMachine = () => {
    try {
      const jsonStr = serializeMachine(
        nodes,
        edges,
        machineType,
        {
          name: `Automaton_${machineType}`,
          updatedAt: new Date().toISOString(),
        },
        initialStackSymbol,
        blankSymbol
      );
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `automaton_${machineType.toLowerCase()}_${Date.now()}.projectzero`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to save machine file:', err);
    }
  };

  const handleOpenMachine = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.projectzero,.json';
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const restored = deserializeMachine(content);
          replaceMachine(restored.nodes, restored.edges, restored.machineType, restored.initialStackSymbol, restored.blankSymbol);
        } catch (err) {
          alert(`Failed to load machine file: ${err instanceof Error ? err.message : 'Invalid machine file'}`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div
      role="toolbar"
      aria-label="Canvas Workspace Toolbar"
      className="h-10 bg-bg-surface1/90 backdrop-blur-md border-b border-border-subtle flex items-center justify-between px-3 select-none z-20 w-full max-w-full overflow-x-auto shrink-0"
    >
      {/* Primary Tools Pods (Selection, Creation, Execution) */}
      <div className="flex items-center justify-between w-full space-x-2.5">
        <ToolbarGroup label="Selection Tools" className="flex-1 justify-evenly">
          {selectionTools.map((item) => (
            <ToolbarButton key={item.id} item={item} className="flex-1" />
          ))}
        </ToolbarGroup>

        <ToolbarGroup label="Creation Tools" className="flex-[3.5] justify-evenly">
          {creationTools.map((item) => (
            <ToolbarButton key={item.id} item={item} className="flex-1" />
          ))}
        </ToolbarGroup>

        <ToolbarGroup label="Simulation Controls" className="flex-2 justify-evenly">
          {simulationControls.map((item) => (
            <ToolbarButton key={item.id} item={item} className="flex-1" />
          ))}
        </ToolbarGroup>
      </div>
    </div>
  );
};
