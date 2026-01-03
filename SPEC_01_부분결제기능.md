# 📋 기능 명세서 #1: 부분 결제 기능

**작성일**: 2026-01-03
**대상 시스템**: OneBridge ERP - 결제관리 시스템
**우선순위**: ⭐⭐⭐⭐⭐ (최우선)

---

## 1. 개요

### 1.1 현재 상황 (진단 결과 기반)

**문제점:**
- 현재 시스템은 청구 금액과 결제 금액이 **정확히 일치**해야만 처리 가능
- `PaymentService.js:243`의 검증 로직: 금액 불일치 시 저장 차단
- 청구DB에 부분 결제 추적 컬럼 없음 (결제완료금액, 미수금)

**실제 업무 사례:**
```
예시 1: 선입금 + 잔금
- 청구금액: 10,000,000원
- 1차 결제: 3,000,000원 (선입금)
- 2차 결제: 7,000,000원 (잔금)

예시 2: 분할 지급
- 청구금액: 5,000,000원
- 1차 결제: 2,000,000원
- 2차 결제: 2,000,000원
- 3차 결제: 1,000,000원
```

**비즈니스 가치**: ⭐⭐⭐⭐⭐ (매우 높음)
- B2B 거래에서 필수적인 기능
- 현금 흐름 관리의 핵심
- 현재 워크어라운드 없이는 처리 불가능

---

## 2. 데이터베이스 스키마 변경

### 2.1 청구DB 시트 확장

**현재 구조 (진단 결과):**
```
총 19개 컬럼:
청구ID, 청구유형, 업체명, 마감ID, 청구일, 청구금액, 청구상태,
청구타입, 발주번호, 비고, 생성일시, 생성자, 발행일시, 발행자,
결제일시, 대체청구서, 원본청구서, billingType, orderNumbers
```

**추가 필요 컬럼 (3개):**

| 컬럼명 | 위치 | 데이터 타입 | 기본값 | 설명 |
|--------|------|------------|--------|------|
| `결제완료금액` | 20번째 (T열) | Number | 0 | 누적 결제된 총액 |
| `미수금` | 21번째 (U열) | Number | =청구금액 | 청구금액 - 결제완료금액 |
| `최종결제일` | 22번째 (V열) | Date | (빈값) | 가장 최근 결제 일시 |

**마이그레이션 스크립트:**

```javascript
/**
 * 청구DB 스키마 확장 (부분 결제 지원)
 * 파일: MigrateInvoiceSchemaForPartialPayment.js
 */
function migrateInvoiceSchemaForPartialPayment() {
  var ss = SpreadsheetApp.openById('1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs');
  var sheet = ss.getSheetByName('청구DB');

  if (!sheet) {
    throw new Error('청구DB 시트를 찾을 수 없습니다.');
  }

  // 현재 헤더 확인
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log('[Migration] 현재 컬럼 수: ' + headers.length);

  // 이미 추가되었는지 확인
  if (headers.indexOf('결제완료금액') !== -1) {
    Logger.log('[Migration] 이미 마이그레이션 완료됨');
    return { success: true, message: '이미 마이그레이션 완료' };
  }

  // 1. 헤더 추가 (20, 21, 22번째 컬럼)
  var startCol = headers.length + 1;
  var newHeaders = ['결제완료금액', '미수금', '최종결제일'];

  sheet.getRange(1, startCol, 1, 3).setValues([newHeaders]);

  // 헤더 스타일 적용
  sheet.getRange(1, startCol, 1, 3)
    .setFontWeight('bold')
    .setBackground('#f1f5f9')
    .setHorizontalAlignment('center');

  // 컬럼 너비 설정
  sheet.setColumnWidth(startCol, 120);     // 결제완료금액
  sheet.setColumnWidth(startCol + 1, 120); // 미수금
  sheet.setColumnWidth(startCol + 2, 100); // 최종결제일

  Logger.log('[Migration] 헤더 추가 완료: ' + newHeaders.join(', '));

  // 2. 기존 데이터 마이그레이션
  var dataRange = sheet.getDataRange();
  var data = dataRange.getValues();

  var 청구금액Col = headers.indexOf('청구금액');
  var 청구상태Col = headers.indexOf('청구상태');
  var 결제일시Col = headers.indexOf('결제일시');

  if (청구금액Col === -1 || 청구상태Col === -1) {
    throw new Error('필수 컬럼을 찾을 수 없습니다.');
  }

  // 헤더 제외한 데이터 행 처리
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var 청구금액 = Number(row[청구금액Col]) || 0;
    var 청구상태 = row[청구상태Col];
    var 결제일시 = row[결제일시Col];

    var 결제완료금액 = 0;
    var 미수금 = 청구금액;
    var 최종결제일 = '';

    // 상태가 PAID인 경우 → 완납으로 간주
    if (청구상태 === 'PAID') {
      결제완료금액 = 청구금액;
      미수금 = 0;
      최종결제일 = 결제일시 || new Date();
    }

    // 데이터 입력
    sheet.getRange(i + 1, startCol).setValue(결제완료금액);
    sheet.getRange(i + 1, startCol + 1).setValue(미수금);
    if (최종결제일) {
      sheet.getRange(i + 1, startCol + 2).setValue(최종결제일);
    }
  }

  Logger.log('[Migration] 기존 데이터 마이그레이션 완료: ' + (data.length - 1) + '건');

  // 3. 미수금 수식 설정 (신규 행용)
  // Note: 기존 행은 고정값, 신규 행은 수식으로 자동 계산
  var lastRow = sheet.getLastRow();
  var formulaRange = sheet.getRange(lastRow + 1, startCol + 1, 100, 1);
  var formula = '=IF(ISBLANK(F' + (lastRow + 1) + '), "", F' + (lastRow + 1) + '-T' + (lastRow + 1) + ')';
  // F열=청구금액, T열=결제완료금액

  // Note: 실제로는 각 행마다 동적으로 계산하도록 함수로 처리

  Logger.log('[Migration] 스키마 확장 완료');

  return {
    success: true,
    message: '청구DB 스키마 확장 완료',
    addedColumns: newHeaders,
    migratedRows: data.length - 1
  };
}

/**
 * 실행 함수
 */
function runInvoiceSchemaMigration() {
  try {
    Logger.log('========================================');
    Logger.log('청구DB 스키마 확장 마이그레이션 시작');
    Logger.log('========================================');

    var result = migrateInvoiceSchemaForPartialPayment();

    Logger.log('');
    Logger.log('✅ 마이그레이션 성공');
    Logger.log('   메시지: ' + result.message);
    Logger.log('   추가 컬럼: ' + result.addedColumns.join(', '));
    Logger.log('   마이그레이션된 행: ' + result.migratedRows);
    Logger.log('========================================');

    return result;

  } catch (error) {
    Logger.log('');
    Logger.log('❌ 마이그레이션 실패');
    Logger.log('   오류: ' + error.message);
    Logger.log('   Stack: ' + error.stack);
    Logger.log('========================================');

    return {
      success: false,
      error: error.message
    };
  }
}
```

### 2.2 청구상태 확장

**기존 상태:**
```
DRAFT     - 임시저장
ISSUED    - 발행완료
PAID      - 입금완료
```

**추가 상태:**
```
PAID_PARTIAL - 부분결제 (신규)
```

**상태 전이도:**
```
DRAFT
  ↓
ISSUED (청구 발행)
  ↓
PAID_PARTIAL (일부 결제) ←→ (추가 결제)
  ↓
PAID (완납)
```

---

## 3. 백엔드 로직 구현

### 3.1 PaymentService.js 수정

#### 3.1.1 결제 저장 함수 수정

**파일**: `PaymentService.js`
**함수**: `saveMultiplePayment()`
**현재 위치**: PaymentService.js:243

**현재 로직 (엄격한 검증):**
```javascript
// 현재: 금액 완전 일치만 허용
if (paymentAmount !== invoiceAmount) {
  return {
    valid: false,
    error: '결제 금액(' + paymentAmount + ')이 청구 금액(' + invoiceAmount + ')과 일치하지 않습니다.'
  };
}
```

**변경 로직 (부분 결제 허용):**
```javascript
/**
 * 부분 결제 검증 로직
 * PaymentService.js에 추가
 */
function validatePartialPayment(invoice, paymentAmount) {
  var 청구금액 = Number(invoice.amount) || 0;
  var 결제완료금액 = Number(invoice.paidAmount) || 0;  // 기존 결제액
  var 미수금 = 청구금액 - 결제완료금액;

  // 1. 결제 금액이 0 이하인지 확인
  if (paymentAmount <= 0) {
    return {
      valid: false,
      error: '결제 금액은 0보다 커야 합니다.'
    };
  }

  // 2. 결제 금액이 미수금을 초과하는지 확인
  if (paymentAmount > 미수금) {
    return {
      valid: false,
      error: '결제 금액(' + formatNumber(paymentAmount) + '원)이 미수금(' +
             formatNumber(미수금) + '원)을 초과합니다.\n' +
             '청구금액: ' + formatNumber(청구금액) + '원\n' +
             '기결제액: ' + formatNumber(결제완료금액) + '원'
    };
  }

  // 3. 결제 후 잔액 계산
  var 결제후잔액 = 미수금 - paymentAmount;
  var 완납여부 = 결제후잔액 === 0;

  return {
    valid: true,
    청구금액: 청구금액,
    기결제액: 결제완료금액,
    금회결제액: paymentAmount,
    결제후잔액: 결제후잔액,
    완납여부: 완납여부,
    신규상태: 완납여부 ? 'PAID' : 'PAID_PARTIAL'
  };
}
```

#### 3.1.2 결제 저장 프로세스 수정

