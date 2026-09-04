#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# PERSIAN PADEL — ساخت بسته‌ی آپلود برای cPanel
#
# هاست اشتراکی معمولاً رم و زمان پردازش کافی برای ساخت پروژه ندارد، پس
# پروژه را روی کامپیوتر خودتان می‌سازیم و فقط خروجی را آپلود می‌کنیم.
#
#   bash deploy/build-for-cpanel.sh
#
# خروجی: cpanel-upload.zip  (همان را در File Manager آپلود و استخراج کنید)
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> پاک‌سازی خروجی قبلی"
rm -rf .next cpanel-upload.zip

echo "==> تولید کلاینت Prisma"
npx prisma generate

echo "==> ساخت پروژه (حالت cPanel — بدون خروجی standalone)"
CPANEL=1 NODE_OPTIONS="--max-old-space-size=3072" npx next build

echo "==> بسته‌بندی"
# node_modules آپلود نمی‌شود؛ خود cPanel با «Run NPM Install» نصبش می‌کند.
# .env هم آپلود نمی‌شود — مقادیرش را در خود پنل cPanel وارد کنید.
zip -qr cpanel-upload.zip \
  .next \
  public \
  prisma \
  app.js \
  package.json \
  package-lock.json \
  next.config.ts \
  -x '.next/cache/*'

echo
echo "آماده شد: cpanel-upload.zip ($(du -h cpanel-upload.zip | cut -f1))"
echo "مرحله‌ی بعد: DEPLOY-CPANEL.md را باز کنید."
