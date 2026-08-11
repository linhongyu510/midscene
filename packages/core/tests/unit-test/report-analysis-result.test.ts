import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  REPORT_ANALYSIS_CATEGORY_LABELS,
  getReportAnalysisTemplate,
  renderReportAnalysisResult,
  renderReportAnalysisResultMarkdownFile,
} from '../../src/report-analysis-result';

function commonFailure(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    report: '/absolute/path/report.html',
    analysisType: 'failed_result_analysis',
    reportStatus: 'fail',
    resultAssessment: 'true_fail',
    resultAssessmentReason:
      'The required state remained absent after the correct action.',
    rootCauseStatus: 'identified',
    conclusion: 'The recorded failure is established.',
    failedStep: 'WaitFor timed out.',
    rootCausePoint: 'The required state did not appear.',
    primaryCategory: 'tested_system',
    failureMechanism:
      'The correct action produced no visible application response.',
    evidence: [
      {
        source: 'action record',
        fact: 'The action completed before the wait timed out.',
      },
    ],
    confidence: 'high',
    limitations: 'none',
    ...overrides,
  };
}

function commonPass(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    report: '/absolute/path/report.html',
    analysisType: 'passed_result_analysis',
    reportStatus: 'pass',
    resultAssessment: 'true_pass',
    resultAssessmentReason:
      'Every required condition is supported at the judgment point.',
    conclusion: 'The recorded pass is correct.',
    evidence: [
      {
        source: 'structured output',
        fact: 'Every required clause is recorded as true.',
      },
    ],
    confidence: 'high',
    limitations: 'none',
    ...overrides,
  };
}

function commonIncomplete(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    report: '/absolute/path/report.html',
    analysisType: 'incomplete_execution_analysis',
    reportStatus: 'incomplete',
    lastTaskStatus: 'running',
    lastRecordedStep: 'A Scroll task remained running with only a start time.',
    conclusion:
      'A repeated model loop is established, while the exact termination event is not recorded.',
    observedIssueStatus: 'identified',
    observedIssue:
      'The model repeated the same ineffective upward-scroll decision.',
    observedIssueConfidence: 'high',
    primaryCategory: 'model_reasoning',
    interruptionCauseStatus: 'inconclusive',
    interruptionReason:
      'The record does not distinguish an outer timeout, cancellation, or worker failure.',
    evidence: [
      {
        source: 'report state',
        fact: 'The last task has status running and no end timestamp.',
      },
    ],
    limitations: 'The outer worker log is not embedded in the report.',
    ...overrides,
  };
}

function withoutFields(
  object: Record<string, unknown>,
  ...fields: string[]
): Record<string, unknown> {
  const omitted = new Set(fields);
  return Object.fromEntries(
    Object.entries(object).filter(([key]) => !omitted.has(key)),
  );
}

