# 결제 관리 시스템 통합 분석 및 개선 방안

## 📋 문서 개요

**작성일:** 2025-01-15
**버전:** 1.0
**목적:** 결제 관리 리뉴얼 후 타 시스템 연동 이슈 분석 및 해결 방안 수립

---

## 🔍 발견된 문제점

### 문제 1: 결제 저장 후 거래원장 상태 미업데이트

**현상:**
- 결제관리 페이지에서 신규 결제 데이터 입력 및 저장 완료
- 결제내역 시트에는 정상 저장됨
- **하지만** 연결된 거래원장의 '매입결제' 또는 '매출결제' 컬럼이 업데이트되지 않음

**영향:**
- 거래원장에서 결제 상태를 확인할 수 없음
- 발주 진행 상태 이모지가 정확하지 않음
- 매입/매출 결제 현황 리포트가 부정확함

**원인 분석:**
```javascript
// PaymentService.js - addPaymentRecord()
// 현재 구현: 결제내역 시트에만 저장
function addPaymentRecord(params) {
  // ...
  sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);
  // ❌ 거래원장 업데이트 로직 없음
  return { success: true, paymentId: paymentId };
}
```

**필요한 추가 로직:**
1. docNumber(청구서ID)에서 연결된 orderNumbers 조회
2. 각 발주번호에 대해 거래원장 시트에서 해당 행 찾기
3. 결제유형에 따라 '매입결제' 또는 '매출결제' 컬럼 업데이트
   - 입금 → '매출결제' 컬럼 업데이트
   - 출금 → '매입결제' 컬럼 업데이트

---

### 문제 2: 청구유형 값 불일치

**현상:**
- 거래원장에서 청구서 생성 시: 청구유형 = `"매출"` 또는 `"매입"`
- 결제관리 페이지에서 기대하는 값: `"SALES"` 또는 `"PURCHASE"`
- **결과:** 청구서 검색 시 결과 없음 또는 잘못된 결과 반환

**코드 분석:**

**청구서 생성 (거래원장 페이지):**
```javascript
// CommonScripts.html (Line 1144)
// InvoiceOutput 페이지에서 청구서 생성 시
var params = {
  settlementId: '',
  type: 'SALES',  // ✅ 하드코딩: SALES
  company: billingState.company,
  // ...
};
google.script.run.createBillingApi(params);
```

**청구서 저장 (SettlementService.js):**
```javascript
// SettlementService.js (Line 806-808)
function createBilling(params) {
  // ...
  var rowData = [
    billingId,
    type,  // ⚠️ params.type을 그대로 저장
    company,
    // ...
  ];
  sheet.appendRow(rowData);
}
```

**청구서 검색 (PaymentService.js):**
```javascript
// PaymentService.js (Line 1518-1519)
function searchInvoices(params) {
  var paymentType = params.paymentType;  // '입금' or '출금'
  var invoiceType = paymentType === '입금' ? 'SALES' : 'PURCHASE';

  // Line 1557-1559
  // 청구서 타입 필터링
  if (row[cType] !== invoiceType) {
    continue;  // ❌ "매출" !== "SALES" → 스킵됨
  }
}
```

**문제점:**
- 거래원장에서 생성된 청구서는 `type: 'SALES'`로 저장 (하드코딩)
- **그러나** 다른 곳에서 생성된 청구서는 `"매출"` 또는 `"매입"`으로 저장될 가능성
- 또는 기존 청구서 데이터가 한글로 저장되어 있을 가능성

**현재 청구DB 데이터 확인 필요:**
- 실제 청구DB 시트의 '청구유형' 컬럼에 어떤 값이 저장되어 있는지 확인
- `"매출"`, `"매입"`, `"SALES"`, `"PURCHASE"` 중 어느 것?

---

### 문제 3: 발주 정보 0건 표시

**현상:**
- 청구서 검색 결과에 청구서 정보는 표시됨 (청구일, 금액 정확)
- **하지만** "발주: 0건"으로 표시됨
- Step 3 청구서 상세에서도 발주 목록이 비어있음

**스크린샷 분석:**
```
INV-20251216-001
고객사: 미미라인 명동점
브랜드: 없음
청구일: 2025-12-16 | 금액: 302,800원
발주: 0건  ← ❌ 문제
```

