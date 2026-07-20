// Telegram bot for admin control of vless-updater.
//
// Commands:
//   /myid                    — show your user ID and chat ID (no auth, for setup)
//   /list [basic|pro|ultra]  — show configs with inline toggle buttons
//   /add <vless:// line>     — append a raw config to ARN Multi.txt this run
//   /status                  — show pending exclusions and extras
//   /run                     — push all files now with current session overrides
//   /reset                   — clear all pending changes
//   /help                    — show this help
//
// Set ADMIN_CHAT_ID env var to restrict the bot to one user/chat.
// If unset the bot responds to everyone (warning printed at startup).

import TelegramBot from "node-telegram-bot-api";
import { session } from "./lib/session.js";
import { buildBasicConfigs } from "./jobs/basic.js";
import { buildProConfigs } from "./jobs/pro.js";
import { buildUltraConfigs } from "./jobs/ultra.js";

const CONFIG_PREFIXES = ["vless://", "vmess://", "trojan://", "hysteria2://", "ss://"];

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/** Decode the #tag from a config line. */
function getConfigTag(line) {
  const idx = line.lastIndexOf("#");
  if (idx === -1) return line.slice(0, 60);
  try { return decodeURIComponent(line.slice(idx + 1)); }
  catch { return line.slice(idx + 1, idx + 61); }
}

