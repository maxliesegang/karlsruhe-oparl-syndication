import { config } from './config.js';

/**
 * Print the model ids the configured endpoint currently serves. The provider is
 * the only authority on this list, so it is queried rather than hard-coded: an
 * unknown `LLM_MODEL` is answered with an HTTP 400 by the endpoint itself, and a
 * checked-in whitelist would only block a model the provider has since added.
 */
const response = await fetch(new URL('models', config.llmBaseUrl), {
  headers: {
    Authorization: `Bearer ${config.llmApiKey}`,
    // The endpoint rejects a request without a session id; see AGENTS.md.
    'x-opencode-session': 'karlsruhe-oparl-models',
  },
});
if (!response.ok) {
  throw new Error(`Could not list models: HTTP ${response.status} ${await response.text()}`);
}

const payload = (await response.json()) as { data?: Array<{ id?: string }> };
const modelIds = (payload.data ?? []).map((model) => model.id).filter((id): id is string => !!id);
if (modelIds.length === 0) throw new Error('The endpoint returned no models.');

for (const modelId of modelIds) {
  console.log(modelId === config.llmModel ? `${modelId}  <- LLM_MODEL` : modelId);
}
