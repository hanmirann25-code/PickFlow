import { handlers } from "@/auth";

// oracledb를 거쳐 사용자 테이블을 조회하므로 Node 런타임이어야 한다.
export const runtime = "nodejs";

export const { GET, POST } = handlers;
