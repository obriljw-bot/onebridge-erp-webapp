/**
 * PaymentService.js
 * 결제 추적 및 입금 매칭 서비스
 *
 * 주요 기능:
 * - 은행 CSV 파싱
 * - 자동 입금 매칭 (금액/날짜 기준)
 * - 청구서 상태 업데이트 (PAID_PARTIAL / PAID)
 * - 미수금 알림
 */

/**
 * 은행 CSV 업로드 및 자동 매칭
 * @param {Object} params - { csvData, matchCriteria }
 * @returns {Object} 매칭 결과
 */
function uploadBankCSV(params) {
  try {
    var csvData = params.csvData || '';
    var matchCriteria = params.matchCriteria || { amountTolerance: 0, dateTolerance: 3 };

    if (!csvData) {
      return {
        success: false,
        error: 'CSV 데이터가 없습니다.'
      };
    }

    Logger.log('[uploadBankCSV] CSV 파싱 시작');

    // CSV 파싱 (간단한 구현 - 실제로는 더 견고한 파서 필요)
    var lines = csvData.split('\n');
    var deposits = [];

    // 첫 줄은 헤더로 간주하고 스킵
    for (var i = 1; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;

      var fields = parseCSVLine(line);

      // CSV 형식: 날짜, 적요, 입금액, 출금액, 잔액
      // 예: 2025-12-10, 홍길동, 1000000, 0, 5000000
      if (fields.length >= 3) {
        var date = fields[0] ? fields[0].trim() : '';
        var description = fields[1] ? fields[1].trim() : '';
        var depositAmount = parseFloat(fields[2]) || 0;

        if (depositAmount > 0) {
          deposits.push({
            date: date,
            description: description,
            amount: depositAmount,
            matched: false,
            matchedBillingId: null
          });
        }
      }
    }

    Logger.log('[uploadBankCSV] 파싱 완료: ' + deposits.length + '건의 입금');

    // 미수금 청구서 조회
    var unpaidBillings = getUnpaidBillings_();

    Logger.log('[uploadBankCSV] 미수금 청구서: ' + unpaidBillings.length + '건');

    // 자동 매칭
    var matches = autoMatchDeposits_(deposits, unpaidBillings, matchCriteria);

    // 매칭된 청구서 상태 업데이트
    var updatedCount = 0;
    for (var j = 0; j < matches.length; j++) {
      var match = matches[j];
      if (match.matched) {
        var updateResult = updateBillingPayment_({
          billingId: match.billingId,
          paidAmount: match.depositAmount,
          paidDate: match.depositDate
        });

        if (updateResult) {
          updatedCount++;
        }
      }
    }

    Logger.log('[uploadBankCSV] 완료: ' + updatedCount + '건 매칭 및 업데이트');

    return {
      success: true,
      totalDeposits: deposits.length,
      matchedCount: matches.length,
      updatedCount: updatedCount,
      matches: matches,
      unmatchedDeposits: deposits.filter(function(d) { return !d.matched; })
    };

  } catch (err) {
    Logger.log('[uploadBankCSV Error] ' + err.message);
    return {
      success: false,
      error: 'CSV 업로드 중 오류 발생: ' + err.message
    };
  }
}

/**
 * CSV 라인 파싱 (쉼표로 구분, 따옴표 지원)
 * @param {string} line - CSV 라인
 * @returns {Array} 파싱된 필드 배열
 */
function parseCSVLine(line) {
  var fields = [];
  var currentField = '';
  var inQuotes = false;

  for (var i = 0; i < line.length; i++) {
    var char = line.charAt(i);

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }

  fields.push(currentField);
  return fields;
}

/**
 * 미수금 청구서 조회 (ISSUED 상태)
 * @returns {Array} 미수금 청구서 목록
 */
