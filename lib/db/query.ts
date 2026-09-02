import oracledb from "oracledb";
import { getPool } from "./pool";

/**
 * SQL 실행 헬퍼.
 *
 * 규칙(.cursor/rules/oracle.mdc):
 * - 바인드 변수만 쓴다. 값을 문자열로 이어붙여 SQL을 만들지 않는다.
 * - 커넥션은 반드시 finally에서 풀에 돌려준다.
 * - 자동 커밋에 의존하지 않는다. 쓰기는 명시적으로 커밋한다.
 */

export type Binds = oracledb.BindParameters;

/** 커넥션을 빌려주고, 무슨 일이 있어도 돌려받는다. */
async function withConnection<T>(fn: (conn: oracledb.Connection) => Promise<T>): Promise<T> {
  const pool = await getPool();
  const connection = await pool.getConnection();
  try {
    return await fn(connection);
  } finally {
    // 여기서 실패해도 원래 오류를 덮지 않게 따로 잡는다.
    try {
      await connection.close();
    } catch (closeError) {
      console.error("[db] 커넥션 반환 실패:", closeError);
    }
  }
}

/**
 * 조회. 행 배열을 돌려준다.
 *
 * @example
 * const rows = await query<{ ORDER_NO: string }>(
 *   "SELECT ORDER_NO FROM ORDERS WHERE STATUS = :status",
 *   { status: "RECEIVED" },
 * );
 */
export async function query<T>(sql: string, binds: Binds = {}): Promise<T[]> {
  return withConnection(async (conn) => {
    const result = await conn.execute<T>(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    return result.rows ?? [];
  });
}

/** 조회하되 한 행만. 없으면 null. */
export async function queryOne<T>(sql: string, binds: Binds = {}): Promise<T | null> {
  const rows = await query<T>(sql, binds);
  return rows[0] ?? null;
}

/**
 * 쓰기(INSERT/UPDATE/DELETE) 한 문장. 성공하면 커밋한다.
 * 여러 문장을 하나로 묶어야 하면 execute를 여러 번 부르지 말고 withTransaction을 쓴다.
 */
export async function execute(sql: string, binds: Binds = {}): Promise<oracledb.Result<unknown>> {
  return withConnection(async (conn) => {
    const result = await conn.execute(sql, binds, { autoCommit: false });
    await conn.commit();
    return result;
  });
}

/**
 * 여러 문장을 한 트랜잭션으로 묶는다. 하나라도 실패하면 전부 롤백한다.
 * 재고를 건드리는 처리는 반드시 이걸 통과해야 한다.
 */
export async function withTransaction<T>(
  fn: (conn: oracledb.Connection) => Promise<T>,
): Promise<T> {
  return withConnection(async (conn) => {
    try {
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    }
  });
}
