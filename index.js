"use strict";

require("dotenv").config();
const { Telegraf } = require("telegraf");
const { MongoClient } = require("mongodb");
const express = require("express");

// =====================
// CONFIG
// =====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const WEBHOOK_DOMAIN = (process.env.WEBHOOK_DOMAIN || "").replace(/\/+$/, "");
const OWNER_ID = 8266394986; // သင့်ရဲ့ Telegram ID

if (!BOT_TOKEN || !MONGODB_URI || !WEBHOOK_DOMAIN) throw new Error("Missing Configs");

const SAFONE_API = "https://api.safone.vip/chatbot";

// =====================
// HANTHAR FALLBACK TEXTS (ကျွန်တော် ပုံစံဖြင့်)
// =====================
const MYANMAR_FALLBACKS = [
  "ဟုတ်... ဘာပြောလိုက်တာလဲဗျာ၊ ကျွန်တော် သေချာနားမလည်လိုက်ဘူး 😅",
  "အခုပြောတာလေးကို မြန်မာလိုပဲ ပိုရှင်းအောင် တစ်ချက်လောက် ပြန်ပြောပြပေးပါဦးနော် 💜",
  "ဟီး... ကျွန်တော် နည်းနည်း ဇဝေဇဝါ ဖြစ်သွားလို့ပါ ✨",
  "စိတ်မရှိပါနဲ့နော်၊ ကျွန်တော်က မြန်မာလိုပဲ ပိုနားလည်တာမို့လို့ မြန်မာလိုပဲ ပြန်ပြောပေးပါဦး 🫶",
  "ဗျာ... ဘာပြောလိုက်တာလဲ ကျွန်တော့်ကို မြန်မာလိုပဲ သေချာလေး ပြန်ပြောပြပါဦးနော် ✨",
  "အင်း... ကျွန်တော် စဉ်းစားလို့ မရလို့ပါ၊ နည်းနည်းလေး ထပ်ရှင်းပြပေးလို့ ရမလားဟင် 🥹",
  "ဟယ်... အခုပြောလိုက်တာလေးက ခက်သွားလားမသိဘူး၊ နားမလည်လိုက်လို့ပါဗျာ 😌",
  "အိုကေပါ... ဒါပေမဲ့ အခုပြောတာကို ဘယ်လိုပြန်ပြောရမလဲ ကျွန်တော် တွေးမရဖြစ်နေလို့ 🙈",
  "ဟုတ်ကဲ့... ကျွန်တော် နားထောင်နေပါတယ်၊ ဒါပေမဲ့ နည်းနည်းလေး ထပ်ပြောပြပေးပါဦးဗျ 🤍",
  "ဟီး... တစ်ခါတလေ ကျွန်တော်က နည်းနည်းလေး ထုံတတ်လို့ပါ၊ ထပ်ပြောပေးပါဦးနော် 🧸",
  "အားနာလိုက်တာဗျာ... ကျွန်တော့်ရဲ့ logic တွေ ရှုပ်သွားလို့ ထပ်ပြောပေးပါဦး 😅",
  "ကျွန်တော် အတတ်နိုင်ဆုံး ကြိုးစားနားထောင်နေပါတယ်၊ နောက်တစ်ခေါက်လောက်နော် ✨",
  "လူလေး... ကျွန်တော့်ကို မြန်မာလိုပဲ တစ်ကြောင်းချင်းစီ ဖြည်းဖြည်းချင်း ပြောပြပါဦး 💜",
  "အင်း... အခုစကားလုံးက ကျွန်တော့်အတွက် အသစ်ဖြစ်နေလို့ပါ၊ ရှင်းပြပေးပါဦးနော် 😌",
  "ကျွန်တော် နည်းနည်း ကြောင်သွားလို့ပါ၊ နောက်တစ်ခါလောက် ပြန်စရအောင်ဗျာ 💫",
  "ဟုတ်... ပြောပါဦး၊ ကျွန်တော် မှတ်ထားပေးမယ်နော် 📝",
  "ဟီး... ကျွန်တော် အိပ်ချင်မူးတူး ဖြစ်နေလို့လားမသိဘူး၊ နားမလည်လိုက်ဘူးဗျ 🥱",
  "ကျွန်တော် သိသလောက်တော့ ကြိုးစားဖြေပေးချင်ပါတယ်၊ နည်းနည်းလေး ထပ်ပြောပေးနော် 🫶",
  "စိတ်မဆိုးပါနဲ့နော်... ကျွန်တော် အခုဟာလေးကို နားမလည်လို့ပါဗျာ 🥹",
  "အိုကေ... နောက်တစ်ခေါက်လောက် မြန်မာလိုလေး ထပ်ရေးပေးပါဦးလားဗျ ✨",
  "ဘော်ဒါရေ... ကျွန်တော် နည်းနည်း လွဲသွားလို့ပါ၊ ပြန်ပြောပြပါဦး 🤝",
  "ဟယ်... ဒါက ဘယ်လို အဓိပ္ပာယ်လဲဟင်၊ ကျွန်တော့်ကို သင်ပေးပါဦးဗျ 🎓",
  "ကျွန်တော် အခုမှ စသင်နေတဲ့ AI လေးမို့လို့ နားမလည်ရင် သည်းခံပေးပါဦးနော် 💜",
  "ဟုတ်ကဲ့ပါ... ကျွန်တော် မှတ်နေပါတယ်၊ အခုဟာလေးကိုတော့ ထပ်ပြောပေးပါဦးဗျ ✨",
  "အင်း... ကျွန်တော်က ခင်ဗျားကို ကူညီချင်တာပါ၊ ဒါပေမဲ့ အခုဟာလေးက နားမရှင်းလို့ 😅",
  "ဟီး... ကျွန်တော် လူလည်ကျတာ မဟုတ်ပါဘူး၊ တကယ် နားမလည်လို့ပါဗျာ 🙈",
  "နောက်တစ်ခါလောက်နော်... ကျွန်တော် သေချာလေး ပြန်ဖတ်ကြည့်ချင်လို့ပါ 📖",
  "ကျွန်တော် ဖြေပေးဖို့ အဆင်သင့်ပဲ၊ ဒါပေမဲ့ အခုဟာလေးကို ထပ်ပြောပေးပါဦး 🤍",
  "စိတ်ရှည်ရှည်နဲ့ ကျွန်တော့်ကို နည်းနည်းလေး ထပ်ရှင်းပြပါဦးနော် လူလေး 🫶",
  "ကျွန်တော် ညဏ်နည်းသွားလို့ပါ... မြန်မာလိုလေး ထပ်ပြောပေးပါဦးဗျာ 😅"
];