**원인 분석 1: orderNumbers 필드가 비어있음**
```javascript
// PaymentService.js - searchInvoices()
// Line 1576-1578
var orderNumbers = JSON.parse(row[cOrderNumbers] || '[]');
var brands = getUniqueBrands(orderNumbers);

// orderNumbers가 []인 경우
// → brands = []
// → invoice.brands = ''
// → invoice.orderCount = 0
```

**가능한 원인:**
1. 청구서 생성 시 orderNumbers 필드를 채우지 않음
2. 거래원장에서 생성된 청구서는 마감DB와 연결되지만 orderNumbers는 저장 안됨
3. SetupPaymentSheets.js에서 orderNumbers 컬럼을 추가했지만, 기존 청구서에는 값이 없음

**원인 분석 2: 청구유형 불일치로 인한 필터링 실패**
- 문제 2와 연관
- `type: "매출"`로 저장된 청구서는 검색 자체가 안될 수 있음
- 또는 검색은 되지만 orderNumbers 조회 시 문제 발생

**확인 필요:**
1. 실제 청구DB 시트의 orderNumbers 컬럼 값 확인
2. 빈 값(`[]`)인지, 아니면 컬럼 자체가 없는지
3. 거래원장에서 청구서 생성 시 orderNumbers를 어떻게 채워야 하는지

---

## 📊 현재 시스템 구조 분석

### 데이터 흐름 맵

```
[거래원장 시트]
├─ 발주번호 (GMP-001)
├─ 브랜드
├─ 매입처
├─ 매입결제 상태 ← ⚠️ 업데이트 안됨
├─ 매출결제 상태 ← ⚠️ 업데이트 안됨
└─ ...

         ↓ (마감 프로세스)

[마감DB]
└─ 마감ID (ST-001)

         ↓ (청구서 생성)

[청구DB 시트]
├─ 청구ID (INV-001 or BL-001)
├─ 청구유형 (⚠️ "매출"/"매입" vs "SALES"/"PURCHASE")
├─ 업체명
├─ 마감ID
├─ 청구일
├─ 청구금액
├─ 청구상태 (DRAFT/ISSUED/PAID/CANCELLED)
├─ billingType (DIRECT/SETTLEMENT) ← Phase 1 추가
├─ orderNumbers (JSON 배열) ← Phase 1 추가, ⚠️ 값 없음
└─ ...

         ↓ (결제 입력)

[결제내역 시트]
├─ 결제ID (PAY-001)
├─ 결제일
├─ 결제유형 (입금/출금)
├─ 거래처명
├─ 금액
├─ 결제수단
├─ 문서번호 (청구ID) ← 새로운 방식
├─ 발주번호 (deprecated)
└─ ...

         ↓ ⚠️ 역방향 업데이트 필요

[거래원장 시트]
├─ 매입결제 상태 ← ❌ 현재 업데이트 안됨
└─ 매출결제 상태 ← ❌ 현재 업데이트 안됨
```

### 관련 함수 목록

| 함수명 | 파일 | 기능 | 상태 |
|--------|------|------|------|
| `createBilling` | SettlementService.js | 청구서 생성 (마감 기반) | ✅ 구현됨 |
| `createTempInvoice` | PaymentService.js | 임시 청구서 생성 | ✅ 구현됨 |
| `searchInvoices` | PaymentService.js | 청구서 검색 | ✅ 구현됨, ⚠️ 타입 불일치 |
| `getInvoiceDetail` | PaymentService.js | 청구서 상세 조회 | ✅ 구현됨 |
| `getOrdersDetailForInvoice` | PaymentService.js | 발주 상세 조회 (브랜드 단위) | ✅ 구현됨 |
| `addPaymentRecord` | PaymentService.js | 결제 추가 | ✅ 구현됨, ❌ 거래원장 미업데이트 |
| `updatePaymentRecord` | PaymentService.js | 결제 수정 | ✅ 구현됨, ❌ 거래원장 미업데이트 |
| `deletePaymentRecord` | PaymentService.js | 결제 삭제 | ✅ 구현됨, ❌ 거래원장 미업데이트 |

---

## 🛠️ 해결 방안

### 방안 1: 거래원장 상태 업데이트 로직 추가 (필수)

**목표:** 결제 저장/수정/삭제 시 거래원장의 매입결제/매출결제 상태 자동 업데이트

#### 1.1 새로운 함수 구현: `updateLedgerPaymentStatus()`

