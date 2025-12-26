export const generateGamutWarning = (
    imgSrc: string,
    threshold: number = 253 // Strict clipping
): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imgSrc;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve("");

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Highlight Clipping (Bright Hotspots)
                if (r >= threshold || g >= threshold || b >= threshold) {
                    data[i] = 255;   // R
                    data[i + 1] = 0;   // G
                    data[i + 2] = 255; // B (Magenta)
                    data[i + 3] = 255;
                }
                // Shadow Crushing (Dead Blacks)
                else if (r <= 5 && g <= 5 && b <= 5) {
                    data[i] = 0;     // R
                    data[i + 1] = 0;   // G
                    data[i + 2] = 255; // B (Blue)
                    data[i + 3] = 255;
                }
                else {
                    data[i + 3] = 0; // Transparent
                }
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL());
        };
        img.onerror = () => resolve("");
    });
};
