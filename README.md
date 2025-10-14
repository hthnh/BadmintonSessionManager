# Filename: README.md

# Badminton Session Manager (Refactored Architecture)

This project is a Flask-based application for managing badminton sessions, players, and real-time scoreboards.

This version has been refactored to support a decoupled, scalable 2-server architecture for handling hardware (ESP devices) and web clients (browsers) separately, using Redis as a message broker.

## Architecture Overview

The new architecture consists of 3 main components that must run simultaneously:

1.  **Hardware Server (`sock_server.py`)**
    * **Technology:** Flask + `flask-sock`
    * **Port:** `5001` (by default)
    * **Purpose:** Listens for raw WebSocket connections from ESP8266/ESP32 devices on `/ws/device`. It receives score data, parses it, and immediately publishes it to a Redis channel (`scoreboard_updates`).

2.  **Redis Message Broker**
    * **Technology:** Redis Server
    * **Port:** `6379` (by default)
    * **Purpose:** Acts as the "middle-man". It receives messages from `sock_server.py` and queues them for the `web_server.py`.

3.  **Web Server (`web_server.py`)**
    * **Technology:** Flask + `flask-socketio`
    * **Port:** `5000` (by default)
    * **Purpose:**
        * Serves all HTML pages and REST APIs (`/api/...`).
        * Handles web browser connections via `flask-socketio`.
        * Runs a background thread that subscribes to the `scoreboard_updates` channel in Redis.
        * When a message is received from Redis, this server (a) updates the `badminton.db` database and (b) `socketio.emit`s the score change to all connected web clients.

## Key Files
* `web_server.py`: Main application server (SocketIO + APIs + HTML).
* `sock_server.py`: Dedicated hardware-facing server (raw WebSocket).
* `extensions.py`: Centralizes `socketio`, `redis_client`, and channel definitions.
* `database.py`: Centralizes database connection logic.
* `/templates/layout.html`: The new base layout for the web UI.
* `/static/modules/dashboard-manager.js`: The (restored) core frontend logic.

## Setup & Installation

1.  **Clone the repository:**
    ```bash
    git clone [your-repo-url]
    cd badmintonsessionmanager
    ```

2.  **Create and activate a virtual environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

3.  **Install dependencies:**
    * Ensure you have installed all required libraries (from `requirements.txt` which you are managing). This must include:
    ```bash
    pip install flask flask-socketio flask-sock redis waitress
    ```

4.  **Install and run Redis:**
    * You must have a Redis server running.
    * Download from: [https://redis.io/topics/quickstart](https://redis.io/topics/quickstart)
    * Run it in a terminal: `redis-server`

## How to Run (Development)

You must run all 3 components in separate terminal windows.

**Terminal 1: Run Redis (if not already running)**
```bash
redis-server
````

**Terminal 2: Run the Hardware Server (Sock Server)**

```bash
python sock_server.py
```

*(This will start listening on port 5001 for your ESP devices)*

**Terminal 3: Run the Main Web Server (SocketIO Server)**

```bash
python web_server.py
```

*(This will start the web application on port 5000)*

-----