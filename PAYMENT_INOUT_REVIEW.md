# 입금/출금 양방향 프로세스 검토

**작성일:** 2025-12-26
**목적:** 결제 관리 리뉴얼이 입금/출금 양쪽에 모두 적합한지 검증

---

## 🔍 핵심 차이점 분석

### 입금 (Income) vs 출금 (Expense)

| 구분 | 입금 | 출금 |
|------|------|------|
| **의미** | 고객사가 우리에게 돈을 줌 | 우리가 공급사에게 돈을 줌 |
| **거래처** | 발주처 (고객사) | 매입처 (공급사) |
| **청구서 타입** | SALES | PURCHASE |
| **발주 상태** | 매출결제 | 매입결제 |
| **데이터 흐름** | 고객사 → 우리 | 우리 → 공급사 |

---

## 📊 실무 시나리오 비교

### Case 1: 입금 (매출결제)

**프로세스:**
```
1. 발주 생성
   - 발주처: 고객사A
   - 매입처: 공급사B
   - 확정금액: 4,500,000원

2. 청구서 발행
   - 청구ID: INV-20251226-001
   - 청구유형: SALES
   - 업체명: 고객사A (발주처)
   - orderNumbers: ["GMP-001", "GMP-002", "GMP-003"]

3. 입금 발생
   - 고객사A → 우리
   - 금액: 4,500,000원

4. 결제 입력
   - 결제유형: 입금
   - 거래처명: 고객사A
   - 청구서: INV-20251226-001
   - 금액: 4,500,000원

5. 발주 상태 업데이트
   - 매출결제: 결제완료
```

**거래원장 데이터:**
```
발주번호: GMP-001
발주처: 고객사A  ← 이 업체가 청구 대상
매입처: 공급사B
매출결제: 미결제 → 결제완료  ← 이 상태 업데이트
매입결제: 미결제
```

---

### Case 2: 출금 (매입결제)

**프로세스:**
```
1. 발주 생성
   - 발주처: 고객사A
   - 매입처: 공급사B
   - 확정금액: 4,500,000원

2. 청구서 발행
   - 청구ID: INV-20251226-002
   - 청구유형: PURCHASE
   - 업체명: 공급사B (매입처)  ← 입금과 다른 업체!
   - orderNumbers: ["GMP-001", "GMP-002", "GMP-003"]

3. 출금 발생
   - 우리 → 공급사B
   - 금액: 4,500,000원

4. 결제 입력
   - 결제유형: 출금
   - 거래처명: 공급사B
   - 청구서: INV-20251226-002
   - 금액: 4,500,000원

5. 발주 상태 업데이트
   - 매입결제: 결제완료  ← 이 상태 업데이트
```

**거래원장 데이터:**
```
발주번호: GMP-001
발주처: 고객사A
매입처: 공급사B  ← 이 업체가 청구 대상
매출결제: 미결제
매입결제: 미결제 → 결제완료  ← 이 상태 업데이트
```

---

## 🚨 발견된 문제점

### 문제 1: 청구서 타입 필터링 누락

**현재 설계:**
```javascript
// Step 1: 청구서 검색
function searchInvoices(params) {
  var query = params.query;
  // ❌ type 필터링 없음
  // 입금 입력 시 PURCHASE 청구서도 검색됨
  // 출금 입력 시 SALES 청구서도 검색됨
}
```

**문제 시나리오:**
```
사용자: "공급사B에 300만원 출금했어"
→ [신규 결제 입력] 클릭
→ "공급사B" 검색
→ 결과:
   ❌ INV-001 (SALES, 고객사A)  ← 매출 청구서
   ✅ INV-002 (PURCHASE, 공급사B)  ← 매입 청구서
   ❌ INV-003 (SALES, 고객사A)

→ 잘못된 청구서 선택 가능성
```

**해결책:**
```javascript
function searchInvoices(params) {
  var query = params.query;
  var paymentType = params.paymentType;  // NEW: '입금' or '출금'

  // 결제유형에 따라 청구서 타입 필터링
  var invoiceType = paymentType === '입금' ? 'SALES' : 'PURCHASE';

  for (var i = 0; i < data.length; i++) {
    var invoice = data[i];

    // ✅ 타입 필터 추가
    if (invoice.type !== invoiceType) {
      continue;
    }

    // 검색 조건 매칭...
  }
}
```

