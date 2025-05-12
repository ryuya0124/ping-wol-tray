const { app, Menu, Tray, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ping = require('ping');
const wol = require('wake_on_lan');

let tray = null;
let settingsWindow = null;
let intervalId = null;
let failCount = 0;

let config = loadConfig();

function loadConfig() {
  const configPath = path.join(__dirname, 'config.json');
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      ip: "192.168.0.0",
      mac: "AA:BB:CC:DD:EE:FF",
      interval: 30
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  return JSON.parse(fs.readFileSync(configPath));
}


function saveConfig(newConfig) {
  fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(newConfig, null, 2));
  config = newConfig;
  restartMonitoring();
}

function isNetworkConnected() {
  const interfaces = os.networkInterfaces();
  for (let name in interfaces) {
    for (let iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.168.')) {
        return true;
      }
    }
  }
  return false;
}

function startMonitoring() {
  intervalId = setInterval(() => {
    if (!isNetworkConnected()) {
      tray.displayBalloon({
        title: 'ネットワーク未接続',
        content: 'LAN接続が確認できません。'
      });
      return;
    }

    ping.sys.probe(config.ip, isAlive => {
      if (isAlive) {
        failCount = 0;
      } else {
        failCount++;
        if (failCount >= 3) {
          wol.wake(config.mac, err => {
            if (!err) {
              tray.displayBalloon({
                title: 'WoL送信',
                content: `${config.ip} にWoLを送信しました。`
              });
            }
          });
          failCount = 0;
        }
      }
    });
  }, config.interval * 1000);
}

function restartMonitoring() {
  if (intervalId) clearInterval(intervalId);
  startMonitoring();
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 400,
    height: 300,
    resizable: false,
    title: '設定',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  settingsWindow.loadFile('settings.html');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

app.whenReady().then(() => {
  tray = new Tray(path.join(__dirname, 'icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: '設定', click: createSettingsWindow },
    { type: 'separator' },
    { label: '終了', click: () => app.quit() }
  ]);
  tray.setToolTip('Ping-WoL監視中');
  tray.setContextMenu(contextMenu);

  startMonitoring();
});

app.on('window-all-closed', e => e.preventDefault()); // 終了しない