```javascript
/**
 * 거래원장의 결제 상태 업데이트
 * @param {String} invoiceId - 청구서ID
 * @param {String} paymentType - 결제유형 ('입금' or '출금')
 * @param {String} status - 상태 ('결제완료', '부분결제', '미결제')
 * @return {Object} { success, updated }
 */
function updateLedgerPaymentStatus(invoiceId, paymentType, status) {
  try {
    // 1. 청구서에서 orderNumbers 조회
    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var invoiceSheet = ss.getSheetByName(INVOICE_SHEET_NAME);
    var invoiceData = invoiceSheet.getDataRange().getValues();
    var invoiceHeader = invoiceData[0];

    var iCol = function(name) { return invoiceHeader.indexOf(name); };
    var iInvoiceId = iCol('청구ID');
    var iOrderNumbers = iCol('orderNumbers');

    var orderNumbers = [];
    for (var i = 1; i < invoiceData.length; i++) {
      if (invoiceData[i][iInvoiceId] === invoiceId) {
        orderNumbers = JSON.parse(invoiceData[i][iOrderNumbers] || '[]');
        break;
      }
    }

    if (orderNumbers.length === 0) {
      Logger.log('[updateLedgerPaymentStatus] 경고: 청구서에 연결된 발주번호가 없습니다. invoiceId=' + invoiceId);
      return {
        success: true,
        updated: 0,
        message: '연결된 발주번호가 없어 거래원장을 업데이트하지 않았습니다.'
      };
    }

    // 2. 거래원장 시트에서 해당 발주번호 찾기
    var ledgerSheet = ss.getSheetByName('거래원장');
    if (!ledgerSheet) {
      return {
        success: false,
        error: '거래원장 시트를 찾을 수 없습니다.'
      };
    }

    var ledgerData = ledgerSheet.getDataRange().getValues();
    var ledgerHeader = ledgerData[0];

    var lCol = function(name) { return ledgerHeader.indexOf(name); };
    var lOrderNumber = lCol('발주번호');
    var lPayBuy = lCol('매입결제');
    var lPaySell = lCol('매출결제');

    if (lOrderNumber === -1 || lPayBuy === -1 || lPaySell === -1) {
      return {
        success: false,
        error: '거래원장 시트에 필수 컬럼이 없습니다.'
      };
    }

    // 3. 결제유형에 따라 업데이트할 컬럼 결정
    var targetCol = paymentType === '입금' ? lPaySell : lPayBuy;
    var targetColName = paymentType === '입금' ? '매출결제' : '매입결제';

    // 4. 각 발주번호에 대해 상태 업데이트
    var updated = 0;
    for (var i = 1; i < ledgerData.length; i++) {
      var row = ledgerData[i];

      if (orderNumbers.indexOf(row[lOrderNumber]) !== -1) {
        ledgerSheet.getRange(i + 1, targetCol + 1).setValue(status);
        updated++;
        Logger.log('[updateLedgerPaymentStatus] 업데이트: 발주번호=' + row[lOrderNumber] + ', ' + targetColName + '=' + status);
      }
    }

    return {
      success: true,
      updated: updated,
      message: updated + '건의 거래원장 상태가 업데이트되었습니다.'
    };

  } catch (error) {
    Logger.log('[updateLedgerPaymentStatus Error] ' + error.message);
    return {
      success: false,
      error: '거래원장 상태 업데이트 중 오류: ' + error.message
    };
  }
}
```

#### 1.2 addPaymentRecord() 수정

```javascript
function addPaymentRecord(params) {
  try {
    // ... 기존 로직 (결제내역 시트 저장)

    sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);

    Logger.log('[addPaymentRecord] ✅ 입출금 기록 추가 (' + nextRow + '행): ' + paymentId);

    // ✅ 새로 추가: 거래원장 상태 업데이트
    if (params.docNumber) {
      var updateResult = updateLedgerPaymentStatus(
        params.docNumber,
        params.type,
        '결제완료'  // 또는 부분결제 로직 추가 가능
      );

      if (updateResult.success) {
        Logger.log('[addPaymentRecord] ✅ 거래원장 업데이트: ' + updateResult.message);
      } else {
        Logger.log('[addPaymentRecord] ⚠️ 거래원장 업데이트 실패: ' + updateResult.error);
        // 실패해도 결제는 저장되었으므로 성공 반환
      }
    }

    return {
      success: true,
      paymentId: paymentId,
      message: '입출금 기록이 추가되었습니다.'
    };

  } catch (error) {
    // ... 에러 처리
  }
}
```

