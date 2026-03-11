"use strict";
/**
 * Email → Property Automation Service
 * Automatically detect properties in emails and create pins on maps
 * UPDATED: Now uses preference-matching.service for intelligent filtering
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPropertyFromEmail = extractPropertyFromEmail;
exports.geocodeAddress = geocodeAddress;
exports.getUserActiveMap = getUserActiveMap;
exports.createPropertyPin = createPropertyPin;
exports.notifyUserNewProperty = notifyUserNewProperty;
exports.processEmailForProperty = processEmailForProperty;
exports.batchProcessEmails = batchProcessEmails;
exports.processQueuedExtraction = processQueuedExtraction;
const logger_1 = require("../utils/logger");
const connection_1 = require("../database/connection");
const axios_1 = __importDefault(require("axios"));
const preference_matching_service_1 = require("./preference-matching.service");
/**
 * Extract property information from email content using AI
 */
async function extractPropertyFromEmail(email) {
    try {
        const emailContent = `
Subject: ${email.subject}
From: ${email.from.name} <${email.from.address}>
Body: ${email.body?.content || email.bodyPreview}
    `.trim();
        // Use Claude AI to extract property information
        const { generateCompletion } = require('./llm.service');
        const prompt = `Extract property information from this real estate email. Return JSON only.

Email:
${emailContent}

Extract:
- address (full street address if mentioned)
- city
- state (2-letter code)
- zipCode
- price (number only, no formatting)
- propertyType (multifamily, retail, office, industrial, mixed-use, land)
- units (number of units for multifamily, null otherwise)
- yearBuilt (year property was built)
- sqft (square footage)
- capRate (cap rate as decimal, e.g., 0.065 for 6.5%)
- occupancy (occupancy percentage as decimal, e.g., 0.95 for 95%)
- condition (excellent, good, fair, value-add, distressed)
- confidence (0.0-1.0, how confident are you this is a real property listing)

If no clear property is mentioned, return {"confidence": 0.0}.
Return valid JSON only, no explanation.`;
        const response = await generateCompletion({
            prompt,
            maxTokens: 600,
            temperature: 0.2, // Very low temperature for structured extraction
        });
        // Parse AI response
        const extracted = JSON.parse(response.text);
        if (extracted.confidence < 0.3) {
            logger_1.logger.debug('Email does not contain property information', { emailId: email.id });
            return null;
        }
        return extracted;
    }
    catch (error) {
        logger_1.logger.error('Error extracting property from email:', error);
        return null;
    }
}
/**
 * Geocode address using Mapbox
 */
async function geocodeAddress(address) {
    const mapboxToken = process.env.MAPBOX_TOKEN;
    if (!mapboxToken) {
        logger_1.logger.warn('Mapbox token not configured, skipping geocoding');
        return null;
    }
    try {
        const encodedAddress = encodeURIComponent(address);
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1`;
        const response = await axios_1.default.get(url);
        if (response.data.features && response.data.features.length > 0) {
            const feature = response.data.features[0];
            return {
                lng: feature.center[0],
                lat: feature.center[1],
                formattedAddress: feature.place_name,
            };
        }
        return null;
    }
    catch (error) {
        logger_1.logger.error('Error geocoding address:', error);
        return null;
    }
}
/**
 * Get user's active map (or create one)
 */
async function getUserActiveMap(userId) {
    try {
        // Get user's most recently updated map
        const result = await (0, connection_1.query)(`SELECT m.id 
       FROM maps m
       WHERE m.owner_id = $1
       ORDER BY m.updated_at DESC
       LIMIT 1`, [userId]);
        if (result.rows.length > 0) {
            return result.rows[0].id;
        }
        // Create default map if none exists
        const createResult = await (0, connection_1.query)(`INSERT INTO maps (name, owner_id, map_type)
       VALUES ($1, $2, $3)
       RETURNING id`, [`${userId}'s Deals`, userId, 'acquisition']);
        // Create default pipeline stages
        const mapId = createResult.rows[0].id;
        const stages = [
            { name: 'Lead', order: 1, color: '#94a3b8' },
            { name: 'Qualified', order: 2, color: '#60a5fa' },
            { name: 'Analyzing', order: 3, color: '#fbbf24' },
            { name: 'Offer Made', order: 4, color: '#fb923c' },
            { name: 'Under Contract', order: 5, color: '#a78bfa' },
            { name: 'Closed', order: 6, color: '#34d399' },
        ];
        for (const stage of stages) {
            await (0, connection_1.query)(`INSERT INTO pipeline_stages (map_id, name, stage_order, color)
         VALUES ($1, $2, $3, $4)`, [mapId, stage.name, stage.order, stage.color]);
        }
        return mapId;
    }
    catch (error) {
        logger_1.logger.error('Error getting user active map:', error);
        return null;
    }
}
/**
 * Create property pin on map (for auto-created properties)
 */
