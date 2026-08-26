import React, { useEffect, useState, useCallback, useRef } from 'react';
import { LayoutManager } from './LayoutManager';

interface ResizableSplitterProps {
  direction: 'horizontal' | 'vertical';
  invert?: boolean;
  currentSize: number;
  minSize: number;
  maxSize: number;
  defaultSize: number;
  controlsPanelId: string;
  label: string;
  onResize: (newSize: number) => void;
  onReset: () => void;
}

export const ResizableSplitter: React.FC<ResizableSplitterProps> = ({
  direction,
  invert = false,
  currentSize,
  minSize,
  maxSize,
  defaultSize,
  controlsPanelId,
  label,
  onResize,
  onReset,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const lastPosRef = useRef<number>(0);

  const announce = useCallback((text: string) => {
    setAnnouncement(text);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
      if (lastPosRef.current !== 0) {
        const delta = currentPos - lastPosRef.current;
        const effectiveDelta = invert ? -delta : delta;
        const targetSize = currentSize + effectiveDelta;
        const clamped = LayoutManager.clampSize(targetSize, minSize, maxSize);
        onResize(clamped);
      }
      lastPosRef.current = currentPos;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const touch = e.touches[0];
      const currentPos = direction === 'horizontal' ? touch.clientX : touch.clientY;
      if (lastPosRef.current !== 0) {
        const delta = currentPos - lastPosRef.current;
        const effectiveDelta = invert ? -delta : delta;
        const targetSize = currentSize + effectiveDelta;
        const clamped = LayoutManager.clampSize(targetSize, minSize, maxSize);
        onResize(clamped);
      }
      lastPosRef.current = currentPos;
    };

    const handleDragEnd = () => {
      setIsDragging(false);
      lastPosRef.current = 0;
      announce(`${label} resized to ${Math.round(currentSize)} pixels`);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, direction, invert, currentSize, minSize, maxSize, onResize, label, announce]);

  const handleStartDrag = (clientPos: number) => {
    lastPosRef.current = clientPos;
    setIsDragging(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onReset();
      announce(`${label} reset to default size ${defaultSize} pixels`);
      return;
    }

    let nextSize = LayoutManager.calculateKeyboardSize(
      currentSize,
      e.key,
      e.shiftKey,
      { minSize, maxSize, defaultSize, snapThreshold: 0 }
    );

    if (invert && nextSize !== null) {
      const step = e.shiftKey ? 50 : 10;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        nextSize = Math.min(maxSize, currentSize + step);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextSize = Math.max(minSize, currentSize - step);
      }
    }

    if (nextSize !== null) {
      e.preventDefault();
      onResize(nextSize);
      announce(`${label} size set to ${Math.round(nextSize)} pixels`);
    }
  };

  const handleDoubleClick = () => {
    onReset();
    announce(`${label} reset to default size ${defaultSize} pixels`);
  };

  return (
    <>
      {/* Dynamic Screen Reader Announcement Live Region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div
        role="separator"
        tabIndex={0}
        aria-orientation={direction}
        aria-valuenow={Math.round(currentSize)}
        aria-valuemin={minSize}
        aria-valuemax={maxSize}
        aria-controls={controlsPanelId}
        aria-label={label}
        onMouseDown={(e) => handleStartDrag(direction === 'horizontal' ? e.clientX : e.clientY)}
        onTouchStart={(e) => {
          if (e.touches.length > 0) {
            handleStartDrag(direction === 'horizontal' ? e.touches[0].clientX : e.touches[0].clientY);
          }
        }}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        title={`${label} (Double-click to reset to ${defaultSize}px, Arrow keys to resize)`}
        className={`z-20 shrink-0 relative transition-colors outline-none select-none forced-colors:border-[ButtonText] ${
          direction === 'horizontal'
            ? 'w-1.5 cursor-col-resize hover:bg-accent-primary/80 forced-colors:hover:bg-[Highlight] before:absolute before:-inset-x-2 before:top-0 before:bottom-0 before:z-10'
            : 'h-1.5 cursor-row-resize hover:bg-accent-primary/80 forced-colors:hover:bg-[Highlight] before:absolute before:-inset-y-2 before:left-0 before:right-0 before:z-10'
        } ${
          isDragging
            ? 'bg-accent-primary shadow-md forced-colors:bg-[Highlight]'
            : 'bg-border-subtle'
        } focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:bg-accent-primary/90`}
      />
    </>
  );
};
