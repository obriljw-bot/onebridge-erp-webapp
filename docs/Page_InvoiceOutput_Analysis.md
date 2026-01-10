# Page_InvoiceOutput.html 완전 분석 문서

**파일 위치**: `/tmp/previous_branch/Page_InvoiceOutput.html`
**작성일**: 2026-01-10
**분석 버전**: 이전 브랜치 (claude/erp-partial-payment-continue-Dgmz2)

---

## 1. HTML 구조 완전 분석

### 1.1 전체 계층 구조

```
<div class="ob-container">
├── <div class="tab-navigation">
│   ├── <div class="tab-nav-item active" data-tab="order-output">
│   └── <div class="tab-nav-item" data-tab="bulk-billing">
│
├── <div id="tab-order-output" class="tab-content active">      ← 탭 1: 발주번호별 출력
│   ├── <div class="ob-topbar">                                 ← 조회 조건 섹션
│   │   ├── <input id="inv-order-code">
│   │   ├── <input id="inv-start-date">
│   │   ├── <input id="inv-end-date">
│   │   ├── <input id="inv-supplier">
│   │   └── <button id="inv-search-btn">
│   │
│   ├── <div class="ob-topbar">                                 ← 출력 설정 섹션
│   │   ├── <select id="inv-doc-type">
│   │   ├── <select id="inv-default-mode">
│   │   ├── <select id="inv-output-format">
│   │   ├── <input id="inv-doc-date">
│   │   ├── <label id="inv-date-label">
│   │   ├── <input id="inv-delivery-date">
│   │   ├── <label id="inv-delivery-label">
│   │   ├── <input type="checkbox" id="inv-manual-remark">
│   │   ├── <input type="checkbox" id="inv-merge-by-supplier">
│   │   └── <button id="inv-export-selected">
│   │
│   ├── <div id="inv-remark-input-area">                        ← 비고 수동입력 영역 (조건부)
│   │   └── <textarea id="inv-manual-remark-text">
│   │
│   ├── <div class="ob-table-wrap">                             ← 테이블 영역
│   │   └── <table>
│   │       ├── <thead>
│   │       │   └── <tr>
│   │       │       ├── <th><input type="checkbox" id="inv-check-all"></th>
│   │       │       └── (9개 컬럼 헤더)
│   │       └── <tbody id="inv-result-tbody">
│   │
│   └── <div class="pagination-container" id="inv-pagination">  ← 페이지네이션
│       ├── <div class="page-info" id="inv-page-info">
│       └── <div class="pagination-controls">
│           ├── <button id="inv-page-first">
│           ├── <button id="inv-page-prev">
│           ├── <div id="inv-page-numbers">
│           ├── <button id="inv-page-next">
│           └── <button id="inv-page-last">
│
└── <div id="tab-bulk-billing" class="tab-content">             ← 탭 2: 일괄 청구서
    ├── <div class="ob-topbar">                                 ← 검색 옵션바
    │   ├── <input id="billing-company">
    │   ├── <input id="billing-start-date">
    │   ├── <input id="billing-end-date">
    │   ├── <button id="billing-search-btn">
    │   └── <button id="billing-reset-btn">
    │
    ├── <div class="billing-summary" id="billing-summary">      ← 청구서 요약
    │   ├── <div class="billing-summary-card">
    │   │   ├── <div class="billing-summary-label">총 품목수</div>
    │   │   └── <div class="billing-summary-value" id="billing-total-items">
    │   ├── <div class="billing-summary-card">
    │   │   ├── <div class="billing-summary-label">총 발주수량</div>
    │   │   └── <div class="billing-summary-value" id="billing-total-order-qty">
    │   ├── <div class="billing-summary-card">
    │   │   ├── <div class="billing-summary-label">총 확정수량</div>
    │   │   └── <div class="billing-summary-value" id="billing-total-confirmed-qty">
    │   └── <div class="billing-summary-card">
    │       ├── <div class="billing-summary-label">총 청구금액</div>
    │       └── <div class="billing-summary-value" id="billing-total-amount">
    │
    ├── <div class="ob-table-wrap">                             ← 상세 테이블
    │   └── <table>
    │       ├── <thead>
    │       └── <tbody id="billing-result-tbody">
    │
    └── <div id="billing-actions">                              ← 액션 버튼
        ├── <button id="billing-export-xlsx">
        ├── <button id="billing-export-pdf">
        └── <button id="billing-save-db">
```

### 1.2 레이아웃 구조

- **최상위 컨테이너**: `.ob-container` (padding: 20px)
- **탭 네비게이션**: Flexbox 레이아웃 (display: flex, gap: 0)
- **탭 콘텐츠**: Block 레이아웃 (조건부 display)
- **상단 옵션바**: Flexbox 레이아웃 (display: flex, gap: 12px, flex-wrap: wrap)
- **청구서 요약**: Grid 레이아웃 (grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)))
- **테이블**: Overflow-auto 컨테이너 (max-height: 720px)
- **페이지네이션**: Flexbox 레이아웃 (justify-content: space-between)

---

## 2. 모든 입력 요소 상세 분석

### 2.1 탭 1: 발주번호별 출력

#### 2.1.1 조회 조건 섹션

| 요소 타입 | ID | Name | Type | Placeholder | 기본값 | 비고 |
|-----------|----|----|------|-------------|--------|------|
| input | `inv-order-code` | - | text | "OB2025-..." | - | 발주번호 검색 |
| input | `inv-start-date` | - | date | - | - | 시작일 |
| input | `inv-end-date` | - | date | - | - | 종료일 |
| input | `inv-supplier` | - | text | "업체명" | - | 매입처 검색 |
| button | `inv-search-btn` | - | - | - | - | 조회 버튼 |

