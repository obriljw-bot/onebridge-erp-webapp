# OneBridge ERP v2 – Service Architecture (Backend & Frontend)

---

# 0. 목표 & 전체 방향

## 0.1 프로젝트 목표

OneBridge ERP v2는 원브릿지 유통 비즈니스의 **전 프로세스 자동화 및 통합 운영 시스템**이다.  
핵심 프로세스는 다음과 같다:

- 발주(Order)
- 확정(Confirmed Qty)
- 입고(Inbound)
- 출고(Outbound)
- 마감(Settlement)
- 청구(Invoice)
- 결제(Payment)
- 회계/월마감(Closing)
- 조정(Adjustment)
- 재고(Inventory)
- 마스터데이터 관리(MDM)

ERP의 목표는 단순한 기록이 아니라 **계산·검증·제안·알림까지 자동화한 지능형 ERP**이다.

---

# 0.2 기술 스택

## Frontend
- Google Apps Script HTMLService (SSR + Partial SPA)
- Vanilla JavaScript 모듈 구조
- Tailwind-like CSS
- Modal/Tab 기반 UI  
- google.script.run API 연동

## Backend
- Apps Script Services (도메인별 Service Layer)
- Google Sheets (운영 DB)
- MySQL(onebridge_erp) — 확장용 / 대용량 처리용 선택적 활용

## Integration
- Gmail API — 청구서/발주서 자동 발송
- Google Drive — PDF 저장
- 은행 CSV — 입출금 자동 매칭
- 외부 ERP 연동 확장 가능 구조

---

# 1. 도메인 레이어 구조 (Logical Data Layers)

ERP는 다음 7개 핵심 레이어로 구성된다.

## 1.1 Transaction Layer (거래원장)

- 발주/확정/입고/출고/판매 모든 원본 행
- SKU, 수량, 단가, 금액
- 파생 필드:
  - 매입액
  - 공급액
  - 마진액
  - 마진율

## 1.2 Settlement Layer (매입/매출 마감)

- 기간별 마감 스냅샷
- Transaction의 상태를 SETTLED로 고정
- Adjustment 포함 집계

## 1.3 Invoice Layer (청구)

- 청구서 발행 정보
- 마감ID 기반
- 미수 잔액 관리

## 1.4 Payment Layer (결제)

- 입금/지급 기록
- 결제 계획
- 은행 CSV 매칭
- 부분결제/완납 처리

## 1.5 Adjustment Layer (조정)

- 반품(Return)
- 파손(Damage)
- 가격조정(Price Adjustment)
- 마감 이후 변동을 원본 수정 없이 관리

## 1.6 Inventory Layer (재고)

- SKU별 재고(수량/가치)
- 입고/출고/반품 반영

## 1.7 Master Data Layer

- 거래처DB
- 품목DB
- 브랜드DB
- 계좌DB
- 결제조건 설정

---

# 2. 백엔드 아키텍처

## 2.1 Apps Script 파일 구조

```
/Code.gs                  // WebApp entry + router
/Router.js
/Layout.html              // 공통 레이아웃

/services/
  TransactionService.gs
  InventoryService.gs
  SettlementService.gs
  InvoiceService.gs
  PaymentService.gs
  AdjustmentService.gs
  ReportingService.gs
  AlertService.gs
  MasterDataService.gs
  AuthService.gs
  Util.gs

/views/
  Page_Dashboard.html
  Page_PurchaseOrders.html
  Page_SalesShipments.html
  Page_Settlement.html
  Page_Invoice.html
  Page_Payment.html
  Page_Adjustment.html
  Page_MasterData.html
  Page_Admin.html
```

---

# 2.2 Service Layer 상세 설계

전체 ERP의 핵심 로직은 Service 모듈들에 구현된다.

---

## 2.2.1 TransactionService

### 기능
- 발주 생성
- 확정수량 수정 후 금액 자동 재계산
- 입고/출고 처리
- 상태(State) 관리

### 주요 함수
```
createOrderFromUpload(rows)
updateConfirmedQuantities(updates[])
applyInbound(transactionRow)
applyOutbound(transactionRow)
getTransactions(filter)
lockTransactionsForSettlement(settlementId, rows)
```

---

## 2.2.2 InventoryService

입고/출고/반품 발생 시 재고 수량 변동을 관리한다.

### 함수
```
applyInbound(transaction)
applyOutbound(transaction)
applyAdjustmentToInventory(adj)
getInventorySnapshot()
```

---

## 2.2.3 SettlementService

### 기능
- 매입/매출 마감
- 마감 시 거래원장 상태 SETTLED로 변경
- 스냅샷 생성
- Adjustment 포함 집계

