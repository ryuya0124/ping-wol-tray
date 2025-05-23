const { app, Menu, Tray, BrowserWindow, dialog } = require('electron');
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
  const configPath = path.join(__dirname, '../config.json');
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

function watchConfigFile() {
  const configPath = path.join(__dirname, '../config.json');
  fs.watchFile(configPath, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      try {
        const updatedConfig = JSON.parse(fs.readFileSync(configPath));
        config = updatedConfig;
        restartMonitoring();
        tray.displayBalloon({
          title: '設定変更検知',
          content: '設定ファイルが変更されたため、監視を再起動しました。'
        });
      } catch (err) {
        console.error('設定ファイルの読み込みに失敗しました:', err);
      }
    }
  });
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

function InstanceCheck(){
  const gotTheLock = app.requestSingleInstanceLock();

  // false(既に起動)の場合　即終了
  if (!gotTheLock) {
    dialog.showMessageBoxSync({
      type: 'warning',
      buttons: ['OK'],
      title: '警告',
      message: 'アプリは既に起動しています。\n複数起動はできません。'
    });
    app.quit();
  }
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
  //二重起動チェック
  InstanceCheck();

  tray = new Tray(path.join(__dirname, 'icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: '設定', click: createSettingsWindow },
    { type: 'separator' },
    { label: '終了', click: () => app.quit() }
  ]);
  tray.setToolTip('Ping-WoL監視中');
  tray.setContextMenu(contextMenu);

  startMonitoring();
  watchConfigFile();
});

app.on('window-all-closed', e => e.preventDefault()); // 終了しない
