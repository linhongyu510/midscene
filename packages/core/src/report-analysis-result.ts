import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, parse, resolve } from 'node:path';
import type { ReportStatus } from './report-inspection';

export const REPORT_ANALYSIS_CATEGORY_LABELS = {
  model_reasoning: '模型理解与决策问题',
  test_design: '测试用例设计问题',
  midscene_runtime: 'Midscene 运行时与工具链问题',
  tested_system: '被测系统状态与行为异常',
  external_dependency: '外部依赖与运行环境问题',
} as const;

export const REPORT_ROOT_CAUSE_STATUSES = [
  'identified',
  'inconclusive',
  'insufficient_evidence',
] as const;

export const REPORT_ANALYSIS_CONFIDENCE_LEVELS = [
  'high',
  'medium',
  'low',
] as const;

export const REPORT_PASSED_RESULT_ASSESSMENTS = [
  'true_pass',
  'false_pass',
  'unverifiable',
  'inconclusive',
] as const;

export const REPORT_FAILED_RESULT_ASSESSMENTS = [
  'true_fail',
  'false_fail',
  'unverifiable',
  'inconclusive',
] as const;

export const REPORT_RESULT_ASSESSMENTS = [
  'true_pass',
  'false_pass',
  'true_fail',
  'false_fail',
  'unverifiable',
  'inconclusive',
] as const;

export const REPORT_EVIDENCE_SOURCES = [
  'report state',
  'test instruction',
  'machine error',
  'action record',
  'screenshot',
  'structured output',
  'model decision record',
  'external evidence',
] as const;

export const REPORT_INCOMPLETE_EXECUTION_LAST_TASK_STATUSES = [
  'pending',
  'running',
  'cancelled',
  'unknown',
] as const;

export const REPORT_OBSERVED_ISSUE_STATUSES = [
  'identified',
  'none_observed',
  'inconclusive',
] as const;

export const REPORT_INTERRUPTION_CAUSE_STATUSES = [
  'identified',
  'inconclusive',
] as const;

export type ReportAnalysisCategory =
  keyof typeof REPORT_ANALYSIS_CATEGORY_LABELS;
export type ReportRootCauseStatus = (typeof REPORT_ROOT_CAUSE_STATUSES)[number];
export type ReportAnalysisConfidence =
  (typeof REPORT_ANALYSIS_CONFIDENCE_LEVELS)[number];
export type ReportPassedResultAssessment =
  (typeof REPORT_PASSED_RESULT_ASSESSMENTS)[number];
export type ReportFailedResultAssessment =
  (typeof REPORT_FAILED_RESULT_ASSESSMENTS)[number];
export type ReportResultAssessment = (typeof REPORT_RESULT_ASSESSMENTS)[number];
export type ReportEvidenceSource = (typeof REPORT_EVIDENCE_SOURCES)[number];
export type ReportIncompleteExecutionLastTaskStatus =
  (typeof REPORT_INCOMPLETE_EXECUTION_LAST_TASK_STATUSES)[number];
export type ReportObservedIssueStatus =
  (typeof REPORT_OBSERVED_ISSUE_STATUSES)[number];
export type ReportInterruptionCauseStatus =
  (typeof REPORT_INTERRUPTION_CAUSE_STATUSES)[number];
export interface ReportAnalysisEvidence {
  source: ReportEvidenceSource;
  fact: string;
  screenshot?: string;
}

export interface ReportAnalysisContributor {
  category: ReportAnalysisCategory;
  mechanism: string;
  evidence: ReportAnalysisEvidence[];
}

interface ReportAnalysisCommonResult {
  report: string;
  conclusion: string;
  evidence: ReportAnalysisEvidence[];
  contributors?: ReportAnalysisContributor[];
  confidence: ReportAnalysisConfidence;
  limitations: string;
}

