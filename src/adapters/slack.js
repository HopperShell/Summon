import bolt from '@slack/bolt';
const { App } = bolt;
import { BaseAdapter } from './base.js';

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export class SlackAdapter extends BaseAdapter {
  name = 'slack';
  capabilities = {
    canEditMessages: true,
    canReact: true,
    canThread: true,
    canSendImages: true,
    maxMessageLength: 3900,
    markdownFormat: 'slack-mrkdwn',
  };

  async connect() {
    this.app = new App({
      token: process.env.SLACK_BOT_TOKEN,
      appToken: process.env.SLACK_APP_TOKEN,
      socketMode: true,
    });

    this.app.message(async ({ message }) => {
      if (message.channel_type !== 'im') return;

      // Allow file_share subtype through; filter out everything else
      if (message.subtype && message.subtype !== 'file_share') return;

      const imageFiles = (message.files || []).filter(
        (f) => SUPPORTED_IMAGE_TYPES.has(f.mimetype) && f.size <= MAX_FILE_SIZE
      );

      // Log skipped oversized files
      for (const f of message.files || []) {
        if (SUPPORTED_IMAGE_TYPES.has(f.mimetype) && f.size > MAX_FILE_SIZE) {
          console.warn(`[slack] Skipping oversized file: ${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB)`);
        }
      }

      // Need either text or images
      if (!message.text && imageFiles.length === 0) return;

      const files = await this._downloadFiles(imageFiles);

      this._handler({
        chatId: message.channel,
        text: message.text || '',
        userId: message.user,
        originalTs: message.ts,
        files,
      });
    });

    await this.app.start();
    this.client = this.app.client;
    console.log('Slack adapter connected (socket mode)');
  }

  async _downloadFiles(imageFiles) {
    const results = [];
    const authHeader = { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` };

    for (const file of imageFiles) {
      try {
        const url = file.url_private_download || file.url_private;

        // Use redirect: 'manual' because fetch strips Authorization headers
        // on cross-origin redirects (files.slack.com → CDN), per the Fetch spec
        let resp = await fetch(url, { headers: authHeader, redirect: 'manual' });

        if (resp.status >= 300 && resp.status < 400) {
          const redirectUrl = resp.headers.get('location');
          resp = await fetch(redirectUrl, { headers: authHeader });
        }

        if (!resp.ok) {
          console.warn(`[slack] Failed to download file ${file.name}: ${resp.status}`);
          continue;
        }

        const contentType = resp.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          console.warn(`[slack] Got HTML instead of image for ${file.name} — auth issue?`);
          continue;
        }

        const buffer = Buffer.from(await resp.arrayBuffer());
        results.push({
          base64: buffer.toString('base64'),
          mediaType: file.mimetype,
        });
      } catch (err) {
        console.warn(`[slack] Error downloading file ${file.name}:`, err.message);
      }
    }
    return results;
  }

  async sendMessage(chatId, text) {
    const result = await this.client.chat.postMessage({ channel: chatId, text });
    return { channel: chatId, ts: result.ts };
  }

  async updateMessage(ref, text) {
    await this.client.chat.update({ channel: ref.channel, ts: ref.ts, text });
  }

  async addReaction(ref, emoji) {
    await this.client.reactions.add({
      channel: ref.channel,
      timestamp: ref.originalTs,
      name: emoji,
    });
  }
}