#### 1.3 updatePaymentRecord() 및 deletePaymentRecord() 수정

동일한 방식으로 수정:
- updatePaymentRecord: docNumber 변경 시 이전/새로운 청구서 모두 거래원장 업데이트
- deletePaymentRecord: 삭제 시 거래원장 상태를 '미결제'로 복원

---

### 방안 2: 청구유형 표준화 (필수)

**목표:** 청구유형 값을 시스템 전체에서 `"SALES"` / `"PURCHASE"`로 통일

#### 2.1 청구서 생성 시 표준 값 사용

**SettlementService.js 수정:**
```javascript
function createBilling(params) {
  // ...

  // ⚠️ 기존: params.type을 그대로 사용
  // ✅ 수정: 표준 값으로 변환
  var standardType = params.type;
  if (params.type === '매출') {
    standardType = 'SALES';
  } else if (params.type === '매입') {
    standardType = 'PURCHASE';
  }
  // 이미 'SALES' 또는 'PURCHASE'인 경우 그대로 유지

  var rowData = [
    billingId,
    standardType,  // ✅ 표준화된 값 사용
    company,
    // ...
  ];

  sheet.appendRow(rowData);
  // ...
}
```

#### 2.2 기존 데이터 마이그레이션 스크립트

```javascript
/**
 * 청구DB의 청구유형을 표준화
 * "매출" → "SALES", "매입" → "PURCHASE"
 */
function migrateBillingTypes() {
  var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
  var sheet = ss.getSheetByName(INVOICE_SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var header = data[0];

  var col = function(name) { return header.indexOf(name); };
  var cType = col('청구유형');

  if (cType === -1) {
    Logger.log('[migrateBillingTypes] 청구유형 컬럼을 찾을 수 없습니다.');
    return;
  }

  var updated = 0;
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var currentType = String(row[cType] || '').trim();
    var newType = null;

    if (currentType === '매출') {
      newType = 'SALES';
    } else if (currentType === '매입') {
      newType = 'PURCHASE';
    }

    if (newType) {
      sheet.getRange(i + 1, cType + 1).setValue(newType);
      updated++;
      Logger.log('[migrateBillingTypes] 업데이트: 행' + (i + 1) + ', "' + currentType + '" → "' + newType + '"');
    }
  }

  Logger.log('[migrateBillingTypes] 완료: ' + updated + '건 업데이트');
}
```

#### 2.3 검색 함수 호환성 개선 (선택)

만약 기존 데이터를 유지하면서 호환성을 원한다면:

```javascript
// PaymentService.js - searchInvoices()
function searchInvoices(params) {
  // ...
  var invoiceType = paymentType === '입금' ? 'SALES' : 'PURCHASE';

  // 호환성을 위한 한글 매핑
  var invoiceTypeKorean = paymentType === '입금' ? '매출' : '매입';

  // ...

  for (var i = 1; i < data.length; i++) {
    var row = data[i];

    // ✅ 청구서 타입 필터링 (영문 또는 한글 모두 허용)
    if (row[cType] !== invoiceType && row[cType] !== invoiceTypeKorean) {
      continue;
    }

    // ...
  }
}
```

**권장:** 방안 2.2 (마이그레이션)를 실행하여 데이터를 표준화하는 것이 좋습니다.

---

### 방안 3: 청구서 생성 시 orderNumbers 자동 채우기 (필수)

**목표:** 거래원장에서 청구서 생성 시 orderNumbers 필드를 자동으로 채움

#### 3.1 createBilling() 함수 수정

**현재 문제:**
- createBilling()은 마감DB를 기반으로 청구서를 생성
- 하지만 orderNumbers 필드를 채우지 않음

**해결 방법:**
마감DB → 마감상세DB → 발주번호 추출

