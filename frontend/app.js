// ===================================================================
// app.js  —  화면을 실제로 움직이는 코드
// -------------------------------------------------------------------
// 큰 흐름:
//   1) 서버에서 공개설정(supabase 주소/anon key)을 받아 로그인 준비
//   2) 이미 로그인돼 있으면 바로 메인 화면, 아니면 로그인 화면
//   3) 로그인 → 메인 화면 (가게 이름 + 검색/필터 + 목록)
//   4) 사진 찍기 → AI 분석 → 확인 팝업 → 저장(입고)
//   5) 목록: [재고 | 판매됨 | 휴지통] 3가지로 전환
//        · 재고   : 아직 안 판 물건. 카드/상세에서 [판매] 가능
//        · 판매됨 : 판매한 물건(판매가·판매일·마진). 상세에서 [판매 취소] 가능
//        · 휴지통 : 소프트 삭제된 물건. 상세에서 [복구] 가능
//
// ★ 이 앱의 약속: 기록은 사라지지 않고(소프트 삭제/소프트 취소),
//   언제든 찾을 수 있고(검색), 고친 흔적이 남는다(수정 이력).
// ===================================================================

// 자주 쓰는 화면 요소들을 미리 찾아둡니다. ($ 는 "요소를 가져온다"는 뜻으로 지은 이름)
const $ = (id) => document.getElementById(id);

let supabaseClient = null;   // Supabase 로그인 리모컨 (아래에서 만듦)

// ★ [Phase 5-A] 업종 설정: /api/me 로 받아와 화면 곳곳(분류·필드·색)을 그립니다.
//   - 여기엔 '금','은' 같은 문자열을 하드코딩하지 않습니다. 전부 설정에서 옵니다.
let appConfig = null;      // { label, categories:[{value,label,color,text}], fields:[...], card_fields:[...] }
let categoryMap = {};      // value → {label,color,text}  (빠른 조회용)

// 판매 경로 코드(store/phone/other)를 한국어로 (업종과 무관하게 공통)
const CHANNEL_LABEL = { store: "매장", phone: "전화", other: "기타" };

