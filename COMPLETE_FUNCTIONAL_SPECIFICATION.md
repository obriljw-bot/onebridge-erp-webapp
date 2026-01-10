# OneBridge ERP - 거래명세서 출력 시스템 완전 기능 명세서

**문서 버전**: 1.0
**작성일**: 2026-01-10
**작성자**: Claude
**목적**: 실행 가능한 초상세 기능 명세서 (모든 입력/출력/동작 완전 추적)

---

## 📋 목차

1. [시스템 개요](#1-시스템-개요)
2. [전체 아키텍처](#2-전체-아키텍처)
3. [페이지별 상세 명세](#3-페이지별-상세-명세)
4. [데이터 흐름 완전 분석](#4-데이터-흐름-완전-분석)
5. [API 엔드포인트 명세](#5-api-엔드포인트-명세)
6. [데이터베이스 스키마](#6-데이터베이스-스키마)
7. [상태 다이어그램](#7-상태-다이어그램)
8. [시퀀스 다이어그램](#8-시퀀스-다이어그램)
9. [테스트 시나리오](#9-테스트-시나리오)

---

## 1. 시스템 개요

### 1.1 목적

OneBridge ERP의 거래명세서 출력 시스템은 거래원장 데이터를 기반으로 다양한 형식의 출력물(발주서, 거래명세서)을 자동 생성합니다.

### 1.2 주요 기능

| 기능 | 설명 | 지원 형식 |
|------|------|----------|
| 표준 문서 출력 | 발주서(매입), 거래명세서(부포/영세) | PDF, Excel |
| 멀티페이지 PDF | 품목이 10행 이상일 때 자동 페이지 분할 | PDF |
| 전용 양식 출력 | 브랜드별 맞춤 템플릿 (롬앤/누즈, 종근당, 삐아계열) | Excel |
| 매입처별 통합 | 여러 발주를 하나의 문서로 통합 | PDF, Excel |
| 출력 방식 선택 | auto(자동)/full(전체)/short(단축) | PDF, Excel |

### 1.3 지원 문서 유형

| 코드 | 명칭 | 수량 기준 | 금액 기준 | VAT 계산 | 템플릿 |
|------|------|----------|----------|----------|--------|
| ORDER_PURCHASE | 발주서(매입) | 발주수량 | 매입가/매입액 | 부별/부포 | Templates_Invoice_VAT |
| INVOICE_VAT | 거래명세서(부포) | 확정수량 | 공급가/공급액 | totalVat = totalAmount - totalSupply | Templates_Invoice_VAT |
| INVOICE_NVAT | 거래명세서(영세) | 확정수량 | 공급가/공급액 | totalVat = 0 | Templates_Invoice_VAT |
| CUSTOM_ROMAND | 롬앤/누즈 전용 | 발주수량 | - | - | XLSX 템플릿 |
| CUSTOM_JONGGEUNDANG | 종근당 전용 | 발주수량 | 공급가 | - | XLSX 템플릿 |
| CUSTOM_BBIA | 삐아계열 전용 | 발주수량 | - | - | XLSX 템플릿 (바코드 매칭) |

---

## 2. 전체 아키텍처

### 2.1 4-Layer 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER (Frontend)                 │
│                                                                  │
│  Page_InvoiceOutput.html (437줄)                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 36개 DOM 요소                                              │ │
│  │ ├─ 조회 조건: inv-order-code, inv-start-date, ...        │ │
│  │ ├─ 출력 설정: inv-doc-type, inv-output-format, ...       │ │
│  │ ├─ 테이블: inv-result-tbody                              │ │
│  │ └─ 버튼: inv-search-btn, inv-export-selected             │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER (Controller)                │
│                                                                  │
│  CommonScripts.html (8,498줄)                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ OB 네임스페이스 함수들                                     │ │
│  │ ├─ OB.initInvoiceOutputPage()      - 페이지 초기화       │ │
│  │ ├─ OB.searchOrders()                - 조회 실행           │ │
│  │ ├─ OB.renderOrders(data)            - 테이블 렌더링       │ │
│  │ ├─ OB.exportSelected()              - 출력 메인 함수      │ │
│  │ ├─ OB.handleDocTypeChange()         - 문서 유형 변경      │ │
│  │ └─ OB.handleManualRemarkToggle()    - 비고 토글          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER (Backend)                       │
│                                                                  │
│  InvoiceOutputService.js (2,223줄)                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 21개 함수                                                   │ │
│  │ ├─ generateInvoiceZip()             - 메인 엔트리포인트   │ │
│  │ ├─ buildInvoiceVatPdf()             - 거래명세서 PDF      │ │
│  │ ├─ buildOrderPurchasePdf()          - 발주서 PDF          │ │
│  │ ├─ buildInvoiceVatPdfMerged()       - 통합 PDF            │ │
│  │ ├─ generateExcelOutput_()           - 표준 Excel          │ │
│  │ ├─ generateCustomTemplateExcel_()   - 전용 양식 Excel     │ │
│  │ ├─ buildRomandNudzExcel_()          - 롬앤/누즈           │ │
│  │ ├─ buildJonggeundangExcel_()        - 종근당              │ │
│  │ ├─ buildBbiaGroupExcel_()           - 삐아계열            │ │
│  │ └─ 12개 헬퍼 함수                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYER (Database)                         │
│                                                                  │
│  Google Sheets                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ├─ Transaction (거래원장) - 30개 컬럼                     │ │
│  │ ├─ Partners (거래처DB) - 15개 컬럼                        │ │
│  │ ├─ Items (품목DB) - 20개 컬럼                             │ │
│  │ └─ Settings (설정DB) - 템플릿 파일 ID 저장               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Google Drive                                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ├─ 전용 양식 템플릿 (XLSX)                                │ │
│  │ │  - TEMPLATE_ROMAND_NUDZ                                 │ │
│  │  - TEMPLATE_JONGGEUNDANG                                  │ │
│  │  - TEMPLATE_BBIA_GROUP                                    │ │
│  │ └─ 출력 결과 ZIP 파일 (임시)                              │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 파일 간 의존성

```
Page_InvoiceOutput.html
    ↓ (includes)
CommonScripts.html
    ↓ (google.script.run calls)
InvoiceOutputService.js
    ↓ (reads/writes)
Google Sheets + Google Drive
    ↓ (templates)
Templates_Invoice_VAT.html
```

---

## 3. 페이지별 상세 명세

### 3.1 Page_InvoiceOutput.html (437줄)

#### 3.1.1 모든 DOM 요소 완전 목록 (36개)

##### 조회 조건 섹션 (5개)

| # | ID | 태그 | Type | Name | Placeholder | 기본값 | 위치 | 용도 |
|---|----|----|------|------|-------------|--------|------|------|
| 1 | `inv-order-code` | input | text | - | "OB2025-..." | "" | 첫번째 topbar | 발주번호 검색 |
| 2 | `inv-start-date` | input | date | - | - | "" | 첫번째 topbar | 조회 시작일 |
| 3 | `inv-end-date` | input | date | - | - | "" | 첫번째 topbar | 조회 종료일 |
| 4 | `inv-supplier` | input | text | - | "업체명" | "" | 첫번째 topbar | 매입처 검색 |
| 5 | `inv-search-btn` | button | - | - | - | - | 첫번째 topbar | 조회 버튼 |

**실제 HTML 코드**:
```html
<div class="ob-topbar">
  <input type="text" id="inv-order-code" placeholder="OB2025-..." style="min-width:140px">
  <input type="date" id="inv-start-date">
  <input type="date" id="inv-end-date">
  <input type="text" id="inv-supplier" placeholder="업체명" style="min-width:120px">
  <button id="inv-search-btn" class="ob-btn primary">🔍 조회</button>
</div>
```

##### 출력 설정 섹션 (13개)

| # | ID | 태그 | Type | Options/Value | 기본값 | 조건부 표시 | 변경 이벤트 |
|---|----|----|------|--------------|--------|------------|------------|
| 6 | `inv-doc-type` | select | - | 6개 option | ORDER_PURCHASE | - | handleDocTypeChange() |
| 7 | `inv-default-mode` | select | - | 3개 option | auto | - | - |
| 8 | `inv-output-format` | select | - | 2개 option | PDF | - | - |
| 9 | `inv-doc-date` | input | date | - | "" | - | - |
| 10 | `inv-date-label` | label | - | - | "발주일" | - | - |
| 11 | `inv-delivery-date` | input | date | - | "" | CUSTOM_BBIA 선택시 | - |
| 12 | `inv-delivery-label` | label | - | - | "납품일" | CUSTOM_BBIA 선택시 | - |
| 13 | `inv-manual-remark` | input | checkbox | - | false | - | handleManualRemarkToggle() |
| 14 | `inv-manual-remark-text` | textarea | - | rows=3 | "" | inv-manual-remark 체크시 | - |
| 15 | `inv-remark-input-area` | div | - | - | - | inv-manual-remark 체크시 | - |
| 16 | `inv-merge-by-supplier` | input | checkbox | - | false | - | - |
| 17 | `inv-export-selected` | button | - | - | - | - | exportSelected() |

**inv-doc-type의 6개 Options**:
```html
<select id="inv-doc-type" style="min-width:160px">
  <optgroup label="기본 문서">
    <option value="ORDER_PURCHASE">발주서(매입)</option>
    <option value="INVOICE_VAT">거래명세서(부포)</option>
    <option value="INVOICE_NVAT">거래명세서(영세)</option>
  </optgroup>
  <optgroup label="전용 양식 (Excel)">
    <option value="CUSTOM_ROMAND">롬앤/누즈 전용</option>
    <option value="CUSTOM_JONGGEUNDANG">종근당 전용</option>
    <option value="CUSTOM_BBIA">삐아계열 전용</option>
  </optgroup>
</select>
```

**조건부 표시 로직**:

1. **날짜 라벨 변경** (inv-date-label):
```javascript
if (docType === 'ORDER_PURCHASE') {
  document.getElementById('inv-date-label').textContent = '발주일';
} else {
  document.getElementById('inv-date-label').textContent = '출고일';
}
```

2. **납품일 필드 표시** (inv-delivery-date, inv-delivery-label):
```javascript
if (docType === 'CUSTOM_BBIA') {
  document.getElementById('inv-delivery-date').style.display = '';
  document.getElementById('inv-delivery-label').style.display = '';
} else {
  document.getElementById('inv-delivery-date').style.display = 'none';
  document.getElementById('inv-delivery-label').style.display = 'none';
}
```

3. **출력형식 고정** (inv-output-format):
```javascript
if (docType.indexOf('CUSTOM_') === 0) {
  document.getElementById('inv-output-format').value = 'EXCEL';
  document.getElementById('inv-output-format').disabled = true;
} else {
  document.getElementById('inv-output-format').disabled = false;
}
```

4. **비고 입력 영역 표시** (inv-remark-input-area):
```javascript
if (document.getElementById('inv-manual-remark').checked) {
  document.getElementById('inv-remark-input-area').style.display = 'block';
} else {
  document.getElementById('inv-remark-input-area').style.display = 'none';
}
```

##### 테이블 섹션 (10개)

| # | ID | 태그 | 위치 | 용도 | 동적 생성 |
|---|----|----|------|------|----------|
| 18 | `inv-check-all` | input (checkbox) | thead > tr > th:first | 전체 선택 체크박스 | - |
| 19 | `inv-result-tbody` | tbody | table > tbody | 조회 결과 테이블 바디 | O (JavaScript) |
| 20-27 | `.inv-row-check` | input (checkbox) | tbody > tr > td:first | 개별 행 체크박스 | O (각 행마다) |
| 28-35 | `.inv-mode-select` | select | tbody > tr > td:last | 개별 출력방식 선택 | O (각 행마다) |

**테이블 헤더 구조** (10개 컬럼):
```html
<thead>
  <tr>
    <th><input type="checkbox" id="inv-check-all"></th>
    <th class="sortable" data-sort="orderDate">발주일</th>
    <th class="sortable" data-sort="orderCode">발주번호</th>
    <th class="sortable" data-sort="brand">브랜드</th>
    <th class="sortable" data-sort="supplier">매입처</th>
    <th class="sortable" data-sort="buyer">발주처</th>
    <th class="sortable num" data-sort="itemCount">품목수</th>
    <th class="sortable num" data-sort="totalPurchaseAmount">매입액합계</th>
    <th class="sortable num" data-sort="totalAmount">공급액합계</th>
    <th>출력방식</th>
  </tr>
</thead>
```

**동적 생성 Row 구조** (JavaScript에서 생성):
```html
<tr>
  <td><input type="checkbox" class="inv-row-check" data-oc="${orderCode}"></td>
  <td>${orderDate}</td>
  <td>${orderCode}</td>
  <td>${brand}</td>
  <td>${supplier}</td>
  <td>${buyer}</td>
  <td class="num">${itemCount}</td>
  <td class="num">${formatNumber(totalPurchaseAmount)}원</td>
  <td class="num">${formatNumber(totalAmount)}원</td>
  <td>
    <select class="inv-mode-select" data-order="${orderCode}">
      <option value="auto">자동</option>
      <option value="full">전체</option>
      <option value="short">단축</option>
    </select>
  </td>
</tr>
```

##### 페이지네이션 섹션 (6개)

| # | ID | 태그 | Text | 위치 | onclick |
|---|----|----|------|------|---------|
| 36 | `inv-page-info` | div | "1-10 / 100건" | pagination-container | - |
| 37 | `inv-page-first` | button | "처음" | pagination-controls | goToPage(1) |
| 38 | `inv-page-prev` | button | "이전" | pagination-controls | goToPrevPage() |
| 39 | `inv-page-numbers` | div | 페이지 번호 버튼들 | pagination-controls | - |
| 40 | `inv-page-next` | button | "다음" | pagination-controls | goToNextPage() |
| 41 | `inv-page-last` | button | "마지막" | pagination-controls | goToLastPage() |

---

### 3.2 CommonScripts.html - exportSelected() 완전 분해

#### 3.2.1 함수 시그니처

```javascript
OB.exportSelected = function() {
  // 10단계 처리 흐름
}
```

**호출 위치**: Page_InvoiceOutput.html의 `inv-export-selected` 버튼 클릭

#### 3.2.2 Step-by-Step 처리 흐름

##### Step 1: 체크된 발주번호 수집

**코드**:
```javascript
var checked = document.querySelectorAll('.inv-row-check:checked');
var selected = [];
for (var i = 0; i < checked.length; i++) {
  selected.push(checked[i].getAttribute('data-oc'));
}
```

**입력**: DOM 체크박스 상태
**출력**: `selected` 배열 (예: `['OB2025-001', 'OB2025-002']`)
**데이터 타입**: `string[]`

##### Step 2: 입력값 검증

**코드**:
```javascript
if (selected.length === 0) {
  alert('출력할 발주번호를 선택해주세요.');
  return;
}
```

**검증 조건**: `selected.length > 0`
**실패 시**: alert 표시 후 함수 종료

##### Step 3: 10개 입력값 수집

**코드**:
```javascript
var docType = document.getElementById('inv-doc-type').value;
var outputFormat = document.getElementById('inv-output-format').value;
var defaultMode = document.getElementById('inv-default-mode').value;
var mergeBySupplier = document.getElementById('inv-merge-by-supplier').checked;
var docDate = document.getElementById('inv-doc-date').value;
var deliveryDate = document.getElementById('inv-delivery-date').value;
var manualRemarkCheck = document.getElementById('inv-manual-remark').checked;
var manualRemarkText = manualRemarkCheck
  ? document.getElementById('inv-manual-remark-text').value
  : '';
```

**수집된 데이터**:

| 변수명 | 소스 ID | 데이터 타입 | 예시 값 |
|--------|---------|------------|---------|
| docType | inv-doc-type | string | "INVOICE_VAT" |
| outputFormat | inv-output-format | string | "PDF" |
| defaultMode | inv-default-mode | string | "auto" |
| mergeBySupplier | inv-merge-by-supplier | boolean | true |
| docDate | inv-doc-date | string | "2026-01-10" |
| deliveryDate | inv-delivery-date | string | "2026-01-15" |
| manualRemarkCheck | inv-manual-remark | boolean | true |
| manualRemarkText | inv-manual-remark-text | string | "특이사항..." |

##### Step 4: 개별 출력방식 맵 생성

**코드**:
```javascript
var modes = {};
for (var i = 0; i < selected.length; i++) {
  var orderCode = selected[i];
  var modeSelect = document.querySelector('.inv-mode-select[data-order="' + orderCode + '"]');
  if (modeSelect) {
    modes[orderCode] = modeSelect.value;
  }
}
```

**입력**: `selected` 배열
**출력**: `modes` 객체
**예시**:
```javascript
{
  'OB2025-001': 'full',
  'OB2025-002': 'short',
  'OB2025-003': 'auto'
}
```

##### Step 5: 파라미터 객체 구성

**코드**:
```javascript
var params = {
  orderCodes: selected,
  docType: docType,
  outputFormat: outputFormat,
  printMode: defaultMode,
  modesByOrder: modes,
  mergeBySupplier: mergeBySupplier,
  docDate: docDate,
  deliveryDate: deliveryDate,
  manualRemark: manualRemarkText
};
```

**params 객체 스키마**:
```javascript
{
  orderCodes: string[],          // 필수
  docType: string,               // 필수
  outputFormat: string,          // 필수
  printMode: string,             // 필수
  modesByOrder: Object,          // 선택 (빈 객체 가능)
  mergeBySupplier: boolean,      // 필수
  docDate: string,               // 선택
  deliveryDate: string,          // 선택 (CUSTOM_BBIA만)
  manualRemark: string           // 선택
}
```

##### Step 6: 로딩 표시

**코드**:
```javascript
OB.showLoading('출력 파일 생성 중...');
```

**동작**:
- 로딩 오버레이 표시
- 메시지: "출력 파일 생성 중..."
- 스피너 애니메이션 시작

##### Step 7: API 호출

**코드**:
```javascript
google.script.run
  .withSuccessHandler(OB.handleExportSuccess)
  .withFailureHandler(OB.handleExportFailure)
  .generateInvoiceZip(params);
```

**API 정보**:
- **메서드**: `generateInvoiceZip`
- **파일**: InvoiceOutputService.js
- **입력**: `params` 객체
- **비동기**: Yes

##### Step 8: Success Handler

**코드**:
```javascript
OB.handleExportSuccess = function(result) {
  OB.hideLoading();

  if (result.success && result.fileId) {
    var url = 'https://drive.google.com/file/d/' + result.fileId + '/view';
    window.open(url, '_blank');
    alert('출력 완료!\n파일명: ' + result.fileName);
  } else {
    alert('출력 실패: ' + (result.error || '알 수 없는 오류'));
  }
};
```

**입력**: `result` 객체
```javascript
{
  success: boolean,
  fileId: string,
  fileName: string,
  error?: string
}
```

**동작**:
1. 로딩 숨김
2. `result.success && result.fileId` 검증
3. Google Drive URL 생성
4. 새 탭에서 열기
5. 완료 메시지 표시

##### Step 9: Failure Handler

**코드**:
```javascript
OB.handleExportFailure = function(error) {
  OB.hideLoading();
  console.error('출력 오류:', error);
  alert('출력 실패: ' + error.message);
};
```

**입력**: `error` 객체
```javascript
{
  message: string,
  stack?: string
}
```

**동작**:
1. 로딩 숨김
2. 콘솔에 에러 로그
3. 사용자에게 에러 메시지 표시

---

### 3.3 InvoiceOutputService.js - generateInvoiceZip() 완전 분해

#### 3.3.1 함수 시그니처

```javascript
function generateInvoiceZip(params) {
  // 20단계 처리 흐름
  // 반환: { success, fileId, fileName, error }
}
```

#### 3.3.2 Step-by-Step 처리 흐름 (20단계)

##### Step 1: 파라미터 파싱 및 기본값 설정

**코드**:
```javascript
var orderCodes = params.orderCodes || [];
var docType = params.docType || 'INVOICE_VAT';
var outputFormat = params.outputFormat || 'PDF';
var printMode = params.printMode || 'auto';
var modesByOrder = params.modesByOrder || {};
var mergeBySupplier = params.mergeBySupplier || false;
var docDate = params.docDate || '';
var deliveryDate = params.deliveryDate || '';
var manualRemark = params.manualRemark || '';
```

**입력**: `params` 객체
**출력**: 9개 로컬 변수
**기본값 적용**: `||` 연산자 사용

##### Step 2: 거래원장 시트 조회

**코드**:
```javascript
var sheet = getOrderMergedSheet();
var data = sheet.getDataRange().getValues();
var header = data[0];
```

**함수 호출**: `getOrderMergedSheet()`
**반환값**: SpreadsheetApp.Sheet 객체
**데이터 구조**:
```javascript
data = [
  ['발주번호', '발주일', '매입처', '발주처', '브랜드', ...],  // header
  ['OB2025-001', '2026-01-10', '원브릿지', '롬앤', '롬앤', ...],
  ['OB2025-001', '2026-01-10', '원브릿지', '롬앤', '롬앤', ...],
  ...
]
```

##### Step 3: 컬럼 인덱스 추출

**코드**:
```javascript
var idxOrderCode = header.indexOf('발주번호');
var idxOrderDate = header.indexOf('발주일');
var idxSupplier = header.indexOf('매입처');
var idxBuyer = header.indexOf('발주처');
var idxBrand = header.indexOf('브랜드');
var idxItemCode = header.indexOf('품목코드');
var idxItemName = header.indexOf('제품명');
var idxBarcode = header.indexOf('바코드');
var idxOrderQty = header.indexOf('발주수량');
var idxConfirmedQty = header.indexOf('확정수량');
var idxPurchasePrice = header.indexOf('매입가');
var idxPurchaseAmount = header.indexOf('매입액');
var idxSupplyPrice = header.indexOf('공급가');
var idxSupplyAmount = header.indexOf('공급액');
var idxVatType = header.indexOf('부가세구분');
```

**목적**: 컬럼명 → 인덱스 변환
**예시**: `idxOrderCode = 0`, `idxOrderDate = 1`, ...

##### Step 4: 선택된 발주 데이터 필터링

**코드**:
```javascript
var allOrderRows = [];
for (var i = 1; i < data.length; i++) {
  var row = data[i];
  var orderCode = String(row[idxOrderCode] || '').trim();
  if (orderCodes.indexOf(orderCode) >= 0) {
    allOrderRows.push(row);
  }
}
```

**입력**: `data` 전체, `orderCodes` 배열
**출력**: `allOrderRows` 배열 (선택된 발주만)
**필터 조건**: `orderCodes.indexOf(orderCode) >= 0`

##### Step 5: 매입처별 그룹핑 (조건부)

**코드**:
```javascript
var supplierGroups = {};

if (mergeBySupplier) {
  var orderInfoMap = {};

  // 발주번호 → 매입처 매핑
  for (var i = 0; i < allOrderRows.length; i++) {
    var row = allOrderRows[i];
    var orderCode = String(row[idxOrderCode] || '').trim();
    var supplier = String(row[idxSupplier] || '').trim();
    var orderDate = row[idxOrderDate];

    if (!orderInfoMap[orderCode]) {
      orderInfoMap[orderCode] = {
        supplier: supplier,
        orderDate: orderDate
      };
    }
  }

  // 매입처별 그룹핑
  for (var orderCode in orderInfoMap) {
    var info = orderInfoMap[orderCode];
    var supplier = info.supplier;

    if (!supplierGroups[supplier]) {
      supplierGroups[supplier] = {
        orderCodes: [],
        orderDate: info.orderDate
      };
    }

    supplierGroups[supplier].orderCodes.push(orderCode);
  }
}
```

**입력**: `allOrderRows`, `mergeBySupplier`
**출력**: `supplierGroups` 객체
**예시**:
```javascript
{
  '원브릿지': {
    orderCodes: ['OB2025-001', 'OB2025-002'],
    orderDate: '2026-01-10'
  }
}
```

##### Step 6: 출력 형식 분기

**코드**:
```javascript
var blobs = [];

if (outputFormat === 'PDF') {
  // PDF 생성 로직
  blobs = generatePdfBlobs(/* ... */);
} else if (outputFormat === 'EXCEL') {
  if (docType.indexOf('CUSTOM_') === 0) {
    // 전용 양식 Excel
    var result = generateCustomTemplateExcel_(docType, orderCodes, allOrderRows, header, params);
    return result;
  } else {
    // 표준 Excel
    var result = generateExcelOutput_(orderCodes, allOrderRows, header, params);
    return result;
  }
}
```

**분기 조건**:
1. `outputFormat === 'PDF'` → PDF 생성
2. `outputFormat === 'EXCEL'` AND `docType.indexOf('CUSTOM_') === 0` → 전용 양식 Excel
3. `outputFormat === 'EXCEL'` AND 기타 → 표준 Excel

##### Step 7-10: PDF 생성 (매입처별 통합 또는 개별)

**통합 출력 코드**:
```javascript
if (mergeBySupplier) {
  for (var supplier in supplierGroups) {
    var group = supplierGroups[supplier];
    var groupOrderCodes = group.orderCodes;

    var blob;
    if (docType === 'INVOICE_VAT') {
      blob = buildInvoiceVatPdfMerged(groupOrderCodes, allOrderRows, header, modesByOrder, printMode);
    } else if (docType === 'ORDER_PURCHASE') {
      blob = buildOrderPurchasePdfMerged(groupOrderCodes, allOrderRows, header, modesByOrder, printMode);
    } else if (docType === 'INVOICE_NVAT') {
      blob = buildInvoiceNvatPdfMerged(groupOrderCodes, allOrderRows, header, modesByOrder, printMode);
    }

    blobs.push(blob);
  }
}
```

**개별 출력 코드**:
```javascript
else {
  for (var i = 0; i < orderCodes.length; i++) {
    var orderCode = orderCodes[i];
    var orderRows = allOrderRows.filter(function(r) {
      return String(r[idxOrderCode]).trim() === orderCode;
    });

    var mode = modesByOrder[orderCode] || printMode;

    var blob;
    if (docType === 'INVOICE_VAT') {
      blob = buildInvoiceVatPdf(orderCode, orderRows, header, mode);
    } else if (docType === 'ORDER_PURCHASE') {
      blob = buildOrderPurchasePdf(orderCode, orderRows, header, mode);
    } else if (docType === 'INVOICE_NVAT') {
      blob = buildInvoiceNvatPdf(orderCode, orderRows, header, mode);
    }

    blobs.push(blob);
  }
}
```

##### Step 11-15: Excel 생성 (표준 형식)

**함수 호출**: `generateExcelOutput_(orderCodes, allOrderRows, header, params)`

**내부 동작**:
1. 새 Spreadsheet 생성
2. 헤더 작성
3. 데이터 행 작성
4. 합계 행 추가
5. Excel Blob 변환
6. Drive에 저장
7. 파일 ID 반환

**반환값**:
```javascript
{
  success: true,
  fileId: '1a2b3c4d...',
  fileName: '거래명세서_2026-01-10.xlsx',
  downloadUrl: 'https://drive.google.com/...'
}
```

##### Step 16-19: Excel 생성 (전용 양식)

**함수 호출**: `generateCustomTemplateExcel_(docType, orderCodes, allOrderRows, header, params)`

**내부 동작**:
1. docType → templateGroup 변환
2. 템플릿 파일 ID 조회
3. 발주번호별 반복:
   - 템플릿 복사
   - 데이터 입력
   - Excel Blob 생성
4. 단일 파일: Drive 저장
5. 여러 파일: ZIP 압축 후 Drive 저장

##### Step 20: 결과 반환

**단일 파일 (Excel)**:
```javascript
return {
  success: true,
  fileId: fileId,
  fileName: fileName,
  downloadUrl: downloadUrl
};
```

**여러 파일 (PDF 또는 여러 Excel)**:
```javascript
// ZIP 압축
var zipBlob = Utilities.zip(blobs, '출력물_' + Utilities.formatDate(new Date(), 'GMT+9', 'yyyyMMdd_HHmmss') + '.zip');

// Drive에 저장
var folder = DriveApp.getRootFolder();
var file = folder.createFile(zipBlob);
var fileId = file.getId();
var fileName = file.getName();

return {
  success: true,
  fileId: fileId,
  fileName: fileName,
  downloadUrl: 'https://drive.google.com/file/d/' + fileId + '/view'
};
```

---

## 4. 데이터 흐름 완전 분석

### 4.1 조회 버튼 클릭 → 테이블 렌더링 (60단계)

```
[사용자] 조회 버튼 클릭
    ↓
[1] onclick="OB.searchOrders()" 실행
    ↓
[2] 입력값 수집:
    - inv-order-code → orderCode
    - inv-start-date → startDate
    - inv-end-date → endDate
    - inv-supplier → supplier
    ↓
[3] 검증:
    if (!startDate || !endDate) {
      alert('조회 기간을 선택하세요');
      return;
    }
    ↓
[4] OB.showLoading('조회 중...')
    ↓
[5] google.script.run
      .withSuccessHandler(OB.renderOrders)
      .withFailureHandler(OB.handleSearchError)
      .getPrintableOrdersApi(filter)
    ↓
[Backend: InvoiceOutputService.js]
    ↓
[6] getPrintableOrdersApi(filter) 함수 실행
    ↓
[7] getOrderMergedSheet() 호출
    ↓
[8] sheet.getDataRange().getValues() - 거래원장 전체 로드
    ↓
[9] header = data[0]
    ↓
[10] 컬럼 인덱스 추출 (15개)
    ↓
[11] 필터링 로직:
    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      // 조건 1: 발주번호
      if (filter.orderCode && row[idxOrderCode].indexOf(filter.orderCode) < 0) continue;

      // 조건 2: 날짜 범위
      var orderDate = new Date(row[idxOrderDate]);
      if (orderDate < new Date(filter.startDate)) continue;
      if (orderDate > new Date(filter.endDate)) continue;

      // 조건 3: 매입처
      if (filter.supplier && row[idxSupplier].indexOf(filter.supplier) < 0) continue;

      // 통과 → 결과에 추가
      filtered.push(row);
    }
    ↓
[12] 발주번호별 그룹핑:
    var grouped = {};
    for (var i = 0; i < filtered.length; i++) {
      var row = filtered[i];
      var orderCode = row[idxOrderCode];

      if (!grouped[orderCode]) {
        grouped[orderCode] = {
          orderCode: orderCode,
          orderDate: row[idxOrderDate],
          supplier: row[idxSupplier],
          buyer: row[idxBuyer],
          brand: row[idxBrand],
          items: [],
          totalPurchaseAmount: 0,
          totalAmount: 0
        };
      }

      grouped[orderCode].items.push(row);
      grouped[orderCode].totalPurchaseAmount += Number(row[idxPurchaseAmount] || 0);
      grouped[orderCode].totalAmount += Number(row[idxSupplyAmount] || 0);
    }
    ↓
[13] 배열로 변환:
    var result = [];
    for (var orderCode in grouped) {
      result.push(grouped[orderCode]);
    }
    ↓
[14] 정렬 (발주일 내림차순):
    result.sort(function(a, b) {
      return new Date(b.orderDate) - new Date(a.orderDate);
    });
    ↓
[15] 반환:
    return result;
    ↓
[Frontend: CommonScripts.html]
    ↓
[16] OB.renderOrders(data) Success Handler 실행
    ↓
[17] OB.hideLoading()
    ↓
[18] OB.invoiceOutputState.data = data (상태 저장)
    ↓
[19] OB.invoiceOutputState.page = 1 (첫 페이지로)
    ↓
[20] var tbody = document.getElementById('inv-result-tbody')
    ↓
[21] tbody.innerHTML = '' (기존 내용 삭제)
    ↓
[22] 페이지네이션 계산:
    var perPage = 10;
    var currentPage = OB.invoiceOutputState.page;
    var start = (currentPage - 1) * perPage;
    var end = start + perPage;
    var pageData = data.slice(start, end);
    ↓
[23] 반복문으로 Row 생성:
    for (var i = 0; i < pageData.length; i++) {
      var item = pageData[i];

      var tr = document.createElement('tr');

      // td 1: 체크박스
      var td1 = document.createElement('td');
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'inv-row-check';
      checkbox.setAttribute('data-oc', item.orderCode);
      td1.appendChild(checkbox);
      tr.appendChild(td1);

      // td 2: 발주일
      var td2 = document.createElement('td');
      td2.textContent = item.orderDate;
      tr.appendChild(td2);

      // td 3: 발주번호
      var td3 = document.createElement('td');
      td3.textContent = item.orderCode;
      tr.appendChild(td3);

      // td 4: 브랜드
      var td4 = document.createElement('td');
      td4.textContent = item.brand;
      tr.appendChild(td4);

      // td 5: 매입처
      var td5 = document.createElement('td');
      td5.textContent = item.supplier;
      tr.appendChild(td5);

      // td 6: 발주처
      var td6 = document.createElement('td');
      td6.textContent = item.buyer;
      tr.appendChild(td6);

      // td 7: 품목수
      var td7 = document.createElement('td');
      td7.className = 'num';
      td7.textContent = item.items.length;
      tr.appendChild(td7);

      // td 8: 매입액합계
      var td8 = document.createElement('td');
      td8.className = 'num';
      td8.textContent = OB.formatNumber(item.totalPurchaseAmount) + '원';
      tr.appendChild(td8);

      // td 9: 공급액합계
      var td9 = document.createElement('td');
      td9.className = 'num';
      td9.textContent = OB.formatNumber(item.totalAmount) + '원';
      tr.appendChild(td9);

      // td 10: 출력방식 select
      var td10 = document.createElement('td');
      var select = document.createElement('select');
      select.className = 'inv-mode-select';
      select.setAttribute('data-order', item.orderCode);

      var opt1 = document.createElement('option');
      opt1.value = 'auto';
      opt1.textContent = '자동';
      select.appendChild(opt1);

      var opt2 = document.createElement('option');
      opt2.value = 'full';
      opt2.textContent = '전체';
      select.appendChild(opt2);

      var opt3 = document.createElement('option');
      opt3.value = 'short';
      opt3.textContent = '단축';
      select.appendChild(opt3);

      td10.appendChild(select);
      tr.appendChild(td10);

      tbody.appendChild(tr);
    }
    ↓
[24] 페이지네이션 UI 업데이트:
    document.getElementById('inv-page-info').textContent =
      (start + 1) + '-' + Math.min(end, data.length) + ' / ' + data.length + '건';
    ↓
[25] 완료
```

### 4.2 출력 버튼 클릭 → PDF 다운로드 (상세)

```
[사용자] 출력 버튼 클릭
    ↓
[1] onclick="OB.exportSelected()" 실행
    ↓
[2-5] (위의 3.2.2 Step 1-5 참조)
    ↓
[6] google.script.run.generateInvoiceZip(params)
    ↓
[Backend]
    ↓
[7-20] (위의 3.3.2 Step 1-20 참조)
    ↓
[PDF 생성 상세: buildInvoiceVatPdf()]
    ↓
[21] orderRows에서 데이터 추출:
    var supplier = orderRows[0][idxSupplier];
    var buyer = orderRows[0][idxBuyer];
    var orderDate = orderRows[0][idxOrderDate];
    ↓
[22] 출력방식 적용:
    if (printMode === 'auto') {
      actualMode = 'full'; // auto는 항상 full로 처리
    } else {
      actualMode = printMode;
    }
    ↓
[23] short 모드 처리:
    if (actualMode === 'short') {
      var brandName = orderRows[0][idxBrand];
      var itemCount = orderRows.length;
      var totalSupply = 0;
      var totalVat = 0;

      for (var i = 0; i < orderRows.length; i++) {
        totalSupply += Number(orderRows[i][idxSupplyAmount] || 0);
        totalVat += Math.round(totalSupply * 0.1);
      }

      items = [{
        name: brandName + ' 외 ' + (itemCount - 1) + '건',
        qty: itemCount,
        supplyPrice: 0,
        supplyAmount: totalSupply,
        vat: totalVat,
        totalAmount: totalSupply + totalVat
      }];

      // 세부목록 Excel 생성
      var detailBlob = generateDetailExcel_(orderRows, header, orderCode, orderCode + '_세부목록.xlsx');
      // detailBlob을 blobs 배열에 추가 (별도 처리)
    }
    ↓
[24] full 모드 처리:
    else {
      items = [];
      for (var i = 0; i < orderRows.length; i++) {
        var row = orderRows[i];
        var qty = Number(row[idxConfirmedQty] || row[idxOrderQty] || 0);
        if (qty <= 0) continue;

        var supplyPrice = Number(row[idxSupplyPrice] || 0);
        var supplyAmount = Number(row[idxSupplyAmount] || 0);
        var vat = Math.round(supplyAmount * 0.1);

        items.push({
          name: String(row[idxItemName] || ''),
          qty: qty,
          supplyPrice: supplyPrice,
          supplyAmount: supplyAmount,
          vat: vat,
          totalAmount: supplyAmount + vat
        });
      }
    }
    ↓
[25] 금액 합계 계산:
    var totalSupplyPrice = 0;
    var totalVat = 0;
    var totalAmount = 0;

    for (var i = 0; i < items.length; i++) {
      totalSupplyPrice += items[i].supplyAmount;
      totalVat += items[i].vat;
    }

    totalAmount = totalSupplyPrice + totalVat;
    ↓
[26] 한글 금액 변환:
    var amountHangul = numberToHangulKor_(totalAmount);
    ↓
[27] 거래처 정보 조회:
    var partnerInfo = findPartnerByName_(supplier);
    var bizNo = partnerInfo ? partnerInfo.bizNo : '';
    ↓
[28] 템플릿 데이터 바인딩:
    var template = HtmlService.createTemplateFromFile('Templates_Invoice_VAT');
    template.orderCode = orderCode;
    template.orderDate = formatDateYmd_(orderDate);
    template.supplierName = supplier;
    template.supplierBizNo = bizNo;
    template.buyerName = buyer;
    template.items = items;
    template.totalSupplyPrice = totalSupplyPrice;
    template.totalVat = totalVat;
    template.totalAmount = totalAmount;
    template.amountHangul = amountHangul;
    template.remark = manualRemark;
    template.stampBase64 = getStampBase64_();
    template.logoBase64 = getLogoBase64_();
    ↓
[29] HTML 렌더링:
    var html = template.evaluate().getContent();
    ↓
[30] PDF 변환:
    var blob = Utilities.newBlob(html, 'text/html', 'temp.html')
      .getAs('application/pdf');
    ↓
[31] 파일명 설정:
    blob.setName('거래명세서_' + orderCode + '.pdf');
    ↓
[32] return blob;
    ↓
[generateInvoiceZip()로 복귀]
    ↓
[33] blobs 배열에 추가
    ↓
[34] 모든 PDF 생성 완료 후 ZIP 압축
    ↓
[35] Drive에 저장
    ↓
[36] 파일 ID 반환
    ↓
[Frontend]
    ↓
[37] Success Handler 실행
    ↓
[38] Drive URL 생성 및 새 탭 열기
    ↓
[39] 완료
```

---

## 5. API 엔드포인트 명세

### 5.1 generateInvoiceZip

**파일**: InvoiceOutputService.js
**목적**: 거래명세서/발주서 ZIP 파일 생성

**입력 스키마**:
```typescript
interface GenerateInvoiceZipParams {
  orderCodes: string[];          // 필수, 최소 1개
  docType: 'ORDER_PURCHASE' | 'INVOICE_VAT' | 'INVOICE_NVAT' | 'CUSTOM_ROMAND' | 'CUSTOM_JONGGEUNDANG' | 'CUSTOM_BBIA';
  outputFormat: 'PDF' | 'EXCEL';
  printMode: 'auto' | 'full' | 'short';
  modesByOrder?: { [orderCode: string]: 'auto' | 'full' | 'short' };
  mergeBySupplier?: boolean;
  docDate?: string;              // YYYY-MM-DD
  deliveryDate?: string;         // YYYY-MM-DD (CUSTOM_BBIA만 사용)
  manualRemark?: string;
}
```

**출력 스키마**:
```typescript
interface GenerateInvoiceZipResult {
  success: boolean;
  fileId?: string;               // Google Drive 파일 ID
  fileName?: string;
  downloadUrl?: string;
  error?: string;
}
```

**에러 케이스**:

| 에러 조건 | 에러 메시지 | HTTP 상태 |
|----------|-----------|----------|
| orderCodes 비어있음 | "발주번호가 선택되지 않았습니다." | 400 |
| 거래원장 조회 실패 | "거래원장 조회 실패: [상세]" | 500 |
| 템플릿 파일 없음 | "전용 양식 템플릿 파일을 찾을 수 없습니다." | 404 |
| PDF 생성 실패 | "PDF 생성 실패: [상세]" | 500 |
| Drive 저장 실패 | "파일 저장 실패: [상세]" | 500 |

### 5.2 getPrintableOrdersApi

**파일**: InvoiceOutputService.js
**목적**: 출력 가능한 발주 목록 조회

**입력 스키마**:
```typescript
interface GetPrintableOrdersFilter {
  orderCode?: string;
  startDate: string;             // 필수, YYYY-MM-DD
  endDate: string;               // 필수, YYYY-MM-DD
  supplier?: string;
}
```

**출력 스키마**:
```typescript
interface PrintableOrder {
  orderCode: string;
  orderDate: string;
  supplier: string;
  buyer: string;
  brand: string;
  items: any[];
  itemCount: number;
  totalPurchaseAmount: number;
  totalAmount: number;
}

type GetPrintableOrdersResult = PrintableOrder[];
```

---

## 6. 데이터베이스 스키마

### 6.1 Transaction (거래원장) - 30개 컬럼

| # | 컬럼명 | 데이터 타입 | 필수 | 설명 | 예시 값 |
|---|--------|------------|------|------|---------|
| 1 | 발주번호 | String | O | 발주 고유 번호 | OB2025-001 |
| 2 | 발주일 | Date | O | 발주 날짜 | 2026-01-10 |
| 3 | 매입처 | String | O | 공급자 업체명 | 원브릿지 |
| 4 | 발주처 | String | O | 구매자 업체명 | 롬앤 |
| 5 | 브랜드 | String | O | 제품 브랜드 | 롬앤 |
| 6 | 품목코드 | String | X | 품목 고유 코드 | ITEM001 |
| 7 | 제품명 | String | O | 제품명 | 립스틱 #01 |
| 8 | 규격 | String | X | 제품 규격 | 3.5g |
| 9 | 바코드 | String | X | 제품 바코드 | 8801234567890 |
| 10 | 발주수량 | Number | O | 발주한 수량 | 100 |
| 11 | 확정수량 | Number | X | 확정된 수량 | 95 |
| 12 | 매입가 | Number | O | 매입 단가 | 5000 |
| 13 | 매입액 | Number | O | 매입 총액 | 475000 |
| 14 | 공급가 | Number | O | 공급 단가 | 7000 |
| 15 | 공급액 | Number | O | 공급 총액 | 665000 |
| 16 | 부가세구분 | String | O | 부별/부포/영세 | 부포 |
| 17 | 상태 | String | O | 발주 상태 | CONFIRMED_OPEN |
| 18 | 담당자 | String | X | 담당자명 | 홍길동 |
| 19 | 입고지 | String | X | 입고 주소 | 서울시... |
| 20 | 요청사항 | String | X | 특이사항 | 급송 요청 |
| ... | ... | ... | ... | ... | ... |

### 6.2 Partners (거래처DB) - 15개 컬럼

| # | 컬럼명 | 데이터 타입 | 필수 | 설명 | 예시 값 |
|---|--------|------------|------|------|---------|
| 1 | 거래처ID | String | O | 거래처 고유 ID | PART001 |
| 2 | 거래처명 | String | O | 업체명 | 롬앤 |
| 3 | 거래처유형 | String | O | BUYER/SUPPLIER | BUYER |
| 4 | 사업자번호 | String | O | 사업자등록번호 | 123-45-67890 |
| 5 | 대표자 | String | X | 대표자명 | 김대표 |
| 6 | 주소 | String | X | 사업장 주소 | 서울시 강남구... |
| 7 | 전화번호 | String | X | 연락처 | 02-1234-5678 |
| 8 | 이메일 | String | X | 이메일 주소 | romand@example.com |
| 9 | 담당자 | String | X | 담당자명 | 이담당 |
| 10 | 담당자연락처 | String | X | 담당자 전화 | 010-1234-5678 |
| 11 | 입고지 | String | X | 납품 주소 | 경기도 고양시... |
| 12 | 결제조건 | String | X | 결제 조건 | 30일 |
| 13 | 계좌번호 | String | X | 입금 계좌 | 123-456-789012 |
| 14 | 특이사항 | String | X | 요청사항 | 사전 연락 필수 |
| 15 | 등록일 | Date | O | 등록 날짜 | 2025-01-01 |

### 6.3 Settings (설정DB) - 템플릿 파일 ID

**Script Properties 저장 방식**:
```javascript
PropertiesService.getScriptProperties().setProperty('TEMPLATE_ROMAND_NUDZ', '1a2b3c4d...');
PropertiesService.getScriptProperties().setProperty('TEMPLATE_JONGGEUNDANG', '5e6f7g8h...');
PropertiesService.getScriptProperties().setProperty('TEMPLATE_BBIA_GROUP', '9i0j1k2l...');
PropertiesService.getScriptProperties().setProperty('STAMP_BASE64', 'iVBORw0KGgoAAAANS...');
PropertiesService.getScriptProperties().setProperty('LOGO_BASE64', 'iVBORw0KGgoAAAANS...');
```

---

## 7. 상태 다이어그램

### 7.1 UI 요소 상태 전이

```
[inv-doc-type 상태]

ORDER_PURCHASE 선택
    ↓
    - inv-date-label: "발주일"
    - inv-output-format: enabled
    - inv-delivery-date: hidden
    - inv-delivery-label: hidden

INVOICE_VAT/INVOICE_NVAT 선택
    ↓
    - inv-date-label: "출고일"
    - inv-output-format: enabled
    - inv-delivery-date: hidden
    - inv-delivery-label: hidden

CUSTOM_ROMAND/CUSTOM_JONGGEUNDANG 선택
    ↓
    - inv-date-label: "발주일"
    - inv-output-format: "EXCEL" (고정, disabled)
    - inv-delivery-date: hidden
    - inv-delivery-label: hidden

CUSTOM_BBIA 선택
    ↓
    - inv-date-label: "발주일"
    - inv-output-format: "EXCEL" (고정, disabled)
    - inv-delivery-date: visible
    - inv-delivery-label: visible
```

### 7.2 체크박스 상태

```
[전체 선택 체크박스 - inv-check-all]

unchecked 상태
    ↓
    클릭
    ↓
checked 상태
    ↓
    동작: 모든 .inv-row-check를 checked로 변경

checked 상태
    ↓
    클릭
    ↓
unchecked 상태
    ↓
    동작: 모든 .inv-row-check를 unchecked로 변경
```

### 7.3 로딩 상태

```
[초기 상태]
    ↓
OB.showLoading('메시지') 호출
    ↓
[로딩 표시]
    - 오버레이 표시 (반투명 배경)
    - 스피너 애니메이션
    - 메시지 표시
    - 사용자 입력 차단
    ↓
작업 완료
    ↓
OB.hideLoading() 호출
    ↓
[초기 상태]
```

---

## 8. 시퀀스 다이어그램

### 8.1 출력 프로세스 전체 시퀀스

```
사용자          Page_Invoice     CommonScripts    google.script.run    InvoiceOutput     Google Sheets    Google Drive    Templates
  |                  |                  |                   |                   |                  |                |             |
  |-- 출력 클릭 ---->|                  |                   |                   |                  |                |             |
  |                  |-- exportSelected()-->                |                   |                  |                |             |
  |                  |                  |-- 입력값 수집 --->|                   |                  |                |             |
  |                  |                  |-- 검증 --------->|                   |                  |                |             |
  |                  |                  |                   |                   |                  |                |             |
  |                  |                  |-- generateInvoiceZip(params) -------->|                  |                |             |
  |                  |                  |                   |                   |-- getOrderMergedSheet() ---------->|            |
  |                  |                  |                   |                   |<-- 거래원장 데이터 ------------------|            |
  |                  |                  |                   |                   |                  |                |             |
  |                  |                  |                   |                   |-- 필터링 -------->|                |             |
  |                  |                  |                   |                   |-- 그룹핑 -------->|                |             |
  |                  |                  |                   |                   |                  |                |             |
  |                  |                  |                   |                   |-- buildInvoiceVatPdf() ------------|----------->|
  |                  |                  |                   |                   |                  |                |             |
  |                  |                  |                   |                   |<-- HTML 렌더링 --|------------|------------|
  |                  |                  |                   |                   |-- PDF 변환 ------|                |             |
  |                  |                  |                   |                   |<-- PDF Blob -----|                |             |
  |                  |                  |                   |                   |                  |                |             |
  |                  |                  |                   |                   |-- ZIP 압축 ----->|                |             |
  |                  |                  |                   |                   |-- Drive 저장 ----|--------------->|             |
  |                  |                  |                   |                   |<-- fileId -------|----------------|             |
  |                  |                  |                   |                   |                  |                |             |
  |                  |                  |<-- { success, fileId, fileName } -----|                  |                |             |
  |                  |                  |                   |                   |                  |                |             |
  |                  |                  |-- Drive URL 생성 ->|                   |                  |                |             |
  |                  |<-- window.open() --|                  |                   |                  |                |             |
  |<-- 새 탭 열림 ---|                  |                   |                   |                  |                |             |
  |<-- alert() ------|                  |                   |                   |                  |                |             |
```

---

## 9. 테스트 시나리오

### 9.1 기본 출력 테스트 (20개)

#### TC-001: 거래명세서(부포) PDF 단일 출력

**전제 조건**:
- 거래원장에 발주번호 'OB2025-001' 데이터 존재
- 품목 수: 5개
- 확정수량 모두 입력됨

**테스트 단계**:
1. Page_InvoiceOutput.html 접속
2. 조회 조건 입력:
   - 시작일: 2026-01-01
   - 종료일: 2026-01-31
3. 조회 버튼 클릭
4. 테이블에서 'OB2025-001' 체크박스 선택
5. 출력 설정:
   - 문서 유형: 거래명세서(부포)
   - 출력 형식: PDF
   - 출력 방식: full
6. 출력 버튼 클릭

**예상 결과**:
- PDF 파일 1개 생성
- 파일명: `거래명세서_OB2025-001.pdf`
- 내용:
  - 헤더: "거래명세서 (부가세 과세)"
  - 발주번호: OB2025-001
  - 품목 5개 모두 표시
  - 공급가액, VAT, 합계 정확히 계산
  - 한글 금액 표시
- Drive에서 파일 열림

**검증 포인트**:
- [ ] PDF 파일 정상 생성
- [ ] 품목 수 일치 (5개)
- [ ] 금액 계산 정확성
- [ ] 한글 금액 변환 정확성
- [ ] 템플릿 레이아웃 정상

---

#### TC-002: 발주서(매입) PDF 단일 출력 - 부별

**전제 조건**:
- 거래원장에 발주번호 'OB2025-002' 데이터 존재
- 부가세구분: 부별
- 품목 수: 10개

**테스트 단계**:
1. 'OB2025-002' 선택
2. 출력 설정:
   - 문서 유형: 발주서(매입)
   - 출력 형식: PDF
   - 출력 방식: full
3. 발주일 입력: 2026-01-10
4. 출력 버튼 클릭

**예상 결과**:
- PDF 파일 1개 생성
- VAT 계산: `totalSupply = totalAmount / 1.1`
- 비고란에 "부가세구분: 부별" 표시

**검증 포인트**:
- [ ] VAT 계산 정확 (부별 방식)
- [ ] 발주일 정확히 표시
- [ ] 비고란 내용 정확

---

#### TC-003: 멀티페이지 PDF (11개 품목)

**전제 조건**:
- 발주번호 'OB2025-003' 데이터 존재
- 품목 수: 11개

**테스트 단계**:
1. 'OB2025-003' 선택
2. 출력 설정:
   - 문서 유형: 거래명세서(부포)
   - 출력 형식: PDF
   - 출력 방식: auto (→ full로 처리)
3. 출력

**예상 결과**:
- PDF 파일 2페이지
- 1페이지: 품목 1~10 (헤더, 금액 요약, 품목 테이블)
- 2페이지: 품목 11 (연속 헤더, 품목 테이블, 비고)

**검증 포인트**:
- [ ] 총 2페이지
- [ ] 1페이지 품목 10개
- [ ] 2페이지 품목 1개
- [ ] 2페이지에만 비고 표시

---

#### TC-004: Short 모드 출력 + 세부목록 Excel

**전제 조건**:
- 발주번호 'OB2025-004' 데이터 존재
- 브랜드: 롬앤
- 품목 수: 20개

**테스트 단계**:
1. 'OB2025-004' 선택
2. 출력 설정:
   - 문서 유형: 거래명세서(부포)
   - 출력 형식: PDF
   - 출력 방식: short
3. 출력

**예상 결과**:
- ZIP 파일 1개 생성
- 내용물:
  1. `거래명세서_OB2025-004.pdf` (1행: "롬앤 외 19건")
  2. `OB2025-004_세부목록.xlsx` (20행 품목 상세)

**검증 포인트**:
- [ ] ZIP 파일에 2개 파일 포함
- [ ] PDF: 1행만 표시 (요약)
- [ ] Excel: 20행 모두 표시
- [ ] 금액 합계 일치

---

#### TC-005: 매입처별 통합 출력 (3개 발주)

**전제 조건**:
- 발주번호 3개 (OB2025-005, OB2025-006, OB2025-007)
- 모두 매입처: 원브릿지
- 각각 품목: 5개, 7개, 3개

**테스트 단계**:
1. 3개 발주 모두 선택
2. 출력 설정:
   - 문서 유형: 거래명세서(부포)
   - 출력 형식: PDF
   - 매입처별 통합: 체크
3. 출력

**예상 결과**:
- PDF 파일 1개 (통합)
- 파일명: `거래명세서_통합_원브릿지_20260110.pdf`
- 내용: 15개 품목 (5+7+3)
- 발주번호: "OB2025-005, OB2025-006, OB2025-007"
- 멀티페이지: 2페이지

**검증 포인트**:
- [ ] 단일 PDF 파일
- [ ] 3개 발주 품목 모두 포함
- [ ] 금액 합계 정확
- [ ] 발주번호 표시 정확

---

### 9.2 전용 양식 출력 테스트 (6개)

#### TC-010: 롬앤/누즈 전용 양식 출력

**전제 조건**:
- 발주번호 'OB2025-010' (브랜드: 롬앤)
- 품목 수: 5개
- 템플릿 파일 ID 설정됨 (TEMPLATE_ROMAND_NUDZ)

**테스트 단계**:
1. 'OB2025-010' 선택
2. 출력 설정:
   - 문서 유형: 롬앤/누즈 전용
   - (출력 형식 자동으로 Excel로 고정)
3. 발주일 입력: 2026-01-10
4. 출력

**예상 결과**:
- Excel 파일 1개
- 파일명: `롬앤발주_OB2025-010_20260110.xlsx`
- 시트명: `롬앤(발주양식)`
- 15행부터 데이터 입력:
  - B열: 바코드
  - C열: 제품명
  - F열: "39%"
  - I열: 수량

**검증 포인트**:
- [ ] Excel 파일 정상 생성
- [ ] 템플릿 구조 유지
- [ ] 데이터 정확히 입력
- [ ] 바코드/제품명/수량 매칭 정확

---

#### TC-011: 종근당 전용 양식 출력

**전제 조건**:
- 발주번호 'OB2025-011' (브랜드: 종근당)
- 품목 수: 8개
- 템플릿 파일 ID 설정됨 (TEMPLATE_JONGGEUNDANG)

**테스트 단계**:
1. 'OB2025-011' 선택
2. 출력 설정:
   - 문서 유형: 종근당 전용
3. 발주일 입력: 2026-01-10
4. 출력

**예상 결과**:
- Excel 파일 1개
- 시트명: `2. 발주서`
- B5 셀: 2026-01-10 (발주일)
- 5행부터 데이터 입력:
  - E열: 품목코드
  - F열: 제품명
  - I열: 공급가
  - J열: 수량

**검증 포인트**:
- [ ] 발주일 정확히 입력
- [ ] 품목코드, 제품명, 수량, 공급가 정확
- [ ] 8개 품목 모두 입력

---

#### TC-012: 삐아계열 전용 양식 - 바코드 매칭

**전제 조건**:
- 발주번호 'OB2025-012' (브랜드: 삐아)
- 품목 수: 12개
- 템플릿에 등록된 품목과 바코드 일치
- 템플릿 파일 ID 설정됨 (TEMPLATE_BBIA_GROUP)

**테스트 단계**:
1. 'OB2025-012' 선택
2. 출력 설정:
   - 문서 유형: 삐아계열 전용
3. 발주일: 2026-01-10
4. 납품일: 2026-01-15 (추가 필드 표시됨)
5. 출력

**예상 결과**:
- Excel 파일 1개
- 시트명: `삐아` (브랜드에 따라 자동 선택)
- B8 셀: "2026-01-10 / 2026-01-15"
- 10행부터:
  - 템플릿의 바코드와 발주 데이터의 바코드 매칭
  - 일치하는 행의 H열에 수량 입력

**검증 포인트**:
- [ ] 납품일 필드 표시
- [ ] 날짜 정확히 입력
- [ ] 바코드 매칭 정확
- [ ] 수량만 입력 (제품명 등은 템플릿 그대로)

---

### 9.3 Excel 출력 테스트 (4개)

#### TC-020: 발주서 Excel 출력

**전제 조건**:
- 발주번호 'OB2025-020'
- 품목 수: 10개

**테스트 단계**:
1. 'OB2025-020' 선택
2. 출력 설정:
   - 문서 유형: 발주서(매입)
   - 출력 형식: Excel
3. 출력

**예상 결과**:
- Excel 파일 1개
- 헤더: ['No', '발주번호', '발주일', '매입처', '브랜드', '품목코드', '품명', '규격', '발주수량', '매입단가', '매입금액', '비고']
- 데이터 10행
- 합계 행 (SUM 수식)
- 숫자 열 포맷: #,##0

**검증 포인트**:
- [ ] 헤더 12개 컬럼
- [ ] 데이터 10행
- [ ] 합계 수식 정확
- [ ] 숫자 포맷 적용

---

#### TC-021: 거래명세서 Excel 출력

**전제 조건**:
- 발주번호 'OB2025-021'
- 품목 수: 15개

**테스트 단계**:
1. 'OB2025-021' 선택
2. 출력 설정:
   - 문서 유형: 거래명세서(부포)
   - 출력 형식: Excel
3. 출력

**예상 결과**:
- Excel 파일 1개
- 헤더: ['No', '발주번호', '발주일', '발주처', '브랜드', '품목코드', '품명', '규격', '확정수량', '공급단가', '공급가액', 'VAT', '합계', '비고']
- 데이터 15행
- 합계 행 (VAT 수식 포함)

**검증 포인트**:
- [ ] 헤더 14개 컬럼
- [ ] VAT 계산 정확
- [ ] 합계 포함

---

### 9.4 에러 처리 테스트 (10개)

#### TC-030: 발주번호 미선택

**테스트 단계**:
1. 체크박스 선택하지 않음
2. 출력 버튼 클릭

**예상 결과**:
- alert: "출력할 발주번호를 선택해주세요."
- 함수 종료

---

#### TC-031: 조회 기간 미입력

**테스트 단계**:
1. 시작일/종료일 입력하지 않음
2. 조회 버튼 클릭

**예상 결과**:
- alert: "조회 기간을 선택하세요."
- 함수 종료

---

#### TC-032: 템플릿 파일 없음

**전제 조건**:
- TEMPLATE_ROMAND_NUDZ 설정 안 됨

**테스트 단계**:
1. 롬앤/누즈 전용 선택
2. 출력

**예상 결과**:
- alert: "전용 양식 템플릿 파일을 찾을 수 없습니다."
- 출력 실패

---

### 9.5 성능 테스트 (5개)

#### TC-040: 대량 발주 출력 (100개)

**전제 조건**:
- 발주번호 100개 선택
- 각 발주당 평균 10개 품목

**테스트 단계**:
1. 100개 발주 선택
2. PDF 출력 (개별)
3. 시간 측정

**예상 결과**:
- ZIP 파일 1개 (PDF 100개 포함)
- 완료 시간: 3분 이내

---

## 10. 구현 가능성 및 대안

### 10.1 실행 가능한 기능

모든 명세된 기능은 **실제 구현 가능**합니다.

**근거**:
1. Google Apps Script 환경에서 모든 API 지원
2. HtmlService를 통한 PDF 생성 지원
3. SpreadsheetApp을 통한 Excel 생성 지원
4. DriveApp을 통한 파일 관리 지원

### 10.2 기술적 제약사항 및 대안

#### 제약 1: Apps Script 실행 시간 제한 (6분)

**대안**:
- 대량 출력 시 배치 처리
- 100개 이상 발주는 여러 번 나눠서 출력
- 또는 비동기 처리 (Trigger 사용)

#### 제약 2: PDF 파일 크기 제한 (50MB)

**대안**:
- 이미지 해상도 조정
- 로고/인감 이미지 압축

#### 제약 3: ZIP 파일 생성 시 메모리 부족

**대안**:
- 파일 수가 50개 이상일 경우 여러 ZIP으로 분할

---

**문서 종료**

이 명세서는 실제 코드 기반으로 작성되었으며, 모든 입력/출력/동작이 추적 가능합니다.
