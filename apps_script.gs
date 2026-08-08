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
 *  (كلمة السر ADMIN_PW تحت). القيم:
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
var SHEET_DIST   = 'Distributors';
var SHEET_STOCK  = 'Stock';        // أرصدة المخزن الجاهزة للتسليم خلال ٤٨ ساعة

var HEAD_STOCK = ['Code', 'Size', 'Qty', 'Updated'];
var TZ           = 'Africa/Cairo';
var ROD_LEN      = 2.20;   // الطول الافتراضي — الطول الفعلي بيجي مع كل صنف في it.rodCm
var ADMIN_PW     = '3184';

// ⚠️ أرقام أعمدة تبويب Orders (تبدأ من ١). لو زوّدت أو رتّبت الأعمدة
// في HEAD_ORDERS تحت، لازم تظبّط الأرقام دي معاها.
var COL_STATUS   = 11;   // Status
var COL_NOTE     = 12;   // Note to Distributor
var COL_UPDATED  = 15;   // Status Updated   // كلمة سر شاشة المصنع — غيّرها من هنا لو حبيت
var PRICE_NOTE   = 'الأسعار بعاليه حسب وقت التسعير وغير ملزمة إلا في حالة سداد المبلغ كامل أو نصفه.';

var HEAD_DIST = ['Phone', 'Name', 'Region', 'Status', 'Requested At', 'Decided At'];

var HEAD_ORDERS = [
  'Order No', 'Date', 'Time', 'Distributor', 'Phone', 'Region',
  'Warehouse', 'Total Qty', 'Total Rods', 'Total Amount', 'Status', 'Note to Distributor', 'Pricing Terms', 'Message', 'Status Updated',
  'Archived', 'Customer', 'Order Note'
];
var COL_ARCHIVED = 16;
var COL_CUSTOMER = 17;   // اسم صاحب الأوردر لو مختلف عن صاحب الجهاز
var COL_ORDNOTE  = 18;   // ملاحظات العميل على الطلب   // Y/N — بيتحدّد أوتوماتيك لما الحالة تبقى Delivered، أو يدوي من زرار الأرشفة

var HEAD_ITEMS = [
  'Order No', 'Date', 'Distributor', 'Type', 'Item', 'Colour Code',
  'Size', 'Included with Door', 'Milling', 'Unit', 'Qty', 'Unit Price', 'Line Total', 'Available',
  'Frame (cm)', 'Bror', 'Frame Height (cm)'
];
var COL_ITEM_AVAIL = 14;   // عمود "متاح؟" في تبويب Order_Items — Y/N، بيتحدّث من شاشة المصنع
// عمودين جداد (v28) بيخزّنوا قيمة الحلق/البرور خام (منفصلين عن نص "Included with Door" الإنجليزي)
// عشان شاشة المصنع تقدر تعرضهم في عمودين منفصلين بالعربي بدل نص متلاصق واحد

