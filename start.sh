#!/bin/bash
cd "$(dirname "$0")"
env $(cat .env | grep -v '^#' | xargs) node src/index.js >> bot.log 2>&1 &
echo "Remote Claude started (PID $!)"
