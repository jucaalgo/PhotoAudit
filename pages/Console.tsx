import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Histogram from '../components/Histogram';

// --- PROFESSIONAL PROMPT LIBRARY (Maintained) ---
const COMMAND_LIBRARY = [
    {
        category: "FILM STOCKS (ANALOG)",
        commands: [
            { label: "Kodak Portra 400", prompt: "EMULATE STOCK: Kodak Portra 400. Fine grain. Warm skin tones. Slight green tint in shadows. Soft highlights.", desc: "The gold standard for portrait photography." },
            { label: "CineStill 800T", prompt: "EMULATE STOCK: CineStill 800T. Tungsten balanced. Halation around highlights (red glow). Cool shadows.", desc: "Night photography standard. Red halation effect." },
            { label: "Ilford HP5 Plus", prompt: "EMULATE STOCK: Ilford HP5 Plus 400. Black & White. Moderate grain. High acutance. Rich greyscale.", desc: "Classic photojournalism B&W." },
            { label: "Fuji Velvia 50", prompt: "EMULATE STOCK: Fuji Velvia 50. High Saturation. High Contrast. Deep Blacks. Vivid Purples/Greens.", desc: "Landscape/Nature slide film." },
            { label: "Kodachrome 64", prompt: "EMULATE STOCK: Kodachrome 64. Archival look. Strong reds. High contrast. Vintage 70s aesthetic.", desc: "The 'McCurry' look. Valid colors." },
            { label: "Technicolor 2-Strip", prompt: "EMULATE PROCESS: Technicolor 2-Strip. Red and Green primaries only. No Blue channel info. Vintage 1930s.", desc: "Historic vintage color process." }
        ]
    },
    {
        category: "LOG & CAMERA PROFILES",
        commands: [
            { label: "Leica Monochrom", prompt: "STYLE: Leica M Monochrom. High dynamic range B&W. No chroma noise. Smooth tonal rolloff.", desc: "Purest digital black and white." },
            { label: "Arri Alexa LogC", prompt: "GRADE: Convert to ARRI LogC. Desaturated. Low contrast. High dynamic range retention. Soft highlight roll-off.", desc: "Cinema flat profile for grading." },
            { label: "Hasselblad Natural Color", prompt: "STYLE: Hasselblad HNCS. True-to-life color science. 16-bit color depth simulation. Perfect skintones.", desc: "Medium format fidelity." },
            { label: "Normalize Log to Rec.709", prompt: "CORRECT: Apply LUT Log -> Rec.709. Restore contrast and saturation from flat profile.", desc: "Standard conversion for video frames." }
        ]
    },
    {
        category: "STUDIO LIGHTING",
        commands: [
            { label: "Rembrandt Key", prompt: "RELIGHT: Place soft Key Light at 45 degrees high. Create classic Rembrandt triangle on cheek. Fill ratio 1:4.", desc: "Classic cinematic portrait lighting." },
            { label: "Butterfly / Paramount", prompt: "RELIGHT: Place light directly front-above. Create butterfly shadow under nose. High Glamour.", desc: "Fashion/Beauty standard lighting." },
            { label: "Split Lighting", prompt: "RELIGHT: Split Lighting. 90-degree side light. Half face in light, half in shadow. High Drama.", desc: "Dramatic mystery look." },
            { label: "Ring Light", prompt: "RELIGHT: Ring Light source. Frontal flat lighting. Halo catchlight in eyes. Minimized skin texture.", desc: "Modern influencer/macro beauty look." },
            { label: "Volumetric Haze", prompt: "ADD ATMOSPHERE: Honest volumetric fog + God Rays from top-left. Diffuse light.", desc: "Adds depth and atmospheric perspective." },
            { label: "Cyberpunk Neon", prompt: "RELIGHT: Dual light setup. Key: Pink/Magenta (Left). Rim: Cyan/Blue (Right). Contrast: High.", desc: "Bicolor futuristic aesthetic." }
        ]
    },
    {
        category: "OPTICAL & LENS FX",
        commands: [
            { label: "Simulate Bokeh (f/1.2)", prompt: "OPTICS: Simulate 85mm f/1.2 lens. Shallow Depth of Field. Creamy background blur. Circular bokeh.", desc: "Focus separation via synthetic optics." },
            { label: "Anamorphic Flares", prompt: "OPTICS: Simulate Anamorphic Lens. Oval bokeh. Horizontal blue streaks on highlights. Barrel distortion.", desc: "CinemaScope aesthetic." },
            { label: "Tilt-Shift (Miniature)", prompt: "OPTICS: Apply Tilt-Shift blur. Focus plane across center. Blur top and bottom drastically.", desc: "Makes scenes look like miniatures." },
            { label: "Fix Chromatic Aberration", prompt: "CORRECT: Remove lateral and longitudinal Chromatic Aberration. Align RGB channels.", desc: "Fixes color fringing on high-contrast edges." },
            { label: "Unsharp Mask (Precision)", prompt: "SHARPEN: Apply Unsharp Mask. Radius: 1.5px. Amount: 50%. Threshold: 4 levels. Do not halo.", desc: "Enhances objective sharpness." }
        ]
    },
    {
        category: "RETOUCHING & RESTORATION",
        commands: [
            { label: "Frequency Separation", prompt: "RETOUCH: Apply Frequency Separation. Smooth low-frequency skin mottling. Retain high-frequency pore texture.", desc: "Pro skin retouching technique." },
            { label: "Dodge & Burn (Global)", prompt: "RETOUCH: Global Dodge and Burn. Darken shadows, lighten highlights to sculpt volume. Increase 3D dimensionality.", desc: "Enhances shape and volume." },
            { label: "Reduce ISO Noise", prompt: "RESTORE: Denoise color noise. Keep luminance grain. Fix high-ISO artifacts.", desc: "Clean up low-light shots." },
            { label: "Reconstruct Highlights", prompt: "RESTORE: Inpaint clipped highlights. Soften transition to pure white.", desc: "Fixes overexposed areas." }
        ]
    },
    {
        category: "CINEMATIC GRADING",
        commands: [
            { label: "Teal & Orange", prompt: "GRADE: Push Shadows to Teal. Push Highlights to Orange. Skin tones protected. High Contrast.", desc: "Blockbuster action look." },
            { label: "Bleach Bypass", prompt: "GRADE: Bleach Bypass. Desature color by 60%. Increase local contrast. Crushed blacks. Metallic skin.", desc: "Gritty, war-film aesthetic (Saving Private Ryan)." },
            { label: "Day for Night", prompt: "GRADE: Day fer Night. Darken exposure. Shift white balance to strong Blue. Crush contrast.", desc: "Simulate night scene from day shot." },
            { label: "Golden Hour", prompt: "RELIGHT: Simulate 2500K low-angle sunlight. Long shadows. Warm golden cast.", desc: "Sunrise/Sunset simulation." }
        ]
    }
];

