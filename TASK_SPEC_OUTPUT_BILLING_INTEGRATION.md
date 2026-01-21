# 작업명세서: 출력-청구서-거래원장 유기적 연동 구현

**작성일**: 2026-01-21
**목적**: PDF 출력 시 청구서 및 거래원장 상태가 자동으로 연동되도록 시스템 개선

---

## 📋 1. 현황 분석

### 1.1 거래원장 시트 구조

**스프레드시트 ID**: `1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs`
**시트명**: `거래원장`
**관리 함수**: `getOrderMergedSheet()` (DBService.js)

#### 상태 관리 컬럼 (4개)

| 컬럼명 | 가능한 값 | 기본값 | 비고 |
|--------|-----------|--------|------|
| **매입발주** | "미처리", "발주완료" | "미처리" | 발주서 출력 시 변경 대상 |
| **매입결제** | "미결제", "부분결제", "결제완료" | "미결제" | 매입처 결제 상태 |
| **매출결제** | "미결제", "부분결제", "결제완료" | "미결제" | 거래명세서 출력 시 변경 대상 |
| **출고** | "미출고", "부분출고", "출고완료" | "미출고" | 물류 상태 |

**참조 코드**: CommonScripts.html:1798-1824

---

### 1.2 청구서 DB 시트 구조

**스프레드시트 ID**: `1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs`
**시트명**: `청구DB`
**상수**: `OB_BILLING_SHEET` (SettlementService.js:15)

#### 컬럼 구조

| # | 컬럼명 | 타입 | 비고 |
|---|--------|------|------|
| 0 | 청구ID | String | BL-YYYYMMDD-001 |
| 1 | 청구유형 | String | SALES/PURCHASE |
| 2 | 업체명 | String | |
| 3 | 마감ID | String | |
| 4 | 청구일 | Date | |
| 5 | 청구금액 | Number | |
| 6 | 청구상태 | String | **DRAFT/ISSUED/PAID** |
| 7 | 비고 | String | |
| 8 | 생성일시 | Date | |
| 9 | 생성자 | String | |
| 10 | 발행일시 | Date | |
| 11 | 발행자 | String | |
| 12 | 결제일시 | Date | |

**참조 코드**: SettlementService.js:785-788

---

### 1.3 현재 문제점

#### 문제 1: updateOrderStatus() 함수 불완전
**위치**: ApiService.js:345-389
**현재 구현**:
```javascript
function updateOrderStatus(orderId, status) {
  // status를 단일 값으로 간주
  var colStatus = header.indexOf('출고'); // ❌ 출고 컬럼만 업데이트
  sheet.getRange(i + 1, colStatus + 1).setValue(status);
}
```

**호출부 코드** (CommonScripts.html:1976-2014):
```javascript
var statuses = {
  buyOrder: '발주완료',  // 매입발주 컬럼
  payBuy: '결제완료',     // 매입결제 컬럼
  paySell: '결제완료',    // 매출결제 컬럼
  ship: '출고완료'        // 출고 컬럼
};
.updateOrderStatus(currentOrderCode, statuses); // ✅ 객체로 전달
```

**결론**: 함수 시그니처와 호출 방식 불일치

---

#### 문제 2: PDF 출력 시 상태 변경 없음
**위치**: InvoiceOutputService.js:24-340
**현재 흐름**:
```
generateInvoiceZip(params)
  ↓
PDF 생성 → Drive 저장
  ↓
❌ 거래원장 상태 업데이트 없음
❌ 청구서 DB 생성/업데이트 없음
```

---

#### 문제 3: reprintInvoiceApi() 미구현
**위치**: ApiService.js (해당 함수 없음)
**호출부**: CommonScripts.html:3403
**에러**: `reprintInvoiceApi is not defined`

---

#### 문제 4: 청구서-거래원장 연동 없음
**청구서 생성** (SettlementService.js:764-838):
- 청구DB에 레코드만 추가
- ❌ 거래원장 상태 변경 없음
- ❌ 발주번호 정보 저장 없음 (재출력 불가)

