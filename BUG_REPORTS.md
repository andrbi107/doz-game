# 🐛 گزارش خطاها (Bug Reports)

این سند تمام خطاهای شناسایی‌شده در بازی دوز را ثبت می‌کند - چه خطاهای گزارش‌شده توسط کاربران و چه خطاهای شناسایی‌شده توسط توسعه‌دهنده. هر خطا شامل شرح، علت، راه‌حل و وضعیت است.

> **آخرین به‌روزرسانی:** ۲۰۲۶-۱۱-۰۴

---

## 📊 خلاصه

| # | عنوان | شدت | وضعیت | نسخه |
|---|-------|------|--------|------|
| 1 | Cannot access 'io' before initialization | 🔴 بحرانی | ✅ رفع شد | v7.1.0 |
| 2 | Health check: Presence.getOnlineCount is not a function | 🟡 متوسط | ✅ رفع شد | v7.1.0 |
| 3 | هشدار deprecation پکیج uuid | 🟢 کم | ✅ رفع شد | v7.1.0 |
| 4 | آسیب‌پذیری امنیتی moderate در وابستگی‌ها | 🟡 متوسط | ✅ رفع شد | v7.1.0 |
| 5 | عدم وجود فایل .env.example برای تنظیمات سرور | 🟢 کم | ✅ رفع شد | v7.1.0 |
| 6 | نبود راهنمای کامل راه‌اندازی سرور در README | 🟡 متوسط | ✅ رفع شد | v7.1.0 |
| 7 | SW registration در file:// protocol | 🟢 کم | ✅ رفع شد | v7.2.0 |
| 8 | CORS خطا در manifest.json از file:// | 🟢 کم | ✅ رفع شد | v7.2.0 |
| 9 | socket is not defined در joinSpectate | 🔴 بحرانی | ✅ رفع شد | v7.2.0 |
| 10 | 401 Unauthorized - راهنمایی ثبت‌نام | 🟡 متوسط | ✅ رفع شد | v7.2.0 |
| 11 | مدیریت token expiry و 401 خطاها | 🟡 متوسط | ✅ رفع شد | v7.2.0 |
| 12 | نبود تنظیمات Server URL در UI | 🟡 متوسط | ✅ رفع شد | v7.2.0 |
| 13 | بهبود پیام‌های خطا و تجربه کاربری | 🟡 متوسط | ✅ رفع شد | v7.2.0 |
| 14 | بازی آنلاین شروع نمی‌شود - game:role جداگانه | 🔴 بحرانی | ✅ رفع شد | v7.3.0 |
| 15 | "Not Connected" در ورود با کد اتاق | 🔴 بحرانی | ✅ رفع شد | v7.3.0 |
| 16 | "نوبت شما نیست" برای کاربر 2 | 🔴 بحرانی | ✅ رفع شد | v7.3.0 |
| 17 | هشدار deprecation apple-mobile-web-app-capable | 🟢 کم | ✅ رفع شد | v7.3.0 |
| 18 | هشدار beforeinstallpromptevent | 🟢 کم | ✅ رفع شد | v7.3.0 |

---

## 🔴 BUG-001: Cannot access 'io' before initialization

| فیلد | مقدار |
|------|-------|
| **شناسه** | BUG-001 |
| **تاریخ گزارش** | ۲۰۲۶-۱۱-۰۴ |
| **گزارش‌دهنده** | کاربر (andrbi107) |
| **شدت** | 🔴 بحرانی (سرور اجرا نمی‌شود) |
| **نسخه affected** | v6.0.0, v7.0.0 |
| **وضعیت** | ✅ رفع شد در v7.1.0 |

### شرح خطا

هنگام اجرای `npm start` در پوشه `server/`، سرور با خطای زیر کرش می‌کند:

```
ReferenceError: Cannot access 'io' before initialization
    at Object.<anonymous> (D:\doz-game\server\index.js:68:38)
```

### علت

در فایل `server/index.js`، نمونه‌های `tournament`، `league`، `spectator`، `battlepass` و `shop` در خطوط ۶۸-۷۴ ساخته می‌شدند، اما همگی به متغیر `io` ارجاع داشتند که در خط ۲۴۰ (یعنی ۱۷۰ خط پایین‌تر) تعریف می‌شد. در جاوااسکریپت، متغیرهای `const` و `let` در temporal dead zone (TDZ) هستند تا قبل از تعریف، و دسترسی به آن‌ها باعث `ReferenceError` می‌شود.

همچنین متغیر `presence` نیز در خط ۶۸ استفاده شده بود اما در خط ۲۶۱ تعریف می‌شد.

