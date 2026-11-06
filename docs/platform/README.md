# اتصال پلتفرم شما به روم‌کیت

روم‌کیت زیرساخت تماس تصویری را می‌دهد و شما رابط کاربری خودتان را نگه می‌دارید.
ما فقط دو چیز به شما می‌دهیم: **اعتبار ورود به اتاق** و **شمارش مصرف**. کاربران
شما مستقیم به سرور رسانهٔ ما وصل می‌شوند و هیچ‌وقت وارد سایت روم‌کیت نمی‌شوند.

---

## ۱. کلید API

از تیم روم‌کیت یک کلید می‌گیرید:

```
rk_live_1a2b3c4d5e6f7890.9PccdwnTKkvDqKwIR3b0Yfx9HLggU--F0bHuL1g0qos
```

سه نکته که مهم‌ترین چیز در کل این مستند است:

- کلید **فقط در بک‌اند شما** استفاده می‌شود. اگر به مرورگر برسد، هر کسی می‌تواند
  برای هر اتاقی توکن بسازد و مصرفش پای شما نوشته می‌شود.
- کلید فقط **یک‌بار** نمایش داده می‌شود؛ ما فقط هش آن را نگه می‌داریم. گم شد،
  کلید تازه بگیرید.
- در هدر `X-Api-Key` می‌آید، نه `Authorization`.

پایهٔ آدرس: `https://roomkit.ir`

---

## ۲. جریان کار

```
کاربر شما            بک‌اند شما              روم‌کیت               سرور رسانه
    │                     │                     │                     │
    │─ «وارد جلسه شو» ───▶│                     │                     │
    │                     │─ POST /v1/rooms/… ─▶│                     │
    │                     │◀── token, serverUrl ┤                     │
    │◀─ token, serverUrl ─┤                     │                     │
    │────────────────── connect (livekit-client) ───────────────────▶│
```

بک‌اند شما تنها جایی است که کلید را می‌بیند. توکنی که برمی‌گردد کوتاه‌عمر است و
فقط برای همان یک اتاق و همان یک کاربر کار می‌کند.

---

## ۳. ساختن اتاق

```bash
curl -X POST https://roomkit.ir/api/v1/rooms \
  -H "X-Api-Key: $ROOMKIT_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
        "slug": "standup",
        "name": "جلسهٔ روزانه",
        "visibility": "private",
        "passcode": "4821",
        "maxParticipants": 20
      }'
```

| فیلد | توضیح |
| --- | --- |
| `slug` | شناسهٔ اتاق، یکتا **در محدودهٔ پلتفرم شما**. فقط حرف، رقم و خط تیره. |
| `visibility` | `public` (پیش‌فرض) یا `private`. |
| `passcode` | برای اتاق خصوصی الزامی است؛ حداقل ۴ نویسه. |
| `maxParticipants` | سقف، که خود سرور رسانه اعمالش می‌کند نه کلاینت. |

اسم اتاق شما با اسم اتاق پلتفرم دیگری تداخل نمی‌کند: داخل سیستم ما اتاق شما
`<کلید-پلتفرم>~standup` نام می‌گیرد.

**تفاوت عمومی و خصوصی**: اتاق خصوصی را کسی نمی‌تواند فقط با دانستن `slug` باز
کند. ولی وقتی شما با کلید API توکن می‌سازید، رمز پرسیده نمی‌شود — شما مالک اتاق
هستید و تصمیم اینکه چه کسی وارد شود با خود شماست.

---

## ۴. گرفتن توکن ورود

```bash
curl -X POST https://roomkit.ir/api/v1/rooms/standup/tokens \
  -H "X-Api-Key: $ROOMKIT_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"identity":"user-42","name":"مجتبی","canPublish":true}'
```

```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9…",
  "serverUrl": "wss://livekit.roomkit.ir",
  "room": "acme~standup",
  "identity": "user-42"
}
```

- `identity` شناسهٔ کاربر در سیستم **خودتان** است و باید در آن اتاق یکتا باشد.
  دو اتصال زندهٔ هم‌نام، یکدیگر را بیرون می‌اندازند.