```javascript
/**
 * 다중 청구서 결제 저장 (부분 결제 지원)
 * PaymentService.js 수정
 */
function saveMultiplePayment(params) {
  try {
    var paymentDate = params.paymentDate;
    var paymentType = params.paymentType;  // '입금' 또는 '출금'
    var paymentMethod = params.paymentMethod;
    var paymentItems = params.paymentItems;  // [{invoiceId, amount, notes}, ...]
    var user = Session.getActiveUser().getEmail();
    var now = new Date();

    Logger.log('[saveMultiplePayment] 결제 저장 시작, 건수: ' + paymentItems.length);

    var ss = SpreadsheetApp.openById('1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs');
    var paymentSheet = ss.getSheetByName('결제내역');
    var invoiceSheet = ss.getSheetByName('청구DB');

    if (!paymentSheet || !invoiceSheet) {
      throw new Error('필요한 시트를 찾을 수 없습니다.');
    }

    // 청구DB 헤더 및 데이터
    var invoiceData = invoiceSheet.getDataRange().getValues();
    var invoiceHeaders = invoiceData[0];

    var 청구IDCol = invoiceHeaders.indexOf('청구ID');
    var 청구금액Col = invoiceHeaders.indexOf('청구금액');
    var 청구상태Col = invoiceHeaders.indexOf('청구상태');
    var 결제완료금액Col = invoiceHeaders.indexOf('결제완료금액');
    var 미수금Col = invoiceHeaders.indexOf('미수금');
    var 최종결제일Col = invoiceHeaders.indexOf('최종결제일');
    var orderNumbersCol = invoiceHeaders.indexOf('orderNumbers');

    // 결과 저장
    var savedPayments = [];
    var updatedInvoices = [];

    // 각 결제 항목 처리
    for (var i = 0; i < paymentItems.length; i++) {
      var item = paymentItems[i];
      var invoiceId = item.invoiceId;
      var paymentAmount = Number(item.amount);
      var notes = item.notes || '';

      // 1. 청구서 찾기
      var invoiceRowIndex = -1;
      var invoiceRow = null;

      for (var j = 1; j < invoiceData.length; j++) {
        if (invoiceData[j][청구IDCol] === invoiceId) {
          invoiceRowIndex = j + 1;  // 시트 행 번호 (1-based)
          invoiceRow = invoiceData[j];
          break;
        }
      }

      if (!invoiceRow) {
        Logger.log('[saveMultiplePayment] 청구서를 찾을 수 없음: ' + invoiceId);
        continue;
      }

      // 2. 부분 결제 검증
      var 청구금액 = Number(invoiceRow[청구금액Col]) || 0;
      var 기결제액 = Number(invoiceRow[결제완료금액Col]) || 0;
      var 미수금 = 청구금액 - 기결제액;

      var validation = validatePartialPayment({
        amount: 청구금액,
        paidAmount: 기결제액
      }, paymentAmount);

      if (!validation.valid) {
        throw new Error('[' + invoiceId + '] ' + validation.error);
      }

      // 3. 결제 ID 생성
      var dateStr = Utilities.formatDate(new Date(paymentDate), Session.getScriptTimeZone(), 'yyyyMMdd');
      var seq = getNextPaymentSequence(paymentSheet, dateStr);
      var paymentId = 'PAY-' + dateStr + '-' + String(seq).padStart(3, '0');

      // 4. 결제내역 시트에 저장
      var paymentRowData = [
        paymentId,                  // 결제ID
        paymentDate,                // 결제일
        paymentType,                // 결제유형 (입금/출금)
        invoiceRow[invoiceHeaders.indexOf('업체명')],  // 거래처명
        paymentAmount,              // 금액
        paymentMethod,              // 결제수단
        invoiceId,                  // 문서번호 (청구ID)
        '',                         // 발주번호 (필요시 추후 추가)
        notes,                      // 비고
        false,                      // 삭제여부
        '',                         // 삭제일시
        '',                         // 삭제자
        now,                        // 입력일시
        user                        // 입력자
      ];

      paymentSheet.appendRow(paymentRowData);
      Logger.log('[saveMultiplePayment] 결제내역 저장: ' + paymentId + ', 금액: ' + paymentAmount);

      savedPayments.push({
        paymentId: paymentId,
        invoiceId: invoiceId,
        amount: paymentAmount
      });

      // 5. 청구DB 업데이트
      var 신규결제완료금액 = 기결제액 + paymentAmount;
      var 신규미수금 = 청구금액 - 신규결제완료금액;
      var 신규상태 = validation.신규상태;  // 'PAID' 또는 'PAID_PARTIAL'

      invoiceSheet.getRange(invoiceRowIndex, 청구상태Col + 1).setValue(신규상태);
      invoiceSheet.getRange(invoiceRowIndex, 결제완료금액Col + 1).setValue(신규결제완료금액);
      invoiceSheet.getRange(invoiceRowIndex, 미수금Col + 1).setValue(신규미수금);
      invoiceSheet.getRange(invoiceRowIndex, 최종결제일Col + 1).setValue(now);

      Logger.log('[saveMultiplePayment] 청구서 업데이트: ' + invoiceId +
                 ', 상태: ' + 신규상태 +
                 ', 결제완료금액: ' + 신규결제완료금액 +
                 ', 미수금: ' + 신규미수금);

      updatedInvoices.push({
        invoiceId: invoiceId,
        status: 신규상태,
        paidAmount: 신규결제완료금액,
        remainingAmount: 신규미수금
      });

      // 6. 거래원장 결제 상태 업데이트
      var orderNumbers = invoiceRow[orderNumbersCol];
      if (orderNumbers) {
        try {
          var orderNumbersArray = JSON.parse(orderNumbers);
          updateLedgerPaymentStatus(orderNumbersArray, 신규상태, invoiceRow[invoiceHeaders.indexOf('청구유형')]);
        } catch (e) {
          Logger.log('[saveMultiplePayment] 거래원장 업데이트 실패: ' + e.message);
        }
      }
    }

    Logger.log('[saveMultiplePayment] 저장 완료, 결제: ' + savedPayments.length + '건, 청구서 업데이트: ' + updatedInvoices.length + '건');

    return {
      success: true,
      message: savedPayments.length + '건의 결제가 저장되었습니다.',
      savedPayments: savedPayments,
      updatedInvoices: updatedInvoices
    };

  } catch (error) {
    Logger.log('[saveMultiplePayment Error] ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 결제 일련번호 생성
 */
function getNextPaymentSequence(sheet, dateStr) {
  var data = sheet.getDataRange().getValues();
  var maxSeq = 0;

  for (var i = 1; i < data.length; i++) {
    var paymentId = data[i][0];  // 결제ID (A열)
    if (paymentId && paymentId.startsWith('PAY-' + dateStr)) {
      var parts = paymentId.split('-');
      if (parts.length === 3) {
        var seq = parseInt(parts[2], 10);
        if (seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
  }

  return maxSeq + 1;
}

/**
 * 거래원장 결제 상태 업데이트
 */
function updateLedgerPaymentStatus(orderNumbers, paymentStatus, invoiceType) {
  var ss = SpreadsheetApp.openById('1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs');
  var ledgerSheet = ss.getSheetByName('거래원장');

  if (!ledgerSheet) {
    Logger.log('[updateLedgerPaymentStatus] 거래원장 시트를 찾을 수 없음');
    return;
  }

  var data = ledgerSheet.getDataRange().getValues();
  var headers = data[0];

  var 발주번호Col = headers.indexOf('발주번호');
  var 매입결제Col = headers.indexOf('매입결제');
  var 매출결제Col = headers.indexOf('매출결제');

  if (발주번호Col === -1) {
    Logger.log('[updateLedgerPaymentStatus] 발주번호 컬럼을 찾을 수 없음');
    return;
  }

  // 결제 상태 매핑
  var statusText = '미결제';
  if (paymentStatus === 'PAID') {
    statusText = '결제완료';
  } else if (paymentStatus === 'PAID_PARTIAL') {
    statusText = '부분결제';
  }

  // 업데이트할 컬럼 결정
  var targetCol = (invoiceType === 'PURCHASE') ? 매입결제Col : 매출결제Col;

  if (targetCol === -1) {
    Logger.log('[updateLedgerPaymentStatus] 결제 상태 컬럼을 찾을 수 없음');
    return;
  }

  var updatedCount = 0;

  // 발주번호 배열을 순회하며 거래원장 업데이트
  for (var i = 0; i < orderNumbers.length; i++) {
    var orderNumber = orderNumbers[i];

    for (var j = 1; j < data.length; j++) {
      if (data[j][발주번호Col] === orderNumber) {
        ledgerSheet.getRange(j + 1, targetCol + 1).setValue(statusText);
        updatedCount++;
      }
    }
  }

  Logger.log('[updateLedgerPaymentStatus] 거래원장 업데이트 완료: ' + updatedCount + '건');
}
```

### 3.2 SettlementService.js 수정

#### 3.2.1 청구서 생성 시 초기값 설정

**파일**: `SettlementService.js`
**함수**: `createBilling()`

```javascript
// createBilling() 함수 내 rowData 생성 부분 수정

// 기존
var rowData = [
  billingId,
  standardizedType,
  company,
  settlementId,
  billingDate,
  amount,
  'DRAFT',
  // ...
];

// 변경 (결제완료금액, 미수금, 최종결제일 초기화 추가)
var rowData = [
  billingId,
  standardizedType,
  company,
  settlementId,
  billingDate,
  amount,
  'DRAFT',        // 청구상태
  '',             // 청구타입
  orderNumbersJson,
  notes,
  now,            // 생성일시
  user,           // 생성자
  '',             // 발행일시
  '',             // 발행자
  '',             // 결제일시
  '',             // 대체청구서
  '',             // 원본청구서
  billingType,
  orderNumbersJson,
  0,              // 결제완료금액 (초기값 0)
  amount,         // 미수금 (초기값 = 청구금액)
  ''              // 최종결제일 (초기값 빈값)
];
```

