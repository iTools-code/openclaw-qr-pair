import qrcode from 'qrcode-terminal';
import WebSocket from 'ws';

// Google Cloud Run 部署所得的全局域名与验证密匙
const RELAY_URL = 'wss://omniclaw-wstunnel-932707657793.us-central1.run.app';
const RELAY_TOKEN = 'OmniClawSuperSecureToken2026';


export default function openclawPlugin(api: any) {
  // 完美适配 OpenClaw 最新底层版本的 CLI 注册机制
  api.registerCli((cli: any) => {
    cli.command('relay')
      .description('Generate a global pairing QR code and start the Cloud Relay Host Bridge')
      .action(() => {
        // 读取本地网关保护 token
        const localToken = api.config?.gateway?.auth?.token || process.env.OPENCLAW_GATEWAY_TOKEN;
        
        if (!localToken) {
          console.error("❌ Gateway token not found in config! Please ensure OPENCLAW_GATEWAY_TOKEN is configured.");
          console.error("⚠️ Alternatively, run 'openclaw qr' to find your token embedded in the printed 'Setup code'.");
          return;
        }

        const clientQRUrl = `${RELAY_URL}/client`;
        const payload = `omniclaw://pair?endpoint=${encodeURIComponent(clientQRUrl)}&token=${encodeURIComponent(RELAY_TOKEN)}`;

        console.log(`\n📱 OmniClaw Auto-Pairing QR Code (Global Cloud Relay Mode)`);
        console.log(`☁️  Global Endpoint: ${clientQRUrl}`);
        console.log(`🔑 Relay Token:     ${RELAY_TOKEN.slice(0, 5)}...${RELAY_TOKEN.slice(-5)}\n`);

        qrcode.generate(payload, { small: true });
        
        console.log(`\n👉 Open the OmniClaw iOS App and scan the QR code to connect worldwide.`);
        console.log(`⏳ Starting Dual-Tube Host Bridge tunneling into Google Cloud...\n`);

        let localWs: WebSocket | null = null;
        let hostWs: WebSocket | null = null;
        let isLocalConnected = false;

        function connectLocal() {
            localWs = new WebSocket(`ws://127.0.0.1:18789`);
            localWs.on('open', () => {
                isLocalConnected = true;
                console.log('🏠 [LOCAL] Connected to local OpenClaw Gateway on :18789.');
            });
            localWs.on('message', (data: any) => {
                if (hostWs && hostWs.readyState === WebSocket.OPEN) {
                    hostWs.send(data);
                }
            });
            localWs.on('close', () => {
                isLocalConnected = false;
                setTimeout(connectLocal, 3000);
            });
            localWs.on('error', () => {});
        }

        function connectHost() {
            const hostUrl = `${RELAY_URL}/host?token=${encodeURIComponent(RELAY_TOKEN)}`;
            hostWs = new WebSocket(hostUrl);
            
            hostWs.on('open', () => {
                console.log('☁️ [CLOUD] Host strictly bonded to Cloud Run Tunnel.');
            });

            hostWs.on('message', (data: any) => {
                if (localWs && localWs.readyState === WebSocket.OPEN) {
                    localWs.send(data);
                } else {
                    console.warn('⚠️ [WARNING] Received from Cloud, but Local Gateway is offline!');
                }
            });

            hostWs.on('close', () => {
                setTimeout(connectHost, 3000);
            });
            hostWs.on('error', (err: any) => {
                console.error('☁️ [ERROR] Cloud Relay disconnected:', err.message);
            });
        }

        connectLocal();
        connectHost();
        
        console.log(`🛡️  Bridge is actively running. Press Ctrl+C to terminate the tunnel...\n`);
      });
  });
};
