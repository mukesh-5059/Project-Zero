import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useGraph } from './GraphContext';
import {
  executeDFA,
  executeNFA,
  executePDA,
  executeTM,
  validateDFA,
  validateNFA,
  validatePDA,
  validateTM,
  DFAExecutionResult,
  DFAExecutionStep,
  NFAExecutionResult,
  NFAExecutionStep,
  PDAExecutionResult,
  PDAExecutionStep,
  TMExecutionResult,
  TMExecutionStep,
  DFAValidationResult,
  isFA_NFA,
  expandSolverEdges,
} from '@project-zero/core-solver';

interface ExecutionContextValue {
  inputString: string;
  setInputString: (val: string) => void;
  currentStepIndex: number;
  setCurrentStepIndex: (idx: number | ((prev: number) => number)) => void;
  isPlaying: boolean;
  playSpeedMs: number;
  setPlaySpeedMs: (speed: number) => void;
  executionResult: DFAExecutionResult | NFAExecutionResult | PDAExecutionResult | TMExecutionResult;
  validationResult: DFAValidationResult;
  currentStep: DFAExecutionStep | NFAExecutionStep | PDAExecutionStep | TMExecutionStep | null;
  activeStateId: string | null;
  activeStateIds: ReadonlyArray<string>;
  activeEdgeId: string | null;
  canRun: boolean;
  canStep: boolean;
  canBack: boolean;
  canReset: boolean;
  run: () => void;
  step: () => void;
  back: () => void;
  reset: () => void;
}

const ExecutionContext = createContext<ExecutionContextValue | undefined>(undefined);

