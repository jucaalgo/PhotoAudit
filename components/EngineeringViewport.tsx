import React, { useRef, useState, useEffect } from 'react';
import { generateGamutWarning } from '../utils/SoftProofing';

interface EngineeringViewportProps {
    beforeImage: string | null;
    afterImage: string | null;
    isCompareMode: boolean;
}

const EngineeringViewport: React.FC<EngineeringViewportProps> = ({ beforeImage, afterImage, isCompareMode }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [startPan, setStartPan] = useState({ x: 0, y: 0 });
    const [sliderPos, setSliderPos] = useState(50); // 0 to 100%

    // Magnifying glass state
    const [loupeEnabled, setLoupeEnabled] = useState(false);
    const [loupePos, setLoupePos] = useState({ x: 0, y: 0 });
    const loupeSize = 200;
    const zoomLevel = 3;

    // Soft Proofing State
    const [paperType, setPaperType] = useState<'NONE' | 'MATTE' | 'GLOSSY'>('NONE');
    const [showGamut, setShowGamut] = useState(false);
    const [gamutOverlay, setGamutOverlay] = useState<string | null>(null);

    // Reset view when images change
    useEffect(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    }, [beforeImage, afterImage]);

    // Gamut Warning Effect
    useEffect(() => {
        if (showGamut && afterImage) {
            generateGamutWarning(afterImage).then(setGamutOverlay);
        } else {
            setGamutOverlay(null);
        }
    }, [showGamut, afterImage]);

    // Paper Simulation Filters
    const getPaperFilter = () => {
        switch (paperType) {
            case 'MATTE': return 'contrast(0.9) brightness(1.05) sepia(0.1)';
            case 'GLOSSY': return 'contrast(1.1) saturate(1.1)';
            default: return 'none';
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(scale * delta, 0.5), 4); // 50% to 400%
        setScale(newScale);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setStartPan({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - startPan.x,
                y: e.clientY - startPan.y
            });
        }

        // Update loupe position
        if (loupeEnabled && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setLoupePos({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    // Slider Logic
    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSliderPos(Number(e.target.value));
    };

    return (
        <div className="flex-1 relative bg-[#05070a] overflow-hidden flex flex-col h-full">
            {/* TOOLBAR */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-[#111722]/90 backdrop-blur border border-[#232f48] rounded-full px-4 py-2 flex items-center gap-4 shadow-xl">
                <div className="flex items-center gap-2 text-[10px] font-mono text-[#92a4c9]">
                    <span className="material-symbols-outlined text-sm">zoom_in</span>
                    <span>{Math.round(scale * 100)}%</span>
                </div>
                <div className="w-px h-4 bg-white/10"></div>
                <div onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }} className="cursor-pointer hover:text-white text-[10px] font-bold text-[#92a4c9] uppercase tracking-wider">
                    RESET VIEW
                </div>
                {isCompareMode && (
                    <>
                        <div className="w-px h-4 bg-white/10"></div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-white">A</span>
                            <input
                                type="range"
                                min="0" max="100"
                                value={sliderPos}
                                onChange={handleSliderChange}
                                className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                            />
                            <span className="text-[10px] font-bold text-white">B</span>
                        </div>
                    </>
                )}
                {/* Loupe Toggle */}
                <div className="w-px h-4 bg-white/10"></div>
                <button
                    onClick={() => setLoupeEnabled(!loupeEnabled)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${loupeEnabled
                        ? 'bg-primary text-white'
                        : 'text-[#92a4c9] hover:text-white'
                        }`}
                >
                    <span className="material-symbols-outlined text-sm">search</span>
                    {loupeEnabled ? 'On' : 'Off'}
                </button>
            </div>

            {/* SOFT PROOFING TOOLBAR (Bottom-Right) */}
            <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
                <div className="bg-[#111722]/90 backdrop-blur border border-[#232f48] rounded-lg p-2 shadow-xl flex flex-col gap-2">
                    <button
                        onClick={() => setShowGamut(!showGamut)}
                        className={`text-[9px] font-bold px-2 py-1 rounded flex items-center gap-2 uppercase tracking-wide transition-colors ${showGamut
                            ? 'bg-red-500 text-white animate-pulse'
                            : 'bg-[#1a2333] text-[#64748b] hover:text-white'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[14px]">warning</span>
                        Gamut Check
                    </button>

                    <div className="h-px bg-[#232f48] w-full"></div>

                    <div className="text-[8px] font-mono text-[#64748b] uppercase text-center mb-1">Print Simulation</div>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setPaperType('NONE')}
                            className={`flex-1 text-[9px] font-bold py-1 rounded transition-colors ${paperType === 'NONE' ? 'bg-blue-600 text-white' : 'bg-[#1a2333] text-[#64748b]'}`}
                        >
                            OFF
                        </button>
                        <button
                            onClick={() => setPaperType('MATTE')}
                            className={`flex-1 text-[9px] font-bold py-1 rounded transition-colors ${paperType === 'MATTE' ? 'bg-blue-600 text-white' : 'bg-[#1a2333] text-[#64748b]'}`}
                        >
                            MAT
                        </button>
                        <button
                            onClick={() => setPaperType('GLOSSY')}
                            className={`flex-1 text-[9px] font-bold py-1 rounded transition-colors ${paperType === 'GLOSSY' ? 'bg-blue-600 text-white' : 'bg-[#1a2333] text-[#64748b]'}`}
                        >
                            GLS
                        </button>
                    </div>
                </div>
            </div>

            {/* VIEWPORT */}
            <div
                ref={containerRef}
                className="w-full h-full cursor-move relative flex items-center justify-center"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                    }}
                    className="relative shadow-2xl flex items-center justify-center max-w-full max-h-full"
                >
                    {/* 1. REFERENCE IMAGE (Invisible spacer or Visible Base) */}
                    {/* We use the 'After' image (or 'Before' if no After) to define the container size naturally with object-contain */}
                    {(afterImage || beforeImage) && (
                        <img
                            src={afterImage || beforeImage}
                            alt="Reference"
                            className="max-w-full max-h-full object-contain pointer-events-none select-none block opacity-0"
                            /* This image is invisible but takes up space. We layer the actual views on top absolutely.
                               Why? To allow for easier transitions and layering without layout shifts. 
                               Actually, simpler: Render After as base. */
                            draggable={false}
                        />

                    )}

                    {/* ACTUAL VIEW LAYERS (Absolute positioned to match Reference) */}

                    {/* LAYER A: AFTER IMAGE (Background) */}
                    {afterImage && (
                        <img
                            src={afterImage}
                            alt="Procesada"
                            className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                            style={{ filter: getPaperFilter() }}
                            draggable={false}
                        />
                    )}

                    {/* LAYER B: BEFORE IMAGE (Foreground - Clipped or Fallback) */}
                    {/* Show if: 
                        1. We are in COMPARE mode (Clipped) 
                        2. OR there is no After Image (Fallback)
                    */}
                    {beforeImage && (isCompareMode || !afterImage) && (
                        <img
                            src={beforeImage}
                            alt="Original"
                            className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                            style={{
                                filter: getPaperFilter(),
                                clipPath: (isCompareMode && afterImage) ? `inset(0 ${100 - sliderPos}% 0 0)` : 'none',
                                zIndex: 10
                            }}
                            draggable={false}
                        />
                    )}

                    {/* SLIDER LINE */}
                    {isCompareMode && afterImage && beforeImage && (
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-white/80 z-20 pointer-events-none shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                            style={{ left: `${sliderPos}%` }}
                        >
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-lg flex items-center justify-center">
                                <span className="material-symbols-outlined text-[10px] text-black">code</span>
                            </div>
                        </div>
                    )}

                    {/* GAMUT OVERLAY */}
                    {showGamut && gamutOverlay && (
                        <img
                            src={gamutOverlay}
                            alt="Gamut Warning"
                            className="absolute inset-0 w-full h-full max-w-none pointer-events-none select-none mix-blend-screen z-10 opacity-80"
                            draggable={false}
                        />
                    )}

                    {/* MAGNIFYING GLASS LOUPE */}
                    {loupeEnabled && afterImage && (
                        <div
                            className="absolute pointer-events-none z-50"
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
                                        backgroundImage: `url(${afterImage})`,
                                        backgroundSize: `${scale * zoomLevel * 100}% ${scale * zoomLevel * 100}%`,
                                        backgroundPosition: `${-loupePos.x * zoomLevel + loupeSize / 2}px ${-loupePos.y * zoomLevel + loupeSize / 2}px`,
                                        backgroundRepeat: 'no-repeat',
                                        filter: getPaperFilter()
                                    }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-full h-px bg-primary/40"></div>
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="h-full w-px bg-primary/40"></div>
                                </div>
                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/80 text-primary text-[8px] font-bold px-2 py-0.5 rounded">
                                    {Math.round(scale * zoomLevel * 100)}%
                                </div>
                            </div>
                            <div className="absolute inset-0 rounded-full border-2 border-primary/20 blur-sm"></div>
                        </div>
                    )}
                </div>
            </div>

            <div className="absolute bottom-4 left-4 pointer-events-none z-20">
                <div className="text-[9px] font-mono text-white/50 bg-black/50 px-2 py-1 rounded">
                    X: {Math.round(position.x)} Y: {Math.round(position.y)} Z: {scale.toFixed(2)}x
                </div>
            </div>
        </div>
    );
};

export default EngineeringViewport;
