const $ = (sel) => document.querySelector(sel);

function currentYear() {
  const v = $("#yearSelect").value;
  return v ? v : "";
}

function qs(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "" && v !== null && v !== undefined) usp.set(k, v);
  });
  const s = usp.toString();
  return s ? `?${s}` : "";
}

function formatWon(n) {
  if (n === null || n === undefined) return "-";
  const sign = n < 0 ? "-" : "";
  n = Math.abs(Math.round(n));
  const eok = Math.floor(n / 100000000);
  const man = Math.floor((n % 100000000) / 10000);
  const rest = n % 10000;
  const parts = [];
  if (eok) parts.push(`${eok}억`);
  if (man) parts.push(`${man}만`);
  if (rest || (!eok && !man)) parts.push(`${rest.toLocaleString("ko-KR")}`);
  return `${sign}${parts.join(" ")}원`;
}

function formatKwh(n) {
  if (n === null || n === undefined) return "-";
  return `${Math.round(n).toLocaleString("ko-KR")} kWh`;
}

function formatNum(n) {
  return Math.round(n).toLocaleString("ko-KR");
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch (_) {}
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ---------- Markdown -> HTML (no external deps) ----------
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMd(s) {
  s = escapeHtml(s);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return s;
}

function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let i = 0;
  let listOpen = false;
  let paraBuf = [];

  const flushPara = () => {
    if (paraBuf.length) {
      html += `<p>${paraBuf.map(inlineMd).join("<br>")}</p>`;
      paraBuf = [];
    }
  };
  const closeList = () => {
    if (listOpen) {
      html += "</ul>";
      listOpen = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      flushPara();
      closeList();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      html += `<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`;
      i++;
      continue;
    }

    if (/^#{1,3}\s+/.test(line)) {
      flushPara();
      closeList();
      const level = line.match(/^#{1,3}/)[0].length;
      const text = line.replace(/^#{1,3}\s+/, "");
      html += `<h${level}>${inlineMd(text)}</h${level}>`;
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,})\s*$/.test(line.trim())) {
      flushPara();
      closeList();
      html += "<hr>";
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushPara();
      closeList();
      const bqLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        bqLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      html += `<blockquote>${bqLines.map(inlineMd).join("<br>")}</blockquote>`;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      flushPara();
      if (!listOpen) {
        html += "<ul>";
        listOpen = true;
      }
      html += `<li>${inlineMd(line.replace(/^\s*[-*]\s+/, ""))}</li>`;
      i++;
      continue;
    }

    if (line.trim() === "") {
      flushPara();
      closeList();
      i++;
      continue;
    }

    paraBuf.push(line);
    i++;
  }
  flushPara();
  closeList();
  return html;
}

// ---------- Overview ----------
async function loadOverview() {
  const el = $("#overviewCards");
  el.innerHTML = `<div class="card skeleton">불러오는 중…</div>`;
  try {
    const data = await fetchJson(`/api/summary/market${qs({ year: currentYear() })}`);
    const top = data.top_industry;
    el.innerHTML = `
      <div class="card">
        <div class="label">총 사업장 수</div>
        <div class="value">${formatNum(data.total_business_sites)}개소</div>
      </div>
      <div class="card">
        <div class="label">총 예상 사용량</div>
        <div class="value">${formatKwh(data.total_expected_usage_kWh)}</div>
      </div>
      <div class="card">
        <div class="label">총 예상 전기요금</div>
        <div class="value">${formatWon(data.total_expected_cost_원)}</div>
      </div>
      <div class="card">
        <div class="label">평균 단가</div>
        <div class="value">${data.avg_unit_price_원_per_kWh}원/kWh</div>
        <div class="sub">1위 업종: ${top ? top.업종이름 : "-"} (${top ? top.비중_pct : "-"}%)</div>
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="card"><span class="error-text">불러오기 실패: ${e.message}</span></div>`;
  }
}

