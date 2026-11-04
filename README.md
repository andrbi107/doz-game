# 🎮 دوز (Doz) — بازی کلاسیک، تجربه‌ای مدرن

یک بازی **دوز (Tic-Tac-Toe)** حرفه‌ای و کاملاً **Vanilla** (بدون فریم‌ورک، بدون ابزار build)، ساخته‌شده با HTML، CSS و JavaScript خالص، همراه با سرور آنلاین Node.js.

<p align="center">
  <strong>PWA · ۶۷ دستاورد · ۳ سطح AI · بازی آنلاین · ELO · تورنمنت · لیگ فصلی · فروشگاه · Battle Pass</strong>
</p>

---

## 🚀 شروع سریع

### بازی آفلاین (بدون سرور)

کافیست فایل `index.html` را در مرورگر باز کنید یا از [سایت آنلاین](https://andrbi107.github.io/doz-game/) استفاده کنید.

### بازی آنلاین (با سرور)

برای استفاده از ویژگی‌های آنلاین (مچ‌میکینگ، ELO، دوستان، تورنمنت)، باید سرور را راه‌اندازی کنید.

---

## 🖥 راه‌اندازی سرور

### پیش‌نیازها

- **Node.js** نسخه ۱۸ یا بالاتر ([دانلود](https://nodejs.org/))
- **npm** (همراه Node.js نصب می‌شود)

### مراحل نصب

```bash
# ۱. وارد پوشه سرور شوید
cd server

# ۲. وابستگی‌ها را نصب کنید
npm install

# ۳. فایل تنظیمات بسازید
cp .env.example .env
# سپس فایل .env را ویرایش کرده و JWT_SECRET را تغییر دهید

# ۴. سرور را اجرا کنید
npm start
```

### خروجی مورد انتظار

```
Doz game server listening on port 3000
Health check: http://localhost:3000/health
CORS enabled for all origins
```

### تست سرور

سرور را تست کنید:

```bash
# Health check
curl http://localhost:3000/health
# خروجی: {"status":"ok","uptime":...,"playersOnline":0,"activeGames":0}

# ثبت‌نام کاربر
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"password123"}'
```

### پیکربندی کلاینت

کلاینت به‌طور پیش‌فرض به `http://localhost:3000` متصل می‌شود. برای تغییر آدرس سرور:

```javascript
// در کنسول مرورگر اجرا کنید
Online.setServerUrl('http://your-server-address:3000');
```

### تنظیمات (.env)

فایل `.env` در پوشه `server/`:

| متغیر | پیش‌فرض | توضیح |
|-------|---------|-------|
| `PORT` | `3000` | پورت سرور |
| `JWT_SECRET` | (هشدار: پیش‌فرض ناامن) | رمز امضای توکن JWT - **حتماً تغییر دهید** |

### اجرای سرور در پس‌زمینه (تولید)

برای محیط تولید، از PM2 استفاده کنید:

```bash
npm install -g pm2
pm2 start index.js --name doz-server
pm2 save
pm2 startup
```

### Troubleshooting

| مشکل | راه‌حل |
|------|--------|
| `Cannot access 'io' before initialization` | در v7.1.0 رفع شد. کد را به‌روزرسانی کنید. |
| `EADDRINUSE: address already in use :::3000` | پورت ۳۰۰۰ در حال استفاده است. `PORT=3001 npm start` را امتحان کنید. |
| کلاینت به سرور متصل نمی‌شود | آدرس سرور را با `Online.setServerUrl()` تنظیم کنید. |
| `npm install` خطا می‌دهد | `rm -rf node_modules package-lock.json && npm install` را اجرا کنید. |

---

## ✨ ویژگی‌ها

### 🎯 حالت‌های بازی
- **دو نفره محلی**: روی یک دستگاه با دو بازیکن
- **در برابر ربات**: با سه سطح دشواری (آسان، متوسط، سخت/شکست‌ناپذیر)
- **آنلاین تصادفی**: مچ‌میکینگ بر اساس ELO
- **اتاق خصوصی**: بازی با دوستان با کد دعوت

### 🧠 هوش مصنوعی
- **الگوریتم Minimax** با **هرس Alpha-Beta** برای ۳×۳ (شکست‌ناپذیر)
- **AI هیوریستیک** برای بوردهای ۴×۴ و ۵×۵

### 📱 PWA
- قابل نصب روی موبایل و دسکتاپ
- آفلاین کامل (Service Worker)
- میان‌برهای سریع

### 🏆 رقابتی
- **سیستم ELO** با ۵ دسته (برنز → الماس)
- **تورنمنت هفتگی** با براکت حذفی
- **لیگ فصلی** ۳۰ روزه با صعود/سقوط
- **Spectator Mode** برای تماشای بازی‌های زنده
- **Post-Game Analysis** با AI

### 🏅 پیشرفت
- **۶۷ دستاورد** با ۶ سطح کمیابی
- **سیستم XP و لول**
- **Battle Pass فصلی** (رایگان + پرمیوم)
- **فروشگاه** با ۱۹ آیتم cosmetic

### 👥 اجتماعی
- **لیست دوستان** با درخواست/پذیرش/مسدودسازی
- **پروفایل عمومی** با آمار کامل
- **جدول برترین‌ها** جهانی
- **چت emote** در حین بازی

### 🎨 شخصی‌سازی
- ۶ رنگ تم
- ۳۶+ آواتار قابل انتخاب
- تم روشن/تیره/خودکار
- حالت کوررنگی و کنتراست بالا

---

## 📁 ساختار پروژه

```
doz-game/
├── index.html              # ساختار اصلی صفحه
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── ROADMAP.md              # نقشه راه توسعه
├── BUG_REPORTS.md          # گزارش خطاها
├── css/
│   ├── themes.css          # متغیرهای تم
│   ├── style.css           # استایل اصلی
│   ├── components.css      # کامپوننت‌های v2-v7
│   ├── animations.css      # انیمیشن‌ها
│   └── responsive.css      # رسپانسیو
├── js/
│   ├── storage.js          # ذخیره‌سازی محلی
│   ├── audio.js            # افکت‌های صوتی (Web Audio API)
│   ├── game.js             # منطق بازی (پشتیبانی از ۳×۳/۴×۴/۵×۵)
│   ├── ai.js               # هوش مصنوعی (Minimax + هیوریستیک)
│   ├── achievements.js     # ۶۷ دستاورد
│   ├── timer.js            # تایمر حرکت
│   ├── replay.js           # بازپخش بازی
│   ├── chart.js            # نمودار Canvas
│   ├── online.js           # کلاینت WebSocket
│   ├── online-ui.js        # رابط آنلاین
│   ├── ui.js               # رابط کاربری
│   └── app.js              # کنترلر اصلی
├── server/                 # سرور Node.js
│   ├── index.js            # نقطه ورودی
│   ├── auth.js             # احراز هویت JWT
│   ├── elo.js              # محاسبه ELO
│   ├── matchmaker.js       # مچ‌میکینگ
│   ├── gameroom.js         # مدیریت اتاق بازی
│   ├── presence.js         # وضعیت آنلاین
│   ├── friends.js          # سیستم دوستان
│   ├── tournament.js       # تورنمنت
│   ├── league.js           # لیگ فصلی
│   ├── spectator.js        # تماشاچی
│   ├── analysis.js         # تحلیل بازی
│   ├── battlepass.js       # Battle Pass
│   ├── shop.js             # فروشگاه
│   ├── package.json        # وابستگی‌های سرور
│   └── .env.example        # نمونه تنظیمات
└── assets/                 # آیکون‌ها
```

---

## 🧪 تست‌ها

```bash
# تست‌های منطق بازی و AI
node scripts/test-doz.js

# تست‌های v3 (دستاوردها، XP، بوردهای متغیر)
node scripts/test-doz-v3.js

# تست‌های سرور (ELO، Auth، GameRoom، Presence، Matchmaker)
node scripts/test-server.js

# تست‌های دوستان
node scripts/test-friends.js

# تست‌های v6 (تورنمنت، لیگ، تماشا، تحلیل)
node scripts/test-v6.js

# تست‌های v7 (Battle Pass، فروشگاه)
node scripts/test-v7.js
```

**مجموع: ۲۱۷ تست** - همگی پاس

---

## 🌐 پشتیبانی مرورگرها

- ✅ Chrome / Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ مرورگرهای موبایل مدرن

---

## 📜 لایسنس

MIT License

---

## 📚 مستندات

- [ROADMAP.md](ROADMAP.md) - نقشه راه توسعه (۵ فاز)
- [BUG_REPORTS.md](BUG_REPORTS.md) - گزارش خطاها

---

## 👥 مشارکت

پیشنهاد یا باگ پیدا کردید؟ [Issue](https://github.com/andrbi107/doz-game/issues) باز کنید.

ساخته‌شده با ❤️ برای علاقه‌مندان به بازی‌های کلاسیک.
