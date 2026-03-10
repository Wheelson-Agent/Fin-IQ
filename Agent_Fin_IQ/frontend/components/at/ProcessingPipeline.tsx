import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle, Loader2, Upload, FileSearch, Cpu, Zap, X } from 'lucide-react';
import { uploadInvoice, runPipeline } from '../../lib/api';

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
    onComplete: () => void;
    onDismiss?: () => void;
    uploaderName?: string;
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
export function ProcessingPipeline({ isBatch, fileNames, batchName, filePaths, fileDataArrays, onComplete, onDismiss, uploaderName }: ProcessingPipelineProps) {
    const STAGES_INIT: PipelineStage[] = [
        { id: 'uploading', label: 'Uploaded', sublabel: isBatch ? `Transferring ${fileNames.length} files...` : 'File secured', icon: <Upload size={28} />, status: 'active' },
        { id: 'analyzing', label: 'Pre-ocr document analysis', sublabel: 'Data extraction & validation', icon: <FileSearch size={28} />, status: 'idle' },
        { id: 'processing', label: 'validation process agent_w processing', sublabel: 'AI analysis & categorization', icon: <Cpu size={28} />, status: 'idle' },
        { id: 'done', label: 'Success', sublabel: 'Processing complete', icon: <Zap size={28} />, status: 'idle' },
    ];

    const willFail = !isBatch && fileNames.some(f => f.toLowerCase().includes('fail'));

    const [stages, setStages] = useState<PipelineStage[]>(STAGES_INIT);
    const [particles, setParticles] = useState<Record<string, boolean>>({});
    const [batchCount, setBatchCount] = useState(0);
    const timers = useRef<ReturnType<typeof setTimeout>[] | ReturnType<typeof setInterval>[]>([]);

    const updateStage = (id: string, status: StageStatus, errorMsg?: string, overrides: Partial<PipelineStage> = {}) => {
        setStages(prev =>
            prev.map(s => (s.id === id ? { ...s, status, errorMsg, ...overrides } : s))
        );
        if (status === 'done' || status === 'error') {
            setParticles(p => ({ ...p, [id]: true }));
            setTimeout(() => setParticles(p => ({ ...p, [id]: false })), 1200);
        }
    };

    const hasRun = useRef(false);

    useEffect(() => {
        if (!filePaths || filePaths.length === 0) return;
        if (hasRun.current) return;
        hasRun.current = true;

        // Reset state on new files
        setStages(STAGES_INIT);
        setParticles({});
        setBatchCount(0);
        timers.current.forEach(t => clearTimeout(t as ReturnType<typeof setTimeout>));
        timers.current = [];

        const processFiles = async () => {
            try {
                // Step 1: Uploading
                updateStage('uploading', 'active');

                const uploadedData = await runWithConcurrency(filePaths, 5, async (fp, i) => {
                    const name = fileNames[i] || `file_${i}`;
                    const fileData = fileDataArrays?.[i];
                    console.log(`[Pipeline] Uploading: ${name} (${fileData ? fileData.length + ' bytes' : 'no data'})`);
                    // @ts-ignore - added uploaderName last
                    const res = await uploadInvoice(fp, name, batchName, fileData, uploaderName);
                    setBatchCount(prev => prev + 1);
                    return { fp, name, invoice: res };
                });

                const uploadFailed = uploadedData.some(d => !d.invoice);
                if (uploadFailed) {
                    console.error('[Pipeline] One or more uploads failed');
                    updateStage('uploading', 'error', 'File storage failed', { sublabel: 'Could not store file in batch folder' });
                    // Clean up and stop
                    for (const data of uploadedData) {
                        if (data.invoice) {
                            // Optionally delete from DB? For now just mark done
                        }
                    }
                    onComplete();
                    return;
                }

                updateStage('uploading', 'done', undefined, {
                    label: 'Uploaded',
                    sublabel: isBatch ? `${fileNames.length} files secured` : 'File secured'
                });

                // Step 2 & 3: Run pipeline for all files in parallel (Pre-OCR -> OCR)
                updateStage('analyzing', 'active');

                const pipelineResults = await runWithConcurrency(uploadedData, 5, async (data) => {
                    if (!data.invoice) return { success: false, error: 'No invoice record' };
                    // Use the correct file path from the created invoice record
                    return await runPipeline(data.invoice.id, data.invoice.file_path, data.name);
                });

                const hasError = pipelineResults.some(r => !r.success);

                if (hasError) {
                    const errorMsgs = pipelineResults.filter(r => !r.success).map(r => r.error).join(' | ');
                    updateStage('analyzing', 'error', undefined, { sublabel: `Error: ${errorMsgs || 'Extraction failed'}` });
                    // Provide error feedback on the processing stage as well
                    updateStage('processing', 'error', undefined, { sublabel: 'Halted due to prior step' });

                    // Finalize storage as failed
                    for (const data of uploadedData) {
                        if (data.invoice) {
                            // @ts-ignore
                            await window.api.invoke('invoices:finalize-batch-file', {
                                id: data.invoice.id,
                                batchId: batchName,
                                fileName: data.name,
                                isSuccess: false
                            });
                        }
                    }
                    onComplete();
                    return;
                }

                updateStage('analyzing', 'done', undefined, { sublabel: '100% confidence extracted' });

                // Step 3: agent_w Processing
                updateStage('processing', 'active');
                // Since OCR already completed in the combined pipeline, we simulate a small delay for cognitive visual feedback 
                await new Promise(r => setTimeout(r, 1000));
                updateStage('processing', 'done', undefined, { sublabel: 'Processing finalized' });

                // Step 4: Done
                updateStage('done', 'active');
                await new Promise(r => setTimeout(r, 1000));

                // Finalize storage on disk (move to completed)
                for (const data of uploadedData) {
                    if (data.invoice) {
                        // @ts-ignore
                        await window.api.invoke('invoices:finalize-batch-file', {
                            id: data.invoice.id,
                            batchId: batchName,
                            fileName: data.name,
                            isSuccess: true
                        });
                    }
                }
                updateStage('done', 'done', undefined, { label: 'Success', sublabel: 'All operations finished' });

                onComplete();
            } catch (err: any) {
                console.error('Pipeline error:', err);
                updateStage('uploading', 'error', 'Upload failed');
            }
        };

        processFiles();
    }, [filePaths, isBatch, batchName]);

    const hasFailed = stages.some(s => s.status === 'error');
    const allDone = stages[3].status === 'done';

    return (
        <motion.div
            className="bg-white rounded-[20px] border border-[#D0D9E8] shadow-[0_8px_40px_rgba(13,27,42,0.08)] overflow-hidden"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        >
            {/* Header bar */}
            <div className="px-[28px] py-[16px] flex items-center justify-between border-b border-[#E2E8F0]"
                style={{ background: 'linear-gradient(135deg, #0B1623 0%, #1A2738 100%)' }}>
                <div className="flex items-center gap-[12px]">
                    <motion.div
                        className="w-[10px] h-[10px] rounded-full"
                        style={{ background: hasFailed ? '#EF4444' : allDone ? '#22C55E' : '#1E6FD9' }}
                        animate={!hasFailed && !allDone ? { opacity: [1, 0.3, 1], scale: [1, 1.3, 1] } : {}}
                        transition={{ duration: 1, repeat: Infinity }}
                    />
                    <span className="text-white font-bold text-[14px]">
                        {hasFailed ? 'Processing Halted' : allDone ? 'Processing Completed' : `Pipeline Active${isBatch ? ` — ${fileNames.length} documents` : ` — ${fileNames[0]}`}`}
                    </span>
                    {isBatch && !allDone && !hasFailed && (
                        <motion.span
                            className="bg-white/10 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold text-white/80 ml-2"
                            animate={{ opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 1.2, repeat: Infinity }}
                        >
                            Batch Progress: {batchCount}/{fileNames.length}
                        </motion.span>
                    )}
                </div>
                {(allDone || hasFailed) && onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="p-1 rounded bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors flex items-center gap-1 text-[12px] font-bold"
                    >
                        Close <X size={14} />
                    </button>
                )}
            </div>

            {/* Body */}
            <div className="px-[40px] py-[40px]">
                <div className="flex items-start justify-between gap-[0px]">
                    {stages.map((stage, i) => (
                        <React.Fragment key={stage.id}>
                            <StageNode stage={stage} index={i} showParticles={particles[stage.id] ?? false} />
                            {i < stages.length - 1 && (
                                <ConnectorBeam
                                    active={stage.status === 'done' || stages[i + 1].status === 'active'}
                                    done={stages[i + 1].status === 'done' || (hasFailed && i < stages.findIndex(s => s.status === 'error'))}
                                    error={stages[i + 1].status === 'error'}
                                />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Batch info footer */}
                {isBatch && hasFailed === false && allDone && (
                    <motion.div
                        className="mt-[32px] overflow-hidden rounded-[16px] relative shadow-[0_8px_32px_rgba(34,197,94,0.15)]"
                        initial={{ opacity: 0, y: 15, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 25 }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-[#22C55E] to-[#10B981] opacity-10" />
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMyMkM1NUUiIGZpbGwtb3BhY2l0eT0iMC4yNCIvPjwvc3ZnPg==')] opacity-30" />
                        <div className="relative px-[24px] py-[20px] border border-[#86EFAC]/50 flex items-center justify-between bg-white/40 backdrop-blur-md">
                            <div className="flex items-center gap-[16px]">
                                <div className="w-[48px] h-[48px] bg-gradient-to-br from-[#22C55E] to-[#10B981] rounded-[14px] flex items-center justify-center shadow-[0_4px_12px_rgba(34,197,94,0.3)] shrink-0">
                                    <CheckCircle size={28} className="text-white" />
                                </div>
                                <div>
                                    <div className="text-[15px] font-black text-[#065F46] tracking-tight mb-[2px]">
                                        Pipeline Execution Spectacularly Successful
                                    </div>
                                    <div className="text-[13px] text-[#047857] font-medium">
                                        All <span className="font-bold text-[#064E3B]">{fileNames.length}</span> documents analyzed, categorized, and finalized with zero errors.
                                    </div>
                                </div>
                            </div>
                            <button onClick={onDismiss} className="bg-white hover:bg-[#F0FDF4] border border-[#86EFAC] text-[#059669] px-[16px] py-[10px] rounded-[10px] text-[13px] font-bold shadow-sm transition-all focus:ring-2 focus:ring-[#22C55E]/50 cursor-pointer">
                                Acknowledge
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Failure message */}
                <AnimatePresence>
                    {hasFailed && !isBatch && (
                        <motion.div
                            className="mt-[32px] bg-[#FEF2F2] border border-[#FECACA] rounded-[12px] p-[16px] text-center"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <div className="flex justify-center mb-2"><XCircle size={24} className="text-[#DC2626]" /></div>
                            <div className="text-[14px] font-bold text-[#DC2626] mb-[4px]">Pipeline Halted</div>
                            <div className="text-[13px] text-[#7F1D1D]">
                                A critical error occurred during document extraction. Please verify the file integrity or provide a clearer scan.
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
