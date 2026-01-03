# 결제-발주 연동 워크플로우 분석 및 개선안

**작성일:** 2025-12-26
**작성자:** Claude Code
**목적:** 사용자 지적사항 검증 및 실무 중심 프로세스 개선방안 제시

---

## 1. 현재 데이터 구조 분석

### 1.1. 3단계 데이터 계층

```
발주 (Order)
  ↓ 1:N
청구 (Invoice)
  ↓ 1:N
결제 (Payment)
```

#### A. 발주 (Order) - 거래원장 시트
```javascript
// 위치: 거래원장 (스프레드시트 ID: 1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs)
발주번호: "GMP-20251226-001"
확정금액: 1000000
매입처: "공급사A"
발주처: "고객사B"
매입결제: "미결제" | "부분결제" | "결제완료"
매출결제: "미결제" | "부분결제" | "결제완료"
```

**접근 함수:**
- `getOrderDetail(orderId)` - 발주번호로 조회
- ❌ **검색 함수 없음** - 자동완성 불가

#### B. 청구 (Invoice) - 청구DB 시트
```javascript
// 위치: 청구DB (동일 스프레드시트)
청구ID: "INV-20251226-001" or "BL-20251226-001"
업체명: "고객사B"
청구일: "2025-12-26"
청구금액: 1000000
청구상태: "DRAFT" | "ISSUED" | "PAID" | "CANCELLED"

// 아키텍처 명세에만 존재 (미구현 가능성)
billingType: "SETTLEMENT" | "DIRECT"
orderNumbers: "[\"GMP-20251226-001\", \"GMP-20251226-002\"]"  // JSON 배열
settlementId: "PS-202512-공급사A"
```

**접근 함수:**
- `searchDocumentNumbers(query)` - 청구ID로 검색 (자동완성 지원)
- 청구DB는 **복수 발주번호 보유 가능** (orderNumbers 필드)

#### C. 결제 (Payment) - 결제내역 시트
```javascript
// 위치: 결제내역 (동일 스프레드시트)
결제ID: "PAY-20251226-001"
결제일: "2025-12-26"
결제유형: "입금" | "출금"
거래처명: "고객사B"
금액: 500000
결제수단: "현금" | "카드" | "계좌이체" | "기타"
문서번호: "INV-20251226-001"  // 청구ID (선택)
발주번호: "GMP-20251226-001"  // ⚠️ 단일 발주번호만 지원
비고: ""
```

**접근 함수:**
- `addPaymentRecord(params)` - 결제 추가
- `updatePaymentRecord(params)` - 결제 수정
- ❌ **발주번호 검색 함수 없음**

---

## 2. 사용자 지적사항 검증

### 문제 1: 발주번호 미인지 상태로 데이터 입력
**사용자 의견:**
> "사용자가 결제데이터를 입력시 결제 업체와 금액정도만 인지한상태로 데이터를 입력하게 되므로 연결된 발주번호를 외우지 않는이상 보통은 공란으로 저장함"

**검증 결과:** ✅ **문제 맞음**

**현황:**
- 입출금 관리 페이지 (Page_PaymentManagement.html:115)
  ```html
  <input type="text" id="payment-order-number" placeholder="발주번호 (선택)" />
  ```
- 발주번호 필드는 단순 텍스트 입력
- 자동완성 기능 없음 (문서번호만 autocomplete 지원)
- 사용자가 수동으로 "GMP-20251226-001" 형식 입력해야 함

**실무 시나리오:**
```
사용자: "A업체에서 500만원 입금됐어"
→ 거래처명: A업체
→ 금액: 5,000,000
→ 발주번호: ??? (모름)
→ 결과: 발주번호 공란으로 저장
```

---

### 문제 2: 발주번호 추후 수정 필요
**사용자 의견:**
> "1번의 경우라면 발주번호가 없는 상태로 데이터 입력을 실행. 추후 수정시 발주번호 수정 필요"

**검증 결과:** ⚠️ **부분 문제**

