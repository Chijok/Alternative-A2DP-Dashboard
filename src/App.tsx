// Copyright (C) 2026 Chijok <chijok2311@outlook.com>
// SPDX-License-Identifier: GPL-3.0-only

import { useEffect, useRef, useState } from 'react'
import headphonesIcon from './assets/headphones.png'
import './App.css'

type Codec = 'AAC' | 'LDAC' | 'aptX HD' | 'aptX' | 'aptX LL' | 'SBC'
type SamplingFrequency = '16' | '32' | '44.1' | '48' | '88.2' | '96'
type ChannelMode = 'joint' | 'stereo' | 'dual' | 'mono'

type Device = {
  id: string
  name: string
  model: string
  address: string
  instanceId: string
  connected: boolean
  codec: Codec
  bitrate: number
  delay: number
  quality: number
  supports: Codec[]
  volume: number
  adaptiveBitrate: boolean
  channelMode: ChannelMode
  samplingFrequency: SamplingFrequency
  liveChannelMode?: ChannelMode
  liveSamplingFrequency?: SamplingFrequency
  driver: 'alternative' | 'microsoft'
}

const codecMaximumBitrates: Record<Codec, number> = {
  SBC: 328,
  AAC: 320,
  LDAC: 990,
  'aptX HD': 576,
  aptX: 352,
  'aptX LL': 352,
}

const codecSamplingFrequencies: Record<Codec, SamplingFrequency[]> = {
  SBC: ['16', '32', '44.1', '48'],
  AAC: ['44.1', '48'],
  LDAC: ['44.1', '48', '88.2', '96'],
  'aptX HD': ['44.1', '48'],
  aptX: ['44.1', '48'],
  'aptX LL': ['44.1', '48'],
}

const codecChannelModes: Record<Codec, ChannelMode[]> = {
  SBC: ['joint', 'stereo', 'dual', 'mono'],
  AAC: ['stereo', 'mono'],
  LDAC: ['stereo', 'dual', 'mono'],
  'aptX HD': ['mono', 'stereo'],
  aptX: ['mono', 'stereo'],
  'aptX LL': ['mono', 'stereo'],
}

const channelModeLabels: Record<ChannelMode, string> = { joint: 'Joint stereo', stereo: 'Stereo', dual: 'Dual channel', mono: 'Mono' }

const initialDevices: Device[] = [
  {
    id: 'airpods', name: 'My AirPods Pro', model: 'AirPods Pro (2nd gen)', address: '0000340e224a88bb', instanceId: '', connected: true,
    codec: 'AAC', bitrate: 256, delay: 150, quality: 96, supports: ['AAC', 'SBC'], volume: 72, adaptiveBitrate: false, channelMode: 'stereo', samplingFrequency: '48', driver: 'alternative',
  },
  {
    id: 'wh-1000xm5', name: 'WH-1000XM5', model: 'Sony WH-1000XM5', address: '001b10a4f2cc7719', instanceId: '', connected: true,
    codec: 'LDAC', bitrate: 990, delay: 98, quality: 89, supports: ['LDAC', 'AAC', 'SBC'], volume: 64, adaptiveBitrate: true, channelMode: 'stereo', samplingFrequency: '96', driver: 'alternative',
  },
  {
    id: 'soundcore', name: 'Soundcore Motion+', model: 'Anker Soundcore Motion+', address: '00a0c600118e4402', instanceId: '', connected: false,
    codec: 'aptX', bitrate: 352, delay: 110, quality: 0, supports: ['aptX', 'SBC'], volume: 58, adaptiveBitrate: false, channelMode: 'stereo', samplingFrequency: '48', driver: 'alternative',
  },
]

const codecDescriptions: Record<Codec, string> = {
  AAC: 'Balanced quality and compatibility',
  LDAC: 'High-resolution wireless audio',
  'aptX HD': 'Rich, detailed Bluetooth audio',
  aptX: 'Reliable low-latency audio',
  'aptX LL': 'Ultra-low-latency audio',
  SBC: 'Universal Bluetooth audio',
}

