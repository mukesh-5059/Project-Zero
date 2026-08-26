import React, { useState, useEffect, useRef } from 'react';
import { convertRegexToNFA, RegexToNFAResult } from '@project-zero/core-solver';
import { StateNode, TransitionEdge } from '@project-zero/canvas-renderer';
import { Sparkles, X, ArrowRight, Terminal } from 'lucide-react';

interface RegexModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (nodes: StateNode[], edges: TransitionEdge[], result: RegexToNFAResult, inputRegex: string) => void;
}

export const RegexModal: React.FC<RegexModalProps> = ({ isOpen, onClose, onGenerate }) => {
  const [regex, setRegex] = useState<string>('(a|b)*abb');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = regex.trim();
    const res = convertRegexToNFA(trimmed);

    if (res.success && res.nodes.length > 0) {
      onGenerate([...res.nodes], [...res.edges], res, trimmed);
    } else {
      onGenerate([], [], res, trimmed);
    }
    onClose();
  };

  const insertSymbol = (sym: string) => {
    setRegex((prev) => prev + sym);
    inputRef.current?.focus();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Regex to NFA Conversion Modal"
      className="fixed inset-0 z-50 bg-transparent flex items-start justify-center pt-20 px-4 select-none"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-bg-surface1 border border-border-strong w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 font-sans"
      >
        {/* Header Title Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-bg-surface2/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-accent-primary/15 text-accent-primary rounded-lg border border-accent-primary/20">
              <Terminal size={18} />
            </div>
            <div>
              <h2 className="font-bold text-txt-primary text-sm tracking-tight flex items-center space-x-2">
                <span>RegEx → Thompson ε-NFA Conversion</span>
              </h2>
              <p className="text-[11px] text-txt-muted">
                Construct an equivalent non-deterministic finite automaton from a regular expression
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close RegEx Modal"
            className="p-1.5 text-txt-muted hover:text-txt-primary hover:bg-bg-surface3 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Input Form Body */}
        <form onSubmit={handleGenerate} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-txt-secondary text-xs font-semibold">
              Regular Expression Input:
            </label>
            <div className="flex items-center bg-bg-surface3 border border-border-subtle focus-within:border-accent-primary focus-within:ring-1 focus-within:ring-accent-primary/50 rounded-xl px-3.5 py-2.5 transition-all shadow-inner">
              <span className="font-mono text-accent-primary font-bold text-sm mr-2 select-none">r =</span>
              <input
                ref={inputRef}
                type="text"
                value={regex}
                onChange={(e) => setRegex(e.target.value)}
                placeholder="e.g. (a|b)*abb, a+b?, ε"
                className="w-full bg-transparent text-txt-primary placeholder-txt-muted font-mono font-bold text-sm outline-none"
              />
              {regex && (
                <button
                  type="button"
                  onClick={() => setRegex('')}
                  className="text-txt-muted hover:text-txt-primary text-[11px] font-mono px-1.5 py-0.5 rounded bg-bg-surface2 hover:bg-bg-surface1 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Clickable Quick-Insert Syntax Operators */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-txt-muted">
              <span className="font-semibold text-txt-secondary flex items-center space-x-1">
                <Sparkles size={12} className="text-accent-primary" />
                <span>Quick-Insert Syntax Operators</span>
              </span>
              <span className="text-[11px]">Click operator chip to insert into expression</span>
            </div>

            <div className="grid grid-cols-6 gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={() => insertSymbol('|')}
                className="p-2 rounded-lg bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle text-center transition-all hover:border-accent-primary group cursor-pointer"
              >
                <div className="font-bold text-accent-primary">|</div>
                <div className="text-[9px] text-txt-muted font-sans">Union</div>
              </button>

              <button
                type="button"
                onClick={() => insertSymbol('*')}
                className="p-2 rounded-lg bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle text-center transition-all hover:border-accent-primary group cursor-pointer"
              >
                <div className="font-bold text-accent-primary">*</div>
                <div className="text-[9px] text-txt-muted font-sans">Star (0+)</div>
              </button>

              <button
                type="button"
                onClick={() => insertSymbol('+')}
                className="p-2 rounded-lg bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle text-center transition-all hover:border-accent-primary group cursor-pointer"
              >
                <div className="font-bold text-accent-primary">+</div>
                <div className="text-[9px] text-txt-muted font-sans">Plus (1+)</div>
              </button>

              <button
                type="button"
                onClick={() => insertSymbol('?')}
                className="p-2 rounded-lg bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle text-center transition-all hover:border-accent-primary group cursor-pointer"
              >
                <div className="font-bold text-accent-primary">?</div>
                <div className="text-[9px] text-txt-muted font-sans">Optional</div>
              </button>

              <button
                type="button"
                onClick={() => insertSymbol('()')}
                className="p-2 rounded-lg bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle text-center transition-all hover:border-accent-primary group cursor-pointer"
              >
                <div className="font-bold text-accent-primary">( )</div>
                <div className="text-[9px] text-txt-muted font-sans">Group</div>
              </button>

              <button
                type="button"
                onClick={() => insertSymbol('ε')}
                className="p-2 rounded-lg bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle text-center transition-all hover:border-accent-primary group cursor-pointer"
              >
                <div className="font-bold text-accent-primary">ε</div>
                <div className="text-[9px] text-txt-muted font-sans">Epsilon</div>
              </button>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-border-subtle flex items-center justify-between text-xs">
            <div className="flex items-center space-x-3 text-txt-muted text-[11px] font-mono">
              <span className="flex items-center space-x-1">
                <kbd className="px-1.5 py-0.5 bg-bg-surface3 border border-border-subtle rounded text-[10px]">Esc</kbd>
                <span>Cancel</span>
              </span>
              <span className="flex items-center space-x-1">
                <kbd className="px-1.5 py-0.5 bg-bg-surface3 border border-border-subtle rounded text-[10px]">↵</kbd>
                <span>Construct</span>
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-border-subtle text-txt-secondary hover:text-txt-primary hover:bg-bg-surface2 transition-colors font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-accent-primary hover:bg-accent-hover text-white font-semibold flex items-center space-x-2 transition-all shadow-md text-xs cursor-pointer"
              >
                <span>Construct ε-NFA Graph</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
