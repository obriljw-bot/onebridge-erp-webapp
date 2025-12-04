# OneBridge ERP v2.2 (SSR Hybrid) — Complete Architecture & Development Standards

## Document Information
- **Version**: 2.2.0
- **Last Updated**: 2025-12-04
- **Status**: Active Development
- **Purpose**: 시스템 아키텍처 명세 + 개발 표준 + 트러블슈팅 가이드 + 도메인 레이어 설계

> ⚠️ **IMPORTANT**: 이 문서는 OneBridge ERP 개발의 **정규 참조 문서**입니다.
> 모든 신규 개발 및 수정 작업은 이 문서의 표준을 준수해야 합니다.

---

# PART 1: SYSTEM ARCHITECTURE

## 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ SheetJS     │  │ OB.state    │  │ google.script.run       │ │
│  │ (Excel Parse)│  │ (전역상태)   │  │ (Server Communication)  │ │
│  └─────────────┘  └─────────────┘  └───────────┬─────────────┘ │
└───────────────────────────────────────────────┬─────────────────┘
                                                │
                    ┌───────────────────────────▼───────────────────────────┐
                    │              Google Apps Script Server                 │
                    │  ┌─────────────────────────────────────────────────┐  │
                    │  │                  WebApp.gs                       │  │
                    │  │                  (Entry Point)                   │  │
                    │  └─────────────────────┬───────────────────────────┘  │
                    │                        │                              │
                    │  ┌─────────────────────▼───────────────────────────┐  │
                    │  │               UIService.gs                       │  │
                    │  │            (Page Routing/SSR)                    │  │
                    │  └─────────────────────┬───────────────────────────┘  │
                    │                        │                              │
                    │  ┌─────────────────────▼───────────────────────────┐  │
                    │  │               ApiService.gs                      │  │
                    │  │         (Client API Endpoints)                   │  │
                    │  │    ⚠️ 모든 반환값 safeReturn() 필수              │  │
                    │  └───────┬─────────────────────────────┬───────────┘  │
                    │          │                             │              │
                    │  ┌───────▼───────┐           ┌────────▼────────┐     │
                    │  │ DBService.gs  │           │ OrderParsing    │     │
                    │  │ (Data Access) │           │ Service.gs      │     │
                    │  └───────┬───────┘           └────────┬────────┘     │
                    │          │                            │              │
                    │  ┌───────▼────────────────────────────▼───────┐      │
                    │  │           InvoiceOutputService.gs          │      │
                    │  │              (PDF Generation)              │      │
                    │  └────────────────────┬───────────────────────┘      │
                    └───────────────────────┬──────────────────────────────┘
                                            │
                    ┌───────────────────────▼───────────────────────────────┐
                    │                Google Spreadsheets                     │
                    │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
                    │  │ 기초데이터DB  │ │ 발주입력DB   │ │ 발주통합DB   │   │
                    │  │ (거래처,품목) │ │ (업로드원본) │ │ (거래원장)   │   │
                    │  └──────────────┘ └──────────────┘ └──────────────┘   │
                    └───────────────────────────────────────────────────────┘
