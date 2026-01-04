/**
 * AlertService.js
 * ============================================================
 * 결제 예정 알림 서비스
 * SPEC_04: 결제 예정일 D-7, D-3, D-day 알림
 * ============================================================
 * 기능:
 * 1. 결제 예정 청구서 조회
 * 2. 알림 이메일 발송
 * 3. 매일 알림 체크 (트리거 함수)
 * ============================================================
 */

// ====== 상수 정의 ======
var SS_ID = '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs'; // 발주_통합DB

/**
 * 결제 예정 청구서 조회
 * @param {number} daysOffset - 0: D-day, 3: D-3, 7: D-7
 * @param {string} invoiceType - "매입" 또는 "매출"
 * @returns {Array} - 해당 청구서 배열
 */
function getUpcomingInvoices(daysOffset, invoiceType) {
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var sheet = ss.getSheetByName('청구DB');

    if (!sheet) {
      Logger.log('[getUpcomingInvoices] ❌ 청구DB 시트를 찾을 수 없습니다.');
      return [];
    }

    var allData = sheet.getDataRange().getValues();
    var headers = allData[0];

    var 청구IDCol = headers.indexOf('청구ID');
    var 청구유형Col = headers.indexOf('청구유형');
    var 거래처명Col = headers.indexOf('거래처명');
    var 청구금액Col = headers.indexOf('청구금액');
    var 청구상태Col = headers.indexOf('청구상태');
    var 결제예정일Col = headers.indexOf('결제예정일');
    var 삭제여부Col = headers.indexOf('삭제여부');
    var 미수금Col = headers.indexOf('remainingBalance');

    // 컬럼 인덱스 확인
    if (결제예정일Col === -1) {
      Logger.log('[getUpcomingInvoices] ⚠️ "결제예정일" 컬럼이 없습니다. migrateInvoiceSheetForAlerts() 실행 필요');
      return [];
    }

    // 목표 날짜 계산
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysOffset);

    var upcomingInvoices = [];

    for (var i = 1; i < allData.length; i++) {
      var row = allData[i];

      // 삭제된 데이터 제외
      if (row[삭제여부Col] === true) continue;

      // 유형 필터
      if (row[청구유형Col] !== invoiceType) continue;

      // 상태 필터: ISSUED 또는 PAID_PARTIAL만 (완납된 건 제외)
      var 상태 = row[청구상태Col];
      if (상태 !== 'ISSUED' && 상태 !== 'PAID_PARTIAL') continue;

      // 결제예정일 확인
      var 결제예정일 = row[결제예정일Col];
      if (!(결제예정일 instanceof Date)) continue;

      // 날짜 비교 (년월일만)
      var 예정일Copy = new Date(결제예정일);
      예정일Copy.setHours(0, 0, 0, 0);

      if (예정일Copy.getTime() === targetDate.getTime()) {
        var 미수금 = 미수금Col !== -1 ? row[미수금Col] : row[청구금액Col];

        upcomingInvoices.push({
          청구ID: row[청구IDCol],
          청구유형: row[청구유형Col],
          거래처명: row[거래처명Col],
          청구금액: row[청구금액Col],
          미수금: 미수금 || row[청구금액Col],
          청구상태: 상태,
          결제예정일: Utilities.formatDate(결제예정일, Session.getScriptTimeZone(), 'yyyy-MM-dd')
        });
      }
    }

    Logger.log('[getUpcomingInvoices] ' + invoiceType + ' D-' + daysOffset + ': ' + upcomingInvoices.length + '건');

    return upcomingInvoices;

  } catch (error) {
    Logger.log('[getUpcomingInvoices] ❌ 오류: ' + error.message);
    return [];
  }
}

/**
 * 결제 예정 알림 이메일 발송
 * @param {string} recipientEmail - 수신자 이메일
 * @param {Array} invoices - 청구서 배열
 * @param {number} daysOffset - D-day 오프셋
 * @param {string} invoiceType - "매입" 또는 "매출"
 */
