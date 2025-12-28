/**
 * ============================================================
 * ForcePopulateOrderNumbers.js
 * orderNumbers 컬럼 강제 채우기 스크립트
 * ============================================================
 *
 * 사용 시나리오:
 * - orderNumbers 컬럼이 있지만 데이터가 비어있는 경우
 * - 마이그레이션이 실패했거나 일부만 처리된 경우
 *
 * 처리 방법:
 * 1. 레거시 "발주번호" 컬럼에서 복사
 * 2. 없으면 마감ID로 마감상세DB에서 조회
 * 3. 둘 다 없으면 빈 배열 []
 * ============================================================
 */

// 상수는 SettlementService.js 및 다른 파일에 이미 정의되어 있으므로 재선언하지 않음
// var PAYMENT_SS_ID = '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs';
// var OB_SETTLEMENT_DETAIL_SHEET = '마감상세DB';

/**
 * 메인 실행 함수
 */
function forcePopulateOrderNumbers() {
  Logger.log('');
  Logger.log('========================================');
  Logger.log('orderNumbers 컬럼 강제 채우기 시작');
  Logger.log('========================================');
  Logger.log('');

  var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
  var sheet = ss.getSheetByName('청구DB');

  if (!sheet) {
    Logger.log('❌ 청구DB 시트를 찾을 수 없습니다.');
    return;
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    Logger.log('⚠️ 데이터가 없습니다.');
    return;
  }

  var headers = data[0];

  // 컬럼 인덱스 찾기
  var orderNumbersCol = headers.indexOf('orderNumbers');
  var legacyCol = headers.indexOf('발주번호');
  var settlementIdCol = headers.indexOf('마감ID');
  var invoiceIdCol = headers.indexOf('청구ID');

  Logger.log('컬럼 위치 확인:');
  Logger.log('  orderNumbers: ' + (orderNumbersCol !== -1 ? (orderNumbersCol + 1) + '열' : '없음'));
  Logger.log('  발주번호 (레거시): ' + (legacyCol !== -1 ? (legacyCol + 1) + '열' : '없음'));
  Logger.log('  마감ID: ' + (settlementIdCol !== -1 ? (settlementIdCol + 1) + '열' : '없음'));
  Logger.log('');

  if (orderNumbersCol === -1) {
    Logger.log('❌ orderNumbers 컬럼을 찾을 수 없습니다!');
    Logger.log('💡 Phase 1 Setup을 먼저 실행하세요: SetupPaymentSheets.js');
    return;
  }

  var processedCount = 0;
  var method1Count = 0;  // 레거시 컬럼에서 복사
  var method2Count = 0;  // 마감ID로 조회
  var method3Count = 0;  // 빈 배열
  var alreadyFilledCount = 0;

  // 각 행 처리
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var invoiceId = row[invoiceIdCol];
    var currentValue = String(row[orderNumbersCol] || '').trim();

    // 이미 채워진 행은 스킵
    if (currentValue && currentValue !== '' && currentValue !== '[]') {
      try {
        var parsed = JSON.parse(currentValue);
        if (Array.isArray(parsed) && parsed.length > 0) {
          alreadyFilledCount++;
          continue;
        }
      } catch (e) {
        // 잘못된 형식이면 계속 진행
      }
    }

    var orderNumbers = [];
    var method = '';

    // 방법 1: 레거시 "발주번호" 컬럼에서 복사
    if (legacyCol !== -1) {
      var legacyValue = String(row[legacyCol] || '').trim();
      if (legacyValue && legacyValue !== '' && legacyValue !== '[]') {
        // JSON 형식인지 확인
        try {
          var parsed = JSON.parse(legacyValue);
          if (Array.isArray(parsed)) {
            orderNumbers = parsed;
            method = 'LEGACY';
            method1Count++;
          }
        } catch (e) {
          // JSON이 아니면 단일 값으로 처리
          orderNumbers = [legacyValue];
          method = 'LEGACY';
          method1Count++;
        }
      }
    }

    // 방법 2: 마감ID로 마감상세DB에서 조회
    if (orderNumbers.length === 0 && settlementIdCol !== -1) {
      var settlementId = String(row[settlementIdCol] || '').trim();
      if (settlementId && settlementId !== '') {
        orderNumbers = getOrderNumbersFromSettlement(settlementId);
        if (orderNumbers.length > 0) {
          method = 'SETTLEMENT';
          method2Count++;
        }
      }
    }

    // 방법 3: 빈 배열
    if (orderNumbers.length === 0) {
      orderNumbers = [];
      method = 'EMPTY';
      method3Count++;
    }

    // orderNumbers 컬럼 업데이트
    var jsonValue = JSON.stringify(orderNumbers);
    sheet.getRange(i + 1, orderNumbersCol + 1).setValue(jsonValue);

    processedCount++;

    if (processedCount % 10 === 0 || orderNumbers.length > 0) {
      Logger.log('행 ' + (i + 1) + ' (' + invoiceId + '): ' + method + ' - ' + orderNumbers.length + '건');
    }
  }

  Logger.log('');
  Logger.log('========================================');
  Logger.log('처리 완료');
  Logger.log('========================================');
  Logger.log('');
  Logger.log('📊 통계:');
  Logger.log('  - 이미 채워진 행: ' + alreadyFilledCount + '개');
  Logger.log('  - 레거시 컬럼에서 복사: ' + method1Count + '개');
  Logger.log('  - 마감ID로 조회: ' + method2Count + '개');
  Logger.log('  - 빈 배열 설정: ' + method3Count + '개');
  Logger.log('  - 총 처리: ' + processedCount + '개');
  Logger.log('');
}

/**
 * 마감ID로 발주번호 목록 조회
 */
function getOrderNumbersFromSettlement(settlementId) {
  try {
    if (!settlementId || settlementId === '') {
      return [];
    }

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var detailSheet = ss.getSheetByName(OB_SETTLEMENT_DETAIL_SHEET);

    if (!detailSheet) {
      return [];
    }

    var data = detailSheet.getDataRange().getValues();
    var headers = data[0];

    var settlementIdCol = headers.indexOf('마감ID');
    var orderNumberCol = headers.indexOf('발주번호');

    if (settlementIdCol === -1 || orderNumberCol === -1) {
      return [];
    }

    var orderNumbers = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][settlementIdCol] === settlementId) {
        var orderNumber = data[i][orderNumberCol];
        if (orderNumber && orderNumber !== '') {
          orderNumbers.push(orderNumber);
        }
      }
    }

    return orderNumbers;

  } catch (err) {
    Logger.log('[getOrderNumbersFromSettlement Error] ' + err.message);
    return [];
  }
}
