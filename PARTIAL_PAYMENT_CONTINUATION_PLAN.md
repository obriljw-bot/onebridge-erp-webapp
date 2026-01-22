# OneBridge ERP - 거래명세서 출력 기능 이관 및 확장 작업 명세서

## 📋 작업 개요

**작업 기간**: 2026-01-10 ~
**이전 브랜치**: `claude/erp-partial-payment-HtG35`
**현재 브랜치**: `claude/erp-partial-payment-continue-Dgmz2`
**작업 유형**: 기능 이관 + 확장 개발

---

## 🎯 작업 목표

1. **이전 브랜치 작업 내용 현재 브랜치로 이관**
   - 거래명세서 출력 기능 전체 병합
   - 멀티페이지 PDF 지원 기능
   - 전용 양식 출력 기능 (롬앤/누즈, 종근당, 삐아계열)
   - Excel 출력 형식 구현

2. **코드 품질 개선 및 최적화**
   - 중복 코드 제거
   - 함수 모듈화 개선
   - 에러 핸들링 강화

3. **추가 기능 확장**
   - 부분결제 기능 구현
   - 결제 이력 추적
   - 미수금/미지급금 관리

---

## 📊 이전 브랜치 작업 분석

### 변경 파일 통계
```
CommonScripts.html         +5,855줄
InvoiceOutputService.js    +1,994줄
Templates_Invoice_VAT.html   +867줄
Page_InvoiceOutput.html      +105줄
----------------------------------------
총 변경: +8,821줄, -560줄
```

### 커밋 히스토리 (claude/erp-partial-payment-HtG35)
```
583cddb | fix: 삐아계열 전용양식 XLSX 변환 로직 추가 | 2026-01-09
0dcea21 | fix: auto 모드에서 항상 full 유지 (멀티페이지 정상 동작) | 2026-01-09
962f7f1 | fix: 출력 기능 버그 수정 및 전용양식 기능 완성 | 2026-01-09
d2133b5 | fix: Excel 출력 형식 실제 구현 | 2026-01-09
31b30bc | feat: Templates_Invoice_VAT.html 멀티페이지 PDF 지원 | 2026-01-09
0e47312 | fix: 이전 브랜치 코드 복원 및 기능 개선 적용 | 2026-01-09
15bece9 | feat: 전용 양식 출력 기능 구현 (롬앤/누즈, 종근당, 삐아계열) | 2026-01-09
9d5a3eb | feat: Templates_Invoice_VAT.html 멀티페이지 지원 | 2026-01-09
0082f5a | feat: InvoiceOutputService.js 멀티페이지 PDF 지원 | 2026-01-09
6870eac | feat: CommonScripts.html 출력 기능 업데이트 | 2026-01-09
ec7cbc7 | feat: 거래명세서 출력 페이지 UI 개선 | 2026-01-09
```

---

## 🏗️ 아키텍처 설계

### 1. 출력 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  Page_InvoiceOutput.html                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ UI Components                                             │  │
│  │ - 문서 유형 선택 (발주서/거래명세서/전용양식)                │  │
│  │ - 출력 형식 선택 (PDF/Excel)                               │  │
│  │ - 출력 방식 선택 (auto/full/short)                         │  │
│  │ - 발주번호 체크박스 리스트                                  │  │
│  │ - 매입처별 통합 출력 옵션                                   │  │
│  │ - 발주일/납품일/비고 입력                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
│  CommonScripts.html                                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Business Logic                                            │  │
│  │ - exportSelected() : 통합 출력 함수                        │  │
│  │ - 파라미터 수집 및 검증                                    │  │
│  │ - 진행 상태 UI 업데이트                                    │  │
│  │ - ZIP 다운로드 처리                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Backend Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  InvoiceOutputService.js                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Main Entry Point                                          │  │
│  │ - generateInvoiceZip(params)                              │  │
│  │   ├─ 출력 형식 분기 (PDF/Excel)                           │  │
│  │   ├─ 전용 양식 분기 (CUSTOM_*)                            │  │
│  │   ├─ 매입처별 통합 처리                                    │  │
│  │   └─ ZIP 파일 생성 및 반환                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ PDF Generation Module                                     │  │
│  │ - buildInvoiceVatPdf() : 거래명세서(부포) 단일           │  │
│  │ - buildOrderPurchasePdf() : 발주서(매입) 단일            │  │
│  │ - buildInvoiceNvatPdf() : 거래명세서(영세) 단일          │  │
│  │ - buildInvoiceVatPdfMerged() : 거래명세서 통합           │  │
│  │ - buildOrderPurchasePdfMerged() : 발주서 통합            │  │
│  │ - buildInvoiceNvatPdfMerged() : 영세 명세서 통합         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Excel Generation Module                                   │  │
│  │ - generateExcelOutput_() : 표준 Excel 출력               │  │
│  │   ├─ 발주서(매입) 형식                                    │  │
│  │   ├─ 거래명세서(부포/영세) 형식                           │  │
│  │   └─ 합계 행/수식 자동 생성                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Custom Template Module                                    │  │
│  │ - generateCustomTemplateExcel_() : 전용 양식 통합 처리   │  │
│  │ - buildRomandNudzExcel_() : 롬앤/누즈 전용              │  │
│  │ - buildJonggeundangExcel_() : 종근당 전용               │  │
│  │ - buildBbiaGroupExcel_() : 삐아계열 전용                │  │
│  │ - getCustomTemplateGroup_() : 브랜드 그룹 판별          │  │
│  │ - getCustomTemplateFileIds_() : 템플릿 파일 조회        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Utility Module                                            │  │
│  │ - findPartnerByName_() : 거래처 정보 조회                │  │
│  │ - formatNumber_() : 숫자 포맷                             │  │
│  │ - formatDateYmd_() : 날짜 포맷                            │  │
│  │ - numberToHangulKor_() : 한글 금액 변환                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Template Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  Templates_Invoice_VAT.html                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Multipage PDF Template                                    │  │
│  │ - 페이지당 10행 자동 분할                                  │  │
│  │ - 첫 페이지: 헤더 + 금액 요약 + 품목 + 비고              │  │
│  │ - 연속 페이지: 헤더 (계속) + 품목                         │  │
│  │ - 마지막 페이지: 비고 포함                                 │  │
│  │ - 스타일: 그라데이션 헤더, 오렌지 액센트                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Data Layer                                │
├─────────────────────────────────────────────────────────────────┤
│  Google Sheets                                                   │
│  - 거래원장 (Transaction)                                        │
│  - 거래처DB (Partners)                                           │
│  - 품목DB (Items)                                                │
│  - 설정DB (Settings)                                             │
│                                                                  │
│  Google Drive                                                    │
│  - 전용 양식 템플릿 파일 (XLSX)                                 │
│  - 출력 결과 ZIP 파일 (임시)                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 2. 데이터 흐름

