// Copyright (C) 2026 Chijok <chijok2311@outlook.com>
// SPDX-License-Identifier: GPL-3.0-only

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('a2dp', {
  getDevices: () => ipcRenderer.invoke('a2dp:get-devices'),
  writeSettings: (settings) => ipcRenderer.invoke('a2dp:write-settings', settings),
  refresh: () => ipcRenderer.invoke('a2dp:get-devices'),
  openBluetoothSettings: () => ipcRenderer.invoke('a2dp:open-bluetooth-settings'),
})
