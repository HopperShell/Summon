import { Bot } from 'grammy';
import { BaseAdapter } from './base.js';

const EMOJI_MAP = {
  white_check_mark: '\u2705',
  x: '\u274C',
  hourglass_flowing_sand: '\u23F3',
};

export class TelegramAdapter extends BaseAdapter {
  constructor() {
    super();
    this.name = 'telegram';
    this.capabilities = {
      canEditMessages: true,
      canReact: true,
      canThread: false,
      maxMessageLength: 4096,
      markdownFormat: 'telegram-html',
    };
    this.bot = null;
  }

  async connect() {
    this.bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

    this.bot.on('message:text', (ctx) => {
      if (ctx.chat.type !== 'private') return;

      this._handler({
        chatId: String(ctx.chat.id),
        text: ctx.message.text,
        userId: String(ctx.from.id),
      });
    });

    this.bot.start();
    console.log('[telegram] Connected');
  }

  async sendMessage(chatId, text) {
    const msg = await this.bot.api.sendMessage(Number(chatId), text, { parse_mode: 'HTML' });
    return { chatId: Number(chatId), messageId: msg.message_id };
  }

  async updateMessage(ref, text) {
    try {
      await this.bot.api.editMessageText(ref.chatId, ref.messageId, text, { parse_mode: 'HTML' });
    } catch (err) {
      // Telegram throws if text is unchanged — safe to ignore
    }
  }

  async addReaction(ref, emoji) {
    const unicodeEmoji = EMOJI_MAP[emoji] || emoji;
    try {
      await this.bot.api.setMessageReaction(ref.chatId, ref.messageId, [{ type: 'emoji', emoji: unicodeEmoji }]);
    } catch (err) {
      // Reactions may fail on older clients or restricted chats — safe to ignore
    }
  }
}