```
사용자 입력
    ↓
[발주번호 선택 + 출력 옵션 선택]
    ↓
CommonScripts.exportSelected()
    ↓
파라미터 수집 및 검증
    {
      orderCodes: ['PO001', 'PO002', ...],
      docType: 'INVOICE_VAT' | 'ORDER_PURCHASE' | 'CUSTOM_*',
      outputFormat: 'PDF' | 'EXCEL',
      printMode: 'auto' | 'full' | 'short',
      modesByOrder: { 'PO001': 'full', 'PO002': 'short' },
      mergeBySupplier: true/false,
      docDate: '2026-01-10',
      deliveryDate: '2026-01-15',
      manualRemark: '특이사항...'
    }
    ↓
google.script.run.generateInvoiceZip(params)
    ↓
Backend: InvoiceOutputService.generateInvoiceZip()
    ↓
┌──────────────────────────────────────────┐
│ 1. 거래원장 데이터 조회                  │
│    - 발주번호별 품목 정보                │
│    - 수량/단가/금액 정보                 │
│    - 거래처 정보                         │
└──────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────┐
│ 2. 출력 형식 분기                        │
│    ├─ PDF → buildXxxPdf()               │
│    ├─ Excel (표준) → generateExcelOutput_() │
│    └─ Excel (전용) → generateCustomTemplateExcel_() │
└──────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────┐
│ 3. 매입처별 통합 처리 (옵션)             │
│    - 발주번호 → 매입처 매핑              │
│    - 매입처별 발주번호 그룹핑            │
│    - 그룹별 통합 문서 생성               │
└──────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────┐
│ 4. 개별 문서 생성                        │
│    - 템플릿 렌더링                       │
│    - PDF/Excel 파일 생성                │
│    - Blob 객체 생성                      │
└──────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────┐
│ 5. ZIP 압축 및 반환                      │
│    - 모든 파일을 ZIP으로 압축            │
│    - Base64 인코딩                       │
│    - Frontend로 반환                     │
└──────────────────────────────────────────┘
    ↓
Frontend: ZIP 파일 다운로드
    ↓
사용자 로컬 저장
```

---

## 📝 작업 단계별 상세 명세

### Phase 1: 이전 브랜치 코드 병합 (우선순위: 최상)

#### 1.1 InvoiceOutputService.js 병합
- [ ] 이전 브랜치의 InvoiceOutputService.js 파일 분석
- [ ] 현재 브랜치와 차이점 비교
- [ ] 충돌 해결 및 코드 병합
- [ ] 함수별 기능 검증

**주요 병합 함수:**
```javascript
// Main Entry
- generateInvoiceZip()

// PDF Generation (단일)
- buildInvoiceVatPdf()
- buildOrderPurchasePdf()
- buildInvoiceNvatPdf()

// PDF Generation (통합)
- buildInvoiceVatPdfMerged()
- buildOrderPurchasePdfMerged()
- buildInvoiceNvatPdfMerged()

// Excel Generation
- generateExcelOutput_()
- generateCustomTemplateExcel_()
- buildRomandNudzExcel_()
- buildJonggeundangExcel_()
- buildBbiaGroupExcel_()

// Utilities
- getCustomTemplateGroup_()
- getCustomTemplateFileIds_()
- findPartnerByName_()
- formatNumber_()
- formatDateYmd_()
- numberToHangulKor_()
```

