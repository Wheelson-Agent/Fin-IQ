/**
 * ============================================================
 * pre-ocr/types.ts — Shared Types for the Pre-OCR Pipeline
 * ============================================================
 *
 * PURPOSE:
 *   Defines all TypeScript interfaces used across the Pre-OCR
 *   module. These types ensure consistent data shape between
 *   the engine, rasterizer, and the database layer.
 * ============================================================
 */

/**
 * Valid status values for a pipeline stage.
 * NOT_STARTED → RUNNING → PASSED / FAILED / SKIPPED
 */
export type StageStatus = 'NOT_STARTED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED' | 'WARNING';

/**
 * The 7 stages of the Pre-OCR pipeline, in execution order.
 */
export const PRE_OCR_STAGES = [
    'Upload / Ingestion',
    'File Validation',
    'Image Extraction & Normalization',
    'Image Quality Assessment',
    'Image Enhancement',
    'Structural Analysis',
    'Decision Engine',
] as const;

/**
 * Represents a single artifact produced by a stage.
 * Example: a PNG image, a JSON report, a log file.
 */
export interface StageArtifact {
    type: string;       // 'PNG' | 'JSON' | 'LOG'
    name: string;       // filename
    createdAt: string;   // ISO timestamp
}

/**
 * State of a single pipeline stage.
 */
export interface StageState {
    name: string;
    status: StageStatus;
    startedAt: string | null;
    endedAt: string | null;
    reasonCodes: string[];       // machine-readable reason codes
    metrics: Record<string, any>; // stage-specific measurements
    artifacts: StageArtifact[];
}

/**
 * Event log entry for the processing timeline.
 */
export interface JobEvent {
    timestamp: string;
    stage: string;
    message: string;
    severity: 'INFO' | 'WARN' | 'ERROR';
}

/**
 * Decision output from Stage 7 (Decision Engine).
 */
export interface DecisionOutput {
    route: 'OCR_READY' | 'ENHANCE_REQUIRED' | 'MANUAL_REVIEW' | 'FAILED';
    confidence: number;
    reasons: string[];
}

/**
 * Complete state of a Pre-OCR processing job.
 * This is the root object that tracks an invoice through all 7 stages.
 */
export interface JobState {
    jobId: string;
    fileName: string;
    inputKind?: 'pdf' | 'image';
    createdAt: string;
    status: 'processing' | 'completed' | 'failed';
    currentStage: string;
    stages: Record<string, StageState>;
    decisionOutput: DecisionOutput | null;
    events: JobEvent[];
}

/**
 * Validate that a status string is a valid StageStatus.
 * Throws if invalid — used as a runtime guard.
 *
 * @param status - Status string to validate
 */
export function assertValidStageStatus(status: string): asserts status is StageStatus {
    const valid: StageStatus[] = ['NOT_STARTED', 'RUNNING', 'PASSED', 'FAILED', 'SKIPPED', 'WARNING'];
    if (!valid.includes(status as StageStatus)) {
        throw new Error(`Invalid stage status: ${status}`);
    }
}