### 3.3 ApiService.js 추가

```javascript
/**
 * 청구서 결제 정보 조회 (부분 결제 지원)
 * ApiService.js 추가
 */
function getInvoicePaymentInfoApi(invoiceId) {
  var result = getInvoicePaymentInfo(invoiceId);
  return safeReturn(result);
}

/**
 * 청구서 결제 정보 조회 (PaymentService.js)
 */
function getInvoicePaymentInfo(invoiceId) {
  try {
    var ss = SpreadsheetApp.openById('1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs');
    var invoiceSheet = ss.getSheetByName('청구DB');
    var paymentSheet = ss.getSheetByName('결제내역');

    if (!invoiceSheet || !paymentSheet) {
      return { success: false, error: '필요한 시트를 찾을 수 없습니다.' };
    }

    // 1. 청구서 조회
    var invoiceData = invoiceSheet.getDataRange().getValues();
    var invoiceHeaders = invoiceData[0];

    var invoiceRow = null;
    for (var i = 1; i < invoiceData.length; i++) {
      if (invoiceData[i][invoiceHeaders.indexOf('청구ID')] === invoiceId) {
        invoiceRow = invoiceData[i];
        break;
      }
    }

    if (!invoiceRow) {
      return { success: false, error: '청구서를 찾을 수 없습니다: ' + invoiceId };
    }

    // 2. 청구서 정보
    var invoice = {
      invoiceId: invoiceId,
      amount: invoiceRow[invoiceHeaders.indexOf('청구금액')],
      paidAmount: invoiceRow[invoiceHeaders.indexOf('결제완료금액')] || 0,
      remainingAmount: invoiceRow[invoiceHeaders.indexOf('미수금')],
      lastPaymentDate: invoiceRow[invoiceHeaders.indexOf('최종결제일')],
      status: invoiceRow[invoiceHeaders.indexOf('청구상태')]
    };

    // 3. 결제 내역 조회
    var paymentData = paymentSheet.getDataRange().getValues();
    var paymentHeaders = paymentData[0];

    var payments = [];
    for (var i = 1; i < paymentData.length; i++) {
      if (paymentData[i][paymentHeaders.indexOf('문서번호')] === invoiceId &&
          !paymentData[i][paymentHeaders.indexOf('삭제여부')]) {
        payments.push({
          paymentId: paymentData[i][paymentHeaders.indexOf('결제ID')],
          paymentDate: formatDateString(paymentData[i][paymentHeaders.indexOf('결제일')]),
          amount: paymentData[i][paymentHeaders.indexOf('금액')],
          paymentMethod: paymentData[i][paymentHeaders.indexOf('결제수단')],
          notes: paymentData[i][paymentHeaders.indexOf('비고')]
        });
      }
    }

    return {
      success: true,
      invoice: invoice,
      payments: payments,
      paymentCount: payments.length
    };

  } catch (error) {
    Logger.log('[getInvoicePaymentInfo Error] ' + error.message);
    return { success: false, error: error.message };
  }
}
```

---

## 4. 프론트엔드 UI 구현

### 4.1 결제 입력 모달 수정

**파일**: `CommonScripts.html`
**함수**: `showPaymentStep4()` (Step 4: 결제 정보 입력)

#### 4.1.1 청구서 상세 조회 시 부분 결제 정보 표시