// 설정을 받은 뒤, 분류 빠른조회표를 만듭니다.
function buildCategoryMap() {
  categoryMap = {};
  const cats = (appConfig && appConfig.categories) || [];
  for (const c of cats) categoryMap[c.value] = c;
}
// 분류 값 → 한국어 라벨 (없으면 값 그대로)
function categoryLabel(v) {
  return (categoryMap[v] && categoryMap[v].label) || v || "";
}
// select 필드(상태등급 등)의 값 → 옵션 라벨
function optionLabel(field, v) {
  if (v == null || v === "") return "";
  const opts = field.options || [];
  const o = opts.find((o) => String(o.value) === String(v));
  return o ? o.label : String(v);
}
// 상태(status) 한국어
function statusLabel(s) {
  return s === "sold" ? "판매됨" : (s === "in_stock" ? "재고" : (s || ""));
}
// 입력 방식(ai_status) 한국어 — 상세 화면에서 "어떻게 입력됐는지" 표시 [입고 최종판]
//   success=AI가 읽음 / failed_manual=AI 실패 후 직접 입력 / (옛 기록 null 은 표시 안 함)
function aiStatusLabel(s) {
  if (s === "success") return "AI 인식";
  if (s === "failed_manual") return "AI 실패 후 직접 입력";
  return "";
}
// 속성 값 읽기: 필드가 attributes 저장이면 rec.attributes 에서, 아니면 rec 에서.
function readFieldValue(rec, field) {
  if (field.store === "attributes") {
    return rec && rec.attributes ? rec.attributes[field.key] : null;
  }
  return rec ? rec[field.key] : null;
}
// HTML 속성값에 안전하게 넣기 위한 이스케이프 (큰따옴표까지)
function escapeAttr(text) {
  return escapeHtml(String(text)).replace(/"/g, "&quot;");
}


// -------------------------------------------------------------------
// (A) 시작 준비: 공개설정을 받아 Supabase 리모컨을 만든다
// -------------------------------------------------------------------
async function init() {
  try {
    const res = await fetch("/api/public-config");
    const cfg = await res.json();
    supabaseClient = supabase.createClient(cfg.supabase_url, cfg.supabase_anon_key);
  } catch (e) {
    alert("서버 설정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    return;
  }

  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    await enterApp();
  } else {
    showLogin();
  }
}


// -------------------------------------------------------------------
// (A-2) 업종군에 맞는 화면으로 보내기  [3업종군 플랫폼]
//   - /api/me 의 business_family(백엔드가 업종으로 판별) 를 우선 씁니다.
//   - 미정(null)이면 사장님이 예전에 고른 값(localStorage)을 씁니다.
//   - retail → 기존 앱 / membership·manufacturing → '준비 중' / 아무것도 없으면 → 선택 화면
// -------------------------------------------------------------------
const FAMILY_PICK_KEY = "familyPick";   // 미정 계정이 고른 업종군을 이 브라우저에 기억
const FAMILY_LABELS = { retail: "재고형", membership: "회원형", manufacturing: "제조형" };
let currentComingFamily = null;

async function fetchMe() {
  const token = await getToken();
  const res = await fetch("/api/me", { headers: { Authorization: "Bearer " + token } });
  if (!res.ok) return null;
  return await res.json();
}

async function enterApp() {
  const me = await fetchMe();
  // 백엔드가 정한 업종군 우선, 없으면(미정) 이 브라우저에 저장된 선택값
  const family = (me && me.business_family) || localStorage.getItem(FAMILY_PICK_KEY) || null;

  if (family === "retail") { await showMain(me); return; }          // 기존 앱 (회귀 없음)
  if (family === "membership") { await showMemberMain(me); return; }  // [회원형 2탄]
  if (family === "manufacturing") { showComingSoon(family); return; } // 아직 준비 중
  showFamilySelect();   // 미정 → 업종군 선택 화면
}

function showFamilySelect() {
  showScreen("family-select");
}

function showComingSoon(family) {
  currentComingFamily = family;
  $("coming-soon-name").textContent = FAMILY_LABELS[family] || "";
  showScreen("coming-soon");
}

// 선택 화면에서 업종군을 고르면: 이 브라우저에 기억하고 enterApp 이 알아서 라우팅.
function pickFamily(family) {
  localStorage.setItem(FAMILY_PICK_KEY, family);
  enterApp();
}

// '준비 중' 화면의 [← 업종군]: 저장된 선택을 지우고 다시 고르게.
function backToFamilySelect() {
  localStorage.removeItem(FAMILY_PICK_KEY);
  showFamilySelect();
}


// ===================================================================
// (S) 회원형: 회원 CRUD  [회원형 2탄 · 2-1]
//   - 목록/검색/휴지통, 등록(사진), 상세, 수정, 소프트삭제, 복구.
//   - retail(재고형)과 완전히 분리된 화면이라 재고형에 영향 없음.
// ===================================================================
let memberState = { q: "", view: "active", offset: 0 };   // active(회원) / trash(휴지통)
let memberFormPhotoUrl = null;   // 등록/수정 폼에서 올린 사진 경로
let memberEditingId = null;      // 수정 중인 회원 id (없으면 등록)
let currentMemberDetail = null;  // 지금 상세로 보고 있는 회원

async function showMemberMain(me) {
  if (me && me.shop_name) $("member-shop-name").textContent = me.shop_name;
  memberState = { q: "", view: "active", offset: 0 };
  $("member-search").value = "";
  document.querySelectorAll("#member-view-segment .seg-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.mview === "active"));
  showScreen("member-main");
  await loadMembers(true);
}

async function loadMembers(reset = true) {
  if (reset) memberState.offset = 0;
  const token = await getToken();
  if (!token) { showLogin(); return; }
  const params = new URLSearchParams();
  if (memberState.q) params.set("q", memberState.q);
  if (memberState.view === "trash") params.set("trash", "true");
  params.set("offset", String(memberState.offset));
  try {
    const res = await fetch("/api/members?" + params.toString(), {
      headers: { Authorization: "Bearer " + token },
    });
    if (!res.ok) { showBanner("회원 목록을 불러오지 못했어요.", "error"); return; }
    const data = await res.json();
    renderMemberList(data.members || [], reset);
    $("member-load-more").hidden = !data.has_more;
  } catch (e) {
    showBanner("회원 목록을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
  }
}

function memberCardHtml(m) {
  const img = m.photo_signed_url
    ? `<img class="thumb" src="${m.photo_signed_url}" alt="사진" />`
    : `<div class="thumb thumb-empty">사진<br>없음</div>`;
  const name = escapeHtml(m.name || "(이름 없음)");
  const sub = [m.phone ? escapeHtml(m.phone) : "", m.joined_at ? `등록 ${escapeHtml(m.joined_at)}` : ""]
    .filter(Boolean).join(" · ");
  return `
    <div class="record-item" data-id="${escapeAttr(m.id)}">
      ${img}
      <div class="record-info">
        <div class="record-top"><span class="record-name">${name}</span></div>
        <div class="record-sub">${sub}</div>
      </div>
    </div>`;
}

function renderMemberList(list, reset) {
  const box = $("member-list");
  const html = list.map(memberCardHtml).join("");
  if (reset) {
    box.innerHTML = html ||
      `<p class="empty-text">${memberState.view === "trash" ? "휴지통이 비었습니다." : "등록된 회원이 없습니다."}</p>`;
  } else {
    box.insertAdjacentHTML("beforeend", html);
  }
  memberState.offset += list.length;
}

// --- 등록/수정 폼 ---
function openMemberForm(mode, m) {
  memberEditingId = (mode === "edit" && m) ? m.id : null;
  $("member-modal-title").textContent = memberEditingId ? "회원 수정" : "회원 등록";
  $("m-name").value = m ? (m.name || "") : "";
  $("m-phone").value = m ? (m.phone || "") : "";
  $("m-birth").value = m ? (m.birth || "") : "";
  $("m-joined").value = m ? (m.joined_at || "") : "";
  $("m-memo").value = m ? (m.memo || "") : "";
  memberFormPhotoUrl = m ? (m.photo_url || null) : null;
  setMemberPhotoPreview(m ? m.photo_signed_url : null);
  $("member-modal").hidden = false;
  $("m-name").focus();
}

function closeMemberModal() { $("member-modal").hidden = true; }

function setMemberPhotoPreview(signedUrl) {
  const el = $("member-photo-preview");
  if (signedUrl) el.innerHTML = `<img src="${signedUrl}" alt="회원 사진" />`;
  else el.textContent = "사진 없음";
}

async function handleMemberPhotoPick(event) {
  const file = event.target.files[0];
  if (!file) return;
  const token = await getToken();
  const fd = new FormData();
  fd.append("photo", file);
  $("loading-overlay").hidden = false;
  try {
    const res = await fetch("/api/members/photo", {
      method: "POST", headers: { Authorization: "Bearer " + token }, body: fd,
    });
    if (!res.ok) { showBanner("사진 업로드에 실패했어요.", "error"); return; }
    const d = await res.json();
    memberFormPhotoUrl = d.photo_url;
    setMemberPhotoPreview(d.photo_signed_url);
  } catch (e) {
    showBanner("사진을 보내지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
  } finally {
    $("loading-overlay").hidden = true;
    event.target.value = "";
  }
}

async function handleMemberSave() {
  const token = await getToken();
  const name = $("m-name").value.trim();
  if (!name) { showBanner("회원 이름을 입력해 주세요.", "error"); $("m-name").focus(); return; }
  const body = {
    name,
    phone: $("m-phone").value.trim() || null,
    birth: $("m-birth").value || null,
    joined_at: $("m-joined").value || null,
    memo: $("m-memo").value.trim() || null,
    photo_url: memberFormPhotoUrl,
  };
  const isEdit = !!memberEditingId;
  const url = isEdit ? `/api/members/${memberEditingId}` : "/api/members";
  const method = isEdit ? "PATCH" : "POST";
  await withBusy($("member-save-btn"), "저장 중...", async () => {
    try {
      const res = await fetch(url, {
        method, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showBanner(err.detail || "저장에 실패했어요.", "error");
        return;
      }
      const editedId = memberEditingId;
      closeMemberModal();
      showBanner("✓ 저장되었습니다");
      if (isEdit) { await openMemberDetail(editedId); }   // 수정 → 상세로
      else { await showMemberMain(); }                     // 등록 → 목록으로
    } catch (e) {
      showBanner("저장하지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
    }
  });
}

// --- 상세 / 삭제 / 복구 ---
async function openMemberDetail(id) {
  const token = await getToken();
  try {
    const res = await fetch(`/api/members/${id}`, { headers: { Authorization: "Bearer " + token } });
    if (!res.ok) { showBanner("회원을 불러오지 못했어요.", "error"); return; }
    const data = await res.json();
    renderMemberDetail(data.member);
    showScreen("member-detail");
    window.scrollTo(0, 0);
    loadMemberMemberships(id);   // [회원형 2-2] 이 회원의 회원권 목록도 채웁니다
    loadMemberAttendances(id);   // [회원형 2-3] 이 회원의 출석 이력도 채웁니다
  } catch (e) {
    showBanner("회원을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
  }
}

function renderMemberDetail(m) {
  const deleted = !!m.deleted_at;
  const photo = m.photo_signed_url
    ? `<img class="detail-photo" src="${m.photo_signed_url}" alt="회원 사진" />`
    : `<div class="detail-photo detail-photo-empty">사진 없음</div>`;
  const rows = [
    ["이름", m.name || "-"],
    ["연락처", m.phone || "-"],
    ["생년월일", m.birth || "-"],
    ["등록일", m.joined_at || "-"],
    ["메모", m.memo || "-"],
  ];
  const fieldRows = rows.map(([l, v]) =>
    `<div class="detail-row"><span class="detail-label">${escapeHtml(l)}</span><span class="detail-value">${escapeHtml(String(v))}</span></div>`
  ).join("");
  const topNote = deleted ? `<div class="detail-deleted-note">🗑 삭제된 회원입니다 (휴지통)</div>` : "";
  // [회원형 2-2] 회원권 영역 (판매 목록은 loadMemberMemberships 가 채움) + 판매 버튼(삭제된 회원엔 없음)
  const msSection = `
    <div class="member-ms-section">
      <div class="member-ms-head">
        <div class="member-ms-title">회원권</div>
        ${deleted ? "" : `<button id="member-sell-btn" class="small-btn">+ 회원권 판매</button>`}
      </div>
      <div id="member-memberships"></div>
    </div>
    <div class="member-ms-section">
      <div class="member-ms-title">출석 이력</div>
      <div id="member-attendances"></div>
    </div>`;
  const buttons = deleted
    ? `<div class="detail-buttons"><button id="member-restore-btn" class="big-btn">복구</button></div>`
    : `<div class="detail-buttons">
         <button id="member-edit-btn" class="big-btn">수정</button>
         <button id="member-delete-btn" class="big-btn danger">삭제</button>
       </div>`;
  $("member-detail-body").innerHTML =
    `${topNote}${photo}<div class="detail-fields">${fieldRows}</div>${msSection}${buttons}`;
  currentMemberDetail = m;
  if (deleted) {
    $("member-restore-btn").onclick = () => handleMemberRestore(m.id);
  } else {
    $("member-sell-btn").onclick = () => openMembershipSale(m);
    $("member-edit-btn").onclick = () => openMemberForm("edit", m);
    $("member-delete-btn").onclick = () => handleMemberDelete(m.id);
  }
}

async function handleMemberDelete(id) {
  if (!confirm("이 회원을 삭제할까요?\n(휴지통에 보관되며 복구할 수 있어요.)")) return;
  const token = await getToken();
  try {
    const res = await fetch(`/api/members/${id}`, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
    if (!res.ok) { showBanner("삭제하지 못했어요.", "error"); return; }
    showBanner("✓ 휴지통으로 옮겼습니다");
    await showMemberMain();
  } catch (e) { showBanner("삭제하지 못했어요. 인터넷 연결을 확인해 주세요.", "error"); }
}

async function handleMemberRestore(id) {
  const token = await getToken();
  try {
    const res = await fetch(`/api/members/${id}/restore`, { method: "POST", headers: { Authorization: "Bearer " + token } });
    if (!res.ok) { showBanner("복구하지 못했어요.", "error"); return; }
    showBanner("✓ 복구되었습니다");
    await openMemberDetail(id);
  } catch (e) { showBanner("복구하지 못했어요. 인터넷 연결을 확인해 주세요.", "error"); }
}


// ===================================================================
// (T) 회원권 상품 + 판매  [회원형 2-2]
// ===================================================================
let plansCache = [];        // 활성 상품 목록 (판매 드롭다운에도 씀)
let planEditingId = null;   // 수정 중인 상품 id
let saleMemberId = null;    // 회원권을 파는 대상 회원 id

// --- 상품 관리 ---
async function openPlanManage() {
  await loadPlans();
  showScreen("plan-manage");
}

async function loadPlans() {
  const token = await getToken();
  try {
    const res = await fetch("/api/membership-plans", { headers: { Authorization: "Bearer " + token } });
    if (!res.ok) { showBanner("상품을 불러오지 못했어요.", "error"); return; }
    plansCache = (await res.json()).plans || [];
    renderPlanList();
  } catch (e) {
    showBanner("상품을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
  }
}

function planKindText(p) {
  return p.kind === "count" ? `${p.total_count ?? "-"}회` : `${p.duration_days ?? "-"}일`;
}

function renderPlanList() {
  const box = $("plan-list");
  if (!plansCache.length) {
    box.innerHTML = `<p class="cat-empty">아직 상품이 없어요. [+ 상품 추가]로 만들어 보세요.</p>`;
    return;
  }
  box.innerHTML = plansCache.map((p) => `
    <div class="cat-item">
      <div class="cat-main">
        <b>${escapeHtml(p.name)}</b>
        <span class="plan-meta">${escapeHtml(planKindText(p))} · ${formatWon(p.price ?? 0)}원</span>
      </div>
      <button class="small-btn" data-act="edit" data-id="${escapeAttr(p.id)}">수정</button>
      <button class="small-btn cat-hide-btn" data-act="hide" data-id="${escapeAttr(p.id)}">숨기기</button>
    </div>`).join("");
}

function openPlanModal(mode, p) {
  planEditingId = (mode === "edit" && p) ? p.id : null;
  $("plan-modal-title").textContent = planEditingId ? "상품 수정" : "상품 추가";
  $("p-name").value = p ? (p.name || "") : "";
  $("p-kind").value = p ? (p.kind || "period") : "period";
  $("p-duration").value = p && p.duration_days != null ? p.duration_days : "";
  $("p-count").value = p && p.total_count != null ? p.total_count : "";
  $("p-price").value = p && p.price != null ? p.price : "";
  planKindToggle();
  $("plan-modal").hidden = false;
  $("p-name").focus();
}

function closePlanModal() { $("plan-modal").hidden = true; }

// 종류에 따라 '유효 일수' / '총 횟수' 칸만 보이게
function planKindToggle() {
  const k = $("p-kind").value;
  $("p-period-row").hidden = k !== "period";
  $("p-count-row").hidden = k !== "count";
}

async function handlePlanSave() {
  const token = await getToken();
  const name = $("p-name").value.trim();
  if (!name) { showBanner("상품 이름을 입력해 주세요.", "error"); $("p-name").focus(); return; }
  const kind = $("p-kind").value;
  const numOrNull = (v) => { v = v.trim(); return v === "" ? null : Number(v); };
  const body = {
    name, kind,
    duration_days: kind === "period" ? numOrNull($("p-duration").value) : null,
    total_count: kind === "count" ? numOrNull($("p-count").value) : null,
    price: numOrNull($("p-price").value) || 0,
  };
  const isEdit = !!planEditingId;
  const url = isEdit ? `/api/membership-plans/${planEditingId}` : "/api/membership-plans";
  await withBusy($("plan-save-btn"), "저장 중...", async () => {
    try {
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showBanner(err.detail || "저장에 실패했어요.", "error");
        return;
      }
      closePlanModal();
      showBanner("✓ 저장되었습니다");
      await loadPlans();
    } catch (e) {
      showBanner("저장하지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
    }
  });
}

async function handlePlanHide(id) {
  if (!confirm("이 상품을 숨길까요?\n(이미 판매된 회원권은 그대로 유지됩니다.)")) return;
  const token = await getToken();
  try {
    const res = await fetch(`/api/membership-plans/${id}`, {
      method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    });
    if (!res.ok) { showBanner("숨기지 못했어요.", "error"); return; }
    showBanner("✓ 숨겼습니다");
    await loadPlans();
  } catch (e) { showBanner("숨기지 못했어요. 인터넷 연결을 확인해 주세요.", "error"); }
}

// --- 회원권 판매 ---
async function openMembershipSale(member) {
  saleMemberId = member.id;
  $("ms-sale-member").textContent = `${member.name || "회원"} 님에게 판매`;
  if (!plansCache.length) await loadPlans();
  if (!plansCache.length) {
    showBanner("먼저 상단 [🎟 회원권]에서 상품을 만들어 주세요.", "error");
    return;
  }
  $("ms-plan").innerHTML = plansCache.map((p) => {
    const label = `${escapeHtml(p.name)} (${escapeHtml(planKindText(p))}) · ${formatWon(p.price ?? 0)}원`;
    return `<option value="${escapeAttr(p.id)}" data-price="${p.price ?? 0}">${label}</option>`;
  }).join("");
  $("ms-start").value = fmtDate(new Date());   // 오늘
  handleMsPlanChange();                         // 선택 상품 가격을 받은 금액에 미리 채움
  $("ms-memo").value = "";
  $("ms-sale-modal").hidden = false;
}

function handleMsPlanChange() {
  const opt = $("ms-plan").selectedOptions[0];
  $("ms-price").value = opt ? (opt.dataset.price || "") : "";
}

async function handleMembershipSale() {
  const token = await getToken();
  const planId = $("ms-plan").value;
  if (!planId) { showBanner("상품을 선택해 주세요.", "error"); return; }
  const priceRaw = $("ms-price").value.trim();
  const body = {
    member_id: saleMemberId,
    plan_id: planId,
    start_date: $("ms-start").value || null,
    price_paid: priceRaw === "" ? null : Number(priceRaw),
    memo: $("ms-memo").value.trim() || null,
  };
  await withBusy($("ms-confirm-btn"), "판매 중...", async () => {
    try {
      const res = await fetch("/api/memberships", {
        method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showBanner(err.detail || "판매에 실패했어요.", "error");
        return;
      }
      $("ms-sale-modal").hidden = true;
      showBanner("✓ 회원권을 판매했습니다");
      await loadMemberMemberships(saleMemberId);   // 상세의 회원권 목록 갱신
    } catch (e) {
      showBanner("판매하지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
    }
  });
}

// --- 한 회원의 회원권 목록 (상세 화면 안) ---
async function loadMemberMemberships(memberId) {
  const token = await getToken();
  try {
    const res = await fetch(`/api/memberships?member_id=${encodeURIComponent(memberId)}`, {
      headers: { Authorization: "Bearer " + token },
    });
    if (!res.ok) return;
    const data = await res.json();
    renderMemberMemberships(data.memberships || []);
  } catch (e) { /* 목록 못 불러와도 상세는 그대로 */ }
}

function renderMemberMemberships(list) {
  const box = $("member-memberships");
  if (!box) return;
  if (!list.length) {
    box.innerHTML = `<p class="ms-empty">판매된 회원권이 없습니다.</p>`;
    return;
  }
  box.innerHTML = list.map((ms) => {
    const period = ms.kind === "count"
      ? `잔여 ${ms.remaining_count ?? "-"}/${ms.total_count ?? "-"}회`
      : `${ms.start_date || "-"} ~ ${ms.end_date || "-"}`;
    const price = ms.price_paid != null ? `${formatWon(ms.price_paid)}원` : "";
    return `
      <div class="ms-item">
        <div class="ms-info">
          <div class="ms-name">${escapeHtml(ms.plan_name || "회원권")}</div>
          <div class="ms-sub">${escapeHtml(period)}${price ? " · " + price : ""}</div>
        </div>
        <button class="small-btn ms-cancel-btn" data-id="${escapeAttr(ms.id)}">취소</button>
      </div>`;
  }).join("");
}

async function handleMembershipCancel(id) {
  if (!confirm("이 회원권을 취소할까요?")) return;
  const token = await getToken();
  try {
    const res = await fetch(`/api/memberships/${id}`, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
    if (!res.ok) { showBanner("취소하지 못했어요.", "error"); return; }
    showBanner("✓ 회원권을 취소했습니다");
    const mid = (currentMemberDetail && currentMemberDetail.id) || saleMemberId;
    if (mid) await loadMemberMemberships(mid);
  } catch (e) { showBanner("취소하지 못했어요. 인터넷 연결을 확인해 주세요.", "error"); }
}


// ===================================================================
// (U) 출석 체크  [회원형 2-3]
//   - 오늘 출석 화면: 회원 명단에서 [출석]/[취소]. 횟수권이면 잔여가 자동 증감.
//   - 회원 상세: 출석 이력 표시.
// ===================================================================
let attQ = "";              // 출석 화면 검색어
let attTodayMap = {};       // member_id → 오늘 출석 기록 {id, checked_at}

function attTodayLabel() {
  const d = new Date();
  const dows = ["일", "월", "화", "수", "목", "금", "토"];
  return `${fmtDate(d)} (${dows[d.getDay()]}) 출석 명단`;
}

function fmtTimeShort(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function showAttendance() {
  attQ = "";
  $("att-search").value = "";
  $("att-date").textContent = attTodayLabel();
  showScreen("attendance");
  await loadAttendance();
}

async function loadAttendance() {
  const token = await getToken();
  if (!token) { showLogin(); return; }
  const params = new URLSearchParams();
  if (attQ) params.set("q", attQ);
  params.set("offset", "0");
  try {
    const [mRes, tRes] = await Promise.all([
      fetch("/api/members?" + params.toString(), { headers: { Authorization: "Bearer " + token } }),
      fetch("/api/attendances/today", { headers: { Authorization: "Bearer " + token } }),
    ]);
    const members = mRes.ok ? ((await mRes.json()).members || []) : [];
    const today = tRes.ok ? ((await tRes.json()).attendances || []) : [];
    attTodayMap = {};
    today.forEach((a) => { attTodayMap[a.member_id] = a; });
    renderAttendanceList(members);
  } catch (e) {
    showBanner("출석 화면을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
  }
}

function renderAttendanceList(members) {
  const box = $("att-list");
  if (!members.length) {
    box.innerHTML = `<p class="empty-text">${attQ ? "찾는 회원이 없습니다." : "등록된 회원이 없습니다."}</p>`;
    return;
  }
  box.innerHTML = members.map((m) => {
    const att = attTodayMap[m.id];
    const img = m.photo_signed_url
      ? `<img class="thumb" src="${m.photo_signed_url}" alt="사진" />`
      : `<div class="thumb thumb-empty">사진<br>없음</div>`;
    const right = att
      ? `<span class="att-done">✓ ${fmtTimeShort(att.checked_at)}</span>
         <button class="small-btn att-cancel-btn" data-id="${escapeAttr(att.id)}">취소</button>`
      : `<button class="small-btn att-check-btn" data-mid="${escapeAttr(m.id)}">출석</button>`;
    return `
      <div class="record-item att-row">
        ${img}
        <div class="record-info">
          <div class="record-top"><span class="record-name">${escapeHtml(m.name || "(이름 없음)")}</span></div>
          <div class="record-sub">${m.phone ? escapeHtml(m.phone) : ""}</div>
        </div>
        <div class="att-right">${right}</div>
      </div>`;
  }).join("");
}

async function handleCheckIn(memberId) {
  const token = await getToken();
  try {
    const res = await fetch("/api/attendances", {
      method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { showBanner(data.detail || "출석 처리에 실패했어요.", "error"); return; }
    let msg = "✓ 출석 체크";
    if (data.remaining != null) msg += ` (잔여 ${data.remaining}회)`;
    showBanner(msg);
    await loadAttendance();
  } catch (e) { showBanner("출석 처리에 실패했어요. 인터넷 연결을 확인해 주세요.", "error"); }
}

async function handleCheckCancel(attId) {
  const token = await getToken();
  try {
    const res = await fetch(`/api/attendances/${attId}`, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
    if (!res.ok) { showBanner("출석 취소에 실패했어요.", "error"); return; }
    showBanner("✓ 출석을 취소했습니다");
    await loadAttendance();
  } catch (e) { showBanner("출석 취소에 실패했어요. 인터넷 연결을 확인해 주세요.", "error"); }
}

// --- 회원 상세 안 출석 이력 ---
async function loadMemberAttendances(memberId) {
  const token = await getToken();
  try {
    const res = await fetch(`/api/attendances?member_id=${encodeURIComponent(memberId)}`, {
      headers: { Authorization: "Bearer " + token },
    });
    if (!res.ok) return;
    renderMemberAttendances((await res.json()).attendances || []);
  } catch (e) { /* 이력 못 불러와도 상세는 그대로 */ }
}

function renderMemberAttendances(list) {
  const box = $("member-attendances");
  if (!box) return;
  if (!list.length) { box.innerHTML = `<p class="ms-empty">출석 기록이 없습니다.</p>`; return; }
  box.innerHTML = `<div class="att-hist">` +
    list.map((a) => `<span class="att-chip">${escapeHtml(formatDateTime(a.checked_at))}</span>`).join("") +
    `</div>`;
}


// -------------------------------------------------------------------
// (B) 화면 전환 도우미 (로그인 / 메인 / 상세 / 정산 중 하나만 보이게)
//     - 하단 탭 바(입고/정산)는 목록·정산 화면에서만 보입니다.
// -------------------------------------------------------------------
function showScreen(name) {
  $("login-screen").hidden = name !== "login";
  $("main-screen").hidden = name !== "main";
  $("detail-screen").hidden = name !== "detail";
  $("report-screen").hidden = name !== "report";
  $("categories-screen").hidden = name !== "categories";           // [분류 사용자 정의]
  $("family-select-screen").hidden = name !== "family-select";     // [3업종군 플랫폼]
  $("coming-soon-screen").hidden = name !== "coming-soon";         // [3업종군 플랫폼]
  $("member-main-screen").hidden = name !== "member-main";         // [회원형 2탄]
  $("member-detail-screen").hidden = name !== "member-detail";     // [회원형 2탄]
  $("plan-manage-screen").hidden = name !== "plan-manage";         // [회원형 2-2]
  $("attendance-screen").hidden = name !== "attendance";           // [회원형 2-3]

  // 하단 탭: 입고(main) / 정산(report) 화면에서만 표시
  const showTabs = (name === "main" || name === "report");
  $("tab-bar").hidden = !showTabs;
  if (showTabs) {
    const active = name === "report" ? "report" : "intake";
    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === active);
    });
  }
}

function showLogin() {
  showScreen("login");
}

async function showMain(me) {
  showScreen("main");
  await loadShopName(me);   // me 를 넘기면 /api/me 를 다시 안 부릅니다 [3업종군 플랫폼]
  await loadRecords(true);
}


// -------------------------------------------------------------------
// (C) 로그인 토큰 가져오기 (백엔드 호출 시 Authorization 헤더에 넣음)
// -------------------------------------------------------------------
async function getToken() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session ? data.session.access_token : null;
}


// -------------------------------------------------------------------
// (C-2) 알림 배너: 성공(초록)/실패(빨강) 문구를 화면 상단에 잠깐 띄웁니다.
// -------------------------------------------------------------------
let bannerTimer = null;
function showBanner(message, type = "ok") {
  const b = $("banner");
  b.textContent = message;
  b.className = "banner " + (type === "error" ? "banner-error" : "banner-ok");
  b.hidden = false;
  if (bannerTimer) clearTimeout(bannerTimer);
  const ms = type === "error" ? 4000 : 2000;
  bannerTimer = setTimeout(() => { b.hidden = true; }, ms);
}


// -------------------------------------------------------------------
// (C-3) 버튼 '작업 중' 처리: 누르는 동안 잠그고 글자를 바꿔 이중 저장을 막음.
// -------------------------------------------------------------------
async function withBusy(btn, busyLabel, fn) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.classList.add("busy");
  btn.textContent = busyLabel;
  try {
    return await fn();
  } finally {
    btn.disabled = false;
    btn.classList.remove("busy");
    btn.textContent = original;
  }
}


// -------------------------------------------------------------------
// (D) 로그인 / (E) 로그아웃 / (F) 가게 이름
// -------------------------------------------------------------------
async function handleLogin() {
  const email = $("email").value.trim();
  const password = $("password").value;
  $("login-error").textContent = "";

  if (!email || !password) {
    $("login-error").textContent = "이메일과 비밀번호를 입력해 주세요.";
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    $("login-error").textContent = "로그인에 실패했어요. 이메일과 비밀번호를 확인해 주세요.";
    return;
  }
  await enterApp();   // 로그인 후 업종군에 맞는 화면으로 [3업종군 플랫폼]
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  $("email").value = "";
  $("password").value = "";
  showLogin();
}

async function loadShopName(me) {
  try {
    // me 를 미리 받았으면 그걸 쓰고, 아니면 /api/me 를 부릅니다. [3업종군 플랫폼]
    const data = me || await fetchMe();
    if (!data) return;
    $("shop-name").textContent = data.shop_name;

    // ★ 업종 설정을 저장하고, 그 설정으로 분류 필터 버튼을 그립니다. [Phase 5-A]
    appConfig = data.config || null;
    buildCategoryMap();
    renderFilterButtons();
  } catch (e) {
    // 이름/설정 못 불러와도 화면은 계속 쓸 수 있게 조용히 넘어감
  }
}

// 분류 필터 버튼 [전체 + 업종 분류들]을 설정으로 그립니다.
function renderFilterButtons() {
  const cats = (appConfig && appConfig.categories) || [];
  let html = `<button class="filter-btn active" data-cat="all">전체</button>`;
  for (const c of cats) {
    html += `<button class="filter-btn" data-cat="${escapeAttr(c.value)}">${escapeHtml(c.label)}</button>`;
  }
  $("filter-row").innerHTML = html;
  // 업종이 바뀌면 이전 분류 선택이 무의미하니 '전체'로 초기화
  listState.category = "all";
}


// ===================================================================
// (Q) 분류 관리 (헤더 ⚙️ → 분류 관리)  [분류 사용자 정의]
//   - 분류는 가게가 직접 만든 것만 존재합니다(프리셋 없음). 새 가게는 0개로 시작.
//   - 목록 정렬(위/아래), 추가, 수정(이름·색), 숨기기(삭제 대신 is_active=false).
// ===================================================================

let catColors = [];        // 색 선택지 [{key,label,color,text}] — GET /api/categories 로 받음
let catList = [];          // 현재 분류 목록 (관리 화면용)
let catEditingId = null;   // 수정 중인 분류 id (없으면 '추가' 모드)
let catPickedColor = null; // 팝업에서 고른 색 키

// 분류 관리 화면 열기
async function openCategoriesScreen() {
  showScreen("categories");
  await loadCategories();
}

// 목록 + 색 선택지 불러오기
async function loadCategories() {
  const token = await getToken();
  try {
    const res = await fetch("/api/categories", { headers: { Authorization: "Bearer " + token } });
    if (!res.ok) { showBanner("분류를 불러오지 못했어요.", "error"); return; }
    const data = await res.json();
    catList = data.categories || [];
    catColors = data.colors || [];
    renderCategoryList();
  } catch (e) {
    showBanner("분류를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
  }
}

// 색 키 → {color,text} (프론트 표시용)
function colorByKey(key) {
  return catColors.find((c) => c.key === key) || { color: "#8a8f98", text: "#ffffff" };
}

// 분류 목록 그리기 (각 행: [▲][▼] 색뱃지 [수정][숨기기])
function renderCategoryList() {
  const box = $("cat-list");
  if (!catList.length) {
    box.innerHTML = `<p class="cat-empty">아직 분류가 없어요. 아래 [+ 분류 추가]로 만들어 보세요.</p>`;
    return;
  }
  box.innerHTML = catList.map((c, i) => {
    const col = colorByKey(c.color);
    const badge = `<span class="badge" style="background:${col.color};color:${col.text}">${escapeHtml(c.label)}</span>`;
    const upDis = i === 0 ? "disabled" : "";
    const downDis = i === catList.length - 1 ? "disabled" : "";
    return `
      <div class="cat-item">
        <div class="cat-order">
          <button class="cat-move" data-move="up" data-id="${escapeAttr(c.id)}" ${upDis} aria-label="위로">▲</button>
          <button class="cat-move" data-move="down" data-id="${escapeAttr(c.id)}" ${downDis} aria-label="아래로">▼</button>
        </div>
        <div class="cat-main">${badge}</div>
        <button class="small-btn" data-act="edit" data-id="${escapeAttr(c.id)}">수정</button>
        <button class="small-btn cat-hide-btn" data-act="hide" data-id="${escapeAttr(c.id)}">숨기기</button>
      </div>`;
  }).join("");
}

// 팝업 열기 (mode: 'add' | 'edit')
function openCatModal(mode, cat) {
  catEditingId = (mode === "edit" && cat) ? cat.id : null;
  $("cat-modal-title").textContent = catEditingId ? "분류 수정" : "분류 추가";
  $("cat-name").value = cat ? cat.label : "";
  catPickedColor = cat ? cat.color : ((catColors[0] && catColors[0].key) || "gray");
  renderColorSwatches();
  $("cat-modal").hidden = false;
  $("cat-name").focus();
}

function closeCatModal() {
  $("cat-modal").hidden = true;
  catEditingId = null;
}

// 6색 스와치 그리기 (고른 색에 테두리 표시)
function renderColorSwatches() {
  $("cat-color-row").innerHTML = catColors.map((c) => {
    const sel = c.key === catPickedColor ? " picked" : "";
    return `<button type="button" class="cat-swatch${sel}" data-color="${escapeAttr(c.key)}"
              style="background:${c.color}" title="${escapeHtml(c.label)}" aria-label="${escapeHtml(c.label)}"></button>`;
  }).join("");
}

// 저장 (추가=POST / 수정=PATCH). 이름 중복이면 서버가 409 로 안내.
async function handleCatSave() {
  const token = await getToken();
  const label = $("cat-name").value.trim();
  if (!label) { showBanner("분류 이름을 입력해 주세요.", "error"); $("cat-name").focus(); return; }
  if (!catPickedColor) { showBanner("색을 골라 주세요.", "error"); return; }

  const isEdit = !!catEditingId;
  const url = isEdit ? `/api/categories/${catEditingId}` : "/api/categories";
  const method = isEdit ? "PATCH" : "POST";

  await withBusy($("cat-save-btn"), "저장 중...", async () => {
    try {
      const res = await fetch(url, {
        method,
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ label, color: catPickedColor }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showBanner(err.detail || "저장에 실패했어요.", "error");   // 409 중복 등도 여기로
        return;
      }
      closeCatModal();
      showBanner("✓ 저장되었습니다");
      await loadCategories();   // 관리 화면 목록 새로고침
      await loadShopName();     // 메인의 분류 필터·뱃지·드롭다운도 새로고침 (appConfig 갱신)
    } catch (e) {
      showBanner("저장하지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
    }
  });
}

// 숨기기 (삭제 대신 is_active=false). 기존 기록의 분류 표시는 그대로 유지됩니다.
async function handleCatHide(id) {
  if (!confirm("이 분류를 숨길까요?\n(이미 저장된 기록의 분류 표시는 그대로 유지됩니다.)")) return;
  const token = await getToken();
  try {
    const res = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    });
    if (!res.ok) { showBanner("숨기지 못했어요.", "error"); return; }
    showBanner("✓ 숨겼습니다");
    await loadCategories();
    await loadShopName();
  } catch (e) {
    showBanner("숨기지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
  }
}

// 위/아래 정렬: 이웃과 sort_order 를 맞바꿉니다 (PATCH 두 번).
async function handleCatMove(id, dir) {
  const idx = catList.findIndex((c) => c.id === id);
  if (idx < 0) return;
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= catList.length) return;

  const a = catList[idx], b = catList[swapIdx];
  const token = await getToken();
  const patch = (cid, order) => fetch(`/api/categories/${cid}`, {
    method: "PATCH",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ sort_order: order }),
  });
  try {
    await Promise.all([patch(a.id, b.sort_order), patch(b.id, a.sort_order)]);
    await loadCategories();
    await loadShopName();
  } catch (e) {
    showBanner("순서를 바꾸지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
  }
}


// -------------------------------------------------------------------
// (G) 사진 선택 → AI 분석 → 확인 팝업
// -------------------------------------------------------------------
async function handlePhotoSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const token = await getToken();
  if (!token) { showLogin(); return; }

  currentFailureId = null;    // 새 사진이므로 이전 실패 연결을 초기화
  hideAnalyzeRecovery();      // 이전 실패 안내가 남아 있으면 지웁니다

  const formData = new FormData();
  formData.append("photo", file);

  $("loading-overlay").hidden = false;

  try {
    const res = await fetch("/api/intake/analyze", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showBanner(err.detail || "사진 분석에 실패했어요.", "error");
      return;
    }
    const result = await res.json();
    // [버그 A-1] AI 인식만 실패한 경우: 사진은 이미 저장됨 → 이어가기 버튼 2개를 보여줍니다.
    if (result.ai_failed) {
      showAnalyzeRecovery(result);
    } else {
      openConfirmModal(result);
    }
  } catch (e) {
    showBanner("사진을 보내지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
  } finally {
    $("loading-overlay").hidden = true;
    event.target.value = "";
  }
}


// -------------------------------------------------------------------
// (G-2) 사진 인식 실패 시 이어가기 [입고 최종판]
//   - AI 가 사진을 못 읽어도, 이미 업로드된 사진(photo_url)과 실패기록(failure_id)은 남습니다.
//   - [다시 찍기] : 카메라/파일 선택을 다시 열어 '새 사진'으로 처음부터 다시.
//   - [직접 입력] : 실패 사진(photo_url)과 failure_id 를 유지한 채 빈 확인 팝업을 엽니다.
//       → 저장하면 ai_status='failed_manual' 로 남고, 그 실패기록이 '해결됨'으로 연결됩니다.
// -------------------------------------------------------------------
function showAnalyzeRecovery(result) {
  currentPhotoUrl = result.photo_url;     // 이미 업로드된 실패 사진 경로
  currentFailureId = result.failure_id;   // 그 실패를 남긴 ai_failures 행 id
  currentAiRaw = null;
  currentAiMeta = null;
  showBanner("사진을 읽지 못했어요. 다시 찍어 주세요.", "error");
  $("analyze-recovery").hidden = false;
}

function hideAnalyzeRecovery() {
  $("analyze-recovery").hidden = true;
}

// [다시 찍기] — 카메라(사진 찍기) 입력을 다시 엽니다. 고르면 새 analyze 가 처음부터 돕니다.
function handleRetake() {
  hideAnalyzeRecovery();
  $("photo-input").click();
}

// [직접 입력] (실패 배너에서) — 지금 실패한 사진/failure_id 를 유지한 채 빈 확인 팝업.
function handleManualEntry() {
  openManualEntry(currentPhotoUrl, currentFailureId);
}

// 실패 사진을 '직접 입력'으로 이어가는 공통 함수.
//   - 실패 배너의 [직접 입력], 정산 탭 '실패 기록'의 [직접 입력하기] 가 함께 씁니다.
//   - photo_url 과 failure_id 를 유지한 채 확인 팝업을 빈 값으로 엽니다.
function openManualEntry(photoUrl, failureId) {
  currentFailureId = failureId || null;
  hideAnalyzeRecovery();
  openConfirmModal({
    photo_url: photoUrl,
    fields: {},          // 빈 값 → 업종 설정 기반 필드가 빈 입력칸으로 그려짐
    ai_raw: null,
    ai_model: null,
    ai_latency_ms: null,
    ai_tokens_input: null,
    ai_tokens_output: null,
  });
}


// analyze 결과 임시 보관
let currentPhotoUrl = null;
let currentAiRaw = null;
let currentAiMeta = null;
let currentFailureId = null;   // [입고 최종판] AI 실패에서 이어온 저장이면 그 실패기록 id (없으면 null)

// -------------------------------------------------------------------
// 업종 설정의 필드들을 입력 폼(label + input)으로 그립니다. [Phase 5-A]
//   - containerId : 그릴 곳, prefix : 입력칸 id 앞부분(cf 또는 ef), values : 미리 채울 값
//   - 만들어지는 입력칸 id 는 `${prefix}-${key}` (예: cf-item_name, ef-brand)
// -------------------------------------------------------------------
function renderFieldForm(containerId, prefix, values) {
  values = values || {};
  const fields = (appConfig && appConfig.fields) || [];
  const cats = (appConfig && appConfig.categories) || [];

  let html = "";
  for (const f of fields) {
    const id = `${prefix}-${f.key}`;
    const v = values[f.key];
    html += `<label class="field-label" for="${id}">${escapeHtml(f.label)}</label>`;

    // [분류 사용자 정의] 분류(category) 필드인데 그 가게 분류가 0개면,
    //   드롭다운 대신 안내문을 보여줍니다. (저장 시 category 는 null 로 나감)
    if (f.key === "category" && cats.length === 0) {
      html += `<p class="no-cat-note">분류 없음 · 설정(⚙️)에서 추가할 수 있어요</p>`;
      continue;
    }

    if (f.type === "select") {
      // 분류(category)는 설정의 categories, 그 밖의 select(상태등급 등)는 f.options
      const opts = f.key === "category" ? cats : (f.options || []);
      let optionsHtml = "";
      // 분류가 아닌 선택은 '비워둘' 수 있게 빈 옵션을 앞에 둡니다.
      if (f.key !== "category") optionsHtml += `<option value="">(선택 안 함)</option>`;
      for (const o of opts) {
        const sel = String(v ?? "") === String(o.value) ? " selected" : "";
        optionsHtml += `<option value="${escapeAttr(o.value)}"${sel}>${escapeHtml(o.label)}</option>`;
      }
      html += `<select id="${id}" class="text-input">${optionsHtml}</select>`;
    } else {
      const mode = f.type === "number" ? "decimal" : "text";
      const val = v == null ? "" : v;
      html += `<input id="${id}" type="text" class="text-input" inputmode="${mode}" value="${escapeAttr(val)}" />`;
    }
  }
  $(containerId).innerHTML = html;
}

// 위에서 그린 폼의 값을 읽어 { key: value } 로 모읍니다.
//   - 숫자 필드는 숫자(또는 빈칸 null), 글자 필드는 앞뒤 공백 정리(빈칸 null)
function readFieldForm(prefix) {
  const fields = (appConfig && appConfig.fields) || [];
  const out = {};
  for (const f of fields) {
    const el = $(`${prefix}-${f.key}`);
    if (!el) continue;
    let val = (el.value || "").trim();
    if (f.type === "number") {
      out[f.key] = val === "" ? null : Number(val);
    } else {
      out[f.key] = val === "" ? null : val;
    }
  }
  return out;
}

// -------------------------------------------------------------------
// (H) 확인 팝업 (신규 입고 저장)
// -------------------------------------------------------------------
function openConfirmModal(result) {
  currentPhotoUrl = result.photo_url;
  currentAiRaw = result.ai_raw;
  currentAiMeta = {
    ai_model: result.ai_model ?? null,
    ai_latency_ms: result.ai_latency_ms ?? null,
    ai_tokens_input: result.ai_tokens_input ?? null,
    ai_tokens_output: result.ai_tokens_output ?? null,
  };

  // AI 가 읽은 값으로 미리 채운 입력 폼을 업종 설정에 맞춰 그립니다.
  renderFieldForm("confirm-fields", "cf", result.fields || {});
  $("confirm-modal").hidden = false;
}

function closeConfirmModal() {
  $("confirm-modal").hidden = true;
  currentFailureId = null;   // 저장했든 취소했든, 실패 연결은 여기서 초기화
}

async function handleSave() {
  const token = await getToken();
  if (!token) { showLogin(); return; }

  // 업종 설정의 입력 폼에서 값을 모읍니다. (item_name, category, ...업종별 필드)
  const fields = readFieldForm("cf");

  // 품목명은 필수예요. (DB에서 item_name 이 비면 저장이 거부됩니다.)
  if (!fields.item_name) {
    showBanner("품목명을 입력해 주세요.", "error");
    const el = $("cf-item_name");
    if (el) el.focus();
    return;
  }

  const body = {
    fields: fields,                 // ★ 업종 필드들을 한 덩어리로 보냄
    photo_url: currentPhotoUrl,
    ai_raw: currentAiRaw,
    failure_id: currentFailureId,   // 실패에서 이어온 저장이면 그 실패기록 id (아니면 null)
    ...(currentAiMeta || {}),
  };

  await withBusy($("save-btn"), "저장 중...", async () => {
    try {
      const res = await fetch("/api/intake/confirm", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showBanner(err.detail || "저장에 실패했어요.", "error");
        return;
      }
      closeConfirmModal();
      showBanner("✓ 저장되었습니다");
      resetToStockList();   // 저장 후 '재고' 목록으로 새로고침
    } catch (e) {
      showBanner("저장하지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
    }
  });
}


// ===================================================================
// (J) 목록: 재고 / 판매됨 / 휴지통 + 검색 / 분류 / 기간 / 페이지네이션
// ===================================================================

let listState = {
  search: "",        // 품목명 검색어
  category: "all",   // all / gold / silver / other
  startDate: "",     // 시작일
  endDate: "",       // 종료일
  offset: 0,         // "더 보기" 로 20씩 증가
  view: "stock",     // stock(재고) / sold(판매됨) / trash(휴지통)
};

// 재고 카드에서 [판매]를 누를 때 쓰려고, 방금 그린 카드의 품목명·매입가를 기억해 둡니다.
// (id → {name, purchase_price})
let cardData = {};

// 재고/휴지통(입고 목록)용 쿼리 문자열
function buildListQuery(offset) {
  const p = new URLSearchParams();
  if (listState.search) p.set("q", listState.search);
  if (listState.category !== "all") p.set("category", listState.category);
  if (listState.startDate) p.set("start_date", listState.startDate);
  if (listState.endDate) p.set("end_date", listState.endDate);
  if (listState.view === "trash") p.set("trash", "true");
  if (listState.view === "stock") p.set("status", "in_stock");  // 재고=아직 안 판 것만
  p.set("offset", String(offset));
  return p.toString();
}

// 목록 불러오기 (reset=true 처음부터 / false "더 보기")
async function loadRecords(reset = true) {
  // 판매됨 탭은 출고(outgo) 목록을 따로 불러옵니다.
  if (listState.view === "sold") {
    return loadSoldRecords(reset);
  }

  const token = await getToken();
  const listBox = $("record-list");

  if (reset) {
    listState.offset = 0;
    listBox.innerHTML = "";
    cardData = {};
  }

  try {
    const res = await fetch("/api/intake/list?" + buildListQuery(listState.offset), {
      headers: { Authorization: "Bearer " + token },
    });
    if (!res.ok) {
      if (reset) listBox.innerHTML = "";
      return;
    }

    const data = await res.json();
    const records = data.records || [];

    if (reset && records.length === 0) {
      listBox.innerHTML = emptyMessage();
      $("load-more-btn").hidden = true;
      return;
    }

    // 재고 카드는 [판매] 버튼을 위해 품목명·매입가를 기억해 둡니다.
    records.forEach((rec) => {
      cardData[rec.id] = { name: rec.item_name, purchase_price: rec.purchase_price };
    });

    listBox.insertAdjacentHTML("beforeend", records.map(recordToHtml).join(""));
    listState.offset += records.length;
    $("load-more-btn").hidden = !data.has_more;
  } catch (e) {
    if (reset) listBox.innerHTML = "";
  }
}

// 판매됨(출고) 목록 불러오기
async function loadSoldRecords(reset = true) {
  const token = await getToken();
  const listBox = $("record-list");

  if (reset) {
    listState.offset = 0;
    listBox.innerHTML = "";
  }

  try {
    const res = await fetch("/api/outgo/list?offset=" + listState.offset, {
      headers: { Authorization: "Bearer " + token },
    });
    if (!res.ok) {
      if (reset) listBox.innerHTML = "";
      return;
    }

    const data = await res.json();
    const records = data.records || [];

    if (reset && records.length === 0) {
      listBox.innerHTML = emptyMessage();
      $("load-more-btn").hidden = true;
      return;
    }

    listBox.insertAdjacentHTML("beforeend", records.map(outgoToHtml).join(""));
    listState.offset += records.length;
    $("load-more-btn").hidden = !data.has_more;
  } catch (e) {
    if (reset) listBox.innerHTML = "";
  }
}

// 목록이 비었을 때 안내 (탭마다 문구가 다름)
function emptyMessage() {
  if (listState.view === "sold") {
    return '<p class="empty-text">아직 판매한 물건이 없습니다.</p>';
  }
  if (listState.view === "trash") {
    return '<p class="empty-text">휴지통이 비어 있습니다.</p>';
  }
  const filtered = listState.search || listState.category !== "all"
    || listState.startDate || listState.endDate;
  if (filtered) {
    return '<p class="empty-text">조건에 맞는 재고가 없습니다.</p>';
  }
  return '<p class="empty-text">아직 입고 기록이 없습니다.<br>위 버튼으로 첫 사진을 찍어보세요.</p>';
}

// 재고/휴지통 카드 (입고 기록 하나 → HTML)
function recordToHtml(rec) {
  const deleted = !!rec.deleted_at;

  const img = rec.photo_signed_url
    ? `<img class="thumb" src="${rec.photo_signed_url}" alt="사진" />`
    : `<div class="thumb thumb-empty">사진<br>없음</div>`;

  const name = escapeHtml(rec.item_name || "(이름 없음)");
  const badge = categoryBadge(rec.category);
  // 카드 하위 표시: 업종 설정의 card_fields(예: gold=중량 / luxury=브랜드·상태) + 매입가
  const sub = buildCardSub(rec);
  const date = formatDate(rec.created_at);

  // 재고 탭에서만 카드에 [판매] 버튼을 답니다. (id 는 uuid 라 안전)
  const sellBtn = (listState.view === "stock")
    ? `<button class="card-sell-btn" data-id="${rec.id}">판매</button>`
    : "";

  return `
    <div class="record-item ${deleted ? "deleted" : ""}" data-id="${rec.id}">
      ${img}
      <div class="record-info">
        <div class="record-top">${badge}<span class="record-name">${name}</span></div>
        <div class="record-sub">${sub}</div>
        <div class="record-date">${date}</div>
      </div>
      ${sellBtn}
    </div>`;
}

// 판매됨 카드 (출고 기록 하나 → HTML). 탭하면 그 물건의 상세로 갑니다(intake_id).
function outgoToHtml(rec) {
  const img = rec.photo_signed_url
    ? `<img class="thumb" src="${rec.photo_signed_url}" alt="사진" />`
    : `<div class="thumb thumb-empty">사진<br>없음</div>`;

  const name = escapeHtml(rec.item_name || "(이름 없음)");
  const badge = categoryBadge(rec.category);
  const sale = rec.sale_price != null ? `${formatWon(rec.sale_price)}원` : "";
  const date = formatDate(rec.sold_at);
  const margin = marginSpan(rec.margin);

  return `
    <div class="record-item sold" data-id="${rec.intake_id}">
      ${img}
      <div class="record-info">
        <div class="record-top">${badge}<span class="record-name">${name}</span></div>
        <div class="record-sub">판매 ${sale} ${margin}</div>
        <div class="record-date">${date}</div>
      </div>
    </div>`;
}

// 분류 뱃지 — 색·라벨을 업종 설정에서 가져와 인라인 스타일로 칠합니다. [Phase 5-A]
function categoryBadge(cat) {
  const c = categoryMap[cat];
  const label = c ? c.label : (cat || "");
  const bg = c ? c.color : "#8a8f98";
  const fg = c ? c.text : "#ffffff";
  if (!label) return "";
  return `<span class="badge" style="background:${bg};color:${fg}">${escapeHtml(label)}</span>`;
}

// 목록 카드의 가운데 줄: card_fields 값들 + 매입가 (가운뎃점으로 연결) [Phase 5-A]
function buildCardSub(rec) {
  const parts = [];
  const cardFields = (appConfig && appConfig.card_fields) || [];
  const fieldByKey = {};
  for (const f of (appConfig && appConfig.fields) || []) fieldByKey[f.key] = f;

  for (const key of cardFields) {
    const f = fieldByKey[key];
    if (!f) continue;
    const val = readFieldValue(rec, f);
    if (val == null || val === "") continue;
    let disp;
    if (key === "weight_g") disp = `${val}g`;
    else if (f.type === "select") disp = optionLabel(f, val);
    else disp = String(val);
    parts.push(escapeHtml(disp));
  }
  if (rec.purchase_price != null) parts.push(`${formatWon(rec.purchase_price)}원`);
  return parts.join(" · ");
}

// 마진 숫자 → {색, 글자}. +는 이익(초록), −는 손해(빨강).
function marginParts(margin) {
  if (margin == null) return null;
  const plus = margin >= 0;
  return {
    cls: plus ? "margin-plus" : "margin-minus",
    text: (plus ? "+" : "−") + formatWon(Math.abs(margin)) + "원",
  };
}
function marginSpan(margin) {
  const p = marginParts(margin);
  return p ? `<span class="margin ${p.cls}">${p.text}</span>` : "";
}


// ===================================================================
// (K) 상세 화면
// ===================================================================

let currentDetail = null;   // 지금 상세로 보고 있는 입고 기록
let currentSale = null;     // 그 물건의 판매정보(sold 일 때) — [판매 취소]에 사용

async function openDetail(id) {
  const token = await getToken();
  try {
    const res = await fetch("/api/intake/" + id, {
      headers: { Authorization: "Bearer " + token },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showBanner(err.detail || "기록을 불러오지 못했어요.", "error");
      return;
    }
    const data = await res.json();
    currentDetail = data.record;
    currentSale = data.sale || null;
    renderDetail(data.record, data.history || [], currentSale);
    showScreen("detail");
    window.scrollTo(0, 0);
  } catch (e) {
    showBanner("기록을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
  }
}

function renderDetail(rec, history, sale) {
  const deleted = !!rec.deleted_at;
  const sold = rec.status === "sold";

  // (1) 사진 (탭하면 확대)
  const photo = rec.photo_signed_url
    ? `<img id="detail-photo" class="detail-photo" src="${rec.photo_signed_url}" alt="입고 사진" />`
    : `<div class="detail-photo detail-photo-empty">사진 없음</div>`;

  // (2) 상단 상태 안내
  let topNote = "";
  if (deleted) topNote = `<div class="detail-deleted-note">🗑 삭제된 기록입니다 (휴지통)</div>`;
  else if (sold) topNote = `<div class="detail-sold-note">✔ 판매된 물건입니다</div>`;

  // (3) 필드 표 — 업종 설정의 필드들을 순서대로 보여줍니다. [Phase 5-A]
  const rows = (appConfig && appConfig.fields || []).map((f) => {
    const val = readFieldValue(rec, f);
    let disp;
    if (f.key === "category") disp = escapeHtml(categoryLabel(val) || "-");
    else if (f.key === "purchase_price") disp = val != null ? formatWon(val) + "원" : "-";
    else if (f.key === "weight_g") disp = val != null ? val + "g" : "-";
    else if (f.type === "select") disp = escapeHtml(optionLabel(f, val) || "-");
    else disp = (val == null || val === "") ? "-" : escapeHtml(String(val));
    return [f.label, disp];
  });
  rows.push(["입고 시각", formatDateTime(rec.created_at)]);
  const fieldRows = rows.map(([label, value]) =>
    `<div class="detail-row"><span class="detail-label">${escapeHtml(label)}</span><span class="detail-value">${value}</span></div>`
  ).join("");

  // (4) 판매 정보 (팔린 물건일 때)
  let saleBlock = "";
  if (sold && sale) {
    const margin = (sale.sale_price != null && rec.purchase_price != null)
      ? sale.sale_price - rec.purchase_price : null;
    const mp = marginParts(margin);
    const marginRow = mp
      ? `<div class="detail-row"><span class="detail-label">마진</span><span class="detail-value ${mp.cls}">${mp.text}</span></div>`
      : "";
    saleBlock = `
      <div class="detail-sale">
        <div class="detail-sale-title">판매 정보</div>
        <div class="detail-row"><span class="detail-label">판매가</span><span class="detail-value">${sale.sale_price != null ? formatWon(sale.sale_price) + "원" : "-"}</span></div>
        ${marginRow}
        <div class="detail-row"><span class="detail-label">판매 경로</span><span class="detail-value">${CHANNEL_LABEL[sale.channel] || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">판매 시각</span><span class="detail-value">${formatDateTime(sale.sold_at)}</span></div>
        ${sale.memo ? `<div class="detail-row"><span class="detail-label">판매 메모</span><span class="detail-value">${escapeHtml(sale.memo)}</span></div>` : ""}
      </div>`;
  }

  // (5) 입력 방식 + "AI 결과를 수정함" 표시
  //   - 입력 방식: ai_status 로 "AI 인식" / "AI 실패 후 직접 입력" 구분 (옛 기록은 표시 안 함)
  const methodLabel = aiStatusLabel(rec.ai_status);
  const methodNote = methodLabel
    ? `<div class="detail-method-note">🏷 입력 방식: ${escapeHtml(methodLabel)}</div>`
    : "";
  const aiEdited = rec.ai_was_edited
    ? `<div class="detail-ai-note">✎ AI 인식 결과를 사장님이 직접 수정한 기록입니다.</div>`
    : "";

  // (6) 수정 이력 (접기/펼치기)
  const historyHtml = history.length
    ? history.map(historyToHtml).join("")
    : '<p class="history-empty">기록된 이력이 없습니다.</p>';
  const historyBlock = `
    <details class="history-box">
      <summary class="history-summary">수정 이력 (${history.length})</summary>
      <div class="history-list">${historyHtml}</div>
    </details>`;

  // (7) 하단 버튼 — 상태에 따라 다르게
  let buttons;
  if (deleted) {
    buttons = `<div class="detail-buttons"><button id="detail-restore-btn" class="big-btn">복구</button></div>`;
  } else if (sold) {
    // 정상적으로 판매정보(sale)가 있으면 [판매 취소], 없으면(드문 오류) 안내만.
    buttons = sale
      ? `<div class="detail-buttons"><button id="detail-cancel-sale-btn" class="big-btn danger">판매 취소</button></div>`
      : `<p class="detail-sale-missing">판매 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>`;
  } else {
    buttons = `
      <div class="detail-buttons">
        <button id="detail-sell-btn" class="big-btn sell">판매</button>
        <button id="detail-edit-btn" class="big-btn">수정</button>
        <button id="detail-delete-btn" class="big-btn danger">삭제</button>
      </div>`;
  }

  $("detail-body").innerHTML = `
    ${topNote}
    ${photo}
    ${methodNote}
    ${aiEdited}
    <div class="detail-fields">${fieldRows}</div>
    ${saleBlock}
    ${historyBlock}
    ${buttons}
  `;

  // (8) 방금 그린 사진/버튼에 동작 연결 (onclick 은 덮어쓰기라 중복 걱정 없음)
  const photoEl = $("detail-photo");
  if (photoEl && rec.photo_signed_url) {
    photoEl.onclick = () => openZoom(rec.photo_signed_url);
  }
  if (deleted) {
    $("detail-restore-btn").onclick = handleRestore;
  } else if (sold) {
    if (sale) $("detail-cancel-sale-btn").onclick = () => handleCancelSale(sale.outgo_id);
  } else {
    $("detail-sell-btn").onclick = () => openSaleModal({
      intake_id: rec.id, item_name: rec.item_name, purchase_price: rec.purchase_price,
    });
    $("detail-edit-btn").onclick = openEditModal;
    $("detail-delete-btn").onclick = handleDelete;
  }
}

// 수정 이력 한 줄 → HTML
function historyToHtml(log) {
  const when = formatDateTime(log.created_at);
  let what;
  if (log.action === "create") what = "등록";
  else if (log.action === "delete") what = "삭제 (휴지통으로 이동)";
  else if (log.action === "restore") what = "복구 (휴지통에서 꺼냄)";
  else if (log.action === "update") what = diffFields(log.before_data, log.after_data);
  else what = "변경";
  return `<div class="history-item">
    <span class="history-when">${when}</span>
    <span class="history-what">${what}</span>
  </div>`;
}

// 수정 전/후 값을 비교해 "매입가 620,000원 → 650,000원" 같은 줄로 만듭니다. [Phase 5-A]
//   - before/after 는 DB 전체 행(컬럼 + attributes). 업종 필드 + 상태(status)를 비교합니다.
function diffFields(before, after) {
  if (!before || !after) return "수정";
  const changes = [];
  for (const f of (appConfig && appConfig.fields) || []) {
    const b = readFieldValue(before, f);
    const a = readFieldValue(after, f);
    if (String(b ?? "") === String(a ?? "")) continue;
    changes.push(`${f.label} ${fmtVal(f, b)} → ${fmtVal(f, a)}`);
  }
  // 상태 변화(재고 ↔ 판매됨)도 보여줍니다.
  if (String(before.status ?? "") !== String(after.status ?? "")) {
    changes.push(`상태 ${statusLabel(before.status)} → ${statusLabel(after.status)}`);
  }
  return changes.length ? changes.join("<br>") : "수정";
}

// 이력 표시용: 필드 값을 사람이 읽기 좋게
function fmtVal(field, v) {
  if (v == null || v === "") return "(없음)";
  if (field.key === "category") return escapeHtml(categoryLabel(v));
  if (field.key === "purchase_price") return formatWon(v) + "원";
  if (field.key === "weight_g") return v + "g";
  if (field.type === "select") return escapeHtml(optionLabel(field, v));
  return escapeHtml(String(v));
}


// ---------- 사진 확대 ----------
function openZoom(src) {
  if (!src) return;
  $("zoom-img").src = src;
  $("image-zoom").hidden = false;
}


// ---------- 수정 ----------
function openEditModal() {
  const r = currentDetail;
  if (!r) return;
  // 현재 기록에서 각 필드 값을 모읍니다. (컬럼은 r[key], attributes 필드는 r.attributes[key])
  const values = {};
  for (const f of (appConfig && appConfig.fields) || []) {
    values[f.key] = readFieldValue(r, f);
  }
  renderFieldForm("edit-fields", "ef", values);
  $("edit-modal").hidden = false;
}

function closeEditModal() {
  $("edit-modal").hidden = true;
}

async function handleEditSave() {
  if (!currentDetail) return;
  const token = await getToken();
  if (!token) { showLogin(); return; }

  const fields = readFieldForm("ef");
  if (!fields.item_name) {
    showBanner("품목명을 입력해 주세요.", "error");
    const el = $("ef-item_name");
    if (el) el.focus();
    return;
  }

  const body = { fields: fields };   // ★ 업종 필드들을 한 덩어리로 보냄

  await withBusy($("edit-save-btn"), "저장 중...", async () => {
    try {
      const res = await fetch("/api/intake/" + currentDetail.id, {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showBanner(err.detail || "수정에 실패했어요.", "error");
        return;
      }
      closeEditModal();
      showBanner("✓ 수정되었습니다");
      await openDetail(currentDetail.id);   // 상세 새로고침(이력까지 갱신)
    } catch (e) {
      showBanner("수정하지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
    }
  });
}


// ---------- 삭제 (소프트 삭제) ----------
async function handleDelete() {
  if (!currentDetail) return;
  if (!confirm("정말 삭제할까요?\n기록은 휴지통에 보관됩니다.")) return;

  const token = await getToken();
  await withBusy($("detail-delete-btn"), "삭제 중...", async () => {
    try {
      const res = await fetch("/api/intake/" + currentDetail.id, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showBanner(err.detail || "삭제에 실패했어요.", "error");
        return;
      }
      showBanner("✓ 삭제되었습니다");
      backToList();
    } catch (e) {
      showBanner("삭제하지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
    }
  });
}


// ---------- 복구 ----------
async function handleRestore() {
  if (!currentDetail) return;
  const token = await getToken();
  await withBusy($("detail-restore-btn"), "복구 중...", async () => {
    try {
      const res = await fetch("/api/intake/" + currentDetail.id + "/restore", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showBanner(err.detail || "복구에 실패했어요.", "error");
        return;
      }
      showBanner("✓ 복구되었습니다");
      backToList();
    } catch (e) {
      showBanner("복구하지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
    }
  });
}


// ===================================================================
// (L) 판매 (출고)
// ===================================================================

let saleContext = null;   // 판매 팝업이 다루는 물건 {intake_id, item_name, purchase_price}

// 판매 팝업 열기 (상세의 [판매] 또는 재고 카드의 [판매]에서 호출)
function openSaleModal(ctx) {
  saleContext = ctx;
  const priceText = ctx.purchase_price != null ? formatWon(ctx.purchase_price) + "원" : "모름";
  $("sale-item-info").textContent = `${ctx.item_name || "(이름 없음)"} · 매입가 ${priceText}`;
  $("s-price").value = "";
  $("s-channel").value = "store";
  $("s-memo").value = "";
  updateSaleMargin();
  $("sale-modal").hidden = false;
  $("s-price").focus();
}

// 재고 카드의 [판매] 버튼에서 호출 (기억해 둔 cardData 로 물건 정보 채움)
function openSaleModalFromCard(id) {
  const d = cardData[id] || {};
  openSaleModal({ intake_id: id, item_name: d.name, purchase_price: d.purchase_price });
}


// ===================================================================
// (R) 코드로 판매  [코드 판매 2단계]
//   - 물건 사진을 찍으면 AI가 품목 코드를 읽어, 그 코드의 재고를 찾아 분기합니다.
//     exact(1건)=바로 판매 / code_group(여러 건)=목록에서 선택 / none=재고 없음 / no_code=코드 못 읽음
// ===================================================================
let codeGroupRecords = {};   // 코드 재고 목록 임시 보관 (id → 기록)

async function handleSaleByCode(event) {
  const file = event.target.files[0];
  if (!file) return;
  const token = await getToken();
  if (!token) { showLogin(); return; }

  const formData = new FormData();
  formData.append("photo", file);
  $("loading-overlay").hidden = false;
  try {
    const res = await fetch("/api/outgo/lookup-by-code", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showBanner(err.detail || "코드로 재고를 찾지 못했어요.", "error");
      return;
    }
    handleCodeLookupResult(await res.json());
  } catch (e) {
    showBanner("사진을 보내지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
  } finally {
    $("loading-overlay").hidden = true;
    event.target.value = "";
  }
}

// lookup 결과(mode)에 따라 분기
function handleCodeLookupResult(r) {
  if (r.mode === "no_code") {
    showBanner("사진에서 코드를 읽지 못했어요. 코드가 잘 보이게 다시 찍어 주세요.", "error");
    return;
  }
  if (r.mode === "none") {
    let msg = `코드 ${r.code} 재고 없음`;
    if (r.sold_exists) msg += " · 최근 같은 코드가 판매된 적이 있어요";
    showBanner(msg, "error");
    return;
  }
  if (r.mode === "exact") {
    const rec = r.records[0];
    openSaleModal({ intake_id: rec.id, item_name: rec.item_name, purchase_price: rec.purchase_price });
    return;
  }
  if (r.mode === "code_group") {
    openCodeGroupModal(r.code, r.records);
  }
}

// 같은 코드 재고 여러 건 → 목록에서 고르기 (백엔드가 이미 오래된 순 정렬, 맨 위가 기본 추천)
function openCodeGroupModal(code, records) {
  $("code-group-sub").textContent = `코드 ${code} · 재고 ${records.length}건 (오래된 입고부터)`;
  codeGroupRecords = {};
  records.forEach((rec) => { codeGroupRecords[rec.id] = rec; });

  $("code-group-list").innerHTML = records.map((rec, i) => {
    const img = rec.photo_signed_url
      ? `<img class="cg-thumb" src="${rec.photo_signed_url}" alt="사진" />`
      : `<div class="cg-thumb cg-thumb-empty">사진<br>없음</div>`;
    const w = rec.weight_g != null ? `${rec.weight_g}g` : "";
    const p = rec.purchase_price != null ? `매입 ${formatWon(rec.purchase_price)}원` : "매입 모름";
    const sub = [formatDate(rec.created_at), w, p].filter(Boolean).join(" · ");
    // 맨 위(가장 오래된 입고)는 '추천'으로 제안하되, 아무거나 탭해서 고를 수 있음(강제 아님)
    const recommend = i === 0 ? `<span class="cg-recommend">추천</span>` : "";
    return `
      <button type="button" class="cg-item${i === 0 ? " cg-default" : ""}" data-id="${escapeAttr(rec.id)}">
        ${img}
        <div class="cg-info">
          <div class="cg-top">${escapeHtml(rec.item_name || "(이름 없음)")}${recommend}</div>
          <div class="cg-sub">${escapeHtml(sub)}</div>
        </div>
      </button>`;
  }).join("");
  $("code-group-modal").hidden = false;
}

function closeCodeGroupModal() { $("code-group-modal").hidden = true; }

// 판매가를 입력할 때마다 "예상 마진 = 판매가 − 매입가"를 실시간 표시
function updateSaleMargin() {
  const el = $("sale-margin");
  const priceText = $("s-price").value.trim();
  const purchase = saleContext ? saleContext.purchase_price : null;

  if (priceText === "" || purchase == null) {
    // 판매가가 없거나 매입가를 모르면 마진 표시를 비웁니다.
    el.textContent = purchase == null ? "" : "";
    el.className = "sale-margin";
    return;
  }
  const price = Number(priceText);
  if (isNaN(price)) {
    el.textContent = "";
    el.className = "sale-margin";
    return;
  }
  const margin = price - purchase;
  const mp = marginParts(margin);
  el.textContent = "예상 마진 " + mp.text;
  el.className = "sale-margin " + mp.cls;
}

async function handleSaleConfirm() {
  if (!saleContext) return;
  const token = await getToken();
  if (!token) { showLogin(); return; }

  const priceText = $("s-price").value.trim();
  const price = Number(priceText);
  if (priceText === "" || isNaN(price) || price <= 0) {
    showBanner("판매가를 올바르게 입력해 주세요.", "error");
    $("s-price").focus();
    return;
  }

  const body = {
    intake_id: saleContext.intake_id,
    sale_price: price,
    channel: $("s-channel").value,
    memo: $("s-memo").value.trim() || null,
  };

  await withBusy($("sale-confirm-btn"), "판매 중...", async () => {
    try {
      const res = await fetch("/api/outgo/confirm", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showBanner(err.detail || "판매 처리에 실패했어요.", "error");
        return;
      }
      $("sale-modal").hidden = true;
      showBanner("✓ 판매 처리되었습니다");
      // 상세에서 판 경우엔 목록으로 돌아가고, 목록 카드에서 판 경우엔 목록만 새로고침.
      if (!$("detail-screen").hidden) {
        backToList();
      } else {
        loadRecords(true);
      }
    } catch (e) {
      showBanner("판매하지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
    }
  });
}

// 판매 취소 (상세의 [판매 취소])
async function handleCancelSale(outgoId) {
  if (!outgoId) return;
  if (!confirm("판매를 취소할까요?\n이 물건은 다시 재고로 돌아갑니다.")) return;

  const token = await getToken();
  await withBusy($("detail-cancel-sale-btn"), "취소 중...", async () => {
    try {
      const res = await fetch("/api/outgo/" + outgoId + "/cancel", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showBanner(err.detail || "판매 취소에 실패했어요.", "error");
        return;
      }
      showBanner("✓ 판매가 취소되었습니다");
      backToList();
    } catch (e) {
      showBanner("판매 취소하지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
    }
  });
}


// ===================================================================
// (M) 목록으로 돌아가기 / 탭 전환
// ===================================================================

function backToList() {
  currentDetail = null;
  currentSale = null;
  showScreen("main");
  loadRecords(true);
}

// 신규 입고 저장 후에는 '재고' 탭으로 맞춰 새로고침
function resetToStockList() {
  if (listState.view !== "stock") {
    listState.view = "stock";
    updateViewUI();
  }
  loadRecords(true);
}

// 세그먼트(재고/판매됨/휴지통) 화면 상태 갱신
function updateViewUI() {
  document.querySelectorAll(".seg-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === listState.view);
  });
  // 판매됨 탭에는 검색/분류/기간 필터를 숨깁니다. (출고 목록엔 안 붙음)
  $("list-controls").hidden = (listState.view === "sold");
}


// ===================================================================
// (N) 작은 도우미들
// ===================================================================

function formatWon(n) {
  return Number(n).toLocaleString("ko-KR");
}

function formatDate(iso) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function formatDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 16).replace("T", " ");
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}


// ===================================================================
// (O) 버튼/입력에 동작 연결 + 시작
// ===================================================================

// --- 로그인 / 로그아웃 / 사진 ---
$("login-btn").addEventListener("click", handleLogin);
$("logout-btn").addEventListener("click", handleLogout);

// [3업종군 플랫폼] 업종군 선택 화면 / 준비 중 화면 배선
$("family-select-screen").addEventListener("click", (e) => {
  const card = e.target.closest(".family-card");
  if (card) pickFamily(card.dataset.family);
});
$("fs-logout-btn").addEventListener("click", handleLogout);
$("cs-back-btn").addEventListener("click", backToFamilySelect);
$("cs-logout-btn").addEventListener("click", handleLogout);

// [회원형 2탄] 회원 화면 배선
$("member-logout-btn").addEventListener("click", handleLogout);
$("member-add-btn").addEventListener("click", () => openMemberForm("add"));
$("member-search").addEventListener("input", (e) => { memberState.q = e.target.value.trim(); loadMembers(true); });
$("member-load-more").addEventListener("click", () => loadMembers(false));
$("member-back-btn").addEventListener("click", () => showMemberMain());
$("member-list").addEventListener("click", (e) => {
  const card = e.target.closest(".record-item");
  if (card) openMemberDetail(card.dataset.id);
});
document.querySelectorAll("#member-view-segment .seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (memberState.view === btn.dataset.mview) return;
    memberState.view = btn.dataset.mview;
    document.querySelectorAll("#member-view-segment .seg-btn").forEach((b) => b.classList.toggle("active", b === btn));
    loadMembers(true);
  });
});
$("member-photo-btn").addEventListener("click", () => $("member-photo-input").click());
$("member-photo-input").addEventListener("change", handleMemberPhotoPick);
$("member-save-btn").addEventListener("click", handleMemberSave);
$("member-cancel-btn").addEventListener("click", closeMemberModal);
// 회원 상세 안 '회원권 취소' 버튼 (상세 내용은 다시 그려지므로 상위에 위임)
$("member-detail-body").addEventListener("click", (e) => {
  const btn = e.target.closest(".ms-cancel-btn");
  if (btn) handleMembershipCancel(btn.dataset.id);
});

// [회원형 2-2] 회원권 상품 관리 + 판매 배선
$("plan-manage-btn").addEventListener("click", openPlanManage);
$("plan-back-btn").addEventListener("click", () => showScreen("member-main"));
$("plan-add-btn").addEventListener("click", () => openPlanModal("add"));
$("plan-cancel-btn").addEventListener("click", closePlanModal);
$("plan-save-btn").addEventListener("click", handlePlanSave);
$("p-kind").addEventListener("change", planKindToggle);
$("plan-list").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  if (btn.dataset.act === "edit") {
    const p = plansCache.find((x) => x.id === btn.dataset.id);
    if (p) openPlanModal("edit", p);
  } else if (btn.dataset.act === "hide") {
    handlePlanHide(btn.dataset.id);
  }
});
$("ms-cancel-btn").addEventListener("click", () => { $("ms-sale-modal").hidden = true; });
$("ms-confirm-btn").addEventListener("click", handleMembershipSale);
$("ms-plan").addEventListener("change", handleMsPlanChange);

// [회원형 2-3] 출석 체크 배선
$("attendance-btn").addEventListener("click", showAttendance);
$("att-back-btn").addEventListener("click", () => showScreen("member-main"));
$("att-search").addEventListener("input", (e) => { attQ = e.target.value.trim(); loadAttendance(); });
$("att-list").addEventListener("click", (e) => {
  const chk = e.target.closest(".att-check-btn");
  if (chk) { handleCheckIn(chk.dataset.mid); return; }
  const cnl = e.target.closest(".att-cancel-btn");
  if (cnl) { handleCheckCancel(cnl.dataset.id); return; }
});
// 사진 찍기(카메라) / 사진 올리기(앨범·파일) — 각자의 숨은 입력칸을 엽니다.
$("take-photo-btn").addEventListener("click", () => $("photo-input").click());
$("upload-photo-btn").addEventListener("click", () => $("upload-input").click());
// 두 입력칸 모두 같은 처리(handlePhotoSelected)로 이어집니다.
$("photo-input").addEventListener("change", handlePhotoSelected);
$("upload-input").addEventListener("change", handlePhotoSelected);

// [입고 최종판] 사진 인식 실패 시 이어가기 버튼 2개
$("retake-btn").addEventListener("click", handleRetake);
$("manual-entry-btn").addEventListener("click", handleManualEntry);

// [입고 최종판] 정산 탭 '실패 기록'의 버튼(직접 입력하기 / 기록 보기)을 위임으로 처리
$("failures-list").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "manual") {
    openManualEntry(btn.dataset.photo, btn.dataset.failure);   // 사진 유지한 채 확인 팝업
  } else if (btn.dataset.action === "detail") {
    openDetail(btn.dataset.intake);                            // 연결된 입고 상세로
  }
});

// [분류 사용자 정의] 분류 관리 화면 배선
$("categories-btn").addEventListener("click", openCategoriesScreen);   // 헤더 ⚙️
$("cat-back-btn").addEventListener("click", () => { showScreen("main"); loadRecords(true); }); // 뒤로가며 목록 새로고침(뱃지 반영)
$("cat-add-btn").addEventListener("click", () => openCatModal("add"));
$("cat-cancel-btn").addEventListener("click", closeCatModal);
$("cat-save-btn").addEventListener("click", handleCatSave);

// 팝업의 색 스와치 선택 (위임)
$("cat-color-row").addEventListener("click", (e) => {
  const sw = e.target.closest("[data-color]");
  if (!sw) return;
  catPickedColor = sw.dataset.color;
  renderColorSwatches();
});

// 목록의 버튼(정렬/수정/숨기기)을 위임으로 처리
$("cat-list").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.move) { handleCatMove(id, btn.dataset.move); return; }
  if (btn.dataset.act === "edit") {
    const cat = catList.find((c) => c.id === id);
    if (cat) openCatModal("edit", cat);
  } else if (btn.dataset.act === "hide") {
    handleCatHide(id);
  }
});

// --- 확인 팝업(신규 저장) ---
$("save-btn").addEventListener("click", handleSave);
$("cancel-btn").addEventListener("click", closeConfirmModal);

// --- 수정 팝업 ---
$("edit-save-btn").addEventListener("click", handleEditSave);
$("edit-cancel-btn").addEventListener("click", closeEditModal);

// --- 판매 팝업 ---
$("sale-confirm-btn").addEventListener("click", handleSaleConfirm);
$("sale-cancel-btn").addEventListener("click", () => { $("sale-modal").hidden = true; });
$("s-price").addEventListener("input", updateSaleMargin);

// --- [코드 판매] 코드로 판매 ---
$("sale-by-code-btn").addEventListener("click", () => $("code-photo-input").click());
$("code-photo-input").addEventListener("change", handleSaleByCode);
$("code-group-cancel-btn").addEventListener("click", closeCodeGroupModal);
// 코드 재고 목록에서 하나 탭 → 그 물건으로 판매 팝업
$("code-group-list").addEventListener("click", (e) => {
  const btn = e.target.closest(".cg-item");
  if (!btn) return;
  const rec = codeGroupRecords[btn.dataset.id];
  if (!rec) return;
  closeCodeGroupModal();
  openSaleModal({ intake_id: rec.id, item_name: rec.item_name, purchase_price: rec.purchase_price });
});

// --- 사진 확대: 아무 곳이나 탭하면 닫힘 ---
$("image-zoom").addEventListener("click", () => { $("image-zoom").hidden = true; });

// --- 상세 화면 뒤로 ---
$("detail-back-btn").addEventListener("click", backToList);

// --- 목록 카드 탭 → 상세 / 카드의 [판매] 버튼 (이벤트 위임) ---
$("record-list").addEventListener("click", (e) => {
  // 카드 안의 [판매] 버튼을 먼저 확인 (상세로 안 넘어가게 막음)
  const sellBtn = e.target.closest(".card-sell-btn");
  if (sellBtn) {
    e.stopPropagation();
    openSaleModalFromCard(sellBtn.dataset.id);
    return;
  }
  const item = e.target.closest(".record-item");
  if (!item) return;
  openDetail(item.dataset.id);
});

// --- 검색창: 0.3초 기다렸다 검색 (타이핑마다 요청 안 하게) ---
let searchTimer = null;
$("search-input").addEventListener("input", (e) => {
  listState.search = e.target.value.trim();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadRecords(true), 300);
});

// --- 분류 필터 버튼 (버튼이 설정으로 동적 생성되므로 이벤트 위임) ---
$("filter-row").addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-btn");
  if (!btn) return;
  $("filter-row").querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  listState.category = btn.dataset.cat;
  loadRecords(true);
});

// --- 기간 선택 ---
$("start-date").addEventListener("change", (e) => {
  listState.startDate = e.target.value;
  loadRecords(true);
});
$("end-date").addEventListener("change", (e) => {
  listState.endDate = e.target.value;
  loadRecords(true);
});

// --- "더 보기" ---
$("load-more-btn").addEventListener("click", () => loadRecords(false));

// --- 재고 / 판매됨 / 휴지통 세그먼트 ---
document.querySelectorAll(".seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (listState.view === btn.dataset.view) return;
    listState.view = btn.dataset.view;
    updateViewUI();
    loadRecords(true);
  });
});

// --- 비밀번호칸 Enter 로 로그인 ---
$("password").addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleLogin();
});


