idf_component_register(
    SRCS "main.c"
    INCLUDE_DIRS "."
    REQUIRES freertos driver esp_event esp_netif esp_http_client nvs_flash json esp_wifi protocol_examples_common esp_websocket_client
)
