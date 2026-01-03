/**
 * 마이그레이션 스크립트 접근 테스트
 *
 * 목적: 스프레드시트 ID로 접근이 가능한지 확인
 */

function testMigrationAccess() {
  Logger.log('=== 마이그레이션 접근 테스트 시작 ===');

  var ssId = '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs';

  Logger.log('1. 스프레드시트 ID: ' + ssId);

  try {
    var ss = SpreadsheetApp.openById(ssId);
    Logger.log('2. ✅ 스프레드시트 접근 성공');
    Logger.log('3. 스프레드시트 이름: ' + ss.getName());

    var invoiceSheet = ss.getSheetByName('청구DB');

    if (!invoiceSheet) {
      Logger.log('4. ❌ 청구DB 시트를 찾을 수 없습니다.');
      Logger.log('5. 사용 가능한 시트 목록:');
      var sheets = ss.getSheets();
      for (var i = 0; i < sheets.length; i++) {
        Logger.log('   - ' + sheets[i].getName());
      }
    } else {
      Logger.log('4. ✅ 청구DB 시트 접근 성공');
      Logger.log('5. 행 수: ' + invoiceSheet.getLastRow());
      Logger.log('6. 열 수: ' + invoiceSheet.getLastColumn());

      var headers = invoiceSheet.getRange(1, 1, 1, invoiceSheet.getLastColumn()).getValues()[0];
      Logger.log('7. 헤더 목록 (' + headers.length + '개):');
      for (var j = 0; j < headers.length; j++) {
        Logger.log('   [' + (j + 1) + '] ' + headers[j]);
      }
    }

    Logger.log('=== ✅ 테스트 완료 ===');

  } catch (error) {
    Logger.log('❌ 오류 발생: ' + error.message);
    Logger.log('스택: ' + error.stack);
  }
}
