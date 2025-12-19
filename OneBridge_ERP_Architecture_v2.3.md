# OneBridge ERP v2.3 (SSR Hybrid) — Complete Architecture & Development Standards

## Document Information
- **Version**: 2.6.0
- **Last Updated**: 2025-12-19
- **Status**: 💰 결제관리 시스템 명세 추가 (Payment Management System Spec)
- **Purpose**: 시스템 아키텍처 명세 + 개발 표준 + UI/UX 패턴 템플릿 + 트러블슈팅 가이드

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
                    │                       │                              │
                    │  ┌────────────────────▼───────────────────────┐      │
                    │  │           SettlementService.gs             │      │
                    │  │         (마감/청구서 관리)                   │      │
                    │  └────────────────────────────────────────────┘      │
                    └───────────────────────┬──────────────────────────────┘
                                            │
                    ┌───────────────────────▼───────────────────────────────┐
                    │                Google Spreadsheets                     │
                    │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
                    │  │ 기초데이터DB  │ │ 발주입력DB   │ │ 발주통합DB   │   │
                    │  │ (거래처,품목) │ │ (업로드원본) │ │ (거래원장)   │   │
                    │  └──────────────┘ └──────────────┘ └──────────────┘   │
                    │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
                    │  │ 마감DB       │ │ 마감상세DB   │ │ 청구DB       │   │
                    │  │ (마감 헤더)  │ │ (마감 상세)  │ │ (청구서)     │   │
                    │  └──────────────┘ └──────────────┘ └──────────────┘   │
                    └───────────────────────────────────────────────────────┘
```

**Architecture Style**: SSR + SPA Hybrid (HTMLService 기반 GAS WebApp)

---

## 1.2 File Structure

### Server Files (.gs)
```
├── WebApp.gs                 # 진입점 (doGet)
├── UIService.gs              # 페이지 라우팅, SSR 템플릿
├── ApiService.gs             # 클라이언트 API 엔드포인트 ⭐
├── DBService.gs              # 데이터베이스 접근 레이어
├── OrderParsingService.gs    # 발주 파싱/매칭/저장 로직
├── InvoiceOutputService.gs   # PDF 생성 엔진
├── InvoiceService.gs         # 청구서/인보이스 서비스 ⭐ NEW
└── SettlementService.gs      # 마감/청구서 관리 (Phase 2)
```

### Client Files (.html)
```
├── Layout.html               # 메인 레이아웃 (SSR 템플릿) + 마감상세 모달
├── CommonHead.html           # 전역 CSS
├── CommonScripts.html        # 전역 JS + 페이지 초기화 함수 ⭐
├── Component_Sidebar.html    # 네비게이션 사이드바
├── Component_HeaderNav.html  # 상단 헤더
├── Page_OrderFile.html       # 발주입력 (파일) 페이지
├── Page_OrderList.html       # 발주내역 페이지
├── Page_Dashboard.html       # 대시보드 페이지
├── Page_InvoiceOutput.html   # 출력/명세서 페이지
├── Page_TransactionLedger.html   # 거래원장 페이지 ⭐ NEW
├── Page_InvoiceManagement.html   # 인보이스 관리 페이지 ⭐ NEW
├── Page_PurchaseSettlement.html  # 매입 마감 페이지 (Phase 2)
├── Page_SalesSettlement.html     # 매출 마감 페이지 (Phase 2)
├── Page_MonthlyClosing.html      # 월별 마감 페이지 (Phase 2)
├── Page_BillingManagement.html   # 청구서 관리 페이지 (Phase 2)
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

### 거래원장 컬럼 구조 ⭐ 업데이트
| 컬럼명 | 타입 | 설명 | API 필드명 |
|--------|------|------|-----------|
| 발주일 | Date | 발주 일자 | - |
| 발주번호 | String | `YYYYMMDD-거래처코드-브랜드코드-SEQ` | orderId |
| 품목코드 | String | 바코드 | - |
| 브랜드 | String | 브랜드명 | - |
| 매입처 | String | 공급사명 | supplier |
| 발주처 | String | 고객사명 | buyer |
| 부가세구분 | String | 부별/영세/면세 | - |
| 제품명 | String | 상품명 | - |
| 발주수량 | Number | 발주 수량 | - |
| 확정수량 | Number | 확정된 수량 | - |
| 매입가 | Number | 매입 단가 | - |
| 공급가 | Number | 공급 단가 | - |
| 매입액 | Formula | =매입가*발주수량 | - |
| 공급액 | Formula | =공급가*발주수량 | - |
| 마진액 | Formula | =공급액-매입액 | - |
| 마진율 | Formula | =마진액/공급액 | - |
| **매입발주** ⭐ | String | 발주 상태 (예: '발주완료', '발주대기') | **buyOrder** |
| **매입결제** ⭐ | String | 매입 결제 상태 (예: '결제완료', '미결제') | **payBuy** |
| **매출결제** ⭐ | String | 매출 결제 상태 (예: '결제완료', '미결제') | **paySell** |
| **출고** ⭐ | String | 출고 상태 (예: '출고완료', '미출고') | **ship** |
| 생성일시 | String | ISO 형식 타임스탬프 | - |
| 수정일시 | String | ISO 형식 타임스탬프 | - |

### 🔴 중요: 4개 상태 컬럼 관리

거래원장 시트는 **4개의 독립적인 상태 컬럼**을 가지며, 각각 다른 업무 단계를 추적합니다:

1. **매입발주**: 매입처에 대한 발주 진행 상태
2. **매입결제**: 매입처에 대한 결제 진행 상태
3. **매출결제**: 발주처로부터의 결제 진행 상태
4. **출고**: 물류/출고 진행 상태

