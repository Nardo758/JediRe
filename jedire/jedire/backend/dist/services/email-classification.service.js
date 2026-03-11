"use strict";
/**
 * Email Classification Service
 * Determines whether an email contains property listings, news/intelligence, or general correspondence
 * Uses keyword matching + optional LLM classification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyEmailByKeywords = classifyEmailByKeywords;
exports.classifyEmailWithLLM = classifyEmailWithLLM;
exports.classifyEmail = classifyEmail;
const logger_1 = require("../utils/logger");
// Keyword patterns for property listings
const PROPERTY_KEYWORDS = {
    highConfidence: [
        /\$\d+[\d,]*\s*(million|m|mm)?/i, // Price indicators
        /\d+\s*unit(?:s)?/i, // Unit count
        /cap\s*rate/i,
        /noi/i, // Net Operating Income
        /for\s*sale/i,
        /listing/i,
        /offering\s*memorandum/i,
        /om\s*attached/i,
        /\d+\s*(?:sf|sq\.?\s*ft\.?|square\s*feet)/i, // Square footage
        /asking\s*price/i,
        /\d+\s*(?:bed|bedroom)s?/i,
        /multifamily/i,
        /apartment\s*(?:building|complex)/i,
    ],
    mediumConfidence: [
        /property/i,
        /real\s*estate/i,
        /investment/i,
        /opportunity/i,
        /off[\s-]?market/i,
        /exclusive/i,
        /commercial/i,
        /retail/i,
        /office\s*(?:building|space)/i,
        /industrial/i,
        /warehouse/i,
    ],
    senders: [
        /broker/i,
        /realty/i,
        /properties/i,
        /capital/i,
        /investments?/i,
        /cbre|cushman|jll|colliers|marcus.*millichap/i, // Major brokerages
    ],
};
// Keyword patterns for news/intelligence
const NEWS_KEYWORDS = {
    highConfidence: [
        /announced/i,
        /development/i,
        /construction/i,
        /groundbreaking/i,
        /redevelopment/i,
        /zoning\s*(?:change|approval)/i,
        /rezoning/i,
        /permits?\s*(?:issued|approved)/i,
        /\d+\s*(?:jobs?|employees?)\s*(?:created|announced|hired)/i, // Employment news
        /\$\d+[\d,]*\s*(?:million|billion)\s*(?:investment|project|funding)/i, // Investment amounts
        /new\s*(?:headquarters|hq|facility|campus)/i,
        /expansion/i,
        /economic\s*development/i,
        /market\s*(?:report|analysis|update)/i,
    ],
    mediumConfidence: [
        /breaking/i,
        /news/i,
        /newsletter/i,
        /market\s*intelligence/i,
        /industry\s*(?:news|update)/i,
        /transaction(?:s)?/i,
        /acquisition/i,
        /merger/i,
        /partnership/i,
    ],
    senders: [
        /news/i,
        /newsletter/i,
        /digest/i,
        /report/i,
        /intelligence/i,
        /research/i,
        /bisnow|costar|reis|yardi|realtymogul/i, // Industry publishers
    ],
};
/**
 * Classify email using keyword-based approach
 */
