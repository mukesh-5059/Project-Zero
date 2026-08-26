import React from 'react';

interface ToolbarGroupProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export const ToolbarGroup: React.FC<ToolbarGroupProps> = ({ label, children, className = '' }) => {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex items-center space-x-1 bg-bg-surface2/60 p-0.5 rounded-lg border border-border-subtle ${className}`}
    >
      {children}
    </div>
  );
};