**API 함수**: `updateOrderStatus(orderId, statuses)`
```javascript
// 4개 상태 동시 업데이트
updateOrderStatus('20251216-001', {
  buyOrder: '발주완료',
  payBuy: '결제대기',
  paySell: '미결제',
  ship: '출고완료'
});

// 개별 상태만 업데이트 (나머지 유지)
updateOrderStatus('20251216-001', {
  ship: '출고완료'
});
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
OB.initOrderFilePage = function() { /* ... */ };           // 발주입력 페이지
OB.initOrderListPage = function() { /* ... */ };           // 발주내역 페이지
OB.initInvoiceOutputPage = function() { /* ... */ };       // 출력/명세서 페이지
OB.initTransactionLedgerPage = function() { /* ... */ };   // 거래원장 페이지 ⭐ NEW
OB.initInvoiceManagementPage = function() { /* ... */ };   // 인보이스관리 페이지 ⭐ NEW
OB.initPurchaseSettlementPage = function() { /* ... */ };  // 매입마감 페이지
OB.initSalesSettlementPage = function() { /* ... */ };     // 매출마감 페이지
OB.initMonthlyClosingPage = function() { /* ... */ };      // 월별마감 페이지
OB.initBillingManagementPage = function() { /* ... */ };   // 청구서관리 페이지

// ===== 공유 모달 함수 =====
OB.viewSettlementDetail = function(settlementId) { /* ... */ };  // 마감상세 모달 ⭐ NEW
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
| `getOrderDetailApi()` | 발주 상세 조회 | ✅ 적용됨 | **완료** |
| `getPrintableOrdersApi()` | 출력용 발주 조회 | ✅ 적용됨 | 완료 |
| `generateInvoiceZipApi()` | PDF ZIP 생성 | ✅ 적용됨 | 완료 |
| `updateOrderStatus()` | 발주 상태 업데이트 (4개 상태) | ✅ 적용됨 | **완료** ⭐ |
| `updateConfirmedQuantitiesApi()` | 확정수량 수정 | ✅ 적용됨 | **완료** ⭐ |
| `updateTransactionStateApi()` | 거래 상태 변경 | ✅ 적용됨 | UI 미연결 |
| `getTransactionsApi()` | 거래원장 조회 | ✅ 적용됨 | UI 미연결 |
| `aggregatePurchaseOrdersApi()` | 매입 마감 집계 | ✅ 적용됨 | 완료 |
| `aggregateSalesOrdersApi()` | 매출 마감 집계 | ✅ 적용됨 | 완료 |
| `savePurchaseSettlementApi()` | 매입 마감 저장 | ✅ 적용됨 | 완료 |
| `saveSalesSettlementApi()` | 매출 마감 저장 | ✅ 적용됨 | 완료 |
| `getPurchaseSettlementsApi()` | 매입 마감 목록 | ✅ 적용됨 | **완료** ⭐ |
| `getSalesSettlementsApi()` | 매출 마감 목록 | ✅ 적용됨 | **완료** ⭐ |
| `aggregateBillingDataApi()` | 청구서 집계 | ✅ 적용됨 | 완료 |
| `createBillingApi()` | 청구서 생성 | ✅ 적용됨 | 완료 |
| `getBillingsApi()` | 청구서 목록 | ✅ 적용됨 | 완료 |
| `updateBillingStatusApi()` | 청구서 상태 변경 | ✅ 적용됨 | 완료 |
| `executeMonthlyClosingApi()` | 월별 마감 실행 | ✅ 적용됨 | 완료 |
| `unlockMonthlyClosingApi()` | 월별 마감 해제 | ✅ 적용됨 | 완료 |
| `getMonthlyClosingsApi()` | 월별 마감 목록 | ✅ 적용됨 | 완료 |
| `aggregateInvoiceDataApi()` | 청구서 데이터 집계 | ✅ 적용됨 | UI 미연결 |
| `createInvoiceFromSettlementApi()` | 마감→청구서 생성 | ✅ 적용됨 | UI 미연결 |
| `getInvoicesApi()` | 청구서 목록 (상세) | ✅ 적용됨 | UI 미연결 |
| `updateInvoiceStatusApi()` | 청구서 상태 변경 | ✅ 적용됨 | UI 미연결 |
| `getSettlementDetailApi()` | 마감 상세 조회 | ✅ 적용됨 | **완료** ⭐ NEW |
| `reprintInvoiceApi()` | 청구서 재출력 (PDF) | ✅ 적용됨 | **완료** ⭐ NEW |
| `getCustomers()` | 발주처 목록 조회 (통합) | ✅ 적용됨 | **완료** ⭐ 개선 |

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

### Issue #002: 발주 상세보기 모달 오류 (2025-12-05)

**증상**:
- 발주내역 페이지에서 상세보기 클릭 시 "알수없는 오류" 메시지 표시
- 콘솔 및 실행창에 오류 메시지 없음

**원인 분석**:

1. **직접적 원인**: `getOrderDetail()` 함수가 `safeReturn()` 래퍼 없이 직접 호출됨
   ```javascript
   // CommonScripts.html (수정 전)
   google.script.run
     .withSuccessHandler(...)
     .getOrderDetail(orderCode);  // ❌ safeReturn 미적용
   ```

2. **근본 원인**: API 함수 명명 규칙 미준수
   - 다른 API 함수들: `getBillingsApi()`, `getPurchaseSettlementsApi()` 등 `xxxApi` 패턴 사용
   - 문제 함수: `getOrderDetail()` - 내부 로직 함수를 직접 호출

3. **왜 "알수없는 오류"가 표시되었나?**
   - Google Apps Script에서 Date 객체가 포함된 데이터 반환 시 직렬화 실패
   - 직렬화 실패 시 클라이언트에 `null` 반환
   - 클라이언트 코드에서 `result`가 `null`일 때 "알 수 없는 오류" 표시
   ```javascript
   if (!result || !result.success) {
     alert('상세 조회 실패: ' + (result ? result.error : '알 수 없는 오류'));
   }
   ```

**해결**:

1. **ApiService.js** - 래퍼 함수 추가
   ```javascript
   /**
    * 발주 상세 조회 (클라이언트용 래퍼)
    */
   function getOrderDetailApi(orderId) {
     var result = getOrderDetail(orderId);
     return safeReturn(result);  // ✅ Date 객체 직렬화 적용
   }
   ```

2. **CommonScripts.html** - API 호출 변경
   ```javascript
   google.script.run
     .withSuccessHandler(...)
     .getOrderDetailApi(orderCode);  // ✅ 래퍼 함수 호출
   ```

**영향 파일**:
- ApiService.js (getOrderDetailApi 함수 추가)
- CommonScripts.html (API 호출 변경)

**교훈**:
- 모든 클라이언트 호출 API 함수는 반드시 `xxxApi` 패턴을 따를 것
- 기존 내부 로직 함수를 클라이언트에서 직접 호출하지 말 것
- 새 API 추가 시 safeReturn 적용 여부 반드시 확인

---

### Issue #003: 확정수량 수정, 4개 상태 저장, 마진 정보 누락 (2025-12-06) ⭐ NEW

**증상**:
1. 발주 상세보기 모달에서 확정수량 수정 불가
2. 상태정보 변경 후 저장 시 출고상태만 적용, 매입발주/매입결제/매출결제 상태 미적용
3. 발주내역 상세보기에서 마진액/마진율 정보 미표시

**원인 분석**:

1. **확정수량 수정 불가**
   - TransactionService.js에 `updateConfirmedQuantities()` 함수 존재
   - ApiService.js에 `updateConfirmedQuantitiesApi()` 래퍼 존재
   - **문제**: UI에서 호출하는 코드가 없었음 (확정수량이 단순 텍스트로 표시)

2. **상태 저장 문제**
   - `updateOrderStatus(orderId, status)` 함수가 단일 상태(출고)만 저장하도록 구현
   - 4개 상태 컬럼 모두 업데이트하는 로직 없음
   ```javascript
   // 수정 전
   var colStatus = header.indexOf('출고');  // 출고 컬럼만 참조
   ```

3. **마진 정보 누락**
   - 상세보기 모달 테이블에 마진액/마진율 컬럼 없음
   - 합계 행에도 마진 정보 없음

**해결**:

1. **확정수량 수정 기능 구현** (CommonScripts.html)
   ```javascript
   // 확정수량을 input 필드로 변경
   html += '<td class="text-right"><input type="number" class="confirmed-qty-input" value="' + confirmedQty + '" ... /></td>';

   // 실시간 금액 재계산
   input.addEventListener('input', function() {
     var purchaseAmt = qty * buyPrice;
     var supplyAmt = qty * supplyPrice;
     var marginAmt = supplyAmt - purchaseAmt;
     // ... 테이블 업데이트
   });

   // 저장 버튼 → updateConfirmedQuantitiesApi 호출
   google.script.run.updateConfirmedQuantitiesApi({ updates: updates });
   ```

2. **updateOrderStatus 함수 수정** (ApiService.js)
   ```javascript
   // 수정 후 - 4개 상태 모두 저장
   function updateOrderStatus(orderId, statuses) {
     // 하위 호환: 문자열로 전달된 경우 출고 상태로 처리
     if (typeof statuses === 'string') {
       statuses = { ship: statuses };
     }

     var colMap = {
       buyOrder: header.indexOf('매입발주'),
       payBuy: header.indexOf('매입결제'),
       paySell: header.indexOf('매출결제'),
       ship: header.indexOf('출고')
     };

     // 각 상태 업데이트
     for (var key in statuses) {
       if (colMap[key] >= 0) {
         sheet.getRange(i + 1, colMap[key] + 1).setValue(statuses[key]);
       }
     }
   }
   ```

3. **마진 정보 표시** (CommonScripts.html)
   ```javascript
   // 테이블 헤더에 마진액/마진율 추가
   html += '<th class="text-right">마진액</th>';
   html += '<th class="text-right">마진율</th>';

   // 데이터 행에 마진 정보 추가 (양수:녹색, 음수:빨간색)
   html += '<td class="text-right margin-amount" style="color: ' +
           (marginAmount >= 0 ? '#059669' : '#dc2626') + ';">₩' +
           formatNumber(marginAmount) + '</td>';
   ```

**영향 파일**:
- ApiService.js (updateOrderStatus 함수 수정)
- CommonScripts.html (상세보기 모달 전체 개선)

**관련 커밋**: `b4e0773`

---

### Issue #004: 매입/매출 마감 기능 개선 (2025-12-06) ⭐ NEW

**증상**:
1. 매입/매출 마감 페이지에서 업체명(매입처/발주처) 입력 필수 - 전체 조회 불가
2. 이전에 저장한 마감 내역 조회 기능 없음

**원인 분석**:

1. **검색조건 문제**
   ```javascript
   // 수정 전 - 업체명 필수 입력
   if (!supplier) {
     alert('매입처를 입력해주세요.');
     return;
   }
   ```
   - API(`aggregatePurchaseOrders`)는 이미 업체명 없이 전체 조회 지원
   - UI에서만 필수 조건 체크

2. **마감 내역 조회 기능 누락**
   - `getPurchaseSettlementsApi`, `getSalesSettlementsApi` 함수 정의됨
   - UI에서 호출하는 코드 없음

**해결**:

1. **검색조건 개선** (CommonScripts.html)
   ```javascript
   // 수정 후 - 업체명 필수 조건 제거
   // if (!supplier) { ... }  // 삭제

   console.log('📋 매입 마감 조회:', {supplier: supplier || '전체', startDate, endDate});
   ```

2. **마감 내역 탭 UI 추가** (Page_PurchaseSettlement.html, Page_SalesSettlement.html)
   ```html
   <!-- 탭 네비게이션 -->
   <div class="settlement-tabs">
     <button class="settlement-tab active" data-tab="new">📝 신규 마감</button>
     <button class="settlement-tab" data-tab="history">📋 마감 내역</button>
   </div>

   <!-- 마감 내역 탭 -->
   <div class="settlement-tab-content" id="purchase-settlement-tab-history">
     <!-- 마감 내역 테이블 -->
   </div>
   ```

3. **마감 내역 조회 기능** (CommonScripts.html)
   ```javascript
   // 탭 전환 기능
   tabs.forEach(function(tab) {
     tab.addEventListener('click', function() {
       // 탭 전환 로직
     });
   });

   // 마감 내역 조회
   google.script.run
     .withSuccessHandler(renderHistoryTable)
     .getPurchaseSettlementsApi({ type: 'PURCHASE' });
   ```

**영향 파일**:
- CommonScripts.html (검색조건 변경, 탭 기능, 마감 내역 조회)
- Page_PurchaseSettlement.html (탭 UI, CSS 추가)
- Page_SalesSettlement.html (탭 UI, CSS 추가)

**관련 커밋**: `be9dd10`

---

## 6.2 알려진 이슈 (미해결)

| ID | 이슈 | 우선순위 | 상태 |
|----|------|----------|------|
| #007 | ping() 함수 Date 객체 반환 | 낮음 | 수정 필요 |

---

## 6.3 Codex 통합으로 해결된 이슈 (2025-12-06) ⭐ NEW

### Issue #005: Page_OrderFile.html 스크립트 분리 ✅ RESOLVED

**증상**: Page_OrderFile.html에 `<script>` 태그가 존재하여 아키텍처 규칙 위반

**해결**:
- Page_OrderFile.html에서 `<script>` 블록 전체 제거 (373~835줄, 약 462줄)
- CommonScripts.html에 `OB.initOrderFilePage()` 함수로 이동 (3152~3531줄, 약 380줄)
- 기존 로직 100% 보존, 아키텍처 규칙 준수

**변경 파일**:
- Page_OrderFile.html: 834줄 → 371줄 (스크립트 제거)
- CommonScripts.html: `OB.initOrderFilePage()` 함수 추가

---

### Issue #006: getCustomers() 함수 중복 정의 ✅ RESOLVED

**증상**: `getCustomers()` 함수가 OrderParsingService.js와 ApiService.js에 중복 정의

**해결**:
- OrderParsingService.js에서 중복 함수 제거 (671~758줄)
- ApiService.js의 `getCustomers()` 함수 개선
  - '발주처' 타입 필터링 추가
  - 반환값 구조화: `{ data: [...], customers: [...] }`

**변경 파일**:
- OrderParsingService.js: 중복 함수 제거 + 주석 추가 "getCustomers() 함수는 ApiService.js로 이동됨"
- ApiService.js: getCustomers() 함수 개선

```javascript
// ApiService.js - 개선된 getCustomers()
function getCustomers() {
  var sheet = SpreadsheetApp.openById(ERP_CONFIG.BASE_DATA_SHEET_ID)
    .getSheetByName('거래처DB');
  var data = sheet.getDataRange().getValues();
  var header = data[0];
  var typeIdx = header.indexOf('유형');

  // '발주처' 타입만 필터링
  var customers = data.slice(1).filter(function(row) {
    return row[typeIdx] === '발주처';
  });

  return safeReturn({
    success: true,
    data: data,
    customers: customers
  });
}
```

---

### Issue #008: 청구서 재출력 기능 ✅ RESOLVED

**증상**: 청구서 재출력 기능 미구현

**해결**:
- InvoiceService.js에 `reprintInvoice()` 함수 추가
- ApiService.js에 `reprintInvoiceApi()` 래퍼 함수 추가
- BillingManagement 페이지의 재출력 버튼에 기능 연결

**구현 코드**:
```javascript
// InvoiceService.js
function reprintInvoice(params) {
  var settlementId = params.settlementId;

  // 마감 상세 데이터 조회
  var detail = getSettlementDetail({ settlementId: settlementId });
  if (!detail.success) {
    return { success: false, error: detail.error };
  }

  // PDF 재생성
  var invoiceResult = generateInvoiceZip({
    orderNumbers: detail.orderNumbers,
    // ... 기타 파라미터
  });

  return {
    success: true,
    fileId: invoiceResult.fileId,
    fileName: invoiceResult.fileName
  };
}

// ApiService.js
function reprintInvoiceApi(params) {
  var result = reprintInvoice(params);
  return safeReturn(result);
}
```

**변경 파일**:
- InvoiceService.js: reprintInvoice() 함수 추가
- ApiService.js: reprintInvoiceApi() 래퍼 추가
- CommonScripts.html: BillingManagement 재출력 버튼 이벤트 연결

---

### Issue #009: Invoice APIs UI 연결 ✅ RESOLVED

**증상**: getInvoicesApi, aggregateInvoiceDataApi 등 인보이스 관련 API가 UI와 미연결

**해결**:
- Page_InvoiceManagement.html 신규 생성 (202줄)
- CommonScripts.html에 `OB.initInvoiceManagementPage()` 함수 추가 (약 315줄)
- Component_Sidebar.html에 "인보이스 관리" 메뉴 추가
- UiService.js, Layout.html에 라우팅 추가

**Page_InvoiceManagement.html 구조**:
```
┌─────────────────────────────────────────────────────┐
│  인보이스 관리 페이지                                │
├─────────────────────────────────────────────────────┤
│  [Panel 1] 데이터 집계                              │
│  - 기간 선택, 거래처 선택, 집계 버튼                 │
│  - 집계 결과 테이블                                 │
├─────────────────────────────────────────────────────┤
│  [Panel 2] 인보이스 생성                            │
│  - 선택된 마감 건에서 인보이스 생성                  │
├─────────────────────────────────────────────────────┤
│  [Panel 3] 인보이스 목록                            │
│  - 생성된 인보이스 목록, 상태 관리, PDF 다운로드     │
└─────────────────────────────────────────────────────┘
```

**OB.initInvoiceManagementPage() 주요 기능**:
```javascript
OB.initInvoiceManagementPage = function() {
  // 1. 데이터 집계 (aggregateInvoiceDataApi 호출)
  // 2. 인보이스 생성 (createInvoiceFromSettlementApi 호출)
  // 3. 인보이스 목록 조회 (getInvoicesApi 호출)
  // 4. 상태 변경 (updateInvoiceStatusApi 호출)
  // 5. PDF 다운로드 링크 생성
};
```

---

### Issue #010: Transaction APIs UI 연결 ✅ RESOLVED

**증상**: getTransactionsApi, updateTransactionStateApi 등 거래원장 API가 UI와 미연결

**해결**:
- Page_TransactionLedger.html 신규 생성 (116줄)
- CommonScripts.html에 `OB.initTransactionLedgerPage()` 함수 추가 (약 235줄)
- Component_Sidebar.html에 "거래원장" 메뉴 추가
- UiService.js, Layout.html에 라우팅 추가

**Page_TransactionLedger.html 구조**:
```
┌─────────────────────────────────────────────────────┐
│  거래원장 페이지                                     │
├─────────────────────────────────────────────────────┤
│  [필터 영역]                                        │
│  - 기간 선택, 발주처/매입처 필터, 상태 필터          │
├─────────────────────────────────────────────────────┤
│  [요약 카드]                                        │
│  - 총 거래건수, 매입액 합계, 공급액 합계, 마진 합계  │
├─────────────────────────────────────────────────────┤
│  [거래 목록 테이블]                                  │
│  - 발주일, 발주번호, 품목, 수량, 금액, 상태 표시     │
│  - 상태 변경 기능                                   │
└─────────────────────────────────────────────────────┘
```

**OB.initTransactionLedgerPage() 주요 기능**:
```javascript
OB.initTransactionLedgerPage = function() {
  // 1. 거래 목록 조회 (getTransactionsApi 호출)
  // 2. 필터링/검색 기능
  // 3. 상태 변경 (updateTransactionStateApi 호출)
  // 4. 요약 카드 계산 및 표시
};
```

---

### Issue #011: 마감 상세보기 기능 ✅ RESOLVED

**증상**: 마감 상세보기 기능(OB.viewSettlementDetail) 미구현

**해결**:
- SettlementService.js에 `getSettlementDetail()` 함수 추가 (약 105줄)
- ApiService.js에 `getSettlementDetailApi()` 래퍼 함수 추가
- Layout.html에 마감 상세 모달 HTML/CSS 추가 (약 90줄)
- CommonScripts.html에 `OB.viewSettlementDetail()` 함수 추가 (약 110줄)

**모달 구조**:
```html
<!-- Layout.html에 추가된 마감 상세 모달 -->
<div id="settlement-detail-modal" class="settlement-modal">
  <div class="settlement-modal-content">
    <div class="settlement-modal-header">
      <h3>마감 상세보기</h3>
      <button class="settlement-modal-close">&times;</button>
    </div>
    <div class="settlement-modal-body">
      <!-- 마감 정보 요약 -->
      <div class="settlement-summary">...</div>
      <!-- 상세 거래 목록 테이블 -->
      <table class="settlement-detail-table">...</table>
    </div>
    <div class="settlement-modal-footer">
      <button class="btn-reprint">재출력</button>
      <button class="btn-close">닫기</button>
    </div>
  </div>
