# Agent-Scoped OpenAI Client with Global Model Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow an `Agent` configured only with `createOpenAIClient` to inherit global model configuration while keeping the client factory isolated to that agent.

**Architecture:** Only an explicit `modelConfig` creates a private `ModelConfigManager`; factory-only agents continue to use `globalModelConfigManager`. Runtime resolution copies the selected model configuration, injects the current agent's `createOpenAIClient`, and passes that agent-scoped copy to `getModelRuntime()` without mutating global state.

**Tech Stack:** TypeScript, `@midscene/core`, `@midscene/shared`, Rstest, pnpm 9.3.0, Node.js 20

---

## File Map

- Modify `packages/core/tests/unit-test/agent-custom-model.test.ts`: add the factory-only global configuration regression test, add two-agent factory isolation coverage, and reset global configuration between tests.
- Modify `packages/core/src/agent/agent.ts`: select a private model manager only for explicit `modelConfig`, then inject the agent factory into a copied runtime configuration.
- Do not modify `packages/shared/src/env/model-config-manager.ts`, `packages/shared/src/env/global-config-manager.ts`, public types, or package metadata.
- Do not include `docs/superpowers/specs/2026-09-03-create-openai-client-global-config-design.md` or this plan in the implementation branch or pull request.

## Command Convention

Run every pnpm command with the repository-supported Node.js and Corepack:

```bash
PATH="/Users/bytedance/.local/lib/nodejs/node-v20.20.2-darwin-arm64/bin:$PATH" corepack pnpm <command>
```

The implementation worktree used below is `../midscene-3079`, and all commands after Task 1 run from that worktree root.

### Task 1: Create an Isolated Implementation Worktree

**Files:**
- Reference only: `docs/superpowers/specs/2026-09-03-create-openai-client-global-config-design.md`
- No implementation files changed

- [ ] **Step 1: Refresh the upstream baseline**

Run:

```bash
git fetch origin main
git status --short --branch
```

Expected: fetch succeeds; the current design branch may be ahead of `origin/main` only by internal documentation commits and has no uncommitted changes.

- [ ] **Step 2: Create the implementation worktree from latest `origin/main`**

Run:

```bash
git worktree add ../midscene-3079 -b fix/create-openai-client-global-config origin/main
```

Expected: Git creates `../midscene-3079` on `fix/create-openai-client-global-config`, based directly on the latest `origin/main`; neither internal document is present in the branch diff.

- [ ] **Step 3: Verify branch scope**

Run from `../midscene-3079`:

```bash
git status --short --branch
git log -1 --oneline
git diff --name-only origin/main...HEAD
```

Expected: clean branch, HEAD equals the fetched `origin/main`, and the final command prints no files.

- [ ] **Step 4: Install the locked dependency graph**

Run from `../midscene-3079`:

```bash
PATH="/Users/bytedance/.local/lib/nodejs/node-v20.20.2-darwin-arm64/bin:$PATH" corepack pnpm install --frozen-lockfile
```

Expected: installation succeeds without changing `pnpm-lock.yaml` or any tracked file.

- [ ] **Step 5: Establish the focused-test baseline**

Run from `../midscene-3079`:

```bash
PATH="/Users/bytedance/.local/lib/nodejs/node-v20.20.2-darwin-arm64/bin:$PATH" corepack pnpm --filter @midscene/core test -- tests/unit-test/agent-custom-model.test.ts
```

Expected: all existing tests in `agent-custom-model.test.ts` pass before adding the regression.

### Task 2: Add the Factory-Only Global Configuration Red Test

**Files:**
- Modify: `packages/core/tests/unit-test/agent-custom-model.test.ts`
- Test: `packages/core/tests/unit-test/agent-custom-model.test.ts`

- [ ] **Step 1: Import the global override helper**

Extend the existing `@midscene/shared/env` import with `overrideAIConfig`:

```ts
import type { CreateOpenAIClientFn } from '@midscene/shared/env';
import {
  MIDSCENE_INSIGHT_MODEL_API_KEY,
  MIDSCENE_INSIGHT_MODEL_BASE_URL,
  MIDSCENE_INSIGHT_MODEL_NAME,
  MIDSCENE_MODEL_API_KEY,
  MIDSCENE_MODEL_BASE_URL,
  MIDSCENE_MODEL_FAMILY,
  MIDSCENE_MODEL_NAME,
  MIDSCENE_PLANNING_MODEL_API_KEY,
  MIDSCENE_PLANNING_MODEL_BASE_URL,
  MIDSCENE_PLANNING_MODEL_NAME,
  overrideAIConfig,
} from '@midscene/shared/env';
```

