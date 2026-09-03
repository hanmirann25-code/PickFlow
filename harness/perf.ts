/**
 * 성능 하네스.
 *
 * 실행: pnpm harness:perf
 *       pnpm harness:perf -- --url https://데모주소 --repeat 5
 *
 * "10만 건에서 안 끊긴다"는 말을 수치로 바꾼다.
 * 명령 한 줄로 다시 나와야 하므로 사람이 눈으로 판정하지 않는다.
 *
 * 반드시 프로덕션 빌드를 향해 실행할 것.
 * 개발 서버는 요청마다 컴파일해서 실제보다 3~10배 느리게 나온다.
 *
 *   pnpm build && pnpm start   (다른 터미널)
 *   pnpm harness:perf
 */

import { chromium, type Browser, type Page } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import oracledb from "oracledb";
import { openConnection, describeTarget } from "./lib/db.ts";
import { buildMetric, round, type Metric } from "./lib/stats.ts";

// ── 옵션 ────────────────────────────────────────────────────────────

function argValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

const OPTIONS = {
  url: argValue("url", "http://localhost:3000"),
  repeat: Number.parseInt(argValue("repeat", "5"), 10),
  email: argValue("email", "admin@demo.io"),
  password: argValue("password", "demo1234"),
  headed: process.argv.includes("--headed"),
};

/** 기준값. 근거는 기획서 8-5의 성능 기준 표에 있다. */
const TARGETS = {
  /** 사람이 "즉시"로 느끼는 구간이 대략 0.1~0.3초. */
  firstRender: 300,
  /** 부드러움 기준 60fps. 55는 그 아래 허용선. */
  scrollFps: 55,
  /** 1초를 넘기면 작업 흐름이 끊긴다고 느낀다. */
  filterResponse: 500,
  /** 목록 API 응답. 화면이 기다리는 시간의 대부분이다. */
  apiLatency: 500,
};

// ── 측정 ────────────────────────────────────────────────────────────