- `canPublish: false` برای تماشاگری که فقط می‌بیند و نمی‌تواند صدا و تصویر
  بفرستد.
- `roomAdmin: true` به آن شرکت‌کننده اجازهٔ **مدیریت داخل اتاق** می‌دهد: بی‌صدا
  کردن دیگران، اخراج، و تغییر دسترسی آن‌ها — بدون این‌که برای هر کار به این API
  برگردد. برای معلم یا میزبان جلسه بدهید، و فقط به یک نفر.
- اگر اعتبار حساب تمام شده باشد، پاسخ **۴۰۲** است — نه ۴۰۳ و نه ۵۰۰. این را در
  کد خود جدا هندل کنید و به کاربر پیام درست بدهید.

---

## ۴-۱. مدیریت شرکت‌کنندگان از سمت سرور

اگر ترجیح می‌دهید کنترل جلسه در بک‌اند خودتان بماند (به‌جای دادن `roomAdmin` به
مرورگر معلم)، همان کارها از این‌جا هم انجام می‌شود:

```bash
# چه کسانی الان داخل اتاق‌اند و چه چیزی می‌فرستند
curl https://roomkit.ir/api/v1/rooms/standup/participants -H "X-Api-Key: $ROOMKIT_API_KEY"

# بی‌صدا کردن همهٔ ترک‌های یک نفر
curl -X POST https://roomkit.ir/api/v1/rooms/standup/participants/user-42/mute \
  -H "X-Api-Key: $ROOMKIT_API_KEY"

# قطع اتصال یک نفر (با توکن تازه می‌تواند برگردد — جلوگیری از بازگشت با شماست)
curl -X DELETE https://roomkit.ir/api/v1/rooms/standup/participants/user-42 \
  -H "X-Api-Key: $ROOMKIT_API_KEY"

# پایان دادن به تماس برای همه (رکورد اتاق می‌ماند)
curl -X POST https://roomkit.ir/api/v1/rooms/standup/end -H "X-Api-Key: $ROOMKIT_API_KEY"
```

---

## ۴-۲. ضبط جلسه

> **هنوز روی roomkit.ir فعال نیست.** تا وقتی یک بک‌اند ضبط نصب نشده باشد،
> `POST .../recordings` پاسخ **۵۰۳** می‌دهد. بقیهٔ این بخش قرارداد آن است، برای
> وقتی که فعال شود.
>
> چرا LiveKit Egress استفاده نشده: Egress برای هماهنگی به یک `redis:` در
> `livekit.yaml` نیاز دارد، و همین یک خط LiveKit را از حالت تک‌نودی به حالت
> توزیع‌شده می‌برد که در آن redis انبارهٔ مشترک وضعیت اتاق‌ها می‌شود — یعنی
> ساخت اتاق و ورود شرکت‌کننده هم از آن رد می‌شود. آن‌وقت یک اختلال در redis
> کلاس‌ها را می‌خواباند، نه فقط ضبط را.

یک ضبط در هر لحظه برای هر اتاق. شروع دوباره روی اتاقی که در حال ضبط است `409`
می‌گیرد.

```bash
curl -X POST https://roomkit.ir/api/v1/rooms/standup/recordings \
  -H "X-Api-Key: $ROOMKIT_API_KEY" -H 'Content-Type: application/json' \
  -d '{"startedBy":"user-42"}'

curl -X POST https://roomkit.ir/api/v1/rooms/standup/recordings/stop \
  -H "X-Api-Key: $ROOMKIT_API_KEY"

curl https://roomkit.ir/api/v1/rooms/standup/recordings -H "X-Api-Key: $ROOMKIT_API_KEY"
```

```json
[
  {
    "id": "0c1f…",
    "slug": "standup",
    "status": "complete",
    "durationSeconds": 5412,
    "sizeBytes": 986431488,
    "playbackUrl": "https://roomkit.ir/api/recordings/0c1f…/file?expires=…&signature=…"
  }
]
```

- `status` یکی از `starting` · `active` · `complete` · `failed` است. تا وقتی
  `complete` نشده `playbackUrl` برابر `null` است.