- [ ] **Step 2: Reset global model state around each test**

Update the existing hooks so each test starts with the known global model values and ends with an empty override. `overrideAIConfig()` invalidates `globalModelConfigManager`, so no cached configuration leaks across tests:

```ts
beforeEach(() => {
  rs.mock('openai');
  overrideAIConfig(defaultModelConfig);
});

afterEach(() => {
  overrideAIConfig({});
  rs.clearAllMocks();
});
```

- [ ] **Step 3: Add the factory-only regression test**

Add this test at the start of `describe('constructor with createOpenAIClient', ...)`:

```ts
it('should combine global model config with an agent-scoped createOpenAIClient', () => {
  const mockCreateClient: CreateOpenAIClientFn = rs.fn(async () => ({
    chat: { completions: { create: rs.fn() } },
  }));
  const agent = new Agent(createMockInterface(), {
    createOpenAIClient: mockCreateClient,
  });

  const runtime = (agent as any).resolveModelRuntime('default');

  expect(runtime.config.modelName).toBe(
    defaultModelConfig[MIDSCENE_MODEL_NAME],
  );
  expect(runtime.config.openaiApiKey).toBe(
    defaultModelConfig[MIDSCENE_MODEL_API_KEY],
  );
  expect(runtime.config.openaiBaseURL).toBe(
    defaultModelConfig[MIDSCENE_MODEL_BASE_URL],
  );
  expect(runtime.config.createOpenAIClient).toBe(mockCreateClient);
  expect(mockCreateClient).not.toHaveBeenCalled();
});
```

This calls the private resolver through a test-only type escape because constructor success alone does not initialize the model manager and would not reproduce the bug.

- [ ] **Step 4: Run the new test and observe the intended red state**

Run:

```bash
PATH="/Users/bytedance/.local/lib/nodejs/node-v20.20.2-darwin-arm64/bin:$PATH" corepack pnpm --filter @midscene/core test -- tests/unit-test/agent-custom-model.test.ts -t "should combine global model config with an agent-scoped createOpenAIClient"
```

Expected: FAIL while resolving the runtime with:

```text
Model configuration is incomplete: model name (MIDSCENE_MODEL_NAME) is required.
```

The test must not fail because of an import error, an assertion typo, or an actual network/model request.

- [ ] **Step 5: Re-run the complete focused file to check test isolation**

Run:

```bash
PATH="/Users/bytedance/.local/lib/nodejs/node-v20.20.2-darwin-arm64/bin:$PATH" corepack pnpm --filter @midscene/core test -- tests/unit-test/agent-custom-model.test.ts
```

Expected: exactly the new factory-only regression fails for the missing model name; pre-existing explicit `modelConfig` tests remain green.

- [ ] **Step 6: Commit the red test separately**

Run:

```bash
git add packages/core/tests/unit-test/agent-custom-model.test.ts
git commit -m "test(core): cover custom client with global model config"
```

Expected: commit contains only the regression test and deterministic global-state setup. Record in implementation notes that this commit is intentionally red until the next commit.

### Task 3: Implement the Minimal Agent-Scoped Runtime Fix

**Files:**
- Modify: `packages/core/src/agent/agent.ts`
- Test: `packages/core/tests/unit-test/agent-custom-model.test.ts`

- [ ] **Step 1: Restrict private manager creation to explicit model config**

Replace the constructor's custom-manager selection:

```ts
// Explicit modelConfig is isolated from global configuration.
// A custom client factory alone still uses the global model values.
this.modelConfigManager = opts?.modelConfig
  ? new ModelConfigManager(opts.modelConfig, opts.createOpenAIClient)
  : globalModelConfigManager;
```

Do not register a new manager with `globalConfigManager`, and do not store the factory on `globalModelConfigManager`.

- [ ] **Step 2: Build an agent-scoped configuration during runtime resolution**

Replace the start of `resolveModelRuntime()` with:

