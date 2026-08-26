import React from 'react';
import { ResizableSplitter } from './docking/ResizableSplitter';

interface ResizableDividerProps {
  direction: 'horizontal' | 'vertical';
  invert?: boolean;
  currentSize?: number;
  minSize?: number;
  maxSize?: number;
  defaultSize?: number;
  controlsPanelId?: string;
  label?: string;
  onResize: (deltaOrSize: number) => void;
  onReset?: () => void;
}

export const ResizableDivider: React.FC<ResizableDividerProps> = ({
  direction,
  invert = false,
  currentSize = 250,
  minSize = 150,
  maxSize = 500,
  defaultSize = 250,
  controlsPanelId = 'workspace-panel',
  label = 'Resize Panel Splitter',
  onResize,
  onReset,
}) => {
  return (
    <ResizableSplitter
      direction={direction}
      invert={invert}
      currentSize={currentSize}
      minSize={minSize}
      maxSize={maxSize}
      defaultSize={defaultSize}
      controlsPanelId={controlsPanelId}
      label={label}
      onResize={onResize}
      onReset={onReset || (() => onResize(defaultSize))}
    />
  );
};