- `playbackUrl` **امضاشده و مدت‌دار** است (پیش‌فرض ۶ ساعت) و مستقیم در تگ
  `<video>` باز می‌شود — نیازی به کلید API ندارد. هر بار که فهرست را می‌گیرید
  لینک تازه‌ای ساخته می‌شود، پس لینک را ذخیرهٔ دائم نکنید؛ `id` را ذخیره کنید.
- پاسخ به Range request می‌دهد، یعنی دانش‌آموز می‌تواند وسط ویدئو بپرد.
- حذف: `DELETE /api/v1/recordings/:id`.

---

## ۵. اتصال از فرانت‌اند

هر SDK کلاینت لای‌وکیت کار می‌کند. با `livekit-client`:

```bash
npm install livekit-client
```

```ts
import { Room, RoomEvent } from 'livekit-client';

// token و serverUrl را از بک‌اند خودتان بگیرید — هرگز کلید API را به اینجا نیاورید.
const { token, serverUrl } = await fetch('/my-backend/join').then((r) => r.json());

const room = new Room({ adaptiveStream: true, dynacast: true });

room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
  document.body.appendChild(track.attach()); // جای واقعی‌اش را خودتان بچینید
});

await room.connect(serverUrl, token);
await room.localParticipant.enableCameraAndMicrophone();
```

> تماس تصویری فقط روی **HTTPS** کار می‌کند. مرورگر در بستر ناامن
> `getUserMedia` را رد می‌کند، پس روی `http://` هیچ دوربینی روشن نمی‌شود
> (به‌جز `localhost` هنگام توسعه).

---

## ۶. دیدن مصرف

```bash
curl https://roomkit.ir/api/v1/usage -H "X-Api-Key: $ROOMKIT_API_KEY"
```

```json
{
  "planMode": "prepaid",
  "includedUnits": 36000,
  "usedUnits": 12480,
  "creditLimitUnits": 0,
  "remainingUnits": 23520
}
```

واحدها **ثانیهٔ قابل‌محاسبه** هستند: هر شرکت‌کننده، هر ثانیه‌ای که در اتاق است،
یک واحد. جلسهٔ ۳۰ دقیقه‌ای با ۴ نفر یعنی `4 × 30 × 60 = 7200` واحد.

سه نوع اشتراک:

| نوع | رفتار |
| --- | --- |
| `unlimited` | هرگز متوقف نمی‌شود؛ مصرف فقط ثبت می‌شود. `remainingUnits` برابر `null`. |
| `pay_as_you_go` | تا سقف بدهکاری ادامه می‌دهد، بعد متوقف می‌شود. |
| `prepaid` | تا وقتی اعتبار هست کار می‌کند. |

مصرف از خود سرور رسانه شمرده می‌شود، نه از مرورگر — یعنی هم دقیق است و هم
نمی‌شود دورش زد. **جلسهٔ در جریان هم شمرده می‌شود**: اگر اعتبار وسط تماس تمام
شود، آن تماس ظرف حدود یک دقیقه بسته می‌شود. اگر این برایتان بد است، `usage` را
دوره‌ای بخوانید و قبل از رسیدن به صفر شارژ کنید.

---

## ۶-۱. وبهوک رویدادهای اتاق

به‌جای حدس‌زدن این‌که چه کسی کِی رفت، بگذارید روم‌کیت خبر بدهد. آدرس و کلید
امضا را ادمین روی حساب شما تنظیم می‌کند:

```bash
curl -X PATCH https://roomkit.ir/api/admin/tenants/$TENANT_ID \
  -H "X-Admin-Token: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"webhookUrl":"https://gamschools.ir/api/roomkit/events","webhookSecret":"..."}'
```

بدنهٔ ارسالی:

```json
{ "event": "participant_left", "room": "standup", "at": "2026-08-26T09:31:04.000Z",
  "identity": "u-42", "name": "مجتبی" }
```

رویدادها: `participant_joined` · `participant_left` · `room_finished` ·
`recording_ready` (این آخری `recording: { id, url, durationSeconds }` هم دارد).

**امضا** در هدر `X-Roomkit-Signature` به شکل `sha256=<hex>` می‌آید و روی بایت‌های
دقیق بدنه با HMAC-SHA256 محاسبه شده است. در گیرنده:

