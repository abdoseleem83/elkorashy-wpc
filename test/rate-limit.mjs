// المسارات المفتوحة (إرسال طلب · تابع طلبك · إلغاء طلب) مالهاش كلمة سر عن قصد،
// عشان الموزّع يشتغل من غير ما يحفظ حاجة. بس كده أي حد معاه الرابط يقدر يغرق
// الشيت بطلبات وهمية، أو يجرّب أرقام موبايل واحد ورا التاني لحد ما يلاقي طلبات
// ويلغيها. الحدود دي بتخلّي ده غير عملي، ولازم تفضل واسعة كفاية إن الاستخدام
// الحقيقي عمره ما يوصلها.
import fs from 'fs';
import vm from 'node:vm';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const grab = n => { const m = new RegExp('function '+n+'\\([\\s\\S]*?\\n\\}').exec(gs); if(!m) throw new Error('مالقيناش '+n); return m[0]; };

// ═══ ١) عدّاد الحدود ═══
function بيئة(){
  const store = {};
  const ctx = {
    RATE_LIMITS_: eval('('+/var RATE_LIMITS_ = (\{[\s\S]*?\n\});/.exec(gs)[1]+')'),
    Number, String, RegExp,
    CacheService: { getScriptCache: () => ({
      get: k => (k in store ? store[k] : null),
      put: (k,v) => { store[k] = v; }
    })}
  };
  vm.createContext(ctx);
  vm.runInContext(grab('rateKey_') + '\n' + grab('rateOk_'), ctx);
  return { ctx, store };
}
const حدود = eval('('+/var RATE_LIMITS_ = (\{[\s\S]*?\n\});/.exec(gs)[1]+')');
check('الحدود معرّفة للمسارات التلاتة',
  حدود.newOrder && حدود.listPhone && حدود.cancelOrder,
  Object.keys(حدود).map(k=>k+'='+حدود[k].limit).join(' · '));
check('حد إرسال الطلبات واسع كفاية للاستخدام الحقيقي (٤٠+ في ١٠ دقايق)',
  حدود.newOrder.limit >= 40, String(حدود.newOrder.limit));

{
  const { ctx } = بيئة();
  const جرّب = (n, dev) => { let سمح=0; for(let i=0;i<n;i++) if(vm.runInContext(`rateOk_('newOrder', ${JSON.stringify(dev)})`, ctx)) سمح++; return سمح; };
  const سمح = جرّب(حدود.newOrder.limit + 15, 'dev-A');
  check('الجهاز بيتوقف بعد ما يعدّي الحد', سمح === حدود.newOrder.limit, 'سمح='+سمح);
  // جهاز تاني مايتأثرش
  check('الجهاز التاني مش متأثر بحظر الأول',
    vm.runInContext("rateOk_('newOrder','dev-B')", ctx) === true);
  // ومسار تاني على نفس الجهاز مايتأثرش
  check('ومسار تاني على نفس الجهاز مايتأثرش',
    vm.runInContext("rateOk_('cancelOrder','dev-A')", ctx) === true);
}
{
  // الكاش واقع؟ ما نوقفش الشغل
  const ctx = { RATE_LIMITS_: حدود, Number, String, RegExp,
    CacheService: { getScriptCache: () => { throw new Error('الكاش مش متاح'); } } };
  vm.createContext(ctx);
  vm.runInContext(grab('rateKey_') + '\n' + grab('rateOk_'), ctx);
  check('لو الكاش مش متاح، الطلبات بتعدّي عادي (مانقفلش على الناس)',
    vm.runInContext("rateOk_('newOrder','dev-A')", ctx) === true);
}

// ═══ ٢) فحص شكل الطلب ═══
{
  const ctx = { String, Number };
  vm.createContext(ctx);
  vm.runInContext('var MAX_ITEMS_=' + /var MAX_ITEMS_\s*=\s*(\d+)/.exec(gs)[1] +
                  '; var MAX_TEXT_=' + /var MAX_TEXT_\s*=\s*(\d+)/.exec(gs)[1] + ';\n' + grab('orderShapeError_'), ctx);
  const خطأ = o => vm.runInContext('orderShapeError_(' + JSON.stringify(o) + ')', ctx);
  const صنف = {kind:'door', qty:1, title:'باب'};
  check('الطلب السليم بيعدّي', خطأ({id:'W1', items:[صنف]}) === '');
  check('طلب فيه ١٥ صنف (أكبر طلب حقيقي) بيعدّي',
    خطأ({id:'W1', items:Array(15).fill(صنف)}) === '');
  check('طلب من غير أصناف بيترفض', خطأ({id:'W1', items:[]}) !== '');
  check('طلب من غير كود بيترفض', خطأ({items:[صنف]}) !== '');
  check('كود طويل جدًا بيترفض', خطأ({id:'x'.repeat(80), items:[صنف]}) !== '');
  check('عدد أصناف خيالي بيترفض', خطأ({id:'W1', items:Array(5000).fill(صنف)}) !== '');
  check('نص طويل جدًا في خانة بيترفض',
    خطأ({id:'W1', items:[صنف], name:'ا'.repeat(5000)}) !== '');
  check('بيانات مش مقروءة بترفض', خطأ(null) !== '');
}

// ═══ ٣) التطبيق بيبعت معرّف الجهاز فعلاً ═══
{
  const b = await chromium.launch();
  const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(1300);
  const r = await pg.evaluate(async ()=>{
    window.toast=()=>{};
    const روابط=[], أجسام=[];
    window.jsonp = (url)=>{ روابط.push(url); return Promise.resolve({ok:true, orders:[]}); };
    window.fetch = (u, opt)=>{ أجسام.push(opt && opt.body); return Promise.resolve({ok:true}); };
    state.profile = {name:'أحمد', phone:'01000000000', region:'طنطا'};
    await loadTrack();                                  // تابع طلبك
    await sendOrderToServer_({id:'W1', phone:'01000000000', items:[{kind:'door',qty:1}]});
    return { روابط, أجسام, جهاز: deviceId_() };
  });
  const t = r.روابط.find(u=>u.includes('action=list'));
  check('«تابع طلبك» بيبعت معرّف الجهاز', !!t && t.includes('dev='+r.جهاز), t||'مفيش نداء');
  const n = r.روابط.find(u=>u.includes('action=newOrder'));
  check('إرسال الطلب بيبعت معرّف الجهاز', !!n && n.includes('dev='+r.جهاز), n? n.slice(0,110):'مفيش نداء');
  check('مفيش أخطاء', errs.length===0, errs.join(' | '));
  await b.close();
}

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
