/**
 * 가짜 데이터 생성기.
 *
 * 실제 인물의 이름·주소·연락처는 절대 쓰지 않는다. 전부 여기서 조합해 만든다.
 * 전화번호는 010-0000-#### 대역만 쓴다. 실제로 배정되지 않는 번호대다.
 *
 * 같은 시드값이면 항상 같은 데이터가 나온다. 그래야 실행 간 비교가 된다.
 */

/** mulberry32 — 짧고 시드 고정이 되는 난수 생성기. 암호용이 아니다. */
export function createRandom(seed: number) {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Random = ReturnType<typeof createRandom>;

export function pick<T>(rand: Random, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

/** min 이상 max 이하 정수. */
export function intBetween(rand: Random, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

// ── 상품 ────────────────────────────────────────────────────────────

const CATEGORIES = ["티셔츠", "후드", "맨투맨", "셔츠", "바지", "자켓", "모자", "가방"] as const;
const MATERIALS = ["기본", "옥스포드", "코튼", "린넨", "기모", "경량"] as const;
const COLORS = ["블랙", "화이트", "네이비", "그레이", "베이지", "카키"] as const;
const SIZES = ["S", "M", "L", "XL"] as const;

export function productName(rand: Random): { name: string; optionName: string } {
  const name = `${pick(rand, MATERIALS)} ${pick(rand, CATEGORIES)}`;
  const optionName = `${pick(rand, SIZES)}/${pick(rand, COLORS)}`;
  return { name, optionName };
}

// ── 수취인 (전부 조합해서 만든 가짜 값) ──────────────────────────────

const SURNAMES = ["강", "고", "남", "도", "류", "문", "배", "서", "설", "양"] as const;
const SYLLABLES = ["가", "라", "루", "미", "선", "슬", "온", "우", "지", "하"] as const;

export function recipientName(rand: Random): string {
  return `${pick(rand, SURNAMES)}${pick(rand, SYLLABLES)}${pick(rand, SYLLABLES)}`;
}

/** 010-0000-#### 만 쓴다. 실제 가입자에게 배정되지 않는 번호대다. */
export function phone(rand: Random): string {
  return `010-0000-${String(intBetween(rand, 0, 9999)).padStart(4, "0")}`;
}

const STREETS = ["가온로", "다솜로", "미르로", "새벼로", "온누리로", "한별로"] as const;
const DISTRICTS = ["가온구", "다온구", "라온구", "미온구", "하온구"] as const;

export function address(rand: Random): string {
  const street = pick(rand, STREETS);
  const district = pick(rand, DISTRICTS);
  return (
    `가상시 ${district} ${street} ${intBetween(rand, 1, 99)}길 ${intBetween(rand, 1, 50)}, ` +
    `${intBetween(rand, 101, 110)}동 ${intBetween(rand, 101, 2504)}호`
  );
}

export const CHANNELS = ["스마트스토어", "자사몰", "오픈마켓", "라이브커머스"] as const;
export const COURIERS = ["가온택배", "다온로지스", "한별택배"] as const;

/**
 * 주문 하나에 담기는 상품 줄 수 (1~5).
 *
 * 균등 분포로 뽑으면 평균이 3이라 주문 10만 건에 주문상품 30만 건이 나온다.
 * 기획서가 잡은 규모는 25만 건이고, 실제 커머스 주문도 1~2줄에 몰린다.
 * 아래 가중치의 기댓값은 2.5라 두 가지가 같이 맞는다.
 *
 *   1줄 30% · 2줄 25% · 3줄 20% · 4줄 15% · 5줄 10%
 */
const LINE_COUNT_THRESHOLDS = [0.3, 0.55, 0.75, 0.9] as const;

export function orderLineCount(rand: Random): number {
  const roll = rand();
  for (let i = 0; i < LINE_COUNT_THRESHOLDS.length; i += 1) {
    if (roll < LINE_COUNT_THRESHOLDS[i]) return i + 1;
  }
  return 5;
}
