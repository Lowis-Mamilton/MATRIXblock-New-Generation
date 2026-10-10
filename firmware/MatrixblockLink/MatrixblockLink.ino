/*
 * MATRIXblock Link — tethered-mode firmware for the MATRIX Mini R4.
 *
 * The MATRIXblock web app drives the board live over BLE: it sends commands
 * (motors, servos, LEDs, buzzer) and this sketch streams sensor telemetry back.
 * Protocol: docs/adr/0003-ble-protocol.md (Nordic UART Service, <= 20-byte
 * frames `[type][seq][payload...]`, little-endian).
 *
 * Board: Arduino UNO R4 WiFi core (arduino:renesas_uno:unor4wifi)
 * Libraries: MatrixMiniR4, ArduinoBLE
 */
#include <ArduinoBLE.h>
#include <MatrixMiniR4.h>
#include <Wire.h>

// ---- protocol -------------------------------------------------------------
const uint8_t PROTOCOL_VERSION = 1;
const uint8_t FW_MAJOR = 1, FW_MINOR = 0, FW_PATCH = 0;

enum Cmd : uint8_t {
  CMD_HELLO = 0x01,
  CMD_HEARTBEAT = 0x02,
  CMD_MOTOR_RUN = 0x10,
  CMD_MOTOR_RUN_DEG = 0x11,
  CMD_MOTOR_STOP = 0x13,
  CMD_MOTOR_RESET = 0x14,
  CMD_SERVO = 0x20,
  CMD_LED = 0x21,
  CMD_TONE = 0x22,
  CMD_NO_TONE = 0x23,
  CMD_HALT = 0x2F,
};

enum Msg : uint8_t {
  MSG_T_MOTORS = 0x80,
  MSG_T_IMU = 0x81,
  MSG_T_PORTS = 0x82,
  MSG_DONE = 0x90,
  MSG_INFO = 0x91,
};

const uint8_t MAX_FRAME = 20;
const unsigned long WATCHDOG_MS = 1000;
const unsigned long MOTORS_EVERY_MS = 50;
const unsigned long IMU_EVERY_MS = 100;
const unsigned long PORTS_EVERY_MS = 200;
const unsigned long SCAN_EVERY_MS = 2000;
/** Measured on a TT motor: about 7.6 degrees per second per 1% speed. */
const float DEG_PER_SEC_PER_PERCENT = 7.6;

BLEService nus("6E400001-B5A3-F393-E0A9-E50E24DCCA9E");
BLECharacteristic rxChar("6E400002-B5A3-F393-E0A9-E50E24DCCA9E", BLEWrite | BLEWriteWithoutResponse, MAX_FRAME);
BLECharacteristic txChar("6E400003-B5A3-F393-E0A9-E50E24DCCA9E", BLENotify, MAX_FRAME);

String boardName = "MXR4";
bool connected = false;
unsigned long lastRxMs = 0;
bool watchdogTripped = false;

// A degree move waiting for the board to report it finished.
struct PendingRotate {
  bool active;
  uint8_t seq;
  unsigned long startedMs;
  /** Give up (stalled or unplugged motor) and report DONE at this time. */
  unsigned long deadlineMs;
};
PendingRotate pending[4];

// ---- I2C sensor ports -----------------------------------------------------
enum PortKind : uint8_t { PORT_NONE = 0, PORT_COLOR = 1, PORT_DISTANCE = 2 };
enum Variant : uint8_t { V_NONE, V_COLOR1, V_COLOR3, V_LASER1, V_LASER2 };

struct Port {
  Variant variant;
  uint16_t value;   // colour code or distance in mm
};
Port ports[4];

const uint8_t MUX_ADDR = 0x70;
const uint8_t COLOR1_ADDR = 0x22;
const uint8_t LASER1_ADDR = 0x26;
const uint8_t SHARED_ADDR = 0x29;   // MXColorV3 (TCS34725) and MXLaserV2 (VL53L0X)

