export const SHARED_PACKAGE_VERSION = '1.0.0';

export interface IBaseEntity {
  readonly id: string;
  readonly createdAt: number;
}

export type AutomatonType = 'FA' | 'DFA' | 'NFA' | 'PDA' | 'TM';

export interface AutomatonMetadata {
  readonly id: string;
  readonly name: string;
  readonly type: AutomatonType;
  readonly description?: string;
  readonly version?: string;
}

/**
 * Formal 5-Tuple specification of a Finite Automaton: M = (Q, Σ, δ, q₀, F)
 */
export interface FiniteAutomaton5Tuple {
  /** Q: Set of state labels or IDs */
  readonly states: ReadonlyArray<string>;
  /** Σ: Derived alphabet symbols */
  readonly alphabet: ReadonlyArray<string>;
  /** q₀: Single initial state label/ID (or null if unassigned) */
  readonly initialState: string | null;
  /** F: Set of accepting/final state labels/IDs */
  readonly acceptingStates: ReadonlyArray<string>;
  /** δ: Transition relation mappings */
  readonly transitions: ReadonlyArray<{
    readonly from: string;
    readonly symbol: string;
    readonly to: string;
  }>;
}

