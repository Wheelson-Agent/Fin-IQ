import * as fs from 'fs';
import * as path from 'path';

const CONFIG_PATH = path.resolve(process.cwd(), 'config/app.config.json');

function getBatchBaseDir() {
    try {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        if (config.paths?.batches) {
            return config.paths.batches;
        }
    } catch (e) {
        // Fallback
    }
    return path.resolve(process.cwd(), 'data/batches');
}

/**
 * Ensures the basic batches directory exists.
 */
export function initBatchesDir() {
    const base = getBatchBaseDir();
    if (!fs.existsSync(base)) {
        fs.mkdirSync(base, { recursive: true });
    }
}

/**
 * Creates the folder structure for a new batch.
 * @param batchName - User-provided batch label
 * @returns Object with paths to the created subfolders
 */
export function createBatchStructure(batchName: string) {
    const base = getBatchBaseDir();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const dateDir = path.join(base, today);
    const batchDir = path.join(dateDir, batchName);

    const subfolders = {
        source: path.join(batchDir, 'source'),
        completed: path.join(batchDir, 'completed'),
        exceptions: path.join(batchDir, 'exceptions'),
    };

    for (const folder of Object.values(subfolders)) {
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }
    }

    return subfolders;
}

/**
 * Moves a file from source to either completed or exceptions based on status.
 */
export async function finalizeFileStorage(batchName: string, fileName: string, isSuccess: boolean, uploadDate?: string) {
    const base = getBatchBaseDir();
    const dateDir = uploadDate || new Date().toISOString().split('T')[0];
    const batchDir = path.join(base, dateDir, batchName);
    const sourcePath = path.join(batchDir, 'source', fileName);
    const targetDir = isSuccess ? path.join(batchDir, 'completed') : path.join(batchDir, 'exceptions');
    const targetPath = path.join(targetDir, fileName);

    if (fs.existsSync(sourcePath)) {
        fs.renameSync(sourcePath, targetPath);
    }
    return targetPath;
}