async function createPropertyPin(mapId, property, location, emailId, userId, extractionId) {
    try {
        // Get first pipeline stage for this map
        const stageResult = await (0, connection_1.query)(`SELECT id FROM pipeline_stages 
       WHERE map_id = $1 
       ORDER BY stage_order ASC 
       LIMIT 1`, [mapId]);
        if (stageResult.rows.length === 0) {
            logger_1.logger.error('No pipeline stages found for map', { mapId });
            return null;
        }
        // Create map pin
        const pinResult = await (0, connection_1.query)(`INSERT INTO map_pins (
        map_id,
        pin_type,
        property_name,
        address,
        coordinates,
        pipeline_stage_id,
        created_by,
        property_data
      ) VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, $8, $9)
      RETURNING id`, [
            mapId,
            'property',
            property.address, // Use address as name for now
            location.formattedAddress,
            location.lng,
            location.lat,
            stageResult.rows[0].id,
            userId,
            {
                source: 'email',
                emailId,
                extractionId,
                extractedData: property,
                price: property.price,
                propertyType: property.propertyType,
                units: property.units,
                yearBuilt: property.yearBuilt,
                sqft: property.sqft,
                capRate: property.capRate,
                occupancy: property.occupancy,
                condition: property.condition,
            },
        ]);
        const pinId = pinResult.rows[0].id;
        // Create deal silo
        await (0, connection_1.query)(`INSERT INTO deal_silos (
        pin_id,
        current_stage_id,
        purchase_price
      ) VALUES ($1, $2, $3)`, [
            pinId,
            stageResult.rows[0].id,
            property.price,
        ]);
        // Update extraction queue with created pin
        await (0, connection_1.query)(`UPDATE property_extraction_queue 
       SET status = 'auto-created', created_pin_id = $1
       WHERE id = $2`, [pinId, extractionId]);
        logger_1.logger.info('Property pin created', {
            mapId,
            pinId,
            address: property.address,
            source: 'email',
            extractionId,
        });
        return pinId;
    }
    catch (error) {
        logger_1.logger.error('Error creating property pin:', error);
        return null;
    }
}
/**
 * Send notification to user about new property
 */
async function notifyUserNewProperty(userId, property, decision, mapId) {
    try {
        let message = '';
        switch (decision) {
            case 'auto-create':
                message = `✅ New property auto-added: ${property.address}`;
                break;
            case 'requires-review':
                message = `🟡 Property needs review: ${property.address}`;
                break;
            case 'rejected':
                message = `❌ Property filtered out: ${property.address}`;
                break;
            case 'ignored':
                message = `⊘ Property ignored (low confidence): ${property.address}`;
                break;
        }
        logger_1.logger.info('Property notification', {
            userId,
            decision,
            address: property.address,
            message,
        });
        // TODO: Implement actual notification system
        // - In-app notification
        // - Email digest (daily summary)
        // - Push notification
        // - Webhook (Slack/Discord/Telegram)
    }
    catch (error) {
        logger_1.logger.error('Error sending notification:', error);
    }
}
/**
 * Main automation function: Process email and create property if relevant
 * NOW WITH INTELLIGENT PREFERENCE MATCHING
 */