function getUnpaidBillings_() {
  try {
    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_BILLING_SHEET);

    if (!sheet) {
      return [];
    }

    var data = sheet.getDataRange().getValues();
    var billings = [];

    for (var i = 1; i < data.length; i++) {
      var status = data[i][5];

      // ISSUED 또는 PAID_PARTIAL 상태만 조회
      if (status === 'ISSUED' || status === 'PAID_PARTIAL') {
        var totalAmount = Number(data[i][6]) || 0;
        var paidAmount = Number(data[i][7]) || 0;
        var remainingAmount = Number(data[i][8]) || totalAmount;

        billings.push({
          billingId: data[i][0],
          type: data[i][1],
          settlementId: data[i][2],
          company: data[i][3],
          billingDate: formatDateString(data[i][4]),
          status: status,
          amount: totalAmount,
          paidAmount: paidAmount,
          remainingAmount: remainingAmount,
          rowIndex: i + 1
        });
      }
    }

    return billings;

  } catch (err) {
    Logger.log('[getUnpaidBillings_ Error] ' + err.message);
    return [];
  }
}

/**
 * 입금 자동 매칭
 * @param {Array} deposits - 입금 목록
 * @param {Array} billings - 청구서 목록
 * @param {Object} criteria - 매칭 기준 { amountTolerance, dateTolerance }
 * @returns {Array} 매칭 결과
 */
function autoMatchDeposits_(deposits, billings, criteria) {
  var matches = [];
  var amountTolerance = criteria.amountTolerance || 0;
  var dateTolerance = criteria.dateTolerance || 3; // 기본 3일

  for (var i = 0; i < deposits.length; i++) {
    var deposit = deposits[i];
    var depositDate = parseDate_(deposit.date);

    if (!depositDate) continue;

    // 금액 및 날짜 기준으로 매칭
    for (var j = 0; j < billings.length; j++) {
      var billing = billings[j];
      var billingDate = parseDate_(billing.billingDate);

      if (!billingDate) continue;

      // 금액 매칭 (허용 오차 범위 내)
      var amountDiff = Math.abs(deposit.amount - billing.remainingAmount);
      var amountMatch = amountDiff <= amountTolerance;

      // 날짜 매칭 (허용 일수 범위 내)
      var dateDiff = Math.abs((depositDate - billingDate) / (1000 * 60 * 60 * 24));
      var dateMatch = dateDiff <= dateTolerance;

      if (amountMatch && dateMatch) {
        matches.push({
          matched: true,
          depositDate: deposit.date,
          depositAmount: deposit.amount,
          depositDescription: deposit.description,
          billingId: billing.billingId,
          billingDate: billing.billingDate,
          billingAmount: billing.amount,
          remainingAmount: billing.remainingAmount,
          company: billing.company,
          matchScore: 100 - (amountDiff / billing.remainingAmount * 50) - (dateDiff / dateTolerance * 50)
        });

        deposit.matched = true;
        deposit.matchedBillingId = billing.billingId;

        // 이미 매칭된 청구서는 제외
        billings.splice(j, 1);
        break;
      }
    }
  }

  // 매칭 점수 기준 내림차순 정렬
  matches.sort(function(a, b) {
    return b.matchScore - a.matchScore;
  });

  return matches;
}

/**
 * 날짜 문자열을 Date 객체로 변환
 * @param {string} dateStr - 날짜 문자열 (YYYY-MM-DD)
 * @returns {Date|null} Date 객체 또는 null
 */
