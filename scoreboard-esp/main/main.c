/********************************************************************************
 * Badminton Scoreboard Controller - ESP-IDF High-Performance Version
 *
 * HARDWARE PROFILE (Direct I/O):
 * - Cathodes (Segments a-g, dp): Driven directly by 8 GPIOs -> ULN2803A (Sink)
 * -> Logic: HIGH signal from ESP32 turns a segment ON.
 * - Anodes (Digits 1-4): Driven by AO3407 P-Channel MOSFETs (High-Side Switch)
 * -> Logic: LOW signal from ESP32 turns a digit ON.
 *
 * SOFTWARE ARCHITECTURE:
 * - Core 0: Dedicated display task for flicker-free multiplexing.
 * - Core 1: Main logic (WiFi, Button ISR, HTTP POST).
 *
 * By: Đối tác lập trình (Gemini)
 ********************************************************************************/

#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "freertos/queue.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "protocol_examples_common.h"
#include "esp_wifi.h"
#include "esp_http_client.h"
#include "cJSON.h"
#include "esp_websocket_client.h" 

// === CẤU HÌNH HỆ THỐNG ===
#define WIFI_SSID      "Pi5-AP"
#define WIFI_PASSWORD  "24042404"
#define SERVER_URL     "http://192.168.50.1:5000/api/scoreboards/SB-001/score"
#define DEVICE_ID      "SB-001"
#define SERVER_IP      "192.168.50.1"
#define SERVER_PORT    5000

#define WIFI_MAXIMUM_RETRY  5

// === CẤU HÌNH CHÂN PHẦN CỨNG (PINOUT) ===
// [CẬP NHẬT] Chân điều khiển trực tiếp 8 segment (a,b,c,d,e,f,g,dp)
#define SEG_A_PIN   GPIO_NUM_18
#define SEG_B_PIN   GPIO_NUM_19
#define SEG_C_PIN   GPIO_NUM_23
#define SEG_D_PIN   GPIO_NUM_5
#define SEG_E_PIN   GPIO_NUM_13
#define SEG_F_PIN   GPIO_NUM_12
#define SEG_G_PIN   GPIO_NUM_14
#define SEG_DP_PIN  GPIO_NUM_27

// [CẬP NHẬT] Chân điều khiển Anode cho các LED
#define DIGIT_1     GPIO_NUM_16
#define DIGIT_2     GPIO_NUM_17
#define DIGIT_3     GPIO_NUM_25
#define DIGIT_4     GPIO_NUM_26

// [CẬP NHẬT] Chân cho nút bấm (ĐÃ THAY ĐỔI để tránh xung đột với SEG_B_PIN)
#define BUTTON_A_PIN GPIO_NUM_2
#define BUTTON_B_PIN GPIO_NUM_4

static const char *TAG = "SCOREBOARD";
volatile bool is_swapped = false;

const gpio_num_t digit_pins[4] = {DIGIT_1, DIGIT_2, DIGIT_3, DIGIT_4};
const gpio_num_t seg_pins[8] = {SEG_A_PIN, SEG_B_PIN, SEG_C_PIN, SEG_D_PIN, SEG_E_PIN, SEG_F_PIN, SEG_G_PIN, SEG_DP_PIN};

// Bảng mã cho LED 7 đoạn (gfedcba). Bit 7 là DP, không dùng trong map này.
const uint8_t digit_map[10] = {
    0b00111111, // 0
    0b00000110, // 1
    0b01011011, // 2
    0b01001111, // 3
    0b01100110, // 4
    0b01101101, // 5
    0b01111101, // 6
    0b00000111, // 7
    0b01111111, // 8
    0b01101111  // 9
};

// === BIẾN TOÀN CỤC & HÀNG ĐỢI ===
volatile int scoreA = 0;
volatile int scoreB = 0;
static portMUX_TYPE score_mutex = portMUX_INITIALIZER_UNLOCKED;
static QueueHandle_t gpio_evt_queue = NULL;