```javascript
/**
 * Step 4: 결제 정보 입력 (부분 결제 지원)
 * CommonScripts.html 수정
 */
function showPaymentStep4(selectedInvoices) {
  OB.showLoading('결제 정보를 불러오는 중...');

  // 각 청구서의 결제 정보 조회
  var invoicePaymentInfoPromises = selectedInvoices.map(function(invoice) {
    return new Promise(function(resolve, reject) {
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            resolve({
              invoice: invoice,
              paymentInfo: result.invoice,
              paymentHistory: result.payments
            });
          } else {
            reject(result.error);
          }
        })
        .withFailureHandler(reject)
        .getInvoicePaymentInfoApi(invoice.billingId);
    });
  });

  Promise.all(invoicePaymentInfoPromises)
    .then(function(results) {
      OB.hideLoading();
      renderPaymentStep4WithPartialPayment(results);
    })
    .catch(function(error) {
      OB.hideLoading();
      alert('결제 정보 조회 실패: ' + error);
    });
}

/**
 * Step 4 렌더링 (부분 결제 표시 포함)
 */
function renderPaymentStep4WithPartialPayment(invoicePaymentData) {
  var modal = document.getElementById('payment-modal');
  var body = modal.querySelector('.payment-modal-body');

  // 총 청구금액, 총 미수금 계산
  var totalInvoiceAmount = 0;
  var totalRemainingAmount = 0;
  var totalPaidAmount = 0;

  invoicePaymentData.forEach(function(data) {
    totalInvoiceAmount += Number(data.invoice.amount) || 0;
    totalRemainingAmount += Number(data.paymentInfo.remainingAmount) || 0;
    totalPaidAmount += Number(data.paymentInfo.paidAmount) || 0;
  });

  var html = '';
  html += '<div class="payment-step-indicator">[Step 4/4] 결제 정보 입력</div>';
  html += '<div class="payment-step-content">';

  // 전체 요약 카드
  html += '<div class="payment-summary-total">';
  html += '  <div class="summary-item">';
  html += '    <div class="summary-label">총 청구금액</div>';
  html += '    <div class="summary-value">' + OB.formatCurrency(totalInvoiceAmount) + '</div>';
  html += '  </div>';
  html += '  <div class="summary-item highlight">';
  html += '    <div class="summary-label">기결제액</div>';
  html += '    <div class="summary-value paid">' + OB.formatCurrency(totalPaidAmount) + '</div>';
  html += '  </div>';
  html += '  <div class="summary-item highlight">';
  html += '    <div class="summary-label">총 미수금</div>';
  html += '    <div class="summary-value remaining">' + OB.formatCurrency(totalRemainingAmount) + '</div>';
  html += '  </div>';
  html += '</div>';

  // 개별 청구서별 결제 입력
  html += '<div class="payment-items-container">';

  invoicePaymentData.forEach(function(data, index) {
    var invoice = data.invoice;
    var paymentInfo = data.paymentInfo;
    var paymentHistory = data.paymentHistory;

    var invoiceAmount = Number(invoice.amount) || 0;
    var paidAmount = Number(paymentInfo.paidAmount) || 0;
    var remainingAmount = Number(paymentInfo.remainingAmount) || invoiceAmount;

    html += '<div class="payment-item-card" data-index="' + index + '">';
    html += '  <div class="payment-item-header">';
    html += '    <span class="invoice-id">' + invoice.billingId + '</span>';
    html += '    <span class="company-name">' + invoice.company + '</span>';
    html += '  </div>';

    html += '  <div class="payment-item-body">';

    // 청구 정보
    html += '    <div class="payment-info-grid">';
    html += '      <div class="info-item">';
    html += '        <div class="info-label">청구금액</div>';
    html += '        <div class="info-value">' + OB.formatCurrency(invoiceAmount) + '</div>';
    html += '      </div>';

    // 기결제액 (부분 결제 표시)
    if (paidAmount > 0) {
      html += '      <div class="info-item highlight">';
      html += '        <div class="info-label">기결제액</div>';
      html += '        <div class="info-value paid">' + OB.formatCurrency(paidAmount) + '</div>';
      html += '      </div>';
    }

    html += '      <div class="info-item highlight">';
    html += '        <div class="info-label">' + (paidAmount > 0 ? '미수금' : '결제 대상 금액') + '</div>';
    html += '        <div class="info-value remaining">' + OB.formatCurrency(remainingAmount) + '</div>';
    html += '      </div>';
    html += '    </div>';

    // 결제 이력 표시 (부분 결제가 있는 경우)
    if (paymentHistory.length > 0) {
      html += '    <div class="payment-history">';
      html += '      <div class="history-header">';
      html += '        <span>📜 결제 이력 (' + paymentHistory.length + '건)</span>';
      html += '        <button type="button" class="btn-toggle-history" onclick="togglePaymentHistory(' + index + ')">펼치기</button>';
      html += '      </div>';
      html += '      <div class="history-body" id="history-' + index + '" style="display:none;">';
      html += '        <table class="history-table">';
      html += '          <thead>';
      html += '            <tr>';
      html += '              <th>결제일</th>';
      html += '              <th>결제ID</th>';
      html += '              <th>금액</th>';
      html += '              <th>결제수단</th>';
      html += '            </tr>';
      html += '          </thead>';
      html += '          <tbody>';
      paymentHistory.forEach(function(payment) {
        html += '            <tr>';
        html += '              <td>' + payment.paymentDate + '</td>';
        html += '              <td>' + payment.paymentId + '</td>';
        html += '              <td class="num">' + OB.formatCurrency(payment.amount) + '</td>';
        html += '              <td>' + payment.paymentMethod + '</td>';
        html += '            </tr>';
      });
      html += '          </tbody>';
      html += '        </table>';
      html += '      </div>';
      html += '    </div>';
    }

    // 금회 결제 입력
    html += '    <div class="payment-input-section">';
    html += '      <label for="payment-amount-' + index + '">금회 결제액 *</label>';
    html += '      <input type="number" ';
    html += '             id="payment-amount-' + index + '" ';
    html += '             class="payment-amount-input" ';
    html += '             data-invoice-id="' + invoice.billingId + '" ';
    html += '             data-max-amount="' + remainingAmount + '" ';
    html += '             placeholder="결제 금액을 입력하세요" ';
    html += '             min="0" ';
    html += '             max="' + remainingAmount + '" ';
    html += '             onkeyup="updatePaymentSummary(' + index + ')" />';
    html += '      <div class="input-hint">';
    html += '        최대 입력 가능: <span class="max-amount">' + OB.formatCurrency(remainingAmount) + '</span>';
    html += '      </div>';
    html += '      <div class="remaining-after-payment" id="remaining-after-' + index + '"></div>';
    html += '    </div>';

    html += '    <div class="payment-notes-section">';
    html += '      <label for="payment-notes-' + index + '">비고</label>';
    html += '      <input type="text" ';
    html += '             id="payment-notes-' + index + '" ';
    html += '             class="payment-notes-input" ';
    html += '             placeholder="예: 1차 선입금" />';
    html += '    </div>';

    html += '  </div>';
    html += '</div>';
  });

  html += '</div>';  // payment-items-container

  // 결제 수단 및 날짜 선택
  html += '<div class="payment-common-info">';
  html += '  <h3>공통 결제 정보</h3>';
  html += '  <div class="common-info-grid">';
  html += '    <div class="field">';
  html += '      <label for="payment-date">결제일 *</label>';
  html += '      <input type="date" id="payment-date" value="' + getTodayString() + '" />';
  html += '    </div>';
  html += '    <div class="field">';
  html += '      <label for="payment-method">결제수단 *</label>';
  html += '      <select id="payment-method">';
  html += '        <option value="계좌이체">계좌이체</option>';
  html += '        <option value="현금">현금</option>';
  html += '        <option value="카드">카드</option>';
  html += '        <option value="기타">기타</option>';
  html += '      </select>';
  html += '    </div>';
  html += '  </div>';
  html += '</div>';

  // 최종 합계
  html += '<div class="payment-final-summary" id="payment-final-summary">';
  html += '  <div class="summary-row">';
  html += '    <span>금회 결제 총액:</span>';
  html += '    <span class="total-payment-amount" id="total-payment-amount">₩0</span>';
  html += '  </div>';
  html += '  <div class="summary-row">';
  html += '    <span>결제 후 잔여 미수금:</span>';
  html += '    <span class="total-remaining-amount" id="total-remaining-amount">' + OB.formatCurrency(totalRemainingAmount) + '</span>';
  html += '  </div>';
  html += '</div>';

  html += '</div>';  // payment-step-content

  // 버튼
  html += '<div class="payment-modal-footer">';
  html += '  <button class="payment-btn secondary" onclick="showPaymentStep3()">← 이전</button>';
  html += '  <button class="payment-btn primary" onclick="submitPartialPayment()">💾 저장</button>';
  html += '</div>';

  body.innerHTML = html;

  // 모달 상태 업데이트
  modal.dataset.currentStep = '4';
  modal.dataset.invoiceData = JSON.stringify(invoicePaymentData);
}

/**
 * 결제 금액 입력 시 실시간 업데이트
 */
function updatePaymentSummary(index) {
  var amountInput = document.getElementById('payment-amount-' + index);
  var remainingDiv = document.getElementById('remaining-after-' + index);

  var inputAmount = Number(amountInput.value) || 0;
  var maxAmount = Number(amountInput.dataset.maxAmount) || 0;

  // 초과 입력 방지
  if (inputAmount > maxAmount) {
    amountInput.value = maxAmount;
    inputAmount = maxAmount;
  }

  // 결제 후 잔액 표시
  var remainingAfter = maxAmount - inputAmount;
  if (inputAmount > 0) {
    if (remainingAfter === 0) {
      remainingDiv.innerHTML = '<span class="complete">✅ 완납 처리됩니다</span>';
      remainingDiv.className = 'remaining-after-payment complete';
    } else {
      remainingDiv.innerHTML = '결제 후 미수금: <span class="amount">' + OB.formatCurrency(remainingAfter) + '</span>';
      remainingDiv.className = 'remaining-after-payment partial';
    }
  } else {
    remainingDiv.innerHTML = '';
  }

  // 전체 합계 업데이트
  updateTotalPaymentSummary();
}

/**
 * 전체 결제 합계 업데이트
 */
function updateTotalPaymentSummary() {
  var amountInputs = document.querySelectorAll('.payment-amount-input');
  var totalPayment = 0;
  var totalRemaining = 0;

  amountInputs.forEach(function(input) {
    var amount = Number(input.value) || 0;
    var maxAmount = Number(input.dataset.maxAmount) || 0;

    totalPayment += amount;
    totalRemaining += (maxAmount - amount);
  });

  document.getElementById('total-payment-amount').textContent = OB.formatCurrency(totalPayment);
  document.getElementById('total-remaining-amount').textContent = OB.formatCurrency(totalRemaining);
}

/**
 * 결제 이력 토글
 */
function togglePaymentHistory(index) {
  var historyBody = document.getElementById('history-' + index);
  var button = historyBody.previousElementSibling.querySelector('.btn-toggle-history');

  if (historyBody.style.display === 'none') {
    historyBody.style.display = 'block';
    button.textContent = '접기';
  } else {
    historyBody.style.display = 'none';
    button.textContent = '펼치기';
  }
}

/**
 * 부분 결제 제출
 */
function submitPartialPayment() {
  var paymentDate = document.getElementById('payment-date').value;
  var paymentMethod = document.getElementById('payment-method').value;

  if (!paymentDate) {
    alert('결제일을 선택해주세요.');
    return;
  }

  // 결제 항목 수집
  var amountInputs = document.querySelectorAll('.payment-amount-input');
  var paymentItems = [];
  var totalAmount = 0;

  amountInputs.forEach(function(input, index) {
    var amount = Number(input.value) || 0;

    if (amount > 0) {
      var invoiceId = input.dataset.invoiceId;
      var notesInput = document.getElementById('payment-notes-' + index);
      var notes = notesInput ? notesInput.value : '';

      paymentItems.push({
        invoiceId: invoiceId,
        amount: amount,
        notes: notes
      });

      totalAmount += amount;
    }
  });

  if (paymentItems.length === 0) {
    alert('결제 금액을 입력해주세요.');
    return;
  }

  if (!confirm('총 ' + OB.formatCurrency(totalAmount) + '원을 결제하시겠습니까?\n\n' +
               '결제 건수: ' + paymentItems.length + '건')) {
    return;
  }

  OB.showLoading('결제 정보를 저장하는 중...');

  var modal = document.getElementById('payment-modal');
  var paymentType = modal.dataset.paymentType;

  google.script.run
    .withSuccessHandler(function(result) {
      OB.hideLoading();

      if (result.success) {
        alert('✅ ' + result.message + '\n\n' +
              '저장된 결제: ' + result.savedPayments.length + '건\n' +
              '업데이트된 청구서: ' + result.updatedInvoices.length + '건');

        closePaymentModal();

        // 결제 목록 새로고침
        if (typeof loadPaymentList === 'function') {
          loadPaymentList();
        }
        if (typeof loadPaymentSummary === 'function') {
          loadPaymentSummary();
        }
      } else {
        alert('❌ 저장 실패\n\n' + result.error);
      }
    })
    .withFailureHandler(function(error) {
      OB.hideLoading();
      alert('❌ 서버 오류\n\n' + error.message);
    })
    .saveMultiplePayment({
      paymentDate: paymentDate,
      paymentType: paymentType,
      paymentMethod: paymentMethod,
      paymentItems: paymentItems
    });
}

/**
 * 오늘 날짜 문자열 (YYYY-MM-DD)
 */
function getTodayString() {
  var today = new Date();
  var year = today.getFullYear();
  var month = String(today.getMonth() + 1).padStart(2, '0');
  var day = String(today.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}
```

#### 4.1.2 CSS 추가

**파일**: `CommonScripts.html` (스타일 섹션)

```css
/* 부분 결제 UI 스타일 */
.payment-summary-total {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  border: 2px solid #e2e8f0;
}

.summary-item {
  text-align: center;
}

.summary-item.highlight {
  background: #fff;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.summary-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 6px;
}

.summary-value {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.summary-value.paid {
  color: #059669;
}

.summary-value.remaining {
  color: #dc2626;
}

.payment-items-container {
  max-height: 500px;
  overflow-y: auto;
  margin-bottom: 20px;
}

.payment-item-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.payment-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
}

.invoice-id {
  font-weight: 700;
  color: #2563eb;
  font-size: 14px;
}

.company-name {
  color: #64748b;
  font-size: 13px;
}

.payment-info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.info-item {
  padding: 8px;
  background: #f8fafc;
  border-radius: 6px;
}

.info-item.highlight {
  background: #fef3c7;
  border: 1px solid #fbbf24;
}

.info-label {
  font-size: 11px;
  color: #64748b;
  margin-bottom: 4px;
}

.info-value {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.info-value.paid {
  color: #059669;
}

.info-value.remaining {
  color: #dc2626;
}

.payment-history {
  margin: 16px 0;
  padding: 12px;
  background: #f1f5f9;
  border-radius: 6px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.btn-toggle-history {
  padding: 4px 12px;
  background: #e2e8f0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-toggle-history:hover {
  background: #cbd5e1;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.history-table th {
  background: #e2e8f0;
  padding: 8px;
  text-align: left;
  font-weight: 600;
}

.history-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #e2e8f0;
}

.history-table td.num {
  text-align: right;
}

.payment-input-section {
  margin: 16px 0;
}

.payment-input-section label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 6px;
}

.payment-amount-input {
  width: 100%;
  padding: 10px;
  border: 2px solid #d1d5db;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
}

.payment-amount-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.input-hint {
  font-size: 11px;
  color: #64748b;
  margin-top: 4px;
}

.max-amount {
  font-weight: 700;
  color: #dc2626;
}

.remaining-after-payment {
  margin-top: 8px;
  padding: 8px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 600;
}

.remaining-after-payment.complete {
  background: #d1fae5;
  color: #065f46;
}

.remaining-after-payment.partial {
  background: #fef3c7;
  color: #92400e;
}

.remaining-after-payment .complete {
  color: #059669;
}

.remaining-after-payment .amount {
  color: #dc2626;
}

.payment-notes-section {
  margin-top: 12px;
}

.payment-notes-section label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 4px;
}

.payment-notes-input {
  width: 100%;
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}

.payment-common-info {
  margin: 20px 0;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.payment-common-info h3 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #0f172a;
}

.common-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.common-info-grid .field label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 4px;
}

.common-info-grid .field input,
.common-info-grid .field select {
  width: 100%;
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}

.payment-final-summary {
  padding: 16px;
  background: #1e293b;
  color: #fff;
  border-radius: 8px;
  margin-top: 20px;
}

.payment-final-summary .summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.payment-final-summary .summary-row:not(:last-child) {
  border-bottom: 1px solid #475569;
}

.payment-final-summary .summary-row span:first-child {
  font-size: 14px;
  color: #cbd5e1;
}

.payment-final-summary .summary-row span:last-child {
  font-size: 18px;
  font-weight: 700;
}

.total-payment-amount {
  color: #34d399;
}

.total-remaining-amount {
  color: #fbbf24;
}
```