/* ============================================================
   استقبال الطلب من التطبيق
   ============================================================ */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // القفل بيمنع إن طلبين يوصلوا في نفس اللحظة ويكتبوا فوق بعض
    lock.waitLock(20000);

    var body = JSON.parse(e.postData.contents);

    if (body.action === 'distSignup' && body.dist) {
      saveDistSignup_(body.dist);
      return json({ ok: true });
    }

    if (body.action !== 'newOrder' || !body.order) {
      return json({ ok: false, error: 'Unknown action' });
    }

    saveOrder_(body.order);
    return json({ ok: true, id: body.order.id });

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

    // حالة تسجيل موزع — بيتقرا برقم موبايله من غير باسورد
    if (action === 'distStatus') {
      var phoneQ = String(e.parameter.phone || '').replace(/\D/g, '');
      if (!phoneQ) return reply({ ok: false, error: 'مفيش رقم موبايل' }, cb);
      var shD = sheet_(SHEET_DIST, HEAD_DIST);
      var rD = findDistRow_(shD, phoneQ);
      if (rD < 0) return reply({ ok: true, status: 'NotFound' }, cb);
      var row = shD.getRange(rD, 1, 1, 6).getValues()[0];
      return reply({ ok: true, status: row[3] || 'Pending', name: row[1], region: row[2] }, cb);
    }

    // قايمة كل طلبات تسجيل الموزعين — لشاشة المصنع بس
    if (action === 'distList') {
      if (String(e.parameter.pw || '') !== ADMIN_PW) {
        return reply({ ok: false, error: 'كلمة السر غلط' }, cb);
      }
      var shDL = sheet_(SHEET_DIST, HEAD_DIST);
      var rowsDL = shDL.getDataRange().getValues();
      var outDL = [];
      for (var iD = 1; iD < rowsDL.length; iD++) {
        outDL.push({
          phone:  String(rowsDL[iD][0] || '').replace(/^'/, ''),
          name:   rowsDL[iD][1],
          region: rowsDL[iD][2],
          status: rowsDL[iD][3]
        });
      }
      return reply({ ok: true, list: outDL }, cb);
    }

    // قبول/رفض تسجيل موزع — من شاشة المصنع
    if (action === 'distDecide') {
      if (String(e.parameter.pw || '') !== ADMIN_PW) {
        return reply({ ok: false, error: 'كلمة السر غلط' }, cb);
      }
      var lockD = LockService.getScriptLock();
      try {
        lockD.waitLock(15000);
        var shDD = sheet_(SHEET_DIST, HEAD_DIST);
        var rDD = findDistRow_(shDD, String(e.parameter.phone || '').replace(/\D/g, ''));
        if (rDD < 0) return reply({ ok: false, error: 'مفيش طلب بالرقم ده' }, cb);
        shDD.getRange(rDD, 4).setValue(String(e.parameter.decision || 'Pending'));
        shDD.getRange(rDD, 6).setValue(new Date());
        return reply({ ok: true }, cb);
      } finally {
        try { lockD.releaseLock(); } catch (e3) {}
      }
    }

    // تحديث حالة الطلب — من شاشة المصنع
    if (action === 'setStatus') {
      if (String(e.parameter.pw || '') !== ADMIN_PW) {
        return reply({ ok: false, error: 'كلمة السر غلط' }, cb);
      }
      var lock = LockService.getScriptLock();
      try {
        lock.waitLock(15000);
        var shS = sheet_(SHEET_ORDERS, HEAD_ORDERS);
        var r = findRow_(shS, e.parameter.id);
        if (r < 0) return reply({ ok: false, error: 'الطلب مش موجود' }, cb);
        var newStatus = String(e.parameter.status || '');
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
      if (String(e.parameter.pw || '') !== ADMIN_PW) {
        return reply({ ok: false, error: 'كلمة السر غلط' }, cb);
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
      var isAdmin = String(e.parameter.pw || '') === ADMIN_PW;
      // لو مفيش كلمة سر صح، لازم يبعت رقم موبايل — عشان موزع ما يشوفش طلبات غيره
      if (!isAdmin && !e.parameter.phone) {
        return reply({ ok: false, error: 'كلمة السر غلط' }, cb);
      }
      var phone = isAdmin ? '' : String((e.parameter.phone || '')).replace(/\D/g, '');
      var sh = sheet_(SHEET_ORDERS, HEAD_ORDERS);
      var rows = sh.getDataRange().getValues();
      var out = [];

      for (var i = 1; i < rows.length; i++) {
        var rowPhone = String(rows[i][4] || '').replace(/\D/g, '');

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
          date:   Utilities.formatDate(new Date(rows[i][1]), TZ, 'yyyy-MM-dd'),
          dist:   rows[i][3],
          phone:  isAdmin ? String(rows[i][4] || '').replace(/^'/, '') : '',
          region: rows[i][5],
          qty:    rows[i][7],
          rods:   rows[i][8],
          total:  rows[i][9],
          status: rows[i][10],
          note:   rows[i][11],      // ملاحظة المصنع للموزع
          customer: rows[i][COL_CUSTOMER - 1] || '',
          ordNote:  rows[i][COL_ORDNOTE  - 1] || '',
          archived: isAdmin ? (String(rows[i][COL_ARCHIVED - 1] || '') === 'Y') : undefined
        });
      }
      return reply({ ok: true, orders: out }, cb);
    }

    // قايمة أصناف طلب واحد بالتفصيل — لشاشة المصنع بس (لعرض/تعديل التوفر ولتصدير PDF)
    if (action === 'orderItems') {
      if (String(e.parameter.pw || '') !== ADMIN_PW) {
        return reply({ ok: false, error: 'كلمة السر غلط' }, cb);
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
              frameHeight: valsOI[iOI][16] || ''
            });
          }
        }
      }
      return reply({ ok: true, items: itemsOut }, cb);
    }

    // تحديد صنف معيّن جوه طلب كـ"غير متاح" أو رجّعه "متاح" — بالـ idx (ترتيبه جوه الطلب، يبدأ من صفر)
    if (action === 'setItemAvail') {
      if (String(e.parameter.pw || '') !== ADMIN_PW) {
        return reply({ ok: false, error: 'كلمة السر غلط' }, cb);
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

    // إلغاء طلب (بيتنادى لوحده لما العميل أو المصنع يعدّل طلب — الطلب القديم يتلغي وطلب جديد يتعمل)
    // من غير باسورد عشان الموزع العادي يقدر يعدّل طلبه هو من غير دخول شاشة المصنع
    if (action === 'cancelOrder') {
      var lockCO = LockService.getScriptLock();
      try {
        lockCO.waitLock(15000);
        var shCO = sheet_(SHEET_ORDERS, HEAD_ORDERS);
        var rCO = findRow_(shCO, e.parameter.id);
        if (rCO < 0) return reply({ ok: false, error: 'الطلب مش موجود' }, cb);
        shCO.getRange(rCO, COL_STATUS).setValue('Cancelled');
        shCO.getRange(rCO, COL_UPDATED).setValue(new Date());
        return reply({ ok: true, id: e.parameter.id }, cb);
      } finally {
        try { lockCO.releaseLock(); } catch (eCO) {}
      }
    }

    // حذف طلب بالكامل (السطر الملخّص + كل سطور أصنافه) — من شاشة المصنع
    if (action === 'deleteOrder') {
      if (String(e.parameter.pw || '') !== ADMIN_PW) {
        return reply({ ok: false, error: 'كلمة السر غلط' }, cb);
      }
      var lockDO = LockService.getScriptLock();
      try {
        lockDO.waitLock(15000);
        var shDO = sheet_(SHEET_ORDERS, HEAD_ORDERS);
        var rDO = findRow_(shDO, e.parameter.id);
        if (rDO < 0) return reply({ ok: false, error: 'الطلب مش موجود' }, cb);
        shDO.deleteRow(rDO);
        var shIDO = sheet_(SHEET_ITEMS, HEAD_ITEMS);
        clearItemRows_(shIDO, e.parameter.id);
        return reply({ ok: true, id: e.parameter.id }, cb);
      } finally {
        try { lockDO.releaseLock(); } catch (eDO) {}
      }
    }

    // مسح كل الطلبات اللي حالتها "تم التسليم" دفعة واحدة (تنظيف دوري) — من زرار "🗑️ مسح المسلّم"
    if (action === 'deleteDelivered') {
      if (String(e.parameter.pw || '') !== ADMIN_PW) {
        return reply({ ok: false, error: 'كلمة السر غلط' }, cb);
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
      if (String(e.parameter.pw || '') !== ADMIN_PW) {
        return reply({ ok: false, error: 'كلمة السر غلط' }, cb);
      }
      var shLW = sheet_(SHEET_ORDERS, HEAD_ORDERS);
      var rowsLW = shLW.getDataRange().getValues();
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
            frameHeight: valsILW[iILW][16] || ''
          });
        }
      }
      var outLW = [];
      for (var jLW = 1; jLW < rowsLW.length; jLW++) {
        var isArchLW = String(rowsLW[jLW][COL_ARCHIVED - 1] || '') === 'Y';
        if (isArchLW && String(e.parameter.archived || '') !== '1') continue;   // المؤرشف مايظهرش في التقارير افتراضيًا
        var idLW = String(rowsLW[jLW][0]);
        outLW.push({
          id:        idLW,
          date:      Utilities.formatDate(new Date(rowsLW[jLW][1]), TZ, 'yyyy-MM-dd'),
          dist:      rowsLW[jLW][3],
          phone:     String(rowsLW[jLW][4] || '').replace(/^'/, ''),
          region:    rowsLW[jLW][5],
          warehouse: rowsLW[jLW][6],
          status:    rowsLW[jLW][10],
          customer:  rowsLW[jLW][COL_CUSTOMER - 1] || '',
          ordNote:   rowsLW[jLW][COL_ORDNOTE  - 1] || '',
          items:     itemsByIdLW[idLW] || []
        });
      }
      return reply({ ok: true, orders: outLW }, cb);
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
      if (String(e.parameter.pw || '') !== ADMIN_PW) {
        return reply({ ok: false, error: 'كلمة السر غلط' }, cb);
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
    if (k === 'frame' || k === 'bror') rods += Number(items[i].qty) || 0;
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
    o.name || '',
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
    o.customer || '',    // صاحب الأوردر لو مختلف عن صاحب الجهاز
    o.note || ''         // ملاحظات العميل
  ];

  if (existing > 0) {
    // بنحافظ على الحالة والملاحظة اللي المصنع كتبها، ونحدّث الباقي بس
    var keep = shO.getRange(existing, COL_STATUS, 1, 2).getValues()[0];
    if (keep[0]) rowO[COL_STATUS - 1] = keep[0];
    if (keep[1]) rowO[COL_NOTE   - 1] = keep[1];
    shO.getRange(existing, 1, 1, rowO.length).setValues([rowO]);
  } else {
    shO.appendRow(rowO);
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
             : (it.kind === 'bror'  ? 'Bror' : 'Accessory'));

    var unit = isDoor ? 'door' : (isRod ? ('rod ' + (it.rodCm || 220) + 'cm') : (it.unit || 'pc'));

    lines.push([
      o.id,
      dateS,
      o.name || '',
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
      isDoor ? (it.frameHeight || '') : ''
    ]);
  }

  if (lines.length) {
    shI.getRange(shI.getLastRow() + 1, 1, lines.length, HEAD_ITEMS.length).setValues(lines);
  }
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

// طلب تسجيل موزع جديد — لو موجود قبل كده وكان "مرفوض"، بيرجّعه Pending تاني
function saveDistSignup_(d){
  var sh = sheet_(SHEET_DIST, HEAD_DIST);
  var phone = String(d.phone || '').replace(/\D/g, '');
  var now = new Date();
  var r = findDistRow_(sh, phone);
  var row = [ "'" + phone, d.name || '', d.region || '', 'Pending', now, '' ];
  if (r > 0) {
    var cur = sh.getRange(r, 4).getValue();
    if (cur !== 'Approved') sh.getRange(r, 1, 1, 6).setValues([row]);
  } else {
    sh.appendRow(row);
  }
}

function findDistRow_(sh, phone) {
  var last = sh.getLastRow();
  if (last < 2 || !phone) return -1;
  var vals = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    var p = String(vals[i][0] || '').replace(/\D/g, '');
    if (p && p.slice(-9) === phone.slice(-9)) return i + 2;
  }
  return -1;
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