**현황:**
- 발주번호 수정 기능: **구현됨** (editPayment 함수)
- **BUT**: 발주번호 필드가 **수정 불가**로 설정됨 (CommonScripts.html:5591)
  ```javascript
  cells[7].innerHTML = '<span style="color:#9ca3af;">' + original.orderNumber + ' (수정불가)</span>';
  ```

**명세서 의도 (PAYMENT_EDIT_SPECIFICATION.md:92):**
- "발주번호: ❌ 변경 불가 (발주 연동 복잡도 때문)"
- 기존 발주번호 **변경**은 복잡하므로 금지
- **BUT 공란 → 발주번호 추가**는 허용해야 함 (이것을 간과함!)

**실제 필요:**
```
신규 입력: 발주번호 = "" (공란)
→ 추후 발주번호 확인 후
수정: 발주번호 = "GMP-20251226-001" (추가)
```

---

### 문제 3: 발주번호 조회/선택 프로세스 필요
**사용자 의견:**
> "1,2번의 문제를 해결하려면 신규데이터 입력시 발주번호 조회와 조회해서 선택한 발주번호가 입력되는 프로세스 필요"

**검증 결과:** ✅ **필수 기능 누락**

**현재 상태:**
- ❌ `searchOrderNumbers()` 함수 없음
- ❌ 발주번호 자동완성 UI 없음
- ✅ 문서번호 자동완성만 존재 (PaymentService.js:487)

**필요한 기능:**
```javascript
// 필요: 발주번호 검색 함수
function searchOrderNumbers(params) {
  // params: { query, company (optional) }
  // 거래원장에서 발주번호, 매입처/발주처, 확정금액 검색
  // return: [{ orderNumber, company, amount, date }]
}
```

---

### 문제 4: 복수 발주번호 지원 필요
**사용자 의견:**
> "여러 발주건(여러 발주번호)을 일괄 결제를 주고 받는경우 많아. 이런경우 여러 발주번호를 입력해야해."

**검증 결과:** ✅ **구조적 문제**

**현재 제약:**
```javascript
// 결제내역 시트 구조 (SetupPaymentSheets.js:81-96)
var headers = [
  '결제ID',
  '결제일',
  '결제유형',
  '거래처명',
  '금액',
  '결제수단',
  '문서번호',
  '발주번호',      // ⚠️ 단일 문자열 필드
  '비고',
  // ...
];
```

**실무 시나리오:**
```
A업체 → 3건 발주:
  - GMP-20251201-001: 2,000,000원
  - GMP-20251210-002: 1,500,000원
  - GMP-20251220-003: 1,000,000원

A업체 입금: 4,500,000원 (3건 일괄 결제)

현재 시스템: 발주번호 1개만 입력 가능
→ 3개 결제 레코드로 분리? (금액 수동 분할)
→ 또는 1개만 연결? (나머지 미연결)
```

**청구DB는 복수 지원:**
```javascript
// OneBridge_ERP_Architecture_v2.3.md:1354
orderNumbers: "[\"GMP-001\", \"GMP-002\", \"GMP-003\"]"  // JSON 배열
```

**결제내역은 미지원:**
- 발주번호 컬럼이 단일 문자열
- 배열 저장 불가능

---

### 문제 5: 복수 발주 선택시 합계 자동계산
**사용자 의견:**
> "4번의 경우 여러 발주번호를 입력 또는 선택할수 있는 방법 필요하고, 선택시 합계금액 자동계산과 금액 이상없는지 사용자가 보고 저장할수 있도록 해야해."

**검증 결과:** ✅ **UX 기능 누락**

**필요한 UX:**
```
[ ] GMP-20251201-001 | 고객사A | 2,000,000원
[ ] GMP-20251210-002 | 고객사A | 1,500,000원
[ ] GMP-20251220-003 | 고객사A | 1,000,000원
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
선택된 발주: 3건
발주 합계: 4,500,000원

입금 금액: [4,500,000] 원

⚠️ 금액 일치: OK
✅ 저장
```

**현재 상태:**
- 수동 입력만 가능
- 검증 없음
- 불일치 경고 없음

---

