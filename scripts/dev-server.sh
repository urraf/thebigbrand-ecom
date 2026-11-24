#!/bin/bash
# Keeps ONE shared Next.js dev server running on :3200 for everyone (agents must not start their own —
# two dev servers in the same folder corrupt .next). Restarts it if it exits. Log: .shots/dev-server.log
cd "$(dirname "$0")/.." || exit 1
mkdir -p .shots
while true; do
  echo "[$(date '+%H:%M:%S')] starting next dev on :3200" >> .shots/dev-server.log
  npx next dev -p 3200 >> .shots/dev-server.log 2>&1
  echo "[$(date '+%H:%M:%S')] dev server exited ($?) — restarting in 3s" >> .shots/dev-server.log
  sleep 3
done
