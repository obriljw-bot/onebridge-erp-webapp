/**
 * MigratePaymentSchemaForRefund.js
 * 결제내역 스키마 확장 (환불 지원)
 *
 * SPEC_02: 결제 취소/환불 기능
 * - 원결제ID 컬럼 추가 (O열, 15번째) - 환불 시 원래 결제 ID
 * - 환불여부 컬럼 추가 (P열, 16번째) - 환불 거래 여부
 */

/**
 * 결제내역 스키마 확장 마이그레이션
 */
function migratePaymentSchemaForRefund() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName('결제내역');

  if (!sheet) {
    throw new Error('결제내역 시트를 찾을 수 없습니다.');
  }

  // 현재 헤더 확인
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log('[Migration] 현재 컬럼 수: ' + headers.length);
  Logger.log('[Migration] 현재 헤더: ' + headers.join(', '));

  // 이미 추가되었는지 확인
  if (headers.indexOf('원결제ID') !== -1) {
    Logger.log('[Migration] ⚠️  이미 마이그레이션 완료됨');
    return {
      success: true,
      message: '이미 마이그레이션 완료됨',
      skipped: true
    };
  }

  // 1. 헤더 추가 (15, 16번째 컬럼)
  var startCol = headers.length + 1;
  var newHeaders = ['원결제ID', '환불여부'];

  Logger.log('[Migration] 새 컬럼 추가 위치: ' + startCol + '번째부터');
  Logger.log('[Migration] 추가할 컬럼: ' + newHeaders.join(', '));

  sheet.getRange(1, startCol, 1, 2).setValues([newHeaders]);

  // 헤더 스타일 적용
  sheet.getRange(1, startCol, 1, 2)
    .setFontWeight('bold')
    .setBackground('#fef3c7')
    .setHorizontalAlignment('center')
    .setBorder(true, true, true, true, true, true);

  // 컬럼 너비 설정
  sheet.setColumnWidth(startCol, 150);     // 원결제ID
  sheet.setColumnWidth(startCol + 1, 80);  // 환불여부

  Logger.log('[Migration] ✅ 헤더 추가 완료');

  // 2. 기존 데이터 초기화 (모두 빈값/false)
  var lastRow = sheet.getLastRow();
  var initializedCount = 0;

  if (lastRow > 1) {
    Logger.log('[Migration] 기존 데이터 초기화 시작...');

    // 원결제ID 빈값
    sheet.getRange(2, startCol, lastRow - 1, 1).setValue('');
    // 환불여부 false
    sheet.getRange(2, startCol + 1, lastRow - 1, 1).setValue(false);

    initializedCount = lastRow - 1;
    Logger.log('[Migration] ✅ 기존 데이터 초기화 완료: ' + initializedCount + '건');
  }

  // 3. 완료 메시지
  Logger.log('========================================');
  Logger.log('✅ 결제내역 스키마 확장 완료');
  Logger.log('   추가된 컬럼: ' + newHeaders.join(', '));
  Logger.log('   초기화된 행: ' + initializedCount + '건');
  Logger.log('========================================');

  return {
    success: true,
    message: '결제내역 스키마 확장 완료',
    addedColumns: newHeaders,
    initializedRows: initializedCount
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
      Logger.log('   초기화된 행: ' + result.initializedRows);
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
 */
function rollbackPaymentSchemaMigration() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName('결제내역');

  if (!sheet) {
    throw new Error('결제내역 시트를 찾을 수 없습니다.');
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  var 원결제IDCol = headers.indexOf('원결제ID');

  if (원결제IDCol === -1) {
    Logger.log('⚠️  롤백할 컬럼이 없습니다. (이미 롤백됨)');
    return { success: false, message: '롤백할 컬럼 없음' };
  }

  // 마지막 2개 컬럼 삭제
  sheet.deleteColumns(원결제IDCol + 1, 2);

  Logger.log('✅ 롤백 완료: 원결제ID, 환불여부 컬럼 삭제됨');

  return {
    success: true,
    message: '롤백 완료'
  };
}
