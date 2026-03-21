#!/bin/bash
cd "$(dirname "$0")"
env $(cat .env | grep -v '^#' | xargs) node src/index.js &
echo "Remote Claude started (PID $!)"
