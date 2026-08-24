# ---------------------------------------------------------------------------
# PERSIAN PADEL — ایمیج تولید
#
# پایه‌ی Debian انتخاب شده چون موتور کوئری Prisma روی glibc پایدارتر از musl است
# و از دردسرهای سازگاری Alpine جلوگیری می‌کند.
# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS base
# openssl برای موتور Prisma لازم است
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- نصب وابستگی‌ها ----
FROM base AS deps
COPY package.json package-lock.json ./
# تنظیمات تلاش مجدد — ساخت ایمیج روی شبکه‌های ناپایدار را مقاوم می‌کند
ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000
RUN npm ci --no-audit --no-fund

# ---- ساخت ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# در زمان ساخت به پایگاه داده وصل نمی‌شویم؛ فقط تولید کلاینت Prisma لازم است.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN npx prisma generate && npx next build

# ---- اجرا ----
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nextjs

# خروجی standalone به‌همراه دارایی‌های ثابت
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

# موتور و CLI پرایزما برای اجرای مهاجرت‌ها هنگام راه‌اندازی.
# (next.config موتور را در standalone هم قرار می‌دهد؛ این کپی تضمین مضاعف است.)
COPY --from=builder --chown=nextjs:nodejs /app/prisma                ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma  ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma  ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma   ./node_modules/prisma
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]
