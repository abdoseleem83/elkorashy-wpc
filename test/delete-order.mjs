// ⚠️ «الحذف بيعلّق والسطر مش بيتمسح من الشيت».
// الحذف بيمسح السطر الملخّص الأول وبعدين سطور الأصناف. لو النداء وقف في نصه
// (مهلة جوجل، النت قطع) بيفضل الطلب نص محذوف: الملخّص راح والأصناف فاضلة،
// وأي محاولة حذف تانية كانت ترد «الطلب مش موجود» — فالسطور تفضل في الشيت
// والسطر في شاشة المصنع ما يختفيش أبدًا.
// الاختبار بيشغّل فرع deleteOrder الحقيقي من apps_script.gs على شيت وهمي.
import fs from 'fs';
import vm from 'node:vm';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const delBlock = /if \(action === 'deleteOrder'\)[\s\S]*?\n    \}\n/.exec(gs);
check('لقينا فرع الحذف', !!delBlock);
const clearSrc = /function clearItemRows_\(sh, id\) \{[\s\S]*?\n\}/.exec(gs);
check('لقينا clearItemRows_', !!clearSrc);

// ═══ شيت وهمي ═══
function بيئة(أوامر, أصناف){
  const O = { rows: [['HEAD']].concat(أوامر.map(r=>r.slice())) };  // [id, ..., status@COL_STATUS]
  const I = { rows: ['HEAD'].concat(أصناف) };
  const سجل = { رجوع_رصيد: [] };
  const shO = {
    getLastRow: () => O.rows.length,
    getRange: (r,c,n) => (n===undefined
      ? { getValue: () => O.rows[r-1][c-1] }
      : { getValues: () => O.rows.slice(r-1, r-1+n).map(v=>[v[0]]) }),
    deleteRow: (pos) => { O.rows.splice(pos-1,1); }
  };
  const shI = {
    getLastRow: () => I.rows.length,
    getRange: (r,c,n) => ({ getValues: () => I.rows.slice(r-1, r-1+n).map(v=>[v]) }),
    deleteRows: (pos,n) => { I.rows.splice(pos-1,n); }
  };
  const ctx = {
    action:'deleteOrder', cb:'',
    e:{ parameter:{ id:'', pw:'x' } },
    String, Number, Object,
    COL_STATUS: 11, SHEET_ORDERS:'O', HEAD_ORDERS:[], SHEET_ITEMS:'I', HEAD_ITEMS:[],
    checkAdminPw_: () => true, adminPwError_: () => 'pw',
    LockService: { getScriptLock: () => ({ waitLock(){}, releaseLock(){} }) },
    sheet_: (name) => name==='O' ? shO : shI,
    findRow_: (sh,id) => { for(let i=1;i<O.rows.length;i++) if(String(O.rows[i][0])===String(id)) return i+1; return -1; },
    restoreStockForOrderId_: (id) => { سجل.رجوع_رصيد.push(String(id)); },
    reply: (o) => o
  };
  return { ctx, O, I, سجل };
}
function احذف(أوامر, أصناف, id){
  const { ctx, O, I, سجل } = بيئة(أوامر, أصناف);
  ctx.e.parameter.id = id;
  vm.createContext(ctx);
  const رد = vm.runInContext(clearSrc[0] + '\n(function(){ ' + delBlock[0] + '\nreturn null; })();', ctx);
  return { رد, أوامر: O.rows.slice(1).map(r=>r[0]), أصناف: I.rows.slice(1), سجل };
}

