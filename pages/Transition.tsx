import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { analyzeImagePixels } from '../services/RealtimeAnalysis';
import { TelemetryData } from '../types';

const Transition = () => {
    const { originalImage, processedImage, processingState, fileMetadata } = useApp();
    const [sliderPos, setSliderPos] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dims, setDims] = useState({ w: 0, h: 0 });

    // Telemetry State for Comparison
    const [telemetryBefore, setTelemetryBefore] = useState<TelemetryData | null>(null);
    const [telemetryAfter, setTelemetryAfter] = useState<TelemetryData | null>(null);

    // Magnifying glass state
    const [loupeEnabled, setLoupeEnabled] = useState(false);
    const [loupePos, setLoupePos] = useState({ x: 0, y: 0 });
    const loupeSize = 200; // Diameter of the loupe
    const zoomLevel = 3; // Magnification factor

    // Handle resize observer to keep internal images synced in size
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            setDims({ w: width, h: height });
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Analyze Images for Comparison
    useEffect(() => {
        const runAnalysis = async () => {
            if (originalImage) {
                const t1 = await analyzeImagePixels(originalImage);
                setTelemetryBefore(t1);
            }
            if (processedImage) {
                const t2 = await analyzeImagePixels(processedImage);
                setTelemetryAfter(t2);
            }
        };
        runAnalysis();
    }, [originalImage, processedImage]);


    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));

        // Update slider position
        setSliderPos((x / rect.width) * 100);

        // Update loupe position
        if (loupeEnabled) {
            setLoupePos({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
        }
    };

    // Helper for Waveforms
    const createRealtimePath = (data: number[], height: number, width: number) => {
        if (!data || data.length === 0) return "";
        let path = `M 0 ${height}`;
        data.forEach((val, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - (val / 100) * height;
            path += ` L ${x} ${y}`;
        });
        path += ` L ${width} ${height} Z`;
        return path;
    };

    const renderHistogram = (t: TelemetryData | null, label: string, color: string) => {
        if (!t || !t.histogram) return <div className="h-24 bg-black/20 animate-pulse rounded transform scale-90"></div>;

        return (
            <div className="mb-4 bg-[#0d1117] border border-[#232f48] rounded p-3 relative overflow-hidden group">
                <div className="flex justify-between items-center mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${color}`}>{label}</span>
                    <span className="text-[9px] font-mono text-[#64748b]">{t.dynamicRange}</span>
                </div>
                <div className="relative h-24 w-full">
                    {/* R */}
                    <svg className="absolute inset-0 w-full h-full opacity-80 mix-blend-screen overflow-visible" preserveAspectRatio="none">
                        <path d={createRealtimePath(t.histogram.r, 96, 280)} fill="none" stroke="red" strokeWidth="1.5" />
                        <path d={createRealtimePath(t.histogram.r, 96, 280)} fill="red" stroke="none" fillOpacity="0.1" />
                    </svg>
                    {/* G */}
                    <svg className="absolute inset-0 w-full h-full opacity-80 mix-blend-screen overflow-visible" preserveAspectRatio="none">
                        <path d={createRealtimePath(t.histogram.g, 96, 280)} fill="none" stroke="#00ff00" strokeWidth="1.5" />
                        <path d={createRealtimePath(t.histogram.g, 96, 280)} fill="#00ff00" stroke="none" fillOpacity="0.1" />
                    </svg>
                    {/* B */}
                    <svg className="absolute inset-0 w-full h-full opacity-80 mix-blend-screen overflow-visible" preserveAspectRatio="none">
                        <path d={createRealtimePath(t.histogram.b, 96, 280)} fill="none" stroke="#0088ff" strokeWidth="1.5" />
                        <path d={createRealtimePath(t.histogram.b, 96, 280)} fill="#0088ff" stroke="none" fillOpacity="0.1" />
                    </svg>
                </div>
                {/* Metadata Stats */}
                <div className="flex justify-between mt-2 pt-2 border-t border-white/5 text-[9px] font-mono text-[#64748b]">
                    <span>ISO {t.camera.iso || 'N/A'}</span>
                    <span>Exp {t.camera.shutterSpeed || 'N/A'}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-[#0b0f17] h-screen flex flex-col font-display text-white overflow-hidden">
            <header className="flex items-center justify-between border-b border-[#232f48] bg-[#111722] px-6 py-3 shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-primary">compare</span>
                    <h2 className="text-sm font-bold tracking-widest uppercase">Transition Review</h2>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setLoupeEnabled(!loupeEnabled)}
                        className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${loupeEnabled
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'bg-[#232f48] text-[#92a4c9] hover:bg-[#324467]'
                            }`}
                    >
                        <span className="material-symbols-outlined text-sm">search</span>
                        {loupeEnabled ? 'Loupe On' : 'Loupe Off'}
                    </button>
                    <Link to="/" className="px-3 py-1 bg-[#232f48] hover:bg-[#324467] text-[10px] font-bold uppercase rounded transition-colors">Close</Link>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex items-center justify-center p-6 bg-[#05070a] relative select-none">
                    {originalImage && processedImage ? (
                        /* Main Container */
                        <div
                            ref={containerRef}
                            className="relative shadow-2xl border border-[#232f48] cursor-ew-resize overflow-hidden"
                            style={{ maxWidth: '90%', maxHeight: '85vh', aspectRatio: 'auto' }} // Let image dictate size
                            onMouseMove={handleMouseMove}
                        >
                            {/* Layer 1: Processed (Background) - Determines Container Size */}
                            <img
                                src={processedImage}
                                alt="Mastered"
                                className="block max-w-full max-h-[85vh] object-contain pointer-events-none"
                                draggable={false}
                            />

                            {/* Label After */}
                            <div className="absolute top-4 right-4 bg-primary/90 text-white text-[10px] font-bold px-2 py-1 rounded z-20">MASTERED</div>

                            {/* Layer 2: Original (Foreground) - Clipped */}
                            <div
                                className="absolute top-0 left-0 h-full overflow-hidden border-r-2 border-primary shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-[#05070a]"
                                style={{ width: `${sliderPos}%` }}
                            >
                                {/* IMPORTANT: This image must be explicitly sized to match the container's rendered dimensions 
                                    to prevent it from squishing inside the clipped div. */}

                                {fileMetadata?.isRaw ? (
                                    <div
                                        className="h-full bg-[#111722] flex items-center justify-center relative border-r border-[#232f48]"
                                        style={{ width: dims.w, height: dims.h }}
                                    >
                                        <div className="text-center opacity-50">
                                            <span className="material-symbols-outlined text-4xl mb-2">raw_on</span>
                                            <div className="text-[10px] font-mono tracking-widest">RAW DATA</div>
                                        </div>
                                    </div>
                                ) : (
                                    <img
                                        src={originalImage}
                                        alt="Original"
                                        className="block max-w-none h-full object-contain pointer-events-none"
                                        style={{ width: dims.w, height: dims.h }}
                                        draggable={false}
                                    />
                                )}

                                {/* Label Before */}
                                <div className="absolute top-4 left-4 bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded z-20">RAW</div>
                            </div>

                            {/* Handle Circle */}
                            <div
                                className="absolute top-1/2 -translate-y-1/2 size-8 bg-white text-primary rounded-full flex items-center justify-center shadow-lg pointer-events-none z-30"
                                style={{ left: `calc(${sliderPos}% - 16px)` }}
                            >
                                <span className="material-symbols-outlined text-sm">swap_horiz</span>
                            </div>

                            {/* Magnifying Glass Loupe */}
                            {loupeEnabled && (
                                <div
                                    className="absolute pointer-events-none z-40"
                                    style={{
                                        left: loupePos.x,
                                        top: loupePos.y,
                                        transform: 'translate(-50%, -50%)',
                                        width: loupeSize,
                                        height: loupeSize,
                                    }}
                                >
                                    <div className="relative w-full h-full rounded-full overflow-hidden border-4 border-primary shadow-[0_0_30px_rgba(19,91,236,0.5)] bg-black">
                                        <div
                                            className="absolute inset-0"
                                            style={{
                                                backgroundImage: `url(${processedImage})`,
                                                backgroundSize: `${dims.w * zoomLevel}px ${dims.h * zoomLevel}px`,
                                                backgroundPosition: `${-loupePos.x * zoomLevel + loupeSize / 2}px ${-loupePos.y * zoomLevel + loupeSize / 2}px`,
                                                backgroundRepeat: 'no-repeat'
                                            }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-full h-px bg-primary/40"></div>
                                        </div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="h-full w-px bg-primary/40"></div>
                                        </div>
                                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/80 text-primary text-[8px] font-bold px-2 py-0.5 rounded">
                                            {zoomLevel}x
                                        </div>
                                    </div>
                                    <div className="absolute inset-0 rounded-full border-2 border-primary/20 blur-sm"></div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-[#92a4c9] text-xs">No data to compare</div>
                    )}
                </div>

                {/* Sidebar */}
                <aside className="w-80 bg-[#111722] border-l border-[#232f48] flex flex-col p-6 overflow-y-auto">
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-6">Densitometry</h3>

                    {/* DUAL CURVE VISUALIZATION */}
                    {renderHistogram(telemetryBefore, "Raw Signal", "text-[#92a4c9]")}

                    <div className="flex justify-center my-2">
                        <span className="material-symbols-outlined text-[#232f48]">arrow_downward</span>
                    </div>

                    {renderHistogram(telemetryAfter, "Mastered Signal", "text-primary")}

                    <h3 className="text-xs font-bold text-white uppercase tracking-widest mt-6 mb-4 pt-4 border-t border-[#232f48]">Processing Log</h3>
                    <div className="space-y-2">
                        {processingState.appliedChanges.length > 0 ? processingState.appliedChanges.map((change, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-[#1a2333] border border-[#232f48] rounded">
                                <span className="text-xs text-[#92a4c9]">{change}</span>
                                <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>
                            </div>
                        )) : (
                            <div className="text-[10px] text-[#64748b] italic text-center">No explicit changes logged.</div>
                        )}
                    </div>
                </aside>
            </main>
        </div>
    );
};

export default Transition;