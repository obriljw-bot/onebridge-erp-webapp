/**
 * ============================================================
 * EmergencyCheckHeaders.js
 * 청구DB 헤더와 데이터 긴급 점검
 * ============================================================
 */

function emergencyCheckHeaders() {
  Logger.log('');
  Logger.log('========================================');
  Logger.log('긴급: 청구DB 헤더 및 데이터 구조 점검');
  Logger.log('========================================');
  Logger.log('');

  var ss = SpreadsheetApp.openById('1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs');
  var sheet = ss.getSheetByName('청구DB');

  if (!sheet) {
    Logger.log('❌ 청구DB 시트를 찾을 수 없습니다.');
    return;
  }

  // 전체 헤더 출력 (A열부터!)
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  Logger.log('📊 총 컬럼 수: ' + lastCol);
  Logger.log('');
  Logger.log('=== 전체 헤더 (A열부터) ===');

  for (var i = 0; i < headers.length; i++) {
    Logger.log(columnToLetter(i + 1) + '열 (' + (i + 1) + '): "' + headers[i] + '"');
  }

  Logger.log('');
  Logger.log('=== 행 8 전체 데이터 (문제 행) ===');

  var lastRow = sheet.getLastRow();
  if (lastRow >= 8) {
    var row8 = sheet.getRange(8, 1, 1, lastCol).getValues()[0];

    for (var i = 0; i < row8.length; i++) {
      var value = row8[i];
      if (value === '' || value === null || value === undefined) {
        value = '(공란)';
      } else if (typeof value === 'string' && value.length > 100) {
        value = value.substring(0, 100) + '... (길이: ' + value.length + ')';
      }
      Logger.log(columnToLetter(i + 1) + '열 (' + headers[i] + '): ' + value);
    }
  } else {
    Logger.log('행 8이 존재하지 않습니다.');
  }

  Logger.log('');
  Logger.log('=== git 이력 확인 권장 ===');
  Logger.log('INV-20251228-001이 언제 어떻게 생성되었는지 확인 필요');
  Logger.log('createBilling() 수정 전/후 비교 필요');

  Logger.log('');
  Logger.log('========================================');
}

function columnToLetter(column) {
  var temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}
