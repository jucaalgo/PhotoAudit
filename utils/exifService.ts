
import EXIF from 'exif-js';
import { TelemetryData } from '../types';

/**
 * Extracts EXIF data from a File object and maps it to a partial TelemetryData structure.
 * This populates the "Camera", "Optics", and "Lighting" sections of the dashboard.
 */
export const extractExifTelemetry = async (file: File): Promise<Partial<TelemetryData>> => {
    return new Promise((resolve) => {
        EXIF.getData(file as any, function (this: any) {
            const allTags = EXIF.getAllTags(this);

            if (!allTags || Object.keys(allTags).length === 0) {
                console.warn("⚠️ No EXIF data found");
                resolve({});
                return;
            }

            // Parse numeric values safely
            const parseNum = (val: any) => {
                if (typeof val === 'number') return val;
                if (val && val.numerator && val.denominator) return val.numerator / val.denominator;
                return 0;
            };

            const model = (allTags.Make ? allTags.Make + " " : "") + (allTags.Model || "Unknown Source");
            const iso = Number(allTags.ISOSpeedRatings) || 0;
            const aperture = allTags.FNumber ? `f/${parseNum(allTags.FNumber).toFixed(1)}` : "--";
            const shutter = allTags.ExposureTime ? (1 / parseNum(allTags.ExposureTime)).toFixed(0) : "--";
            const shutterDisp = allTags.ExposureTime ? `1/${shutter}s` : "--";
            const focal = allTags.FocalLength ? `${parseNum(allTags.FocalLength).toFixed(0)}mm` : "--";
            const lens = allTags.LensModel || "Unknown Lens";
            const wb = allTags.WhiteBalance === 1 ? "Manual" : "Auto";

            // Map to Partial Telemetry
            const telemetry: Partial<TelemetryData> = {
                camera: {
                    model: model.replace(/\0/g, '').trim(), // Remove null bytes
                    iso: iso,
                    aperture: aperture,
                    shutterSpeed: shutterDisp,
                    focalLength: focal,
                    whiteBalance: wb,
                    tint: "0" // EXIF usually doesn't give tint directly
                },
                optics: {
                    lens: lens.replace(/\0/g, '').trim(),
                    chromaticAberration: "None" // Placeholder
                },
                lighting: {
                    type: allTags.Flash && allTags.Flash !== 0 ? "Flash Fired" : "Ambient",
                    direction: "Unknown",
                    contrastRatio: "Unknown"
                }
            };

            resolve(telemetry);
        });
    });
};
