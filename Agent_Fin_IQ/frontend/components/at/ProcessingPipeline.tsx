import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle, Loader2, Upload, FileSearch, Cpu, Zap, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { uploadInvoice, runPipeline, getBatchLogs, getWorkerStatus, getAllLogsDebug } from '../../lib/api';
import { Button } from '../../components/ui/button';

/* ─────────────────────────── Types ─────────────────────────── */
export type StageStatus = 'idle' | 'active' | 'done' | 'error';

export interface PipelineStage {
    id: string;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    status: StageStatus;
    errorMsg?: string;
}

export interface ProcessingPipelineProps {
    isBatch: boolean;
    fileNames: string[];
    batchName: string;
    filePaths: string[];
    fileDataArrays?: number[][];  // Raw file data as byte arrays
    stages?: PipelineStage[] | null;
    onStagesChange?: (val: PipelineStage[] | ((prev: PipelineStage[]) => PipelineStage[])) => void;
    particles?: Record<string, boolean>;
    onParticlesChange?: (val: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
    onComplete: () => void;
    onDismiss?: () => void;
    uploaderName?: string;
    onConfirmedCountChange?: (count: number) => void;
}

/**
 * Executes an array of item tasks with a maximum degree of concurrency.
 */
async function runWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    iteratorFn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results: R[] = [];
    const executing = new Set<Promise<any>>();

    for (const [index, item] of items.entries()) {
        const p = iteratorFn(item, index).then((res) => {
            results[index] = res;
            executing.delete(p);
        });
        executing.add(p);
        if (executing.size >= concurrency) {
            await Promise.race(executing);
        }
    }
    await Promise.all(executing);
    return results;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function getHardwareBudget(): number {
    if (typeof navigator !== 'undefined' && Number.isFinite(navigator.hardwareConcurrency)) {
        return navigator.hardwareConcurrency;
    }
    return 4;
}

function getFileComplexityScore(filePath: string, fileName: string, fileData?: number[]): number {
    const candidate = `${fileName || ''} ${filePath || ''}`.toLowerCase();
    const isPdf = candidate.endsWith('.pdf');
    const sizeBytes = Array.isArray(fileData) ? fileData.length : 0;

    if (isPdf && sizeBytes >= 15 * 1024 * 1024) return 3;
    if (isPdf && sizeBytes >= 5 * 1024 * 1024) return 2.5;
    if (isPdf) return 2;
    if (sizeBytes >= 12 * 1024 * 1024) return 2;
    if (sizeBytes >= 4 * 1024 * 1024) return 1.5;
    return 1;
}

function getDynamicConcurrencyPlan(
    filePaths: string[],
    fileNames: string[],
    fileDataArrays?: number[][]
): { upload: number; pipeline: number } {
    const totalFiles = Math.max(filePaths.length, 1);
    const hardwareBudget = getHardwareBudget();
    const complexityScores = filePaths.map((fp, index) =>
        getFileComplexityScore(fp, fileNames[index] || `file_${index}`, fileDataArrays?.[index])
    );
    const highestComplexity = complexityScores.length > 0 ? Math.max(...complexityScores) : 1;
    const pdfCount = filePaths.filter((fp, index) => {
        const candidate = `${fileNames[index] || ''} ${fp || ''}`.toLowerCase();
        return candidate.endsWith('.pdf');
    }).length;

    let pipeline = hardwareBudget >= 12 ? 6 : hardwareBudget >= 8 ? 5 : hardwareBudget >= 4 ? 4 : 2;

    // Large batches: scale up workers so queue wait doesn't dominate total time.
    // OCR is I/O-bound (Google API network wait), so extra workers don't tax CPU.
    if (totalFiles >= 15) pipeline = Math.max(pipeline, 5);
    else if (totalFiles >= 8) pipeline = Math.max(pipeline, 4);

    if (highestComplexity >= 3) {
        pipeline = Math.min(pipeline, 2);
    } else if (highestComplexity >= 2.5 || pdfCount >= Math.max(2, Math.ceil(totalFiles / 2))) {
        pipeline = Math.min(pipeline, 3);
    }

    pipeline = clamp(Math.min(pipeline, totalFiles), 1, 6);

    let upload = hardwareBudget >= 12 ? 4 : hardwareBudget >= 8 ? 4 : hardwareBudget >= 4 ? 3 : 2;
    if (highestComplexity >= 3) {
        upload = Math.min(upload, 2);
    }

    upload = clamp(Math.min(Math.max(upload, pipeline), totalFiles), 1, 4);

    return { upload, pipeline };
}

/* ─────────────────────── Particle component ─────────────────── */
function Particle({ color, delay }: { color: string; delay: number }) {
    const angle = Math.random() * 360;
    const dist = 40 + Math.random() * 60;
    const x = Math.cos((angle * Math.PI) / 180) * dist;
    const y = Math.sin((angle * Math.PI) / 180) * dist;
    return (
        <motion.div
            className="absolute w-[6px] h-[6px] rounded-full pointer-events-none"
            style={{ background: color, top: '50%', left: '50%', marginLeft: -3, marginTop: -3 }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x, y, opacity: 0, scale: 0 }}
            transition={{ duration: 0.8, delay, ease: 'easeOut' }}
        />
    );
}