#### 1.2 CommonScripts.html 병합
- [ ] 이전 브랜치의 CommonScripts.html 출력 관련 코드 추출
- [ ] 현재 브랜치의 기존 구조와 통합
- [ ] 중복 코드 제거 및 최적화
- [ ] 이벤트 핸들러 연결 확인

**주요 병합 함수:**
```javascript
// 출력 관련
OB.initInvoiceOutputPage()
OB.loadInvoiceOutputData()
OB.exportSelected()
OB.handleDocTypeChange()
OB.handleOutputFormatChange()

// UI 제어
- 전용양식 선택 시 자동 Excel 형식 변경
- 삐아계열 선택 시 납품일 필드 표시
- 체크박스 전체 선택/해제
- 진행 상태 표시
```

#### 1.3 Templates_Invoice_VAT.html 병합
- [ ] 멀티페이지 PDF 템플릿 구조 병합
- [ ] 스타일 시트 통합
- [ ] 페이지 분할 로직 검증
- [ ] 반응형 레이아웃 테스트

**주요 기능:**
- 페이지당 10행 자동 분할
- 첫 페이지: 헤더 + 금액 요약 + 품목 + 비고
- 연속 페이지: 헤더 (계속) + 품목
- 마지막 페이지: 비고 포함

#### 1.4 Page_InvoiceOutput.html 병합
- [ ] UI 컴포넌트 병합
- [ ] 선택 옵션 추가 (문서 유형, 출력 형식, 출력 방식)
- [ ] 입력 필드 추가 (발주일, 납품일, 비고)
- [ ] 테이블 컬럼 구조 업데이트

**주요 UI 요소:**
```html
<!-- 문서 유형 선택 -->
<select id="inv-doc-type">
  <option value="ORDER_PURCHASE">발주서(매입)</option>
  <option value="INVOICE_VAT">거래명세서(부포)</option>
  <option value="INVOICE_NVAT">거래명세서(영세)</option>
  <optgroup label="전용 양식">
    <option value="CUSTOM_ROMAND">롬앤/누즈 전용</option>
    <option value="CUSTOM_JONGGEUNDANG">종근당 전용</option>
    <option value="CUSTOM_BBIA">삐아계열 전용</option>
  </optgroup>
</select>

<!-- 출력 형식 선택 -->
<select id="inv-output-format">
  <option value="PDF">PDF</option>
  <option value="EXCEL">Excel</option>
</select>

<!-- 출력 방식 선택 -->
<select id="inv-default-mode">
  <option value="auto">자동(10행 기준)</option>
  <option value="full">전체내역</option>
  <option value="short">단축내역</option>
</select>

<!-- 추가 옵션 -->
<input type="date" id="inv-doc-date" />
<input type="date" id="inv-delivery-date" />
<textarea id="inv-manual-remark"></textarea>
<input type="checkbox" id="inv-merge-by-supplier" />
```

---

### Phase 2: 기능 검증 및 테스트 (우선순위: 상) ✅ 완료

#### 2.1 출력 시 상태 자동 변경 구현 현황

**✅ 현재 구현 완료:**
```javascript
// InvoiceOutputService.js:91-92, 352-353
if (docType === 'ORDER_PURCHASE') {
  updateOrderStatusAfterOutput_(orderCodes, 'buyOrder', '발주완료');
}
```

**상태 변경 정책 (최종 확정):**
| 문서 유형 | 변경 대상 | 변경 값 | 비고 |
|---------|---------|--------|------|
| `ORDER_PURCHASE` (발주서) | 매입발주 | "발주완료" | ✅ 구현 완료 |
| `INVOICE_VAT` (거래명세서 부포) | **변경 없음** | - | ❌ 구현 안 함 (의도됨) |
| `INVOICE_NVAT` (거래명세서 영세) | **변경 없음** | - | ❌ 구현 안 함 (의도됨) |

**이유**: 거래명세서 1번 출력했다고 매출결제가 완료된 것이 아님!

#### 2.2 기본 출력 기능 테스트 ✅
- [x] PDF 출력 테스트 (발주서, 거래명세서 부포/영세)
- [x] Excel 출력 테스트 (표준 형식)
- [x] 멀티페이지 PDF 테스트 (10행 이상 데이터)
- [x] 출력 방식 테스트 (auto, full, short)

#### 2.3 전용 양식 출력 테스트 ✅
- [x] 롬앤/누즈 전용 양식 테스트
- [x] 종근당 전용 양식 테스트
- [x] 삐아계열 전용 양식 테스트
- [x] XLSX → Google Sheets 변환 검증
- [x] 바코드 매칭 로직 검증

#### 2.4 매입처별 통합 출력 테스트 ✅
- [x] 매입처별 발주번호 그룹핑 검증
- [x] 통합 PDF 생성 테스트
- [x] 통합 Excel 생성 테스트
- [x] 파일명 규칙 검증

#### 2.5 에러 처리 테스트 ✅
- [x] 잘못된 발주번호 입력 시
- [x] 템플릿 파일 없을 시
- [x] 거래처 정보 없을 시
- [x] 네트워크 오류 시

---

### Phase 3: 부분결제 기능 구현 (우선순위: 중)

#### 3.1 부분결제 데이터 구조 설계

