import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppContextType, TelemetryData, ProcessingState, GradingState, MOCK_TELEMETRY, FileMetadata, Snapshot } from '../types';
import { analyzeImageContent, editImageContent } from '../services/geminiService';
import { analyzeImagePixels } from '../services/RealtimeAnalysis';

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_GRADING: GradingState = {
    exposure: 0,
    contrast: 0,
    temp: 0,
    tint: 0,
    highlights: 0,
    shadows: 0,
    saturation: 0,
    enableSmoothness: false
};

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
    const [lastProcessingSource, setLastProcessingSource] = useState<'CLOUD' | 'LOCAL' | null>(null);

    const [processingState, setProcessingState] = useState<ProcessingState>({
        isProcessing: false,
        stage: '',
        progress: 0,
        appliedChanges: []
    });

    // History Stack for Undo functionality
    const [editHistory, setEditHistory] = useState<string[]>([]);
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

    const addSnapshot = (label: string, url: string) => {
        const newSnap: Snapshot = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            imageUrl: url,
            thumbnailUrl: url,
            label: label,
            gradingState: { ...gradingState } // Clone state
        };
        setSnapshots(prev => [newSnap, ...prev]);
    };

    const restoreSnapshot = (id: string) => {
        const snap = snapshots.find(s => s.id === id);
        if (snap) {
            setProcessedImage(snap.imageUrl);
            setGradingState(snap.gradingState);
        }
    };

    const deleteSnapshot = (id: string) => {
        setSnapshots(prev => prev.filter(s => s.id !== id));
    };

    const setOriginalImage = (url: string, metadata?: FileMetadata) => {
        setOriginalImageState(url);
        // Reset pipeline when new image loads
        setProcessedImage(null);
        setEditHistory([]);
        setSnapshots([]); // NEW: Clear history on new load
        setGradingState(DEFAULT_GRADING);
        if (metadata) setFileMetadata(metadata);
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
        setProcessingState(prev => ({ ...prev, isProcessing: true, stage: 'Photon Level Analysis (Realtime)', progress: 20 }));
        try {
            // NEW: Use local pixel analysis for accurate telemetry (Histogram, Contrast, Detection)
            const url = `data:${mimeType};base64,${base64Data}`;
            const data = await analyzeImagePixels(url);

            setTelemetry(data);
            setProcessingState(prev => ({ ...prev, isProcessing: false, stage: 'Complete', progress: 100 }));
        } catch (error) {
            console.error("Analysis failed:", error);
            // Fallback to Gemini Cloud Analysis if local fails, or mock
            try {
                const cloudData = await analyzeImageContent(base64Data, mimeType);
                setTelemetry(cloudData);
                setProcessingState(prev => ({ ...prev, isProcessing: false, stage: 'Complete (Cloud fallback)', progress: 100 }));
            } catch (e) {
                setTelemetry(MOCK_TELEMETRY);
                setProcessingState(prev => ({ ...prev, isProcessing: false, stage: 'Error (Using Cached Data)', progress: 0 }));
            }
        }
    };

    const processImage = async (
        imageBytes: string,
        mimeType: string,
        prompt: string,
        manualOverrides?: GradingState,
        lighting?: { direction: number, intensity: number, temperature: number },
        maskBase64?: string
    ) => {
        console.log("📦 APP_CONTEXT: processImage called", { prompt, hasLighting: !!lighting, hasMask: !!maskBase64 });
        setProcessingState(prev => ({ ...prev, isProcessing: true, stage: 'Engine v12.0: Initializing...', progress: 10 }));
        try {
            let analysisContext = "AUTO-DETECTED FLAWS TO FIX:\n";
            // ... (restored logic placeholder)

            setProcessingState(prev => ({ ...prev, stage: 'Generative Mastering (Gemini 3 Pro)...', progress: 60 }));

            // NEW: Handle Object Return
            const result = await editImageContent(imageBytes, mimeType, prompt, analysisContext, gradingState.enableSmoothness, lighting, maskBase64);

            // Destructure Result & Source
            const resultUrl = result.data;
            const source = result.source;

            setProcessedImage(resultUrl);
            setLastProcessingSource(source); // UPDATE SOURCE STATE

            setEditHistory(prev => [...prev, resultUrl]);
            addSnapshot(`Version ${snapshots.length + 1} (${source})`, resultUrl);
            setProcessingState({ isProcessing: false, stage: 'Render Complete', progress: 100, appliedChanges: [] });
            return true;
        } catch (error) {
            console.error(error);
            setProcessingState(prev => ({ ...prev, isProcessing: false, stage: 'Pipeline Failed', progress: 0 }));
            return false;
        }
    };

    const contextValue = React.useMemo(() => ({
        originalImage, processedImage, rawBinary, telemetry, processingState, gradingState, canUndo: editHistory.length > 0, fileMetadata,
        setOriginalImage, setProcessedImage, setRawBinary, setTelemetry, setProcessingState, setGradingState, setFileMetadata,
        analyzeImage, processImage, undoLastEdit,
        snapshots, addSnapshot, deleteSnapshot, restoreSnapshot, analysis: [],
        lastProcessingSource // EXPOSE NEW STATE
    }), [
        originalImage, processedImage, rawBinary, telemetry, processingState, gradingState, editHistory.length, fileMetadata,
        snapshots, editHistory
    ]);

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useApp must be used within AppProvider");
    return context;
};
