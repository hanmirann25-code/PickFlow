/**
 * 역할과 권한 정의.
 *
 * 이 파일이 권한에 관한 유일한 정의다. 화면도 서버도 여기만 본다.
 * 화면에 조건을 직접 적지 않는다. 그래야 버튼과 서버 검사가 어긋날 수 없다.
 *
 * 기획서 4-2의 권한 매트릭스를 그대로 옮긴 것이다.
 */

export const ROLES = ["ADMIN", "OPERATOR", "PICKER", "VIEWER"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** 화면·API가 요구할 수 있는 권한 단위. */
export const PERMISSIONS = [
  "order:read",
  "order:cancel",
  "inventory:allocate",
  "wave:manage",
  "picking:perform",
  "packing:register",
  "user:manage",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * 역할별 허용 권한. 기획서 4-2 표와 1:1로 대응한다.
 *
 * ADMIN은 전부. VIEWER는 읽기만. PICKER는 모바일 피킹만.
 */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: [
    "order:read",
    "order:cancel",
    "inventory:allocate",
    "wave:manage",
    "picking:perform",
    "packing:register",
    "user:manage",
    "audit:read",
  ],
  OPERATOR: ["order:read", "order:cancel", "inventory:allocate", "wave:manage", "packing:register"],
  PICKER: ["picking:perform"],
  VIEWER: ["order:read"],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** 그 역할이 가진 권한 전부. 화면에서 메뉴를 거를 때 쓴다. */
export function permissionsOf(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
