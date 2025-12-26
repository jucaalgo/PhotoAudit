
import React, { useEffect, useState } from 'react';
import { logger, LogEntry } from '../services/LoggerService';

export const SystemLogViewer = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const updateLogs = () => setLogs([...logger.getLogs()]);

        // Initial load
        updateLogs();

        // Listen for updates
        window.addEventListener('PHOTOAUDIT_LOG_UPDATE', updateLogs);
        return () => window.removeEventListener('PHOTOAUDIT_LOG_UPDATE', updateLogs);
    }, []);

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'ERROR': return 'text-red-500';
            case 'WARN': return 'text-yellow-500';
            case 'SUCCESS': return 'text-green-400';
            default: return 'text-slate-400';
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-slate-900 border border-slate-700 hover:border-blue-500/50 p-2 rounded shadow-2xl hover:bg-slate-800 transition-all z-50 text-[10px] font-mono tracking-wider flex items-center gap-2 px-4 group"
            >
                <div className={`w-2 h-2 rounded-full ${logs[0]?.level === 'ERROR' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                <span className="text-slate-400 group-hover:text-white">SYSTEM_LOGS :: {logs.length}</span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 w-[600px] h-[400px] bg-[#0b0f17] border border-slate-700/50 rounded-lg shadow-2xl flex flex-col z-50 font-mono text-[11px] overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-bottom-10 duration-200">
            <div className="flex justify-between items-center bg-slate-900/80 p-2 px-3 border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-blue-500">terminal</span>
                    <span className="font-bold text-slate-200 tracking-wider">SYSTEM ACTIVITY LOG</span>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => logger.clear()} className="hover:text-red-400 text-slate-500 transition-colors">CLEAR</button>
                    <button onClick={() => setIsOpen(false)} className="hover:text-white text-slate-500 transition-colors">MINIMIZE</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 bg-black/80 scrollbar-thin scrollbar-thumb-slate-700">
                {logs.length === 0 && <div className="text-slate-600 italic p-4 text-center mt-10">No system operations recorded.</div>}

                {logs.map(log => (
                    <div key={log.id} className="flex gap-3 hover:bg-white/5 p-1.5 rounded cursor-default border-b border-white/5 last:border-0 group transition-colors">
                        <span className="text-slate-600 whitespace-nowrap min-w-[70px]">
                            {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`w-14 font-bold ${getLevelColor(log.level)}`}>
                            {log.level}
                        </span>
                        <span className="text-blue-400 w-24 opacity-80 group-hover:opacity-100">
                            [{log.category}]
                        </span>
                        <span className="text-slate-300 flex-1 truncate font-medium" title={log.message}>
                            {log.message}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