```

**Architecture Style**: SSR + SPA Hybrid (HTMLService 기반 GAS WebApp)

---

## 1.2 File Structure

### Server Files (.gs)
```
├── WebApp.gs                  # 진입점 (doGet)
├── UIService.gs               # 페이지 라우팅, SSR 템플릿
├── ApiService.gs              # 클라이언트 API 엔드포인트 ⭐
├── DBService.gs               # 데이터베이스 접근 레이어
├── OrderParsingService.gs     # 발주 파싱/매칭/저장 로직
├── SettlementService.gs       # 매입/매출 마감 로직 ⭐
├── AdjustmentService.gs       # 조정(반품/파손/가격조정) 로직 ⭐⭐⭐ NEW!
├── PaymentService.gs          # 결제/입금 관리 로직 ⭐ NEW!
└── InvoiceOutputService.gs    # PDF 생성 엔진
```

### Client Files (.html)
```
├── Layout.html               # 메인 레이아웃 (SSR 템플릿)
├── CommonHead.html           # 전역 CSS
├── CommonScripts.html        # 전역 JS + 페이지 초기화 함수 ⭐
├── Component_Sidebar.html    # 네비게이션 사이드바
├── Component_HeaderNav.html  # 상단 헤더
├── Page_OrderFile.html       # 발주입력 (파일) 페이지
├── Page_OrderList.html       # 발주내역 페이지
├── Page_Dashboard.html       # 대시보드 페이지
├── Page_InvoiceOutput.html   # 출력/명세서 페이지
└── Page_Settings.html        # 설정 페이지
```

---

## 1.3 Database Schema

### Spreadsheet IDs
```javascript
const ERP_CONFIG = {
  BASE_DATA_SHEET_ID:    '1vjAjykSQGK2DnFXvmQcH2zuI8WbOvAq_smqvW8u_bao',  // 기초데이터
  ORDER_INPUT_SHEET_ID:  '11sjwW1NM4fskAQBYnWghbE6d2E0y_EpX-LocgUAevWY',  // 발주입력
  ORDER_MERGED_SHEET_ID: '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs'   // 발주통합DB
};
```

### 거래원장 컬럼 구조 (v2.2 확장)
| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| 발주일 | Date | 발주 일자 |
| 발주번호 | String | `YYYYMMDD-거래처코드-브랜드코드-SEQ` |
| 품목코드 | String | 바코드 |
| 브랜드 | String | 브랜드명 |
| 매입처 | String | 공급사명 |
| 발주처 | String | 고객사명 |
| 부가세구분 | String | 부별/영세/면세 |
| 제품명 | String | 상품명 |
| 발주수량 | Number | 발주 수량 |
| 확정수량 | Number | 확정된 수량 ⭐ 수정 시 금액 자동 재계산 |
| 매입가 | Number | 매입 단가 |
| 공급가 | Number | 공급 단가 |
| 매입액 | Number | =확정수량*매입가 (수식 → 값으로 변경 예정) |
| 공급액 | Number | =확정수량*공급가 (수식 → 값으로 변경 예정) |
| 마진액 | Number | =공급액-매입액 |
| 마진율 | Number | =마진액/공급액*100 |
| **거래상태** ⭐ | String | **ORDERED / CONFIRMED_OPEN / SETTLED / INVOICED / PAID** |
| **매입마감ID** ⭐ | String | 매입 마감 시 참조 ID (예: PS-202501-ABC상사) |
| **매출마감ID** ⭐ | String | 매출 마감 시 참조 ID (예: SS-202501-올리브영) |
| 생성일시 | String | ISO 형식 타임스탬프 |
| 수정일시 | String | ISO 형식 타임스탬프 |

**⭐ v2.2 신규 컬럼**: 거래상태, 매입마감ID, 매출마감ID 추가로 마감 연계 및 수정 권한 제어 가능

---

## 1.4 핵심 도메인 레이어 (v2.2 신규)

OneBridge ERP는 다음 6개 도메인 레이어로 구성됩니다:

### 1) Transaction Layer (거래원장)
- **역할**: 모든 발주/확정/입고/출고의 원본 데이터
- **테이블**: 거래원장 (ORDER_MERGED_SHEET)
- **주요 필드**: 발주번호, SKU, 수량, 단가, 금액, 상태
- **상태 관리**: ORDERED → CONFIRMED_OPEN → SETTLED → INVOICED → PAID

### 2) Settlement Layer (매입/매출 마감)
- **역할**: 기간별 거래 집계 및 마감
- **테이블**: 매입마감DB, 매출마감DB
- **프로세스**:
  - 거래원장 데이터 집계
  - Adjustment 반영
  - 마감 확정 시 거래원장 상태를 SETTLED로 변경
  - 거래원장에 마감ID 기록

### 3) Invoice Layer (청구)
- **역할**: 청구서 발행 및 관리
- **테이블**: 청구DB
- **연계**: Settlement → Invoice
- **상태**: DRAFT → ISSUED → PAID

### 4) Payment Layer (결제 관리) ⭐ NEW!
- **역할**: 실제 입금/지급 관리 및 미수금 추적
- **테이블**: 결제DB
- **기능**:
  - 결제 계획 (예정일 관리)
  - 실제 결제 기록
  - 미수금/미지급금 자동 계산
  - 은행 CSV 매칭 (선택)
  - 부분결제 처리
- **상태**: PLANNED → DONE → REVERSED

### 5) Adjustment Layer (조정) ⭐⭐⭐ NEW! 핵심!
- **역할**: 마감 후 발생한 변동을 원본 수정 없이 관리
- **테이블**: 조정DB
- **조정 유형**:
  - RETURN (반품)
  - DAMAGE (파손)
  - PRICE_ADJUSTMENT (가격 조정)
  - QUANTITY_ADJUSTMENT (수량 조정)
- **핵심 원칙**:
  - **마감 후에는 거래원장 수정 금지**
  - **모든 변동은 Adjustment 행으로 기록**
  - Settlement/Invoice/Payment 재계산 시 Adjustment 포함

**예시:**
```
1월 31일: 매입 마감 (100개, SETTLED 상태)
2월 3일: 5개 결품 발견

[기존 방식 - 문제]
- 거래원장 95개로 수정 → 마감 데이터 불일치!

[v2.2 Adjustment 방식 - 해결]
- 거래원장: 100개 유지 (SETTLED 상태 변경 불가)
- 조정DB에 새 행 추가:
  - 조정ID: ADJ-20250203-001
  - 원거래ID: 참조 발주번호
  - 조정유형: RETURN
  - 조정수량: -5
  - 조정금액: -25,000원
  - 사유: "5개 결품"
- 다음 집계/청구 시 자동 반영
```

### 6) Master Data Layer (마스터)
- **역할**: 거래처, 품목, 브랜드 등 기초 데이터
- **테이블**: 거래처DB, 품목DB, 브랜드DB

---

## 1.5 상태 전이 다이어그램 (v2.2 신규)

### Transaction 상태 흐름
```
ORDERED          // 발주 등록
  ↓ (확정수량 입력)
CONFIRMED_OPEN   // 확정 완료 (마감 전, 수정 가능)
  ↓ (매입/매출 마감 실행)
SETTLED          // 마감 완료 (수정 불가, Adjustment만 가능)
  ↓ (청구서 발행)
INVOICED         // 청구됨
  ↓ (결제 완료)
PAID             // 결제 완료
```

### Settlement 상태 흐름
```
DRAFT      // 임시저장
  ↓ (마감 확정)
CONFIRMED  // 마감 확정
  ↓ (월마감 실행)
LOCKED     // 잠금 (월마감 완료)
```

### Payment 상태 흐름
```
PLANNED    // 결제 예정
  ↓ (실제 결제)
DONE       // 결제 완료
  ↓ (필요 시)
