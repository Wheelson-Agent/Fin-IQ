/**
 * TypeScript declarations for the Electron IPC bridge.
 * The electronAPI is exposed via electron/preload.cjs using contextBridge.
 */
interface ElectronAPI {
    invoke: (channel: string, data?: any) => Promise<any>;
    checkN8nStatus?: () => Promise<boolean>;
    checkOcrStatus?: () => Promise<boolean>;
}

interface Window {
    electronAPI?: ElectronAPI;
}
