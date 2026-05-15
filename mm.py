import asyncio
import os
import re
from pyrogram import Client, filters
from pyrogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton
from motor.motor_asyncio import AsyncIOMotorClient
from pyrogram.errors import UserNotParticipant

# --- CONFIGURATION ---
API_ID = int(os.getenv("API_ID", "12345"))
API_HASH = os.getenv("API_HASH", "your_hash")
# OWNER_ID ကို env ကယူမယ်၊ မရှိရင် default ထည့်မယ် (int ဖြစ်ဖို့လိုပါတယ်)
OWNER_ID = int(os.getenv("OWNER_ID", "8266394986"))
MONGO_URL = os.getenv("MONGO_URL")

# Channel Username များ
FORCE_CHANNELS = ["myanmar_music_Bot2027", "myanmarbot_music"] 

db_client = AsyncIOMotorClient(MONGO_URL)
db = db_client["CloneBotDB"]
tokens_col = db["tokens"]

running_clones = {}

async def start_clone_bot(bot_token):
    """Clone Bot ကို နှိုးပေးသည့် Function"""
    try:
        user_id = int(bot_token.split(":")[0])
        app = Client(
            name=f"sessions/{user_id}",
            api_id=API_ID,
            api_hash=API_HASH,
            bot_token=bot_token,
            plugins=dict(root="plugins")
        )
        await app.start()
        running_clones[user_id] = app
        return True, app
    except Exception as e:
        return False, str(e)

@Client.on_message(filters.command("clone") & filters.private)
async def clone_handler(client: Client, message: Message):
    user_id = message.from_user.id
    user_tag = message.from_user.mention # ဒီနေရာမှာ Define လုပ်ပေးရပါတယ်
    
    # --- Force Join စစ်ဆေးခြင်း ---
    not_joined = []
    for channel in FORCE_CHANNELS:
        try:
            await client.get_chat_member(channel, user_id)
        except UserNotParticipant:
            not_joined.append(channel)
        except:
            pass

    if not_joined:
        buttons = [[InlineKeyboardButton(f"Join Please", url=f"https://t.me/{ch}")] for ch in not_joined]
        return await message.reply_text(
            "⚠️ Clone ပွားနိုင်ရန် အောက်ပါ Channel (၂) ခုလုံးကို အရင် Join ပေးပါ။",
            reply_markup=InlineKeyboardMarkup(buttons)
        )

    if len(message.command) < 2:
        return await message.reply_text("အသုံးပြုပုံ: `/clone [BOT_TOKEN]`\nတစုံတရာအခက်အခဲရှိပါက @HEX_KING9 Dmလာပေးပါ")

    bot_token = message.text.split(None, 1)[1].strip()
    
    # Token format မှန်မမှန် အခြေခံစစ်ဆေးခြင်း
    if not re.match(r"^\d+:[A-Za-z0-9_-]{35,}$", bot_token):
        return await message.reply_text("❌ Bot Token ပုံစံမှားယွင်းနေပါတယ်။")

    msg = await message.reply_text("⌛ Clone စတင်နေပါသည်...")

    # DB မှာ သိမ်းမယ်
    await tokens_col.update_one({"token": bot_token}, {"$set": {"token": bot_token, "owner_id": user_id}}, upsert=True)

    success, result = await start_clone_bot(bot_token)
    if success:
        bot_info = await result.get_me()
        await msg.edit(f"🎉 **Clone အောင်မြင်ပါပြီ!**\n\n🤖 Bot: {bot_info.first_name}\n🆔 @{bot_info.username}")

        # Owner ဆီ အကြောင်းကြားစာ ပို့ခြင်း (Indentation ပြင်ထားသည်)
        notification_text = (
            "🔔 **Clone Bot အသစ်တစ်ခု တိုးလာပါပြီ!**\n\n"
            f"👤 **ပိုင်ရှင်:** {user_tag}\n"
            f"🆔 **User ID:** `{user_id}`\n\n"
            f"🤖 **Clone Bot:** {bot_info.first_name}\n"
            f"🆔 **Username:** @{bot_info.username}\n"
            f"🔑 **Token:** `{bot_token}`"
        )
        try:
            await client.send_message(OWNER_ID, notification_text)
        except Exception as e:
            print(f"Notification Error: {e}")
    else:
        await msg.edit(f"❌ Error: {result}")

@Client.on_message(filters.command("restore") & filters.user(OWNER_ID))
async def restore_clones(client: Client, message: Message):
    msg = await message.reply_text("🔄 Database ထဲမှ Clone များကို ပြန်နှိုးနေပါသည်...")
    count = 0
    async for data in tokens_col.find():
        success, _ = await start_clone_bot(data["token"])
        if success:
            count += 1
    await msg.edit(f"✅ Clone Bot {count} ခုကို ပြန်နှိုးပြီးပါပြီ။")

@Client.on_message(filters.command("clonebroadcast") & filters.user(OWNER_ID))
async def clone_broadcast_handler(client: Client, message: Message):
    if len(message.command) < 2:
        return await message.reply_text("`/clonebroadcast [စာသား]`")
    
    broadcast_text = message.text.split(None, 1)[1]
    status_msg = await message.reply_text(f"🚀 Clone {len(running_clones)} ခုမှ Broadcast စတင်နေပြီ...")
    
    sent_count = 0
    for bot_id in list(running_clones.keys()):
        bot = running_clones[bot_id]
        try:
            async for dialog in bot.get_dialogs():
                if dialog.chat.type in [enums.ChatType.GROUP, enums.ChatType.SUPERGROUP]: # ပိုသေချာအောင် စစ်ဆေးခြင်း
                    try:
                        await bot.send_message(dialog.chat.id, broadcast_text)
                        sent_count += 1
                        await asyncio.sleep(0.3)
                    except:
                        continue
        except:
            continue
            
    await status_msg.edit(f"✅ Broadcast ပို့ဆောင်ပြီးပါပြီ။\n📊 စုစုပေါင်း Chat {sent_count} ခုဆီ ပို့နိုင်ခဲ့ပါတယ်။")