**Payment 시트 구조:**
```
| PaymentID | InvoiceID | OrderCode | PaymentDate | Amount | PaymentType | Status | CreatedDate | CreatedBy |
|-----------|-----------|-----------|-------------|--------|-------------|--------|-------------|-----------|
| PAY001    | INV001    | PO001     | 2026-01-10  | 500000 | PARTIAL     | DONE   | 2026-01-10  | admin     |
| PAY002    | INV001    | PO001     | 2026-01-15  | 300000 | PARTIAL     | DONE   | 2026-01-15  | admin     |
| PAY003    | INV001    | PO001     | 2026-01-20  | 200000 | FINAL       | DONE   | 2026-01-20  | admin     |
```

**Invoice 시트 추가 필드:**
```
| InvoiceID | TotalAmount | PaidAmount | OutstandingAmount | PaymentStatus |
|-----------|-------------|------------|-------------------|---------------|
| INV001    | 1000000     | 800000     | 200000            | PARTIAL       |
```

**PaymentStatus 상태:**
- `UNPAID`: 미결제
- `PARTIAL`: 부분결제
- `PAID`: 완납

#### 3.2 Backend Service 구현

**PaymentService.js 생성:**
```javascript
/**
 * 부분결제 등록
 */
function recordPartialPayment(params) {
  var { invoiceId, orderCode, amount, paymentDate, paymentType, remark } = params;

  // 1. Invoice 정보 조회
  var invoice = getInvoiceById(invoiceId);

  // 2. 결제 금액 검증
  if (amount <= 0 || amount > invoice.outstandingAmount) {
    throw new Error('결제 금액이 유효하지 않습니다.');
  }

  // 3. Payment 레코드 생성
  var paymentId = generatePaymentId();
  var payment = {
    paymentId: paymentId,
    invoiceId: invoiceId,
    orderCode: orderCode,
    paymentDate: paymentDate,
    amount: amount,
    paymentType: paymentType, // 'PARTIAL' | 'FINAL'
    status: 'DONE',
    remark: remark,
    createdDate: new Date(),
    createdBy: Session.getActiveUser().getEmail()
  };

  // 4. Payment 시트에 저장
  savePayment(payment);

  // 5. Invoice 잔액 업데이트
  updateInvoiceBalance(invoiceId, amount);

  return {
    success: true,
    paymentId: paymentId,
    outstandingAmount: invoice.totalAmount - invoice.paidAmount - amount
  };
}

/**
 * 결제 이력 조회
 */
function getPaymentHistory(invoiceId) {
  var sheet = getSheetByName('Payment');
  var data = sheet.getDataRange().getValues();

  var payments = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[1] === invoiceId) { // InvoiceID 컬럼
      payments.push({
        paymentId: row[0],
        invoiceId: row[1],
        orderCode: row[2],
        paymentDate: row[3],
        amount: row[4],
        paymentType: row[5],
        status: row[6],
        remark: row[7] || '',
        createdDate: row[8],
        createdBy: row[9]
      });
    }
  }

  return payments;
}

/**
 * 미수금 조회
 */
function getOutstandingInvoices(partnerId) {
  var sheet = getSheetByName('Invoice');
  var data = sheet.getDataRange().getValues();

  var outstanding = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[2] === partnerId && row[7] !== 'PAID') { // PartnerId, PaymentStatus
      outstanding.push({
        invoiceId: row[0],
        orderCode: row[1],
        partnerId: row[2],
        partnerName: row[3],
        totalAmount: row[4],
        paidAmount: row[5],
        outstandingAmount: row[6],
        paymentStatus: row[7],
        dueDate: row[8]
      });
    }
  }

  return outstanding;
}
```

#### 3.3 Frontend UI 구현

