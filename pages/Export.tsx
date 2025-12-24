import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const Export = () => {
    const { processedImage, originalImage, rawBinary, fileMetadata } = useApp();
    const [exportFormat, setExportFormat] = useState("JPG 100%");
    const [resolutionMode, setResolutionMode] = useState("NATIVE"); // NATIVE, MATCH_SOURCE, 1080P
    const [isExporting, setIsExporting] = useState(false);
    const [sourceDimensions, setSourceDimensions] = useState<{w: number, h: number} | null>(null);

    // Load original image dimensions on mount to enable "Match Source"
    useEffect(() => {
        if (originalImage) {
            const img = new Image();
            img.src = originalImage;
            img.onload = () => {
                setSourceDimensions({ w: img.naturalWidth, h: img.naturalHeight });
            };
        }
    }, [originalImage]);

    const handleDownload = async () => {
        if (!processedImage && exportFormat !== "RAW") return;

        setIsExporting(true);

        try {
            let downloadUrl = "";
            let filename = `PhotoAudit_Export_${Date.now()}`;
            
            // 1. RAW EXPORT (Passthrough)
            if (exportFormat === "RAW") {
                if (rawBinary && fileMetadata) {
                     // Create a blob from the raw binary string
                     const byteCharacters = atob(rawBinary);
                     const byteNumbers = new Array(byteCharacters.length);
                     for (let i = 0; i < byteCharacters.length; i++) {
                         byteNumbers[i] = byteCharacters.charCodeAt(i);
                     }
                     const byteArray = new Uint8Array(byteNumbers);
                     const blob = new Blob([byteArray], { type: "application/octet-stream" });
                     downloadUrl = URL.createObjectURL(blob);
                     filename = `PhotoAudit_Source_${Date.now()}${fileMetadata.extension}`; // e.g. .rw2
                } else if (originalImage) {
                    // Fallback if binary missing but originalImage exists (e.g. loaded as jpg)
                    downloadUrl = originalImage;
                    filename = `PhotoAudit_Source_${Date.now()}.jpg`;
                }
            } 
            // 2. IMAGE EXPORT (JPG/PNG with Canvas Processing)
            else {
                const img = new Image();
                img.src = processedImage!;
                await img.decode();

                const canvas = document.createElement('canvas');
                let targetW = img.naturalWidth;
                let targetH = img.naturalHeight;

                // Calculate Dimensions
                if (resolutionMode === "MATCH_SOURCE" && sourceDimensions) {
                    targetW = sourceDimensions.w;
                    targetH = sourceDimensions.h;
                } else if (resolutionMode === "1080P") {
                    const aspect = img.naturalWidth / img.naturalHeight;
                    if (aspect > 1) { // Landscape
                        targetW = 1920;
                        targetH = 1920 / aspect;
                    } else { // Portrait
                        targetH = 1920;
                        targetW = 1920 * aspect;
                    }
                }

                canvas.width = targetW;
                canvas.height = targetH;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    // High quality scaling
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, targetW, targetH);

                    // Encode
                    if (exportFormat.includes("PNG")) {
                        downloadUrl = canvas.toDataURL("image/png");
                        filename += ".png";
                    } else {
                        // JPG
                        const quality = exportFormat.includes("100") ? 1.0 : 0.85;
                        downloadUrl = canvas.toDataURL("image/jpeg", quality);
                        filename += ".jpg";
                    }
                }
            }

            // Trigger Download
            if (downloadUrl) {
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

        } catch (error) {
            console.error("Export failed", error);
            alert("Export failed. Please try again.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="bg-[#0b0f17] min-h-screen flex flex-col text-white font-display">
             <header className="flex items-center justify-between border-b border-[#232f48] bg-[#111722] px-6 py-4">
                <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-primary text-2xl">lens_blur</span>
                    <h2 className="text-lg font-bold">PHOTOAUDIT PRO</h2>
                </div>
                <Link to="/" className="text-xs font-bold uppercase text-[#92a4c9] hover:text-white">Back to Dashboard</Link>
            </header>

            <main className="flex-1 p-12 max-w-5xl mx-auto w-full">
                <div className="flex justify-between items-end mb-12 pb-6 border-b border-[#232f48]">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">Delivery & Mastering</h1>
                        <p className="text-[#92a4c9] text-sm">Engine v12.0 Final Output</p>
                    </div>
                    <button 
                        onClick={handleDownload}
                        disabled={(!processedImage && exportFormat !== "RAW") || isExporting}
                        className={`px-8 py-4 rounded font-bold uppercase tracking-widest flex items-center gap-3 transition-all ${((!processedImage && exportFormat !== "RAW") || isExporting) ? 'bg-[#232f48] text-[#64748b] cursor-not-allowed' : 'bg-primary hover:bg-blue-600 text-white shadow-lg shadow-primary/25'}`}
                    >
                        {isExporting ? (
                            <>
                                <span className="material-symbols-outlined animate-spin">sync</span>
                                Encoding...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">download</span>
                                Export Master
                            </>
                        )}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Settings Panel */}
                    <div className="bg-[#111722] border border-[#232f48] rounded p-6">
                        <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                             <span className="material-symbols-outlined text-sm">settings_photo_camera</span> Export Configuration
                        </h3>
                        <div className="space-y-6">
                            
                            {/* Format Selection */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs text-[#92a4c9] uppercase font-bold">File Format</label>
                                <div className="grid grid-cols-1 gap-2">
                                    <button 
                                        onClick={() => setExportFormat("JPG 100%")}
                                        className={`flex items-center justify-between p-3 rounded border text-sm transition-all ${exportFormat === "JPG 100%" ? 'bg-primary/20 border-primary text-white' : 'bg-[#1a2333] border-[#232f48] text-[#92a4c9] hover:border-white/30'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-lg">image</span>
                                            <span>JPG (Maximum Quality)</span>
                                        </div>
                                        <span className="text-[10px] font-mono opacity-50">100%</span>
                                    </button>
                                    
                                    <button 
                                        onClick={() => setExportFormat("PNG")}
                                        className={`flex items-center justify-between p-3 rounded border text-sm transition-all ${exportFormat === "PNG" ? 'bg-primary/20 border-primary text-white' : 'bg-[#1a2333] border-[#232f48] text-[#92a4c9] hover:border-white/30'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-lg">imagesmode</span>
                                            <span>PNG (Lossless)</span>
                                        </div>
                                        <span className="text-[10px] font-mono opacity-50">16-BIT SIM</span>
                                    </button>

                                    <button 
                                        onClick={() => setExportFormat("RAW")}
                                        className={`flex items-center justify-between p-3 rounded border text-sm transition-all ${exportFormat === "RAW" ? 'bg-emerald-500/20 border-emerald-500 text-white' : 'bg-[#1a2333] border-[#232f48] text-[#92a4c9] hover:border-white/30'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-lg">raw_on</span>
                                            <span>Original RAW Source</span>
                                        </div>
                                        <span className="text-[10px] font-mono opacity-50">ARCHIVE</span>
                                    </button>
                                </div>
                            </div>

                            {/* Resolution Selection */}
                            {exportFormat !== "RAW" && (
                                <div className="flex flex-col gap-2 animate-fade-in">
                                    <label className="text-xs text-[#92a4c9] uppercase font-bold">Output Resolution</label>
                                    <select 
                                        value={resolutionMode}
                                        onChange={(e) => setResolutionMode(e.target.value)}
                                        className="bg-[#1a2333] border border-[#232f48] text-white text-sm p-3 rounded outline-none focus:border-primary"
                                    >
                                        <option value="NATIVE">Native AI Resolution (4K/2K)</option>
                                        {sourceDimensions && <option value="MATCH_SOURCE">Match Source Resolution (Upscale) [{sourceDimensions.w}x{sourceDimensions.h}]</option>}
                                        <option value="1080P">HD 1080p (Web/Social)</option>
                                    </select>
                                    <p className="text-[10px] text-[#64748b] mt-1">
                                        *Selecting "Match Source" will use bicubic interpolation to match original dimensions.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Preview Panel */}
                    <div className="bg-[#111722] border border-[#232f48] rounded p-6 flex flex-col justify-center items-center text-center relative overflow-hidden group">
                         <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(0,0,0,0.2)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.2)_50%,rgba(0,0,0,0.2)_75%,transparent_75%,transparent)] bg-[size:20px_20px] opacity-10"></div>
                         
                         {processedImage && exportFormat !== "RAW" ? (
                             <>
                                <img src={processedImage} className="max-h-48 mb-4 shadow-2xl border border-white/10 rounded" alt="Preview" />
                                <h3 className="text-xl font-bold text-white mb-1 z-10">Master Render Ready</h3>
                                <p className="text-[#92a4c9] text-sm z-10 font-mono">
                                    {resolutionMode === "MATCH_SOURCE" && sourceDimensions ? `${sourceDimensions.w}x${sourceDimensions.h}` : resolutionMode === "NATIVE" ? "AI NATIVE RES" : "1920x1080"} 
                                    {' '}// {exportFormat}
                                </p>
                             </>
                         ) : exportFormat === "RAW" && fileMetadata ? (
                             <>
                                <span className="material-symbols-outlined text-6xl text-emerald-500 mb-4 z-10">folder_zip</span>
                                <h3 className="text-xl font-bold text-white mb-1 z-10">Source Archive</h3>
                                <p className="text-[#92a4c9] text-sm z-10 font-mono">{fileMetadata.name}</p>
                             </>
                         ) : (
                             <>
                                <span className="material-symbols-outlined text-6xl text-[#232f48] mb-4 z-10">image_not_supported</span>
                                <h3 className="text-xl font-bold text-[#64748b] mb-2 z-10">No Render Available</h3>
                                <p className="text-[#92a4c9] text-sm z-10">Process an image first.</p>
                             </>
                         )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Export;