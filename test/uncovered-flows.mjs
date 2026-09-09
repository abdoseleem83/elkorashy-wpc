// مسارات كانت من غير أي اختبار: الإكسسوارات، ألواح البروديوم، معاينة صورة الباب،
// الأسعار المخصّصة (الأوفررايد) بمستوياتها، ودورة الأرشيف كاملة.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1400);
await pg.evaluate(()=>{ window.toast=(m)=>{ window.__toast=m; }; });

// ═══ ١) الإكسسوارات ═══
{
  const r = await pg.evaluate(()=>{
    state.cart=[]; state.acc={};
    addAccessories();                        // من غير أي كميات
    const رسالة_فاضي = window.__toast;
    const a1 = ACCESSORIES[0], a2 = ACCESSORIES[1];
    state.acc[a1.id] = 3;
    addAccessories();
    const بعد_الأولى = JSON.parse(JSON.stringify(state.cart));
    state.acc[a1.id] = 2;                    // نفس الصنف تاني — لازم يتجمع
    addAccessories();
    const مجمّع = state.cart.filter(it=>it.kind==='acc' && it.id===a1.id);
    state.acc[a2.id] = 1;
    addAccessories();
    return { رسالة_فاضي, عدد_أول:بعد_الأولى.length, كمية_مجمّعة: مجمّع[0] && مجمّع[0].qty,
             عدد_سطور_نفس_الصنف: مجمّع.length, إجمالي_السلة: state.cart.length,
             الكميات_اتصفرت: Object.keys(state.acc).length===0,
             سعر: مجمّع[0] && مجمّع[0].price === a1.price };
  });
  check('من غير كميات: بيقول «محددتش أي كميات»', /محددتش/.test(r.رسالة_فاضي||''), r.رسالة_فاضي);
  check('الإضافة بتحط الصنف في السلة', r.عدد_أول===1, String(r.عدد_أول));
  check('نفس الصنف تاني بيتجمع في سطر واحد (٣+٢=٥)',
    r.عدد_سطور_نفس_الصنف===1 && r.كمية_مجمّعة===5, 'سطور='+r.عدد_سطور_نفس_الصنف+' كمية='+r.كمية_مجمّعة);
  check('السعر مأخوذ من الكتالوج', r.سعر===true);
  check('صنف تاني بيتضاف سطر مستقل', r.إجمالي_السلة===2, String(r.إجمالي_السلة));
  check('الكميات بتتصفّر بعد الإضافة', r.الكميات_اتصفرت);
}

// ═══ ٢) ألواح البروديوم ═══
{
  const r = await pg.evaluate(()=>{
    state.cart=[]; state.pd={code:'', qty:''};
    addPanel();  const بدون_كود = window.__toast;
    state.pd.code = DOORS[0].code; state.pd.qty = 0;
    addPanel();  const بدون_عدد = window.__toast;
    state.pd.qty = 4; addPanel();
    const أول = JSON.parse(JSON.stringify(state.cart));
    // addPanel بيصفّر state.pd بعد كل إضافة، فبنعيد ظبطه
    state.pd = {code: DOORS[0].code, qty: 3}; addPanel();      // نفس اللون — يتجمع
    const مجمّع = state.cart.filter(it=>it.kind==='panel');
    state.pd = {code: DOORS[1].code, qty: 2}; addPanel();
    return { بدون_كود, بدون_عدد, كمية: مجمّع[0] && مجمّع[0].qty, عدد_سطور: مجمّع.length,
             إجمالي: state.cart.length, سعر: مجمّع[0] && مجمّع[0].price === PRODIUM_PRICE,
             عنوان: أول[0] && أول[0].title };
  });
  check('من غير كود: بيطلب الكود', /كود/.test(r.بدون_كود||''), r.بدون_كود);
  check('من غير عدد: بيطلب العدد', /عدد/.test(r.بدون_عدد||''), r.بدون_عدد);
  check('نفس اللون بيتجمع في سطر واحد (٤+٣=٧)',
    r.عدد_سطور===1 && r.كمية===7, 'سطور='+r.عدد_سطور+' كمية='+r.كمية);
  check('ولون تاني سطر مستقل', r.إجمالي===2, String(r.إجمالي));
  check('سعر اللوح من الكتالوج', r.سعر===true);
  check('اسم الصنف فيه «لوح بروديوم»', /لوح بروديوم/.test(r.عنوان||''), r.عنوان);
}

