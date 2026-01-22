/**
 * DiagnosePaymentSystem.js
 * ============================================================
 * 결제 관리 시스템 현재 상태 진단 스크립트
 * ============================================================
 * 목적:
 * 1. 스프레드시트 실제 구조 확인
 * 2. 각 시트의 헤더와 샘플 데이터 확인
 * 3. 데이터 간 관계 확인
 * 4. 명세서 작성을 위한 정확한 정보 수집
 * ============================================================
 */

var SS_ID = '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs'; // 발주_통합DB

/**
 * 메인 진단 함수
 */
function diagnosePaymentSystem() {
  var report = [];
  report.push('='.repeat(80));
  report.push('결제 관리 시스템 진단 보고서');
  report.push('생성일시: ' + new Date().toISOString());
  report.push('='.repeat(80));
  report.push('');

  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    report.push('[스프레드시트 정보]');
    report.push('이름: ' + ss.getName());
    report.push('ID: ' + ss.getId());
    report.push('시트 개수: ' + ss.getSheets().length);
    report.push('');

    // 1. 결제내역 시트
    report.push('-'.repeat(80));
    report.push('1. 결제내역 시트');
    report.push('-'.repeat(80));
    var paymentInfo = diagnoseSheet(ss, '결제내역');
    report = report.concat(paymentInfo);

    // 2. 회사비용 시트
    report.push('');
    report.push('-'.repeat(80));
    report.push('2. 회사비용 시트');
    report.push('-'.repeat(80));
    var expenseInfo = diagnoseSheet(ss, '회사비용');
    report = report.concat(expenseInfo);

    // 3. 청구DB 시트
    report.push('');
    report.push('-'.repeat(80));
    report.push('3. 청구DB 시트');
    report.push('-'.repeat(80));
    var invoiceInfo = diagnoseSheet(ss, '청구DB');
    report = report.concat(invoiceInfo);

    // 4. 거래원장 시트
    report.push('');
    report.push('-'.repeat(80));
    report.push('4. 거래원장 시트');
    report.push('-'.repeat(80));
    var ledgerInfo = diagnoseSheet(ss, '거래원장');
    report = report.concat(ledgerInfo);

    // 5. 매입마감DB 시트
    report.push('');
    report.push('-'.repeat(80));
    report.push('5. 매입마감DB 시트');
    report.push('-'.repeat(80));
    var purchaseInfo = diagnoseSheet(ss, '매입마감DB');
    report = report.concat(purchaseInfo);

    // 6. 매출마감DB 시트
    report.push('');
    report.push('-'.repeat(80));
    report.push('6. 매출마감DB 시트');
    report.push('-'.repeat(80));
    var salesInfo = diagnoseSheet(ss, '매출마감DB');
    report = report.concat(salesInfo);

    // 7. 월마감DB 시트
    report.push('');
    report.push('-'.repeat(80));
    report.push('7. 월마감DB 시트');
    report.push('-'.repeat(80));
    var monthlyInfo = diagnoseSheet(ss, '월마감DB');
    report = report.concat(monthlyInfo);

    // 8. 데이터 관계 분석
    report.push('');
    report.push('='.repeat(80));
    report.push('데이터 관계 분석');
    report.push('='.repeat(80));
    var relationInfo = analyzeDataRelationships(ss);
    report = report.concat(relationInfo);

  } catch (error) {
    report.push('');
    report.push('❌ 오류 발생: ' + error.message);
    report.push('Stack: ' + error.stack);
  }

  report.push('');
  report.push('='.repeat(80));
  report.push('진단 완료');
  report.push('='.repeat(80));

  var fullReport = report.join('\n');
  Logger.log(fullReport);

  return fullReport;
}

/**
 * 개별 시트 진단
 */
function diagnoseSheet(ss, sheetName) {
  var info = [];

  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    info.push('❌ 시트를 찾을 수 없음: ' + sheetName);
    return info;
  }

  info.push('✅ 시트 존재: ' + sheetName);
  info.push('총 행 수: ' + sheet.getLastRow());
  info.push('총 열 수: ' + sheet.getLastColumn());

  // 헤더 확인
  if (sheet.getLastRow() >= 1) {
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    info.push('');
    info.push('[헤더 정보]');
    info.push('총 ' + headers.length + '개 컬럼:');
    for (var i = 0; i < headers.length; i++) {
      info.push('  ' + (i + 1) + '. ' + headers[i]);
    }
  }

  // 데이터 행 수
  var dataRows = sheet.getLastRow() - 1; // 헤더 제외
  info.push('');
  info.push('[데이터 정보]');
  info.push('데이터 행 수: ' + dataRows);

  // 샘플 데이터 (최대 3행)
  if (dataRows > 0) {
    var sampleCount = Math.min(3, dataRows);
    var sampleData = sheet.getRange(2, 1, sampleCount, sheet.getLastColumn()).getValues();

    info.push('');
    info.push('[샘플 데이터] (최대 3행)');
    for (var r = 0; r < sampleData.length; r++) {
      info.push('  행 ' + (r + 2) + ':');
      for (var c = 0; c < Math.min(5, sampleData[r].length); c++) { // 최대 5개 컬럼만
        var value = sampleData[r][c];
        var displayValue = value;

        // Date 객체인 경우 형식 변환
        if (value instanceof Date) {
          displayValue = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else if (typeof value === 'string' && value.length > 50) {
          displayValue = value.substring(0, 50) + '...';
        }

        info.push('    ' + headers[c] + ': ' + displayValue);
      }
      if (sampleData[r].length > 5) {
        info.push('    ... (나머지 ' + (sampleData[r].length - 5) + '개 컬럼 생략)');
      }
    }
  }

  return info;
}