/** Escape all Markdown special chars so tags never break message rendering. */
function escMd(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

/** Build plain-text list message (no Markdown parse_mode needed). */
function renderListMessage(type, configs) {
  const exc = session.excluded[type];
  const lines = configs.map((cfg, i) => {
    const pos = i + 1;
    const mark = exc.has(pos) ? "❌" : "✅";
    const tag = getConfigTag(cfg);
    return `${mark} ${pos}. ${tag}`;
  });

  const excluded = [...exc].sort((a, b) => a - b);
  const excNote = excluded.length ? `\nИсключено: ${excluded.join(", ")}` : "";
  return `📋 ${type.toUpperCase()} — ${configs.length} конф.${excNote}\n\n${lines.join("\n")}`;
}

/** Build inline keyboard for a type's config list. */
function buildKeyboard(type, total) {
  const exc = session.excluded[type];
  const rows = [];

  // Toggle buttons — 5 per row
  for (let i = 0; i < total; i += 5) {
    const row = [];
    for (let j = i; j < Math.min(i + 5, total); j++) {
      const pos = j + 1;
      const mark = exc.has(pos) ? "❌" : "✅";
      row.push({ text: `${mark}${pos}`, callback_data: `t:${type}:${pos}` });
    }
    rows.push(row);
  }

  rows.push([
    { text: "♻️ Сбросить", callback_data: `rs:${type}` },
    { text: "🚀 Обновить всё", callback_data: "run" },
  ]);

  return { inline_keyboard: rows };
}

// Cache fetched configs per type — populated on /list, reused on button presses.
const configCache = { basic: [], pro: [], ultra: [] };

async function fetchForType(type) {
  if (type === "basic") return buildBasicConfigs({ exclude: new Set() });
  if (type === "pro")   return buildProConfigs({ exclude: new Set() });
  if (type === "ultra") return buildUltraConfigs({ exclude: new Set() });
  throw new Error(`Unknown type: ${type}`);
}

// --------------------------------------------------------------------------
// Command regex factory
// Adds optional @botname suffix so commands work in groups and DMs alike.
// --------------------------------------------------------------------------
function cmd(pattern) {
  // pattern like "start|help" or "list(?:\\s+...)?"
  return new RegExp(`^\\/${pattern}(?:@\\w+)?(?:\\s|$)`, "i");
}

// --------------------------------------------------------------------------
// Bot startup
// --------------------------------------------------------------------------

/**
 * @param {(overrides?: { excludes?: object, extraLines?: string[] }) => Promise<void>} runAllFn
 */
export function startBot(runAllFn) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.warn("[bot] BOT_TOKEN not set — Telegram bot disabled.");
    return;
  }

  // Accept both numeric and string comparison to be safe.
  const ADMIN_RAW = process.env.ADMIN_CHAT_ID || "";
  const ADMIN_NUM = ADMIN_RAW ? parseInt(ADMIN_RAW.trim(), 10) : null;
  const ADMIN_STR = ADMIN_RAW.trim();

  if (!ADMIN_NUM) {
    console.warn("[bot] ADMIN_CHAT_ID not set — bot responds to ALL users.");
  } else {
    console.log(`[bot] Admin restricted to ID ${ADMIN_NUM}.`);
  }

  let bot;
  try {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
  } catch (err) {
    console.error("[bot] Failed to create bot instance:", err.message);
    return;
  }

  // ---------- Access check ----------
  function isAllowed(fromId, chatId) {
    if (!ADMIN_NUM) return true;
    return (
      fromId === ADMIN_NUM ||
      chatId === ADMIN_NUM ||
      String(fromId) === ADMIN_STR ||
      String(chatId) === ADMIN_STR
    );
  }

  function allowed(msg) {
    return isAllowed(msg.from?.id, msg.chat?.id);
  }

  function deny(chatId) {
    return bot.sendMessage(chatId, "⛔ Доступ запрещён.");
  }

  // ---------- /myid — no auth, for initial setup ----------
  bot.onText(cmd("myid"), (msg) => {
    const fromId = msg.from?.id ?? "?";
    const chatId = msg.chat?.id ?? "?";
    const text =
      `🆔 Ваш user ID: ${fromId}\n` +
      `💬 Chat ID: ${chatId}\n\n` +
      `Установите ADMIN_CHAT_ID=${fromId} в переменных Railway.`;
    bot.sendMessage(msg.chat.id, text).catch(console.error);
  });

  // ---------- /help, /start ----------
  bot.onText(cmd("(?:help|start)"), (msg) => {
    if (!allowed(msg)) return deny(msg.chat.id);
    const text =
      "vless-updater бот\n\n" +
      "/list [basic|pro|ultra] — список конфигов с кнопками\n" +
      "/add <vless:// строка> — добавить конфиг в Multi на этот раз\n" +
      "/status — текущие изменения сессии\n" +
      "/run — обновить GitHub прямо сейчас\n" +
      "/reset — сбросить сессию\n" +
      "/myid — узнать свой ID\n" +
      "/help — эта справка";
    bot.sendMessage(msg.chat.id, text).catch(console.error);
  });

  // ---------- /list ----------
  bot.onText(cmd("list(?:\\s+(basic|pro|ultra))?"), async (msg, match) => {
    if (!allowed(msg)) return deny(msg.chat.id);
    const chatId = msg.chat.id;
    // match[1] is the type if provided, ignoring any trailing @botname
    const type = (match[1] || "").toLowerCase().trim();

    if (!type) {
      bot.sendMessage(chatId, "Выберите список:", {
        reply_markup: {
          inline_keyboard: [[
            { text: "📋 Basic", callback_data: "list:basic" },
            { text: "📋 Pro",   callback_data: "list:pro" },
            { text: "📋 Ultra", callback_data: "list:ultra" },
          ]],
        },
      }).catch(console.error);
      return;
    }

    let waitMsg;
    try {
      waitMsg = await bot.sendMessage(chatId, `⏳ Загружаю ${type.toUpperCase()}…`);
    } catch (err) {
      console.error("[bot] sendMessage failed:", err.message);
      return;
    }

    try {
      const configs = await fetchForType(type);
      configCache[type] = configs;
      await bot.editMessageText(renderListMessage(type, configs), {
        chat_id: chatId,
        message_id: waitMsg.message_id,
        reply_markup: buildKeyboard(type, configs.length),
      });
    } catch (err) {
      console.error("[bot] /list error:", err.message);
      bot.editMessageText(`❌ Ошибка: ${err.message}`, {
        chat_id: chatId,
        message_id: waitMsg.message_id,
      }).catch(() => {});
    }
  });

  // ---------- /add ----------
  bot.onText(cmd("add(?:\\s+(.+))?"), (msg, match) => {
    if (!allowed(msg)) return deny(msg.chat.id);
    const line = (match[1] || "").trim();
    if (!line) {
      return bot.sendMessage(msg.chat.id, "Использование: /add <vless://...>").catch(console.error);
    }
    if (!CONFIG_PREFIXES.some(p => line.startsWith(p))) {
      return bot.sendMessage(msg.chat.id,
        "❌ Строка должна начинаться с vless://, vmess://, trojan://, hysteria2:// или ss://"
      ).catch(console.error);
    }
    session.extraLines.push(line);
    bot.sendMessage(msg.chat.id,
      `✅ Добавлено в ARN Multi.txt (всего доп. конфигов: ${session.extraLines.length})\n${line.slice(0, 100)}`
    ).catch(console.error);
  });

  // ---------- /status ----------
  bot.onText(cmd("status"), (msg) => {
    if (!allowed(msg)) return deny(msg.chat.id);
    const lines = [];
    for (const type of ["basic", "pro", "ultra"]) {
      const exc = [...session.excluded[type]].sort((a, b) => a - b);
      if (exc.length) lines.push(`${type.toUpperCase()} — исключено: ${exc.join(", ")}`);
    }
    if (session.extraLines.length) {
      lines.push(`Extra — добавлено строк: ${session.extraLines.length}`);
    }
    const text = lines.length
      ? `📊 Текущая сессия:\n\n${lines.join("\n")}`
      : "✅ Сессия чистая — изменений нет.";
    bot.sendMessage(msg.chat.id, text).catch(console.error);
  });

  // ---------- /reset ----------
  bot.onText(cmd("reset"), (msg) => {
    if (!allowed(msg)) return deny(msg.chat.id);
    session.reset();
    bot.sendMessage(msg.chat.id, "♻️ Сессия сброшена.").catch(console.error);
  });

  // ---------- /run ----------
  bot.onText(cmd("run"), async (msg) => {
    if (!allowed(msg)) return deny(msg.chat.id);
    await triggerRun(msg.chat.id, bot, runAllFn);
  });

  // ---------- Inline button callbacks ----------
  bot.on("callback_query", async (query) => {
    const chatId = query.message?.chat?.id;
    const msgId  = query.message?.message_id;
    if (!chatId || !msgId) return;

    if (!isAllowed(query.from?.id, chatId)) {
      return bot.answerCallbackQuery(query.id, { text: "⛔ Доступ запрещён." }).catch(() => {});
    }

    const data = query.data || "";

    // list:<type>
    if (data.startsWith("list:")) {
      const type = data.slice(5);
      bot.answerCallbackQuery(query.id).catch(() => {});
      try {
        await bot.editMessageText(`⏳ Загружаю ${type.toUpperCase()}…`, {
          chat_id: chatId, message_id: msgId,
        });
        const configs = await fetchForType(type);
        configCache[type] = configs;
        await bot.editMessageText(renderListMessage(type, configs), {
          chat_id: chatId, message_id: msgId,
          reply_markup: buildKeyboard(type, configs.length),
        });
      } catch (err) {
        console.error("[bot] list callback error:", err.message);
        bot.editMessageText(`❌ ${err.message}`, { chat_id: chatId, message_id: msgId }).catch(() => {});
      }
      return;
    }

    // t:<type>:<pos> — toggle
    if (data.startsWith("t:")) {
      const parts = data.split(":");
      const type = parts[1];
      const pos = parseInt(parts[2], 10);
      if (!type || !pos || !session.excluded[type]) {
        return bot.answerCallbackQuery(query.id).catch(() => {});
      }

      const exc = session.excluded[type];
      if (exc.has(pos)) {
        exc.delete(pos);
        bot.answerCallbackQuery(query.id, { text: `✅ ${pos} включён` }).catch(() => {});
      } else {
        exc.add(pos);
        bot.answerCallbackQuery(query.id, { text: `❌ ${pos} исключён` }).catch(() => {});
      }

      const configs = configCache[type];
      if (!configs?.length) return;
      try {
        await bot.editMessageText(renderListMessage(type, configs), {
          chat_id: chatId, message_id: msgId,
          reply_markup: buildKeyboard(type, configs.length),
        });
      } catch { /* "message not modified" — ok */ }
      return;
    }

    // rs:<type> — reset one type; rs — reset all
    if (data.startsWith("rs")) {
      const type = data.startsWith("rs:") ? data.slice(3) : null;
      if (type && session.excluded[type]) {
        session.excluded[type].clear();
        bot.answerCallbackQuery(query.id, { text: `♻️ ${type.toUpperCase()} сброшен` }).catch(() => {});
        const configs = configCache[type];
        if (configs?.length) {
          try {
            await bot.editMessageText(renderListMessage(type, configs), {
              chat_id: chatId, message_id: msgId,
              reply_markup: buildKeyboard(type, configs.length),
            });
          } catch { /* ok */ }
        }
      } else {
        session.reset();
        bot.answerCallbackQuery(query.id, { text: "♻️ Сессия сброшена" }).catch(() => {});
      }
      return;
    }

    // run
    if (data === "run") {
      bot.answerCallbackQuery(query.id, { text: "🚀 Запускаю обновление…" }).catch(() => {});
      await triggerRun(chatId, bot, runAllFn);
      return;
    }

    bot.answerCallbackQuery(query.id).catch(() => {});
  });

  bot.on("polling_error", (err) => {
    console.error("[bot] Polling error:", err.code, err.message);
  });

  bot.on("error", (err) => {
    console.error("[bot] Bot error:", err.message);
  });

  console.log("[bot] Telegram bot started (polling).");
}

