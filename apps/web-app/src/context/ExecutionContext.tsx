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

  // Dynamically validate depending on active machineType ('DFA', 'NFA', 'PDA', or 'TM')
  const validationResult = useMemo(() => {
    if (machineType === 'TM') {
      return validateTM({ nodes, edges }, blankSymbol);
    }
    if (machineType === 'PDA') {
      return validatePDA({ nodes, edges }, initialStackSymbol);
    }
    return machineType === 'NFA' ? validateNFA({ nodes, edges }) : validateDFA({ nodes, edges });
  }, [nodes, edges, machineType, initialStackSymbol, blankSymbol]);

  const executionResult = useMemo(() => {
    if (machineType === 'TM') {
      return executeTM({ nodes, edges }, inputString, { blankSymbol });
    }
    if (machineType === 'PDA') {
      return executePDA({ nodes, edges }, inputString, { initialStackSymbol });
    }
    return machineType === 'NFA'
      ? executeNFA({ nodes, edges }, inputString)
      : executeDFA({ nodes, edges }, inputString);
  }, [nodes, edges, machineType, inputString, initialStackSymbol, blankSymbol]);

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
      // DFA step
      return currentStep.currentStateId ? [currentStep.currentStateId] : [];
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

  // Automated step playback timer loop
  useEffect(() => {
    if (!isPlaying) return;

    if (!canStep) {
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
  }, [isPlaying, canStep, steps.length, playSpeedMs]);

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
