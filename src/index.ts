import qrcode from 'qrcode-terminal';
import WebSocket from 'ws';

// Google Cloud Run 部署所得的全局域名与验证密匙
const RELAY_URL = 'wss://omniclaw-wstunnel-932707657793.us-central1.run.app';
const RELAY_TOKEN = 'OmniClawSuperSecureToken2026';

export default function openclawPlugin(api: any) {
  // Plugin API Registration Disabled.
  // We now run this code autonomously via the 'openclaw-relay' binary script to avoid Version Matrix deprecations with OpenClaw internal CLI commands.
};