#### 2.1.2 출력 설정 섹션

##### Select 요소 1: 문서유형 (`inv-doc-type`)

| ID | Name | Min-Width | 기본값 |
|----|------|-----------|--------|
| `inv-doc-type` | - | 160px | ORDER_PURCHASE |

**Options 목록**:

```html
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
```

##### Select 요소 2: 출력방식 (`inv-default-mode`)

| ID | Name | 기본값 |
|----|------|--------|
| `inv-default-mode` | - | auto |

**Options 목록**:

| Value | Text |
|-------|------|
| `auto` | 자동(10행 기준) |
| `full` | 전체내역 |
| `short` | 단축내역 |

##### Select 요소 3: 출력형식 (`inv-output-format`)

| ID | Name | 기본값 |
|----|------|--------|
| `inv-output-format` | - | PDF |

**Options 목록**:

| Value | Text |
|-------|------|
| `PDF` | PDF |
| `EXCEL` | Excel |

##### Input 요소: 날짜 관련

| ID | Type | Title | 기본값 | Display | 조건부 표시 |
|----|------|-------|--------|---------|------------|
| `inv-doc-date` | date | "발주서: 발주일 / 거래명세서: 출고일" | - | block | - |
| `inv-delivery-date` | date | "삐아계열 전용 양식용 납품일" | - | none | 삐아계열 선택시 |

##### Label 요소: 날짜 레이블

| ID | Text | Display | 조건부 표시 |
|----|------|---------|------------|
| `inv-date-label` | "발주일" | block | - |
| `inv-delivery-label` | "납품일" | none | 삐아계열 선택시 |

##### Checkbox 요소

| ID | Label | 기본값 | Width/Height | 비고 |
|----|-------|--------|--------------|------|
| `inv-manual-remark` | "비고 수동입력" | unchecked | 14px | 체크시 textarea 영역 표시 |
| `inv-merge-by-supplier` | "매입처별 통합" | unchecked | 16px | 매입처별 통합 출력 옵션 |

##### Textarea 요소 (조건부 표시)

| ID | Rows | Style | Placeholder | 표시 조건 |
|----|------|-------|-------------|-----------|
| `inv-manual-remark-text` | 3 | width:100%, resize:vertical | "비고란에 표시할 내용을 입력하세요..." | `inv-manual-remark` 체크시 |

**조건부 표시 영역**:
- Container ID: `inv-remark-input-area`
- Display: none (기본), block (체크시)
- Background: #fffbeb (연한 노란색)
- Border: 1px solid #fcd34d

##### Button 요소

| ID | Class | Text | 비고 |
|----|-------|------|------|
| `inv-export-selected` | `ob-btn success` | "📥 선택항목 출력" | 메인 출력 버튼 |

### 2.2 탭 2: 일괄 청구서

#### 2.2.1 검색 옵션바

| 요소 타입 | ID | Type | Placeholder | Min-Width |
|-----------|----|----|-------------|-----------|
| input | `billing-company` | text | "발주처 입력" | 200px |
| input | `billing-start-date` | date | - | - |
| input | `billing-end-date` | date | - | - |
| button | `billing-search-btn` | - | "🔍 조회" | - |
| button | `billing-reset-btn` | - | "초기화" | - |

#### 2.2.2 청구서 요약 카드

**Container ID**: `billing-summary`
**Display**: none (기본), grid (조회 후)

| Summary Value ID | Label | 기본값 |
|-----------------|-------|--------|
| `billing-total-items` | "총 품목수" | 0 |
| `billing-total-order-qty` | "총 발주수량" | 0 |
| `billing-total-confirmed-qty` | "총 확정수량" | 0 |
| `billing-total-amount` | "총 청구금액" | ₩0 |

#### 2.2.3 액션 버튼

**Container ID**: `billing-actions`
**Display**: none (기본), flex (조회 후)

| ID | Class | Text | 기능 |
|----|-------|------|------|
| `billing-export-xlsx` | `ob-btn secondary` | "📥 엑셀 다운로드" | Excel 파일 다운로드 |
| `billing-export-pdf` | `ob-btn success` | "📄 PDF 청구서 생성" | PDF 청구서 생성 |
| `billing-save-db` | `ob-btn primary` | "💾 청구서 DB 저장 + 발행" | DB 저장 및 발행 |

---

## 3. 테이블 구조

### 3.1 탭 1: 발주번호별 출력 테이블

#### 3.1.1 Thead 컬럼 목록

| 컬럼 순서 | th 내용 | class | data-sort | 비고 |
|----------|---------|-------|-----------|------|
| 1 | `<input type="checkbox" id="inv-check-all">` | - | - | 전체 선택 체크박스 |
| 2 | 발주일 | sortable | orderDate | 정렬 가능 |
| 3 | 발주번호 | sortable | orderCode | 정렬 가능 |
| 4 | 브랜드 | sortable | brand | 정렬 가능 |
| 5 | 매입처 | sortable | supplier | 정렬 가능 |
| 6 | 발주처 | sortable | buyer | 정렬 가능 |
| 7 | 품목수 | sortable num | itemCount | 정렬 가능, 우측 정렬 |
| 8 | 매입액합계 | sortable num | totalPurchaseAmount | 정렬 가능, 우측 정렬 |
| 9 | 공급액합계 | sortable num | totalAmount | 정렬 가능, 우측 정렬 |
| 10 | 출력방식 | - | - | 개별 출력방식 선택 |