### ساختار اشتباه (قبل از رفع)

```
خط 65: const friends = Friends.create(store);
خط 68: const tournament = Tournament.create(io, ...);  ← io هنوز تعریف نشده!
خط 69: const league = League.create(io, store);         ← io هنوز تعریف نشده!
خط 70: const spectator = Spectator.create(io);          ← io هنوز تعریف نشده!
...
خط 240: const io = new Server(server, ...);             ← تعریف io در اینجا
خط 261: const presence = Presence.create(io);           ← تعریف presence در اینجا
```

### راه‌حل

بازنظمی کد `index.js` به‌صورت زیر:

1. ابتدا `app` و `server` و `io` ساخته شوند
2. سپس `presence` و `matchmaking` ساخته شوند (نیاز به `io` دارند)
3. سپس سرویس‌های `friends`، `tournament`، `league`، `spectator`، `battlepass`، `shop` ساخته شوند
4. سپس routes تعریف شوند
5. سپس socket.io handlers تعریف شوند
6. در نهایت سرور listen کند

### فایل‌های تغییر یافته

- `server/index.js` - بازنظمی کامل ترتیب تعریف متغیرها

### تست

پس از رفع، سرور باید بدون خطا اجرا شود:
```bash
cd server && npm start
# خروجی مورد انتظار:
# Doz game server listening on port 3000
# Health check: http://localhost:3000/health
```

---

## 🟡 BUG-002: Health check: Presence.getOnlineCount is not a function

| فیلد | مقدار |
|------|-------|
| **شناسه** | BUG-002 |
| **تاریخ گزارش** | ۲۰۲۶-۱۱-۰۴ |
| **گزارش‌دهنده** | توسعه‌دهنده (شناسایی خودکار) |
| **شدت** | 🟡 متوسط (health check کار نمی‌کند) |
| **نسخه affected** | v4.0.0 - v7.0.0 |
| **وضعیت** | ✅ رفع شد در v7.1.0 |

### شرح خطا

در endpoint `/health`، کد `Presence.getOnlineCount()` صدا زده می‌شد. اما `Presence` ماژولی است که فقط تابع `create` را export می‌کند. تابع `getOnlineCount` روی نمونه (instance) ساخته‌شده توسط `create` وجود دارد، نه روی خود ماژول.

### علت

```javascript
// presence.js
module.exports = { create };  // فقط create export می‌شود

// index.js (اشتباه)
app.get('/health', (req, res) => {
    playersOnline: Presence.getOnlineCount(),  // ← وجود ندارد!
});
```

### راه‌حل

استفاده از نمونه `presence` ساخته‌شده به‌جای ماژول:

```javascript
// index.js (اصلاح‌شده)
app.get('/health', (req, res) => {
    playersOnline: presence.getOnlineCount(),  // ← نمونه ساخته‌شده
});
```

برای این کار، endpoint `/health` باید بعد از تعریف `presence` منتقل شود.

---

## 🟢 BUG-003: هشدار deprecation پکیج uuid

| فیلد | مقدار |
|------|-------|
| **شناسه** | BUG-003 |
| **تاریخ گزارش** | ۲۰۲۶-۱۱-۰۴ |
| **گزارش‌دهنده** | کاربر (andrbi107) |
| **شدت** | 🟢 کم (هشدار) |
| **نسخه affected** | v4.0.0 - v7.0.0 |
| **وضعیت** | ✅ رفع شد در v7.1.0 |

### شرح خطا

هنگام `npm install`، هشدار زیر نمایش داده می‌شود:

```
npm warn deprecated uuid@9.0.1: uuid@10 and below is no longer supported.
For ESM codebases, update to uuid@latest.
For CommonJS codebases, use uuid@11
```

### علت

فایل `package.json` از `uuid@^9.0.1` استفاده می‌کرد که deprecate شده است.

### راه‌حل

به‌روزرسانی به `uuid@^11.0.0`:

```json
// package.json
"dependencies": {
    "uuid": "^11.0.0",
    ...
}
```

سینتکس import نیز سازگار است (`const { v4: uuidv4 } = require('uuid')` در uuid@11 همچنان کار می‌کند).

---

## 🟡 BUG-004: آسیب‌پذیری امنیتی moderate در وابستگی‌ها

| فیلد | مقدار |
|------|-------|
| **شناسه** | BUG-004 |
| **تاریخ گزارش** | ۲۰۲۶-۱۱-۰۴ |
| **گزارش‌دهنده** | کاربر (andrbi107) |
| **شدت** | 🟡 متوسط |
| **نسخه affected** | v4.0.0 - v7.0.0 |
| **وضعیت** | ✅ رفع شد در v7.1.0 |

