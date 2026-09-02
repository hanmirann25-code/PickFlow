import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db/query";
import { describeTarget } from "@/lib/db/pool";

// oracledb는 Node 런타임에서만 돈다. Edge에서는 동작하지 않는다.
export const runtime = "nodejs";
// 헬스체크가 캐시되면 의미가 없다. 매 요청마다 실제로 DB를 찌른다.
export const dynamic = "force-dynamic";

/** 오라클 드라이버 오류에서 사람이 볼 만한 정보만 뽑는다. 비밀번호는 담기지 않는다. */
function describeError(error: unknown): { message: string; code: string | null; hint: string } {
  if (error instanceof Error) {
    const code = "errorNum" in error ? `ORA-${String(error.errorNum).padStart(5, "0")}` : null;
    return { message: error.message, code, hint: hintFor(error.message) };
  }
  return { message: String(error), code: null, hint: "알 수 없는 오류입니다." };
}

/** 자주 나오는 실패는 다음에 뭘 해야 하는지까지 알려준다. */
function hintFor(message: string): string {
  if (message.includes("ORA-01017")) {
    return "사용자 이름 또는 비밀번호가 틀렸습니다. .env.local의 ORACLE_USER / ORACLE_PASSWORD를 확인하세요.";
  }
  if (message.includes("ORA-28000")) {
    return (
      "비밀번호를 연속으로 틀려 계정이 잠겼습니다(기본 10회). " +
      "sqlplus / as sysdba 로 접속해 ALTER SESSION SET CONTAINER = FREEPDB1; " +
      "ALTER USER PICKFLOW ACCOUNT UNLOCK; 를 실행하세요."
    );
  }
  if (message.includes("ORA-12541") || message.includes("ECONNREFUSED")) {
    return "리스너에 연결하지 못했습니다. 오라클이 실행 중인지(OracleServiceFREE, TNSListener) 확인하세요.";
  }
  if (message.includes("ORA-12514")) {
    return "리스너는 떴지만 해당 서비스명을 모릅니다. ORACLE_CONNECT_STRING의 서비스명을 확인하세요 (로컬 Free는 보통 FREEPDB1).";
  }
  if (message.includes("환경변수")) {
    return ".env.local 파일이 없거나 값이 비어 있습니다. .env.example을 복사해서 채우세요.";
  }
  return "오류 메시지를 그대로 확인하세요.";
}

export async function GET() {
  const startedAt = Date.now();

  try {
    const row = await queryOne<{ OK: number }>("SELECT 1 AS OK FROM DUAL");
    const elapsedMs = Date.now() - startedAt;

    return NextResponse.json({
      status: "ok",
      db: { connected: row?.OK === 1, target: describeTarget(), elapsedMs },
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const detail = describeError(error);

    // 서버 로그에는 전체 오류를 남긴다. 응답에는 요약만 담는다.
    console.error("[health] DB 연결 실패:", error);

    return NextResponse.json(
      {
        status: "error",
        db: { connected: false, target: describeTarget(), elapsedMs },
        error: detail,
        checkedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