// ---- small helpers --------------------------------------------------------
void put16(uint8_t* b, int16_t v) { b[0] = v & 0xFF; b[1] = (v >> 8) & 0xFF; }
void putU16(uint8_t* b, uint16_t v) { b[0] = v & 0xFF; b[1] = v >> 8; }
void put32(uint8_t* b, int32_t v) { for (int i = 0; i < 4; i++) b[i] = (v >> (8 * i)) & 0xFF; }
uint16_t getU16(const uint8_t* b) { return b[0] | (b[1] << 8); }
uint32_t getU32(const uint8_t* b) { return b[0] | (b[1] << 8) | ((uint32_t)b[2] << 16) | ((uint32_t)b[3] << 24); }
int16_t clamp16(double v) { return v > 32767 ? 32767 : v < -32768 ? -32768 : (int16_t)v; }

void send(const uint8_t* frame, uint8_t len) {
  if (connected && txChar.subscribed()) txChar.writeValue(frame, len);
}

void sendDone(uint8_t seq) {
  uint8_t f[3] = {MSG_DONE, 0, seq};
  send(f, 3);
}

void showStatus(const char* status) {
  MiniR4.OLED.clearDisplay();
  MiniR4.OLED.setTextSize(2);
  MiniR4.OLED.setCursor(0, 0);
  MiniR4.OLED.print(boardName);
  MiniR4.OLED.setTextSize(1);
  MiniR4.OLED.setCursor(0, 22);
  MiniR4.OLED.print(status);
  MiniR4.OLED.display();
}

// ---- actuators ------------------------------------------------------------
void finishPending(uint8_t i) {
  if (pending[i].active) {
    pending[i].active = false;
    sendDone(pending[i].seq);
  }
}

void haltAll() {
  mmL.SetALLDCBrake();
  for (uint8_t i = 0; i < 4; i++) finishPending(i);
  MiniR4.Buzzer.NoTone();
}

bool validPort(uint8_t p) { return p >= 1 && p <= 4; }

void handleFrame(const uint8_t* f, int len) {
  if (len < 2) return;
  const uint8_t type = f[0], seq = f[1];
  const uint8_t* p = f + 2;
  const int n = len - 2;

  switch (type) {
    case CMD_HELLO: {
      uint8_t info[6] = {MSG_INFO, 0, PROTOCOL_VERSION, FW_MAJOR, FW_MINOR, FW_PATCH};
      send(info, 6);
      break;
    }
    case CMD_HEARTBEAT:
      break;
    case CMD_MOTOR_RUN:
      if (n >= 2 && validPort(p[0])) {
        finishPending(p[0] - 1);
        mmL.SetDCMotorSpeed(p[0], (int8_t)p[1]);
      }
      break;
    case CMD_MOTOR_RUN_DEG:
      if (n >= 6 && validPort(p[0])) {
        const uint8_t i = p[0] - 1;
        finishPending(i);
        const int8_t speed = (int8_t)p[1];
        uint32_t degrees = getU32(p + 2);
        if (degrees > 65535) degrees = 65535;
        if (speed == 0 || degrees == 0) {
          sendDone(seq);
        } else {
          mmL.SetDCMotorRotate(p[0], speed, (uint16_t)degrees);
          const unsigned long expected = degrees * 1000UL / (unsigned long)(abs(speed) * DEG_PER_SEC_PER_PERCENT);
          pending[i] = {true, seq, millis(), millis() + expected * 2 + 1500};
        }
      }
      break;
    case CMD_MOTOR_STOP:
      if (n >= 2 && validPort(p[0])) {
        finishPending(p[0] - 1);
        if (p[1] == 1) mmL.SetDCMotorPower(p[0], 0);   // coast
        else mmL.SetDCBrake(p[0]);                     // brake
      }
      break;
    case CMD_MOTOR_RESET:
      if (n >= 1 && validPort(p[0])) mmL.SetEncoderResetCounter(p[0]);
      break;
    case CMD_SERVO:
      if (n >= 2 && validPort(p[0])) mmL.SetServoAngle(p[0], p[1] > 180 ? 180 : p[1]);
      break;
    case CMD_LED:
      if (n >= 4) {
        if (p[0] & 1) MiniR4.LED.setColor(1, p[1], p[2], p[3]);
        if (p[0] & 2) MiniR4.LED.setColor(2, p[1], p[2], p[3]);
      }
      break;
    case CMD_TONE:
      if (n >= 4) MiniR4.Buzzer.Tone(getU16(p), getU16(p + 2));
      break;
    case CMD_NO_TONE:
      MiniR4.Buzzer.NoTone();
      break;
    case CMD_HALT:
      haltAll();
      break;
  }
}