### 4.2 청구서 관리 페이지 수정

**파일**: `Page_BillingManagement.html` 및 `CommonScripts.html`

#### 4.2.1 청구서 목록 테이블에 부분 결제 정보 표시

```javascript
/**
 * 청구서 목록 조회 (부분 결제 정보 포함)
 * CommonScripts.html의 initBillingManagementPage() 수정
 */
function loadBillingList() {
  var company = document.getElementById('billing-mgmt-company').value;
  var status = document.getElementById('billing-mgmt-status').value;
  var startDate = document.getElementById('billing-mgmt-start-date').value;
  var endDate = document.getElementById('billing-mgmt-end-date').value;

  OB.showLoading('청구서 목록을 조회하는 중...');

  google.script.run
    .withSuccessHandler(function(result) {
      OB.hideLoading();

      if (result.success) {
        renderBillingListWithPartialPayment(result.billings);
        updateBillingSummary(result.billings);
      } else {
        alert('조회 실패: ' + result.error);
      }
    })
    .withFailureHandler(function(error) {
      OB.hideLoading();
      alert('서버 오류: ' + error.message);
    })
    .getInvoicesApi({
      company: company,
      status: status,
      startDate: startDate,
      endDate: endDate
    });
}

/**
 * 청구서 목록 렌더링 (부분 결제 표시)
 */
function renderBillingListWithPartialPayment(billings) {
  var tbody = document.getElementById('billing-mgmt-tbody');

  if (!billings || billings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="billing-empty">' +
                      '<div class="billing-empty-icon">📋</div>' +
                      '<div class="billing-empty-text">조회된 청구서가 없습니다</div>' +
                      '</td></tr>';
    return;
  }

  var html = '';

  billings.forEach(function(billing) {
    var statusClass = billing.status;
    var statusText = billing.status;

    // 상태 텍스트 한글화
    switch(billing.status) {
      case 'DRAFT': statusText = '임시저장'; break;
      case 'ISSUED': statusText = '발행완료'; break;
      case 'PAID': statusText = '완납'; break;
      case 'PAID_PARTIAL': statusText = '부분결제'; statusClass = 'PARTIAL'; break;
    }

    html += '<tr>';
    html += '  <td>' + billing.billingId + '</td>';
    html += '  <td>' + (billing.type === 'SALES' ? '매출' : '매입') + '</td>';
    html += '  <td>' + billing.company + '</td>';
    html += '  <td>' + billing.billingDate + '</td>';

    // 금액 표시 (부분 결제 시 진행 상황 표시)
    html += '  <td class="num">';
    html += '    <div class="amount-display">';
    html += '      <div class="total-amount">' + OB.formatCurrency(billing.amount) + '</div>';

    // 부분 결제인 경우 진행바 표시
    if (billing.status === 'PAID_PARTIAL') {
      var paidAmount = Number(billing.paidAmount) || 0;
      var totalAmount = Number(billing.amount) || 0;
      var percentage = Math.round((paidAmount / totalAmount) * 100);

      html += '      <div class="payment-progress">';
      html += '        <div class="progress-bar-container">';
      html += '          <div class="progress-bar" style="width: ' + percentage + '%"></div>';
      html += '        </div>';
      html += '        <div class="progress-text">';
      html += '          ' + OB.formatCurrency(paidAmount) + ' / ' + OB.formatCurrency(totalAmount);
      html += '          (' + percentage + '%)';
      html += '        </div>';
      html += '      </div>';
    }

    html += '    </div>';
    html += '  </td>';

    html += '  <td class="center">';
    html += '    <span class="billing-status-badge ' + statusClass + '">' + statusText + '</span>';
    html += '  </td>';
    html += '  <td>' + (billing.notes || '-') + '</td>';
    html += '  <td class="center">';
    html += '    <button class="billing-btn small primary" onclick="viewBillingDetail(\'' + billing.billingId + '\')">상세</button>';
    html += '  </td>';
    html += '</tr>';
  });

  tbody.innerHTML = html;
}

/**
 * 요약 정보 업데이트 (부분 결제 반영)
 */
function updateBillingSummary(billings) {
  var summaryDiv = document.getElementById('billing-mgmt-summary');

  if (!billings || billings.length === 0) {
    summaryDiv.style.display = 'none';
    return;
  }

  var totalCount = billings.length;
  var totalAmount = 0;
  var issuedAmount = 0;
  var paidAmount = 0;
  var unpaidAmount = 0;

  billings.forEach(function(billing) {
    var amount = Number(billing.amount) || 0;
    var paid = Number(billing.paidAmount) || 0;

    totalAmount += amount;

    if (billing.status === 'ISSUED' || billing.status === 'PAID' || billing.status === 'PAID_PARTIAL') {
      issuedAmount += amount;
    }

    if (billing.status === 'PAID' || billing.status === 'PAID_PARTIAL') {
      paidAmount += paid;
    }

    unpaidAmount += (amount - paid);
  });

  document.getElementById('billing-mgmt-total-count').textContent = totalCount;
  document.getElementById('billing-mgmt-total-amount').textContent = OB.formatCurrency(totalAmount);
  document.getElementById('billing-mgmt-issued-amount').textContent = OB.formatCurrency(issuedAmount);
  document.getElementById('billing-mgmt-unpaid-amount').textContent = OB.formatCurrency(unpaidAmount);

  summaryDiv.style.display = 'grid';
}
```

#### 4.2.2 청구서 상세 모달에 부분 결제 정보 표시