---

### 문제 2: 거래처 필드 혼란

**청구DB 구조:**
```
청구ID: INV-001
청구유형: SALES
업체명: 고객사A  ← "업체명" 필드
```

```
청구ID: INV-002
청구유형: PURCHASE
업체명: 공급사B  ← 같은 "업체명" 필드인데 의미가 다름
```

**현재 UI 설계:**
```
검색 결과:
거래처: 고객사A  ← "거래처"라는 표현이 애매함
```

**개선안:**
```
입금 (SALES) 청구서 검색 결과:
고객사: 고객사A  ← 명확함
브랜드: 브랜드A, 브랜드B

출금 (PURCHASE) 청구서 검색 결과:
공급사: 공급사B  ← 명확함
브랜드: 브랜드C, 브랜드D
```

---

### 문제 3: 임시 청구서 생성 시 타입 구분

**현재 설계:**
```javascript
function createTempInvoice(params) {
  var invoiceData = {
    invoiceId: 'INV-TEMP-XXX',
    billingType: 'DIRECT',
    company: params.company,
    type: params.type,  // ❓ 어떻게 결정?
    amount: params.amount
  };
}
```

**필요:**
```javascript
// 모달에서 결제유형 먼저 선택 → 청구서 타입 자동 결정
function openPaymentModal() {
  // Step 0: 결제유형 선택 (입금/출금)
  // Step 1: 청구서 검색 (타입 필터 적용)
  // ...
}
```

---

### 문제 4: 브랜드 정보 표시

**거래원장 구조:**
```
발주번호: GMP-001
발주처: 고객사A
매입처: 공급사B
브랜드: 브랜드A
```

**입금 청구서 (SALES):**
- 발주처(고객사A)에게 청구
- 브랜드 표시: OK (어떤 브랜드 판매했는지)

**출금 청구서 (PURCHASE):**
- 매입처(공급사B)에게 지불
- 브랜드 표시: OK (어떤 브랜드 구매했는지)

**결론:** 양쪽 다 브랜드 표시 필요 ✅

---

### 문제 5: 발주 상태 동기화

**현재 로직:**
```javascript
// PaymentService.js:120-126
if (params.orderNumber && params.orderNumber !== '') {
  var syncResult = syncOrderPaymentStatus(params.orderNumber, params.type);
  // params.type = '입금' or '출금'
}

function syncOrderPaymentStatus(orderNumber, paymentType) {
  var status = calculatePaymentStatus(orderNumber, paymentType);
  var statusKey = paymentType === '입금' ? 'paySell' : 'payBuy';
  // ✅ 올바른 매핑
}
```

**검증:** 정상 동작 ✅

---

## ✅ 수정 사항 정리

### 1. 결제유형 선택 우선 (Step 0 추가)

**Before (3단계):**
```
Step 1: 청구서 검색
Step 2: 청구서 세부 확인
Step 3: 결제 정보 입력
```

**After (4단계):**
```
Step 1: 결제유형 선택 (입금/출금)  ← NEW
Step 2: 청구서 검색 (타입 필터 적용)
Step 3: 청구서 세부 확인
Step 4: 결제 정보 입력
```

---

### 2. Step 1: 결제유형 선택 UI

```
┌─────────────────────────────────────────────────────────┐
│  💰 신규 입출금 기록 추가                         ✕      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Step 1/4] 결제 유형 선택                              │
│                                                         │
│  어떤 유형의 결제를 입력하시겠습니까?                    │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │                                                   │ │
│  │  ┌─────────────────────┐  ┌─────────────────────┐│ │
│  │  │  💰 입금             │  │  💸 출금             ││ │
│  │  │                     │  │                     ││ │
│  │  │  고객사로부터       │  │  공급사에게         ││ │
│  │  │  받은 금액          │  │  지불한 금액        ││ │
│  │  │                     │  │                     ││ │
│  │  │  (매출결제)         │  │  (매입결제)         ││ │
│  │  │                     │  │                     ││ │
│  │  │  [선택]             │  │  [선택]             ││ │
│  │  └─────────────────────┘  └─────────────────────┘│ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│                                            [취소]       │
└─────────────────────────────────────────────────────────┘
```

---

### 3. Step 2: 청구서 검색 (타입 필터 적용)

