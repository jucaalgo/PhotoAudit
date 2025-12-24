import { GoogleGenAI, Type } from "@google/genai";
import { TelemetryData } from "../types";

export const analyzeImageContent = async (base64Data: string, mimeType: string): Promise<TelemetryData> => {
    // Initialize client inside function to ensure latest process.env.API_KEY is used
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64Data,
                            mimeType: mimeType
                        }
                    },
                    {
                        text: `EXECUTE DEEP TECHNICAL AUDIT.
                        ROLE: Optical Physicist & Sensor Engineer.
                        TASK: Analyze this image signal.
                        
                        IMPORTANT: 
                        - If the image provided is a digital placeholder card containing text like "RAW DATA PROXY", ignore the visual pixel data. Instead, HALLUCINATE plausible technical telemetry for a cinema camera RAW file based on the text on the card.
                        - IF THE IMAGE IS A REAL PHOTOGRAPH (e.g. landscapes, portraits, extracted RAW previews), analyze the ACTUAL pixels.
                        
                        1. NOISE ANALYSIS: Calculate RMS Noise floor. Is it grainy? (High > 2.0).
                        2. OPTICAL SHARPNESS: Estimate MTF50. Is it soft/out of focus?
                        3. DYNAMIC RANGE: Check for clipping in highlights/shadows.
                        4. EXPOSURE: Is it underexposed (Log) or balanced?
                        5. CHROMA: Is the image Black and White / Monochrome?
                        
                        RETURN ACCURATE JSON DATA.`
                    }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        sharpness: { type: Type.NUMBER },
                        noiseLevel: { type: Type.NUMBER },
                        dynamicRange: { type: Type.STRING },
                        bitDepth: { type: Type.STRING },
                        colorSpace: { type: Type.STRING },
                        auditStatus: { type: Type.STRING, enum: ["PASS", "FAIL", "WARN"] },
                        isBlackAndWhite: { type: Type.BOOLEAN, description: "True if image is grayscale/monochrome" },
                        camera: {
                            type: Type.OBJECT,
                            properties: {
                                model: { type: Type.STRING },
                                lens: { type: Type.STRING },
                                focalLength: { type: Type.STRING },
                                aperture: { type: Type.STRING },
                                shutterSpeed: { type: Type.STRING },
                                iso: { type: Type.NUMBER },
                                whiteBalance: { type: Type.STRING },
                                tint: { type: Type.STRING }
                            }
                        },
                        lighting: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING },
                                contrastRatio: { type: Type.STRING },
                                direction: { type: Type.STRING },
                                quality: { type: Type.NUMBER }
                            }
                        },
                        spectralAnalysis: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                        histogram: {
                            type: Type.OBJECT,
                            properties: {
                                r: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                                g: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                                b: { type: Type.ARRAY, items: { type: Type.NUMBER } }
                            }
                        },
                        optics: {
                            type: Type.OBJECT,
                            properties: {
                                mtf50: { type: Type.STRING },
                                chromaticAberration: { type: Type.STRING },
                                distortion: { type: Type.STRING }
                            }
                        },
                        signal: {
                            type: Type.OBJECT,
                            properties: {
                                rmsNoise: { type: Type.NUMBER },
                                snr: { type: Type.NUMBER },
                                dynamicRange: { type: Type.NUMBER },
                                clipping: { 
                                    type: Type.OBJECT,
                                    properties: {
                                        highlights: { type: Type.BOOLEAN },
                                        shadows: { type: Type.BOOLEAN }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No analysis returned");
        return JSON.parse(text) as TelemetryData;

    } catch (e) {
        console.error("Analysis failed", e);
        throw e;
    }
};

export const editImageContent = async (base64Data: string, mimeType: string, prompt: string, analysisContext?: string, allowSmoothness: boolean = false): Promise<string> => {
    // Initialize client inside function to ensure latest process.env.API_KEY is used
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        // PROFESSIONAL PHOTOGRAPHY LOGIC V3.3: "HYPER-REALISM ENGINE"
        // Updated to explicitly forbid "Denoising" and enforce "Micro-Contrast".

        const textureLogic = allowSmoothness 
            ? `MODE: COMMERCIAL RETOUCH (SOFT).
               - Allowed: Gentle skin smoothing.
               - Forbidden: Removing structural features.`
            : `MODE: FORENSIC TEXTURE PRESERVATION (CRITICAL).
               - **ABSOLUTE PROHIBITION ON SMOOTHING**.
               - The input texture (pores, hair, grain, fabric weave) is SACRED.
               - Treat High-Frequency spatial details as READ-ONLY.
               - Only adjust Low-Frequency attributes (Color, Exposure, Tone).
               - IF THE FACE HAS PORES, KEEP THEM VISIBLE AND SHARP.
               - IF THE IMAGE HAS ISO NOISE, KEEP IT (Do not denoise).
               - DO NOT "FIX" SKIN TEXTURE. PRESERVE IMPERFECTIONS.`;

        const systemPrompt = `
            ROLE: Master Retoucher & Colorist (Non-Destructive).
            
            TASK: Process this RAW signal strictly based on instructions.
            
            INPUT SIGNAL:
            - The input is a professional photograph. It contains intentional texture, noise, and focus falloff.
            
            STRICT RESTRICTIONS (VIOLATION = FAILURE):
            1. **ZERO HALLUCINATION**: Do not invent new details.
            2. **TEXTURE LOCK**: ${textureLogic}
            3. **BACKGROUND HANDLING (CRITICAL)**: 
               - If changing background to White/Black: DO NOT REMOVE THE FLOOR PLANE.
               - **RETAIN CONTACT SHADOWS**: The feet/base of the object must cast a shadow.
               - **SOFT FLOOR**: Create a subtle gradient or "Infinite Floor" effect so the subject is anchored.
               - Subject edges must be perfect Alpha Mattes.
            4. **NO "AI LOOK"**: If the output looks waxy, plastic, or like a 3D render, IT IS WRONG. 
            5. **PASS-THROUGH GEOMETRY**: Every hair, pore, and edge must remain in the exact pixel coordinate (unless background is being removed).
            6. **HYPER-REALISM**: Ensure high micro-contrast. If the image looks too clean, ADD ORGANIC FILM GRAIN to bring back reality.
            
            COLOR SCIENCE INSTRUCTIONS:
            - Apply the requested grading (Exposure, WB, Tint, Looks).
            - If requested, apply Tone Curve corrections to linearize luminance.
            
            CONTEXT:
            ${analysisContext || "Standard processing."}
            
            OPERATOR COMMAND: ${prompt}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64Data,
                            mimeType: mimeType
                        }
                    },
                    {
                        text: systemPrompt
                    }
                ]
            },
            config: {
                imageConfig: {
                    imageSize: "4K", 
                }
            }
        });

        for (const candidate of response.candidates || []) {
            for (const part of candidate.content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        
        throw new Error("No image generated");
    } catch (e) {
        console.error("Edit failed", e);
        throw e;
    }
};