// === [MỚI] FreeRTOS Event Group để xử lý tín hiệu WiFi ===
static EventGroupHandle_t s_wifi_event_group;
#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAIL_BIT      BIT1

static int s_retry_num = 0; // Biến đếm số lần kết nối lại



// === [MỚI] WEBSOCKET LOGIC ===
static esp_websocket_client_handle_t ws_client;

static void handle_websocket_event_data(const char *data, int len) {
    // Tìm kiếm tên sự kiện trong chuỗi nhận được
    if (strstr(data, "\"score_updated\"")) {
        const char *json_start = strchr(data, '{');
        if (json_start) {
            cJSON *root = cJSON_Parse(json_start);
            if (root) {
                cJSON *score_a_json = cJSON_GetObjectItem(root, "score_A");
                cJSON *score_b_json = cJSON_GetObjectItem(root, "score_B");

                if (cJSON_IsNumber(score_a_json) && cJSON_IsNumber(score_b_json)) {
                    portENTER_CRITICAL(&score_mutex);
                    scoreA = score_a_json->valueint;
                    scoreB = score_b_json->valueint;
                    portEXIT_CRITICAL(&score_mutex);
                    ESP_LOGI(TAG, "Score updated via WebSocket: %d - %d", scoreA, scoreB);
                }
                cJSON_Delete(root);
            }
        }
    } else if (strstr(data, "\"board_state_updated\"")) { // [MỚI] Xử lý sự kiện cập nhật trạng thái
        const char *json_start = strchr(data, '{');
        if (json_start) {
            cJSON *root = cJSON_Parse(json_start);
            if (root) {
                cJSON *is_swapped_json = cJSON_GetObjectItem(root, "is_swapped");
                if (cJSON_IsNumber(is_swapped_json)) {
                    portENTER_CRITICAL(&score_mutex);
                    is_swapped = (is_swapped_json->valueint == 1);
                    portEXIT_CRITICAL(&score_mutex);
                    ESP_LOGI(TAG, "Swap state updated via WebSocket: %s", is_swapped ? "ON" : "OFF");
                }
                cJSON_Delete(root);
            }
        }
    }
}

static void websocket_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data) {
    esp_websocket_event_data_t *data = (esp_websocket_event_data_t *)event_data;
    switch (event_id) {
        case WEBSOCKET_EVENT_CONNECTED:
            ESP_LOGI(TAG, "WEBSOCKET_EVENT_CONNECTED");
            esp_websocket_client_send_text(data->client, "40", 2, portMAX_DELAY);
            break;
        case WEBSOCKET_EVENT_DISCONNECTED:
            ESP_LOGW(TAG, "WEBSOCKET_EVENT_DISCONNECTED");
            break;
        case WEBSOCKET_EVENT_DATA:
            if (data->data_len > 0) {
                switch (data->data_ptr[0]) {
                    case '2': // PING
                        ESP_LOGI(TAG, "Socket.IO PING received, sending PONG.");
                        esp_websocket_client_send_text(data->client, "3", 1, portMAX_DELAY);
                        break;
                    case '4': // MESSAGE
                        if (data->data_ptr[1] == '2') { // EVENT
                            ESP_LOGI(TAG, "Socket.IO EVENT received.");
                            handle_websocket_event_data((const char*)data->data_ptr, data->data_len);
                        }
                        break;
                }
            }
            break;
        case WEBSOCKET_EVENT_ERROR:
            ESP_LOGE(TAG, "WEBSOCKET_EVENT_ERROR");
            break;
    }
}


static void websocket_app_start(void) {
    esp_websocket_client_config_t websocket_cfg = {
        .uri = "ws://"SERVER_IP,
        .port = SERVER_PORT,
        .path = "/socket.io/?EIO=4&transport=websocket"
    };
    ESP_LOGI(TAG, "Connecting to WebSocket at %s...", websocket_cfg.uri);
    ws_client = esp_websocket_client_init(&websocket_cfg);
    esp_websocket_register_events(ws_client, WEBSOCKET_EVENT_ANY, websocket_event_handler, (void *)ws_client);
    esp_websocket_client_start(ws_client);
}

