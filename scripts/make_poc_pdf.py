# -*- coding: utf-8 -*-
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, HRFlowable
)

pdfmetrics.registerFont(TTFont("Malgun", r"C:\Windows\Fonts\malgun.ttf"))
pdfmetrics.registerFont(TTFont("MalgunBold", r"C:\Windows\Fonts\malgunbd.ttf"))

BASE = r"C:\Users\user\Desktop\교통 데이터 분석\scripts"

styles = {
    "title": ParagraphStyle("title", fontName="MalgunBold", fontSize=19, leading=24,
                             textColor=colors.HexColor("#1A202C"), alignment=TA_CENTER,
                             spaceAfter=4),
    "subtitle": ParagraphStyle("subtitle", fontName="Malgun", fontSize=10.5, leading=14,
                                textColor=colors.HexColor("#4A5568"), alignment=TA_CENTER,
                                spaceAfter=14),
    "h2": ParagraphStyle("h2", fontName="MalgunBold", fontSize=13, leading=18,
                          textColor=colors.HexColor("#2B6CB0"), spaceBefore=14, spaceAfter=6),
    "body": ParagraphStyle("body", fontName="Malgun", fontSize=10, leading=15.5,
                            textColor=colors.HexColor("#1A202C"), spaceAfter=4),
    "bullet": ParagraphStyle("bullet", fontName="Malgun", fontSize=10, leading=15.5,
                              textColor=colors.HexColor("#1A202C"), leftIndent=12, spaceAfter=3),
    "caption": ParagraphStyle("caption", fontName="Malgun", fontSize=8.5, leading=12,
                               textColor=colors.HexColor("#718096"), alignment=TA_CENTER,
                               spaceAfter=10),
    "code": ParagraphStyle("code", fontName="Courier", fontSize=8, leading=11.5,
                            textColor=colors.HexColor("#1A202C"),
                            backColor=colors.HexColor("#F7F9FC"),
                            borderPadding=8, leftIndent=4),
}

doc = SimpleDocTemplate(
    BASE + r"\언제콜_프로토타입_검증자료.pdf",
    pagesize=A4,
    topMargin=18 * mm, bottomMargin=16 * mm, leftMargin=20 * mm, rightMargin=20 * mm,
)

story = []

story.append(Paragraph("언제콜 (EonjeCall)", styles["title"]))
story.append(Paragraph("전국 교통약자를 위한 시간대·이동수단 의사결정 지원 서비스 — 프로토타입 검증 자료", styles["subtitle"]))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0")))

story.append(Paragraph("1. 서비스 흐름", styles["h2"]))
story.append(Paragraph(
    "목적지와 도착 희망 시각을 입력하면, ① 대중교통 혼잡도 예측과 ② 전국 이동지원센터 "
    "예약마감·운행시각 데이터를 비교해 두 가지 선택지를 즉시 제시한다.", styles["body"]))
story.append(Spacer(1, 6))
story.append(Image(BASE + r"\eonjecall_diagram.png", width=150 * mm, height=110 * mm))
story.append(Paragraph("그림 1. 언제콜 서비스 흐름도", styles["caption"]))

story.append(Paragraph("2. 사용 데이터", styles["h2"]))
for line in [
    "TMAP 대중교통 API(SK Open API, 민관협력 지원 플랫폼 카탈로그 경유) — 역별 실시간 열차 혼잡도, "
    "10분 단위 통계",
    "전국교통약자이동지원센터 표준데이터(공공데이터포털) — 전국 178개 센터의 위경도, 예약접수·"
    "차량운행 시각, 관할 서비스 지역",
]:
    story.append(Paragraph("• " + line, styles["bullet"]))

story.append(Paragraph("3. 프로토타입 실행 결과 — 서울역 사례", styles["h2"]))
story.append(Paragraph(
    "현재 시각 17시, 도착 희망 시각 20시30분으로 입력했을 때 TMAP 실시간 혼잡도 API를 직접 호출해 "
    "계산된 결과다. 가공된 예시 수치가 아니라 API 응답값을 코드로 그대로 조회·계산한 값이다.",
    styles["body"]))
story.append(Spacer(1, 4))

code_output = """=== 언제콜 데모: 서울역 / MON 현재 17시00분 / 도착 희망 20시30분 ===
    (선택지 A는 TMAP 지하철 혼잡도 실시간 API, 10분 단위)

[선택지 A] 지금/구간 내 대중교통
  현재(17:00) 혼잡도: 신창역 방면 70%
  17시00분~20시30분 구간 최저 혼잡도: 인천역 방면 27% (20:30 출발 권장)

[선택지 B] 이동지원센터 예약
  가장 가까운 등록 센터: 경기도 광명시 교통약자이동지원센터 (직선거리 14.0km)
  평일 예약마감 23:59 / 차량운행종료 23:59
  -> 서비스 범위: '광명시 전지역' (=중구 미포함) -> 서울역 기준 이용 불가
  -> 전국표준데이터 기준 서울역 인근엔 이용 가능한 이동지원센터가 없음
     (서울시 자체 시스템인 서울동행맵/장애인콜택시로 안내 필요 - 데이터 사각지대 실증 사례)"""

# code/output block uses Table with single cell for background box, but Korean text
# inside code style needs Malgun font, not Courier (Courier has no Hangul glyphs).
out_style = ParagraphStyle("out", fontName="Malgun", fontSize=8.3, leading=12.5,
                            textColor=colors.HexColor("#1A202C"))
out_para = Paragraph(code_output.replace("\n", "<br/>").replace(" ", "&nbsp;"), out_style)
t = Table([[out_para]], colWidths=[164 * mm])
t.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F7F9FC")),
    ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#CBD5E0")),
    ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story.append(t)
story.append(Spacer(1, 4))
story.append(Paragraph(
    "※ 서울역조차 전국표준데이터 기준 관할 이동지원센터가 없다는 사실 자체가, "
    "이 서비스가 메우려는 데이터 공백을 실증한다.", styles["caption"]))

story.append(Paragraph("4. 핵심 구현 로직 (요약)", styles["h2"]))
for line in [
    "congestion_choice() — TMAP 혼잡도 API를 시간대별로 호출해 입력 구간 내 최저 혼잡도 시각을 탐색",
    "center_choice() — 하버사인 거리 공식으로 최근접 이동지원센터를 계산하고, 관할 서비스 지역 텍스트와 "
    "대조해 실제 이용 가능 여부까지 판정",
    "전체 코드는 별첨 eonjecall_poc.py 참고 (pandas + requests 기반, 민관협력 플랫폼 경유 발급 API 키 사용)",
]:
    story.append(Paragraph("• " + line, styles["bullet"]))

doc.build(story)
print("PDF 생성 완료")
