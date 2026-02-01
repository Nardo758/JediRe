#!/bin/bash
cd backend && node dist/index.replit.js &
BACKEND_PID=$!
sleep 2
cd frontend && npm run dev &
FRONTEND_PID=$!
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