// === LOGIC GIAO TIẾP MẠNG (Không thay đổi) ===
// ... (Toàn bộ các hàm _http_event_handler và send_score_update_task giữ nguyên như cũ)
esp_err_t _http_event_handler(esp_http_client_event_t *evt) { return ESP_OK; }

static void send_score_update_task(void *arg) {
    char post_data[128];
    int local_score_a, local_score_b;

    portENTER_CRITICAL(&score_mutex);
    local_score_a = scoreA;
    local_score_b = scoreB;
    portEXIT_CRITICAL(&score_mutex);

    cJSON *root = cJSON_CreateObject();
    cJSON_AddNumberToObject(root, "score_A", local_score_a);
    cJSON_AddNumberToObject(root, "score_B", local_score_b);
    cJSON_PrintPreallocated(root, post_data, sizeof(post_data), 1);
    cJSON_Delete(root);

    esp_http_client_config_t config = { .url = SERVER_URL, .event_handler = _http_event_handler };
    esp_http_client_handle_t client = esp_http_client_init(&config);
    esp_http_client_set_method(client, HTTP_METHOD_POST);
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, post_data, strlen(post_data));

    esp_err_t err = esp_http_client_perform(client);
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "HTTP POST Status = %d", esp_http_client_get_status_code(client));
    } else {
        ESP_LOGE(TAG, "HTTP POST request failed: %s", esp_err_to_name(err));
    }

    esp_http_client_cleanup(client);
    vTaskDelete(NULL);
}


static void IRAM_ATTR gpio_isr_handler(void* arg) {
    uint32_t gpio_num = (uint32_t) arg;
    xQueueSendFromISR(gpio_evt_queue, &gpio_num, NULL);
}

static void button_handler_task(void* arg) {
    uint32_t io_num;
    for(;;) {
        if(xQueueReceive(gpio_evt_queue, &io_num, portMAX_DELAY)) {
            vTaskDelay(pdMS_TO_TICKS(50)); // Debounce
            if (gpio_get_level(io_num) == 0) {
                portENTER_CRITICAL(&score_mutex);
                
                bool local_is_swapped = is_swapped; // Đọc trạng thái swap
                
                if (io_num == BUTTON_A_PIN) { // Nút bên trái
                    if (local_is_swapped) { // Nếu đảo ngược, nút trái tăng điểm B
                        if (++scoreB > 99) scoreB = 0;
                    } else { // Mặc định, nút trái tăng điểm A
                        if (++scoreA > 99) scoreA = 0;
                    }
                } else if (io_num == BUTTON_B_PIN) { // Nút bên phải
                    if (local_is_swapped) { // Nếu đảo ngược, nút phải tăng điểm A
                        if (++scoreA > 99) scoreA = 0;
                    } else { // Mặc định, nút phải tăng điểm B
                        if (++scoreB > 99) scoreB = 0;
                    }
                }
                
                portEXIT_CRITICAL(&score_mutex);
                xTaskCreate(&send_score_update_task, "http_post_task", 4096, NULL, 5, NULL);
            }
        }
    }
}


// === TASK HIỂN THỊ LED 7 ĐOẠN (CORE 0) ===

// [MỚI] Hàm này sẽ đặt 8 chân segment theo một giá trị từ digit_map
void set_segments_from_map(uint8_t map_value) {
    // Lặp qua 7 segments (a-g), bỏ qua DP
    for(int i = 0; i < 7; i++) {
        // Nếu bit thứ i trong map_value là 1, bật segment tương ứng.
        if((map_value >> i) & 1) {
            gpio_set_level(seg_pins[i], 1);
        } else {
            gpio_set_level(seg_pins[i], 0);
        }
    }
    // Tắt DP (chân thứ 8) vì chúng ta không dùng
    gpio_set_level(seg_pins[7], 0);
}


