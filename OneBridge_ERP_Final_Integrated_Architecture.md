# OneBridge ERP – Final Integrated Architecture Document

## 📘 OneBridge ERP – 연결 지점별 “최종 확정 상태 룰(Base Rule Set)”

아래는 네가 준 피드백을 반영하여,
불필요한 모호성 제거 + 실사용 기준으로 완전히 명문화한 최종 규칙이다.

---

## 1. [발주 업로드 → 거래원장 저장]

### ✅ Rule 1. 전체 파싱 데이터 중 단 하나라도 불일치가 있으면 → 저장 절대 불가

바코드/제품명/브랜드/거래처 중 하나라도 매칭 실패하면:

- 저장 자체를 캔슬  
- “총 X건 중 Y건 불일치. 품목DB/거래처DB 수정 후 다시 업로드하세요.” 라는 메시지  
- Partial Save 금지  

거래원장은 회계 원장과 동일한 중요도를 갖기 때문에 누락이 생기면  
단가·재고·마감·청구 전체가 틀어짐.

---

### ✅ Rule 2. 확정수량 초기 = 발주수량

---

## 2. [거래원장 → 마감 집계]

### ⭕ 유지: 고급옵션 – “출고/입고 상관없이 확정수량 기준으로 마감(경고 표시)”

옵션 | 의미
----|------
기본옵션 | 출고(매출)/입고(매입) 완료된 건만 마감
고급옵션 | 출고/입고 여부 무관, 확정수량 > 0 기준으로 마감. 단 경고 표시

경고 문구 예시:

“입고/출고 미완료 건이 포함됩니다. 그래도 마감하시겠습니까?”

---

### ❌ 삭제: “이미 마감된 거래 제외”

마감 거래는 Settlement DB의 SettlementID로 자동 필터링되므로  
별도 규칙이 필요 없음.

---

## 3. [마감 → 인보이스] 절대 규칙 (B안으로 확정)

### ▶ **B안: 마감 → 인보이스 (청구 = 인보이스 통합)**

Billing 단계 삭제  
Settlement → InvoiceService 에서 바로 인보이스 생성

최종 전이 구조:

```
Settlement → Invoice(DRAFT → ISSUED → PAID_PARTIAL → PAID)
```

---

## 4. [마감/인보이스 사용자 검증 UI 룰]

### 🚀 최종 룰: "거래번호(OrderID) 단위로 사용자에게 보여준다."

세부 품목이 아닌 "거래건" 단위로 마감/인보이스 대상 식별

표 구성:

체크박스 | 거래번호 | 거래일자 | 브랜드 | 품목수 | 총수량 | 합계금액 | 상태

사용자 기능:

- 체크박스 다중 선택  
- 선택한 거래 마감  
- 선택한 마감건으로 인보이스 생성  
- 품목 상세는 모달로만 확인  

---

## 5. 최종 연결 지점 룰(정리본)

### 📍 1단계: 발주 업로드 → 거래원장

- 전체 업로드 데이터 100% 매칭 전까지 저장 불가  
- 불일치 발생 시 저장 중단  
- 확정수량 초기값 = 발주수량  

---

### 📍 2단계: 거래원장 관리

사용자 작업:

- 확정수량 수정  
- 매입발주/출고/결제 상태 변경  

룰:

- 확정수량 변경 시 금액/마진 자동 재계산  
- 마감된 거래는 확정수량/단가 변경 금지  

---

### 📍 3단계: 마감

- 기본: 출고/입고 완료된 건만  
- 고급옵션: 확정수량 기준 포함(경고)  
- UI: 거래번호 기준 리스트에서 선택  

---

### 📍 4단계: 인보이스

- Settlement 존재해야 함  
- Billing 소멸, Invoice 단일 체계  
- 리스트에서 다중 선택 후 생성  

인보이스 상태:

```
DRAFT → ISSUED → PAID_PARTIAL → PAID
```

---

### 📍 5단계: 월마감

- ISSUED 이상 인보이스 기준  
- 월마감 이후 수정 불가  

---

# 📄 6. 실무 플로우 기준 화면 묶기 – Operational Flow UI Architecture v1.0

아래는 플로우 기반 화면 구조 전체.

---

# 6.1 거래처별 정산 플로우 (SettlementFlow)

### Step 1 — 거래원장 요약 & 확정수량 수정
- 거래건수  
- 품목수  
- 총수량  
- 금액  
- 마진  
- 거래번호 기준 리스트  

기능:
- 다중 선택  
- 상세 모달  
- 일괄 확정수량/상태 수정  

---

### Step 2 — 마감
- 매입 마감  
- 매출 마감  
- 확정수량 기준 고급옵션  

---

### Step 3 — 인보이스 생성
- 마감건 리스트  
- 다중 선택  
- 인보이스 생성/발행/취소/재출력  

---

# 6.2 일간 운영 플로우 (DailyOps)

카드:
- 확정수량 미입력  
- 마감 가능  
- 미발행 인보이스  
- 재고 경고(추후)  

각 카드 클릭 → SettlementFlow 해당 Step으로 이동

---

# 6.3 인보이스 플로우 (InvoiceFlow)

- 전체 인보이스 조회  
- 상태 필터  
- 발행 / 취소 / 재출력  

---

# 6.4 월마감 플로우 (MonthlyClosing)

- 인보이스 집계  
- 월마감  
- 월마감 해제  
- 해당 월 스냅샷  

---

# 7. API 구조

```
SettlementFlow
 ├ getTransactionsApi
 ├ updateConfirmedQuantitiesApi
 ├ updateTransactionStateApi
 ├ aggregatePurchaseOrdersApi
 ├ savePurchaseSettlementApi
 ├ aggregateSalesOrdersApi
 ├ saveSalesSettlementApi
 ├ createInvoiceFromSettlementApi
 └ reprintInvoiceApi
```

---

# 8. 상태 머신

## Settlement
```
DRAFT → CONFIRMED → LOCKED
```

## Invoice
```
DRAFT → ISSUED → PAID_PARTIAL → PAID
```

## Transaction
- 출고/입고/확정/결제 다중 상태  
- 마감 이후 수정 불가  

---

# 9. 향후 확장

| 모듈 | 역할 |
|------|------|
| Adjustment | 모든 조정 처리 |
| Inventory | 재고 스냅샷 |
| Payment | 결제/미수 |
| Reporting | 대시보드 |
| Alert | 경고/이상치 |

---

# 10. 결론

본 문서는 OneBridge ERP의  
최종 확정 상태 룰 + 실무 기반 화면 아키텍처를  
단일 통합 문서로 정리한 공식 기준 문서이다.
