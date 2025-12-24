import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { GradingState, ActionProposal } from '../types';
import { extractEmbeddedPreview } from '../utils/rawUtils';

// Professional Waveform Path Generation
const createPath = (data: number[], height: number, width: number) => {
    if (!data || data.length === 0) return "";
    
    // Scale points to SVG dimensions
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - (val / 100) * height; 
        return [x, y];
    });

    let path = `M 0 ${height}`;
    points.forEach((point, i) => {
        path += ` L ${point[0]} ${point[1]}`;
    });
    path += ` L ${width} ${height} Z`;
    return path;
};

// Raw Noise Generator for visual feedback
const RawNoisePattern = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            canvas.width = canvas.parentElement?.clientWidth || 300;
            canvas.height = canvas.parentElement?.clientHeight || 300;
            drawNoise();
        };

        const drawNoise = () => {
            const w = canvas.width;
            const h = canvas.height;
            const idata = ctx.createImageData(w, h);
            const buffer32 = new Uint32Array(idata.data.buffer);
            const len = buffer32.length;

            for (let i = 0; i < len; i++) {
                if (Math.random() < 0.1) {
                    // Simulate Bayer specs (R, G, B pixels scattered)
                    const rand = Math.random();
                    if (rand < 0.33) buffer32[i] = 0xFF000044; // Red
                    else if (rand < 0.66) buffer32[i] = 0xFF004400; // Green
                    else buffer32[i] = 0xFFFF0000; // Blue (Little Endian)
                } else {
                    buffer32[i] = 0xFF05070a; // Transparent-ish
                }
            }
            ctx.putImageData(idata, 0, 0);
        };

        window.addEventListener('resize', resize);
        resize();

        return () => window.removeEventListener('resize', resize);
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-30 pointer-events-none mix-blend-screen" />;
};

// HELPER: Generate a Data URL for a "Digital Proxy" card to use when RAW cannot be displayed
const generateRawProxyImage = (filename: string, extension: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return "";

    // Background
    ctx.fillStyle = '#0b0f17';
    ctx.fillRect(0, 0, 1920, 1080);

    // Tech Grid
    ctx.strokeStyle = '#232f48';
    ctx.lineWidth = 2;
    for(let i=0; i<1920; i+=100) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,1080); ctx.stroke(); }
    for(let i=0; i<1080; i+=100) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(1920,i); ctx.stroke(); }

    // Text
    ctx.font = 'bold 80px sans-serif';
    ctx.fillStyle = '#10b981';
    ctx.textAlign = 'center';
    ctx.fillText('RAW DATA PROXY', 960, 400);

    ctx.font = '40px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`${filename.toUpperCase()}`, 960, 500);
    ctx.fillText(`ENCODING: ${extension.toUpperCase()} 14-BIT`, 960, 560);
    ctx.fillText(`NO EMBEDDED PREVIEW DETECTED`, 960, 620);
    
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 10;
    ctx.strokeRect(460, 200, 1000, 680);

    return canvas.toDataURL('image/jpeg', 0.8);
};

