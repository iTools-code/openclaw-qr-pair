#!/usr/bin/env node
import qrcode from 'qrcode-terminal';
import WebSocket from 'ws';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Google Cloud Run 部署所得的全局域名与验证密匙
const RELAY_URL = 'wss://omniclaw-wstunnel-932707657793.us-central1.run.app';
const RELAY_TOKEN = 'OmniClawSuperSecureToken2026';

// 尝试读取 OpenClaw 本地配置获取 Token
let localToken = process.env.OPENCLAW_GATEWAY_TOKEN;
const configPaths = [
    path.join(os.homedir(), '.openclaw', 'openclaw.json'),
    path.join(os.homedir(), '.openclaw', 'config.json'),
    path.join(os.homedir(), '.openclaw', 'plugins.json')
];

if (!localToken) {
    for (const cp of configPaths) {
        if (fs.existsSync(cp)) {
            try {
                const cfg = JSON.parse(fs.readFileSync(cp, 'utf8'));
                if (cfg.gateway?.auth?.token) {
                    localToken = cfg.gateway.auth.token;
                    break;
                }
            } catch(e) {}
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
        console.log('☁️ [CLOUD] Mac/Linux Host strictly bonded to Cloud Run Tunnel.');
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