### شرح خطا

`npm install` گزارش می‌دهد: `1 moderate severity vulnerability`

### علت

پکیج `uuid@9` وابستگی‌های قدیمی داشت که آسیب‌پذیری moderate داشتند.

### راه‌حل

1. به‌روزرسانی `uuid` به `^11.0.0`
2. اجرای `npm audit fix` برای رفع خودکار
3. بررسی `npm audit` برای تأیید رفع

---

## 🟢 BUG-005: عدم وجود فایل .env.example

| فیلد | مقدار |
|------|-------|
| **شناسه** | BUG-005 |
| **تاریخ گزارش** | ۲۰۲۶-۱۱-۰۴ |
| **گزارش‌دهنده** | توسعه‌دهنده (شناسایی خودکار) |
| **شدت** | 🟢 کم |
| **نسخه affected** | v4.0.0 - v7.0.0 |
| **وضعیت** | ✅ رفع شد در v7.1.0 |

### شرح

سرور از متغیرهای محیطی `PORT` و `JWT_SECRET` استفاده می‌کند، اما فایل `.env.example` برای راهنمایی کاربران وجود نداشت.

### راه‌حل

ایجاد فایل `server/.env.example` با مقادیر نمونه:

```env
PORT=3000
JWT_SECRET=change-this-to-a-random-secret-in-production
```

---

## 🟡 BUG-006: نبود راهنمای کامل راه‌اندازی سرور در README

| فیلد | مقدار |
|------|-------|
| **شناسه** | BUG-006 |
| **تاریخ گزارش** | ۲۰۲۶-۱۱-۰۴ |
| **گزارش‌دهنده** | کاربر (andrbi107) |
| **شدت** | 🟡 متوسط |
| **نسخه affected** | تمام نسخه‌ها |
| **وضعیت** | ✅ رفع شد در v7.1.0 |

### شرح

README فقط دستور کوتاه `cd server && npm install && npm start` را داشت، بدون توضیح کامل تنظیمات، متغیرهای محیطی، و پیکربندی کلاینت برای اتصال به سرور.

### راه‌حل

افزودن بخش کامل «راه‌اندازی سرور» به README شامل:
- پیش‌نیازها
- نصب
- تنظیمات (.env)
- اجرای سرور
- پیکربندی کلاینت
- تست health check
- troubleshooting

---

## 📝 نحوه گزارش خطای جدید

برای گزارش خطای جدید، لطفاً اطلاعات زیر را ارائه دهید:

1. **شرح خطا**: چه اتفاقی افتاد؟
2. **مراحل بازتولید**: دقیقاً چه کاری انجام دادید؟
3. **رفتار مورد انتظار**: چه چیزی باید رخ می‌داد؟
4. **رفتار فعلی**: چه چیزی رخ داد؟
5. **محیط**: سیستم‌عامل، نسخه Node.js، نسخه مرورگر
6. **لاگ خطا**: متن کامل خطا (اگر وجود دارد)
7. **اسکرین‌شات**: در صورت امکان

