// Copyright (C) 2026 Chijok <chijok2311@outlook.com>
// SPDX-License-Identifier: GPL-3.0-only

const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron')
const { execFile } = require('node:child_process')
const path = require('node:path')

app.setPath('userData', path.join(app.getPath('appData'), 'AlternativeA2DP'))
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')

const isDev = !app.isPackaged
const powershell = `
$ErrorActionPreference = 'Stop'
$base = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\AltA2DP\\Parameters\\Devices'
function Read-Dword($object, $name, $fallback = 0) {
  if ($null -eq $object) { return $fallback }
  $value = $object.PSObject.Properties[$name]
  if ($null -eq $value) { return $fallback }
  return [int64]$value.Value
}
function Read-Key($path) {
  if (Test-Path $path) { return Get-ItemProperty $path }
  return $null
}
function Codec-Name($codec) {
  switch ([int]$codec) { 1 { 'SBC' } 2 { 'AAC' } 8 { 'aptX' } 16 { 'aptX HD' } 32 { 'aptX LL' } 64 { 'LDAC' } default { 'SBC' } }
}
function Sampling-Frequency($object, $codec) {
  if ($codec -eq 'SBC') { $value = Read-Dword $object 'SbcSamplingFrequency'; switch ($value) { 1 { return '48' } 2 { return '44.1' } 4 { return '32' } 8 { return '16' } } }
  if ($codec -eq 'AAC') { $value = Read-Dword $object 'AacSamplingFrequency'; switch ($value) { 8 { return '44.1' } 16 { return '48' } } }
  if ($codec -eq 'LDAC') { $value = Read-Dword $object 'LdacSamplingFrequency'; switch ($value) { 1 { return '44.1' } 2 { return '48' } 4 { return '88.2' } 8 { return '96' } } }
  if ($codec -eq 'aptX') { $value = Read-Dword $object 'AptxSamplingFrequency'; switch ($value) { 2 { return '44.1' } 1 { return '48' } } }
  if ($codec -eq 'aptX HD') { $value = Read-Dword $object 'AptxHdSamplingFrequency'; switch ($value) { 2 { return '44.1' } 1 { return '48' } } }
  if ($codec -eq 'aptX LL') { $value = Read-Dword $object 'AptxLlSamplingFrequency'; switch ($value) { 2 { return '44.1' } 1 { return '48' } } }
  return '48'
}
function Channel-Mode($object, $codec) {
  if ($codec -eq 'SBC') { $value = Read-Dword $object 'SbcChannelMode'; switch ($value) { 1 { return 'joint' } 2 { return 'stereo' } 4 { return 'dual' } 8 { return 'mono' } } }
  if ($codec -eq 'AAC') { $value = Read-Dword $object 'AacChannelMode'; switch ($value) { 4 { return 'stereo' } 8 { return 'mono' } } }
  if ($codec -eq 'LDAC') { $value = Read-Dword $object 'LdacChannelMode'; switch ($value) { 1 { return 'stereo' } 2 { return 'dual' } 4 { return 'mono' } } }
  if ($codec -eq 'aptX') { $value = Read-Dword $object 'AptxChannelMode'; switch ($value) { 1 { return 'mono' } 2 { return 'stereo' } } }
  if ($codec -eq 'aptX HD') { $value = Read-Dword $object 'AptxHdChannelMode'; switch ($value) { 1 { return 'mono' } 2 { return 'stereo' } } }
  if ($codec -eq 'aptX LL') { $value = Read-Dword $object 'AptxLlChannelMode'; switch ($value) { 1 { return 'mono' } 2 { return 'stereo' } } }
  return 'stereo'
}
$capabilityPath = Join-Path $base 'Capability'
$devices = @()
$pnpDevices = @(Get-CimInstance Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.DeviceID -like '*BTHENUM*110B*' })
$addresses = @()
if (Test-Path $capabilityPath) { $addresses += @(Get-ChildItem -Path $capabilityPath -ErrorAction SilentlyContinue | ForEach-Object { $_.PSChildName }) }
foreach ($pnpDevice in $pnpDevices) {
  if ($pnpDevice.DeviceID -match '(?i)([0-9A-F]{12})_C[0-9A-F]+$') {
    $pnpAddress = ('0000' + $matches[1]).ToLower()
    if ($addresses -notcontains $pnpAddress) { $addresses += $pnpAddress }
  }
}
foreach ($address in $addresses) {
    $capability = Read-Key (Join-Path $capabilityPath $address)
    $current = Read-Key (Join-Path $base "Current\\$address")
    $next = Read-Key (Join-Path $base "Next\\$address")
    $token = $address.TrimStart('0').ToUpper()
    $pnp = @($pnpDevices | Where-Object { $_.DeviceID.ToUpper().Contains($token) } | Select-Object -First 1)
    $supports = @()
    if ((Read-Dword $capability 'SbcChannelMode') -ne 0) { $supports += 'SBC' }
    if ((Read-Dword $capability 'AacChannelMode') -ne 0) { $supports += 'AAC' }
    if ((Read-Dword $capability 'LdacChannelMode') -ne 0) { $supports += 'LDAC' }
    if ((Read-Dword $capability 'AptxChannelMode') -ne 0) { $supports += 'aptX' }
    if ((Read-Dword $capability 'AptxHdChannelMode') -ne 0) { $supports += 'aptX HD' }
    if ((Read-Dword $capability 'AptxLlChannelMode') -ne 0) { $supports += 'aptX LL' }
    if ($supports.Count -eq 0) { $supports = @('SBC') }
    $nextCodec = Codec-Name (Read-Dword $next 'Codec' 1)
    $currentOpened = ((Read-Dword $current 'Opened') -eq 1)
    $currentCodecValue = Read-Dword $current 'Codec'
    $currentCodec = if ($currentOpened -and $currentCodecValue -ne 0) { Codec-Name $currentCodecValue } else { $nextCodec }
    $devices += [ordered]@{
      id = $address
      name = if ($capability.Name) { [string]$capability.Name } elseif ($pnp.Name) { [string]$pnp.Name } else { "Bluetooth device $address" }
      model = if ($pnp.Name) { [string]$pnp.Name } else { 'Bluetooth A2DP device' }
      address = $address
      instanceId = if ($pnp.DeviceID) { [string]$pnp.DeviceID } else { '' }
      connected = ((Read-Dword $current 'Opened') -eq 1)
      codec = $currentCodec
      channelMode = Channel-Mode $next $nextCodec
      samplingFrequency = Sampling-Frequency $next $nextCodec
      liveChannelMode = Channel-Mode $current $currentCodec
      liveSamplingFrequency = Sampling-Frequency $current $currentCodec
      bitrate = [int]([math]::Min(990, [math]::Max(0, [math]::Round((Read-Dword $current 'Bitrate' (Read-Dword $next 'AacBitrate' 256000)) / 1000))))
      delay = [int]([math]::Round((Read-Dword $current 'Delay') / 10))
      quality = if ($currentOpened) { 92 } else { 0 }
      supports = @($supports)
      adaptiveBitrate = ((Read-Dword $next 'AbrEnable') -eq 1)
      volume = [int64](Read-Dword $next 'VolumeLevel')
      scoActive = ((Read-Dword $current 'ScoActive') -eq 1)
      error = [uint64](Read-Dword $current 'Error')
    }
}
@($devices) | ConvertTo-Json -Compress -Depth 6
`

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr.trim() || error.message))
      try { resolve(JSON.parse(stdout.trim() || '[]')) } catch { reject(new Error(`Invalid PowerShell response: ${stdout}`)) }
    })
  })
}