function App() {
  const [devices, setDevices] = useState(initialDevices)
  const [selectedId, setSelectedId] = useState('airpods')
  const [activeTab, setActiveTab] = useState<'audio' | 'advanced'>('audio')
  const [toast, setToast] = useState('')
  const dirtyDevices = useRef(new Set<string>())
  const selected = devices.find((device) => device.id === selectedId) ?? devices[0]

  const refreshDevices = async (silent = false) => {
    if (!window.a2dp) {
      if (!silent) setToast('Device list refreshed (preview data)')
      return
    }
    try {
      const response = await window.a2dp.refresh()
      const nativeDevices = Array.isArray(response) ? response : [response]
      if (nativeDevices.length === 0) {
        if (!silent) setToast('No AltA2DP devices found in the driver registry')
        return
      }
      const refreshedDevices = nativeDevices.map((device) => {
        const codec = device.codec as Codec
        return {
          ...device,
          codec,
          bitrate: device.adaptiveBitrate ? codecMaximumBitrates[codec] : device.bitrate,
          supports: device.supports as Codec[],
          channelMode: device.channelMode as ChannelMode,
          samplingFrequency: device.samplingFrequency as SamplingFrequency,
          liveChannelMode: device.liveChannelMode as ChannelMode,
          liveSamplingFrequency: device.liveSamplingFrequency as SamplingFrequency,
          driver: 'alternative' as const,
        }
      })
      setDevices((current) => refreshedDevices.map((device) => {
        const existing = current.find((item) => item.id === device.id)
        if (!existing) return device
        if (!dirtyDevices.current.has(device.id)) return { ...device, driver: existing.driver }
        return { ...device, codec: existing.codec, bitrate: existing.bitrate, adaptiveBitrate: existing.adaptiveBitrate, channelMode: existing.channelMode, samplingFrequency: existing.samplingFrequency, driver: existing.driver }
      }))
      if (nativeDevices.length > 0) setSelectedId((currentId) => nativeDevices.some((device) => device.id === currentId) ? currentId : nativeDevices[0].id)
      if (!silent) setToast(`${nativeDevices.length} driver device${nativeDevices.length === 1 ? '' : 's'} detected`)
    } catch (error) {
      if (!silent) setToast(error instanceof Error ? error.message : 'Could not read the driver registry')
    }
  }

  useEffect(() => {
    void refreshDevices()
    const refreshTimer = window.setInterval(() => { void refreshDevices(true) }, 3000)
    return () => window.clearInterval(refreshTimer)
  }, [])

  const updateSelected = (updates: Partial<Device>) => {
    dirtyDevices.current.add(selected.id)
    setDevices((current) => current.map((device) => device.id === selected.id ? { ...device, ...updates } : device))
  }

  const selectCodec = (codec: Codec) => {
    const frequencies = codecSamplingFrequencies[codec]
    const channelModes = codecChannelModes[codec]
    updateSelected({ codec, bitrate: selected.adaptiveBitrate ? codecMaximumBitrates[codec] : selected.bitrate, channelMode: channelModes.includes(selected.channelMode) ? selected.channelMode : channelModes[0], samplingFrequency: frequencies.includes(selected.samplingFrequency) ? selected.samplingFrequency : frequencies[frequencies.length - 1] })
  }

  const setAdaptiveBitrate = (enabled: boolean) => {
    updateSelected({ adaptiveBitrate: enabled, bitrate: enabled ? codecMaximumBitrates[selected.codec] : selected.bitrate })
  }

  const applySettings = async () => {
    if (!window.a2dp) {
      setToast('Preview only: run the Electron app to write registry settings')
      return
    }
    setToast('Writing Next settings and reconnecting device...')
    const result = await window.a2dp.writeSettings({ address: selected.address, instanceId: selected.instanceId, codec: selected.codec, bitrate: selected.bitrate, adaptiveBitrate: selected.adaptiveBitrate, channelMode: selected.channelMode, samplingFrequency: selected.samplingFrequency })
    if (result.ok) {
      dirtyDevices.current.delete(selected.id)
      setToast(result.message?.message ?? 'Settings applied')
      window.setTimeout(() => { void refreshDevices() }, 1800)
    } else setToast(result.error ?? 'Could not apply settings')
  }

  const pairDevice = async () => {
    if (window.a2dp) {
      await window.a2dp.openBluetoothSettings()
      setToast('Bluetooth settings opened. Choose Add device to pair your headphones.')
    } else setToast('Open Windows Bluetooth settings to pair a device')
  }

  const changeDriver = (nextDriver: 'alternative' | 'microsoft') => {
    updateSelected({ driver: nextDriver })
    setToast(nextDriver === 'alternative'
      ? 'Alternative A2DP Driver selected'
      : 'Microsoft Bluetooth A2DP Driver selected. Restart the device to switch drivers.')
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><img src={headphonesIcon} alt="A2DP Dashboard" /></div><div><strong>Alternative</strong><span>A2DP Driver</span></div></div>
        <div className="sidebar-heading"><span>MY DEVICES</span><button className="icon-button" title="Refresh devices" onClick={() => void refreshDevices()}>↻</button></div>
        <div className="device-list">
          {devices.map((device) => <button className={`device-card ${device.id === selected.id ? 'selected' : ''}`} key={device.id} onClick={() => setSelectedId(device.id)}>
            <div className={`device-icon ${device.connected ? 'online' : ''}`}>◖</div>
            <div className="device-copy"><strong>{device.name}</strong><span>{device.connected ? `Connected · ${device.codec}` : 'Disconnected'}</span></div>
            <span className={`status-dot ${device.connected ? 'connected' : ''}`} />
          </button>)}
        </div>
        <button className="add-device" onClick={() => void pairDevice()}><span>＋</span> Pair new device</button>
        <div className="sidebar-footer"><div className="driver-status"><span className="status-dot connected" /><div><strong>Driver active</strong><span>AltA2dpSVC.exe</span></div></div><button className="settings-button" title="Driver settings">⚙</button></div>
      </aside>

      <section className="workspace">
        <header className="topbar"><div className="breadcrumbs"><span>DEVICES</span><b>/</b><strong>{selected.name}</strong></div><div className="admin-pill"><span>●</span> Administrator mode</div></header>
        <div className="content">
          <div className="device-header"><div><div className="eyebrow"><span className={`status-dot ${selected.connected ? 'connected' : ''}`} /> {selected.connected ? 'CONNECTED' : 'DISCONNECTED'}</div><h1>{selected.name}</h1><p>{selected.model} <span>·</span> {selected.address}</p></div><div className="header-actions"><button className="quiet-button" onClick={() => setToast('Connection diagnostics are healthy')}>Run diagnostics</button><button className="apply-button" onClick={applySettings}>Apply changes <span>→</span></button></div></div>
          <div className="tabs"><button className={activeTab === 'audio' ? 'active' : ''} onClick={() => setActiveTab('audio')}>Audio profile</button><button className={activeTab === 'advanced' ? 'active' : ''} onClick={() => setActiveTab('advanced')}>Advanced</button></div>
          {activeTab === 'audio' ? <>
            <section className="section-block codec-section"><div className="section-title"><div><h2>Codec</h2><p>Select the codec used on the next connection.</p></div><span className="capability-tag">Capability detected</span></div><div className="codec-grid">{selected.supports.map((codec) => <button className={`codec-option ${selected.codec === codec ? 'active' : ''}`} key={codec} onClick={() => selectCodec(codec)}><span className={`codec-badge ${codec.toLowerCase().replace(' ', '-')}`}>{codec === 'LDAC' ? 'LD' : codec === 'AAC' ? 'AA' : codec === 'SBC' ? 'SB' : 'AP'}</span><span><strong>{codec}</strong><small>{codecDescriptions[codec]}</small></span>{selected.codec === codec && <span className="check">✓</span>}</button>)}</div></section>
            <section className="section-block settings-section"><div className="section-title"><div><h2>{selected.codec} settings</h2><p>Fine-tune how {selected.name} receives audio.</p></div><span className="next-label">NEXT CONNECTION</span></div><div className="driver-picker profile-driver"><label htmlFor="driver-select">Device Driver</label><select id="driver-select" value={selected.driver} onChange={(event) => changeDriver(event.target.value as 'alternative' | 'microsoft')}><option value="alternative">Alternative A2DP Driver</option><option value="microsoft">Microsoft Bluetooth A2DP Driver</option></select></div><div className="control-grid"><label className="field"><span>Channel mode</span><select value={selected.channelMode} onChange={(event) => updateSelected({ channelMode: event.target.value as ChannelMode })}>{codecChannelModes[selected.codec].map((mode) => <option value={mode} key={mode}>{channelModeLabels[mode]}</option>)}</select></label><label className="field"><span>Sampling frequency</span><select value={selected.samplingFrequency} onChange={(event) => updateSelected({ samplingFrequency: event.target.value as SamplingFrequency })}>{codecSamplingFrequencies[selected.codec].map((frequency) => <option value={frequency} key={frequency}>{frequency} kHz</option>)}</select></label><div className={`slider-field ${selected.adaptiveBitrate ? 'locked' : ''}`}><div><span>Target bitrate</span><strong>{selected.bitrate} kbps{selected.adaptiveBitrate ? ' · MAX' : ''}</strong></div><input type="range" min="128" max={codecMaximumBitrates[selected.codec]} step="1" value={Math.min(selected.bitrate, codecMaximumBitrates[selected.codec])} disabled={selected.adaptiveBitrate} onChange={(event) => updateSelected({ bitrate: Number(event.target.value) })}/><div className="range-labels"><span>128 kbps</span><span>{codecMaximumBitrates[selected.codec]} kbps</span></div></div><label className="toggle-row"><span><strong>Adaptive bitrate</strong><small>Locks bitrate at {codecMaximumBitrates[selected.codec]} kbps and lets the driver manage stability</small></span><input type="checkbox" checked={selected.adaptiveBitrate} onChange={(event) => setAdaptiveBitrate(event.target.checked)} /><span className="toggle" /></label></div></section>
          </> : <section className="section-block advanced-panel"><div className="section-title"><div><h2>Advanced driver settings</h2><p>These controls map directly to the writable Next registry key.</p></div><span className="next-label">HKLM · NEXT</span></div><div className="advanced-list"><div><span>Registry path</span><code>...\AltA2DP\Parameters\Devices\Next\{selected.address}</code></div><div><span>Reconnect behavior</span><strong>Disable and re-enable PnP device</strong></div><div><span>Volume attenuation</span><strong>{selected.volume > 0 ? `-${100 - selected.volume} dB` : '0 dB'}</strong></div></div></section>}
        </div>
        <footer className="status-bar"><div className="live-indicator"><span /> LIVE STATUS</div><div className="status-metric"><small>CODEC</small><strong>{selected.codec}</strong></div><div className="status-metric"><small>BITRATE</small><strong>{selected.bitrate} kbps</strong></div><div className="status-metric"><small>FREQUENCY</small><strong>{selected.liveSamplingFrequency ?? selected.samplingFrequency} kHz</strong></div><div className="status-metric"><small>CHANNELS</small><strong>{channelModeLabels[selected.liveChannelMode ?? selected.channelMode]}</strong></div><div className="status-metric"><small>LATENCY</small><strong>{selected.delay} ms</strong></div><div className="status-metric quality"><small>CONNECTION QUALITY</small><strong><i style={{ width: `${selected.quality}%` }} />{selected.connected ? `${selected.quality}%` : '—'}</strong></div><div className="sco-state"><span />SCO inactive</div></footer>
      </section>
      {toast && <button className="toast" onClick={() => setToast('')}><span>✓</span>{toast}<b>×</b></button>}
    </main>
  )
}

export default App
