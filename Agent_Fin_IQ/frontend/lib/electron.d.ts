/**
 * TypeScript declarations for the Electron IPC bridge.
 * The electronAPI is exposed via electron/preload.cjs using contextBridge.
 */
interface ElectronAPI {
    invoke: (channel: string, data?: any) => Promise<any>;
    on: (channel: string, callback: (data: any) => void) => void;
    getPathForFile: (file: File) => string;
    checkN8nStatus?: () => Promise<boolean>;
    checkOcrStatus?: () => Promise<boolean>;
}

interface Window {
    api: ElectronAPI;
}
