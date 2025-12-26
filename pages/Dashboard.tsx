import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { GradingState, ActionProposal, Snapshot } from '../types';
import { extractEmbeddedPreview } from '../utils/rawUtils';
import EngineeringViewport from '../components/EngineeringViewport';
import { calculateScopes, ScopeData } from '../utils/compositionScope';
import { applyFilmGrain, applyHalation } from '../utils/FilmSimulation';
import { analyzeImageContent, editImageContent } from '../services/geminiService';
import { analyzeImagePixels } from '../services/RealtimeAnalysis';
import { extractExifTelemetry } from '../utils/exifService';
import { logger } from '../services/LoggerService';
import { SystemLogViewer } from '../components/SystemLogViewer';

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
    for (let i = 0; i < 1920; i += 100) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1080); ctx.stroke(); }
    for (let i = 0; i < 1080; i += 100) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1920, i); ctx.stroke(); }

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
    console.log("Dashboard: Mounting...");
    const navigate = useNavigate();
    const {
        originalImage,
        setOriginalImage,
        processedImage,
        setProcessedImage,
        telemetry,
        setTelemetry,
        gradingState, // [FIX] Restore
        setGradingState, // [FIX] Restore
        fileMetadata, // [FIX] Restore (needed for export)
        setFileMetadata, // [FIX] Restore
        setRawBinary, // [FIX] Restore
        snapshots,
        addSnapshot,
        restoreSnapshot,
        deleteSnapshot,
        analyzeImage, // [FIX] Restore (needed for pre-flight)
        processImage, // [FIX] Restore (needed for render)
        processingState, // [FIX] Restore (needed for UI)
        setProcessingState, // [FIX] Restore
        analysis, // [FIX] Restore
        lastProcessingSource
    } = useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [mode, setMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
    const [viewMode, setViewMode] = useState<'SINGLE' | 'COMPARE'>('SINGLE');
    const [realtimeScopes, setRealtimeScopes] = useState<ScopeData | null>(null);
    const [showLogs, setShowLogs] = useState(false); // [FIX] Restore Log Toggle State

    // Film Simulation State
    const [filmGrain, setFilmGrain] = useState(0);
    const [halation, setHalation] = useState(0);
    const [filmSimulatedImage, setFilmSimulatedImage] = useState<string | null>(null);

    // Relighting State
    const [showLightingStudio, setShowLightingStudio] = useState(false);
    const [lightingState, setLightingState] = useState({
        active: false,
        direction: 45, // Degrees
        intensity: 50, // Percent
        temperature: 5600 // Kelvin
    });

    const imageElementRef = useRef<HTMLImageElement>(null); // To read pixels for scopes
    const [hasApiKey, setHasApiKey] = useState(false);
    const [isProxyView, setIsProxyView] = useState(false);

    // UI States
    const [showModal, setShowModal] = useState(false);
    const [showPipelineSettings, setShowPipelineSettings] = useState(false);
    const [proposals, setProposals] = useState<ActionProposal[]>([]);

    // [NEW] Window Management
    // [NEW] Window Management
    const [panelZIndices, setPanelZIndices] = useState({
        filmLab: 60,
        lighting: 60,
        gamut: 60,
        metadata: 50
    });

    const [panelPositions, setPanelPositions] = useState({
        lighting: { x: 100, y: 150 },
        filmLab: { x: 1000, y: 600 }
    });

    // Simple Drag Logic
    const dragRef = useRef<{ id: string, startX: number, startY: number, initialX: number, initialY: number } | null>(null);

    const handleMouseDown = (e: React.MouseEvent, id: 'lighting' | 'filmLab') => {
        bringToFront(id);
        dragRef.current = {
            id,
            startX: e.clientX,
            startY: e.clientY,
            initialX: panelPositions[id].x,
            initialY: panelPositions[id].y
        };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragRef.current) return;
            const { id, startX, startY, initialX, initialY } = dragRef.current;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            setPanelPositions(prev => ({
                ...prev,
                [id]: { x: initialX + dx, y: initialY + dy }
            }));
        };

        const handleMouseUp = () => {
            dragRef.current = null;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const bringToFront = (panel: keyof typeof panelZIndices) => {
        setPanelZIndices(prev => {
            const maxZ = Math.max(...Object.values(prev));
            return { ...prev, [panel]: maxZ + 1 };
        });
    };

    const [hasVertex, setHasVertex] = useState(false);

    useEffect(() => {
        const checkKey = async () => {
            if ((window as any).aistudio && (window as any).aistudio.hasSelectedApiKey) {
                const hasKey = await (window as any).aistudio.hasSelectedApiKey();
                setHasApiKey(hasKey);
            }
        };

        // CHECK FOR PERSISTENT CREDENTIALS (VERTEX AI)
        const checkVertex = () => {
            const storedCreds = localStorage.getItem('VERTEX_CREDENTIALS');
            if (storedCreds) {
                setHasVertex(true);
            } else {
                setHasVertex(false);
            }
        };

        checkKey();
        checkVertex();

        // Listen for storage events (if user updates config in another tab or component)
        window.addEventListener('storage', checkVertex);
        return () => window.removeEventListener('storage', checkVertex);
    }, []);

    const handleApiKeySelect = async () => {
        if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
            await (window as any).aistudio.openSelectKey();
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            setHasApiKey(hasKey);
        }
    };




    // [FIX] Clean handleFileSelect (Now has access to analyzeImage)
    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        console.log("Dashboard: handleFileSelect triggered");
        const file = event.target.files?.[0];
        if (!file) {
            console.log("Dashboard: No file selected");
            return;
        }
        console.log("Dashboard: File selected", file.name, file.type);
        logger.info("UPLOAD", `File Selected: ${file.name}`, { size: file.size, type: file.type });

        // Metadata Object
        const metadata = {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            extension: file.name.split('.').pop()?.toLowerCase() || 'jpg',
            isRaw: !!file.name.toLowerCase().match(/\.(rw2|cr2|nef|arw|dng)$/)
        };

        // RAW Handling
        if (metadata.isRaw) {
            setProcessingState(prev => ({ ...prev, isProcessing: true, stage: 'Extracting RAW Preview...', progress: 10 }));

            try {
                const previewUrl = await extractEmbeddedPreview(file);

                if (previewUrl) {
                    setOriginalImage(previewUrl, metadata);
                    // [FIX] Initialize Basic Telemetry so sidebar isn't empty
                    setTelemetry({
                        sharpness: 0, noiseLevel: 0, dynamicRange: "PENDING", bitDepth: "14-bit",
                        auditStatus: "WARN", isBlackAndWhite: false, colorSpace: "V-Gamut",
                        camera: { model: "LUMIX S5M2X", iso: 0, shutterSpeed: "--", aperture: "--", focalLength: "--", whiteBalance: "Daylight", tint: "0" },
                        signal: { rmsNoise: 0, snr: 0, dynamicRange: 0, clipping: { highlights: false, shadows: false } },
                        histogram: { r: [], g: [], b: [] },
                        optics: { lens: "Unknown", chromaticAberration: "None" },
                        lighting: { type: "Unknown", direction: "Unknown", contrastRatio: "Unknown" }
                    } as any);

                    // [FIX] Combined Analysis for RAW
                    Promise.all([
                        analyzeImagePixels(previewUrl),
                        extractExifTelemetry(file) // RAW files have rich EXIF
                    ]).then(([pixelData, exifData]) => {
                        setTelemetry(prev => ({
                            ...prev,
                            ...pixelData,
                            ...exifData,
                            camera: { ...prev.camera, ...(exifData.camera || {}) },
                            optics: { ...prev.optics, ...(exifData.optics || {}) },
                            lighting: { ...prev.lighting, ...(exifData.lighting || {}) },
                            histogram: pixelData.histogram,
                            signal: pixelData.signal
                        }));
                        logger.success("ANALYSIS", "RAW Telemetry Extracted", { model: exifData.camera?.model });
                    }).catch(err => logger.error("ANALYSIS", "RAW Analysis Failed", err));

                    setIsProxyView(false); // [FIX] Show the image, not the "Preview Unavailable" card
                    setProcessingState(prev => ({ ...prev, isProcessing: false }));
                    logger.success("UPLOAD", "RAW Preview Extracted Successfully");
                } else {
                    throw new Error("Failed to extract preview");
                }
            } catch (error) {
                console.error("RAW Error:", error);
                logger.error("UPLOAD", "RAW Extraction Failed", error);
                setProcessingState(prev => ({ ...prev, isProcessing: false }));
                alert("Could not extract RAW preview. Please convert to JPG/PNG.");
            }
        } else {
            // Standard Image (JPG/PNG)
            setProcessingState(prev => ({ ...prev, isProcessing: true, stage: 'Loading Image...', progress: 50 }));

            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setOriginalImage(e.target.result as string, metadata);
                    // [FIX] Initialize Basic Telemetry
                    setTelemetry({
                        sharpness: 0, noiseLevel: 0, dynamicRange: "PENDING", bitDepth: "8-bit",
                        auditStatus: "WARN", isBlackAndWhite: false, colorSpace: "sRGB",
                        camera: { model: "Unknown Source", iso: 0, shutterSpeed: "--", aperture: "--", focalLength: "--", whiteBalance: "Auto", tint: "0" },
                        signal: { rmsNoise: 0, snr: 0, dynamicRange: 0, clipping: { highlights: false, shadows: false } },
                        histogram: { r: [], g: [], b: [] },
                        optics: { lens: "Unknown", chromaticAberration: "None" },
                        lighting: { type: "Unknown", direction: "Unknown", contrastRatio: "Unknown" }
                    } as any);

                    // [FIX] Independent Analysis Chains (Failure in one doesn't stop the other)

                    // 1. Pixel Physics (Histogram, Noise) - CRITICAL for Graphs
                    analyzeImagePixels(e.target.result as string).then(pixelData => {
                        console.log("Pixel Analysis Success", pixelData);
                        setTelemetry(prev => ({
                            ...prev,
                            ...pixelData,
                            histogram: pixelData.histogram,
                            signal: pixelData.signal
                        }));
                        setRealtimeScopes(pixelData.scopes);
                    }).catch(err => console.error("Pixel Analysis Failed", err));

                    // 2. EXIF Metadata (Camera Model) - Optional
                    extractExifTelemetry(file).then(exifData => {
                        console.log("EXIF Success", exifData);
                        setTelemetry(prev => ({
                            ...prev,
                            ...exifData,
                            camera: { ...prev.camera, ...(exifData.camera || {}) },
                            optics: { ...prev.optics, ...(exifData.optics || {}) },
                            lighting: { ...prev.lighting, ...(exifData.lighting || {}) }
                        }));
                    }).catch(err => console.warn("EXIF Failed (Non-fatal)", err));

                    setProcessingState(prev => ({ ...prev, isProcessing: false }));
                    logger.success("UPLOAD", "Default Analysis Complete", { type: file.type });
                }
            };
            reader.readAsDataURL(file);
        }
        // Clear input to allow re-selection
        event.target.value = '';
    };

    // REAL-TIME SCOPE CALCULATION (Unified Logic)
    useEffect(() => {
        const source = processedImage || originalImage;
        if (!source) return;

        // Use the same robust service as initial load
        analyzeImagePixels(source).then(data => {
            setRealtimeScopes(data.scopes);
        }).catch(e => console.error("Scope calculation failed", e));

    }, [originalImage, processedImage]);

    // FILM SIMULATION EFFECT (Live Preview on Original OR Processed)
    useEffect(() => {
        const sourceImage = processedImage || originalImage; // [FIX] Use Original if no Processed
        if (!sourceImage) {
            setFilmSimulatedImage(null);
            return;
        }

        if (filmGrain === 0 && halation === 0) {
            setFilmSimulatedImage(null);
            return;
        }

        const img = new Image();
        img.src = sourceImage;
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(img, 0, 0);

            // Apply Effects with stronger visibility
            if (filmGrain > 0) applyFilmGrain(ctx, canvas.width, canvas.height, (filmGrain / 100) * 2); // 2x multiplier
            if (halation > 0) applyHalation(ctx, canvas.width, canvas.height, 300, 30, (halation / 100) * 1.5); // 1.5x multiplier, larger radius

            setFilmSimulatedImage(canvas.toDataURL('image/jpeg', 0.9));
        };
    }, [processedImage, originalImage, filmGrain, halation]);

    // 1. GENERATE PROPOSALS
    const initiatePreFlightCheck = async () => {
        // [FIX] Allow Vertex to bypass API Key check
        if (!hasApiKey && !hasVertex) {
            await handleApiKeySelect();
            // Double check if they managed to connect either
            const keySelected = await (window as any).aistudio?.hasSelectedApiKey();
            if (!keySelected && !localStorage.getItem('VERTEX_CREDENTIALS')) return;
        }
        if (!originalImage) return;

        const actions: ActionProposal[] = [];

        // --- DYNAMIC AI CONSULTATION (NEW) ---
        if (telemetry?.aiSuggestions && telemetry.aiSuggestions.length > 0) {
            console.log("Using AI Consultant Suggestions");

            // Map AI strings to ActionProposals
            const aiActions = telemetry.aiSuggestions.map((suggestion, index) => {
                // CLEAN LABEL: Remove "AI Insight:" prefix if present
                const cleanText = suggestion.replace(/^AI Insight:\s*/i, "").trim();
                const isUrgent = /Fix|Recover|Neutralize|Correct|Remove/i.test(cleanText);

                return {
                    id: `ai_suggestion_${index}`,
                    label: cleanText.length > 40 ? cleanText.substring(0, 37) + "..." : cleanText,
                    description: cleanText,
                    technicalDetail: 'Generative Consultant',
                    isActive: isUrgent, // SMART SELECTION: Only activate urgent tasks
                    isCritical: false
                };
            });

            actions.push(...aiActions);

            // Add TONE CURVE Action if data exists
            if (telemetry.suggestedCurve) {
                actions.push({
                    id: 'tone_curve_ai',
                    label: 'APPLY SUGGESTED TONE CURVE',
                    description: 'Match ideal contrast curve calculated by AI Agent.',
                    technicalDetail: 'Curve Remap',
                    isActive: false, // User choice
                    isCritical: true
                });
            }

            // DYNAMIC: Add Digital Matte Options (Professional Background Control)
            actions.push({
                id: 'digital_matte_black',
                label: 'DIGITAL MATTE - BLACK',
                description: 'Isolate subject on pure #000000 void. Removes all background context.',
                technicalDetail: 'Vantablack Process',
                isActive: false,
                isCritical: true
            });

            actions.push({
                id: 'digital_matte_white',
                label: 'DIGITAL MATTE - WHITE',
                description: 'Isolate subject on pure #FFFFFF infinity wall.',
                technicalDetail: 'Studio Process',
                isActive: false,
                isCritical: true
            });

        } else {
            // FALLBACK TO CLASSIC LOGIC (If API didn't return suggestions)
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
        // Keep modal open during processing to show loading state
        if (!originalImage) return;

        const base64 = originalImage.split(',')[1];

        const activeProposals = proposals.filter(p => p.isActive);
        const technicalInstructions = activeProposals.map(p => `${p.label} (${p.technicalDetail})`).join(", ");
        const colorizeProposal = proposals.find(p => p.id === 'colorize_restoration');
        const shouldColorize = colorizeProposal?.isActive || false;

        // Handle Backgrounds (Exclusive)
        const whiteBg = activeProposals.find(p => p.id === 'digital_matte_white' || p.id === 'background_white');
        const blackBg = activeProposals.find(p => p.id === 'digital_matte_black' || p.id === 'background_black');
        const curveOpt = activeProposals.find(p => p.id === 'tone_curve_ai' || p.id === 'tone_curve');

        // REVISED VISUAL GOAL: HYBRID COMPOSITING
        let visualGoal = "PRIORITY 1: SUBJECT FIDELITY. RETAIN ALL IMPERFECTIONS, PORES, AND TEXTURE ON THE SUBJECT ONLY. DO NOT SMOOTH THE SUBJECT.";

        if (whiteBg) visualGoal += " PRIORITY 2: DIGITAL MATTE - WHITE. DELETE THE BACKGROUND. FILL WITH FLAT SYNTHETIC #FFFFFF. NO FLOOR TEXTURE. NO GRAIN. JUST PURE WHITE.";
        if (blackBg) visualGoal += " PRIORITY 2: DIGITAL MATTE - BLACK. DELETE THE BACKGROUND. FILL WITH FLAT SYNTHETIC #000000. DO NOT JUST DARKEN THE FLOOR - DELETE IT. BACKGROUND MUST BE VISUALLY VOID (#000000).";
        if (curveOpt) visualGoal += " ACTION: APPLY PROFESSIONAL 'S-CURVE' TO LIGHTING. LINEARIZE DENSITY.";

        if (telemetry?.isBlackAndWhite && !shouldColorize) {
            visualGoal += " OUTPUT MUST BE MONOCHROME. FOCUS ON DYNAMIC RANGE ONLY.";
        } else if (telemetry?.isBlackAndWhite && shouldColorize) {
            visualGoal += " RESTORATION TASK: COLORIZE. ADD NOISE TO PREVENT 'PAINTED' LOOK.";
        }

        // Add unique ID to prevent caching and force a fresh "Simulation" render
        const requestId = Date.now();
        const prompt = `[REQ:${requestId}] EXECUTE FORENSIC PIPELINE v12.0. ACTIVE PROTOCOLS: ${technicalInstructions} VISUAL GOAL: ${visualGoal}`;

        console.log("🔥 DASHBOARD: Dispatching Render Request", { requestId, prompt, activeProposals: activeProposals.map(p => p.id) });
        const overrides = mode === 'MANUAL' ? gradingState : undefined;

        let mimeType = "image/jpeg";
        if (!fileMetadata?.isRaw && fileMetadata?.type) {
            mimeType = fileMetadata.type;
        }

        const lighting = lightingState.active ? {
            direction: lightingState.direction,
            intensity: lightingState.intensity,
            temperature: lightingState.temperature
        } : undefined;

        const success = await processImage(base64, mimeType, prompt, overrides, lighting);

        if (success) {
            setShowModal(false); // Close modal on success
            navigate('/transition');
        } else {
            // Processing failed - close modal so user can see error in status bar
            setShowModal(false);
        }
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

    // RENDER HELPER FOR WAVEFORM PATH
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

    const updateGrade = (key: keyof GradingState, value: number | boolean) => {
        setGradingState({ ...gradingState, [key]: value });
    };

    // Helper to visualize clock face for lighting direction
    const getDirectionLabel = (deg: number) => {
        if (deg >= 337.5 || deg < 22.5) return "12:00 (Top)";
        if (deg < 67.5) return "1:30 (Top-Right)";
        if (deg < 112.5) return "3:00 (Right)";
        if (deg < 157.5) return "4:30 (Bottom-Right)";
        if (deg < 202.5) return "6:00 (Bottom)";
        if (deg < 247.5) return "7:30 (Bottom-Left)";
        if (deg < 292.5) return "9:00 (Left)";
        return "10:30 (Top-Left)";
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-[#0d1117] text-white font-display relative">

            {/* --- VIRTUAL LIGHTING STUDIO PANEL (FLOATING - INLINE) --- */}
            {showLightingStudio && (
                <div
                    className="absolute flex flex-col shadow-2xl rounded-lg border border-[#232f48] overflow-hidden bg-[#111722]/95 backdrop-blur w-72"
                    style={{
                        left: panelPositions.lighting.x,
                        top: panelPositions.lighting.y,
                        zIndex: panelZIndices.lighting
                    }}
                    onMouseDown={() => bringToFront('lighting')}
                >
                    {/* Header */}
                    <div
                        onMouseDown={(e) => handleMouseDown(e, 'lighting')}
                        className="bg-[#161b22] px-3 py-2 border-b border-[#232f48] flex justify-between items-center cursor-grab active:cursor-grabbing select-none"
                    >
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-[#92a4c9]">wb_iridescent</span>
                            <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Lighting Grid</h4>
                        </div>
                        <div className="flex items-center gap-2" onMouseDown={e => e.stopPropagation()}>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={lightingState.active} onChange={(e) => setLightingState({ ...lightingState, active: e.target.checked })} className="sr-only peer" />
                                <div className="w-9 h-5 bg-[#161b22] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600 peer-checked:after:bg-white peer-checked:after:border-white"></div>
                            </label>
                            <button onClick={() => setShowLightingStudio(false)} className="text-[#64748b] hover:text-white ml-2"><span className="material-symbols-outlined text-sm">close</span></button>
                        </div>
                    </div>

                    <div className={`p-4 space-y-5 transition-opacity ${lightingState.active ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        {/* 1. DIRECTION */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] uppercase font-bold text-[#64748b]">
                                <span>Key Light Angle</span>
                                <span className="text-purple-400">{getDirectionLabel(lightingState.direction)}</span>
                            </div>
                            <div className="relative h-12 bg-[#0d1117] rounded-lg border border-[#232f48] overflow-hidden flex items-center px-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="360"
                                    value={lightingState.direction}
                                    onChange={(e) => setLightingState({ ...lightingState, direction: parseInt(e.target.value) })}
                                    className="w-full accent-purple-500 h-1 bg-[#232f48] appearance-none cursor-pointer z-10 relative"
                                />
                            </div>
                        </div>

                        {/* 2. INTENSITY */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] uppercase font-bold text-[#64748b]">
                                <span>Output Power</span>
                                <span className="text-purple-400">{lightingState.intensity}%</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={lightingState.intensity}
                                onChange={(e) => setLightingState({ ...lightingState, intensity: parseInt(e.target.value) })}
                                className="w-full accent-purple-500 h-1 bg-[#232f48] rounded appearance-none cursor-pointer"
                            />
                        </div>

                        {/* 3. TEMPERATURE */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] uppercase font-bold text-[#64748b]">
                                <span>Color Temp</span>
                                <span className="text-purple-400">{lightingState.temperature}K</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-orange-400 font-bold">WARM</span>
                                <input
                                    type="range"
                                    min="2500"
                                    max="9000"
                                    step="100"
                                    value={lightingState.temperature}
                                    onChange={(e) => setLightingState({ ...lightingState, temperature: parseInt(e.target.value) })}
                                    className="w-full accent-purple-500 h-1 bg-gradient-to-r from-orange-500 via-white to-blue-500 rounded appearance-none cursor-pointer"
                                />
                                <span className="text-[10px] text-blue-400 font-bold">COOL</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- PIPELINE SETTINGS MODAL --- */}
            {showPipelineSettings && (
                <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
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
                                            <input type="radio" name="odt" defaultChecked className="text-blue-500 bg-transparent border-gray-600" />
                                            <div>
                                                <div className="text-sm font-bold text-white">Rec.709 (Scene)</div>
                                                <div className="text-[10px] text-[#64748b]">Standard broadcast gamma 2.4</div>
                                            </div>
                                        </div>
                                    </label>
                                    <label className="flex items-center justify-between p-3 border border-[#232f48] rounded bg-[#161b22] cursor-pointer hover:border-blue-500/50">
                                        <div className="flex items-center gap-3">
                                            <input type="radio" name="odt" className="text-blue-500 bg-transparent border-gray-600" />
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
                <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
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
                                        className={`group flex items-start gap-4 p-4 rounded border cursor-pointer transition-all ${proposal.isActive
                                            ? 'bg-[#1a2333] border-primary/50 shadow-[0_0_15px_rgba(19,91,236,0.1)]'
                                            : 'bg-[#161b22] border-[#232f48] opacity-60 hover:opacity-80'
                                            }`}
                                    >
                                        <div className={`mt-1 size-5 rounded border flex items-center justify-center transition-colors ${proposal.isActive
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
                                disabled={processingState.isProcessing}
                                className={`px-6 py-3 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all ${processingState.isProcessing ? 'opacity-75 cursor-not-allowed' : ''}`}
                            >
                                {processingState.isProcessing ? (
                                    <>
                                        <span className="material-symbols-outlined animate-spin text-sm">settings_motion_mode</span>
                                        <span>ENGAGING...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-sm">rocket_launch</span>
                                        <span>Engage Engine</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- FILM LAB CONTROLS (FLOATING) --- */}
            {/* --- FILM LAB CONTROLS (FLOATING - INLINE) --- */}


            {/* --- HEADER STATUS BAR (Was Footer) --- */}
            <header className="flex-none h-16 bg-[#0d1117] border-b border-[#232f48] px-6 flex items-center justify-between text-xs text-[#64748b] font-mono z-50 shadow-lg relative">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-3xl">lens_blur</span>
                        <div>
                            <h2 className="text-base font-bold tracking-widest text-white leading-none">PHOTOAUDIT PRO <span className="text-primary text-xs align-top">v12.0</span></h2>
                            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#92a4c9] mt-0.5">
                                Designed by <span className="text-white">Juan Carlos Alvarado</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Log Toggle (User Requirement: Hidden by default, accessible via Settings) */}
                    <button
                        onClick={() => setShowLogs(!showLogs)}
                        className={`text-[#64748b] hover:text-white transition-colors p-2 rounded ${showLogs ? 'bg-[#232f48] text-white shadow-inner' : ''}`}
                        title="System Logs"
                    >
                        <span className="material-symbols-outlined text-sm">terminal</span>
                    </button>

                    <button
                        onClick={handleApiKeySelect}
                        className={`flex items-center gap-2 border text-[10px] font-bold px-4 py-2 rounded uppercase tracking-wider transition-all ${(hasApiKey || hasVertex)
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-white'
                            : 'bg-red-500/10 border-red-500 text-red-500 hover:bg-red-500 hover:text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                            }`}
                    >
                        <span className="material-symbols-outlined text-sm">{(hasApiKey || hasVertex) ? 'verified_user' : 'vpn_key_alert'}</span>
                        {(hasApiKey || hasVertex) ? "Engine Ready" : "Connect API Key"}
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 border border-blue-500 text-white text-[10px] font-bold px-4 py-2 rounded uppercase tracking-wider transition-all shadow-lg hover:shadow-blue-500/20"
                    >
                        <span className="material-symbols-outlined text-sm">upload_file</span>
                        Load Source
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,.rw2,.arw,.cr2,.dng,.nef,.orf,.raf,.json" />
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
                                {realtimeScopes ? (
                                    <>
                                        <path d={createRealtimePath(realtimeScopes.histogram.r, 100, 100)} fill="none" stroke="#ff0000" strokeWidth="0.5" className="opacity-80" />
                                        <path d={createRealtimePath(realtimeScopes.histogram.r, 100, 100)} fill="#ff0000" className="opacity-10" />

                                        <path d={createRealtimePath(realtimeScopes.histogram.g, 100, 100)} fill="none" stroke="#00ff00" strokeWidth="0.5" className="opacity-80" />
                                        <path d={createRealtimePath(realtimeScopes.histogram.g, 100, 100)} fill="#00ff00" className="opacity-10" />

                                        <path d={createRealtimePath(realtimeScopes.histogram.b, 100, 100)} fill="none" stroke="#0000ff" strokeWidth="0.5" className="opacity-80" />
                                        <path d={createRealtimePath(realtimeScopes.histogram.b, 100, 100)} fill="#0000ff" className="opacity-10" />
                                    </>
                                ) : telemetry ? (
                                    <>
                                        {/* Fallback to AI Data if Realtime not ready */}
                                        <path d={createPath(telemetry.histogram.r, 100, 100)} fill="none" stroke="#ff0000" strokeWidth="0.5" className="opacity-80" />
                                        <path d={createPath(telemetry.histogram.r, 100, 100)} fill="#ff0000" className="opacity-10" />
                                        <path d={createPath(telemetry.histogram.g, 100, 100)} fill="none" stroke="#00ff00" strokeWidth="0.5" className="opacity-80" />
                                        <path d={createPath(telemetry.histogram.g, 100, 100)} fill="#00ff00" className="opacity-10" />
                                        <path d={createPath(telemetry.histogram.b, 100, 100)} fill="none" stroke="#0000ff" strokeWidth="0.5" className="opacity-80" />
                                        <path d={createPath(telemetry.histogram.b, 100, 100)} fill="#0000ff" className="opacity-10" />
                                    </>
                                ) : null}
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

                            {/* 4. PROFESSIONAL CONSULTANT (NEW) */}
                            {telemetry?.gradingScore !== undefined && (
                                <div>
                                    <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">stars</span> Professional Grade
                                    </h3>
                                    <div className="bg-[#1a2333] p-3 rounded border border-[#232f48] space-y-3">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[#64748b] text-[10px] uppercase">Technical Score</span>
                                            <span className="text-2xl font-bold text-white">{telemetry.gradingScore}/100</span>
                                        </div>
                                        <div className="w-full bg-[#0d1117] rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-purple-500 h-full transition-all duration-1000"
                                                style={{ width: `${telemetry.gradingScore}%` }}
                                            />
                                        </div>

                                        {/* CURVE VISUALIZATION */}
                                        {telemetry.suggestedCurve && (
                                            <div className="mt-2 pt-2 border-t border-[#232f48]">
                                                <span className="text-[#64748b] text-[10px] uppercase block mb-1">Suggested Tone Curve</span>
                                                <div className="relative w-full h-24 bg-[#0d1117] rounded border border-[#232f48]">
                                                    {/* Grid Lines */}
                                                    <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 opacity-20 pointer-events-none">
                                                        {[...Array(16)].map((_, i) => <div key={i} className="border-r border-b border-white/20" />)}
                                                    </div>

                                                    {/* Linear Reference */}
                                                    <svg className="absolute inset-0 w-full h-full p-2" viewBox="0 0 255 255" preserveAspectRatio="none">
                                                        <line x1="0" y1="255" x2="255" y2="0" stroke="#333" strokeWidth="2" strokeDasharray="4" />

                                                        {/* AI Suggested Curve */}
                                                        <path
                                                            d={`M 0 255 ${telemetry.suggestedCurve.map(p => `L ${p[0]} ${255 - p[1]}`).join(' ')}`}
                                                            fill="none"
                                                            stroke="#a855f7"
                                                            strokeWidth="3"
                                                            vectorEffect="non-scaling-stroke"
                                                        />
                                                        {/* Points */}
                                                        {telemetry.suggestedCurve.map((p, i) => (
                                                            <circle key={i} cx={p[0]} cy={255 - p[1]} r="4" fill="#fff" />
                                                        ))}
                                                    </svg>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>


                    {/* === CENTER: IMAGE VIEWPORT === */}
                    <div
                        className={`flex-1 relative bg-[#05070a] flex flex-col items-center justify-center overflow-hidden border-x border-[#232f48] ${!originalImage ? 'cursor-pointer' : ''}`}
                        onClick={() => !originalImage && fileInputRef.current?.click()}
                    >
                        {/* VIEWPORT HEADER */}
                        {originalImage && (
                            <div className="w-full bg-[#111722] border-b border-[#232f48] p-2 flex justify-between items-center z-10 shrink-0">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setViewMode('SINGLE')}
                                        className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${viewMode === 'SINGLE' ? 'bg-blue-600 text-white' : 'text-[#64748b] hover:text-white'}`}
                                    >
                                        Singular
                                    </button>
                                    <button
                                        onClick={() => setViewMode('COMPARE')}
                                        className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${viewMode === 'COMPARE' ? 'bg-blue-600 text-white' : 'text-[#64748b] hover:text-white'}`}
                                    >
                                        Compare A/B
                                    </button>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-[10px] text-[#64748b] font-mono">
                                        ENG. VIEWPORT ACTIVE
                                    </div>
                                    {processedImage && lastProcessingSource && (
                                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider flex items-center gap-1 border ${lastProcessingSource === 'CLOUD'
                                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500'
                                            : 'bg-yellow-500/10 border-yellow-500 text-yellow-500'
                                            }`}>
                                            <span className="material-symbols-outlined text-[10px]">
                                                {lastProcessingSource === 'CLOUD' ? 'cloud_done' : 'terminal'}
                                            </span>
                                            {lastProcessingSource === 'CLOUD' ? 'GEMINI 2.0 FLASH' : 'OFFLINE SIMULATION'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex-1 w-full relative overflow-hidden">
                            {originalImage ? (
                                // MAIN VIEWPORT
                                <div className="flex-1 relative bg-[#0b0f17] flex overflow-hidden">
                                    <div className="relative flex-1 flex items-center justify-center overflow-hidden">
                                        {fileMetadata?.isRaw && isProxyView ? (
                                            // RAW PROXY (Keep existing RAW screen)
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
                                            </div>
                                        ) : (
                                            <EngineeringViewport
                                                beforeImage={originalImage}
                                                afterImage={filmSimulatedImage || processedImage || originalImage}
                                                isCompareMode={viewMode === 'COMPARE'}
                                            />
                                        )}

                                        {/* OVERLAY: Analysis scanning effect */}
                                        {processingState === 'ANALYZING' && <RawNoisePattern />}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-[#232f48] h-full">
                                    <span className="material-symbols-outlined text-6xl mb-4">add_a_photo</span>
                                    <span className="text-xs uppercase tracking-[0.2em]">No Media Ingested</span>
                                </div>
                            )}
                        </div>

                        {/* VERSION HISTORY STRIP */}
                        {snapshots.length > 0 && (
                            <div className="h-28 bg-[#111722] border-t border-[#232f48] flex flex-col shrink-0">
                                <div className="px-4 py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-widest bg-[#161b22]">
                                    Version History
                                </div>
                                <div className="flex-1 p-2 flex gap-2 overflow-x-auto custom-scrollbar">
                                    {/* Original Image Thumbnail */}
                                    {originalImage && (
                                        <div
                                            onClick={() => { setProcessedImage(null); navigate('/'); }}
                                            className="w-24 shrink-0 flex flex-col gap-1 cursor-pointer group"
                                        >
                                            <div className="h-14 rounded overflow-hidden border border-emerald-500 group-hover:border-white transition-colors">
                                                <img src={originalImage} className="w-full h-full object-cover" alt="original" />
                                            </div>
                                            <div className="text-[9px] text-emerald-500 truncate text-center group-hover:text-white font-bold">ORIGINAL</div>
                                        </div>
                                    )}
                                    {snapshots.map((snap) => (
                                        <div
                                            key={snap.id}
                                            className="w-24 shrink-0 flex flex-col gap-1 group relative"
                                        >
                                            <div
                                                onClick={() => { restoreSnapshot(snap.id); navigate('/transition'); }}
                                                className="h-14 rounded overflow-hidden border border-[#232f48] group-hover:border-primary transition-colors cursor-pointer"
                                            >
                                                <img src={snap.thumbnailUrl} className="w-full h-full object-cover" alt="snap" />
                                            </div>
                                            {/* Delete button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteSnapshot(snap.id);
                                                }}
                                                className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                                            >
                                                ×
                                            </button>
                                            <div className="text-[9px] text-[#92a4c9] truncate text-center group-hover:text-primary">{snap.label}</div>
                                        </div>
                                    ))}
                                </div>
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
                                    onClick={(hasApiKey || hasVertex) ? initiatePreFlightCheck : handleApiKeySelect}
                                    disabled={(!originalImage || processingState.isProcessing) && (hasApiKey || hasVertex)}
                                    className={`w-full py-4 rounded text-xs font-bold uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${!(hasApiKey || hasVertex)
                                        ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                                        : processingState.isProcessing
                                            ? 'bg-[#232f48] text-[#64748b]'
                                            : hasVertex
                                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20' // Vertex Green
                                                : 'bg-primary hover:bg-blue-600 text-white shadow-primary/20'
                                        }`}
                                >
                                    {processingState.isProcessing ? (
                                        <>
                                            <span className="material-symbols-outlined animate-spin text-sm">settings_motion_mode</span>
                                            <span>PROCESSING PIPELINE...</span>
                                        </>
                                    ) : !(hasApiKey || hasVertex) ? (
                                        <>
                                            <span className="material-symbols-outlined text-sm">vpn_key_alert</span>
                                            <span>CONNECT API KEY</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-sm">{hasVertex ? 'dns' : 'auto_fix_high'}</span>
                                            <span>{hasVertex ? 'ENGAGE VERTEX ENGINE' : 'RENDER PIPELINE'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {showLogs && <SystemLogViewer />}
        </div>
    );
};

export default Dashboard;
