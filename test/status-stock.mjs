// رصيد المخزن بيتخصم لما الطلب يتعمل، وبيرجع لما يتلغي أو يتحذف.
// لكن تغيير الحالة لـ "ملغي" من setStatus مكانش بيرجّع الرصيد — فطلب ملغي
// يفضل رصيده مخصوم للأبد. الاختبار بيقرا منطق الدالة من الملف مباشرة.
import fs from 'fs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const block = /if \(action === 'setStatus'\)[\s\S]*?\n    \}\n/.exec(gs)[0];

check('بيقرا الحالة القديمة قبل ما يكتب الجديدة',
  /var oldStatus[\s\S]*?shS\.getRange\(r, COL_STATUS\)\.setValue\(newStatus\)/.test(block));
check('التحويل لـ Cancelled بيرجّع الرصيد',
  /newStatus === 'Cancelled'[\s\S]{0,120}adjustStockForOrderId_\([^)]*\+1\)/.test(block));
check('المُسلَّم فعليًا مايرجعش رصيده',
  /newStatus === 'Cancelled' && oldStatus !== 'Delivered'/.test(block));
check('الرجوع من Cancelled لحالة نشطة بيخصم تاني',
  /oldStatus === 'Cancelled' && newStatus !== 'Cancelled'[\s\S]{0,120}adjustStockForOrderId_\([^)]*-1\)/.test(block));
check('مفيش تعديل رصيد لو الحالة ما اتغيرتش (مفيش خصم مزدوج)',
  /if \(newStatus !== oldStatus\)/.test(block));
check('كله جوّه القفل',
  /LockService\.getScriptLock/.test(block) && block.indexOf('adjustStockForOrderId_') > block.indexOf('waitLock'));

// الدالة الموحّدة موجودة والقديمة لسه شغّالة
check('adjustStockForOrderId_ موجودة وبتاخد اتجاه',
  /function adjustStockForOrderId_\(id, dir\)[\s\S]*?adjustStockForItems_\(itemsRS, dir\)/.test(gs));
check('restoreStockForOrderId_ لسه شغّالة (الإلغاء والحذف بيستعملوها)',
  /function restoreStockForOrderId_\(id\)\{ adjustStockForOrderId_\(id, \+1\); \}/.test(gs));
check('الإلغاء والحذف لسه بيرجّعوا الرصيد',
  (gs.match(/restoreStockForOrderId_\(e\.parameter\.id\)/g)||[]).length === 2);

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