#### 3.1.2 Tbody 생성 방식

- **ID**: `inv-result-tbody`
- **동적 로드**: JavaScript에서 조회 결과에 따라 동적 생성
- **기본 메시지**: `"조회 결과가 없습니다."` (colspan=10)

#### 3.1.3 각 Row 구조 (예상)

```html
<tr>
  <td><input type="checkbox" class="row-checkbox" data-order-id="..."></td>
  <td>{발주일}</td>
  <td>{발주번호}</td>
  <td>{브랜드}</td>
  <td>{매입처}</td>
  <td>{발주처}</td>
  <td class="num">{품목수}</td>
  <td class="num">{매입액합계}</td>
  <td class="num">{공급액합계}</td>
  <td>
    <select class="output-mode-select">
      <option value="auto">자동</option>
      <option value="full">전체</option>
      <option value="short">단축</option>
    </select>
  </td>
</tr>
```

### 3.2 탭 2: 일괄 청구서 테이블

#### 3.2.1 Thead 컬럼 목록

| 컬럼 순서 | th 내용 | class | 비고 |
|----------|---------|-------|------|
| 1 | 발주번호 | - | - |
| 2 | 발주일 | - | - |
| 3 | 매입처 | - | - |
| 4 | 브랜드 | - | - |
| 5 | 제품명 | - | - |
| 6 | 품목코드 | - | - |
| 7 | 발주수량 | num | 우측 정렬 |
| 8 | 확정수량 | num | 우측 정렬 |
| 9 | 공급가 | num | 우측 정렬 |
| 10 | 공급액 | num | 우측 정렬 |

#### 3.2.2 Tbody 생성 방식

- **ID**: `billing-result-tbody`
- **동적 로드**: JavaScript에서 조회 결과에 따라 동적 생성
- **기본 메시지**: `"거래처와 기간을 선택하여 조회하세요"` (colspan=10)

---

## 4. 버튼 및 액션 요소

### 4.1 탭 1: 발주번호별 출력

| ID | Class | Text | 위치 | 예상 onclick 이벤트 | 기능 |
|----|-------|------|------|-------------------|------|
| `inv-search-btn` | `ob-btn primary` | "🔍 조회" | 조회 조건 섹션 | `searchInvoices()` | 조회 조건에 따른 발주서 검색 |
| `inv-export-selected` | `ob-btn success` | "📥 선택항목 출력" | 출력 설정 섹션 | `exportSelectedInvoices()` | 선택된 항목 출력 |
| `inv-check-all` | - | (체크박스) | 테이블 헤더 | `toggleAllCheckboxes()` | 전체 선택/해제 |
| `inv-page-first` | `pagination-btn` | "처음" | 페이지네이션 | `goToPage(1)` | 첫 페이지로 이동 |
| `inv-page-prev` | `pagination-btn` | "이전" | 페이지네이션 | `goToPrevPage()` | 이전 페이지로 이동 |
| `inv-page-next` | `pagination-btn` | "다음" | 페이지네이션 | `goToNextPage()` | 다음 페이지로 이동 |
| `inv-page-last` | `pagination-btn` | "마지막" | 페이지네이션 | `goToLastPage()` | 마지막 페이지로 이동 |

### 4.2 탭 2: 일괄 청구서

| ID | Class | Text | 위치 | 예상 onclick 이벤트 | 기능 |
|----|-------|------|------|-------------------|------|
| `billing-search-btn` | `ob-btn primary` | "🔍 조회" | 검색 옵션바 | `searchBilling()` | 일괄 청구서 조회 |
| `billing-reset-btn` | `ob-btn secondary` | "초기화" | 검색 옵션바 | `resetBillingSearch()` | 검색 조건 초기화 |
| `billing-export-xlsx` | `ob-btn secondary` | "📥 엑셀 다운로드" | 액션 버튼 | `exportBillingToExcel()` | Excel 파일 다운로드 |
| `billing-export-pdf` | `ob-btn success` | "📄 PDF 청구서 생성" | 액션 버튼 | `exportBillingToPDF()` | PDF 청구서 생성 |
| `billing-save-db` | `ob-btn primary` | "💾 청구서 DB 저장 + 발행" | 액션 버튼 | `saveBillingToDB()` | DB 저장 및 발행 |

### 4.3 탭 네비게이션

| data-tab | Class | Text | 예상 onclick 이벤트 | 기능 |
|----------|-------|------|-------------------|------|
| `order-output` | `tab-nav-item active` | "📋 발주번호별 출력" | `switchTab('order-output')` | 탭 1로 전환 |
| `bulk-billing` | `tab-nav-item` | "💳 일괄 청구서" | `switchTab('bulk-billing')` | 탭 2로 전환 |

---

## 5. 스타일 및 레이아웃

### 5.1 주요 CSS 클래스

#### 5.1.1 컨테이너 클래스

| Class | 주요 스타일 | 용도 |
|-------|-----------|------|
| `.ob-container` | `padding: 20px` | 최상위 컨테이너 |
| `.ob-topbar` | `display: flex; gap: 12px; flex-wrap: wrap; padding: 12px; background: white; border-radius: 8px` | 옵션바 |
| `.ob-table-wrap` | `overflow: auto; max-height: 720px; background: white; border-radius: 8px` | 테이블 래퍼 |

#### 5.1.2 탭 관련 클래스

