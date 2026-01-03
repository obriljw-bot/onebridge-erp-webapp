/**
 * MigrateInvoiceSchemaForPartialPayment.js
 * 청구DB 스키마 확장 (부분 결제 지원)
 *
 * SPEC_01: 부분 결제 기능
 * - 결제완료금액 컬럼 추가 (T열, 20번째)
 * - 미수금 컬럼 추가 (U열, 21번째)
 * - 최종결제일 컬럼 추가 (V열, 22번째)
 */

/**
 * 청구DB 스키마 확장 마이그레이션
 */
function migrateInvoiceSchemaForPartialPayment() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName('청구DB');

  if (!sheet) {
    throw new Error('청구DB 시트를 찾을 수 없습니다.');
  }

  // 현재 헤더 확인
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log('[Migration] 현재 컬럼 수: ' + headers.length);
  Logger.log('[Migration] 현재 헤더: ' + headers.join(', '));

  // 이미 추가되었는지 확인
  if (headers.indexOf('결제완료금액') !== -1) {
    Logger.log('[Migration] ⚠️  이미 마이그레이션 완료됨');
    return {
      success: true,
      message: '이미 마이그레이션 완료됨',
      skipped: true
    };
  }

  // 1. 헤더 추가 (20, 21, 22번째 컬럼)
  var startCol = headers.length + 1;
  var newHeaders = ['결제완료금액', '미수금', '최종결제일'];

  Logger.log('[Migration] 새 컬럼 추가 위치: ' + startCol + '번째부터');
  Logger.log('[Migration] 추가할 컬럼: ' + newHeaders.join(', '));

  sheet.getRange(1, startCol, 1, 3).setValues([newHeaders]);

  // 헤더 스타일 적용
  sheet.getRange(1, startCol, 1, 3)
    .setFontWeight('bold')
    .setBackground('#dbeafe')
    .setHorizontalAlignment('center')
    .setBorder(true, true, true, true, true, true);

  // 컬럼 너비 설정
  sheet.setColumnWidth(startCol, 120);     // 결제완료금액
  sheet.setColumnWidth(startCol + 1, 120); // 미수금
  sheet.setColumnWidth(startCol + 2, 100); // 최종결제일

  Logger.log('[Migration] ✅ 헤더 추가 완료');

  // 2. 기존 데이터 마이그레이션
  var dataRange = sheet.getDataRange();
  var data = dataRange.getValues();

  var 청구금액Col = headers.indexOf('청구금액');
  var 청구상태Col = headers.indexOf('청구상태');
  var 결제일시Col = headers.indexOf('결제일시');

  if (청구금액Col === -1 || 청구상태Col === -1) {
    throw new Error('필수 컬럼(청구금액, 청구상태)을 찾을 수 없습니다.');
  }

  Logger.log('[Migration] 기존 데이터 마이그레이션 시작...');
  Logger.log('[Migration] 청구금액 컬럼: ' + (청구금액Col + 1) + '번째');
  Logger.log('[Migration] 청구상태 컬럼: ' + (청구상태Col + 1) + '번째');

  var migratedCount = 0;
  var paidCount = 0;
  var issuedCount = 0;

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
      paidCount++;
    } else if (청구상태 === 'ISSUED' || 청구상태 === 'PAID_PARTIAL') {
      // 발행됨 또는 부분결제 상태 → 미수금 = 청구금액
      결제완료금액 = 0;
      미수금 = 청구금액;
      issuedCount++;
    }
    // DRAFT 상태는 아무것도 안 함 (기본값 유지)

    // 데이터 입력
    sheet.getRange(i + 1, startCol).setValue(결제완료금액);
    sheet.getRange(i + 1, startCol + 1).setValue(미수금);
    if (최종결제일) {
      sheet.getRange(i + 1, startCol + 2).setValue(최종결제일);
    }

    migratedCount++;
  }

  Logger.log('[Migration] ✅ 기존 데이터 마이그레이션 완료');
  Logger.log('[Migration]    총 ' + migratedCount + '건 처리');
  Logger.log('[Migration]    - PAID: ' + paidCount + '건 (완납 처리)');
  Logger.log('[Migration]    - ISSUED: ' + issuedCount + '건 (미수금 설정)');

  // 3. 숫자 형식 적용 (결제완료금액, 미수금)
  var numericFormat = '#,##0';
  var lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    // 결제완료금액 컬럼
    sheet.getRange(2, startCol, lastRow - 1, 1).setNumberFormat(numericFormat);
    // 미수금 컬럼
    sheet.getRange(2, startCol + 1, lastRow - 1, 1).setNumberFormat(numericFormat);
  }

  Logger.log('[Migration] ✅ 숫자 형식 적용 완료');

  // 4. 완료 메시지
  Logger.log('========================================');
  Logger.log('✅ 청구DB 스키마 확장 완료');
  Logger.log('   추가된 컬럼: ' + newHeaders.join(', '));
  Logger.log('   마이그레이션된 행: ' + migratedCount + '건');
  Logger.log('========================================');

  return {
    success: true,
    message: '청구DB 스키마 확장 완료',
    addedColumns: newHeaders,
    migratedRows: migratedCount,
    details: {
      paidCount: paidCount,
      issuedCount: issuedCount
    }
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

    if (result.skipped) {
      Logger.log('');
      Logger.log('⏭️  마이그레이션 스킵');
      Logger.log('   이유: ' + result.message);
      Logger.log('========================================');
    } else {
      Logger.log('');
      Logger.log('✅ 마이그레이션 성공');
      Logger.log('   메시지: ' + result.message);
      Logger.log('   추가 컬럼: ' + result.addedColumns.join(', '));
      Logger.log('   마이그레이션된 행: ' + result.migratedRows);
      if (result.details) {
        Logger.log('   - PAID 처리: ' + result.details.paidCount + '건');
        Logger.log('   - ISSUED 처리: ' + result.details.issuedCount + '건');
      }
      Logger.log('========================================');
    }

    return result;

  } catch (error) {
    Logger.log('');
    Logger.log('❌ 마이그레이션 실패');
    Logger.log('   오류: ' + error.message);
    Logger.log('   Stack: ' + error.stack);
    Logger.log('========================================');

    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * 마이그레이션 롤백 (필요시)
 * 주의: 추가된 컬럼의 데이터가 모두 삭제됩니다!
 */
function rollbackInvoiceSchemaMigration() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName('청구DB');

  if (!sheet) {
    throw new Error('청구DB 시트를 찾을 수 없습니다.');
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  var 결제완료금액Col = headers.indexOf('결제완료금액');

  if (결제완료금액Col === -1) {
    Logger.log('⚠️  롤백할 컬럼이 없습니다. (이미 롤백됨)');
    return { success: false, message: '롤백할 컬럼 없음' };
  }

  // 마지막 3개 컬럼 삭제
  sheet.deleteColumns(결제완료금액Col + 1, 3);

  Logger.log('✅ 롤백 완료: 결제완료금액, 미수금, 최종결제일 컬럼 삭제됨');

  return {
    success: true,
    message: '롤백 완료'
  };
}