```ts
private resolveModelRuntime(intent: TIntent): ModelRuntime {
  const modelConfig: IModelConfig = {
    ...this.modelConfigManager.getModelConfig(intent),
    createOpenAIClient: this.opts.createOpenAIClient,
  };
  const runtime = getModelRuntime(modelConfig);
  return {
    ...runtime,
    onUsage: (usage) => {
```

Keep the existing `onUsage` callback body unchanged. The object spread is required: assigning directly to the manager-returned object would mutate cached global configuration and leak one agent's factory into another.

- [ ] **Step 3: Run the previously failing test**

Run:

```bash
PATH="/Users/bytedance/.local/lib/nodejs/node-v20.20.2-darwin-arm64/bin:$PATH" corepack pnpm --filter @midscene/core test -- tests/unit-test/agent-custom-model.test.ts -t "should combine global model config with an agent-scoped createOpenAIClient"
```

Expected: PASS. The runtime contains global model name, API key, and base URL plus the supplied agent factory; the factory itself is not called.

- [ ] **Step 4: Run the entire focused test file**

Run:

```bash
PATH="/Users/bytedance/.local/lib/nodejs/node-v20.20.2-darwin-arm64/bin:$PATH" corepack pnpm --filter @midscene/core test -- tests/unit-test/agent-custom-model.test.ts
```

Expected: PASS. Existing `modelConfig + createOpenAIClient`, intent fallback, observability wrapper, and backward-compatibility cases remain green.

- [ ] **Step 5: Inspect the production diff for scope**

Run:

```bash
git diff -- packages/core/src/agent/agent.ts
```

Expected: only manager selection and agent-scoped runtime configuration changed; there is no public API, shared manager, or configuration-precedence change.

- [ ] **Step 6: Commit the minimal production fix**

Run:

```bash
git add packages/core/src/agent/agent.ts
git commit -m "fix(core): preserve global config for custom clients"
```

Expected: this commit turns the preceding red regression green and contains no test or documentation changes.

### Task 4: Prove Factory Isolation Across Agents

**Files:**
- Modify: `packages/core/tests/unit-test/agent-custom-model.test.ts`
- Test: `packages/core/tests/unit-test/agent-custom-model.test.ts`

- [ ] **Step 1: Add the two-agent isolation test**

Add this test after the factory-only global configuration test:

```ts
it('should isolate createOpenAIClient between agents sharing global config', () => {
  const firstCreateClient: CreateOpenAIClientFn = rs.fn(async () => ({
    chat: { completions: { create: rs.fn() } },
  }));
  const secondCreateClient: CreateOpenAIClientFn = rs.fn(async () => ({
    chat: { completions: { create: rs.fn() } },
  }));
  const firstAgent = new Agent(createMockInterface(), {
    createOpenAIClient: firstCreateClient,
  });
  const secondAgent = new Agent(createMockInterface(), {
    createOpenAIClient: secondCreateClient,
  });

  const firstRuntime = (firstAgent as any).resolveModelRuntime('default');
  const secondRuntime = (secondAgent as any).resolveModelRuntime('default');
  const firstRuntimeAgain = (firstAgent as any).resolveModelRuntime('default');

  expect(firstRuntime.config.modelName).toBe(
    defaultModelConfig[MIDSCENE_MODEL_NAME],
  );
  expect(secondRuntime.config.modelName).toBe(
    defaultModelConfig[MIDSCENE_MODEL_NAME],
  );
  expect(firstRuntime.config).not.toBe(secondRuntime.config);
  expect(firstRuntime.config.createOpenAIClient).toBe(firstCreateClient);
  expect(secondRuntime.config.createOpenAIClient).toBe(secondCreateClient);
  expect(firstRuntimeAgain.config.createOpenAIClient).toBe(firstCreateClient);
});
```

The third resolution proves that resolving the second agent did not overwrite factory state used by the first.

- [ ] **Step 2: Run only the isolation test**

Run:

```bash
PATH="/Users/bytedance/.local/lib/nodejs/node-v20.20.2-darwin-arm64/bin:$PATH" corepack pnpm --filter @midscene/core test -- tests/unit-test/agent-custom-model.test.ts -t "should isolate createOpenAIClient between agents sharing global config"
```

Expected: PASS, with both agents sharing the same global model values but receiving distinct runtime config objects and their own factory references.