// ═══ ٣) معاينة صورة الباب ═══
{
  const r = await pg.evaluate(async ()=>{
    showDoorPreview(DOORS[0].code);
    await new Promise(r=>setTimeout(r,300));
    const ov = document.querySelector('.imgpv, #doorPreviewOverlay, [id*="review"]');
    const أي_طبقة = document.body.lastElementChild;
    return { فتحت: !!(ov || (أي_طبقة && أي_طبقة.querySelector && أي_طبقة.querySelector('img'))),
             فيه_صورة: !!document.querySelector('body > div img[src*="doors"]') };
  });
  check('معاينة الباب بتفتح وفيها الصورة', r.فتحت && r.فيه_صورة, JSON.stringify(r));
  await pg.evaluate(()=>{ const el=document.querySelector('body > div:last-child'); if(el && el.remove) el.remove(); });
}

// ═══ ٤) الأسعار المخصّصة (أوفررايد) ═══
{
  const r = await pg.evaluate(()=>{
    const w = SIZES[0].w, قديم = SIZES[0].price;
    const code = DOORS[0].code;
    localStorage.setItem('wpc_prices', JSON.stringify({
      dist:   { sizes:{ [w]: 1111 }, customExtra: 55, acc:{ [ACCESSORIES[0].id]: 77 }, panel:{prodium: 99} },
      showroom:{ sizes:{ [w]: 2222 } },
      customer:{ sizes:{ [w]: 3333 } }
    }));
    applyPriceOverrides();
    return {
      جملة: SIZES[0].price, إضافي_خاص: CUSTOM_EXTRA,
      إكسسوار: ACCESSORIES[0].price, لوح: PRODIUM_PRICE,
      معرض: tierPrice(SIZES[0].price, 'door', 'showroom', w),
      عميل: tierPrice(SIZES[0].price, 'door', 'customer', w),
      // من غير أوفررايد بيرجع للسعر الأساسي + الزيادة الثابتة للمستوى
      معرض_مقاس_تاني: tierPrice(SIZES[1].price, 'door', 'showroom', SIZES[1].w),
      حجم_تاني_ماتغيرش: SIZES[1].price,
      قديم
    };
  });
  const SIZES1 = r.حجم_تاني_ماتغيرش;
  check('سعر الجملة اتغيّر للمقاس المحدد', r.جملة===1111, String(r.جملة));
  check('والمقاس التاني ما اتغيرش', r.حجم_تاني_ماتغيرش !== 1111, String(r.حجم_تاني_ماتغيرش));
  check('إضافي المقاس الخاص اتغيّر', r.إضافي_خاص===55, String(r.إضافي_خاص));
  check('سعر الإكسسوار اتغيّر', r.إكسسوار===77, String(r.إكسسوار));
  check('سعر لوح البروديوم اتغيّر', r.لوح===99, String(r.لوح));
  check('سعر المعرض منفصل عن الجملة', r.معرض===2222, String(r.معرض));
  check('وسعر العميل منفصل كمان', r.عميل===3333, String(r.عميل));
  check('المقاس اللي مالوش سعر مخصّص بياخد زيادة المستوى الثابتة',
    r.معرض_مقاس_تاني > SIZES1, 'معرض='+r.معرض_مقاس_تاني+' جملة='+SIZES1);
}

