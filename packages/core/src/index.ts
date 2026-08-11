import { z } from 'zod';
import Service from './service/index';
import { TaskRunner } from './task-runner';
import { getVersion } from './utils';

export {
  plan,
  AiLocateElement,
  runConnectivityTest,
  getMidsceneLocationSchema,
  PointSchema,
  SizeSchema,
  RectSchema,
  TMultimodalPromptSchema,
  TUserPromptSchema,
  type TMultimodalPrompt,
  type TUserPrompt,
  type ConnectivityTestConfig,
  type ConnectivityTestResult,
} from './ai-model/index';

export {
  MIDSCENE_MODEL_NAME,
  type CreateOpenAIClientFn,
} from '@midscene/shared/env';

export type * from './types';
export {
  ServiceError,
  ExecutionDump,
  ReportActionDump,
  GroupedActionDump,
  type IExecutionDump,
  type IReportActionDump,
  type IGroupedActionDump,
  type ReportMeta,
  type GroupMeta,
} from './types';

export { z };

export default Service;
export { TaskRunner, Service, getVersion };

export type {
  MidsceneYamlScript,
  MidsceneYamlTask,
  MidsceneYamlFlowItem,
  MidsceneYamlConfigResult,
  MidsceneYamlConfig,
  MidsceneYamlScriptWebEnv,
  MidsceneYamlScriptAndroidEnv,
  MidsceneYamlScriptIOSEnv,
  MidsceneYamlScriptEnv,
  LocateOption,
  DetailedLocateParam,
} from './yaml';

export {
  Agent,
  type AgentOpt,
  type AiActOptions,
  type GherkinStepKeyword,
  type MidsceneUsageMetrics,
  type RunGherkinScenarioOptions,
  type UsageBucket,
  createAgent,
  type UIObservation,
  type UIObserver,
  type UIObserverOption,
} from './agent';
export {
  describeElementAtPoint,
  verifyElementDescriptionAtPoint,
  verifyLocator,
  type DescribeElementAtPointOptions,
  type DescribeElementCoordinateSpace,
  type ElementDescriberRuntime,
  type VerifyElementDescriptionAtPointOptions,
} from './element-describer';

// Dump utilities
export {
  restoreImageReferences,
  escapeContent,
  unescapeContent,
  parseImageScripts,
  parseDumpScript,
  parseDumpScriptAttributes,
  generateImageScriptTag,
  generateDumpScriptTag,
  deriveTaskStatus,
  deriveCaseStatus,
} from './dump';
export type { TaskStatusFields, DerivedTaskStatus } from './dump';
export {
  getTaskSearchArea,
  getTaskServiceDump,
} from './dump/task-service-dump';

// Report generator
export type { IReportGenerator } from './report-generator';
export { ReportGenerator, nullReportGenerator } from './report-generator';
export {
  collectDedupedExecutions,
  ReportMergingTool,
  dedupeExecutionsKeepLatest,
  splitReportHtmlByExecution,
} from './report';
export {
  createReportCliCommands,
  reportFileToMarkdown,
  splitReportFile,
  mergeReportFiles,
  type ConsumeReportFileAction,
  type ReportFileToMarkdownOptions,
  type ReportCliCommandDefinition,
  type ReportCliCommandEntry,
  type SplitReportFileOptions,
  type MergeReportFilesOptions,
  type MergeReportFilesResult,
} from './report-cli';
export {
  REPORT_ANALYSIS_CATEGORY_LABELS,
  REPORT_ANALYSIS_CONFIDENCE_LEVELS,
  REPORT_EVIDENCE_SOURCES,
  REPORT_FAILED_RESULT_ASSESSMENTS,
  REPORT_INCOMPLETE_EXECUTION_LAST_TASK_STATUSES,
  REPORT_INTERRUPTION_CAUSE_STATUSES,
  REPORT_OBSERVED_ISSUE_STATUSES,
  REPORT_PASSED_RESULT_ASSESSMENTS,
  REPORT_RESULT_ASSESSMENTS,
  REPORT_ROOT_CAUSE_STATUSES,
  getReportAnalysisTemplate,
  parseReportAnalysisResultJson,
  renderReportAnalysisResult,
  renderReportAnalysisResultFile,
  renderReportAnalysisResultMarkdownFile,
  validateReportAnalysisResult,
  type MidsceneReportAnalysisResult,
  type ReportAnalysisCategory,
  type ReportAnalysisConfidence,
  type ReportAnalysisContributor,
  type ReportAnalysisEvidence,
  type ReportIncompleteExecutionAnalysisResult,
  type ReportIncompleteExecutionLastTaskStatus,
  type ReportInterruptionCauseStatus,
  type ReportObservedIssueStatus,
  type ReportEvidenceSource,
  type ReportFailedResultAnalysisResult,
  type ReportFailedResultAssessment,
  type ReportPassedResultAnalysisResult,
  type ReportPassedResultAssessment,
  type ReportResultAssessment,
  type ReportRootCauseStatus,
} from './report-analysis-result';
export {
  REPORT_STATUSES,
  inspectReport,
  inspectReportFile,
  type InspectReportOptions,
  type InspectReportFileOptions,
  type PublicReportInspectionResult,
  type ReportInspectionResult,
  type ReportStatus,
} from './report-inspection';

// ScreenshotItem
export { ScreenshotItem } from './screenshot-item';
export { ScreenshotStore, type ScreenshotRef } from './dump/screenshot-store';

export {
  executionToMarkdown,
  reportToMarkdown,
  type ExecutionMarkdownOptions,
  type ExecutionMarkdownResult,
  type ReportMarkdownResult,
  type MarkdownAttachment,
} from './report-markdown';