function sendPaymentAlertEmail(recipientEmail, invoices, daysOffset, invoiceType) {
  if (!invoices || invoices.length === 0) {
    Logger.log('[sendPaymentAlertEmail] ⚠️ 발송할 청구서가 없습니다.');
    return;
  }

  var dDayLabel = '';
  if (daysOffset === 0) {
    dDayLabel = 'D-day (오늘)';
  } else {
    dDayLabel = 'D-' + daysOffset;
  }

  var typeLabel = invoiceType === '매입' ? '결제' : '입금';

  // 이메일 제목
  var subject = '[' + typeLabel + ' 알림] ' + dDayLabel + ' ' + typeLabel + ' 예정 청구서 ' + invoices.length + '건';

  // 이메일 본문
  var body = '';
  body += '안녕하세요,\n\n';

  if (daysOffset === 0) {
    body += '오늘 ' + typeLabel + ' 예정인 청구서가 ' + invoices.length + '건 있습니다:\n\n';
  } else {
    body += daysOffset + '일 후 ' + typeLabel + ' 예정인 청구서가 ' + invoices.length + '건 있습니다:\n\n';
  }

  var totalAmount = 0;

  for (var i = 0; i < invoices.length; i++) {
    var invoice = invoices[i];
    var amount = Number(invoice.미수금) || 0;
    totalAmount += amount;

    body += (i + 1) + '. 청구ID: ' + invoice.청구ID + '\n';
    body += '   거래처: ' + invoice.거래처명 + '\n';
    body += '   금액: ' + amount.toLocaleString() + '원\n';
    body += '   예정일: ' + invoice.결제예정일 + '\n\n';
  }

  body += '총 ' + typeLabel + ' 예정 금액: ' + totalAmount.toLocaleString() + '원\n\n';

  body += '[청구서 보기]\n';
  body += ScriptApp.getService().getUrl() + '\n\n';

  body += '감사합니다.\n';
  body += '원브릿지 ERP';

  // 이메일 발송
  try {
    MailApp.sendEmail({
      to: recipientEmail,
      subject: subject,
      body: body
    });

    Logger.log('[sendPaymentAlertEmail] ✅ 알림 이메일 발송 완료: ' + recipientEmail + ' (' + invoices.length + '건)');

  } catch (error) {
    Logger.log('[sendPaymentAlertEmail] ❌ 이메일 발송 오류: ' + error.message);
  }
}

/**
 * 매일 아침 9시 실행되는 알림 체크 함수
 * (시간 기반 트리거로 등록 필요)
 */
function dailyPaymentAlertCheck() {
  Logger.log('========================================');
  Logger.log('결제 예정 알림 체크 시작: ' + new Date());
  Logger.log('========================================');

  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var alertSheet = ss.getSheetByName('알림설정');

    if (!alertSheet) {
      Logger.log('[dailyPaymentAlertCheck] ⚠️ 알림설정 시트가 없습니다. setupAlertSettings() 실행 필요');
      return;
    }

    var alertData = alertSheet.getDataRange().getValues();
    var alertHeaders = alertData[0];

    var 활성여부Col = alertHeaders.indexOf('활성여부');
    var 대상유형Col = alertHeaders.indexOf('대상유형');
    var 트리거일Col = alertHeaders.indexOf('트리거일');
    var 수신자이메일Col = alertHeaders.indexOf('수신자이메일');

    // 각 알림 설정 순회
    for (var i = 1; i < alertData.length; i++) {
      var alert = alertData[i];

      // 비활성화된 알림 스킵
      if (alert[활성여부Col] !== true) continue;

      var 대상유형 = alert[대상유형Col]; // "매입" 또는 "매출"
      var 트리거일 = alert[트리거일Col]; // "D-7", "D-3", "D-day"
      var 수신자이메일 = alert[수신자이메일Col];

      // 트리거일을 숫자로 변환
      var daysOffset = 0;
      if (트리거일 === 'D-day') {
        daysOffset = 0;
      } else if (트리거일.indexOf('D-') === 0) {
        daysOffset = parseInt(트리거일.replace('D-', ''));
      } else {
        continue;
      }

      // 해당 조건의 청구서 조회
      var invoices = getUpcomingInvoices(daysOffset, 대상유형);

      if (invoices.length > 0) {
        Logger.log('[알림 발송] ' + 대상유형 + ' ' + 트리거일 + ': ' + invoices.length + '건');
        sendPaymentAlertEmail(수신자이메일, invoices, daysOffset, 대상유형);
      } else {
        Logger.log('[알림 없음] ' + 대상유형 + ' ' + 트리거일 + ': 0건');
      }
    }

    Logger.log('========================================');
    Logger.log('알림 체크 완료');
    Logger.log('========================================');

  } catch (error) {
    Logger.log('[dailyPaymentAlertCheck] ❌ 오류: ' + error.message);
  }
}

/**
 * 매일 아침 9시 알림 체크 트리거 설정
 */
function setupDailyAlertTrigger() {
  try {
    // 기존 트리거 삭제
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'dailyPaymentAlertCheck') {
        ScriptApp.deleteTrigger(triggers[i]);
        Logger.log('[setupDailyAlertTrigger] 기존 트리거 삭제: ' + triggers[i].getUniqueId());
      }
    }

    // 새 트리거 생성: 매일 오전 9-10시 사이
    ScriptApp.newTrigger('dailyPaymentAlertCheck')
      .timeBased()
      .everyDays(1)
      .atHour(9)
      .create();

    Logger.log('[setupDailyAlertTrigger] ✅ 매일 오전 9시 알림 트리거 설정 완료');

    return { success: true, message: '트리거 설정 완료' };

  } catch (error) {
    Logger.log('[setupDailyAlertTrigger] ❌ 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}