### 문제 6: 발주번호 vs 청구번호 중심 워크플로우
**사용자 의견:**
> "결제 데이터와 거래데이터의 연결을 발주번호를 중심으로 하고 있는데, 중간 연결개념으로는 청구번호 또는 문서번호가 있어. 어떤걸 중심으로 작업프로세스 풀어가면 좋을지코드 분석하고 의견줘"

**검증 결과:** ⚠️ **아키텍처 설계 이슈**

**현재 코드 실제 사용:**
```javascript
// PaymentService.js:92 - 문서번호 필드
params.docNumber || '',         // 문서번호 (청구ID)

// PaymentService.js:93 - 발주번호 필드
params.orderNumber || '',       // 발주번호

// PaymentService.js:120-126 - 발주 연동 로직
if (params.orderNumber && params.orderNumber !== '') {
  var syncResult = syncOrderPaymentStatus(params.orderNumber, params.type);
  // 발주번호 기준으로 매입결제/매출결제 상태 업데이트
}
```

**현재 구현 방식:**
- 결제 → **발주번호 직접 연결** → 발주 상태 업데이트
- 문서번호(청구ID)는 **참고용으로만 저장**됨
- 청구 → 발주 연결은 사용되지 않음

**아키텍처 명세 의도:**
```
Track A (직접 청구):
  발주 → 청구생성 (orderNumbers 저장) → 결제

Track B (마감 후 청구):
  발주 → 마감 → 청구생성 → 결제
```

**불일치:**
- 명세: 청구 → 발주 연결 (orderNumbers)
- 구현: 결제 → 발주 직접 연결 (orderNumber)
- **청구는 우회됨**

---

## 3. 데이터 연결 구조 비교

### 3.1. 현재 구현 (발주번호 중심)

```
결제내역
  ├─ 문서번호 (청구ID) ────────┐ (참고용, 미사용)
  └─ 발주번호 (단일) ──────────┼─→ 거래원장
                              │   └─ 매입결제/매출결제 상태 업데이트
청구DB                        │
  ├─ orderNumbers (복수) ─────┘ (미연결)
  └─ settlementId
```

**장점:**
- ✅ 직접 연결로 단순함
- ✅ 발주 상태 즉시 업데이트

**단점:**
- ❌ 복수 발주번호 불가
- ❌ 청구 → 발주 관계 미활용
- ❌ 청구서 기반 결제 추적 불가
- ❌ 일괄 결제 시나리오 불가

---

### 3.2. 제안 A: 청구번호 중심 (권장)

```
결제내역
  └─ 문서번호 (청구ID) ─────→ 청구DB
                              ├─ orderNumbers: ["GMP-001", "GMP-002", "GMP-003"]
                              │   └─→ 거래원장 (복수)
                              └─ settlementId → 마감DB → 거래원장 (복수)
```

**구현 방식:**
```javascript
// 1. 결제 추가 시
addPaymentRecord({
  docNumber: "INV-20251226-001",  // 청구ID (필수)
  // orderNumber 필드 제거 또는 자동 계산
})

// 2. 발주 상태 동기화
function syncOrderPaymentStatus(invoiceId, paymentType) {
  // 청구DB에서 orderNumbers 조회
  var invoice = getInvoiceDetail(invoiceId);
  var orderNumbers = JSON.parse(invoice.orderNumbers);

  // 각 발주번호별로 결제 합산 및 상태 업데이트
  orderNumbers.forEach(function(orderId) {
    calculateAndUpdatePaymentStatus(orderId, paymentType);
  });
}
```

**장점:**
- ✅ **복수 발주번호 자연스럽게 지원**
- ✅ 청구서 기반 결제 추적 가능
- ✅ 일괄 결제 시나리오 완벽 지원
- ✅ 마감 → 청구 → 결제 워크플로우 일관성
- ✅ 아키텍처 명세와 일치

**단점:**
- ⚠️ 청구서 없는 결제 불가 (해결: 임시 청구 자동생성)
- ⚠️ 기존 데이터 마이그레이션 필요

---

### 3.3. 제안 B: 하이브리드 (호환성 우선)

```
결제내역
  ├─ 문서번호 (청구ID) ────→ 청구DB (우선)
  │                          └─ orderNumbers → 거래원장 (복수)
  └─ 발주번호 (JSON 배열) ───→ 거래원장 (직접, 복수)
```

