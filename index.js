// Production entry point
// Force port 4000 — the deployment forwards localPort 4000 → externalPort 80
process.env.PORT = '4000';
require('./backend/dist/index.replit.js');
