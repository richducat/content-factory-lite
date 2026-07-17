/**
 * lib/openai.mjs — minimal, zero-dependency OpenAI Chat Completions client.
 *
 * Uses the built-in fetch (Node 18+), so `npm install` has nothing to do.
 * Only implements the one call this project needs: a JSON-mode chat
 * completion with basic retry on transient failures.
 */

const API_URL = 'https://api.openai.com/v1/chat/completions'
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

/**
 * Read the API key from the environment and fail with a helpful message
 * (not a stack trace) when it is missing.
 */
export function requireApiKey(env = process.env) {
  const key = (env.OPENAI_API_KEY || '').trim()
  if (!key) {
    throw new FriendlyError(
      [
        'OPENAI_API_KEY is not set.',
        '',
        'Fix (pick one):',
        '  1. cp .env.example .env   and paste your key into .env',
        '  2. export OPENAI_API_KEY=sk-...   in your shell',
        '',
        'Get a key at https://platform.openai.com/api-keys',
        'To preview the prompt without an API call, run with --dry-run.',
      ].join('\n'),
    )
  }
  return key
}

/** Error type whose message is meant for humans — printed without a stack. */
export class FriendlyError extends Error {}

/**
 * Call the Chat Completions API in JSON mode and return the parsed object.
 *
 * @param {object} params
 * @param {string} params.apiKey
 * @param {string} params.model    e.g. "gpt-4o-mini"
 * @param {string} params.system   system prompt
 * @param {string} params.user     user prompt
 * @param {number} [params.maxRetries=2]
 * @returns {Promise<object>} the model's JSON response, parsed
 */
export async function chatJson({ apiKey, model, system, user, maxRetries = 2 }) {
  const body = JSON.stringify({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  })

  let lastError
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (attempt > 0) {
      // Simple exponential backoff: 2s, 4s.
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
    }

    let response
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body,
      })
    } catch (error) {
      lastError = new FriendlyError(`Network error calling OpenAI: ${error.message}`)
      continue
    }

    if (!response.ok) {
      const detail = await safeErrorDetail(response)
      if (response.status === 401) {
        throw new FriendlyError(
          'OpenAI rejected the API key (401). Check OPENAI_API_KEY in your .env.',
        )
      }
      if (RETRYABLE_STATUS.has(response.status)) {
        lastError = new FriendlyError(`OpenAI returned ${response.status}: ${detail}`)
        continue
      }
      throw new FriendlyError(`OpenAI returned ${response.status}: ${detail}`)
    }

    const payload = await response.json()
    const content = payload?.choices?.[0]?.message?.content
    if (!content) {
      throw new FriendlyError('OpenAI response had no message content.')
    }

    try {
      return JSON.parse(content)
    } catch {
      throw new FriendlyError(
        'Model returned invalid JSON. Re-run, or try a different OPENAI_MODEL.',
      )
    }
  }

  throw lastError || new FriendlyError('OpenAI request failed after retries.')
}

async function safeErrorDetail(response) {
  try {
    const data = await response.json()
    return data?.error?.message || JSON.stringify(data).slice(0, 300)
  } catch {
    return response.statusText || 'no detail'
  }
}