**구현 방식:**
```javascript
// 결제내역 시트 구조 변경
var headers = [
  '결제ID',
  // ...
  '문서번호',         // 청구ID (우선 사용)
  '발주번호',         // JSON 배열: ["GMP-001", "GMP-002"]
  // ...
];

// 동기화 로직
function syncOrderPaymentStatus(params) {
  // 1. 문서번호가 있으면 청구DB 경유
  if (params.docNumber) {
    var invoice = getInvoiceDetail(params.docNumber);
    var orderNumbers = JSON.parse(invoice.orderNumbers);
  }
  // 2. 없으면 발주번호 직접 사용
  else if (params.orderNumber) {
    var orderNumbers = JSON.parse(params.orderNumber);
  }

  // 각 발주번호 상태 업데이트
  orderNumbers.forEach(function(orderId) {
    updateSingleOrderStatus(orderId, params.type);
  });
}
```

**장점:**
- ✅ 기존 코드 호환성 유지
- ✅ 청구 없는 결제 가능
- ✅ 복수 발주번호 지원
- ✅ 점진적 마이그레이션 가능

**단점:**
- ⚠️ 두 가지 경로 유지 관리 복잡
- ⚠️ 데이터 불일치 가능성

---

## 4. 권장 개선안

### 4.1. 아키텍처 결정: **제안 A (청구번호 중심)** 채택

**이유:**
1. **아키텍처 명세 준수:** OneBridge_ERP_Architecture_v2.3.md 설계 의도와 일치
2. **복수 발주 자연 지원:** 청구DB.orderNumbers 활용
3. **워크플로우 일관성:** 발주 → 청구 → 결제 흐름 유지
4. **ERP 모범 사례:** 청구서 기반 결제가 회계 표준

**마이그레이션 전략:**
- 기존 발주번호 → 임시 청구서 자동 생성
- 문서번호 공란 레코드 → 일괄 변환 스크립트

---

### 4.2. 구현 단계

#### Phase 1: 발주번호 검색 기능 추가

**A. 백엔드 함수 (PaymentService.js)**
```javascript
/**
 * 발주번호 검색 (자동완성용)
 * @param {Object} params - { query, company (optional) }
 * @return {Object} { success, suggestions: [{ orderNumber, company, amount, date, status }] }
 */
function searchOrderNumbers(params) {
  try {
    if (!params.query || params.query.length < 3) {
      return { success: true, suggestions: [] };
    }

    var query = String(params.query).toUpperCase();
    var ss = SpreadsheetApp.openById(ORDER_MERGED_SHEET_ID);
    var sheet = ss.getSheetByName('거래원장');
    var data = sheet.getDataRange().getValues();
    var header = data[0];

    var col = function(name) { return header.indexOf(name); };
    var suggestions = [];
    var seen = {};  // 중복 제거용

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var orderNumber = String(row[col('발주번호')] || '');

      if (orderNumber.toUpperCase().indexOf(query) !== -1 && !seen[orderNumber]) {
        var company = row[col('발주처')] || row[col('매입처')];

        // company 필터 (선택)
        if (params.company && company.indexOf(params.company) === -1) {
          continue;
        }

        suggestions.push({
          orderNumber: orderNumber,
          company: company,
          amount: Number(row[col('확정금액')]) || 0,
          date: formatDateString(row[col('발주일')]),
          payBuyStatus: row[col('매입결제')] || '미결제',
          paySellStatus: row[col('매출결제')] || '미결제'
        });

        seen[orderNumber] = true;

        if (suggestions.length >= 10) break;
      }
    }

    return { success: true, suggestions: suggestions };

  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

**B. API 래퍼 (ApiService.js)**
```javascript
function searchOrderNumbersApi(params) {
  var result = searchOrderNumbers(params);
  return safeReturn(result);
}
```

---

#### Phase 2: 청구서 기반 복수 발주 UI

**A. 입출금 폼 수정 (Page_PaymentManagement.html)**
```html
<!-- 기존 발주번호 필드 제거 -->
<!-- <input id="payment-order-number" /> -->

