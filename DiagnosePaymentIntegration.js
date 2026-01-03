/**
 * ============================================================
 * DiagnosePaymentIntegration.js
 * 결제 시스템 통합 이슈 진단 스크립트
 * ============================================================
 * 사용 방법:
 * 1. Google Apps Script 편집기에서 이 파일 추가
 * 2. diagnosePaymentIntegration() 함수 실행
 * 3. 로그 확인 (Ctrl+Enter 또는 보기 > 로그)
 * ============================================================
 */

var PAYMENT_SS_ID = '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs';

/**
 * 메인 진단 함수
 */
function diagnosePaymentIntegration() {
  Logger.log('');
  Logger.log('========================================');
  Logger.log('결제 시스템 통합 이슈 진단 시작');
  Logger.log('========================================');
  Logger.log('');

  var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);

  // 1. 청구DB 컬럼 구조 확인
  diagnoseInvoiceSheetStructure(ss);

  // 2. 청구유형 값 분포 확인
  diagnoseInvoiceTypes(ss);

  // 3. orderNumbers 필드 상태 확인
  diagnoseOrderNumbers(ss);

  // 4. 거래원장 컬럼 확인
  diagnoseLedgerColumns(ss);

  // 5. 샘플 데이터 확인
  diagnoseSampleData(ss);

  Logger.log('');
  Logger.log('========================================');
  Logger.log('진단 완료');
  Logger.log('========================================');
}

/**
 * 1. 청구DB 컬럼 구조 확인
 */
