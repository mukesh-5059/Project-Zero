/**
 * State Node data interface for Project Zero Canvas Engine.
 * Formally specified in docs/09_Canvas_Engine_Specification.md (Section 7).
 */

export interface StateNode {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly radius?: number;
  readonly isInitial?: boolean;
  readonly isAccepting?: boolean;
  readonly isSelected?: boolean;
  readonly isExecutionHighlighted?: boolean;
  readonly isExecutionAccepting?: boolean;
  readonly isHovered?: boolean;
  readonly isDisabled?: boolean;
  readonly fillColor?: string;
  readonly strokeColor?: string;
  readonly textColor?: string;
}

export const DEFAULT_NODE_RADIUS = 32;
export const DEFAULT_ACCEPTING_RING_OFFSET = 6;
export const DEFAULT_INITIAL_MARKER_SIZE = 16;
export const DEFAULT_HOVER_HALO_WIDTH = 4;
export const DEFAULT_SELECTION_STROKE_WIDTH = 3;

export const DEFAULT_STATE_FILL_COLOR = '#1E293B';
export const DEFAULT_STATE_STROKE_COLOR = '#94A3B8';
export const DEFAULT_STATE_TEXT_COLOR = '#F8FAFC';
export const DEFAULT_ACCENT_COLOR = '#3B82F6';