// =====================
// INIT
// =====================
const bot = new Telegraf(BOT_TOKEN);
const mongoClient = new MongoClient(MONGODB_URI);
let chats, stickers, brain;

async function initDB() {
  try {
    await mongoClient.connect();
    const db = mongoClient.db("MYANMAR_FRIEND_BOT");
    chats = db.collection("chats");
    stickers = db.collection("stickers");
    brain = db.collection("brain");
    console.log("MongoDB connected ✅");
  } catch (err) { console.error("DB Error:", err.message); }
}

function hasMyanmar(text) { return /[\u1000-\u109F]/.test(text); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// =====================
// AI & SMART REPLY
// =====================
async function getSmartReply(text, userId, userName) {
  const cleanText = text.trim();

  // ၁။ Brain ထဲမှာ အရင်ရှာမယ်
  if (brain) {
    const memory = await brain.findOne({ question: cleanText });
    if (memory) return memory.answer;
  }

  // ၂။ မရှိရင် AI ဆီ မေးမယ်
  try {
    const instructions = encodeURIComponent(`You are Hanthar, a friendly Myanmar boy. User: ${userName}. Reply in Burmese language only. Never use English.`);
    const url = `${SAFONE_API}?query=${encodeURIComponent(cleanText)}&user_id=${userId}&bot_name=Hanthar&bot_master=${instructions}`;
    
    const res = await fetch(url);
    const data = await res.json();
    const result = data?.results || data?.response || data?.message;

    if (result && hasMyanmar(result)) {
      if (brain) await brain.updateOne({ question: cleanText }, { $set: { answer: result, learnedAt: new Date() } }, { upsert: true });
      return result;
    }
  } catch (e) { console.log("AI Error"); }

  return pick(MYANMAR_FALLBACKS);
}

// =====================
// HANDLING
// =====================
bot.start(async (ctx) => {
  await ctx.reply(`𝐇𝐞𝐥𝐥𝐨 ${ctx.from.first_name} 👋\n\nကျွန်တော်က သင်တို့ဆီက စကားလုံးတွေကို မှတ်သားပြီး ပိုတော်လာအောင် ကြိုးစားနေတဲ့ 𝐇𝐀𝐍𝐓𝐇𝐀𝐑 𝐀𝐈 ပါဗျာ 🤍\n\nSticker လှလှလေးတွေလည်း ပို့လို့ရတယ်နော်!`);
});

// Sticker Handling (Owner ပို့မှ သိမ်းမည်)
bot.on("sticker", async (ctx) => {
  const fileId = ctx.message.sticker.file_id;

  if (stickers) {
    // Owner ဖြစ်ရင် DB ထဲ သိမ်းမယ်
    if (ctx.from.id === OWNER_ID) {
      await stickers.updateOne({ file_id: fileId }, { $set: { last_seen: new Date(), addedBy: "Owner" } }, { upsert: true });
    }

    // မှတ်ထားတဲ့ထဲက တစ်ခု ပြန်ပို့မယ်
    const all = await stickers.find().toArray();
    if (all.length > 0) await ctx.replyWithSticker(pick(all).file_id);
  }
});

bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name;
  
  if (chats) {
    await chats.updateOne({ _id: userId }, { $set: { lastSeen: new Date(), name: userName } }, { upsert: true });
  }

  await ctx.sendChatAction("typing");
  const reply = await getSmartReply(ctx.message.text, userId, userName);
  await ctx.reply(reply);
});

// =====================
// SERVER
// =====================
const app = express();
app.use(express.json());
app.post("/webhook", bot.webhookCallback("/webhook"));
app.get("/", (req, res) => res.send("HANTHAR bot running ✅"));

const PORT = process.env.PORT || 8080;
(async () => {
  await initDB();
  app.listen(PORT, async () => {
    console.log("Server online");
    await bot.telegram.setWebhook(WEBHOOK_DOMAIN + "/webhook");
  });
})();