function diagnoseInvoiceSheetStructure(ss) {
  Logger.log('');
  Logger.log('[1] 청구DB 시트 컬럼 구조 확인');
  Logger.log('----------------------------------------');

  var sheet = ss.getSheetByName('청구DB');

  if (!sheet) {
    Logger.log('❌ 청구DB 시트를 찾을 수 없습니다.');
    return;
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  Logger.log('✅ 청구DB 시트 존재');
  Logger.log('📊 총 컬럼 수: ' + headers.length);
  Logger.log('');
  Logger.log('컬럼 목록:');

  headers.forEach(function(header, index) {
    var marker = '';
    if (header === 'billingType') marker = ' ← ⭐ Phase 1 추가';
    if (header === 'orderNumbers') marker = ' ← ⭐ Phase 1 추가';
    if (header === '청구유형') marker = ' ← 🔍 문제 2 관련';

    Logger.log('  ' + (index + 1) + '. ' + header + marker);
  });

  // 필수 컬럼 확인
  var hasBillingType = headers.indexOf('billingType') !== -1;
  var hasOrderNumbers = headers.indexOf('orderNumbers') !== -1;
  var hasInvoiceType = headers.indexOf('청구유형') !== -1;

  Logger.log('');
  Logger.log('필수 컬럼 확인:');
  Logger.log('  - billingType: ' + (hasBillingType ? '✅ 존재' : '❌ 없음'));
  Logger.log('  - orderNumbers: ' + (hasOrderNumbers ? '✅ 존재' : '❌ 없음'));
  Logger.log('  - 청구유형: ' + (hasInvoiceType ? '✅ 존재' : '❌ 없음'));

  if (!hasBillingType || !hasOrderNumbers) {
    Logger.log('');
    Logger.log('⚠️ 경고: Phase 1 셋업이 실행되지 않았습니다.');
    Logger.log('💡 해결: SetupPaymentSheets.js의 setupPaymentSheets() 함수를 실행하세요.');
  }
}

/**
 * 2. 청구유형 값 분포 확인
 */
function diagnoseInvoiceTypes(ss) {
  Logger.log('');
  Logger.log('[2] 청구유형 값 분포 확인');
  Logger.log('----------------------------------------');

  var sheet = ss.getSheetByName('청구DB');

  if (!sheet) {
    Logger.log('❌ 청구DB 시트를 찾을 수 없습니다.');
    return;
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var typeColIndex = headers.indexOf('청구유형');

  if (typeColIndex === -1) {
    Logger.log('❌ 청구유형 컬럼을 찾을 수 없습니다.');
    return;
  }

  // 값 분포 집계
  var distribution = {};
  var totalCount = 0;

  for (var i = 1; i < data.length; i++) {
    var typeValue = String(data[i][typeColIndex] || '').trim();

    if (typeValue) {
      distribution[typeValue] = (distribution[typeValue] || 0) + 1;
      totalCount++;
    }
  }

  Logger.log('📊 총 청구서 건수: ' + totalCount);
  Logger.log('');
  Logger.log('청구유형 분포:');

  for (var type in distribution) {
    var count = distribution[type];
    var percent = ((count / totalCount) * 100).toFixed(1);
    var marker = '';

    if (type === 'SALES' || type === 'PURCHASE') {
      marker = ' ← ✅ 표준 값';
    } else if (type === '매출' || type === '매입') {
      marker = ' ← ⚠️ 한글 값 (표준화 필요)';
    } else {
      marker = ' ← ❓ 알 수 없는 값';
    }

    Logger.log('  - "' + type + '": ' + count + '건 (' + percent + '%)' + marker);
  }

  // 권장 사항
  Logger.log('');
  if (distribution['매출'] || distribution['매입']) {
    Logger.log('💡 권장: 한글 값을 영문으로 표준화하세요.');
    Logger.log('   - "매출" → "SALES"');
    Logger.log('   - "매입" → "PURCHASE"');
    Logger.log('   - 스크립트: migrateBillingTypes() 함수 실행');
  } else if (distribution['SALES'] || distribution['PURCHASE']) {
    Logger.log('✅ 모든 청구유형이 표준 값(SALES/PURCHASE)으로 저장되어 있습니다.');
  } else {
    Logger.log('⚠️ 청구서 데이터가 없거나 알 수 없는 값이 있습니다.');
  }
}

/**
 * 3. orderNumbers 필드 상태 확인
 */
function diagnoseOrderNumbers(ss) {
  Logger.log('');
  Logger.log('[3] orderNumbers 필드 상태 확인');
  Logger.log('----------------------------------------');

  var sheet = ss.getSheetByName('청구DB');

  if (!sheet) {
    Logger.log('❌ 청구DB 시트를 찾을 수 없습니다.');
    return;
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var orderNumbersColIndex = headers.indexOf('orderNumbers');

  if (orderNumbersColIndex === -1) {
    Logger.log('❌ orderNumbers 컬럼을 찾을 수 없습니다.');
    Logger.log('💡 해결: SetupPaymentSheets.js의 setupPaymentSheets() 함수를 실행하세요.');
    return;
  }

  // orderNumbers 상태 집계
  var emptyCount = 0;
  var filledCount = 0;
  var invalidCount = 0;
  var sampleFilled = null;

  for (var i = 1; i < data.length; i++) {
    var orderNumbersValue = String(data[i][orderNumbersColIndex] || '').trim();

    if (!orderNumbersValue || orderNumbersValue === '[]') {
      emptyCount++;
    } else {
      try {
        var parsed = JSON.parse(orderNumbersValue);
        if (Array.isArray(parsed) && parsed.length > 0) {
          filledCount++;
          if (!sampleFilled) {
            sampleFilled = {
              row: i + 1,
              invoiceId: data[i][0],
              orderNumbers: parsed
            };
          }
        } else {
          emptyCount++;
        }
      } catch (e) {
        invalidCount++;
      }
    }
  }

  var totalCount = data.length - 1;

  Logger.log('📊 총 청구서 건수: ' + totalCount);
  Logger.log('');
  Logger.log('orderNumbers 상태:');
  Logger.log('  - 비어있음 ([] 또는 없음): ' + emptyCount + '건 (' + ((emptyCount / totalCount) * 100).toFixed(1) + '%)');
  Logger.log('  - 채워져 있음: ' + filledCount + '건 (' + ((filledCount / totalCount) * 100).toFixed(1) + '%)');
  Logger.log('  - 잘못된 형식: ' + invalidCount + '건');

  if (sampleFilled) {
    Logger.log('');
    Logger.log('✅ 샘플 (채워진 데이터):');
    Logger.log('  - 행: ' + sampleFilled.row);
    Logger.log('  - 청구서ID: ' + sampleFilled.invoiceId);
    Logger.log('  - orderNumbers: ' + JSON.stringify(sampleFilled.orderNumbers));
  }

  // 문제 분석
  Logger.log('');
  if (emptyCount > 0) {
    Logger.log('⚠️ 문제 발견: ' + emptyCount + '건의 청구서에 orderNumbers가 비어있습니다.');
    Logger.log('');
    Logger.log('💡 가능한 원인:');
    Logger.log('  1. createBilling() 함수가 orderNumbers를 채우지 않음');
    Logger.log('  2. 임시 청구서 (createTempInvoice)는 의도적으로 빈 배열');
    Logger.log('');
    Logger.log('💡 해결 방안:');
    Logger.log('  - createBilling() 수정: getOrderNumbersFromSettlement() 함수 추가');
    Logger.log('  - 마감ID → 마감상세DB → 발주번호 배열 추출');
  } else {
    Logger.log('✅ 모든 청구서에 orderNumbers가 채워져 있습니다.');
  }
}

/**
 * 4. 거래원장 컬럼 확인
 */
function diagnoseLedgerColumns(ss) {
  Logger.log('');
  Logger.log('[4] 거래원장 컬럼 확인');
  Logger.log('----------------------------------------');

  var sheet = ss.getSheetByName('거래원장');

  if (!sheet) {
    Logger.log('❌ 거래원장 시트를 찾을 수 없습니다.');
    return;
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  Logger.log('✅ 거래원장 시트 존재');
  Logger.log('📊 총 컬럼 수: ' + headers.length);
  Logger.log('');

  // 필수 컬럼 확인
  var colOrderNumber = headers.indexOf('발주번호');
  var colPayBuy = headers.indexOf('매입결제');
  var colPaySell = headers.indexOf('매출결제');

  Logger.log('필수 컬럼 확인:');
  Logger.log('  - 발주번호: ' + (colOrderNumber !== -1 ? '✅ 존재 (열 ' + (colOrderNumber + 1) + ')' : '❌ 없음'));
  Logger.log('  - 매입결제: ' + (colPayBuy !== -1 ? '✅ 존재 (열 ' + (colPayBuy + 1) + ')' : '❌ 없음'));
  Logger.log('  - 매출결제: ' + (colPaySell !== -1 ? '✅ 존재 (열 ' + (colPaySell + 1) + ')' : '❌ 없음'));

  if (colOrderNumber === -1 || colPayBuy === -1 || colPaySell === -1) {
    Logger.log('');
    Logger.log('❌ 필수 컬럼이 없습니다. 거래원장 시트 구조를 확인하세요.');
    return;
  }

  // 샘플 데이터 확인
  var data = sheet.getDataRange().getValues();
  var sampleCount = Math.min(5, data.length - 1);

  if (sampleCount > 0) {
    Logger.log('');
    Logger.log('샘플 데이터 (최대 5건):');

    for (var i = 1; i <= sampleCount; i++) {
      var row = data[i];
      Logger.log('  ' + i + '. 발주번호: ' + row[colOrderNumber] +
                 ', 매입결제: "' + (row[colPayBuy] || '(없음)') + '"' +
                 ', 매출결제: "' + (row[colPaySell] || '(없음)') + '"');
    }
  }

  // 상태 값 분포
  var payBuyDistribution = {};
  var paySellDistribution = {};

  for (var i = 1; i < data.length; i++) {
    var payBuy = String(data[i][colPayBuy] || '').trim();
    var paySell = String(data[i][colPaySell] || '').trim();

    if (payBuy) payBuyDistribution[payBuy] = (payBuyDistribution[payBuy] || 0) + 1;
    if (paySell) paySellDistribution[paySell] = (paySellDistribution[paySell] || 0) + 1;
  }

  Logger.log('');
  Logger.log('매입결제 상태 분포:');
  for (var status in payBuyDistribution) {
    Logger.log('  - "' + status + '": ' + payBuyDistribution[status] + '건');
  }

  Logger.log('');
  Logger.log('매출결제 상태 분포:');
  for (var status in paySellDistribution) {
    Logger.log('  - "' + status + '": ' + paySellDistribution[status] + '건');
  }
}

/**
 * 5. 샘플 데이터 확인
 */
function diagnoseSampleData(ss) {
  Logger.log('');
  Logger.log('[5] 샘플 데이터 종합 확인');
  Logger.log('----------------------------------------');

  var invoiceSheet = ss.getSheetByName('청구DB');
  var ledgerSheet = ss.getSheetByName('거래원장');

  if (!invoiceSheet || !ledgerSheet) {
    Logger.log('❌ 필수 시트를 찾을 수 없습니다.');
    return;
  }

  var invoiceData = invoiceSheet.getDataRange().getValues();
  var invoiceHeaders = invoiceData[0];

  // 샘플: 첫 번째 청구서 데이터
  if (invoiceData.length > 1) {
    var sampleRow = invoiceData[1];

    Logger.log('📋 샘플: 청구서 데이터 (첫 번째 행)');
    Logger.log('');

    invoiceHeaders.forEach(function(header, index) {
      var value = sampleRow[index];
      var displayValue = value;

      if (header === 'orderNumbers') {
        try {
          var parsed = JSON.parse(value || '[]');
          displayValue = JSON.stringify(parsed) + ' (배열 길이: ' + parsed.length + ')';
        } catch (e) {
          displayValue = value + ' (파싱 실패)';
        }
      }

      Logger.log('  - ' + header + ': ' + displayValue);
    });
  } else {
    Logger.log('⚠️ 청구서 데이터가 없습니다.');
  }
}

/**
 * 보너스: 문제 요약 리포트
 */
function generateProblemSummary() {
  Logger.log('');
  Logger.log('========================================');
  Logger.log('문제 요약 리포트');
  Logger.log('========================================');
  Logger.log('');

  var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
  var problems = [];

  // 문제 1: 청구DB 컬럼 확인
  var invoiceSheet = ss.getSheetByName('청구DB');
  if (invoiceSheet) {
    var headers = invoiceSheet.getRange(1, 1, 1, invoiceSheet.getLastColumn()).getValues()[0];
    if (headers.indexOf('billingType') === -1 || headers.indexOf('orderNumbers') === -1) {
      problems.push({
        severity: 'HIGH',
        title: 'Phase 1 셋업 미실행',
        description: 'billingType 또는 orderNumbers 컬럼이 없습니다.',
        solution: 'SetupPaymentSheets.js의 setupPaymentSheets() 함수를 실행하세요.'
      });
    }
  }

  // 문제 2: 청구유형 한글 값
  if (invoiceSheet) {
    var data = invoiceSheet.getDataRange().getValues();
    var typeCol = data[0].indexOf('청구유형');
    var hasKorean = false;

    for (var i = 1; i < data.length; i++) {
      var type = String(data[i][typeCol] || '');
      if (type === '매출' || type === '매입') {
        hasKorean = true;
        break;
      }
    }

    if (hasKorean) {
      problems.push({
        severity: 'MEDIUM',
        title: '청구유형 한글 값 발견',
        description: '일부 청구서가 "매출"/"매입"으로 저장되어 있습니다.',
        solution: 'migrateBillingTypes() 스크립트를 실행하여 "SALES"/"PURCHASE"로 변환하세요.'
      });
    }
  }

  // 문제 3: orderNumbers 비어있음
  if (invoiceSheet) {
    var data = invoiceSheet.getDataRange().getValues();
    var orderNumCol = data[0].indexOf('orderNumbers');
    var emptyCount = 0;

    if (orderNumCol !== -1) {
      for (var i = 1; i < data.length; i++) {
        var val = String(data[i][orderNumCol] || '').trim();
        if (!val || val === '[]') {
          emptyCount++;
        }
      }

      if (emptyCount > 0) {
        problems.push({
          severity: 'HIGH',
          title: 'orderNumbers 필드 비어있음',
          description: emptyCount + '건의 청구서에 orderNumbers가 비어있습니다.',
          solution: 'createBilling() 함수를 수정하여 orderNumbers를 자동으로 채우도록 하세요.'
        });
      }
    }
  }

  // 출력
  if (problems.length === 0) {
    Logger.log('✅ 발견된 문제 없음');
  } else {
    Logger.log('발견된 문제: ' + problems.length + '개');
    Logger.log('');

    problems.forEach(function(problem, index) {
      var severityIcon = problem.severity === 'HIGH' ? '🔴' : '🟡';
      Logger.log(severityIcon + ' 문제 ' + (index + 1) + ': ' + problem.title);
      Logger.log('  심각도: ' + problem.severity);
      Logger.log('  설명: ' + problem.description);
      Logger.log('  해결: ' + problem.solution);
      Logger.log('');
    });
  }
}
