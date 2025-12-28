/**
 * ============================================================
 * TestCreateBilling.js
 * createBilling() 함수 테스트 및 로그 확인
 * ============================================================
 */

/**
 * 테스트: 직접 청구서 생성
 */
function testCreateDirectBilling() {
  Logger.log('');
  Logger.log('========================================');
  Logger.log('createBilling() 테스트 시작');
  Logger.log('========================================');
  Logger.log('');

  var testParams = {
    orderNumbers: ['TEST-ORDER-001', 'TEST-ORDER-002'],
    type: 'SALES',
    company: '테스트업체',
    billingDate: new Date(),
    amount: 1000000,
    notes: '테스트 청구서'
  };

  Logger.log('📝 테스트 파라미터:');
  Logger.log('  orderNumbers: ' + JSON.stringify(testParams.orderNumbers));
  Logger.log('  type: ' + testParams.type);
  Logger.log('  company: ' + testParams.company);
  Logger.log('');

  var result = createBilling(testParams);

  Logger.log('');
  Logger.log('📊 결과:');
  Logger.log('  success: ' + result.success);
  Logger.log('  billingId: ' + result.billingId);
  Logger.log('  message: ' + result.message);
  if (result.error) {
    Logger.log('  error: ' + result.error);
  }

  if (result.success) {
    Logger.log('');
    Logger.log('✅ 청구서 생성 성공!');
    Logger.log('');
    Logger.log('🔍 생성된 청구서 확인:');

    // 생성된 청구서 데이터 확인
    var ss = SpreadsheetApp.openById('1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs');
    var sheet = ss.getSheetByName('청구DB');

    if (sheet) {
      var data = sheet.getDataRange().getValues();
      var headers = data[0];

      // 방금 생성된 청구서 찾기
      for (var i = data.length - 1; i >= 1; i--) {
        if (data[i][0] === result.billingId) {
          Logger.log('');
          Logger.log('--- 생성된 청구서 (행 ' + (i + 1) + ') ---');

          // 중요 컬럼만 출력
          var importantCols = ['청구ID', '청구유형', '업체명', '발주번호', '청구타입', 'billingType', 'orderNumbers'];

          for (var j = 0; j < headers.length; j++) {
            if (importantCols.indexOf(headers[j]) !== -1) {
              var value = data[i][j];
              if (value === '' || value === null || value === undefined) {
                value = '(공란)';
              }
              Logger.log('  ' + headers[j] + ' (' + columnToLetter(j + 1) + '열): ' + value);
            }
          }

          Logger.log('');
          Logger.log('🎯 핵심 확인:');
          var orderNumbersCol = headers.indexOf('orderNumbers');
          var billingTypeCol = headers.indexOf('billingType');
          var legacyCol = headers.indexOf('발주번호');

          if (orderNumbersCol !== -1) {
            var orderNumbersValue = data[i][orderNumbersCol];
            Logger.log('  orderNumbers (S열): ' + (orderNumbersValue || '(공란)'));

            if (orderNumbersValue && orderNumbersValue !== '' && orderNumbersValue !== '[]') {
              try {
                var parsed = JSON.parse(orderNumbersValue);
                Logger.log('  파싱 결과: ' + JSON.stringify(parsed));
                Logger.log('  배열 길이: ' + parsed.length);
                Logger.log('  ✅ orderNumbers 정상 채워짐!');
              } catch (e) {
                Logger.log('  ❌ JSON 파싱 오류: ' + e.message);
              }
            } else {
              Logger.log('  ❌ orderNumbers가 비어있습니다!');
            }
          } else {
            Logger.log('  ❌ orderNumbers 컬럼을 찾을 수 없습니다!');
          }

          if (billingTypeCol !== -1) {
            var billingTypeValue = data[i][billingTypeCol];
            Logger.log('  billingType (R열): ' + (billingTypeValue || '(공란)'));
          }

          if (legacyCol !== -1) {
            var legacyValue = data[i][legacyCol];
            Logger.log('  발주번호 (I열): ' + (legacyValue || '(공란)'));
          }

          break;
        }
      }
    }
  } else {
    Logger.log('');
    Logger.log('❌ 청구서 생성 실패!');
  }

  Logger.log('');
  Logger.log('========================================');
  Logger.log('테스트 완료');
  Logger.log('========================================');
}

/**
 * 컬럼 번호를 문자로 변환
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
