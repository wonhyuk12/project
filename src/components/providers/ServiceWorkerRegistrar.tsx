"use client";

import { useEffect } from "react";

/** PWA 설치(홈 화면에 추가) 가능하게 하려고 서비스워커를 등록한다. 화면에는 아무것도 그리지 않는다. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
