#include <ESP8266WiFi.h>
#include <ArduinoWebsockets.h>
#include <ArduinoJson.h>

using namespace websockets;

const char* ssid = "Pi5-AP";
const char* password = "24042404";
const char* SERVER_IP = "192.168.50.1";
const int SERVER_PORT = 5000;

WebsocketsClient wsClient;

int scoreA = 0, scoreB = 0;

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
}

void onMessageCallback(WebsocketsMessage msg) {
  StaticJsonDocument<128> doc;
  DeserializationError err = deserializeJson(doc, msg.data());
  if (err) return;

  if (doc.containsKey("score_A")) scoreA = doc["score_A"];
  if (doc.containsKey("score_B")) scoreB = doc["score_B"];
  Serial.printf("[WS] Updated score: %d - %d\n", scoreA, scoreB);
}

void sendScore() {
  StaticJsonDocument<128> doc;
  doc["score_A"] = scoreA;
  doc["score_B"] = scoreB;
  String json;
  serializeJson(doc, json);
  wsClient.send(json);
  Serial.printf("[WS] Sent: %s\n", json.c_str());
}

void setup() {
  Serial.begin(115200);
  connectWiFi();

  String wsUrl = "ws://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + "/ws";
  wsClient.onMessage(onMessageCallback);
  wsClient.connect(wsUrl);

  Serial.println("[WS] Connected to server!");
}

void loop() {
  wsClient.poll();

  if (Serial.available()) {
    String msg = Serial.readStringUntil('\n');
    if (msg.startsWith("A+")) scoreA++;
    else if (msg.startsWith("B+")) scoreB++;
    sendScore();
  }

  delay(10);
}
