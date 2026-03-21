#!/bin/bash
kill $(pgrep -f "node src/index.js") 2>/dev/null && echo "Stopped" || echo "Not running"