export const ExecutionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { nodes, edges, machineType, initialStackSymbol, blankSymbol } = useGraph();
  const [inputString, setInputStringState] = useState<string>('000');
  const [currentStepIndex, setCurrentStepIndexState] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeedMs, setPlaySpeedMs] = useState<number>(600);

  // Preprocess edges for solver execution: expand comma-separated symbols (FA) or newline rules (PDA/TM)
  const solverEdges = useMemo(() => {
    return expandSolverEdges(edges, machineType);
  }, [edges, machineType]);

  // Helper to dynamically detect whether an FA graph has NFA characteristics
  const isGraphNFA = useMemo(() => {
    return isFA_NFA(nodes, edges);
  }, [nodes, edges]);

  // Dynamically validate depending on active machineType ('FA', 'DFA', 'NFA', 'PDA', or 'TM')
  const validationResult = useMemo(() => {
    if (machineType === 'TM') {
      return validateTM({ nodes, edges: solverEdges }, blankSymbol);
    }
    if (machineType === 'PDA') {
      return validatePDA({ nodes, edges: solverEdges }, initialStackSymbol);
    }
    if (machineType === 'NFA' || (machineType === 'FA' && isGraphNFA)) {
      return validateNFA({ nodes, edges: solverEdges });
    }
    return validateDFA({ nodes, edges: solverEdges });
  }, [nodes, solverEdges, machineType, initialStackSymbol, blankSymbol, isGraphNFA]);

  const executionResult = useMemo(() => {
    if (machineType === 'TM') {
      return executeTM({ nodes, edges: solverEdges }, inputString, { blankSymbol });
    }
    if (machineType === 'PDA') {
      return executePDA({ nodes, edges: solverEdges }, inputString, { initialStackSymbol });
    }
    if (machineType === 'NFA' || (machineType === 'FA' && isGraphNFA)) {
      return executeNFA({ nodes, edges: solverEdges }, inputString);
    }
    return executeDFA({ nodes, edges: solverEdges }, inputString);
  }, [nodes, solverEdges, machineType, inputString, initialStackSymbol, blankSymbol, isGraphNFA]);

  const steps = executionResult.steps;

  // Execution safety: Reset current step index and halt animation whenever graph structure or parameters mutate
  useEffect(() => {
    setCurrentStepIndexState(0);
    setIsPlaying(false);
  }, [nodes, edges, machineType, initialStackSymbol, blankSymbol]);

  // Clamp currentStepIndex within bounds whenever steps change
  useEffect(() => {
    if (steps.length === 0) {
      setCurrentStepIndexState(0);
    } else if (currentStepIndex >= steps.length) {
      setCurrentStepIndexState(steps.length - 1);
    }
  }, [steps.length, currentStepIndex]);

  const currentStep = useMemo(() => {
    if (steps.length === 0) return null;
    const idx = Math.min(Math.max(0, currentStepIndex), steps.length - 1);
    return steps[idx] || null;
  }, [steps, currentStepIndex]);

  const activeStateIds = useMemo((): ReadonlyArray<string> => {
    if (!currentStep) return [];
    if ('nextStates' in currentStep) {
      // NFA step: use nextStates (or epsilonClosure) for current active state set
      return currentStep.nextStates.map((s) => s.id);
    } else {
      // DFA / PDA / TM step: highlight target state after transition if present, otherwise current state
      const targetId = currentStep.nextStateId || currentStep.currentStateId;
      return targetId ? [targetId] : [];
    }
  }, [currentStep]);

  const activeStateId = activeStateIds.length > 0 ? activeStateIds[0] : null;
  const activeEdgeId = currentStep && 'transitionId' in currentStep ? currentStep.transitionId || null : null;

  const canRun = validationResult.isValid && steps.length > 0;
  const canStep = validationResult.isValid && steps.length > 0 && currentStepIndex < steps.length - 1;
  const canBack = validationResult.isValid && currentStepIndex > 0;
  const canReset = currentStepIndex > 0 || isPlaying;

  const setInputString = useCallback((val: string) => {
    setInputStringState(val);
    setCurrentStepIndexState(0);
    setIsPlaying(false);
  }, []);

  const setCurrentStepIndex = useCallback((idx: number | ((prev: number) => number)) => {
    setCurrentStepIndexState(idx);
  }, []);

  const step = useCallback(() => {
    if (!canStep) {
      setIsPlaying(false);
      return;
    }
    setCurrentStepIndexState((prev) => Math.min(prev + 1, steps.length - 1));
  }, [canStep, steps.length]);

  const back = useCallback(() => {
    if (!canBack) return;
    setIsPlaying(false);
    setCurrentStepIndexState((prev) => Math.max(0, prev - 1));
  }, [canBack]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentStepIndexState(0);
  }, []);

  const run = useCallback(() => {
    if (!canRun) return;

    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    if (currentStepIndex >= steps.length - 1) {
      setCurrentStepIndexState(0);
    }
    setIsPlaying(true);
  }, [canRun, isPlaying, currentStepIndex, steps.length]);

  // Automated step playback timer loop: automatically steps through execution steps sequentially
  useEffect(() => {
    if (!isPlaying) return;

    if (currentStepIndex >= steps.length - 1) {
      setIsPlaying(false);
      return;
    }

    const timer = setTimeout(() => {
      setCurrentStepIndexState((prev) => {
        const next = prev + 1;
        if (next >= steps.length - 1) {
          setIsPlaying(false);
        }
        return Math.min(next, steps.length - 1);
      });
    }, playSpeedMs);

    return () => clearTimeout(timer);
  }, [isPlaying, currentStepIndex, steps.length, playSpeedMs]);

  // Centralized keyboard shortcuts for simulation execution
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;
      const isInputActive = (el: HTMLElement | null): boolean => {
        if (!el) return false;
        const tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) {
          return true;
        }
        if (typeof el.closest === 'function') {
          return el.closest('input, textarea, select, [role="dialog"], [role="separator"]') !== null;
        }
        return false;
      };

      if (isInputActive(target) || isInputActive(activeEl)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        run();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        step();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        back();
      } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        reset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [run, step, back, reset]);

  return (
    <ExecutionContext.Provider
      value={{
        inputString,
        setInputString,
        currentStepIndex,
        setCurrentStepIndex,
        isPlaying,
        playSpeedMs,
        setPlaySpeedMs,
        executionResult,
        validationResult,
        currentStep,
        activeStateId,
        activeStateIds,
        activeEdgeId,
        canRun,
        canStep,
        canBack,
        canReset,
        run,
        step,
        back,
        reset,
      }}
    >
      {children}
    </ExecutionContext.Provider>
  );
};

export function useExecution(): ExecutionContextValue {
  const context = useContext(ExecutionContext);
  if (!context) {
    throw new Error('useExecution must be used within an ExecutionProvider');
  }
  return context;
}
