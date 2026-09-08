import { NvidiaProvider, NvidiaProviderConfig } from './provider';
import { ChatRequest, ChatResponse, GatewayErrorResponse } from './types';
import { RequestValidationError, validateChatRequest } from './validator';
import { selectModel } from './modelRouter';

export interface HandleChatOptions {
  providerConfig?: NvidiaProviderConfig;
  signal?: AbortSignal;
}

export async function handleChatRequest(
  requestBody: unknown,
  options?: HandleChatOptions
): Promise<{ status: number; body: ChatResponse | GatewayErrorResponse }> {
  try {
    // 1. Validate incoming request
    validateChatRequest(requestBody);
    const request = requestBody as ChatRequest;

    // 2. Deterministic server-side model selection
    // Note: Provider config can specify a model for testing, but client cannot dictate it.
    const routingDecision = selectModel(request);
    const primaryModelId = options?.providerConfig?.model || routingDecision.selectedModel;

    const provider = new NvidiaProvider({
      ...options?.providerConfig,
      model: primaryModelId,
    });

    let result: ChatResponse;
    let fallbackUsed = false;

    try {
      result = await provider.chat(request, options?.signal);
    } catch (primaryErr: unknown) {
      const err = primaryErr as Error;

      // Check if fallback is eligible (only for transient upstream / network errors, not validation or auth errors)
      const isAuthError = err.message?.includes('NVIDIA_API_KEY') || err.message?.includes('authorization failed');
      const isValidationError = err instanceof RequestValidationError;
      const isAborted = err.name === 'AbortError';

      if (!isAuthError && !isValidationError && !isAborted && routingDecision.fallbackModel && !options?.providerConfig?.model) {
        // Fallback attempt: exactly ONE fallback attempt with next best eligible candidate
        fallbackUsed = true;
        const fallbackModelId = routingDecision.fallbackModel;
        
        if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test') {
          console.warn(`[AI Router Fallback] Primary model "${primaryModelId}" failed (${err.message}). Attempting fallback to "${fallbackModelId}".`);
        }

        const fallbackProvider = new NvidiaProvider({
          ...options?.providerConfig,
          model: fallbackModelId,
        });

        result = await fallbackProvider.chat(request, options?.signal);
      } else {
        throw primaryErr;
      }
    }

    // Attach safe telemetry (no secrets)
    result.routingInfo = {
      selectedModel: result.model,
      taskCategory: routingDecision.taskProfile.category,
      reason: routingDecision.routingReason,
      fallbackUsed,
    };

    return {
      status: 200,
      body: result,
    };
  } catch (err: unknown) {
    const error = err as Error;

    if (error instanceof RequestValidationError) {
      return {
        status: 400,
        body: {
          error: {
            message: error.message,
            type: 'validation_error',
            statusCode: 400,
          },
        },
      };
    }

    if (
      error.message?.includes('NVIDIA_API_KEY is not configured') ||
      error.message?.includes('is not authorized or enabled in Project Zero model registry')
    ) {
      return {
        status: 500,
        body: {
          error: {
            message: error.message,
            type: 'config_error',
            statusCode: 500,
          },
        },
      };
    }

    return {
      status: 502,
      body: {
        error: {
          message: error.message || 'An upstream error occurred while processing the AI request.',
          type: 'upstream_error',
          statusCode: 502,
        },
      },
    };
  }
}