REVERSED   // 취소/환불
```

---

# PART 2: FRONTEND ARCHITECTURE

## 2.1 Layout System

### Layout.html (Root Template)
```html
<!DOCTYPE html>
<html>
  <head>
    <?!= include('CommonHead'); ?>
  </head>
  <body class="ob-body">
    <div class="ob-app-shell">
      <aside class="ob-sidebar">
        <?!= include('Component_Sidebar'); ?>
      </aside>
      <main class="ob-main">
        <header class="ob-header">
          <?!= include('Component_HeaderNav'); ?>
        </header>
        <section id="app-main" class="ob-main-content">
          <!-- SSR: 페이지 내용이 여기에 삽입됨 -->
        </section>
      </main>
    </div>
    <?!= include('CommonScripts'); ?>
  </body>
</html>
```

---

## 2.2 CommonScripts.html — SPA Engine

### 핵심 역할
1. **전역 네임스페이스 관리** (`window.OB`)
2. **페이지 라우팅** (SPA 방식)
3. **서버 통신 래퍼** (`google.script.run`)
4. **로딩 오버레이** 제어
5. **페이지별 초기화 함수** 호스팅

### 필수 구조
```javascript
// ===== 전역 네임스페이스 =====
window.OB = window.OB || {};

// ===== 상태 관리 =====
OB.state = {
  currentPage: 'orderFile',
  isLoading: false,
  initializedPages: {}
};

// ===== 페이지 초기화 디스패처 =====
OB.initCurrentPage = function(page) {
  var initFuncName = 'init' + page.charAt(0).toUpperCase() + page.slice(1) + 'Page';
  if (typeof OB[initFuncName] === 'function') {
    OB[initFuncName]();
  }
};

// ===== 로딩 오버레이 =====
OB.showLoading = function(message) { /* ... */ };
OB.hideLoading = function() { /* ... */ };

// ===== API 래퍼 =====
OB.api = {
  loadPage: function(page) { /* ... */ },
  ping: function() { /* ... */ }
};

// ===== 각 페이지별 초기화 함수 (⭐ 중요) =====
OB.initOrderFilePage = function() { /* ... */ };
OB.initInvoiceOutputPage = function() { /* ... */ };
// ... 기타 페이지
```

---

## 2.3 Page Module Structure

### ⚠️ 필수 규칙: Page_*.html에는 JavaScript 없음

```
Page_*.html 구조:
├── <style> 태그 (페이지 전용 CSS)
└── HTML 마크업

❌ 금지: <script> 태그
✅ 권장: 모든 JavaScript는 CommonScripts.html에 정의
```

**이유**: SPA 방식에서 `innerHTML`로 페이지 로드 시 `<script>` 태그가 실행되지 않음

### 페이지별 요소 ID 규칙
```
{페이지약어}-{요소유형}-{기능}

예시:
- inv-search-btn      (InvoiceOutput의 조회 버튼)
- inv-result-tbody    (InvoiceOutput의 결과 테이블 본문)
- ob-customer-select  (OrderFile의 발주처 선택)
```

---

# PART 3: BACKEND ARCHITECTURE

## 3.1 API Layer Standards ⭐⭐⭐

### 🚨 핵심 규칙: 직렬화 필수

Google Apps Script에서 클라이언트로 데이터 반환 시, **Date 객체** 등 JSON으로 변환 불가능한 데이터가 포함되면 **전체 응답이 null**로 변환됩니다.

### 필수 헬퍼 함수 (ApiService.gs 상단)

```javascript
/**
 * ============================================================
 * 클라이언트 반환용 직렬화 함수 (필수)
 * ============================================================
 * Date 객체, undefined 등을 JSON 호환 형식으로 변환
 * 모든 클라이언트 호출 함수에서 반드시 사용할 것
 */
function safeReturn(data) {
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (e) {
    Logger.log('[safeReturn Error] ' + e.message);
    return { 
      success: false, 
      error: '데이터 직렬화 실패: ' + e.message 
    };
  }
}

/**
 * 표준 성공 응답 생성
 */
function successResponse(data) {
  return safeReturn({
    success: true,
    timestamp: new Date().toISOString(),
    ...data
  });
}

/**
 * 표준 에러 응답 생성
 */
function errorResponse(message, code) {
  return {
    success: false,
    error: message,
    errorCode: code || 'UNKNOWN_ERROR',
    timestamp: new Date().toISOString()
  };
}
```

---

### 함수 명명 규칙

| 용도 | 패턴 | 예시 |
|------|------|------|
| 내부 비즈니스 로직 | `동사 + 명사` | `getOrderList()`, `processOrder()` |
| 클라이언트 호출용 | `동사 + 명사 + Api` | `getOrderListApi()`, `saveOrderApi()` |
| 내부 헬퍼 함수 | `동사 + 명사 + _` | `formatDate_()`, `validateInput_()` |

---

### API 함수 표준 패턴

```javascript
/**
 * 클라이언트 호출용 API 함수 표준 패턴
 * @param {Object} params - 클라이언트에서 전달된 파라미터
 * @returns {Object} - 직렬화된 응답 객체
 */
