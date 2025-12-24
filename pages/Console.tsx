import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const Console = () => {
    const { originalImage, processedImage, processImage, processingState, canUndo, undoLastEdit } = useApp();
    const [prompt, setPrompt] = useState("");

    const handleProcess = () => {
        if (originalImage && prompt) {
            const sourceImage = processedImage || originalImage;
            const base64 = sourceImage.split(',')[1];
            processImage(base64, "image/jpeg", prompt);
        }
    };

    const appendPrompt = (newText: string) => {
        setPrompt(prev => {
            const trimmed = prev.trim();
            if (trimmed.length > 0 && !trimmed.endsWith('.')) {
                return `${trimmed}. ${newText}`;
            } else if (trimmed.length > 0) {
                return `${trimmed} ${newText}`;
            }
            return newText;
        });
    };

    const PRESET_PROMPTS = [
        {
            category: "CORRECCIÓN TÉCNICA",
            prompts: [
                "Normalizar curva Logarítmica a Rec.709 lineal con contraste medio.",
                "Eliminar ruido digital cromático manteniendo el grano de película natural.",
                "Corregir aberración cromática en los bordes de alto contraste.",
                "Reconstruir información de altas luces (highlights) clipeadas.",
                "Equilibrar el balance de blancos neutralizando dominantes magentas."
            ]
        },
        {
            category: "AISLAMIENTO & FONDO (MATTE)",
            prompts: [
                "Eliminar fondo y sustituir por BLANCO (Studio Floor) manteniendo sombras de contacto.",
                "Eliminar fondo y sustituir por NEGRO (Void) manteniendo reflejo en el suelo.",
                "Generar máscara Alpha precisa en el cabello y desenfocar fondo existente (Bokeh).",
                "Limpiar ciclorama/fondo, eliminar arrugas de la tela."
            ]
        },
        {
            category: "ILUMINACIÓN AVANZADA (CURVAS)",
            prompts: [
                "Aplicar Curva de Contraste en 'S' para profundidad en medios tonos.",
                "Levantar sombras (Toe) manteniendo el punto negro anclado.",
                "Suavizar la caída de luz (Rolloff) en las altas luces.",
                "Remapear luminancia para simular iluminación Rembrandt (Key Light 45°)."
            ]
        },
        {
            category: "ESTILO & COLOR",
            prompts: [
                "Aplicar look 'Teal & Orange' cinematográfico suave.",
                "Simular emulsión Kodak Portra 400 con tonos de piel cálidos.",
                "Convertir a Blanco y Negro estilo Leica Monochrom (alto contraste).",
                "Aumentar densidad en negros para un look 'Low Key' dramático."
            ]
        },
        {
            category: "TEXTURA & DETALLE",
            prompts: [
                "Mejorar micro-contraste en texturas de piel (Separación de Frecuencias).",
                "Aumentar nitidez óptica compensando difracción de lente.",
                "Añadir grano de película 35mm orgánico en medios tonos."
            ]
        }
    ];

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-white overflow-hidden h-screen flex flex-col">
            <header className="flex-none flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#232f48] bg-[#111722] px-6 py-3 z-20">
                <div className="flex items-center gap-4 text-white">
                    <Link to="/" className="size-6 text-primary"><span className="material-symbols-outlined !text-[24px]">lens_blur</span></Link>
                    <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">PHOTOAUDIT PRO</h2>
                </div>
                <div className="flex flex-1 justify-end gap-6 items-center">
                    <nav className="hidden md:flex items-center gap-8">
                        <Link to="/" className="text-white/70 hover:text-white text-sm font-medium leading-normal transition-colors">Dashboard</Link>
                        <span className="text-white text-sm font-medium leading-normal border-b-2 border-primary py-1">Console</span>
                    </nav>
                </div>
            </header>
            <div className="flex flex-1 overflow-hidden">
                <aside className="w-96 flex flex-col border-r border-[#232f48] bg-[#111722] overflow-y-auto flex-none z-10 custom-scrollbar">
                    <div className="p-6 pb-2">
                        <h1 className="text-2xl font-bold leading-tight tracking-tight text-white mb-1">Console</h1>
                        <p className="text-[#92a4c9] text-xs uppercase tracking-wider font-medium">Flash 2.5 Re-rendering Workspace</p>
                    </div>
                    <div className="px-6 py-4 border-b border-[#232f48]">
                         <div className="flex flex-col gap-4">
                            <label className="text-white text-sm font-bold uppercase tracking-wider flex justify-between">
                                <span>Engine Prompt</span>
                                <span className="text-[10px] text-[#64748b] font-normal lowercase self-end">Multi-command enabled</span>
                            </label>
                            <textarea 
                                className="bg-[#1a2333] border border-[#232f48] rounded text-white text-sm p-3 h-32 focus:border-primary outline-none resize-none font-mono"
                                placeholder="Selecciona comandos de la guía para construir tu pipeline..."
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                            />
                            
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setPrompt("")}
                                    className="px-3 py-3 rounded text-sm font-bold border border-[#232f48] bg-[#1a2333] hover:bg-red-900/20 hover:text-red-400 text-[#64748b] transition-colors"
                                    title="Limpiar Consola"
                                >
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                                <button 
                                    onClick={undoLastEdit}
                                    disabled={!canUndo || processingState.isProcessing}
                                    className={`flex-1 py-3 rounded text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors border border-[#232f48] ${
                                        !canUndo || processingState.isProcessing
                                        ? 'bg-[#1a2333] text-[#64748b] cursor-not-allowed' 
                                        : 'bg-[#1a2333] hover:bg-[#232f48] text-[#92a4c9] hover:text-white'
                                    }`}
                                    title="Revertir a versión anterior"
                                >
                                    <span className="material-symbols-outlined text-lg">undo</span>
                                    Revertir
                                </button>
                                
                                <button 
                                    onClick={handleProcess}
                                    disabled={processingState.isProcessing || !originalImage}
                                    className={`flex-[2] py-3 rounded text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors ${
                                        processingState.isProcessing 
                                        ? 'bg-primary/50 cursor-wait' 
                                        : 'bg-primary hover:bg-blue-600 shadow-lg shadow-primary/20'
                                    }`}
                                >
                                    {processingState.isProcessing ? (
                                        <>
                                            <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                                            Procesando...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-lg">auto_fix_high</span>
                                            Ejecutar
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Instructions Panel - EXPANDED */}
                    <div className="p-6 flex-1 bg-[#0d1117]">
                        <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-primary">menu_book</span>
                            Guía de Sintaxis (Click to Append)
                        </h4>
                        
                        <div className="space-y-6">
                            {PRESET_PROMPTS.map((section, idx) => (
                                <div key={idx}>
                                    <h5 className="text-[10px] font-bold text-[#64748b] uppercase mb-2 border-b border-[#232f48] pb-1">{section.category}</h5>
                                    <ul className="space-y-2">
                                        {section.prompts.map((p, i) => (
                                            <li 
                                                key={i} 
                                                onClick={() => appendPrompt(p)}
                                                className="group cursor-pointer flex gap-2 items-start hover:bg-[#1a2333] p-1.5 rounded transition-all active:scale-95"
                                            >
                                                <span className="text-primary mt-0.5 text-[10px] opacity-50 group-hover:opacity-100">+</span>
                                                <span className="text-[#92a4c9] text-xs font-mono group-hover:text-white leading-tight">{p}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
                
                <main className="flex-1 flex flex-col relative bg-[#0a0e14]">
                    <div className="flex-1 flex items-center justify-center p-8 overflow-hidden relative group/canvas">
                        <div className="relative w-full h-full max-w-5xl shadow-2xl rounded-sm overflow-hidden border border-[#232f48] flex items-center justify-center bg-black">
                            {processedImage ? (
                                <img src={processedImage} className="max-h-full max-w-full object-contain" alt="Processed" />
                            ) : originalImage ? (
                                <img src={originalImage} className="max-h-full max-w-full object-contain opacity-50 grayscale" alt="Original" />
                            ) : (
                                <div className="text-text-secondary text-sm">Waiting for input stream...</div>
                            )}
                            
                            {processedImage && (
                                <div className="absolute top-4 right-4 bg-primary/90 backdrop-blur text-white text-xs font-bold px-2 py-1 rounded shadow-lg">RENDER: COMPLETE</div>
                            )}
                            
                            {/* Version Indicator */}
                            {processedImage && canUndo && (
                                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur text-[#92a4c9] border border-white/10 text-[10px] font-mono px-2 py-1 rounded">
                                    EDIT HISTORY ACTIVE
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Console;