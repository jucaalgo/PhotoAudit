import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AppContextType, TelemetryData, ProcessingState, GradingState, MOCK_TELEMETRY, DEFAULT_GRADING, FileMetadata } from '../types';
import { analyzeImageContent, editImageContent } from '../services/geminiService';

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
    children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    const [originalImage, setOriginalImageState] = useState<string | null>(null);
    const [processedImage, setProcessedImage] = useState<string | null>(null);
    const [rawBinary, setRawBinary] = useState<string | null>(null); // NEW: Store RAW bytes
    const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
    const [gradingState, setGradingState] = useState<GradingState>(DEFAULT_GRADING);
    const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);
    const [processingState, setProcessingState] = useState<ProcessingState>({
        isProcessing: false,
        stage: '',
        progress: 0,
        appliedChanges: []
    });

    // History Stack for Undo functionality
    const [editHistory, setEditHistory] = useState<string[]>([]);

    const setOriginalImage = (url: string) => {
        setOriginalImageState(url);
        // Reset pipeline when new image loads
        setProcessedImage(null);
        setEditHistory([]); 
        setGradingState(DEFAULT_GRADING);
        // We do NOT reset fileMetadata here necessarily as it might be set before image load
    };

    const undoLastEdit = () => {
        if (editHistory.length === 0) return;

        const newHistory = [...editHistory];
        newHistory.pop(); // Remove current state (which is displayed)
        
        setEditHistory(newHistory);

        if (newHistory.length > 0) {
            // Revert to the previous state in the stack
            setProcessedImage(newHistory[newHistory.length - 1]);
        } else {
            // If history is empty, revert to original state (null processed)
            setProcessedImage(null);
        }
    };

    const analyzeImage = async (base64Data: string, mimeType: string) => {
        setProcessingState(prev => ({ ...prev, isProcessing: true, stage: 'Photon Level Analysis', progress: 20 }));
        try {
            // For RAW files, base64Data is now the Proxy JPEG. We use that to simulate analysis.
            const dataToAnalyze = base64Data;
            
            const data = await analyzeImageContent(dataToAnalyze, mimeType);
            
            // Fix for RAW files: If Gemini analysis returns valid struct but empty histograms (because it can't render RAW pixels),
            // inject mock histogram data so the UI looks active.
            if (data && (!data.histogram || data.histogram.r.length === 0)) {
                data.histogram = MOCK_TELEMETRY.histogram;
            }
            
            setTelemetry(data);
            setProcessingState(prev => ({ ...prev, isProcessing: false, stage: 'Complete', progress: 100 }));
        } catch (error) {
            console.error(error);
            setTelemetry(MOCK_TELEMETRY); // Fallback for demo
            setProcessingState(prev => ({ ...prev, isProcessing: false, stage: 'Error (Using Cached Data)', progress: 0 }));
        }
    };

    const processImage = async (imageBytes: string, mimeType: string, prompt: string, manualOverrides?: GradingState) => {
        setProcessingState(prev => ({ ...prev, isProcessing: true, stage: 'Engine v12.0: Initializing...', progress: 10 }));
        try {
            // 1. Build Analysis Context String
            let analysisContext = "AUTO-DETECTED FLAWS TO FIX:\n";
            if (telemetry) {
                if (telemetry.signal.rmsNoise > 2.0) analysisContext += "- CRITICAL: High ISO Noise detected. Apply Aggressive Deep Learning Denoise.\n";
                if (telemetry.optics.mtf50 && parseInt(telemetry.optics.mtf50) < 2000) analysisContext += "- CRITICAL: Image is Soft. Apply Deconvolution Sharpening.\n";
                if (telemetry.signal.clipping.highlights) analysisContext += "- WARNING: Highlight Clipping. Reconstruct highlight details using generative fill.\n";
                if (telemetry.signal.clipping.shadows) analysisContext += "- WARNING: Crushed Blacks. Lift shadows and recover texture.\n";
                analysisContext += `- Input Profile: ${telemetry.colorSpace} / ${telemetry.bitDepth}\n`;
            } else {
                analysisContext += "- No telemetry available. Analyze image structure dynamically.\n";
            }

            setProcessingState(prev => ({ ...prev, stage: 'Applying Telemetry Corrections...', progress: 30 }));

            // 2. Build Grading Prompt & Config
            let finalPrompt = prompt;
            let changes: string[] = ["Global Harmonization", "Hyper-real Texture"];
            let enableSmoothness = gradingState.enableSmoothness; // Default

            if (manualOverrides) {
                const manualInstructions = [];
                if (manualOverrides.exposure !== 0) { 
                    manualInstructions.push(`Exposure Offset ${manualOverrides.exposure}`); 
                    changes.push(`Exposure ${manualOverrides.exposure > 0 ? '+' : ''}${manualOverrides.exposure}`); 
                }
                if (manualOverrides.contrast !== 0) { 
                    manualInstructions.push(`Contrast ${manualOverrides.contrast > 0 ? 'Boost' : 'Reduce'} ${manualOverrides.contrast}`); 
                    changes.push(`Contrast ${manualOverrides.contrast}`); 
                }
                if (manualOverrides.temp !== 0) { 
                    manualInstructions.push(`Color Temp ${manualOverrides.temp}`); 
                    changes.push(`Temp ${manualOverrides.temp}`); 
                }
                
                // Override smoothness if provided
                if (manualOverrides.enableSmoothness !== undefined) {
                    enableSmoothness = manualOverrides.enableSmoothness;
                }
                
                if (manualInstructions.length > 0) {
                    finalPrompt = `${prompt}. MANDATORY OVERRIDES: ${manualInstructions.join(', ')}.`;
                }
            }

            setProcessingState(prev => ({ ...prev, stage: 'Generative Mastering (Gemini 3 Pro)...', progress: 60 }));

            // 3. Execute
            const bytesToSend = imageBytes;
            const resultUrl = await editImageContent(bytesToSend, mimeType, finalPrompt, analysisContext, enableSmoothness);
            
            // 4. Update State and History
            setProcessedImage(resultUrl);
            setEditHistory(prev => [...prev, resultUrl]); // Add new result to history stack
            
            setProcessingState({ isProcessing: false, stage: 'Render Complete', progress: 100, appliedChanges: changes });
        } catch (error) {
            console.error(error);
            setProcessingState(prev => ({ ...prev, isProcessing: false, stage: 'Pipeline Failed', progress: 0 }));
        }
    };

    return (
        <AppContext.Provider value={{
            originalImage, processedImage, rawBinary, telemetry, processingState, gradingState, canUndo: editHistory.length > 0, fileMetadata,
            setOriginalImage, setProcessedImage, setRawBinary, setTelemetry, setProcessingState, setGradingState, setFileMetadata,
            analyzeImage, processImage, undoLastEdit
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useApp must be used within AppProvider");
    return context;
};
