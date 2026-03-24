import qrcode from 'qrcode-terminal';

export default (api: any) => {
  api.cli.command('qr')
    .description('Generate a pairing QR code for the OmniClaw iOS app')
    .option('-h, --host <hostname>', 'The gateway hostname or IP', '127.0.0.1')
    .option('-s, --scheme <scheme>', 'WebSocket scheme (ws or wss)', 'wss')
    .option('-p, --port <port>', 'Gateway port (will default to 443 if wss or 18789 if ws)', '')
    .action((options: any) => {
      // Fetch token from Gateway config at runtime
      const token = api.config.gateway?.auth?.token || process.env.OPENCLAW_GATEWAY_TOKEN;
      
      if (!token) {
        console.error("❌ Gateway token not found in config! Please ensure OPENCLAW_GATEWAY_TOKEN or config.gateway.auth.token is configured.");
        return;
      }

      // Determine accurate WS connection endpoint
      let portStr = options.port;
      if (!portStr) {
        portStr = options.scheme === 'wss' ? '' : ':18789';
      } else {
        portStr = `:${portStr}`;
      }

      // The iOS app natively relies on omniclaw:// scheme to auto-launch the connection workflow
      const endpoint = `${options.scheme}://${options.host}${portStr}`;
      const payload = `omniclaw://pair?endpoint=${encodeURIComponent(endpoint)}&token=${encodeURIComponent(token)}`;

      console.log(`\n📱 OmniClaw Auto-Pairing QR Code`);
      console.log(`📡 Endpoint: ${endpoint}`);
      console.log(`🔑 Token:    ${token.slice(0, 5)}...${token.slice(-5)}\n`);

      // Plot the QR Code in terminal with the small payload setting for better UX on high-DPI
      qrcode.generate(payload, { small: true });
      
      console.log(`\n👉 Open the OmniClaw iOS App, point your camera at this QR code to establish the secure connection instantly.\n`);
    });
};
