import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import express from "express";
import fs from "fs";
import ytdl from "ytdl-core";
import yts from "yt-search";

const app = express();
const PORT = process.env.PORT || 3000;

// Mantener vivo el bot
app.get("/", (req, res) => res.send("Bot ON ✅"));
app.listen(PORT, () => console.log(`HTTP Server Running ✔ PORT:${PORT}`));

// --- BOT ---
async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({ auth: state, printQRInTerminal: true });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        if(update.qr) console.log("SCAN QR 🔥🔥");
        if(update.connection === "close") {
            const reason = update.lastDisconnect?.error?.output?.statusCode;
            console.log("Conexion cerrada, code:", reason);
            if(reason !== DisconnectReason.loggedOut) start();
        }
        if(update.connection === "open") console.log("Bot Conectado ✅");
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if(type !== "notify") return;
        const msg = messages[0];
        if(!msg.message || msg.key.fromMe) return;
        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message?.extendedTextMessage?.text;
        if(!text) return;

        // --- COMANDOS ---
        if(text.startsWith("#sticker")) {
            try {
                const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
                if(!quoted) return sock.sendMessage(sender, { text: "Responde una imagen con #sticker" });
                const media = await sock.downloadMediaMessage({ message: { imageMessage: quoted } });
                await sock.sendMessage(sender, { sticker: media });
            } catch(e) { console.log(e); }
        } else if(text.startsWith("#ytaudio")) {
            const query = text.replace("#ytaudio", "").trim();
            if(!query) return sock.sendMessage(sender, { text: "Pon el nombre del video" });
            const r = await yts(query);
            if(!r.videos.length) return sock.sendMessage(sender, { text: "No encontré el video 😅" });
            const url = r.videos[0].url;
            const stream = ytdl(url, { filter: 'audioonly' });
            await sock.sendMessage(sender, { audio: stream, mimetype: 'audio/mpeg' });
        } else if(text.startsWith("#ytvideo")) {
            const query = text.replace("#ytvideo", "").trim();
            if(!query) return sock.sendMessage(sender, { text: "Pon el nombre del video" });
            const r = await yts(query);
            if(!r.videos.length) return sock.sendMessage(sender, { text: "No encontré el video 😅" });
            await sock.sendMessage(sender, { video: { url: r.videos[0].url }, caption: r.videos[0].title });
        } else if(/https?:\/\/chat\.whatsapp\.com\/\S+/.test(text)) {
            await sock.sendMessage(sender, { text: "Links de grupo no permitidos 🚫" });
        } else if(text.toLowerCase().includes("hola")) {
            await sock.sendMessage(sender, { text: "Hola! 😎🔥" });
        } else if(text.startsWith("#say")) {
            const msgToSay = text.replace("#say","").trim();
            if(msgToSay) await sock.sendMessage(sender, { text: msgToSay });
        }
    });
}

start();
