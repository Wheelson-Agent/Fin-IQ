# Electron Shell

This folder contains the Electron-specific entry points that create the desktop window and bridge the frontend to the backend.

## Files

| File | Purpose |
|------|---------|
| `main.js` | Creates the BrowserWindow, loads the backend, serves the React frontend |
| `preload.js` | Securely exposes IPC channels to the React frontend via `contextBridge` |

## How It Works

1. `main.js` starts → initializes the backend (`backend/main.ts`)
2. Creates a BrowserWindow → loads the React app (Vite dev server or built files)
3. `preload.js` exposes `window.api.invoke()` to the React app
4. React pages call `window.api.invoke('channel-name', data)` to communicate with the backend
