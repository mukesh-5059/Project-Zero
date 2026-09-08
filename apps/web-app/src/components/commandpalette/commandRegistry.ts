import { ICommand } from './types';
import {
  FolderTree,
  BookOpen,
  GraduationCap,
  Sidebar,
  PanelRight,
  Play,
  RefreshCw,
  Moon,
  Sun,
  Monitor,
  Trash2,
  Save,
  Cpu,
  Zap,
  CheckCircle,
  Bot,
  HelpCircle,
  Code,
} from 'lucide-react';

export const COMMAND_REGISTRY: ICommand[] = [
  // 1. Navigation Category
  {
    id: 'nav-explorer',
    title: 'Focus Project Explorer Panel',
    category: 'Navigation',
    icon: FolderTree,
    shortcut: 'Alt+1',
    keywords: ['explorer', 'files', 'tree', 'project'],
  },
  {
    id: 'nav-syllabus',
    title: 'Focus Syllabus Topics Panel',
    category: 'Navigation',
    icon: BookOpen,
    shortcut: 'Alt+2',
    keywords: ['syllabus', 'modules', 'course', 'learn'],
  },
  {
    id: 'nav-quizzes',
    title: 'Focus Quiz Challenges Panel',
    category: 'Navigation',
    icon: GraduationCap,
    shortcut: 'Alt+3',
    keywords: ['quizzes', 'tests', 'challenges'],
  },

  // 2. View Category
  {
    id: 'view-toggle-sidebar',
    title: 'Toggle Left Sidebar',
    category: 'View',
    icon: Sidebar,
    shortcut: 'Ctrl+B',
    keywords: ['sidebar', 'left', 'hide', 'show'],
  },
  {
    id: 'view-toggle-inspector',
    title: 'Toggle Property Inspector',
    category: 'View',
    icon: PanelRight,
    shortcut: 'Ctrl+Shift+P',
    keywords: ['inspector', 'properties', 'right', 'hide', 'show'],
  },
  {
    id: 'view-toggle-bottom',
    title: 'Toggle Bottom Execution Panel',
    category: 'View',
    icon: Play,
    shortcut: 'Ctrl+J',
    keywords: ['bottom', 'trace', 'matrix', 'logs', 'panel'],
  },
  {
    id: 'view-reset-layout',
    title: 'Reset Workspace Layout Ratios',
    category: 'View',
    icon: RefreshCw,
    keywords: ['reset', 'layout', 'default', 'restore'],
  },

  // 3. Theme Category
  {
    id: 'theme-dark',
    title: 'Switch to Dark Theme',
    category: 'Theme',
    icon: Moon,
    keywords: ['theme', 'dark', 'mode', 'night'],
  },
  {
    id: 'theme-light',
    title: 'Switch to Light Theme',
    category: 'Theme',
    icon: Sun,
    keywords: ['theme', 'light', 'mode', 'day'],
  },
  {
    id: 'theme-contrast',
    title: 'Switch to High Contrast Theme',
    category: 'Theme',
    icon: Monitor,
    keywords: ['theme', 'contrast', 'high', 'accessibility'],
  },

  // 4. Workspace Category
  {
    id: 'ws-save',
    title: 'Save Active Automaton Machine',
    category: 'Workspace',
    icon: Save,
    shortcut: 'Ctrl+S',
    keywords: ['save', 'serialize', 'indexeddb'],
  },
  {
    id: 'ws-clear',
    title: 'Clear Canvas Workspace',
    category: 'Workspace',
    icon: Trash2,
    keywords: ['clear', 'reset', 'delete', 'new'],
  },

  // 5. Active Computational Solver Category
  {
    id: 'solver-nfa-dfa',
    title: 'Execute NFA to DFA Subset Construction',
    category: 'Transformations',
    icon: Cpu,
    keywords: ['nfa', 'dfa', 'subset', 'conversion', 'solver'],
  },
  {
    id: 'solver-hopcroft',
    title: 'Execute Hopcroft DFA Minimization',
    category: 'Transformations',
    icon: Zap,
    keywords: ['hopcroft', 'minimize', 'solver', 'reduction'],
  },
  {
    id: 'solver-regex',
    title: 'Construct ε-NFA from Regular Expression',
    category: 'Transformations',
    icon: Code,
    keywords: ['regex', 'thompson', 'nfa', 'construction'],
  },
  {
    id: 'solver-analyze',
    title: 'Run Machine Analysis & Completeness Check',
    category: 'Analysis',
    icon: CheckCircle,
    keywords: ['analyze', 'completeness', 'validation', 'telemetry'],
  },

  {
    id: 'ai-open-assistant',
    title: 'Open Theoretical AI Assistant Workspace',
    category: 'Workspace',
    icon: Bot,
    description: 'Open dedicated AI Assistant workspace surface in right panel',
    keywords: ['ai', 'assistant', 'tutor', 'guidance', 'chat', 'proofs'],
  },
  {
    id: 'ai-tutor-ask',
    title: 'Ask AI Tutor for Step Guidance',
    category: 'AI Assistant',
    icon: Bot,
    keywords: ['ai', 'tutor', 'guidance', 'help'],
  },
  {
    id: 'ai-tutor-explain',
    title: 'AI Explain Automaton Execution Trace',
    category: 'AI Assistant',
    icon: HelpCircle,
    keywords: ['ai', 'explain', 'trace', 'reasoning'],
  },
];
