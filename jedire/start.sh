#!/bin/bash
cd /home/runner/workspace/backend && npx ts-node --transpile-only src/index.replit.ts &
cd /home/runner/workspace/frontend && npx vite --host 0.0.0.0 --port 5000 &
wait
