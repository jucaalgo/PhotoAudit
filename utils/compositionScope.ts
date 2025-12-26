export interface ScopeData {
    histogram: {
        r: number[];
        g: number[];
        b: number[];
    };
    waveform: number[]; // Simplified Luma Array for drawing
}

export const calculateScopes = (imageElement: HTMLImageElement | HTMLCanvasElement): ScopeData => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Canvas context init failed");

    // Downscale for performance (enough for scope accuracy)
    const SCOPE_RES = 512;
    canvas.width = SCOPE_RES;
    canvas.height = SCOPE_RES;

    ctx.drawImage(imageElement, 0, 0, SCOPE_RES, SCOPE_RES);
    const imageData = ctx.getImageData(0, 0, SCOPE_RES, SCOPE_RES);
    const data = imageData.data;

    const rHist = new Array(256).fill(0);
    const gHist = new Array(256).fill(0);
    const bHist = new Array(256).fill(0);

    // Waveform: We map X columns to array values. 
    // Ideally a waveform is a density plot (Scope), but for a line graph approximation:
    // We'll average the Luma of each column.
    // Professional Waveforms show distribution per column. 
    // To keep it simple but accurate for web rendering: 100 points of accumulated luma.
    const waveform = new Array(100).fill(0);

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Histogram
        rHist[r]++;
        gHist[g]++;
        bHist[b]++;

        // Waveform Logic (Approximation for fast render)
        // Calculate Rec.709 Luma
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        // Map pixel X position to waveform bucket (0-99)
        const pixelIndex = i / 4;
        const x = pixelIndex % SCOPE_RES;
        const waveBucket = Math.floor((x / SCOPE_RES) * 100);

        // We accumulate luma to average later, or max?
        // Let's store max luma per column to show "Peak" levels
        if (luma > waveform[waveBucket]) waveform[waveBucket] = luma;
    }

    // Normalize Histograms to 0-100 range for SVG
    const maxVal = Math.max(...rHist, ...gHist, ...bHist);
    const norm = (arr: number[]) => arr.map(v => (v / maxVal) * 100);

    return {
        histogram: {
            r: norm(rHist),
            g: norm(gHist),
            b: norm(bHist)
        },
        waveform: waveform.map(v => (v / 255) * 100) // Normalize 0-100 IRE
    };
};
