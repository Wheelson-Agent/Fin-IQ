import React, { useState, useEffect } from 'react';
import { Database, Terminal, CheckCircle, XCircle, Clock, Search, Code, RefreshCw } from 'lucide-react';
import { getTallySyncLogs } from '../lib/api';
import type { TallySyncLog } from '../lib/types';
import { SectionHeader } from '../components/at/SectionHeader';
import { motion, AnimatePresence } from 'motion/react';

export default function TallySyncLogs() {
    const [logs, setLogs] = useState<TallySyncLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const data = await getTallySyncLogs();
            setLogs(data || []);
        } catch (err) {
            console.error('[TallySyncLogs] Failed to fetch:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const formatTimestamp = (ts: string) => {
        const d = new Date(ts);
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500">
            <div className="mb-6 flex justify-between items-end">
                <SectionHeader
                    title="Tally Sync Monitor"
                    description="Real-time XML exchange logs between Fin-IQ and Tally Prime."
                />
                <button
                    onClick={fetchLogs}
                    className="mb-[20px] flex items-center gap-2 px-3 py-1.5 bg-[#F1F5F9] text-[#475569] rounded-lg text-[12px] font-bold hover:bg-[#E2E8F0] transition-colors"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh Logs
                </button>
            </div>

            <div className="flex-1 overflow-auto">
                <div className="bg-white rounded-[20px] border border-[#D0D9E8]/50 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#F8FAFC] border-b border-[#D0D9E8]/50">
                                <th className="p-4 text-[11px] font-black text-[#8899AA] uppercase tracking-widest">Status</th>
                                <th className="p-4 text-[11px] font-black text-[#8899AA] uppercase tracking-widest">Time</th>
                                <th className="p-4 text-[11px] font-black text-[#8899AA] uppercase tracking-widest">Entity Type</th>
                                <th className="p-4 text-[11px] font-black text-[#8899AA] uppercase tracking-widest">Entity ID</th>
                                <th className="p-4 text-[11px] font-black text-[#8899AA] uppercase tracking-widest">Response</th>
                                <th className="p-4 w-[100px]"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => (
                                <React.Fragment key={log.id}>
                                    <tr
                                        onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                                        className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                                    >
                                        <td className="p-4">
                                            {log.status === 'Success' ? (
                                                <div className="flex items-center gap-2 text-emerald-600">
                                                    <CheckCircle size={16} />
                                                    <span className="text-[12px] font-bold">In Sync</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-rose-600">
                                                    <XCircle size={16} />
                                                    <span className="text-[12px] font-bold">Failed</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-[12px] text-[#475569] font-mono">{formatTimestamp(log.created_at)}</td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-bold uppercase tracking-wider border border-indigo-100">
                                                {log.entity_type}
                                            </span>
                                        </td>
                                        <td className="p-4 text-[12px] text-[#475569] truncate max-w-[150px] font-mono">{log.entity_id}</td>
                                        <td className="p-4">
                                            <span className={`text-[12px] font-medium ${log.status === 'Error' ? 'text-rose-500' : 'text-[#8899AA]'}`}>
                                                {log.error_message || 'Tally Response OK'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center gap-2 text-[#8899AA]">
                                                <Terminal size={14} />
                                                <span className="text-[10px] font-bold">XML</span>
                                            </div>
                                        </td>
                                    </tr>
                                    <AnimatePresence>
                                        {expandedLogId === log.id && (
                                            <tr>
                                                <td colSpan={6} className="p-0 bg-[#0F172A]">
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="p-6 grid grid-cols-2 gap-6 h-[400px]">
                                                            <div className="flex flex-col h-full">
                                                                <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                    <Code size={12} /> Request Envelope (Fin-IQ)
                                                                </div>
                                                                <pre className="flex-1 bg-black/30 border border-white/10 rounded-lg p-3 text-[11px] text-[#91D5FF] font-mono overflow-auto scrollbar-thin scrollbar-thumb-white/10">
                                                                    {log.request_xml || 'No request data captured.'}
                                                                </pre>
                                                            </div>
                                                            <div className="flex flex-col h-full">
                                                                <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                    <Database size={12} /> Response Envelope (Tally)
                                                                </div>
                                                                <pre className={`flex-1 bg-black/30 border border-white/10 rounded-lg p-3 text-[11px] font-mono overflow-auto scrollbar-thin scrollbar-thumb-white/10 ${log.status === 'Error' ? 'text-rose-300' : 'text-[#B7EB8F]'}`}>
                                                                    {log.response_xml || 'No response data captured.'}
                                                                </pre>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                </td>
                                            </tr>
                                        )}
                                    </AnimatePresence>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                    {logs.length === 0 && !loading && (
                        <div className="p-20 text-center">
                            <Database size={48} className="mx-auto text-[#D0D9E8] mb-4" />
                            <div className="text-[14px] font-bold text-[#1A2640]">No Sync Logs Yet</div>
                            <div className="text-[12px] text-[#8899AA]">Sync data with Tally to start monitoring.</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
