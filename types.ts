
export interface CameraData {
    model: string;
    lens: string;
    focalLength: string;
    aperture: string;
    shutterSpeed: string;
    iso: number;
    whiteBalance: string; // e.g., "5600K"
    tint: string; // e.g., "+2 Green"
}

export interface LightingData {
    type: string; // e.g., "Softbox", "Natural", "Hard Sun"
    contrastRatio: string; // e.g., "1:4"
    direction: string; // e.g., "Rembrandt", "Flat"
    quality: number; // 0-100 score
}

export interface OpticalData {
    mtf50: string; // e.g. "2800 LW/PH"
    chromaticAberration: string; // e.g. "0.8px (Red/Cyan)"
    distortion: string; // e.g. "-1.2% Barrel"
}

export interface SignalData {
    rmsNoise: number; // Root Mean Square noise
    snr: number; // Signal to Noise Ratio in dB
    dynamicRange: number; // Stops
    clipping: { highlights: boolean; shadows: boolean };
}

export interface TelemetryData {
    sharpness: number;
    noiseLevel: number;
    dynamicRange: string;
    bitDepth: string;
    colorSpace: string;
    auditStatus: 'PASS' | 'FAIL' | 'WARN';
    isBlackAndWhite: boolean; // NEW: Detection for B&W logic
    histogram: { r: number[], g: number[], b: number[] };
    camera: CameraData;
    lighting: LightingData;
    spectralAnalysis: number[];
    optics: OpticalData;
    signal: SignalData;
}

export interface GradingState {
    exposure: number;   // -5 to +5
    contrast: number;   // -100 to +100
    temp: number;       // -100 (Cool) to +100 (Warm)
    tint: number;       // -100 (Green) to +100 (Magenta)
    highlights: number; // -100 to +100
    shadows: number;    // -100 to +100
    saturation: number; // -100 to +100
    enableSmoothness: boolean; // NEW: Toggle for AI Smoothing
}

export interface ProcessingState {
    isProcessing: boolean;
    stage: string; // 'Analyzing', 'Retouching', 'Exporting'
    progress: number;
    appliedChanges: string[]; // List of specific changes made
}

export interface ActionProposal {
    id: string;
    label: string;
    description: string;
    technicalDetail: string;
    isActive: boolean;
    isCritical: boolean; // Cannot be disabled if true (optional, currently not strictly enforced)
}

export interface FileMetadata {
    name: string;
    type: string;
    isRaw: boolean;
    extension: string;
}

export interface AppContextType {
    originalImage: string | null;
    processedImage: string | null;
    rawBinary: string | null; // NEW: Stores the actual raw file base64 data
    telemetry: TelemetryData | null;
    processingState: ProcessingState;
    gradingState: GradingState;
    fileMetadata: FileMetadata | null; 
    canUndo: boolean; 
    setOriginalImage: (url: string) => void;
    setProcessedImage: (url: string) => void;
    setRawBinary: (data: string | null) => void; // NEW
    setTelemetry: (data: TelemetryData) => void;
    setProcessingState: (state: ProcessingState) => void;
    setGradingState: (state: GradingState) => void;
    setFileMetadata: (data: FileMetadata | null) => void; 
    analyzeImage: (imageBytes: string, mimeType: string) => Promise<void>;
    processImage: (imageBytes: string, mimeType: string, prompt: string, manualOverrides?: GradingState) => Promise<void>;
    undoLastEdit: () => void;
}

export const DEFAULT_GRADING: GradingState = {
    exposure: 0,
    contrast: 0,
    temp: 0,
    tint: 0,
    highlights: 0,
    shadows: 0,
    saturation: 0,
    enableSmoothness: false
};

export const MOCK_TELEMETRY: TelemetryData = {
    sharpness: 98,
    noiseLevel: 12,
    dynamicRange: "14.2 stops",
    bitDepth: "14-bit RAW",
    colorSpace: "ACEScg",
    auditStatus: 'PASS',
    isBlackAndWhite: false,
    histogram: {
        r: [10, 20, 40, 60, 80, 50, 30, 20, 10, 5],
        g: [15, 25, 45, 65, 85, 55, 35, 25, 15, 5],
        b: [20, 30, 50, 70, 90, 60, 40, 30, 20, 10]
    },
    camera: {
        model: "LUMIX S5M2X",
        lens: "Lumix S Pro 50mm f/1.4",
        focalLength: "50mm",
        aperture: "f/2.8",
        shutterSpeed: "1/50",
        iso: 640,
        whiteBalance: "5600K",
        tint: "+0"
    },
    lighting: {
        type: "Natural / Fill",
        contrastRatio: "1:4",
        direction: "Key 45°",
        quality: 92
    },
    spectralAnalysis: [20, 45, 60, 80, 95, 70, 50, 40, 30, 20],
    optics: {
        mtf50: "3200 LW/PH",
        chromaticAberration: "0.2px (Negligible)",
        distortion: "-0.1%"
    },
    signal: {
        rmsNoise: 1.2,
        snr: 48,
        dynamicRange: 14.5,
        clipping: { highlights: false, shadows: false }
    }
};