{ // الحالة العادية
  const r = احذف([['A','','','','','','','','','','New'],['B','','','','','','','','','','New']],
                 ['A','B','B','B'], 'B');
  check('الرد ok', r.رد && r.رد.ok===true, JSON.stringify(r.رد));
  check('السطر الملخّص اتمسح', r.أوامر.join('')==='A', r.أوامر.join(''));
  check('سطور الأصناف اتمسحت', r.أصناف.join('')==='A', r.أصناف.join(''));
  check('الرصيد رجع مرة واحدة', r.سجل.رجوع_رصيد.length===1);
  check('مش مكتوب إنه كان متحذف قبل كده', r.رد.alreadyGone===false);
}
{ // ⚠️ بيت القصيد: نداء سابق وقف في نصه — الملخّص راح والأصناف فاضلة
  const r = احذف([['A','','','','','','','','','','New']], ['A','B','B','B'], 'B');
  check('الحذف بيكمّل التنظيف بدل ما يقول «مش موجود»', r.رد && r.رد.ok===true, JSON.stringify(r.رد));
  check('سطور الأصناف اليتيمة اتمسحت فعلاً', r.أصناف.join('')==='A', r.أصناف.join(''));
  check('وبيقول إن الملخّص كان متحذف قبل كده', r.رد.alreadyGone===true);
  check('ومابيرجّعش الرصيد تاني (اترجّع في النداء الأول)', r.سجل.رجوع_رصيد.length===0);
}
{ // الطلب مش موجود خالص
  const r = احذف([['A','','','','','','','','','','New']], ['A'], 'Z');
  check('طلب مش موجود خالص = خطأ واضح', r.رد && r.رد.ok===false && /مش موجود/.test(r.رد.error), JSON.stringify(r.رد));
}
{ // المُسلَّم مالوش رصيد يرجع
  const r = احذف([['B','','','','','','','','','','Delivered']], ['B'], 'B');
  check('المُسلَّم: مفيش رجوع رصيد', r.رد.ok===true && r.سجل.رجوع_رصيد.length===0);
}
{ // الملغي رصيده رجع قبل كده
  const r = احذف([['B','','','','','','','','','','Cancelled']], ['B'], 'B');
  check('الملغي: مفيش رجوع رصيد مزدوج', r.رد.ok===true && r.سجل.رجوع_رصيد.length===0);
}
{ // طلب من غير أصناف (سطر ملخّص لوحده)
  const r = احذف([['B','','','','','','','','','','New']], ['A'], 'B');
  check('طلب من غير أصناف بيتمسح عادي', r.رد.ok===true && r.أوامر.length===0);
}

// ═══ clearItemRows_ بترجّع العدد ═══
{
  const ctx = { String, Number, sh:null };
  const st = { rows:['HEAD','A','B','B','C'] };
  ctx.sh = {
    getLastRow: () => st.rows.length,
    getRange: (r,c,n) => ({ getValues: () => st.rows.slice(r-1,r-1+n).map(v=>[v]) }),
    deleteRows: (p,n) => { st.rows.splice(p-1,n); }
  };
  vm.createContext(ctx);
  const n = vm.runInContext(clearSrc[0] + '\nclearItemRows_(sh, "B");', ctx);
  check('clearItemRows_ بترجّع عدد السطور المتمسحة', n===2, 'رجعت '+n);
  const z = vm.runInContext('clearItemRows_(sh, "ZZ");', ctx);
  check('وبترجّع صفر لو مفيش سطور', z===0, 'رجعت '+z);
}

// ═══ الإلغاء بينضّف السطور اليتيمة كمان ═══
{
  const cancel = /if \(action === 'cancelOrder'\)[\s\S]*?\n    \}\n/.exec(gs)[0];
  check('الإلغاء بينضّف أصناف طلب ملخّصه راح',
    /rCO < 0\)\s*\{[\s\S]{0,400}clearItemRows_\(sheet_\(SHEET_ITEMS/.test(cancel));
  check('ولسه بيرد نفس الرسالة للتطبيق (مفيش تغيير في السلوك)',
    /rCO < 0\)\s*\{[\s\S]{0,500}error: 'الطلب مش موجود'/.test(cancel));
}

// ═══ ناحية التطبيق ═══
check('مهلة الحذف أطول من المهلة العادية',
  /const DELETE_TIMEOUT_MS = (\d+)/.test(html) &&
  Number(/const DELETE_TIMEOUT_MS = (\d+)/.exec(html)[1]) > Number(/const JSONP_TIMEOUT_MS = (\d+)/.exec(html)[1]));
check('الحذف بيستعمل المهلة الطويلة دي',
  /action=deleteOrder[\s\S]{0,200}DELETE_TIMEOUT_MS/.test(html));
check('«الطلب مش موجود» = اتمسح خلاص، مش فشل',
  /مش موجود\/\.test\(msg\)\)\s*return \{ gone:true, already:true \}/.test(html));
check('فيه محاولة تانية أوتوماتيك لو الاتصال قطع',
  /catch\(err1\)\{[\s\S]{0,400}await deleteOrderCall_\(id\)/.test(html));
check('الطلب بيتشال من النشط والأرشيف والأصناف مع بعض',
  /function forgetOrderLocally_\(id\)\{[\s\S]*?archRows[\s\S]*?delete state\.admin\.items\[id\]/.test(html));
check('والنسخة المحفوظة بتتحدّث كمان (ما يرجعش تاني بعد إعادة الفتح)',
  /function forgetOrderLocally_\(id\)\{[\s\S]*?saveAdminCache_/.test(html));
check('زرار الحذف بيرجع شغّال مهما حصل', /delBusy = null; render\(\);\n\}/.test(html));

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
