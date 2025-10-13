
web_clients = set()
esp_clients = {} 

# --- Broadcasting Functions ---
# These are defined at the top level so blueprints can import them.
def broadcast_to_web(message_json):
    """Sends a message to all connected web clients."""
    for client in list(web_clients):
        try:
            client.send(message_json)
        except Exception:
            web_clients.remove(client)

def broadcast_to_esp(message_json, device_id=None):
    """Sends a message to a specific ESP device or all devices if device_id is None."""
    targets = []
    if device_id and device_id in esp_clients:
        targets.append((device_id, esp_clients[device_id]))
    elif not device_id:
        targets = list(esp_clients.items())

    for did, client in targets:
        try:
            client.send(message_json)
        except Exception:
            del esp_clients[did]
