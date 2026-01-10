# Templates_Invoice_VAT.html 완전 분석 문서

## 📋 목차

1. [개요](#개요)
2. [템플릿 구조 완전 분석](#템플릿-구조-완전-분석)
3. [템플릿 변수 및 데이터 바인딩](#템플릿-변수-및-데이터-바인딩)
4. [멀티페이지 로직](#멀티페이지-로직)
5. [스타일 상세](#스타일-상세)
6. [레이아웃 섹션별 분석](#레이아웃-섹션별-분석)
7. [PDF 변환 최적화](#pdf-변환-최적화)
8. [페이지 레이아웃 시각화](#페이지-레이아웃-시각화)

---

## 개요

**파일 위치**: `/tmp/previous_branch/Templates_Invoice_VAT.html`
**문서 유형**: 거래명세서 (VAT 포함)
**PDF 엔진**: Google Apps Script HTML Service → PDF 변환
**용지 크기**: A4 (210mm × 297mm)
**데이터 소스**: InvoiceOutputService.js

---

## 템플릿 구조 완전 분석

### HTML 전체 구조

```
<!DOCTYPE html>
<html>
  <head>
    - 문자 인코딩: UTF-8
    - <style> 블록 (5~438행)
  </head>
  <body>
    <!-- 첫 페이지 -->
    <div class="page">
      - 헤더 (로고, 제목, 발주 정보)
      - 인감 워터마크
      - 컨텐츠
        - 거래처 정보 (공급자/발주자)
        - 금액 요약
        - 품목 테이블 (최대 10행)
        - 비고 (1페이지 전용)
      - 푸터
      - 페이지 번호
    </div>

    <!-- 추가 페이지 (11행 이상일 때) -->
    <div class="page-break"></div>
    <div class="page-continuation">
      - 연속 페이지 헤더
      - 품목 테이블 (연속)
      - 비고 (마지막 페이지만)
      - 푸터
      - 페이지 번호
    </div>
  </body>
</html>
```

### @page CSS 설정

이 템플릿은 명시적인 `@page` 설정이 없으며, 대신 다음 방식으로 페이지를 제어합니다:

```css
.page {
  width: 210mm;           /* A4 너비 */
  min-height: 297mm;      /* A4 높이 */
  padding: 0;
  background: #ffffff;
}
```

### 페이지 분할 로직

- **첫 페이지**: 최대 10개 품목 표시
- **연속 페이지**: 각 10개 품목씩 표시
- **최소 행 보장**: 첫 페이지가 단일 페이지인 경우 최소 5행 표시 (빈 행 추가)
- **페이지 브레이크**: `.page-break` 클래스로 페이지 분리

---

## 템플릿 변수 및 데이터 바인딩

### 변수 목록 및 출처

| 변수명 | 데이터 타입 | 표시 위치 | InvoiceOutputService 출처 | 설명 |
|--------|-------------|-----------|---------------------------|------|
| **logoBase64** | String | 헤더 로고 | (미구현) | 회사 로고 Base64 인코딩 |
| **stampBase64** | String | 워터마크 | `getStampBase64_()` | 인감 이미지 Base64 |
| **orderCode** | String | 헤더, 연속 페이지 | 함수 파라미터 | 발주번호 |
| **dueDate** | String | 헤더, 공급자 정보 | `formatDateYmd_(orderDate)` | 납기일자 (발주일 기반) |
| **supplierName** | String | 공급자 정보 | `firstRow[idxSupplierName]` | 매입처 상호 |
| **supplierBizNo** | String | 공급자 정보 | `findPartnerByName_(supplierNm).bizNo` | 매입처 사업자등록번호 |
| **supplierManager** | String | 공급자 정보 | `findPartnerByName_(supplierNm).manager` | 매입처 담당자 |
| **buyerName** | String | 발주자 정보 | `firstRow[idxBuyerName]` | 발주처 상호 |
| **buyerBizNo** | String | 발주자 정보 | `findPartnerByName_(buyerNm).bizNo` | 발주처 사업자등록번호 |
| **buyerPhone** | String | 발주자 정보 | `findPartnerByName_(buyerNm).phone` | 발주처 연락처 |
| **buyerAddress** | String | 발주자 정보 | `findPartnerByName_(buyerNm).address` | 발주처 주소 |
| **totalSupply** | String | 금액 요약 | `formatNumber_(totalSupply)` | 공급가액 합계 |
| **totalVat** | String | 금액 요약 | `formatNumber_(totalVat)` | 부가세 합계 |
| **totalAmount** | String | 금액 요약 | `formatNumber_(totalAmount)` | 총 금액 (VAT 포함) |
| **amountHangul** | String | 금액 요약 | `numberToHangulKor_(totalAmount)` | 한글 금액 (예: "구십구만 원") |
| **items** | Array | 품목 테이블 | 품목 배열 (아래 참조) | 품목 리스트 |
| **buyerOrderCode** | String | 비고 | 컨텍스트 빈 문자열 | 발주처 발주코드 (현재 미사용) |
| **remark** | String | 비고 | 컨텍스트 빈 문자열 | 특이사항 (현재 미사용) |

### items 배열 구조

각 품목 객체는 다음 속성을 포함합니다:

```javascript
{
  code:   String,  // 품목코드 - r[idxProductCode]
  name:   String,  // 품명 - r[idxProductName]
  spec:   String,  // 규격 - 현재 빈 문자열
  qty:    String,  // 수량 - formatNumber_(r[qtyCol])
  price:  String,  // 단가 - formatNumber_(supplyPrice)
  amount: String,  // 금액 - formatNumber_(supply)
  note:   String   // 비고 - 현재 빈 문자열 (단축 출력시 "(단축 출력)")
}
```

### 데이터 흐름도

```
거래원장 시트 (OrderMerged)
    ↓
InvoiceOutputService.buildInvoiceVatPdf()
    ↓
데이터 추출 및 가공:
  - 거래원장에서 발주번호로 필터링
  - 거래처DB에서 상세정보 조회
  - 수량 × 단가 계산
  - 금액 포맷팅
    ↓
컨텍스트 객체 생성 (ctx)
    ↓
HtmlService.createTemplateFromFile('Templates_Invoice_VAT')
    ↓
템플릿 변수 주입
    ↓
HTML 생성 → PDF 변환
```

---

## 멀티페이지 로직

### ITEMS_PER_PAGE 설정

```javascript
var ITEMS_PER_PAGE = 10;  // 페이지당 최대 품목 수
```

### 페이지 분할 알고리즘

**546-551행: 변수 초기화**
```javascript
var rowCount = items && items.length ? items.length : 0;
var ITEMS_PER_PAGE = 10;
var totalPages = rowCount <= ITEMS_PER_PAGE ? 1 : Math.ceil(rowCount / ITEMS_PER_PAGE);
var firstPageItems = Math.min(rowCount, ITEMS_PER_PAGE);
```

**로직 설명**:
- `rowCount`: 총 품목 수
- `totalPages`: 총 페이지 수 (10개 이하면 1페이지, 초과시 올림)
- `firstPageItems`: 첫 페이지에 표시할 품목 수

### 첫 페이지 구조 (571-601행)

```javascript
<tbody>
  // 품목 출력 (0 ~ firstPageItems)
  <? for (var i = 0; i < firstPageItems; i++) {
       var it = items[i]; ?>
    <tr>
      <td class="col-no"><?= i + 1 ?></td>
      <td class="col-code"><?= it.code || '' ?></td>
      <!-- ... -->
    </tr>
  <? } ?>

  // 최소 5행 보장 (단일 페이지만)
  <? if (totalPages === 1) {
       for (var j = rowCount; j < 5; j++) { ?>
    <tr>
      <td class="col-no">&nbsp;</td>
      <!-- ... 빈 셀 ... -->
    </tr>
  <?   }
     } ?>
</tbody>
```

### 연속 페이지 구조 (634-713행)

```javascript
<? for (var pageNum = 2; pageNum <= totalPages; pageNum++) {
     var startIdx = (pageNum - 1) * ITEMS_PER_PAGE;
     var endIdx = Math.min(startIdx + ITEMS_PER_PAGE, rowCount);
     var isLastPage = (pageNum === totalPages);
?>

<div class="page-break"></div>
<div class="page-continuation">
  <div class="continuation-header">
    <div class="continuation-title">거래명세서 (계속)</div>
    <div class="continuation-info">
      발주번호: <?= orderCode ?> | <?= dueDate ?>
    </div>
  </div>

  <div class="content">
    <div class="items-section">
      <div class="section-title">품목 내역 (<?= startIdx + 1 ?>~<?= endIdx ?> / 총 <?= rowCount ?>건)</div>

      <table class="items-table">
        <tbody>
          <? for (var k = startIdx; k < endIdx; k++) {
               var it = items[k]; ?>
            <tr>
              <td class="col-no"><?= k + 1 ?></td>
              <!-- ... -->
            </tr>
          <? } ?>
        </tbody>
      </table>
    </div>

    // 비고 (마지막 페이지만)
    <? if (isLastPage) { ?>
    <div class="remark-section">
      <!-- ... -->
    </div>
    <? } ?>
  </div>

  <div class="page-number">- <?= pageNum ?> -</div>
</div>
<? } ?>
```

### 마지막 페이지 처리

- **비고 영역**: 첫 페이지가 단일 페이지이거나, 마지막 연속 페이지에만 표시
- **조건 확인**: `if (totalPages === 1)` 또는 `if (isLastPage)`

---

## 스타일 상세

### 색상 팔레트

| 용도 | 컬러 코드 | 설명 |
|------|-----------|------|
| **주 배경색** | `#ffffff` | 흰색 |
| **텍스트 기본** | `#1e293b` | 다크 슬레이트 |
| **텍스트 보조** | `#475569`, `#64748b` | 회색 계열 |
| **텍스트 연한** | `#94a3b8` | 연한 회색 |
| **강조색** | `#f97316` | 오렌지 (브랜드 컬러) |
| **배경 밝은** | `#f8fafc`, `#f1f5f9` | 아주 밝은 회색 |
| **배경 진한** | `#1e293b`, `#334155`, `#475569` | 다크 슬레이트 계열 |
| **테두리** | `#e2e8f0`, `#cbd5e1` | 회색 테두리 |
| **호버** | `#fef3c7` | 연한 노란색 |
| **VAT 강조** | `#fbbf24`, `#92400e` | 골드/브라운 |

### 그라데이션

**헤더 그라데이션**:
```css
background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
```

**금액 요약 박스 그라데이션**:
```css
background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
```

**총 금액 바 그라데이션**:
```css
background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
```

**테이블 헤더 그라데이션**:
```css
background: linear-gradient(135deg, #334155 0%, #475569 100%);
```

**연속 페이지 헤더 그라데이션**:
```css
background: linear-gradient(135deg, #334155 0%, #475569 100%);
```

### 테두리 및 여백

**테두리 스타일**:
- 헤더 하단: `4px solid #f97316` (오렌지 강조선)
- 거래처 박스: `2px solid #e2e8f0` (둥근 모서리 12px)
- 금액 요약: `2px solid #cbd5e1` (둥근 모서리 12px)
- 품목 테이블: `2px solid #cbd5e1` (둥근 모서리 8px)

**여백 (Padding)**:
- 헤더: `20px 30px`
- 컨텐츠: `25px 30px`
- 거래처 박스 내부: `14px 16px`
- 금액 요약: `18px 20px`
- 테이블 셀: `8px` (헤더 `10px 8px`)

**간격 (Margin)**:
- 섹션 간: `25px`
- 거래처 박스 그리드 갭: `20px`
- 금액 요약 그리드 갭: `16px`

### 테이블 스타일

**컬럼 너비**:
```css
.col-no     { width: 8mm;  text-align: center; }
.col-code   { width: 24mm; text-align: center; font-family: 'Courier New', monospace; }
.col-name   { width: auto; text-align: left;   padding-left: 10px; }
.col-spec   { width: 18mm; text-align: center; }
.col-qty    { width: 18mm; text-align: right;  padding-right: 10px; font-family: 'Courier New', monospace; }
.col-price  { width: 24mm; text-align: right;  padding-right: 10px; font-family: 'Courier New', monospace; }
.col-amt    { width: 28mm; text-align: right;  padding-right: 10px; font-family: 'Courier New', monospace; font-weight: 600; }
.col-note   { width: 18mm; text-align: left;   font-size: 9px; color: #64748b; }
```

**행 스타일**:
- 헤더: 진한 회색 그라데이션, 흰색 텍스트
- 홀수 행: `#ffffff` (흰색)
- 짝수 행: `#f8fafc` (연한 회색)
- 호버: `#fef3c7` (연한 노란색)

### 호버 효과

```css
.items-table tbody tr:hover {
  background: #fef3c7;
}
```

### CSS 클래스 전체 목록

| 클래스명 | 용도 | 주요 스타일 |
|----------|------|-------------|
| `.page` | 첫 페이지 컨테이너 | 210mm × 297mm, 흰색 배경 |
| `.page-continuation` | 연속 페이지 컨테이너 | 동일 크기 |
| `.page-break` | 페이지 분리 | `page-break-after: always` |
| `.header` | 헤더 영역 | 그리드 3열, 다크 그라데이션 |
| `.logo-area` | 로고 영역 | 플렉스 정렬 |
| `.logo-placeholder` | 로고 플레이스홀더 | 120×50px, 점선 테두리 |
| `.title-area` | 제목 영역 | 중앙 정렬 |
| `.doc-title` | 문서 제목 | 24px, 굵게 |
| `.doc-subtitle` | 문서 부제목 | 11px, 연한 회색 |
| `.header-info` | 헤더 정보 | 오른쪽 정렬 |
| `.stamp-watermark` | 인감 워터마크 | 절대 위치, 투명도 15% |
| `.content` | 컨텐츠 영역 | 패딩 25px 30px |
| `.partners-section` | 거래처 섹션 | 그리드 2열 |
| `.partner-box` | 거래처 박스 | 테두리, 둥근 모서리, 그림자 |
| `.partner-header` | 거래처 헤더 | 밝은 회색 배경, 오렌지 막대 |
| `.partner-body` | 거래처 내용 | 패딩 14px 16px |
| `.partner-row` | 거래처 행 | 그리드 2열 (80px + 1fr) |
| `.partner-label` | 거래처 레이블 | 10px, 회색, 굵게 |
| `.partner-value` | 거래처 값 | 11px, 검은색, 중간 굵기 |
| `.summary-box` | 금액 요약 박스 | 그라데이션, 테두리, 그림자 |
| `.summary-grid` | 금액 요약 그리드 | 3열 그리드 |
| `.summary-item` | 금액 요약 항목 | 중앙 정렬, 흰색 배경 |
| `.summary-label` | 금액 레이블 | 10px, 회색 |
| `.summary-amount` | 금액 값 | 16px, 굵게, Courier New |
| `.summary-total` | 총 금액 바 | 다크 그라데이션, 흰색 텍스트 |
| `.summary-total-label` | 총 금액 레이블 | 13px, 굵게 |
| `.summary-total-amount` | 총 금액 값 | 20px, 굵게, Courier New |
| `.summary-hangul` | 한글 금액 | 11px, 회색, 이탤릭 |
| `.items-section` | 품목 섹션 | 마진 하단 25px |
| `.section-title` | 섹션 제목 | 13px, 굵게, 오렌지 막대 |
| `.items-table` | 품목 테이블 | 전체 너비, 테두리 통합 |
| `.remark-section` | 비고 섹션 | 테두리, 둥근 모서리 |
| `.remark-header` | 비고 헤더 | 밝은 회색 배경 |
| `.remark-body` | 비고 내용 | 최소 높이 50mm, 패딩 14px 16px |
| `.remark-label` | 비고 레이블 | 굵게, 회색 |
| `.footer` | 푸터 | 절대 위치 하단 15mm, 중앙 정렬 |
| `.page-number` | 페이지 번호 | 절대 위치 하단 8mm, 중앙 정렬 |
| `.continuation-header` | 연속 페이지 헤더 | 플렉스, 다크 그라데이션 |
| `.continuation-title` | 연속 페이지 제목 | 14px, 굵게 |
| `.continuation-info` | 연속 페이지 정보 | 11px, 연한 회색 |

---

## 레이아웃 섹션별 분석

### 1. 헤더 (44-62행)

**구조**:
```
┌─────────────────────────────────────────────────────┐
│ [로고]     거래명세서           발주번호: PO-001    │
│            TRANSACTION STATEMENT  발주일자: 2024-01-10 │
└─────────────────────────────────────────────────────┘
```

**그리드 레이아웃**:
- 3열: `140px` | `1fr` | `140px`
- 정렬: 왼쪽 로고, 중앙 제목, 오른쪽 정보

**데이터 바인딩**:
- 로고: `logoBase64` (있으면 이미지, 없으면 플레이스홀더)
- 발주번호: `orderCode`
- 발주일자: `dueDate`

### 2. 인감 워터마크 (465-467행)

**특징**:
- 절대 위치: 중앙, 상단 90mm
- 크기: 35mm
- 투명도: 15% (`opacity: 0.15`)
- Z-index: 1 (컨텐츠 뒤)

### 3. 거래처 정보 (472-519행)

**레이아웃**:
```
┌─────────────────────┬─────────────────────┐
│ 공급자 정보         │ 발주자 정보         │
├─────────────────────┼─────────────────────┤
│ 상호: ABC 주식회사  │ 상호: XYZ 상사      │
│ 사업자: 123-45-... │ 사업자: 987-65-... │
│ 담당자: 홍길동      │ 연락처: 02-1234-... │
│ 납기일자: 2024-... │ 주소: 서울특별시... │
└─────────────────────┴─────────────────────┘
```

**공급자 정보**:
- 상호: `supplierName`
- 사업자등록번호: `supplierBizNo`
- 담당자: `supplierManager`
- 납기일자: `dueDate`

**발주자 정보**:
- 상호: `buyerName`
- 사업자등록번호: `buyerBizNo`
- 연락처: `buyerPhone`
- 주소: `buyerAddress`

### 4. 금액 요약 (521-544행)

**레이아웃**:
```
┌──────────────────────────────────────────────────┐
│  [공급가액]    [부가세]    [VAT 포함]            │
│  ₩1,000,000   ₩100,000    ₩1,100,000            │
├──────────────────────────────────────────────────┤
│  총 금액 (VAT 포함)              ₩1,100,000      │
├──────────────────────────────────────────────────┤
│                              일백십만 원 정       │
└──────────────────────────────────────────────────┘
```

**데이터 바인딩**:
- 공급가액: `totalSupply`
- 부가세: `totalVat`
- VAT 포함: `totalAmount`
- 한글 금액: `amountHangul`

**스타일 특징**:
- VAT 포함 항목은 노란색 배경 (`#fef3c7`)으로 강조
- 총 금액 바는 다크 그라데이션 배경
- 금액은 Courier New 폰트 (숫자 가독성)

### 5. 품목 테이블 (553-602행)

**테이블 구조**:
```
┌────┬──────────┬────────────────┬──────┬──────┬──────┬──────┬──────┐
│ No │ 품목코드 │ 품명           │ 규격 │ 수량 │ 단가 │ 금액 │ 비고 │
├────┼──────────┼────────────────┼──────┼──────┼──────┼──────┼──────┤
│ 1  │ P001     │ 제품A          │ EA   │ 10   │ 1000 │ 10000│      │
│ 2  │ P002     │ 제품B          │ KG   │ 5    │ 2000 │ 10000│      │
└────┴──────────┴────────────────┴──────┴──────┴──────┴──────┴──────┘
```

**컬럼 정보**:
1. **No** (8mm): 일련번호 (1부터 시작)
2. **품목코드** (24mm): `item.code`
3. **품명** (auto): `item.name`
4. **규격** (18mm): `item.spec` (현재 미사용)
5. **수량** (18mm): `item.qty`
6. **단가** (24mm): `item.price` (공급가)
7. **금액** (28mm): `item.amount` (공급액)
8. **비고** (18mm): `item.note` (현재 미사용)

**첫 페이지 특수 처리**:
- 품목이 10개 이하면 최소 5행 보장 (빈 행 추가)
- 홀수/짝수 행 배경색 교차
- 호버 시 노란색 하이라이트

### 6. 비고 영역 (605-617행, 688-700행)

**표시 조건**:
- 첫 페이지가 단일 페이지인 경우: 첫 페이지에 표시
- 멀티페이지인 경우: 마지막 페이지에만 표시

**내용**:
- 발주처 발주코드: `buyerOrderCode` (옵션)
- 특이사항: `remark`

**스타일**:
- 최소 높이: 50mm
- 테두리, 둥근 모서리 12px

### 7. 푸터 (364-374행, 705-707행)

**내용**:
```
본 문서는 (주)원브릿지 ERP 시스템에서 자동 생성되었습니다. | OneBridge ERP v2.1
```

**위치**:
- 절대 위치: 하단 15mm
- 중앙 정렬
- 폰트 크기: 9px
- 색상: `#94a3b8` (연한 회색)

### 8. 페이지 번호 (377-386행, 709-710행)

**표시 조건**:
- 멀티페이지인 경우만 표시

**형식**:
- 첫 페이지: `- 1 -`
- 연속 페이지: `- 2 -`, `- 3 -`, ...

**위치**:
- 절대 위치: 하단 8mm
- 중앙 정렬
- 폰트 크기: 11px
- 색상: `#64748b`

---

## PDF 변환 최적화

### 페이지 브레이크 설정

```css
.page-break {
  page-break-after: always;
  break-after: page;
}
```

- CSS2 속성 (`page-break-after`)과 CSS3 속성 (`break-after`) 모두 사용
- 브라우저 호환성 극대화

### 인쇄 최적화 CSS (423-437행)

```css
@media print {
  .page, .page-continuation {
    margin: 0;
    padding: 0;
  }

  .page-break {
    page-break-after: always;
    break-after: page;
  }

  body {
    background: #ffffff;
  }
}
```

**특징**:
- 인쇄 시 여백 제거
- 배경색 흰색 보장
- 페이지 브레이크 명시

### A4 용지 크기 설정

```css
.page {
  width: 210mm;       /* A4 너비 */
  min-height: 297mm;  /* A4 높이 */
}
```

- 국제 표준 A4 용지 크기
- `min-height` 사용으로 컨텐츠 오버플로 방지

### PDF 변환 프로세스

Google Apps Script에서는 다음과 같이 변환됩니다:

```javascript
var html = tmpl.evaluate().getContent();
var blob = Utilities.newBlob(html, 'text/html', 'invoice_vat_' + orderCode + '.html')
  .getAs('application/pdf');
```

**프로세스**:
1. 템플릿 평가 (변수 바인딩)
2. HTML 문자열 생성
3. Blob 생성 (MIME 타입: `text/html`)
4. PDF로 변환 (`.getAs('application/pdf')`)

---

## 페이지 레이아웃 시각화

### 첫 페이지 (품목 10개 이하)

```
┌──────────────────────────────────────────────────────────────┐
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ [LOGO]     거래명세서            발주번호: PO-001      │  │ 헤더
│  │        TRANSACTION STATEMENT   발주일자: 2024-01-10    │  │ (그라데이션)
│  └────────────────────────────────────────────────────────┘  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ (오렌지 강조선)           │
│                                                                │
│  ┌────────────────────┬────────────────────┐                 │
│  │ 공급자 정보        │ 발주자 정보        │ 거래처 정보     │
│  ├────────────────────┼────────────────────┤ (대칭 배치)     │
│  │ 상호: ABC 주식회사 │ 상호: XYZ 상사     │                 │
│  │ 사업자: 123-45-... │ 사업자: 987-65-... │                 │
│  │ 담당자: 홍길동     │ 연락처: 02-1234-.. │                 │
│  │ 납기일자: 2024-... │ 주소: 서울특별시.. │                 │
│  └────────────────────┴────────────────────┘                 │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ [공급가액]    [부가세]    [VAT 포함]                 │ 금액 요약   │
│  │ ₩1,000,000   ₩100,000    ₩1,100,000                 │ (그라데이션)│
│  ├──────────────────────────────────────────────────────┤    │
│  │ █ 총 금액 (VAT 포함)              ₩1,100,000 █      │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │                              일백십만 원 정           │    │
│  └──────────────────────────────────────────────────────┘    │
│                      [인감 워터마크]                          │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 품목 내역                                            │ 품목 테이블 │
│  ├──┬────┬──────┬───┬───┬────┬────┬───┤    │
│  │No│코드│ 품명 │규격│수량│단가│금액│비고│    │
│  ├──┼────┼──────┼───┼───┼────┼────┼───┤    │
│  │1 │P001│제품A │EA │10 │1000│10K │    │    │
│  │2 │P002│제품B │KG │5  │2000│10K │    │    │
│  │... (최대 10행)                               │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 특이사항 및 비고                                     │ 비고 영역   │
│  │                                                      │    │
│  │ 발주처 발주코드: ABC-123                            │    │
│  │                                                      │    │
│  │ (기타 특이사항...)                                  │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ────────────────────────────────────────────────────────    │
│  본 문서는 (주)원브릿지 ERP 시스템에서 자동 생성되었습니다.   │ 푸터
│  OneBridge ERP v2.1                                            │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### 연속 페이지 (품목 11개 이상)

```
┌──────────────────────────────────────────────────────────────┐
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 거래명세서 (계속)        발주번호: PO-001 | 2024-01-10│  │ 연속 헤더
│  └────────────────────────────────────────────────────────┘  │ (간소화)
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ (오렌지 강조선)           │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 품목 내역 (11~20 / 총 25건)                         │ 품목 테이블 │
│  ├──┬────┬──────┬───┬───┬────┬────┬───┤    │ (연속)
│  │No│코드│ 품명 │규격│수량│단가│금액│비고│    │
│  ├──┼────┼──────┼───┼───┼────┼────┼───┤    │
│  │11│P011│제품K │EA │10 │1000│10K │    │    │
│  │12│P012│제품L │KG │5  │2000│10K │    │    │
│  │... (최대 10행)                               │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  [마지막 페이지인 경우 비고 영역 표시]                        │
│                                                                │
│  ────────────────────────────────────────────────────────    │
│  본 문서는 (주)원브릿지 ERP 시스템에서 자동 생성되었습니다.   │ 푸터
│  OneBridge ERP v2.1                                            │
│                                                                │
│                           - 2 -                                │ 페이지 번호
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 데이터 출처 추적

### InvoiceOutputService 함수 맵핑

| 템플릿 변수 | InvoiceOutputService 함수 | 데이터 출처 | 라인 |
|-------------|---------------------------|-------------|------|
| `logoBase64` | (미구현) | 향후 Script Properties 또는 Drive | - |
| `stampBase64` | `getStampBase64_()` | Script Properties `STAMP_BASE64` | 402-410 |
| `orderCode` | 함수 파라미터 | `generateInvoiceZip()` 파라미터 | 203, 334 |
| `dueDate` | `formatDateYmd_(orderDate)` | 거래원장 `발주일` 컬럼 | 333 |
| `supplierName` | 직접 할당 | 거래원장 `매입처` 컬럼 | 226, 324 |
| `supplierBizNo` | `findPartnerByName_(supplierNm).bizNo` | 거래처DB `사업자번호` 컬럼 | 230, 233, 325 |
| `supplierManager` | `findPartnerByName_(supplierNm).manager` | 거래처DB `담당자` 컬럼 | 230, 234, 326 |
| `buyerName` | 직접 할당 | 거래원장 `발주처` 컬럼 | 227, 328 |
| `buyerBizNo` | `findPartnerByName_(buyerNm).bizNo` | 거래처DB `사업자번호` 컬럼 | 231, 235, 329 |
| `buyerPhone` | `findPartnerByName_(buyerNm).phone` | 거래처DB `연락처` 컬럼 | 231, 236, 330 |
| `buyerAddress` | `findPartnerByName_(buyerNm).address` | 거래처DB `주소` 컬럼 | 231, 237, 331 |
| `totalSupply` | `formatNumber_(totalSupply)` | 거래원장 `공급액` 컬럼 합계 | 246, 268, 336 |
| `totalVat` | `formatNumber_(totalVat)` | `totalAmount - totalSupply` | 318, 337 |
| `totalAmount` | `formatNumber_(totalAmount)` | 거래원장 `매입액` 컬럼 합계 | 247, 267, 338 |
| `amountHangul` | `numberToHangulKor_(totalAmount)` | 총 금액 한글 변환 | 339 |
| `items[]` | 루프로 생성 | 거래원장 각 행 | 251-284 |
| `items[].code` | 직접 할당 | 거래원장 `품목코드` 컬럼 | 271, 276 |
| `items[].name` | 직접 할당 | 거래원장 `제품명` 컬럼 | 272, 277 |
| `items[].spec` | 빈 문자열 | (현재 미사용) | 273, 278 |
| `items[].qty` | `formatNumber_(qty)` | 거래원장 `확정수량` or `발주수량` | 253, 279 |
| `items[].price` | `formatNumber_(supplyPrice)` | 거래원장 `공급가` 컬럼 | 258, 280 |
| `items[].amount` | `formatNumber_(supply)` | 거래원장 `공급액` 컬럼 | 264, 281 |
| `items[].note` | 빈 문자열 | (현재 미사용, 단축 출력시 "(단축 출력)") | 282, 306 |
| `buyerOrderCode` | 빈 문자열 | (현재 미사용) | 342 |
| `remark` | 빈 문자열 | (현재 미사용) | 343 |

### 데이터 소스 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│                    Google Sheets 데이터                      │
└─────────────────────────────────────────────────────────────┘
         │                           │
         │                           │
         ▼                           ▼
┌───────────────────┐       ┌───────────────────┐
│  거래원장 시트    │       │  거래처DB 시트    │
│  (OrderMerged)    │       │  (Suppliers)      │
├───────────────────┤       ├───────────────────┤
│ - 발주번호        │       │ - 거래처명        │
│ - 발주일          │       │ - 사업자번호      │
│ - 브랜드          │       │ - 담당자          │
│ - 매입처          │◄──────┤ - 연락처          │
│ - 발주처          │  조회  │ - 주소            │
│ - 제품명          │       └───────────────────┘
│ - 품목코드        │
│ - 확정수량        │
│ - 매입가          │
│ - 공급가          │
│ - 매입액          │
│ - 공급액          │
└───────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│            InvoiceOutputService.buildInvoiceVatPdf()         │
├─────────────────────────────────────────────────────────────┤
│ 1. 거래원장에서 발주번호로 필터링                            │
│ 2. 거래처DB에서 거래처명으로 상세 정보 조회                  │
│    - findPartnerByName_(supplierNm)                          │
│    - findPartnerByName_(buyerNm)                             │
│ 3. 품목별 계산 및 포맷팅                                      │
│    - 수량 × 단가 (거래원장에서 이미 계산됨)                  │
│    - formatNumber_() - 천 단위 콤마 포맷팅                   │
│    - formatDateYmd_() - 날짜 포맷팅 (yyyy-MM-dd)             │
│ 4. 총계 계산                                                  │
│    - totalSupply (공급가액 합계)                             │
│    - totalAmount (매입액 합계)                               │
│    - totalVat = totalAmount - totalSupply                    │
│ 5. 한글 금액 변환                                             │
│    - numberToHangulKor_() - "일백십만 원"                    │
│ 6. 출력방식 적용 (auto / full / short)                       │
│    - auto: 5개 이하 full, 초과 short                         │
│    - short: "브랜드명 외 N건" 축약                           │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                  템플릿 컨텍스트 객체 (ctx)                  │
├─────────────────────────────────────────────────────────────┤
│ {                                                             │
│   stampBase64: "...",                                         │
│   supplierName: "ABC 주식회사",                               │
│   supplierBizNo: "123-45-67890",                              │
│   supplierManager: "홍길동",                                  │
│   buyerName: "XYZ 상사",                                      │
│   buyerBizNo: "987-65-43210",                                 │
│   buyerPhone: "02-1234-5678",                                 │
│   buyerAddress: "서울특별시 강남구...",                       │
│   dueDate: "2024-01-10",                                      │
│   orderCode: "PO-001",                                        │
│   totalSupply: "1,000,000",                                   │
│   totalVat: "100,000",                                        │
│   totalAmount: "1,100,000",                                   │
│   amountHangul: "일백십만 원",                                │
│   items: [                                                    │
│     {                                                         │
│       code: "P001",                                           │
│       name: "제품A",                                          │
│       spec: "",                                               │
│       qty: "10",                                              │
│       price: "1,000",                                         │
│       amount: "10,000",                                       │
│       note: ""                                                │
│     },                                                        │
│     ...                                                       │
│   ],                                                          │
│   buyerOrderCode: "",                                         │
│   remark: ""                                                  │
│ }                                                             │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│   HtmlService.createTemplateFromFile('Templates_Invoice_VAT')│
├─────────────────────────────────────────────────────────────┤
│ 1. 템플릿 변수 주입 (tmpl[k] = ctx[k])                       │
│ 2. 템플릿 평가 (<?= ... ?> 치환)                             │
│ 3. HTML 생성                                                  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              Utilities.newBlob(...).getAs('application/pdf') │
├─────────────────────────────────────────────────────────────┤
│ HTML → PDF 변환 (Google Apps Script 내장 엔진)               │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                     PDF Blob (최종 산출물)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 주요 특징 요약

### ✅ 장점

1. **멀티페이지 지원**: 품목이 많아도 자동 페이지 분할
2. **반응형 레이아웃**: 그리드 시스템으로 깔끔한 구조
3. **브랜드 아이덴티티**: 오렌지 강조색으로 일관성 유지
4. **가독성 최적화**:
   - 색상 대비 (다크 배경 + 흰색 텍스트)
   - 숫자는 Courier New 폰트 (정렬 및 가독성)
   - 호버 효과로 품목 추적 용이
5. **A4 용지 최적화**: 정확한 mm 단위 설정
6. **인쇄 최적화**: `@media print` CSS로 인쇄 품질 보장
7. **데이터 무결성**: 거래원장에서 계산된 값을 직접 사용

### ⚠️ 제약사항

1. **logoBase64 미구현**: 로고 이미지 동적 로드 기능 없음
2. **규격 컬럼 미사용**: 거래원장에 규격 컬럼이 없어 빈 값
3. **비고 필드 미사용**: `buyerOrderCode`, `remark` 현재 빈 문자열
4. **단일 브랜드 출력**: 멀티 브랜드 통합 시 `buildInvoiceVatPdfMerged()` 별도 함수 사용

### 🔧 개선 가능 영역

1. **로고 동적 로드**: Script Properties 또는 Drive에서 로고 이미지 로드
2. **규격 데이터**: 거래원장에 규격 컬럼 추가 또는 제품DB 연동
3. **비고 활용**: 발주 시 입력한 비고 내용 표시
4. **헤더 커스터마이징**: 거래처별 로고 및 헤더 색상 변경
5. **QR 코드**: 문서 검증용 QR 코드 추가
6. **전자서명**: 디지털 서명 영역 추가

---

## 관련 파일

- **템플릿 파일**: `/tmp/previous_branch/Templates_Invoice_VAT.html`
- **서비스 파일**: `/home/user/onebridge-erp-webapp/InvoiceOutputService.js`
- **데이터 소스**:
  - 거래원장 시트 (`OrderMerged`)
  - 거래처DB 시트 (`Suppliers`)
- **스크립트 속성**:
  - `STAMP_BASE64`: 인감 이미지 Base64 인코딩

---

## 버전 정보

- **문서 버전**: 2.1
- **생성 시스템**: OneBridge ERP v2.1
- **분석 일자**: 2026-01-10
- **분석 대상**: 이전 브랜치 (`/tmp/previous_branch`)

---

## 결론

`Templates_Invoice_VAT.html`은 Google Apps Script 환경에서 거래명세서를 PDF로 출력하기 위한 잘 구조화된 템플릿입니다. 멀티페이지 지원, 반응형 레이아웃, 브랜드 아이덴티티, A4 용지 최적화 등의 장점을 가지고 있으며, 거래원장과 거래처DB 데이터를 기반으로 동적으로 문서를 생성합니다.

향후 로고 동적 로드, 규격 데이터 추가, 비고 활용 등의 개선을 통해 더욱 완성도 높은 문서 출력 시스템으로 발전할 수 있습니다.
