/**
 * ✅ 3개 주요 시트의 구조 확인
 * 이 함수를 실행하면 모든 시트의 헤더와 컬럼 위치를 로그로 출력합니다.
 */
function debugAllSheetStructures() {
  Logger.log('========================================');
  Logger.log('=== OneBridge ERP 시트 구조 분석 ===');
  Logger.log('========================================\n');
  
  // 1. 품목DB (마스터DB)
  Logger.log('📊 1. 품목DB (마스터DB)');
  Logger.log('   시트 ID: ' + OB_MASTER_DB_SS_ID);
  Logger.log('   시트명: ' + OB_MASTER_PRODUCT_SHEET);
  Logger.log('   ─────────────────────────────────');
  
  var ss1 = SpreadsheetApp.openById(OB_MASTER_DB_SS_ID);
  var sheet1 = ss1.getSheetByName(OB_MASTER_PRODUCT_SHEET);
  
  if (sheet1) {
    var header1 = sheet1.getRange(1, 1, 1, sheet1.getLastColumn()).getValues()[0];
    Logger.log('   총 컬럼 수: ' + header1.length);
    Logger.log('   헤더:');
    for (var i = 0; i < header1.length; i++) {
      var colLetter = getColumnLetter(i);
      Logger.log('      ' + colLetter + '열 (인덱스 ' + i + '): ' + header1[i]);
    }
  } else {
    Logger.log('   ❌ 시트를 찾을 수 없습니다!');
  }
  
  // 2. 거래처DB (마스터DB)
  Logger.log('\n📊 2. 거래처DB (마스터DB)');
  Logger.log('   시트 ID: ' + OB_MASTER_DB_SS_ID);
  Logger.log('   시트명: 거래처DB');
  Logger.log('   ─────────────────────────────────');
  
  var sheet2 = ss1.getSheetByName('거래처DB');
  
  if (sheet2) {
    var header2 = sheet2.getRange(1, 1, 1, sheet2.getLastColumn()).getValues()[0];
    Logger.log('   총 컬럼 수: ' + header2.length);
    Logger.log('   헤더:');
    for (var i = 0; i < header2.length; i++) {
      var colLetter = getColumnLetter(i);
      Logger.log('      ' + colLetter + '열 (인덱스 ' + i + '): ' + header2[i]);
    }
  } else {
    Logger.log('   ❌ 시트를 찾을 수 없습니다!');
  }
  
  // 3. 거래원장 (발주_통합DB)
  Logger.log('\n📊 3. 거래원장 (발주_통합DB)');
  Logger.log('   시트 ID: ' + OB_ORDER_ALL_SS_ID);
  Logger.log('   시트명: ' + OB_ORDER_MAIN_SHEET);
  Logger.log('   ─────────────────────────────────');
  
  var ss3 = SpreadsheetApp.openById(OB_ORDER_ALL_SS_ID);
  var sheet3 = ss3.getSheetByName(OB_ORDER_MAIN_SHEET);
  
  if (sheet3) {
    var header3 = sheet3.getRange(1, 1, 1, sheet3.getLastColumn()).getValues()[0];
    Logger.log('   총 컬럼 수: ' + header3.length);
    Logger.log('   헤더:');
    for (var i = 0; i < header3.length; i++) {
      var colLetter = getColumnLetter(i);
      Logger.log('      ' + colLetter + '열 (인덱스 ' + i + '): ' + header3[i]);
    }
  } else {
    Logger.log('   ❌ 시트를 찾을 수 없습니다!');
  }
  
  Logger.log('\n========================================');
  Logger.log('=== 분석 완료 ===');
  Logger.log('========================================');
}

/**
 * 컬럼 인덱스를 엑셀 문자로 변환
 */
function getColumnLetter(colIndex) {
  var letter = '';
  var temp = colIndex + 1;
  
  while (temp > 0) {
    var remainder = (temp - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  
  return letter;
}