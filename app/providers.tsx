"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * 서버 상태는 TanStack Query가 맡는다.
 *
 * QueryClient를 모듈 최상단에서 만들면 서버에서 모든 요청이 같은 캐시를 공유한다.
 * 사용자 A의 목록이 사용자 B에게 보일 수 있다. useState로 클라이언트마다 하나씩 만든다.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 목록 화면은 잠깐 사이 같은 조건으로 여러 번 오간다.
            // 30초 안에는 다시 묻지 않는다.
            staleTime: 30_000,
            // 창을 다시 포커스했다고 10만 건 목록을 다시 부르지 않는다.
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