async function processEmailForProperty(email, userId) {
    try {
        logger_1.logger.info('Processing email for property detection', {
            emailId: email.id,
            userId,
            subject: email.subject,
        });
        // Step 1: Extract property information from email
        const property = await extractPropertyFromEmail(email);
        if (!property) {
            return {
                success: false,
                reason: 'No property information found in email'
            };
        }
        logger_1.logger.info('Property extracted from email', {
            address: property.address,
            confidence: property.confidence,
            propertyType: property.propertyType,
        });
        // Step 2: Get user's acquisition preferences
        const preferences = await (0, preference_matching_service_1.getUserPreferences)(userId);
        if (!preferences) {
            logger_1.logger.warn('No user preferences found, using default behavior', { userId });
            // Default: High confidence extractions go to review queue
            if (property.confidence >= 0.7) {
                const extractionId = await (0, preference_matching_service_1.queuePropertyExtraction)(userId, email.id, email.subject, email.from.address, new Date(email.receivedDateTime), property, {
                    matches: false,
                    score: 0,
                    reasons: [{ criterion: 'no_preferences', matched: false, weight: 0, details: 'User has not set preferences' }],
                    decision: 'requires-review',
                    decision_reason: 'No user preferences configured',
                });
                return {
                    success: true,
                    decision: 'requires-review',
                    extractionId,
                    reason: 'No preferences set - added to review queue',
                };
            }
            else {
                return {
                    success: false,
                    decision: 'ignored',
                    reason: 'Low extraction confidence and no user preferences',
                };
            }
        }
        // Step 3: Match property against user preferences
        const matchResult = await (0, preference_matching_service_1.matchPropertyToPreferences)(property, preferences);
        logger_1.logger.info('Property matched against preferences', {
            matches: matchResult.matches,
            score: matchResult.score,
            decision: matchResult.decision,
        });
        // Step 4: Queue the extraction with match result
        const extractionId = await (0, preference_matching_service_1.queuePropertyExtraction)(userId, email.id, email.subject, email.from.address, new Date(email.receivedDateTime), property, matchResult);
        // Step 5: Handle based on decision
        if (matchResult.decision === 'auto-create') {
            // Geocode address
            const fullAddress = [
                property.address,
                property.city,
                property.state,
                property.zipCode
            ].filter(Boolean).join(', ');
            const location = await geocodeAddress(fullAddress);
            if (!location) {
                logger_1.logger.warn('Could not geocode address, moving to review queue', { address: fullAddress });
                await (0, connection_1.query)(`UPDATE property_extraction_queue 
           SET status = 'requires-review', decision_reason = $1
           WHERE id = $2`, ['Could not geocode address', extractionId]);
                return {
                    success: true,
                    decision: 'requires-review',
                    extractionId,
                    reason: 'High match but geocoding failed',
                    matchScore: matchResult.score,
                };
            }
            // Get user's active map
            const mapId = await getUserActiveMap(userId);
            if (!mapId) {
                logger_1.logger.error('No active map found for user', { userId });
                return {
                    success: false,
                    decision: 'requires-review',
                    extractionId,
                    reason: 'No active map found',
                };
            }
            // Create property pin automatically
            const pinId = await createPropertyPin(mapId, property, location, email.id, userId, extractionId);
            if (pinId) {
                await notifyUserNewProperty(userId, property, 'auto-create', mapId);
                return {
                    success: true,
                    decision: 'auto-create',
                    pinId,
                    extractionId,
                    matchScore: matchResult.score,
                };
            }
            else {
                return {
                    success: false,
                    decision: 'requires-review',
                    extractionId,
                    reason: 'Failed to create pin',
                };
            }
        }
        else {
            // requires-review, rejected, or ignored
            await notifyUserNewProperty(userId, property, matchResult.decision);
            return {
                success: true,
                decision: matchResult.decision,
                extractionId,
                reason: matchResult.decision_reason,
                matchScore: matchResult.score,
            };
        }
    }
    catch (error) {
        logger_1.logger.error('Error in email property automation:', error);
        return {
            success: false,
            reason: 'Internal error processing email: ' + error.message
        };
    }
}
/**
 * Batch process multiple emails
 */
async function batchProcessEmails(emails, userId) {
    const results = {
        processed: 0,
        autoCreated: 0,
        requiresReview: 0,
        rejected: 0,
        ignored: 0,
        errors: 0,
    };
    logger_1.logger.info('Starting batch email processing', {
        userId,
        emailCount: emails.length,
    });
    for (const email of emails) {
        try {
            const result = await processEmailForProperty(email, userId);
            results.processed++;
            if (result.success) {
                switch (result.decision) {
                    case 'auto-create':
                        results.autoCreated++;
                        break;
                    case 'requires-review':
                        results.requiresReview++;
                        break;
                    case 'rejected':
                        results.rejected++;
                        break;
                    case 'ignored':
                        results.ignored++;
                        break;
                }
            }
            else {
                results.errors++;
            }
        }
        catch (error) {
            results.errors++;
            logger_1.logger.error('Error processing email in batch:', {
                emailId: email.id,
                error,
            });
        }
    }
    logger_1.logger.info('Batch email processing complete', results);
    return results;
}
/**
 * Manually process a queued extraction (user approves it)
 */
async function processQueuedExtraction(extractionId, userId) {
    try {
        // Get the extraction
        const result = await (0, connection_1.query)(`SELECT * FROM property_extraction_queue 
       WHERE id = $1 AND user_id = $2`, [extractionId, userId]);
        if (result.rows.length === 0) {
            return { success: false, reason: 'Extraction not found' };
        }
        const extraction = result.rows[0];
        const property = extraction.extracted_data;
        // Geocode
        const fullAddress = [
            property.address,
            property.city,
            property.state,
            property.zipCode
        ].filter(Boolean).join(', ');
        const location = await geocodeAddress(fullAddress);
        if (!location) {
            return { success: false, reason: 'Could not geocode address' };
        }
        // Get map
        const mapId = await getUserActiveMap(userId);
        if (!mapId) {
            return { success: false, reason: 'No active map found' };
        }
        // Create pin
        const pinId = await createPropertyPin(mapId, property, location, extraction.email_id, userId, extractionId);
        if (pinId) {
            return { success: true, pinId };
        }
        else {
            return { success: false, reason: 'Failed to create pin' };
        }
    }
    catch (error) {
        logger_1.logger.error('Error processing queued extraction:', error);
        return { success: false, reason: 'Internal error' };
    }
}
//# sourceMappingURL=email-property-automation.service.js.map