// ═══ ٥) دورة الأرشيف كاملة ═══
// مفيش زرار «أرشفة» يدوي في التطبيق: الأرشفة بتحصل لما الحالة تبقى «تم التسليم»
// (السيرفر بيرجّع archived:true)، والرجوع بيبقى من زرار «رجّع» في شاشة الأرشيف.
{
  const r = await pg.evaluate(async ()=>{
    const نداءات=[];
    window.jsonp = (url)=>{ نداءات.push(url);
      return Promise.resolve({ok:true, id:'A1', status:'Delivered', archived: /status=Delivered/.test(url)}); };
    state.admin.open=true; state.admin.pw='x'; state.tab='admin'; state.admin.viewArchive=false;
    state.admin.rows=[{id:'A1', displayNo:1, date:'2026-09-01', customer:'ع', dist:'م', phone:'01',
      status:'Ready', qty:5, total:500}];
    state.admin.archRows=[];
    renderNow();
    await setStatus('A1','Delivered');            // تسليم = أرشفة أوتوماتيك
    const بعد = { في_النشط: state.admin.rows.length, نداء: نداءات[نداءات.length-1] };

    // دلوقتي بيبان في الأرشيف، والرجوع بيشيله منه ويرجّعه للنشط
    state.admin.viewArchive = true;
    state.admin.archRows=[{id:'A1', displayNo:1, date:'2026-09-01', customer:'ع', dist:'م', phone:'01',
      status:'Delivered', qty:5, total:500}];
    renderNow();
    await unarchiveOrder('A1');
    return { بعد, في_الأرشيف: state.admin.archRows.length, رجع_للنشط: state.admin.rows.length,
             نداء_الرجوع: نداءات[نداءات.length-1] };
  });
  check('التسليم بيشيل الطلب من الشاشة النشطة (أرشفة أوتوماتيك)',
    r.بعد.في_النشط===0, String(r.بعد.في_النشط));
  check('وبيبعت الحالة للسيرفر', /status=Delivered/.test(r.بعد.نداء||''), r.بعد.نداء);
  check('الرجوع من الأرشيف بيشيله من الأرشيف', r.في_الأرشيف===0, String(r.في_الأرشيف));
  check('وبيرجّعه للطلبات النشطة', r.رجع_للنشط===1, String(r.رجع_للنشط));
  check('وبيبعت archived=0', /archived=0/.test(r.نداء_الرجوع||''), r.نداء_الرجوع);
}

// ═══ ٦) كشف الجهاز (شاشات التثبيت) ═══
{
  const r = await pg.evaluate(()=>{
    const أصلي = navigator.userAgent;
    const جرّب = (ua)=>{ Object.defineProperty(navigator,'userAgent',{value:ua, configurable:true});
      return { ios: isIOSDevice(), webview: isInAppWebView() }; };
    const نتايج = {
      ايفون: جرّب('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605'),
      اندرويد: جرّب('Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari/537'),
      فيسبوك: جرّب('Mozilla/5.0 (Linux; Android 13; wv) Chrome/120 [FBAN/FB4A;FBAV/400]'),
      انستجرام: جرّب('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Instagram 300.0'),
      كمبيوتر: جرّب('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120')
    };
    Object.defineProperty(navigator,'userAgent',{value:أصلي, configurable:true});
    return نتايج;
  });
  check('بيعرف الآيفون', r.ايفون.ios===true && r.ايفون.webview===false, JSON.stringify(r.ايفون));
  check('والأندرويد العادي مش آيفون ولا متصفح داخلي',
    r.اندرويد.ios===false && r.اندرويد.webview===false, JSON.stringify(r.اندرويد));
  check('ومتصفح فيسبوك الداخلي', r.فيسبوك.webview===true, JSON.stringify(r.فيسبوك));
  check('ومتصفح انستجرام الداخلي', r.انستجرام.webview===true, JSON.stringify(r.انستجرام));
  check('والكمبيوتر عادي', r.كمبيوتر.ios===false && r.كمبيوتر.webview===false, JSON.stringify(r.كمبيوتر));
}

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