### 주요 함수
```
calculatePurchaseSettlement(params)
savePurchaseSettlement(data)
calculateSalesSettlement(params)
unlockSettlement(settlementId)
```

---

## 2.2.4 InvoiceService

### 기능
- Settlement 기반 청구서 생성
- 기한/발행일 자동 계산
- 거래처 결제조건 반영

### 주요 함수
```
createInvoiceFromSettlement(settlementId)
getInvoices(filter)
updateInvoiceStatus(invoiceId, status)
```

---

## 2.2.5 PaymentService

### 기능
- 결제 계획
- 실제 결제 기록
- 미수/미지급 자동 계산

### 주요 함수
```
planPayment(...)
recordPaymentDone(paymentInfo)
calculateOutstandingBalances(counterpartyId)
```

---

## 2.2.6 AdjustmentService

### 기능
- 마감 이후 변동(반품/파손/가격 변경 등)을 조정행으로 저장
- Transaction 수정 금지 → Adjustment Layer만 사용

### 주요 함수
```
createAdjustmentFromReturn(transactionId, adjQty, reason)
createPriceAdjustment(settlementId, amount, reason)
getAdjustments(filter)
```

---

## 2.2.7 ReportingService

대시보드, 월별 손익, 채권채무, 재고자산 등 종합 리포트를 생성한다.

### 함수
```
getDailyDashboardSummary()
getMonthlyPnlReport(month)
getAgingReport(type)
```

---

## 2.2.8 AlertService

자동 경고/알림 시스템

### 예시
- 결품률 ↑
- 매입처 단가 이상치
- 마감 불일치
- 재고 부족

### 함수
```
checkAndGenerateAlerts()
getAlertsForDashboard()
```

---

## 2.2.9 MasterDataService
거래처·품목·브랜드 등 기초 데이터 관리.

---

## 2.2.10 AuthService
역할/권한 기반 접근제어.

---

# 3. 프론트엔드 아키텍처

## 3.1 페이지 구조 및 Routing

- `doGet(e)`로 page 파라미터 읽어 Layout.html에 include
- google.script.run으로 백엔드 함수 호출

---

# 3.2 주요 Page 설계

## Dashboard
- OPEN/SETTLED 금액
- 오늘 결제/입금 예정
- 경고 리스트

## Purchase Orders
- 발주 업로드
- 발주 리스트
- 확정수량 입력
- 입고 처리

## Sales Shipments
- 출고
- 반품/교환 처리(Adjustment 자동 생성)

## Settlement
- 매입/매출 마감
- 검증
- 마감 저장

## Invoice
- Settlement → Invoice 생성
- 청구서 발행/PDF 저장

## Payment
- 결제 계획
- 은행 CSV 매칭
- 미수/미지급 관리

## Adjustment
- 조정 리스트
- 조정 생성 모달

## Master Data / Admin
- 거래처/품목/브랜드 설정
- 시스템 설정

---

# 4. 상태(State) 설계

## Transaction 상태
```
ORDERED → CONFIRMED_OPEN → SETTLED → INVOICED → PAID
```

## Settlement 상태
```
DRAFT → CONFIRMED → LOCKED
```

## Invoice 상태
```
DRAFT → ISSUED → PAID_PARTIAL → PAID
```

## Payment 상태
```
PLANNED → DONE → REVERSED
```

---

# 5. End‑to‑End 비즈니스 흐름

## 5.1 매입 흐름
```
발주 → 확정 → 입고 → 매입마감 → 청구 → 지급 → 월마감
```

## 5.2 매출 흐름
```
출고 → 조정(반품) → 매출마감 → 청구 → 입금 → 월마감
```

## 5.3 조정 흐름
- 마감 이후 발생한 모든 변동은 Adjustment Layer로 관리
- Settlement/Invoice/Payment/Inventory 모두 재계산

---

# 6. 비기능 요건

## 성능
- getValues/setValues 기반 배치 처리
- 필터/검색 최소화

## 감사(Log)
- 마감/청구/결제/조정 변경은 모두 로그 기록

## 보안
- WebApp 도메인 제한
- 역할 기반 권한 제어

---

# 7. 로드맵

## Phase 0  
- 확정수량 + 금액 재계산  
- 거래원장 안정화

## Phase 1  
- Settlement/Invoice 안정화

## Phase 2  
- Payment + 대시보드

## Phase 3  
- Adjustment Layer 고도화  
- 월마감 회계 완성

## Phase 4  
- Alert/Recommendation Intelligence

---

**End of Document**
