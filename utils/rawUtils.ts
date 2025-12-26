
/**
 * RAW EMBEDDED PREVIEW EXTRACTOR
 * 
 * Commercial RAW files (RW2, ARW, CR2, NEF) are essentially TIFF containers 
 * that almost always include a full-size or high-res JPEG preview for the camera's LCD.
 * 
 * Instead of decoding the raw Bayer data (which is slow/impossible in pure JS without WASM),
 * we scan the binary stream for JPEG Start-Of-Image (FF D8) and End-Of-Image (FF D9) markers
 * to surgically extract this hidden preview image.
 */

export const extractEmbeddedPreview = async (file: File): Promise<string | null> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const len = data.length;
        
        // We look for JPEG markers: SOI (FF D8) and EOI (FF D9)
        // To be efficient, we gather candidates and pick the largest one (thumbnails are small, previews are big)
        
        let startOffsets: number[] = [];
        let endOffsets: number[] = [];
        
        // Optimization: Most previews are in the first few MB or structured segments. 
        // A full scan is safer but slower. We'll do a stepped scan for performance.
        
        let i = 0;
        while (i < len - 1) {
            if (data[i] === 0xFF) {
                if (data[i+1] === 0xD8) {
                    startOffsets.push(i);
                } else if (data[i+1] === 0xD9) {
                    endOffsets.push(i + 2); // Include the marker bytes
                }
            }
            // Skip forward faster if not 0xFF
            i++;
        }

        if (startOffsets.length === 0 || endOffsets.length === 0) return null;

        // Find the largest valid JPEG structure
        let largestSize = 0;
        let bestBlob: Blob | null = null;

        // Heuristic: Pair SOIs with the next logical EOI
        // Real logic is complex (parsing TIFF IFD), but size-based heuristic works 95% of time for RAWs
        
        for (let s of startOffsets) {
            // Find the first EOI after this SOI
            const e = endOffsets.find(end => end > s);
            if (e) {
                const size = e - s;
                // Previews are usually > 500KB. Thumbnails are < 50KB.
                if (size > largestSize && size > 100000) { 
                    largestSize = size;
                    const jpegData = data.subarray(s, e);
                    bestBlob = new Blob([jpegData], { type: 'image/jpeg' });
                }
            }
        }

        if (bestBlob) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(bestBlob);
            });
        }

        return null;

    } catch (e) {
        console.error("RAW Extraction Failed:", e);
        return null;
    }
};
