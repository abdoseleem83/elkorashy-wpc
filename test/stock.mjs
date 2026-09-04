import fs from 'fs';
const fn = fs.readFileSync('/tmp/fn.js','utf8');

function makeSheet(rows){                 // محاكاة بسيطة لـ Sheets
  const data = rows.map(r=>r.slice());
  return {
    getLastRow: ()=>data.length+1,
    getRange: (r,c,nr,nc)=>({
      getValues: ()=>data.slice(r-2, r-2+nr).map(x=>x.slice(c-1, c-1+nc)),
      setValues: (v)=>{ v.forEach((row,i)=>{ row.forEach((val,j)=>{ data[r-2+i][c-1+j]=val; }); }); },
      setValue: (v)=>{ data[r-2][c-1]=v; }
    }),
    _data: data
  };
}
let SH;
globalThis.sheet_ = ()=>SH;
globalThis.SHEET_STOCK=''; globalThis.HEAD_STOCK=[];
const adjust = new Function('items','dir', fn.replace(/^function adjustStockForItems_\(items, dir\)\{/,'').replace(/\}$/,''));

const cases = [
  ['سطر واحد',            [['A01','70',10,'']], [{kind:'door',code:'A01',w:'70',qty:3}], -1, 7],
  ['سطرين نفس الكود والمقاس', [['A01','70',10,'']], [{kind:'door',code:'A01',w:'70',qty:3},{kind:'door',code:'A01',w:'70',qty:2}], -1, 5],
  ['تلات سطور نفس المفتاح',   [['A01','70',10,'']], [{kind:'door',code:'A01',w:'70',qty:1},{kind:'door',code:'A01',w:'70',qty:1},{kind:'door',code:'A01',w:'70',qty:1}], -1, 7],
  ['مقاسات مختلفة',        [['A01','70',10,''],['A01','80',5,'']], [{kind:'door',code:'A01',w:'70',qty:4},{kind:'door',code:'A01',w:'80',qty:2}], -1, null],
  ['رجوع الرصيد (+1)',      [['A01','70',5,'']], [{kind:'door',code:'A01',w:'70',qty:3},{kind:'door',code:'A01',w:'70',qty:2}], +1, 10],
  ['كود مش في المخزن',      [['A01','70',10,'']], [{kind:'door',code:'A99',w:'70',qty:3}], -1, 10],
  ['مقاس خاص (بدون w)',     [['A01','70',10,'']], [{kind:'door',code:'A01',w:'',qty:3}], -1, 10],
  ['أصناف مش أبواب',        [['A01','70',10,'']], [{kind:'frame',code:'A01',w:'70',qty:3}], -1, 10],
];
let pass=0;
for(const [name, rows, items, dir, expect] of cases){
  SH = makeSheet(rows);
  adjust(items, dir);
  if(expect===null){
    const ok = SH._data[0][2]===6 && SH._data[1][2]===3;
    console.log((ok?'✅':'❌'), name, '→', SH._data.map(r=>r[0]+'/'+r[1]+'='+r[2]).join(', '));
    if(ok) pass++;
  } else {
    const got=SH._data[0][2], ok=got===expect;
    console.log((ok?'✅':'❌'), name, '→ المتوقع', expect, '| الفعلي', got);
    if(ok) pass++;
  }
}
console.log(`\n${pass}/${cases.length} نجحت`);