| Class | 주요 스타일 | 용도 |
|-------|-----------|------|
| `.tab-navigation` | `display: flex; gap: 0; background: white; border-radius: 8px 8px 0 0` | 탭 네비게이션 컨테이너 |
| `.tab-nav-item` | `padding: 12px 24px; cursor: pointer; color: #6b7280; border-bottom: 3px solid transparent` | 비활성 탭 |
| `.tab-nav-item.active` | `color: #2563eb; border-bottom-color: #2563eb; background: white` | 활성 탭 |
| `.tab-content` | `display: none` | 비활성 탭 콘텐츠 |
| `.tab-content.active` | `display: block; animation: fadeIn 0.3s` | 활성 탭 콘텐츠 |

#### 5.1.3 버튼 클래스

| Class | 주요 스타일 | 용도 |
|-------|-----------|------|
| `.ob-btn` | `padding: 8px 14px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px` | 기본 버튼 |
| `.primary` | `background: #2563eb; color: white` | 주요 액션 버튼 (파란색) |
| `.secondary` | `background: #e5e7eb` | 보조 액션 버튼 (회색) |
| `.success` | `background: #10b981; color: white` | 성공/실행 버튼 (초록색) |

#### 5.1.4 테이블 클래스

| Class | 주요 스타일 | 용도 |
|-------|-----------|------|
| `.ob-table-wrap th` | `background: #f1f5f9; font-weight: bold; position: sticky; top: 0; z-index: 10` | 고정 헤더 |
| `.ob-table-wrap td.num` | `text-align: right` | 숫자 우측 정렬 |
| `.sortable` | `cursor: pointer; user-select: none` | 정렬 가능 헤더 |
| `.sortable.asc::after` | `content: ' ↑'` | 오름차순 정렬 표시 |
| `.sortable.desc::after` | `content: ' ↓'` | 내림차순 정렬 표시 |

#### 5.1.5 청구서 요약 클래스

| Class | 주요 스타일 | 용도 |
|-------|-----------|------|
| `.billing-summary` | `display: none; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px` | 요약 카드 컨테이너 (기본 숨김) |
| `.billing-summary.active` | `display: grid` | 요약 카드 표시 |
| `.billing-summary-card` | `background: white; padding: 16px; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.1)` | 개별 요약 카드 |
| `.billing-summary-label` | `font-size: 12px; color: #64748b` | 요약 레이블 |
| `.billing-summary-value` | `font-size: 20px; font-weight: 700; color: #1e293b` | 요약 값 |

### 5.2 조건부 스타일 (display: none)

| 요소 ID | 기본 Display | 조건부 Display | 표시 조건 |
|---------|-------------|---------------|-----------|
| `inv-remark-input-area` | none | block | `inv-manual-remark` 체크박스 체크시 |
| `inv-delivery-date` | none | block | 문서유형이 `CUSTOM_BBIA` 선택시 |
| `inv-delivery-label` | none | block | 문서유형이 `CUSTOM_BBIA` 선택시 |
| `inv-pagination` | none | flex | 조회 결과가 있고 페이지가 2개 이상일 때 |
| `billing-summary` | none | grid | 일괄 청구서 조회 후 |
| `billing-actions` | none | flex | 일괄 청구서 조회 후 |

### 5.3 반응형 디자인

- **Flexbox 활용**: `flex-wrap: wrap`으로 화면 크기에 따라 자동 줄바꿈
- **Grid 레이아웃**: `auto-fit, minmax(200px, 1fr)`로 카드 크기 자동 조정
- **고정 헤더**: `position: sticky; top: 0`으로 스크롤시 헤더 고정
- **반응형 여부**: 부분적 반응형 (Flexbox/Grid 활용, 모바일 최적화는 제한적)

---

## 6. 페이지별 기능 맵핑

### 6.1 탭 1: 발주번호별 출력

#### 6.1.1 작업 1: 발주서 조회

**시작점**:
- 입력: `inv-order-code`, `inv-start-date`, `inv-end-date`, `inv-supplier`
- 버튼: `inv-search-btn` 클릭

**처리 과정** (예상):
1. 조회 조건 수집
2. API 호출: `GET /api/invoices?orderCode=...&startDate=...&endDate=...&supplier=...`
3. 결과 데이터 파싱

**결과**:
- `inv-result-tbody` 업데이트 (테이블 행 동적 생성)
- `inv-pagination` 표시 (결과가 여러 페이지일 경우)
- 각 행에 체크박스 및 출력방식 select 추가

#### 6.1.2 작업 2: 문서유형 변경

**시작점**:
- Select: `inv-doc-type` 변경

**처리 과정** (예상):
1. 선택된 문서유형 확인
2. 문서유형에 따라 레이블 변경:
   - ORDER_PURCHASE: "발주일" 표시
   - INVOICE_VAT/INVOICE_NVAT: "출고일" 표시
   - CUSTOM_BBIA: "발주일" + "납품일" 모두 표시
3. 조건부 필드 표시/숨김

**결과**:
- `inv-date-label` 텍스트 변경
- `inv-delivery-date`, `inv-delivery-label` 표시/숨김

#### 6.1.3 작업 3: 비고 수동입력 설정

**시작점**:
- Checkbox: `inv-manual-remark` 체크

**처리 과정**:
1. 체크박스 상태 확인
2. 조건부 영역 표시/숨김

**결과**:
- `inv-remark-input-area` 표시 (체크시)
- `inv-manual-remark-text` textarea 활성화

#### 6.1.4 작업 4: 선택 항목 출력

**시작점**:
- 체크박스: 개별 행 체크 또는 `inv-check-all` 전체 선택
- 버튼: `inv-export-selected` 클릭