async function login(page: Page): Promise<void> {
  await page.goto(`${OPTIONS.url}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", OPTIONS.email);
  await page.fill("#password", OPTIONS.password);
  await Promise.all([page.waitForURL(`${OPTIONS.url}/`), page.click('button[type="submit"]')]);
}

/**
 * 주문 목록 첫 렌더 — 콘솔 안에서 메뉴로 들어갈 때.
 *
 * 사이드바의 "주문"을 누른 순간부터 첫 데이터 행이 그려질 때까지를 잰다.
 * 껍데기만 뜨고 표가 비어 있는 시간은 사용자에게 "아직 안 뜬 것"이다.
 *
 * 콘솔을 쓰는 동안 목록에 들어오는 거의 모든 경우가 이 경로다.
 * page.goto로 재면 매번 문서를 통째로 다시 받아 실제 조작과 달라진다.
 * 300ms라는 기준("사람이 즉시로 느끼는 구간")도 이 조작을 두고 잡은 값이다.
 */
async function measureFirstRender(page: Page): Promise<number> {
  await page.goto(`${OPTIONS.url}/`, { waitUntil: "domcontentloaded" });
  const menu = page
    .getByRole("navigation", { name: "주 메뉴" })
    .getByRole("link", { name: "주문" });
  await menu.first().waitFor({ state: "visible" });

  const startedAt = Date.now();
  await menu.first().click();
  await page.waitForSelector("tbody tr[data-index]", { state: "attached", timeout: 30_000 });
  return Date.now() - startedAt;
}

/**
 * 주문 목록 첫 렌더 — 주소로 바로 들어오는 첫 방문(캐시 없음).
 *
 * 기획서 8-5가 "첫 방문과 재방문을 따로 기록"하라고 정해둔 쪽이다.
 * 자바스크립트 번들 내려받기까지 포함하므로 메뉴 이동보다 느린 게 정상이다.
 * 섞어서 재면 성격이 다른 두 조작이 한 수치로 뭉개진다.
 *
 * 캐시가 빈 컨텍스트를 새로 만들어야 하므로 로그인부터 다시 한다.
 * 로그인 시간은 측정 구간에 넣지 않는다.
 */
async function measureColdFirstRender(browser: Browser): Promise<number> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    await login(page);

    const startedAt = Date.now();
    await page.goto(`${OPTIONS.url}/orders`, { waitUntil: "commit" });
    await page.waitForSelector("tbody tr[data-index]", { state: "attached", timeout: 30_000 });
    return Date.now() - startedAt;
  } finally {
    await context.close();
  }
}

/**
 * 스크롤 중 프레임.
 *
 * 브라우저 안에서 requestAnimationFrame 간격을 재고, 스크롤을 조금씩 밀어
 * 실제로 그리게 만든다. 한 번에 끝까지 튀면 그릴 일이 없어 fps가 의미 없어진다.
 */
async function measureScrollFps(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const box = document.querySelector<HTMLElement>('[role="group"]');
    if (!box) throw new Error("목록 스크롤 영역을 찾지 못했습니다.");

    box.scrollTop = 0;
    await new Promise((resolve) => setTimeout(resolve, 300));

    const frames: number[] = [];
    let last = performance.now();
    let running = true;

    const tick = () => {
      const now = performance.now();
      frames.push(now - last);
      last = now;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // 1.5초 동안 한 프레임에 40px씩 민다.
    const startedAt = performance.now();
    while (performance.now() - startedAt < 1500) {
      box.scrollTop += 40;
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
    running = false;

    // 첫 프레임은 측정 시작 지점이라 버린다.
    const durations = frames.slice(1);
    if (durations.length === 0) return 0;
    const sorted = [...durations].sort((a, b) => a - b);
    const medianMs = sorted[Math.floor(sorted.length / 2)];
    return medianMs > 0 ? 1000 / medianMs : 0;
  });
}

/**
 * 필터 적용 응답 시간.
 *
 * 체크박스를 누른 순간부터 건수가 실제로 바뀔 때까지를 잰다.
 * 요청이 끝난 시점이 아니라 화면이 바뀐 시점이 사용자가 기다린 시간이다.
 */
async function measureFilterResponse(page: Page): Promise<number> {
  await page.goto(`${OPTIONS.url}/orders`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("tbody tr[data-index]", { state: "attached" });

  const before = await page.textContent("main");
  const beforeTotal = before?.match(/전체\s+([\d,]+)\s*건/)?.[1] ?? "";

  const startedAt = Date.now();
  // check()가 아니라 click()을 쓴다.
  // 이 체크박스는 URL이 바뀌어야 켜지는 제어 요소라, check()는 누른 직후
  // 아직 반영되지 않은 상태를 보고 실패로 판단한다.
  await page.getByLabel("자사몰", { exact: true }).click();

  // 건수가 바뀔 때까지 기다린다.
  await page.waitForFunction(
    (previous) => {
      const text = document.querySelector("main")?.textContent ?? "";
      const current = text.match(/전체\s+([\d,]+)\s*건/)?.[1] ?? "";
      return current !== "" && current !== previous;
    },
    beforeTotal,
    { timeout: 30_000 },
  );

  return Date.now() - startedAt;
}

/** 목록 API 응답 시간. 로그인 쿠키를 그대로 쓰려고 브라우저 안에서 부른다. */
async function measureApiLatency(page: Page, query: string): Promise<number> {
  return page.evaluate(async (search) => {
    const startedAt = performance.now();
    const response = await fetch(`/api/orders?${search}`);
    await response.json();
    return performance.now() - startedAt;
  }, query);
}

/** 측정 대상 DB의 데이터 규모. 조건 없는 수치는 의미가 없다. */
async function readDataScale(): Promise<Record<string, number>> {
  const conn = await openConnection();
  try {
    const result = await conn.execute<{ ORDERS: number; ORDER_ITEMS: number; PRODUCTS: number }>(
      `SELECT (SELECT COUNT(*) FROM ORDERS)      AS ORDERS,
              (SELECT COUNT(*) FROM ORDER_ITEMS) AS ORDER_ITEMS,
              (SELECT COUNT(*) FROM PRODUCTS)    AS PRODUCTS
         FROM DUAL`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const row = result.rows?.[0];
    return {
      orders: row?.ORDERS ?? 0,
      orderItems: row?.ORDER_ITEMS ?? 0,
      products: row?.PRODUCTS ?? 0,
    };
  } finally {
    await conn.close();
  }
}

// ── 결과 저장 ───────────────────────────────────────────────────────

async function writeResult(result: unknown): Promise<string> {
  const dir = path.join(import.meta.dirname, "results");
  await mkdir(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const file = path.join(dir, `${date}-perf.json`);
  await writeFile(file, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return file;
}

function printTable(metrics: Metric[]): void {
  console.log("\n── 측정 결과 ─────────────────────────────────────────────────");
  console.log(
    `  ${"항목".padEnd(22)} ${"중앙값".padStart(9)} ${"p95".padStart(9)} ${"기준".padStart(10)}  판정`,
  );
  console.log("  " + "─".repeat(60));
  for (const metric of metrics) {
    const sign = metric.direction === "atMost" ? "≤" : "≥";
    const target = metric.target === null ? "참고" : `${sign} ${metric.target}${metric.unit}`;
    const verdict = metric.target === null ? "—" : metric.pass ? "통과" : "미달";
    console.log(
      `  ${metric.label.padEnd(22)} ${`${metric.median}${metric.unit}`.padStart(9)}` +
        ` ${`${metric.p95}${metric.unit}`.padStart(9)}` +
        ` ${target.padStart(10)}  ${verdict}`,
    );
  }
  console.log("  " + "─".repeat(60));
}

// ── 본체 ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!Number.isInteger(OPTIONS.repeat) || OPTIONS.repeat < 1) {
    throw new Error(`--repeat 값이 올바르지 않습니다: ${OPTIONS.repeat}`);
  }

  console.log(`대상 화면: ${OPTIONS.url}`);
  console.log(`대상 DB:   ${describeTarget()}`);
  console.log(`반복:      ${OPTIONS.repeat}회\n`);

  const scale = await readDataScale();
  console.log(
    `데이터: 주문 ${scale.orders.toLocaleString()} / 주문상품 ${scale.orderItems.toLocaleString()}`,
  );
  if (scale.orders < 100_000) {
    console.warn(
      `⚠ 주문이 ${scale.orders.toLocaleString()}건뿐입니다. ` +
        `10만 건 기준으로 재려면 먼저 pnpm harness:seed 를 실행하세요.`,
    );
  }

  let browser: Browser | undefined;
  const coldFirstRender: number[] = [];
  const firstRender: number[] = [];
  const scrollFps: number[] = [];
  const filterResponse: number[] = [];
  const apiDefault: number[] = [];
  const apiFiltered: number[] = [];
  const apiDeepPage: number[] = [];

  try {
    browser = await chromium.launch({ headless: !OPTIONS.headed });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await login(page);

    /*
      워밍업 1회. 결과에 넣지 않는다.

      첫 회는 항상 다른 회차보다 몇 배 느리다. Next가 그 경로의 청크를 그때 처음
      메모리에 올리고, 오라클 커넥션 풀도 그때 연결을 만든다.
      운영 중인 서버를 여러 사람이 쓰는 상황과 다르므로 이 한 번을 섞으면
      p95가 워밍업 비용을 가리키게 되고 나머지 측정이 묻힌다.

      캐시가 빈 상태로 처음 들어오는 비용은 버리지 않는다.
      "목록 첫 렌더(첫 방문)" 지표가 그것만 따로 잰다.
    */
    process.stdout.write("  워밍업...".padEnd(40));
    await measureFirstRender(page);
    await measureScrollFps(page);
    await measureFilterResponse(page);
    await measureApiLatency(page, "page=1&size=50");
    await measureApiLatency(page, "page=1500&size=50");

    for (let run = 1; run <= OPTIONS.repeat; run += 1) {
      process.stdout.write(`\r  측정 ${run}/${OPTIONS.repeat}...`.padEnd(40));

      coldFirstRender.push(await measureColdFirstRender(browser));
      firstRender.push(await measureFirstRender(page));
      scrollFps.push(await measureScrollFps(page));
      filterResponse.push(await measureFilterResponse(page));

      await page.goto(`${OPTIONS.url}/orders`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("tbody tr[data-index]", { state: "attached" });
      apiDefault.push(await measureApiLatency(page, "page=1&size=50"));
      apiFiltered.push(
        await measureApiLatency(
          page,
          `page=1&size=50&channel=${encodeURIComponent("자사몰")}&from=2026-08-10&to=2026-08-20`,
        ),
      );
      apiDeepPage.push(await measureApiLatency(page, "page=1500&size=50"));
    }
    process.stdout.write("\n");

    const browserVersion = browser.version();
    await context.close();

    const metrics: Metric[] = [
      buildMetric(
        "orders.firstRender",
        "목록 첫 렌더(메뉴)",
        "ms",
        firstRender,
        TARGETS.firstRender,
        "atMost",
      ),
      // 첫 방문은 번들 내려받기가 포함돼 성격이 다르다.
      // 기준을 두지 않고 기록만 한다. 숨기지 않고 그대로 보여주기 위함이다.
      buildMetric(
        "orders.firstRenderCold",
        "목록 첫 렌더(첫 방문)",
        "ms",
        coldFirstRender,
        null,
        "atMost",
      ),
      buildMetric(
        "orders.scrollFps",
        "스크롤 프레임",
        "fps",
        scrollFps,
        TARGETS.scrollFps,
        "atLeast",
      ),
      buildMetric(
        "orders.filterResponse",
        "필터 적용 응답",
        "ms",
        filterResponse,
        TARGETS.filterResponse,
        "atMost",
      ),
      buildMetric("api.list", "API 기본 목록", "ms", apiDefault, TARGETS.apiLatency, "atMost"),
      buildMetric("api.filtered", "API 필터 조회", "ms", apiFiltered, TARGETS.apiLatency, "atMost"),
      buildMetric(
        "api.deepPage",
        "API 깊은 페이지",
        "ms",
        apiDeepPage,
        TARGETS.apiLatency,
        "atMost",
      ),
    ];

    printTable(metrics);

    const failed = metrics.filter((metric) => !metric.pass);
    const result = {
      name: "perf",
      runAt: new Date().toISOString(),
      // 측정 조건이 없는 수치는 비교할 수 없다. 반드시 함께 남긴다.
      conditions: {
        url: OPTIONS.url,
        browser: `Chromium ${browserVersion}`,
        viewport: "1440x900",
        repeat: OPTIONS.repeat,
        warmupRuns: 1,
        data: scale,
        db: describeTarget(),
        note:
          "합격 판정은 p95 기준. 중앙값만 보면 가끔 느린 것을 놓친다. " +
          "측정 전 워밍업 1회는 결과에서 제외한다(Next 청크 로드·커넥션 풀 생성 비용). " +
          "캐시가 빈 첫 방문 비용은 orders.firstRenderCold가 따로 잰다.",
      },
      metrics,
      pass: failed.length === 0,
    };

    const file = await writeResult(result);
    console.log(`결과 저장: ${path.relative(process.cwd(), file)}`);

    if (failed.length > 0) {
      console.error("\n✗ 기준 미달");
      for (const metric of failed) {
        const sign = metric.direction === "atMost" ? "이하여야" : "이상이어야";
        console.error(
          `  ${metric.label}: p95 ${metric.p95}${metric.unit} (${metric.target}${metric.unit} ${sign} 함)`,
        );
      }
      console.error(
        "\n개선 후 다시 실행하거나, 못 맞추면 README의 '알려진 한계'에 그대로 적을 것.",
      );
      process.exitCode = 1;
      return;
    }

    console.log("✓ 전부 통과");
  } finally {
    await browser?.close();
  }
}

main().catch((error: unknown) => {
  console.error("\n✗ 성능 측정 실패");
  console.error(error instanceof Error ? error.message : error);
  console.error(
    "\n화면이 떠 있는지 확인하세요. 프로덕션 빌드 기준으로 재야 합니다:\n" +
      "  pnpm build && pnpm start   (다른 터미널)\n" +
      "  pnpm harness:perf",
  );
  process.exit(1);
});

export { round };
