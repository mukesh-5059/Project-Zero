import { ChatRequest, ChatResponse } from './types';
import { DEFAULT_ROUTED_MODEL, PROJECT_ZERO_GENERAL_ASSISTANT_INSTRUCTION } from './constants';
import { isModelAllowed } from './modelRegistry';
import { validateChatRequest } from './validator';
import { serializeContextForPrompt } from './serializer';
import { extractActionProposal } from './actionValidator';
import { buildTaskProfile } from './modelRouter';

export interface NvidiaProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fetchFn?: typeof fetch;
}

interface NvidiaChoice {
  message?: {
    role?: string;
    content?: string | null;
  };
}

interface NvidiaChatCompletionResponse {
  id?: string;
  choices?: NvidiaChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    type?: string;
    code?: string | number;
  };
}

export class NvidiaProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private fetchFn: typeof fetch;

  constructor(config?: NvidiaProviderConfig) {
    const envApiKey =
      typeof process !== 'undefined' && typeof process.env?.NVIDIA_API_KEY === 'string'
        ? process.env.NVIDIA_API_KEY
        : '';
    this.apiKey = config?.apiKey !== undefined ? config.apiKey : envApiKey;
    this.baseUrl = config?.baseUrl || 'https://integrate.api.nvidia.com/v1';
    this.model = config?.model || DEFAULT_ROUTED_MODEL;
    this.fetchFn = config?.fetchFn || (typeof fetch !== 'undefined' ? fetch : (globalThis.fetch as typeof fetch));

    if (!isModelAllowed(this.model)) {
      throw new Error(`Model "${this.model}" is not authorized or enabled in Project Zero model registry.`);
    }
  }

  public getModel(): string {
    return this.model;
  }

  public async chat(rawRequest: unknown, signal?: AbortSignal): Promise<ChatResponse> {
    // 1. Validate request
    validateChatRequest(rawRequest);
    const request: ChatRequest = rawRequest;

    // 2. Validate API key presence
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new Error('NVIDIA_API_KEY is not configured on the gateway server.');
    }

    // 3. Prepare payload with General Assistant system instruction and sanitized application context
    const profile = buildTaskProfile(request);
    let systemInstruction = PROJECT_ZERO_GENERAL_ASSISTANT_INSTRUCTION;
    let contextMessageContent: string | null = null;

    let actionDirective = '';
    if (profile.requiresStructuredActions) {
      actionDirective = '\n\n=== MANDATORY ACTION-FIRST DIRECTIVE ===\nThe user is requesting automaton construction, modification, or repair.\n1. You MUST output the ```json:project-zero-actions envelope FIRST.\n2. Do NOT write step-by-step reasoning or monologue before the JSON block.\n3. Put any educational notes, suffix explanations, or state roles strictly AFTER the action block.\n========================================';
    }

    if (request.context) {
      const contextStr = serializeContextForPrompt(request.context);
      const combined = `${PROJECT_ZERO_GENERAL_ASSISTANT_INSTRUCTION}${actionDirective}\n\n=== CURRENT USER WORKSPACE & MACHINE CONTEXT ===\n${contextStr}\n================================================`;
      if (combined.length <= 4000) {
        systemInstruction = combined;
      } else {
        // If combined exceeds 4000 chars, split into dedicated system messages (each <= 4000)
        systemInstruction = `${PROJECT_ZERO_GENERAL_ASSISTANT_INSTRUCTION}${actionDirective}`;
        contextMessageContent = `=== CURRENT USER WORKSPACE & MACHINE CONTEXT ===\n${contextStr}\n================================================`;
      }
    } else if (actionDirective) {
      systemInstruction = `${PROJECT_ZERO_GENERAL_ASSISTANT_INSTRUCTION}${actionDirective}`;
    }

    const upstreamMessages: { role: string; content: string }[] = [
      { role: 'system', content: systemInstruction.length > 4000 ? systemInstruction.slice(0, 4000) : systemInstruction },
    ];

    if (contextMessageContent) {
      upstreamMessages.push({
        role: 'system',
        content: contextMessageContent.length > 4000 ? contextMessageContent.slice(0, 4000) : contextMessageContent,
      });
    }

    // Add conversation history with deterministic bounding:
    // - The active user query (last turn) is preserved exactly
    // - Prior history messages are bounded to <= 4000 characters
    const turns = request.messages;
    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      const isLatest = i === turns.length - 1;
      let content = turn.content;

      if (!isLatest && content.length > 4000) {
        content = content.slice(0, 3800) + '\n... [History truncated for context]';
      }

      if (isLatest && profile.requiresStructuredActions) {
        const actionPromptSuffix = '\n\n[MANDATORY FORMAT: Begin your response directly with the structured JSON block:\n```json:project-zero-actions\n{\n  "version": "1.0.0",\n  "summary": "Brief summary of construction/modifications",\n  "actions": [\n    ...\n  ]\n}\n```\nFollowed by your concise educational explanation of states and suffixes.]';
        if (content.length + actionPromptSuffix.length <= 4000) {
          content = `${content}${actionPromptSuffix}`;
        }
      }

      upstreamMessages.push({
        role: turn.role,
        content,
      });
    }

    // Safety Invariant: Every outbound message sent to NVIDIA MUST remain <= 4000 characters
    for (let idx = 0; idx < upstreamMessages.length; idx++) {
      if (upstreamMessages[idx].content.length > 4000) {
        upstreamMessages[idx].content = upstreamMessages[idx].content.slice(0, 4000);
      }
    }

    const body = {
      model: this.model,
      messages: upstreamMessages,
      max_tokens: request.maxTokens ?? 8192,
      temperature: request.temperature ?? 0.1,
    };


    // 4. Dispatch request
    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      throw new Error(`Network/gateway connectivity error: ${(err as Error).message}`);
    }

    if (!response.ok) {
      let errorDetail = `Status ${response.status}`;
      try {
        const errorJson = (await response.json()) as NvidiaChatCompletionResponse | null;
        if (errorJson?.error?.message) {
          errorDetail = errorJson.error.message;
        }
      } catch {
        // Use status code description
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error('NVIDIA authorization failed. Please check server gateway API credentials.');
      } else if (response.status === 429) {
        throw new Error('NVIDIA rate limit reached. Please wait a moment before trying again.');
      } else {
        throw new Error(`NVIDIA upstream inference error: ${errorDetail}`);
      }
    }

    // 5. Parse response
    const json = (await response.json()) as NvidiaChatCompletionResponse;
    const choice = json.choices?.[0];
    if (!choice || !choice.message || typeof choice.message.content !== 'string') {
      throw new Error('Malformed response received from NVIDIA inference endpoint.');
    }

    const rawContent = choice.message.content.trim();
    const { cleanedText, actionProposal } = extractActionProposal(rawContent);

    return {
      id: json.id || `response-${Date.now()}`,
      model: this.model,
      message: {
        role: 'assistant',
        content: cleanedText,
      },
      actionProposal,
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            totalTokens: json.usage.total_tokens,
          }
        : undefined,
    };
  }
}