export interface ReportFailedResultAnalysisResult
  extends ReportAnalysisCommonResult {
  analysisType: 'failed_result_analysis';
  reportStatus: 'fail';
  resultAssessment: ReportFailedResultAssessment;
  resultAssessmentReason: string;
  rootCauseStatus: ReportRootCauseStatus;
  failedStep?: string;
  rootCausePoint?: string;
  primaryCategory?: ReportAnalysisCategory;
  failureMechanism?: string;
  evidenceIssue?: string;
  plausibleCategories?: ReportAnalysisCategory[];
}

export interface ReportPassedResultAnalysisResult
  extends ReportAnalysisCommonResult {
  analysisType: 'passed_result_analysis';
  reportStatus: 'pass';
  resultAssessment: ReportPassedResultAssessment;
  resultAssessmentReason: string;
  passClaimIssuePoint?: string;
  primaryCategory?: ReportAnalysisCategory;
  issueMechanism?: string;
  evidenceIssue?: string;
}

export interface ReportIncompleteExecutionAnalysisResult {
  report: string;
  analysisType: 'incomplete_execution_analysis';
  reportStatus: 'incomplete';
  lastTaskStatus: ReportIncompleteExecutionLastTaskStatus;
  conclusion: string;
  lastRecordedStep: string;
  observedIssueStatus: ReportObservedIssueStatus;
  observedIssue?: string;
  observedIssueConfidence: ReportAnalysisConfidence;
  primaryCategory?: ReportAnalysisCategory;
  interruptionCauseStatus: ReportInterruptionCauseStatus;
  interruptionReason: string;
  evidence: ReportAnalysisEvidence[];
  contributors?: ReportAnalysisContributor[];
  limitations: string;
}

export type MidsceneReportAnalysisResult =
  | ReportFailedResultAnalysisResult
  | ReportPassedResultAnalysisResult
  | ReportIncompleteExecutionAnalysisResult;

type JsonObject = Record<string, unknown>;

const COMMON_FIELDS = [
  'report',
  'analysisType',
  'reportStatus',
  'conclusion',
  'evidence',
  'contributors',
  'confidence',
  'limitations',
] as const;

function fail(message: string): never {
  throw new Error(message);
}

function has(object: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function expectObject(
  value: unknown,
  location: string,
): asserts value is JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${location} must be an object`);
  }
}

function expectAllowedFields(
  object: JsonObject,
  allowed: readonly string[],
  location: string,
): void {
  const allowedSet = new Set(allowed);
  const extra = Object.keys(object).filter((key) => !allowedSet.has(key));
  if (extra.length > 0) {
    fail(`${location} contains unsupported field(s): ${extra.join(', ')}`);
  }
}

function requireString(
  object: JsonObject,
  key: string,
  location: string,
): string {
  const value = object[key];
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${location}.${key} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(
  object: JsonObject,
  key: string,
  location: string,
): string | undefined {
  if (!has(object, key)) return undefined;
  return requireString(object, key, location);
}

function requireEnum<const T extends readonly string[]>(
  object: JsonObject,
  key: string,
  values: T,
  location: string,
): T[number] {
  const value = requireString(object, key, location);
  if (!values.includes(value)) {
    fail(`${location}.${key} must be one of: ${values.join(', ')}`);
  }
  return value as T[number];
}

function requireArray(
  object: JsonObject,
  key: string,
  location: string,
  options: { nonEmpty?: boolean } = {},
): unknown[] {
  const nonEmpty = options.nonEmpty ?? true;
  const value = object[key];
  if (!Array.isArray(value) || (nonEmpty && value.length === 0)) {
    fail(`${location}.${key} must be ${nonEmpty ? 'a non-empty' : 'an'} array`);
  }
  return value;
}

function forbidFields(
  object: JsonObject,
  fields: readonly string[],
  location: string,
): void {
  const present = fields.filter((field) => has(object, field));
  if (present.length > 0) {
    fail(`${location} must omit field(s): ${present.join(', ')}`);
  }
}

function validateCategory(
  value: unknown,
  location: string,
): asserts value is ReportAnalysisCategory {
  if (
    typeof value !== 'string' ||
    !Object.prototype.hasOwnProperty.call(
      REPORT_ANALYSIS_CATEGORY_LABELS,
      value,
    )
  ) {
    fail(
      `${location} must be one of: ${Object.keys(REPORT_ANALYSIS_CATEGORY_LABELS).join(', ')}`,
    );
  }
}

function validateScreenshot(value: unknown, location: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${location} must be a non-empty string`);
  }

  const target = value.trim();
  if (/^https?:\/\//i.test(target)) return;
  if (!isAbsolute(target)) {
    fail(`${location} must be an absolute local path or an HTTP(S) URL`);
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    fail(`${location} local file does not exist: ${target}`);
  }
}

