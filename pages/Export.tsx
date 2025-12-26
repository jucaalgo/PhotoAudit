
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { logger } from '../services/LoggerService';

const Export = () => {
    const { processedImage, originalImage, fileMetadata } = useApp();
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState("");

    // Master Output Settings
    const [quality, setQuality] = useState(1.0); // 100%
    const [scale, setScale] = useState(1.0); // Native

    // Visual State
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        setPreviewUrl(processedImage || originalImage);
    }, [processedImage, originalImage]);

    const getFilename = (suffix: string, ext: string) => {
        if (!fileMetadata || !fileMetadata.name) return `PhotoAudit_Export_${Date.now()}.${ext}`;

        const originalName = fileMetadata.name;
        // Strip extension
        const baseName = originalName.lastIndexOf('.') > -1
            ? originalName.substring(0, originalName.lastIndexOf('.'))
            : originalName;

        // Sanitize
        const cleanName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');

        return `${cleanName}_${suffix}.${ext}`;
    }

    const handleDownloadSource = async () => {
        if (!originalImage) return;

        try {
            logger.info("EXPORT", "Downloading Source Image");
            const link = document.createElement("a");
            link.href = originalImage;
            link.download = getFilename("Source", "jpg"); // Assuming jpg for now if unknown
            if (fileMetadata?.extension) {
                link.download = getFilename("Source", fileMetadata.extension);
            }

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            logger.success("EXPORT", "Source Downloaded");
        } catch (e) {
            logger.error("EXPORT", "Source Download Failed", e);
            alert("Could not download source.");
        }
    };

    const handleExportMaster = async () => {
        const source = processedImage || originalImage;
        if (!source) {
            alert("No image to export.");
            return;
        }

        setIsProcessing(true);
        setStatusMessage("Initializing Render Engine (High-Res Blob)...");
        setProgress(10);

        try {
            // 1. Load Image
            const img = new Image();
            img.crossOrigin = "Anonymous"; // Crucial for canvas export
            img.src = source;

            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = (e) => reject(new Error("Failed to load source image into memory."));
            });

            setStatusMessage("Constructing Canvas...");
            setProgress(30);

            // 2. Setup Canvas
            const canvas = document.createElement('canvas');
            const targetWidth = img.naturalWidth * scale;
            const targetHeight = img.naturalHeight * scale;

            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d', { alpha: false });

            if (!ctx) throw new Error("Canvas Context Lost");

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            setStatusMessage("Rendering Pixels...");
            setProgress(50);

            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

            setStatusMessage("Encoding Binary Stream (JPEG)...");
            setProgress(75);

            // 3. Encode to Blob (Async & memory efficient)
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    logger.error("EXPORT", "Blob encoding failed (Empty result)");
                    setStatusMessage("Error: Encoding Failed");
                    setIsProcessing(false);
                    return;
                }

                // 4. Save
                setStatusMessage("Writing to Disk...");
                setProgress(90);

                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");

                // [FIX] Force Safe Filename (Bypass Helper)
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const finalName = `PhotoAudit_Master_${timestamp}.jpg`;

                console.log("⬇️ STARTING DOWNLOAD:", { finalName, size: blob.size, url });
                logger.info("EXPORT", "Triggering Download", { finalName });

                link.href = url;
                // Double-tap the download attribute for best compatibility
                link.download = finalName;
                link.setAttribute("download", finalName);

                document.body.appendChild(link);
                link.click();

                // Cleanup
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url); // Free memory
                    logger.success("EXPORT", "Master Export Complete (Blob)", { filename: finalName, size: blob.size });
                    setProgress(100);
                    setStatusMessage("Export Complete");
                }, 100);

                setTimeout(() => {
                    setIsProcessing(false);
                    setProgress(0);
                    setStatusMessage("");
                }, 2000);

            }, 'image/jpeg', quality);

        } catch (e) {
            console.error(e);
            logger.error("EXPORT", "Master Export Failed", e);
            setStatusMessage(`ERROR: ${e}`);
            setIsProcessing(false);
        }
    };

    return (
        <div className="bg-[#050505] min-h-screen flex flex-col text-white font-sans selection:bg-blue-500/30">
            {/* Header */}
            <header className="h-16 border-b border-[#222] flex items-center justify-between px-8 bg-[#0a0a0a]">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold tracking-tighter">PA</div>
                    <span className="font-bold tracking-wide text-sm opacity-80">DELIVERY PAGE</span>
                </div>
                <Link to="/" className="text-xs font-bold text-gray-500 hover:text-white transition-colors">RETURN TO WORKSPACE</Link>
            </header>

            <main className="flex-1 p-12 flex gap-12 max-w-[1600px] mx-auto w-full">

                {/* LEFT: SOURCE (Read Only) */}
                <div className="flex-1 flex flex-col gap-6 opacity-60 hover:opacity-100 transition-opacity">
                    <div className="border-b border-[#333] pb-4 mb-2">
                        <h2 className="text-2xl font-bold">Source Asset</h2>
                        <p className="text-gray-500 text-sm font-mono mt-1">
                            {fileMetadata?.name || "Unknown Asset"}
                            {fileMetadata?.size && ` // ${(fileMetadata.size / 1024 / 1024).toFixed(2)} MB`}
                        </p>
                    </div>

                    <div className="aspect-video bg-[#111] rounded-lg border border-[#333] overflow-hidden relative flex items-center justify-center group">
                        {originalImage ? (
                            <img src={originalImage} className="max-w-full max-h-full object-contain grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" />
                        ) : (
                            <span className="text-gray-700 font-mono text-xs">NO ASSET LOADED</span>
                        )}
                    </div>

                    <button
                        onClick={handleDownloadSource}
                        className="bg-[#222] hover:bg-[#333] text-white py-4 rounded border border-[#333] font-mono text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                    >
                        <span className="material-symbols-outlined text-sm">download</span>
                        Download Original
                    </button>
                    <p className="text-xs text-gray-600 text-center">Passthrough Request. No processing applied.</p>
                </div>

                {/* VISUAL SEPARATOR */}
                <div className="w-px bg-gradient-to-b from-transparent via-[#333] to-transparent"></div>

                {/* RIGHT: MASTER (Actionable) */}
                <div className="flex-1 flex flex-col gap-6">
                    <div className="border-b border-blue-900/30 pb-4 mb-2">
                        <h2 className="text-2xl font-bold text-blue-100">Master Output</h2>
                        <p className="text-blue-400/60 text-sm font-mono mt-1">
                            Engine v12.1 // JPEG Encoding
                        </p>
                    </div>

                    <div className="aspect-video bg-[#0a0f18] rounded-lg border border-blue-900/30 overflow-hidden relative flex items-center justify-center shadow-2xl shadow-blue-900/10">
                        {previewUrl ? (
                            <img src={previewUrl} className="max-w-full max-h-full object-contain" />
                        ) : (
                            <span className="text-gray-800 font-mono text-xs">NO SIGNAL</span>
                        )}

                        {/* LOADING OVERLAY */}
                        {isProcessing && (
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                                <div className="w-64 h-1 bg-[#333] rounded-full overflow-hidden mb-4">
                                    <div className="h-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                                </div>
                                <span className="text-blue-400 font-mono text-xs animate-pulse">{statusMessage}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={handleExportMaster}
                            disabled={isProcessing}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white py-6 rounded font-bold uppercase tracking-widest text-sm shadow-xl shadow-blue-600/20 hover:shadow-blue-500/40 transition-all flex items-center justify-center gap-3"
                        >
                            {isProcessing ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin">settings</span>
                                    PROCESSING...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">save</span>
                                    EXPORT MASTER JPG
                                </>
                            )}
                        </button>
                    </div>
                    <p className="text-xs text-blue-400/40 text-center font-mono">
                        Config: JPEG / Q{quality * 100} / Scale {scale * 100}% / sRGB
                    </p>
                </div>

            </main>
        </div>
    );
};

export default Export;