function classifyEmailByKeywords(email) {
    const subject = email.subject || '';
    const body = email.body || email.snippet || '';
    const from = email.from || '';
    const fullText = `${subject} ${body}`.toLowerCase();
    let propertyScore = 0;
    let newsScore = 0;
    const reasons = [];
    // Check property keywords
    let propertyMatches = 0;
    PROPERTY_KEYWORDS.highConfidence.forEach((pattern) => {
        if (pattern.test(fullText)) {
            propertyScore += 2;
            propertyMatches++;
        }
    });
    PROPERTY_KEYWORDS.mediumConfidence.forEach((pattern) => {
        if (pattern.test(fullText)) {
            propertyScore += 1;
            propertyMatches++;
        }
    });
    PROPERTY_KEYWORDS.senders.forEach((pattern) => {
        if (pattern.test(from)) {
            propertyScore += 1.5;
            reasons.push(`Property broker sender: ${from}`);
        }
    });
    if (propertyMatches > 0) {
        reasons.push(`${propertyMatches} property keyword match(es)`);
    }
    // Check news keywords
    let newsMatches = 0;
    NEWS_KEYWORDS.highConfidence.forEach((pattern) => {
        if (pattern.test(fullText)) {
            newsScore += 2;
            newsMatches++;
        }
    });
    NEWS_KEYWORDS.mediumConfidence.forEach((pattern) => {
        if (pattern.test(fullText)) {
            newsScore += 1;
            newsMatches++;
        }
    });
    NEWS_KEYWORDS.senders.forEach((pattern) => {
        if (pattern.test(from)) {
            newsScore += 1.5;
            reasons.push(`News/intelligence sender: ${from}`);
        }
    });
    if (newsMatches > 0) {
        reasons.push(`${newsMatches} news keyword match(es)`);
    }
    // Determine classification
    const containsProperty = propertyScore >= 2;
    const containsNews = newsScore >= 2;
    let classification;
    let confidence;
    if (containsProperty && containsNews) {
        classification = 'mixed';
        confidence = Math.min(propertyScore, newsScore) / 10;
        reasons.push('Contains both property and news indicators');
    }
    else if (containsProperty) {
        classification = 'property';
        confidence = Math.min(propertyScore / 10, 0.95);
        reasons.push('Classified as property listing');
    }
    else if (containsNews) {
        classification = 'news';
        confidence = Math.min(newsScore / 10, 0.95);
        reasons.push('Classified as news/intelligence');
    }
    else {
        classification = 'general';
        confidence = 0.1;
        reasons.push('General correspondence (no property or news indicators)');
    }
    return {
        classification,
        confidence: Math.min(confidence, 1.0),
        reasons,
        containsProperty,
        containsNews,
    };
}
/**
 * Classify email using LLM (more accurate but slower)
 */
async function classifyEmailWithLLM(email) {
    try {
        const { generateCompletion } = require('./llm.service');
        const prompt = `Classify this email. Respond with JSON only.

Email:
Subject: ${email.subject}
From: ${email.from}
Body: ${email.body.substring(0, 1000)}

Classify as:
- "property" - Property listing (for sale, broker email, pricing, units, cap rate, offering memorandum)
- "news" - Market intelligence (development announcements, employment news, new construction, market reports)
- "mixed" - Contains BOTH property listing AND news
- "general" - Regular correspondence

Return JSON:
{
  "classification": "property|news|mixed|general",
  "confidence": 0.0-1.0,
  "reasons": ["reason 1", "reason 2"],
  "containsProperty": true/false,
  "containsNews": true/false
}`;
        const response = await generateCompletion({
            prompt,
            maxTokens: 300,
            temperature: 0.1,
        });
        const result = JSON.parse(response.text);
        return result;
    }
    catch (error) {
        logger_1.logger.error('Error classifying email with LLM, falling back to keywords:', error);
        return classifyEmailByKeywords(email);
    }
}
/**
 * Main classification function - uses keywords first, LLM if ambiguous
 */
async function classifyEmail(email, useLLM = false) {
    // Try keyword-based classification first
    const keywordResult = classifyEmailByKeywords(email);
    // If high confidence, return immediately
    if (keywordResult.confidence >= 0.7) {
        logger_1.logger.debug('Email classified with high confidence via keywords', {
            classification: keywordResult.classification,
            confidence: keywordResult.confidence,
        });
        return keywordResult;
    }
    // If low confidence and LLM enabled, use AI
    if (useLLM && keywordResult.confidence < 0.5) {
        logger_1.logger.debug('Using LLM for ambiguous email classification');
        return await classifyEmailWithLLM(email);
    }
    // Otherwise return keyword result
    return keywordResult;
}
//# sourceMappingURL=email-classification.service.js.map