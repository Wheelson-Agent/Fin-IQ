/**
 * backend/services/batchLogger.ts
 * 
 * Simple in-memory logger for processing batches.
 * Groups logs by batchName and tracks active worker count.
 */

export interface BatchLog {
  id: string;
  batchName: string;
  fileName: string;
  stage: 'Upload' | 'Pre-OCR' | 'OCR' | 'AI-Analysis' | 'Finalizing' | 'System';
  status: 'Started' | 'Completed' | 'Failed' | 'Info';
  message: string;
  timestamp: string;
}

class BatchLogger {
  private logs: Map<string, BatchLog[]> = new Map();
  private allLogs: BatchLog[] = []; // Debug storage
  private activeWorkers: number = 0;

  /**
   * Adds a log entry for a specific batch.
   */
  public addLog(batchName: string, fileName: string, stage: BatchLog['stage'], status: BatchLog['status'], message: string) {
    if (!this.logs.has(batchName)) {
      this.logs.set(batchName, []);
    }

    const log: BatchLog = {
      id: Math.random().toString(36).substring(7),
      batchName,
      fileName,
      stage,
      status,
      message,
      timestamp: new Date().toISOString()
    };

    console.log(`[BatchLogger] Adding log for batch: ${batchName}, file: ${fileName}, stage: ${stage}`);
    this.logs.get(batchName)?.push(log);
    this.allLogs.push(log);
    if (this.allLogs.length > 50) this.allLogs.shift();
    
    // Optional: Keep only last 1000 logs per batch to avoid memory leaks
    const currentBatchLogs = this.logs.get(batchName)!;
    if (currentBatchLogs.length > 1000) {
      this.logs.set(batchName, currentBatchLogs.slice(-1000));
    }
  }

  public getAllLogsDebug(): BatchLog[] {
    return this.allLogs;
  }

  /**
   * Retrieves all logs for a batch.
   */
  public getLogs(batchName: string): BatchLog[] {
    const batchLogs = this.logs.get(batchName) || [];
    console.log(`[BatchLogger] Retrieving ${batchLogs.length} logs for batch: ${batchName}`);
    return batchLogs;
  }

  /**
   * Worker counter management
   */
  public incrementWorkers() {
    this.activeWorkers++;
  }

  public decrementWorkers() {
    this.activeWorkers = Math.max(0, this.activeWorkers - 1);
  }

  public getWorkerCount(): number {
    return this.activeWorkers;
  }

  /**
   * Clears logs for a specific batch.
   */
  public clearBatch(batchName: string) {
    this.logs.delete(batchName);
  }
}

// Export as singleton
export const batchLogger = new BatchLogger();
