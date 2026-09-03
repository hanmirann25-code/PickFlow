/**
 * 측정값 요약.
 *
 * 평균은 쓰지 않는다. 한 번 크게 튄 값을 평균이 숨기기 때문이다.
 * 중앙값(보통 이 정도)과 p95(나쁠 때 이 정도)를 함께 본다.
 */

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * p95. 표본이 적을 때는 보간 없이 그 위치의 값을 그대로 쓴다.
 * 5회 측정에서 p95는 사실상 최악값이다. 그게 우리가 알고 싶은 값이다.
 */
export function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index];
}

export function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export type Metric = {
  key: string;
  label: string;
  unit: string;
  median: number;
  p95: number;
  /** 개별 측정값. 나중에 이상값을 되짚어볼 수 있게 남긴다. */
  samples: number[];
  /** null이면 참고용 지표다. 합격·불합격을 판정하지 않는다. */
  target: number | null;
  /** 목표가 상한인가(작을수록 좋음), 하한인가(클수록 좋음). */
  direction: "atMost" | "atLeast";
  pass: boolean;
};

export function buildMetric(
  key: string,
  label: string,
  unit: string,
  samples: number[],
  target: number | null,
  direction: "atMost" | "atLeast",
): Metric {
  const med = round(median(samples));
  const worst = round(p95(samples));

  // 합격 판정은 p95로 한다. 중앙값만 보면 가끔 느린 것을 놓친다.
  // 기준이 없는 지표는 기록만 하고 판정하지 않는다.
  const pass = target === null ? true : direction === "atMost" ? worst <= target : worst >= target;

  return {
    key,
    label,
    unit,
    median: med,
    p95: worst,
    samples: samples.map((value) => round(value)),
    target,
    direction,
    pass,
  };
}