function validateEvidenceItem(item: unknown, location: string): void {
  expectObject(item, location);
  expectAllowedFields(item, ['source', 'fact', 'screenshot'], location);
  const source = requireEnum(item, 'source', REPORT_EVIDENCE_SOURCES, location);
  requireString(item, 'fact', location);

  if (source === 'screenshot') {
    if (!has(item, 'screenshot')) {
      fail(`${location}.screenshot is required for screenshot evidence`);
    }
    validateScreenshot(item.screenshot, `${location}.screenshot`);
  } else if (has(item, 'screenshot')) {
    fail(`${location}.screenshot is allowed only when source is screenshot`);
  }
}

function validateEvidenceArray(
  object: JsonObject,
  key: string,
  location: string,
): void {
  const items = requireArray(object, key, location);
  items.forEach((item, index) =>
    validateEvidenceItem(item, `${location}.${key}[${index}]`),
  );
}

function validateContributors(object: JsonObject, location: string): void {
  if (!has(object, 'contributors')) return;
  const contributors = requireArray(object, 'contributors', location);
  contributors.forEach((contributor, index) => {
    const itemLocation = `${location}.contributors[${index}]`;
    expectObject(contributor, itemLocation);
    expectAllowedFields(
      contributor,
      ['category', 'mechanism', 'evidence'],
      itemLocation,
    );
    validateCategory(contributor.category, `${itemLocation}.category`);
    requireString(contributor, 'mechanism', itemLocation);
    validateEvidenceArray(contributor, 'evidence', itemLocation);
  });
}

function validateCommon(
  object: JsonObject,
  expectedType:
    | 'failed_result_analysis'
    | 'passed_result_analysis'
    | 'incomplete_execution_analysis',
  expectedStatus: 'fail' | 'pass' | 'incomplete',
): void {
  const location = 'result';
  requireString(object, 'report', location);
  const analysisType = requireEnum(
    object,
    'analysisType',
    [
      'failed_result_analysis',
      'passed_result_analysis',
      'incomplete_execution_analysis',
    ] as const,
    location,
  );
  if (analysisType !== expectedType) {
    fail(`result.analysisType must be ${expectedType}`);
  }
  const reportStatus = requireEnum(
    object,
    'reportStatus',
    ['fail', 'pass', 'incomplete'] as const,
    location,
  );
  if (reportStatus !== expectedStatus) {
    fail(`result.reportStatus must be ${expectedStatus}`);
  }
  requireString(object, 'conclusion', location);
  validateEvidenceArray(object, 'evidence', location);
  requireEnum(
    object,
    'confidence',
    REPORT_ANALYSIS_CONFIDENCE_LEVELS,
    location,
  );
  requireString(object, 'limitations', location);
  validateContributors(object, location);
}