**청구서 상태 변경** (SettlementService.js:928-998):
- 청구DB의 '청구상태' 컬럼만 업데이트
- ❌ 거래원장 상태 연동 없음

---

## 🎯 2. 구현 계획

### Phase 1: updateOrderStatus() 함수 개선

#### 2.1.1 목표
4개 상태 컬럼을 모두 지원하도록 함수 리팩토링

#### 2.1.2 변경 위치
- **파일**: ApiService.js
- **함수**: `updateOrderStatus(orderId, statuses)` (345-389행)
- **타입**: 함수 시그니처 변경

#### 2.1.3 구현 사항

**변경 전 시그니처**:
```javascript
function updateOrderStatus(orderId, status)
```

**변경 후 시그니처**:
```javascript
function updateOrderStatus(orderId, statuses)
```

**파라미터 구조**:
```javascript
statuses = {
  buyOrder: "미처리" | "발주완료" | null,
  payBuy: "미결제" | "부분결제" | "결제완료" | null,
  paySell: "미결제" | "부분결제" | "결제완료" | null,
  ship: "미출고" | "부분출고" | "출고완료" | null
}
```

**로직 의사코드**:
```javascript
function updateOrderStatus(orderId, statuses) {
  // 1. 거래원장 시트 로드
  var sheet = getOrderMergedSheet();
  var data = sheet.getDataRange().getValues();
  var header = data[0];

  // 2. 컬럼 인덱스 확인
  var colOrderCode = header.indexOf('발주번호');
  var colBuyOrder = header.indexOf('매입발주');
  var colPayBuy = header.indexOf('매입결제');
  var colPaySell = header.indexOf('매출결제');
  var colShip = header.indexOf('출고');

  // 3. 발주번호로 모든 행 찾아서 업데이트
  var updated = 0;
  for (var i = 1; i < data.length; i++) {
    if (data[i][colOrderCode] === orderId) {
      // 4개 상태 중 값이 있는 것만 업데이트
      if (statuses.buyOrder && colBuyOrder >= 0) {
        sheet.getRange(i + 1, colBuyOrder + 1).setValue(statuses.buyOrder);
      }
      if (statuses.payBuy && colPayBuy >= 0) {
        sheet.getRange(i + 1, colPayBuy + 1).setValue(statuses.payBuy);
      }
      if (statuses.paySell && colPaySell >= 0) {
        sheet.getRange(i + 1, colPaySell + 1).setValue(statuses.paySell);
      }
      if (statuses.ship && colShip >= 0) {
        sheet.getRange(i + 1, colShip + 1).setValue(statuses.ship);
      }
      updated++;
    }
  }

  return { success: true, updated: updated };
}
```

#### 2.1.4 백워드 호환성
**기존 호출부** (CommonScripts.html:2014):
```javascript
.updateOrderStatus(currentOrderCode, statuses); // ✅ 객체 전달 (정상 동작)
```

**검증 필요**: 다른 곳에서 단일 값으로 호출하는지 확인
```bash
grep -r "updateOrderStatus" --include="*.js" --include="*.html"
```

---

### Phase 2: PDF 출력 시 거래원장 상태 자동 변경

#### 2.2.1 목표
발주서/거래명세서 출력 시 해당 발주번호의 거래원장 상태 자동 업데이트

#### 2.2.2 변경 위치
- **파일**: InvoiceOutputService.js
- **함수**: `generateInvoiceZip(params)` (24-340행)
- **위치**: ZIP 파일 생성 완료 후, return 직전

#### 2.2.3 상태 변경 로직

**문서 유형별 상태 매핑**:

| docType | 문서명 | 변경 대상 컬럼 | 변경 값 | 비고 |
|---------|--------|---------------|---------|------|
| `ORDER_PURCHASE` | 발주서(매입) | 매입발주 | "발주완료" | 매입처에 발주서 전달 |
| `INVOICE_VAT` | 거래명세서(부포) | 매출결제 | "결제완료" | 발주처에 청구 |
| `INVOICE_NVAT` | 거래명세서(영세) | 매출결제 | "결제완료" | 발주처에 청구 |