**처리 과정** (예상):
1. 체크된 행 수집
2. 각 행의 출력방식(auto/full/short) 확인
3. 출력 설정 수집:
   - 문서유형: `inv-doc-type`
   - 출력형식: `inv-output-format`
   - 문서 날짜: `inv-doc-date`
   - 납품일 (조건부): `inv-delivery-date`
   - 비고: `inv-manual-remark-text` (체크시)
   - 매입처별 통합: `inv-merge-by-supplier`
4. API 호출: `POST /api/invoices/export`
5. 파일 생성 및 다운로드

**결과**:
- PDF 또는 Excel 파일 다운로드
- 통합 옵션 선택시 매입처별로 묶어서 출력

#### 6.1.5 작업 5: 정렬

**시작점**:
- 테이블 헤더의 `.sortable` 클릭

**처리 과정** (예상):
1. 클릭된 컬럼의 `data-sort` 속성 확인
2. 현재 정렬 방향 확인 (asc/desc)
3. 데이터 정렬
4. 테이블 재렌더링

**결과**:
- 테이블 데이터 정렬
- 헤더에 정렬 방향 표시 (↑/↓)

#### 6.1.6 작업 6: 페이지네이션

**시작점**:
- 버튼: `inv-page-first`, `inv-page-prev`, `inv-page-next`, `inv-page-last` 클릭
- 또는 `inv-page-numbers` 내 페이지 번호 클릭

**처리 과정** (예상):
1. 대상 페이지 번호 확인
2. API 호출 또는 클라이언트 측 페이지 전환
3. 테이블 데이터 업데이트

**결과**:
- `inv-result-tbody` 업데이트
- `inv-page-info` 업데이트 (예: "1-10 / 50")
- 활성 페이지 버튼 하이라이트

### 6.2 탭 2: 일괄 청구서

#### 6.2.1 작업 1: 일괄 청구서 조회

**시작점**:
- 입력: `billing-company`, `billing-start-date`, `billing-end-date`
- 버튼: `billing-search-btn` 클릭

**처리 과정** (예상):
1. 조회 조건 수집
2. API 호출: `GET /api/billing?company=...&startDate=...&endDate=...`
3. 결과 데이터 파싱
4. 요약 데이터 계산

**결과**:
- `billing-result-tbody` 업데이트
- `billing-summary` 표시 및 데이터 업데이트:
  - `billing-total-items`
  - `billing-total-order-qty`
  - `billing-total-confirmed-qty`
  - `billing-total-amount`
- `billing-actions` 표시

#### 6.2.2 작업 2: 검색 조건 초기화

**시작점**:
- 버튼: `billing-reset-btn` 클릭

**처리 과정**:
1. 모든 입력 필드 초기화
2. 테이블 및 요약 데이터 초기화

**결과**:
- `billing-company`, `billing-start-date`, `billing-end-date` 값 초기화
- `billing-result-tbody` 기본 메시지로 변경
- `billing-summary`, `billing-actions` 숨김

#### 6.2.3 작업 3: Excel 다운로드

**시작점**:
- 버튼: `billing-export-xlsx` 클릭

**처리 과정** (예상):
1. 현재 테이블 데이터 수집
2. Excel 파일 생성 (클라이언트 측 또는 서버 측)
3. 파일 다운로드

**결과**:
- Excel 파일 다운로드 (.xlsx)

#### 6.2.4 작업 4: PDF 청구서 생성

**시작점**:
- 버튼: `billing-export-pdf` 클릭

**처리 과정** (예상):
1. 현재 청구서 데이터 수집
2. API 호출: `POST /api/billing/pdf`
3. PDF 파일 생성
4. 파일 다운로드

**결과**:
- PDF 청구서 파일 다운로드

#### 6.2.5 작업 5: DB 저장 및 발행

**시작점**:
- 버튼: `billing-save-db` 클릭

**처리 과정** (예상):
1. 현재 청구서 데이터 수집
2. API 호출: `POST /api/billing/save`
3. DB에 청구서 데이터 저장
4. 발행 상태로 변경
5. 성공 메시지 표시

**결과**:
- 청구서 DB 저장
- 발행 상태 업데이트
- 알림 메시지 표시

### 6.3 탭 전환

**시작점**:
- 탭 네비게이션의 `.tab-nav-item` 클릭

**처리 과정** (예상):
1. 클릭된 탭의 `data-tab` 속성 확인
2. 모든 탭 콘텐츠 숨김
3. 해당 탭 콘텐츠 표시
4. 탭 네비게이션 활성화 상태 변경

**결과**:
- 탭 전환 (fadeIn 애니메이션)
- 탭 네비게이션 active 클래스 변경

---

## 7. DOM 요소 ID 및 JavaScript 함수 연결 매핑

### 7.1 탭 1: 발주번호별 출력

