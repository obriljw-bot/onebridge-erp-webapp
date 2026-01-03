# 📋 기능 명세서 #2: 결제 취소/환불 기능

**작성일**: 2026-01-03
**대상 시스템**: OneBridge ERP - 결제관리 시스템
**우선순위**: ⭐⭐⭐⭐ (높음)

---

## 1. 개요

### 1.1 현재 상황 (진단 결과 기반)

**현재 구현 상태:**
- ✅ 결제내역 시트에 `삭제여부` 컬럼 존재 (10번째 컬럼)
- ✅ 소프트 삭제 지원 (deletePaymentRecord 함수)
- ❌ 삭제 시 청구서 상태 자동 복원 없음
- ❌ 거래원장 결제 상태 자동 복원 없음
- ❌ 환불 전용 기능 없음

**문제점:**
```javascript
// 현재: PaymentService.js의 deletePaymentRecord()
// 삭제여부만 true로 변경, 청구서/거래원장은 수동 처리 필요
function deletePaymentRecord(params) {
  // 결제내역의 삭제여부만 true로 설정
  sheet.getRange(rowIndex, 10).setValue(true);  // 삭제여부
  sheet.getRange(rowIndex, 11).setValue(now);   // 삭제일시
  sheet.getRange(rowIndex, 12).setValue(user);  // 삭제자

  // ❌ 청구서 상태 복원 없음
  // ❌ 거래원장 업데이트 없음
}
```

**실제 업무 사례:**
```
케이스 1: 결제 오입력
- 상황: 3,000,000원 입력해야 하는데 30,000,000원 입력
- 필요: 즉시 취소 + 청구서 상태 복원

케이스 2: 반품/환불
- 상황: 제품 불량으로 전액 반품
- 필요: 환불 기록 + 마이너스 결제 + 청구서 상태 변경

케이스 3: 부분 환불
- 상황: 10개 중 3개 반품
- 필요: 부분 환불 + 결제완료금액 감소
```

**비즈니스 가치**: ⭐⭐⭐⭐ (높음)
- 입력 오류 수정 필수
- 반품/환불 처리 필수
- 회계 감사 추적 필수

---

## 2. 기능 설계

### 2.1 취소 vs 환불 구분

| 구분 | 취소 (Cancel) | 환불 (Refund) |
|------|--------------|--------------|
| **용도** | 입력 오류 수정 | 실제 반품/환불 |
| **처리 방식** | Soft Delete | 마이너스 결제 기록 |
| **청구서 영향** | 상태 복원 | 결제완료금액 감소 |
| **회계 처리** | 원거래 무효화 | 별도 환불 거래 |
| **권장 시점** | 당일 처리 | 언제든지 |
| **감사 추적** | 삭제 이력 | 환불 거래 이력 |

### 2.2 데이터베이스 스키마 변경

#### 2.2.1 결제내역 시트 (현재 14개 컬럼 유지)

**현재 구조:**
```
1. 결제ID, 2. 결제일, 3. 결제유형, 4. 거래처명, 5. 금액,
6. 결제수단, 7. 문서번호, 8. 발주번호, 9. 비고,
10. 삭제여부, 11. 삭제일시, 12. 삭제자, 13. 입력일시, 14. 입력자
```

**확장 필요 컬럼 (2개 추가):**

| 컬럼명 | 위치 | 데이터 타입 | 기본값 | 설명 |
|--------|------|------------|--------|------|
| `원결제ID` | 15번째 (O열) | String | (빈값) | 환불인 경우 원래 결제 ID |
| `환불여부` | 16번째 (P열) | Boolean | false | 환불 거래 여부 |

**마이그레이션 스크립트:**

```javascript
/**
 * 결제내역 시트 스키마 확장 (환불 지원)
 * 파일: MigratePaymentSchemaForRefund.js
 */
function migratePaymentSchemaForRefund() {
  var ss = SpreadsheetApp.openById('1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs');
  var sheet = ss.getSheetByName('결제내역');

  if (!sheet) {
    throw new Error('결제내역 시트를 찾을 수 없습니다.');
  }

  // 현재 헤더 확인
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log('[Migration] 현재 컬럼 수: ' + headers.length);

  // 이미 추가되었는지 확인
  if (headers.indexOf('원결제ID') !== -1) {
    Logger.log('[Migration] 이미 마이그레이션 완료됨');
    return { success: true, message: '이미 마이그레이션 완료' };
  }

  // 1. 헤더 추가 (15, 16번째 컬럼)
  var startCol = headers.length + 1;
  var newHeaders = ['원결제ID', '환불여부'];

  sheet.getRange(1, startCol, 1, 2).setValues([newHeaders]);

  // 헤더 스타일 적용
  sheet.getRange(1, startCol, 1, 2)
    .setFontWeight('bold')
    .setBackground('#f1f5f9')
    .setHorizontalAlignment('center');

  // 컬럼 너비 설정
  sheet.setColumnWidth(startCol, 150);     // 원결제ID
  sheet.setColumnWidth(startCol + 1, 80);  // 환불여부

  Logger.log('[Migration] 헤더 추가 완료: ' + newHeaders.join(', '));

  // 2. 기존 데이터 초기화 (모두 빈값/false)
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    // 원결제ID 빈값
    sheet.getRange(2, startCol, lastRow - 1, 1).setValue('');
    // 환불여부 false
    sheet.getRange(2, startCol + 1, lastRow - 1, 1).setValue(false);
  }

  Logger.log('[Migration] 기존 데이터 초기화 완료: ' + (lastRow - 1) + '건');

  return {
    success: true,
    message: '결제내역 스키마 확장 완료',
    addedColumns: newHeaders,
    initializedRows: lastRow - 1
  };
}

/**
 * 실행 함수
 */
function runPaymentSchemaMigration() {
  try {
    Logger.log('========================================');
    Logger.log('결제내역 스키마 확장 마이그레이션 시작');
    Logger.log('========================================');

    var result = migratePaymentSchemaForRefund();

    Logger.log('');
    Logger.log('✅ 마이그레이션 성공');
    Logger.log('   메시지: ' + result.message);
    Logger.log('   추가 컬럼: ' + result.addedColumns.join(', '));
    Logger.log('   초기화된 행: ' + result.initializedRows);
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

#### 2.2.2 청구서 취소/재발급 이력 (기존 컬럼 활용)

**청구DB 현재 구조 (진단 결과):**
```
16. 대체청구서 - 재발급된 새 청구서 ID
17. 원본청구서 - 취소된 원래 청구서 ID
```

이미 존재하는 컬럼을 활용하므로 추가 마이그레이션 불필요.

---

## 3. 백엔드 로직 구현

### 3.1 결제 취소 (Soft Delete + 상태 복원)

**파일**: `PaymentService.js`

```javascript
/**
 * 결제 취소 (상태 복원 포함)
 * PaymentService.js 수정
 */