// ---- BLE events -----------------------------------------------------------
void onRx(BLEDevice, BLECharacteristic c) {
  lastRxMs = millis();
  watchdogTripped = false;
  handleFrame(c.value(), c.valueLength());
}

void onConnect(BLEDevice central) {
  Serial.print(F("[MatrixblockLink] connected: "));
  Serial.println(central.address());
  connected = true;
  lastRxMs = millis();
  watchdogTripped = false;
  // Blink green so students can see which board they connected to.
  for (uint8_t k = 0; k < 2; k++) {
    MiniR4.LED.setColor(1, 0, 255, 0);
    MiniR4.LED.setColor(2, 0, 255, 0);
    delay(120);
    MiniR4.LED.setColor(1, 0, 0, 0);
    MiniR4.LED.setColor(2, 0, 0, 0);
    delay(120);
  }
  showStatus("Connected");
}

void onDisconnect(BLEDevice) {
  Serial.println(F("[MatrixblockLink] disconnected"));
  connected = false;
  haltAll();
  MiniR4.LED.setColor(1, 0, 0, 0);
  MiniR4.LED.setColor(2, 0, 0, 0);
  showStatus("Waiting for app...");
  BLE.advertise();
}

// ---- sensor ports ---------------------------------------------------------
void muxSelect(uint8_t ch) {
  Wire1.beginTransmission(MUX_ADDR);
  Wire1.write(1 << ch);
  Wire1.endTransmission();
  delayMicroseconds(800);
}

bool present(uint8_t addr) {
  Wire1.beginTransmission(addr);
  return Wire1.endTransmission() == 0;
}

uint8_t readReg8(uint8_t addr, uint8_t reg) {
  Wire1.beginTransmission(addr);
  Wire1.write(reg);
  if (Wire1.endTransmission(false) != 0) return 0;
  if (Wire1.requestFrom(addr, (uint8_t)1) != 1) return 0;
  return Wire1.read();
}

/** Library sensor objects for port index 0..3 (I2C1..I2C4). */
MatrixColor* color1(uint8_t i) {
  switch (i) { case 0: return &MiniR4.I2C1.MXColor; case 1: return &MiniR4.I2C2.MXColor; case 2: return &MiniR4.I2C3.MXColor; default: return &MiniR4.I2C4.MXColor; }
}
MatrixColorV3* color3(uint8_t i) {
  switch (i) { case 0: return &MiniR4.I2C1.MXColorV3; case 1: return &MiniR4.I2C2.MXColorV3; case 2: return &MiniR4.I2C3.MXColorV3; default: return &MiniR4.I2C4.MXColorV3; }
}
MatrixLaser* laser1(uint8_t i) {
  switch (i) { case 0: return &MiniR4.I2C1.MXLaser; case 1: return &MiniR4.I2C2.MXLaser; case 2: return &MiniR4.I2C3.MXLaser; default: return &MiniR4.I2C4.MXLaser; }
}
MatrixLaserV2* laser2(uint8_t i) {
  switch (i) { case 0: return &MiniR4.I2C1.MXLaserV2; case 1: return &MiniR4.I2C2.MXLaserV2; case 2: return &MiniR4.I2C3.MXLaserV2; default: return &MiniR4.I2C4.MXLaserV2; }
}

/** Which sensor answers on this port (cheap address probe, no init). */
Variant probe(uint8_t i) {
  muxSelect(i);
  if (present(COLOR1_ADDR)) return V_COLOR1;
  if (present(LASER1_ADDR)) return V_LASER1;
  if (present(SHARED_ADDR)) {
    // VL53L0X identifies itself with 0xEE at register 0xC0.
    return readReg8(SHARED_ADDR, 0xC0) == 0xEE ? V_LASER2 : V_COLOR3;
  }
  return V_NONE;
}

bool initSensor(uint8_t i, Variant v) {
  switch (v) {
    case V_COLOR1: return color1(i)->begin();
    case V_COLOR3: return color3(i)->begin();
    case V_LASER1: return laser1(i)->begin();
    case V_LASER2: return laser2(i)->begin();
    default: return false;
  }
}

