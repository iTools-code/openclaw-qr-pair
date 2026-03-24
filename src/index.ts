import qrcode from 'qrcode-terminal';
import WebSocket from 'ws';

// Google Cloud Run 部署所得的全局域名与验证密匙
const RELAY_URL = 'wss://omniclaw-wstunnel-932707657793.us-central1.run.app';
const RELAY_TOKEN = 'OmniClawSuperSecureToken2026';

export default (api: any) => {
  api.cli.command('qr')
    .description('Generate a global pairing QR code and start the Cloud Relay Host Bridge')
    .action(() => {
      // 获取本地网关保护 token (确保只有具备这个 token 的 iOS App 最终能通过身份验证)
      const localToken = api.config.gateway?.auth?.token || process.env.OPENCLAW_GATEWAY_TOKEN;
      
      if (!localToken) {
        console.error("❌ Gateway token not found in config! Please ensure OPENCLAW_GATEWAY_TOKEN is configured.");
        return;
      }

      // 给 iPhone 扫的最终握手包：Endpoint 是我们刚建的云端 /client，但带着过审 Token
      const clientQRUrl = `${RELAY_URL}/client`;
      const payload = `omniclaw://pair?endpoint=${encodeURIComponent(clientQRUrl)}&token=${encodeURIComponent(RELAY_TOKEN)}`;

      console.log(`\n📱 OmniClaw Auto-Pairing QR Code (Global Cloud Relay Mode)`);
      console.log(`☁️  Global Endpoint: ${clientQRUrl}`);
      console.log(`🔑 Relay Token:     ${RELAY_TOKEN.slice(0, 5)}...${RELAY_TOKEN.slice(-5)}\n`);

      // 缩印模式输出控制台二维码
      qrcode.generate(payload, { small: true });
      
      console.log(`\n👉 Open the OmniClaw iOS App and scan the QR code to connect worldwide.`);
      console.log(`⏳ Starting Dual-Tube Host Bridge tunneling into Google Cloud...\n`);

      let localWs: WebSocket | null = null;
      let hostWs: WebSocket | null = null;
      let isLocalConnected = false;

      // ============================================
      // 管道 A：连接本地计算机运行的 OpenClaw 网关
      // ============================================
      function connectLocal() {
          localWs = new WebSocket(`ws://127.0.0.1:18789`);
          localWs.on('open', () => {
              isLocalConnected = true;
              console.log('🏠 [LOCAL] Connected to local OpenClaw Gateway on :18789.');
          });
          localWs.on('message', (data) => {
              // 本地吐出的数据（AI 回复的 JSON-RPC）立刻透传喷射到云端的 /host 管道
              if (hostWs && hostWs.readyState === WebSocket.OPEN) {
                  hostWs.send(data);
              }
          });
          localWs.on('close', () => {
              isLocalConnected = false;
              setTimeout(connectLocal, 3000);
          });
          localWs.on('error', () => { /* 抑制无网关时的报错轰炸 */ });
      }

      // ============================================
      // 管道 B：连接遥远的 Google Cloud Run Relay 宿主端
      // ============================================
      function connectHost() {
          const hostUrl = `${RELAY_URL}/host?token=${encodeURIComponent(RELAY_TOKEN)}`;
          hostWs = new WebSocket(hostUrl);
          
          hostWs.on('open', () => {
              console.log('☁️ [ CLOUD] Mac Host strictly bonded to Cloud Run Tunnel.');
          });

          hostWs.on('message', (data) => {
              // 收到来自手机经过云端发送来的指令（如：语音、聊天），立刻捅进本地管道
              if (localWs && localWs.readyState === WebSocket.OPEN) {
                  localWs.send(data);
              } else {
                  console.warn('⚠️ [WARNING] Received from Cloud, but Local Gateway is offline!');
              }
          });

          hostWs.on('close', () => {
              setTimeout(connectHost, 3000);
          });
          hostWs.on('error', (err) => {
              console.error('☁️ [ ERROR] Cloud Relay disconnected:', err.message);
          });
      }

      connectLocal();
      connectHost();
      
      console.log(`🛡️  Bridge is actively running. Press Ctrl+C to terminate the tunnel...\n`);
    });
};
