import React, { useState } from 'react';
import { IToolbarItem } from './types';

export const ToolbarButton: React.FC<{ item: IToolbarItem; className?: string }> = ({ item, className = '' }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const Icon = item.icon;

  return (
    <div className={`relative flex items-center ${className}`}>
      <button
        type="button"
        role="button"
        disabled={item.isDisabled}
        aria-pressed={item.isActive}
        aria-label={`${item.label}${item.shortcut ? ` (${item.shortcut})` : ''}`}
        aria-keyshortcuts={item.shortcut}
        onClick={item.onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className={`w-full relative flex items-center justify-center space-x-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all outline-none select-none ${
          item.isDisabled
            ? 'opacity-40 cursor-not-allowed text-txt-muted bg-transparent'
            : item.isActive
              ? 'bg-accent-primary text-white shadow-sm ring-1 ring-accent-hover'
              : 'text-txt-secondary hover:text-txt-primary hover:bg-bg-surface3 active:bg-bg-surface2'
        } focus-visible:ring-2 focus-visible:ring-border-focus`}
      >
        <Icon size={14} className="shrink-0" />
        <span className="truncate">{item.label}</span>

        {item.shortcut && (
          <kbd
            className={`px-1 py-0.2 text-[9px] font-mono rounded shrink-0 transition-colors ${
              item.isActive
                ? 'bg-white/20 text-white border border-white/30'
                : 'bg-bg-base text-txt-muted border border-border-subtle'
            }`}
          >
            {item.shortcut}
          </kbd>
        )}
      </button>

      {/* Hover/Focus Floating Tooltip Overlay */}
      {showTooltip && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-bg-surface3 text-txt-primary text-[11px] font-mono rounded shadow-lg border border-border-strong whitespace-nowrap z-50 animate-in fade-in zoom-in-95 duration-75 pointer-events-none"
        >
          {item.tooltip}
          {item.shortcut && <span className="text-accent-primary font-bold ml-1.5">[{item.shortcut}]</span>}
        </div>
      )}
    </div>
  );
};
