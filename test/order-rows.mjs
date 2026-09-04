// readOrderRows_ في apps_script.gs بتقرا صفوف شيت Orders على مرحلتين عشان تتخطى
// الأعمدة التقيلة (Message / Pricing Terms / Status Updated) اللي محدش بيقراها.
// الاختبار ده بيتأكد إن الصف اللي بترجّعه **مطابق تمامًا** لقراءة الشيت كامل،
// ما عدا التلات أعمدة دي — يعني كل الكود اللي بيقرا rows[i][N] يفضل شغّال زي ما هو.
import fs from 'fs';

const src = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const fn = /function readOrderRows_\(sh\) \{[\s\S]*?\n\}/.exec(src)[0];
const HEAD = /var HEAD_ORDERS = \[([\s\S]*?)\];/.exec(src)[1]
  .replace(/\n/g, '').split(',').map(x => x.trim().replace(/^'|'$/g, ''));

let pass = 0, fail = 0;
const check = (n, ok, x='') => { console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

// شيت وهمي: كل خانة قيمتها "r<صف>c<عمود>" عشان نعرف لو حصل أي إزاحة
function makeSheet(nRows) {
  const data = [];
  for (let r = 0; r < nRows; r++) {
    const row = [];
    for (let c = 0; c < HEAD.length; c++) row.push('r' + r + 'c' + c);
    data.push(row);
  }
  return {
    _data: data,
    _reads: [],
    getLastRow: () => nRows + 1,          // +1 للترويسة
    getRange(r, c, nr, nc) {
      this._reads.push({ r, c, nr, nc });
      const self = this;
      return { getValues: () => self._data.slice(r - 2, r - 2 + nr).map(x => x.slice(c - 1, c - 1 + nc)) };
    }
  };
}

globalThis.HEAD_ORDERS = HEAD;
const readOrderRows_ = new Function('sh', fn.replace(/^function readOrderRows_\(sh\) \{/, '').replace(/\}$/, ''));

const SKIPPED = [12, 13, 14];   // Pricing Terms · Message · Status Updated

// ---- الحالة العادية ----
const sh = makeSheet(5);
const rows = readOrderRows_(sh);
check('عدد الصفوف صح', rows.length === 5, String(rows.length));
check('عرض الصف = عدد الأعمدة', rows.every(r => r.length === HEAD.length), String(rows[0].length));

let shifted = null;
for (let r = 0; r < 5 && !shifted; r++) {
  for (let c = 0; c < HEAD.length; c++) {
    const want = SKIPPED.includes(c) ? '' : 'r' + r + 'c' + c;
    if (rows[r][c] !== want) { shifted = `صف ${r} عمود ${c} (${HEAD[c]}): المتوقع "${want}" والفعلي "${rows[r][c]}"`; break; }
  }
}
check('كل خانة في مكانها الصح (مفيش إزاحة أعمدة)', !shifted, shifted || '');
check('الأعمدة التقيلة اتخطّت فعلاً', SKIPPED.every(c => rows[0][c] === ''),
      SKIPPED.map(c => HEAD[c]).join(' · '));

// الأعمدة اللي الكود بيقراها بالاسم لازم تبقى سليمة
const NEEDED = { 'Order No':0, 'Date':1, 'Distributor':3, 'Phone':4, 'Region':5, 'Total Qty':7,
  'Total Rods':8, 'Total Amount':9, 'Status':10, 'Note to Distributor':11, 'Archived':15,
  'Customer':16, 'Order Note':17, 'Customer Phone':18, 'Replaces Order':20, 'Display No':21,
  'Edit Count':22, 'Edited At':23 };
const bad = Object.entries(NEEDED).filter(([name, i]) => HEAD[i] !== name || rows[0][i] !== 'r0c' + i);
check('كل الأعمدة المستخدمة بترجع بقيمتها', bad.length === 0, bad.map(([n]) => n).join(', '));

// ---- عدد القراءات ----
check('قراءتين بس من الشيت', sh._reads.length === 2, String(sh._reads.length));
check('مابيقراش عمود Message (14)', !sh._reads.some(x => x.c <= 14 && x.c + x.nc - 1 >= 14),
      sh._reads.map(x => `أعمدة ${x.c}..${x.c + x.nc - 1}`).join(' + '));

// ---- شيت فاضي ----
check('شيت فاضي بيرجّع قايمة فاضية', readOrderRows_(makeSheet(0)).length === 0);
check('صف واحد بس شغّال', readOrderRows_(makeSheet(1)).length === 1);

console.log(`\n${pass}/${pass + fail} نجحت`);
process.exit(fail ? 1 : 0);