<!-- 새로운 청구서 검색 필드 -->
<div class="form-group">
  <label>청구서 번호 *</label>
  <div style="position:relative;">
    <input type="text" id="payment-doc-number" placeholder="INV- 또는 BL-로 시작하는 청구ID" />
    <div id="doc-autocomplete" class="autocomplete-dropdown"></div>
  </div>
  <div id="selected-invoice-info" style="margin-top:8px; display:none;">
    <div style="font-size:12px; color:#059669;">
      <strong>선택된 청구서:</strong> <span id="invoice-id-display"></span><br>
      <strong>연결 발주:</strong> <span id="invoice-orders-display"></span><br>
      <strong>청구 금액:</strong> <span id="invoice-amount-display"></span>원
    </div>
  </div>
</div>

<!-- 또는: 발주 직접 선택 UI (청구서 없는 경우) -->
<div class="form-group">
  <label>발주 직접 선택 <small>(청구서 없는 경우)</small></label>
  <button type="button" id="select-orders-btn" class="payment-btn secondary">발주 선택</button>
  <div id="selected-orders-list"></div>
</div>
```

**B. 발주 선택 모달 (CommonScripts.html)**
```javascript
function openOrderSelectionModal() {
  var html = '<div class="modal-overlay" id="order-selection-modal">' +
    '<div class="modal-content" style="width:700px;">' +
      '<h3>발주 선택</h3>' +
      '<input type="text" id="order-search-input" placeholder="발주번호 또는 거래처명 검색" />' +
      '<div id="order-search-results" style="max-height:400px; overflow-y:auto;">' +
        '<!-- 검색 결과 테이블 -->' +
      '</div>' +
      '<div style="margin-top:16px; padding:12px; background:#f3f4f6; border-radius:6px;">' +
        '<strong>선택된 발주:</strong> <span id="selected-count">0</span>건<br>' +
        '<strong>합계 금액:</strong> <span id="selected-total">0</span>원' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button onclick="confirmOrderSelection()" class="payment-btn primary">선택 완료</button>' +
        '<button onclick="closeOrderSelectionModal()" class="payment-btn secondary">취소</button>' +
      '</div>' +
    '</div>' +
  '</div>';

  document.body.insertAdjacentHTML('beforeend', html);

  // 검색 입력 이벤트
  document.getElementById('order-search-input').addEventListener('input', function(e) {
    searchOrdersForSelection(e.target.value);
  });
}

function searchOrdersForSelection(query) {
  if (query.length < 3) return;

  google.script.run
    .withSuccessHandler(function(result) {
      if (result.success) {
        renderOrderSearchResults(result.suggestions);
      }
    })
    .searchOrderNumbersApi({ query: query });
}

function renderOrderSearchResults(orders) {
  var html = '<table class="payment-table">' +
    '<thead><tr>' +
      '<th width="40"><input type="checkbox" id="select-all-orders" /></th>' +
      '<th>발주번호</th>' +
      '<th>거래처</th>' +
      '<th>발주일</th>' +
      '<th>금액</th>' +
      '<th>결제상태</th>' +
    '</tr></thead><tbody>';

  orders.forEach(function(order) {
    html += '<tr>' +
      '<td><input type="checkbox" class="order-checkbox" data-order="' +
        encodeURIComponent(JSON.stringify(order)) + '" /></td>' +
      '<td>' + order.orderNumber + '</td>' +
      '<td>' + order.company + '</td>' +
      '<td>' + order.date + '</td>' +
      '<td>' + order.amount.toLocaleString() + '원</td>' +
      '<td><span class="status-badge">' + order.paySellStatus + '</span></td>' +
    '</tr>';
  });

  html += '</tbody></table>';
  document.getElementById('order-search-results').innerHTML = html;

  // 체크박스 이벤트
  document.querySelectorAll('.order-checkbox').forEach(function(cb) {
    cb.addEventListener('change', updateOrderSelection);
  });
}

