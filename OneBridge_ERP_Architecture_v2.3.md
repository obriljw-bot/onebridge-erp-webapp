# OneBridge ERP v2.3 (SSR Hybrid) — Complete Architecture & Development Standards

## Document Information
- **Version**: 2.3.0
- **Last Updated**: 2025-12-06
- **Status**: 🔄 Testing in Progress (Codex 통합 코드 검증 중)
- **Purpose**: 시스템 아키텍처 명세 + 개발 표준 + 트러블슈팅 가이드

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

### 거래원장 컬럼 구조
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
| 확정수량 | Number | 확정된 수량 |
| 매입가 | Number | 매입 단가 |
| 공급가 | Number | 공급 단가 |
| 매입액 | Formula | =매입가*발주수량 |
| 공급액 | Formula | =공급가*발주수량 |
| 마진액 | Formula | =공급액-매입액 |
| 마진율 | Formula | =마진액/공급액 |
| 생성일시 | String | ISO 형식 타임스탬프 |
| 수정일시 | String | ISO 형식 타임스탬프 |

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

## C. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 2.0.0 | 2025-11 | 초기 아키텍처 문서 작성 |
| 2.1.0 | 2025-11-27 | 직렬화 표준, SPA 규칙, 디버깅 가이드 추가 |
| 2.2.0 | 2025-12-05 | Phase 2 회계 기능 추가, Issue #002 해결 (발주 상세보기 모달 오류), API 함수 목록 업데이트 |
| 2.2.1 | 2025-12-06 | Issue #003 해결 (확정수량 수정, 4개 상태 저장, 마진 정보), Issue #004 해결 (마감 검색조건, 마감 내역 조회), 발주내역 목록 진행상태 컬럼 추가 |
| 2.3.0 | 2025-12-06 | **Codex 통합 (테스트 진행 중)** - Issue #005~#011 해결, 거래원장 페이지 신규, 인보이스관리 페이지 신규, 마감상세 모달, 청구서 재출력, 코드 리팩토링 (+1,783줄/-566줄) |

---

**Document End**

> 이 문서는 OneBridge ERP 프로젝트의 **정규 참조 문서**입니다.
> 모든 개발자는 이 문서의 표준을 준수해야 합니다.
> 문서 수정 시 반드시 버전과 변경 이력을 업데이트하세요.
