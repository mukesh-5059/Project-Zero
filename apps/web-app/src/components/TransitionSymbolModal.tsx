import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, CornerDownLeft, X } from 'lucide-react';
import { AutomatonType } from '@project-zero/shared';

export interface ConfirmTransitionData {
  label: string;
  inputSymbol?: string;
  stackTop?: string;
  stackReplacement?: string;
  readSymbol?: string;
  writeSymbol?: string;
  moveDirection?: 'L' | 'R' | 'S';
}

interface TransitionSymbolModalProps {
  isOpen: boolean;
  machineType?: AutomatonType;
  sourceLabel: string;
  targetLabel: string;
  onConfirm: (data: ConfirmTransitionData) => void;
  onCancel: () => void;
}

const PRESET_SYMBOLS_FA = ['0', '1', 'a', 'b', 'ε', 'λ', 'x', 'y'];
const PRESET_SYMBOLS_INPUT = ['a', 'b', '0', '1', 'ε'];
const PRESET_SYMBOLS_STACK_TOP = ['Z0', 'A', 'B', 'X', 'ε'];
const PRESET_SYMBOLS_STACK_REPL = ['AZ0', 'BZ0', 'AA', 'Z0', 'ε'];
const PRESET_SYMBOLS_TM = ['0', '1', 'a', 'b', '□', 'ε'];