**입금 선택 시:**
```
┌─────────────────────────────────────────────────────────┐
│  💰 신규 입출금 기록 추가 - 입금                  ✕      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Step 2/4] 청구서 선택                                 │
│                                                         │
│  💡 고객사에게 발행한 청구서를 검색합니다.               │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ 🔍 청구서 번호 또는 고객사명 검색                 │ │
│  │ [INV-20251226        ]  [검색]                    │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  검색 결과: (매출 청구서만 표시)                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ○ INV-20251226-001 (SALES)                        │ │
│  │   고객사: 고객사A │ 브랜드: 브랜드A, B             │ │
│  │   청구일: 2025-12-26 │ 금액: 4,500,000원          │ │
│  │   상태: ISSUED │ 발주 3건                          │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  [📄 청구서 없음 (임시 생성)]                           │
│                                                         │
│                         [← 이전]      [다음 단계 →]    │
└─────────────────────────────────────────────────────────┘
```

**출금 선택 시:**
```
┌─────────────────────────────────────────────────────────┐
│  💸 신규 입출금 기록 추가 - 출금                  ✕      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Step 2/4] 청구서 선택                                 │
│                                                         │
│  💡 공급사로부터 받은 청구서를 검색합니다.               │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ 🔍 청구서 번호 또는 공급사명 검색                 │ │
│  │ [INV-20251226        ]  [검색]                    │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  검색 결과: (매입 청구서만 표시)                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ○ INV-20251226-002 (PURCHASE)                     │ │
│  │   공급사: 공급사B │ 브랜드: 브랜드C, D             │ │
│  │   청구일: 2025-12-26 │ 금액: 3,200,000원          │ │
│  │   상태: ISSUED │ 발주 2건                          │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  [📄 청구서 없음 (임시 생성)]                           │
│                                                         │
│                         [← 이전]      [다음 단계 →]    │
└─────────────────────────────────────────────────────────┘
```

---

### 4. 임시 청구서 생성 모달 (타입 자동 설정)

**입금 선택 시:**
```
┌─────────────────────────────────────────────────────────┐
│  📄 임시 청구서 생성 - 매출 (입금)               ✕      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  💡 고객사에게 발행할 임시 청구서를 생성합니다.         │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ 고객사명:   [                ]  *                 │ │
│  │ 청구일:     [2025-12-26      ]  * 📅             │ │
│  │ 청구금액:   [                ]  * 원             │ │
│  │ 비고:       [임시 생성 (정식 청구서 발행 예정)]   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  자동 설정:                                             │
│  - 청구유형: SALES (매출)                               │
│  - 상태: DRAFT                                          │
│                                                         │
│                         [취소]      [📄 생성 후 계속]  │
└─────────────────────────────────────────────────────────┘
```

**출금 선택 시:**
```
┌─────────────────────────────────────────────────────────┐
│  📄 임시 청구서 생성 - 매입 (출금)               ✕      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  💡 공급사로부터 받은 임시 청구서를 생성합니다.         │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ 공급사명:   [                ]  *                 │ │
│  │ 청구일:     [2025-12-26      ]  * 📅             │ │
│  │ 청구금액:   [                ]  * 원             │ │
│  │ 비고:       [임시 생성 (정식 청구서 발행 예정)]   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  자동 설정:                                             │
│  - 청구유형: PURCHASE (매입)                            │
│  - 상태: DRAFT                                          │
│                                                         │
│                         [취소]      [📄 생성 후 계속]  │
└─────────────────────────────────────────────────────────┘
```

---

### 5. 백엔드 함수 수정