void display_task(void *pvParameters) {
    ESP_LOGI(TAG, "Display task started on Core %d", xPortGetCoreID());

    uint8_t digits[4];
    const int display_period_ms = 15;// Tương đương 50Hz, mỗi chu kỳ quét là 20ms
    const int digit_on_time_us = 2300; // Mỗi digit sẽ sáng trong 4ms (4000us)

    TickType_t xLastWakeTime = xTaskGetTickCount();

    while (1) {
        portENTER_CRITICAL(&score_mutex);
        int localScoreA = scoreA;
        int localScoreB = scoreB;
        bool local_is_swapped = is_swapped;
        portEXIT_CRITICAL(&score_mutex);

        // [CẬP NHẬT] Logic gán điểm cho các digit dựa vào trạng thái is_swapped
        if (local_is_swapped) {
            // Hiển thị điểm B bên trái (digit 1, 2) và điểm A bên phải (digit 3, 4)
            digits[0] = localScoreB % 10;
            digits[1] = localScoreB / 10;
            digits[2] = localScoreA % 10;
            digits[3] = localScoreA / 10;
        } else {
            // Hiển thị bình thường
            digits[0] = localScoreA % 10;
            digits[1] = localScoreA / 10;
            digits[2] = localScoreB % 10;
            digits[3] = localScoreB / 10;
        }


        // Vòng lặp quét 4 LED
        for (int i = 0; i < 4; i++) {
            // 1. TẮT DIGIT CŨ (quan trọng)
            // Lệnh này đảm bảo digit từ vòng lặp trước đã tắt
            for(int j = 0; j < 4; j++){
                if(j!=i)gpio_set_level(digit_pins[j], 0);
            }
             
            // 3. ĐẶT DỮ LIỆU SEGMENT MỚI
            set_segments_from_map(digit_map[digits[i]]);

            // 4. BẬT DIGIT MỚI
            gpio_set_level(digit_pins[i], 1);

            // 5. GIỮ SÁNG
            taskYIELD();
            esp_rom_delay_us(digit_on_time_us);
            taskYIELD();

        }
        
        // 6. ĐỢI CHO ĐẾN CHU KỲ TIẾP THEO
        // Luôn đảm bảo toàn bộ vòng lặp (cả 4 digit) diễn ra trong 20ms
        vTaskDelayUntil(&xLastWakeTime, pdMS_TO_TICKS(display_period_ms));
    }
}


// [MỚI] Hàm xử lý sự kiện WiFi
static void wifi_event_handler(void* arg, esp_event_base_t event_base,
                                int32_t event_id, void* event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        if (s_retry_num < WIFI_MAXIMUM_RETRY) {
            esp_wifi_connect();
            s_retry_num++;
            ESP_LOGI(TAG, "retry to connect to the AP");
        } else {
            xEventGroupSetBits(s_wifi_event_group, WIFI_FAIL_BIT); // Gửi tín hiệu thất bại
        }
        ESP_LOGI(TAG,"connect to the AP fail");
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        ESP_LOGI(TAG, "got ip:" IPSTR, IP2STR(&event->ip_info.ip));
        s_retry_num = 0;
        xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT); // Gửi tín hiệu thành công
    }
}

void wifi_init_sta(void)
{
    s_wifi_event_group = xEventGroupCreate();

    // Chỉ tạo instance WiFi STA. Hàm init hệ thống đã được gọi ở app_main
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    // Đăng ký event handler
    esp_event_handler_instance_t instance_any_id;
    esp_event_handler_instance_t instance_got_ip;
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL, &instance_any_id));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL, &instance_got_ip));

    // Cấu hình và khởi động WiFi
    wifi_config_t wifi_config = { .sta = {}, };
    strcpy((char *)wifi_config.sta.ssid, WIFI_SSID);
    strcpy((char *)wifi_config.sta.password, WIFI_PASSWORD);

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "wifi_init_sta finished, waiting for connection...");

    // Đợi tín hiệu kết nối thành công hoặc thất bại
    EventBits_t bits = xEventGroupWaitBits(s_wifi_event_group,
            WIFI_CONNECTED_BIT | WIFI_FAIL_BIT,
            pdFALSE, pdFALSE, portMAX_DELAY);

    if (bits & WIFI_CONNECTED_BIT) {
        ESP_LOGI(TAG, "connected to ap SSID:%s", WIFI_SSID);
    } else if (bits & WIFI_FAIL_BIT) {
        ESP_LOGE(TAG, "Failed to connect to SSID:%s", WIFI_SSID);
    } else {
        ESP_LOGE(TAG, "UNEXPECTED EVENT");
    }
}