function validateSettings(settings) {
  if (!settings || !/^[0-9a-f]{16}$/i.test(settings.address)) throw new Error('Invalid Bluetooth address')
  if (!['SBC', 'AAC', 'LDAC', 'aptX', 'aptX HD', 'aptX LL'].includes(settings.codec)) throw new Error('Unsupported codec')
  if (!Number.isFinite(settings.bitrate) || settings.bitrate < 0 || settings.bitrate > 990) throw new Error('Invalid bitrate')
  if (typeof settings.adaptiveBitrate !== 'boolean') throw new Error('Invalid adaptive bitrate setting')
}

async function writeSettings(settings) {
  validateSettings(settings)
  const codecIds = { SBC: 1, AAC: 2, 'aptX': 8, 'aptX HD': 16, 'aptX LL': 32, LDAC: 64 }
  const samplingFields = { SBC: 'SbcSamplingFrequency', AAC: 'AacSamplingFrequency', LDAC: 'LdacSamplingFrequency', 'aptX': 'AptxSamplingFrequency', 'aptX HD': 'AptxHdSamplingFrequency', 'aptX LL': 'AptxLlSamplingFrequency' }
  const samplingMasks = { SBC: { '16': 8, '32': 4, '44.1': 2, '48': 1 }, AAC: { '44.1': 8, '48': 16 }, LDAC: { '44.1': 1, '48': 2, '88.2': 4, '96': 8 }, 'aptX': { '44.1': 2, '48': 1 }, 'aptX HD': { '44.1': 2, '48': 1 }, 'aptX LL': { '44.1': 2, '48': 1 } }
  const channelFields = { SBC: 'SbcChannelMode', AAC: 'AacChannelMode', LDAC: 'LdacChannelMode', 'aptX': 'AptxChannelMode', 'aptX HD': 'AptxHdChannelMode', 'aptX LL': 'AptxLlChannelMode' }
  const channelMasks = { SBC: { joint: 1, stereo: 2, dual: 4, mono: 8 }, AAC: { stereo: 4, mono: 8 }, LDAC: { stereo: 1, dual: 2, mono: 4 }, 'aptX': { mono: 1, stereo: 2 }, 'aptX HD': { mono: 1, stereo: 2 }, 'aptX LL': { mono: 1, stereo: 2 } }
  if (!codecIds[settings.codec]) throw new Error(`Unsupported codec: ${settings.codec}`)
  if (!samplingFields[settings.codec] || samplingMasks[settings.codec][settings.samplingFrequency] === undefined) throw new Error(`Unsupported sampling frequency ${settings.samplingFrequency} for ${settings.codec}`)
  if (!channelFields[settings.codec] || channelMasks[settings.codec][settings.channelMode] === undefined) throw new Error(`Unsupported channel mode ${settings.channelMode} for ${settings.codec}`)
  const address = settings.address
  const instanceId = String(settings.instanceId || '').replace(/'/g, "''")
  const nextPath = `HKLM:\\SYSTEM\\CurrentControlSet\\Services\\AltA2DP\\Parameters\\Devices\\Next\\${address}`
  const script = `
$ErrorActionPreference = 'Stop'
$next = '${nextPath}'
if (-not (Test-Path $next)) { New-Item -Path $next -Force | Out-Null }
Set-ItemProperty -Path $next -Name 'Codec' -Value ${codecIds[settings.codec]} -Type DWord
Set-ItemProperty -Path $next -Name '${samplingFields[settings.codec]}' -Value ${samplingMasks[settings.codec][settings.samplingFrequency]} -Type DWord
Set-ItemProperty -Path $next -Name '${channelFields[settings.codec]}' -Value ${channelMasks[settings.codec][settings.channelMode]} -Type DWord
Set-ItemProperty -Path $next -Name 'AbrEnable' -Value ${settings.adaptiveBitrate ? 1 : 0} -Type DWord
if ('${settings.codec}' -eq 'AAC') { Set-ItemProperty -Path $next -Name 'AacBitrate' -Value ${Math.round(settings.bitrate * 1000)} -Type DWord }
if ('${settings.codec}' -eq 'LDAC') { Set-ItemProperty -Path $next -Name 'LdacEqmid' -Value $(if (${settings.bitrate} -ge 900) { 0 } elseif (${settings.bitrate} -ge 600) { 1 } else { 2 }) -Type DWord }
${instanceId ? `$instanceId = '${instanceId}'
$restartMessage = ''
try {
  Get-PnpDevice -InstanceId $instanceId -ErrorAction Stop | Out-Null
  Disable-PnpDevice -InstanceId $instanceId -Confirm:$false -ErrorAction Stop
  Start-Sleep -Seconds 2
  Enable-PnpDevice -InstanceId $instanceId -Confirm:$false -ErrorAction Stop
  $restartMessage = 'Device restarted with new settings'
} catch {
  $pnpError = $_.Exception.Message
  & pnputil.exe /restart-device $instanceId | Out-Null
  if ($LASTEXITCODE -eq 0) { $restartMessage = 'Device restarted with new settings' }
  else { $restartMessage = "Settings were written. Windows could not restart this device ($pnpError). Disconnect and reconnect the headphones, or reboot Windows, to apply them." }
}` : "$restartMessage = 'Settings were written. Disconnect and reconnect the headphones to apply them.'"}
[ordered]@{ ok = $true; message = $restartMessage } | ConvertTo-Json
`
  return runPowerShell(script)
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    title: 'A2DP Dashboard',
    icon: path.join(__dirname, '../public/app-icon.svg'),
    backgroundColor: '#101216',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  })
  if (isDev) window.loadURL('http://localhost:5173')
  else window.loadFile(path.join(__dirname, '../dist/index.html'))
}

ipcMain.handle('a2dp:get-devices', async () => {
  const devices = await runPowerShell(powershell)
  return Array.isArray(devices) ? devices : (devices ? [devices] : [])
})
ipcMain.handle('a2dp:open-bluetooth-settings', async () => {
  await shell.openExternal('ms-settings:bluetooth')
  return { ok: true }
})
ipcMain.handle('a2dp:write-settings', async (_event, settings) => {
  try { return { ok: true, message: await writeSettings(settings) } }
  catch (error) { dialog.showErrorBox('Alternative A2DP Driver', error.message); return { ok: false, error: error.message } }
})
app.whenReady().then(() => { Menu.setApplicationMenu(null); createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() }) })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