// Kelvin to RGB Helper
function kelvinToRgb(kelvin: number): string {
    let temp = kelvin / 100;
    let r, g, b;

    if (temp <= 66) {
        r = 255;
        g = temp;
        g = 99.4708025861 * Math.log(g) - 161.1195681661;
        if (temp <= 19) {
            b = 0;
        } else {
            b = temp - 10;
            b = 138.5177312231 * Math.log(b) - 305.0447927307;
        }
    } else {
        r = temp - 60;
        r = 329.698727446 * Math.pow(r, -0.1332047592);
        g = temp - 60;
        g = 288.1221695283 * Math.pow(g, -0.0755148492);
        b = 255;
    }

    return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
}

function clamp(x: number) {
    return Math.max(0, Math.min(255, x));
}


const Console = () => {
    const { originalImage, processedImage, processImage, processingState, canUndo, undoLastEdit } = useApp();
    const [prompt, setPrompt] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hoverInfo, setHoverInfo] = useState<{ title: string, desc: string } | null>(null);

    // --- MODES ---
    const [activeMode, setActiveMode] = useState<'COMMAND' | 'MAGIC_BRUSH' | 'RELIGHT_4D'>('COMMAND');

    // Magic Brush State
    const [isDrawing, setIsDrawing] = useState(false);
    const [brushSize, setBrushSize] = useState(20);

    // 4D Relighting State
    const [lightType, setLightType] = useState<'SUN' | 'REFLECTOR'>('SUN');
    const [lightPos, setLightPos] = useState({ x: 50, y: 50 }); // Percentage

    // Advanced Render Props
    const [reflectorWidth, setReflectorWidth] = useState(45); // Degrees (Spread)
    const [reflectorAngle, setReflectorAngle] = useState(0);  // Rotation
    const [reflectorFalloff, setReflectorFalloff] = useState(0.5); // Hardness/Amplitude

    const [colorTemp, setColorTemp] = useState(6500); // Kelvin
    const [lightIntensity, setLightIntensity] = useState(0.5);

    // Derived Color from Temp
    const lightColorInfo = kelvinToRgb(colorTemp);

    // Magnifying glass (Lens) - Disabled in Brush/Relight mode for simpler interaction
    const [loupeEnabled, setLoupeEnabled] = useState(false);
    const [loupePos, setLoupePos] = useState({ x: 0, y: 0 });
    const loupeSize = 250;
    const zoomLevel = 3;

    // --- ACTIONS ---
    const handleProcess = () => {
        if (!originalImage) return;

        let lightingData = undefined;
        let maskData = undefined;
        let finalPrompt = prompt; // Initialize finalPrompt

        if (activeMode === 'MAGIC_BRUSH') {
            finalPrompt = `INPAINTING (Region-Based): ${prompt}. Focus changes ONLY on masked area. Integrate edges seamlessly.`;
            if (canvasRef.current) {
                maskData = canvasRef.current.toDataURL().split(',')[1];
            }
        } else if (activeMode === 'RELIGHT_4D') {
            const typeStr = lightType === 'SUN' ? "Omni-directional Sun Source" : "Directional Reflector Beam";
            const beamDetails = lightType === 'REFLECTOR' ? `Beam Width: ${reflectorWidth}deg, Rotation: ${reflectorAngle}deg, Focus: ${reflectorFalloff}` : "";

            finalPrompt = `RELIGHTING (4D Engine): Source: ${typeStr} at [${lightPos.x}%, ${lightPos.y}%]. ${beamDetails}. Color Temp: ${colorTemp}K. Intensity: ${lightIntensity}. Cast realistic geometric shadows based on depth.`;

            // [FIX] Pass structured lighting data for Client-Side Hybrid Overlay
            // Convert X/Y position to Clock-Face Direction (0-360)
            const dy = lightPos.y - 50;
            const dx = lightPos.x - 50;
            let angle = Math.atan2(dy, dx) * (180 / Math.PI); // -180 to 180
            angle = (angle + 90 + 360) % 360; // Normalize so 0 is Top (12 o'clock)

            lightingData = {
                direction: Math.round(angle),
                intensity: Math.round(lightIntensity * 100), // Scale 0-1 to 0-100
                temperature: colorTemp
            };
        }

        const sourceImage = processedImage || originalImage;
        const base64 = sourceImage.split(',')[1];
        processImage(base64, "image/jpeg", finalPrompt, undefined, lightingData, maskData); // Pass Mask
    };

    const appendPrompt = (text: string) => {
        setPrompt(prev => {
            const trimmed = prev.trim();
            return (trimmed.length > 0 && !trimmed.endsWith('.')) ? `${trimmed}. ${text}` : `${trimmed} ${text}`;
        });
    };

    const handleMouseEnter = (title: string, desc: string) => setHoverInfo({ title, desc });
    const handleMouseLeave = () => setHoverInfo(null);

    // --- INTERACTION HANDLERS ---

    // Canvas Drawing (Magic Brush)
    const startDrawing = (e: React.MouseEvent) => {
        if (activeMode !== 'MAGIC_BRUSH' || !canvasRef.current) return;
        setIsDrawing(true);
        draw(e);
    };

    const stopDrawing = () => setIsDrawing(false);

    const draw = (e: React.MouseEvent) => {
        if (!isDrawing || activeMode !== 'MAGIC_BRUSH' || !canvasRef.current || !imageRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Scale coordinates to internal canvas size
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; // Semi-transparent red mask
        ctx.lineTo(x * scaleX, y * scaleY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x * scaleX, y * scaleY);
    };

    // Relighting Drag
    const handleRelightDrag = (e: React.MouseEvent) => {
        if (activeMode !== 'RELIGHT_4D' || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        // Simple drag interaction (click to move light)
        if (e.buttons === 1) { // Left mouse button down
            setLightPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (activeMode === 'COMMAND' && loupeEnabled && imageRef.current) {
            const rect = imageRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
                setLoupePos({ x, y });
            }
        } else if (activeMode === 'MAGIC_BRUSH' && isDrawing) {
            draw(e);
        } else if (activeMode === 'RELIGHT_4D') {
            handleRelightDrag(e);
        }
    };

    // Resize canvas to match image
    useEffect(() => {
        if (imageRef.current && canvasRef.current) {
            canvasRef.current.width = imageRef.current.naturalWidth;
            canvasRef.current.height = imageRef.current.naturalHeight;
        }
    }, [processedImage, originalImage, activeMode]);


    return (
        <div className="bg-[#0b0f17] h-screen flex flex-col text-white font-display overflow-hidden relative">

            {/* HEADER */}
            <header className="flex-none h-14 bg-[#0d1117] border-b border-[#232f48] px-4 flex items-center justify-between text-xs text-[#64748b] font-mono z-50 shadow-lg">
                <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-primary text-2xl">terminal</span>
                    {/* UPDATED TITLE */}
                    <h2 className="text-sm font-bold tracking-widest text-white">COMMAND CONSOLE <span className="text-primary text-[10px] align-top">ULTRA</span></h2>
                </div>
                {/* NEW MODE SWITCHER - THIS WAS MISSING IN PREVIOUS DEPLOY */}
                <div className="flex gap-4">
                    <button onClick={() => setActiveMode('COMMAND')} className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${activeMode === 'COMMAND' ? 'bg-primary text-white' : 'text-[#64748b] hover:text-white'}`}>Command</button>
                    <button onClick={() => setActiveMode('MAGIC_BRUSH')} className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${activeMode === 'MAGIC_BRUSH' ? 'bg-purple-600 text-white' : 'text-[#64748b] hover:text-white'}`}>
                        <span className="material-symbols-outlined text-xs">brush</span> Magic Brush
                    </button>
                    <button onClick={() => setActiveMode('RELIGHT_4D')} className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${activeMode === 'RELIGHT_4D' ? 'bg-orange-600 text-white' : 'text-[#64748b] hover:text-white'}`}>
                        <span className="material-symbols-outlined text-xs">light_mode</span> 4D Light
                    </button>
                </div>
                <div className="flex gap-6">
                    <Link to="/" className="text-[#92a4c9] hover:text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-colors">
                        <span className="material-symbols-outlined text-sm">dashboard</span> Dashboard
                    </Link>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">

                {/* --- LEFT PANEL --- */}
                <aside className="w-80 bg-[#111722] border-r border-[#232f48] flex flex-col z-20 shadow-2xl shrink-0 overflow-hidden transition-all">

                    {/* INFO BOX (Contextual) */}
                    <div className="p-4 bg-[#0d1117] border-b border-[#232f48] min-h-[80px] flex flex-col justify-center sticky top-0 z-10 shadow-lg">
                        {hoverInfo ? (
                            <div className="animate-fade-in">
                                <h3 className="text-primary text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-xs">info</span> {hoverInfo.title}
                                </h3>
                                <p className="text-[#92a4c9] text-[9px] leading-relaxed pl-5">{hoverInfo.desc}</p>
                            </div>
                        ) : activeMode === 'MAGIC_BRUSH' ? (
                            <div className="text-center">
                                <h3 className="text-purple-400 text-[10px] font-bold uppercase tracking-widest mb-1">Magic Brush Active</h3>
                                <p className="text-[#92a4c9] text-[9px]">Paint over areas you want to modify.</p>
                            </div>
                        ) : activeMode === 'RELIGHT_4D' ? (
                            <div className="text-center">
                                <h3 className="text-orange-400 text-[10px] font-bold uppercase tracking-widest mb-1">4D Relighting</h3>
                                <p className="text-[#92a4c9] text-[9px]">
                                    {lightType === 'SUN' ? 'Moving Omni-Directional Sun.' : 'Aiming Directional Reflector.'}
                                </p>
                            </div>
                        ) : (
                            <div className="opacity-30 text-center">
                                <p className="text-[9px] uppercase tracking-wider">Select a command to append to stream</p>
                            </div>
                        )}
                    </div>

                    {/* CONTENT SCRIPTING / CONTROLS depending on Mode */}
                    {activeMode === 'COMMAND' && (
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                            {COMMAND_LIBRARY.map((group, idx) => (
                                <div key={idx} className="mb-4">
                                    <h4 className="text-[9px] font-bold text-[#64748b] uppercase tracking-widest px-2 mb-2 sticky top-0 bg-[#111722]/95 py-1 z-10 backdrop-blur">{group.category}</h4>
                                    <div className="space-y-0.5">
                                        {group.commands.map((cmd, i) => (
                                            <button
                                                key={i}
                                                onClick={() => appendPrompt(cmd.prompt)}
                                                onMouseEnter={() => handleMouseEnter(cmd.label, cmd.desc)}
                                                onMouseLeave={handleMouseLeave}
                                                className="w-full text-left px-3 py-2 text-[10px] font-mono text-[#92a4c9] hover:text-white hover:bg-[#1a2333] rounded flex items-center justify-between group transition-all"
                                            >
                                                <span>{cmd.label}</span>
                                                <span className="opacity-0 group-hover:opacity-100 text-primary text-[10px] font-bold">+</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeMode === 'MAGIC_BRUSH' && (
                        <div className="flex-1 p-4">
                            <div className="mb-4">
                                <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">Brush Size</label>
                                <input
                                    type="range"
                                    min="5" max="100"
                                    value={brushSize}
                                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                    className="w-full mt-2 appearance-none bg-[#232f48] h-1 rounded cursor-pointer"
                                />
                            </div>
                            <div className="text-[10px] text-[#92a4c9]">
                                Paint the red mask over the object you want to change. Then describe the change below.
                            </div>
                        </div>
                    )}

                    {activeMode === 'RELIGHT_4D' && (
                        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">

                            {/* LIGHT TYPE TOGGLE */}
                            <div className="mb-6 flex bg-[#0d1117] p-1 rounded-lg border border-[#232f48]">
                                <button
                                    onClick={() => setLightType('SUN')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${lightType === 'SUN' ? 'bg-orange-600 text-white shadow' : 'text-[#64748b] hover:text-white'}`}
                                >
                                    <span className="material-symbols-outlined text-sm">wb_sunny</span> Sun
                                </button>
                                <button
                                    onClick={() => setLightType('REFLECTOR')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${lightType === 'REFLECTOR' ? 'bg-orange-600 text-white shadow' : 'text-[#64748b] hover:text-white'}`}
                                >
                                    <span className="material-symbols-outlined text-sm">highlight</span> Reflector
                                </button>
                            </div>


                            <div className="mb-6">
                                <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest flex justify-between">
                                    <span>Intensity</span>
                                    <span className="text-white">{Math.round(lightIntensity * 100)}%</span>
                                </label>
                                <input
                                    type="range"
                                    min="0" max="1" step="0.1"
                                    value={lightIntensity}
                                    onChange={(e) => setLightIntensity(parseFloat(e.target.value))}
                                    className="w-full mt-2 appearance-none bg-[#232f48] h-1 rounded cursor-pointer accent-orange-500"
                                />
                            </div>

                            <div className="mb-6">
                                <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest flex justify-between">
                                    <span>Color Temp</span>
                                    <span className="text-white">{colorTemp}K</span>
                                </label>
                                <div className="relative mt-2 h-4 rounded w-full overflow-hidden">
                                    {/* Temperature Gradient Background */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-white to-orange-500 opacity-80" />
                                    <input
                                        type="range"
                                        min="2000" max="10000" step="100"
                                        value={colorTemp}
                                        onChange={(e) => setColorTemp(parseInt(e.target.value))}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    {/* Indicator */}
                                    <div
                                        className="absolute top-0 bottom-0 w-1 bg-white border-x border-black shadow"
                                        style={{ left: `${((colorTemp - 2000) / 8000) * 100}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[9px] text-[#64748b] mt-1 font-mono">
                                    <span>Warm (2000K)</span>
                                    <span>Cool (10000K)</span>
                                </div>
                            </div>

                            {/* REFLECTOR SPECIFIC CONTROLS */}
                            {lightType === 'REFLECTOR' && (
                                <div className="border-t border-[#232f48] pt-4 animate-fade-in">
                                    <h5 className="text-[9px] font-bold text-orange-400 uppercase tracking-widest mb-4">Reflector Physics</h5>

                                    <div className="mb-4">
                                        <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest flex justify-between">
                                            <span>Beam Width</span>
                                            <span className="text-white">{reflectorWidth}°</span>
                                        </label>
                                        <input type="range" min="10" max="120" value={reflectorWidth} onChange={(e) => setReflectorWidth(parseInt(e.target.value))} className="w-full mt-2 appearance-none bg-[#232f48] h-1 rounded cursor-pointer accent-orange-500" />
                                    </div>

                                    <div className="mb-4">
                                        <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest flex justify-between">
                                            <span>Angle (Direction)</span>
                                            <span className="text-white">{reflectorAngle}°</span>
                                        </label>
                                        <input type="range" min="0" max="360" value={reflectorAngle} onChange={(e) => setReflectorAngle(parseInt(e.target.value))} className="w-full mt-2 appearance-none bg-[#232f48] h-1 rounded cursor-pointer accent-orange-500" />
                                    </div>

                                    <div className="mb-4">
                                        <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest flex justify-between">
                                            <span>Amplitude (Reflection)</span>
                                            <span className="text-white">{Math.round(reflectorFalloff * 100)}%</span>
                                        </label>
                                        <input type="range" min="0" max="1" step="0.1" value={reflectorFalloff} onChange={(e) => setReflectorFalloff(parseFloat(e.target.value))} className="w-full mt-2 appearance-none bg-[#232f48] h-1 rounded cursor-pointer accent-orange-500" />
                                    </div>
                                </div>
                            )}

                            {/* EXPLICIT RENDER BUTTON (User Request) */}
                            <button
                                onClick={handleProcess}
                                disabled={processingState.isProcessing}
                                className="w-full mt-6 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded shadow-lg uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                            >
                                {processingState.isProcessing ? (
                                    <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                                ) : (
                                    <span className="material-symbols-outlined text-sm">auto_fix_high</span>
                                )}
                                {processingState.isProcessing ? "Rendering..." : "Apply Lighting to Image"}
                            </button>
                            <p className="text-[9px] text-center text-[#64748b] mt-2">Permanently burns this lighting into the photo.</p>

                        </div>
                    )}


                    {/* PROMPT INPUT & EXECUTE */}
                    <div className="p-3 bg-[#161b22] border-t border-[#232f48]">
                        <textarea
                            className="w-full bg-[#0d1117] border border-[#232f48] rounded text-white text-[10px] p-2 focus:border-primary outline-none resize-none font-mono leading-relaxed mb-2 h-20 placeholder-white/20"
                            placeholder={activeMode === 'MAGIC_BRUSH' ? "Describe change for masks area..." : "Command Stream..."}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={undoLastEdit}
                                disabled={!canUndo || processingState.isProcessing}
                                className={`flex-1 py-2.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${!canUndo
                                    ? 'border-[#232f48] text-[#64748b] opacity-50 cursor-not-allowed'
                                    : 'border-[#232f48] bg-[#1a2333] hover:bg-[#232f48] text-white hover:text-white'}`}
                            >
                                <span className="material-symbols-outlined text-sm">undo</span> Undo
                            </button>
                            <button
                                onClick={handleProcess}
                                disabled={processingState.isProcessing || !originalImage}
                                className={`flex-[2] py-2.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg text-white ${processingState.isProcessing
                                    ? 'bg-[#232f48] text-[#64748b] cursor-wait'
                                    : activeMode === 'MAGIC_BRUSH' ? 'bg-purple-600 hover:bg-purple-500' : activeMode === 'RELIGHT_4D' ? 'bg-orange-600 hover:bg-orange-500' : 'bg-primary hover:bg-blue-600'}`}
                            >
                                {processingState.isProcessing ? (
                                    <> <span className="material-symbols-outlined animate-spin text-sm">sync</span> Processing </>
                                ) : (
                                    <> <span className="material-symbols-outlined text-sm">play_arrow</span> {activeMode === 'MAGIC_BRUSH' ? 'Inpaint Mask' : activeMode === 'RELIGHT_4D' ? 'Re-Illuminate' : 'Execute'} </>
                                )}
                            </button>
                        </div>
                    </div>

                </aside>

                {/* --- MAIN VIEWPORT --- */}
                <main className="flex-1 relative bg-[#05070a] flex flex-col overflow-hidden">
                    <div className="absolute top-4 left-4 z-40 flex gap-2">

                        {/* VIEWPORT TOOLS / MODE SWITCHER */}
                        <div className="bg-[#111722]/90 backdrop-blur border border-[#232f48] rounded-lg p-1 flex gap-1 shadow-2xl">
                            <button
                                onClick={() => setActiveMode('COMMAND')}
                                className={`p-2 rounded transition-all ${activeMode === 'COMMAND' ? 'bg-primary text-white shadow-lg' : 'text-[#92a4c9] hover:bg-[#1a2333] hover:text-white'}`}
                                title="Command Mode"
                            >
                                <span className="material-symbols-outlined text-sm">terminal</span>
                            </button>
                            <button
                                onClick={() => setActiveMode('MAGIC_BRUSH')}
                                className={`p-2 rounded transition-all ${activeMode === 'MAGIC_BRUSH' ? 'bg-purple-600 text-white shadow-lg' : 'text-[#92a4c9] hover:bg-[#1a2333] hover:text-white'}`}
                                title="Magic Brush (Inpainting)"
                            >
                                <span className="material-symbols-outlined text-sm">brush</span>
                            </button>
                            <button
                                onClick={() => setActiveMode('RELIGHT_4D')}
                                className={`p-2 rounded transition-all ${activeMode === 'RELIGHT_4D' ? 'bg-orange-600 text-white shadow-lg' : 'text-[#92a4c9] hover:bg-[#1a2333] hover:text-white'}`}
                                title="4D Relighting"
                            >
                                <span className="material-symbols-outlined text-sm">light_mode</span>
                            </button>
                        </div>

                        <div className="w-px h-8 bg-[#232f48] mx-1"></div>

                        {activeMode === 'COMMAND' && (
                            <button onClick={() => setLoupeEnabled(!loupeEnabled)} className={`px-3 py-1.5 rounded-full flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider border transition-all ${loupeEnabled ? 'bg-primary border-primary text-white' : 'bg-black/50 border-[#232f48] text-[#92a4c9]'}`}>
                                <span className="material-symbols-outlined text-sm">search</span> Lens
                            </button>
                        )}
                        {processedImage && (
                            <button onClick={undoLastEdit} disabled={!canUndo} className={`px-3 py-1.5 rounded-full flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider border bg-black/50 backdrop-blur border-[#232f48] text-[#92a4c9] ${canUndo ? 'hover:bg-[#1a2333] hover:text-white' : 'opacity-50'}`}>
                                <span className="material-symbols-outlined text-sm">undo</span>
                            </button>
                        )}
                    </div>

                    {/* 4D LIGHT SOURCE ICON */}
                    {activeMode === 'RELIGHT_4D' && (
                        <div
                            className="absolute z-50 cursor-pointer shadow-2xl"
                            style={{
                                left: `${lightPos.x}%`,
                                top: `${lightPos.y}%`,
                                transform: 'translate(-50%, -50%)'
                            }}
                            onMouseDown={() => { }} // Handle drag via parent container
                        >
                            <div className={`w-8 h-8 rounded-full border-2 border-orange-500 shadow-[0_0_20px_rgba(255,165,0,0.8)] flex items-center justify-center animate-pulse ${lightType === 'SUN' ? 'bg-white' : 'bg-orange-950'}`}>
                                <span className="material-symbols-outlined text-orange-600 font-bold text-xs">{lightType === 'SUN' ? 'light_mode' : 'highlight'}</span>
                            </div>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-black/80 px-2 py-1 rounded text-[9px] whitespace-nowrap border border-white/20">
                                {lightType === 'SUN' ? 'Sun Pos' : 'Reflector'}
                            </div>
                        </div>
                    )}

                    <div
                        className="flex-1 flex items-center justify-center p-8 overflow-hidden relative cursor-crosshair"
                        ref={containerRef}
                        onMouseDown={startDrawing}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onMouseMove={handleMouseMove}
                    >
                        <div className="absolute inset-0 z-0 pointer-events-none opacity-20" style={{ backgroundImage: 'linear-gradient(#232f48 1px, transparent 1px), linear-gradient(90deg, #232f48 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(30,41,59,0.2)_0%,rgba(5,7,10,1)_100%)]"></div>

                        {processedImage || originalImage ? (
                            <div className="relative shadow-2xl shadow-black/80 border border-[#232f48] bg-black max-w-full max-h-full flex z-10 overflow-hidden">
                                <img
                                    ref={imageRef}
                                    src={processedImage || originalImage || ""}
                                    className="max-w-full max-h-full object-contain pointer-events-none select-none transition-none"
                                    alt="Workarea"
                                    style={{
                                        // Base adjustments only, no dynamic lighting interaction here
                                        filter: activeMode === 'RELIGHT_4D' ? 'contrast(1.1)' : 'none'
                                    }}
                                />

                                {/* MAGIC BRUSH CANVAS LAYER */}
                                {activeMode === 'MAGIC_BRUSH' && (
                                    <canvas
                                        ref={canvasRef}
                                        className="absolute inset-0 w-full h-full z-20 cursor-crosshair touch-none"
                                    />
                                )}

                                {/* 4D RELIGHTING OVERLAYS (Advanced Simulation) */}
                                {activeMode === 'RELIGHT_4D' && (
                                    <>
                                        {/* SUN MODE SIMULATION */}
                                        {lightType === 'SUN' && (
                                            <>
                                                <div
                                                    className="absolute inset-0 z-20 pointer-events-none mix-blend-overlay transition-none"
                                                    style={{
                                                        background: `radial-gradient(circle at ${lightPos.x}% ${lightPos.y}%, ${lightColorInfo} 0%, transparent 70%)`,
                                                        opacity: lightIntensity * 1.5
                                                    }}
                                                />
                                                <div
                                                    className="absolute inset-0 z-20 pointer-events-none mix-blend-multiply transition-none"
                                                    style={{
                                                        background: `radial-gradient(circle at ${100 - lightPos.x}% ${100 - lightPos.y}%, rgba(0,0,0,0.8) 0%, transparent 80%)`,
                                                        opacity: lightIntensity
                                                    }}
                                                />
                                            </>
                                        )}

                                        {/* REFLECTOR MODE SIMULATION (Conic Beam) */}
                                        {lightType === 'REFLECTOR' && (
                                            <>
                                                {/* Beam Highlight */}
                                                <div
                                                    className="absolute inset-0 z-20 pointer-events-none mix-blend-overlay transition-none opacity-80"
                                                    style={{
                                                        background: `conic-gradient(from ${reflectorAngle - (reflectorWidth / 2) + 90}deg at ${lightPos.x}% ${lightPos.y}%, transparent 0deg, ${lightColorInfo} ${reflectorWidth / 2}deg, transparent ${reflectorWidth}deg)`
                                                    }}
                                                />
                                                {/* Reflector Specular Core */}
                                                <div
                                                    className="absolute inset-0 z-20 pointer-events-none mix-blend-screen transition-none"
                                                    style={{
                                                        background: `radial-gradient(circle at ${lightPos.x}% ${lightPos.y}%, ${lightColorInfo} 0%, transparent ${20 * reflectorFalloff}%)`,
                                                        opacity: lightIntensity * 2
                                                    }}
                                                />
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center opacity-30 select-none text-[#92a4c9]">
                                <span className="material-symbols-outlined text-6xl mb-4 text-[#232f48]">satellite_alt</span>
                                <span className="text-xs font-mono uppercase tracking-widest">Awaiting Signal</span>
                            </div>
                        )}

                        {loupeEnabled && activeMode === 'COMMAND' && (processedImage || originalImage) && imageRef.current && (
                            <div className="fixed pointer-events-none z-[100] rounded-full overflow-hidden border-2 border-white/20 shadow-2xl bg-black"
                                style={{
                                    left: imageRef.current.getBoundingClientRect().left + loupePos.x,
                                    top: imageRef.current.getBoundingClientRect().top + loupePos.y,
                                    width: loupeSize,
                                    height: loupeSize,
                                    transform: 'translate(-50%, -50%)',
                                }}>
                                <div className="absolute inset-0"
                                    style={{
                                        backgroundImage: `url(${processedImage || originalImage})`,
                                        backgroundSize: `${imageRef.current.getBoundingClientRect().width * zoomLevel}px ${imageRef.current.getBoundingClientRect().height * zoomLevel}px`,
                                        backgroundPosition: `${-loupePos.x * zoomLevel + loupeSize / 2}px ${-loupePos.y * zoomLevel + loupeSize / 2}px`,
                                        backgroundRepeat: 'no-repeat'
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </main>

                {/* --- RIGHT PANEL: LIVE ANALYSIS (Unchanged) --- */}
                <aside className="w-64 bg-[#111722] border-l border-[#232f48] flex flex-col z-20 shadow-2xl shrink-0">
                    <div className="p-4 border-b border-[#232f48]">
                        <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-sm">monitoring</span> Signal Monitor</h4>
                        <div className="mb-4 bg-black rounded p-1 border border-[#232f48]">
                            <Histogram imageSrc={processedImage || originalImage} width={220} height={120} />
                        </div>
                    </div>
                    <div className="p-4 flex-1">
                        <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-3">Tone Curves</h4>
                        <div className="bg-black/50 border border-white/10 h-32 w-full rounded relative flex items-center justify-center text-white/20 text-xs font-mono">
                            <span>RGB Curves</span>
                            <svg className="absolute inset-0 w-full h-full p-2 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <path d="M0,100 L100,0" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="2" />
                                <path d="M0,100 C40,90 60,10 100,0" fill="none" stroke="rgba(255,50,50,0.5)" strokeWidth="1" />
                                <path d="M0,100 C30,80 70,20 100,0" fill="none" stroke="rgba(50,255,50,0.5)" strokeWidth="1" />
                            </svg>
                        </div>
                    </div>
                </aside>

            </div>
        </div>
    );
};

export default Console;