function validateIncompleteExecution(object: JsonObject): void {
  const location = 'result';
  expectAllowedFields(
    object,
    [
      'report',
      'analysisType',
      'reportStatus',
      'lastTaskStatus',
      'conclusion',
      'lastRecordedStep',
      'observedIssueStatus',
      'observedIssue',
      'observedIssueConfidence',
      'primaryCategory',
      'interruptionCauseStatus',
      'interruptionReason',
      'evidence',
      'contributors',
      'limitations',
    ],
    location,
  );
  requireString(object, 'report', location);
  const analysisType = requireEnum(
    object,
    'analysisType',
    ['incomplete_execution_analysis'] as const,
    location,
  );
  if (analysisType !== 'incomplete_execution_analysis') {
    fail('result.analysisType must be incomplete_execution_analysis');
  }
  const reportStatus = requireEnum(
    object,
    'reportStatus',
    ['incomplete'] as const,
    location,
  );
  if (reportStatus !== 'incomplete') {
    fail('result.reportStatus must be incomplete');
  }
  requireEnum(
    object,
    'lastTaskStatus',
    REPORT_INCOMPLETE_EXECUTION_LAST_TASK_STATUSES,
    location,
  );
  requireString(object, 'conclusion', location);
  requireString(object, 'lastRecordedStep', location);
  const observedIssueStatus = requireEnum(
    object,
    'observedIssueStatus',
    REPORT_OBSERVED_ISSUE_STATUSES,
    location,
  );
  requireEnum(
    object,
    'observedIssueConfidence',
    REPORT_ANALYSIS_CONFIDENCE_LEVELS,
    location,
  );
  requireEnum(
    object,
    'interruptionCauseStatus',
    REPORT_INTERRUPTION_CAUSE_STATUSES,
    location,
  );
  requireString(object, 'interruptionReason', location);
  validateEvidenceArray(object, 'evidence', location);
  requireString(object, 'limitations', location);
  validateContributors(object, location);

  if (observedIssueStatus === 'identified') {
    requireString(object, 'observedIssue', location);
    validateCategory(object.primaryCategory, 'result.primaryCategory');
    return;
  }

  if (observedIssueStatus === 'inconclusive') {
    requireString(object, 'observedIssue', location);
    forbidFields(object, ['primaryCategory', 'contributors'], location);
    return;
  }

  forbidFields(
    object,
    ['observedIssue', 'primaryCategory', 'contributors'],
    location,
  );
}

function validateFailedResult(object: JsonObject): void {
  const location = 'result';
  expectAllowedFields(
    object,
    [
      ...COMMON_FIELDS,
      'resultAssessment',
      'resultAssessmentReason',
      'rootCauseStatus',
      'failedStep',
      'rootCausePoint',
      'primaryCategory',
      'failureMechanism',
      'evidenceIssue',
      'plausibleCategories',
    ],
    location,
  );
  validateCommon(object, 'failed_result_analysis', 'fail');
  optionalString(object, 'failedStep', location);
  requireEnum(
    object,
    'resultAssessment',
    REPORT_FAILED_RESULT_ASSESSMENTS,
    location,
  );
  requireString(object, 'resultAssessmentReason', location);

  const status = requireEnum(
    object,
    'rootCauseStatus',
    REPORT_ROOT_CAUSE_STATUSES,
    location,
  );
  if (status === 'identified') {
    requireString(object, 'rootCausePoint', location);
    validateCategory(object.primaryCategory, 'result.primaryCategory');
    requireString(object, 'failureMechanism', location);
    forbidFields(object, ['evidenceIssue', 'plausibleCategories'], location);
    return;
  }

  if (status === 'insufficient_evidence') {
    requireString(object, 'evidenceIssue', location);
    forbidFields(
      object,
      [
        'rootCausePoint',
        'primaryCategory',
        'failureMechanism',
        'plausibleCategories',
      ],
      location,
    );
    return;
  }

  const categories = requireArray(object, 'plausibleCategories', location);
  const seen = new Set<string>();
  categories.forEach((category, index) => {
    validateCategory(category, `result.plausibleCategories[${index}]`);
    if (seen.has(category)) {
      fail(`result.plausibleCategories contains duplicate: ${category}`);
    }
    seen.add(category);
  });
  const hasRootCause = has(object, 'rootCausePoint');
  const hasMechanism = has(object, 'failureMechanism');
  if (hasRootCause !== hasMechanism) {
    fail(
      'result.rootCausePoint and result.failureMechanism must be provided together when rootCauseStatus is inconclusive',
    );
  }
  if (hasRootCause) {
    requireString(object, 'rootCausePoint', location);
    requireString(object, 'failureMechanism', location);
  }
  forbidFields(object, ['primaryCategory', 'evidenceIssue'], location);
}