**searchInvoices() 수정:**
```javascript
/**
 * 청구서 검색 (결제유형별 필터링)
 * @param {Object} params - { query, paymentType }
 * @return {Object} { success, invoices: [...] }
 */
function searchInvoices(params) {
  try {
    var query = String(params.query || '').toUpperCase();
    var paymentType = params.paymentType;  // NEW: '입금' or '출금'

    if (!paymentType) {
      return {
        success: false,
        error: '결제유형을 선택해주세요.'
      };
    }

    // 결제유형에 따라 청구서 타입 결정
    var invoiceType = paymentType === '입금' ? 'SALES' : 'PURCHASE';

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName('청구DB');
    var data = sheet.getDataRange().getValues();
    var header = data[0];

    var col = function(name) { return header.indexOf(name); };
    var cInvoiceId = col('청구ID');
    var cType = col('청구유형');
    var cCompany = col('업체명');
    var cDate = col('청구일');
    var cAmount = col('청구금액');
    var cStatus = col('청구상태');
    var cOrderNumbers = col('orderNumbers');  // JSON 배열

    var invoices = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      // ✅ 청구서 타입 필터링
      if (row[cType] !== invoiceType) {
        continue;
      }

      // CANCELLED 제외
      if (row[cStatus] === 'CANCELLED') {
        continue;
      }

      // 검색어 매칭
      var invoiceId = String(row[cInvoiceId] || '');
      var company = String(row[cCompany] || '');

      if (query.length >= 3 &&
          invoiceId.toUpperCase().indexOf(query) === -1 &&
          company.toUpperCase().indexOf(query) === -1) {
        continue;
      }

      // orderNumbers에서 브랜드 목록 조회
      var orderNumbers = JSON.parse(row[cOrderNumbers] || '[]');
      var brands = getUniqueBrands(orderNumbers);

      invoices.push({
        invoiceId: invoiceId,
        type: row[cType],
        company: company,
        brands: brands.join(', '),
        date: formatDateString(row[cDate]),
        amount: Number(row[cAmount]) || 0,
        status: row[cStatus],
        orderCount: orderNumbers.length
      });

      if (invoices.length >= 10) break;
    }

    return {
      success: true,
      invoices: invoices
    };

  } catch (error) {
    return {
      success: false,
      error: '청구서 검색 중 오류: ' + error.message
    };
  }
}

/**
 * 발주번호 목록에서 고유 브랜드 추출
 */
function getUniqueBrands(orderNumbers) {
  var brands = [];
  var seen = {};

  var ss = SpreadsheetApp.openById(ORDER_MERGED_SHEET_ID);
  var sheet = ss.getSheetByName('거래원장');
  var data = sheet.getDataRange().getValues();
  var header = data[0];

  var colOrderNumber = header.indexOf('발주번호');
  var colBrand = header.indexOf('브랜드');

  orderNumbers.forEach(function(orderId) {
    for (var i = 1; i < data.length; i++) {
      if (data[i][colOrderNumber] === orderId) {
        var brand = data[i][colBrand] || '';
        if (brand && !seen[brand]) {
          brands.push(brand);
          seen[brand] = true;
        }
      }
    }
  });

  return brands;
}
```

**createTempInvoice() 수정:**
```javascript
/**
 * 임시 청구서 생성
 * @param {Object} params - { company, paymentType, amount, date }
 * @return {Object} { success, invoiceId }
 */
function createTempInvoice(params) {
  try {
    var company = params.company || '';
    var paymentType = params.paymentType;  // '입금' or '출금'
    var amount = params.amount || 0;
    var date = params.date || new Date();

    if (!company || !paymentType || !amount) {
      return {
        success: false,
        error: '필수 정보를 입력해주세요.'
      };
    }

    // ✅ 결제유형에 따라 청구서 타입 자동 결정
    var invoiceType = paymentType === '입금' ? 'SALES' : 'PURCHASE';

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName('청구DB');

    if (!sheet) {
      return {
        success: false,
        error: '청구DB 시트를 찾을 수 없습니다.'
      };
    }

    // 임시 청구서 ID 생성
    var now = new Date();
    var dateStr = formatDate(now, 'YYYYMMDD');
    var data = sheet.getDataRange().getValues();
    var seq = 1;

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].startsWith('INV-TEMP-' + dateStr)) {
        seq++;
      }
    }

    var invoiceId = 'INV-TEMP-' + dateStr + '-' + String(seq).padStart(3, '0');

    var user = Session.getActiveUser().getEmail();

    var rowData = [
      invoiceId,
      'DIRECT',  // billingType
      '[]',      // orderNumbers (빈 배열)
      '',        // settlementId
      company,
      invoiceType,  // ✅ SALES or PURCHASE
      amount,
      date,
      'DRAFT',   // status
      '임시 생성 (정식 청구서 발행 예정)',
      now,
      user,
      '',
      '',
      ''
    ];

    // 청구DB 헤더 확인 후 저장
    sheet.appendRow(rowData);

    Logger.log('[createTempInvoice] 임시 청구서 생성: ' + invoiceId + ' (' + invoiceType + ')');

    return {
      success: true,
      invoiceId: invoiceId,
      invoiceType: invoiceType,
      message: '임시 청구서가 생성되었습니다.'
    };

  } catch (error) {
    return {
      success: false,
      error: '임시 청구서 생성 중 오류: ' + error.message
    };
  }
}
```

