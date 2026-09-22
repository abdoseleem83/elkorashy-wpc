// «الحذف بيعلّق والسطر مش بيتمسح» — الاختبار ده بيشغّل مسار الحذف الحقيقي
// في المتصفح ويتأكد إن السطر بيختفي ويفضل مختفي:
//  ١) الحذف العادي بيشيله.
//  ٢) الفحص الخلفي اللي كان طالع قبل الحذف مابيرجّعوش تاني.
//  ٣) مهلة/قطع نت = محاولة تانية أوتوماتيك، مش رسالة فشل والسطر فاضل.
//  ٤) «الطلب مش موجود» = اتمسح خلاص، مش فشل.
//  ٥) فشل حقيقي = رسالة واضحة والزرار يرجع شغّال.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:1200,height:900}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const تهيئة = `
  window.confirm = () => true;
  state.admin.pw = 'x'; state.admin.open = true; state.tab = 'admin';
  state.admin.rows = [
    {id:'O1', displayNo:'1', status:'New', dist:'أ', qty:1, total:100},
    {id:'O2', displayNo:'2', status:'New', dist:'ب', qty:1, total:200}
  ];
  state.admin.archRows = null;
  _deletedIds.clear();
`;

{ // ١) حذف عادي
  const r = await pg.evaluate(`(async()=>{ ${تهيئة}
    window.jsonp = () => Promise.resolve({ok:true, id:'O1'});
    await deleteOrder('O1');
    return { ids: state.admin.rows.map(o=>o.id), busy: state.admin.delBusy };
  })()`);
  check('الحذف بيشيل السطر من الشاشة', r.ids.join(',')==='O2', r.ids.join(','));
  check('والزرار بيرجع شغّال', r.busy===null);
}

{ // ٢) ⚠️ بيت القصيد: فحص خلفي قديم فيه الطلب المحذوف
  const r = await pg.evaluate(`(async()=>{ ${تهيئة}
    window.jsonp = () => Promise.resolve({ok:true, id:'O1'});
    await deleteOrder('O1');
    // رد «list» كان طالع قبل الحذف — لسه فيه O1
    window.jsonp = () => Promise.resolve({ok:true, orders:[
      {id:'O1', displayNo:'1', status:'New', dist:'أ'},
      {id:'O2', displayNo:'2', status:'New', dist:'ب'}
    ]});
    await adminPoll();
    return state.admin.rows.map(o=>o.id);
  })()`);
  check('الفحص الخلفي مابيرجّعش الطلب المحذوف', r.join(',')==='O2', r.join(','));
}

{ // ٢ب) ونفس الحكاية لو المصنع عمل تحديث كامل للشاشة
  const r = await pg.evaluate(`(async()=>{ ${تهيئة}
    window.jsonp = () => Promise.resolve({ok:true, id:'O1'});
    await deleteOrder('O1');
    window.jsonp = () => Promise.resolve({ok:true, orders:[
      {id:'O1', status:'New'}, {id:'O2', status:'New'}
    ]});
    await adminLoad();
    return state.admin.rows.map(o=>o.id);
  })()`);
  check('وتحديث الشاشة كمان مابيرجّعوش', r.join(',')==='O2', r.join(','));
}

{ // ٢ج) النسخة المحفوظة كمان مافيهاش المحذوف
  const r = await pg.evaluate(`(async()=>{ ${تهيئة}
    window.jsonp = () => Promise.resolve({ok:true, id:'O1'});
    await deleteOrder('O1');
    const c = JSON.parse(localStorage.getItem('wpc_adm_rows')||'{}');
    return (c.rows||[]).map(o=>o.id);
  })()`);
  check('والنسخة المحفوظة مافيهاش المحذوف', r.join(',')==='O2', r.join(','));
}

{ // ٢د) الذاكرة دي مؤقتة — بعد المدة السيرفر هو المرجع
  const r = await pg.evaluate(`(async()=>{ ${تهيئة}
    window.jsonp = () => Promise.resolve({ok:true, id:'O1'});
    await deleteOrder('O1');
    _deletedIds.set('O1', Date.now() - (DELETED_TTL_MS + 1000));   // عدّى وقتها
    return dropDeleted_([{id:'O1'},{id:'O2'}]).map(o=>o.id);
  })()`);
  check('الذاكرة بتنتهي بعد المدة (مفيش تخزين بيكبر للأبد)', r.join(',')==='O1,O2', r.join(','));
}

{ // ٣) مهلة في المحاولة الأولى ونجاح في التانية
  const r = await pg.evaluate(`(async()=>{ ${تهيئة}
    let n = 0;
    window.jsonp = () => { n++; return n===1 ? Promise.reject(new Error('انتهت المهلة'))
                                              : Promise.resolve({ok:true, id:'O1', alreadyGone:true}); };
    await deleteOrder('O1');
    return { ids: state.admin.rows.map(o=>o.id), n, busy: state.admin.delBusy };
  })()`);
  check('المهلة = محاولة تانية أوتوماتيك', r.n===2, 'نداءات='+r.n);
  check('والسطر بيتشال في الآخر', r.ids.join(',')==='O2', r.ids.join(','));
  check('والزرار بيرجع شغّال', r.busy===null);
}

{ // ٤) «الطلب مش موجود» = اتمسح خلاص
  const r = await pg.evaluate(`(async()=>{ ${تهيئة}
    window.jsonp = () => Promise.resolve({ok:false, error:'الطلب مش موجود'});
    await deleteOrder('O1');
    return state.admin.rows.map(o=>o.id);
  })()`);
  check('«الطلب مش موجود» = السطر يتشال، مش رسالة فشل', r.join(',')==='O2', r.join(','));
}

{ // ٥) فشل حقيقي (كلمة سر غلط) = السطر يفضل ورسالة واضحة، من غير إعادة محاولة
  const r = await pg.evaluate(`(async()=>{ ${تهيئة}
    let n=0; window.jsonp = () => { n++; return Promise.resolve({ok:false, error:'كلمة السر غلط'}); };
    await deleteOrder('O1');
    return { ids: state.admin.rows.map(o=>o.id), busy: state.admin.delBusy, n };
  })()`);
  check('فشل حقيقي = السطر يفضل مكانه', r.ids.join(',')==='O1,O2', r.ids.join(','));
  check('والزرار يرجع شغّال برضه', r.busy===null);
  check('ورفض السيرفر مابيتعادش (نداء واحد بس)', r.n===1, 'نداءات='+r.n);
}

{ // ٦) قطع نت في المحاولتين = فشل، من غير ما الزرار يعلّق
  const r = await pg.evaluate(`(async()=>{ ${تهيئة}
    let n=0; window.jsonp = () => { n++; return Promise.reject(new Error('تعذّر الاتصال')); };
    await deleteOrder('O1');
    return { ids: state.admin.rows.map(o=>o.id), n, busy: state.admin.delBusy };
  })()`);
  check('قطع نت = محاولتين بس، مش لوب', r.n===2, 'نداءات='+r.n);
  check('والسطر يفضل (الحذف فعلاً ما حصلش)', r.ids.join(',')==='O1,O2', r.ids.join(','));
  check('والزرار مايعلّقش', r.busy===null);
}

{ // ٧) «مسح المسلّم» كمان بيفضل ماسك بعد فحص خلفي
  const r = await pg.evaluate(`(async()=>{ ${تهيئة}
    state.admin.archRows = [{id:'A1', status:'Delivered'}, {id:'A2', status:'New'}];
    window.jsonp = () => Promise.resolve({ok:true, count:1, ids:['A1']});
    await clearDeliveredOrders();
    window.jsonp = () => Promise.resolve({ok:true, orders:[{id:'A1',status:'Delivered'},{id:'A2',status:'New'}]});
    await loadArchive();
    return (state.admin.archRows||[]).map(o=>o.id);
  })()`);
  check('المسلَّم الممسوح مابيرجعش في الأرشيف', r.join(',')==='A2', r.join(','));
}

check('مفيش أخطاء في الصفحة', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