/* ──────────────────── Connector beam ────────────────────────── */
function ConnectorBeam({ active, done, error }: { active: boolean; done: boolean; error: boolean }) {
    const color = error ? '#EF4444' : done ? '#22C55E' : '#1E6FD9';
    return (
        <div className="flex-1 relative h-[4px] mx-[4px] rounded-full bg-[#E2E8F0] overflow-hidden self-center mt-[-32px]">
            <AnimatePresence>
                {(active || done || error) && (
                    <motion.div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ background: `linear-gradient(90deg, transparent, ${color}, ${color})` }}
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 1.2, ease: 'easeInOut' }}
                    />
                )}
            </AnimatePresence>
            {active && (
                <motion.div
                    className="absolute inset-y-0 w-[40px] rounded-full"
                    style={{ background: `linear-gradient(90deg, transparent, ${color}88, transparent)` }}
                    animate={{ x: ['-40px', '100%'] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                />
            )}
        </div>
    );
}

/* ─────────────────── Stage node ─────────────────────────────── */
function StageNode({ stage, index, showParticles }: { stage: PipelineStage; index: number; showParticles: boolean }) {
    const isActive = stage.status === 'active';
    const isDone = stage.status === 'done';
    const isError = stage.status === 'error';
    const isIdle = stage.status === 'idle';

    const ringColor = isError ? '#FEE2E2' : isDone ? '#D1FAE5' : isActive ? '#DBEAFE' : '#F1F5F9';
    const iconColor = isError ? '#EF4444' : isDone ? '#22C55E' : isActive ? '#1E6FD9' : '#CBD5E1';
    const glowColor = isError ? 'rgba(239,68,68,0.35)' : isDone ? 'rgba(34,197,94,0.35)' : isActive ? 'rgba(30,111,217,0.45)' : 'transparent';

    return (
        <motion.div
            className="flex flex-col items-center gap-[12px] relative z-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, type: 'spring', stiffness: 260, damping: 20 }}
        >
            {/* Node circle */}
            <div className="relative">
                {/* Outer glow ring */}
                <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ background: glowColor, filter: 'blur(12px)', transform: 'scale(1.8)' }}
                    animate={isActive ? { opacity: [0.5, 1, 0.5], scale: [1.6, 2, 1.6] } : { opacity: 1 }}
                    transition={isActive ? { duration: 1.5, repeat: Infinity } : {}}
                />

                {/* Ring */}
                <motion.div
                    className="w-[72px] h-[72px] rounded-full flex items-center justify-center relative"
                    style={{ background: ringColor, border: `3px solid ${isIdle ? '#E2E8F0' : iconColor}` }}
                    animate={isActive ? { boxShadow: [`0 0 0 0px ${glowColor}`, `0 0 0 12px transparent`] } : {}}
                    transition={isActive ? { duration: 1.2, repeat: Infinity } : {}}
                >
                    {/* Icon */}
                    <motion.div
                        animate={isActive ? { rotate: stage.id === 'processing' ? 360 : 0, scale: [1, 1.15, 1] } : {}}
                        transition={
                            isActive && stage.id === 'processing'
                                ? { rotate: { duration: 2, repeat: Infinity, ease: 'linear' }, scale: { duration: 1, repeat: Infinity } }
                                : isActive
                                    ? { duration: 1, repeat: Infinity }
                                    : {}
                        }
                        style={{ color: iconColor }}
                    >
                        {isError ? <XCircle size={32} /> : isDone ? <CheckCircle size={32} /> : isActive && stage.id !== 'uploading' ? <Loader2 size={32} className="animate-spin" /> : stage.icon}
                    </motion.div>

                    {/* Success particles */}
                    {showParticles && isDone && (
                        <>
                            {Array.from({ length: 10 }).map((_, i) => (
                                <Particle key={i} color={iconColor} delay={i * 0.04} />
                            ))}
                        </>
                    )}
                    {showParticles && isError && (
                        <>
                            {Array.from({ length: 8 }).map((_, i) => (
                                <Particle key={i} color="#EF4444" delay={i * 0.04} />
                            ))}
                        </>
                    )}
                </motion.div>

                {/* Step number */}
                <div
                    className="absolute -top-[6px] -right-[6px] w-[20px] h-[20px] rounded-full flex items-center justify-center text-[10px] font-black"
                    style={{
                        background: isIdle ? '#E2E8F0' : iconColor,
                        color: isIdle ? '#94A3B8' : 'white',
                    }}
                >
                    {index + 1}
                </div>
            </div>

            {/* Label */}
            <div className="text-center mt-2">
                <motion.div
                    className="text-[13px] font-bold mb-[2px]"
                    style={{ color: isIdle ? '#94A3B8' : isError ? '#DC2626' : isDone ? '#059669' : '#1A2640' }}
                    layout
                >
                    {stage.label}
                </motion.div>
                <div className="text-[11px] text-[#8899AA] max-w-[120px] transition-colors" style={{ color: isActive ? '#1E6FD9' : '#8899AA' }}>{stage.sublabel}</div>

                {/* Error message */}
                <AnimatePresence>
                    {isError && stage.errorMsg && (
                        <motion.div
                            initial={{ opacity: 0, y: -4, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0 }}
                            className="mt-[6px] bg-[#FEF2F2] border border-[#FECACA] rounded-[6px] px-[8px] py-[5px] text-[10px] text-[#DC2626] font-semibold max-w-[130px] text-center"
                        >
                            ⚠ {stage.errorMsg}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

/* ─────────────────── Main Component ─────────────────────────── */
const processedBatches = new Set<string>();

export function ProcessingPipeline({ 
    isBatch, fileNames, batchName, filePaths, fileDataArrays, 
    onComplete, onDismiss, uploaderName,
    stages: externalStages, onStagesChange,
    particles: externalParticles, onParticlesChange,
    onConfirmedCountChange
}: ProcessingPipelineProps) {
    const STAGES_INIT: PipelineStage[] = [
        { id: 'uploading', label: 'Uploaded', sublabel: isBatch ? `Transferring ${fileNames.length} files...` : 'File secured', icon: <Upload size={28} />, status: 'active' },
        { id: 'analyzing', label: 'Pre-ocr document analysis', sublabel: 'Data extraction & validation', icon: <FileSearch size={28} />, status: 'idle' },
        { id: 'processing', label: 'validation process agent_w processing', sublabel: 'AI analysis & categorization', icon: <Cpu size={28} />, status: 'idle' },
        { id: 'done', label: 'Success', sublabel: 'Processing complete', icon: <Zap size={28} />, status: 'idle' },
    ];

    const [internalStages, setInternalStages] = useState<PipelineStage[]>(STAGES_INIT);
    const [internalParticles, setInternalParticles] = useState<Record<string, boolean>>({});
    
    // Sync with external state
    const stages = externalStages || internalStages;
    const particles = externalParticles || internalParticles;
    
    // Pass functional updates straight through to the external handler so the
    // caller can use React's own functional-setState form, avoiding stale-closure
    // issues when this component unmounts while an async pipeline is still running.
    const setStages = (val: PipelineStage[] | ((prev: PipelineStage[]) => PipelineStage[])) => {
        if (onStagesChange) {
            onStagesChange(val);
        } else if (typeof val === 'function') {
            setInternalStages(val);
        } else {
            setInternalStages(val);
        }
    };

    const setParticlesState = (val: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => {
        if (onParticlesChange) {
            onParticlesChange(val);
        } else if (typeof val === 'function') {
            setInternalParticles(val);
        } else {
            setInternalParticles(val);
        }
    };

    const [batchCount, setBatchCount] = useState(0);
    const [confirmedCount, setConfirmedCount] = useState(0);
    const [logs, setLogs] = useState<any[]>([]);
    const [workerCount, setWorkerCount] = useState(0);
    const [lastUpdate, setLastUpdate] = useState<string>('');
    const [activeFileName, setActiveFileName] = useState<string>('');
    const timers = useRef<ReturnType<typeof setTimeout>[] | ReturnType<typeof setInterval>[]>([]);
    const logScrollRef = useRef<HTMLDivElement>(null);
    const concurrencyPlan = useMemo(
        () => getDynamicConcurrencyPlan(filePaths, fileNames, fileDataArrays),
        [fileDataArrays, fileNames, filePaths]
    );

    // Periodic log and worker status fetching
    useEffect(() => {
        if (!batchName) return;

        const interval = setInterval(async () => {
            try {
                console.log(`[Pipeline] Polling logs for batch: ${batchName}`);
                const [fetchedLogs, status, debugLogs] = await Promise.all([
                    getBatchLogs(batchName),
                    getWorkerStatus(),
                    getAllLogsDebug()
                ]);
                
                console.log(`[Pipeline] Response: batch=${fetchedLogs?.length||0}, debug=${debugLogs?.length||0}`);
                setLogs(fetchedLogs || []);
                setWorkerCount(status?.activeWorkers || 0);
                setLastUpdate(new Date().toLocaleTimeString('en-IN', { hour12: false }));
            } catch (err) {
                console.error('[Pipeline] Failed to fetch logs/status', err);
            }
        }, 2000); // Poll every 2 seconds

        return () => clearInterval(interval);
    }, [batchName]);

    useEffect(() => {
        const el = logScrollRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom < 80) {
            el.scrollTop = el.scrollHeight;
        }
    }, [logs]);

    useEffect(() => {
        if (onConfirmedCountChange) {
            onConfirmedCountChange(confirmedCount);
        }
    }, [confirmedCount, onConfirmedCountChange]);

    const updateStage = (id: string, status: StageStatus, errorMsg?: string, overrides: Partial<PipelineStage> = {}) => {
        setStages(prev =>
            prev.map(s => (s.id === id ? { ...s, status, errorMsg, ...overrides } : s))
        );
        if (status === 'done' || status === 'error') {
            setParticlesState(p => ({ ...p, [id]: true }));
            setTimeout(() => setParticlesState(p => ({ ...p, [id]: false })), 1200);
        }
    };

    useEffect(() => {
        if (!filePaths || filePaths.length === 0) return;
        
        // Prevent React 18 Strict Mode double-firing the pipeline for the exact same batch
        if (batchName && processedBatches.has(batchName)) return;

        // If we have external stages already progressed beyond initial, don't restart
        const hasExternalProgress = externalStages && externalStages.some(s => 
            (s.id !== 'uploading' && s.status !== 'idle') || 
            (s.id === 'uploading' && (s.status === 'done' || s.status === 'error'))
        );

        if (hasExternalProgress) {
            if (batchName) processedBatches.add(batchName);
            return;
        }
        
        if (batchName) processedBatches.add(batchName);

        // Reset state on new files if not already initialized externally
        if (!externalStages) {
            setStages(STAGES_INIT);
            setParticlesState({});
        }
        setBatchCount(0);
        timers.current.forEach(t => clearTimeout(t as ReturnType<typeof setTimeout>));
        timers.current = [];

        const processFiles = async () => {
            try {
                console.log(`[Pipeline] Dynamic concurrency selected for ${batchName || 'single-run'}: upload=${concurrencyPlan.upload}, pipeline=${concurrencyPlan.pipeline}`);
                // Step 1: Uploading
                updateStage('uploading', 'active');

                const uploadedData = await runWithConcurrency(filePaths, concurrencyPlan.upload, async (fp, i) => {
                    const name = fileNames[i] || `file_${i}`;
                    setActiveFileName(name);
                    const fileData = fileDataArrays?.[i];
                    
                    try {
                        // @ts-ignore - added uploaderName last
                        const res = await uploadInvoice(fp, name, batchName, fileData, uploaderName);
                        if (res && res.id) {
                            setConfirmedCount(prev => prev + 1);
                        }
                        setBatchCount(prev => prev + 1);
                        return { fp, name, invoice: res };
                    } catch (err) {
                        console.error(`[Pipeline] Upload failed for ${name}:`, err);
                        setBatchCount(prev => prev + 1);
                        return { fp, name, invoice: null };
                    }
                });

                const allUploadFailed = uploadedData.every(d => !d.invoice);
                const someUploadFailed = uploadedData.some(d => !d.invoice);

                if (allUploadFailed) {
                    updateStage('uploading', 'error', 'All uploads failed', { sublabel: 'Could not store any files' });
                    onComplete();
                    return;
                }

                updateStage('uploading', 'done', undefined, {
                    label: 'Uploaded',
                    sublabel: someUploadFailed 
                        ? `${uploadedData.filter(d => d.invoice).length}/${fileNames.length} secured` 
                        : (isBatch ? `${fileNames.length} files secured` : 'File secured')
                });

                // Step 2 & 3: Run pipeline for successful files
                updateStage('analyzing', 'active');
                setBatchCount(0); 
                const successfulUploads = uploadedData.filter(d => d.invoice);

                const pipelineResults = await runWithConcurrency(successfulUploads, concurrencyPlan.pipeline, async (data) => {
                    if (!data.invoice) return { success: false, error: 'No invoice record' };
                    setActiveFileName(data.name);
                    try {
                        const res = await runPipeline(data.invoice.id, data.invoice.file_path, data.name, batchName);
                        // Finalize immediately (Success or Failure)
                        // @ts-ignore
                        await window.api.invoke('invoices:finalize-batch-file', {
                            id: data.invoice.id,
                            batchId: batchName,
                            fileName: data.name,
                            isSuccess: res.success
                        });
                        setBatchCount(prev => prev + 1);
                        window.dispatchEvent(new Event('app:refresh'));
                        return res;
                    } catch (err: any) {
                        console.error(`[Pipeline] runPipeline failed for ${data.name}:`, err);
                        // Finalize as failure
                        // @ts-ignore
                        await window.api.invoke('invoices:finalize-batch-file', {
                            id: data.invoice.id,
                            batchId: batchName,
                            fileName: data.name,
                            isSuccess: false
                        });
                        setBatchCount(prev => prev + 1);
                        window.dispatchEvent(new Event('app:refresh'));
                        return { success: false, error: err.message || 'Processing error' };
                    }
                });

                const allPipelineFailed = pipelineResults.every(r => !r.success);
                const somePipelineFailed = pipelineResults.some(r => !r.success);

                if (allPipelineFailed) {
                    updateStage('analyzing', 'error', 'Extraction failed', { sublabel: 'All files failed OCR/Analysis' });
                    onComplete();
                    return;
                }

                updateStage('analyzing', 'done', undefined, { 
                    sublabel: somePipelineFailed 
                        ? `${pipelineResults.filter(r => r.success).length}/${pipelineResults.length} extracted` 
                        : '100% confidence extracted' 
                });

                // Step 3: agent_w Processing
                updateStage('processing', 'active');
                await new Promise(r => setTimeout(r, 1000));
                updateStage('processing', 'done', undefined, { sublabel: 'Processing finalized' });

                // Step 4: Done
                updateStage('done', 'active');
                await new Promise(r => setTimeout(r, 1000));
                updateStage('done', 'done', undefined, { label: 'Success', sublabel: somePipelineFailed ? 'Completed with partial failures' : 'All operations finished' });

                onComplete();
            } catch (err: any) {
                console.error('Pipeline error:', err);
                const errMsg = err.message || 'Unknown error';
                updateStage('uploading', 'error', 'Upload failed', { 
                    sublabel: errMsg.includes('disk') ? 'Disk space error' : 
                              errMsg.includes('permission') ? 'Folder permission denied' : 
                              `Technical error: ${errMsg}`
                });
            }
        };

        processFiles();
    }, [filePaths, isBatch, batchName]);

    const hasFailed = stages.some((s: PipelineStage) => s.status === 'error');
    const allDone = stages[3].status === 'done';

    return (
        <div className="w-full h-full flex flex-col pt-4">
            {/* Steps Container */}
            <div className="flex-1 overflow-y-auto px-4 pb-12">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                    <div className="bg-[#1A2640] px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                            <h3 className="text-white font-bold tracking-tight text-sm">
                                {hasFailed ? 'Processing Halted' : allDone ? 'Internal Processing Complete' : `Processing: ${activeFileName || 'Initializing...'}`}
                            </h3>
                            {isBatch && !allDone && !hasFailed && (
                                <span className="text-[10px] bg-white/10 text-blue-200 px-2 py-0.5 rounded-full font-mono border border-white/5">
                                    Item {batchCount}/{fileNames.length}
                                </span>
                            )}
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-md font-bold uppercase border border-emerald-500/30">
                                Active Workers: {workerCount}
                            </span>
                        </div>
                        {onDismiss && (
                            <button 
                                onClick={onDismiss}
                                className="text-slate-400 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                            >
                                <X size={14} /> Close
                            </button>
                        )}
                    </div>

                    <div className="p-10 border-b border-slate-100">
                        <div className="relative flex items-center justify-between gap-4">
                            {/* Horizontal Line Background */}
                            <div className="absolute top-[35px] left-0 right-0 h-[2px] bg-slate-100 -z-0" />
                            
                            {stages.map((stage: PipelineStage, i: number) => (
                                <React.Fragment key={stage.id}>
                                    <StageNode stage={stage} index={i} showParticles={particles[stage.id] ?? false} />
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    {/* Logs Area — Grouped by File */}
                    <div className="bg-[#0F172A] p-0 flex flex-col h-[320px]">
                        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Batch Activity Logs</span>
                                {lastUpdate && <span className="text-[9px] text-slate-500 font-mono animate-pulse">Syncing... {lastUpdate}</span>}
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">{batchName}</span>
                        </div>
                        <div 
                            ref={logScrollRef}
                            className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-white/10"
                        >
                            {logs.length === 0 && (
                                <div className="text-slate-600 italic">Waiting for processing events...</div>
                            )}
                            
                            {/* Group logs by fileName */}
                            {Array.from(new Set(logs.map(l => l.fileName))).map(fileName => {
                                const fileLogs = logs.filter(l => l.fileName === fileName);
                                const lastStage = fileLogs[fileLogs.length - 1]?.stage;
                                const isFailed = fileLogs.some(l => l.status === 'Failed');
                                
                                return (
                                    <div key={fileName} className="mb-6 last:mb-0 border-l border-white/5 pl-4 ml-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-blue-400 font-bold">{fileName}</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-black tracking-tighter ${
                                                isFailed ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/10 text-blue-300'
                                            }`}>
                                                {isFailed ? 'FAILED' : lastStage || 'QUEUED'}
                                            </span>
                                        </div>
                                        <div className="space-y-1 opacity-80">
                                            {fileLogs.map((log) => (
                                                <div key={log.id} className="flex gap-2">
                                                    <span className="text-slate-600 shrink-0 text-[10px]">[{new Date(log.timestamp).toLocaleTimeString('en-IN', { hour12: false })}]</span>
                                                    <span className="text-slate-400 shrink-0 select-none w-16 uppercase text-[9px] pt-0.5 font-black">[{log.stage}]</span>
                                                    <span style={{ 
                                                        color: log.status === 'Completed' ? '#4ADE80' : log.status === 'Failed' ? '#FB7185' : '#E2E8F0' 
                                                    }}>
                                                        {log.status === 'Failed' ? '✖ ' : log.status === 'Completed' ? '✔ ' : '→ '}
                                                        {log.message}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-10 bg-slate-50/50">
                        <AnimatePresence>
                            {hasFailed && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-12 p-8 rounded-xl bg-red-50/50 border border-red-100 flex flex-col items-center text-center gap-3"
                                >
                                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 shadow-sm">
                                        <AlertCircle size={24} />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <h4 className="text-lg font-bold text-red-900">Pipeline Halted</h4>
                                        <p className="text-sm text-red-600/80 max-w-md font-medium">
                                            A technical error occurred during processing. Please verify configurations or provide a clearer scan.
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {allDone && !hasFailed && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-12 p-8 rounded-xl bg-emerald-50/50 border border-emerald-100 flex flex-col items-center text-center gap-3 shadow-sm"
                                >
                                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                        <CheckCircle2 size={24} />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <h4 className="text-lg font-bold text-emerald-900">All Operations Finished</h4>
                                        <p className="text-sm text-emerald-600/80 font-medium">
                                            Documents are now available in the "Ready" or "Received" tabs.
                                        </p>
                                    </div>
                                    <Button 
                                        onClick={onDismiss} 
                                        className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-md"
                                    >
                                        Back to Dashboard
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}
