import type { PlayerLevel, TournamentLevelRule } from '@prisma/client';
import { LEVEL_LABEL, LEVEL_ORDER, levelRank } from '@/lib/constants';

export interface LevelCombination {
  slot1: PlayerLevel;
  slot2: PlayerLevel;
}

export interface LevelRuleCheck {
  allowed: boolean;
  reason?: string;
  /** ترتیب پیشنهادی جایگاه‌ها در صورت جابه‌جایی */
  swapped?: boolean;
}

function parseCombinations(value: unknown): LevelCombination[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const rec = item as Record<string, unknown>;
    const s1 = rec.slot1;
    const s2 = rec.slot2;
    if (typeof s1 !== 'string' || typeof s2 !== 'string') return [];
    if (!LEVEL_ORDER.includes(s1 as PlayerLevel) || !LEVEL_ORDER.includes(s2 as PlayerLevel)) return [];
    return [{ slot1: s1 as PlayerLevel, slot2: s2 as PlayerLevel }];
  });
}

/**
 * بررسی مجاز بودن ترکیب سطح دو بازیکن یک تیم.
 *
 *  FREE        → هر ترکیبی مجاز است
 *  EXACT       → سطح هر جایگاه باید دقیقاً یکی از سطوح تعیین‌شده باشد
 *  RANGE       → سطح هر جایگاه باید در بازه‌ی [قوی‌ترین..ضعیف‌ترین] سطوح تعیین‌شده باشد
 *  COMBINATION → ترکیب باید در فهرست ترکیب‌های مجاز باشد
 *
 * اگر `orderInsensitive` روشن باشد، جای دو بازیکن هم بررسی می‌شود.
 */
export function checkLevelRule(
  rule: TournamentLevelRule | null | undefined,
  level1: PlayerLevel,
  level2: PlayerLevel,
): LevelRuleCheck {
  if (!rule || rule.type === 'FREE') return { allowed: true };

  const evaluate = (a: PlayerLevel, b: PlayerLevel): boolean => {
    switch (rule.type) {
      case 'EXACT': {
        const okA = rule.slot1Levels.length === 0 || rule.slot1Levels.includes(a);
        const okB = rule.slot2Levels.length === 0 || rule.slot2Levels.includes(b);
        return okA && okB;
      }
      case 'RANGE': {
        const inRange = (level: PlayerLevel, allowed: PlayerLevel[]) => {
          if (allowed.length === 0) return true;
          const ranks = allowed.map(levelRank);
          return levelRank(level) >= Math.min(...ranks) && levelRank(level) <= Math.max(...ranks);
        };
        return inRange(a, rule.slot1Levels) && inRange(b, rule.slot2Levels);
      }
      case 'COMBINATION': {
        const combos = parseCombinations(rule.combinations);
        if (combos.length === 0) return true;
        return combos.some((c) => c.slot1 === a && c.slot2 === b);
      }
      default:
        return true;
    }
  };

  if (evaluate(level1, level2)) return { allowed: true };

  if (rule.orderInsensitive && evaluate(level2, level1)) {
    return { allowed: true, swapped: true };
  }

  return { allowed: false, reason: describeRuleViolation(rule, level1, level2) };
}

function describeRuleViolation(
  rule: TournamentLevelRule,
  level1: PlayerLevel,
  level2: PlayerLevel,
): string {
  const pair = `${LEVEL_LABEL[level1]} + ${LEVEL_LABEL[level2]}`;
  return `ترکیب سطح ${pair} با قوانین این تورنومنت مطابقت ندارد. ${describeRule(rule)}`;
}

/** توضیح خوانا از قانون سطح — برای نمایش به بازیکن */
export function describeRule(rule: TournamentLevelRule | null | undefined): string {
  if (!rule || rule.type === 'FREE') return 'محدودیتی برای سطح بازیکنان وجود ندارد (Free Level).';

  const fmt = (levels: PlayerLevel[]) =>
    levels.length ? levels.map((l) => LEVEL_LABEL[l]).join('، ') : 'آزاد';

  switch (rule.type) {
    case 'EXACT':
      return `بازیکن اول باید سطح ${fmt(rule.slot1Levels)} و بازیکن دوم سطح ${fmt(rule.slot2Levels)} داشته باشد.`;
    case 'RANGE': {
      const range = (levels: PlayerLevel[]) => {
        if (!levels.length) return 'آزاد';
        const sorted = [...levels].sort((a, b) => levelRank(a) - levelRank(b));
        return `از ${LEVEL_LABEL[sorted[0]]} تا ${LEVEL_LABEL[sorted[sorted.length - 1]]}`;
      };
      return `سطح بازیکن اول ${range(rule.slot1Levels)} و سطح بازیکن دوم ${range(rule.slot2Levels)} باشد.`;
    }
    case 'COMBINATION': {
      const combos = parseCombinations(rule.combinations);
      if (!combos.length) return 'ترکیب مجازی تعریف نشده است.';
      const list = combos.map((c) => `${LEVEL_LABEL[c.slot1]} + ${LEVEL_LABEL[c.slot2]}`).join(' یا ');
      return `ترکیب‌های مجاز: ${list}`;
    }
    default:
      return '';
  }
}
