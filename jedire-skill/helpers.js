/**
 * JediRe Skill Helper Functions
 * Utility functions for formatting, parsing, and analyzing JediRe data
 */

/**
 * Format deal data for readable output
 * @param {Object} deal - Deal object from JediRe API
 * @returns {string} Formatted deal summary
 */
function formatDeal(deal) {
  if (!deal) return 'No deal data available';

  const {
    id,
    name,
    address,
    type,
    price,
    units,
    capRate,
    irr,
    cashOnCash,
    riskScore,
    recommendation,
    analysisDate
  } = deal;

  const lines = [
    `📊 Deal: ${name || id}`,
    `🏢 Type: ${type || 'N/A'}`,
    `📍 Address: ${address || 'N/A'}`,
    '',
    `💰 Price: ${formatCurrency(price)}`,
    `🏠 Units: ${units || 'N/A'}`,
    '',
    '📈 Metrics:',
    `  • Cap Rate: ${formatPercent(capRate)}`,
    `  • IRR: ${formatPercent(irr)}`,
    `  • Cash-on-Cash: ${formatPercent(cashOnCash)}`,
    '',
    `⚠️  Risk Score: ${riskScore || 'N/A'}/100`,
    `✅ Recommendation: ${recommendation || 'N/A'}`,
    '',
    `🕒 Analyzed: ${formatDate(analysisDate)}`
  ];

  return lines.join('\n');
}

/**
 * Format property data for readable output
 * @param {Object} property - Property object from JediRe API
 * @returns {string} Formatted property summary
 */
function formatProperty(property) {
  if (!property) return 'No property data available';

  const {
    address,
    city,
    state,
    zip,
    type,
    yearBuilt,
    squareFeet,
    bedrooms,
    bathrooms,
    lotSize,
    estimatedValue,
    lastSalePrice,
    lastSaleDate,
    taxAssessment,
    marketTrend
  } = property;

  const lines = [
    `🏠 Property: ${address}`,
    `📍 Location: ${city}, ${state} ${zip}`,
    `🏗️  Type: ${type || 'N/A'} | Built: ${yearBuilt || 'N/A'}`,
    '',
    '📐 Details:',
    `  • Square Feet: ${formatNumber(squareFeet)}`,
    `  • Bedrooms: ${bedrooms || 'N/A'} | Bathrooms: ${bathrooms || 'N/A'}`,
    `  • Lot Size: ${formatNumber(lotSize)} sq ft`,
    '',
    '💵 Valuation:',
    `  • Estimated Value: ${formatCurrency(estimatedValue)}`,
    `  • Last Sale: ${formatCurrency(lastSalePrice)} (${formatDate(lastSaleDate)})`,
    `  • Tax Assessment: ${formatCurrency(taxAssessment)}`,
    '',
    `📊 Market Trend: ${marketTrend || 'N/A'}`
  ];

  return lines.join('\n');
}

/**
 * Detect deal IDs mentioned in text
 * @param {string} text - Text to search
 * @returns {Array<string>} Array of detected deal IDs
 */
function detectDealMention(text) {
  if (!text || typeof text !== 'string') return [];

  const patterns = [
    /DEAL-(\d+)/gi,      // DEAL-12345
    /#(\d{4,6})/g        // #12345
  ];

  const matches = new Set();

  patterns.forEach(pattern => {
    const found = text.matchAll(pattern);
    for (const match of found) {
      // Normalize to DEAL-XXXXX format
      const id = match[0].startsWith('DEAL-') 
        ? match[0] 
        : `DEAL-${match[1]}`;
      matches.add(id.toUpperCase());
    }
  });

  return Array.from(matches);
}

/**
 * Parse and explain error objects from JediRe
 * @param {Object} error - Error object from webhook or API
 * @returns {Object} Parsed error with explanation and recommendations
 */
