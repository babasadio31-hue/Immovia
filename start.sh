#!/bin/bash
echo "Starting Uvicorn on port $PORT..."
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
