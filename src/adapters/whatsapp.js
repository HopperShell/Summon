import { makeWASocket, useMultiFileAuthState, DisconnectReason } from 'baileys';
import { BaseAdapter } from './base.js';
import fs from 'fs/promises';

export class WhatsAppAdapter extends BaseAdapter {
  constructor() {
    super();
    this.name = 'whatsapp';
    this.capabilities = {
      canEditMessages: false,
      canReact: false,
      canThread: false,
      maxMessageLength: 4096,
      markdownFormat: 'whatsapp',
    };
    this.sock = null;
  }

  async connect() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
    });

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        if (loggedOut) {
          console.log('[whatsapp] Logged out — clearing auth and reconnecting...');
          await fs.rm('auth_info', { recursive: true, force: true });
        } else {
          console.log('[whatsapp] Connection closed — reconnecting...');
        }

        await this.connect();
      } else if (connection === 'open') {
        console.log('[whatsapp] Connected');
      }
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('messages.upsert', ({ messages }) => {
      const msg = messages?.[0];
      if (!msg) return;
      if (!msg.message) return;
      if (msg.key.remoteJid === 'status@broadcast') return;

      const senderJid = msg.key.remoteJid;
      const phoneNumber = senderJid.replace('@s.whatsapp.net', '');

      const allowedNumber = process.env.WHATSAPP_ALLOWED_NUMBER;
      if (allowedNumber && phoneNumber !== allowedNumber) return;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text;

      if (!text) return;

      this._handler({ chatId: senderJid, text, userId: phoneNumber });
    });
  }

  async sendMessage(chatId, text) {
    const msg = await this.sock.sendMessage(chatId, { text });
    return { chatId, messageId: msg.key.id };
  }

  async updateMessage(ref, text) {
    /* no-op — WhatsApp doesn't support editing */
  }

  async addReaction(ref, emoji) {
    /* no-op */
  }
}