/** Detect plugged / unplugged sensors. */
void scanPorts() {
  for (uint8_t i = 0; i < 4; i++) {
    Variant v = probe(i);
    if (v == ports[i].variant) continue;
    ports[i].variant = (v != V_NONE && initSensor(i, v)) ? v : V_NONE;
    ports[i].value = 0;
  }
}

/** Library colour IDs -> wire codes (0 none, 1 black, 2 white, 3 red, 4 yellow, 5 green, 6 blue). */
uint8_t colorCode(int8_t id) {
  switch (id) {
    case COLOR_BLACK: return 1;
    case COLOR_WHITE: return 2;
    case COLOR_RED: return 3;
    case COLOR_YELLOW: return 4;
    case COLOR_GREEN: return 5;
    case COLOR_BLUE:
    case COLOR_LIGHTBLUE:
    case COLOR_VIOLET: return 6;
    default: return 0;
  }
}

void readPorts() {
  for (uint8_t i = 0; i < 4; i++) {
    switch (ports[i].variant) {
      case V_COLOR1: ports[i].value = colorCode(color1(i)->getColorID()); break;
      case V_COLOR3: ports[i].value = colorCode(color3(i)->getColorID()); break;
      case V_LASER1: ports[i].value = laser1(i)->getDistance(); break;
      case V_LASER2: ports[i].value = laser2(i)->getDistance(); break;
      default: ports[i].value = 0;
    }
  }
}

PortKind kindOf(Variant v) {
  switch (v) {
    case V_COLOR1:
    case V_COLOR3: return PORT_COLOR;
    case V_LASER1:
    case V_LASER2: return PORT_DISTANCE;
    default: return PORT_NONE;
  }
}

// ---- telemetry ------------------------------------------------------------
/*
 * Every call to the STM32 takes ~5 ms over a 57600-baud software serial link,
 * so readings are taken one per loop() pass, round robin, keeping BLE.poll()
 * responsive. Frames are sent from the cached values.
 */
uint8_t battery = 0;
int32_t encoders[4] = {0, 0, 0, 0};
bool buttonUp = false, buttonDown = false;
double roll = 0, pitch = 0, yaw = 0;

enum ReadStep : uint8_t { R_ENC1, R_ENC2, R_ENC3, R_ENC4, R_BTN_UP, R_BTN_DOWN, R_IMU, R_ROTATE, R_COUNT };
uint8_t readStep = 0;
uint8_t rotateCursor = 0;

/** Check one pending degree move per call. */
void pollOneRotation() {
  for (uint8_t k = 0; k < 4; k++) {
    const uint8_t i = (rotateCursor + k) % 4;
    if (!pending[i].active || millis() - pending[i].startedMs < 50) continue;
    rotateCursor = (i + 1) % 4;
    bool ended = false;
    if (mmL.GetRotateState(i + 1, ended) == MMLower::RESULT::OK && ended) finishPending(i);
    return;
  }
}

void readNext() {
  switch (readStep) {
    case R_ENC1:
    case R_ENC2:
    case R_ENC3:
    case R_ENC4: {
      int32_t deg = 0;
      if (mmL.GetEncoderDegrees(readStep - R_ENC1 + 1, deg) == MMLower::RESULT::OK) encoders[readStep - R_ENC1] = deg;
      break;
    }
    case R_BTN_UP: mmL.GetButtonState(2, buttonUp); break;     // BTN_UP is button 2
    case R_BTN_DOWN: mmL.GetButtonState(1, buttonDown); break; // BTN_DOWN is button 1
    case R_IMU: mmL.GetIMUEuler(roll, pitch, yaw); break;
    case R_ROTATE: pollOneRotation(); break;
  }
  readStep = (readStep + 1) % R_COUNT;
}

/** Stalled or unplugged motors never report "rotation ended": give up on time. */
void checkRotateDeadlines() {
  for (uint8_t i = 0; i < 4; i++) {
    if (pending[i].active && (long)(millis() - pending[i].deadlineMs) > 0) {
      mmL.SetDCBrake(i + 1);
      finishPending(i);
    }
  }
}