export const TransitionSymbolModal: React.FC<TransitionSymbolModalProps> = ({
  isOpen,
  machineType = 'FA',
  sourceLabel,
  targetLabel,
  onConfirm,
  onCancel,
}) => {
  // Single-symbol state for FA
  const [symbol, setSymbol] = useState('0');

  // Multi-field state for PDA
  const [inputSymbol, setInputSymbol] = useState('a');
  const [stackTop, setStackTop] = useState('Z0');
  const [stackReplacement, setStackReplacement] = useState('AZ0');

  // Multi-field state for TM
  const [readSymbol, setReadSymbol] = useState('0');
  const [writeSymbol, setWriteSymbol] = useState('1');
  const [moveDirection, setMoveDirection] = useState<'L' | 'R' | 'S'>('R');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSymbol('0');
      setInputSymbol('a');
      setStackTop('Z0');
      setStackReplacement('AZ0');
      setReadSymbol('0');
      setWriteSymbol('1');
      setMoveDirection('R');

      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (machineType === 'PDA') {
      const inSym = inputSymbol.trim() || 'ε';
      const topSym = stackTop.trim() || 'ε';
      const replSym = stackReplacement.trim() || 'ε';
      const label = `${inSym}, ${topSym} -> ${replSym}`;

      onConfirm({
        label,
        inputSymbol: inSym,
        stackTop: topSym,
        stackReplacement: replSym,
      });
    } else if (machineType === 'TM') {
      const rSym = readSymbol.trim() || '0';
      const wSym = writeSymbol.trim() || '1';
      const label = `${rSym} → ${wSym}, ${moveDirection}`;

      onConfirm({
        label,
        readSymbol: rSym,
        writeSymbol: wSym,
        moveDirection,
      });
    } else {
      const sym = symbol.trim() || 'ε';
      onConfirm({
        label: sym,
        inputSymbol: sym,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    }
  };

  const isPDA = machineType === 'PDA';
  const isTM = machineType === 'TM';

  const previewLabel = isPDA
    ? `${inputSymbol.trim() || 'ε'}, ${stackTop.trim() || 'ε'} -> ${stackReplacement.trim() || 'ε'}`
    : isTM
    ? `${readSymbol.trim() || '0'} → ${writeSymbol.trim() || '1'}, ${moveDirection}`
    : symbol.trim() || 'ε';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn"
    >
      <div className="bg-bg-surface1 border border-border-subtle rounded-xl shadow-2xl w-full max-w-md overflow-hidden select-none animate-scaleUp">
        {/* Header */}
        <div className="p-4 border-b border-border-subtle bg-bg-surface2/50 flex items-center justify-between">
          <div>
            <h3 id="modal-title" className="text-sm font-semibold text-txt-primary flex items-center space-x-1.5">
              <span>{isPDA ? 'PDA Transition Rule' : isTM ? 'Turing Machine Transition' : 'Transition Input Symbol'}</span>
            </h3>
            <p className="text-[11px] text-txt-secondary mt-0.5 flex items-center space-x-1 font-mono">
              <span className="font-bold text-accent-primary">{sourceLabel}</span>
              <ArrowRight size={12} className="text-txt-muted" />
              <span className="font-bold text-accent-primary">{targetLabel}</span>
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-md text-txt-muted hover:text-txt-primary hover:bg-bg-surface3 transition-colors"
            title="Cancel (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {isPDA ? (
            <>
              {/* PDA Input Symbol */}
              <div>
                <label className="block text-xs font-medium text-txt-secondary mb-1">
                  1. Input Symbol Consumed (a)
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputSymbol}
                  onChange={(e) => setInputSymbol(e.target.value)}
                  placeholder="e.g. a, 0, ε"
                  className="w-full px-3 py-1.5 text-sm font-mono bg-bg-surface2 border border-border-subtle rounded-lg text-txt-primary focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {PRESET_SYMBOLS_INPUT.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setInputSymbol(s)}
                      className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-all ${
                        inputSymbol === s
                          ? 'bg-accent-primary text-white border-accent-primary font-bold'
                          : 'bg-bg-surface2 border-border-subtle text-txt-secondary hover:bg-bg-surface3 hover:text-txt-primary'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* PDA Top of Stack */}
              <div>
                <label className="block text-xs font-medium text-txt-secondary mb-1">
                  2. Top of Stack Matched / Popped (X)
                </label>
                <input
                  type="text"
                  value={stackTop}
                  onChange={(e) => setStackTop(e.target.value)}
                  placeholder="e.g. Z0, A, ε"
                  className="w-full px-3 py-1.5 text-sm font-mono bg-bg-surface2 border border-border-subtle rounded-lg text-txt-primary focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {PRESET_SYMBOLS_STACK_TOP.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStackTop(s)}
                      className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-all ${
                        stackTop === s
                          ? 'bg-accent-primary text-white border-accent-primary font-bold'
                          : 'bg-bg-surface2 border-border-subtle text-txt-secondary hover:bg-bg-surface3 hover:text-txt-primary'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* PDA Stack Replacement */}
              <div>
                <label className="block text-xs font-medium text-txt-secondary mb-1">
                  3. Stack Replacement Pushed (γ)
                </label>
                <input
                  type="text"
                  value={stackReplacement}
                  onChange={(e) => setStackReplacement(e.target.value)}
                  placeholder="e.g. AZ0, Z0, ε"
                  className="w-full px-3 py-1.5 text-sm font-mono bg-bg-surface2 border border-border-subtle rounded-lg text-txt-primary focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {PRESET_SYMBOLS_STACK_REPL.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStackReplacement(s)}
                      className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-all ${
                        stackReplacement === s
                          ? 'bg-accent-primary text-white border-accent-primary font-bold'
                          : 'bg-bg-surface2 border-border-subtle text-txt-secondary hover:bg-bg-surface3 hover:text-txt-primary'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : isTM ? (
            <>
              {/* TM Read Symbol */}
              <div>
                <label className="block text-xs font-medium text-txt-secondary mb-1">Read Symbol</label>
                <input
                  ref={inputRef}
                  type="text"
                  value={readSymbol}
                  onChange={(e) => setReadSymbol(e.target.value)}
                  placeholder="e.g. 0, 1, □"
                  className="w-full px-3 py-1.5 text-sm font-mono bg-bg-surface2 border border-border-subtle rounded-lg text-txt-primary focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {PRESET_SYMBOLS_TM.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setReadSymbol(s)}
                      className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-all ${
                        readSymbol === s
                          ? 'bg-accent-primary text-white border-accent-primary font-bold'
                          : 'bg-bg-surface2 border-border-subtle text-txt-secondary hover:bg-bg-surface3 hover:text-txt-primary'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* TM Write Symbol */}
              <div>
                <label className="block text-xs font-medium text-txt-secondary mb-1">Write Symbol</label>
                <input
                  type="text"
                  value={writeSymbol}
                  onChange={(e) => setWriteSymbol(e.target.value)}
                  placeholder="e.g. 1, 0, □"
                  className="w-full px-3 py-1.5 text-sm font-mono bg-bg-surface2 border border-border-subtle rounded-lg text-txt-primary focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all"
                />
              </div>

              {/* TM Move Direction */}
              <div>
                <label className="block text-xs font-medium text-txt-secondary mb-1">Tape Head Move</label>
                <div className="flex gap-2">
                  {(['L', 'R', 'S'] as const).map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => setMoveDirection(dir)}
                      className={`flex-1 py-1.5 text-xs font-mono rounded-lg border transition-all ${
                        moveDirection === dir
                          ? 'bg-accent-primary text-white border-accent-primary font-bold'
                          : 'bg-bg-surface2 border-border-subtle text-txt-secondary hover:bg-bg-surface3'
                      }`}
                    >
                      {dir === 'L' ? 'L (Left)' : dir === 'R' ? 'R (Right)' : 'S (Stay)'}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* FA Input Symbol */}
              <div>
                <label className="block text-xs font-medium text-txt-secondary mb-1">
                  Read Symbol / String (Σ)
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="e.g. a, 0, ε, λ, 01"
                  className="w-full px-3 py-2 text-sm font-mono bg-bg-surface2 border border-border-subtle rounded-lg text-txt-primary focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all"
                />
              </div>

              {/* Quick Preset Symbol Chips */}
              <div>
                <label className="block text-[11px] text-txt-muted mb-1.5">Quick Symbols</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_SYMBOLS_FA.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setSymbol(s);
                        inputRef.current?.focus();
                      }}
                      className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-all ${
                        symbol === s
                          ? 'bg-accent-primary text-white border-accent-primary font-bold'
                          : 'bg-bg-surface2 border-border-subtle text-txt-secondary hover:bg-bg-surface3 hover:text-txt-primary'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Rule Preview Bar */}
          <div className="px-3 py-2 bg-bg-surface2 border border-border-subtle rounded-lg text-xs flex items-center justify-between font-mono text-txt-secondary">
            <span className="text-[11px] text-txt-muted">Computed Transition:</span>
            <span className="font-bold text-accent-primary">{previewLabel}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs font-medium text-txt-secondary hover:text-txt-primary hover:bg-bg-surface2 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-medium bg-accent-primary text-white hover:bg-accent-hover rounded-lg shadow-sm flex items-center space-x-1 transition-all"
            >
              <span>Create Transition</span>
              <CornerDownLeft size={12} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