```javascript
/**
 * 청구서 상세 보기 (부분 결제 정보 포함)
 */
function viewBillingDetail(billingId) {
  OB.showLoading('청구서 정보를 불러오는 중...');

  google.script.run
    .withSuccessHandler(function(result) {
      OB.hideLoading();

      if (result.success) {
        showBillingDetailModal(result.invoice, result.payments);
      } else {
        alert('조회 실패: ' + result.error);
      }
    })
    .withFailureHandler(function(error) {
      OB.hideLoading();
      alert('서버 오류: ' + error.message);
    })
    .getInvoicePaymentInfoApi(billingId);
}

/**
 * 청구서 상세 모달 렌더링
 */
function showBillingDetailModal(invoice, payments) {
  var modal = document.getElementById('billing-detail-modal');

  // 기본 정보
  document.getElementById('detail-billing-id').textContent = invoice.invoiceId;
  document.getElementById('detail-type').textContent = invoice.type === 'SALES' ? '매출' : '매입';
  document.getElementById('detail-company').textContent = invoice.company;
  document.getElementById('detail-settlement-id').textContent = invoice.settlementId || '-';
  document.getElementById('detail-billing-date').textContent = invoice.billingDate;
  document.getElementById('detail-amount').textContent = OB.formatCurrency(invoice.amount);

  // 상태 배지
  var statusText = invoice.status;
  var statusClass = invoice.status;
  switch(invoice.status) {
    case 'DRAFT': statusText = '임시저장'; break;
    case 'ISSUED': statusText = '발행완료'; break;
    case 'PAID': statusText = '완납'; break;
    case 'PAID_PARTIAL': statusText = '부분결제'; statusClass = 'PARTIAL'; break;
  }
  document.getElementById('detail-status').innerHTML =
    '<span class="billing-status-badge ' + statusClass + '">' + statusText + '</span>';

  document.getElementById('detail-notes').textContent = invoice.notes || '-';

  // 발행 정보
  document.getElementById('detail-created-at').textContent = invoice.createdAt || '-';
  document.getElementById('detail-created-by').textContent = invoice.createdBy || '-';
  document.getElementById('detail-issued-at').textContent = invoice.issuedAt || '-';
  document.getElementById('detail-issued-by').textContent = invoice.issuedBy || '-';
  document.getElementById('detail-paid-at').textContent = invoice.paidAt || '-';

  // 부분 결제 정보 추가
  var bodyDiv = document.getElementById('billing-detail-body');

  // 기존 결제 정보 섹션 제거 (있을 경우)
  var existingPaymentSection = bodyDiv.querySelector('.payment-detail-section');
  if (existingPaymentSection) {
    existingPaymentSection.remove();
  }

  // 결제 정보 섹션 추가
  if (payments && payments.length > 0) {
    var paymentHtml = '';
    paymentHtml += '<div class="billing-detail-section payment-detail-section">';
    paymentHtml += '  <h3>💰 결제 정보</h3>';

    // 결제 요약
    var paidAmount = Number(invoice.paidAmount) || 0;
    var remainingAmount = Number(invoice.remainingAmount) || Number(invoice.amount);
    var percentage = Math.round((paidAmount / invoice.amount) * 100);

    paymentHtml += '  <div class="payment-summary-in-detail">';
    paymentHtml += '    <div class="summary-grid">';
    paymentHtml += '      <div class="summary-item">';
    paymentHtml += '        <div class="label">청구금액</div>';
    paymentHtml += '        <div class="value">' + OB.formatCurrency(invoice.amount) + '</div>';
    paymentHtml += '      </div>';
    paymentHtml += '      <div class="summary-item">';
    paymentHtml += '        <div class="label">결제완료</div>';
    paymentHtml += '        <div class="value paid">' + OB.formatCurrency(paidAmount) + '</div>';
    paymentHtml += '      </div>';
    paymentHtml += '      <div class="summary-item">';
    paymentHtml += '        <div class="label">미수금</div>';
    paymentHtml += '        <div class="value remaining">' + OB.formatCurrency(remainingAmount) + '</div>';
    paymentHtml += '      </div>';
    paymentHtml += '    </div>';

    // 진행바
    if (invoice.status === 'PAID_PARTIAL') {
      paymentHtml += '    <div class="progress-container">';
      paymentHtml += '      <div class="progress-bar-bg">';
      paymentHtml += '        <div class="progress-bar-fill" style="width: ' + percentage + '%"></div>';
      paymentHtml += '      </div>';
      paymentHtml += '      <div class="progress-label">' + percentage + '% 결제 완료</div>';
      paymentHtml += '    </div>';
    }

    paymentHtml += '  </div>';

    // 결제 이력
    paymentHtml += '  <h4 style="margin: 16px 0 8px;">결제 이력 (' + payments.length + '건)</h4>';
    paymentHtml += '  <table class="payment-history-table">';
    paymentHtml += '    <thead>';
    paymentHtml += '      <tr>';
    paymentHtml += '        <th>결제일</th>';
    paymentHtml += '        <th>결제ID</th>';
    paymentHtml += '        <th>금액</th>';
    paymentHtml += '        <th>결제수단</th>';
    paymentHtml += '        <th>비고</th>';
    paymentHtml += '      </tr>';
    paymentHtml += '    </thead>';
    paymentHtml += '    <tbody>';

    payments.forEach(function(payment) {
      paymentHtml += '      <tr>';
      paymentHtml += '        <td>' + payment.paymentDate + '</td>';
      paymentHtml += '        <td>' + payment.paymentId + '</td>';
      paymentHtml += '        <td class="num">' + OB.formatCurrency(payment.amount) + '</td>';
      paymentHtml += '        <td>' + payment.paymentMethod + '</td>';
      paymentHtml += '        <td>' + (payment.notes || '-') + '</td>';
      paymentHtml += '      </tr>';
    });

    paymentHtml += '    </tbody>';
    paymentHtml += '  </table>';
    paymentHtml += '</div>';

    bodyDiv.insertAdjacentHTML('beforeend', paymentHtml);
  }

  modal.classList.add('active');
}
```

#### 4.2.3 Page_BillingManagement.html에 CSS 추가

```html
<style>
/* 기존 스타일... */

/* 부분 결제 상태 배지 */
.billing-status-badge.PARTIAL {
  background: #fef3c7;
  color: #92400e;
}

/* 금액 표시 영역 */
.amount-display {
  text-align: right;
}

.total-amount {
  font-weight: 700;
  margin-bottom: 4px;
}

/* 결제 진행바 */
.payment-progress {
  margin-top: 6px;
}

.progress-bar-container {
  width: 100%;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 4px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #059669);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 10px;
  color: #64748b;
}

/* 상세 모달 내 결제 정보 */
.payment-detail-section {
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
  margin-top: 16px;
}

.payment-summary-in-detail {
  margin-bottom: 16px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}

.summary-grid .summary-item {
  background: #fff;
  padding: 12px;
  border-radius: 6px;
  text-align: center;
}

.summary-grid .label {
  font-size: 11px;
  color: #64748b;
  margin-bottom: 6px;
}

.summary-grid .value {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.summary-grid .value.paid {
  color: #059669;
}

.summary-grid .value.remaining {
  color: #dc2626;
}

.progress-container {
  margin-top: 12px;
}

.progress-bar-bg {
  width: 100%;
  height: 20px;
  background: #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 6px;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #34d399, #10b981);
  transition: width 0.5s ease;
}

.progress-label {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #059669;
}

/* 결제 이력 테이블 */
.payment-history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.payment-history-table th {
  background: #e2e8f0;
  padding: 8px;
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid #cbd5e1;
}

.payment-history-table td {
  padding: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.payment-history-table td.num {
  text-align: right;
  font-weight: 600;
}

.payment-history-table tbody tr:hover {
  background: #f8fafc;
}
</style>
```

---

## 5. 페이지 간 연동 방식

### 5.1 거래원장 → 청구서 → 결제 데이터 흐름

```
[거래원장]
  └─ 발주번호: 20251202-C001-DG-001
      │
      ↓ (청구서 생성)
[청구DB]
  └─ 청구ID: INV-20251216-001
      ├─ orderNumbers: ["20251202-C001-DG-001"]
      ├─ 청구금액: 10,000,000
      ├─ 결제완료금액: 0 → 3,000,000 → 10,000,000
      ├─ 미수금: 10,000,000 → 7,000,000 → 0
      └─ 청구상태: ISSUED → PAID_PARTIAL → PAID
      │
      ↓ (결제 입력)
[결제내역]
  ├─ PAY-20251220-001 (문서번호: INV-20251216-001, 금액: 3,000,000)
  └─ PAY-20251225-001 (문서번호: INV-20251216-001, 금액: 7,000,000)
      │
      ↓ (상태 동기화)
[거래원장]
  └─ 발주번호: 20251202-C001-DG-001
      └─ 매출결제: 미결제 → 부분결제 → 결제완료
```

### 5.2 스프레드시트 입력/수정 순서

#### 5.2.1 부분 결제 입력 시퀀스

```javascript
/**
 * 부분 결제 입력 프로세스
 *
 * 1. 사용자가 결제 모달에서 청구서 선택
 * 2. getInvoicePaymentInfo() 호출 → 현재 결제 상태 조회
 *    - 청구DB에서 청구금액, 결제완료금액, 미수금 읽기
 *    - 결제내역에서 기존 결제 이력 조회
 * 3. UI에 표시
 *    - 청구금액, 기결제액, 미수금 표시
 *    - 기존 결제 이력 테이블 표시
 *    - 금회 결제액 입력 폼 (최대값 = 미수금)
 * 4. 사용자가 금액 입력 후 저장 버튼 클릭
 * 5. validatePartialPayment() 호출 → 검증
 *    - 금액이 0보다 큰지 확인
 *    - 금액이 미수금을 초과하지 않는지 확인
 * 6. saveMultiplePayment() 호출
 *    a) 결제내역 시트에 새 행 추가
 *       - paymentSheet.appendRow([결제ID, 결제일, ...])
 *    b) 청구DB 업데이트
 *       - invoiceSheet.getRange(row, 결제완료금액Col).setValue(기결제액 + 금회결제액)
 *       - invoiceSheet.getRange(row, 미수금Col).setValue(청구금액 - 결제완료금액)
 *       - invoiceSheet.getRange(row, 청구상태Col).setValue('PAID' 또는 'PAID_PARTIAL')
 *       - invoiceSheet.getRange(row, 최종결제일Col).setValue(now)
 *    c) 거래원장 업데이트
 *       - orderNumbers를 파싱하여 해당 발주번호 찾기
 *       - ledgerSheet.getRange(row, 매출결제Col).setValue('부분결제' 또는 '결제완료')
 * 7. 응답 반환 및 UI 새로고침
 */
```

#### 5.2.2 시트별 업데이트 로직

**A. 결제내역 시트 (INSERT)**

```javascript
// 위치: PaymentService.js > saveMultiplePayment()
// 동작: 항상 새 행 추가 (appendRow)

paymentSheet.appendRow([
  paymentId,                  // PAY-20251220-001
  paymentDate,                // 2025-12-20
  paymentType,                // 입금
  거래처명,                   // 미미라인 명동점
  paymentAmount,              // 3,000,000
  paymentMethod,              // 계좌이체
  invoiceId,                  // INV-20251216-001
  '',                         // 발주번호
  notes,                      // 1차 선입금
  false,                      // 삭제여부
  '',                         // 삭제일시
  '',                         // 삭제자
  now,                        // 입력일시
  user                        // 입력자
]);
```

**B. 청구DB 시트 (UPDATE)**

```javascript
// 위치: PaymentService.js > saveMultiplePayment()
// 동작: 기존 행의 특정 셀 업데이트

// 1. 청구서 행 찾기
for (var i = 1; i < invoiceData.length; i++) {
  if (invoiceData[i][청구IDCol] === invoiceId) {
    invoiceRowIndex = i + 1;  // 1-based 행 번호
    break;
  }
}

// 2. 셀 업데이트
invoiceSheet.getRange(invoiceRowIndex, 청구상태Col + 1).setValue('PAID_PARTIAL');
invoiceSheet.getRange(invoiceRowIndex, 결제완료금액Col + 1).setValue(신규결제완료금액);
invoiceSheet.getRange(invoiceRowIndex, 미수금Col + 1).setValue(신규미수금);
invoiceSheet.getRange(invoiceRowIndex, 최종결제일Col + 1).setValue(now);
```

