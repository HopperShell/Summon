import bolt from '@slack/bolt';
const { App } = bolt;
import { BaseAdapter } from './base.js';

export class SlackAdapter extends BaseAdapter {
  name = 'slack';
  capabilities = {
    canEditMessages: true,
    canReact: true,
    canThread: true,
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
      if (message.subtype) return;
      if (!message.text) return;

      this._handler({
        chatId: message.channel,
        text: message.text,
        userId: message.user,
        originalTs: message.ts,
      });
    });

    await this.app.start();
    this.client = this.app.client;
    console.log('Slack adapter connected (socket mode)');
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