**의사코드**:
```javascript
function generateInvoiceZip(params) {
  // ... 기존 PDF 생성 로직 ...

  // ZIP 파일 생성 성공 후
  if (pdfBlobs.length > 0) {
    var zipBlob = createZipBlob(pdfBlobs, fileName);
    var fileId = saveToDrive(zipBlob);

    // ✅ 새로운 로직: 거래원장 상태 업데이트
    try {
      updateOrderStatusAfterOutput_(orderCodes, docType);
    } catch (err) {
      Logger.log('[WARN] 상태 업데이트 실패: ' + err.message);
      // 에러 발생해도 PDF는 정상 반환 (비즈니스 로직 분리)
    }

    return {
      success: true,
      fileId: fileId,
      fileName: fileName
    };
  }
}

// 새 헬퍼 함수
function updateOrderStatusAfterOutput_(orderCodes, docType) {
  var statuses = {};

  // 문서 유형에 따라 업데이트할 상태 결정
  switch(docType) {
    case 'ORDER_PURCHASE':
      statuses.buyOrder = '발주완료';
      break;
    case 'INVOICE_VAT':
    case 'INVOICE_NVAT':
      statuses.paySell = '결제완료';
      break;
    default:
      return; // 알 수 없는 문서 유형
  }

  // 각 발주번호별로 상태 업데이트
  for (var i = 0; i < orderCodes.length; i++) {
    var result = updateOrderStatus(orderCodes[i], statuses);
    if (!result.success) {
      Logger.log('[ERROR] 발주번호 ' + orderCodes[i] + ' 상태 업데이트 실패');
    }
  }
}
```

#### 2.2.4 주의사항

**부분결제 vs 결제완료**:
- 현재 로직은 무조건 "결제완료"로 설정
- 실제로는 "부분결제" 처리가 필요할 수 있음
- **해결 방안**: 향후 Phase에서 부분결제 로직 추가 (명세서 출력 횟수 추적 등)

**에러 처리**:
- 상태 업데이트 실패해도 PDF는 정상 반환
- 에러 로그만 기록하고 계속 진행

---

### Phase 3: 청구서 DB 구조 개선

#### 2.3.1 목표
청구서 재출력 및 거래원장 연동을 위한 발주번호 저장

#### 2.3.2 변경 위치
- **파일**: SettlementService.js
- **함수**: `createBilling(params)` (764-838행)
- **시트**: 청구DB

#### 2.3.3 청구DB 헤더 추가

**현재 헤더** (SettlementService.js:786-788):
```javascript
['청구ID', '청구유형', '업체명', '마감ID', '청구일', '청구금액',
 '청구상태', '비고', '생성일시', '생성자', '발행일시', '발행자', '결제일시']
```

**추가 컬럼**:
| 컬럼 인덱스 | 컬럼명 | 타입 | 설명 |
|------------|--------|------|------|
| 13 | **발주번호목록** | String | 쉼표로 구분 (예: "PO-001,PO-002") |

**변경 후 헤더**:
```javascript
['청구ID', '청구유형', '업체명', '마감ID', '청구일', '청구금액',
 '청구상태', '비고', '생성일시', '생성자', '발행일시', '발행자', '결제일시', '발주번호목록']
```

#### 2.3.4 createBilling() 함수 수정

**파라미터 추가**:
```javascript
function createBilling(params) {
  var settlementId = params.settlementId || '';
  var type = params.type || '';
  var company = params.company || '';
  var billingDate = params.billingDate || new Date();
  var amount = params.amount || 0;
  var notes = params.notes || '';
  var orderNumbers = params.orderNumbers || [];  // ✅ 새 파라미터

  // ...

  var orderNumbersStr = orderNumbers.join(',');  // ✅ 쉼표 구분 문자열

  var rowData = [
    billingId,
    type,
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
    orderNumbersStr  // ✅ 새 컬럼
  ];

  sheet.appendRow(rowData);
}
```