// --------------------------------------------------------------------------
// Trigger a full run with current session overrides
// --------------------------------------------------------------------------
async function triggerRun(chatId, bot, runAllFn) {
  const statusLines = [];
  for (const type of ["basic", "pro", "ultra"]) {
    const exc = [...session.excluded[type]].sort((a, b) => a - b);
    if (exc.length) statusLines.push(`${type.toUpperCase()}: исключено ${exc.join(", ")}`);
  }
  if (session.extraLines.length) {
    statusLines.push(`Extra: +${session.extraLines.length} конфигов в Multi`);
  }

  const note = statusLines.length
    ? `\nИзменения: ${statusLines.join(" | ")}`
    : "\nОбычный запуск — без изменений.";

  let waitMsg;
  try {
    waitMsg = await bot.sendMessage(chatId, `⏳ Обновляю GitHub…${note}`);
  } catch (err) {
    console.error("[bot] triggerRun sendMessage failed:", err.message);
    return;
  }

  const overrides = {
    excludes: {
      basic: new Set(session.excluded.basic),
      pro:   new Set(session.excluded.pro),
      ultra: new Set(session.excluded.ultra),
    },
    extraLines: [...session.extraLines],
  };

  // Clear session before running so next run is clean even if this fails.
  session.reset();

  try {
    const t0 = Date.now();
    await runAllFn(overrides);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    bot.editMessageText(`✅ Готово за ${elapsed}с. GitHub обновлён.`, {
      chat_id: chatId, message_id: waitMsg.message_id,
    }).catch(console.error);
  } catch (err) {
    console.error("[bot] runAll error:", err.message);
    bot.editMessageText(`❌ Ошибка: ${err.message}`, {
      chat_id: chatId, message_id: waitMsg.message_id,
    }).catch(console.error);
  }
}