function validatePassedResult(object: JsonObject): void {
  const location = 'result';
  expectAllowedFields(
    object,
    [
      ...COMMON_FIELDS,
      'resultAssessment',
      'resultAssessmentReason',
      'passClaimIssuePoint',
      'primaryCategory',
      'issueMechanism',
      'evidenceIssue',
    ],
    location,
  );
  validateCommon(object, 'passed_result_analysis', 'pass');
  const assessment = requireEnum(
    object,
    'resultAssessment',
    REPORT_PASSED_RESULT_ASSESSMENTS,
    location,
  );
  requireString(object, 'resultAssessmentReason', location);

  if (assessment === 'true_pass') {
    forbidFields(
      object,
      [
        'passClaimIssuePoint',
        'primaryCategory',
        'issueMechanism',
        'evidenceIssue',
        'contributors',
      ],
      location,
    );
    return;
  }

  if (assessment === 'false_pass' || assessment === 'unverifiable') {
    requireString(object, 'passClaimIssuePoint', location);
    requireString(object, 'issueMechanism', location);
    if (has(object, 'primaryCategory')) {
      validateCategory(object.primaryCategory, 'result.primaryCategory');
    }
    forbidFields(object, ['evidenceIssue'], location);
    return;
  }

  requireString(object, 'evidenceIssue', location);
  forbidFields(
    object,
    [
      'passClaimIssuePoint',
      'primaryCategory',
      'issueMechanism',
      'contributors',
    ],
    location,
  );
}

export function validateReportAnalysisResult(
  value: unknown,
): asserts value is MidsceneReportAnalysisResult {
  expectObject(value, 'result');
  if (value.analysisType === 'incomplete_execution_analysis') {
    validateIncompleteExecution(value);
  } else if (value.analysisType === 'failed_result_analysis') {
    validateFailedResult(value);
  } else if (value.analysisType === 'passed_result_analysis') {
    validatePassedResult(value);
  } else {
    fail(
      'result must describe failed_result_analysis, passed_result_analysis, or incomplete_execution_analysis output',
    );
  }
}

function formatCategory(category: ReportAnalysisCategory): string {
  return `\`${category}\` — ${REPORT_ANALYSIS_CATEGORY_LABELS[category]}`;
}

function markdownImageDestination(value: string): string {
  return `<${value.trim().replaceAll('>', '%3E')}>`;
}

function indentText(value: string, indent: string): string {
  return String(value)
    .trim()
    .split(/\r?\n/)
    .map((line) => `${indent}${line}`)
    .join('\n');
}