**Page_Payment.html 생성:**
```html
<div id="payment-page">
  <!-- 검색 필터 -->
  <div class="filter-section">
    <select id="payment-partner-filter">
      <option value="">전체 거래처</option>
      <!-- 동적 로드 -->
    </select>
    <select id="payment-status-filter">
      <option value="">전체 상태</option>
      <option value="UNPAID">미결제</option>
      <option value="PARTIAL">부분결제</option>
      <option value="PAID">완납</option>
    </select>
    <button onclick="OB.loadPaymentData()">조회</button>
  </div>

  <!-- Invoice 리스트 -->
  <div class="invoice-list">
    <table id="payment-invoice-table">
      <thead>
        <tr>
          <th>Invoice ID</th>
          <th>발주번호</th>
          <th>거래처</th>
          <th>총액</th>
          <th>기결제액</th>
          <th>미수금</th>
          <th>상태</th>
          <th>결제기한</th>
          <th>액션</th>
        </tr>
      </thead>
      <tbody>
        <!-- 동적 로드 -->
      </tbody>
    </table>
  </div>

  <!-- 결제 등록 모달 -->
  <div id="payment-modal" class="modal">
    <div class="modal-content">
      <h3>결제 등록</h3>
      <form id="payment-form">
        <input type="hidden" id="payment-invoice-id" />
        <div>
          <label>Invoice ID:</label>
          <span id="payment-invoice-id-display"></span>
        </div>
        <div>
          <label>발주번호:</label>
          <span id="payment-order-code-display"></span>
        </div>
        <div>
          <label>거래처:</label>
          <span id="payment-partner-display"></span>
        </div>
        <div>
          <label>총액:</label>
          <span id="payment-total-display"></span>
        </div>
        <div>
          <label>미수금:</label>
          <span id="payment-outstanding-display"></span>
        </div>
        <div>
          <label>결제일:</label>
          <input type="date" id="payment-date" required />
        </div>
        <div>
          <label>결제금액:</label>
          <input type="number" id="payment-amount" min="1" required />
        </div>
        <div>
          <label>결제 유형:</label>
          <select id="payment-type">
            <option value="PARTIAL">부분결제</option>
            <option value="FINAL">최종결제</option>
          </select>
        </div>
        <div>
          <label>비고:</label>
          <textarea id="payment-remark"></textarea>
        </div>
        <div class="modal-buttons">
          <button type="submit">등록</button>
          <button type="button" onclick="OB.closePaymentModal()">취소</button>
        </div>
      </form>
    </div>
  </div>

  <!-- 결제 이력 모달 -->
  <div id="payment-history-modal" class="modal">
    <div class="modal-content">
      <h3>결제 이력</h3>
      <table id="payment-history-table">
        <thead>
          <tr>
            <th>Payment ID</th>
            <th>결제일</th>
            <th>결제금액</th>
            <th>유형</th>
            <th>상태</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>
          <!-- 동적 로드 -->
        </tbody>
      </table>
      <button onclick="OB.closePaymentHistoryModal()">닫기</button>
    </div>
  </div>
</div>
```

**CommonScripts.html 추가:**
```javascript
// 결제 페이지 초기화
OB.initPaymentPage = function() {
  console.log('🔧 initPaymentPage 호출');

  // 거래처 필터 로드
  OB.loadPartnerFilter();

  // Invoice 데이터 로드
  OB.loadPaymentData();

  // 이벤트 핸들러 등록
  document.getElementById('payment-form').addEventListener('submit', function(e) {
    e.preventDefault();
    OB.submitPayment();
  });
};

// Invoice 데이터 로드
OB.loadPaymentData = function() {
  var partnerId = document.getElementById('payment-partner-filter').value;
  var status = document.getElementById('payment-status-filter').value;

  OB.showLoading('Invoice 데이터 로딩 중...');

  google.script.run
    .withSuccessHandler(function(invoices) {
      OB.hideLoading();
      OB.renderPaymentInvoiceTable(invoices);
    })
    .withFailureHandler(function(err) {
      OB.hideLoading();
      console.error(err);
      alert('Invoice 조회 실패: ' + err.message);
    })
    .getOutstandingInvoices(partnerId, status);
};

// Invoice 테이블 렌더링
OB.renderPaymentInvoiceTable = function(invoices) {
  var tbody = document.querySelector('#payment-invoice-table tbody');
  tbody.innerHTML = '';

  invoices.forEach(function(inv) {
    var tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${inv.invoiceId}</td>
      <td>${inv.orderCode}</td>
      <td>${inv.partnerName}</td>
      <td>${OB.formatNumber(inv.totalAmount)}원</td>
      <td>${OB.formatNumber(inv.paidAmount)}원</td>
      <td class="text-danger">${OB.formatNumber(inv.outstandingAmount)}원</td>
      <td>${OB.getPaymentStatusBadge(inv.paymentStatus)}</td>
      <td>${inv.dueDate}</td>
      <td>
        <button onclick="OB.openPaymentModal('${inv.invoiceId}')">결제</button>
        <button onclick="OB.openPaymentHistoryModal('${inv.invoiceId}')">이력</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
};

// 결제 모달 열기
OB.openPaymentModal = function(invoiceId) {
  google.script.run
    .withSuccessHandler(function(invoice) {
      document.getElementById('payment-invoice-id').value = invoice.invoiceId;
      document.getElementById('payment-invoice-id-display').textContent = invoice.invoiceId;
      document.getElementById('payment-order-code-display').textContent = invoice.orderCode;
      document.getElementById('payment-partner-display').textContent = invoice.partnerName;
      document.getElementById('payment-total-display').textContent = OB.formatNumber(invoice.totalAmount) + '원';
      document.getElementById('payment-outstanding-display').textContent = OB.formatNumber(invoice.outstandingAmount) + '원';

      // 결제금액 max 설정
      document.getElementById('payment-amount').max = invoice.outstandingAmount;

      // 모달 표시
      document.getElementById('payment-modal').classList.add('show');
    })
    .withFailureHandler(function(err) {
      console.error(err);
      alert('Invoice 조회 실패: ' + err.message);
    })
    .getInvoiceById(invoiceId);
};

// 결제 등록
OB.submitPayment = function() {
  var params = {
    invoiceId: document.getElementById('payment-invoice-id').value,
    orderCode: document.getElementById('payment-order-code-display').textContent,
    paymentDate: document.getElementById('payment-date').value,
    amount: parseInt(document.getElementById('payment-amount').value),
    paymentType: document.getElementById('payment-type').value,
    remark: document.getElementById('payment-remark').value
  };

  OB.showLoading('결제 등록 중...');

  google.script.run
    .withSuccessHandler(function(result) {
      OB.hideLoading();
      alert('결제가 등록되었습니다.\n미수금: ' + OB.formatNumber(result.outstandingAmount) + '원');
      OB.closePaymentModal();
      OB.loadPaymentData(); // 테이블 갱신
    })
    .withFailureHandler(function(err) {
      OB.hideLoading();
      console.error(err);
      alert('결제 등록 실패: ' + err.message);
    })
    .recordPartialPayment(params);
};

// 결제 이력 모달 열기
OB.openPaymentHistoryModal = function(invoiceId) {
  google.script.run
    .withSuccessHandler(function(payments) {
      var tbody = document.querySelector('#payment-history-table tbody');
      tbody.innerHTML = '';

      payments.forEach(function(pay) {
        var tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${pay.paymentId}</td>
          <td>${pay.paymentDate}</td>
          <td>${OB.formatNumber(pay.amount)}원</td>
          <td>${pay.paymentType}</td>
          <td>${pay.status}</td>
          <td>${pay.remark || '-'}</td>
        `;
        tbody.appendChild(tr);
      });

      document.getElementById('payment-history-modal').classList.add('show');
    })
    .withFailureHandler(function(err) {
      console.error(err);
      alert('결제 이력 조회 실패: ' + err.message);
    })
    .getPaymentHistory(invoiceId);
};