**호출부 수정** (CommonScripts.html:1313-1341):
```javascript
// 현재 코드에 이미 orderNumbers 전달됨 (1320행)
var params = {
  settlementId: '',
  type: 'SALES',
  company: billingState.company,
  billingDate: new Date(),
  amount: billingState.currentData.totalAmount,
  notes: billingState.startDate + ' ~ ' + billingState.endDate + ' 청구',
  orderNumbers: orderCodes  // ✅ 이미 있음 (1320행)
};
```

**결론**: 호출부는 수정 불필요, createBilling() 함수만 수정

---

### Phase 4: reprintInvoiceApi() 구현

#### 2.4.1 목표
청구서 관리 페이지에서 "재출력" 버튼 기능 구현

#### 2.4.2 구현 위치
- **파일**: ApiService.js
- **새 함수**: `reprintInvoiceApi(params)`
- **위치**: generateInvoiceZipApi() 다음 (103행 이후)

#### 2.4.3 구현 로직

```javascript
/**
 * 청구서 재출력 (클라이언트용 래퍼)
 * @param {Object} params - { billingId, invoiceId, settlementId, type }
 */
function reprintInvoiceApi(params) {
  try {
    var billingId = params.billingId || params.invoiceId || '';

    if (!billingId) {
      return safeReturn({
        success: false,
        error: '청구ID를 찾을 수 없습니다.'
      });
    }

    // 1. 청구DB에서 발주번호 목록 조회
    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_BILLING_SHEET);

    if (!sheet) {
      return safeReturn({
        success: false,
        error: '청구DB를 찾을 수 없습니다.'
      });
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
    var orderCodes = orderNumbersStr.split(',').map(function(s) {
      return s.trim();
    }).filter(function(s) {
      return s !== '';
    });

    if (orderCodes.length === 0) {
      return safeReturn({
        success: false,
        error: '발주번호가 비어있습니다.'
      });
    }

    // 4. 문서 유형 결정 (청구유형 기반)
    var docType = 'INVOICE_NVAT'; // 기본값
    if (billingType === 'PURCHASE') {
      docType = 'ORDER_PURCHASE';
    } else if (billingType === 'SALES') {
      docType = 'INVOICE_VAT'; // or INVOICE_NVAT
    }

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

#### 2.4.4 필요한 상수 추가

**파일**: ApiService.js (상단)
```javascript
// SettlementService.js에 정의된 상수 import 필요
var OB_SETTLEMENT_SS_ID = '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs';
var OB_BILLING_SHEET = '청구DB';
```

---

### Phase 5: 청구서 발행 시 거래원장 연동

#### 2.5.1 목표
청구서 상태를 ISSUED로 변경할 때 거래원장의 매출결제도 자동 업데이트

#### 2.5.2 변경 위치
- **파일**: SettlementService.js
- **함수**: `updateBillingStatus(params)` (928-998행)
- **추가 로직**: ISSUED 상태 변경 시 거래원장 업데이트

#### 2.5.3 구현 로직

```javascript
function updateBillingStatus(params) {
  try {
    var billingId = params.billingId || '';
    var status = params.status || '';

    // ... 기존 로직 ...

    // 상태 업데이트
    sheet.getRange(rowIndex, 7).setValue(status);

    // ✅ 새 로직: ISSUED로 변경 시 거래원장 업데이트
    if (status === 'ISSUED') {
      sheet.getRange(rowIndex, 11).setValue(now);
      sheet.getRange(rowIndex, 12).setValue(user);

      // 거래원장의 매출결제 상태 변경
      try {
        updateLedgerStatusOnIssued_(billingId);
      } catch (err) {
        Logger.log('[WARN] 거래원장 상태 업데이트 실패: ' + err.message);
        // 에러 발생해도 청구서 상태는 변경됨
      }
    }

    // ... 나머지 로직 ...
  }
}