// ===================================================================
// (P) 정산 (리포트)  [Phase 3]
// ===================================================================

// 정산 조건. period 는 이번달/지난달/최근7일/직접, computed* 는 실제 계산된 기간.
let reportState = {
  period: "this_month",
  start: "",          // 직접 선택 시작일
  end: "",            // 직접 선택 종료일
  computedStart: "",  // 실제 조회에 쓴 기간 (엑셀에도 사용)
  computedEnd: "",
};

// Chart.js 그래프 객체(다시 그릴 때 이전 것을 지워야 해서 보관)
let dailyChart = null;
let categoryChart = null;

// 날짜를 'YYYY-MM-DD' 로 (브라우저 로컬 = 사장님은 한국시간)
function fmtDate(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 선택한 기간(period)을 실제 시작일~종료일로 계산합니다.
function computePeriod() {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();   // 0~11
  let start, end;

  if (reportState.period === "this_month") {
    start = new Date(y, m, 1);
    end = new Date(y, m + 1, 0);         // 이번 달 마지막 날
  } else if (reportState.period === "last_month") {
    start = new Date(y, m - 1, 1);
    end = new Date(y, m, 0);             // 지난 달 마지막 날
  } else if (reportState.period === "last7") {
    end = new Date(y, m, today.getDate());
    start = new Date(y, m, today.getDate() - 6);  // 오늘 포함 7일
  } else {  // custom(직접 선택)
    if (reportState.start && reportState.end) {
      return { start: reportState.start, end: reportState.end };
    }
    // 아직 직접 날짜를 안 골랐으면 이번 달로 대신 보여줍니다.
    start = new Date(y, m, 1);
    end = new Date(y, m + 1, 0);
  }
  return { start: fmtDate(start), end: fmtDate(end) };
}

// 정산 화면 전체 불러오기 (요약·그래프·비용을 한 번에)
async function loadReport() {
  const { start, end } = computePeriod();
  reportState.computedStart = start;
  reportState.computedEnd = end;
  $("period-label").textContent = `${start} ~ ${end}`;

  const token = await getToken();
  const h = { Authorization: "Bearer " + token };
  const q = `start=${start}&end=${end}`;

  try {
    // 5가지를 동시에 요청해서 빠르게 채웁니다.
    const [sumRes, dailyRes, heatRes, catRes, expRes] = await Promise.all([
      fetch(`/api/report/summary?${q}`, { headers: h }),
      fetch(`/api/report/daily?${q}`, { headers: h }),
      fetch(`/api/report/heatmap?${q}`, { headers: h }),
      fetch(`/api/report/category?${q}`, { headers: h }),
      fetch(`/api/expenses?${q}`, { headers: h }),
    ]);
    if (sumRes.ok) renderSummary(await sumRes.json());
    if (dailyRes.ok) renderDailyChart(await dailyRes.json());
    if (heatRes.ok) renderHeatmap(await heatRes.json());
    if (catRes.ok) renderCategoryChart(await catRes.json());
    if (expRes.ok) renderExpenses((await expRes.json()).records || []);
  } catch (e) {
    showBanner("정산 정보를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
  }

  // AI 인식 실패 기록도 함께 새로고침 (정산 화면 하단 접기 영역). [입고 최종판]
  loadAiFailures();
}


// ----- AI 인식 실패 기록 (정산 탭 하단) [입고 최종판] -----
//   실패했지만 안 버린 사진들을 보여주고, 거기서 '직접 입력'으로 이어가거나
//   이미 해결된 건 그 입고 상세로 갈 수 있게 합니다.
async function loadAiFailures() {
  const token = await getToken();
  try {
    const res = await fetch("/api/ai-failures", { headers: { Authorization: "Bearer " + token } });
    if (!res.ok) return;
    const data = await res.json();
    renderAiFailures(data.failures || []);
  } catch (e) {
    // 실패 목록을 못 불러와도 정산 화면은 계속 씁니다 (조용히 넘어감).
  }
}

function renderAiFailures(list) {
  const box = $("failures-list");
  // 요약: (미해결 N / 전체 M)
  const unresolved = list.filter((f) => !f.resolved).length;
  $("failures-count").textContent = list.length ? `(미해결 ${unresolved} / 전체 ${list.length})` : "(없음)";

  if (!list.length) {
    box.innerHTML = `<p class="failures-empty">AI 인식에 실패한 사진이 없습니다.</p>`;
    return;
  }

  box.innerHTML = list.map((f) => {
    const img = f.photo_signed_url
      ? `<img class="failure-thumb" src="${f.photo_signed_url}" alt="실패 사진" />`
      : `<div class="failure-thumb failure-thumb-empty">사진</div>`;
    const when = formatDateTime(f.created_at);
    // 미해결 → [직접 입력하기](사진 유지한 팝업) / 해결됨 → [기록 보기](연결된 입고 상세)
    const btn = f.resolved
      ? `<button class="small-btn" data-action="detail" data-intake="${escapeAttr(f.resolved_intake_id)}">기록 보기</button>`
      : `<button class="small-btn" data-action="manual" data-photo="${escapeAttr(f.photo_url)}" data-failure="${escapeAttr(f.id)}">직접 입력하기</button>`;
    const badge = f.resolved
      ? `<span class="failure-state resolved">해결됨</span>`
      : `<span class="failure-state unresolved">미해결</span>`;
    return `
      <div class="failure-item">
        ${img}
        <div class="failure-info">
          <div class="failure-top">${badge}<span class="failure-when">${escapeHtml(when)}</span></div>
        </div>
        ${btn}
      </div>`;
  }).join("");
}

// ----- 요약 카드 4개 -----
function renderSummary(data) {
  $("sum-revenue").textContent = formatWon(data.revenue) + "원";
  $("sum-margin").textContent = formatWon(data.margin) + "원";
  $("sum-expense").textContent = formatWon(data.expense) + "원";

  // 순이익은 색으로 강조 (+ 초록 / − 빨강)
  const netEl = $("sum-net");
  netEl.textContent = formatWon(data.net) + "원";
  netEl.className = "summary-value big " + (data.net >= 0 ? "margin-plus" : "margin-minus");

  // 각 카드의 전(前)기간 대비 증감
  const chg = data.change || {};
  renderChange($("chg-revenue"), chg.revenue);
  renderChange($("chg-margin"), chg.margin);
  renderChange($("chg-expense"), chg.expense);
  renderChange($("chg-net"), chg.net);
}

// 증감(▲▼ 퍼센트) 표시. 지난 값이 0이면(비교 불가) '—'.
function renderChange(el, pct) {
  if (pct == null) {
    el.textContent = "— 지난 기간 대비";
    el.className = "summary-change";
    return;
  }
  const up = pct >= 0;
  el.textContent = (up ? "▲ " : "▼ ") + Math.abs(pct) + "%";
  el.className = "summary-change " + (up ? "chg-up" : "chg-down");
}

// ----- 일별 매출·순이익 (선그래프) -----
function renderDailyChart(data) {
  const days = data.days || [];
  const labels = days.map((d) => d.date.slice(5));   // MM-DD
  const revenue = days.map((d) => d.revenue);
  const net = days.map((d) => d.net);

  if (dailyChart) dailyChart.destroy();   // 이전 그래프 지우기
  dailyChart = new Chart($("chart-daily"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "매출", data: revenue, borderColor: "#c9a227",
          backgroundColor: "rgba(201,162,39,0.15)", tension: 0.3, fill: true },
        { label: "순이익", data: net, borderColor: "#1a2744",
          backgroundColor: "rgba(26,39,68,0.08)", tension: 0.3, fill: true },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: { y: { ticks: { callback: (v) => Number(v).toLocaleString("ko-KR") } } },
    },
  });
}