function someFeatureApi(params) {
  try {
    // 1. 입력 검증
    if (!params || !params.requiredField) {
      return errorResponse('필수 파라미터가 없습니다.', 'INVALID_PARAMS');
    }
    
    // 2. 비즈니스 로직 실행
    var result = someBusinessLogic(params);
    
    // 3. 성공 응답 (⭐ safeReturn 필수)
    return safeReturn({
      success: true,
      data: result
    });
    
  } catch (e) {
    // 4. 에러 로깅 및 응답
    Logger.log('[someFeatureApi Error] ' + e.message + '\n' + e.stack);
    return errorResponse(e.message, 'INTERNAL_ERROR');
  }
}
```

---

## 3.2 ApiService.gs — Endpoint Registry

### 현재 등록된 API 함수

| 함수명 | 용도 | 직렬화 | 상태 |
|--------|------|--------|------|
| `ping()` | 서버 연결 테스트 | ⚠️ 필요 | 수정 필요 |
| `getDashboardStatsApi()` | 대시보드 통계 | ✅ 필요 | 추가 필요 |
| `getOrderListApi()` | 발주 목록 조회 | ✅ 필요 | 추가 필요 |
| `getOrderDetailApi()` | 발주 상세 조회 | ✅ 필요 | 추가 필요 |
| `getPrintableOrdersApi()` | 출력용 발주 조회 | ✅ 적용됨 | 완료 |
| `generateInvoiceZipApi()` | PDF ZIP 생성 | ✅ 적용됨 | 완료 |

---

## 3.3 DBService.gs — Data Access Layer

### 핵심 함수
```javascript
// 시트 접근
function getSupplierSheet() { }      // 거래처DB
function getProductSheet() { }       // 품목DB
function getOrderMergedSheet() { }   // 거래원장

// 데이터 조회
function getSuppliers() { }          // 거래처 목록
function getProducts() { }           // 품목 목록
function findProductByBarcode() { }  // 바코드 검색

// 데이터 저장
function appendOrderMerged() { }     // 거래원장 추가
```

### ⚠️ 호출 규칙
```javascript
// ❌ 잘못된 호출 (DBService는 네임스페이스가 아님)
DBService.getOrderMergedSheet();

// ✅ 올바른 호출 (전역 함수)
getOrderMergedSheet();
```

---

## 3.4 OrderParsingService.gs — Order Processing Engine

### 데이터 플로우
```
[Browser: SheetJS parse]
        ↓ rows (2D Array)
processParsedOrderRows(rows)
        ↓ { items, matchedCount, unmatchedCount, ... }
saveParsedOrdersToDB(items)
        ↓ { success, savedRows, errors }
Google Sheet (거래원장)
```

### 발주번호 생성 규칙
```
YYYYMMDD-거래처코드-브랜드코드-SEQ

예시: 20251127-C001-DR-001
- 20251127: 발주일
- C001: 거래처코드 (미미라인 명동점)
- DR: 브랜드코드 (닥터지)
- 001: 일련번호
```

---

## 3.5 SettlementService.gs — 매입/매출 마감

### 역할
- 기간별 거래 집계 (매입처/발주처 기준)
- Adjustment 포함 집계
- 마감 확정 시 거래원장 상태 업데이트

### 주요 함수
```javascript
// 집계
aggregatePurchaseOrders(params)  // 매입 데이터 집계
aggregateSalesOrders(params)     // 매출 데이터 집계

// 마감 저장 (v2.2 개선: 거래원장 연계)
savePurchaseSettlement(params)
  → 마감DB 저장
  → 거래원장 상태를 SETTLED로 변경 ⭐
  → 거래원장에 매입마감ID 기록 ⭐

saveSalesSettlement(params)
  → 마감DB 저장
  → 거래원장 상태를 SETTLED로 변경 ⭐
  → 거래원장에 매출마감ID 기록 ⭐

// 마감 해제
unlockSettlement(settlementId)
  → 마감DB 상태를 DRAFT로 변경
  → 거래원장 상태를 CONFIRMED_OPEN으로 복구 ⭐
  → 거래원장 마감ID 초기화 ⭐

// 조회
getPurchaseSettlements(params)
getSalesSettlements(params)
```

### v2.2 핵심 개선사항
- 마감 시 거래원장과 양방향 연계
- 마감 해제 시 거래원장 상태 복구
- Adjustment 포함 집계 로직

---

## 3.6 AdjustmentService.gs — 조정 관리 ⭐⭐⭐ NEW!

### 역할
마감 후 발생한 모든 변동을 원본 수정 없이 관리하는 **핵심 서비스**

### 조정DB 스키마
```
조정DB 시트:
- 조정ID         : TEXT (PK) "ADJ-YYYYMMDD-SEQ"
- 조정유형       : TEXT "RETURN" | "DAMAGE" | "PRICE_ADJ" | "QTY_ADJ"
- 원거래ID       : TEXT (FK to 거래원장 발주번호)
- 품목코드       : TEXT
- 조정수량       : NUMBER (음수 가능)
- 조정금액       : NUMBER (음수 가능)
- 사유           : TEXT
- 생성일시       : DATETIME
- 생성자         : TEXT
- 승인상태       : TEXT "PENDING" | "APPROVED" | "REJECTED"
```

### 주요 함수
```javascript
/**
 * 반품 조정 생성
 */
createReturnAdjustment(params) {
  // params: { orderCode, itemCode, returnQty, reason }

  // 1. 원거래 확인 (SETTLED 상태여야 함)
  // 2. 조정 행 생성
  // 3. 조정DB에 저장
  // 4. 관련 Settlement/Invoice 재계산 필요 플래그 설정
}

/**
 * 가격 조정 생성
 */
createPriceAdjustment(params) {
  // params: { settlementId, adjustmentAmount, reason }

  // 예: 매입처와 협상으로 -50,000원 조정
}

/**
 * 조정 목록 조회
 */
getAdjustments(filter) {
  // filter: { type, startDate, endDate, status }
}

