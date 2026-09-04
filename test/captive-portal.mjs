import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const ctx = await b.newContext({acceptDownloads:true, serviceWorkers:'block'});   // نوقف الـ SW عشان الاعتراض يشتغل
const pg = await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.route('**/cdn/*.js', r=>r.fulfill({status:200, contentType:'text/html', body:'<html>Login required</html>'}));
await pg.goto('http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1200);
const s=await pg.$('.gateskip'); if(s){await s.click(); await pg.waitForTimeout(300);}
const r = await pg.evaluate(async()=>{
  const out={};
  try{ out.ensure = await ensureLib_('html2canvas'); }catch(e){ out.ensureRejected = true; }
  out.libDefined = typeof html2canvas!=='undefined';
  return out;
});
console.log('ensureLib_ رفض التحميل؟', r.ensureRejected?'✅ آه':'❌ لأ، رجّع '+r.ensure);
console.log('المكتبة معرّفة فعلاً؟', r.libDefined?'آه':'لأ');
// دلوقتي نجرّب التصدير كامل
const seen=[];
const t=setInterval(async()=>{ try{
  const m=await pg.evaluate(()=>{const e=document.getElementById('toast');
    return e.classList.contains('show')?e.textContent:null;});
  if(m && !seen.includes(m)) seen.push(m);
}catch(e){} }, 150);
await pg.evaluate(()=>{ state.orders=[{id:'T1',ts:Date.now(),name:'م',phone:'01',region:'ط',warehouse:'إ',
  status:'New',total:1,items:[{kind:'door',title:'باب',code:'A01',sizeTxt:'70 سم',sizeEn:'70 cm',unitPrice:1,qty:1,w:70}]}];
  return makeDoc(state.orders[0],'order'); }).catch(()=>{});
await pg.waitForTimeout(4000); clearInterval(t);
console.log('رسالة للمستخدم عند الضغط على PDF:', seen.length?'✅ '+JSON.stringify(seen):'❌ ولا رسالة');
console.log('أخطاء غير ممسوكة:', errs.length?('⚠️ '+errs.join(' | ')):'✅ مفيش');
await b.close();
