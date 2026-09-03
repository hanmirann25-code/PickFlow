import type { Role } from "@/lib/auth/roles";

/**
 * 주문 상태에 관한 유일한 정의.
 *
 * 서버 전이 함수, 화면의 액션 버튼, README 다이어그램이 전부 이 표에서 파생된다.
 * 다른 곳에 상태 조건을 흩뿌리지 않는다 (AGENTS.md 절대 규칙).
 *
 * 표를 고치면 세 가지가 함께 바뀐다.
 *   1. 서버가 허용하는 전이
 *   2. 화면에 뜨는 액션 버튼
 *   3. README의 상태 다이어그램
 * 그래서 화면과 서버가 어긋날 수 없다.
 */

// ── 상태 ────────────────────────────────────────────────────────────

export const ORDER_STATUSES = [
  "RECEIVED", // 접수
  "ALLOCATED", // 할당완료
  "PICKING", // 피킹중
  "PACKED", // 패킹완료
  "SHIPPED", // 출고완료
  "BACKORDER", // 품절대기
  "HOLD", // 보류
  "CANCELLED", // 취소
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** 화면에 보여줄 한글 이름. 색만으로 상태를 구분하지 않기 위해 항상 텍스트를 함께 쓴다. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  RECEIVED: "접수",
  ALLOCATED: "할당완료",
  PICKING: "피킹중",
  PACKED: "패킹완료",
  SHIPPED: "출고완료",
  BACKORDER: "품절대기",
  HOLD: "보류",
  CANCELLED: "취소",
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

/** 더 이상 나갈 수 없는 상태. 여기 도달하면 흐름이 끝난다. */
export const TERMINAL_STATUSES = ["SHIPPED", "CANCELLED"] as const satisfies readonly OrderStatus[];

export function isTerminal(status: OrderStatus): boolean {
  return (TERMINAL_STATUSES as readonly OrderStatus[]).includes(status);
}

// ── 가드와 훅 ───────────────────────────────────────────────────────

/**
 * 전이 전에 확인할 조건. 이름만 여기서 정하고, 실제 검사는 P14의 전이 함수가 한다.
 * 표에 이름을 적어두면 "이 전이에 무슨 조건이 붙는지"를 한눈에 볼 수 있다.
 */
export const GUARDS = ["hasEnoughStock", "allItemsPicked", "hasTrackingNo"] as const;
export type GuardName = (typeof GUARDS)[number];

/**
 * 전이에 따라붙는 일. 실행 시점이 다르다 (AGENTS.md).
 *
 *   audit, inventoryTx → 트랜잭션 안. 실패하면 전체 롤백한다.
 *   emit               → 커밋 이후. 롤백됐는데 알림만 나가는 것을 막는다.
 */
export const EFFECTS = ["audit", "inventoryTx", "emit"] as const;
export type EffectName = (typeof EFFECTS)[number];

// ── 전이 표 ─────────────────────────────────────────────────────────

export type Transition = {
  readonly from: OrderStatus;
  readonly to: OrderStatus;
  /** 화면의 버튼에 그대로 쓰는 이름. */
  readonly label: string;
  /** 이 전이를 실행할 수 있는 역할. */
  readonly roles: readonly Role[];
  readonly guard?: GuardName;
  readonly effects: readonly EffectName[];
  /** 왜 이렇게 정했는지. 표를 읽는 사람이 근거를 찾아 헤매지 않게 남긴다. */
  readonly note?: string;
};

/**
 * 전이 표. 여기 없는 전이는 존재하지 않는다.
 *
 * `satisfies`를 쓴 이유: `as const`로 리터럴 타입을 유지하면서도
 * 없는 상태·역할·가드를 적으면 컴파일이 실패한다.
 * 예를 들어 from: "DONE"이라고 쓰면 그 자리에서 타입 에러가 난다.
 */
export const ORDER_TRANSITIONS = [
  // ── 정상 흐름 ──
  {
    from: "RECEIVED",
    to: "ALLOCATED",
    label: "재고 할당",
    roles: ["ADMIN", "OPERATOR"],
    guard: "hasEnoughStock",
    effects: ["audit", "inventoryTx", "emit"],
    note: "재고를 찜해둔다. 실제로 빠지지는 않는다.",
  },
  {
    from: "ALLOCATED",
    to: "PICKING",
    label: "피킹 시작",
    roles: ["ADMIN", "OPERATOR"],
    effects: ["audit", "emit"],
  },
  {
    from: "PICKING",
    to: "PACKED",
    label: "패킹 완료",
    roles: ["ADMIN", "OPERATOR"],
    guard: "allItemsPicked",
    effects: ["audit", "emit"],
  },
  {
    from: "PACKED",
    to: "SHIPPED",
    label: "출고 확정",
    roles: ["ADMIN", "OPERATOR"],
    guard: "hasTrackingNo",
    effects: ["audit", "inventoryTx", "emit"],
    note: "이 시점에 재고가 실제로 차감된다.",
  },

  // ── 품절 ──
  {
    from: "RECEIVED",
    to: "BACKORDER",
    label: "품절 대기",
    roles: ["ADMIN", "OPERATOR"],
    effects: ["audit", "emit"],
    note: "재고가 모자라 할당하지 못한 경우. 부분 할당은 하지 않는다.",
  },
  {
    from: "BACKORDER",
    to: "ALLOCATED",
    label: "재고 할당",
    roles: ["ADMIN", "OPERATOR"],
    guard: "hasEnoughStock",
    effects: ["audit", "inventoryTx", "emit"],
    note: "입고 후 다시 시도한다.",
  },

  // ── 보류 ──
  // 출고·취소된 주문은 보류할 수 없다. 이미 끝난 흐름이다.
  ...(["RECEIVED", "ALLOCATED", "PICKING", "PACKED", "BACKORDER"] as const).map(
    (from) =>
      ({
        from,
        to: "HOLD",
        label: "보류",
        roles: ["ADMIN", "OPERATOR"],
        // 할당된 재고를 이 시점에 풀지는 않는다. 보류는 잠시 멈추는 것이지 취소가 아니다.
        effects: ["audit", "emit"],
      }) as const,
  ),
  {
    from: "HOLD",
    to: "RECEIVED",
    label: "보류 해제",
    roles: ["ADMIN", "OPERATOR"],
    effects: ["audit", "inventoryTx", "emit"],
    note: "접수 상태로 되돌려 처음부터 다시 태운다. 할당돼 있던 재고는 이때 원복한다.",
  },

  // ── 취소 ──
  // SHIPPED 이후는 취소할 수 없다 (AGENTS.md). 이미 택배사에 넘어갔다.
  {
    from: "RECEIVED",
    to: "CANCELLED",
    label: "취소",
    roles: ["ADMIN", "OPERATOR"],
    effects: ["audit", "emit"],
    note: "아직 할당 전이라 되돌릴 재고가 없다.",
  },
  {
    from: "BACKORDER",
    to: "CANCELLED",
    label: "취소",
    roles: ["ADMIN", "OPERATOR"],
    effects: ["audit", "emit"],
  },
  ...(["ALLOCATED", "PICKING", "PACKED", "HOLD"] as const).map(
    (from) =>
      ({
        from,
        to: "CANCELLED",
        label: "취소",
        roles: ["ADMIN", "OPERATOR"],
        // 할당된 재고를 반드시 원복한다 (기획서 6장 규칙).
        effects: ["audit", "inventoryTx", "emit"],
      }) as const,
  ),
] as const satisfies readonly Transition[];

// ── 파생 1: 지금 할 수 있는 일 ──────────────────────────────────────

/**
 * 현재 상태와 역할로 가능한 전이 목록.
 *
 * 화면은 이 결과로 버튼을 만든다. 화면에 조건을 직접 적지 않는다.
 * 그래야 표를 고칠 때 버튼과 서버 검사가 같이 움직인다.
 */
export function availableActions(status: OrderStatus, role: Role): Transition[] {
  return ORDER_TRANSITIONS.filter(
    (transition) =>
      transition.from === status &&
      // as const 로 roles가 리터럴 튜플까지 좁혀져 있어 넓은 Role로는 includes가 막힌다.
      // 값을 바꾸는 게 아니라 비교를 위해 타입만 넓힌다.
      (transition.roles as readonly Role[]).includes(role),
  );
}

/** 역할과 무관하게 그 상태에서 갈 수 있는 곳. 다이어그램과 안내 문구에 쓴다. */
export function transitionsFrom(status: OrderStatus): Transition[] {
  return ORDER_TRANSITIONS.filter((transition) => transition.from === status);
}

// ── 파생 2: 이 전이가 허용되는가 ────────────────────────────────────

export type TransitionCheck =
  { allowed: true; transition: Transition } | { allowed: false; reason: string };

/**
 * 전이 허용 여부.
 *
 * 거부할 때는 반드시 사유를 함께 준다. "거부됨"만 남기면 나중에
 * 감사 로그를 봐도 왜 막혔는지 알 수 없다 (AGENTS.md: 정의에 없는 전이는
 * 거부하고 사유를 남긴다).
 *
 * 가드(재고가 충분한지 등)는 여기서 보지 않는다. DB를 봐야 알 수 있는 것이라
 * 트랜잭션 안에서 P14의 전이 함수가 확인한다. 이 함수는 표만 본다.
 */
export function canTransition(from: OrderStatus, to: OrderStatus, role: Role): TransitionCheck {
  if (from === to) {
    return { allowed: false, reason: `이미 ${ORDER_STATUS_LABELS[to]} 상태입니다.` };
  }

  if (isTerminal(from)) {
    return {
      allowed: false,
      reason: `${ORDER_STATUS_LABELS[from]} 주문은 더 이상 상태를 바꿀 수 없습니다.`,
    };
  }

  const transition = ORDER_TRANSITIONS.find((item) => item.from === from && item.to === to);
  if (!transition) {
    return {
      allowed: false,
      reason:
        `${ORDER_STATUS_LABELS[from]}에서 ${ORDER_STATUS_LABELS[to]}로는 바꿀 수 없습니다. ` +
        `가능한 상태: ${transitionsFrom(from)
          .map((item) => ORDER_STATUS_LABELS[item.to])
          .join(", ")}`,
    };
  }

  if (!(transition.roles as readonly Role[]).includes(role)) {
    return {
      allowed: false,
      reason: `${transition.label}은(는) ${transition.roles.join(", ")} 역할만 할 수 있습니다. 현재 역할: ${role}`,
    };
  }

  return { allowed: true, transition };
}

// ── 파생 3: 다이어그램 ──────────────────────────────────────────────

/**
 * Mermaid 상태 다이어그램 문자열.
 *
 * README에 붙이는 그림을 표에서 만든다. 손으로 그린 그림은 표가 바뀌면
 * 조용히 거짓말이 된다. P26의 report 하네스가 이 문자열로 README를 갱신한다.
 */
export function toMermaid(): string {
  const lines = ["stateDiagram-v2", "  [*] --> RECEIVED"];

  // 보류·취소는 어느 단계에서든 갈 수 있어 선이 너무 많아진다.
  // 정상 흐름을 먼저 그리고 그 둘은 뒤에 모아 둔다.
  const isExit = (to: OrderStatus) => to === "HOLD" || to === "CANCELLED";

  for (const transition of ORDER_TRANSITIONS.filter((item) => !isExit(item.to))) {
    lines.push(`  ${transition.from} --> ${transition.to}: ${transition.label}`);
  }
  for (const transition of ORDER_TRANSITIONS.filter((item) => isExit(item.to))) {
    lines.push(`  ${transition.from} --> ${transition.to}: ${transition.label}`);
  }

  for (const status of TERMINAL_STATUSES) {
    lines.push(`  ${status} --> [*]`);
  }

  for (const status of ORDER_STATUSES) {
    lines.push(`  ${status}: ${ORDER_STATUS_LABELS[status]}`);
  }

  return lines.join("\n");
}