function renderEvidence(items: ReportAnalysisEvidence[]): string {
  return items
    .map((item) => {
      const lines = [
        `- **Source:** \`${item.source}\``,
        '',
        `  **Fact:** ${indentText(item.fact, '  ').trimStart()}`,
      ];
      if (item.source === 'screenshot' && item.screenshot) {
        lines.push(
          '',
          '  **Screenshot:**',
          '',
          `  ![Screenshot evidence](${markdownImageDestination(item.screenshot)})`,
        );
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

function renderContributors(
  contributors: ReportAnalysisContributor[] | undefined,
): string[] {
  if (!contributors) return [];
  return contributors.map((contributor, index) =>
    [
      `**Contributor ${index + 1}:** ${formatCategory(contributor.category)}`,
      `**Mechanism:** ${contributor.mechanism.trim()}`,
      '**Evidence:**',
      renderEvidence(contributor.evidence),
    ].join('\n'),
  );
}

function renderHeader(
  report: string | null,
  metadata: Array<[string, string]>,
): string[] {
  return [
    `**Report:** ${report ? `\`${report}\`` : 'Not supplied'}`,
    ...metadata.map(([label, value]) => `**${label}:** \`${value}\``),
  ].flatMap((line, index) => (index === 0 ? [line] : ['', line]));
}

function renderDetail(label: string, value: string): string {
  const content = value.trim();
  return content.includes('\n')
    ? `**${label}:**\n\n${content}`
    : `**${label}:** ${content}`;
}

function renderAssessment(confidence: string, limitations: string): string[] {
  return [
    `**Confidence:** \`${confidence}\``,
    '',
    `**Limitations:** ${limitations.trim()}`,
  ];
}

function renderFailedResult(result: ReportFailedResultAnalysisResult): string {
  const details: string[] = [];
  if (result.failedStep) {
    details.push(renderDetail('Failed step', result.failedStep));
  }
  details.push(
    renderDetail('Result-assessment reason', result.resultAssessmentReason),
  );
  if (result.rootCausePoint) {
    details.push(renderDetail('Root-cause point', result.rootCausePoint));
  }
  if (result.primaryCategory) {
    details.push(
      renderDetail('Primary category', formatCategory(result.primaryCategory)),
    );
  }
  if (result.failureMechanism) {
    details.push(renderDetail('Failure mechanism', result.failureMechanism));
  }
  if (result.evidenceIssue) {
    details.push(renderDetail('Evidence issue', result.evidenceIssue));
  }
  if (result.plausibleCategories) {
    details.push(
      renderDetail(
        'Plausible categories',
        result.plausibleCategories
          .map((category) => `- ${formatCategory(category)}`)
          .join('\n'),
      ),
    );
  }
  const output = [
    ...renderHeader(result.report, [
      ['Analysis type', 'failed_result_analysis'],
      ['Report status', 'fail'],
      ['Result assessment', result.resultAssessment],
      ['Root-cause status', result.rootCauseStatus],
    ]),
    '',
    renderDetail('Conclusion', result.conclusion),
  ];
  if (details.length > 0) {
    output.push('', details.join('\n\n'));
  }
  output.push('', '**Evidence:**', '', renderEvidence(result.evidence));
  const contributors = renderContributors(result.contributors);
  if (contributors.length > 0) {
    output.push('', '**Contributing factors:**', '', contributors.join('\n\n'));
  }
  output.push('', ...renderAssessment(result.confidence, result.limitations));
  return output.join('\n');
}

function renderPassedResult(result: ReportPassedResultAnalysisResult): string {
  const details: string[] = [];
  if (result.passClaimIssuePoint) {
    details.push(
      renderDetail('Pass-claim issue point', result.passClaimIssuePoint),
    );
  }
  if (result.primaryCategory) {
    details.push(
      renderDetail('Primary category', formatCategory(result.primaryCategory)),
    );
  }
  if (result.issueMechanism) {
    details.push(renderDetail('Issue mechanism', result.issueMechanism));
  }
  if (result.evidenceIssue) {
    details.push(renderDetail('Evidence issue', result.evidenceIssue));
  }
  const output = [
    ...renderHeader(result.report, [
      ['Analysis type', 'passed_result_analysis'],
      ['Report status', 'pass'],
      ['Result assessment', result.resultAssessment],
    ]),
    '',
    renderDetail('Conclusion', result.conclusion),
    '',
    renderDetail('Result-assessment reason', result.resultAssessmentReason),
  ];
  if (details.length > 0) {
    output.push('', details.join('\n\n'));
  }
  output.push('', '**Evidence:**', '', renderEvidence(result.evidence));
  const contributors = renderContributors(result.contributors);
  if (contributors.length > 0) {
    output.push('', '**Contributing factors:**', '', contributors.join('\n\n'));
  }
  output.push('', ...renderAssessment(result.confidence, result.limitations));
  return output.join('\n');
}

function renderIncompleteExecution(
  result: ReportIncompleteExecutionAnalysisResult,
): string {
  const details: string[] = [
    renderDetail('Last recorded step', result.lastRecordedStep),
    renderDetail('Observed-issue status', result.observedIssueStatus),
  ];
  if (result.observedIssue) {
    details.push(renderDetail('Observed issue', result.observedIssue));
  }
  if (result.primaryCategory) {
    details.push(
      renderDetail('Primary category', formatCategory(result.primaryCategory)),
    );
  }
  details.push(
    renderDetail('Observed-issue confidence', result.observedIssueConfidence),
    renderDetail('Interruption assessment', result.interruptionReason),
  );
  const output = [
    ...renderHeader(result.report, [
      ['Analysis type', 'incomplete_execution_analysis'],
      ['Report status', 'incomplete'],
      ['Last task status', result.lastTaskStatus],
      ['Interruption-cause status', result.interruptionCauseStatus],
    ]),
    '',
    renderDetail('Conclusion', result.conclusion),
    '',
    details.join('\n\n'),
    '',
    '**Evidence:**',
    '',
    renderEvidence(result.evidence),
  ];
  const contributors = renderContributors(result.contributors);
  if (contributors.length > 0) {
    output.push(
      '',
      '**Observed pre-termination contributors:**',
      '',
      contributors.join('\n\n'),
    );
  }
  output.push('', renderDetail('Limitations', result.limitations));
  return output.join('\n');
}

export function renderReportAnalysisResult(value: unknown): string {
  validateReportAnalysisResult(value);
  if (
    'analysisType' in value &&
    value.analysisType === 'incomplete_execution_analysis'
  ) {
    return renderIncompleteExecution(value);
  }
  if (value.analysisType === 'failed_result_analysis') {
    return renderFailedResult(value);
  }
  return renderPassedResult(value);
}

const TEMPLATES: Record<ReportStatus, MidsceneReportAnalysisResult> = {
  fail: {
    report: '/absolute/path/report.html',
    analysisType: 'failed_result_analysis',
    reportStatus: 'fail',
    resultAssessment: 'inconclusive',
    resultAssessmentReason:
      'Explain whether report evidence proves the requested outcome failed, succeeded, or remains undecidable.',
    rootCauseStatus: 'identified',
    conclusion:
      'Determine whether the failed result is true_fail, false_fail, unverifiable, or inconclusive.',
    failedStep: 'Identify the recorded failed task or transition.',
    rootCausePoint: 'Identify the earliest evidenced unrecovered cause.',
    primaryCategory: 'model_reasoning',
    failureMechanism: 'Describe the observed mechanism.',
    evidence: [
      {
        source: 'machine error',
        fact: 'Preserve the exact task-bound error and owning task.',
      },
    ],
    confidence: 'high',
    limitations: 'none',
  },
  pass: {
    report: '/absolute/path/report.html',
    analysisType: 'passed_result_analysis',
    reportStatus: 'pass',
    resultAssessment: 'inconclusive',
    resultAssessmentReason:
      'Explain whether report evidence proves the recorded pass correct, false, or undecidable.',
    conclusion:
      'Determine whether the passed result is true_pass, false_pass, unverifiable, or inconclusive.',
    evidenceIssue:
      'Describe the reliable but conflicting or ambiguous evidence that prevents a decision.',
    evidence: [
      {
        source: 'report state',
        fact: 'Record the evidence needed to assess the passed result against every required condition.',
      },
    ],
    confidence: 'low',
    limitations: 'State any missing, unreadable, or ambiguous evidence.',
  },
  incomplete: {
    report: '/absolute/path/report.html',
    analysisType: 'incomplete_execution_analysis',
    reportStatus: 'incomplete',
    lastTaskStatus: 'running',
    lastRecordedStep:
      'Identify the last recorded pending, running, cancelled, or unreliable task.',
    conclusion:
      'Separate the observed pre-termination problem from the exact interruption cause.',
    observedIssueStatus: 'inconclusive',
    observedIssue:
      'State what the recorded prefix can and cannot establish about a pre-termination issue.',
    observedIssueConfidence: 'low',
    interruptionCauseStatus: 'inconclusive',
    interruptionReason:
      'Explain which exact interruption causes remain compatible with the record.',
    evidence: [
      {
        source: 'report state',
        fact: 'Record the exact non-terminal task state and the last completed causal context.',
      },
    ],
    limitations: 'The exact external termination event may be absent.',
  },
};

export function getReportAnalysisTemplate(
  reportStatus: ReportStatus,
): MidsceneReportAnalysisResult {
  if (!Object.prototype.hasOwnProperty.call(TEMPLATES, reportStatus)) {
    fail('report status must be one of: pass, fail, incomplete');
  }
  return JSON.parse(JSON.stringify(TEMPLATES[reportStatus]));
}

export interface ReportAnalysisArtifactPaths {
  analysisResultPath: string;
  analysisOutputPath: string;
}

export function writeReportAnalysisTemplateFile(
  reportStatus: ReportStatus,
  htmlPath: string,
  outputDir = process.cwd(),
): ReportAnalysisArtifactPaths {
  const reportName = parse(htmlPath).name || 'report';
  const resolvedOutputDir = resolve(outputDir);
  mkdirSync(resolvedOutputDir, { recursive: true });

  for (let index = 0; ; index += 1) {
    const suffix = index === 0 ? '' : `-${index}`;
    const analysisResultPath = join(
      resolvedOutputDir,
      `${reportName}-analysis-json${suffix}.json`,
    );
    const analysisOutputPath = join(
      resolvedOutputDir,
      `${reportName}-analysis-result${suffix}.md`,
    );
    if (existsSync(analysisResultPath) || existsSync(analysisOutputPath)) {
      continue;
    }

    writeFileSync(
      analysisResultPath,
      `${JSON.stringify(getReportAnalysisTemplate(reportStatus), null, 2)}\n`,
      'utf8',
    );
    return { analysisResultPath, analysisOutputPath };
  }
}

export function parseReportAnalysisResultJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return fail(`invalid JSON: ${detail}`);
  }
}