```javascript
function createBilling(params) {
  try {
    var settlementId = params.settlementId || '';
    var type = params.type || '';
    var company = params.company || '';
    var billingDate = params.billingDate || new Date();
    var amount = params.amount || 0;
    var notes = params.notes || '';

    // ... 유효성 검사

    // ✅ 새로 추가: 마감ID에서 발주번호 목록 조회
    var orderNumbers = [];
    if (settlementId) {
      orderNumbers = getOrderNumbersFromSettlement(settlementId);
    }

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_BILLING_SHEET);

    // ... billingId 생성

    // 청구유형 표준화
    var standardType = type;
    if (type === '매출') standardType = 'SALES';
    else if (type === '매입') standardType = 'PURCHASE';

    var rowData = [
      billingId,
      standardType,  // ✅ 표준화
      company,
      settlementId,
      billingDate,
      amount,
      'DRAFT',
      notes,
      now,
      user,
      '',
      '',
      '',
      'SETTLEMENT',  // ✅ billingType 추가
      JSON.stringify(orderNumbers)  // ✅ orderNumbers 추가
    ];

    sheet.appendRow(rowData);
    Logger.log('[createBilling] 청구서 생성: ' + billingId + ', 발주번호: ' + orderNumbers.length + '건');

    return {
      success: true,
      billingId: billingId,
      message: '청구서가 생성되었습니다.'
    };

  } catch (err) {
    // ... 에러 처리
  }
}

/**
 * 마감ID에서 발주번호 목록 조회
 * @param {String} settlementId - 마감ID
 * @return {Array} 발주번호 배열
 */
function getOrderNumbersFromSettlement(settlementId) {
  try {
    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var detailSheet = ss.getSheetByName(OB_SETTLEMENT_DETAIL_SHEET);

    if (!detailSheet) {
      Logger.log('[getOrderNumbersFromSettlement] 마감상세DB 시트를 찾을 수 없습니다.');
      return [];
    }

    var data = detailSheet.getDataRange().getValues();
    var header = data[0];

    var col = function(name) { return header.indexOf(name); };
    var cSettlementId = col('마감ID');
    var cOrderNumber = col('발주번호');

    if (cSettlementId === -1 || cOrderNumber === -1) {
      Logger.log('[getOrderNumbersFromSettlement] 필수 컬럼을 찾을 수 없습니다.');
      return [];
    }

    var orderNumbers = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      if (row[cSettlementId] === settlementId) {
        var orderNumber = String(row[cOrderNumber] || '').trim();
        if (orderNumber && orderNumbers.indexOf(orderNumber) === -1) {
          orderNumbers.push(orderNumber);
        }
      }
    }

    Logger.log('[getOrderNumbersFromSettlement] 마감ID=' + settlementId + ', 발주번호=' + orderNumbers.length + '건');
    return orderNumbers;

  } catch (error) {
    Logger.log('[getOrderNumbersFromSettlement Error] ' + error.message);
    return [];
  }
}
```

#### 3.2 청구DB 시트 컬럼 확인

**필요한 컬럼:**
- billingType (Phase 1에서 추가됨) ✅
- orderNumbers (Phase 1에서 추가됨) ✅

**확인 사항:**
1. 청구DB 시트에 실제로 이 컬럼들이 존재하는지 확인
2. 기존 청구서 데이터에 빈 값(`[]`)이 있는지 확인
3. SetupPaymentSheets.js가 실행되었는지 확인

---

### 방안 4: 임시 청구서 생성 시 orderNumbers 처리

**현재 구현:**
```javascript
// PaymentService.js - createTempInvoice()
// orderNumbers를 빈 배열로 초기화
rowData.push('[]');  // orderNumbers
```

**개선 방안:**
임시 청구서는 발주번호가 없으므로 현재 구현 유지. 다만, 추후 사용자가 발주번호를 추가할 수 있도록 UI 제공 고려.

---

## 📋 구현 우선순위

### Phase A: 긴급 수정 (필수) - 예상 소요: 2-3시간

1. ✅ **청구유형 표준화 스크립트 실행**
   - 기존 청구DB 데이터를 "매출"/"매입" → "SALES"/"PURCHASE"로 변환
   - 스크립트: `migrateBillingTypes()`
   - 예상 소요: 10분

2. ✅ **createBilling() 함수 수정**
   - 청구유형 표준화 로직 추가
   - orderNumbers 자동 채우기 로직 추가
   - getOrderNumbersFromSettlement() 함수 구현
   - 예상 소요: 1시간

3. ✅ **거래원장 상태 업데이트 로직 구현**
   - updateLedgerPaymentStatus() 함수 구현
   - addPaymentRecord() 수정
   - 예상 소요: 1.5시간

---

