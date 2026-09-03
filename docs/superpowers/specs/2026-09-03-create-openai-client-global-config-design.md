# Agent-Scoped OpenAI Client with Global Model Config Design

## Problem

`Agent` creates a private `ModelConfigManager` whenever either `modelConfig` or
`createOpenAIClient` is supplied. A private manager created for
`createOpenAIClient` alone has no `GlobalConfigManager`, so it initializes from
an empty configuration map and throws that `MIDSCENE_MODEL_NAME` is missing.

This prevents callers from adding an observability wrapper such as Langfuse or
LangSmith while continuing to configure the model through environment variables.

## Goals

- Let an agent configured with only `createOpenAIClient` use the same global
  model configuration as an agent with no custom options.
- Keep `createOpenAIClient` scoped to the agent that supplied it.
- Preserve the existing isolated behavior when an explicit `modelConfig` is
  supplied.
- Preserve intent-specific configuration and fallback behavior.
- Add regression coverage without making real model calls.

## Non-Goals

- Changing the public `AgentOpt` API.
- Changing `ModelConfigManager` or `GlobalConfigManager`.
- Adding new model configuration precedence rules.
- Refactoring OpenAI client creation or observability integrations.

## Selected Design

Only an explicit `modelConfig` requires a private `ModelConfigManager`.
`createOpenAIClient` alone does not define model values, so that agent continues
to use `globalModelConfigManager`.

`Agent.resolveModelRuntime()` obtains the current model configuration from the
selected manager, creates an agent-scoped copy, and sets
`createOpenAIClient` from `AgentOpt` before calling `getModelRuntime()`.

The resulting behavior is:

| Agent options | Model values | Client factory |
| --- | --- | --- |
| none | global configuration | none |
| `createOpenAIClient` only | global configuration | agent-scoped factory |
| `modelConfig` only | isolated explicit configuration | none |
| `modelConfig` and `createOpenAIClient` | isolated explicit configuration | agent-scoped factory |

The global model configuration object is never mutated, so two agents can use
different factories without affecting each other.

## Rejected Alternatives

### Register the global manager on a private manager

This fixes initial environment loading, but the private manager has its own
initialized cache and is not invalidated by `overrideAIConfig()`. Its behavior
would therefore differ from the normal global path.

### Store the factory on the global manager

This would make an agent-specific callback global mutable state. Constructing a
second agent could replace the first agent's wrapper.

### Add multi-manager invalidation

Allowing `GlobalConfigManager` to track every private manager could preserve
dynamic invalidation, but it expands shared configuration infrastructure and
lifecycle management for a bug that can be fixed inside `Agent`.

## Error Handling

Existing model validation remains unchanged. If the inherited global
configuration is incomplete, the existing `MIDSCENE_MODEL_NAME` error remains
correct. Exceptions raised by `createOpenAIClient` continue to propagate from
the existing service-caller path.

## Testing

Add focused tests to
`packages/core/tests/unit-test/agent-custom-model.test.ts`:

1. Configure global model values, construct an agent with only
   `createOpenAIClient`, and verify runtime resolution succeeds with the global
   model name and the supplied factory.
2. Construct two agents with different factories and verify each runtime keeps
   its own factory.
3. Keep the existing explicit `modelConfig + createOpenAIClient` tests green to
   prove isolated configuration behavior is unchanged.

The regression test must fail before the production change with the current
missing-model error. Tests restore environment variables and clear the global
model manager cache to avoid cross-test pollution.

## Expected Change Set

- Modify `packages/core/src/agent/agent.ts`.
- Modify `packages/core/tests/unit-test/agent-custom-model.test.ts`.
- Do not include this design document in the implementation PR.