| DOM ID | 요소 타입 | 예상 연결 함수 | 이벤트 | 기능 |
|--------|----------|---------------|--------|------|
| `inv-order-code` | input | - | input | 발주번호 필터링 |
| `inv-start-date` | input | - | change | 시작일 설정 |
| `inv-end-date` | input | - | change | 종료일 설정 |
| `inv-supplier` | input | - | input | 매입처 필터링 |
| `inv-search-btn` | button | `searchInvoices()` | click | 조회 실행 |
| `inv-doc-type` | select | `onDocTypeChange()` | change | 문서유형 변경, 레이블/필드 조정 |
| `inv-default-mode` | select | - | change | 기본 출력방식 설정 |
| `inv-output-format` | select | - | change | 출력형식 설정 |
| `inv-doc-date` | input | - | change | 문서 날짜 설정 |
| `inv-delivery-date` | input | - | change | 납품일 설정 |
| `inv-date-label` | label | `updateDateLabel()` | - | 날짜 레이블 표시 |
| `inv-delivery-label` | label | `toggleDeliveryFields()` | - | 납품일 레이블 표시 |
| `inv-manual-remark` | checkbox | `toggleRemarkInput()` | change | 비고 입력 영역 표시/숨김 |
| `inv-merge-by-supplier` | checkbox | - | change | 매입처별 통합 옵션 설정 |
| `inv-manual-remark-text` | textarea | - | input | 비고 내용 입력 |
| `inv-export-selected` | button | `exportSelectedInvoices()` | click | 선택 항목 출력 |
| `inv-remark-input-area` | div | - | - | 비고 입력 영역 컨테이너 |
| `inv-check-all` | checkbox | `toggleAllCheckboxes()` | change | 전체 선택/해제 |
| `inv-result-tbody` | tbody | `renderInvoiceTable()` | - | 테이블 데이터 렌더링 |
| `inv-pagination` | div | - | - | 페이지네이션 컨테이너 |
| `inv-page-info` | div | `updatePageInfo()` | - | 페이지 정보 표시 |
| `inv-page-first` | button | `goToPage(1)` | click | 첫 페이지 |
| `inv-page-prev` | button | `goToPrevPage()` | click | 이전 페이지 |
| `inv-page-numbers` | div | `renderPageNumbers()` | - | 페이지 번호 렌더링 |
| `inv-page-next` | button | `goToNextPage()` | click | 다음 페이지 |
| `inv-page-last` | button | `goToLastPage()` | click | 마지막 페이지 |

### 7.2 탭 2: 일괄 청구서

| DOM ID | 요소 타입 | 예상 연결 함수 | 이벤트 | 기능 |
|--------|----------|---------------|--------|------|
| `billing-company` | input | - | input | 거래처 입력 |
| `billing-start-date` | input | - | change | 시작일 설정 |
| `billing-end-date` | input | - | change | 종료일 설정 |
| `billing-search-btn` | button | `searchBilling()` | click | 청구서 조회 |
| `billing-reset-btn` | button | `resetBillingSearch()` | click | 검색 초기화 |
| `billing-summary` | div | `updateBillingSummary()` | - | 요약 데이터 표시 |
| `billing-total-items` | div | - | - | 총 품목수 표시 |
| `billing-total-order-qty` | div | - | - | 총 발주수량 표시 |
| `billing-total-confirmed-qty` | div | - | - | 총 확정수량 표시 |
| `billing-total-amount` | div | - | - | 총 청구금액 표시 |
| `billing-result-tbody` | tbody | `renderBillingTable()` | - | 테이블 데이터 렌더링 |
| `billing-actions` | div | - | - | 액션 버튼 컨테이너 |
| `billing-export-xlsx` | button | `exportBillingToExcel()` | click | Excel 다운로드 |
| `billing-export-pdf` | button | `exportBillingToPDF()` | click | PDF 생성 |
| `billing-save-db` | button | `saveBillingToDB()` | click | DB 저장 및 발행 |

### 7.3 탭 네비게이션

| data-tab | 요소 타입 | 예상 연결 함수 | 이벤트 | 기능 |
|----------|----------|---------------|--------|------|
| `order-output` | div | `switchTab('order-output')` | click | 발주번호별 출력 탭으로 전환 |
| `bulk-billing` | div | `switchTab('bulk-billing')` | click | 일괄 청구서 탭으로 전환 |

### 7.4 동적 생성 요소 (클래스 기반)

| Class | 요소 타입 | 예상 연결 함수 | 이벤트 | 기능 |
|-------|----------|---------------|--------|------|
| `.row-checkbox` | checkbox | `onRowCheckChange()` | change | 개별 행 선택 |
| `.output-mode-select` | select | - | change | 개별 출력방식 설정 |
| `.sortable` | th | `sortTable()` | click | 테이블 정렬 |
| `.pagination-btn` | button | `goToPage(n)` | click | 특정 페이지로 이동 |

---

## 8. UI 와이어프레임

### 8.1 탭 1: 발주번호별 출력

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📋 발주번호별 출력  │  💳 일괄 청구서                               │ ← Tab Navigation
├─────────────────────────────────────────────────────────────────────┤
│ 🔍 조회 조건 ─────────────────────────────────────────────────────  │
│  발주번호: [OB2025-...    ]  기간: [2025-01-01] ~ [2025-01-31]     │ ← 조회 조건 섹션
│  매입처: [업체명        ]  [🔍 조회]                                │
├─────────────────────────────────────────────────────────────────────┤
│ 📄 출력 설정 ─────────────────────────────────────────────────────  │
│  문서유형: [발주서(매입)    ▼]  출력방식: [자동(10행 기준) ▼]      │
│  출력형식: [PDF ▼]  발주일: [2025-01-10]                           │ ← 출력 설정 섹션
│  ☐ 비고 수동입력  │  ☑ 매입처별 통합      [📥 선택항목 출력]      │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ☐ │ 발주일     │ 발주번호    │ 브랜드  │ 매입처 │ ... │ 출력방식│ │
│ ├───┼───────────┼────────────┼────────┼───────┼─────┼─────────┤ │
│ │ ☐ │ 2025-01-05│ OB2025-001 │ 롬앤   │ A업체 │ ... │[자동 ▼]│ │ ← 테이블
│ │ ☐ │ 2025-01-06│ OB2025-002 │ 삐아   │ B업체 │ ... │[전체 ▼]│ │
│ │ ☐ │ 2025-01-07│ OB2025-003 │ 누즈   │ A업체 │ ... │[단축 ▼]│ │
│ └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ 1-10 / 50      [처음] [이전] 1 2 3 4 5 [다음] [마지막]             │ ← 페이지네이션
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 탭 2: 일괄 청구서

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📋 발주번호별 출력  │  💳 일괄 청구서                               │ ← Tab Navigation
├─────────────────────────────────────────────────────────────────────┤
│ 거래처: [발주처 입력     ]  기간: [2025-01-01] [2025-01-31]         │
│ [🔍 조회] [초기화]                                                  │ ← 검색 옵션바
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                   │
│ │총 품목수 │ │총 발주수량│ │총 확정수량│ │총 청구금액│                  │ ← 청구서 요약
│ │   25    │ │   500   │ │   480   │ │₩4,800,000│                  │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘                   │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 발주번호│ 발주일 │ 매입처 │ 브랜드 │ 제품명 │ ... │ 공급액    │ │
│ ├────────┼───────┼───────┼───────┼───────┼─────┼──────────┤ │
│ │OB2025-1│2025-01│A업체  │롬앤   │립스틱 │ ... │₩100,000  │ │ ← 상세 테이블
│ │OB2025-2│2025-01│A업체  │삐아   │아이섀도│ ... │₩150,000  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                    [📥 엑셀 다운로드] [📄 PDF 청구서 생성]          │ ← 액션 버튼
│                    [💾 청구서 DB 저장 + 발행]                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.3 조건부 표시 요소

