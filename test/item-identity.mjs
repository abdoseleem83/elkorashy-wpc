// الأصناف بتتحدّد بترتيبها جوه الطلب (idx). لو حد تاني حذف أو ضاف صنف والشاشة
// عندك لسه القديمة، التعديل أو الحذف كان بيقع على **صنف تاني** من غير ما حد
// ياخد باله. دلوقتي التطبيق بيبعت هوية الصنف والسيرفر بيتأكد منها قبل الكتابة.
import fs from 'fs';
import vm from 'node:vm';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

// ═══ ١) السيرفر: itemMatches_ ═══
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const src = /function itemMatches_\(row, e\) \{[\s\S]*?\n\}/.exec(gs);
check('لقينا دالة التحقق في السيرفر', !!src);
const ctx = { String }; vm.createContext(ctx); vm.runInContext(src[0], ctx);
const صف = (type,code,size)=>{ const r=new Array(22).fill(''); r[3]=type; r[5]=code; r[6]=size; return r; };
const طابق = (row, p) => vm.runInContext('itemMatches_('+JSON.stringify(row)+', {parameter:'+JSON.stringify(p)+'})', ctx);

check('الصنف المطابق بيعدّي',
  طابق(صف('Door','A01','90 cm'), {itype:'Door', icode:'A01', isize:'90 cm'}) === true);
check('كود مختلف بيترفض',
  طابق(صف('Door','A01','90 cm'), {itype:'Door', icode:'A05', isize:'90 cm'}) === false);
check('مقاس مختلف بيترفض',
  طابق(صف('Door','A01','90 cm'), {itype:'Door', icode:'A01', isize:'70 cm'}) === false);
check('نوع مختلف بيترفض',
  طابق(صف('Door','A01','90 cm'), {itype:'Frame', icode:'A01', isize:'90 cm'}) === false);
check('تطبيق قديم (مابيبعتش هوية) لسه شغّال',
  طابق(صف('Door','A01','90 cm'), {}) === true);

// كل المسارات اللي بتكتب على صنف لازم تتأكد
['setItemAvail','setItemQty','deleteOrderItem','setItemProduced'].forEach(a=>{
  const blk = new RegExp("action === '"+a+"'[\\s\\S]*?\\n    \\}\\n").exec(gs);
  check('مسار '+a+' بيتحقق من هوية الصنف', !!blk && /itemMatches_/.test(blk[0]));
});

// ═══ ٢) التطبيق بيبعت الهوية فعلاً ═══
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);
const r = await pg.evaluate(async()=>{
  window.toast=()=>{};
  const روابط=[];
  window.jsonp = (url)=>{ روابط.push(url); return Promise.resolve({ok:true, qty:2, produced:0}); };
  state.admin.open=true; state.admin.pw='x'; state.tab='admin';
  state.admin.rows=[{id:'A1', displayNo:1, customer:'ع', date:'2026-09-01', qty:5, total:100}];
  state.admin.items['A1']=[
    {type:'Door',title:'باب',code:'A01',size:'90 cm',unit:'door',qty:5,unitPrice:100,produced:0},
    {type:'Frame',title:'حلق',code:'B02',size:'10 cm',unit:'set',qty:2,unitPrice:50,produced:0}];
  await setItemAvail('A1', 1, false);
  await setItemQty_('A1', 1, 3);
  await setItemProduced('A1', 1, 1);
  await deleteOrderItem_('A1', 1);
  return روابط;
});
const أفعال = ['setItemAvail','setItemQty','setItemProduced','deleteOrderItem'];
أفعال.forEach(a=>{
  const u = r.find(x=>x.includes('action='+a));
  const ok = u && /itype=Frame/.test(u) && /icode=B02/.test(u) && /isize=10(\+|%20)cm/.test(u);
  check(a+' بيبعت هوية الصنف', !!ok, u ? decodeURIComponent(u.slice(u.indexOf('action='))).slice(0,110) : 'مفيش نداء');
});
check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
