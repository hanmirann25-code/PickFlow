import oracledb from "oracledb";

/**
 * 하네스 전용 DB 연결.
 *
 * 앱 코드(lib/db/*)를 import하지 않는다. 하네스는 앱이 죽어 있어도 돌아가야 하고,
 * 앱의 동작을 검증하는 쪽이 앱의 코드를 빌려 쓰면 검증이 되지 않는다.
 * lib/db/pool.ts와 비슷한 코드가 여기 한 번 더 있는 것은 의도된 중복이다.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `환경변수 ${name}가 비어 있습니다. ` +
        `하네스는 .env.local을 읽습니다: node --env-file=.env.local harness/<script>.ts`,
    );
  }
  return value;
}

/**
 * 운영 DB를 향해 실행되는 것을 막는다.
 *
 * 하네스는 데이터를 지우고 다시 넣는다. 접속 대상이 로컬이 아니면 멈춘다.
 * 원격(클라우드 데모 DB)에 일부러 돌리려면 HARNESS_ALLOW_REMOTE=1을 붙인다.
 */
export function assertDevDatabase(): void {
  const target = required("ORACLE_CONNECT_STRING");
  const isLocal = /(^|[/@])(localhost|127\.0\.0\.1)[:/]/.test(target);

  if (isLocal) return;

  if (process.env.HARNESS_ALLOW_REMOTE === "1") {
    console.warn(`⚠ 원격 DB에 실행합니다: ${target}`);
    console.warn("  HARNESS_ALLOW_REMOTE=1이 설정돼 있어 계속합니다.");
    return;
  }

  throw new Error(
    `접속 대상이 로컬이 아닙니다: ${target}\n` +
      `하네스는 데이터를 지우고 다시 넣습니다. 운영 DB에서 실행되는 것을 막기 위해 중단합니다.\n` +
      `의도한 것이라면 HARNESS_ALLOW_REMOTE=1 을 설정하고 다시 실행하세요.`,
  );
}

/** 하네스는 짧게 살다 끝나는 스크립트라 풀 대신 커넥션 하나만 쓴다. */
export async function openConnection(): Promise<oracledb.Connection> {
  const config: oracledb.ConnectionAttributes = {
    user: required("ORACLE_USER"),
    password: required("ORACLE_PASSWORD"),
    connectString: required("ORACLE_CONNECT_STRING"),
  };

  const walletDir = process.env.ORACLE_WALLET_DIR;
  if (walletDir) {
    config.configDir = walletDir;
    config.walletLocation = walletDir;
    config.walletPassword = process.env.ORACLE_WALLET_PASSWORD;
  }

  return oracledb.getConnection(config);
}

/** 접속 대상을 사람이 읽을 수 있게. 비밀번호는 넣지 않는다. */
export function describeTarget(): string {
  return `${process.env.ORACLE_USER}@${process.env.ORACLE_CONNECT_STRING}`;
}

/** 테이블별 건수. 실행 후 결과 확인용. */
export async function countRows(
  conn: oracledb.Connection,
  tables: readonly string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of tables) {
    // 테이블명은 코드에 적힌 상수만 들어온다. 사용자 입력을 여기 넘기지 말 것.
    const result = await conn.execute<{ CNT: number }>(
      `SELECT COUNT(*) AS CNT FROM ${table}`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    counts[table] = result.rows?.[0]?.CNT ?? 0;
  }
  return counts;
}
