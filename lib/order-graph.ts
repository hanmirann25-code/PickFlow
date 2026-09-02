/**
 * 주문 상태에 관한 유일한 정의.
 *
 * 서버 전이 함수, 화면의 액션 버튼, README 다이어그램이 전부 여기서 파생된다.
 * 다른 곳에 상태 조건을 흩뿌리지 않는다 (AGENTS.md 절대 규칙).
 *
 * 지금은 상태 목록만 있다. 전이 표(from/to/label/roles/guard/effects)와
 * transition() 함수는 P13에서 이 파일에 더한다.
 */

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