export function renderReportAnalysisResultFile(filePath: string): string {
  const raw = readFileSync(filePath === '-' ? 0 : filePath, 'utf8');
  return renderReportAnalysisResult(parseReportAnalysisResultJson(raw));
}

function resolveAnalysisMarkdownOutputPath(
  analysisResultPath: string,
  outputPath?: string,
): string {
  if (outputPath) return resolve(outputPath);
  if (analysisResultPath === '-') {
    fail(
      'analysis Markdown output path is required when the analysis result is read from stdin',
    );
  }
  const inputPath = resolve(analysisResultPath);
  const parsed = parse(inputPath);
  const pairedName = parsed.name.match(/^(.*)-analysis-json(-\d+)?$/);
  if (pairedName) {
    return join(
      parsed.dir,
      `${pairedName[1]}-analysis-result${pairedName[2] ?? ''}.md`,
    );
  }
  return join(parsed.dir, `${parsed.name}.md`);
}

export function renderReportAnalysisResultMarkdownFile(
  analysisResultPath: string,
  outputPath?: string,
): string {
  const markdown = renderReportAnalysisResultFile(analysisResultPath);
  const resolvedOutputPath = resolveAnalysisMarkdownOutputPath(
    analysisResultPath,
    outputPath,
  );
  if (
    analysisResultPath !== '-' &&
    resolve(analysisResultPath) === resolvedOutputPath
  ) {
    fail('analysis Markdown output path must differ from the input JSON path');
  }
  mkdirSync(dirname(resolvedOutputPath), { recursive: true });
  writeFileSync(resolvedOutputPath, markdown, 'utf8');
  return resolvedOutputPath;
}