خطاها را در [GitHub Issues](https://github.com/andrbi107/doz-game/issues) گزارش دهید.

---

## 🔴 BUG-014: بازی آنلاین شروع نمی‌شود - game:role جداگانه

| فیلد | مقدار |
|------|-------|
| **شناسه** | BUG-014 |
| **تاریخ گزارش** | ۲۰۲۶-۱۱-۰۴ |
| **گزارش‌دهنده** | کاربر (andrbi107) |
| **شدت** | 🔴 بحرانی (بازی آنلاین کار نمی‌کند) |
| **نسخه affected** | v4.0.0 - v7.2.0 |
| **وضعیت** | ✅ رفع شد در v7.3.0 |

### شرح خطا

در بازی آنلاین، پس از مچ‌شدن دو بازیکن:
1. هیچ پیغامی نمایش داده نمی‌شود
2. امکان حرکت وجود ندارد
3. کاربر 2 پیام "نوبت شما نیست" دریافت می‌کند

### علت

در `server/gameroom.js`، تابع `start()` دو event جداگانه ارسال می‌کرد:
1. `game:start` (broadcast به room) با `yourRole` برای player1
2. `game:role` (individual) با role هر بازیکن

مشکل: `game:start` به هر دو بازیکن می‌رسید ولی `yourRole` فقط برای player1 درست بود. کلاینت در `handleGameStart` شرط `if (data.role)` را چک می‌کرد که با `game:role` کار می‌کرد اما با `game:start` که `yourRole` داشت کار نمی‌کرد. در نتیجه `myRole` هرگز تنظیم نمی‌شد.

### راه‌حل

بازنویسی `gameroom.js`:
1. حذف event جداگانه `game:role`
2. ارسال `game:start` به هر بازیکن به‌صورت جداگانه با `yourRole` مخصوص خودش
3. افزودن `roomId` به همه eventها (game:start، game:move، game:end، game:rematch-start)
4. بهبود `handleRematchStart` با ارسال `yourRole` و `players`

---

## 🔴 BUG-015: "Not Connected" در ورود با کد اتاق

| فیلد | مقدار |
|------|-------|
| **شناسه** | BUG-015 |
| **تاریخ گزارش** | ۲۰۲۶-۱۱-۰۴ |
| **گزارش‌دهنده** | کاربر (andrbi107) |
| **شدت** | 🔴 بحرانی |
| **نسخه affected** | v7.0.0 - v7.2.0 |
| **وضعیت** | ✅ رفع شد در v7.3.0 |

### شرح خطا

هنگام ورود با کد اتاق خصوصی، پیام "Not Connected" نمایش داده می‌شود.

### علت

تابع `confirmJoinPrivate` در `online-ui.js` مستقیماً `Online.joinPrivateRoom` را صدا می‌زد بدون بررسی `Online.isConnected()`. اگر socket هنوز وصل نشده بود، `socket` برابر `null` بود و `socket.emit` خطا می‌داد.

### راه‌حل

1. بررسی `Online.isConnected()` قبل از `joinPrivateRoom`
2. اگر متصل نیست، تلاش برای `Online.connect()`
3. نمایش پیام راهنما به کاربر

---

## 🔴 BUG-016: "نوبت شما نیست" برای کاربر 2

| فیلد | مقدار |
|------|-------|
| **شناسه** | BUG-016 |
| **تاریخ گزارش** | ۲۰۲۶-۱۱-۰۴ |
| **گزارش‌دهنده** | کاربر (andrbi107) |
| **شدت** | 🔴 بحرانی |
| **نسخه affected** | v4.0.0 - v7.2.0 |
| **وضعیت** | ✅ رفع شد در v7.3.0 |

### شرح خطا

کاربر 2 حتی وقتی نوبت اوست، پیام "نوبت شما نیست" دریافت می‌کند.

### علت

به‌خاطر BUG-014، `myRole` هرگز در کلاینت تنظیم نمی‌شد (برابر `null` می‌ماند). در نتیجه `onlineGameState.currentPlayer !== onlineGameState.myRole` همیشه `true` بود (چون `null !== 'x'`).

### راه‌حل

رفع BUG-014 (تنظیم صحیح `myRole` از `yourRole` در `game:start`). همچنین بهبود `handleOnlineCellClick` با بررسی `myRole` و نمایش پیام مناسب.

---

## 🟢 BUG-017: هشدار deprecation apple-mobile-web-app-capable

| فیلد | مقدار |
|------|-------|
| **شناسه** | BUG-017 |
| **تاریخ گزارش** | ۲۰۲۶-۱۱-۰۴ |
| **گزارش‌دهنده** | کاربر (andrbi107) |
| **شدت** | 🟢 کم (هشدار) |
| **نسخه affected** | v2.0.0 - v7.2.0 |
| **وضعیت** | ✅ رفع شد در v7.3.0 |

### شرح خطا

کنسول مرورگر هشدار: `<meta name="apple-mobile-web-app-capable"> is deprecated. Please include <meta name="mobile-web-app-capable">`

### راه‌حل

تغییر `apple-mobile-web-app-capable` به `mobile-web-app-capable` در `index.html`.

---

## 🟢 BUG-018: هشدار beforeinstallpromptevent

| فیلد | مقدار |
|------|-------|
| **شناسه** | BUG-018 |
| **تاریخ گزارش** | ۲۰۲۶-۱۱-۰۴ |
| **گزارش‌دهنده** | کاربر (andrbi107) |
| **شدت** | 🟢 کم (هشدار) |
| **نسخه affected** | v2.0.0 - v7.2.0 |
| **وضعیت** | ✅ رفع شد در v7.3.0 |

### شرح خطا

کنسول مرورگر هشدار: `Banner not shown: beforeinstallpromptevent.preventDefault() called.`

### علت

`e.preventDefault()` صدا زده می‌شد اما `e.prompt()` هیچ‌گاه صدا زده نمی‌شد (مگر اینکه کاربر روی بنر نصب کلیک می‌کرد).

### راه‌حل

این رفتار در واقع صحیح است (preventDefault برای جلوگیری از mini-infobar). هشدار با افزودن کامنت توضیحی و listener برای `appinstalled` بهبود یافت.