// 새 헬퍼 함수
function updateLedgerStatusOnIssued_(billingId) {
  // 1. 청구DB에서 발주번호 목록 조회
  var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
  var billingSheet = ss.getSheetByName(OB_BILLING_SHEET);
  var data = billingSheet.getDataRange().getValues();
  var header = data[0];

  var colBillingId = header.indexOf('청구ID');
  var colOrderNumbers = header.indexOf('발주번호목록');

  var orderNumbersStr = '';
  for (var i = 1; i < data.length; i++) {
    if (data[i][colBillingId] === billingId) {
      orderNumbersStr = data[i][colOrderNumbers] || '';
      break;
    }
  }

  if (!orderNumbersStr) {
    Logger.log('[WARN] 청구ID ' + billingId + '의 발주번호를 찾을 수 없음');
    return;
  }

  // 2. 발주번호 배열로 변환
  var orderCodes = orderNumbersStr.split(',').map(function(s) {
    return s.trim();
  }).filter(function(s) {
    return s !== '';
  });

  // 3. 각 발주번호의 거래원장 상태 업데이트
  for (var i = 0; i < orderCodes.length; i++) {
    var result = updateOrderStatus(orderCodes[i], {
      paySell: '결제완료'
    });

    if (!result.success) {
      Logger.log('[ERROR] 발주번호 ' + orderCodes[i] + ' 상태 업데이트 실패');
    }
  }

  Logger.log('[updateLedgerStatusOnIssued] 청구ID ' + billingId + ' 발행으로 ' + orderCodes.length + '개 발주 상태 업데이트 완료');
}
```

---

## 🧪 3. 백테스트 시나리오

### Scenario 1: 발주서 출력

**초기 상태**:
```
거래원장:
발주번호: PO-20260120-001
매입발주: "미처리"
매입결제: "미결제"
매출결제: "미결제"
출고: "미출고"
```

**액션**:
```javascript
generateInvoiceZipApi({
  orderCodes: ['PO-20260120-001'],
  docType: 'ORDER_PURCHASE',
  printMode: 'auto',
  modesByOrder: {},
  mergeBySupplier: false
})
```

**예상 결과**:
```
✅ PDF 생성 성공
✅ Drive 저장 완료
✅ 거래원장 상태 업데이트:
   - 매입발주: "미처리" → "발주완료"
   - 매입결제: "미결제" (변경 없음)
   - 매출결제: "미결제" (변경 없음)
   - 출고: "미출고" (변경 없음)
```

**검증 쿼리**:
```
=QUERY(거래원장!A:Z, "SELECT A, B, C WHERE A = 'PO-20260120-001'")
```

---

### Scenario 2: 거래명세서 출력

**초기 상태**:
```
거래원장:
발주번호: PO-20260120-002
매입발주: "발주완료"
매입결제: "결제완료"
매출결제: "미결제"
출고: "출고완료"
```

**액션**:
```javascript
generateInvoiceZipApi({
  orderCodes: ['PO-20260120-002'],
  docType: 'INVOICE_VAT',
  printMode: 'auto',
  modesByOrder: {},
  mergeBySupplier: false
})
```

**예상 결과**:
```
✅ PDF 생성 성공
✅ Drive 저장 완료
✅ 거래원장 상태 업데이트:
   - 매입발주: "발주완료" (변경 없음)
   - 매입결제: "결제완료" (변경 없음)
   - 매출결제: "미결제" → "결제완료"
   - 출고: "출고완료" (변경 없음)
```

---

### Scenario 3: 청구서 생성 → 발행

**초기 상태**:
```
거래원장:
발주번호: PO-001, PO-002
매출결제: "미결제"

청구DB: (없음)
```

**액션 1: 청구서 생성**:
```javascript
createBillingApi({
  settlementId: '',
  type: 'SALES',
  company: '테스트업체',
  billingDate: new Date(),
  amount: 1000000,
  notes: '2026-01 청구',
  orderNumbers: ['PO-001', 'PO-002']  // ✅ 발주번호 목록 전달
})
```

**예상 결과 1**:
```
✅ 청구DB 레코드 생성:
   - 청구ID: BL-20260121-001
   - 청구상태: DRAFT
   - 발주번호목록: "PO-001,PO-002"  ✅ 저장됨