**C. 거래원장 시트 (UPDATE)**

```javascript
// 위치: PaymentService.js > updateLedgerPaymentStatus()
// 동작: orderNumbers 배열의 각 발주번호에 해당하는 행 업데이트

// 1. orderNumbers 파싱
var orderNumbersArray = JSON.parse(orderNumbers);  // ["20251202-C001-DG-001"]

// 2. 각 발주번호 찾아서 업데이트
for (var i = 0; i < orderNumbersArray.length; i++) {
  var orderNumber = orderNumbersArray[i];

  for (var j = 1; j < ledgerData.length; j++) {
    if (ledgerData[j][발주번호Col] === orderNumber) {
      // 매출 청구서인 경우 매출결제 컬럼 업데이트
      ledgerSheet.getRange(j + 1, 매출결제Col + 1).setValue('부분결제');
    }
  }
}
```

### 5.3 데이터 무결성 보장

#### 5.3.1 트랜잭션 시뮬레이션

Google Apps Script에는 트랜잭션이 없으므로 로직 순서로 보장:

```javascript
// 1. 검증 단계 (데이터 읽기 전용)
var validation = validatePartialPayment(invoice, paymentAmount);
if (!validation.valid) {
  throw new Error(validation.error);
}

// 2. 결제내역 추가 (롤백 불필요 - 새 데이터)
paymentSheet.appendRow(paymentRowData);

// 3. 청구DB 업데이트 (중요!)
// 실패 시 결제내역의 '삭제여부'를 true로 설정하여 무효화 가능
try {
  invoiceSheet.getRange(...).setValue(...);
  invoiceSheet.getRange(...).setValue(...);
  // ...
} catch (e) {
  // 롤백: 방금 추가한 결제내역의 삭제여부를 true로
  var lastRow = paymentSheet.getLastRow();
  paymentSheet.getRange(lastRow, 10).setValue(true);  // 10번째 컬럼 = 삭제여부
  throw e;
}

// 4. 거래원장 업데이트 (실패해도 결제는 유효)
// 로그만 남기고 에러는 무시 (수동 복구 가능)
try {
  updateLedgerPaymentStatus(...);
} catch (e) {
  Logger.log('[Warning] 거래원장 업데이트 실패: ' + e.message);
}
```

#### 5.3.2 동시성 제어

```javascript
/**
 * 낙관적 잠금 (Optimistic Locking) 시뮬레이션
 * 청구DB 업데이트 시 중복 결제 방지
 */
function saveMultiplePaymentWithConcurrencyControl(params) {
  // ... (기존 코드)

  // 청구서 업데이트 전 재검증
  var currentInvoiceData = invoiceSheet.getDataRange().getValues();
  var currentInvoiceRow = null;

  for (var i = 1; i < currentInvoiceData.length; i++) {
    if (currentInvoiceData[i][청구IDCol] === invoiceId) {
      currentInvoiceRow = currentInvoiceData[i];
      break;
    }
  }

  var current결제완료금액 = Number(currentInvoiceRow[결제완료금액Col]) || 0;

  // 초기 조회 시점과 현재 시점의 결제완료금액이 다르면 동시 수정 발생
  if (current결제완료금액 !== 기결제액) {
    throw new Error(
      '[동시성 충돌] 다른 사용자가 이미 결제를 입력했습니다.\n' +
      '페이지를 새로고침 후 다시 시도해주세요.\n\n' +
      '초기 결제완료금액: ' + 기결제액 + '\n' +
      '현재 결제완료금액: ' + current결제완료금액
    );
  }

  // 이상 없으면 업데이트 진행
  // ...
}
```

---

## 6. 단계별 구현 계획

### Phase 1: 데이터베이스 스키마 확장 (1일)

**작업 항목:**
- [x] 마이그레이션 스크립트 작성 (`MigrateInvoiceSchemaForPartialPayment.js`)
- [ ] Apps Script 편집기에 스크립트 추가
- [ ] `runInvoiceSchemaMigration()` 실행
- [ ] 실행 로그 확인 및 검증
  - 헤더 3개 추가 확인 (결제완료금액, 미수금, 최종결제일)
  - 기존 PAID 청구서의 데이터 마이그레이션 확인
- [ ] 백업 생성 (시트 복사)

**검증 방법:**
```javascript
// 검증 스크립트
function verifyMigration() {
  var ss = SpreadsheetApp.openById('1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs');
  var sheet = ss.getSheetByName('청구DB');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  Logger.log('총 컬럼 수: ' + headers.length);
  Logger.log('결제완료금액 컬럼 존재: ' + (headers.indexOf('결제완료금액') !== -1));
  Logger.log('미수금 컬럼 존재: ' + (headers.indexOf('미수금') !== -1));
  Logger.log('최종결제일 컬럼 존재: ' + (headers.indexOf('최종결제일') !== -1));

  // PAID 상태인 첫 번째 청구서의 데이터 확인
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('청구상태')] === 'PAID') {
      Logger.log('샘플 PAID 청구서:');
      Logger.log('  청구ID: ' + data[i][headers.indexOf('청구ID')]);
      Logger.log('  청구금액: ' + data[i][headers.indexOf('청구금액')]);
      Logger.log('  결제완료금액: ' + data[i][headers.indexOf('결제완료금액')]);
      Logger.log('  미수금: ' + data[i][headers.indexOf('미수금')]);
      break;
    }
  }
}
```

---

### Phase 2: 백엔드 로직 구현 (2일)

**Day 1: 검증 및 저장 로직**
- [ ] `validatePartialPayment()` 함수 구현
- [ ] `saveMultiplePayment()` 함수 수정
  - 부분 결제 허용 로직
  - 청구DB 업데이트 로직
  - 거래원장 상태 업데이트 로직
- [ ] `getNextPaymentSequence()` 함수 구현
- [ ] `updateLedgerPaymentStatus()` 함수 수정 (부분결제 상태 추가)
- [ ] 단위 테스트 작성 및 실행

**Day 2: 조회 및 API**
- [ ] `getInvoicePaymentInfo()` 함수 구현
- [ ] `getInvoicePaymentInfoApi()` API 래퍼 추가
- [ ] `SettlementService.js`의 `createBilling()` 수정 (초기값 설정)
- [ ] 통합 테스트

**테스트 시나리오:**
```javascript
/**
 * 부분 결제 테스트 시나리오
 */
function testPartialPayment() {
  Logger.log('========== 부분 결제 테스트 시작 ==========');

  // 1. 테스트용 청구서 생성
  var testInvoice = createBilling({
    type: 'SALES',
    company: '테스트_부분결제_업체',
    billingDate: '2026-01-03',
    amount: 10000000,
    notes: '부분결제 테스트용 청구서',
    orderNumbers: ['TEST-001']
  });

  Logger.log('[Test] 청구서 생성: ' + testInvoice.billingId);

  // 2. 1차 부분 결제 (30%)
  var payment1 = saveMultiplePayment({
    paymentDate: '2026-01-04',
    paymentType: '입금',
    paymentMethod: '계좌이체',
    paymentItems: [{
      invoiceId: testInvoice.billingId,
      amount: 3000000,
      notes: '1차 선입금 (30%)'
    }]
  });

  Logger.log('[Test] 1차 결제 결과: ' + JSON.stringify(payment1));

  // 검증: 청구서 상태 = PAID_PARTIAL
  var invoiceInfo1 = getInvoicePaymentInfo(testInvoice.billingId);
  Logger.log('[Verify] 1차 결제 후:');
  Logger.log('  결제완료금액: ' + invoiceInfo1.invoice.paidAmount + ' (예상: 3000000)');
  Logger.log('  미수금: ' + invoiceInfo1.invoice.remainingAmount + ' (예상: 7000000)');
  Logger.log('  상태: ' + invoiceInfo1.invoice.status + ' (예상: PAID_PARTIAL)');

  // 3. 2차 부분 결제 (50%)
  var payment2 = saveMultiplePayment({
    paymentDate: '2026-01-10',
    paymentType: '입금',
    paymentMethod: '계좌이체',
    paymentItems: [{
      invoiceId: testInvoice.billingId,
      amount: 5000000,
      notes: '2차 중도금 (50%)'
    }]
  });

  Logger.log('[Test] 2차 결제 결과: ' + JSON.stringify(payment2));

  // 검증
  var invoiceInfo2 = getInvoicePaymentInfo(testInvoice.billingId);
  Logger.log('[Verify] 2차 결제 후:');
  Logger.log('  결제완료금액: ' + invoiceInfo2.invoice.paidAmount + ' (예상: 8000000)');
  Logger.log('  미수금: ' + invoiceInfo2.invoice.remainingAmount + ' (예상: 2000000)');
  Logger.log('  상태: ' + invoiceInfo2.invoice.status + ' (예상: PAID_PARTIAL)');

  // 4. 3차 잔금 결제 (20%)
  var payment3 = saveMultiplePayment({
    paymentDate: '2026-01-15',
    paymentType: '입금',
    paymentMethod: '계좌이체',
    paymentItems: [{
      invoiceId: testInvoice.billingId,
      amount: 2000000,
      notes: '3차 잔금 (20%)'
    }]
  });

  Logger.log('[Test] 3차 결제 결과: ' + JSON.stringify(payment3));

  // 검증: 청구서 상태 = PAID
  var invoiceInfo3 = getInvoicePaymentInfo(testInvoice.billingId);
  Logger.log('[Verify] 3차 결제 후 (완납):');
  Logger.log('  결제완료금액: ' + invoiceInfo3.invoice.paidAmount + ' (예상: 10000000)');
  Logger.log('  미수금: ' + invoiceInfo3.invoice.remainingAmount + ' (예상: 0)');
  Logger.log('  상태: ' + invoiceInfo3.invoice.status + ' (예상: PAID)');
  Logger.log('  결제 이력 수: ' + invoiceInfo3.paymentCount + ' (예상: 3)');

  // 5. 초과 결제 시도 (오류 발생 예상)
  try {
    var paymentError = saveMultiplePayment({
      paymentDate: '2026-01-16',
      paymentType: '입금',
      paymentMethod: '계좌이체',
      paymentItems: [{
        invoiceId: testInvoice.billingId,
        amount: 1000,
        notes: '초과 결제 테스트'
      }]
    });

    Logger.log('[Test] ❌ 초과 결제가 성공했습니다 (오류!)');
  } catch (e) {
    Logger.log('[Test] ✅ 초과 결제 방지 성공: ' + e.message);
  }

  Logger.log('========== 부분 결제 테스트 완료 ==========');
}
```

