import oracledb from "oracledb";

/**
 * 오라클 커넥션 풀.
 *
 * node-oracledb 6부터는 Thin 모드가 기본이라 Instant Client를 깔지 않아도 된다.
 * 그래서 이 파일에는 initOracleClient() 호출이 없다. 넣으면 Thick 모드로 바뀌면서
 * 배포 서버에 Instant Client 의존이 생긴다.
 */

// Next.js 개발 모드는 파일이 바뀔 때마다 모듈을 다시 평가한다.
// 풀을 모듈 스코프 변수에만 두면 저장할 때마다 새 풀이 생겨 커넥션이 샌다.
// globalThis에 캐싱해서 프로세스당 하나만 유지한다.
declare global {
  var __pickflowPool: Promise<oracledb.Pool> | undefined;
}

/** 값이 없으면 즉시 멈춘다. 접속 직전에 알 수 없는 오류로 터지는 것보다 낫다. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `환경변수 ${name}가 비어 있습니다. .env.local에 값을 넣어주세요. ` +
        `예시는 .env.example을 참고하세요.`,
    );
  }
  return value;
}

function toInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`환경변수 ${name}는 숫자여야 합니다. 현재 값: ${raw}`);
  }
  return parsed;
}

function buildPoolConfig(): oracledb.PoolAttributes {
  const config: oracledb.PoolAttributes = {
    user: required("ORACLE_USER"),
    password: required("ORACLE_PASSWORD"),
    connectString: required("ORACLE_CONNECT_STRING"),
    poolMin: toInt("ORACLE_POOL_MIN", 2),
    poolMax: toInt("ORACLE_POOL_MAX", 10),
    poolIncrement: 1,
    // 풀이 말라 있을 때 무한정 매달리지 않게 한다. 응답을 못 주는 것보다 빨리 실패하는 게 낫다.
    queueTimeout: 10_000,
  };

  // 지갑 경로가 있으면 클라우드(Autonomous Database) 접속으로 자동 전환한다.
  // 코드를 고치지 않고 환경변수만 바꿔서 로컬↔클라우드를 오가기 위한 분기다.
  const walletDir = process.env.ORACLE_WALLET_DIR;
  if (walletDir) {
    config.configDir = walletDir; // tnsnames.ora 위치
    config.walletLocation = walletDir; // ewallet.pem 위치
    config.walletPassword = process.env.ORACLE_WALLET_PASSWORD;
  }

  return config;
}

/** 접속 대상을 사람이 읽을 수 있게. 비밀번호는 절대 넣지 않는다. */
export function describeTarget(): string {
  const target = process.env.ORACLE_CONNECT_STRING ?? "(미설정)";
  const mode = process.env.ORACLE_WALLET_DIR ? "wallet" : "direct";
  return `${process.env.ORACLE_USER ?? "(미설정)"}@${target} [${mode}]`;
}

export function getPool(): Promise<oracledb.Pool> {
  const cached = globalThis.__pickflowPool;
  if (cached) return cached;

  const pending = oracledb.createPool(buildPoolConfig()).catch((error: unknown) => {
    // 실패한 Promise를 캐시에 남기면 이후 요청이 전부 같은 오류를 재사용한다.
    // 비워두고 다음 요청에서 다시 시도하게 한다.
    globalThis.__pickflowPool = undefined;
    throw error;
  });

  globalThis.__pickflowPool = pending;
  return pending;
}

/** 프로세스를 내릴 때 정리용. 하네스 스크립트가 끝날 때도 쓴다. */
export async function closePool(): Promise<void> {
  const pending = globalThis.__pickflowPool;
  if (!pending) return;
  globalThis.__pickflowPool = undefined;
  const pool = await pending;
  await pool.close(10);
}
