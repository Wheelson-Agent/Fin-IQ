import React, { createContext, useContext, useState, useCallback } from 'react';
import type { BatchActivityLog, PipelineStage } from '../components/at/ProcessingPipeline';

export interface StartProcessingInput {
    fileNames: string[];
    filePaths: string[];
    fileDataArrays: number[][];
    batchName: string;
}

export interface PipelineData extends StartProcessingInput {
    pipelineRunId: string;
    pipelineStartedAt: string;
}

const EMPTY_PIPELINE: PipelineData = {
    fileNames: [],
    filePaths: [],
    fileDataArrays: [],
    batchName: '',
    pipelineRunId: '',
    pipelineStartedAt: '',
};

const createPipelineRunId = () => `pipeline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

interface ProcessingContextType {
    isProcessing: boolean;
    pipelineData: PipelineData;
    pipelineStages: PipelineStage[] | null;
    pipelineParticles: Record<string, boolean>;
    pipelineLogs: BatchActivityLog[];
    confirmedUploads: number;
    isExpanded: boolean;
    startProcessing: (data: StartProcessingInput) => void;
    clearProcessing: () => void;
    onStagesChange: (val: PipelineStage[] | ((prev: PipelineStage[]) => PipelineStage[])) => void;
    onParticlesChange: (val: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
    setPipelineLogs: (logs: BatchActivityLog[]) => void;
    setConfirmedUploads: (count: number) => void;
    toggleExpanded: () => void;
}

const ProcessingContext = createContext<ProcessingContextType | undefined>(undefined);

export function ProcessingProvider({ children }: { children: React.ReactNode }) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [pipelineData, setPipelineData] = useState<PipelineData>(EMPTY_PIPELINE);
    const [pipelineStages, setPipelineStages] = useState<PipelineStage[] | null>(null);
    const [pipelineParticles, setPipelineParticles] = useState<Record<string, boolean>>({});
    const [pipelineLogs, setPipelineLogs] = useState<BatchActivityLog[]>([]);
    const [confirmedUploads, setConfirmedUploads] = useState(0);
    const [isExpanded, setIsExpanded] = useState(true);

    const startProcessing = useCallback((data: StartProcessingInput) => {
        setPipelineData({
            ...data,
            pipelineRunId: createPipelineRunId(),
            pipelineStartedAt: new Date().toISOString(),
        });
        setPipelineStages(null);
        setPipelineParticles({});
        setPipelineLogs([]);
        setConfirmedUploads(0);
        setIsExpanded(true);
        setIsProcessing(true);
    }, []);

    const clearProcessing = useCallback(() => {
        setIsProcessing(false);
        setPipelineData(EMPTY_PIPELINE);
        setPipelineStages(null);
        setPipelineParticles({});
        setPipelineLogs([]);
        setConfirmedUploads(0);
    }, []);

    // Accepts both plain arrays and functional updates — prevents stale-closure
    // corruption when the pipeline component is unmounted mid-processing.
    const onStagesChange = useCallback(
        (val: PipelineStage[] | ((prev: PipelineStage[]) => PipelineStage[])) => {
            if (typeof val === 'function') {
                setPipelineStages(prev => (prev ? val(prev) : prev));
            } else {
                setPipelineStages(val);
            }
        },
        []
    );

    const onParticlesChange = useCallback(
        (val: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => {
            if (typeof val === 'function') {
                setPipelineParticles(prev => val(prev));
            } else {
                setPipelineParticles(val);
            }
        },
        []
    );

    const toggleExpanded = useCallback(() => setIsExpanded(e => !e), []);

    return (
        <ProcessingContext.Provider
            value={{
                isProcessing,
                pipelineData,
                pipelineStages,
                pipelineParticles,
                pipelineLogs,
                confirmedUploads,
                isExpanded,
                startProcessing,
                clearProcessing,
                onStagesChange,
                onParticlesChange,
                setPipelineLogs,
                setConfirmedUploads,
                toggleExpanded,
            }}
        >
            {children}
        </ProcessingContext.Provider>
    );
}

export function useProcessing() {
    const context = useContext(ProcessingContext);
    if (!context) throw new Error('useProcessing must be used within a ProcessingProvider');
    return context;
}
