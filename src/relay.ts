#!/usr/bin/env node
import qrcode from 'qrcode-terminal';
import WebSocket from 'ws';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { execSync } from 'child_process';

// Google Cloud Run 部署所得的全局域名与验证密匙
const RELAY_URL = 'wss://omniclaw-wstunnel-932707657793.us-central1.run.app';
const RELAY_TOKEN = 'OmniClawSuperSecureToken2026';

// 尝试从环境中读取用户设置的明文 Token
let localToken = process.env.OPENCLAW_GATEWAY_TOKEN;

if (!localToken) {
    console.log("⏳ Spawning 'npx openclaw qr' to securely obtain a dynamic Bootstrap Token...");
    try {
        const qrOutput = execSync('npx openclaw qr', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        const setupCodeMatch = qrOutput.match(/Setup code:\s+([a-zA-Z0-9+/=_-]+)/);
        
        if (setupCodeMatch && setupCodeMatch[1]) {
            const encodedPayload = setupCodeMatch[1];
            // Decode Base64 (URL Safe)
            const decodedJsonStr = Buffer.from(encodedPayload, 'base64').toString('utf8');
            const setupObj = JSON.parse(decodedJsonStr);
            if (setupObj.bootstrapToken) {
                localToken = setupObj.bootstrapToken;
                console.log(`✅ Successfully extracted a 15-minute Bootstrap Token from the OpenClaw Daemon.`);
            }
        }
    } catch (e) {
        console.warn("⚠️ Failed to invoke 'npx openclaw qr' to generate dynamic token automatically.");
    }
}

if (!localToken) {
    console.error("❌ Gateway token not found! Please export OPENCLAW_GATEWAY_TOKEN=<plaintext_token_or_bootstrap>");
    console.error("⚠️ Alternatively, ensure 'npx openclaw' is executable in this directory.");
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
