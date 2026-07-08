import numpy as np

# ==================================================================
# 강화학습 예시: 4x4 GridWorld에서 Q-learning
# 에이전트는 아무것도 모른 채 시작 → 오직 '보상'만 보고
# 시행착오로 목표까지 가는 길을 스스로 배운다.
#
# ▶ 큰 흐름:  환경 정의 → 백지 Q테이블 → 2000판 반복학습 → 결과 확인
#   (자세한 설명은 같은 폴더의 '강화학습_설명.md' 참고)
# ==================================================================

# --- 1) 환경(Environment) 정의 ---------------------------------
# 격자와 규칙을 정하는 부분. "세상이 어떻게 생겼고, 행동하면 뭐가 벌어지는지".
# 4x4 격자, 상태 번호 0~15  (왼쪽 위=0, 오른쪽 아래=15)
#   0  1  2  3
#   4  H  6  7      H = 함정(-10, 즉시 종료)
#   8  9 10 11
#  12 13 14  G      G = 목표(+10, 즉시 종료)
GRID = 4
N_STATES = GRID * GRID          # 전체 칸 수 = 16
GOAL = 15                       # 목표 칸
HOLE = 5                        # 함정 칸
ACTIONS = ['위', '아래', '왼쪽', '오른쪽']   # 행동 0,1,2,3
ARROWS  = ['↑', '↓', '←', '→']              # 결과를 화살표로 예쁘게 출력하려고

def step(state, action):
    """환경의 규칙 함수.
    '현재 칸(state)에서 어떤 방향(action)으로 움직이면'
    → (다음칸, 받은 보상, 게임 끝났는지)를 돌려준다.
    에이전트는 이 함수 안이 어떻게 생겼는지 '모른다'. 결과만 받아서 배운다."""
    row, col = divmod(state, GRID)   # 칸 번호 → (행, 열)로 변환
    # 벽 밖으로는 못 나가게 max/min으로 막아둠 (벽에 부딪히면 제자리)
    if   action == 0: row = max(row - 1, 0)           # 위
    elif action == 1: row = min(row + 1, GRID - 1)    # 아래
    elif action == 2: col = max(col - 1, 0)           # 왼쪽
    elif action == 3: col = min(col + 1, GRID - 1)    # 오른쪽
    next_state = row * GRID + col    # (행, 열) → 다시 칸 번호로

    # 보상 규칙: 어디에 도착했느냐에 따라 점수를 준다
    if next_state == GOAL: return next_state, 10.0, True    # 목표 → 큰 보상(+끝)
    if next_state == HOLE: return next_state, -10.0, True   # 함정 → 큰 벌(+끝)
    return next_state, -0.1, False   # 그냥 이동 → 작은 벌점(=빨리 가라는 압력)

# --- 2) Q테이블 & 하이퍼파라미터 --------------------------------
# Q테이블 = 에이전트의 '두뇌'. 각 칸에서 각 방향이 얼마나 좋은지 적어두는 표.
Q = np.zeros((N_STATES, 4))   # Q[상태][행동] = 그 선택의 '가치' 추정치. 처음엔 전부 0(백지)
alpha   = 0.001   # 학습률: 새 경험을 얼마나 반영할지 (0.1 = 살짝살짝 반영)
gamma   = 0.9   # 감가율: 미래 보상을 얼마나 중시할지 (← 투자 할인율과 똑같은 개념)
epsilon = 0.5   # 탐험 확률: 10%는 일부러 무작위로 새 길을 시도
rng = np.random.default_rng(0)   # 난수 생성기 (seed 0 → 매번 같은 결과가 나오게 고정)

# --- 3) 학습 루프 ----------------------------------------------
# 2000판(episode)을 반복하며 Q테이블을 조금씩 다듬는다. 여기가 '학습' 그 자체.
for episode in range(2000):
    state = 0            # 매 판마다 출발점(0)으로 리셋
    done = False         # 아직 목표/함정에 도달 안 함
    while not done:      # 한 판이 끝날 때까지 계속 움직임
        # ε-greedy: 탐험(exploration) vs 활용(exploitation)
        if rng.random() < epsilon:
            action = int(rng.integers(4))      # 탐험(10%): 무작위로 새 길 시도
        else:
            action = int(np.argmax(Q[state]))  # 활용(90%): 지금까지 가장 좋았던 선택

        # 환경에게 "이 행동 하면 어떻게 돼?" 물어보고 결과를 받음
        next_state, reward, done = step(state, action)

        # === Q-learning 업데이트 (강화학습의 심장) ==================
        # 목표값 = 즉시 보상 + 감가된 '미래 최선값'
        # done(끝)이면 미래가 없으니 미래항을 0으로 만든다.
        td_target = reward + gamma * np.max(Q[next_state]) * (0 if done else 1)
        # 현재 추정치를 목표값 쪽으로 조금(alpha만큼) 이동
        #   (td_target - Q[state, action]) = '오차'(예상과 현실의 차이)
        Q[state, action] += alpha * (td_target - Q[state, action])

        state = next_state   # 다음 칸으로 이동해서 반복

# --- 4) 학습 결과: 각 칸에서 배운 최선의 방향 ---------------------
# Q값이 가장 높은 방향(argmax)을 뽑아 화살표로 그린다. 이게 '정책(policy)'.
print("학습된 정책 (각 칸에서 에이전트가 선택하는 방향):\n")
for row in range(GRID):
    line = ''
    for col in range(GRID):
        s = row * GRID + col
        if   s == GOAL: line += '  G '
        elif s == HOLE: line += '  H '
        else:           line += '  ' + ARROWS[int(np.argmax(Q[s]))] + ' '
    print(line)

# 배운 정책대로만 움직였을 때 출발점→목표까지 실제 경로를 따라가 본다
print("\n출발점(0)에서 목표까지 따라가 보기:")
state, path, steps = 0, [0], 0
while state != GOAL and steps < 20:          # 최대 20걸음까지만 (무한루프 방지)
    state = step(state, int(np.argmax(Q[state])))[0]  # 최선의 방향으로 한 걸음
    path.append(state)
    steps += 1
print(" → ".join(map(str, path)))
