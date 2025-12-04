/**
 * OneBridge ERP v2.2 마이그레이션 스크립트
 * 거래원장에 상태 관리 컬럼 3개 추가
 *
 * 실행 방법:
 * 1. Apps Script 에디터에서 이 파일 내용을 복사
 * 2. addStateColumnsToTransactionLedger() 함수를 실행
 * 3. 권한 승인 후 완료 확인
 *
 * ⚠️ 주의: 이 스크립트는 한 번만 실행해야 합니다!
 */

const ORDER_MERGED_SHEET_ID = '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs';
const TRANSACTION_SHEET_NAME = '거래원장';

/**
 * 거래원장에 상태 관리 컬럼 3개 추가
 * - 거래상태 (Transaction State)
 * - 매입마감ID (Purchase Settlement ID)
 * - 매출마감ID (Sales Settlement ID)
 */
function addStateColumnsToTransactionLedger() {
  Logger.log('=== 거래원장 상태 컬럼 추가 시작 ===');

  try {
    // 1. 시트 열기
    var ss = SpreadsheetApp.openById(ORDER_MERGED_SHEET_ID);
    var sheet = ss.getSheetByName(TRANSACTION_SHEET_NAME);

    if (!sheet) {
      throw new Error('거래원장 시트를 찾을 수 없습니다.');
    }

    // 2. 현재 헤더 읽기
    var lastCol = sheet.getLastColumn();
    var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    Logger.log('현재 컬럼 수: ' + lastCol);
    Logger.log('헤더: ' + header.join(', '));

    // 3. 새 컬럼이 이미 있는지 확인
    var stateColIdx = header.indexOf('거래상태');
    var purchaseSettlementIdIdx = header.indexOf('매입마감ID');
    var salesSettlementIdIdx = header.indexOf('매출마감ID');

    if (stateColIdx >= 0) {
      Logger.log('⚠️ "거래상태" 컬럼이 이미 존재합니다. (컬럼 ' + (stateColIdx + 1) + ')');
      return {
        success: false,
        message: '컬럼이 이미 존재합니다. 중복 실행 방지됨.'
      };
    }

    // 4. 새 컬럼 3개 추가 (수정일시 컬럼 뒤에)
    var updatedAtIdx = header.indexOf('수정일시');
    var insertPosition = updatedAtIdx >= 0 ? updatedAtIdx + 2 : lastCol + 1; // 1-based index

    Logger.log('삽입 위치: 컬럼 ' + insertPosition);

    // 5. 3개 컬럼 삽입
    sheet.insertColumnsAfter(insertPosition - 1, 3);

    // 6. 헤더 설정
    sheet.getRange(1, insertPosition).setValue('거래상태');
    sheet.getRange(1, insertPosition + 1).setValue('매입마감ID');
    sheet.getRange(1, insertPosition + 2).setValue('매출마감ID');

    Logger.log('✅ 컬럼 3개 추가 완료');

    // 7. 기존 데이터에 기본값 설정 (CONFIRMED_OPEN)
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var dataRange = sheet.getRange(2, insertPosition, lastRow - 1, 1);
      var values = [];
      for (var i = 0; i < lastRow - 1; i++) {
        values.push(['CONFIRMED_OPEN']);
      }
      dataRange.setValues(values);

      Logger.log('✅ 기존 데이터 ' + (lastRow - 1) + '행에 기본 상태값 설정 완료 (CONFIRMED_OPEN)');
    }

    // 8. 헤더 스타일 적용 (굵게, 배경색)
    var headerRange = sheet.getRange(1, insertPosition, 1, 3);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#E8F0FE');
    headerRange.setHorizontalAlignment('center');

    Logger.log('✅ 헤더 스타일 적용 완료');

    // 9. 최종 확인
    var newHeader = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    Logger.log('업데이트된 헤더: ' + newHeader.join(', '));

    Logger.log('=== 마이그레이션 완료 ===');

    return {
      success: true,
      message: '거래원장에 상태 컬럼 3개 추가 완료',
      insertPosition: insertPosition,
      rowsUpdated: lastRow - 1
    };

  } catch (e) {
    Logger.log('❌ 오류 발생: ' + e.message);
    Logger.log(e.stack);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * 테스트: 새 컬럼 확인
 */
function verifyStateColumns() {
  var ss = SpreadsheetApp.openById(ORDER_MERGED_SHEET_ID);
  var sheet = ss.getSheetByName(TRANSACTION_SHEET_NAME);

  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  var stateIdx = header.indexOf('거래상태');
  var purchaseIdx = header.indexOf('매입마감ID');
  var salesIdx = header.indexOf('매출마감ID');

  Logger.log('=== 컬럼 확인 ===');
  Logger.log('거래상태: 컬럼 ' + (stateIdx + 1) + ' (' + (stateIdx >= 0 ? '✅ 존재' : '❌ 없음') + ')');
  Logger.log('매입마감ID: 컬럼 ' + (purchaseIdx + 1) + ' (' + (purchaseIdx >= 0 ? '✅ 존재' : '❌ 없음') + ')');
  Logger.log('매출마감ID: 컬럼 ' + (salesIdx + 1) + ' (' + (salesIdx >= 0 ? '✅ 존재' : '❌ 없음') + ')');

  // 샘플 데이터 확인
  if (sheet.getLastRow() > 1) {
    var sampleRow = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
    Logger.log('\n샘플 데이터 (2행):');
    Logger.log('거래상태: ' + sampleRow[stateIdx]);
    Logger.log('매입마감ID: ' + sampleRow[purchaseIdx]);
    Logger.log('매출마감ID: ' + sampleRow[salesIdx]);
  }
}