```ts
const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
// با timingSafeEqual مقایسه کنید، نه با ===
```

نکته‌های عملی:

- `room` همیشه **slug خودتان** است، نه نام namespaced لای‌وکیت.
- ارسال **یک‌بار و بدون retry** است. اگر endpoint شما بالا نباشد آن رویداد از
  دست می‌رود — روم‌کیت عمداً دوباره نمی‌فرستد تا یک گیرندهٔ خراب به حلقهٔ
  بی‌پایان تبدیل نشود. حساب نهایی را از دادهٔ خودتان ببندید.
- تایم‌اوت ۵ ثانیه است؛ سریع `200` بدهید و کار سنگین را پس‌زمینه ببرید.

---

## ۷. همهٔ endpointها

| متد | مسیر | کار |
| --- | --- | --- |
| `GET` | `/api/v1/rooms` | فهرست اتاق‌های شما |
| `POST` | `/api/v1/rooms` | ساخت اتاق |
| `GET` | `/api/v1/rooms/:slug` | یک اتاق |
| `DELETE` | `/api/v1/rooms/:slug` | حذف اتاق (تماس جاری را قطع نمی‌کند) |
| `POST` | `/api/v1/rooms/:slug/tokens` | توکن ورود |
| `GET` | `/api/v1/rooms/:slug/participants` | چه کسانی داخل اتاق‌اند |
| `POST` | `/api/v1/rooms/:slug/participants/:identity/mute` | بی‌صدا کردن یک نفر |
| `DELETE` | `/api/v1/rooms/:slug/participants/:identity` | قطع اتصال یک نفر |
| `POST` | `/api/v1/rooms/:slug/end` | پایان تماس برای همه |
| `POST` | `/api/v1/rooms/:slug/recordings` | شروع ضبط |
| `POST` | `/api/v1/rooms/:slug/recordings/stop` | توقف ضبط |
| `GET` | `/api/v1/rooms/:slug/recordings` | ضبط‌های یک اتاق |
| `GET` | `/api/v1/recordings` | همهٔ ضبط‌های شما |
| `DELETE` | `/api/v1/recordings/:id` | حذف یک ضبط |
| `GET` | `/api/v1/usage` | اعتبار و مصرف |

خطاها: `401` کلید نامعتبر یا پلتفرم معلق · `402` اعتبار تمام ·
`404` اتاق نیست · `409` این `slug` قبلاً ثبت شده.

---

## ۸. سرور MCP (اختیاری)

اگر با یک دستیار کدنویسی کار می‌کنید، فایل [`roomkit-mcp.mjs`](./roomkit-mcp.mjs)
همین API را به‌عنوان ابزار در اختیارش می‌گذارد. هیچ وابستگی‌ای ندارد — فقط
Node 18 به بالا:

```json
{
  "mcpServers": {
    "roomkit": {
      "command": "node",
      "args": ["/absolute/path/to/roomkit-mcp.mjs"],
      "env": { "ROOMKIT_API_KEY": "rk_live_..." }
    }
  }
}
```

ابزارهایی که می‌دهد: `roomkit_list_rooms`، `roomkit_create_room`،
`roomkit_get_room`، `roomkit_delete_room`، `roomkit_mint_token`،
`roomkit_usage`.

برای تست روی محیط دیگر، `ROOMKIT_BASE_URL` را ست کنید.

---

## ۹. اشتباه‌های رایج

- **کلید API در فرانت‌اند.** رایج‌ترین و پرهزینه‌ترین. توکن ورود را بک‌اند
  بسازد.
- **`identity` تکراری.** اگر برای همهٔ کاربران `guest` بفرستید، هر ورود جدید
  قبلی را بیرون می‌اندازد.
- **`slug` با نویسهٔ غیرمجاز.** فقط حرف، رقم و خط تیره. `~` مخصوصاً ممنوع است.
- **هندل‌نکردن ۴۰۲.** بدون آن، تمام‌شدن اعتبار برای کاربر شما شبیه خرابی سرویس
  دیده می‌شود.
- **تست روی `http://`.** دوربین روشن نمی‌شود و علتش هم در کنسول واضح نیست.
