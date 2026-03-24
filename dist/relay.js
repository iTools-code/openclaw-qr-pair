#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const ws_1 = __importDefault(require("ws"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
// Google Cloud Run 部署所得的全局域名与验证密匙
const RELAY_URL = 'wss://omniclaw-wstunnel-932707657793.us-central1.run.app';
const RELAY_TOKEN = 'OmniClawSuperSecureToken2026';
// 尝试读取 OpenClaw 本地配置获取 Token
let localToken = process.env.OPENCLAW_GATEWAY_TOKEN;
const configPaths = [
    path_1.default.join(os_1.default.homedir(), '.openclaw', 'openclaw.json'),
    path_1.default.join(os_1.default.homedir(), '.openclaw', 'config.json'),
    path_1.default.join(os_1.default.homedir(), '.openclaw', 'plugins.json')
];
if (!localToken) {
    for (const cp of configPaths) {
        if (fs_1.default.existsSync(cp)) {
            try {
                const cfg = JSON.parse(fs_1.default.readFileSync(cp, 'utf8'));
                if (cfg.gateway?.auth?.token) {
                    localToken = cfg.gateway.auth.token;
                    break;
                }
            }
            catch (e) { }
        }
    }
}
if (!localToken) {
    console.error("❌ Gateway token not found! Please export OPENCLAW_GATEWAY_TOKEN=xxx");
    // Fallback directly to prompting the user
    console.error("⚠️ Alternatively, run 'openclaw qr' to find your token embedded in the printed 'Setup code'.");
    process.exit(1);
}
// 给 iPhone 扫的最终握手包：Endpoint 是我们刚建的云端 /client，但带着过审 Token
const clientQRUrl = `${RELAY_URL}/client`;
const payload = `omniclaw://pair?endpoint=${encodeURIComponent(clientQRUrl)}&relayToken=${encodeURIComponent(RELAY_TOKEN)}&gatewayToken=${encodeURIComponent(localToken)}`;
console.log(`\n📱 OmniClaw Auto-Pairing QR Code (Global Cloud Relay Mode)`);
console.log(`☁️  Global Endpoint: ${clientQRUrl}`);
console.log(`🔑 Relay Token:     ${RELAY_TOKEN.slice(0, 5)}...${RELAY_TOKEN.slice(-5)}`);
console.log(`🔐 Gateway Token:   ${localToken.slice(0, 5)}...${localToken.slice(-5)}\n`);
// 缩印模式输出控制台二维码
qrcode_terminal_1.default.generate(payload, { small: true });
console.log(`\n👉 Open the OmniClaw iOS App and scan the QR code to connect worldwide.`);
console.log(`⏳ Starting Dual-Tube Host Bridge tunneling into Google Cloud...\n`);
let localWs = null;
let hostWs = null;
let isLocalConnected = false;
function connectLocal() {
    localWs = new ws_1.default(`ws://127.0.0.1:18789`);
    localWs.on('open', () => {
        isLocalConnected = true;
        console.log('🏠 [LOCAL] Connected to local OpenClaw Gateway on :18789.');
    });
    localWs.on('message', (data) => {
        if (hostWs && hostWs.readyState === ws_1.default.OPEN) {
            hostWs.send(data);
        }
    });
    localWs.on('close', () => {
        isLocalConnected = false;
        setTimeout(connectLocal, 3000);
    });
    localWs.on('error', () => { });
}
function connectHost() {
    const hostUrl = `${RELAY_URL}/host?token=${encodeURIComponent(RELAY_TOKEN)}`;
    hostWs = new ws_1.default(hostUrl);
    hostWs.on('open', () => {
        console.log('☁️ [CLOUD] Mac/Linux Host strictly bonded to Cloud Run Tunnel.');
    });
    hostWs.on('message', (data) => {
        if (localWs && localWs.readyState === ws_1.default.OPEN) {
            localWs.send(data);
        }
        else {
            console.warn('⚠️ [WARNING] Received from Cloud, but Local Gateway is offline!');
        }
    });
    hostWs.on('close', () => {
        setTimeout(connectHost, 3000);
    });
    hostWs.on('error', (err) => {
        console.error('☁️ [ERROR] Cloud Relay disconnected:', err.message);
    });
}
connectLocal();
connectHost();
console.log(`🛡️  Bridge is actively running. Press Ctrl+C to terminate the tunnel...\n`);
