# Filename: extensions.py
"""
Centralized extensions initialization.

This file initializes shared extensions (like SocketIO and Redis) 
to avoid circular imports and provide a single source of truth.
"""

from flask_socketio import SocketIO
import redis
import os

# 1. Initialize SocketIO for the WEB server
# We use 'threading' as async_mode for compatibility with Flask development server.
# (Restored from original version ...7457...)
socketio = SocketIO(async_mode='threading', cors_allowed_origins="*")

# 2. Initialize Redis client
# (Added for the new PubSub architecture)
# This client connects to the Redis server.
# It uses REDIS_URL from environment variables if available, 
# otherwise defaults to localhost.
try:
    redis_url = os.environ.get('REDIS_URL', 'redis://localhost:7777/0')
    # decode_responses=True ensures we get strings, not bytes, from Redis
    redis_client = redis.Redis.from_url(redis_url, decode_responses=True)
    # Test the connection
    redis_client.ping()
    print(f"Successfully connected to Redis at {redis_url}")
except redis.exceptions.ConnectionError as e:
    print(f"--- FATAL ERROR: Could not connect to Redis ---")
    print(f"Error: {e}")
    print("Please ensure Redis server is running at the specified URL.")
    # We can choose to exit or let it fail later
    # For now, we'll set client to None
    redis_client = None

# 3. Define the Redis Channel name
# This MUST match the channel used by sock_server.py
REDIS_SCOREBOARD_CHANNEL = "scoreboard_updates"