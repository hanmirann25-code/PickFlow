import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // oracledb는 번들러가 건드리면 안 된다. 내부에서 동적 require를 쓰기 때문에
  // 번들에 말아넣으면 런타임에 모듈을 못 찾는다. 서버에서 그대로 require 되게 둔다.
  serverExternalPackages: ["oracledb"],
};

export default nextConfig;