/**
 * 조정 승인/거부
 */
approveAdjustment(adjustmentId)
rejectAdjustment(adjustmentId, reason)
```

### 사용 시나리오
```javascript
// 시나리오: 마감 후 5개 결품 발생

// 1. 사용자가 조정 생성 요청
createReturnAdjustment({
  orderCode: '20250131-C001-DR-001',
  itemCode: '8809123456789',
  returnQty: 5,
  reason: '결품 발생'
});

// 2. 시스템 처리:
// - 원거래 상태 확인: SETTLED ✓
// - 조정DB에 행 추가:
//   ADJ-20250203-001, RETURN, -5개, -25,000원

// 3. 다음 집계/청구 시 자동 반영:
// - Settlement 재집계: 100개 → 95개 (Adjustment 포함)
// - Invoice 금액 수정: -25,000원
```

---

## 3.7 PaymentService.gs — 결제 관리 ⭐ NEW!

### 역할
실제 입금/지급 관리 및 미수금 추적

### 결제DB 스키마
```
결제DB 시트:
- 결제ID         : TEXT (PK) "PAY-YYYYMMDD-SEQ"
- 청구ID         : TEXT (FK to 청구DB)
- 결제유형       : TEXT "INBOUND" (입금) | "OUTBOUND" (지급)
- 결제예정일     : DATE
- 실제결제일     : DATE
- 결제금액       : NUMBER
- 결제방법       : TEXT "현금" | "계좌이체" | "어음" | "카드"
- 결제상태       : TEXT "PLANNED" | "DONE" | "REVERSED"
- 은행정보       : TEXT
- 비고           : TEXT
- 생성일시       : DATETIME
```

### 주요 함수
```javascript
/**
 * 결제 계획 생성
 */
planPayment(params) {
  // params: { invoiceId, dueDate, amount, method }

  // Invoice에서 자동 생성 또는 수동 생성
}

/**
 * 실제 결제 기록
 */
recordPayment(params) {
  // params: { paymentId, actualDate, actualAmount, bankInfo }

  // 1. 결제 상태를 DONE으로 변경
  // 2. 청구서 상태 업데이트 (부분결제/완납 판단)
  // 3. 거래원장 상태를 PAID로 변경 (완납 시)
}

/**
 * 미수금/미지급금 계산
 */
calculateOutstanding(counterpartyId) {
  // 거래처별 미수금/미지급금 자동 계산

  return {
    totalInvoiced: 1000000,    // 총 청구액
    totalPaid: 750000,         // 총 결제액
    outstanding: 250000,       // 미수금
    overdueAmount: 100000      // 연체금액
  };
}

/**
 * 은행 CSV 매칭 (선택적 기능)
 */
matchBankCsv(csvData) {
  // 은행 입출금 내역과 결제 계획 자동 매칭
}
```

---

# PART 4: DATA FLOW DIAGRAMS

## 4.1 발주 파일 업로드 플로우

```
┌─────────────────┐
│  User uploads   │
│  Excel file     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  SheetJS parse  │  ← Browser (Client-side)
│  → 2D Array     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  processParsedOrderRows(rows)   │  ← Server
│  - 헤더 감지                      │
│  - 품목DB 매칭                    │
│  - matched/unmatched 분류        │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Display Table  │  ← Browser
│  (매칭 결과)     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  saveParsedOrdersToDB(items)    │  ← Server
│  - 사전 검증                      │
│  - 발주번호 생성                   │
│  - 거래원장 저장                   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Google Sheet   │
│  (거래원장)      │
└─────────────────┘
```

---

## 4.2 출력/명세서 플로우

```
┌─────────────────┐
│  User: 조회     │
│  버튼 클릭      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  getPrintableOrdersApi(params)  │  ← Server
│  - 필터링 (기간/발주번호/매입처)   │
│  - 발주번호별 그룹핑               │
│  - ⭐ safeReturn() 적용          │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Display Table  │  ← Browser
│  (발주 목록)     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  generateInvoiceZipApi(params)  │  ← Server
│  - PDF 생성 (HtmlService)        │
│  - ZIP 압축 (Utilities.zip)      │
│  - Drive 저장                    │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Download ZIP   │  ← Browser
│  (Google Drive) │
└─────────────────┘
```

---

# PART 5: DEVELOPMENT STANDARDS (필수 준수)

## 5.1 서버 함수 작성 체크리스트

새로운 API 함수 작성 시 반드시 확인:

- [ ] 함수명이 `xxxApi` 패턴을 따르는가?
- [ ] `safeReturn()` 래퍼가 적용되었는가?
- [ ] 반환 객체에 Date 객체가 없는가?
- [ ] try-catch로 에러 처리가 되어있는가?
- [ ] Logger.log로 디버그 로그가 있는가?
- [ ] JSDoc 주석이 작성되었는가?

---

## 5.2 페이지 모듈 작성 체크리스트

새로운 페이지 작성 시 반드시 확인:

- [ ] Page_Xxx.html에는 HTML/CSS만 있는가?
- [ ] `<script>` 태그가 없는가?
- [ ] `OB.initXxxPage` 함수가 CommonScripts.html에 정의되었는가?
- [ ] 요소 ID가 명명 규칙을 따르는가?
- [ ] UIService.gs에 페이지 라우팅이 추가되었는가?

---

## 5.3 배포 체크리스트

변경 사항 배포 시 반드시 확인:

- [ ] 모든 수정 파일이 저장되었는가?
- [ ] Apps Script 에디터에서 **새 버전**으로 배포했는가?
- [ ] 브라우저 캐시를 클리어했는가? (Ctrl+Shift+R)
- [ ] 콘솔에 에러가 없는가?
- [ ] 핵심 기능 테스트를 완료했는가?

---

## 5.4 디버깅 가이드

### 서버 응답이 null일 때

```
1. 서버 함수 직접 실행
   → Apps Script 에디터에서 함수 실행 → 로그 확인
   