/**
 * 데이터 관계 분석
 */
function analyzeDataRelationships(ss) {
  var info = [];

  try {
    // 1. 청구DB와 결제내역 관계
    info.push('');
    info.push('[1] 청구DB ↔ 결제내역 관계');
    info.push('-'.repeat(40));

    var invoiceSheet = ss.getSheetByName('청구DB');
    var paymentSheet = ss.getSheetByName('결제내역');

    if (invoiceSheet && paymentSheet) {
      var invoiceData = invoiceSheet.getDataRange().getValues();
      var paymentData = paymentSheet.getDataRange().getValues();

      if (invoiceData.length > 1 && paymentData.length > 1) {
        var invoiceHeaders = invoiceData[0];
        var paymentHeaders = paymentData[0];

        var invoiceIdCol = invoiceHeaders.indexOf('청구ID');
        var paymentDocCol = paymentHeaders.indexOf('문서번호');

        if (invoiceIdCol !== -1 && paymentDocCol !== -1) {
          // 청구서 ID 수집
          var invoiceIds = {};
          for (var i = 1; i < Math.min(10, invoiceData.length); i++) {
            var id = invoiceData[i][invoiceIdCol];
            if (id) invoiceIds[id] = true;
          }

          // 결제내역의 문서번호와 매칭 확인
          var matchCount = 0;
          for (var i = 1; i < Math.min(10, paymentData.length); i++) {
            var docNum = paymentData[i][paymentDocCol];
            if (docNum && invoiceIds[docNum]) {
              matchCount++;
            }
          }

          info.push('샘플 청구서 ID 개수: ' + Object.keys(invoiceIds).length);
          info.push('매칭된 결제내역: ' + matchCount + '건');
        }
      }
    }

    // 2. 청구DB와 거래원장 관계
    info.push('');
    info.push('[2] 청구DB ↔ 거래원장 관계');
    info.push('-'.repeat(40));

    var ledgerSheet = ss.getSheetByName('거래원장');
    if (invoiceSheet && ledgerSheet) {
      var ledgerData = ledgerSheet.getDataRange().getValues();

      if (invoiceData.length > 1 && ledgerData.length > 1) {
        var ledgerHeaders = ledgerData[0];
        var orderNumberCol = ledgerHeaders.indexOf('발주번호');
        var orderNumbersCol = invoiceHeaders.indexOf('orderNumbers');

        if (orderNumberCol !== -1 && orderNumbersCol !== -1) {
          info.push('청구DB.orderNumbers 컬럼 존재: ✅');
          info.push('거래원장.발주번호 컬럼 존재: ✅');

          // 샘플 데이터 확인
          if (invoiceData.length > 1) {
            var sampleOrderNumbers = invoiceData[1][orderNumbersCol];
            info.push('샘플 orderNumbers 값: ' + sampleOrderNumbers);

            try {
              if (sampleOrderNumbers) {
                var parsed = JSON.parse(sampleOrderNumbers);
                info.push('JSON 파싱 성공: ' + parsed.length + '개 발주번호');
              }
            } catch (e) {
              info.push('JSON 파싱 실패: ' + e.message);
            }
          }
        }
      }
    }

    // 3. 결제 상태 컬럼 확인
    info.push('');
    info.push('[3] 거래원장 결제 상태 컬럼');
    info.push('-'.repeat(40));

    if (ledgerSheet) {
      var ledgerHeaders = ledgerSheet.getRange(1, 1, 1, ledgerSheet.getLastColumn()).getValues()[0];
      var purchasePaymentCol = ledgerHeaders.indexOf('매입결제');
      var salesPaymentCol = ledgerHeaders.indexOf('매출결제');

      info.push('매입결제 컬럼: ' + (purchasePaymentCol !== -1 ? '✅ (열 ' + (purchasePaymentCol + 1) + ')' : '❌'));
      info.push('매출결제 컬럼: ' + (salesPaymentCol !== -1 ? '✅ (열 ' + (salesPaymentCol + 1) + ')' : '❌'));
    }

  } catch (error) {
    info.push('');
    info.push('❌ 관계 분석 오류: ' + error.message);
  }

  return info;
}

/**
 * 보고서를 Google 문서로 저장
 */
function saveReportToDoc() {
  var report = diagnosePaymentSystem();

  var doc = DocumentApp.create('결제관리시스템_진단보고서_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss'));
  var body = doc.getBody();
  body.setText(report);

  // 고정폭 폰트 적용
  var style = {};
  style[DocumentApp.Attribute.FONT_FAMILY] = 'Courier New';
  style[DocumentApp.Attribute.FONT_SIZE] = 9;
  body.setAttributes(style);

  Logger.log('보고서 저장 완료: ' + doc.getUrl());
  return doc.getUrl();
}
