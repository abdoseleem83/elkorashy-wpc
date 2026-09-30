// الاختبارات اللي بتشغّل كود السيرفر جوه vm لازم تلاقي نفس الثوابت اللي
// الكود بيندهها. كل مرة ثابت جديد بيتضاف، الصناديق دي كانت بتفشل بـ
// «X is not defined» — مش باج في التطبيق، بس وقت ضايع في كل مرة.
// الملف ده بيطلّع تعريفات الأعمدة **من apps_script.gs نفسه** (مش نسخة
// مكتوبة بالإيد، عشان الاختبار يفضل بيقيس الكود الحقيقي).
import fs from 'node:fs';

export const مصدر = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');

const كل = re => (مصدر.match(re) || []).join('\n');
const أول = re => (re.exec(مصدر) || [''])[0];

// أرقام الأعمدة لوحدها. دي اللي بتتحقن في الصناديق اللي عندها HEAD_* وهمية
// (عدد أعمدة مختلف) — حقن HEAD_* الحقيقية فيها كان هيكسر السطور الوهمية.
export const ثوابت = كل(/^var COL_[A-Z_]+\s*=\s*\d+;/gm);

// الترتيب مهم: HEAD_* و GAP_COLS_ الأول عشان GAP_FIRST_COL_ بتعتمد عليهم.
export const أعمدة = [
  كل(/^var HEAD_[A-Z_]+ = \[[\s\S]*?\];$/gm),
  كل(/^var GAP_COLS_ = \[[^\]]*\];$/gm),
  أول(/var GAP_FIRST_COL_ = \(function \(\) \{[\s\S]*?\n\}\)\(\);/),
  كل(/^var COL_[A-Z_]+\s*=\s*\d+;/gm)
].filter(Boolean).join('\n');