const Dashboard = () => {
    const { originalImage, setOriginalImage, analyzeImage, processImage, processingState, telemetry, gradingState, setGradingState, fileMetadata, setFileMetadata, setRawBinary } = useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const [mode, setMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
    const [hasApiKey, setHasApiKey] = useState(false);
    const [isProxyView, setIsProxyView] = useState(false);
    
    // UI States
    const [showModal, setShowModal] = useState(false);
    const [showPipelineSettings, setShowPipelineSettings] = useState(false); 
    const [proposals, setProposals] = useState<ActionProposal[]>([]);

    useEffect(() => {
        const checkKey = async () => {
            if ((window as any).aistudio && (window as any).aistudio.hasSelectedApiKey) {
                const hasKey = await (window as any).aistudio.hasSelectedApiKey();
                setHasApiKey(hasKey);
            }
        };
        checkKey();
    }, []);

    const handleApiKeySelect = async () => {
        if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
            await (window as any).aistudio.openSelectKey();
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            setHasApiKey(hasKey);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const name = file.name.toLowerCase();
            const rawExtensions = ['.rw2', '.arw', '.cr2', '.dng', '.nef', '.orf', '.raf'];
            const extension = name.substring(name.lastIndexOf('.'));
            const isRawFile = rawExtensions.some(ext => name.endsWith(ext));
            
            setFileMetadata({
                name: file.name,
                type: file.type,
                isRaw: isRawFile,
                extension: extension
            });

            const reader = new FileReader();
            reader.onload = async (event) => {
                const result = event.target?.result as string;
                const base64 = result.split(',')[1];
                
                // Infer MIME type
                let mimeType = file.type;
                if (!mimeType || mimeType === "") {
                     if (name.endsWith(".rw2")) mimeType = "image/x-panasonic-raw";
                    else if (name.endsWith(".arw")) mimeType = "image/x-sony-arw";
                    else if (name.endsWith(".cr2")) mimeType = "image/x-canon-cr2";
                    else if (name.endsWith(".dng")) mimeType = "image/x-adobe-dng";
                    else if (name.endsWith(".nef")) mimeType = "image/x-nikon-nef";
                    else mimeType = "application/octet-stream";
                }

                if (isRawFile) {
                    setRawBinary(base64); // Keep raw bytes for export
                    
                    // ATTEMPT 1: EXTRACT EMBEDDED PREVIEW (REAL IMAGE)
                    const previewUrl = await extractEmbeddedPreview(file);
                    
                    if (previewUrl) {
                        // Success! We found the hidden JPEG
                        setOriginalImage(previewUrl);
                        setIsProxyView(false);
                        const previewBase64 = previewUrl.split(',')[1];
                        await analyzeImage(previewBase64, "image/jpeg");
                    } else {
                        // ATTEMPT 2: FALLBACK TO PROXY CARD
                        const proxyUrl = generateRawProxyImage(file.name, extension);
                        setOriginalImage(proxyUrl);
                        setIsProxyView(true);
                        const proxyBase64 = proxyUrl.split(',')[1];
                        await analyzeImage(proxyBase64, "image/jpeg");
                    }

                } else {
                    setRawBinary(null);
                    setOriginalImage(result);
                    setIsProxyView(false);
                    await analyzeImage(base64, mimeType);
                }
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    // 1. GENERATE PROPOSALS
    const initiatePreFlightCheck = async () => {
         if (!hasApiKey) {
             await handleApiKeySelect();
             if (!await (window as any).aistudio?.hasSelectedApiKey()) return;
        }
        if (!originalImage) return;

        const actions: ActionProposal[] = [];

        // --- CORE RESTORATION ---
        if (telemetry?.isBlackAndWhite) {
            actions.push({ id: 'colorize_restoration', label: 'Neural Colorization', description: 'Monochrome signal detected. In-paint color data?', technicalDetail: 'Deep Chroma Estimation', isActive: false, isCritical: false });
             actions.push({ id: 'bw_enhancement', label: 'Silver Halide Contrast', description: 'Deepen blacks and enhance midtone separation.', technicalDetail: 'Zone System Remap', isActive: true, isCritical: false });
        } else {
             actions.push({ id: 'normalization', label: 'ACES Input Transform', description: 'Normalize Log/RAW gamma to linear working space.', technicalDetail: 'V-Log -> ACES AP1', isActive: true, isCritical: true });
        }
        if (telemetry?.signal?.rmsNoise && telemetry.signal.rmsNoise > 1.5) {
            actions.push({ id: 'denoise', label: 'Deep Learning Denoise', description: 'High ISO noise detected. Apply organic reduction.', technicalDetail: 'Spatial/Temporal (Chroma)', isActive: true, isCritical: false });
        }
        
        // --- NEW: PROFESSIONAL LIGHTING & BACKGROUNDS ---
        actions.push({ id: 'tone_curve', label: 'Luma Curve Optimization', description: 'Apply "S-Curve" to linearize density and improve depth.', technicalDetail: '16-bit Luminance Remap', isActive: false, isCritical: false });
        
        actions.push({ id: 'background_white', label: 'Studio Isolation (White)', description: 'Isolate on Infinite White. Retain floor reflection & shadows.', technicalDetail: 'Matte + Grounding', isActive: false, isCritical: false });
        actions.push({ id: 'background_black', label: 'Void Isolation (Black)', description: 'Isolate on Infinite Black. Retain floor reflection & shadows.', technicalDetail: 'Matte + Grounding', isActive: false, isCritical: false });

        if (telemetry?.signal?.clipping?.highlights) {
             actions.push({ id: 'highlight_recon', label: 'Highlight Reconstruction', description: 'Clipped channels detected. Reconstruct structure.', technicalDetail: 'Generative In-painting', isActive: true, isCritical: false });
        }
        
        // --- MANDATORY PROTECTION ---
        actions.push({ id: 'skin_texture', label: 'Texture Integrity Guard', description: 'Prevent AI smoothing. Maintain original pores & grain.', technicalDetail: 'Frequency Protection', isActive: true, isCritical: true });

        if (mode === 'MANUAL') {
             if (gradingState.exposure !== 0) actions.push({ id: 'man_exp', label: 'Exposure Offset', description: `Apply user density shift: ${gradingState.exposure}`, technicalDetail: 'Printer Lights', isActive: true, isCritical: false });
             if (gradingState.temp !== 0 || gradingState.tint !== 0) actions.push({ id: 'man_wb', label: 'White Balance Correct', description: `Temp: ${gradingState.temp}, Tint: ${gradingState.tint}`, technicalDetail: 'Matrix Adjustment', isActive: true, isCritical: false });
        }

        setProposals(actions);
        setShowModal(true);
    };

    const executeRender = async () => {
        setShowModal(false);
        if (!originalImage) return;
        
        const base64 = originalImage.split(',')[1];
        
        const activeProposals = proposals.filter(p => p.isActive);
        const technicalInstructions = activeProposals.map(p => `${p.label} (${p.technicalDetail})`).join(", ");
        const colorizeProposal = proposals.find(p => p.id === 'colorize_restoration');
        const shouldColorize = colorizeProposal?.isActive || false;
        
        // Handle Backgrounds (Exclusive)
        const whiteBg = activeProposals.find(p => p.id === 'background_white');
        const blackBg = activeProposals.find(p => p.id === 'background_black');
        const curveOpt = activeProposals.find(p => p.id === 'tone_curve');

        // REVISED VISUAL GOAL: ABSOLUTE FIDELITY
        let visualGoal = "PRIORITY 1: PHOTOREALISTIC FIDELITY. RETAIN ALL IMPERFECTIONS, PORES, AND TEXTURE. DO NOT CLEAN THE IMAGE.";
        
        if (whiteBg) visualGoal += " ACTION: REMOVE BACKGROUND. REPLACE WITH INFINITE WHITE STUDIO. **CRITICAL**: KEEP CONTACT SHADOWS ON FLOOR. DO NOT LET SUBJECT FLOAT.";
        if (blackBg) visualGoal += " ACTION: REMOVE BACKGROUND. REPLACE WITH INFINITE BLACK VOID. **CRITICAL**: KEEP CONTACT SHADOWS ON FLOOR. DO NOT LET SUBJECT FLOAT.";
        if (curveOpt) visualGoal += " ACTION: APPLY PROFESSIONAL 'S-CURVE' TO LIGHTING. LINEARIZE DENSITY.";

        if (telemetry?.isBlackAndWhite && !shouldColorize) {
            visualGoal += " OUTPUT MUST BE MONOCHROME. FOCUS ON DYNAMIC RANGE ONLY.";
        } else if (telemetry?.isBlackAndWhite && shouldColorize) {
             visualGoal += " RESTORATION TASK: COLORIZE. ADD NOISE TO PREVENT 'PAINTED' LOOK.";
        }
        const prompt = `EXECUTE FORENSIC PIPELINE v12.0. ACTIVE PROTOCOLS: ${technicalInstructions} VISUAL GOAL: ${visualGoal}`;
        const overrides = mode === 'MANUAL' ? gradingState : undefined;
        
        let mimeType = "image/jpeg";
        if (!fileMetadata?.isRaw && fileMetadata?.type) {
            mimeType = fileMetadata.type;
        }

        await processImage(base64, mimeType, prompt, overrides);
        navigate('/transition');
    };

    const toggleProposal = (id: string) => {
        // Exclusive logic for backgrounds (can't have both white and black)
        if (id === 'background_white') {
             setProposals(prev => prev.map(p => {
                 if (p.id === 'background_white') return { ...p, isActive: !p.isActive };
                 if (p.id === 'background_black') return { ...p, isActive: false }; // Disable black
                 return p;
             }));
        } else if (id === 'background_black') {
             setProposals(prev => prev.map(p => {
                 if (p.id === 'background_black') return { ...p, isActive: !p.isActive };
                 if (p.id === 'background_white') return { ...p, isActive: false }; // Disable white
                 return p;
             }));
        } else {
             setProposals(prev => prev.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p));
        }
    };

    const updateGrade = (key: keyof GradingState, value: number | boolean) => {
        setGradingState({ ...gradingState, [key]: value });
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-[#0d1117] text-white font-display relative">
            
            {/* --- PIPELINE SETTINGS MODAL --- */}
            {showPipelineSettings && (
                 <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-[#111722] border border-[#232f48] shadow-2xl w-full max-w-2xl rounded-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-[#1a2333] px-6 py-4 border-b border-[#232f48] flex justify-between items-center">
                            <h3 className="text-white font-bold text-lg tracking-tight flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-500">tune</span>
                                PIPELINE CONFIGURATION
                            </h3>
                            <button onClick={() => setShowPipelineSettings(false)} className="text-[#64748b] hover:text-white"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <div className="p-6 overflow-y-auto bg-[#0d1117] space-y-6">
                            {/* ACES IDT */}
                             <div className="space-y-3">
                                <h4 className="text-xs font-bold text-[#92a4c9] uppercase tracking-widest border-b border-[#232f48] pb-1">Input Transform (IDT)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-[#64748b] uppercase">Gamma Curve</label>
                                        <select className="w-full bg-[#1a2333] border border-[#232f48] text-white text-xs p-2 rounded outline-none">
                                            <option>Panasonic V-Log</option>
                                            <option>Sony S-Log3</option>
                                            <option>Arri LogC3</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-[#64748b] uppercase">Gamut</label>
                                        <select className="w-full bg-[#1a2333] border border-[#232f48] text-white text-xs p-2 rounded outline-none">
                                            <option>V-Gamut</option>
                                            <option>S-Gamut3.Cine</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                             {/* ACES ODT */}
                             <div className="space-y-3">
                                <h4 className="text-xs font-bold text-[#92a4c9] uppercase tracking-widest border-b border-[#232f48] pb-1">Output Transform (ODT)</h4>
                                <div className="space-y-2">
                                    <label className="flex items-center justify-between p-3 border border-[#232f48] rounded bg-[#161b22] cursor-pointer hover:border-blue-500/50">
                                        <div className="flex items-center gap-3">
                                            <input type="radio" name="odt" defaultChecked className="text-blue-500 bg-transparent border-gray-600"/>
                                            <div>
                                                <div className="text-sm font-bold text-white">Rec.709 (Scene)</div>
                                                <div className="text-[10px] text-[#64748b]">Standard broadcast gamma 2.4</div>
                                            </div>
                                        </div>
                                    </label>
                                     <label className="flex items-center justify-between p-3 border border-[#232f48] rounded bg-[#161b22] cursor-pointer hover:border-blue-500/50">
                                        <div className="flex items-center gap-3">
                                            <input type="radio" name="odt" className="text-blue-500 bg-transparent border-gray-600"/>
                                            <div>
                                                <div className="text-sm font-bold text-white">P3-DCI (Cinema)</div>
                                                <div className="text-[10px] text-[#64748b]">Digital projection gamut</div>
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                         <div className="p-4 bg-[#111722] border-t border-[#232f48] flex justify-end">
                            <button onClick={() => setShowPipelineSettings(false)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded uppercase tracking-wider">Save Pipeline</button>
                        </div>
                    </div>
                 </div>
            )}

            {/* --- PRE-FLIGHT CHECK MODAL --- */}
            {showModal && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-[#111722] border border-[#232f48] shadow-2xl w-full max-w-2xl rounded-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-[#1a2333] px-6 py-4 border-b border-[#232f48] flex justify-between items-center">
                            <div className="flex flex-col">
                                <h3 className="text-white font-bold text-lg tracking-tight flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">playlist_add_check</span>
                                    PRE-FLIGHT DIAGNOSTIC CHECK
                                </h3>
                                <p className="text-[#92a4c9] text-xs font-mono mt-1">CONFIRM PROCESSING VECTORS // ENGINE V12.0</p>
                            </div>
                            <div className="text-[10px] font-mono bg-black/40 text-[#92a4c9] px-2 py-1 rounded">
                                {proposals.filter(p => p.isActive).length} NODES ACTIVE
                            </div>
                        </div>
                        
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-[#0d1117]">
                            <div className="space-y-3">
                                {proposals.map((proposal) => (
                                    <div 
                                        key={proposal.id}
                                        onClick={() => toggleProposal(proposal.id)}
                                        className={`group flex items-start gap-4 p-4 rounded border cursor-pointer transition-all ${
                                            proposal.isActive 
                                            ? 'bg-[#1a2333] border-primary/50 shadow-[0_0_15px_rgba(19,91,236,0.1)]' 
                                            : 'bg-[#161b22] border-[#232f48] opacity-60 hover:opacity-80'
                                        }`}
                                    >
                                        <div className={`mt-1 size-5 rounded border flex items-center justify-center transition-colors ${
                                            proposal.isActive 
                                            ? 'bg-primary border-primary text-white' 
                                            : 'border-[#64748b] bg-transparent'
                                        }`}>
                                            {proposal.isActive && <span className="material-symbols-outlined text-sm font-bold">check</span>}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className={`text-sm font-bold uppercase tracking-wide ${proposal.isActive ? 'text-white' : 'text-[#64748b]'}`}>{proposal.label}</h4>
                                                <span className="text-[9px] font-mono text-[#475569] bg-[#0d1117] px-1.5 py-0.5 rounded border border-[#232f48]">{proposal.technicalDetail}</span>
                                            </div>
                                            <p className="text-xs text-[#92a4c9] leading-relaxed">{proposal.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 bg-[#111722] border-t border-[#232f48] flex justify-end gap-3">
                            <button 
                                onClick={() => setShowModal(false)}
                                className="px-5 py-3 rounded text-xs font-bold uppercase tracking-widest text-[#92a4c9] hover:text-white hover:bg-[#1a2333] transition-colors"
                            >
                                Abort Sequence
                            </button>
                            <button 
                                onClick={executeRender}
                                className="px-6 py-3 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all"
                            >
                                <span className="material-symbols-outlined text-sm">rocket_launch</span>
                                Engage Engine
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header with Credit */}
            <header className="flex-none h-14 border-b border-[#232f48] bg-[#111722] px-4 flex items-center justify-between z-20">
                <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-primary text-2xl">lens_blur</span>
                    <div>
                        <h2 className="text-sm font-bold tracking-widest text-white leading-none">PHOTOAUDIT PRO <span className="text-primary">v12.0</span></h2>
                        <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#92a4c9] mt-1">
                            Diseñado por Juan Carlos Alvarado
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                     <button 
                        onClick={handleApiKeySelect}
                        className={`flex items-center gap-2 border text-[10px] font-bold px-3 py-1.5 rounded uppercase tracking-wider transition-all ${
                            hasApiKey 
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-white' 
                            : 'bg-red-500/10 border-red-500 text-red-500 hover:bg-red-500 hover:text-white animate-pulse'
                        }`}
                     >
                        <span className="material-symbols-outlined text-sm">{hasApiKey ? 'verified_user' : 'key'}</span>
                        {hasApiKey ? "API Connected" : "Connect API"}
                     </button>
                     <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 bg-[#1a2333] border border-[#232f48] hover:border-primary text-white text-[10px] font-bold px-3 py-1.5 rounded uppercase tracking-wider transition-all"
                     >
                        <span className="material-symbols-outlined text-sm">upload_file</span>
                        Load Source
                     </button>
                     <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,.rw2,.arw,.cr2,.dng,.nef,.orf,.raf" />
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden flex-col">
                
                {/* 1. TOP BAR WAVEFORM (High Precision) */}
                <div className="h-40 bg-black border-b border-[#232f48] relative shrink-0 overflow-hidden">
                    <div className="absolute top-2 left-4 z-10 text-[10px] font-bold text-[#92a4c9] uppercase tracking-widest flex items-center gap-2 bg-black/50 px-2 rounded">
                        <span className="material-symbols-outlined text-sm">ssid_chart</span> Waveform / RGB Parade (Rec.709)
                    </div>
                    {telemetry ? (
                        <div className="w-full h-full relative">
                            {/* Waveform SVG with thinner strokes and screen blend mode for additive color */}
                            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full absolute inset-0 mix-blend-screen">
                                <path d={createPath(telemetry.histogram.r, 100, 100)} fill="none" stroke="#ff0000" strokeWidth="0.5" className="opacity-80" />
                                <path d={createPath(telemetry.histogram.r, 100, 100)} fill="#ff0000" className="opacity-10" />
                                
                                <path d={createPath(telemetry.histogram.g, 100, 100)} fill="none" stroke="#00ff00" strokeWidth="0.5" className="opacity-80" />
                                <path d={createPath(telemetry.histogram.g, 100, 100)} fill="#00ff00" className="opacity-10" />
                                
                                <path d={createPath(telemetry.histogram.b, 100, 100)} fill="none" stroke="#0000ff" strokeWidth="0.5" className="opacity-80" />
                                <path d={createPath(telemetry.histogram.b, 100, 100)} fill="#0000ff" className="opacity-10" />
                            </svg>
                            
                            {/* Graticule Overlay (IRE Scale) */}
                            <div className="absolute inset-0 w-full h-full pointer-events-none flex flex-col justify-between py-2 px-1">
                                <div className="border-t border-white/20 w-full relative"><span className="absolute right-0 -top-3 text-[9px] text-white/40 font-mono">100 IRE (Clip)</span></div>
                                <div className="border-t border-white/10 w-full relative"><span className="absolute right-0 -top-3 text-[9px] text-white/40 font-mono">75</span></div>
                                <div className="border-t border-white/20 w-full relative"><span className="absolute right-0 -top-3 text-[9px] text-white/40 font-mono">50</span></div>
                                <div className="border-t border-white/10 w-full relative"><span className="absolute right-0 -top-3 text-[9px] text-white/40 font-mono">25</span></div>
                                <div className="border-t border-white/20 w-full relative"><span className="absolute right-0 -top-3 text-[9px] text-white/40 font-mono">0 (Black)</span></div>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <div className="text-center">
                                <span className="material-symbols-outlined text-4xl text-[#232f48] animate-pulse">query_stats</span>
                                <div className="text-xs font-mono text-[#232f48] mt-2 uppercase">Signal Input Required</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Content Split */}
                <div className="flex-1 flex overflow-hidden">

                    {/* === LEFT SIDEBAR: TELEMETRY & DATA === */}
                    <div className="w-80 bg-[#111722] flex flex-col border-r border-[#232f48] overflow-y-auto custom-scrollbar shrink-0">
                        <div className="p-4 border-b border-[#232f48] sticky top-0 bg-[#111722] z-10 flex justify-between items-center">
                             <h3 className="text-[10px] font-bold text-[#92a4c9] uppercase tracking-widest flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">data_object</span> Source Telemetry
                             </h3>
                             <button onClick={() => setShowPipelineSettings(true)} className="text-[#92a4c9] hover:text-white transition-colors" title="Pipeline Config">
                                <span className="material-symbols-outlined text-sm">tune</span>
                            </button>
                        </div>
                        
                        <div className="p-4 space-y-6">
                             {/* 1. SENSOR & EXPOSURE */}
                             <div>
                                <h3 className="text-[10px] font-bold text-[#92a4c9] uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">camera</span> Sensor Geometry
                                </h3>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-[#1a2333] p-2 rounded border border-[#232f48] col-span-2">
                                        <span className="block text-[#64748b] text-[10px] uppercase">Camera Model</span>
                                        <span className="text-white font-bold truncate">{telemetry?.camera?.model || "LUMIX S5M2X"}</span>
                                    </div>
                                    <div className="bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                        <span className="block text-[#64748b] text-[10px] uppercase">ISO Sensitivity</span>
                                        <span className="text-white font-bold">{telemetry?.camera?.iso || "--"}</span>
                                    </div>
                                    <div className="bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                        <span className="block text-[#64748b] text-[10px] uppercase">Shutter Angle</span>
                                        <span className="text-white font-bold">{telemetry?.camera?.shutterSpeed || "--"}</span>
                                    </div>
                                    <div className="bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                        <span className="block text-[#64748b] text-[10px] uppercase">Aperture</span>
                                        <span className="text-white font-bold">{telemetry?.camera?.aperture || "--"}</span>
                                    </div>
                                    <div className="bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                        <span className="block text-[#64748b] text-[10px] uppercase">Focal Length</span>
                                        <span className="text-white font-bold">{telemetry?.camera?.focalLength || "--"}</span>
                                    </div>
                                </div>
                             </div>

                             {/* 2. SIGNAL PHYSICS */}
                             <div>
                                <h3 className="text-[10px] font-bold text-[#92a4c9] uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">monitor_heart</span> Signal Physics
                                </h3>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                     <div className="bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                        <span className="block text-[#64748b] text-[10px] uppercase">Bit Depth</span>
                                        <span className="text-white font-bold">{telemetry?.bitDepth || "--"}</span>
                                    </div>
                                    <div className="bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                        <span className="block text-[#64748b] text-[10px] uppercase">Dyn Range</span>
                                        <span className="text-emerald-400 font-bold">{telemetry?.signal?.dynamicRange ? `${telemetry.signal.dynamicRange} stops` : "--"}</span>
                                    </div>
                                    <div className="bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                        <span className="block text-[#64748b] text-[10px] uppercase">RMS Noise</span>
                                        <span className={`${telemetry?.signal?.rmsNoise && telemetry.signal.rmsNoise > 2 ? 'text-red-400' : 'text-green-400'} font-bold`}>
                                            {telemetry?.signal?.rmsNoise ? `${telemetry.signal.rmsNoise}%` : "--"}
                                        </span>
                                    </div>
                                     <div className="bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                        <span className="block text-[#64748b] text-[10px] uppercase">SNR</span>
                                        <span className="text-white font-bold">{telemetry?.signal?.snr ? `${telemetry.signal.snr}dB` : "--"}</span>
                                    </div>
                                </div>
                             </div>

                             {/* 3. OPTICS & COLOR */}
                             <div>
                                <h3 className="text-[10px] font-bold text-[#92a4c9] uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">palette</span> Optics & Color
                                </h3>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                     <div className="bg-[#1a2333] p-2 rounded border border-[#232f48] col-span-2">
                                        <span className="block text-[#64748b] text-[10px] uppercase">Lens Profile</span>
                                        <span className="text-white font-bold truncate">{telemetry?.camera?.lens || "--"}</span>
                                    </div>
                                     <div className="bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                        <span className="block text-[#64748b] text-[10px] uppercase">White Balance</span>
                                        <span className="text-white font-bold">{telemetry?.camera?.whiteBalance || "--"}</span>
                                    </div>
                                    <div className="bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                        <span className="block text-[#64748b] text-[10px] uppercase">Tint</span>
                                        <span className="text-white font-bold">{telemetry?.camera?.tint || "--"}</span>
                                    </div>
                                    <div className="bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                        <span className="block text-[#64748b] text-[10px] uppercase">Color Space</span>
                                        <span className="text-white font-bold">{telemetry?.colorSpace || "--"}</span>
                                    </div>
                                    <div className="bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                        <span className="block text-[#64748b] text-[10px] uppercase">MTF50</span>
                                        <span className="text-primary font-bold">{telemetry?.optics?.mtf50 || "--"}</span>
                                    </div>
                                </div>
                             </div>

                        </div>
                    </div>


                    {/* === CENTER: IMAGE VIEWPORT === */}
                    <div 
                        className={`flex-1 relative bg-[#05070a] flex items-center justify-center overflow-hidden border-x border-[#232f48] ${!originalImage ? 'cursor-pointer' : ''}`}
                        onClick={() => !originalImage && fileInputRef.current?.click()}
                    >
                         {originalImage ? (
                            fileMetadata?.isRaw && isProxyView ? (
                                // RAW FILE VISUALIZATION (FULL SCREEN SENSOR DATA)
                                <div className="w-full h-full relative overflow-hidden flex flex-col items-center justify-center bg-black">
                                    {/* Simulated Bayer Noise Background */}
                                    <RawNoisePattern />
                                    
                                    {/* Central Data HUD */}
                                    <div className="relative z-10 border border-[#232f48] bg-[#0b0f17]/90 backdrop-blur-md p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-md animate-fade-in-up">
                                        <div className="flex items-center gap-4 border-b border-[#232f48] pb-4 w-full justify-center">
                                            <span className="material-symbols-outlined text-5xl text-emerald-500 animate-pulse">raw_on</span>
                                            <div className="text-left">
                                                <div className="text-xs font-bold text-[#64748b] uppercase tracking-widest">Sensor Data Stream</div>
                                                <div className="text-2xl font-bold text-white tracking-tight">{fileMetadata.name}</div>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-3 gap-2 w-full">
                                            <div className="bg-[#1a2333] p-2 rounded border border-[#232f48] text-center">
                                                <div className="text-[9px] text-[#64748b] uppercase">Encoding</div>
                                                <div className="text-white font-bold text-xs">V-LOG L</div>
                                            </div>
                                            <div className="bg-[#1a2333] p-2 rounded border border-[#232f48] text-center">
                                                <div className="text-[9px] text-[#64748b] uppercase">Depth</div>
                                                <div className="text-white font-bold text-xs">14-BIT</div>
                                            </div>
                                            <div className="bg-[#1a2333] p-2 rounded border border-[#232f48] text-center">
                                                <div className="text-[9px] text-[#64748b] uppercase">Format</div>
                                                <div className="text-white font-bold text-xs">{fileMetadata.extension.toUpperCase()}</div>
                                            </div>
                                        </div>

                                        <div className="w-full bg-[#1a2333] rounded-full h-1.5 mt-2 overflow-hidden">
                                            <div className="bg-emerald-500 h-full w-full animate-pulse shadow-[0_0_10px_#10b981]"></div>
                                        </div>
                                        <div className="text-[9px] font-mono text-emerald-500 uppercase tracking-widest">
                                            DATA INTEGRITY: 100% // PREVIEW UNAVAILABLE
                                        </div>
                                    </div>

                                    {/* Corner Overlays */}
                                    <div className="absolute top-4 right-4 font-mono text-[10px] text-[#64748b]">
                                        MATRIX: BAYER RGGB<br/>
                                        ISO: NATIVE
                                    </div>
                                    <div className="absolute bottom-4 left-4 font-mono text-[10px] text-[#64748b]">
                                        BUFFER: 24.5MB<br/>
                                        STREAM: LOCKED
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <img src={originalImage} className="max-w-full max-h-full object-contain shadow-2xl" alt="Preview" />
                                    {fileMetadata?.isRaw && (
                                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur px-3 py-1 rounded-full border border-white/10 text-[10px] font-bold text-emerald-400 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-sm">visibility</span>
                                            EMBEDDED PREVIEW EXTRACTED
                                        </div>
                                    )}
                                </>
                            )
                        ) : (
                            <div className="flex flex-col items-center text-[#232f48]">
                                <span className="material-symbols-outlined text-6xl mb-4">add_a_photo</span>
                                <span className="text-xs uppercase tracking-[0.2em]">No Media Ingested</span>
                            </div>
                        )}
                        {originalImage && <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
                             <div className="text-[10px] bg-[#232f48]/80 text-white border border-white/10 px-2 py-1 rounded font-mono flex items-center gap-2">
                                <span className="size-2 rounded-full bg-red-500 animate-pulse"></span>
                                LUMIX S5M2X DETECTED
                            </div>
                            <div className="text-[9px] bg-black/50 text-[#92a4c9] px-2 py-0.5 rounded font-mono w-fit">
                                V-LOG / V-GAMUT
                            </div>
                             {telemetry?.isBlackAndWhite && (
                                <div className="text-[9px] bg-white/10 text-white px-2 py-0.5 rounded font-mono border border-white/20 w-fit">
                                    MONOCHROME
                                </div>
                            )}
                        </div>}
                    </div>

                    {/* === RIGHT SIDEBAR: CONTROLS === */}
                    <div className="w-80 bg-[#111722] flex flex-col border-l border-[#232f48] overflow-y-auto custom-scrollbar shrink-0">
                        <div className="p-4 border-b border-[#232f48] sticky top-0 bg-[#111722] z-10">
                             <h3 className="text-[10px] font-bold text-[#92a4c9] uppercase tracking-widest flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">tune</span> Grading Console
                             </h3>
                        </div>

                        {/* Controls */}
                        <div className="p-4 flex-1 space-y-6">
                            
                            {/* 4. LIGHTING */}
                             <div>
                                <h3 className="text-[10px] font-bold text-[#92a4c9] uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">light_mode</span> Scene Lighting
                                </h3>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                     <div className="bg-[#1a2333] p-2 rounded border border-[#232f48] col-span-2">
                                        <span className="block text-[#64748b] text-[10px] uppercase">Type</span>
                                        <span className="text-white font-bold">{telemetry?.lighting?.type || "--"}</span>
                                    </div>
                                     <div className="bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                        <span className="block text-[#64748b] text-[10px] uppercase">Direction</span>
                                        <span className="text-white font-bold">{telemetry?.lighting?.direction || "--"}</span>
                                    </div>
                                    <div className="bg-[#1a2333] p-2 rounded border border-[#232f48]">
                                        <span className="block text-[#64748b] text-[10px] uppercase">Contrast Ratio</span>
                                        <span className="text-white font-bold">{telemetry?.lighting?.contrastRatio || "--"}</span>
                                    </div>
                                </div>
                             </div>

                             {/* 5. FINISH QUALITY (AI SMOOTHNESS TOGGLE) */}
                             <div className="bg-[#1a2333] p-3 rounded border border-[#232f48]">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-bold text-white uppercase flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">face</span>
                                        Surface Finish
                                    </span>
                                    {gradingState.enableSmoothness && <span className="text-[9px] text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded flex items-center gap-1 border border-orange-400/20"><span className="material-symbols-outlined text-[10px]">warning</span>SOFT</span>}
                                </div>
                                <div className="flex items-center justify-between">
                                     <span className="text-xs text-[#92a4c9]">AI Smoothing (Cosmetic)</span>
                                     <button 
                                        onClick={() => updateGrade('enableSmoothness', !gradingState.enableSmoothness)}
                                        className={`w-10 h-5 rounded-full relative transition-colors ${gradingState.enableSmoothness ? 'bg-primary' : 'bg-[#0d1117] border border-[#232f48]'}`}
                                     >
                                         <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${gradingState.enableSmoothness ? 'left-[22px]' : 'left-0.5'}`}></div>
                                     </button>
                                </div>
                                <p className="text-[9px] text-[#64748b] mt-2 leading-tight border-t border-white/5 pt-2">
                                    {gradingState.enableSmoothness ? "WARNING: Artificial smoothing enabled. Micro-texture loss possible." : "Texture Integrity Protection Active (NIST Standard)."}
                                </p>
                            </div>

                            <div>
                                <div className="flex bg-[#1a2333] p-1 rounded mb-4 border border-[#232f48]">
                                    <button onClick={() => setMode('AUTO')} className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded transition-all ${mode === 'AUTO' ? 'bg-primary text-white shadow' : 'text-[#64748b] hover:text-white'}`}>Auto (ACES)</button>
                                    <button onClick={() => setMode('MANUAL')} className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded transition-all ${mode === 'MANUAL' ? 'bg-primary text-white shadow' : 'text-[#64748b] hover:text-white'}`}>Printer Lights</button>
                                </div>

                                {mode === 'MANUAL' && (
                                    <div className="space-y-4 mb-4 animate-fade-in p-2 bg-[#1a2333] rounded border border-[#232f48]">
                                        <h4 className="text-[10px] font-bold text-white uppercase mb-2 border-b border-white/10 pb-1">Offset (Printer Points)</h4>
                                        <div className="space-y-2">
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px] text-[#92a4c9]"><span>Exposure (Density)</span><span className="font-mono text-white">{gradingState.exposure > 0 ? '+' : ''}{gradingState.exposure}</span></div>
                                                <input type="range" min="-3" max="3" step="0.1" value={gradingState.exposure} onChange={(e) => updateGrade('exposure', parseFloat(e.target.value))} className="w-full h-1 bg-black rounded-lg appearance-none cursor-pointer" />
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px] text-[#92a4c9]"><span>Cyan / Red</span><span className="font-mono text-white">{gradingState.temp}</span></div>
                                                <input type="range" min="-50" max="50" step="1" value={gradingState.temp} onChange={(e) => updateGrade('temp', parseFloat(e.target.value))} className="w-full h-1 bg-gradient-to-r from-cyan-900 via-gray-700 to-red-900 rounded-lg appearance-none cursor-pointer" />
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px] text-[#92a4c9]"><span>Magenta / Green</span><span className="font-mono text-white">{gradingState.tint}</span></div>
                                                <input type="range" min="-50" max="50" step="1" value={gradingState.tint} onChange={(e) => updateGrade('tint', parseFloat(e.target.value))} className="w-full h-1 bg-gradient-to-r from-green-900 via-gray-700 to-pink-900 rounded-lg appearance-none cursor-pointer" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button 
                                    onClick={initiatePreFlightCheck}
                                    disabled={!originalImage || processingState.isProcessing}
                                    className={`w-full py-4 rounded text-xs font-bold uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${processingState.isProcessing ? 'bg-[#232f48] text-[#64748b]' : 'bg-primary hover:bg-blue-600 text-white shadow-primary/20'}`}
                                >
                                    {processingState.isProcessing ? (
                                        <>
                                            <span className="material-symbols-outlined animate-spin text-sm">settings_motion_mode</span>
                                            <span>PROCESSING PIPELINE...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-sm">auto_fix_high</span>
                                            <span>RENDER PIPELINE</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;