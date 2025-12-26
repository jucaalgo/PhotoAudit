
import React, { useEffect, useRef, useState } from 'react';

interface HistogramProps {
    imageSrc: string | null;
    width?: number;
    height?: number;
}

const Histogram: React.FC<HistogramProps> = ({ imageSrc, width = 256, height = 150 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [counts, setCounts] = useState<{ r: number[], g: number[], b: number[] } | null>(null);

    useEffect(() => {
        if (!imageSrc) return;

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageSrc;

        img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            // Downscale for performance if needed, but full res gives accuracy
            // Keeping it reasonable (max 1024px) to avoid lag
            const maxDim = 500;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
                const ratio = Math.min(maxDim / w, maxDim / h);
                w *= ratio;
                h *= ratio;
            }
            tempCanvas.width = w;
            tempCanvas.height = h;

            const ctx = tempCanvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(img, 0, 0, w, h);
            const imageData = ctx.getImageData(0, 0, w, h).data;

            const rCounts = new Array(256).fill(0);
            const gCounts = new Array(256).fill(0);
            const bCounts = new Array(256).fill(0);

            for (let i = 0; i < imageData.length; i += 4) {
                rCounts[imageData[i]]++;
                gCounts[imageData[i + 1]]++;
                bCounts[imageData[i + 2]]++;
            }

            // Normalize
            const maxCount = Math.max(...rCounts, ...gCounts, ...bCounts);
            const normR = rCounts.map(c => c / maxCount);
            const normG = gCounts.map(c => c / maxCount);
            const normB = bCounts.map(c => c / maxCount);

            setCounts({ r: normR, g: normG, b: normB });
        };
    }, [imageSrc]);

    useEffect(() => {
        if (!counts || !canvasRef.current) return;

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'screen'; // Additive blending for RGB

        const drawChannel = (data: number[], color: string) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(0, height);
            for (let i = 0; i < 256; i++) {
                const x = (i / 255) * width;
                const h = data[i] * height;
                ctx.lineTo(x, height - h);
            }
            ctx.lineTo(width, height);
            ctx.fill();
        };

        drawChannel(counts.r, 'rgba(255, 50, 50, 0.5)');
        drawChannel(counts.g, 'rgba(50, 255, 50, 0.5)');
        drawChannel(counts.b, 'rgba(50, 50, 255, 0.5)');

        // Draw White Luma curve outline
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 256; i++) {
            const x = (i / 255) * width;
            // Approx luma height
            const h = ((counts.r[i] + counts.g[i] + counts.b[i]) / 3) * height;
            if (i === 0) ctx.moveTo(x, height - h);
            else ctx.lineTo(x, height - h);
        }
        ctx.stroke();

    }, [counts, width, height]);

    return (
        <div className="bg-black/50 border border-white/10 rounded p-2">
            <h4 className="text-[10px] font-mono uppercase text-white/50 mb-1">RGB Waveform</h4>
            <canvas ref={canvasRef} width={width} height={height} className="w-full h-auto" />
            <div className="flex justify-between text-[8px] font-mono text-white/30 mt-1">
                <span>0</span>
                <span>128</span>
                <span>255</span>
            </div>
        </div>
    );
};

export default Histogram;