❌ 거래원장 상태 변경 없음 (정상)
```

**액션 2: 청구서 발행**:
```javascript
updateBillingStatusApi({
  billingId: 'BL-20260121-001',
  status: 'ISSUED'
})
```

**예상 결과 2**:
```
✅ 청구DB 상태 변경:
   - 청구상태: DRAFT → ISSUED
   - 발행일시: 2026-01-21 14:30:00
   - 발행자: user@example.com
✅ 거래원장 상태 자동 업데이트:
   - PO-001: 매출결제 "미결제" → "결제완료"
   - PO-002: 매출결제 "미결제" → "결제완료"
```

---

### Scenario 4: 청구서 재출력

**초기 상태**:
```
청구DB:
청구ID: BL-20260121-001
청구상태: ISSUED
발주번호목록: "PO-003,PO-004"
청구유형: SALES
```

**액션**:
```javascript
reprintInvoiceApi({
  billingId: 'BL-20260121-001',
  invoiceId: 'BL-20260121-001',
  settlementId: '',
  type: 'SALES'
})
```

**예상 결과**:
```
✅ 청구DB에서 발주번호 조회 성공: ["PO-003", "PO-004"]
✅ 문서 유형 결정: INVOICE_VAT (청구유형=SALES)
✅ generateInvoiceZip() 호출
✅ PDF 생성 및 Drive 저장
✅ 거래원장 상태 업데이트:
   - PO-003: 매출결제 → "결제완료"
   - PO-004: 매출결제 → "결제완료"
```

**엣지 케이스**:
- 발주번호목록이 빈 문자열 → 에러 반환
- 청구ID 존재하지 않음 → 에러 반환
- 발주번호목록 컬럼 없음 → 에러 반환 (시스템 업데이트 필요)

---

### Scenario 5: 다중 발주번호 출력

**초기 상태**:
```
거래원장:
PO-001: 매입발주 "미처리"
PO-002: 매입발주 "미처리"
PO-003: 매입발주 "미처리"
```

**액션**:
```javascript
generateInvoiceZipApi({
  orderCodes: ['PO-001', 'PO-002', 'PO-003'],
  docType: 'ORDER_PURCHASE',
  printMode: 'auto',
  modesByOrder: {},
  mergeBySupplier: false
})
```

**예상 결과**:
```
✅ 3개 발주번호 모두 처리
✅ 거래원장 상태 업데이트:
   - PO-001: 매입발주 → "발주완료"
   - PO-002: 매입발주 → "발주완료"
   - PO-003: 매입발주 → "발주완료"