---

### Phase 3: 프론트엔드 UI 구현 (2일)

**Day 1: 결제 입력 모달**
- [ ] `showPaymentStep4()` 함수 수정
- [ ] `renderPaymentStep4WithPartialPayment()` 함수 구현
- [ ] `updatePaymentSummary()` 실시간 계산 로직
- [ ] `submitPartialPayment()` 제출 로직
- [ ] CSS 스타일 추가
- [ ] 브라우저 테스트

**Day 2: 청구서 관리 페이지**
- [ ] `renderBillingListWithPartialPayment()` 함수 수정
- [ ] 진행바 UI 추가
- [ ] `showBillingDetailModal()` 수정 (결제 이력 표시)
- [ ] 요약 통계 계산 로직 수정
- [ ] CSS 스타일 추가
- [ ] 통합 테스트

---

### Phase 4: 통합 테스트 및 디버깅 (1일)

**테스트 체크리스트:**

```markdown
## 부분 결제 기능 테스트 체크리스트

### A. 데이터 검증
- [ ] 청구DB에 3개 컬럼 추가 확인
- [ ] 기존 PAID 청구서의 마이그레이션 정확성 확인
- [ ] 신규 청구서 생성 시 초기값 설정 확인

### B. 결제 입력 프로세스
- [ ] Step 1: 결제유형 선택 정상 동작
- [ ] Step 2: 청구서 검색 및 선택 정상 동작
- [ ] Step 3: 다중 청구서 요약 표시
- [ ] Step 4: 부분 결제 정보 표시
  - [ ] 청구금액, 기결제액, 미수금 정확히 표시
  - [ ] 기존 결제 이력 테이블 정상 표시
  - [ ] 금회 결제액 입력 폼 동작
  - [ ] 최대 금액 제한 (미수금 초과 방지)
  - [ ] 실시간 잔액 계산 정확성
  - [ ] 완납 시 "완납 처리" 메시지 표시

### C. 결제 저장
- [ ] 1차 부분 결제 (30%)
  - [ ] 결제내역 시트에 새 행 추가
  - [ ] 청구DB 업데이트 (결제완료금액, 미수금, 상태)
  - [ ] 청구상태 = PAID_PARTIAL
  - [ ] 거래원장 매출결제 = "부분결제"
- [ ] 2차 부분 결제 (50%)
  - [ ] 누적 결제액 정확히 계산
  - [ ] 미수금 정확히 감소
  - [ ] 청구상태 = PAID_PARTIAL 유지
- [ ] 3차 완납 (20%)
  - [ ] 미수금 = 0
  - [ ] 청구상태 = PAID
  - [ ] 거래원장 매출결제 = "결제완료"

### D. 오류 처리
- [ ] 0원 결제 시도 → 오류 메시지
- [ ] 미수금 초과 금액 입력 → 오류 메시지
- [ ] 완납 후 추가 결제 시도 → 오류 메시지
- [ ] 동시 결제 시도 → 낙관적 잠금 동작

### E. UI 표시
- [ ] 청구서 목록
  - [ ] PAID_PARTIAL 상태 배지 표시
  - [ ] 부분 결제 진행바 표시
  - [ ] 결제 비율 (%) 표시
- [ ] 청구서 상세 모달
  - [ ] 결제 정보 섹션 표시
  - [ ] 결제 요약 (청구금액, 결제완료, 미수금)
  - [ ] 진행바 표시
  - [ ] 결제 이력 테이블 표시

### F. 다중 청구서 결제
- [ ] 여러 청구서에 대해 각각 다른 금액으로 부분 결제
- [ ] 일부는 완납, 일부는 부분 결제
- [ ] 총 결제액 및 총 잔여 미수금 정확히 계산

### G. 엣지 케이스
- [ ] 소수점 금액 처리 (예: 1,234,567.89원)
- [ ] 매우 큰 금액 처리 (예: 999,999,999원)
- [ ] 동일 날짜에 여러 번 결제
- [ ] 과거 날짜로 결제 입력
```

---

## 7. 예상 개발 기간

| Phase | 작업 내용 | 일정 | 담당 |
|-------|----------|------|------|
| **Phase 1** | DB 스키마 확장 | 1일 | 백엔드 |
| **Phase 2** | 백엔드 로직 구현 | 2일 | 백엔드 |
| **Phase 3** | 프론트엔드 UI 구현 | 2일 | 프론트엔드 |
| **Phase 4** | 통합 테스트 및 디버깅 | 1일 | 전체 |
| **총계** | | **6일** (여유 1일 포함) | |

---

## 8. 위험 요소 및 대응 방안

### 8.1 데이터 마이그레이션 실패

**위험:**
- 기존 PAID 청구서의 데이터 마이그레이션 오류
- 컬럼 추가 실패

**대응:**
- 마이그레이션 전 전체 시트 백업 (복사본 생성)
- 마이그레이션 스크립트에 롤백 기능 포함
- 검증 스크립트로 마이그레이션 결과 확인

### 8.2 동시성 문제

**위험:**
- 여러 사용자가 동시에 같은 청구서에 결제 입력
- 결제완료금액 계산 오류

**대응:**
- 낙관적 잠금 로직 구현
- 청구서 업데이트 전 재검증
- 오류 발생 시 명확한 메시지 표시

### 8.3 성능 저하

**위험:**
- 결제 이력이 많은 청구서 조회 시 느려짐
- 거래원장 업데이트 시간 증가

**대응:**
- 결제 이력 페이징 (최대 10건만 표시, 나머지는 "더보기")
- 거래원장 업데이트를 비동기로 처리 (실패해도 결제는 유효)
- 인덱싱 개념 도입 (발주번호별 캐시)

### 8.4 UI/UX 복잡도 증가

**위험:**
- 부분 결제 정보로 인한 UI 복잡성
- 사용자 혼란

**대응:**
- 단계별 정보 표시 (기본은 간단하게, 상세는 펼치기)
- 명확한 라벨링 ("금회 결제액", "결제 후 잔액" 등)
- 툴팁 및 가이드 메시지 추가

---

## 9. 참고 자료

### 9.1 관련 파일

- `PaymentService.js` - 결제 관리 백엔드 로직
- `SettlementService.js` - 청구서 생성 로직
- `ApiService.js` - API 엔드포인트
- `CommonScripts.html` - 결제 입력 모달
- `Page_BillingManagement.html` - 청구서 관리 페이지
- `PAYMENT_RENEWAL_FINAL_SPEC.md` - 기존 설계 문서

### 9.2 스프레드시트 구조

**청구DB 시트 (확장 후):**
```
총 22개 컬럼:
1.  청구ID
2.  청구유형
3.  업체명
4.  마감ID
5.  청구일
6.  청구금액
7.  청구상태 (DRAFT, ISSUED, PAID_PARTIAL, PAID)
8.  청구타입
9.  발주번호
10. 비고
11. 생성일시
12. 생성자
13. 발행일시
14. 발행자
15. 결제일시
16. 대체청구서
17. 원본청구서
18. billingType
19. orderNumbers
20. 결제완료금액 (신규)
21. 미수금 (신규)
22. 최종결제일 (신규)
```

**결제내역 시트:**
```
총 14개 컬럼:
1.  결제ID
2.  결제일
3.  결제유형
4.  거래처명
5.  금액
6.  결제수단
7.  문서번호 (청구ID)
8.  발주번호
9.  비고
10. 삭제여부
11. 삭제일시
12. 삭제자
13. 입력일시
14. 입력자
```

---

## 10. 구현 완료 체크리스트

### Phase 1: 데이터베이스
- [ ] 마이그레이션 스크립트 작성
- [ ] 스크립트 실행 및 검증
- [ ] 백업 생성

### Phase 2: 백엔드
- [ ] validatePartialPayment() 구현
- [ ] saveMultiplePayment() 수정
- [ ] getInvoicePaymentInfo() 구현
- [ ] API 래퍼 추가
- [ ] 단위 테스트 통과

### Phase 3: 프론트엔드
- [ ] 결제 모달 Step 4 수정
- [ ] 청구서 목록 UI 수정
- [ ] 청구서 상세 모달 수정
- [ ] CSS 스타일 추가
- [ ] 브라우저 테스트 통과

### Phase 4: 통합 테스트
- [ ] 전체 프로세스 테스트
- [ ] 오류 처리 검증
- [ ] 성능 테스트
- [ ] 사용자 시나리오 검증

### Phase 5: 배포
- [ ] 프로덕션 환경 백업
- [ ] 스크립트 배포
- [ ] 사용자 가이드 작성
- [ ] 모니터링 설정

---

**작성자**: Claude (AI Assistant)
**검토자**: (담당자 이름)
**승인자**: (승인자 이름)
**버전**: 1.0
**최종 수정일**: 2026-01-03
