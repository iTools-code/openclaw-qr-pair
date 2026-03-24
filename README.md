# OpenClaw QR Pairing Plugin (`openclaw-qr-pair`)

A lightweight, terminal-based QR code generator plugin for [OpenClaw](https://github.com/openclaw/openclaw). 

This plugin securely extracts your gateway's connection endpoint and active token at runtime, generating a scannable URI QR Code (`omniclaw://pair`) directly in your terminal. This allows the OmniClaw iOS mobile app to establish an `Ed25519` identity handshake and full-duplex WebSocket connection in milliseconds, completely eliminating manual text entry.

## Installation

Run the following commands on your server to clone and install the plugin from its local path:

```bash
git clone https://github.com/iTools-code/openclaw-qr-pair.git
openclaw plugins install ./openclaw-qr-pair
```

*(Remember to restart your OpenClaw Gateway daemon after installation).*

## Usage

Simply run the following command in an environment where your OpenClaw Gateway configuration is loaded:

```bash
openclaw qr
```

### Options

If your OpenClaw gateway is running behind a reverse proxy (like Cloudflare Tunnels), you can override the display hostname:

```bash
openclaw qr --host your-domain.com --scheme wss
```

Point your OmniClaw iOS app at the giant QR code rendered in your terminal, and watch the zero-trust handshake establish instantly! ✨