</div>
```

**OB.viewSettlementDetail() 구현**:
```javascript
OB.viewSettlementDetail = function(settlementId) {
  var modal = document.getElementById('settlement-detail-modal');

  // 로딩 표시
  OB.showLoading('마감 상세 조회 중...');

  google.script.run
    .withSuccessHandler(function(result) {
      OB.hideLoading();
      if (result.success) {
        // 모달 내용 렌더링
        renderSettlementDetail(result.data);
        modal.style.display = 'flex';
      } else {
        alert('조회 실패: ' + result.error);
      }
    })
    .withFailureHandler(function(error) {
      OB.hideLoading();
      alert('서버 오류: ' + error.message);
    })
    .getSettlementDetailApi({ settlementId: settlementId });
};
```

**변경 파일**:
- SettlementService.js: getSettlementDetail() 함수 추가
- ApiService.js: getSettlementDetailApi() 래퍼 추가
- Layout.html: 마감 상세 모달 HTML/CSS 추가
- CommonScripts.html: OB.viewSettlementDetail() 함수 추가

---

# PART 6B: 2-TRACK 청구서 시스템 (Phase 1-2) ⭐ NEW

## 개요

2-Track 청구서 시스템은 기존의 **마감 기반 청구서 생성 (Track B - Batch)**에 더해, **거래원장에서 직접 청구서 생성 (Track A - Fast Path)**을 지원합니다.

### Track 비교

| 항목 | Track A (Fast Path) | Track B (Batch) |
|------|---------------------|-----------------|
| **시작점** | 거래원장 | 마감 관리 |
| **필수 단계** | 없음 (즉시 생성) | 마감 필수 |
| **사용 시나리오** | 긴급 청구서, 소량 거래 | 정기 마감, 대량 청구 |
| **청구타입** | `DIRECT` | `SETTLEMENT` |
| **발주번호 참조** | JSON 배열 저장 | settlementId 참조 |

---

## Phase 1: 2-Track 청구서 생성

### 1.1 InvoiceService.js 수정

**`createInvoiceFromSettlement()` 함수**가 두 가지 경로를 모두 처리:

```javascript
function createInvoiceFromSettlement(params) {
  var settlementId = params.settlementId;      // Track B
  var orderNumbers = params.orderNumbers;      // Track A

  // 파라미터 검증: 둘 중 하나는 필수
  if (!settlementId && (!orderNumbers || orderNumbers.length === 0)) {
    return { success: false, error: '마감ID 또는 발주번호가 필요합니다.' };
  }

  // billingType 자동 결정
  var billingType = settlementId ? 'SETTLEMENT' : 'DIRECT';

  // Track A: 거래원장에서 금액 자동 계산
  if (billingType === 'DIRECT' && (!params.amount || params.amount === 0)) {
    var sheet = getOrderMergedSheet();
    var data = sheet.getDataRange().getValues();
    var header = data[0];
    var totalAmount = 0;

    // orderNumbers의 공급액 합계
    for (var i = 1; i < data.length; i++) {
      var orderNo = data[i][header.indexOf('발주번호')];
      if (orderNumbers.indexOf(orderNo) !== -1) {
        totalAmount += Number(data[i][header.indexOf('공급액')] || 0);
      }
    }
    params.amount = totalAmount;
  }

  // 청구DB에 저장
  var invoiceData = {
    invoiceId: generateInvoiceId(),
    company: params.company,
    type: params.type,
    amount: params.amount,
    invoiceDate: params.invoiceDate || new Date(),
    billingType: billingType,              // ⭐ NEW
    settlementId: settlementId || '',      // Track B
    orderNumbers: JSON.stringify(orderNumbers || []),  // ⭐ Track A
    status: 'DRAFT',
    createdAt: new Date().toISOString()
  };

  // ... 저장 로직
}
```

### 1.2 API 함수

```javascript
// ApiService.js

/**
 * Track A 전용 API (발주번호 기반 직접 청구서 생성)
 */
function createDirectBillingApi(params) {
  var result = createInvoiceFromSettlement(params);
  return safeReturn(result);
}

/**
 * 청구서 존재 여부 확인
 */
function checkInvoiceExistsApi(params) {
  var result = checkInvoiceExists(params);
  return safeReturn(result);
}
```

---

## Phase 2: 컨텍스트 기반 네비게이션

### 2.1 Smart Navigation 흐름

```
[거래원장] 발주번호 행 → "청구서" 버튼 클릭
    ↓
checkInvoiceExists(orderNumber) 호출
    ↓
┌─────────────────┬─────────────────┐
│ 청구서 존재     │ 청구서 없음     │
├─────────────────┼─────────────────┤
│ Alert: 기존 청구서│ Confirm: 생성?  │
│ "확인" 클릭     │ "예" → 생성     │
│     ↓           │     ↓           │
│ billingManagement│ createDirect   │
│ 페이지로 이동   │ Billing        │
│ + 자동 필터링   │ + 페이지 이동  │
└─────────────────┴─────────────────┘
```

### 2.2 구현 코드

```javascript
// CommonScripts.html

OB.navigateToInvoice = function(orderNumber, company) {
  OB.showLoading('청구서 확인 중...');

  google.script.run
    .withSuccessHandler(function(result) {
      OB.hideLoading();

      if (!result.success) {
        alert('오류: ' + result.error);
        return;
      }

      if (result.exists) {
        // 청구서 존재 → 이동
        var invoiceList = result.invoices.map(function(inv) {
          return inv.invoiceId + ' (' + inv.status + ')';
        }).join(', ');

        alert('기존 청구서가 있습니다:\n' + invoiceList);

        // 페이지 이동 + 필터 설정
        OB.state.pendingInvoiceFilter = {
          orderNumber: orderNumber,
          company: company
        };
        OB.api.loadPage('billingManagement');

      } else {
        // 청구서 없음 → 생성 제안
        if (confirm('청구서가 없습니다. 즉시 생성하시겠습니까?')) {
          OB.createDirectInvoiceForOrder(orderNumber, company);
        }
      }
    })
    .withFailureHandler(function(error) {
      OB.hideLoading();
      alert('오류: ' + error.message);
    })
    .checkInvoiceExistsApi({ orderNumber: orderNumber });
};

OB.createDirectInvoiceForOrder = function(orderNumber, company) {
  OB.showLoading('청구서 생성 중...');

  google.script.run
    .withSuccessHandler(function(result) {
      OB.hideLoading();

      if (result.success) {
        alert('청구서가 생성되었습니다!\n청구서 ID: ' + result.invoiceId);
        OB.api.loadPage('billingManagement');
      } else {
        alert('생성 실패: ' + result.error);
      }
    })
    .withFailureHandler(function(error) {
      OB.hideLoading();
      alert('오류: ' + error.message);
    })
    .createDirectBillingApi({
      orderNumbers: [orderNumber],
      company: company,
      type: 'SALES'
    });
};
```

---

## 데이터 구조 변경

### 청구DB 컬럼 추가

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| invoiceId | String | 청구서 ID |
| **billingType** ⭐ | String | `SETTLEMENT` or `DIRECT` |
| **orderNumbers** ⭐ | String | JSON 배열 (Track A 전용) |
| settlementId | String | 마감 ID (Track B 전용) |
| company | String | 거래처명 |
| type | String | `PURCHASE` or `SALES` |
| amount | Number | 청구 금액 |
| invoiceDate | String | 청구일 (ISO) |
| status | String | `DRAFT`, `ISSUED`, `PAID` |
| createdAt | String | 생성일시 (ISO) |

---

# PART 6C: 거래원장 페이지 표준 구조 ⭐ NEW

## 개요

거래원장 페이지는 **4개 상태 컬럼**을 모두 표시하고 관리해야 합니다.

## Page_TransactionLedger.html 올바른 구조

### HTML 테이블 헤더

```html
<thead>
  <tr>
    <th>발주일</th>
    <th>발주번호</th>
    <th>발주처</th>
    <th>브랜드</th>
    <th>품목코드</th>
    <th>제품명</th>
    <th class="num">발주수량</th>
    <th class="num">확정수량</th>
    <th class="num">공급가</th>
    <th class="num">공급액</th>
    <!-- ⭐ 4개 상태 컬럼 -->
    <th>매입발주</th>
    <th>매입결제</th>
    <th>매출결제</th>
    <th>출고</th>
    <th>액션</th>
  </tr>
</thead>
```

### JavaScript 렌더링 (품목별 표시)

```javascript
// CommonScripts.html - OB.initTransactionLedgerPage()

