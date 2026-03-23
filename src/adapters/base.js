export class BaseAdapter {
  name = '';
  capabilities = {
    canEditMessages: false,
    canReact: false,
    canThread: false,
    canSendImages: false,
    maxMessageLength: 4000,
    markdownFormat: 'standard',
  };

  // Called once on startup
  async connect() {
    throw new Error('implement connect()');
  }

  // Register message handler: fn({ chatId, text, userId })
  onMessage(fn) {
    this._handler = fn;
  }

  // Send a new message, returns a ref object for later updates
  async sendMessage(chatId, text) {
    throw new Error('implement sendMessage()');
  }

  // Edit a previously sent message (no-op if not supported)
  async updateMessage(ref, text) {
    /* no-op */
  }

  // Add emoji reaction (no-op if not supported)
  async addReaction(ref, emoji) {
    /* no-op */
  }
}
