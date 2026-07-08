import csv, math, os, random

# ==================================================================
# 현실적인 강화학습 예제: Q-learning 매매 에이전트
#
#   "최근 시세를 보고 → 사거나/팔거나/관망하며 → 수익을 극대화" 하는 법을
#   에이전트가 과거 데이터로 스스로 배운다.
#
# 현실 프로젝트에서 꼭 필요한 4가지를 모두 넣음:
#   ① 실제 데이터 사용 (CSV 있으면 읽고, 없으면 현실적인 가격을 생성)
#   ② 거래 수수료(비용) 반영
#   ③ 학습/검증 구간 분리 → '처음 보는 미래'에서 백테스트 (과적합 방지)
#   ④ '단순 보유(Buy & Hold)' 벤치마크와 정직하게 비교
# ==================================================================

# ------------------------------------------------------------------
# 0) 설정값 (하이퍼파라미터 & 시장 설정)
# ------------------------------------------------------------------
CSV_PATH      = "prices.csv"   # 이 파일이 있으면 실제 데이터로 학습 (없으면 자동 생성)
FEE           = 0.0005         # 거래 수수료 0.05% (매수/매도할 때마다 차감)
TRAIN_RATIO   = 0.7            # 앞 70%로 학습, 뒤 30%는 '처음 보는 미래'로 검증
MOMENTUM_LOOKBACK = 5          # 며칠 전 대비 수익률(모멘텀)을 볼지
MA_WINDOW     = 10             # 이동평균선 기간

ALPHA         = 0.1            # 학습률
GAMMA         = 0.95           # 감가율 (미래 수익을 얼마나 중시할지)
EPISODES      = 300            # 과거 데이터를 몇 번 반복해서 복습할지
EPS_START     = 1.0           # 처음엔 100% 탐험(무작위)
EPS_END       = 0.05          # 나중엔 5%만 탐험

ACTIONS = ['관망', '매수', '매도']   # 0=관망(유지), 1=매수, 2=매도
rng = random.Random(42)

# ------------------------------------------------------------------
# 1) 데이터 준비 : 실제 CSV 로드 or 현실적인 가격 데이터 생성
# ------------------------------------------------------------------
def load_prices(path):
    """CSV의 종가(close) 열을 읽어 가격 리스트로 반환.
    실제로는 야후 파이낸스/업비트/바이낸스에서 받은 CSV를 여기 넣으면 됨.
    형식: 헤더에 'close' 또는 'Close' 열이 있거나, 숫자 한 열만 있어도 됨."""
    prices = []
    with open(path, newline='') as f:
        reader = csv.reader(f)
        rows = list(reader)
    header = rows[0]
    # 'close' 열 위치 찾기 (없으면 마지막 열을 종가로 간주)
    idx = None
    for i, name in enumerate(header):
        if name.strip().lower() in ('close', 'adj close', '종가'):
            idx = i; break
    start = 1 if any(c.strip().replace('.', '').replace('-', '').isalpha() for c in header) else 0
    if idx is None: idx = -1
    for row in rows[start:]:
        if not row: continue
        try: prices.append(float(row[idx]))
        except (ValueError, IndexError): continue
    return prices

def make_realistic_prices(n=1200, start=100.0):
    """실제 CSV가 없을 때 쓰는 '현실적인' 가짜 가격 데이터.
    기하 브라운 운동 + 가끔 추세 전환(상승장/하락장) → 실제 차트처럼 오르내림."""
    prices = [start]
    drift, vol = 0.0004, 0.02      # 하루 평균 상승률, 변동성
    for t in range(1, n):
        if rng.random() < 0.01:    # 1% 확률로 시장 국면(상승/하락 추세) 전환
            drift = rng.choice([0.0010, 0.0004, -0.0006])
        shock = rng.gauss(0, 1)
        prices.append(prices[-1] * math.exp(drift - 0.5*vol*vol + vol*shock))
    return prices

if os.path.exists(CSV_PATH):
    prices = load_prices(CSV_PATH)
    source = f"실제 데이터 ({CSV_PATH}, {len(prices)}일치)"