function updateOrderSelection() {
  var selectedOrders = [];
  var totalAmount = 0;

  document.querySelectorAll('.order-checkbox:checked').forEach(function(cb) {
    var order = JSON.parse(decodeURIComponent(cb.dataset.order));
    selectedOrders.push(order);
    totalAmount += order.amount;
  });

  document.getElementById('selected-count').textContent = selectedOrders.length;
  document.getElementById('selected-total').textContent = totalAmount.toLocaleString();
}

function confirmOrderSelection() {
  var selectedOrders = [];

  document.querySelectorAll('.order-checkbox:checked').forEach(function(cb) {
    var order = JSON.parse(decodeURIComponent(cb.dataset.order));
    selectedOrders.push(order);
  });

  if (selectedOrders.length === 0) {
    alert('발주를 선택해주세요.');
    return;
  }

  // 선택된 발주 정보를 폼에 표시
  displaySelectedOrders(selectedOrders);

  // 모달 닫기
  closeOrderSelectionModal();
}
```

---

#### Phase 3: 결제내역 시트 구조 변경

**A. 컬럼 수정**
```javascript
// SetupPaymentSheets.js - createPaymentSheet() 수정
var headers = [
  '결제ID',
  '결제일',
  '결제유형',
  '거래처명',
  '금액',
  '결제수단',
  '문서번호',        // 청구ID (필수로 변경)
  '연결발주목록',     // NEW: JSON 배열 ["GMP-001", "GMP-002"]
  '비고',
  '삭제여부',
  '삭제일시',
  '삭제자',
  '입력일시',
  '입력자'
];
```

**B. 데이터 저장 로직 수정**
```javascript
// PaymentService.js - addPaymentRecord() 수정
function addPaymentRecord(params) {
  // ...기존 검증...

  // 청구서 정보 조회
  var invoice = null;
  var orderNumbers = [];

  if (params.docNumber) {
    invoice = getInvoiceDetail(params.docNumber);
    if (invoice.success) {
      orderNumbers = JSON.parse(invoice.orderNumbers || '[]');
    }
  } else if (params.orderNumbers) {
    // 직접 발주 선택한 경우
    orderNumbers = params.orderNumbers;  // 배열로 전달받음
  }

  var rowData = [
    paymentId,
    paymentDate,
    params.type,
    params.company,
    amount,
    params.method,
    params.docNumber || '',
    JSON.stringify(orderNumbers),  // JSON 배열로 저장
    params.notes || '',
    false,
    '',
    '',
    now,
    user
  ];

  // 저장...

  // 발주 상태 동기화 (복수 처리)
  orderNumbers.forEach(function(orderId) {
    var syncResult = syncOrderPaymentStatus(orderId, params.type);
    if (!syncResult.success) {
      Logger.log('[addPaymentRecord] ⚠️ 발주 동기화 실패: ' + orderId);
    }
  });

  return {
    success: true,
    paymentId: paymentId,
    linkedOrders: orderNumbers.length,
    message: '입출금 기록이 추가되었습니다.'
  };
}
```

---

#### Phase 4: 금액 검증 및 경고

```javascript
function validatePaymentAmount(selectedOrders, inputAmount) {
  var totalOrderAmount = 0;

  selectedOrders.forEach(function(order) {
    totalOrderAmount += order.amount;
  });

  var diff = inputAmount - totalOrderAmount;

  if (diff === 0) {
    return {
      valid: true,
      message: '✅ 금액이 정확히 일치합니다.',
      type: 'success'
    };
  } else if (diff > 0) {
    return {
      valid: true,
      message: '⚠️ 입금액이 ' + diff.toLocaleString() + '원 많습니다. 초과 입금으로 처리됩니다.',
      type: 'warning'
    };
  } else {
    return {
      valid: true,
      message: '⚠️ 입금액이 ' + Math.abs(diff).toLocaleString() + '원 부족합니다. 부분결제로 처리됩니다.',
      type: 'warning'
    };
  }
}
```

---

#### Phase 5: 발주번호 수정 권한 조정

```javascript
// CommonScripts.html - editPayment() 수정
function editPayment(paymentId) {
  // ...기존 코드...

  // 발주번호 수정 로직 변경
  var currentOrders = JSON.parse(original.orderNumbers || '[]');

  if (currentOrders.length === 0) {
    // 공란인 경우: 추가 가능
    cells[7].innerHTML = '<button onclick="selectOrdersForEdit(\'' + paymentId + '\')" class="payment-btn secondary">발주 선택</button>';
  } else {
    // 이미 연결된 경우: 표시만 (변경 불가)
    cells[7].innerHTML = '<span style="color:#059669;">' +
      currentOrders.join(', ') + ' (수정불가)</span>';
  }
}
```

---

## 5. 마이그레이션 계획

### 5.1. 기존 데이터 변환

```javascript
/**
 * 기존 결제내역 데이터 마이그레이션
 * - 발주번호 (단일) → 연결발주목록 (배열)
 */
