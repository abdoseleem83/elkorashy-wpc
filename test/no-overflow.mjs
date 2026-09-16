// كارت الإكسسوار التالت في كل صف كان بيتقص برّه الشاشة على الموبايل — الموزّع
// مكانش شايف تلت الإكسسوارات أصلاً ولا يقدر يضغط عليها. السبب إن عدّاد الكمية
// عرضه ثابت أكبر من عمود الشبكة، فالشبكة تتمدّ والباقي يطلع برّه.
// الاختبار ده بيفتح كل شاشة ويتأكد إن مفيش عنصر خارج حدود الشاشة (غير اللي
// جوّه صندوق بيتمرّر أفقيًا بنيّة زي جدول المخزن).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();

for(const عرض of [360, 412]){
  const pg = await (await b.newContext({viewport:{width:عرض,height:915}})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(1300);
  await pg.evaluate(()=>{
    window.toast=()=>{}; window.busy=()=>{};
    window.__برّه = ()=>{
      const جواه_تمرير = el=>{ for(let n=el.parentElement;n&&n!==document.body;n=n.parentElement){
          if(/auto|scroll/.test(getComputedStyle(n).overflowX)) return true; } return false; };
      const خارج=[];
      document.querySelectorAll('#view *').forEach(el=>{
        if(جواه_تمرير(el)) return;
        const r=el.getBoundingClientRect();
        if(r.width>0 && (r.right>window.innerWidth+2 || r.left<-2))
          خارج.push((el.className?'.'+String(el.className).split(' ')[0]:el.tagName.toLowerCase())
                    +' ['+Math.round(r.left)+'→'+Math.round(r.right)+']');
      });
      return خارج;
    };
  });

  const شاشة = async (اسم, تجهيز)=>{
    await pg.evaluate(تجهيز);
    await pg.waitForTimeout(350);
    const خارج = await pg.evaluate(()=>window.__برّه());
    check(`${عرض}px — ${اسم}`, خارج.length===0, خارج.slice(0,3).join(' · '));
  };

  await شاشة('طلب جديد', ()=>{ state.tab='new'; state.newSection=''; render(); });
  await شاشة('الأبواب', ()=>{ state.newSection='doors';
    state.pick={code:'A01',sizes:{'70':{qty:2,height:'',frame:10,frameHeight:'',dbror:'6×9',hafr:false,wood:true,frameKind:null,frameRodQty:'',frameForDoors:''}},
      customOn:false,note:'',custom:{w:'',h:'',qty:1,frame:null,frameHeight:'',dbror:null,hafr:false,wood:false,frameKind:null,frameRodQty:'',frameForDoors:''}};
    render(); });
  await شاشة('باب مقاس خاص', ()=>{ state.pick.customOn=true;
    state.pick.custom={w:'85',h:'225',qty:2,frame:10,frameHeight:'218',dbror:'6×9',hafr:true,wood:true,frameKind:'rods',frameRodQty:'4',frameForDoors:'2'};
    render(); });
  await شاشة('الإكسسوارات', ()=>{ state.newSection='acc'; render(); });
  await شاشة('حلق فقط', ()=>{ state.newSection='frames'; state.fr.nonStd=true; state.fr.extra=[{cm:'180.5',qty:2}]; render(); });
  await شاشة('برور فقط', ()=>{ state.newSection='brors'; render(); });
  await شاشة('ألواح بروديوم', ()=>{ state.newSection='panels'; render(); });
  await شاشة('السلة', ()=>{
    state.cart=[{kind:'door',code:'A01',title:'باب A01 أرو — 70 سم (حفر)',sizeTxt:'70 سم',sizeEn:'70 cm',w:70,qty:5,
                 unitPrice:5400,frame:10,dbror:'6×9',note:'حفر جانبي وردة — الطول لأربع أبواب'},
                {kind:'frame',qty:9,customSet:true,price:206.31,title:'حلق باب 10 سم — قائم 200 سم × 6 + عارضة حلق علوية 120 سم × 3',
                 spec:'قائم 200 سم × 6 + عارضة حلق علوية 120 سم × 3'}];
    saveCart_(); state.tab='cart'; render(); });
  await شاشة('تابع طلبك', ()=>{
    state.orders=[{id:'O1',no:142,date:'2026-09-14',ts:Date.now(),status:'In Progress',name:'محمد',
      phone:'01000000000',region:'طنطا',customer:'مؤسسة الخليفة جروب للمقاولات',editCount:2,replacesId:'O0',prevNo:141,
      items:[{kind:'door',code:'A01',title:'باب',sizeTxt:'70 سم',qty:5,unitPrice:5400}],total:27000}];
    state.tab='orders'; render(); });
  await شاشة('المصنع', ()=>{
    Object.assign(state.admin,{open:true,loading:false,viewStock:false,viewArchive:false,pricesOpen:false,
      groupOpen:{'مؤسسة الخليفة جروب للمقاولات':true},prodEdit:{},qtyEdit:{},
      rows:[{id:'B2',no:33,date:'2026-09-01',ts:Date.now(),status:'Ready',dist:'مؤسسة الخليفة جروب للمقاولات',
        phone:'01000000001',region:'المحلة',customer:'مؤسسة الخليفة جروب للمقاولات',qty:64,total:341600,
        items:[{type:'Door',code:'A01',title:'Door A01',size:'70 cm',qty:64,produced:60,unitPrice:5400}]}]});
    state.admin.openOrder='B2'; state.tab='admin'; render(); });
  await شاشة('أرصدة المخزن', ()=>{ state.admin.viewStock=true; state.admin.stockDraft={}; render(); });
  await شاشة('الأسعار', ()=>{ state.admin.viewStock=false; openAdminPrices(); render(); });

  check(`${عرض}px — مفيش أخطاء JS`, errs.length===0, errs.join(' | '));
  await pg.close();
}
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
