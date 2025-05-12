const fs = require('fs');
const path = require('path');
const { remote } = require('electron');

const configPath = path.join(__dirname, '../config.json');
const form = document.getElementById('config-form');

window.onload = () => {
  const config = JSON.parse(fs.readFileSync(configPath));
  document.getElementById('ip').value = config.ip;
  document.getElementById('mac').value = config.mac;
  document.getElementById('interval').value = config.interval;
};

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const newConfig = {
    ip: document.getElementById('ip').value,
    mac: document.getElementById('mac').value,
    interval: parseInt(document.getElementById('interval').value)
  };
  fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
  remote.getCurrentWindow().close();
});