function migratePaymentData() {
  var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
  var sheet = ss.getSheetByName('결제내역');
  var data = sheet.getDataRange().getValues();
  var header = data[0];

  var col = function(name) { return header.indexOf(name); };
  var cOrderNumber = col('발주번호');
  var cOrderList = col('연결발주목록');  // 새 컬럼

  for (var i = 1; i < data.length; i++) {
    var oldOrderNumber = data[i][cOrderNumber];

    if (oldOrderNumber && oldOrderNumber !== '') {
      // 단일 발주번호 → JSON 배열로 변환
      var orderList = JSON.stringify([oldOrderNumber]);
      sheet.getRange(i + 1, cOrderList + 1).setValue(orderList);
    } else {
      // 빈 값 → 빈 배열
      sheet.getRange(i + 1, cOrderList + 1).setValue('[]');
    }
  }

  Logger.log('[migratePaymentData] 마이그레이션 완료: ' + (data.length - 1) + '건');
}
```

---

## 6. 구현 우선순위

### 🔴 Priority 1 (즉시 필요)
1. **발주번호 검색 함수** (`searchOrderNumbers()`)
2. **발주번호 자동완성 UI** (입력 폼)
3. **발주번호 추가 가능하도록 수정** (editPayment 수정)

### 🟡 Priority 2 (1주 내)
4. **발주 선택 모달** (복수 선택 UI)
5. **금액 검증 및 경고**
6. **연결발주목록 컬럼 추가**

### 🟢 Priority 3 (2주 내)
7. **청구서 기반 자동 발주 연결**
8. **기존 데이터 마이그레이션**
9. **통합 테스트**

---

## 7. 예상 효과

### Before (현재)
```
사용자: "A업체 500만원 입금됐어"
→ 거래처명, 금액 입력
→ 발주번호? (모름, 공란)
→ 저장
→ 나중에 수정? (불가능)
→ 발주 상태 미동기화
```

### After (개선 후)
```
사용자: "A업체 500만원 입금됐어"
→ 거래처명, 금액 입력
→ [발주 선택] 버튼 클릭
→ "A업체" 검색 → 3건 표시
   ☑ GMP-001: 2,000,000원
   ☑ GMP-002: 1,500,000원
   ☑ GMP-003: 1,000,000원
   ━━━━━━━━━━━━━━━━━━━━━━
   합계: 4,500,000원
→ ⚠️ 입금액(5,000,000원) vs 발주합계(4,500,000원)
   "500,000원 초과 입금입니다"
→ 확인 후 저장
→ 3건 발주 상태 자동 업데이트
```

---

## 8. 결론

**사용자 지적사항 6가지 모두 타당함.**

**핵심 문제:**
1. 발주번호 검색 기능 부재
2. 복수 발주번호 미지원 (구조적 한계)
3. 청구서 → 발주 연결 미활용
4. 발주번호 추가 불가 (UI 제약)

**권장 솔루션:**
- **아키텍처:** 청구번호 중심 (제안 A)
- **구현:** 3단계 점진적 개선
  1. 발주 검색/자동완성
  2. 복수 발주 선택 UI
  3. 청구 기반 자동 연결

**개발 기간:** 약 2주 (우선순위 1-2 기준)

---

**다음 단계:**
위 분석 내용 검토 후 개선안 승인 시 즉시 개발 착수 가능합니다.