2. 반환 데이터 타입 확인
   → Logger.log('타입: ' + typeof result);
   
3. JSON 직렬화 테스트
   → var json = JSON.stringify(result);
   → Logger.log('JSON 길이: ' + json.length);
   
4. Date 객체 확인
   → result.someDate instanceof Date → true면 문제
   
5. safeReturn() 적용
   → return safeReturn(result);
```

### 페이지 초기화 함수가 실행되지 않을 때

```
1. 콘솔에서 확인
   → "⚠️ 초기화 함수 없음" 메시지 확인
   
2. CommonScripts.html 확인
   → OB.initXxxPage 함수가 정의되어 있는가?
   
3. Page_Xxx.html 확인
   → <script> 태그가 있는가? → 있으면 제거
   
4. 함수명 일치 확인
   → page 이름과 init 함수명이 일치하는가?
```

---

## 5.5 확정수량 수정 표준 패턴 ⭐⭐⭐ NEW!

### 문제 정의
발주 후 확정수량이 변경되었을 때, 관련된 금액 필드들이 자동으로 재계산되어야 합니다.

### 영향 받는 필드
```
확정수량 변경 시 재계산 필요:
- 매입액 = 확정수량 × 매입가
- 공급액 = 확정수량 × 공급가
- 마진액 = 공급액 - 매입액
- 마진율 = (마진액 / 공급액) × 100
```

### 상태별 수정 권한
```
ORDERED         → ✅ 수정 가능 (자유롭게)
CONFIRMED_OPEN  → ✅ 수정 가능 (마감 전)
SETTLED         → ❌ 수정 불가 (Adjustment만 가능)
INVOICED        → ❌ 수정 불가 (Adjustment만 가능)
PAID            → ❌ 수정 불가 (Adjustment만 가능)
```

### 구현 표준
```javascript
/**
 * 확정수량 수정 및 금액 재계산
 * @param {Array} updates - [{ rowIndex, confirmedQty }, ...]
 * @returns {Object} 성공/실패 응답
 */
function updateConfirmedQuantitiesApi(updates) {
  try {
    var sheet = getOrderMergedSheet();
    var data = sheet.getDataRange().getValues();
    var header = data[0];

    // 컬럼 인덱스
    var cols = {
      confirmedQty: header.indexOf('확정수량'),
      purchasePrice: header.indexOf('매입가'),
      supplyPrice: header.indexOf('공급가'),
      purchaseAmount: header.indexOf('매입액'),
      supplyAmount: header.indexOf('공급액'),
      marginAmount: header.indexOf('마진액'),
      marginRate: header.indexOf('마진율'),
      state: header.indexOf('거래상태')
    };

    var updateRanges = [];

    updates.forEach(function(update) {
      var rowIndex = update.rowIndex;
      var row = data[rowIndex];

      // 1. 상태 확인 (SETTLED 이상이면 수정 불가)
      var state = row[cols.state] || 'ORDERED';
      if (state !== 'ORDERED' && state !== 'CONFIRMED_OPEN') {
        throw new Error('마감된 거래는 수정할 수 없습니다. Adjustment를 사용하세요.');
      }

      // 2. 확정수량 업데이트
      var confirmedQty = parseFloat(update.confirmedQty);
      row[cols.confirmedQty] = confirmedQty;

      // 3. 금액 재계산
      var purchasePrice = parseFloat(row[cols.purchasePrice]) || 0;
      var supplyPrice = parseFloat(row[cols.supplyPrice]) || 0;

      var purchaseAmount = confirmedQty * purchasePrice;
      var supplyAmount = confirmedQty * supplyPrice;
      var marginAmount = supplyAmount - purchaseAmount;
      var marginRate = supplyAmount > 0 ? (marginAmount / supplyAmount * 100) : 0;

      row[cols.purchaseAmount] = purchaseAmount;
      row[cols.supplyAmount] = supplyAmount;
      row[cols.marginAmount] = marginAmount;
      row[cols.marginRate] = marginRate;

      // 4. 상태 업데이트 (ORDERED → CONFIRMED_OPEN)
      if (state === 'ORDERED') {
        row[cols.state] = 'CONFIRMED_OPEN';
      }

      // 5. 업데이트 범위 저장
      updateRanges.push({
        row: rowIndex + 1,
        values: [
          confirmedQty,
          purchaseAmount,
          supplyAmount,
          marginAmount,
          marginRate,
          row[cols.state]
        ]
      });
    });

    // 6. 시트에 일괄 반영
    updateRanges.forEach(function(range) {
      sheet.getRange(range.row, cols.confirmedQty + 1).setValue(range.values[0]);
      sheet.getRange(range.row, cols.purchaseAmount + 1).setValue(range.values[1]);
      sheet.getRange(range.row, cols.supplyAmount + 1).setValue(range.values[2]);
      sheet.getRange(range.row, cols.marginAmount + 1).setValue(range.values[3]);
      sheet.getRange(range.row, cols.marginRate + 1).setValue(range.values[4]);
      sheet.getRange(range.row, cols.state + 1).setValue(range.values[5]);
    });

    return successResponse({
      updatedCount: updateRanges.length
    });

  } catch (e) {
    Logger.log('[updateConfirmedQuantitiesApi Error] ' + e.message);
    return errorResponse(e.message, 'UPDATE_FAILED');
  }
}
```

### 사용자 시나리오
```
시나리오 1: 발주 후 확정수량 입력
1. 발주 등록 (상태: ORDERED, 확정수량: 0)
2. 사용자가 확정수량 입력 (예: 100개)
3. 시스템이 자동 재계산:
   - 매입액 = 100 × 5,000 = 500,000원
   - 공급액 = 100 × 6,000 = 600,000원
   - 마진액 = 100,000원
   - 마진율 = 16.67%