### Phase B: 추가 개선 (권장) - 예상 소요: 1-2시간

4. ✅ **updatePaymentRecord() 수정**
   - 결제 수정 시 거래원장 상태 업데이트
   - 예상 소요: 30분

5. ✅ **deletePaymentRecord() 수정**
   - 결제 삭제 시 거래원장 상태 복원
   - 예상 소요: 30분

6. ✅ **부분결제 로직 구현**
   - 청구금액과 결제금액이 다른 경우 '부분결제' 상태로 업데이트
   - 예상 소요: 30분

---

### Phase C: 테스트 및 검증 - 예상 소요: 1-2시간

7. ✅ **통합 테스트 시나리오**
   - 시나리오 1: 거래원장에서 청구서 생성 → orderNumbers 확인
   - 시나리오 2: 결제 입력 → 거래원장 상태 확인
   - 시나리오 3: 결제 수정 → 거래원장 상태 재확인
   - 시나리오 4: 결제 삭제 → 거래원장 상태 복원 확인
   - 예상 소요: 1시간

8. ✅ **문서 업데이트**
   - 통합 가이드 작성
   - 사용자 교육 자료 업데이트
   - 예상 소요: 30분

---

## 🔍 추가 확인 필요 사항

### 1. 청구DB 실제 데이터 확인
- [ ] 청구유형 컬럼의 실제 값 확인 (SALES/PURCHASE vs 매출/매입)
- [ ] orderNumbers 컬럼 존재 여부 확인
- [ ] billingType 컬럼 존재 여부 확인
- [ ] 기존 청구서 건수 확인

### 2. 거래원장 컬럼 확인
- [ ] '매입결제' 컬럼 존재 확인
- [ ] '매출결제' 컬럼 존재 확인
- [ ] 현재 상태 값 확인 (미결제/부분결제/결제완료)

### 3. 마감상세DB 구조 확인
- [ ] 마감ID 컬럼 존재 확인
- [ ] 발주번호 컬럼 존재 확인
- [ ] 데이터 샘플 확인

---

## 📝 구현 체크리스트

### Phase A (긴급 수정)
- [ ] migrateBillingTypes() 스크립트 작성
- [ ] 스크립트 실행 및 결과 확인
- [ ] getOrderNumbersFromSettlement() 함수 구현
- [ ] createBilling() 함수 수정
- [ ] updateLedgerPaymentStatus() 함수 구현
- [ ] addPaymentRecord() 함수 수정
- [ ] 테스트: 청구서 생성 → orderNumbers 확인
- [ ] 테스트: 결제 입력 → 거래원장 상태 확인

### Phase B (추가 개선)
- [ ] updatePaymentRecord() 함수 수정
- [ ] deletePaymentRecord() 함수 수정
- [ ] 부분결제 로직 구현
- [ ] 테스트: 결제 수정 시나리오
- [ ] 테스트: 결제 삭제 시나리오

### Phase C (테스트 및 검증)
- [ ] 통합 테스트 4개 시나리오 실행
- [ ] 버그 수정
- [ ] 문서 업데이트
- [ ] 사용자 교육

---

## 🎯 예상 결과

### Phase A 완료 후:
- ✅ 청구서 검색 시 발주 정보 정상 표시
- ✅ 청구유형 필터링 정상 동작
- ✅ 결제 입력 후 거래원장 상태 자동 업데이트

### Phase B 완료 후:
- ✅ 결제 수정/삭제 시에도 거래원장 상태 동기화
- ✅ 부분결제 처리 가능

### Phase C 완료 후:
- ✅ 전체 시스템 통합 완료
- ✅ 사용자 교육 완료
- ✅ 프로덕션 배포 준비 완료

---

## ⚠️ 주의사항

1. **백업 필수**
   - 모든 수정 작업 전에 청구DB, 거래원장 시트 백업

2. **점진적 배포**
   - Phase A만 먼저 배포하여 검증
   - 문제없으면 Phase B, C 순차 배포

3. **사용자 통지**
   - 마이그레이션 작업 시 사용자에게 사전 공지
   - 작업 시간 동안 시스템 사용 제한

4. **롤백 계획**
   - 문제 발생 시 즉시 백업으로 복원
   - 코드 변경사항 Git으로 버전 관리

---

**작성자:** OneBridge ERP Development Team
**검토자:** [검토 필요]
**승인자:** [승인 필요]
