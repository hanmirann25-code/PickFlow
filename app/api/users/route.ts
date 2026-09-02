import { NextResponse } from "next/server";
import { query } from "@/lib/db/query";
import { requirePermission } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserRow = {
  ID: number;
  EMAIL: string;
  NAME: string;
  ROLE: string;
  CREATED_AT: Date;
};

/**
 * 사용자 목록. ADMIN 전용 (기획서 4-2 권한 매트릭스).
 *
 * 화면에서 메뉴를 숨기는 것과 별개로 여기서 반드시 다시 검사한다.
 * 브라우저 콘솔에서 fetch('/api/users') 한 줄이면 메뉴를 숨겨도 그대로 호출되기 때문이다.
 */
export async function GET() {
  const guard = await requirePermission("user:manage");
  if (!guard.ok) return guard.response;

  // 비밀번호 해시는 절대 내보내지 않는다.
  const users = await query<UserRow>(
    `SELECT ID, EMAIL, NAME, ROLE, CREATED_AT
       FROM USERS
      ORDER BY ID`,
  );

  return NextResponse.json({
    requestedBy: { id: guard.user.id, role: guard.user.role },
    count: users.length,
    users: users.map((user) => ({
      id: user.ID,
      email: user.EMAIL,
      name: user.NAME,
      role: user.ROLE,
      createdAt: user.CREATED_AT,
    })),
  });
}
