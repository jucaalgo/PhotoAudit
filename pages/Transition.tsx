import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const Transition = () => {
    const { originalImage, processedImage, processingState, fileMetadata } = useApp();
    const [sliderPos, setSliderPos] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dims, setDims] = useState({ w: 0, h: 0 });

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

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        setSliderPos((x / rect.width) * 100);
    };

    return (
        <div className="bg-[#0b0f17] h-screen flex flex-col font-display text-white overflow-hidden">
            <header className="flex items-center justify-between border-b border-[#232f48] bg-[#111722] px-6 py-3 shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-primary">compare</span>
                    <h2 className="text-sm font-bold tracking-widest uppercase">Transition Review</h2>
                </div>
                <Link to="/" className="px-3 py-1 bg-[#232f48] hover:bg-[#324467] text-[10px] font-bold uppercase rounded transition-colors">Close</Link>
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
                        </div>
                    ) : (
                        <div className="text-[#92a4c9] text-xs">No data to compare</div>
                    )}
                </div>

                {/* Sidebar */}
                <aside className="w-80 bg-[#111722] border-l border-[#232f48] flex flex-col p-6">
                     <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-6">Processing Log</h3>
                     <div className="space-y-2">
                        {processingState.appliedChanges.map((change, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-[#1a2333] border border-[#232f48] rounded">
                                <span className="text-xs text-[#92a4c9]">{change}</span>
                                <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>
                            </div>
                        ))}
                     </div>
                </aside>
            </main>
        </div>
    );
};

export default Transition;