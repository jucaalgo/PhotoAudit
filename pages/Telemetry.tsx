import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

// Helper to interpolate low-res telemetry data into a high-res smooth curve for the UI
const interpolateData = (data: number[], steps: number = 100): number[] => {
    if (!data || data.length < 2) return new Array(steps).fill(0);
    const result = [];
    for (let i = 0; i < steps; i++) {
        const percent = i / (steps - 1);
        const index = percent * (data.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        const val = data[lower] * (1 - weight) + data[upper] * weight;
        result.push(val);
    }
    return result;
};

const ScopeGraph = ({ data, color, height = 200 }: { data: number[], color: string, height?: number }) => {
    const smoothData = useMemo(() => interpolateData(data, 100), [data]);
    
    const pathD = useMemo(() => {
        const w = 100;
        const h = 100;
        let d = `M 0 ${h}`;
        smoothData.forEach((val, i) => {
            const x = (i / (smoothData.length - 1)) * w;
            const y = h - (val * 0.8); // Scale to keep inside
            d += ` L ${x} ${y}`;
        });
        d += ` L ${w} ${h} Z`;
        return d;
    }, [smoothData]);

    return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full mix-blend-screen">
             <defs>
                <linearGradient id={`grad-${color}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.8" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.1" />
                </linearGradient>
            </defs>
            <path d={pathD} fill={`url(#grad-${color})`} stroke={color} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        </svg>
    );
};

const Telemetry = () => {
    const { originalImage, telemetry } = useApp();

    return (
        <div className="font-display bg-background-light dark:bg-background-dark text-slate-900 dark:text-white overflow-hidden h-screen flex flex-col">
             <header className="flex-none flex items-center justify-between whitespace-nowrap border-b border-solid border-border-dark bg-background-dark px-6 py-3 z-20">
                <div className="flex items-center gap-4 text-white">
                    <Link to="/" className="size-6 text-primary"><span className="material-symbols-outlined text-[28px]">shutter_speed</span></Link>
                    <div><h2 className="text-white text-lg font-bold leading-tight tracking-wider">PHOTOAUDIT PRO</h2><p className="text-xs text-text-secondary font-body">v12.0 | Advanced Telemetry</p></div>
                </div>
                <div className="flex flex-1 justify-end gap-6 items-center">
                    <div className="hidden md:flex gap-2">
                        <Link to="/config" className="flex items-center justify-center overflow-hidden rounded h-9 px-4 bg-surface-dark border border-border-dark text-white text-sm font-bold hover:bg-border-dark transition-colors"><span className="material-symbols-outlined text-sm mr-2">settings</span>Settings</Link>
                    </div>
                </div>
            </header>
            
            <div className="flex-1 flex overflow-hidden">
                
                {/* LEFT SIDEBAR: RAW METADATA (Sensor & Signal) */}
                <aside className="w-80 bg-[#111722] border-r border-[#232f48] flex flex-col overflow-y-auto custom-scrollbar z-10">
                    <div className="p-5 border-b border-[#232f48]">
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Raw Inspector</h2>
                        <p className="text-[10px] text-[#92a4c9] font-mono">SOURCE METADATA DECODER</p>
                    </div>

                    <div className="p-5 space-y-8">
                        
                        {/* 1. SENSOR GEOMETRY */}
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-bold text-[#92a4c9] uppercase tracking-widest flex items-center gap-2 border-b border-[#232f48] pb-2">
                                <span className="material-symbols-outlined text-sm text-primary">camera_roll</span> Sensor Geometry
                            </h3>
                            <div className="grid grid-cols-1 gap-2 text-xs">
                                <div className="flex justify-between items-center bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                    <span className="text-[#64748b]">Model</span>
                                    <span className="text-white font-bold text-right">{telemetry?.camera?.model || "--"}</span>
                                </div>
                                <div className="flex justify-between items-center bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                    <span className="text-[#64748b]">Native ISO</span>
                                    <span className="text-white font-bold font-mono">{telemetry?.camera?.iso || "--"}</span>
                                </div>
                                <div className="flex justify-between items-center bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                    <span className="text-[#64748b]">Aperture</span>
                                    <span className="text-white font-bold font-mono">{telemetry?.camera?.aperture || "--"}</span>
                                </div>
                                <div className="flex justify-between items-center bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                    <span className="text-[#64748b]">Shutter</span>
                                    <span className="text-white font-bold font-mono">{telemetry?.camera?.shutterSpeed || "--"}</span>
                                </div>
                                <div className="flex justify-between items-center bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                    <span className="text-[#64748b]">Focal Length</span>
                                    <span className="text-white font-bold font-mono">{telemetry?.camera?.focalLength || "--"}</span>
                                </div>
                            </div>
                        </div>

                        {/* 2. SIGNAL PHYSICS */}
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-bold text-[#92a4c9] uppercase tracking-widest flex items-center gap-2 border-b border-[#232f48] pb-2">
                                <span className="material-symbols-outlined text-sm text-primary">monitor_heart</span> Signal Physics
                            </h3>
                            <div className="grid grid-cols-1 gap-2 text-xs">
                                <div className="flex justify-between items-center bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                    <span className="text-[#64748b]">Bit Depth</span>
                                    <span className="text-white font-bold font-mono">{telemetry?.bitDepth || "--"}</span>
                                </div>
                                <div className="flex justify-between items-center bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                    <span className="text-[#64748b]">Dynamic Range</span>
                                    <span className="text-emerald-400 font-bold font-mono">{telemetry?.signal?.dynamicRange ? `${telemetry.signal.dynamicRange} stops` : "--"}</span>
                                </div>
                                <div className="flex justify-between items-center bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                    <span className="text-[#64748b]">RMS Noise</span>
                                    <span className={`font-bold font-mono ${telemetry?.signal?.rmsNoise && telemetry.signal.rmsNoise > 2 ? 'text-red-400' : 'text-green-400'}`}>
                                        {telemetry?.signal?.rmsNoise ? `${telemetry.signal.rmsNoise}%` : "--"}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                    <span className="text-[#64748b]">SNR (dB)</span>
                                    <span className="text-white font-bold font-mono">{telemetry?.signal?.snr || "--"}</span>
                                </div>
                            </div>
                        </div>

                         {/* 3. OPTICS & COLOR */}
                         <div className="space-y-3">
                            <h3 className="text-[10px] font-bold text-[#92a4c9] uppercase tracking-widest flex items-center gap-2 border-b border-[#232f48] pb-2">
                                <span className="material-symbols-outlined text-sm text-primary">lens</span> Optics & Color
                            </h3>
                            <div className="grid grid-cols-1 gap-2 text-xs">
                                <div className="flex justify-between items-center bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                    <span className="text-[#64748b]">Lens Model</span>
                                    <span className="text-white font-bold text-right truncate w-32">{telemetry?.camera?.lens || "--"}</span>
                                </div>
                                <div className="flex justify-between items-center bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                    <span className="text-[#64748b]">MTF50 Sharpness</span>
                                    <span className="text-primary font-bold font-mono">{telemetry?.optics?.mtf50 || "--"}</span>
                                </div>
                                <div className="flex justify-between items-center bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                    <span className="text-[#64748b]">Color Space</span>
                                    <span className="text-white font-bold font-mono">{telemetry?.colorSpace || "--"}</span>
                                </div>
                                <div className="flex justify-between items-center bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                    <span className="text-[#64748b]">White Balance</span>
                                    <span className="text-white font-bold font-mono">{telemetry?.camera?.whiteBalance || "--"}</span>
                                </div>
                            </div>
                        </div>

                        {/* 4. LIGHTING */}
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-bold text-[#92a4c9] uppercase tracking-widest flex items-center gap-2 border-b border-[#232f48] pb-2">
                                <span className="material-symbols-outlined text-sm text-primary">light_mode</span> Scene Lighting
                            </h3>
                            <div className="grid grid-cols-1 gap-2 text-xs">
                                <div className="flex justify-between items-center bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                    <span className="text-[#64748b]">Type</span>
                                    <span className="text-white font-bold text-right">{telemetry?.lighting?.type || "--"}</span>
                                </div>
                                <div className="flex justify-between items-center bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                    <span className="text-[#64748b]">Contrast Ratio</span>
                                    <span className="text-white font-bold font-mono">{telemetry?.lighting?.contrastRatio || "--"}</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </aside>

                {/* MAIN CONTENT CENTER */}
                <main className="flex-1 flex flex-col min-w-0 bg-[#0a0e14] relative">
                     <div className="flex items-center justify-between px-4 py-2 bg-surface-dark/50 border-b border-border-dark backdrop-blur-sm absolute w-full top-0 z-10">
                        <div className="flex items-center gap-2 text-text-secondary text-sm"><span className="material-symbols-outlined text-sm">folder</span><span>/</span><span>Ingest</span><span>/</span><span className="text-white font-bold">RAW_ANALYSIS.EXR</span></div>
                     </div>
                     <div className="flex-1 flex items-center justify-center p-8 overflow-hidden relative">
                        <div className="relative shadow-2xl rounded overflow-hidden border border-border-dark group h-full w-full flex items-center justify-center bg-[#05070a]">
                            {originalImage ? (
                                <img src={originalImage} className="max-h-full max-w-full object-contain" alt="Analysis Target" />
                            ) : (
                                <div className="text-text-secondary flex flex-col items-center">
                                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">signal_disconnected</span>
                                    <span>No Signal Input</span>
                                </div>
                            )}
                            {/* Grid Overlay */}
                            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
                        </div>
                     </div>
                     
                     {/* BOTTOM SCOPES */}
                     <div className="h-[250px] bg-surface-dark border-t border-border-dark flex overflow-x-auto shrink-0 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
                        {/* Professional RGB Parade / Histogram Scope */}
                        <div className="flex-1 min-w-[380px] flex flex-col p-4 bg-[#0d1117]">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#92a4c9] flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">tune</span>
                                    RGB Histogram (10-bit Precision)
                                </h3>
                                <span className="text-[9px] font-mono text-emerald-500">SIGNAL: LEGAL</span>
                            </div>
                            <div className="relative flex-1 bg-black rounded border border-[#232f48] overflow-hidden">
                                 {/* Scope Grid Background */}
                                 <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
                                 <div className="absolute inset-0 border-t border-white/10 top-1/4"></div>
                                 <div className="absolute inset-0 border-t border-white/10 top-2/4"></div>
                                 <div className="absolute inset-0 border-t border-white/10 top-3/4"></div>
                                 
                                 {/* The Graphs */}
                                 <div className="absolute inset-0 px-1 pb-1">
                                     {telemetry ? (
                                        <>
                                            <ScopeGraph data={telemetry.histogram.r} color="#ff3b30" />
                                            <ScopeGraph data={telemetry.histogram.g} color="#4cd964" />
                                            <ScopeGraph data={telemetry.histogram.b} color="#007aff" />
                                        </>
                                     ) : (
                                         <div className="w-full h-full flex items-center justify-center text-[10px] text-white/20 font-mono">AWAITING TELEMETRY STREAM</div>
                                     )}
                                 </div>
                            </div>
                        </div>
                     </div>
                </main>
            </div>
        </div>
    );
};

export default Telemetry;