#### 비고 수동입력 영역 (inv-manual-remark 체크시)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📝 비고란 내용 (수동입력)                                           │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 비고란에 표시할 내용을 입력하세요...                            │ │
│ │                                                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

#### 납품일 필드 (문서유형이 CUSTOM_BBIA일 때)

```
발주일: [2025-01-10]  납품일: [2025-01-15]
```

---

## 9. 주요 기능 흐름도

### 9.1 발주서 출력 프로세스

```
[사용자] → [조회 조건 입력] → [🔍 조회 버튼 클릭]
    ↓
[searchInvoices() 실행]
    ↓
[API 호출: GET /api/invoices]
    ↓
[응답 데이터 수신]
    ↓
[renderInvoiceTable() 실행] → [테이블 행 생성]
    ↓
[updatePageInfo() 실행] → [페이지네이션 표시]
    ↓
[사용자] → [행 선택 (체크박스)]
    ↓
[출력 설정 선택] → [문서유형, 출력형식, 날짜 등]
    ↓
[📥 선택항목 출력 버튼 클릭]
    ↓
[exportSelectedInvoices() 실행]
    ↓
[선택된 행 데이터 수집]
    ↓
[출력 옵션 수집]
    ↓
[매입처별 통합 확인] → [체크시 매입처별 그룹핑]
    ↓
[API 호출: POST /api/invoices/export]
    ↓
[파일 생성 (PDF/Excel)]
    ↓
[파일 다운로드]
```

### 9.2 일괄 청구서 생성 프로세스

```
[사용자] → [거래처 및 기간 입력] → [🔍 조회 버튼 클릭]
    ↓
[searchBilling() 실행]
    ↓
[API 호출: GET /api/billing]
    ↓
[응답 데이터 수신]
    ↓
[renderBillingTable() 실행] → [테이블 데이터 표시]
    ↓
[updateBillingSummary() 실행] → [요약 카드 업데이트]
    ↓
[billing-summary, billing-actions 표시]
    ↓
[사용자] → [액션 선택]
    ├─ [📥 엑셀 다운로드] → exportBillingToExcel() → Excel 파일 다운로드
    ├─ [📄 PDF 청구서 생성] → exportBillingToPDF() → PDF 파일 다운로드
    └─ [💾 청구서 DB 저장 + 발행] → saveBillingToDB() → DB 저장 및 발행 상태 변경
```

---

## 10. 예상 API 엔드포인트

### 10.1 발주서 관련

| Method | Endpoint | 설명 | 요청 파라미터 | 응답 |
|--------|----------|------|--------------|------|
| GET | `/api/invoices` | 발주서 목록 조회 | `orderCode`, `startDate`, `endDate`, `supplier`, `page`, `limit` | 발주서 목록 + 페이지네이션 정보 |
| POST | `/api/invoices/export` | 발주서 출력 | `orderIds[]`, `docType`, `outputFormat`, `outputMode`, `docDate`, `deliveryDate`, `remark`, `mergeBySupplier` | PDF/Excel 파일 |

### 10.2 일괄 청구서 관련

| Method | Endpoint | 설명 | 요청 파라미터 | 응답 |
|--------|----------|------|--------------|------|
| GET | `/api/billing` | 일괄 청구서 조회 | `company`, `startDate`, `endDate` | 청구서 상세 내역 + 요약 데이터 |
| POST | `/api/billing/pdf` | PDF 청구서 생성 | 청구서 데이터 | PDF 파일 |
| POST | `/api/billing/excel` | Excel 다운로드 | 청구서 데이터 | Excel 파일 |
| POST | `/api/billing/save` | DB 저장 및 발행 | 청구서 데이터 | 저장 결과 |

---

## 11. 보안 및 권한 고려사항

### 11.1 데이터 접근 권한

- 사용자 권한에 따른 발주서/청구서 조회 제한 필요
- 특정 거래처/매입처만 조회 가능하도록 필터링

### 11.2 파일 다운로드 보안

- 생성된 파일에 워터마크 또는 고유 식별자 추가
- 파일 다운로드 로그 기록
- 임시 파일 자동 삭제 메커니즘