void sendMotors() {
  uint8_t f[20] = {MSG_T_MOTORS, 0};
  uint8_t busy = 0;
  for (uint8_t i = 0; i < 4; i++) {
    put32(f + 2 + i * 4, encoders[i]);
    if (pending[i].active) busy |= 1 << i;
  }
  f[18] = busy;
  f[19] = (buttonUp ? 1 : 0) | (buttonDown ? 2 : 0);
  send(f, 20);
}

void sendImu() {
  uint8_t f[9] = {MSG_T_IMU, 0};
  put16(f + 2, clamp16(pitch * 100));
  put16(f + 4, clamp16(roll * 100));
  put16(f + 6, clamp16(yaw * 100));
  f[8] = battery;
  send(f, 9);
}

void sendPorts() {
  readPorts();
  uint8_t f[14] = {MSG_T_PORTS, 0};
  for (uint8_t i = 0; i < 4; i++) {
    f[2 + i * 3] = kindOf(ports[i].variant);
    putU16(f + 3 + i * 3, ports[i].value);
  }
  send(f, 14);
}

// ---- main -----------------------------------------------------------------
void setup() {
  // Diagnostics on the USB serial port (115200 baud); harmless when nobody listens.
  Serial.begin(115200);
  Serial.println(F("[MatrixblockLink] starting"));
  MiniR4.begin();
  Serial.println(F("[MatrixblockLink] MiniR4 ready"));

  if (!BLE.begin()) {
    Serial.println(F("[MatrixblockLink] BLE.begin() failed"));
    boardName = "BLE ERROR";
    showStatus("Update the WiFi/BLE bridge");
    while (true) delay(1000);
  }

  // Name the board after the end of its address so a classroom can tell boards apart.
  String addr = BLE.address();   // "aa:bb:cc:dd:ee:ff"
  addr.toUpperCase();
  boardName = "MXR4-" + addr.substring(12, 14) + addr.substring(15, 17);

  BLE.setLocalName(boardName.c_str());
  BLE.setDeviceName(boardName.c_str());
  BLE.setAdvertisedService(nus);
  nus.addCharacteristic(rxChar);
  nus.addCharacteristic(txChar);
  BLE.addService(nus);
  rxChar.setEventHandler(BLEWritten, onRx);
  BLE.setEventHandler(BLEConnected, onConnect);
  BLE.setEventHandler(BLEDisconnected, onDisconnect);
  BLE.advertise();

  scanPorts();
  showStatus("Waiting for app...");
  Serial.print(F("[MatrixblockLink] advertising as "));
  Serial.println(boardName);
  for (uint8_t i = 0; i < 4; i++) {
    Serial.print(F("  I2C"));
    Serial.print(i + 1);
    Serial.print(F(": "));
    Serial.println(kindOf(ports[i].variant) == PORT_COLOR ? F("colour") : kindOf(ports[i].variant) == PORT_DISTANCE ? F("distance") : F("-"));
  }
}

void loop() {
  static unsigned long lastMotors = 0, lastImu = 0, lastPorts = 0, lastScan = 0, lastBattery = 0;
  BLE.poll();
  const unsigned long now = millis();

  if (connected && !watchdogTripped && now - lastRxMs > WATCHDOG_MS) {
    // The app went quiet (radio trouble, tab closed): stop before the robot runs away.
    Serial.println(F("[MatrixblockLink] watchdog: no frames for 1 s, stopping"));
    haltAll();
    watchdogTripped = true;
  }

  checkRotateDeadlines();
  if (now - lastScan >= SCAN_EVERY_MS) {
    lastScan = now;
    scanPorts();
  }
  if (now - lastBattery >= 1000) {
    lastBattery = now;
    float volt = 0, perc = 0;
    if (mmL.GetPowerInfo(volt, perc) == MMLower::RESULT::OK) battery = perc < 0 ? 0 : perc > 100 ? 100 : (uint8_t)perc;
  }
  if (!connected) return;

  readNext();
  if (now - lastMotors >= MOTORS_EVERY_MS) {
    lastMotors = now;
    sendMotors();
  }
  if (now - lastImu >= IMU_EVERY_MS) {
    lastImu = now;
    sendImu();
  }
  if (now - lastPorts >= PORTS_EVERY_MS) {
    lastPorts = now;
    sendPorts();
  }
}