function analyzeError(error) {
  if (!error) return { message: 'Unknown error', severity: 'low' };

  const {
    code,
    message,
    type,
    timestamp,
    context,
    stackTrace
  } = error;

  const analysis = {
    code: code || 'UNKNOWN',
    message: message || 'No error message provided',
    type: type || 'unknown',
    timestamp: timestamp || new Date().toISOString(),
    severity: determineSeverity(error),
    impact: determineImpact(error),
    explanation: explainError(error),
    recommendations: getRecommendations(error),
    context: context || {}
  };

  return analysis;
}

/**
 * Determine error severity
 * @private
 */
function determineSeverity(error) {
  const { code, type } = error;
  
  if (code?.startsWith('CRITICAL') || type === 'system_failure') {
    return 'critical';
  }
  if (code?.startsWith('ERROR') || type === 'data_error') {
    return 'high';
  }
  if (code?.startsWith('WARN') || type === 'validation_error') {
    return 'medium';
  }
  return 'low';
}

/**
 * Determine error impact
 * @private
 */
function determineImpact(error) {
  const { type, context } = error;
  
  if (type === 'system_failure') {
    return 'Platform-wide outage - all services affected';
  }
  if (type === 'data_error') {
    return `Data integrity issue - ${context?.affectedDeals || 'multiple'} deals affected`;
  }
  if (type === 'api_error') {
    return 'API service degradation - some requests may fail';
  }
  if (type === 'validation_error') {
    return 'Data quality warning - results may be incomplete';
  }
  return 'Minimal impact - isolated issue';
}

/**
 * Explain error in user-friendly terms
 * @private
 */
function explainError(error) {
  const { code, type, message } = error;
  
  const explanations = {
    'API_TIMEOUT': 'The JediRe API took too long to respond. This might be due to high load or network issues.',
    'DATA_MISSING': 'Required data is missing from the response. The analysis may be incomplete.',
    'CALCULATION_ERROR': 'An error occurred during financial calculations. The results may not be accurate.',
    'RATE_LIMIT': 'API rate limit exceeded. Too many requests were made in a short time.',
    'AUTH_FAILED': 'Authentication failed. Check your API key configuration.',
    'VALIDATION_ERROR': 'Input data failed validation. Check the format of your request.'
  };

  return explanations[code] || message || 'An unexpected error occurred.';
}

/**
 * Get recommendations for error resolution
 * @private
 */
function getRecommendations(error) {
  const { code, type } = error;
  
  const recommendations = {
    'API_TIMEOUT': [
      'Retry the request after a brief delay',
      'Check JediRe status page for ongoing incidents',
      'Consider breaking large requests into smaller chunks'
    ],
    'DATA_MISSING': [
      'Verify the deal ID is correct',
      'Check if the deal has been recently updated',
      'Contact JediRe support if the issue persists'
    ],
    'CALCULATION_ERROR': [
      'Review input parameters for accuracy',
      'Try running a simpler analysis first',
      'Report the issue to JediRe support with the deal ID'
    ],
    'RATE_LIMIT': [
      'Wait before making additional requests',
      'Implement exponential backoff in your code',
      'Contact JediRe to discuss rate limit increases'
    ],
    'AUTH_FAILED': [
      'Verify JEDIRE_API_KEY environment variable is set',
      'Check that your API key is still valid',
      'Regenerate API key in JediRe dashboard if needed'
    ]
  };

  return recommendations[code] || [
    'Review the error message for specific details',
    'Check JediRe documentation for this error type',
    'Contact support if the issue persists'
  ];
}

/**
 * Format currency values
 * @private
 */
function formatCurrency(value) {
  if (value == null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Format percentage values
 * @private
 */
function formatPercent(value) {
  if (value == null) return 'N/A';
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Format numbers with thousands separators
 * @private
 */
function formatNumber(value) {
  if (value == null) return 'N/A';
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Format dates in readable format
 * @private
 */
function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Export functions
module.exports = {
  formatDeal,
  formatProperty,
  detectDealMention,
  analyzeError
};