### 11.3 입력 검증

- 날짜 범위 검증 (과거 데이터만 조회 가능)
- SQL Injection 방지를 위한 파라미터 검증
- XSS 방지를 위한 사용자 입력 이스케이핑

---

## 12. 개선 제안

### 12.1 UX 개선

1. **로딩 인디케이터**: 조회 중 로딩 스피너 표시
2. **에러 메시지**: API 실패시 사용자 친화적 오류 메시지
3. **토스트 알림**: 성공/실패 시 토스트 메시지 표시
4. **키보드 단축키**: Enter 키로 조회, Ctrl+P로 출력 등

### 12.2 기능 개선

1. **저장된 필터**: 자주 사용하는 조회 조건 저장
2. **일괄 다운로드**: 여러 파일을 ZIP으로 묶어서 다운로드
3. **미리보기**: 출력 전 미리보기 기능
4. **이메일 발송**: 생성된 청구서를 이메일로 직접 발송

### 12.3 성능 개선

1. **지연 로딩**: 테이블 데이터 가상 스크롤 적용
2. **캐싱**: 조회 결과 클라이언트 측 캐싱
3. **배치 처리**: 대량 출력 시 배치 처리 및 진행률 표시

---

## 13. 종속성 및 연관 파일 (예상)

### 13.1 JavaScript 파일

- `/js/pages/invoiceOutput.js` - 메인 로직
- `/js/utils/dateUtils.js` - 날짜 처리 유틸리티
- `/js/utils/formatUtils.js` - 포맷팅 유틸리티
- `/js/services/invoiceService.js` - 발주서 API 서비스
- `/js/services/billingService.js` - 청구서 API 서비스

### 13.2 서버 측 파일

- `/routes/invoiceRoutes.js` - 발주서 라우트
- `/routes/billingRoutes.js` - 청구서 라우트
- `/controllers/invoiceController.js` - 발주서 컨트롤러
- `/controllers/billingController.js` - 청구서 컨트롤러
- `/services/pdfService.js` - PDF 생성 서비스
- `/services/excelService.js` - Excel 생성 서비스

### 13.3 템플릿 파일

- `/templates/invoice_purchase.html` - 발주서(매입) 템플릿
- `/templates/invoice_vat.html` - 거래명세서(부포) 템플릿
- `/templates/invoice_nvat.html` - 거래명세서(영세) 템플릿
- `/templates/custom_romand.xlsx` - 롬앤/누즈 전용 템플릿
- `/templates/custom_jonggeundang.xlsx` - 종근당 전용 템플릿
- `/templates/custom_bbia.xlsx` - 삐아계열 전용 템플릿

---

## 14. 테스트 시나리오

### 14.1 탭 1: 발주번호별 출력

1. **조회 테스트**
   - 발주번호로 조회
   - 기간으로 조회
   - 매입처로 조회
   - 복합 조건 조회
   - 결과 없음 케이스

2. **정렬 테스트**
   - 각 컬럼별 오름차순/내림차순 정렬
   - 정렬 상태 유지 확인

3. **페이지네이션 테스트**
   - 페이지 이동 (첫/이전/다음/마지막)
   - 특정 페이지 번호 클릭
   - 페이지 정보 정확성

4. **출력 테스트**
   - 단일 항목 출력
   - 복수 항목 출력
   - 매입처별 통합 출력
   - 각 문서유형별 출력
   - PDF/Excel 형식별 출력
   - 비고 수동입력 포함 출력

5. **조건부 필드 테스트**
   - 문서유형 변경시 레이블 변경
   - 삐아계열 선택시 납품일 필드 표시
   - 비고 수동입력 체크시 textarea 표시

### 14.2 탭 2: 일괄 청구서

1. **조회 테스트**
   - 거래처 및 기간으로 조회
   - 요약 데이터 정확성 확인
   - 상세 테이블 데이터 확인

2. **초기화 테스트**
   - 모든 입력 필드 초기화 확인
   - 테이블 및 요약 데이터 초기화 확인

3. **다운로드 테스트**
   - Excel 다운로드
   - PDF 청구서 생성

4. **DB 저장 테스트**
   - 청구서 DB 저장
   - 발행 상태 변경 확인

### 14.3 탭 전환 테스트

- 탭 전환시 데이터 유지 확인
- 애니메이션 정상 작동 확인
- 활성 탭 하이라이트 확인

---

## 15. 결론

### 15.1 페이지 요약

**Page_InvoiceOutput.html**은 발주서 및 청구서 출력을 위한 2개의 탭으로 구성된 페이지입니다:

1. **발주번호별 출력 탭**: 개별 발주서를 조회하고 선택하여 다양한 형식으로 출력
2. **일괄 청구서 탭**: 거래처별로 청구서를 일괄 생성하고 관리

### 15.2 주요 특징

- **모던 UI**: Flexbox, Grid를 활용한 반응형 레이아웃
- **다양한 출력 옵션**: 문서유형, 출력형식, 출력방식 선택 가능
- **조건부 UI**: 사용자 선택에 따라 동적으로 필드 표시/숨김
- **페이지네이션**: 대량 데이터 처리를 위한 페이지네이션 지원
- **정렬 기능**: 테이블 헤더 클릭으로 정렬 가능
- **요약 정보**: 청구서 요약 카드로 주요 지표 시각화

### 15.3 DOM ID 총 개수

- **탭 1 (발주번호별 출력)**: 22개 ID
- **탭 2 (일괄 청구서)**: 14개 ID
- **총합**: 36개 고유 ID

---

**문서 끝**
