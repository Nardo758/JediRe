const url = 'https://apartment-locator-ai-real.replit.app/api/v1/properties?city=Atlanta&state=GA&limit=2';
const apiKey = 'aiq_2248e8fc535c5a9c4a09f9ed1c0d719bf0ad45f56b2c47841de6bc1421388f6b';

fetch(url, {
  headers: { 'Authorization': `Bearer ${apiKey}` }
})
.then(r => r.json())
.then(data => console.log(JSON.stringify(data, null, 2)))
.catch(err => console.error('Error:', err));