- [ ] **Step 3: Run all custom-model tests**

Run:

```bash
PATH="/Users/bytedance/.local/lib/nodejs/node-v20.20.2-darwin-arm64/bin:$PATH" corepack pnpm --filter @midscene/core test -- tests/unit-test/agent-custom-model.test.ts
```

Expected: PASS with no network calls and no state-dependent failures.

- [ ] **Step 4: Commit the isolation regression**

Run:

```bash
git add packages/core/tests/unit-test/agent-custom-model.test.ts
git commit -m "test(core): verify custom client isolation"
```

Expected: commit contains only the two-agent isolation test.

### Task 5: Run Core and Repository Quality Gates

**Files:**
- Verify: `packages/core/src/agent/agent.ts`
- Verify: `packages/core/tests/unit-test/agent-custom-model.test.ts`

- [ ] **Step 1: Run the complete `@midscene/core` test suite**

Run:

```bash
PATH="/Users/bytedance/.local/lib/nodejs/node-v20.20.2-darwin-arm64/bin:$PATH" corepack pnpm --filter @midscene/core test
```

Expected: PASS. Any AI tests that require external credentials must not be invoked by this non-AI test target.

- [ ] **Step 2: Build `@midscene/core` and its workspace dependencies**

Run:

```bash
PATH="/Users/bytedance/.local/lib/nodejs/node-v20.20.2-darwin-arm64/bin:$PATH" corepack pnpm --filter @midscene/core... build
```

Expected: PASS with generated package output and no TypeScript or bundling errors.

- [ ] **Step 3: Type-check repository tests**

Run:

```bash
PATH="/Users/bytedance/.local/lib/nodejs/node-v20.20.2-darwin-arm64/bin:$PATH" corepack pnpm type-check:tests
```

Expected: PASS. The new test's `CreateOpenAIClientFn` values and runtime assertions introduce no test type errors.

- [ ] **Step 4: Run Biome on only the changed source and test files**

Run:

```bash
PATH="/Users/bytedance/.local/lib/nodejs/node-v20.20.2-darwin-arm64/bin:$PATH" corepack pnpm exec biome check packages/core/src/agent/agent.ts packages/core/tests/unit-test/agent-custom-model.test.ts --diagnostic-level=info --no-errors-on-unmatched --fix
```

Expected: PASS. If Biome changes either file, inspect the diff, rerun the focused test file, and commit only formatting changes with the file they belong to.

- [ ] **Step 5: Check whitespace and final branch scope**

Run:

```bash
git diff --check origin/main...HEAD
git status --short
git diff --name-only origin/main...HEAD
git log --oneline origin/main..HEAD
```

Expected:

```text
packages/core/src/agent/agent.ts
packages/core/tests/unit-test/agent-custom-model.test.ts
```

The branch has three focused commits, the worktree is clean, and neither `docs/superpowers/specs/` nor `docs/superpowers/plans/` appears.

- [ ] **Step 6: Review the final patch**

Run:

```bash
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- packages/core/src/agent/agent.ts packages/core/tests/unit-test/agent-custom-model.test.ts
```

Expected: the patch implements only #3079, includes the original red regression and two-agent isolation proof, performs no real model call, and contains no unrelated refactor.

### Task 6: Prepare the Contribution for Publication

**Files:**
- No additional files required

- [ ] **Step 1: Confirm issue behavior and pull request narrative**

Prepare a concise PR description containing:

```markdown
## Summary

- reuse global model configuration when `createOpenAIClient` is the only agent-level model option
- inject the custom client factory into an agent-scoped runtime config copy
- cover factory-only global config and cross-agent factory isolation

## Test plan

- focused `agent-custom-model.test.ts`
- complete `@midscene/core` test suite
- `@midscene/core` dependency build
- repository test type-check
- Biome on changed files
- `git diff --check`

Fixes #3079
```

- [ ] **Step 2: Verify no internal planning artifacts are tracked**

Run:

```bash
git diff --name-only origin/main...HEAD | grep '^docs/superpowers/' && exit 1 || true
```

Expected: no output and exit code 0.

- [ ] **Step 3: Stop before push unless publication was explicitly authorized**

Expected: implementation is ready for review and publication. Pushing the branch and opening the PR are separate external actions and require the user's explicit authorization if it has not already been granted.
