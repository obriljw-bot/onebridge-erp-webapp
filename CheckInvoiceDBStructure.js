/**
 * ============================================================
 * CheckInvoiceDBStructure.js
 * 청구DB 시트 구조 및 데이터 상태 긴급 진단
 * ============================================================
 */

var PAYMENT_SS_ID = '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs';

/**
 * 청구DB 전체 구조 확인
 */
function checkInvoiceDBStructure() {
  Logger.log('');
  Logger.log('========================================');
  Logger.log('청구DB 시트 구조 긴급 진단');
  Logger.log('========================================');
  Logger.log('');

  var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
  var sheet = ss.getSheetByName('청구DB');

  if (!sheet) {
    Logger.log('❌ 청구DB 시트를 찾을 수 없습니다!');
    return;
  }

  Logger.log('✅ 청구DB 시트 존재');
  Logger.log('');

  // 1. 전체 헤더 출력
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  Logger.log('📊 총 컬럼 수: ' + lastCol);
  Logger.log('');
  Logger.log('=== 전체 헤더 목록 ===');

  for (var i = 0; i < headers.length; i++) {
    var colLetter = columnToLetter(i + 1);
    var marker = '';

    if (headers[i] === 'orderNumbers') marker = ' ⭐ CRITICAL';
    if (headers[i] === '발주번호') marker = ' 🔍 LEGACY';
    if (headers[i] === 'billingType') marker = ' ⭐ Phase 1';
    if (headers[i] === '청구ID') marker = ' 🔑 KEY';

    Logger.log(colLetter + '열 (col ' + (i + 1) + '): "' + headers[i] + '"' + marker);
  }

  Logger.log('');
  Logger.log('=== orderNumbers 컬럼 찾기 ===');

  var orderNumbersIndex = headers.indexOf('orderNumbers');
  if (orderNumbersIndex === -1) {
    Logger.log('❌ "orderNumbers" 컬럼을 찾을 수 없습니다!');
    Logger.log('💡 Phase 1 Setup이 실행되지 않았거나 컬럼 이름이 다를 수 있습니다.');
  } else {
    var colLetter = columnToLetter(orderNumbersIndex + 1);
    Logger.log('✅ "orderNumbers" 컬럼 발견: ' + colLetter + '열 (col ' + (orderNumbersIndex + 1) + ')');
  }

  Logger.log('');
  Logger.log('=== 발주번호 (레거시) 컬럼 찾기 ===');

  var legacyIndex = headers.indexOf('발주번호');
  if (legacyIndex === -1) {
    Logger.log('⚠️ "발주번호" 레거시 컬럼을 찾을 수 없습니다.');
  } else {
    var colLetter = columnToLetter(legacyIndex + 1);
    Logger.log('✅ "발주번호" 레거시 컬럼 발견: ' + colLetter + '열 (col ' + (legacyIndex + 1) + ')');
  }

  // 2. 데이터 행 수 확인
  var lastRow = sheet.getLastRow();
  Logger.log('');
  Logger.log('📊 데이터 행 수: ' + (lastRow - 1) + '개 (헤더 제외)');

  if (lastRow <= 1) {
    Logger.log('⚠️ 데이터가 없습니다.');
    return;
  }

  // 3. orderNumbers 컬럼 데이터 상태 확인
  if (orderNumbersIndex !== -1) {
    Logger.log('');
    Logger.log('=== orderNumbers 컬럼 데이터 상태 ===');

    var orderNumbersData = sheet.getRange(2, orderNumbersIndex + 1, lastRow - 1, 1).getValues();

    var emptyCount = 0;
    var filledCount = 0;
    var invalidCount = 0;
    var sampleFilled = null;
    var sampleEmpty = null;

    for (var i = 0; i < orderNumbersData.length; i++) {
      var value = String(orderNumbersData[i][0] || '').trim();

      if (!value || value === '' || value === '[]') {
        emptyCount++;
        if (!sampleEmpty) {
          sampleEmpty = {
            row: i + 2,
            value: value
          };
        }
      } else {
        try {
          var parsed = JSON.parse(value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            filledCount++;
            if (!sampleFilled) {
              sampleFilled = {
                row: i + 2,
                value: value,
                parsed: parsed
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

    Logger.log('비어있음: ' + emptyCount + '개 (' + ((emptyCount / (lastRow - 1)) * 100).toFixed(1) + '%)');
    Logger.log('채워짐: ' + filledCount + '개 (' + ((filledCount / (lastRow - 1)) * 100).toFixed(1) + '%)');
    Logger.log('잘못된 형식: ' + invalidCount + '개');

    if (sampleFilled) {
      Logger.log('');
      Logger.log('샘플 (데이터 있음):');
      Logger.log('  행 ' + sampleFilled.row + ': ' + sampleFilled.value);
      Logger.log('  파싱 결과: ' + JSON.stringify(sampleFilled.parsed));
    }

    if (sampleEmpty) {
      Logger.log('');
      Logger.log('샘플 (데이터 없음):');
      Logger.log('  행 ' + sampleEmpty.row + ': "' + sampleEmpty.value + '"');
    }

    if (emptyCount === (lastRow - 1)) {
      Logger.log('');
      Logger.log('🔴 심각: orderNumbers 컬럼의 모든 데이터가 비어있습니다!');
      Logger.log('');
      Logger.log('가능한 원인:');
      Logger.log('1. 마이그레이션 스크립트가 실행되지 않음');
      Logger.log('2. 마이그레이션 조건을 충족하는 행이 없음');
      Logger.log('3. createBilling()이 orderNumbers를 채우지 못함');
    }
  }

  // 4. 레거시 발주번호 컬럼 데이터 확인
  if (legacyIndex !== -1) {
    Logger.log('');
    Logger.log('=== 발주번호 (레거시) 컬럼 데이터 상태 ===');

    var legacyData = sheet.getRange(2, legacyIndex + 1, lastRow - 1, 1).getValues();

    var legacyEmpty = 0;
    var legacyFilled = 0;
    var legacySample = null;

    for (var i = 0; i < legacyData.length; i++) {
      var value = String(legacyData[i][0] || '').trim();

      if (!value || value === '') {
        legacyEmpty++;
      } else {
        legacyFilled++;
        if (!legacySample) {
          legacySample = {
            row: i + 2,
            value: value
          };
        }
      }
    }

    Logger.log('비어있음: ' + legacyEmpty + '개');
    Logger.log('채워짐: ' + legacyFilled + '개');

    if (legacySample) {
      Logger.log('');
      Logger.log('샘플:');
      Logger.log('  행 ' + legacySample.row + ': ' + legacySample.value);
    }

    if (legacyFilled > 0 && orderNumbersIndex !== -1 && emptyCount > 0) {
      Logger.log('');
      Logger.log('💡 발주번호 컬럼에는 데이터가 있지만 orderNumbers는 비어있습니다!');
      Logger.log('   → 마이그레이션 스크립트를 실행해야 합니다.');
    }
  }

  // 5. 첫 5개 행 전체 데이터 출력
  Logger.log('');
  Logger.log('=== 샘플 데이터 (첫 5개 행) ===');

  var sampleRows = Math.min(5, lastRow - 1);
  if (sampleRows > 0) {
    var sampleData = sheet.getRange(2, 1, sampleRows, lastCol).getValues();

    for (var i = 0; i < sampleRows; i++) {
      Logger.log('');
      Logger.log('--- 행 ' + (i + 2) + ' ---');
      for (var j = 0; j < headers.length; j++) {
        if (headers[j] === '청구ID' || headers[j] === '청구유형' || headers[j] === 'orderNumbers' || headers[j] === '발주번호' || headers[j] === 'billingType') {
          var displayValue = sampleData[i][j];
          if (displayValue === '' || displayValue === null || displayValue === undefined) {
            displayValue = '(공란)';
          }
          Logger.log('  ' + headers[j] + ': ' + displayValue);
        }
      }
    }
  }

  Logger.log('');
  Logger.log('========================================');
  Logger.log('진단 완료');
  Logger.log('========================================');
}

/**
 * 컬럼 번호를 문자로 변환 (1 -> A, 27 -> AA)
 */
function columnToLetter(column) {
  var temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}