4. 상태 변경: ORDERED → CONFIRMED_OPEN

시나리오 2: 확정수량 수정 (마감 전)
1. 현재 상태: CONFIRMED_OPEN
2. 사용자가 확정수량 변경 (100 → 95)
3. 시스템이 자동 재계산 (위와 동일)
4. 상태 유지: CONFIRMED_OPEN

시나리오 3: 확정수량 수정 시도 (마감 후)
1. 현재 상태: SETTLED
2. 사용자가 확정수량 변경 시도
3. ❌ 에러: "마감된 거래는 수정할 수 없습니다. Adjustment를 사용하세요."
4. 올바른 방법:
   - AdjustmentService.createReturnAdjustment() 사용
   - 조정 행으로 -5개 기록
```

---

# PART 6: KNOWN ISSUES & RESOLUTION LOG

## 6.1 해결된 이슈

### Issue #001: InvoiceOutput 조회 버튼 미작동 (2025-11-27)

**증상**: 조회 버튼 클릭 시 서버 응답 null

**원인**: 
1. Page_InvoiceOutput.html의 `<script>` 태그가 SPA 로드 시 실행되지 않음
2. `getPrintableOrders()` 반환값에 Date 객체 포함

**해결**:
1. 초기화 함수를 CommonScripts.html로 이동
2. `getPrintableOrdersApi()` 래퍼 함수에 `safeReturn()` 적용

**영향 파일**:
- CommonScripts.html
- Page_InvoiceOutput.html
- ApiService.gs

---

## 6.2 알려진 이슈 (미해결)

| ID | 이슈 | 우선순위 | 상태 |
|----|------|----------|------|
| #002 | Page_OrderFile.html에 `<script>` 태그 존재 | 낮음 | 보류 (SSR에서만 사용) |
| #003 | getCustomers() 함수 중복 정의 | 중간 | 검토 필요 |
| #004 | ping() 함수 Date 객체 반환 | 낮음 | 수정 필요 |
| #005 | UIService 페이지명 불일치 | 낮음 | 수정 완료 |

---

# PART 7: DEVELOPMENT ROADMAP (v2.2 재정의)

OneBridge ERP는 단계별 개발 로드맵을 따릅니다. 각 Phase는 명확한 목표와 완료 조건을 가집니다.

---

## Phase 0: 거래원장 안정화 ⭐ 현재 진행 중

### 목표
확정수량 입력 및 금액 자동 재계산 기능 완성

### 주요 작업
- [x] 확정수량 수정 UI 구현 (Page_OrderList)
- [ ] updateConfirmedQuantitiesApi() 구현
  - 확정수량 → 매입액/공급액/마진액/마진율 자동 재계산
  - 상태 관리: ORDERED → CONFIRMED_OPEN
  - SETTLED 상태에서는 수정 불가 검증
- [ ] 거래원장에 상태 컬럼 추가 (거래상태, 매입마감ID, 매출마감ID)
- [ ] 발주 상세 모달 개선 (상태 표시, 확정수량 입력)

### 완료 조건
- 확정수량 수정 시 모든 금액 필드가 자동 재계산됨
- 상태별 수정 권한이 올바르게 작동함
- 거래원장 데이터 무결성이 보장됨

---

## Phase 1: Settlement/Invoice 안정화 + Adjustment Layer

### 목표
매입/매출 마감 및 청구 프로세스 완성, Adjustment Layer 도입

### 주요 작업
- [ ] SettlementService 개선
  - 마감 시 거래원장 상태 업데이트 (→ SETTLED)
  - 거래원장에 마감ID 기록
  - 마감 해제 시 상태 복구
  - Adjustment 포함 집계 로직
- [ ] AdjustmentService 구현
  - 조정DB 생성 (반품/파손/가격조정)
  - createReturnAdjustment(), createPriceAdjustment() 구현
  - 조정 승인 프로세스
- [ ] InvoiceService 구현
  - Settlement → Invoice 자동 생성
  - 청구서 PDF 생성
  - 청구 상태 관리 (DRAFT → ISSUED)

### 완료 조건
- 매입/매출 마감이 정상 작동하며 거래원장과 연계됨
- 마감 후 변동 사항은 Adjustment로만 처리 가능
- 청구서가 마감 데이터 기반으로 정확하게 생성됨

---

## Phase 2: Payment Layer + Dashboard

### 목표
결제 관리 시스템 구축 및 대시보드 완성

### 주요 작업
- [ ] PaymentService 구현
  - 결제DB 생성
  - planPayment(), recordPayment() 구현
  - 미수금/미지급금 자동 계산
  - 부분결제/완납 처리
  - 은행 CSV 매칭 (선택)
- [ ] 청구서 상태 업데이트
  - 결제 완료 시 ISSUED → PAID
  - 거래원장 상태 업데이트 (→ PAID)
- [ ] Dashboard 구현
  - 오늘의 결제/입금 예정
  - 미수금/미지급금 요약
  - 경고 알림 (연체, 재고 부족 등)
  - 월별 매출/매입/마진 현황

### 완료 조건
- 결제 계획 및 실제 결제 기록이 체계적으로 관리됨
- 대시보드에서 핵심 지표를 한눈에 확인 가능
- 미수금/미지급금이 자동으로 추적됨

---

## Phase 3: Adjustment Layer 고도화 + 월마감 회계 완성

### 목표
조정 프로세스 고도화 및 월별 회계 마감 완성

### 주요 작업
- [ ] 조정 워크플로우 개선
  - 조정 승인 프로세스 UI
  - 조정 이력 추적
  - 조정 영향도 분석 (Settlement/Invoice/Payment 재계산)
- [ ] 월마감 기능
  - 월별 손익계산서 자동 생성
  - 채권채무 에이징 리포트
  - 재고자산 평가 (선택)
  - 월마감 잠금 (LOCKED 상태)
- [ ] ReportingService 구현
  - getDailyDashboardSummary()
  - getMonthlyPnlReport()
  - getAgingReport()

### 완료 조건
- 조정 프로세스가 완전히 자동화됨
- 월마감 리포트가 정확하게 생성됨
- 회계 데이터 무결성이 보장됨

---

## Phase 4: Alert/Recommendation Intelligence

### 목표
자동 경고 및 지능형 추천 시스템 구축

### 주요 작업
- [ ] AlertService 구현
  - 결품률 모니터링
  - 매입처 단가 이상치 탐지
  - 마감 불일치 경고
  - 재고 부족 알림
  - 연체 알림
- [ ] 자동 추천 엔진
  - 발주 수량 추천 (과거 데이터 기반)
  - 마진율 최적화 제안
  - 결제 일정 최적화
- [ ] 외부 연동
  - Gmail API (청구서 자동 발송)
  - Google Drive (PDF 자동 저장)
  - 은행 CSV 자동 매칭

### 완료 조건
- 이상 징후가 자동으로 탐지되고 알림이 발송됨
- 데이터 기반 추천이 제공됨
- 외부 시스템과의 연동이 안정적으로 작동함

---

## Phase 5: 확장 및 최적화 (장기)

### 주요 작업
- [ ] Supabase/MySQL 데이터 이관 (대용량 처리)
- [ ] Full SPA 전환 (React/Vue 고려)
- [ ] 확정수량 회신 포털 (거래처용)
- [ ] 모바일 앱 (선택)
- [ ] AI 기반 발주 예측
- [ ] 다중 창고 관리
- [ ] 다중 통화 지원

---

# PART 8: APPENDIX

## A. JSON 직렬화 불가 데이터 타입

| 타입 | 현상 | 해결책 |
|------|------|--------|
| Date 객체 | null 또는 누락 | `.toISOString()` 또는 `safeReturn()` |
| undefined | 키 자체가 누락 | null로 명시적 변환 |
| 함수 | 누락 | 제거 |
| 순환 참조 | 에러 발생 | 구조 변경 |
| NaN | null로 변환 | 숫자 검증 |
| Infinity | null로 변환 | 숫자 검증 |

---

## B. 필수 코드 스니펫

### safeReturn 함수
```javascript
function safeReturn(data) {
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (e) {
    Logger.log('[safeReturn Error] ' + e.message);
    return { success: false, error: '데이터 직렬화 실패' };
  }
}
```

### API 함수 템플릿
```javascript
/**
 * [기능 설명]
 * @param {Object} params - 파라미터 설명
 * @returns {Object} 응답 객체
 */
