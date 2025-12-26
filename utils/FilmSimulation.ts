
export const applyFilmGrain = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    amount: number,
    size: number = 1
) => {
    if (amount === 0) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const pixelCount = width * height;

    // Create a noise buffer
    // We can't easily scale noise pixel-by-pixel in a simple loop without performance hit for "size",
    // effectively "size" > 1 would mean we generate lower res noise and upscale, but for now 
    // let's stick to pixel-perfect grain which is more high-end engineering.
    // Enhanced grain logic: Mid-tone bias.
    // Real film grain is most visible in mid-tones, less in crushed blacks or clipped whites.

    for (let i = 0; i < pixelCount; i++) {
        const offset = i * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];

        // Calc luminance
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        // Grain curve: Parabolic visual masking
        // Peak at 128 (0.5), taper to 0 at 0 and 255.
        // Formula: 1 - (2 * (lum / 255 - 0.5))^2  <-- approximate parabola
        // Simplification: 
        const normLum = lum / 255;
        const grainMask = 4 * normLum * (1 - normLum); // Peaks at 0.5, zero at 0 and 1.

        // Generate noise
        // Box-Muller transform for Gaussian distribution is better/more natural than Math.random()
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u1 || 0.00001)) * Math.cos(2.0 * Math.PI * u2);

        const noise = z * amount * 20 * grainMask; // 20 is arbitrary scaler

        // Apply noise
        // We add noise to R, G, B. 
        // For colored grain, generate 3 diff noises. For monochrome grain, use same.
        // Organic film usually has coupled dye clouds, so monochrome intensity noise is often enough 
        // but color noise adds realism for color negative simulations. 
        // Let's do monochrome luma noise for cleaner result, or slight color variation?
        // Let's stick to luma noise to act like "silver halide" structure

        data[offset] = Math.min(255, Math.max(0, r + noise));
        data[offset + 1] = Math.min(255, Math.max(0, g + noise));
        data[offset + 2] = Math.min(255, Math.max(0, b + noise));
    }

    ctx.putImageData(imageData, 0, 0);
};

export const applyHalation = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    threshold: number = 200,
    radius: number = 20,
    intensity: number = 0.5
) => {
    if (intensity === 0) return;

    // 1. Create an offscreen canvas for the highlight map
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    // 2. Draw current image to offscreen
    offCtx.drawImage(ctx.canvas, 0, 0);

    // 3. Thresholding: Keep only bright pixels
    const imageData = offCtx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        if (lum < threshold) {
            data[i + 3] = 0; // Make transparent
        } else {
            // Visualize the highlight source? 
            // Halation is technically red. So let's turn the source slightly red?
            // Or just keep the luminance information.
            // Let's tint it warm immediately because red light scatters most.
            data[i] = 255;
            data[i + 1] = 50;
            data[i + 2] = 0;
            // Alpha based on how much it exceeds threshold
            data[i + 3] = Math.min(255, (lum - threshold) * 2);
        }
    }
    offCtx.putImageData(imageData, 0, 0);

    // 4. Blur the highlights
    // Context filter blur is hardware accelerated
    // We need to draw this *back* onto the main canvas with a blur.

    // However, direct context.filter support might vary or be tricky to "apply" to existing data inplace 
    // without a draw call.
    // The easiest way is to draw the offCanvas onto the main ctx with a globalCompositeOperation.

    ctx.save();
    ctx.globalCompositeOperation = 'screen'; // Or 'lighter' (add)
    ctx.filter = `blur(${radius}px)`;
    ctx.globalAlpha = intensity;
    ctx.drawImage(offCanvas, 0, 0);
    ctx.restore();
};
