#!/usr/bin/env bash
# بيشغّل كل ملفات الاختبار على سيرفر محلي مؤقت.
#   ./test/run-all.sh            → بورت تلقائي
#   PORT=8100 ./test/run-all.sh  → بورت محدد
set -u
cd "$(dirname "$0")/.."
PORT="${PORT:-$((8100 + RANDOM % 800))}"
python3 -m http.server "$PORT" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 2

export APP_URL="http://localhost:$PORT/index.html"
fails=0
for f in test/*.mjs; do
  if out=$(node "$f" 2>&1); then
    echo "✅ $f"
  else
    echo "❌ $f"
    echo "$out" | grep '❌' | head -5
    fails=$((fails+1))
  fi
done
echo "──────────────────────────"
[ "$fails" -eq 0 ] && echo "كل الملفات نجحت" || echo "فشل $fails ملف"
exit "$fails"