else:
    prices = make_realistic_prices()
    source = f"자동 생성한 현실적 데이터 ({len(prices)}일치)  ※ prices.csv를 넣으면 실제 데이터로 학습"

# 일간 수익률 (t → t+1 가격 변화율). 강화학습의 실제 '이익/손해'의 원천.
returns = [prices[t+1] / prices[t] - 1 for t in range(len(prices) - 1)]

# ------------------------------------------------------------------
# 2) 상태(State) 만들기 : 연속적인 시세를 '이산 상태'로 변환
#    Q-learning은 상태를 칸으로 나눠야 하므로 특징을 구간(bucket)으로 나눔.
# ------------------------------------------------------------------
def momentum_bucket(t):
    """최근 MOMENTUM_LOOKBACK일 수익률을 5단계로 분류 (급락~급등)."""
    if t < MOMENTUM_LOOKBACK: return 2   # 데이터 부족하면 중립
    m = prices[t] / prices[t - MOMENTUM_LOOKBACK] - 1
    if   m < -0.03: return 0   # 급락
    elif m < -0.01: return 1   # 하락
    elif m <  0.01: return 2   # 횡보
    elif m <  0.03: return 3   # 상승
    else:           return 4   # 급등

def ma_signal(t):
    """현재가가 이동평균선 위(1)인지 아래(0)인지 → 추세 판단의 기본."""
    if t < MA_WINDOW: return 1
    ma = sum(prices[t - MA_WINDOW + 1: t + 1]) / MA_WINDOW
    return 1 if prices[t] >= ma else 0

def get_state(t, position):
    """상태 = (모멘텀 5단계, 이평선 위/아래 2가지, 현재 보유중인지 2가지)
    → 총 5 x 2 x 2 = 20개 상태. position을 넣어야 '언제 팔지'도 배움."""
    return (momentum_bucket(t), ma_signal(t), position)

N_STATES = 5 * 2 * 2
def state_index(s):
    m, ma, pos = s
    return (m * 2 + ma) * 2 + pos

# Q테이블: [상태][행동]. 처음엔 전부 0 (아무 전략도 모름).
Q = [[0.0, 0.0, 0.0] for _ in range(N_STATES)]

# ------------------------------------------------------------------
# 3) 환경 한 스텝: 행동 → (다음상태, 보상)
#    핵심! 보상 = 그날 포지션으로 번 수익 - 매매했으면 수수료.
# ------------------------------------------------------------------
def take_action(t, position, action):
    """t일에 action을 하면 새 포지션이 정해지고, t→t+1 가격변화로 손익 발생."""
    if   action == 1: new_pos = 1          # 매수 → 보유 상태로
    elif action == 2: new_pos = 0          # 매도 → 현금 상태로
    else:             new_pos = position   # 관망 → 그대로 유지

    cost = FEE if new_pos != position else 0.0        # 포지션 바뀌면 수수료
    reward = new_pos * returns[t] - cost              # 보유중일 때만 수익률을 얻음
    return new_pos, reward

# ------------------------------------------------------------------
# 4) 학습/검증 구간 분리  ← 현실성의 핵심!
#    과거(train)로만 배우고, 한 번도 안 본 미래(test)에서 성적표를 매김.
# ------------------------------------------------------------------
split = int(len(returns) * TRAIN_RATIO)
train_range = range(MA_WINDOW, split)             # 학습에 쓰는 날짜
test_range  = range(split, len(returns))          # 검증(백테스트)에 쓰는 날짜

# ------------------------------------------------------------------
# 5) 학습 루프 : 과거 구간을 EPISODES번 반복하며 Q테이블을 다듬음
# ------------------------------------------------------------------
print("=" * 60)
print(f"데이터: {source}")
print(f"학습 구간 {train_range.start}~{split}일 / 검증 구간 {split}~{len(returns)}일")
print("=" * 60)

