import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

plt.rcParams["font.family"] = "Malgun Gothic"
plt.rcParams["axes.unicode_minus"] = False

fig, ax = plt.subplots(figsize=(9, 6.5))
ax.set_xlim(0, 10)
ax.set_ylim(0, 10)
ax.axis("off")

def box(x, y, w, h, text, fc="#EAF2FF", ec="#2B6CB0", fontsize=12, weight="normal"):
    b = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.12,rounding_size=0.15",
                        linewidth=1.6, edgecolor=ec, facecolor=fc)
    ax.add_patch(b)
    ax.text(x + w/2, y + h/2, text, ha="center", va="center",
            fontsize=fontsize, weight=weight, color="#1A202C", linespacing=1.5)

def arrow(x1, y1, x2, y2):
    a = FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=18,
                         linewidth=1.6, color="#4A5568")
    ax.add_patch(a)

# 입력
box(2.5, 8.3, 5, 1.3, "입력\n목적지 + 도착 희망 시각\n예) 병원, 오후 6시까지", fontsize=12, weight="bold")

arrow(5, 8.3, 5, 7.1)

# AI 분석
box(1.5, 5.6, 7, 1.4,
    "AI 분석\n혼잡도 예측 모델 + 전국 이동지원센터\n예약마감·운행시각 데이터 비교",
    fc="#FFF5E6", ec="#DD8500", fontsize=12, weight="bold")

arrow(3.5, 5.6, 2.5, 4.4)
arrow(6.5, 5.6, 7.5, 4.4)

# 선택지 A
box(0.3, 2.9, 4.2, 1.5,
    "선택지 A\n지금 대중교통으로 출발\n예상 혼잡도 OO%",
    fc="#E8F8F0", ec="#2F855A", fontsize=11.5, weight="bold")

# 선택지 B
box(5.5, 2.9, 4.2, 1.5,
    "선택지 B\n지금 이동지원센터 예약\n마감까지 OO분 남음",
    fc="#FDEEEE", ec="#C53030", fontsize=11.5, weight="bold")

ax.text(5, 1.6, "두 장의 카드로 즉시 비교 — 복잡한 경로 검색 없이 바로 결정",
        ha="center", va="center", fontsize=11, color="#4A5568", style="italic")

ax.text(5, 9.85, "언제콜(EonjeCall) 서비스 흐름", ha="center", va="center",
        fontsize=16, weight="bold", color="#1A202C")

plt.tight_layout()
out_path = r"C:\Users\user\Desktop\교통 데이터 분석\scripts\eonjecall_diagram.png"
plt.savefig(out_path, dpi=200, bbox_inches="tight", facecolor="white")
print("saved:", out_path)