```

---

### Scenario 6: 상태 업데이트 실패 (에러 처리)

**초기 상태**:
```
거래원장:
PO-999: (존재하지 않는 발주번호)
```

**액션**:
```javascript
generateInvoiceZipApi({
  orderCodes: ['PO-999'],
  docType: 'ORDER_PURCHASE',
  printMode: 'auto',
  modesByOrder: {},
  mergeBySupplier: false
})
```

**예상 결과**:
```
✅ PDF 생성 시도 → 실패 (발주번호 없음)
❌ 거래원장 상태 업데이트 실패 (발주번호 존재하지 않음)
⚠️  에러 로그 기록: "발주번호 PO-999 상태 업데이트 실패"
✅ 사용자에게는 PDF 생성 실패 에러만 반환
```

---

## 📝 4. 구현 체크리스트

### Phase 1: updateOrderStatus() 개선
- [ ] ApiService.js:345-389 함수 리팩토링
- [ ] 4개 상태 컬럼 모두 지원 (buyOrder, payBuy, paySell, ship)
- [ ] null/undefined 값 무시 처리
- [ ] 에러 처리 강화
- [ ] 기존 호출부 동작 검증 (CommonScripts.html:2014)

### Phase 2: PDF 출력 시 상태 자동 변경
- [ ] InvoiceOutputService.js:24-340 수정
- [ ] updateOrderStatusAfterOutput_() 헬퍼 함수 추가
- [ ] ORDER_PURCHASE → 매입발주="발주완료"
- [ ] INVOICE_VAT/NVAT → 매출결제="결제완료"
- [ ] 에러 발생 시 PDF 생성은 정상 진행
- [ ] 로그 기록 추가

### Phase 3: 청구DB 구조 개선
- [ ] SettlementService.js:785-788 헤더 수정
- [ ] "발주번호목록" 컬럼 추가 (13번 인덱스)
- [ ] createBilling():806-820 rowData 수정
- [ ] 쉼표 구분 문자열로 저장
- [ ] 기존 청구서에는 빈 값으로 표시 (하위 호환성)

### Phase 4: reprintInvoiceApi() 구현
- [ ] ApiService.js에 새 함수 추가
- [ ] 청구ID → 발주번호 목록 조회
- [ ] 문서 유형 자동 결정 (청구유형 기반)
- [ ] generateInvoiceZip() 호출
- [ ] 에러 처리 (발주번호 없음, 컬럼 없음 등)
- [ ] 상수 추가 (OB_SETTLEMENT_SS_ID, OB_BILLING_SHEET)

### Phase 5: 청구서 발행 시 거래원장 연동
- [ ] SettlementService.js:928-998 수정
- [ ] updateLedgerStatusOnIssued_() 헬퍼 함수 추가
- [ ] ISSUED 상태 변경 시 거래원장 업데이트
- [ ] 매출결제 = "결제완료" 자동 설정
- [ ] 에러 발생 시 청구서 상태는 정상 변경
- [ ] 로그 기록 추가

### 백테스트
- [ ] Scenario 1: 발주서 출력 검증
- [ ] Scenario 2: 거래명세서 출력 검증
- [ ] Scenario 3: 청구서 생성 → 발행 검증
- [ ] Scenario 4: 청구서 재출력 검증
- [ ] Scenario 5: 다중 발주번호 출력 검증
- [ ] Scenario 6: 에러 처리 검증

---

## ⚠️ 5. 주의사항 및 제약사항

### 5.1 부분결제 처리
**현재 구현**: 무조건 "결제완료"로 설정
**문제점**: 실제로는 부분결제가 필요한 경우 있음
**향후 개선**:
- 확정수량 vs 발주수량 비교하여 부분결제 판단
- 또는 출력 횟수 추적하여 첫 출력은 부분결제, 마지막 출력은 결제완료

### 5.2 출력 취소 처리
**현재 구현**: 출력 즉시 상태 변경, 취소 불가
**문제점**: 잘못 출력하면 상태 되돌리기 어려움
**향후 개선**:
- 출력 이력 테이블 추가
- 출력 취소 기능 구현 (상태 롤백)

### 5.3 거래원장 컬럼명 변경 금지
**중요**: 다음 컬럼명은 절대 변경하면 안 됨:
- "발주번호"
- "매입발주"
- "매입결제"
- "매출결제"
- "출고"

만약 변경 필요 시:
1. 모든 `header.indexOf('컬럼명')` 코드 수정 필요
2. 데이터 마이그레이션 필요

### 5.4 에러 처리 철학
**원칙**: "PDF 생성 실패 > 상태 업데이트 실패"

- PDF 생성 실패 시 → 사용자에게 에러 표시
- 상태 업데이트 실패 시 → 로그만 기록, PDF는 정상 반환
- 이유: 출력 문서가 더 중요함 (사후 수동 처리 가능)

### 5.5 동시성 문제
**현재 구현**: 동시성 제어 없음
**잠재적 문제**:
- 2명이 동시에 같은 발주 출력 시 상태 충돌 가능
- Apps Script는 기본적으로 동기 처리되므로 큰 문제 없음
**향후 개선**: Lock Service 활용 고려

### 5.6 청구DB 마이그레이션
**필요 작업**: 기존 청구서에 "발주번호목록" 컬럼 없음
**해결 방안**:
- 새 헤더 추가 시 자동으로 빈 컬럼 생성됨
- 기존 청구서는 재출력 불가 (발주번호 정보 없음)
- 필요 시 수동으로 발주번호 채워넣기

---

## 📊 6. 영향도 분석

### 6.1 변경 파일

| 파일명 | 변경 타입 | 영향도 | 비고 |
|--------|----------|--------|------|
| ApiService.js | 함수 수정 + 추가 | 🔴 HIGH | updateOrderStatus, reprintInvoiceApi |
| InvoiceOutputService.js | 로직 추가 | 🟡 MEDIUM | generateInvoiceZip |
| SettlementService.js | 로직 추가 + 헤더 수정 | 🟡 MEDIUM | createBilling, updateBillingStatus |
| CommonScripts.html | 변경 없음 | 🟢 LOW | 기존 호출 방식 유지 |
| Templates_Invoice_VAT.html | 변경 없음 | 🟢 NONE | 템플릿 수정 불필요 |

### 6.2 하위 호환성

**✅ 유지됨**:
- 기존 updateOrderStatus() 호출부 정상 동작
- 기존 PDF 출력 기능 정상 동작
- 기존 청구서 조회 정상 동작

**⚠️ 제한됨**:
- 기존 청구서는 재출력 불가 (발주번호 정보 없음)
- 새 컬럼 없는 환경에서는 재출력 에러 (명확한 에러 메시지 표시)

### 6.3 롤백 계획

**Phase별 롤백 가능 여부**:
- Phase 1: ✅ 가능 (함수만 원복)
- Phase 2: ✅ 가능 (로직만 주석 처리)
- Phase 3: ⚠️ 부분 가능 (헤더 추가는 유지, 로직만 원복)
- Phase 4: ✅ 가능 (새 함수 제거)
- Phase 5: ✅ 가능 (로직만 주석 처리)

---

## 🚀 7. 구현 순서 권장사항

### 순차적 구현 (권장)
1. **Phase 1 먼저 구현 및 테스트** → 기반 함수 안정화
2. **Phase 3 구현** → DB 구조 준비
3. **Phase 2 구현 및 테스트** → PDF 출력 연동
4. **Phase 4 구현** → 재출력 기능
5. **Phase 5 구현** → 청구서 발행 연동

### 이유
- Phase 1 없이는 나머지 Phase 동작 불가
- Phase 3 없이는 Phase 4 동작 불가
- Phase 2와 Phase 5는 독립적으로 테스트 가능

---

## 📌 8. 추가 고려사항

### 8.1 부가 기능 (향후 Phase)

**1. 출력 이력 추적**
- 새 시트: "출력이력DB"
- 컬럼: 출력ID, 발주번호, 문서유형, 출력일시, 출력자, 파일ID
- 용도: 재출력, 출력 취소, 감사 추적

**2. 부분결제 자동 판단**
- 확정수량 < 발주수량 → 부분결제
- 확정수량 = 발주수량 → 결제완료

**3. 청구서-출력 연결 강화**
- 청구서 생성 시 자동으로 PDF 생성
- 청구서 발행 = PDF 생성 + 상태 변경 원자적 처리

**4. 알림 기능**
- 청구서 발행 시 이메일 발송
- 출력 완료 시 슬랙 알림

### 8.2 성능 최적화

**현재 구현**:
- updateOrderStatus()가 전체 시트 읽기 (O(n))
- 발주번호당 개별 업데이트 (O(m))

**최적화 방안**:
- 배치 업데이트: setValues() 사용
- 인덱싱: 발주번호 → 행번호 매핑 캐시

---

## ✅ 9. 최종 검증 항목

### 기능 검증
- [ ] 발주서 출력 시 매입발주 상태 변경
- [ ] 거래명세서 출력 시 매출결제 상태 변경
- [ ] 청구서 생성 시 발주번호 저장
- [ ] 청구서 발행 시 매출결제 상태 변경
- [ ] 청구서 재출력 정상 동작
- [ ] 에러 처리 정상 동작

### 데이터 무결성
- [ ] 거래원장 상태 값이 허용된 값만 저장
- [ ] 청구DB의 발주번호목록 형식 정확
- [ ] 동일 발주번호 중복 처리 없음

### 사용자 경험
- [ ] 에러 메시지 명확
- [ ] 처리 속도 3초 이내
- [ ] 로그 메시지 적절

---

**명세서 버전**: 1.0
**최종 검토일**: 2026-01-21
**검토자**: Claude Code Agent