// 결제 상태 배지
OB.getPaymentStatusBadge = function(status) {
  var badges = {
    'UNPAID': '<span class="badge badge-danger">미결제</span>',
    'PARTIAL': '<span class="badge badge-warning">부분결제</span>',
    'PAID': '<span class="badge badge-success">완납</span>'
  };
  return badges[status] || status;
};
```

---

### Phase 4: UI 페이지 개선 (우선순위: 최상 🔥)

#### 4.1 Page_OrderList.html (거래원장 페이지) - 상태 컬럼 추가

**현재 상태:**
```html
<!-- Page_OrderList.html:492-499 -->
<th>발주일</th>
<th>발주번호</th>
<th>발주처</th>
<th>브랜드</th>
<th>매입처</th>
<th>품목수</th>
<th>매입액</th>
<th>공급액</th>
<!-- ❌ 상태 컬럼 없음! -->
```

**개선 계획:**
```html
<!-- 추가할 컬럼 -->
<th>발주일</th>
<th>발주번호</th>
<th>발주처</th>
<th>브랜드</th>
<th>매입처</th>
<th>품목수</th>
<th>매입액</th>
<th>공급액</th>
<th class="text-center">매입발주</th>  <!-- ✨ 새로 추가 -->
<th class="text-center">매입결제</th>  <!-- ✨ 새로 추가 -->
<th class="text-center">매출결제</th>  <!-- ✨ 새로 추가 -->
<th class="text-center">출고</th>      <!-- ✨ 새로 추가 -->
<th class="text-center">액션</th>      <!-- ✨ 새로 추가 -->
```

**상태 뱃지 스타일:**
```css
.orderlist-status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

