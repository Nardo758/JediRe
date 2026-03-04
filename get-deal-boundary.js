#!/usr/bin/env node
/**
 * Get Deal Boundary Data via Clawdbot API
 */

const https = require('https');

const API_URL = 'https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev';
const AUTH_TOKEN = '69295404e382acd00de4facdaa053fd20ae0a1cf15dc63c0b8a55cffc0e088b6';
const DEAL_ID = 'e044db04-439b-4442-82df-b36a840f2fd8';

// Simplified query approach - get deals with boundaries
const requestData = JSON.stringify({
  query: 'deals_count'
});

const url = new URL(`${API_URL}/api/v1/clawdbot/query`);

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Length': Buffer.byteLength(requestData)
  }
};

const req = https.request(url, options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
    try {
      const parsed = JSON.parse(data);
      console.log('\nParsed:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('Could not parse JSON');
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(requestData);
req.end();