// ----- 분류별 매출 (도넛) -----
function renderCategoryChart(data) {
  const items = data.items || [];
  const labels = items.map((i) => i.label);
  const values = items.map((i) => i.revenue);
  const total = values.reduce((a, b) => a + b, 0);

  // 판매가 하나도 없으면 도넛 대신 안내 문구
  $("chart-empty").hidden = total > 0;
  const wrap = $("chart-category").parentElement;
  wrap.hidden = total === 0;

  if (categoryChart) categoryChart.destroy();
  if (total === 0) return;

  // 색도 업종 설정에서 옵니다(백엔드 category 응답의 color). [Phase 5-A]
  const colors = items.map((i) => i.color || "#8a8f98");
  categoryChart = new Chart($("chart-category"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${Number(ctx.parsed).toLocaleString("ko-KR")}원`,
          },
        },
      },
    },
  });
}

// ----- 요일 × 시간대 히트맵 (CSS 그리드 + 색 농도) -----
const HM_DOWS = ["월", "화", "수", "목", "금", "토", "일"];
const HM_HOURS = ["0", "3", "6", "9", "12", "15", "18", "21"];

function renderHeatmap(data) {
  const matrix = data.matrix || [];
  const max = data.max || 0;

  let html = '<div class="hm-grid">';
  html += '<div class="hm-corner"></div>';                       // 왼쪽 위 빈칸
  HM_HOURS.forEach((hr) => { html += `<div class="hm-col-label">${hr}시</div>`; });

  for (let dow = 0; dow < 7; dow++) {
    html += `<div class="hm-row-label">${HM_DOWS[dow]}</div>`;
    for (let b = 0; b < 8; b++) {
      const c = (matrix[dow] && matrix[dow][b]) || 0;
      const t = max > 0 ? c / max : 0;
      const label = `${HM_DOWS[dow]} ${HM_HOURS[b]}시대 · ${c}건`;
      html += `<div class="hm-cell" style="background:${heatColor(t)}" title="${label}">${c > 0 ? c : ""}</div>`;
    }
  }
  html += "</div>";
  $("heatmap").innerHTML = html;
}

// 0~1 농도 → 금색 배경색 (0이면 옅은 회색)
function heatColor(t) {
  if (t <= 0) return "#f1f1f1";
  const a = (0.15 + t * 0.85).toFixed(2);   // 최소 0.15 ~ 최대 1.0
  return `rgba(201,162,39,${a})`;
}

// ----- 비용 목록 -----
function renderExpenses(records) {
  const box = $("expense-list");
  if (!records.length) {
    box.innerHTML = '<p class="empty-text small">이 기간에 등록된 비용이 없습니다.</p>';
    return;
  }
  box.innerHTML = records.map(expenseToHtml).join("");
}

function expenseToHtml(e) {
  return `
    <div class="expense-item">
      <div class="expense-main">
        <span class="expense-name">${escapeHtml(e.name || "-")}</span>
        <span class="expense-date">${e.spent_at || ""}</span>
      </div>
      <span class="expense-amount">${formatWon(e.amount || 0)}원</span>
      <button class="expense-del" data-id="${e.id}">삭제</button>
    </div>`;
}


// ----- 비용 추가 팝업 -----
function openExpenseModal() {
  $("x-name").value = "";
  $("x-amount").value = "";
  $("x-date").value = fmtDate(new Date());   // 기본 오늘(한국시간)
  $("x-memo").value = "";
  $("expense-modal").hidden = false;
  $("x-name").focus();
}

function closeExpenseModal() {
  $("expense-modal").hidden = true;
}

async function handleExpenseAdd() {
  const token = await getToken();
  if (!token) { showLogin(); return; }

  const name = $("x-name").value.trim();
  if (!name) {
    showBanner("비용 이름을 입력해 주세요.", "error");
    $("x-name").focus();
    return;
  }
  const amountText = $("x-amount").value.trim();
  const amount = Number(amountText);
  if (amountText === "" || isNaN(amount) || amount <= 0) {
    showBanner("금액을 올바르게 입력해 주세요.", "error");
    $("x-amount").focus();
    return;
  }

  const body = {
    name: name,
    amount: amount,
    spent_at: $("x-date").value || null,   // 비었으면 서버가 오늘로
    memo: $("x-memo").value.trim() || null,
  };

  await withBusy($("expense-add-btn"), "추가 중...", async () => {
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showBanner(err.detail || "비용 저장에 실패했어요.", "error");
        return;
      }
      closeExpenseModal();
      showBanner("✓ 비용이 추가되었습니다");
      loadReport();   // 요약·그래프·목록 새로고침
    } catch (e) {
      showBanner("비용을 저장하지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
    }
  });
}

// 비용 삭제 (실삭제 — 감사로그에 남습니다)
async function handleExpenseDelete(id) {
  if (!id) return;
  if (!confirm("이 비용을 삭제할까요?")) return;

  const token = await getToken();
  try {
    const res = await fetch("/api/expenses/" + id, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showBanner(err.detail || "비용 삭제에 실패했어요.", "error");
      return;
    }
    showBanner("✓ 비용이 삭제되었습니다");
    loadReport();
  } catch (e) {
    showBanner("비용을 삭제하지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
  }
}


// ----- 엑셀 내보내기 -----
async function handleExcel() {
  const s = reportState.computedStart;
  const e = reportState.computedEnd;
  if (!s || !e) return;

  const token = await getToken();
  await withBusy($("excel-btn"), "내보내는 중...", async () => {
    try {
      const res = await fetch(`/api/report/excel?start=${s}&end=${e}`, {
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showBanner(err.detail || "엑셀 내보내기에 실패했어요.", "error");
        return;
      }
      // 파일(blob)을 받아 다운로드를 일으킵니다.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `정산_${s}_${e}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showBanner("✓ 엑셀을 내려받았습니다");
    } catch (e) {
      showBanner("엑셀을 내보내지 못했어요. 인터넷 연결을 확인해 주세요.", "error");
    }
  });
}


