"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const router = (0, express_1.Router)();
/**
 * Generate drive-time or walk-time isochrone using Mapbox API
 * POST /api/v1/isochrone/generate
 */
router.post('/generate', async (req, res) => {
    try {
        const { lng, lat, minutes, profile } = req.body;
        // Validate inputs
        if (!lng || !lat || !minutes || !profile) {
            return res.status(400).json({
                error: 'Missing required fields: lng, lat, minutes, profile',
            });
        }
        if (!['driving', 'walking', 'cycling'].includes(profile)) {
            return res.status(400).json({
                error: 'Invalid profile. Must be: driving, walking, or cycling',
            });
        }
        if (minutes < 1 || minutes > 60) {
            return res.status(400).json({
                error: 'Minutes must be between 1 and 60',
            });
        }
        // Get Mapbox token from environment
        const mapboxToken = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN;
        if (!mapboxToken) {
            console.error('MAPBOX_TOKEN not configured');
            return res.status(500).json({
                error: 'Mapbox API not configured',
            });
        }
        // Call Mapbox Isochrone API
        // https://docs.mapbox.com/api/navigation/isochrone/
        const seconds = minutes * 60;
        const url = `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${lng},${lat}`;
        const response = await axios_1.default.get(url, {
            params: {
                contours_minutes: minutes,
                polygons: true,
                access_token: mapboxToken,
            },
        });
        // Extract the polygon from response
        const isochrone = response.data;
        if (!isochrone.features || isochrone.features.length === 0) {
            return res.status(404).json({
                error: 'No isochrone generated for this location',
            });
        }
        // Return the polygon geometry
        const polygon = isochrone.features[0];
        res.json({
            success: true,
            geometry: polygon.geometry,
            properties: {
                contour: minutes,
                profile,
                center: [lng, lat],
            },
            stats: {
                // These would need to be calculated by querying properties in the area
                // For now, return null - frontend can show "calculating..." state
                population: null,
                existing_units: null,
                pipeline_units: null,
                avg_rent: null,
            },
        });
    }
    catch (error) {
        console.error('Error generating isochrone:', error.response?.data || error.message);
        if (error.response?.status === 422) {
            return res.status(400).json({
                error: 'Invalid coordinates or parameters',
            });
        }
        res.status(500).json({
            error: 'Failed to generate isochrone',
            details: error.message,
        });
    }
});
exports.default = router;
//# sourceMappingURL=isochrone.routes.js.map