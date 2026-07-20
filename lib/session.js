// In-memory session state used by the Telegram bot.
// Stores per-type exclusion sets and extra config lines for the current run.
// Automatically cleared after runAll() is triggered by the bot.

export const session = {
  excluded: {
    basic: /** @type {Set<number>} */ (new Set()),
    pro:   /** @type {Set<number>} */ (new Set()),
    ultra: /** @type {Set<number>} */ (new Set()),
  },
  /** Raw vless:// lines added manually via /add — appended to ARN Multi.txt */
  extraLines: /** @type {string[]} */ ([]),

  reset() {
    this.excluded.basic.clear();
    this.excluded.pro.clear();
    this.excluded.ultra.clear();
    this.extraLines = [];
  },

  hasChanges() {
    return (
      this.excluded.basic.size > 0 ||
      this.excluded.pro.size   > 0 ||
      this.excluded.ultra.size > 0 ||
      this.extraLines.length   > 0
    );
  },
};