/* 매입발주 */
.badge-buy-order-pending { background: #fee2e2; color: #991b1b; }  /* 미처리 */
.badge-buy-order-done { background: #d1fae5; color: #065f46; }     /* 발주완료 */

/* 매입결제 */
.badge-pay-buy-unpaid { background: #fef3c7; color: #92400e; }    /* 미결제 */
.badge-pay-buy-partial { background: #fed7aa; color: #9a3412; }   /* 부분결제 */
.badge-pay-buy-paid { background: #d1fae5; color: #065f46; }      /* 결제완료 */

/* 매출결제 */
.badge-pay-sell-unpaid { background: #fef3c7; color: #92400e; }   /* 미결제 */
.badge-pay-sell-partial { background: #fed7aa; color: #9a3412; }  /* 부분결제 */
.badge-pay-sell-paid { background: #d1fae5; color: #065f46; }     /* 결제완료 */

/* 출고 */
.badge-ship-pending { background: #e0e7ff; color: #3730a3; }      /* 미출고 */
.badge-ship-partial { background: #c7d2fe; color: #4338ca; }      /* 부분출고 */
.badge-ship-done { background: #d1fae5; color: #065f46; }         /* 출고완료 */
```

**CommonScripts.html 수정:**
```javascript
// 거래원장 데이터 렌더링 시 상태 컬럼 추가
OB.renderOrderListTable = function(orders) {
  var tbody = document.getElementById('orderlist-tbody');
  tbody.innerHTML = '';

  orders.forEach(function(order) {
    var tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${order.orderDate}</td>
      <td class="orderlist-ordercode">${order.orderCode}</td>
      <td>${order.buyer}</td>
      <td>${order.brand}</td>
      <td>${order.supplier}</td>
      <td class="text-center">${order.itemCount}</td>
      <td class="text-right">₩${formatNumber(order.totalPurchaseAmount)}</td>
      <td class="text-right">₩${formatNumber(order.totalAmount)}</td>
      <td class="text-center">${getStatusBadge('buyOrder', order.buyOrderStatus)}</td>
      <td class="text-center">${getStatusBadge('payBuy', order.payBuyStatus)}</td>
      <td class="text-center">${getStatusBadge('paySell', order.paySellStatus)}</td>
      <td class="text-center">${getStatusBadge('ship', order.shipStatus)}</td>
      <td class="text-center">
        <button class="orderlist-btn-sm" onclick="viewOrderDetail('${order.orderCode}')">상세</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
};

// 상태 뱃지 생성 함수
function getStatusBadge(type, status) {
  var badges = {
    'buyOrder': {
      '미처리': '<span class="orderlist-status-badge badge-buy-order-pending">미처리</span>',
      '발주완료': '<span class="orderlist-status-badge badge-buy-order-done">발주완료</span>'
    },
    'payBuy': {
      '미결제': '<span class="orderlist-status-badge badge-pay-buy-unpaid">미결제</span>',
      '부분결제': '<span class="orderlist-status-badge badge-pay-buy-partial">부분결제</span>',
      '결제완료': '<span class="orderlist-status-badge badge-pay-buy-paid">결제완료</span>'
    },
    'paySell': {
      '미결제': '<span class="orderlist-status-badge badge-pay-sell-unpaid">미결제</span>',
      '부분결제': '<span class="orderlist-status-badge badge-pay-sell-partial">부분결제</span>',
      '결제완료': '<span class="orderlist-status-badge badge-pay-sell-paid">결제완료</span>'
    },
    'ship': {
      '미출고': '<span class="orderlist-status-badge badge-ship-pending">미출고</span>',
      '부분출고': '<span class="orderlist-status-badge badge-ship-partial">부분출고</span>',
      '출고완료': '<span class="orderlist-status-badge badge-ship-done">출고완료</span>'
    }
  };

  return badges[type][status] || status;
}
```

---

#### 4.2 Page_BillingManagement.html (청구서 관리 페이지) - 재출력 기능 연결

**현재 상태:**
```html
<!-- Page_BillingManagement.html:418-420 -->
<button class="billing-btn secondary" id="billing-detail-reprint-btn">
  📄 청구서 재출력
</button>
<!-- ❌ 버튼은 있지만 기능 미구현! -->
```

**개선 계획:**
```javascript
// CommonScripts.html에 추가
OB.handleBillingReprint = function(billingId) {
  if (!confirm('청구서를 재출력하시겠습니까?')) return;

  OB.showLoading('청구서 재출력 중...');

  google.script.run
    .withSuccessHandler(function(result) {
      OB.hideLoading();
      if (result.success) {
        alert('청구서가 재출력되었습니다.\n폴더: ' + result.folderUrl);
        window.open(result.folderUrl, '_blank');
      } else {
        alert('재출력 실패: ' + result.error);
      }
    })
    .withFailureHandler(function(err) {
      OB.hideLoading();
      alert('재출력 중 오류 발생: ' + err.message);
    })
    .reprintInvoiceApi({
      billingId: billingId,
      invoiceId: billingId,
      settlementId: '',
      type: 'SALES'
    });
};

// 이벤트 리스너 연결
document.getElementById('billing-detail-reprint-btn').addEventListener('click', function() {
  var billingId = document.getElementById('detail-billing-id').textContent;
  OB.handleBillingReprint(billingId);
});
```

**Backend 함수 구현 (ApiService.js):**
```javascript
/**
 * 청구서 재출력 API
 * @param {Object} params - { billingId, invoiceId, settlementId, type }
 */
function reprintInvoiceApi(params) {
  try {
    var billingId = params.billingId || params.invoiceId || '';

    if (!billingId) {
      return safeReturn({ success: false, error: '청구ID를 찾을 수 없습니다.' });
    }

    // 1. 청구DB에서 발주번호 목록 조회
    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_BILLING_SHEET);

    if (!sheet) {
      return safeReturn({ success: false, error: '청구DB를 찾을 수 없습니다.' });
    }

    var data = sheet.getDataRange().getValues();
    var header = data[0];
    var colBillingId = header.indexOf('청구ID');
    var colOrderNumbers = header.indexOf('발주번호목록');
    var colType = header.indexOf('청구유형');

    if (colOrderNumbers < 0) {
      return safeReturn({
        success: false,
        error: '청구DB에 발주번호목록 컬럼이 없습니다. 시스템 업데이트가 필요합니다.'
      });
    }

    // 2. 청구ID로 행 찾기
    var orderNumbersStr = '';
    var billingType = '';
    for (var i = 1; i < data.length; i++) {
      if (data[i][colBillingId] === billingId) {
        orderNumbersStr = data[i][colOrderNumbers] || '';
        billingType = data[i][colType] || 'SALES';
        break;
      }
    }

    if (!orderNumbersStr) {
      return safeReturn({
        success: false,
        error: '해당 청구서의 발주번호를 찾을 수 없습니다.'
      });
    }

    // 3. 발주번호 배열로 변환
    var orderCodes = orderNumbersStr.split(',')
      .map(function(s) { return s.trim(); })
      .filter(function(s) { return s !== ''; });

    if (orderCodes.length === 0) {
      return safeReturn({ success: false, error: '발주번호가 비어있습니다.' });
    }

    // 4. 문서 유형 결정
    var docType = billingType === 'PURCHASE' ? 'ORDER_PURCHASE' : 'INVOICE_VAT';

    // 5. generateInvoiceZip 호출
    var result = generateInvoiceZip({
      orderCodes: orderCodes,
      docType: docType,
      printMode: 'auto',
      modesByOrder: {},
      mergeBySupplier: false
    });

    return safeReturn(result);

  } catch (err) {
    Logger.log('[reprintInvoiceApi Error] ' + err.message);
    return safeReturn({
      success: false,
      error: '재출력 중 오류 발생: ' + err.message
    });
  }
}
```

---

#### 4.3 Page_Dashboard.html (대시보드) - 결제 현황 위젯 추가 (선택사항)

**현재 상태:** 모두 정적 예시 데이터

**개선 계획:** Phase 3 완료 후 실제 데이터 연동 (우선순위 낮음)

---

### Phase 5: 코드 품질 개선 (우선순위: 하)

**세부 계획:**
- 리팩토링: 중복 코드 제거, 함수 모듈화, 변수명 일관성, JSDoc 주석
- 에러 핸들링: try-catch 추가, 친화적 메시지, 로깅 시스템
- 성능 최적화: 배치 처리, API 호출 최소화, 캐싱 전략
- 보안 강화: 입력값 검증, 권한 체크, 민감정보 제거

**디테일 설명은 별도 문서 참조**

---

## 🔄 Git Workflow

### 브랜치 전략
```
main (또는 master)
  ↓
claude/erp-partial-payment-continue-Dgmz2 (현재 작업 브랜치)
  ← claude/erp-partial-payment-HtG35 (병합 소스)
```

### 커밋 메시지 규칙
```
feat: 새로운 기능 추가
fix: 버그 수정
refactor: 코드 리팩토링
docs: 문서 수정
style: 코드 포맷팅
test: 테스트 코드
chore: 빌드/설정 변경
```

### 커밋 전략
1. **Phase별 커밋**: 각 Phase가 완료될 때마다 커밋
2. **기능별 커밋**: 독립적인 기능은 개별 커밋
3. **의미있는 단위**: 너무 작거나 큰 커밋 지양

---

## 📊 진행 상황 추적

### Phase 1: 코드 병합 (4/4 완료) ✅
- [x] InvoiceOutputService.js 병합
- [x] CommonScripts.html 병합
- [x] Templates_Invoice_VAT.html 병합
- [x] Page_InvoiceOutput.html 병합

### Phase 2: 기능 검증 및 출력 시 상태 변경 (완료) ✅
- [x] 출력 시 상태 자동 변경 구현 확인
- [x] 기본 출력 기능 테스트
- [x] 전용 양식 출력 테스트
- [x] 매입처별 통합 출력 테스트
- [x] 에러 처리 테스트

**검증 보고서**: [PHASE2_VERIFICATION_REPORT.md](./PHASE2_VERIFICATION_REPORT.md)
**구현 완성도**: 100% (명세서 대비 완전 구현)

### Phase 3: 부분결제 기능 (0/3 완료)
- [ ] 데이터 구조 설계 및 생성
- [ ] Backend Service 구현 (PaymentService.js)
- [ ] Frontend UI 구현 (Page_Payment.html)

### Phase 4: UI 페이지 개선 (0/3 완료) 🔥 최우선
- [ ] **Page_OrderList.html**: 거래원장에 상태 컬럼 추가 (매입발주/매입결제/매출결제/출고)
- [ ] **Page_BillingManagement.html**: 청구서 재출력 버튼 기능 연결
- [ ] **Page_Dashboard.html**: 결제 현황 위젯 추가 (선택사항)

### Phase 5: 코드 품질 개선 (0/1 완료)
- [ ] 리팩토링, 에러 핸들링, 성능, 보안 개선

---

## 🎯 작업 우선순위

| 순위 | Phase | 작업 내용 | 중요도 |
|------|-------|----------|--------|
| 1 | **Phase 4.1** | 거래원장 페이지 상태 컬럼 추가 | 🔥 최상 |
| 2 | **Phase 4.2** | 청구서 재출력 기능 연결 | 🔥 최상 |
| 3 | **Phase 3** | 부분결제 시스템 구현 | 🟡 중 |
| 4 | **Phase 4.3** | 대시보드 위젯 추가 | 🟢 하 |
| 5 | **Phase 5** | 코드 품질 개선 | 🟢 하 |

---

## 📌 주의사항

1. **데이터 백업**: 작업 전 Google Sheets 데이터 백업
2. **테스트 환경**: 가능하면 복사본에서 먼저 테스트
3. **점진적 배포**: Phase별로 검증 후 다음 단계 진행
4. **문서화**: 주요 변경사항은 문서에 기록
5. **코드 리뷰**: 병합 전 코드 검토 필수

---

## 🔗 관련 문서

- [OneBridge ERP v2 Architecture](./OneBridge_ERP_v2_Architecture_검토용.md)
- [OneBridge ERP Architecture v2.1](./OneBridge_ERP_Architecture_v2.1.md)

---

**문서 작성일**: 2026-01-10
**최종 업데이트**: 2026-01-22
**작성자**: Claude
**버전**: 1.1
