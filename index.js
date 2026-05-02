"use strict";

require("dotenv").config();
const { Telegraf } = require("telegraf");
const { MongoClient } = require("mongodb");
const express = require("express");

// =====================
// ENV
// =====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const WEBHOOK_DOMAIN = (process.env.WEBHOOK_DOMAIN || "").replace(/\/+$/, "");

if (!BOT_TOKEN) throw new Error("Missing BOT_TOKEN");
if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");
if (!WEBHOOK_DOMAIN) throw new Error("Missing WEBHOOK_DOMAIN");

// =====================
// SAFONE API & FALLBACK DATA
// =====================
const SAFONE_API = "https://api.safone.vip/chatbot";

// AI နားမလည်ရင် သုံးဖို့ မြန်မာလို Template စာသားများ
const MYANMAR_FALLBACKS = [
  "ဟုတ်... ဘာပြောလိုက်တာလဲ၊ ကျွန်တော် သေချာနားမလည်လိုက်ဘူး 😅",
  "ဟုတ်ကဲ့ဗျာ၊ အခုပြောတာလေးကို မြန်မာလိုပဲ ပိုရှင်းအောင် တစ်ချက်လောက် ပြန်ပြောပြပေးပါဦးနော် 💜",
  "ဟီး... ကျွန်တော် နည်းနည်း ဇဝေဇဝါ ဖြစ်သွားလို့ပါ၊ နောက်တစ်ခေါက် ပြန်မေးကြည့်ပါဦးလားဗျ ✨",
  "အိုကေပါ၊ ကျွန်တော် နားထောင်နေတယ်နော်။ ဒါပေမဲ့ အခုပြောတာကို ဘယ်လိုပြန်ဖြေရမလဲ စဉ်းစားမရလို့ပါဗျာ 😌",
  "စိတ်မရှိပါနဲ့နော်၊ ကျွန်တော် က မြန်မာလိုပဲ ပိုနားလည်တာမို့လို့ မြန်မာလိုပဲ ပြန်ပြောပေးပါဦး 🫶"
];

// =====================
// BOT & DB INIT
// =====================
const bot = new Telegraf(BOT_TOKEN);
const mongoClient = new MongoClient(MONGODB_URI);

let sessions, chats;

async function initDB() {
  try {
    await mongoClient.connect();
    const db = mongoClient.db("MYANMAR_FRIEND_BOT");
    sessions = db.collection("sessions");
    chats = db.collection("chats");
    console.log("MongoDB connected ✅");
  } catch (err) {
    console.error("MongoDB Connection Error:", err.message);
  }
}

// =====================
// HELPERS
// =====================
function getName(ctx) {
  return ctx.from?.first_name || "friend";
}

async function sendLong(ctx, text) {
  if (!text) return;
  const limit = 3900;
  for (let i = 0; i < text.length; i += limit) {
    await ctx.reply(text.substring(i, i + limit));
  }
}

// =====================
// SAFONE AI CALL (Updated with strict Myanmar instructions)
// =====================
async function getAIReply(prompt, userId) {
  try {
    const botName = encodeURIComponent("Hanthar");
    // AI ကို မြန်မာလိုပဲ ဖြေဖို့ အသေအလဲ ညွှန်ကြားထားပါတယ်
    const instructions = encodeURIComponent(
      "You are Hanthar, a friendly Myanmar AI. YOU MUST REPLY ONLY IN BURMESE (MYANMAR) LANGUAGE. Never use English. If you don't understand, be polite in Burmese."
    );

    const url = `${SAFONE_API}?query=${encodeURIComponent(prompt)}&user_id=${userId}&bot_name=${botName}&bot_master=${instructions}`;
    
    const res = await fetch(url);
    const data = await res.json();
    const finalResult = data?.results || data?.response || data?.message;

    // အကယ်၍ အဖြေပြန်မလာရင် သို့မဟုတ် အဖြေက English ဖြစ်နေရင် Fallback သုံးမယ်
    if (!finalResult || /^[A-Za-z\s.,!?]+$/.test(finalResult)) {
      return MYANMAR_FALLBACKS[Math.floor(Math.random() * MYANMAR_FALLBACKS.length)];
    }

    return finalResult;
  } catch (err) {
    console.log("Safone Error:", err.message);
    return MYANMAR_FALLBACKS[0]; // Error တက်ရင်လည်း မြန်မာလိုပဲ ပြန်မယ်
  }
}

// =====================
// COMMANDS
// =====================
bot.start(async (ctx) => {
  const name = getName(ctx);
  const welcomeText = `𝐇𝐞𝐥𝐥𝐨 ${name} 👋\n\n𝐇𝐀𝐍𝐓𝐇𝐀𝐑 𝐀𝐈 ရဲ့ ကမ္ဘာလေးထဲကို ကြိုဆိုပါတယ်ဗျာ 🤍\n\nကျွန်တော်က သင့်အတွက် အဖော်မွန်လည်းဖြစ်၊ မေးသမျှကိုလည်း မြန်မာလို သေချာဖြေကြားပေးမှာပါနော် ✨`;

  await ctx.reply(welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "➕ Add Nora to your group", url: `https://t.me/${ctx.botInfo.username}?startgroup=true` }],
        [
          { text: "📢 Support Channel", url: "https://t.me/myanmarbot_music" },
          { text: "🎧 Support Chat", url: "https://t.me/myanmar_music_Bot2027" }
        ],
        [{ text: "👨‍💻 DEV", url: "https://t.me/HANTHAR999" }]
      ]
    }
  });
});

bot.command("clear", async (ctx) => {
  if (sessions) {
    await sessions.deleteOne({ _id: ctx.from.id });
    await ctx.reply("𝐌𝐞𝐦𝐨𝐫𝐲 𝐜𝐥𝐞𝐚𝐫𝐞𝐝 ✅");
  }
});

// =====================
// MESSAGE HANDLING
// =====================
bot.on("text", async (ctx) => {
  const text = ctx.message.text;

  if (chats) {
    await chats.updateOne(
      { _id: ctx.chat.id },
      { $set: { lastSeen: new Date() } },
      { upsert: true }
    );
  }

  await ctx.sendChatAction("typing");

  const reply = await getAIReply(text, ctx.from.id);
  await sendLong(ctx, reply);
});

// =====================
// WEBHOOK & SERVER
// =====================
const app = express();
const SECRET_PATH = "/webhook"; 

app.get("/", (req, res) => {
  res.send("HANTHAR bot running ✅");
});

app.post(SECRET_PATH, express.json(), bot.webhookCallback(SECRET_PATH));

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
