import { RegisteredModel } from './types';

export const REGISTERED_MODELS: Record<string, RegisteredModel> = {
  'nvidia/nemotron-3-super-120b-a12b': {
    id: 'nvidia/nemotron-3-super-120b-a12b',
    displayName: 'Nemotron-3 Super 120B',
    enabled: true,
    role: 'primary_fast_capable',
    latencyClass: 'ULTRA_FAST',
    observedLatencyMs: 378,
    priority: 100,
    reliabilityScore: 5,
    capabilities: {
      generalChat: true,
      education: true,
      reasoning: true,
      coding: true,
      structuredActions: true,
      graphConstruction: true,
      graphEditing: true,
      graphUnderstanding: true,
      multimodal: false,
    },
    description: 'High performance 120B model with sub-second latency and strong graph/structured action capabilities.',
  },

  'nvidia/nemotron-3.5-lightning-30b-a3b': {
    id: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    displayName: 'Nemotron-3.5 Lightning 30B',
    enabled: true,
    role: 'fast_general',
    latencyClass: 'ULTRA_FAST',
    observedLatencyMs: 946,
    priority: 80,
    reliabilityScore: 5,
    capabilities: {
      generalChat: true,
      education: true,
      reasoning: true,
      coding: true,
      structuredActions: true,
      graphConstruction: true,
      graphEditing: true,
      graphUnderstanding: true,
      multimodal: false,
    },
    description: 'Very fast 30B model suited for general educational chat and standard graph manipulations.',
  },

  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning': {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    displayName: 'Nemotron-3 Nano Omni 30B Reasoning',
    enabled: true,
    role: 'fast_reasoning',
    latencyClass: 'FAST',
    observedLatencyMs: 1244,
    priority: 70,
    reliabilityScore: 4,
    capabilities: {
      generalChat: true,
      education: true,
      reasoning: true,
      coding: true,
      structuredActions: true,
      graphConstruction: true,
      graphEditing: true,
      graphUnderstanding: true,
      multimodal: true,
    },
    description: 'Specialized 30B reasoning and multimodal model with low latency for deep step-by-step explanations.',
  },

  'google/gemma-4-31b-it': {
    id: 'google/gemma-4-31b-it',
    displayName: 'Gemma 4 31B IT',
    enabled: true,
    role: 'secondary_reasoning',
    latencyClass: 'SLOW',
    observedLatencyMs: 19300,
    priority: 40,
    reliabilityScore: 3,
    capabilities: {
      generalChat: true,
      education: true,
      reasoning: true,
      coding: true,
      structuredActions: true,
      graphConstruction: false,
      graphEditing: false,
      graphUnderstanding: true,
      multimodal: false,
    },
    description: 'Google Gemma 31B instruction-tuned model for deep conceptual discourse and mathematical explanation.',
  },

  'nvidia/nemotron-3-ultra-550b-a55b': {
    id: 'nvidia/nemotron-3-ultra-550b-a55b',
    displayName: 'Nemotron-3 Ultra 550B',
    enabled: true,
    role: 'heavy_reasoning_reference',
    latencyClass: 'VERY_SLOW',
    observedLatencyMs: 46000,
    priority: 50,
    reliabilityScore: 4,
    capabilities: {
      generalChat: true,
      education: true,
      reasoning: true,
      coding: true,
      structuredActions: true,
      graphConstruction: true,
      graphEditing: true,
      graphUnderstanding: true,
      multimodal: false,
    },
    description: 'Authoritative 550B flagship model for heavy mathematical proofs, complex Turing machine verification, and deep formal reasoning.',
  },
};

export const MODEL_REGISTRY: RegisteredModel[] = Object.values(REGISTERED_MODELS);

export function getRegisteredModel(modelId: string): RegisteredModel | undefined {
  return REGISTERED_MODELS[modelId];
}

export function isModelAllowed(modelId: string): boolean {
  const model = REGISTERED_MODELS[modelId];
  return Boolean(model && model.enabled);
}

export function getEnabledModels(): RegisteredModel[] {
  return MODEL_REGISTRY.filter((m) => m.enabled);
}