describe('report analysis result', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      if (existsSync(directory)) {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });

  it('round-trips every generated template through validation and rendering', () => {
    for (const name of ['fail', 'pass', 'incomplete'] as const) {
      expect(() =>
        renderReportAnalysisResult(getReportAnalysisTemplate(name)),
      ).not.toThrow();
    }
  });

  it('renders every category with the canonical label', () => {
    for (const [category, label] of Object.entries(
      REPORT_ANALYSIS_CATEGORY_LABELS,
    )) {
      const markdown = renderReportAnalysisResult(
        commonFailure({ primaryCategory: category }),
      );
      expect(markdown).toContain('**Primary category:**');
      expect(markdown).toContain(`\`${category}\` — ${label}`);
    }
  });

  it('groups the report into readable Markdown sections', () => {
    const markdown = renderReportAnalysisResult(commonFailure());

    expect(markdown).toContain('**Report:** `/absolute/path/report.html`');
    expect(markdown).toContain('**Analysis type:** `failed_result_analysis`');
    expect(markdown).toContain('**Report status:** `fail`');
    expect(markdown).toContain('**Result assessment:** `true_fail`');
    expect(markdown).toContain('**Result-assessment reason:**');
    expect(markdown).toContain('**Root-cause status:** `identified`');
    expect(markdown).toContain('**Conclusion:**');
    expect(markdown).toContain('**Failed step:**');
    expect(markdown).toContain('**Evidence:**');
    expect(markdown).toContain('**Confidence:** `high`');
    expect(markdown).toContain('**Limitations:**');
    expect(markdown).not.toContain('# ');
    expect(markdown).not.toContain('| --- |');
  });

  it('allows an inconclusive root cause to retain an established mechanism', () => {
    const result = withoutFields(
      commonFailure({
        rootCauseStatus: 'inconclusive',
        conclusion: 'The mechanism is known but ownership is inconclusive.',
        plausibleCategories: ['midscene_runtime', 'tested_system'],
      }),
      'primaryCategory',
    );

    const markdown = renderReportAnalysisResult(result);
    expect(markdown).toContain('**Root-cause point:**');
    expect(markdown).toContain('**Failure mechanism:**');
    expect(markdown).toContain('**Plausible categories:**');
  });

  it('requires inconclusive root-cause point and mechanism together', () => {
    const result = withoutFields(
      commonFailure({
        rootCauseStatus: 'inconclusive',
        plausibleCategories: ['midscene_runtime', 'tested_system'],
      }),
      'primaryCategory',
      'failureMechanism',
    );

    expect(() => renderReportAnalysisResult(result)).toThrow(
      'must be provided together',
    );
  });

  it('accepts an evidence-insufficient failure without cause fields', () => {
    const result = withoutFields(
      commonFailure({
        rootCauseStatus: 'insufficient_evidence',
        evidenceIssue: 'The decisive task record is absent.',
      }),
      'rootCausePoint',
      'primaryCategory',
      'failureMechanism',
    );

    expect(() => renderReportAnalysisResult(result)).not.toThrow();
  });

  it.each(['true_fail', 'false_fail', 'unverifiable', 'inconclusive'] as const)(
    'accepts the failed-result assessment %s',
    (resultAssessment) => {
      const markdown = renderReportAnalysisResult(
        commonFailure({ resultAssessment }),
      );
      expect(markdown).toContain(
        `**Result assessment:** \`${resultAssessment}\``,
      );
    },
  );

  it('requires every failed-report analysis to assess result correctness', () => {
    const result = withoutFields(commonFailure(), 'resultAssessment');
    expect(() => renderReportAnalysisResult(result)).toThrow(
      'result.resultAssessment must be a non-empty string',
    );

    const withoutReason = withoutFields(
      commonFailure(),
      'resultAssessmentReason',
    );
    expect(() => renderReportAnalysisResult(withoutReason)).toThrow(
      'result.resultAssessmentReason must be a non-empty string',
    );
  });

  it('rejects an unsupported failed-result assessment', () => {
    expect(() =>
      renderReportAnalysisResult(
        commonFailure({ resultAssessment: 'false_negative' }),
      ),
    ).toThrow('result.resultAssessment must be one of');
  });

  it.each(['true_pass', 'false_pass'])(
    'rejects passed-result assessment %s on a failed report',
    (resultAssessment) => {
      expect(() =>
        renderReportAnalysisResult(commonFailure({ resultAssessment })),
      ).toThrow('result.resultAssessment must be one of');
    },
  );

  it.each([
    ['identified', {}],
    [
      'inconclusive',
      {
        plausibleCategories: ['midscene_runtime', 'tested_system'],
      },
    ],
    [
      'insufficient_evidence',
      { evidenceIssue: 'The decisive task evidence is absent.' },
    ],
  ] as const)(
    'keeps every result assessment independent from rootCauseStatus %s',
    (rootCauseStatus, additions) => {
      for (const resultAssessment of [
        'true_fail',
        'false_fail',
        'unverifiable',
        'inconclusive',
      ] as const) {
        let result = commonFailure({
          resultAssessment,
          rootCauseStatus,
          ...additions,
        });
        if (rootCauseStatus === 'inconclusive') {
          result = withoutFields(result, 'primaryCategory');
        }
        if (rootCauseStatus === 'insufficient_evidence') {
          result = withoutFields(
            result,
            'rootCausePoint',
            'primaryCategory',
            'failureMechanism',
          );
        }
        expect(() => renderReportAnalysisResult(result)).not.toThrow();
      }
    },
  );

  it('validates every passed-result assessment shape', () => {
    expect(renderReportAnalysisResult(commonPass())).toContain(
      '**Result assessment:** `true_pass`',
    );

    expect(() =>
      renderReportAnalysisResult(
        commonPass({
          resultAssessment: 'false_pass',
          conclusion: 'The recorded pass is false.',
          passClaimIssuePoint:
            'The assertion claimed a missing state was present.',
          issueMechanism: 'The assertion ignored the recorded page state.',
          primaryCategory: 'model_reasoning',
        }),
      ),
    ).not.toThrow();

    expect(() =>
      renderReportAnalysisResult(
        commonPass({
          resultAssessment: 'unverifiable',
          conclusion: 'The pass lacks required proof.',
          passClaimIssuePoint:
            'The pass was emitted before the side effect was observed.',
          issueMechanism: 'No record captures the required side effect.',
        }),
      ),
    ).not.toThrow();

    expect(() =>
      renderReportAnalysisResult(
        commonPass({
          resultAssessment: 'inconclusive',
          conclusion: 'The pass cannot be assessed.',
          evidenceIssue:
            'The available evidence cannot establish the required state.',
        }),
      ),
    ).not.toThrow();
  });

  it('requires every passed-report analysis to explain its assessment', () => {
    const withoutAssessment = withoutFields(commonPass(), 'resultAssessment');
    expect(() => renderReportAnalysisResult(withoutAssessment)).toThrow(
      'result.resultAssessment must be a non-empty string',
    );

    const withoutReason = withoutFields(commonPass(), 'resultAssessmentReason');
    expect(() => renderReportAnalysisResult(withoutReason)).toThrow(
      'result.resultAssessmentReason must be a non-empty string',
    );
  });

  it.each(['true_fail', 'false_fail'])(
    'rejects failed-result assessment %s on a passed report',
    (resultAssessment) => {
      expect(() =>
        renderReportAnalysisResult(commonPass({ resultAssessment })),
      ).toThrow('result.resultAssessment must be one of');
    },
  );

  it.each([
    'false_positive_analysis',
    'failure_analysis',
    'pass_result_analysis',
  ])('rejects the legacy analysis route %s', (analysisType) => {
    expect(() =>
      renderReportAnalysisResult({ ...commonPass(), analysisType }),
    ).toThrow('result must describe');
  });

  it('rejects legacy verdict fields', () => {
    const legacyPass = withoutFields(commonPass(), 'resultAssessment');
    expect(() =>
      renderReportAnalysisResult({
        ...legacyPass,
        passVerdict: 'substantiated',
      }),
    ).toThrow('unsupported field(s): passVerdict');

    const legacyFailure = withoutFields(
      commonFailure(),
      'resultAssessment',
      'resultAssessmentReason',
    );
    expect(() =>
      renderReportAnalysisResult({
        ...legacyFailure,
        failureVerdict: 'false_negative',
        failureVerdictReason: 'Legacy terminology.',
      }),
    ).toThrow('unsupported field(s): failureVerdict, failureVerdictReason');
  });

  it.each(['passed', 'failed', 'unknown'])(
    'rejects the legacy report status %s',
    (reportStatus) => {
      expect(() =>
        renderReportAnalysisResult({ ...commonPass(), reportStatus }),
      ).toThrow('result.reportStatus must be one of: fail, pass, incomplete');
    },
  );

  it.each(['unknownReason', 'incompleteReason'])(
    'rejects the legacy %s field',
    (field) => {
      expect(() =>
        renderReportAnalysisResult({
          ...commonIncomplete(),
          [field]: 'incomplete',
        }),
      ).toThrow(`unsupported field(s): ${field}`);
    },
  );

  it('rejects terminal task statuses on incomplete execution analysis', () => {
    expect(() =>
      renderReportAnalysisResult({
        ...commonIncomplete(),
        lastTaskStatus: 'passed',
      }),
    ).toThrow('result.lastTaskStatus must be one of');
  });

  it('separates a non-terminal cause assessment from observed contributors', () => {
    const markdown = renderReportAnalysisResult(commonIncomplete());

    expect(markdown).toContain(
      '**Analysis type:** `incomplete_execution_analysis`',
    );
    expect(markdown).toContain('**Report status:** `incomplete`');
    expect(markdown).toContain('**Interruption-cause status:** `inconclusive`');
    expect(markdown).toContain('**Last recorded step:**');
    expect(markdown).toContain('**Observed issue:**');
    expect(markdown).toContain('`model_reasoning` — 模型理解与决策问题');
  });

  it.each(['pending', 'running', 'cancelled', 'unknown'] as const)(
    'accepts the final task status %s for incomplete-execution analysis',
    (lastTaskStatus) => {
      const markdown = renderReportAnalysisResult(
        commonIncomplete({ lastTaskStatus }),
      );
      expect(markdown).toContain(`**Last task status:** \`${lastTaskStatus}\``);
    },
  );

  it('requires an identified observed issue and its category together', () => {
    const result = withoutFields(commonIncomplete(), 'primaryCategory');
    expect(() => renderReportAnalysisResult(result)).toThrow(
      'result.primaryCategory must be one of',
    );
  });

  it('accepts none_observed only without issue attribution', () => {
    const result = withoutFields(
      commonIncomplete({ observedIssueStatus: 'none_observed' }),
      'observedIssue',
      'primaryCategory',
    );
    expect(() => renderReportAnalysisResult(result)).not.toThrow();
    expect(() =>
      renderReportAnalysisResult({
        ...result,
        primaryCategory: 'model_reasoning',
      }),
    ).toThrow('result must omit field(s): primaryCategory');
  });

  it('accepts an inconclusive issue only without attributed contributors', () => {
    const result = withoutFields(
      commonIncomplete({
        observedIssueStatus: 'inconclusive',
        observedIssue:
          'The record is compatible with either a model loop or an ineffective scroll tool.',
      }),
      'primaryCategory',
    );
    expect(() => renderReportAnalysisResult(result)).not.toThrow();
    expect(() =>
      renderReportAnalysisResult({
        ...result,
        contributors: [
          {
            category: 'midscene_runtime',
            mechanism: 'The scroll may not have changed the page.',
            evidence: [
              {
                source: 'action record',
                fact: 'The recorded scroll did not establish a page change.',
              },
            ],
          },
        ],
      }),
    ).toThrow('result must omit field(s): contributors');
  });

  it('writes Markdown beside the analysis-result JSON by default', () => {
    const directory = mkdtempSync(
      join(tmpdir(), 'midscene-analysis-markdown-'),
    );
    temporaryDirectories.push(directory);
    const resultPath = join(directory, 'analysis-result.json');
    writeFileSync(resultPath, JSON.stringify(commonFailure()), 'utf8');

    const outputPath = renderReportAnalysisResultMarkdownFile(resultPath);

    expect(outputPath).toBe(join(directory, 'analysis-result.md'));
    expect(readFileSync(outputPath, 'utf8')).toContain(
      '**Analysis type:** `failed_result_analysis`',
    );
  });

  it('renders only a real absolute file or HTTP(S) URL as screenshot evidence', () => {
    const directory = mkdtempSync(join(tmpdir(), 'midscene-analysis-result-'));
    temporaryDirectories.push(directory);
    const screenshot = join(directory, 'evidence.png');
    writeFileSync(screenshot, 'image');

    const valid = commonFailure({
      evidence: [{ source: 'screenshot', fact: 'Visible state.', screenshot }],
    });
    expect(renderReportAnalysisResult(valid)).toContain(
      `![Screenshot evidence](<${screenshot}>)`,
    );
    expect(renderReportAnalysisResult(valid)).toContain('**Screenshot:**');

    const invalid = commonFailure({
      evidence: [
        {
          source: 'screenshot',
          fact: 'Visible state.',
          screenshot: './evidence.png',
        },
      ],
    });
    expect(() => renderReportAnalysisResult(invalid)).toThrow(
      'must be an absolute local path or an HTTP(S) URL',
    );
  });
});
