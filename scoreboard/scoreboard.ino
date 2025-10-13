// ===== CODE ĐÃ SỬA LỖI HOÀN CHỈNH CHO ARDUINO NANO =====

// --- PHẦN CẤU HÌNH PIN VÀ HIỂN THỊ ---

// Chân điều khiển segment (a-g, dp). Thứ tự: a, b, c, d, e, f, g, dp
const int seg_pins[] = {9, 8, 3, 4, 2, 5, 6, 7};

// Chân điều khiển Anode cho các LED (Digit 1, 2, 3, 4)
const int digit_pins[] = {11, 12, A2, A3};

// Logic điều khiển (KHÔNG ĐỔI)
const int DIGIT_ON = HIGH;
const int DIGIT_OFF = LOW;
const int SEGMENT_ON = HIGH;
const int SEGMENT_OFF = LOW;

// Bảng mã cho LED 7 đoạn (gfedcba). Bit 7 là DP.
const byte digit_map[10] = {
  B00111111, // 0
  B00000110, // 1  <-- BẠN ĐÃ THIẾU SỐ NÀY
  B01011011, // 2
  B01001111, // 3
  B01100110, // 4
  B01101101, // 5
  B01111101, // 6
  B00000111, // 7
  B01111111, // 8
  B01101111  // 9
};

// --- BIẾN TOÀN CỤC ---
volatile int scoreA = 0;
volatile int scoreB = 0;
volatile bool is_swapped = false;

// Buffer để đọc dữ liệu từ UART một cách an toàn, không làm gián đoạn việc quét LED
char serialBuffer[20];
byte bufferIndex = 0;

void setup() {
  // Cấu hình các chân segment và digit là OUTPUT
  for (int i = 0; i < 8; i++) pinMode(seg_pins[i], OUTPUT);
  for (int i = 0; i < 4; i++) pinMode(digit_pins[i], OUTPUT);

  // Tắt tất cả các digit và segment ban đầu
  for (int i = 0; i < 4; i++) digitalWrite(digit_pins[i], DIGIT_OFF);
  for (int i = 0; i < 8; i++) digitalWrite(seg_pins[i], SEGMENT_OFF);
  
  Serial.begin(9600); // Khởi động cổng UART để nhận dữ liệu từ ESP8266
}

void setSegments(byte number) {
  if (number > 9) return; // Chỉ hiển thị số từ 0-9
  byte pattern = digit_map[number];
  for (int i = 0; i < 7; i++) { // Lặp qua 7 đoạn
    if ((pattern >> i) & 1) {
      digitalWrite(seg_pins[i], SEGMENT_ON);
    } else {
      digitalWrite(seg_pins[i], SEGMENT_OFF);
    }
  }
  digitalWrite(seg_pins[7], SEGMENT_OFF); // Luôn tắt dấu chấm
}

void displayScores() {
  byte digits[4];

  // Logic chia số vẫn giữ nguyên
  if (is_swapped) {
    digits[1] = (scoreB / 10) % 10; // Chữ số hàng chục của team B
    digits[0] = scoreB % 10;        // Chữ số hàng đơn vị của team B
    digits[3] = (scoreA / 10) % 10; // Chữ số hàng chục của team A
    digits[2] = scoreA % 10;        // Chữ số hàng đơn vị của team A
  } else {
    digits[1] = (scoreA / 10) % 10; // Chữ số hàng chục của team A
    digits[0] = scoreA % 10;        // Chữ số hàng đơn vị của team A
    digits[3] = (scoreB / 10) % 10; // Chữ số hàng chục của team B
    digits[2] = scoreB % 10;        // Chữ số hàng đơn vị của team B
  }

  // Vòng lặp quét LED đã được sửa lỗi và tối ưu
  for (int i = 0; i < 4; i++) {
    // 1. TẮT TẤT CẢ CÁC DIGIT (quan trọng để chống ghosting)
    digitalWrite(digit_pins[0], DIGIT_OFF);
    digitalWrite(digit_pins[1], DIGIT_OFF);
    digitalWrite(digit_pins[2], DIGIT_OFF);
    digitalWrite(digit_pins[3], DIGIT_OFF);

    // 2. ĐẶT DỮ LIỆU SEGMENT MỚI
    setSegments(digits[i]);

    // 3. BẬT DIGIT HIỆN TẠI
    digitalWrite(digit_pins[i], DIGIT_ON);

    // 4. GIỮ SÁNG
    delay(4); // Giữ sáng 4ms -> Tần số quét ~62.5Hz, rất mượt
  }
}

void parseData(String data) {
  int firstComma = data.indexOf(',');
  int secondComma = data.indexOf(',', firstComma + 1);

  if (firstComma > 0 && secondComma > 0) {
    scoreA = data.substring(0, firstComma).toInt();
    scoreB = data.substring(firstComma + 1, secondComma).toInt();
    is_swapped = (data.substring(secondComma + 1).toInt() == 1);
  }
}

void checkForNewData() {
  while (Serial.available() > 0) {
    char receivedChar = Serial.read();

    if (receivedChar == '\n' || receivedChar == '\r') {
      if (bufferIndex > 0) {
        serialBuffer[bufferIndex] = '\0'; // Kết thúc chuỗi
        parseData(String(serialBuffer));
        bufferIndex = 0; // Reset buffer
      }
    } else {
      if (bufferIndex < 19) {
        serialBuffer[bufferIndex++] = receivedChar;
      } else {
        // Tràn buffer, reset
        bufferIndex = 0;
      }
    }
  }
}

void loop() {
  checkForNewData();
  displayScores();
}