// === HÀM KHỞI TẠO CHÍNH ===
// main.c

// ... (các hàm khác không đổi)

// main.c

void app_main(void)
{
    // === BƯỚC 1: KHỞI TẠO CÁC DỊCH VỤ NỀN CỦA HỆ THỐNG ===
    // Khởi tạo Non-Volatile Storage (NVS) để lưu trữ cấu hình WiFi
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
      ESP_ERROR_CHECK(nvs_flash_erase());
      ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);
    
    // Khởi tạo TCP/IP stack và event loop một lần duy nhất tại đây
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    // === BƯỚC 2: KHỞI TẠO DỊCH VỤ WIFI VÀ ĐỢI KẾT NỐI ===
    // Hàm này sẽ tạm dừng cho đến khi kết nối WiFi thành công hoặc thất bại
    wifi_init_sta();

    // === BƯỚC 3: SAU KHI WIFI ĐÃ SẴN SÀNG, KHỞI TẠO GPIO VÀ CÁC TASK ===
    ESP_LOGI(TAG, "WiFi Connected. Initializing GPIO and application tasks...");
    
    // Cấu hình chân output cho các segment và digit của LED
    uint64_t output_pin_bitmask = 0;
    for(int i = 0; i < 8; i++) output_pin_bitmask |= (1ULL << seg_pins[i]);
    for(int i = 0; i < 4; i++) output_pin_bitmask |= (1ULL << digit_pins[i]);

    gpio_config_t io_conf = {};
    io_conf.intr_type = GPIO_INTR_DISABLE;
    io_conf.mode = GPIO_MODE_OUTPUT;
    io_conf.pin_bit_mask = output_pin_bitmask;
    io_conf.pull_down_en = 0;
    io_conf.pull_up_en = 0;
    gpio_config(&io_conf);
    
    // Cấu hình chân input cho nút bấm và cài đặt ngắt
    io_conf.intr_type = GPIO_INTR_NEGEDGE;
    io_conf.pin_bit_mask = (1ULL << BUTTON_A_PIN) | (1ULL << BUTTON_B_PIN);
    io_conf.mode = GPIO_MODE_INPUT;
    io_conf.pull_up_en = 1;
    gpio_config(&io_conf);

    // Tạo hàng đợi và dịch vụ xử lý ngắt
    gpio_evt_queue = xQueueCreate(10, sizeof(uint32_t));
    gpio_install_isr_service(0);
    gpio_isr_handler_add(BUTTON_A_PIN, gpio_isr_handler, (void*) BUTTON_A_PIN);
    gpio_isr_handler_add(BUTTON_B_PIN, gpio_isr_handler, (void*) BUTTON_B_PIN);



    // === BƯỚC 4: KHỞI TẠO WEBSOCKET CLIENT ===
    ESP_LOGI(TAG, "WiFi Connected. Starting WebSocket client...");
    websocket_app_start();

    // === BƯỚC 5: GỬI REQUEST "ĐĂNG KÝ" BAN ĐẦU ===
    ESP_LOGI(TAG, "Sending initial registration POST request...");
    xTaskCreate(&send_score_update_task, "http_post_task", 4096, NULL, 5, NULL);

    // === BƯỚC 6: KHỞI TẠO CÁC TASK CỦA ỨNG DỤNG ===
    ESP_LOGI(TAG, "Starting application tasks...");
    xTaskCreate(button_handler_task, "button_handler", 2048, NULL, 10, NULL);
    xTaskCreatePinnedToCore(display_task, "display_task", 4096, NULL, 1, NULL, 0);
    
    ESP_LOGI(TAG, "Initialization complete. System is running.");
}