function renderTable() {
  state.filtered.forEach(function(tx) {
    var tr = document.createElement('tr');

    // ... 기본 컬럼 렌더링

    // ⭐ 4개 상태 컬럼 - 드롭다운으로 표시
    var statuses = ['매입발주', '매입결제', '매출결제', '출고'];
    var statusKeys = ['buyOrder', 'payBuy', 'paySell', 'ship'];

    statuses.forEach(function(statusName, idx) {
      var td = document.createElement('td');
      var select = document.createElement('select');
      select.className = 'status-select';
      select.dataset.statusKey = statusKeys[idx];
      select.dataset.orderCode = tx['발주번호'];

      var options = ['미처리', '진행중', '완료', '취소'];
      options.forEach(function(opt) {
        var option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (tx[statusName] === opt) {
          option.selected = true;
        }
        select.appendChild(option);
      });

      td.appendChild(select);
      tr.appendChild(td);
    });

    // 액션 버튼
    var actionTd = document.createElement('td');
    var saveBtn = document.createElement('button');
    saveBtn.textContent = '상태 저장';
    saveBtn.className = 'ledger-btn primary';
    saveBtn.addEventListener('click', function() {
      saveRowStatuses(tr);
    });
    actionTd.appendChild(saveBtn);

    var invoiceBtn = document.createElement('button');
    invoiceBtn.textContent = '청구서';
    invoiceBtn.className = 'ledger-btn secondary';
    invoiceBtn.addEventListener('click', function() {
      OB.navigateToInvoice(tx['발주번호'], tx['발주처']);
    });
    actionTd.appendChild(invoiceBtn);

    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

function saveRowStatuses(tr) {
  var selects = tr.querySelectorAll('.status-select');
  var orderCode = selects[0].dataset.orderCode;
  var statuses = {};

  selects.forEach(function(select) {
    statuses[select.dataset.statusKey] = select.value;
  });

  OB.showLoading('상태 저장 중...');

  google.script.run
    .withSuccessHandler(function(result) {
      OB.hideLoading();
      if (result.success) {
        alert('상태가 저장되었습니다.');
      } else {
        alert('저장 실패: ' + result.error);
      }
    })
    .withFailureHandler(function(error) {
      OB.hideLoading();
      alert('오류: ' + error.message);
    })
    .updateOrderStatus(orderCode, statuses);
}
```

### 거래번호 단위 집계 표시 (Phase 4 목표)

```javascript
// 발주번호별로 그룹핑
function aggregateByOrderNumber() {
  var groups = {};

  state.filtered.forEach(function(tx) {
    var orderNo = tx['발주번호'];
    if (!groups[orderNo]) {
      groups[orderNo] = {
        orderNo: orderNo,
        orderDate: tx['발주일'],
        buyer: tx['발주처'],
        supplier: tx['매입처'],
        brand: tx['브랜드'],
        itemCount: 0,
        totalAmount: 0,
        buyOrder: tx['매입발주'],
        payBuy: tx['매입결제'],
        paySell: tx['매출결제'],
        ship: tx['출고'],
        items: []
      };
    }

    groups[orderNo].itemCount++;
    groups[orderNo].totalAmount += Number(tx['공급액'] || 0);
    groups[orderNo].items.push(tx);
  });

  return Object.values(groups);
}

// 집계 테이블 렌더링
function renderAggregatedTable() {
  var groups = aggregateByOrderNumber();

  groups.forEach(function(group) {
    var tr = document.createElement('tr');
    tr.className = 'aggregated-row';
    tr.dataset.orderNo = group.orderNo;

    // 클릭 → 상세 모달
    tr.addEventListener('click', function() {
      showOrderDetailModal(group);
    });

    // 발주번호, 발주처, 품목수, 금액, 4개 상태
    // ...
  });
}

function showOrderDetailModal(group) {
  // 모달에 group.items 표시
  // 각 품목별 상세 정보
  // 4개 상태 일괄 변경 기능
}
```

---

# PART 7: FUTURE ROADMAP

## 7.1 v2.3 개발 완료 항목 ✅

- [x] Page_OrderFile.html 스크립트 CommonScripts로 이동 (Issue #005)
- [x] getCustomers() 함수 중복 제거 및 통합 (Issue #006)
- [x] 청구서 재출력 기능 구현 (Issue #008)
- [x] Invoice APIs UI 연결 - Page_InvoiceManagement.html (Issue #009)
- [x] Transaction APIs UI 연결 - Page_TransactionLedger.html (Issue #010)
- [x] 마감 상세보기 모달 구현 (Issue #011)

## 7.2 테스트 진행 중 (v2.3) 🔄

- [ ] 거래원장 페이지 기능 검증
- [ ] 인보이스 관리 페이지 기능 검증
- [ ] 마감 상세보기 모달 동작 확인
- [ ] 청구서 재출력 기능 테스트
- [ ] 발주입력 페이지 정상 동작 확인 (스크립트 이동 후)

## 7.3 단기 계획 (v2.4)

- [ ] 모든 API 함수에 safeReturn() 적용 확인
- [ ] ping() 함수 Date 객체 반환 수정 (Issue #007)
- [ ] 에러 처리 표준화
- [ ] 로딩 상태 UX 개선

## 7.4 중기 계획 (v3.0)

- [ ] Utils.gs 공통 유틸리티 분리
- [ ] 단위 테스트 도입
- [ ] 코드 문서화 (JSDoc)
- [ ] Page_Settings 기능 구현
- [ ] 마감/청구서 기능 고도화

## 7.5 장기 계획

- [ ] Supabase/MySQL 데이터 이관
- [ ] Full SPA 전환 (React/Vue)
- [ ] 확정수량 회신 포털
- [ ] 자동 매입결제 스케줄링
- [ ] AI 기반 발주 예측

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

# PART 7: UI/UX PATTERN TEMPLATES

> 💡 **목적**: 거래원장을 기준으로 확립된 UI/UX 패턴을 다른 메뉴(청구서 관리, 매출/매입 마감 등)에서 **재사용 가능한 템플릿**으로 정의

## 7.1 거래원장 패턴 (표준 템플릿)

### 7.1.1 레이아웃 구조 (4단 구성)

```
┌─────────────────────────────────────────────────────────────┐
│ [1] 검색 필터 영역                                           │
│ ┌─────────┬─────────┬─────────┬──────────────┬────┬─────┐  │
│ │발주처   │상태     │발주번호 │기간 범위      │조회│초기화│ │
│ └─────────┴─────────┴─────────┴──────────────┴────┴─────┘  │
├─────────────────────────────────────────────────────────────┤
│ [2] 요약 정보 (Summary Cards)                                │
│ ┌───────────┬───────────┬───────────┬──────────────┐        │
│ │조회건수   │발주수량   │확정수량   │공급액        │        │
│ │ 15건      │ 1,500     │ 1,450     │ ₩15,000,000  │        │
│ └───────────┴───────────┴───────────┴──────────────┘        │
├─────────────────────────────────────────────────────────────┤
│ [3] 일괄 작업 버튼 (체크박스 선택 시 활성화)                 │
│ [0건 선택 - 청구서 생성] [선택 항목 상태 변경]              │
├─────────────────────────────────────────────────────────────┤
│ [4] 데이터 테이블 (체크박스 + 집계 데이터)                   │
│ ┌─┬────┬──────┬────┬───┬──┬──┬───┬───┬───┬───┬────┐      │
│ │☑│일자│번호  │처  │브 │량│확│입 │공 │마 │마 │상태│      │
│ ├─┼────┼──────┼────┼───┼──┼──┼───┼───┼───┼───┼────┤      │
│ │☐│0115│ABC-1│ABC │A  │100│95│950│1.2│250│20%│✓✗✓✗│      │
│ │☐│0115│ABC-2│ABC │B  │200│200│2.0│2.5│500│20%│✓✓✓✗│      │
│ └─┴────┴──────┴────┴───┴──┴──┴───┴───┴───┴───┴────┘      │
└─────────────────────────────────────────────────────────────┘
```

**핵심 요소:**
- **검색 필터**: 발주처, 상태, 발주번호, 기간 범위 (입력 → 조회 → 필터링)
- **요약 카드**: 조회 결과의 집계 정보 (건수, 수량, 금액)
- **일괄 버튼**: 체크박스 선택 개수에 따라 `disabled` 속성 제어
- **테이블**: 발주번호 단위 집계 데이터 (품목별 행 → 발주번호 단위 합산)

---

### 7.1.2 테이블 + 체크박스 패턴

**구조:**
```html
<!-- HTML 구조 -->
<table>
  <thead>
    <tr>
      <th><input type="checkbox" id="select-all"></th>
      <th>컬럼1</th>
      <th>컬럼2</th>
    </tr>
  </thead>
  <tbody id="data-tbody">
    <!-- JavaScript로 동적 생성 -->
  </tbody>
</table>

<!-- 일괄 버튼 (초기 disabled) -->
<button id="bulk-btn-1" disabled>선택 항목 처리</button>
```

**JavaScript 패턴:**
```javascript
// 1. 전체 선택 체크박스
selectAllCheckbox.addEventListener('change', function() {
  var checkboxes = document.querySelectorAll('.row-checkbox');
  checkboxes.forEach(function(cb) {
    cb.checked = selectAllCheckbox.checked;
  });
  updateBulkButtons();
});

// 2. 개별 체크박스 변경
tbody.addEventListener('change', function(e) {
  if (e.target.classList.contains('row-checkbox')) {
    updateBulkButtons();
  }
});

// 3. 일괄 버튼 활성화/비활성화
function updateBulkButtons() {
  var checked = document.querySelectorAll('.row-checkbox:checked');
  bulkBtn.disabled = checked.length === 0;

  // 전체 선택 상태 업데이트
  var total = document.querySelectorAll('.row-checkbox').length;
  selectAllCheckbox.checked = checked.length === total;
  selectAllCheckbox.indeterminate = checked.length > 0 && checked.length < total;
}
```

**핵심 포인트:**
- 체크박스에 `data-*` 속성으로 ID 저장 (예: `data-order-number`)
- 일괄 버튼은 항상 표시, `disabled`로 제어
- `indeterminate` 상태로 부분 선택 표시

---

### 7.1.3 상태 표시 패턴 (✓✗ + 색상 코딩)

**컴팩트 형식:**
```
4개 상태를 1개 셀에 표시:
✓✗✓✗ = [매입발주 완료][매입결제 미완료][매출결제 완료][출고 미완료]
```

**구현:**
```javascript
// 상태 표시 셀 생성
var td = document.createElement('td');
td.style.textAlign = 'center';
td.style.fontFamily = 'monospace';
td.style.fontWeight = 'bold';

// 상태별 심볼 + 색상 반환
function getStatusSymbol(status) {
  if (!status) return { symbol: '✗', color: '#dc2626' }; // 빨간색
  var completed = ['완료', '결제완료', '발주완료', '출고완료'];
  var isCompleted = completed.indexOf(status) !== -1;
  return {
    symbol: isCompleted ? '✓' : '✗',
    color: isCompleted ? '#059669' : '#dc2626' // 초록색 : 빨간색
  };
}

// 4개 상태를 span으로 감싸서 개별 색상 적용
var statuses = [data.buyOrder, data.payBuy, data.paySell, data.ship];
statuses.forEach(function(status) {
  var result = getStatusSymbol(status);
  var span = document.createElement('span');
  span.textContent = result.symbol;
  span.style.color = result.color;
  td.appendChild(span);
});
```

**핵심 포인트:**
- ❌ 툴팁(title) 사용 안 함 (브라우저별 차이)
- ✅ 시각적 색상으로 상태 구분 (초록=완료, 빨강=미완료)
- ✅ 굵게(bold) + monospace 폰트로 가독성 확보

---

### 7.1.4 모달 구조 패턴 (섹션 분리 + 독립 저장)

**구조:**
```
┌──────────────────────────────────────┐
│ 발주번호: 20240115-ABC-A-001         │
├──────────────────────────────────────┤
│ [섹션 1] 상태 변경                   │
│ ┌──────────────────────────────────┐ │
│ │ 매입발주: [▼]  매입결제: [▼]    │ │
│ │ 매출결제: [▼]  출고: [▼]        │ │
│ │          [상태 저장 버튼]        │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ [섹션 2] 품목 상세 (확정수량 편집)   │
│ ┌──────────────────────────────────┐ │
│ │ 품목  | 발주량 | 확정량 | 금액   │ │
│ │ 품목A |   100  | [95]   | ...    │ │
│ │ 품목B |   200  | [200]  | ...    │ │
│ │                                  │ │
│ │      [확정수량 저장] [닫기]      │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

**핵심 포인트:**
- 2개 섹션 분리: 상태 변경 / 데이터 편집
- **독립적 저장 버튼**: 각 섹션마다 별도 저장
  - 이유: 상태만 변경하는 경우가 빈번함 (수량 변경 없이)
- 배경색으로 섹션 구분 (`background:#f8fafc`)

---

### 7.1.5 일괄 작업 패턴 (검증 → API 호출)

**표준 플로우:**
```javascript
bulkActionBtn.addEventListener('click', function() {
  // 1. 선택 검증
  var checkboxes = document.querySelectorAll('.row-checkbox:checked');
  if (checkboxes.length === 0) {
    alert('항목을 선택해주세요.');
    return;
  }

  // 2. 데이터 수집 + 비즈니스 검증
  var orderNumbers = [];
  var companies = {};
  checkboxes.forEach(function(cb) {
    orderNumbers.push(cb.dataset.orderNumber);
    companies[cb.dataset.company] = true;
  });

  // 예: 동일 거래처만 청구서 생성 가능
  if (Object.keys(companies).length > 1) {
    alert('동일한 거래처의 발주만 선택해야 합니다.');
    return;
  }

  // 3. 확인 창
  if (!confirm(orderNumbers.length + '건을 처리하시겠습니까?')) {
    return;
  }

  // 4. API 호출
  OB.showLoading('처리 중...');
  google.script.run
    .withSuccessHandler(function(res) {
      OB.hideLoading();
      if (!res || !res.success) {
        alert('실패: ' + (res ? res.error : '알 수 없는 오류'));
        return;
      }
      alert('완료되었습니다.');
      // 5. 체크박스 해제 + 버튼 비활성화
      checkboxes.forEach(function(cb) { cb.checked = false; });
      updateBulkButtons();
      // 6. 데이터 새로고침
      fetchData();
    })
    .withFailureHandler(function(err) {
      OB.hideLoading();
      alert('실패: ' + err.message);
    })
    .bulkActionApi({ orderNumbers: orderNumbers, ... });
});
```

**핵심 포인트:**
- **5단계 검증**: 선택 여부 → 비즈니스 규칙 → 확인 → API → 후처리
- **에러 핸들링**: success/failure 모두 처리
- **UX**: 로딩 표시 → 완료 메시지 → 체크박스 해제 → 화면 갱신

---

### 7.1.6 백엔드 데이터 처리 패턴 (안전한 행 찾기)

**문제점: rowIndex 기반 업데이트의 위험성**
```javascript
// ❌ 위험한 방식
function updateData(params) {
  var rowIndex = params.rowIndex; // 클라이언트가 행 번호 전달
  sheet.getRange(rowIndex, col).setValue(value); // 동기화 문제 가능
}
```

**해결책: 식별자 기반 안전한 행 찾기**
```javascript
// ✅ 안전한 방식 (거래원장 예시)
function updateConfirmedQuantities(params) {
  var updates = params.updates; // [{ orderNumber, itemCode, confirmedQty }]

  var data = sheet.getDataRange().getValues();
  var header = data[0];
  var colOrderNum = header.indexOf('발주번호');
  var colItemCode = header.indexOf('품목코드');

  updates.forEach(function(update) {
    // 1. 발주번호 + 품목코드로 정확한 행 찾기
    var rowIndex = null;
    var matchCount = 0;

    for (var i = 1; i < data.length; i++) {
      if (data[i][colOrderNum] === update.orderNumber &&
          data[i][colItemCode] === update.itemCode) {
        rowIndex = i + 1; // 1-based
        matchCount++;
      }
    }

    // 2. 안전성 검증
    if (matchCount === 0) {
      errors.push('데이터를 찾을 수 없습니다: ' + update.orderNumber);
      return;
    }
    if (matchCount > 1) {
      errors.push('중복 데이터 ' + matchCount + '건: ' + update.orderNumber);
      return;
    }

    // 3. 정확히 1개만 매칭된 경우에만 업데이트
    sheet.getRange(rowIndex, colConfirmedQty + 1).setValue(update.confirmedQty);
  });
}
```

**핵심 포인트:**
- **복합 키 사용**: 단일 필드가 아니라 여러 필드 조합 (orderNumber + itemCode)
- **중복 검증**: 정확히 1개만 매칭되어야 업데이트 (0개 또는 2개 이상이면 에러)
- **로그 기록**: 성공/실패 모두 Logger.log()로 기록
- **오류 수집**: 개별 업데이트 실패 시 전체 롤백 대신 오류 배열에 수집

---

### 7.1.7 데이터 집계 패턴 (품목 행 → 발주번호 단위)

**시나리오**: 거래원장 시트는 품목별 행이지만, 화면에는 발주번호 단위로 집계해서 표시

**구현:**
```javascript
function renderTable() {
  // 1. 발주번호 단위로 집계
  var aggregated = {};

  rawData.forEach(function(item) {
    var orderNum = item['발주번호'];

    if (!aggregated[orderNum]) {
      aggregated[orderNum] = {
        orderNumber: orderNum,
        orderDate: item['발주일'],
        company: item['발주처'],
        brand: item['브랜드'], // 첫 번째 품목의 브랜드 (발주번호=브랜드 1:1)
        items: [],
        totalOrderQty: 0,
        totalConfirmedQty: 0,
        totalPurchaseAmt: 0,
        totalSupplyAmt: 0
      };
    }

    // 품목 추가
    aggregated[orderNum].items.push(item);

    // 합계 계산
    var confirmedQty = Number(item['확정수량']) || 0;
    aggregated[orderNum].totalConfirmedQty += confirmedQty;
    aggregated[orderNum].totalPurchaseAmt += confirmedQty * (Number(item['매입가']) || 0);
    aggregated[orderNum].totalSupplyAmt += confirmedQty * (Number(item['공급가']) || 0);
  });

  // 2. 마진 계산 (집계 후)
  Object.keys(aggregated).forEach(function(key) {
    var agg = aggregated[key];
    agg.totalMarginAmt = agg.totalSupplyAmt - agg.totalPurchaseAmt;
    agg.marginRate = agg.totalSupplyAmt > 0
      ? ((agg.totalMarginAmt / agg.totalSupplyAmt) * 100).toFixed(1)
      : 0;
  });

  // 3. 테이블 렌더링
  Object.keys(aggregated).forEach(function(orderNum) {
    var agg = aggregated[orderNum];
    var tr = document.createElement('tr');

    // 체크박스 (발주번호 저장)
    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.orderNumber = agg.orderNumber;
    checkbox.dataset.company = agg.company;

    // ... 셀 추가
  });
}
```

**핵심 포인트:**
- **2단계 처리**: 집계 → 파생 계산 (마진, 비율 등)
- **데이터 구조**: 발주번호를 key로 한 객체, items 배열로 품목 보관
- **1:1 필드**: 발주번호 = 브랜드 (첫 품목 값 사용)
- **합계 필드**: 수량, 금액 등은 품목별 합산

---

## 7.2 패턴 적용 가이드

**다른 메뉴에 적용할 때:**

1. **청구서 관리**:
   - 레이아웃: 7.1.1 그대로 적용
   - 체크박스: 7.1.2 패턴 (일괄 발행, 일괄 삭제)
   - 상태 표시: 7.1.3 패턴 (발행 상태 ✓✗)
   - 모달: 청구서 상세 + 상태 변경 섹션 분리

2. **매출/매입 마감**:
   - 레이아웃: 7.1.1 응용 (마감 기간, 거래처 필터)
   - 체크박스: 일괄 마감, 일괄 잠금 해제
   - 상태 표시: 마감 상태 (미마감/마감중/완료/잠금)
   - 모달: 마감 상세 + 항목 편집

3. **발주 관리**:
   - 레이아웃: 7.1.1
   - 체크박스: 일괄 삭제, 일괄 상태 변경
   - 집계 패턴: 7.1.7 (발주번호 단위)

**핵심 원칙:**
- ✅ 사용자 경험 일관성 (같은 패턴 = 학습 비용 감소)
- ✅ 코드 재사용성 (검증된 로직 재활용)
- ✅ 유지보수성 (한 곳 수정 → 다른 곳 참고)

---

# PART 8: 결제관리 시스템

## 8.1. 개요

### 8.1.1. 목적
- **입출금 추적**: 거래처별 입금/출금 내역을 수동으로 기록하고 관리
- **회사비용 관리**: 회사 운영비, 경비 등 비용 항목을 독립적으로 관리
- **문서 연계**: 청구서/매입발주서 문서번호와 결제 내역을 연결하여 추적성 확보
- **회계 기초 데이터**: 추후 회계 장부, 현금흐름표 등의 기초 데이터로 활용

### 8.1.2. 핵심 설계 원칙
- ✅ **수동 입력 방식**: 자동화가 아닌 사용자가 직접 입력/수정/삭제
- ✅ **문서 연결 선택적**: 문서번호 없이도 입출금 기록 가능
- ✅ **히스토리 보존**: 삭제된 데이터도 소프트 삭제로 추후 확인 가능
- ✅ **심플한 UI**: 복잡한 회계 용어 지양, 직관적인 입출금 개념 사용

### 8.1.3. 주요 기능
1. **입출금 내역 관리**
   - 거래처별 입금/출금 기록 추가, 수정, 삭제
   - 문서번호 자동완성으로 청구서와 연결
   - 날짜/거래처/문서번호 필터 검색
   - 요약 통계 (총 입금, 총 출금, 순이익)

2. **회사비용 관리**
   - 비용 항목별 지출 기록
   - 날짜/항목 필터 검색
   - 요약 통계 (항목별 합계)

3. **청구서 이력 관리**
   - 청구서 취소 및 재발급 (확정수량 변경 시)
   - 원본-대체 청구서 연결 관계 추적
   - 취소된 청구서도 히스토리 보존

---

## 8.2. 데이터 구조

### 8.2.1. [결제내역] 시트

**위치**: `발주_통합DB` 스프레드시트 > `결제내역` 시트

**컬럼 구조**:
```
| 컬럼명      | 타입      | 설명                          | 필수 | 예시값                |
|------------|-----------|------------------------------|------|-----------------------|
| 결제ID      | 문자열    | 자동생성 (PAY-YYYYMMDD-001)   | O    | PAY-20251219-001      |
| 결제일      | 날짜      | 입금/출금 발생일               | O    | 2025-12-19            |
| 결제유형    | 문자열    | 입금 또는 출금                 | O    | 입금                  |
| 거래처명    | 문자열    | 거래처 이름                    | O    | A거래처               |
| 금액        | 숫자      | 입금/출금 금액                 | O    | 500000                |
| 결제수단    | 문자열    | 현금/카드/계좌이체/기타        | O    | 계좌이체              |
| 문서번호    | 문자열    | 청구DB의 청구ID (선택)         | X    | INV-20251219-003      |
| 발주번호    | 문자열    | 거래원장의 발주번호 (직접연결) | X    | GMP-20251201-001      |
| 비고        | 문자열    | 메모                           | X    | 1차 부분 결제         |
| 삭제여부    | 논리값    | TRUE/FALSE                     | O    | FALSE                 |
| 삭제일시    | 타임스탬프| 삭제한 시각                    | X    | 2025-12-20 10:30:25   |
| 삭제자      | 문자열    | 삭제한 사용자 이메일           | X    | user@example.com      |
| 입력일시    | 타임스탬프| 생성 시각                      | O    | 2025-12-19 14:30:25   |
| 입력자      | 문자열    | 생성 사용자 이메일             | O    | user@example.com      |
```

**데이터 예시**:
```
결제ID              결제일      결제유형  거래처명  금액      결제수단    문서번호           발주번호         비고        삭제여부  입력일시              입력자
PAY-20251219-001   2025-12-19  입금      A거래처  500000    계좌이체    INV-20251219-003   GMP-20251201-001 1차 부분    FALSE     2025-12-19 14:30:25   user@example.com
PAY-20251218-002   2025-12-18  출금      B공급처  300000    카드        INV-20251210-005   GMP-20251205-002 전액 결제   FALSE     2025-12-18 09:15:10   user@example.com
```

**인덱스/검색 키**:
- 결제일 (날짜 범위 검색)
- 거래처명 (부분 일치 검색)
- 문서번호 (정확 일치)
- 삭제여부 (활성 데이터 필터링)

---

### 8.2.2. [회사비용] 시트

**위치**: `발주_통합DB` 스프레드시트 > `회사비용` 시트

**컬럼 구조**:
```
| 컬럼명      | 타입      | 설명                          | 필수 | 예시값                |
|------------|-----------|------------------------------|------|-----------------------|
| 비용ID      | 문자열    | 자동생성 (EXP-YYYYMMDD-001)   | O    | EXP-20251219-001      |
| 비용일      | 날짜      | 비용 발생일                    | O    | 2025-12-19            |
| 비용항목    | 문자열    | 드롭다운 선택                  | O    | 통신비                |
| 금액        | 숫자      | 비용 금액                      | O    | 50000                 |
| 결제수단    | 문자열    | 현금/카드/계좌이체/기타        | O    | 카드                  |
| 비고        | 문자열    | 메모                           | X    | 사무실 인터넷 요금    |
| 삭제여부    | 논리값    | TRUE/FALSE                     | O    | FALSE                 |
| 삭제일시    | 타임스탬프| 삭제한 시각                    | X    | -                     |
| 삭제자      | 문자열    | 삭제한 사용자 이메일           | X    | -                     |
| 입력일시    | 타임스탬프| 생성 시각                      | O    | 2025-12-19 14:30:25   |
| 입력자      | 문자열    | 생성 사용자 이메일             | O    | user@example.com      |
```

**비용항목 드롭다운 옵션**:
```
- 인건비
- 임차료
- 통신비
- 교통비
- 소모품비
- 접대비
- 광고선전비
- 식비
- 기타
```

**데이터 예시**:
```
비용ID              비용일      비용항목  금액    결제수단    비고                  삭제여부  입력일시              입력자
EXP-20251219-001   2025-12-19  통신비    50000   카드        사무실 인터넷 요금    FALSE     2025-12-19 14:30:25   user@example.com
EXP-20251218-002   2025-12-18  식비      30000   현금        직원 회식             FALSE     2025-12-18 19:00:00   user@example.com
```

---

### 8.2.3. [청구DB] 시트 확장

**기존 컬럼에 추가**:
```
| 컬럼명          | 타입      | 설명                          | 필수 | 예시값                |
|----------------|-----------|------------------------------|------|-----------------------|
| 대체청구서      | 문자열    | 취소 시 새로 발급한 청구서 ID  | X    | INV-20251220-004      |
| 원본청구서      | 문자열    | 재발급 시 원본 청구서 ID       | X    | INV-20251219-003      |
```

**청구서 상태 확장**:
```
기존: DRAFT, ISSUED, PAID
추가: CANCELLED (취소됨)
```

**청구서 취소 후 재발급 예시**:
```
청구ID              청구유형  업체명    청구금액  청구상태   대체청구서         원본청구서         비고
INV-20251219-003   매출      A거래처  1000000   CANCELLED  INV-20251220-004   -                  확정수량 변경으로 취소
INV-20251220-004   매출      A거래처  1200000   ISSUED     -                  INV-20251219-003   수정 청구서
```

---

## 8.3. 백엔드 아키텍처

### 8.3.1. PaymentService.js 함수 목록

**파일 생성**: `PaymentService.js` (새 파일)

**함수 정의**:

#### 입출금 관리
```javascript
/**
 * 입출금 기록 추가
 * @param {Object} params - { date, type, company, amount, method, docNumber, orderNumber, notes }
 * @return {Object} { success, paymentId, message, error }
 */
function addPaymentRecord(params)

/**
 * 입출금 조회 (필터링)
 * @param {Object} params - { type, company, startDate, endDate, docNumber, includeDeleted }
 * @return {Object} { success, payments: [], error }
 */
function getPaymentRecords(params)

/**
 * 입출금 수정
 * @param {Object} params - { paymentId, date, type, company, amount, method, docNumber, orderNumber, notes }
 * @return {Object} { success, message, error }
 */
function updatePaymentRecord(params)

/**
 * 입출금 삭제 (소프트 삭제)
 * @param {Object} params - { paymentId }
 * @return {Object} { success, message, error }
 */
function deletePaymentRecord(params)

/**
 * 입출금 요약 통계
 * @param {Object} params - { startDate, endDate, company }
 * @return {Object} { success, totalIncome, totalExpense, netProfit, error }
 */
function getPaymentSummary(params)

/**
 * 문서번호 자동완성 검색
 * @param {Object} params - { query }
 * @return {Object} { success, suggestions: [{ docNumber, company, date, amount }], error }
 */
function searchDocumentNumbers(params)
```

#### 회사비용 관리
```javascript
/**
 * 비용 기록 추가
 * @param {Object} params - { date, category, amount, method, notes }
 * @return {Object} { success, expenseId, message, error }
 */
function addExpenseRecord(params)

/**
 * 비용 조회 (필터링)
 * @param {Object} params - { category, startDate, endDate, includeDeleted }
 * @return {Object} { success, expenses: [], error }
 */
function getExpenseRecords(params)

/**
 * 비용 수정
 * @param {Object} params - { expenseId, date, category, amount, method, notes }
 * @return {Object} { success, message, error }
 */
function updateExpenseRecord(params)

/**
 * 비용 삭제 (소프트 삭제)
 * @param {Object} params - { expenseId }
 * @return {Object} { success, message, error }
 */
function deleteExpenseRecord(params)

/**
 * 비용 요약 통계
 * @param {Object} params - { startDate, endDate, category }
 * @return {Object} { success, totalExpense, byCategory: {}, error }
 */
function getExpenseSummary(params)
```

#### 청구서 이력 관리
```javascript
/**
 * 청구서 취소 및 재발급
 * @param {Object} params - { invoiceId, reason, newOrderNumbers, newAmount }
 * @return {Object} { success, oldInvoiceId, newInvoiceId, message, error }
 */
function cancelAndReissueInvoice(params)

/**
 * 청구서 이력 조회 (원본-대체 관계 추적)
 * @param {Object} params - { invoiceId }
 * @return {Object} { success, history: [{ invoiceId, status, date, amount, relation }], error }
 */
function getInvoiceHistory(params)
```

#### 유틸리티
```javascript
/**
 * 결제ID 생성 (PAY-YYYYMMDD-001)
 */
function generatePaymentId()

/**
 * 비용ID 생성 (EXP-YYYYMMDD-001)
 */
function generateExpenseId()

/**
 * 소프트 삭제 처리 (공통)
 * @param {Sheet} sheet
 * @param {string} id
 * @param {string} idColumnName
 */
function softDeleteRecord(sheet, id, idColumnName)
```

---

### 8.3.2. API 엔드포인트 (ApiService.js 추가)

**ApiService.js에 추가할 래퍼 함수**:

```javascript
// 입출금 관리
function addPaymentRecordApi(params) { return safeReturn(addPaymentRecord(params)); }
function getPaymentRecordsApi(params) { return safeReturn(getPaymentRecords(params)); }
function updatePaymentRecordApi(params) { return safeReturn(updatePaymentRecord(params)); }
function deletePaymentRecordApi(params) { return safeReturn(deletePaymentRecord(params)); }
function getPaymentSummaryApi(params) { return safeReturn(getPaymentSummary(params)); }
function searchDocumentNumbersApi(params) { return safeReturn(searchDocumentNumbers(params)); }

// 회사비용 관리
function addExpenseRecordApi(params) { return safeReturn(addExpenseRecord(params)); }
function getExpenseRecordsApi(params) { return safeReturn(getExpenseRecords(params)); }
function updateExpenseRecordApi(params) { return safeReturn(updateExpenseRecord(params)); }
function deleteExpenseRecordApi(params) { return safeReturn(deleteExpenseRecord(params)); }
function getExpenseSummaryApi(params) { return safeReturn(getExpenseSummary(params)); }

// 청구서 이력 관리
function cancelAndReissueInvoiceApi(params) { return safeReturn(cancelAndReissueInvoice(params)); }
function getInvoiceHistoryApi(params) { return safeReturn(getInvoiceHistory(params)); }
```

---

## 8.4. 프론트엔드 UI

### 8.4.1. Page_PaymentManagement.html 구조

**파일 생성**: `Page_PaymentManagement.html` (새 파일)

**레이아웃**:
```html
<div class="ob-container">

  <!-- 탭 네비게이션 -->
  <div class="tab-navigation">
    <div class="tab-nav-item active" data-tab="payment-records">
      💰 입출금 내역
    </div>
    <div class="tab-nav-item" data-tab="company-expenses">
      💸 회사비용
    </div>
  </div>

  <!-- ========== 탭 1: 입출금 내역 ========== -->
  <div id="tab-payment-records" class="tab-content active">

    <!-- 검색 필터 -->
    <div class="ob-topbar">
      <label>유형</label>
      <select id="payment-type-filter">
        <option value="">전체</option>
        <option value="입금">입금</option>
        <option value="출금">출금</option>
      </select>

      <label>거래처</label>
      <input id="payment-company-filter" placeholder="거래처명">

      <label>기간</label>
      <input id="payment-start-date" type="date">
      <input id="payment-end-date" type="date">

      <label>문서번호</label>
      <input id="payment-doc-filter" placeholder="INV-...">

      <button id="payment-search-btn" class="ob-btn primary">조회</button>
      <button id="payment-reset-btn" class="ob-btn secondary">초기화</button>
      <button id="payment-add-btn" class="ob-btn success">+ 입출금 기록 추가</button>
    </div>

    <!-- 요약 카드 -->
    <div class="payment-summary">
      <div class="summary-card income">
        <div class="summary-label">총 입금액</div>
        <div class="summary-value" id="payment-total-income">₩0</div>
      </div>
      <div class="summary-card expense">
        <div class="summary-label">총 출금액</div>
        <div class="summary-value" id="payment-total-expense">₩0</div>
      </div>
      <div class="summary-card profit">
        <div class="summary-label">순이익</div>
        <div class="summary-value" id="payment-net-profit">₩0</div>
      </div>
    </div>

    <!-- 테이블 -->
    <div class="ob-table-wrap">
      <table>
        <thead>
          <tr>
            <th>일자</th>
            <th>유형</th>
            <th>거래처</th>
            <th class="num">금액</th>
            <th>결제수단</th>
            <th>문서번호</th>
            <th>비고</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody id="payment-records-tbody">
          <tr><td colspan="8" style="text-align:center;color:#777;padding:40px;">조회 결과가 없습니다.</td></tr>
        </tbody>
      </table>
    </div>

    <!-- 내보내기 버튼 -->
    <div class="export-buttons">
      <button id="payment-export-excel" class="ob-btn secondary">📥 Excel 내보내기</button>
      <button id="payment-export-pdf" class="ob-btn secondary">📄 PDF 내보내기</button>
    </div>

  </div>

  <!-- ========== 탭 2: 회사비용 ========== -->
  <div id="tab-company-expenses" class="tab-content">

    <!-- 검색 필터 -->
    <div class="ob-topbar">
      <label>항목</label>
      <select id="expense-category-filter">
        <option value="">전체</option>
        <option value="인건비">인건비</option>
        <option value="임차료">임차료</option>
        <option value="통신비">통신비</option>
        <option value="교통비">교통비</option>
        <option value="소모품비">소모품비</option>
        <option value="접대비">접대비</option>
        <option value="광고선전비">광고선전비</option>
        <option value="식비">식비</option>
        <option value="기타">기타</option>
      </select>

      <label>기간</label>
      <input id="expense-start-date" type="date">
      <input id="expense-end-date" type="date">

      <button id="expense-search-btn" class="ob-btn primary">조회</button>
      <button id="expense-reset-btn" class="ob-btn secondary">초기화</button>
      <button id="expense-add-btn" class="ob-btn success">+ 비용 추가</button>
    </div>

    <!-- 요약 카드 -->
    <div class="expense-summary">
      <div class="summary-card">
        <div class="summary-label">총 비용</div>
        <div class="summary-value" id="expense-total">₩0</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">항목별 통계</div>
        <div class="summary-detail" id="expense-by-category"></div>
      </div>
    </div>

    <!-- 테이블 -->
    <div class="ob-table-wrap">
      <table>
        <thead>
          <tr>
            <th>일자</th>
            <th>항목</th>
            <th class="num">금액</th>
            <th>결제수단</th>
            <th>비고</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody id="expense-records-tbody">
          <tr><td colspan="6" style="text-align:center;color:#777;padding:40px;">조회 결과가 없습니다.</td></tr>
        </tbody>
      </table>
    </div>

    <!-- 내보내기 버튼 -->
    <div class="export-buttons">
      <button id="expense-export-excel" class="ob-btn secondary">📥 Excel 내보내기</button>
      <button id="expense-export-pdf" class="ob-btn secondary">📄 PDF 내보내기</button>
    </div>

  </div>

</div>

<!-- 입출금 추가/수정 모달 -->
<div id="payment-modal" class="modal">
  <div class="modal-content">
    <div class="modal-header">
      <h3 id="payment-modal-title">입출금 기록 추가</h3>
      <span class="modal-close">&times;</span>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>유형 <span class="required">*</span></label>
        <div class="radio-group">
          <label><input type="radio" name="payment-type" value="입금" checked> 입금</label>
          <label><input type="radio" name="payment-type" value="출금"> 출금</label>
        </div>
      </div>
      <div class="form-group">
        <label>일자 <span class="required">*</span></label>
        <input type="date" id="payment-date-input" required>
      </div>
      <div class="form-group">
        <label>거래처 <span class="required">*</span></label>
        <input type="text" id="payment-company-input" required>
      </div>
      <div class="form-group">
        <label>금액 <span class="required">*</span></label>
        <input type="number" id="payment-amount-input" min="0" required>
      </div>
      <div class="form-group">
        <label>결제수단 <span class="required">*</span></label>
        <select id="payment-method-input" required>
          <option value="현금">현금</option>
          <option value="카드">카드</option>
          <option value="계좌이체">계좌이체</option>
          <option value="기타">기타</option>
        </select>
      </div>
      <div class="form-group">
        <label>문서번호 (선택)</label>
        <input type="text" id="payment-doc-input" placeholder="INV-..." autocomplete="off">
        <div id="payment-doc-suggestions" class="autocomplete-suggestions"></div>
      </div>
      <div class="form-group">
        <label>비고</label>
        <input type="text" id="payment-notes-input">
      </div>
    </div>
    <div class="modal-footer">
      <button id="payment-save-btn" class="ob-btn primary">저장</button>
      <button id="payment-cancel-btn" class="ob-btn secondary">취소</button>
    </div>
  </div>
</div>

<!-- 회사비용 추가/수정 모달 -->
<div id="expense-modal" class="modal">
  <div class="modal-content">
    <div class="modal-header">
      <h3 id="expense-modal-title">비용 추가</h3>
      <span class="modal-close">&times;</span>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>일자 <span class="required">*</span></label>
        <input type="date" id="expense-date-input" required>
      </div>
      <div class="form-group">
        <label>항목 <span class="required">*</span></label>
        <select id="expense-category-input" required>
          <option value="인건비">인건비</option>
          <option value="임차료">임차료</option>
          <option value="통신비">통신비</option>
          <option value="교통비">교통비</option>
          <option value="소모품비">소모품비</option>
          <option value="접대비">접대비</option>
          <option value="광고선전비">광고선전비</option>
          <option value="식비">식비</option>
          <option value="기타">기타</option>
        </select>
      </div>
      <div class="form-group">
        <label>금액 <span class="required">*</span></label>
        <input type="number" id="expense-amount-input" min="0" required>
      </div>
      <div class="form-group">
        <label>결제수단 <span class="required">*</span></label>
        <select id="expense-method-input" required>
          <option value="현금">현금</option>
          <option value="카드">카드</option>
          <option value="계좌이체">계좌이체</option>
          <option value="기타">기타</option>
        </select>
      </div>
      <div class="form-group">
        <label>비고</label>
        <input type="text" id="expense-notes-input">
      </div>
    </div>
    <div class="modal-footer">
      <button id="expense-save-btn" class="ob-btn primary">저장</button>
      <button id="expense-cancel-btn" class="ob-btn secondary">취소</button>
    </div>
  </div>
</div>
```

---

### 8.4.2. CommonScripts.html 추가 - 페이지 초기화 함수

**CommonScripts.html에 추가**:

```javascript
/**
 * 결제관리 페이지 초기화
 */
function initPaymentManagement() {
  console.log('[initPaymentManagement] 결제관리 페이지 초기화');

  // 탭 전환 이벤트
  document.querySelectorAll('.tab-nav-item').forEach(function(tab) {
    tab.addEventListener('click', function() {
      var targetTab = this.dataset.tab;

      // 탭 활성화
      document.querySelectorAll('.tab-nav-item').forEach(function(t) {
        t.classList.remove('active');
      });
      this.classList.add('active');

      // 콘텐츠 표시
      document.querySelectorAll('.tab-content').forEach(function(c) {
        c.classList.remove('active');
      });
      document.getElementById('tab-' + targetTab).classList.add('active');
    });
  });

  // 입출금 내역 탭 초기화
  initPaymentRecordsTab();

  // 회사비용 탭 초기화
  initExpenseRecordsTab();
}

/**
 * 입출금 내역 탭 초기화
 */
function initPaymentRecordsTab() {
  // 조회 버튼
  document.getElementById('payment-search-btn').addEventListener('click', function() {
    loadPaymentRecords();
  });

  // 초기화 버튼
  document.getElementById('payment-reset-btn').addEventListener('click', function() {
    document.getElementById('payment-type-filter').value = '';
    document.getElementById('payment-company-filter').value = '';
    document.getElementById('payment-start-date').value = '';
    document.getElementById('payment-end-date').value = '';
    document.getElementById('payment-doc-filter').value = '';
  });

  // 추가 버튼
  document.getElementById('payment-add-btn').addEventListener('click', function() {
    openPaymentModal('add');
  });

  // Excel 내보내기
  document.getElementById('payment-export-excel').addEventListener('click', function() {
    exportPaymentToExcel();
  });

  // PDF 내보내기
  document.getElementById('payment-export-pdf').addEventListener('click', function() {
    exportPaymentToPDF();
  });

  // 문서번호 자동완성
  setupDocumentAutocomplete();

  // 초기 로드
  loadPaymentRecords();
}

/**
 * 회사비용 탭 초기화
 */
function initExpenseRecordsTab() {
  // 조회 버튼
  document.getElementById('expense-search-btn').addEventListener('click', function() {
    loadExpenseRecords();
  });

  // 초기화 버튼
  document.getElementById('expense-reset-btn').addEventListener('click', function() {
    document.getElementById('expense-category-filter').value = '';
    document.getElementById('expense-start-date').value = '';
    document.getElementById('expense-end-date').value = '';
  });

  // 추가 버튼
  document.getElementById('expense-add-btn').addEventListener('click', function() {
    openExpenseModal('add');
  });

  // Excel 내보내기
  document.getElementById('expense-export-excel').addEventListener('click', function() {
    exportExpenseToExcel();
  });

  // PDF 내보내기
  document.getElementById('expense-export-pdf').addEventListener('click', function() {
    exportExpenseToPDF();
  });
}

/**
 * 입출금 기록 로드
 */
function loadPaymentRecords() {
  var params = {
    type: document.getElementById('payment-type-filter').value,
    company: document.getElementById('payment-company-filter').value,
    startDate: document.getElementById('payment-start-date').value,
    endDate: document.getElementById('payment-end-date').value,
    docNumber: document.getElementById('payment-doc-filter').value,
    includeDeleted: false
  };

  OB.showLoading('입출금 내역 조회 중...');

  google.script.run
    .withSuccessHandler(function(response) {
      OB.hideLoading();
      if (response.success) {
        renderPaymentRecords(response.payments);
        updatePaymentSummary(response.payments);
      } else {
        OB.showError(response.error || '조회 실패');
      }
    })
    .withFailureHandler(function(error) {
      OB.hideLoading();
      OB.showError('조회 중 오류 발생: ' + error.message);
    })
    .getPaymentRecordsApi(params);
}

/**
 * 입출금 테이블 렌더링
 */
function renderPaymentRecords(payments) {
  var tbody = document.getElementById('payment-records-tbody');
  tbody.innerHTML = '';

  if (!payments || payments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#777;padding:40px;">조회 결과가 없습니다.</td></tr>';
    return;
  }

  payments.forEach(function(payment) {
    var tr = document.createElement('tr');

    // 유형에 따라 색상 구분
    var typeClass = payment.type === '입금' ? 'income' : 'expense';

    tr.innerHTML =
      '<td>' + OB.formatDate(payment.date) + '</td>' +
      '<td><span class="badge ' + typeClass + '">' + payment.type + '</span></td>' +
      '<td>' + payment.company + '</td>' +
      '<td class="num">' + OB.formatNumber(payment.amount) + '원</td>' +
      '<td>' + payment.method + '</td>' +
      '<td>' + (payment.docNumber || '-') + '</td>' +
      '<td>' + (payment.notes || '-') + '</td>' +
      '<td>' +
        '<button class="action-btn edit" data-id="' + payment.paymentId + '">수정</button> ' +
        '<button class="action-btn delete" data-id="' + payment.paymentId + '">삭제</button>' +
      '</td>';

    tbody.appendChild(tr);
  });

  // 수정/삭제 버튼 이벤트
  tbody.querySelectorAll('.edit').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var paymentId = this.dataset.id;
      openPaymentModal('edit', paymentId);
    });
  });

  tbody.querySelectorAll('.delete').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var paymentId = this.dataset.id;
      deletePayment(paymentId);
    });
  });
}

/**
 * 입출금 요약 업데이트
 */
function updatePaymentSummary(payments) {
  var totalIncome = 0;
  var totalExpense = 0;

  payments.forEach(function(payment) {
    if (payment.type === '입금') {
      totalIncome += Number(payment.amount) || 0;
    } else {
      totalExpense += Number(payment.amount) || 0;
    }
  });

  var netProfit = totalIncome - totalExpense;

  document.getElementById('payment-total-income').textContent = '₩' + OB.formatNumber(totalIncome);
  document.getElementById('payment-total-expense').textContent = '₩' + OB.formatNumber(totalExpense);
  document.getElementById('payment-net-profit').textContent = '₩' + OB.formatNumber(netProfit);

  // 순이익 색상
  var profitEl = document.getElementById('payment-net-profit');
  if (netProfit > 0) {
    profitEl.style.color = '#059669';
  } else if (netProfit < 0) {
    profitEl.style.color = '#dc2626';
  } else {
    profitEl.style.color = '#6b7280';
  }
}

/**
 * 문서번호 자동완성 설정
 */
function setupDocumentAutocomplete() {
  var input = document.getElementById('payment-doc-input');
  var suggestionsDiv = document.getElementById('payment-doc-suggestions');

  input.addEventListener('input', function() {
    var query = this.value.trim();

    if (query.length < 3) {
      suggestionsDiv.innerHTML = '';
      suggestionsDiv.style.display = 'none';
      return;
    }

    // 문서번호 검색
    google.script.run
      .withSuccessHandler(function(response) {
        if (response.success && response.suggestions.length > 0) {
          renderDocumentSuggestions(response.suggestions, suggestionsDiv, input);
        } else {
          suggestionsDiv.innerHTML = '';
          suggestionsDiv.style.display = 'none';
        }
      })
      .searchDocumentNumbersApi({ query: query });
  });

  // 외부 클릭 시 닫기
  document.addEventListener('click', function(e) {
    if (e.target !== input) {
      suggestionsDiv.style.display = 'none';
    }
  });
}

/**
 * 문서번호 제안 렌더링
 */
function renderDocumentSuggestions(suggestions, container, input) {
  container.innerHTML = '';
  container.style.display = 'block';

  suggestions.forEach(function(suggestion) {
    var div = document.createElement('div');
    div.className = 'suggestion-item';
    div.textContent = suggestion.docNumber + ' (' + suggestion.company + ')';

    div.addEventListener('click', function() {
      input.value = suggestion.docNumber;
      container.style.display = 'none';
    });

    container.appendChild(div);
  });
}

// ... (더 많은 함수들: openPaymentModal, savePayment, deletePayment, exportPaymentToExcel 등)
```

---

## 8.5. 거래원장 연동

### 8.5.1. 상세 모달 문서 정보 섹션

**CommonScripts.html 수정** - 거래원장 상세 모달에 추가:

```javascript
/**
 * 거래원장 상세 모달 - 문서 정보 섹션 렌더링
 */
function renderDocumentInfoSection(orderNumber) {
  var container = document.getElementById('ledger-doc-info');

  if (!container) return;

  container.innerHTML = '<div style="text-align:center;color:#777;">조회 중...</div>';

  // 청구서 존재 여부 확인
  google.script.run
    .withSuccessHandler(function(response) {
      if (response.success) {
        if (response.exists && response.invoices.length > 0) {
          // 케이스 1: 청구서 발급됨
          var invoice = response.invoices[0]; // 1:1 관계이므로 첫 번째 것만

          container.innerHTML =
            '<div class="doc-info-box success">' +
              '<div class="doc-status-badge success">✅ 청구서 발급됨</div>' +
              '<div class="doc-details">' +
                '<div class="doc-detail-row">' +
                  '<span class="doc-label">문서번호:</span> ' +
                  '<span class="doc-value">' + invoice.invoiceId + '</span>' +
                '</div>' +
                '<div class="doc-detail-row">' +
                  '<span class="doc-label">발급일:</span> ' +
                  '<span class="doc-value">' + OB.formatDate(invoice.invoiceDate) + '</span>' +
                '</div>' +
              '</div>' +
            '</div>';
        } else {
          // 케이스 2: 청구서 미발급
          container.innerHTML =
            '<div class="doc-info-box warning">' +
              '<div class="doc-status-badge warning">⚠️ 청구서 미발급</div>' +
            '</div>';
        }
      } else {
        container.innerHTML = '<div style="color:#dc2626;">조회 실패: ' + response.error + '</div>';
      }
    })
    .withFailureHandler(function(error) {
      container.innerHTML = '<div style="color:#dc2626;">오류 발생: ' + error.message + '</div>';
    })
    .checkInvoiceExistsApi({ orderNumber: orderNumber });
}
```

**CSS 스타일 (CommonHead.html에 추가)**:

```css
/* 문서 정보 섹션 */
.ledger-modal-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

.ledger-modal-section h3 {
  margin: 0 0 12px 0;
  font-size: 15px;
  color: #374151;
}

.doc-info-box {
  padding: 12px 16px;
  border-radius: 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
}

.doc-info-box.success {
  background: #f0fdf4;
  border-color: #86efac;
}

.doc-info-box.warning {
  background: #fffbeb;
  border-color: #fcd34d;
}

.doc-status-badge {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.doc-status-badge.success {
  color: #059669;
}

.doc-status-badge.warning {
  color: #d97706;
}

.doc-details {
  margin-top: 8px;
}

.doc-detail-row {
  font-size: 13px;
  color: #4b5563;
  margin: 4px 0;
}

.doc-label {
  font-weight: 600;
  color: #6b7280;
}

.doc-value {
  color: #1f2937;
}
```

---

## 8.6. 사용 시나리오

### 시나리오 1: 청구서 발급 후 입금 기록

**사용자 플로우**:
```
1. [거래원장] 메뉴에서 발주건 확인
2. [청구서 생성] 버튼 클릭 → 청구DB에 INV-20251219-003 생성
3. 거래처로부터 500,000원 입금 확인 (실제 은행 거래)
4. [결제관리] 메뉴 → [입출금 내역] 탭 → [+ 입출금 기록 추가]
5. 모달에서 입력:
   - 유형: 입금
   - 일자: 2025-12-19
   - 거래처: A거래처
   - 금액: 500000
   - 결제수단: 계좌이체
   - 문서번호: INV-2... (자동완성으로 INV-20251219-003 선택)
   - 비고: 1차 부분 결제
6. [저장] 클릭 → 결제내역 시트에 PAY-20251219-001 생성
7. 요약 통계에서 총 입금액 500,000원 확인
```

**데이터 연결**:
```
[거래원장]
발주번호: GMP-20251201-001

[청구DB]
청구ID: INV-20251219-003
발주번호: ["GMP-20251201-001"]

[결제내역]
결제ID: PAY-20251219-001
문서번호: INV-20251219-003
발주번호: GMP-20251201-001
```

---

### 시나리오 2: 확정수량 변경으로 청구서 재발급

**사용자 플로우**:
```
1. [거래원장] 상세 모달에서 확정수량 100개 → 120개로 수정
2. 기존 청구서 INV-20251219-003 취소 필요
3. [결제관리] 또는 [청구서 관리]에서 취소 기능 실행
   - 기존 청구서 상태: ISSUED → CANCELLED
   - 대체청구서: INV-20251220-004 (자동 생성)
4. 새 청구서 INV-20251220-004 발행
   - 원본청구서: INV-20251219-003
   - 금액: 1,200,000원 (수정된 수량 기준)
5. 거래처에게 INV-20251220-004 전달
```

**데이터 이력**:
```
[청구DB]
청구ID              상태       금액       대체청구서         원본청구서
INV-20251219-003   CANCELLED  1,000,000  INV-20251220-004  -
INV-20251220-004   ISSUED     1,200,000  -                 INV-20251219-003

히스토리 조회 시:
INV-20251219-003 → 취소됨 (수정 청구서: INV-20251220-004)
INV-20251220-004 → 발급완료 (원본 청구서: INV-20251219-003)
```

---

### 시나리오 3: 회사비용 기록 (문서 없음)

**사용자 플로우**:
```
1. [결제관리] 메뉴 → [회사비용] 탭
2. [+ 비용 추가] 클릭
3. 모달에서 입력:
   - 일자: 2025-12-19
   - 항목: 통신비
   - 금액: 50000
   - 결제수단: 카드
   - 비고: 사무실 인터넷 요금
4. [저장] 클릭 → 회사비용 시트에 EXP-20251219-001 생성
5. 요약 통계에서 총 비용 50,000원, 통신비 항목 확인
```

**데이터 독립성**:
```
[회사비용]
비용ID: EXP-20251219-001
항목: 통신비
금액: 50000

→ 문서번호, 발주번호 없이도 독립적으로 기록 가능
```

---

### 시나리오 4: 입출금 내역 Excel 내보내기

**사용자 플로우**:
```
1. [결제관리] → [입출금 내역] 탭
2. 필터 설정:
   - 기간: 2025-12-01 ~ 2025-12-31
   - 유형: 전체
3. [조회] 클릭 → 100건 조회
4. [📥 Excel 내보내기] 클릭
5. 구글 시트로 내보내기:
   - 시트명: "결제내역_20251219"
   - 컬럼: 결제ID, 결제일, 결제유형, 거래처명, 금액, 결제수단, 문서번호, 발주번호, 비고
   - 데이터: 현재 화면에 표시된 전체 데이터 (필터 적용된 상태)
6. 새 탭에서 구글 시트 열림 → 다운로드 또는 인쇄 가능
```

---

## 8.7. 구현 체크리스트

### Phase 1: 데이터 구조 (완료 시 체크)
- [ ] [결제내역] 시트 생성 (14개 컬럼)
- [ ] [회사비용] 시트 생성 (11개 컬럼)
- [ ] [청구DB] 시트에 "대체청구서", "원본청구서" 컬럼 추가
- [ ] 데이터 유효성 검사 (드롭다운) 설정

### Phase 2: 백엔드 (완료 시 체크)
- [ ] PaymentService.js 생성
  - [ ] addPaymentRecord()
  - [ ] getPaymentRecords()
  - [ ] updatePaymentRecord()
  - [ ] deletePaymentRecord() - 소프트 삭제
  - [ ] getPaymentSummary()
  - [ ] searchDocumentNumbers()
  - [ ] addExpenseRecord()
  - [ ] getExpenseRecords()
  - [ ] updateExpenseRecord()
  - [ ] deleteExpenseRecord() - 소프트 삭제
  - [ ] getExpenseSummary()
  - [ ] cancelAndReissueInvoice()
  - [ ] getInvoiceHistory()
  - [ ] generatePaymentId()
  - [ ] generateExpenseId()

- [ ] ApiService.js 수정
  - [ ] 12개 API 래퍼 함수 추가

### Phase 3: 프론트엔드 (완료 시 체크)
- [ ] Page_PaymentManagement.html 생성
  - [ ] 2개 탭 구조 (입출금 내역, 회사비용)
  - [ ] 입출금 내역 테이블 + 필터
  - [ ] 회사비용 테이블 + 필터
  - [ ] 입출금 추가/수정 모달
  - [ ] 회사비용 추가/수정 모달
  - [ ] 요약 카드 (통계)
  - [ ] 내보내기 버튼

- [ ] CommonScripts.html 수정
  - [ ] initPaymentManagement()
  - [ ] loadPaymentRecords()
  - [ ] renderPaymentRecords()
  - [ ] updatePaymentSummary()
  - [ ] setupDocumentAutocomplete()
  - [ ] openPaymentModal()
  - [ ] savePayment()
  - [ ] deletePayment()
  - [ ] loadExpenseRecords()
  - [ ] renderExpenseRecords()
  - [ ] openExpenseModal()
  - [ ] saveExpense()
  - [ ] deleteExpense()
  - [ ] exportPaymentToExcel()
  - [ ] exportPaymentToPDF()
  - [ ] exportExpenseToExcel()
  - [ ] exportExpenseToPDF()

- [ ] CommonHead.html 수정
  - [ ] 결제관리 스타일 추가
  - [ ] 모달 스타일
  - [ ] 자동완성 스타일

### Phase 4: 거래원장 연동 (완료 시 체크)
- [ ] CommonScripts.html 수정
  - [ ] renderDocumentInfoSection()
  - [ ] 거래원장 상세 모달에 섹션 추가

- [ ] Layout.html 수정 (필요 시)
  - [ ] 거래원장 모달 HTML 구조 업데이트

### Phase 5: 청구서 이력 관리 (완료 시 체크)
- [ ] InvoiceService.js 수정
  - [ ] createInvoiceFromSettlement() 확장 (대체청구서, 원본청구서 처리)

### Phase 6: 테스트 (완료 시 체크)
- [ ] 입출금 CRUD 테스트
- [ ] 회사비용 CRUD 테스트
- [ ] 문서번호 자동완성 테스트
- [ ] 청구서 취소/재발급 테스트
- [ ] 소프트 삭제 테스트
- [ ] Excel/PDF 내보내기 테스트
- [ ] 거래원장 문서 정보 표시 테스트

---

## C. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 2.0.0 | 2025-11 | 초기 아키텍처 문서 작성 |
| 2.1.0 | 2025-11-27 | 직렬화 표준, SPA 규칙, 디버깅 가이드 추가 |
| 2.2.0 | 2025-12-05 | Phase 2 회계 기능 추가, Issue #002 해결 (발주 상세보기 모달 오류), API 함수 목록 업데이트 |
| 2.2.1 | 2025-12-06 | Issue #003 해결 (확정수량 수정, 4개 상태 저장, 마진 정보), Issue #004 해결 (마감 검색조건, 마감 내역 조회), 발주내역 목록 진행상태 컬럼 추가 |
| 2.3.0 | 2025-12-06 | **Codex 통합 (테스트 진행 중)** - Issue #005~#011 해결, 거래원장 페이지 신규, 인보이스관리 페이지 신규, 마감상세 모달, 청구서 재출력, 코드 리팩토링 (+1,783줄/-566줄) |
| **2.4.0** | **2025-12-16** | **🔴 설계 개선 및 구현 계획** - 거래원장 4개 상태 컬럼 명시 (매입발주/매입결제/매출결제/출고), Phase 1-2 (2-Track 청구서) 설계 추가, 거래원장 페이지 표준 구조 정의, 3단계 구현 로드맵 수립 |
| **2.5.0** | **2025-12-18** | **📐 UI/UX 패턴 템플릿 추가 (PART 7)** - 거래원장을 표준 템플릿으로 정의, 7가지 핵심 패턴 문서화 (레이아웃, 체크박스, 상태 표시, 모달, 일괄 작업, 백엔드 처리, 데이터 집계), 다른 메뉴(청구서, 마감 등) 참고 기준 확립 |
| **2.6.0** | **2025-12-19** | **💰 결제관리 시스템 명세 추가 (PART 8)** - 입출금 내역 관리, 회사비용 관리, 청구서 취소/재발급 로직, 문서번호 자동완성, 소프트 삭제, Excel/PDF 내보내기, 거래원장 문서 정보 섹션, 데이터 구조 설계 (결제내역/회사비용 시트), PaymentService.js 함수 명세, UI/UX 구조 정의, 4가지 사용 시나리오, 구현 체크리스트 |

---

**Document End**

> 이 문서는 OneBridge ERP 프로젝트의 **정규 참조 문서**입니다.
> 모든 개발자는 이 문서의 표준을 준수해야 합니다.
> 문서 수정 시 반드시 버전과 변경 이력을 업데이트하세요.