// ---------- Industry share bars ----------
async function loadIndustryChart() {
  const el = $("#industryChart");
  el.innerHTML = `<div class="card skeleton">불러오는 중…</div>`;
  try {
    const rows = await fetchJson(`/api/summary/industry${qs({ year: currentYear() })}`);
    el.innerHTML = rows
      .map(
        (r) => `
      <div class="bar-row">
        <div class="bar-label">
          <span>${r.업종이름} <span style="color:var(--ink-soft)">(${r.업종코드}·${r.전기계약종류}·${formatNum(r.개소수)}개소)</span></span>
          <span>${formatWon(r.총예상전기요금_원)} · ${r.비중_pct}%</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${r.비중_pct}%"></div></div>
      </div>`
      )
      .join("");
  } catch (e) {
    el.innerHTML = `<div class="card"><span class="error-text">불러오기 실패: ${e.message}</span></div>`;
  }
}

// ---------- Monthly seasonal bars ----------
async function loadMonthlyChart() {
  const meta = $("#monthlyMeta");
  const el = $("#monthlyChart");
  meta.textContent = "불러오는 중…";
  el.innerHTML = "";
  try {
    const data = await fetchJson(`/api/summary/monthly${qs({ year: currentYear() })}`);
    const max = Math.max(...data.monthly.map((m) => m.총예상전기요금_원));
    el.innerHTML = data.monthly
      .map((m) => {
        const pct = Math.max(4, Math.round((m.총예상전기요금_원 / max) * 100));
        const cls =
          m.월 === data.peak_month ? "peak" : m.월 === data.off_peak_month ? "offpeak" : "";
        return `<div class="month-col ${cls}" title="${formatWon(m.총예상전기요금_원)}">
          <div class="bar" style="height:${pct}%"></div>
          <div class="m-label">${m.월}월</div>
        </div>`;
      })
      .join("");
    meta.innerHTML = `피크: <strong>${data.peak_month}월</strong> (${formatWon(
      data.peak_month_cost_원
    )}) · 비수기: <strong>${data.off_peak_month}월</strong> (${formatWon(data.off_peak_month_cost_원)})`;
  } catch (e) {
    meta.innerHTML = `<span class="error-text">불러오기 실패: ${e.message}</span>`;
  }
}

// ---------- Savings calculator ----------
$("#savingsForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const box = $("#savingsResult");
  box.innerHTML = `<span class="hint"><span class="spinner"></span>계산 중…</span>`;
  try {
    const data = await fetchJson(
      `/api/summary/savings${qs({
        year: currentYear(),
        adoption_sites: $("#adoptionSites").value,
        usage_reduction_pct: $("#usageReduction").value,
        cost_reduction_pct: $("#costReduction").value,
      })}`
    );
    box.innerHTML = `
      <div class="r-row"><span>기준 총 사용량 / 총 요금</span><span>${formatKwh(
        data.baseline_total_usage_kWh
      )} / ${formatWon(data.baseline_total_cost_원)}</span></div>
      <div class="r-row"><span>전체 시장 절감 시 (사용량/요금)</span><span>${formatKwh(
        data.projected_usage_saved_kWh
      )} / ${formatWon(data.projected_cost_saved_원)}</span></div>
      ${
        data.adoption_sites !== undefined
          ? `<div class="r-row"><span>도입 ${data.adoption_sites}개소 (점유 ${data.adoption_share_pct}%)</span><span>${formatKwh(
              data.adoption_projected_usage_saved_kWh
            )} / ${formatWon(data.adoption_projected_cost_saved_원)}</span></div>`
          : ""
      }
      <div class="r-row"><span>근거</span><span>${data.basis}</span></div>
    `;
  } catch (e) {
    box.innerHTML = `<span class="error-text">계산 실패: ${e.message}</span>`;
  }
});

