import { Client, GatewayIntentBits, Events, Partials } from 'discord.js';
import { BaseAdapter } from './base.js';

const EMOJI_MAP = {
  white_check_mark: '\u2705',
  x: '\u274C',
  hourglass_flowing_sand: '\u23F3',
};

export class DiscordAdapter extends BaseAdapter {
  constructor() {
    super();
    this.name = 'discord';
    this.capabilities = {
      canEditMessages: true,
      canReact: true,
      canThread: true,
      maxMessageLength: 2000,
      markdownFormat: 'standard',
    };
    this.client = null;
  }

  async connect() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel],
    });

    this.client.on(Events.MessageCreate, (message) => {
      if (message.author.bot) return;
      if (!message.channel.isDMBased()) return;

      this._handler({
        chatId: message.channel.id,
        text: message.content,
        userId: message.author.id,
      });
    });

    await this.client.login(process.env.DISCORD_BOT_TOKEN);
    console.log(`[discord] Connected as ${this.client.user.tag}`);
  }

  async sendMessage(chatId, text) {
    const channel = await this.client.channels.fetch(chatId);
    const sentMessage = await channel.send(text);
    return { channel: sentMessage.channel, message: sentMessage };
  }

  async updateMessage(ref, text) {
    await ref.message.edit(text);
  }

  async addReaction(ref, emoji) {
    const unicodeEmoji = EMOJI_MAP[emoji] || emoji;
    await ref.message.react(unicodeEmoji);
  }
}
