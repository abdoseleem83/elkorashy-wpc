// امتلاء مساحة التخزين المحلي. التطبيق بيخزّن 80 طلب بكل أصنافهم + السلة +
// كاش شاشة المصنع. المتصفح بيدي ~5 ميجا للموقع، ولما تمتلي setItem بترمي استثناء.
// السؤال: التطبيق بيتصرف إزاي؟ بيقع؟ بيضيّع الطلب من غير ما يقول؟
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

// ---------- الحجم الحقيقي لـ 80 طلب ----------
const size = await pg.evaluate(()=>{
  const mkItem = i => ({kind:'door', title:'باب A01 أرو (حفر)', titleEn:'WPC Door A01 - Arrow (Carved)',
    code:'A01', img:'img/doors/A01.jpg', sizeTxt:'70 سم', sizeEn:'70 cm', unitPrice:5800,
    qty:3+i, w:70, frame:10, dbror:'6×9', frameHeight:220, doorHeight:0, hafr:true,
    millEn:'Carved', note:'ملاحظة على الصنف', produced:0});
  const mkOrder = i => ({id:'W260904-1200'+i, ts:Date.now(), displayNo:i, editCount:0,
    name:'محمد القرشي', phone:'01067765483', region:'طنطا', warehouse:'مصنع إنشاص',
    customer:'ورشة النور للأخشاب', customerPhone:'01112223334', note:'التسليم الأسبوع الجاي',
    total:50000, msg:'x'.repeat(600), items:Array.from({length:12},(_,k)=>mkItem(k))});
  const orders = Array.from({length:80},(_,i)=>mkOrder(i));
  const bytes = new Blob([JSON.stringify(orders)]).size;
  return { كيلوبايت: Math.round(bytes/1024), طلب_واحد_كيلوبايت: Math.round(bytes/80/1024*10)/10 };
});
console.log(`حجم 80 طلب (12 صنف لكل طلب): ${size.كيلوبايت} كيلوبايت  (~${size.طلب_واحد_كيلوبايت} ك.ب للطلب)`);
check('أقل من ٢ ميجا (في حدود المتاح)', size.كيلوبايت < 2048, size.كيلوبايت+' KB');

// ---------- التخزين بيفشل: التطبيق بيعمل إيه؟ ----------
const r = await pg.evaluate(()=>{
  const real = Storage.prototype.setItem;
  let threw = false;
  Storage.prototype.setItem = function(){ threw = true; const e = new Error('QuotaExceededError');
    e.name='QuotaExceededError'; throw e; };
  let crashed = null, savedOk = null;
  try {
    save('wpc_test', {a:1});          // الدالة المسؤولة عن الحفظ
    savedOk = true;
  } catch(e){ crashed = e.message; }
  Storage.prototype.setItem = real;
  return { رمى_استثناء: crashed, الحفظ_ابتلع_الخطأ: savedOk === true, حاول_يكتب: threw };
});
check('التطبيق مبيقعش لما التخزين يمتلي', !r.رمى_استثناء, r.رمى_استثناء || 'مامتلاش');
check('دالة الحفظ بتبتلع الخطأ', r.الحفظ_ابتلع_الخطأ);

// ---------- لكن: المستخدم بيعرف إن طلبه ما اتحفظش؟ ----------
const r2 = await pg.evaluate(async()=>{
  const real = Storage.prototype.setItem;
  Storage.prototype.setItem = function(k){
    if(String(k).startsWith('wpc_')){ const e=new Error('QuotaExceededError'); e.name='QuotaExceededError'; throw e; }
    return real.apply(this, arguments);
  };
  const msgs=[]; const oldToast = window.toast;
  window.toast = m => { msgs.push(m); };
  state.orders = []; state.cart = [{kind:'door',title:'باب',qty:1,unitPrice:100,code:'A01',sizeTxt:'70 سم'}];
  state.profile = {name:'محمد', phone:'01012345678', region:'طنطا'};
  state.customer = {name:'ورشة', phone:''};
  state.editingId = null; state.editingMeta = null; state.orderNote='';
  window.APPS_SCRIPT_URL_BACKUP = null;
  try { submitOrder(); } catch(e){ msgs.push('CRASH: '+e.message); }
  await new Promise(r=>setTimeout(r,300));
  Storage.prototype.setItem = real; window.toast = oldToast;
  // هل الطلب موجود في التخزين فعلاً؟
  let stored = [];
  try { stored = JSON.parse(localStorage.getItem('wpc_orders')||'[]'); } catch(e){}
  return { الرسائل: msgs, في_الذاكرة: state.orders.length, في_التخزين: stored.length };
});
console.log('\nلما التخزين يمتلي والمستخدم يبعت طلب:');
console.log('   الرسائل اللي شافها:', JSON.stringify(r2.الرسائل));
console.log('   الطلب في الذاكرة:', r2.في_الذاكرة, '| في التخزين:', r2.في_التخزين);
check('التطبيق ما وقعش', !r2.الرسائل.some(m=>String(m).startsWith('CRASH')));
const warned = r2.الرسائل.some(m => /مساحة|التخزين|ما اتحفظ|مساحه/.test(String(m)));
check('المستخدم اتنبّه إن الطلب ما اتحفظش على الجهاز', warned,
      warned ? '' : '❗ الطلب ضاع من التخزين والمستخدم شايف رسالة نجاح');

check('مفيش أخطاء صفحة', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