for ep in range(EPISODES):
    # 탐험율(epsilon)을 점점 줄임 → 처음엔 마구 실험, 나중엔 배운 대로
    epsilon = EPS_START + (EPS_END - EPS_START) * ep / max(1, EPISODES - 1)
    position = 0
    for t in train_range:
        s = get_state(t, position); si = state_index(s)
        if rng.random() < epsilon:
            action = rng.randint(0, 2)                    # 탐험
        else:
            action = max(range(3), key=lambda a: Q[si][a])  # 활용(최선)

        new_pos, reward = take_action(t, position, action)
        ns = get_state(t + 1, new_pos); nsi = state_index(ns)

        # Q-learning 업데이트 (강화학습의 심장)
        td_target = reward + GAMMA * max(Q[nsi])
        Q[si][action] += ALPHA * (td_target - Q[si][action])

        position = new_pos

# ------------------------------------------------------------------
# 6) 백테스트 : '처음 보는 미래' 구간에서 배운 전략을 실전처럼 돌려봄
#    비교 대상 = 그냥 처음에 사서 끝까지 들고 있는 'Buy & Hold'
# ------------------------------------------------------------------
def backtest(day_range):
    equity = 1.0        # 시작 자산 1.0 (=100%)
    position = 0
    trades = 0
    wins = 0
    curve = [equity]
    for t in day_range:
        s = get_state(t, position); si = state_index(s)
        action = max(range(3), key=lambda a: Q[si][a])    # 탐험 없이 배운 대로만
        new_pos, reward = take_action(t, position, action)
        if new_pos != position: trades += 1
        if reward > 0: wins += 1
        equity *= (1 + reward)
        curve.append(equity)
        position = new_pos
    return equity, trades, wins, curve

rl_final, trades, wins, rl_curve = backtest(test_range)

# Buy & Hold: 검증 구간 첫날 사서 끝까지 보유 (수수료 1회)
bh = 1.0 - FEE
for t in test_range:
    bh *= (1 + returns[t])

print("\n" + "=" * 60)
print("백테스트 결과 (학습 때 못 본 미래 구간에서의 성적)")
print("=" * 60)
print(f"  강화학습 전략 최종 자산 : {rl_final:6.3f}  → 수익률 {(rl_final-1)*100:+6.2f}%")
print(f"  단순 보유(Buy&Hold)    : {bh:6.3f}  → 수익률 {(bh-1)*100:+6.2f}%")
print(f"  매매 횟수 : {trades}회 / 이익 난 날 비율 : {wins/len(test_range)*100:.1f}%")
verdict = "강화학습 전략이 앞섰습니다" if rl_final > bh else "이번엔 단순 보유가 나았습니다"
print(f"  → {verdict}. (수수료·과적합 때문에 항상 이기는 건 아님 = 현실적)")

# ------------------------------------------------------------------
# 7) 자산 곡선을 ASCII 그래프로 (검증 구간 RL 전략)
# ------------------------------------------------------------------
print("\n강화학습 전략의 자산 곡선 (검증 구간):")
lo, hi = min(rl_curve), max(rl_curve)
H = 10
step_x = max(1, len(rl_curve) // 60)   # 가로로 최대 ~60칸
sampled = rl_curve[::step_x]
for level in range(H, -1, -1):
    thresh = lo + (hi - lo) * level / H
    row = ''.join('█' if v >= thresh else ' ' for v in sampled)
    print(f"{thresh:6.3f} |{row}")
print("       +" + "-" * len(sampled))
print(f"        (시작 {rl_curve[0]:.2f} → 끝 {rl_curve[-1]:.3f})")

# ------------------------------------------------------------------
# 8) 배운 전략 엿보기 : 상태별로 무엇을 하기로 배웠나
# ------------------------------------------------------------------
print("\n배운 전략 (일부 상태에서의 선택):")
mom_name = ['급락', '하락', '횡보', '상승', '급등']
for m in range(5):
    for ma in (1, 0):
        for pos in (0, 1):
            si = state_index((m, ma, pos))
            act = max(range(3), key=lambda a: Q[si][a])
            held = '보유중' if pos else '현금'
            trend = '이평선위' if ma else '이평선아래'
            print(f"  {mom_name[m]:>2}·{trend}·{held:>3} → {ACTIONS[act]}")
        break  # 이평선 위 케이스만 대표로 출력 (너무 길어지지 않게)
