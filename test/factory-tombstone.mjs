// v327: طلب المصنع حذفه لازم يختفي من «تابع طلبك» حتى لو استلامه ما اتأكدش على الجهاز.
import fs from 'fs';
import vm from 'node:vm';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const fn = /function applyFactoryTombstones327_\(ids,phone\)\{[\s\S]*?\n\}\r?\n/.exec(html);
check('لقينا applyFactoryTombstones327_', !!fn);
check('loadTrack بينادي الدالة', /applyFactoryTombstones327_\(d\.deleted,phone\)/.test(html));
check('السيرفر بيرجّع deleted مع قايمة الموبايل', /deleted: readDeleted327_\(phone\.slice\(-9\)\)/.test(gs));
check('deleteOrder بيسجّل الحذف', /recordDeleted327_\(\[\[e\.parameter\.id, phDO\]\]\)/.test(gs));
check('deleteDelivered بيسجّل الحذف', /recordDeleted327_\(deletedPairs327\)/.test(gs));

const mk = (orders, rows=[], pend=[]) => {
  const store = {}; const toasts=[]; const deleted=[]; let pendNow=pend.slice();
  const ctx = { String, Array, Set,
    state:{ orders, track:{ rows } },
    load:(k,d)=>store[k]===undefined?d:store[k], save:(k,v)=>{store[k]=v;return true;},
    markDeleted_:(id)=>deleted.push(String(id)),
    loadPendingSync_:()=>pendNow, savePendingSync_:(l)=>{pendNow=l;},
    saveOrders_:()=>true, toast:(m)=>toasts.push(m) };
  vm.createContext(ctx); vm.runInContext(fn[0], ctx);
  return { ctx, toasts, deleted, pend:()=>pendNow };
};
const PH='01012345678';
{ // طلب لم يتأكد استلامه (مش في sent) لكن السيرفر بيقول إنه اتحذف
  const t = mk([{id:'A',phone:PH},{id:'B',phone:PH}], [], ['A']);
  const n = vm.runInContext(`applyFactoryTombstones327_(['A'],'${PH}')`, t.ctx);
  check('اتشال طلب واحد', n===1, String(n));
  check('A اتشال و B فضل', t.ctx.state.orders.map(o=>o.id).join()==='B');
  check('اتشال من المعلّق كمان', t.pend().length===0);
  check('اتسجّل كمحذوف (ما يرجعش من جهاز تاني)', t.deleted.join()==='A');
}
{ // السيرفر لسه شايل الطلب (مش مفروض يتشال حتى لو id في قايمة المحذوف)
  const t = mk([{id:'A',phone:PH}], [{id:'A'}]);
  check('لو لسه موجود في رد السيرفر ما يتشالش', vm.runInContext(`applyFactoryTombstones327_(['A'],'${PH}')`, t.ctx)===0);
}
{ // رقم موبايل تاني
  const t = mk([{id:'A',phone:'01199999999'}]);
  check('طلب بموبايل مختلف ما يتشالش', vm.runInContext(`applyFactoryTombstones327_(['A'],'${PH}')`, t.ctx)===0);
}
{ // سيرفر قديم بدون deleted
  const t = mk([{id:'A',phone:PH}]);
  check('من غير deleted مفيش تغيير', vm.runInContext(`applyFactoryTombstones327_(undefined,'${PH}')`, t.ctx)===0);
}
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`); process.exit(fail?1:0);
