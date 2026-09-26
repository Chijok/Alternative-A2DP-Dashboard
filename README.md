# A2DP Dashboard

A Windows desktop control panel for Bluetooth A2DP devices managed by the Alternative A2DP Driver. It uses Electron and React, reads device capabilities and status from the Windows registry, and can write codec settings for the next connection.

> The Alternative A2DP kernel driver and its service must already be installed. This project does not install, bundle, or redistribute the driver.

## Features

- Discovers Windows Bluetooth A2DP device nodes and AltA2DP registry entries.
- Refreshes device discovery automatically and lets you refresh manually.
- Shows the active codec, bitrate, frequency, channel mode, latency, and connection state when the driver reports those values.
- Lists codecs and parameter options reported by the device's AltA2DP `Capability` registry key.
- Edits the per-device `Next` settings for codec, sampling frequency, channel mode, bitrate, and adaptive bitrate.
- Opens Windows Bluetooth settings from **Pair new device**.
- Uses a dark, responsive interface with independent device-list and settings scrolling.

## Requirements

- Windows 10 or Windows 11
- Node.js and npm
- The Alternative A2DP Driver installed and active for the target Bluetooth device
- Administrator privileges to write the machine-wide AltA2DP registry key and attempt PnP device restart

## Development Setup

Clone the repository, open PowerShell in the project directory, and install dependencies:

```powershell
npm install
```

Start the Vite renderer in one terminal:

```powershell
npm run dev
```

Start the Electron desktop app in a second terminal:

```powershell
npm run electron:dev
```

For registry writes and device restart, launch PowerShell as Administrator before starting Electron. The app does not elevate itself.

The renderer can also be opened in a browser at the Vite URL. In browser-only mode there is no native registry or PnP bridge, so it uses mock preview devices and cannot apply settings.

## Build and Checks

Build the TypeScript renderer and production assets:

```powershell
npm run build
```

Run the configured linter:

```powershell
npm run lint
```

The current `build` script creates the Vite production renderer. A packaged Windows installer or standalone executable is not configured yet.

## How It Works

The Electron main process uses PowerShell to read:

```text
HKLM\SYSTEM\CurrentControlSet\Services\AltA2DP\Parameters\Devices\Capability
HKLM\SYSTEM\CurrentControlSet\Services\AltA2DP\Parameters\Devices\Current
HKLM\SYSTEM\CurrentControlSet\Services\AltA2DP\Parameters\Devices\Next
```

`Capability` describes options reported by the remote device, `Current` describes the active negotiated connection, and `Next` contains settings for the next connection. Device discovery also queries Windows Bluetooth A2DP PnP nodes so a paired device can appear before the driver creates its capability entry. Discovery refreshes periodically.

Selecting **Apply changes** writes the supported values to the device's `Next` registry key and then asks Windows to restart the associated PnP device. Windows may reject programmatic restart or report that a reboot is pending; in that case, disconnect and reconnect the headphones manually, or reboot Windows.

## Important Limitations

- Codec options are shown only when the corresponding capability channel-mode value is nonzero. A PnP-only device without an AltA2DP capability entry has not reported its codec capabilities yet; the app cannot safely infer them.
- The **Device Driver** selector is currently a per-device UI selection only. It does not install, remove, or switch Windows drivers.
- Driver codec IDs and registry masks are based on values observed for the target driver. The driver may differ by version; verify registry behavior before applying settings to a different driver release.
- Windows PnP restart can fail even when the registry write succeeds. The app reports this separately and does not claim the settings are active until the driver reconnects.
- No driver binaries or installer are included.

## Registry and Device Safety

The app writes only the selected device's `Next` registry values. It reads capability and current-state values for display. Applying settings can interrupt Bluetooth audio while Windows restarts the device. Review changes before applying them, and keep a way to reconnect the device through Windows Bluetooth settings.

## Contributing

Issues and pull requests are welcome. Please include your Windows version, Alternative A2DP Driver version, device model, and relevant error text when reporting a problem. Do not attach license keys, registry exports containing personal device identifiers, or proprietary driver binaries.

## License

Copyright (C) 2026 Chijok <chijok2311@outlook.com>.

The A2DP Dashboard code is licensed under the GNU General Public License, version 3.0 only. See [LICENSE](LICENSE) or the [official GPL-3.0 text](https://www.gnu.org/licenses/gpl-3.0.txt).

Third-party dependencies, assets, and the Alternative A2DP Driver are not relicensed by this notice and remain under their respective licenses.
