"use strict";

require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
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
// SAFONE API
// =====================
const SAFONE_API = "https://api.safone.vip/chatbot";

// =====================
// BOT & DB INIT
// =====================
const bot = new Telegraf(BOT_TOKEN);
const mongoClient = new MongoClient(MONGODB_URI);

let sessions;
let chats;

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
// SAFONE AI CALL (Updated Logic)
// =====================
async function getAIReply(prompt, userId) {
  try {
    // API Documentation အရ လိုအပ်တဲ့ parameters တွေ အကုန်ထည့်ထားပါတယ်
    const url = `${SAFONE_API}?query=${encodeURIComponent(prompt)}&user_id=${userId}&bot_name=Nora&bot_master=Hanthar`;
    
    const res = await fetch(url);
    const data = await res.json();

    // API က results သို့မဟုတ် response သို့မဟုတ် message ထဲမှာ အဖြေပေးတတ်ပါတယ်
    const finalResult = data?.results || data?.response || data?.message;

    if (finalResult) {
      return finalResult;
    } else {
      console.log("API Result Empty. Full Data:", JSON.stringify(data));
      return "နားမလည်ဘူး ဖြစ်နေတယ်ဗျာ😅 (API မှ အဖြေမရပါ)";
    }
  } catch (err) {
    console.log("Safone API Error:", err.message);
    return "AI error 🥲 (API ချိတ်ဆက်မှု အဆင်မပြေပါ)";
  }
}

// =====================
// COMMANDS
// =====================
bot.start(async (ctx) => {
  const name = getName(ctx);
  const welcomeText = `ဟယ်လို ${name} 👋\nHANTHAR AI ရဲ့ ကမ္ဘာလေးထဲကို ကြိုဆိုပါတယ်ဗျာ 🤍 \n\n ကျွန်​ေတာ်က သင့်အတွက် အဖော်မွန်လည်းဖြစ်၊ မေးသမျှကိုလည်း ဖြေကြားပေးမှာပါနော် ✨`;

  await ctx.reply(welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "➕ Add Nora to your group", url: `https://t.me/${ctx.botInfo.username}?startgroup=true` }],
        [
          { text: "📢 Support Channel", url: "https://t.me/myanmarbot_music" },
          { text: "🎧 Support Chat", url: "https://t.me/myanmar_music_Bot2027" }
        ],
        [{ text: "👨‍💻 Owner", url: "https://t.me/HANTHAR999" }]
      ]
    }
  });
});

bot.command("clear", async (ctx) => {
  if (sessions) {
    await sessions.deleteOne({ _id: ctx.from.id });
    await ctx.reply("Memory cleared ✅");
  }
});

// =====================
// MESSAGE HANDLING
// =====================
bot.on("text", async (ctx) => {
  const text = ctx.message.text;

  // Save to DB
  if (chats) {
    await chats.updateOne(
      { _id: ctx.chat.id },
      { $set: { lastSeen: new Date() } },
      { upsert: true }
    );
  }

  await ctx.sendChatAction("typing");

  // prompt နဲ့ user id ပို့ပြီး AI အဖြေယူမယ်
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
      // WEBHOOK_DOMAIN က https://... ဖြစ်ရပါမယ်
      await bot.telegram.setWebhook(WEBHOOK_DOMAIN + SECRET_PATH);
      console.log("Webhook set ✅");
    } catch (e) {
      console.error("Webhook Setup Error:", e.message);
    }
  });
})();