---

## ✅ 검증 결과

### 입금 시나리오 (SALES)

```
✅ Step 1: 결제유형 선택 → 입금
✅ Step 2: 청구서 검색 (SALES만 필터링)
   - 고객사명으로 검색
   - SALES 청구서만 표시
   - 브랜드 정보 표시
✅ Step 3: 청구서 세부 확인
   - 발주 목록 (브랜드 단위)
   - 합계 금액
✅ Step 4: 결제 정보 입력
   - 결제유형: 입금 (자동 설정)
   - 금액 검증
✅ 발주 상태 업데이트
   - 매출결제: 결제완료
```

---

### 출금 시나리오 (PURCHASE)

```
✅ Step 1: 결제유형 선택 → 출금
✅ Step 2: 청구서 검색 (PURCHASE만 필터링)
   - 공급사명으로 검색
   - PURCHASE 청구서만 표시
   - 브랜드 정보 표시
✅ Step 3: 청구서 세부 확인
   - 발주 목록 (브랜드 단위)
   - 합계 금액
✅ Step 4: 결제 정보 입력
   - 결제유형: 출금 (자동 설정)
   - 금액 검증
✅ 발주 상태 업데이트
   - 매입결제: 결제완료
```

---

## 📊 비교 테이블

| 단계 | 입금 (SALES) | 출금 (PURCHASE) | 공통 |
|------|-------------|----------------|------|
| **Step 1** | "💰 입금" 선택 | "💸 출금" 선택 | 결제유형 선택 |
| **Step 2** | SALES 청구서만 검색 | PURCHASE 청구서만 검색 | 청구서 검색 |
| **거래처** | 고객사 | 공급사 | 업체명 |
| **브랜드** | 판매 브랜드 | 구매 브랜드 | 브랜드 표시 |
| **임시 청구서** | type: 'SALES' | type: 'PURCHASE' | DRAFT 상태 |
| **발주 상태** | 매출결제 업데이트 | 매입결제 업데이트 | 상태 동기화 |

---

## 🎯 최종 확정 사항

### 변경된 설계

1. **모달 단계: 3단계 → 4단계**
   ```
   Step 1: 결제유형 선택 (입금/출금) ← NEW
   Step 2: 청구서 검색 (타입 필터)
   Step 3: 청구서 세부 확인
   Step 4: 결제 정보 입력
   ```

2. **청구서 검색 필터링**
   - 입금 선택: SALES 청구서만
   - 출금 선택: PURCHASE 청구서만
   - 거래처명: 고객사/공급사 자동 구분

3. **임시 청구서 생성**
   - 입금: type = 'SALES'
   - 출금: type = 'PURCHASE'
   - 자동 타입 설정

4. **UI 문구 조정**
   - 입금: "고객사", "매출 청구서"
   - 출금: "공급사", "매입 청구서"

---

## 🚀 개발 영향 분석

### 추가 개발 필요

1. **Step 1 UI 추가 (결제유형 선택)** - +0.5일
2. **searchInvoices() 타입 필터 추가** - +0.5일
3. **createTempInvoice() 타입 자동 설정** - +0.2일
4. **UI 문구 동적 변경** - +0.3일

**총 추가 일정:** +1.5일

**최종 개발 기간:** 8일 + 1.5일 = **9.5일**

---

## ✅ 결론

**입금/출금 양방향 모두 지원 가능합니다!**

**핵심 수정사항:**
1. ✅ Step 1: 결제유형 선택 단계 추가
2. ✅ 청구서 검색 시 타입 필터링
3. ✅ 임시 청구서 타입 자동 설정
4. ✅ UI 문구 동적 변경 (고객사/공급사)
5. ✅ 브랜드 정보 양쪽 다 표시

**변경 없이 유지:**
- ✅ 브랜드 단위 표시 (품목 세부 제외)
- ✅ 금액 검증 로직
- ✅ 발주 상태 동기화 (기존 로직 그대로)
- ✅ 모달 크기 (700px)
- ✅ DRAFT 청구서 허용 (경고만)

**개발 준비 완료!**