function cancelPayment(params) {
  try {
    var paymentId = params.paymentId;
    var cancelReason = params.cancelReason || '결제 취소';
    var user = Session.getActiveUser().getEmail();
    var now = new Date();

    Logger.log('[cancelPayment] 결제 취소 시작: ' + paymentId);

    var ss = SpreadsheetApp.openById('1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs');
    var paymentSheet = ss.getSheetByName('결제내역');
    var invoiceSheet = ss.getSheetByName('청구DB');

    if (!paymentSheet || !invoiceSheet) {
      throw new Error('필요한 시트를 찾을 수 없습니다.');
    }

    // 1. 결제내역 조회
    var paymentData = paymentSheet.getDataRange().getValues();
    var paymentHeaders = paymentData[0];

    var paymentRowIndex = -1;
    var payment = null;

    for (var i = 1; i < paymentData.length; i++) {
      if (paymentData[i][0] === paymentId) {  // 결제ID (A열)
        paymentRowIndex = i + 1;  // 시트 행 번호 (1-based)
        payment = paymentData[i];
        break;
      }
    }

    if (!payment) {
      return { success: false, error: '결제 내역을 찾을 수 없습니다: ' + paymentId };
    }

    // 이미 삭제된 결제인지 확인
    var 삭제여부Col = paymentHeaders.indexOf('삭제여부');
    if (payment[삭제여부Col]) {
      return { success: false, error: '이미 취소된 결제입니다.' };
    }

    // 2. 결제 정보 추출
    var 결제유형 = payment[paymentHeaders.indexOf('결제유형')];
    var 금액 = Number(payment[paymentHeaders.indexOf('금액')]) || 0;
    var 문서번호 = payment[paymentHeaders.indexOf('문서번호')];  // 청구ID

    // 3. 결제내역 소프트 삭제
    paymentSheet.getRange(paymentRowIndex, 삭제여부Col + 1).setValue(true);
    paymentSheet.getRange(paymentRowIndex, paymentHeaders.indexOf('삭제일시') + 1).setValue(now);
    paymentSheet.getRange(paymentRowIndex, paymentHeaders.indexOf('삭제자') + 1).setValue(user);
    paymentSheet.getRange(paymentRowIndex, paymentHeaders.indexOf('비고') + 1).setValue(
      payment[paymentHeaders.indexOf('비고')] + ' [취소: ' + cancelReason + ']'
    );

    Logger.log('[cancelPayment] 결제내역 삭제 완료: ' + paymentId);

    // 4. 청구서 상태 복원
    if (문서번호) {
      var invoiceData = invoiceSheet.getDataRange().getValues();
      var invoiceHeaders = invoiceData[0];

      var invoiceRowIndex = -1;
      var invoice = null;

      for (var i = 1; i < invoiceData.length; i++) {
        if (invoiceData[i][invoiceHeaders.indexOf('청구ID')] === 문서번호) {
          invoiceRowIndex = i + 1;
          invoice = invoiceData[i];
          break;
        }
      }

      if (invoice) {
        // 청구서의 현재 결제완료금액과 미수금 조회
        var 청구금액 = Number(invoice[invoiceHeaders.indexOf('청구금액')]) || 0;
        var 현재결제완료금액 = Number(invoice[invoiceHeaders.indexOf('결제완료금액')]) || 0;

        // 취소된 금액만큼 차감
        var 신규결제완료금액 = 현재결제완료금액 - 금액;
        var 신규미수금 = 청구금액 - 신규결제완료금액;

        // 새로운 상태 결정
        var 신규상태 = 'ISSUED';
        if (신규결제완료금액 >= 청구금액) {
          신규상태 = 'PAID';
        } else if (신규결제완료금액 > 0) {
          신규상태 = 'PAID_PARTIAL';
        }

        // 청구서 업데이트
        invoiceSheet.getRange(invoiceRowIndex, invoiceHeaders.indexOf('청구상태') + 1).setValue(신규상태);
        invoiceSheet.getRange(invoiceRowIndex, invoiceHeaders.indexOf('결제완료금액') + 1).setValue(신규결제완료금액);
        invoiceSheet.getRange(invoiceRowIndex, invoiceHeaders.indexOf('미수금') + 1).setValue(신규미수금);

        Logger.log('[cancelPayment] 청구서 업데이트: ' + 문서번호 +
                   ', 상태: ' + 신규상태 +
                   ', 결제완료금액: ' + 신규결제완료금액 +
                   ', 미수금: ' + 신규미수금);

        // 5. 거래원장 상태 업데이트
        var orderNumbers = invoice[invoiceHeaders.indexOf('orderNumbers')];
        var 청구유형 = invoice[invoiceHeaders.indexOf('청구유형')];

        if (orderNumbers) {
          try {
            var orderNumbersArray = JSON.parse(orderNumbers);
            updateLedgerPaymentStatus(orderNumbersArray, 신규상태, 청구유형);
          } catch (e) {
            Logger.log('[cancelPayment] 거래원장 업데이트 실패: ' + e.message);
          }
        }
      }
    }

    Logger.log('[cancelPayment] 결제 취소 완료: ' + paymentId);

    return {
      success: true,
      message: '결제가 취소되었습니다.',
      cancelledPayment: {
        paymentId: paymentId,
        amount: 금액,
        invoiceId: 문서번호
      }
    };

  } catch (error) {
    Logger.log('[cancelPayment Error] ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * API 래퍼
 */
function cancelPaymentApi(params) {
  var result = cancelPayment(params);
  return safeReturn(result);
}
```

### 3.2 환불 처리 (마이너스 결제 기록)

```javascript
/**
 * 환불 처리 (마이너스 결제 생성)
 * PaymentService.js 추가
 */
function createRefund(params) {
  try {
    var originalPaymentId = params.originalPaymentId;
    var refundAmount = Number(params.refundAmount) || 0;
    var refundReason = params.refundReason || '환불';
    var refundDate = params.refundDate || new Date();
    var user = Session.getActiveUser().getEmail();
    var now = new Date();

    Logger.log('[createRefund] 환불 생성 시작: ' + originalPaymentId + ', 금액: ' + refundAmount);

    if (refundAmount <= 0) {
      return { success: false, error: '환불 금액은 0보다 커야 합니다.' };
    }

    var ss = SpreadsheetApp.openById('1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs');
    var paymentSheet = ss.getSheetByName('결제내역');
    var invoiceSheet = ss.getSheetByName('청구DB');

    if (!paymentSheet || !invoiceSheet) {
      throw new Error('필요한 시트를 찾을 수 없습니다.');
    }

    // 1. 원결제 조회
    var paymentData = paymentSheet.getDataRange().getValues();
    var paymentHeaders = paymentData[0];

    var originalPayment = null;

    for (var i = 1; i < paymentData.length; i++) {
      if (paymentData[i][0] === originalPaymentId) {  // 결제ID
        originalPayment = paymentData[i];
        break;
      }
    }

    if (!originalPayment) {
      return { success: false, error: '원결제를 찾을 수 없습니다: ' + originalPaymentId };
    }

    // 원결제 정보
    var 원결제금액 = Number(originalPayment[paymentHeaders.indexOf('금액')]) || 0;
    var 결제유형 = originalPayment[paymentHeaders.indexOf('결제유형')];
    var 거래처명 = originalPayment[paymentHeaders.indexOf('거래처명')];
    var 결제수단 = originalPayment[paymentHeaders.indexOf('결제수단')];
    var 문서번호 = originalPayment[paymentHeaders.indexOf('문서번호')];

    // 환불 금액이 원결제 금액을 초과하는지 확인
    if (refundAmount > 원결제금액) {
      return {
        success: false,
        error: '환불 금액(' + refundAmount + '원)이 원결제 금액(' + 원결제금액 + '원)을 초과합니다.'
      };
    }

    // 2. 환불 ID 생성
    var dateStr = Utilities.formatDate(new Date(refundDate), Session.getScriptTimeZone(), 'yyyyMMdd');
    var seq = getNextPaymentSequence(paymentSheet, dateStr);
    var refundId = 'PAY-' + dateStr + '-' + String(seq).padStart(3, '0');

    // 3. 환불 결제유형 결정 (반대)
    var 환불결제유형 = (결제유형 === '입금') ? '출금' : '입금';

    // 4. 환불 결제내역 추가 (마이너스 금액)
    var refundRowData = [
      refundId,                           // 결제ID
      refundDate,                         // 결제일
      환불결제유형,                       // 결제유형 (반대)
      거래처명,                           // 거래처명
      -refundAmount,                      // 금액 (마이너스)
      결제수단,                           // 결제수단
      문서번호,                           // 문서번호
      '',                                 // 발주번호
      '환불: ' + refundReason + ' (원결제: ' + originalPaymentId + ')',  // 비고
      false,                              // 삭제여부
      '',                                 // 삭제일시
      '',                                 // 삭제자
      now,                                // 입력일시
      user,                               // 입력자
      originalPaymentId,                  // 원결제ID (신규)
      true                                // 환불여부 (신규)
    ];

    paymentSheet.appendRow(refundRowData);
    Logger.log('[createRefund] 환불 결제내역 추가: ' + refundId);

    // 5. 청구서 상태 업데이트
    if (문서번호) {
      var invoiceData = invoiceSheet.getDataRange().getValues();
      var invoiceHeaders = invoiceData[0];

      var invoiceRowIndex = -1;
      var invoice = null;

      for (var i = 1; i < invoiceData.length; i++) {
        if (invoiceData[i][invoiceHeaders.indexOf('청구ID')] === 문서번호) {
          invoiceRowIndex = i + 1;
          invoice = invoiceData[i];
          break;
        }
      }

      if (invoice) {
        var 청구금액 = Number(invoice[invoiceHeaders.indexOf('청구금액')]) || 0;
        var 현재결제완료금액 = Number(invoice[invoiceHeaders.indexOf('결제완료금액')]) || 0;

        // 환불 금액만큼 차감
        var 신규결제완료금액 = 현재결제완료금액 - refundAmount;
        var 신규미수금 = 청구금액 - 신규결제완료금액;

        // 새로운 상태 결정
        var 신규상태 = 'ISSUED';
        if (신규결제완료금액 >= 청구금액) {
          신규상태 = 'PAID';
        } else if (신규결제완료금액 > 0) {
          신규상태 = 'PAID_PARTIAL';
        }

        // 청구서 업데이트
        invoiceSheet.getRange(invoiceRowIndex, invoiceHeaders.indexOf('청구상태') + 1).setValue(신규상태);
        invoiceSheet.getRange(invoiceRowIndex, invoiceHeaders.indexOf('결제완료금액') + 1).setValue(신규결제완료금액);
        invoiceSheet.getRange(invoiceRowIndex, invoiceHeaders.indexOf('미수금') + 1).setValue(신규미수금);

        Logger.log('[createRefund] 청구서 업데이트: ' + 문서번호 +
                   ', 상태: ' + 신규상태 +
                   ', 결제완료금액: ' + 신규결제완료금액);

        // 6. 거래원장 상태 업데이트
        var orderNumbers = invoice[invoiceHeaders.indexOf('orderNumbers')];
        var 청구유형 = invoice[invoiceHeaders.indexOf('청구유형')];

        if (orderNumbers) {
          try {
            var orderNumbersArray = JSON.parse(orderNumbers);
            updateLedgerPaymentStatus(orderNumbersArray, 신규상태, 청구유형);
          } catch (e) {
            Logger.log('[createRefund] 거래원장 업데이트 실패: ' + e.message);
          }
        }
      }
    }

    Logger.log('[createRefund] 환불 처리 완료: ' + refundId);

    return {
      success: true,
      message: '환불이 처리되었습니다.',
      refund: {
        refundId: refundId,
        originalPaymentId: originalPaymentId,
        refundAmount: refundAmount,
        invoiceId: 문서번호
      }
    };

  } catch (error) {
    Logger.log('[createRefund Error] ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * API 래퍼
 */
function createRefundApi(params) {
  var result = createRefund(params);
  return safeReturn(result);
}
```

### 3.3 결제 내역 조회 (삭제/환불 포함)

```javascript
/**
 * 결제 내역 조회 (삭제/환불 필터 포함)
 * PaymentService.js 수정
 */
function getPaymentRecords(params) {
  try {
    var type = params.type || '';              // 입금/출금
    var company = params.company || '';
    var startDate = params.startDate || '';
    var endDate = params.endDate || '';
    var docNumber = params.docNumber || '';
    var includeDeleted = params.includeDeleted || false;  // 삭제 포함 여부
    var includeRefund = params.includeRefund !== false;   // 환불 포함 여부 (기본 true)

    var ss = SpreadsheetApp.openById('1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs');
    var sheet = ss.getSheetByName('결제내역');

    if (!sheet) {
      return { success: true, payments: [] };
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    var payments = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      // 삭제 필터
      var 삭제여부 = row[headers.indexOf('삭제여부')];
      if (!includeDeleted && 삭제여부) continue;

      // 환불 필터
      var 환불여부 = row[headers.indexOf('환불여부')] || false;
      if (!includeRefund && 환불여부) continue;

      // 유형 필터
      if (type && row[headers.indexOf('결제유형')] !== type) continue;

      // 거래처 필터
      if (company && row[headers.indexOf('거래처명')].indexOf(company) === -1) continue;

      // 문서번호 필터
      if (docNumber && row[headers.indexOf('문서번호')] !== docNumber) continue;

      // 날짜 필터
      if (startDate || endDate) {
        var 결제일 = new Date(row[headers.indexOf('결제일')]);
        if (startDate && 결제일 < new Date(startDate)) continue;
        if (endDate && 결제일 > new Date(endDate)) continue;
      }

      payments.push({
        결제ID: row[headers.indexOf('결제ID')],
        결제일: formatDateString(row[headers.indexOf('결제일')]),
        결제유형: row[headers.indexOf('결제유형')],
        거래처명: row[headers.indexOf('거래처명')],
        금액: row[headers.indexOf('금액')],
        결제수단: row[headers.indexOf('결제수단')],
        문서번호: row[headers.indexOf('문서번호')],
        발주번호: row[headers.indexOf('발주번호')],
        비고: row[headers.indexOf('비고')],
        삭제여부: 삭제여부,
        삭제일시: formatDateString(row[headers.indexOf('삭제일시')]),
        삭제자: row[headers.indexOf('삭제자')],
        입력일시: formatDateString(row[headers.indexOf('입력일시')]),
        입력자: row[headers.indexOf('입력자')],
        원결제ID: row[headers.indexOf('원결제ID')] || '',
        환불여부: 환불여부
      });
    }

    return {
      success: true,
      payments: payments,
      count: payments.length
    };

  } catch (error) {
    Logger.log('[getPaymentRecords Error] ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
```

---

## 4. 프론트엔드 UI 구현

### 4.1 결제 내역 테이블에 취소/환불 버튼 추가

**파일**: `Page_PaymentManagement.html` 및 `CommonScripts.html`

```javascript
/**
 * 결제 내역 렌더링 (취소/환불 버튼 포함)
 * CommonScripts.html 수정
 */
function renderPaymentList(payments) {
  var tbody = document.getElementById('payment-list-tbody');

  if (!payments || payments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="13" class="payment-empty">조회된 입출금 내역이 없습니다.</td></tr>';
    return;
  }

  var html = '';

  payments.forEach(function(payment) {
    var isDeleted = payment.삭제여부;
    var isRefund = payment.환불여부;
    var rowClass = isDeleted ? 'deleted-row' : (isRefund ? 'refund-row' : '');

    html += '<tr class="' + rowClass + '">';
    html += '  <td>' + payment.결제ID + '</td>';
    html += '  <td>' + payment.결제일 + '</td>';
    html += '  <td>';

    // 유형 배지
    if (isRefund) {
      html += '    <span class="payment-badge refund">환불</span>';
    } else {
      var badgeClass = (payment.결제유형 === '입금') ? 'income' : 'expense';
      html += '    <span class="payment-badge ' + badgeClass + '">' + payment.결제유형 + '</span>';
    }

    html += '  </td>';
    html += '  <td>' + payment.거래처명 + '</td>';

    // 금액 (환불은 빨간색)
    var amountClass = isRefund ? 'refund-amount' : '';
    html += '  <td class="num ' + amountClass + '">' + OB.formatCurrency(payment.금액) + '</td>';

    html += '  <td>' + payment.결제수단 + '</td>';
    html += '  <td>' + (payment.문서번호 || '-') + '</td>';
    html += '  <td>' + (payment.발주번호 || '-') + '</td>';
    html += '  <td>' + (payment.비고 || '-') + '</td>';
    html += '  <td>' + payment.입력일시 + '</td>';

    // 액션 버튼
    html += '  <td class="actions">';

    if (isDeleted) {
      // 취소된 결제
      html += '    <span class="deleted-label">취소됨</span>';
      html += '    <button class="payment-btn-small secondary" onclick="viewPaymentDetail(\'' + payment.결제ID + '\')">상세</button>';
    } else if (isRefund) {
      // 환불 거래
      html += '    <button class="payment-btn-small secondary" onclick="viewRefundDetail(\'' + payment.결제ID + '\', \'' + payment.원결제ID + '\')">상세</button>';
    } else {
      // 정상 결제
      html += '    <button class="payment-btn-small secondary" onclick="viewPaymentDetail(\'' + payment.결제ID + '\')">상세</button>';
      html += '    <button class="payment-btn-small danger" onclick="showCancelPaymentModal(\'' + payment.결제ID + '\')">취소</button>';
      html += '    <button class="payment-btn-small warning" onclick="showRefundModal(\'' + payment.결제ID + '\')">환불</button>';
    }

    html += '  </td>';
    html += '</tr>';
  });

  tbody.innerHTML = html;
}
```

### 4.2 결제 취소 모달

```javascript
/**
 * 결제 취소 모달 표시
 * CommonScripts.html 추가
 */
function showCancelPaymentModal(paymentId) {
  var modal = createModal('결제 취소', 'cancel-payment-modal');

  var body = modal.querySelector('.modal-body');
  body.innerHTML = '';

  var html = '';
  html += '<div class="warning-message">';
  html += '  <div class="warning-icon">⚠️</div>';
  html += '  <div class="warning-text">';
  html += '    <strong>결제 취소 확인</strong>';
  html += '    <p>결제를 취소하면 다음 작업이 수행됩니다:</p>';
  html += '    <ul>';
  html += '      <li>결제 내역이 "삭제됨"으로 표시됩니다</li>';
  html += '      <li>청구서의 결제완료금액이 감소합니다</li>';
  html += '      <li>청구서 상태가 자동으로 복원됩니다</li>';
  html += '      <li>거래원장의 결제 상태가 업데이트됩니다</li>';
  html += '    </ul>';
  html += '  </div>';
  html += '</div>';

  html += '<div class="form-group">';
  html += '  <label for="cancel-reason">취소 사유 *</label>';
  html += '  <input type="text" id="cancel-reason" placeholder="예: 금액 오입력" required />';
  html += '</div>';

  html += '<input type="hidden" id="cancel-payment-id" value="' + paymentId + '" />';

  body.innerHTML = html;

  var footer = modal.querySelector('.modal-footer');
  footer.innerHTML = '';
  footer.innerHTML += '<button class="payment-btn secondary" onclick="closeModal(\'cancel-payment-modal\')">닫기</button>';
  footer.innerHTML += '<button class="payment-btn danger" onclick="confirmCancelPayment()">확인 및 취소</button>';

  document.body.appendChild(modal);
  modal.classList.add('active');
}

/**
 * 결제 취소 확인
 */
function confirmCancelPayment() {
  var paymentId = document.getElementById('cancel-payment-id').value;
  var cancelReason = document.getElementById('cancel-reason').value;

  if (!cancelReason || cancelReason.trim() === '') {
    alert('취소 사유를 입력해주세요.');
    return;
  }

  if (!confirm('정말로 결제를 취소하시겠습니까?\n\n결제ID: ' + paymentId + '\n사유: ' + cancelReason)) {
    return;
  }

  OB.showLoading('결제를 취소하는 중...');

  google.script.run
    .withSuccessHandler(function(result) {
      OB.hideLoading();

      if (result.success) {
        alert('✅ ' + result.message);
        closeModal('cancel-payment-modal');
        loadPaymentList();
        loadPaymentSummary();
      } else {
        alert('❌ 취소 실패\n\n' + result.error);
      }
    })
    .withFailureHandler(function(error) {
      OB.hideLoading();
      alert('❌ 서버 오류\n\n' + error.message);
    })
    .cancelPaymentApi({
      paymentId: paymentId,
      cancelReason: cancelReason
    });
}
```

### 4.3 환불 모달

```javascript
/**
 * 환불 모달 표시
 * CommonScripts.html 추가
 */
function showRefundModal(paymentId) {
  OB.showLoading('결제 정보를 불러오는 중...');

  // 먼저 원결제 정보 조회
  google.script.run
    .withSuccessHandler(function(result) {
      OB.hideLoading();

      if (result.success) {
        renderRefundModal(result.payment);
      } else {
        alert('결제 정보 조회 실패: ' + result.error);
      }
    })
    .withFailureHandler(function(error) {
      OB.hideLoading();
      alert('서버 오류: ' + error.message);
    })
    .getPaymentDetailApi(paymentId);
}

/**
 * 환불 모달 렌더링
 */
function renderRefundModal(payment) {
  var modal = createModal('환불 처리', 'refund-modal');

  var body = modal.querySelector('.modal-body');
  body.innerHTML = '';

  var html = '';
  html += '<div class="info-message">';
  html += '  <div class="info-icon">ℹ️</div>';
  html += '  <div class="info-text">';
  html += '    <strong>환불 안내</strong>';
  html += '    <p>환불 처리 시 마이너스 결제 내역이 생성되며, 청구서의 결제완료금액이 감소합니다.</p>';
  html += '  </div>';
  html += '</div>';

  // 원결제 정보
  html += '<div class="original-payment-info">';
  html += '  <h3>원결제 정보</h3>';
  html += '  <div class="info-grid">';
  html += '    <div class="info-item">';
  html += '      <div class="label">결제ID</div>';
  html += '      <div class="value">' + payment.결제ID + '</div>';
  html += '    </div>';
  html += '    <div class="info-item">';
  html += '      <div class="label">결제일</div>';
  html += '      <div class="value">' + payment.결제일 + '</div>';
  html += '    </div>';
  html += '    <div class="info-item">';
  html += '      <div class="label">거래처</div>';
  html += '      <div class="value">' + payment.거래처명 + '</div>';
  html += '    </div>';
  html += '    <div class="info-item">';
  html += '      <div class="label">결제금액</div>';
  html += '      <div class="value amount">' + OB.formatCurrency(payment.금액) + '</div>';
  html += '    </div>';
  html += '  </div>';
  html += '</div>';

  // 환불 입력
  html += '<div class="refund-input-section">';
  html += '  <div class="form-group">';
  html += '    <label for="refund-date">환불일 *</label>';
  html += '    <input type="date" id="refund-date" value="' + getTodayString() + '" required />';
  html += '  </div>';

  html += '  <div class="form-group">';
  html += '    <label for="refund-amount">환불금액 *</label>';
  html += '    <input type="number" id="refund-amount" ';
  html += '           min="0" max="' + payment.금액 + '" ';
  html += '           placeholder="환불 금액 입력" required />';
  html += '    <div class="input-hint">최대 환불 가능: ' + OB.formatCurrency(payment.금액) + '</div>';
  html += '  </div>';

  html += '  <div class="form-group">';
  html += '    <label for="refund-reason">환불 사유 *</label>';
  html += '    <input type="text" id="refund-reason" placeholder="예: 제품 불량으로 인한 반품" required />';
  html += '  </div>';
  html += '</div>';

  html += '<input type="hidden" id="refund-payment-id" value="' + payment.결제ID + '" />';

  body.innerHTML = html;

  var footer = modal.querySelector('.modal-footer');
  footer.innerHTML = '';
  footer.innerHTML += '<button class="payment-btn secondary" onclick="closeModal(\'refund-modal\')">닫기</button>';
  footer.innerHTML += '<button class="payment-btn warning" onclick="confirmRefund()">환불 처리</button>';

  document.body.appendChild(modal);
  modal.classList.add('active');
}

/**
 * 환불 확인
 */
function confirmRefund() {
  var paymentId = document.getElementById('refund-payment-id').value;
  var refundDate = document.getElementById('refund-date').value;
  var refundAmount = Number(document.getElementById('refund-amount').value) || 0;
  var refundReason = document.getElementById('refund-reason').value;

  if (!refundDate) {
    alert('환불일을 선택해주세요.');
    return;
  }

  if (refundAmount <= 0) {
    alert('환불 금액을 입력해주세요.');
    return;
  }

  if (!refundReason || refundReason.trim() === '') {
    alert('환불 사유를 입력해주세요.');
    return;
  }

  if (!confirm('환불을 처리하시겠습니까?\n\n금액: ' + OB.formatCurrency(refundAmount) + '\n사유: ' + refundReason)) {
    return;
  }

  OB.showLoading('환불을 처리하는 중...');

  google.script.run
    .withSuccessHandler(function(result) {
      OB.hideLoading();

      if (result.success) {
        alert('✅ ' + result.message + '\n\n환불ID: ' + result.refund.refundId);
        closeModal('refund-modal');
        loadPaymentList();
        loadPaymentSummary();
      } else {
        alert('❌ 환불 실패\n\n' + result.error);
      }
    })
    .withFailureHandler(function(error) {
      OB.hideLoading();
      alert('❌ 서버 오류\n\n' + error.message);
    })
    .createRefundApi({
      originalPaymentId: paymentId,
      refundDate: refundDate,
      refundAmount: refundAmount,
      refundReason: refundReason
    });
}

/**
 * 모달 생성 헬퍼 함수
 */
function createModal(title, id) {
  var existingModal = document.getElementById(id);
  if (existingModal) {
    existingModal.remove();
  }

  var modal = document.createElement('div');
  modal.id = id;
  modal.className = 'payment-modal';

  modal.innerHTML = '';
  modal.innerHTML += '<div class="payment-modal-content">';
  modal.innerHTML += '  <div class="payment-modal-header">';
  modal.innerHTML += '    <h2>' + title + '</h2>';
  modal.innerHTML += '    <button class="payment-modal-close" onclick="closeModal(\'' + id + '\')">×</button>';
  modal.innerHTML += '  </div>';
  modal.innerHTML += '  <div class="modal-body"></div>';
  modal.innerHTML += '  <div class="modal-footer"></div>';
  modal.innerHTML += '</div>';

  return modal;
}

/**
 * 모달 닫기
 */
function closeModal(id) {
  var modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');
    setTimeout(function() {
      modal.remove();
    }, 300);
  }
}

/**
 * 오늘 날짜 문자열
 */
function getTodayString() {
  var today = new Date();
  var year = today.getFullYear();
  var month = String(today.getMonth() + 1).padStart(2, '0');
  var day = String(today.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}
```

### 4.4 CSS 추가

**파일**: `Page_PaymentManagement.html` 또는 `CommonScripts.html`

```css
/* 취소/환불 관련 스타일 */
.deleted-row {
  background: #f3f4f6;
  opacity: 0.6;
}

.refund-row {
  background: #fef3c7;
}

.payment-badge.refund {
  background: #fbbf24;
  color: #78350f;
}

.refund-amount {
  color: #dc2626;
  font-weight: 700;
}

.deleted-label {
  display: inline-block;
  padding: 3px 8px;
  background: #e5e7eb;
  color: #6b7280;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  margin-right: 4px;
}

.warning-message, .info-message {
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
}

.warning-message {
  background: #fef3c7;
  border: 1px solid #fbbf24;
}

.info-message {
  background: #dbeafe;
  border: 1px solid #3b82f6;
}

.warning-icon, .info-icon {
  font-size: 24px;
}

.warning-text strong, .info-text strong {
  display: block;
  margin-bottom: 8px;
  color: #0f172a;
}

.warning-text p, .info-text p {
  margin: 0 0 8px;
  color: #475569;
  font-size: 13px;
}

.warning-text ul {
  margin: 0;
  padding-left: 20px;
  color: #475569;
  font-size: 12px;
}

.original-payment-info {
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.original-payment-info h3 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #0f172a;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item .label {
  font-size: 11px;
  color: #64748b;
}

.info-item .value {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}

.info-item .value.amount {
  color: #2563eb;
  font-size: 16px;
}

.refund-input-section {
  margin-top: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 6px;
}

.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}

.form-group input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.input-hint {
  font-size: 11px;
  color: #64748b;
  margin-top: 4px;
}

.payment-modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  justify-content: center;
  align-items: center;
}

.payment-modal.active {
  display: flex;
}

.payment-modal-content {
  background: #fff;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.payment-modal-header {
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.payment-modal-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.payment-modal-close {
  background: transparent;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #64748b;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
```

---

## 5. 데이터 흐름 및 페이지 연동

### 5.1 결제 취소 프로세스

```
[결제 내역 페이지]
  └─ 사용자가 "취소" 버튼 클릭
      │
      ↓
  [취소 모달]
  └─ 취소 사유 입력
  └─ "확인 및 취소" 버튼
      │
      ↓
  [cancelPayment() 실행]
  ├─ 1. 결제내역 시트
  │   └─ 삭제여부 = true
  │   └─ 삭제일시 = now
  │   └─ 삭제자 = user
  │
  ├─ 2. 청구DB 시트
  │   └─ 결제완료금액 감소
  │   └─ 미수금 증가
  │   └─ 청구상태 복원 (PAID → PAID_PARTIAL 또는 ISSUED)
  │
  └─ 3. 거래원장 시트
      └─ 매출결제/매입결제 상태 업데이트
      │
      ↓
  [UI 새로고침]
  └─ 결제 내역 목록
  └─ 청구서 관리 페이지
```

### 5.2 환불 프로세스

```
[결제 내역 페이지]
  └─ 사용자가 "환불" 버튼 클릭
      │
      ↓
  [환불 모달]
  └─ 원결제 정보 표시
  └─ 환불일, 환불금액, 환불사유 입력
  └─ "환불 처리" 버튼
      │
      ↓
  [createRefund() 실행]
  ├─ 1. 결제내역 시트
  │   └─ 새 행 추가 (마이너스 금액)
  │   └─ 결제유형 = 반대 (입금 ↔ 출금)
  │   └─ 원결제ID = 원래 결제 ID
  │   └─ 환불여부 = true
  │
  ├─ 2. 청구DB 시트
  │   └─ 결제완료금액 감소
  │   └─ 미수금 증가
  │   └─ 청구상태 업데이트
  │
  └─ 3. 거래원장 시트
      └─ 매출결제/매입결제 상태 업데이트
      │
      ↓
  [UI 새로고침]
  └─ 결제 내역 목록 (환불 거래 표시)
```

### 5.3 스프레드시트 입력/수정 로직

#### 결제 취소 시퀀스

```javascript
/**
 * 결제 취소 스프레드시트 업데이트 순서
 */

// 1. 결제내역 시트 업데이트 (Soft Delete)
// 위치: PaymentService.js > cancelPayment()
var paymentSheet = ss.getSheetByName('결제내역');
paymentSheet.getRange(paymentRowIndex, 10).setValue(true);   // 삭제여부
paymentSheet.getRange(paymentRowIndex, 11).setValue(now);    // 삭제일시
paymentSheet.getRange(paymentRowIndex, 12).setValue(user);   // 삭제자

// 2. 청구DB 시트 업데이트 (상태 복원)
var invoiceSheet = ss.getSheetByName('청구DB');
var 신규결제완료금액 = 현재결제완료금액 - 취소금액;
var 신규미수금 = 청구금액 - 신규결제완료금액;
var 신규상태 = (신규결제완료금액 === 0) ? 'ISSUED' :
               (신규결제완료금액 >= 청구금액) ? 'PAID' : 'PAID_PARTIAL';

invoiceSheet.getRange(invoiceRowIndex, 청구상태Col + 1).setValue(신규상태);
invoiceSheet.getRange(invoiceRowIndex, 결제완료금액Col + 1).setValue(신규결제완료금액);
invoiceSheet.getRange(invoiceRowIndex, 미수금Col + 1).setValue(신규미수금);

// 3. 거래원장 시트 업데이트 (결제 상태)
var ledgerSheet = ss.getSheetByName('거래원장');
var statusText = (신규상태 === 'PAID') ? '결제완료' :
                 (신규상태 === 'PAID_PARTIAL') ? '부분결제' : '미결제';

// orderNumbers 배열의 각 발주번호에 대해
for (var i = 0; i < orderNumbersArray.length; i++) {
  var orderNumber = orderNumbersArray[i];
  // 해당 발주번호 행 찾아서 매출결제 또는 매입결제 컬럼 업데이트
  ledgerSheet.getRange(row, 매출결제Col + 1).setValue(statusText);
}
```

#### 환불 생성 시퀀스

```javascript
/**
 * 환불 생성 스프레드시트 업데이트 순서
 */

// 1. 결제내역 시트에 새 행 추가 (마이너스 금액)
var paymentSheet = ss.getSheetByName('결제내역');
var refundRowData = [
  refundId,               // PAY-20260103-002
  refundDate,             // 2026-01-03
  환불결제유형,           // '출금' (원래가 입금이면)
  거래처명,               // 동일
  -refundAmount,          // 마이너스 금액!
  결제수단,               // 동일
  문서번호,               // 청구ID (동일)
  '',                     // 발주번호
  '환불: ' + refundReason,  // 비고
  false,                  // 삭제여부
  '',                     // 삭제일시
  '',                     // 삭제자
  now,                    // 입력일시
  user,                   // 입력자
  originalPaymentId,      // 원결제ID (신규)
  true                    // 환불여부 (신규)
];

paymentSheet.appendRow(refundRowData);

// 2. 청구DB 업데이트 (취소와 동일)
// ... (위와 동일)

// 3. 거래원장 업데이트 (취소와 동일)
// ... (위와 동일)
```

---

## 6. 단계별 구현 계획

### Phase 1: 데이터베이스 스키마 확장 (0.5일)

**작업 항목:**
- [ ] 마이그레이션 스크립트 작성 (`MigratePaymentSchemaForRefund.js`)
- [ ] Apps Script 편집기에 스크립트 추가
- [ ] `runPaymentSchemaMigration()` 실행
- [ ] 실행 로그 확인 및 검증
  - 헤더 2개 추가 확인 (원결제ID, 환불여부)
  - 기존 데이터 초기화 확인
- [ ] 백업 생성 (시트 복사)

---

### Phase 2: 백엔드 로직 구현 (1.5일)

**Day 1: 취소 기능 (0.75일)**
- [ ] `cancelPayment()` 함수 구현
- [ ] `cancelPaymentApi()` API 래퍼 추가
- [ ] 청구서 상태 복원 로직
- [ ] 거래원장 업데이트 로직
- [ ] 단위 테스트

**Day 2: 환불 기능 (0.75일)**
- [ ] `createRefund()` 함수 구현
- [ ] `createRefundApi()` API 래퍼 추가
- [ ] 마이너스 금액 처리
- [ ] 원결제 검증 로직
- [ ] 통합 테스트

---

### Phase 3: 프론트엔드 UI 구현 (1일)

**작업 항목:**
- [ ] 결제 내역 테이블 수정 (취소/환불 버튼)
- [ ] 취소 모달 구현
- [ ] 환불 모달 구현
- [ ] 삭제/환불 거래 표시 스타일
- [ ] CSS 추가
- [ ] 브라우저 테스트

---

### Phase 4: 통합 테스트 및 디버깅 (0.5일)

**테스트 체크리스트:**

```markdown
## 결제 취소/환불 기능 테스트 체크리스트

### A. 결제 취소
- [ ] 정상 결제 취소
  - [ ] 결제내역 삭제여부 = true
  - [ ] 청구서 결제완료금액 감소
  - [ ] 청구서 상태 복원 (PAID → PAID_PARTIAL 또는 ISSUED)
  - [ ] 거래원장 결제 상태 업데이트
- [ ] 부분 결제 취소
  - [ ] 청구서 상태 = PAID_PARTIAL 유지
  - [ ] 미수금 정확히 증가
- [ ] 완납 후 일부 취소
  - [ ] 청구서 상태 = PAID → PAID_PARTIAL
- [ ] 오류 처리
  - [ ] 이미 취소된 결제 재취소 방지
  - [ ] 존재하지 않는 결제 ID

### B. 환불 처리
- [ ] 전액 환불
  - [ ] 마이너스 금액 결제 생성
  - [ ] 원결제ID 설정
  - [ ] 환불여부 = true
  - [ ] 청구서 상태 복원
- [ ] 부분 환불
  - [ ] 환불 금액만큼 결제완료금액 감소
  - [ ] 청구서 상태 업데이트
- [ ] 여러 번 환불
  - [ ] 누적 환불 금액이 원결제 초과 방지
- [ ] 오류 처리
  - [ ] 환불 금액 > 원결제 금액
  - [ ] 0원 환불

### C. UI 표시
- [ ] 결제 내역 목록
  - [ ] 취소된 결제 회색 표시
  - [ ] 환불 거래 노란색 표시
  - [ ] 마이너스 금액 빨간색
  - [ ] 취소/환불 버튼 조건부 표시
- [ ] 취소 모달
  - [ ] 경고 메시지 표시
  - [ ] 취소 사유 필수 입력
- [ ] 환불 모달
  - [ ] 원결제 정보 표시
  - [ ] 최대 금액 제한
  - [ ] 환불 사유 필수 입력

### D. 통계
- [ ] 결제 통계에서 환불 제외 옵션
- [ ] 환불 금액 별도 집계
```

---

## 7. 예상 개발 기간

| Phase | 작업 내용 | 일정 |
|-------|----------|------|
| **Phase 1** | DB 스키마 확장 | 0.5일 |
| **Phase 2** | 백엔드 로직 구현 | 1.5일 |
| **Phase 3** | 프론트엔드 UI 구현 | 1일 |
| **Phase 4** | 통합 테스트 | 0.5일 |
| **총계** | | **3.5일** |

---

## 8. 위험 요소 및 대응 방안

### 8.1 회계 감사 추적 부족

**위험:**
- 취소/환불 이력이 불충분하여 감사 시 문제

**대응:**
- 모든 취소/환불에 사유 필수 입력
- 삭제일시, 삭제자 자동 기록
- 환불은 별도 거래로 기록 (감사 추적 용이)

### 8.2 동시성 문제

**위험:**
- 한 사용자가 취소하는 동안 다른 사용자가 동일 청구서에 결제 입력

**대응:**
- 청구서 업데이트 시 낙관적 잠금 적용 (SPEC_01 참고)
- 오류 발생 시 명확한 메시지 표시

### 8.3 부분 환불 복잡도

**위험:**
- 여러 번 환불 시 계산 오류

**대응:**
- 환불 전 현재 결제완료금액 재조회
- 환불 가능 금액 실시간 계산
- 검증 로직 강화

---

## 9. 참고 자료

### 9.1 관련 파일

- `PaymentService.js` - 결제 관리 백엔드
- `ApiService.js` - API 엔드포인트
- `Page_PaymentManagement.html` - 결제 관리 페이지
- `CommonScripts.html` - 모달 및 UI 로직

### 9.2 스프레드시트 구조

**결제내역 시트 (확장 후):**
```
총 16개 컬럼:
1. 결제ID, 2. 결제일, 3. 결제유형, 4. 거래처명, 5. 금액,
6. 결제수단, 7. 문서번호, 8. 발주번호, 9. 비고,
10. 삭제여부, 11. 삭제일시, 12. 삭제자,
13. 입력일시, 14. 입력자,
15. 원결제ID (신규), 16. 환불여부 (신규)
```

---

**작성자**: Claude (AI Assistant)
**검토자**: (담당자 이름)
**승인자**: (승인자 이름)
**버전**: 1.0
**최종 수정일**: 2026-01-03