// ---------- Revenue calculator ----------
$("#revenueForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const box = $("#revenueResult");
  box.innerHTML = `<span class="hint"><span class="spinner"></span>계산 중…</span>`;
  try {
    const rows = await fetchJson(
      `/api/summary/revenue${qs({
        customers: $("#customerCounts").value,
        monthly_fee: $("#monthlyFee").value,
      })}`
    );
    box.innerHTML = `
      <table>
        <thead><tr><th>고객 수</th><th>월 매출</th><th>연 매출</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r) =>
                `<tr><td>${formatNum(r.customers)}개소</td><td>${formatWon(
                  r.monthly_revenue_원
                )}</td><td>${formatWon(r.annual_revenue_원)}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>
    `;
  } catch (e) {
    box.innerHTML = `<span class="error-text">계산 실패: ${e.message}</span>`;
  }
});

// ---------- Gemini: market strategy report ----------
let lastMarketReportMd = "";

$("#genMarketReport").addEventListener("click", async () => {
  const btn = $("#genMarketReport");
  const status = $("#reportStatus");
  const out = $("#reportOutput");
  btn.disabled = true;
  $("#copyReport").disabled = true;
  $("#downloadReport").disabled = true;
  out.innerHTML = "";
  status.innerHTML = `<span class="spinner"></span>Gemini가 리포트를 작성 중입니다… (약 15~30초 소요)`;
  try {
    const data = await fetchJson(
      `/api/strategy/market${qs({
        year: currentYear(),
        adoption_sites: $("#adoptionSites").value,
      })}`
    );
    lastMarketReportMd = data.report;
    out.innerHTML = mdToHtml(data.report);
    status.textContent = `생성 완료 (분석 범위: ${data.scope})`;
    $("#copyReport").disabled = false;
    $("#downloadReport").disabled = false;
  } catch (e) {
    if (e.status === 503) {
      status.innerHTML = `<span class="error-text">Gemini API 키가 설정되지 않았습니다. m-ems/.env의 GEMINI_API_KEY를 확인하세요.</span>`;
    } else {
      status.innerHTML = `<span class="error-text">리포트 생성 실패: ${e.message}</span>`;
    }
  } finally {
    btn.disabled = false;
  }
});

$("#copyReport").addEventListener("click", async () => {
  if (!lastMarketReportMd) return;
  await navigator.clipboard.writeText(lastMarketReportMd);
  const btn = $("#copyReport");
  const original = btn.textContent;
  btn.textContent = "복사됨!";
  setTimeout(() => (btn.textContent = original), 1500);
});

$("#downloadReport").addEventListener("click", () => {
  if (!lastMarketReportMd) return;
  const blob = new Blob([lastMarketReportMd], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mems_strategy_${currentYear() || "all"}.md`;
  a.click();
  URL.revokeObjectURL(url);
});

// ---------- Industry dropdown + deep-dive ----------
async function loadIndustryOptions() {
  const sel = $("#industrySelect");
  try {
    const rows = await fetchJson("/api/industries");
    sel.innerHTML = rows
      .map((r) => `<option value="${r.업종코드}::${r.업종이름}">${r.업종이름} (${r.업종코드})</option>`)
      .join("");
  } catch (e) {
    sel.innerHTML = `<option>불러오기 실패</option>`;
  }
}

$("#genIndustryReport").addEventListener("click", async () => {
  const sel = $("#industrySelect");
  const status = $("#industryReportStatus");
  const out = $("#industryReportOutput");
  const [code, name] = sel.value.split("::");
  if (!code) return;

  const btn = $("#genIndustryReport");
  btn.disabled = true;
  out.innerHTML = "";
  status.innerHTML = `<span class="spinner"></span>Gemini가 '${name}' 브리핑을 작성 중입니다…`;
  try {
    const data = await fetchJson(
      `/api/strategy/industry/${encodeURIComponent(code)}${qs({
        year: currentYear(),
        industry_name: name,
      })}`
    );
    out.innerHTML = mdToHtml(data.report);
    status.textContent = "생성 완료";
  } catch (e) {
    if (e.status === 503) {
      status.innerHTML = `<span class="error-text">Gemini API 키가 설정되지 않았습니다.</span>`;
    } else {
      status.innerHTML = `<span class="error-text">생성 실패: ${e.message}</span>`;
    }
  } finally {
    btn.disabled = false;
  }
});

// ---------- init ----------
function reloadAll() {
  loadOverview();
  loadIndustryChart();
  loadMonthlyChart();
}

$("#yearSelect").addEventListener("change", reloadAll);

reloadAll();
loadIndustryOptions();