function parseDate_(dateStr) {
  if (!dateStr) return null;

  try {
    // YYYY-MM-DD 형식 파싱
    var parts = dateStr.split('-');
    if (parts.length === 3) {
      var year = parseInt(parts[0]);
      var month = parseInt(parts[1]) - 1;
      var day = parseInt(parts[2]);
      return new Date(year, month, day);
    }

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * 청구서 결제 정보 업데이트
 * @param {Object} params - { billingId, paidAmount, paidDate }
 * @returns {boolean} 성공 여부
 */
function updateBillingPayment_(params) {
  try {
    var billingId = params.billingId;
    var paidAmount = params.paidAmount || 0;
    var paidDate = params.paidDate || '';

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_BILLING_SHEET);

    if (!sheet) {
      return false;
    }

    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === billingId) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      return false;
    }

    var totalAmount = Number(data[rowIndex - 1][6]) || 0;
    var currentPaidAmount = Number(data[rowIndex - 1][7]) || 0;
    var newPaidAmount = currentPaidAmount + paidAmount;
    var remainingAmount = totalAmount - newPaidAmount;

    // 상태 결정
    var newStatus = '';
    if (remainingAmount <= 0) {
      newStatus = 'PAID';
      remainingAmount = 0;
      newPaidAmount = totalAmount;
    } else {
      newStatus = 'PAID_PARTIAL';
    }

    var now = new Date();

    // 업데이트: 상태(6열), 입금액(8열), 잔액(9열), 결제일시(13열)
    sheet.getRange(rowIndex, 6).setValue(newStatus);
    sheet.getRange(rowIndex, 8).setValue(newPaidAmount);
    sheet.getRange(rowIndex, 9).setValue(remainingAmount);
    sheet.getRange(rowIndex, 13).setValue(now);

    Logger.log('[updateBillingPayment_] 청구서 결제 업데이트: ' + billingId + ' -> ' + newStatus);

    return true;

  } catch (err) {
    Logger.log('[updateBillingPayment_ Error] ' + err.message);
    return false;
  }
}

/**
 * 미수금 알림 조회
 * @param {Object} params - { days } - 기준일 이후 경과 일수
 * @returns {Object} 알림 대상 목록
 */
function getOutstandingBalanceAlerts(params) {
  try {
    var days = params.days || 7; // 기본 7일
    var today = new Date();
    var cutoffDate = new Date(today.getTime() - (days * 24 * 60 * 60 * 1000));

    var unpaidBillings = getUnpaidBillings_();
    var alerts = [];

    for (var i = 0; i < unpaidBillings.length; i++) {
      var billing = unpaidBillings[i];
      var billingDate = parseDate_(billing.billingDate);

      if (billingDate && billingDate < cutoffDate) {
        var overdueDays = Math.floor((today - billingDate) / (1000 * 60 * 60 * 24));

        alerts.push({
          billingId: billing.billingId,
          company: billing.company,
          billingDate: billing.billingDate,
          amount: billing.amount,
          remainingAmount: billing.remainingAmount,
          overdueDays: overdueDays,
          severity: overdueDays > 30 ? 'HIGH' : overdueDays > 14 ? 'MEDIUM' : 'LOW'
        });
      }
    }

    // 경과 일수 내림차순 정렬
    alerts.sort(function(a, b) {
      return b.overdueDays - a.overdueDays;
    });

    return {
      success: true,
      alertCount: alerts.length,
      alerts: alerts
    };

  } catch (err) {
    Logger.log('[getOutstandingBalanceAlerts Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * 수동 입금 기록
 * @param {Object} params - { billingId, paidAmount, paidDate, notes }
 * @returns {Object} 결과
 */
function recordManualPayment(params) {
  try {
    var billingId = params.billingId || '';
    var paidAmount = params.paidAmount || 0;
    var paidDate = params.paidDate || new Date().toISOString().split('T')[0];
    var notes = params.notes || '';

    if (!billingId) {
      return {
        success: false,
        error: '청구서 ID를 입력해주세요.'
      };
    }

    if (paidAmount <= 0) {
      return {
        success: false,
        error: '입금액을 입력해주세요.'
      };
    }

    Logger.log('[recordManualPayment] 수동 입금 기록: ' + billingId);

    var result = updateBillingPayment_({
      billingId: billingId,
      paidAmount: paidAmount,
      paidDate: paidDate
    });

    if (!result) {
      return {
        success: false,
        error: '입금 기록 실패'
      };
    }

    return {
      success: true,
      message: '입금이 기록되었습니다.'
    };

  } catch (err) {
    Logger.log('[recordManualPayment Error] ' + err.message);
    return {
      success: false,
      error: '입금 기록 중 오류 발생: ' + err.message
    };
  }
}

/**
 * 날짜 포맷 헬퍼 함수
 */
function formatDateString(date) {
  if (!date) return '';
  if (typeof date === 'string') return date;

  try {
    var d = new Date(date);
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  } catch (err) {
    return '';
  }
}