function someFeatureApi(params) {
  try {
    // 입력 검증
    if (!params) {
      return { success: false, error: '파라미터가 없습니다.' };
    }
    
    // 비즈니스 로직
    var result = someLogic(params);
    
    // 성공 응답 (직렬화 필수)
    return safeReturn({
      success: true,
      data: result
    });
    
  } catch (e) {
    Logger.log('[someFeatureApi Error] ' + e.message);
    return { success: false, error: e.message };
  }
}
```

### 페이지 초기화 함수 템플릿
```javascript
OB.initSomePagePage = function() {
  console.log('🔧 initSomePagePage 시작');
  
  var mainElement = document.getElementById('some-main-element');
  if (!mainElement) {
    console.error('❌ 메인 요소를 찾을 수 없음');
    return;
  }
  
  // 중복 초기화 방지
  if (mainElement.dataset.bound === '1') {
    console.log('⭕ 이미 초기화됨');
    return;
  }
  mainElement.dataset.bound = '1';
  
  // 이벤트 바인딩
  // ...
  
  console.log('✅ initSomePagePage 완료');
};
```

---

## C. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 2.0.0 | 2025-11 | 초기 아키텍처 문서 작성 |
| 2.1.0 | 2025-11-27 | 직렬화 표준, SPA 규칙, 디버깅 가이드 추가 |
| 2.2.0 | 2025-12-04 | **도메인 레이어 설계 추가** (Adjustment/Payment Layer), 거래원장 상태 관리 도입, 확정수량 수정 표준 패턴 정의, 개발 로드맵 재정의 (Phase 0-5) |

---

**Document End**

> 이 문서는 OneBridge ERP 프로젝트의 **정규 참조 문서**입니다.
> 모든 개발자는 이 문서의 표준을 준수해야 합니다.
> 문서 수정 시 반드시 버전과 변경 이력을 업데이트하세요.