// ===================================================================
// (Q) 하단 탭 / 정산 화면의 버튼·입력 연결
// ===================================================================

// --- 하단 탭 [입고 | 정산] ---
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.tab === "report") {
      showScreen("report");
      loadReport();
    } else {
      showScreen("main");
      loadRecords(true);
    }
  });
});

// --- 기간 선택 버튼 ---
document.querySelectorAll(".period-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".period-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    reportState.period = btn.dataset.period;
    $("custom-period").hidden = (reportState.period !== "custom");
    // 직접 선택은 두 날짜를 다 고른 뒤에 조회, 나머지는 즉시 조회
    if (reportState.period !== "custom") loadReport();
  });
});
$("report-start").addEventListener("change", (e) => {
  reportState.start = e.target.value;
  if (reportState.period === "custom" && reportState.start && reportState.end) loadReport();
});
$("report-end").addEventListener("change", (e) => {
  reportState.end = e.target.value;
  if (reportState.period === "custom" && reportState.start && reportState.end) loadReport();
});

// --- 비용 추가 / 삭제 / 엑셀 ---
$("add-expense-btn").addEventListener("click", openExpenseModal);
$("expense-add-btn").addEventListener("click", handleExpenseAdd);
$("expense-cancel-btn").addEventListener("click", closeExpenseModal);
$("excel-btn").addEventListener("click", handleExcel);

// 비용 목록의 [삭제] (이벤트 위임)
$("expense-list").addEventListener("click", (e) => {
  const del = e.target.closest(".expense-del");
  if (del) handleExpenseDelete(del.dataset.id);
});


init();   // 프로그램 시작!
