// Copyright (C) 2026 Chijok <chijok2311@outlook.com>
// SPDX-License-Identifier: GPL-3.0-only

type NativeDevice = {
  id: string
  name: string
  model: string
  address: string
  instanceId: string
  connected: boolean
  codec: string
  channelMode: string
  samplingFrequency: string
  liveChannelMode: string
  liveSamplingFrequency: string
  bitrate: number
  delay: number
  quality: number
  supports: string[]
  volume: number
  adaptiveBitrate: boolean
  scoActive: boolean
  error: number
}

type NativeBridge = {
  getDevices: () => Promise<NativeDevice[]>
  refresh: () => Promise<NativeDevice[]>
  openBluetoothSettings: () => Promise<{ ok: boolean }>
  writeSettings: (settings: { address: string; instanceId: string; codec: string; bitrate: number; adaptiveBitrate: boolean; channelMode: string; samplingFrequency: string }) => Promise<{ ok: boolean; message?: { ok: boolean; message: string }; error?: string }>
}

declare global {
  interface Window {
    a2dp?: NativeBridge
  }
}

export {}
