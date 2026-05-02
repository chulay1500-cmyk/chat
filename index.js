"use strict";

require("dotenv").config();
const { Telegraf } = require("telegraf");
const { MongoClient } = require("mongodb");
const express = require("express");

// =====================
// ENV & CONFIG
// =====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const WEBHOOK_DOMAIN = (process.env.WEBHOOK_DOMAIN || "").replace(/\/+$/, "");

if (!BOT_TOKEN || !MONGODB_URI || !WEBHOOK_DOMAIN) throw new Error("Missing Configs");

const SAFONE_API = "https://api.safone.vip/chatbot";

// AI နားမလည်ရင် သုံးဖို့ မြန်မာလို စာသားများ
const MYANMAR_FALLBACKS = [
  "ဟုတ်... ဘာပြောလိုက်တာလဲဗျာ၊ ကျွန်တော် သေချာနားမလည်လိုက်ဘူး 😅",
  "အခုပြောတာလေးကို မြန်မာလိုပဲ ပိုရှင်းအောင် တစ်ချက်လောက် ပြန်ပြောပြပေးပါဦးနော် 💜",
  "ဟီး... ကျွန်တော် နည်းနည်း ဇဝေဇဝါ ဖြစ်သွားလို့ပါ၊ နောက်တစ်ခေါက် ပြန်မေးကြည့်ပါဦးလား ✨",
  "စိတ်မရှိပါနဲ့နော်၊ ကျွန်တော်က မြန်မာလိုပဲ ပိုနားလည်တာမို့လို့ မြန်မာလိုပဲ ပြန်ပြောပေးပါဦး 🫶"
];

// =====================
// BOT & DB INIT
// =====================
const bot = new Telegraf(BOT_TOKEN);
const mongoClient = new MongoClient(MONGODB_URI);

let chats, stickers; // DB collections

async function initDB() {
  try {
    await mongoClient.connect();
    const db = mongoClient.db("MYANMAR_FRIEND_BOT");
    chats = db.collection("chats");
    stickers = db.collection("stickers"); // Sticker မှတ်ဖို့ collection
    console.log("MongoDB connected ✅");
  } catch (err) {
    console.error("MongoDB Connection Error:", err.message);
  }
}

// =====================
// HELPERS
// =====================
function hasMyanmar(text) {
  return /[\u1000-\u109F]/.test(text); // မြန်မာစာ Unicode ပါ/မပါ စစ်ခြင်း
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// =====================
// SAFONE AI CALL
// =====================
async function getAIReply(prompt, userId, userName) {
  try {
    const instructions = encodeURIComponent(
      `You are Hanthar, a friendly Myanmar boy. User name is ${userName}. ALWAYS reply in Burmese language only. Never use English.`
    );

    const url = `${SAFONE_API}?query=${encodeURIComponent(prompt)}&user_id=${userId}&bot_name=Hanthar&bot_master=${instructions}`;
    
    const res = await fetch(url);
    const data = await res.json();
    const finalResult = data?.results || data?.response || data?.message;

    // မြန်မာစာ မပါရင် သို့မဟုတ် အဖြေမရှိရင် Fallback သုံးမယ်
    if (!finalResult || !hasMyanmar(finalResult)) {
      return pick(MYANMAR_FALLBACKS);
    }

    return finalResult;
  } catch (err) {
    return pick(MYANMAR_FALLBACKS);
  }
}

// =====================
// COMMANDS
// =====================
bot.start(async (ctx) => {
  const welcomeText = `𝐇𝐞𝐥𝐥𝐨 ${ctx.from.first_name} 👋\n\n𝐇𝐀𝐍𝐓𝐇𝐀𝐑 𝐀𝐈 က ကြိုဆိုပါတယ်ဗျာ 🤍\n\nကျွန်တော်က မြန်မာလိုပဲ သေချာပြောမှာမို့လို့ စိတ်ကြိုက် စကားပြောလို့ရပါပြီ ✨\nSticker လေးတွေလည်း ပို့လို့ရတယ်နော်!`;

  await ctx.reply(welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "➕ Add to Group", url: `https://t.me/${ctx.botInfo.username}?startgroup=true` }],
        [{ text: "👨‍💻 DEV", url: "https://t.me/HANTHAR999" }]
      ]
    }
  });
});

// =====================
// STICKER HANDLING (Sticker မှတ်ပြီး ပြန်ပို့ခြင်း)
// =====================
bot.on("sticker", async (ctx) => {
  const fileId = ctx.message.sticker.file_id;

  // DB ထဲမှာ Sticker ကို သိမ်းမယ် (ရှိပြီးသားဆိုရင်လည်း update ဖြစ်သွားမယ်)
  if (stickers) {
    await stickers.updateOne(
      { file_id: fileId },
      { $set: { last_seen: new Date() } },
      { upsert: true }
    );

    // မှတ်ထားတဲ့ Sticker တွေထဲက တစ်ခုကို Random ပြန်ပို့မယ်
    const allStickers = await stickers.find().toArray();
    if (allStickers.length > 0) {
      const randomSticker = pick(allStickers);
      await ctx.replyWithSticker(randomSticker.file_id);
    }
  }
});

// =====================
// MESSAGE HANDLING
// =====================
bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  const userId = ctx.from.id;
  const userName = ctx.from.first_name;

  // User ရဲ့ နောက်ဆုံးစကားလုံးကို မှတ်မယ်
  if (chats) {
    await chats.updateOne(
      { _id: userId },
      { $set: { lastMsg: text, name: userName, lastSeen: new Date() } },
      { upsert: true }
    );
  }

  await ctx.sendChatAction("typing");
  const reply = await getAIReply(text, userId, userName);
  await ctx.reply(reply);
});

// =====================
// WEBHOOK & SERVER
// =====================
const app = express();
const SECRET_PATH = "/webhook"; 

app.use(express.json());
app.post(SECRET_PATH, bot.webhookCallback(SECRET_PATH));
app.get("/", (req, res) => res.send("HANTHAR bot running ✅"));

const PORT = process.env.PORT || 8080;

(async () => {
  await initDB();
  app.listen(PORT, async () => {
    console.log("Server running on port", PORT);
    try {
      await bot.telegram.setWebhook(WEBHOOK_DOMAIN + SECRET_PATH);
      console.log("Webhook set ✅");
    } catch (e) {
      console.error("Webhook Error:", e.message);
    }
  });
})();
