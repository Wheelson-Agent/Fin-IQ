/**
 * Agent_Fin_IQ\backend\sync\n8nStatusWatcher.ts
 * 
 * Standardized n8n health watcher service.
 * Monitoring service that polls n8n health and caches the result for the frontend.
 */

import { BrowserWindow } from 'electron';

export type N8nStatus = 'live' | 'offline' | 'unknown';

export interface N8nStatusResponse {
  service: 'n8n';
  status: N8nStatus;
  endpoint: string | null;
  checkedAt: string;
  reason?: string;
}

class N8nStatusWatcher {
  private currentStatus: N8nStatusResponse;
  private intervalId: NodeJS.Timeout | null = null;
  private isChecking: boolean = false;
  
  // Configuration
  private readonly pollInterval: number = 30000; // 30s default
  private readonly timeout: number = 5000;       // 5s default

  constructor() {
    this.currentStatus = {
      service: 'n8n',
      status: 'unknown',
      endpoint: this.getHealthEndpoint(),
      checkedAt: new Date().toISOString(),
      reason: 'Watcher initialized, waiting for first check.'
    };
  }

  /**
   * Derives the health endpoint from the validation URL in .env
   */
  private getHealthEndpoint(): string | null {
    const url = process.env.N8N_VALIDATION_URL;
    if (!url) return null;
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}/healthz`;
    } catch {
      return null;
    }
  }

  /**
   * Performs the health check fetch logic
   */
  public async checkNow(): Promise<N8nStatusResponse> {
    if (this.isChecking) return this.currentStatus;
    
    this.isChecking = true;
    const endpoint = this.getHealthEndpoint();
    const now = new Date().toISOString();

    if (!endpoint) {
      this.updateState({
        status: 'unknown',
        endpoint: null,
        checkedAt: now,
        reason: 'N8N_VALIDATION_URL is not configured in .env'
      });
      this.isChecking = false;
      return this.currentStatus;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeout)
      });

      if (response.ok) {
        this.updateState({
          status: 'live',
          endpoint,
          checkedAt: now,
          reason: undefined
        });
      } else {
        this.updateState({
          status: 'offline',
          endpoint,
          checkedAt: now,
          reason: `n8n responded with status: ${response.status} ${response.statusText}`
        });
      }
    } catch (error: any) {
      this.updateState({
        status: 'offline',
        endpoint,
        checkedAt: now,
        reason: error instanceof Error ? error.message : 'Unknown connection error'
      });
    } finally {
      this.isChecking = false;
    }

    return this.currentStatus;
  }

  /**
   * Updates the internal state and broadcasts to UI
   */
  private updateState(update: Partial<N8nStatusResponse>) {
    const hasChanged = update.status !== this.currentStatus.status;
    
    this.currentStatus = {
      ...this.currentStatus,
      ...update
    };

    // If status changed or explicitly required, push to UI
    if (hasChanged) {
      console.log(`[n8nWatcher] Status changed: ${this.currentStatus.status} (${this.currentStatus.reason || 'OK'})`);
      this.broadcast();
    }
  }

  /**
   * Broadcasts the latest status to all Electron windows
   */
  private broadcast() {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
      if (!win.isDestroyed()) {
        // We push the full response object
        win.webContents.send('n8n:status-update', this.currentStatus);
      }
    });
  }

  /**
   * Start periodic health monitoring
   */
  public start(intervalMs?: number) {
    if (this.intervalId) return;
    
    const interval = intervalMs || this.pollInterval;
    console.log(`[n8nWatcher] Starting watcher (Interval: ${interval}ms)`);
    
    this.checkNow();
    this.intervalId = setInterval(() => this.checkNow(), interval);
  }

  /**
   * Stop periodic health monitoring
   */
  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[n8nWatcher] Watcher stopped');
    }
  }

  /**
   * Returns the latest cached status object
   */
  public getStatus(): N8nStatusResponse {
    return this.currentStatus;
  }
}

// Export as a singleton
export const n8nWatcher = new N8nStatusWatcher();

// Also export convenient wrapper functions if needed for direct imports
export function startWatching() { n8nWatcher.start(); }
export function stopWatching() { n8nWatcher.stop(); }
export function getStatus() { return n8nWatcher.getStatus(); }
export function checkNow() { return n8nWatcher.checkNow(); }
