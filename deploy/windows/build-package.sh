#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# ساخت بسته‌ی نصب برای ویندوز سرور.
#
# چرا لازم است: خروجی standalone نکست فقط چیزهایی را دارد که برای *اجرا*
# لازم است. سه چیزی که برای *نصب* لازم است در آن نیست:
#   - ابزار خط‌فرمان prisma (برای ساخت جدول‌ها)
#   - پوشه‌ی مهاجرت‌ها
#   - فایل seed که تایپ‌اسکریپت است و روی سرور مفسر ندارد
# این اسکریپت هر سه را اضافه می‌کند تا روی سرور فقط «اجرا» بماند.
#
# اجرا:  bash deploy/windows/build-package.sh
# خروجی: dist/persian-padel-windows.zip
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

OUT="$ROOT/dist/persian-padel-windows"
ZIP="$ROOT/dist/persian-padel-windows.zip"

step() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }
ok()   { printf '    \033[32m[OK]\033[0m   %s\n' "$1"; }

step "پاک‌کردن خروجی قبلی"
rm -rf "$OUT" "$ZIP"
mkdir -p "$OUT"
ok "dist آماده شد"

step "ساخت برنامه"
# هر دو موتور کوئری (لینوکس و ویندوز) تولید می‌شوند — binaryTargets در schema
npx prisma generate >/dev/null
NODE_OPTIONS="--max-old-space-size=3072" npx next build 2>&1 | grep -E '✓|error|Error' | head -5
[ -d .next/standalone ] || { echo "خروجی standalone ساخته نشد"; exit 1; }
ok "build تمام شد"

step "کپی خروجی اجرا"
cp -r .next/standalone/. "$OUT/"
# نکست این دو را در standalone نمی‌گذارد ولی بدونشان صفحه بدون CSS بالا می‌آید
mkdir -p "$OUT/.next"
cp -r .next/static "$OUT/.next/static"
[ -d public ] && cp -r public "$OUT/public"
ok "server.js و فایل‌های ایستا کپی شدند"

step "افزودن ابزار مهاجرت پایگاه داده"
mkdir -p "$OUT/prisma"
cp prisma/schema.prisma "$OUT/prisma/"
cp -r prisma/migrations "$OUT/prisma/migrations"
# ابزار prisma و وابستگی‌هایش را کنار بسته نصب می‌کنیم تا روی سرور
# نیازی به npm install و دسترسی به اینترنت نباشد
PRISMA_VER="$(node -p "require('./package.json').devDependencies.prisma || require('./package.json').dependencies.prisma")"
TMP_CLI="$(mktemp -d)"
( cd "$TMP_CLI" \
  && npm init -y >/dev/null 2>&1 \
  && npm install --no-audit --no-fund --omit=dev "prisma@${PRISMA_VER}" >/dev/null 2>&1 )
mkdir -p "$OUT/node_modules"
cp -r "$TMP_CLI/node_modules/." "$OUT/node_modules/"
rm -rf "$TMP_CLI"
[ -f "$OUT/node_modules/prisma/build/index.js" ] || { echo "ابزار prisma کپی نشد"; exit 1; }
ok "prisma CLI v${PRISMA_VER} و $(ls prisma/migrations | grep -c '^2' || true) مهاجرت اضافه شد"

step "ترجمه‌ی فایل seed به جاوااسکریپت"
# seed.ts روی سرور مفسر ندارد؛ اینجا به یک فایل مستقل تبدیلش می‌کنیم
# alias برای server-only: آن بسته عمداً خطا می‌دهد تا کد سروری به باندل
# مرورگر نرود. seed اصلاً مرورگر ندارد، ولی چون همان ماژول‌های اپ را وارد
# می‌کند به آن نگهبان برمی‌خورد و اجرا نمی‌شود.
npx esbuild prisma/seed.ts \
  --bundle --platform=node --target=node20 --format=cjs \
  --external:@prisma/client --external:.prisma \
  --alias:server-only="$ROOT/deploy/windows/shims/server-only.js" \
  --outfile="$OUT/prisma/seed.js" --log-level=error

# اگر باندل حتی نحو درستی نداشته باشد، همین حالا بفهمیم نه وسط نصب روی سرور
node --check "$OUT/prisma/seed.js" || { echo "seed.js نحو معتبر ندارد"; exit 1; }
ok "seed.js ساخته شد ($(du -h "$OUT/prisma/seed.js" | cut -f1))"

step "کپی اسکریپت‌های نصب و راهنماها"
mkdir -p "$OUT/deploy/windows" "$OUT/docs"
cp deploy/windows/*.ps1 "$OUT/deploy/windows/"
# راحتیِ کاربر: اسکریپت‌ها کنار ریشه هم باشند
cp deploy/windows/*.ps1 "$OUT/"
for f in WINDOWS-SERVER.md PAYMENT-GATEWAY.md; do
  [ -f "docs/$f" ] && cp "docs/$f" "$OUT/docs/"
done
[ -f deploy/windows/START-HERE.txt ] && cp deploy/windows/START-HERE.txt "$OUT/"
ok "اسکریپت‌ها و راهنماها اضافه شدند"

step "بررسی سلامت بسته"
fail=0
check() { if [ -e "$OUT/$1" ]; then ok "$1"; else printf '    \033[31m[X]    %s غایب است\033[0m\n' "$1"; fail=1; fi }
check server.js
check .next/static
check prisma/schema.prisma
check prisma/migrations
check prisma/seed.js
check node_modules/prisma/build/index.js
check node_modules/.prisma/client/query_engine-windows.dll.node
check Install.ps1
check Install-Service.ps1
check Install-IIS.ps1
check Setup-SSL.ps1
[ "$fail" -eq 0 ] || { echo; echo "بسته ناقص است."; exit 1; }

step "فشرده‌سازی"
( cd "$ROOT/dist" && zip -qr "$(basename "$ZIP")" "$(basename "$OUT")" )
ok "$(du -h "$ZIP" | cut -f1)  →  $ZIP"

echo
printf '\033[32m===========================================================\033[0m\n'
printf '\033[32m   بسته آماده است: dist/persian-padel-windows.zip\033[0m\n'
printf '\033[32m===========================================================\033[0m\n'
echo "   این فایل را با RDP روی ویندوز سرور کپی و باز کنید،"
echo "   بعد راهنمای docs/WINDOWS-SERVER.md را دنبال کنید."
