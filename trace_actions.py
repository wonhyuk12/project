import random

# ==================================================================
# 처음 시작했던 상태(백지 Q테이블)와,
# 에이전트가 첫 판에서 하는 '모든 행동'을 한 걸음씩 보여주는 스크립트
# (numpy 없이 순수 파이썬으로 작성 → 어디서나 바로 실행됨)
# ==================================================================

GRID = 4
N_STATES = GRID * GRID
GOAL = 15
HOLE = 5
ACTIONS = ['위', '아래', '왼쪽', '오른쪽']
ARROWS  = ['↑', '↓', '←', '→']

def step(state, action):
    row, col = divmod(state, GRID)
    if   action == 0: row = max(row - 1, 0)
    elif action == 1: row = min(row + 1, GRID - 1)
    elif action == 2: col = max(col - 1, 0)
    elif action == 3: col = min(col + 1, GRID - 1)
    next_state = row * GRID + col
    if next_state == GOAL: return next_state, 10.0, True
    if next_state == HOLE: return next_state, -10.0, True
    return next_state, -0.1, False

def argmax(row):
    """리스트에서 가장 큰 값의 인덱스 (numpy.argmax 대체)"""
    best_i, best_v = 0, row[0]
    for i, v in enumerate(row):
        if v > best_v:
            best_i, best_v = i, v
    return best_i

def draw_grid(state):
    lines = []
    for row in range(GRID):
        cells = []
        for col in range(GRID):
            s = row * GRID + col
            if   s == state: cells.append(' ● ')   # 에이전트 현재 위치
            elif s == GOAL:  cells.append(' G ')
            elif s == HOLE:  cells.append(' H ')
            else:            cells.append(f'{s:2d} ')
        lines.append(''.join(cells))
    return '\n'.join(lines)

# Q테이블: 16칸 x 4행동, 전부 0 (백지)
Q = [[0.0, 0.0, 0.0, 0.0] for _ in range(N_STATES)]
alpha, gamma, epsilon = 0.1, 0.9, 0.1
rng = random.Random(0)   # seed 고정 → 매번 같은 결과

# --- 처음 시작 상태 -------------------------------------------
print("=" * 55)
print("① 처음 시작했던 것 (아무것도 모르는 백지 상태)")
print("=" * 55)
print("\nQ테이블 (전부 0 = 어느 방향이 좋은지 전혀 모름):\n")
print("칸 |   위    아래   왼쪽  오른쪽")
print("-" * 40)
for s in range(N_STATES):
    print(f"{s:2d} | {Q[s][0]:5.1f} {Q[s][1]:5.1f} {Q[s][2]:5.1f} {Q[s][3]:5.1f}")

print("\n출발 지점 (● = 에이전트, 칸 0에서 시작):\n")
print(draw_grid(0))

# --- 첫 판의 모든 행동 ----------------------------------------
print("\n" + "=" * 55)
print("② 첫 판(episode 1)에서 한 '모든 행동'")
print("=" * 55)

state, done, t = 0, False, 0
while not done:
    t += 1
    if rng.random() < epsilon:
        action = rng.randint(0, 3); mode = "탐험(무작위)"
    else:
        action = argmax(Q[state]); mode = "활용(최선)"

    next_state, reward, done = step(state, action)

    td_target = reward + gamma * max(Q[next_state]) * (0 if done else 1)
    Q[state][action] += alpha * (td_target - Q[state][action])

    end = "  ← 종료!" if done else ""
    print(f"[{t:2d}걸음] 칸 {state:2d} 에서 '{ACTIONS[action]}{ARROWS[action]}' "
          f"({mode}) → 칸 {next_state:2d}, 보상 {reward:+.1f}{end}")
    state = next_state

result = "목표 도착!" if state == GOAL else ("함정에 빠짐!" if state == HOLE else "종료")
print(f"\n첫 판 요약: 총 {t}걸음 만에 {result}")

# --- 학습 후 비교 ---------------------------------------------
print("\n" + "=" * 55)
print("③ 참고: 2000판 학습 후엔 어떻게 달라지나")
print("=" * 55)
for episode in range(2000):
    s, d = 0, False
    while not d:
        a = rng.randint(0, 3) if rng.random() < epsilon else argmax(Q[s])
        ns, r, d = step(s, a)
        Q[s][a] += alpha * (r + gamma * max(Q[ns]) * (0 if d else 1) - Q[s][a])
        s = ns

print("\n학습된 정책 (각 칸의 최선 방향):\n")
for row in range(GRID):
    line = ''
    for col in range(GRID):
        s = row * GRID + col
        if   s == GOAL: line += '  G '
        elif s == HOLE: line += '  H '
        else:           line += '  ' + ARROWS[argmax(Q[s])] + ' '
    print(line)

print("\n학습 후 출발점→목표 경로:")
s, path, steps = 0, [0], 0
while s != GOAL and steps < 20:
    s = step(s, argmax(Q[s]))[0]; path.append(s); steps += 1
print(" → ".join(map(str, path)))
