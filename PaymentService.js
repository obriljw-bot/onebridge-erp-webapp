/**
 * PaymentService.js
 * ============================================================
 * 결제관리 시스템 백엔드 로직
 * ============================================================
 * - 입출금 내역 관리 (CRUD)
 * - 회사비용 관리 (CRUD)
 * - 청구서 취소/재발급
 * - 문서번호 자동완성
 * - 소프트 삭제
 * ============================================================
 */

// ====== 상수 정의 ======
var PAYMENT_SS_ID = '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs'; // 발주_통합DB
var PAYMENT_SHEET_NAME = '결제내역';
var EXPENSE_SHEET_NAME = '회사비용';
var INVOICE_SHEET_NAME = '청구DB';

// ============================================================
// 1. 입출금 관리 (6개 함수)
// ============================================================

/**
 * 거래원장 결제 상태 업데이트
 *
 * @param {string} invoiceId - 청구서 ID
 * @param {string} paymentType - 결제유형 (입금/출금)
 * @param {string} status - 상태 값 (예: '결제완료', '미결제')
 * @returns {Object} { success, updatedCount, message, error }
 */
function updateLedgerPaymentStatus(invoiceId, paymentType, status) {
  try {
    Logger.log('[updateLedgerPaymentStatus] 시작 - invoiceId: ' + invoiceId + ', paymentType: ' + paymentType + ', status: ' + status);

    if (!invoiceId || invoiceId === '') {
      return {
        success: false,
        error: '청구서 ID가 필요합니다.'
      };
    }

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);

    // 1. 청구DB에서 orderNumbers 조회
    var invoiceSheet = ss.getSheetByName(INVOICE_SHEET_NAME);
    if (!invoiceSheet) {
      Logger.log('[updateLedgerPaymentStatus] 청구DB 시트를 찾을 수 없습니다.');
      return {
        success: false,
        error: '청구DB 시트를 찾을 수 없습니다.'
      };
    }

    var invoiceData = invoiceSheet.getDataRange().getValues();
    var invoiceHeaders = invoiceData[0];
    var invoiceIdCol = invoiceHeaders.indexOf('청구ID');
    var orderNumbersCol = invoiceHeaders.indexOf('orderNumbers');

    if (invoiceIdCol === -1 || orderNumbersCol === -1) {
      Logger.log('[updateLedgerPaymentStatus] 필요한 컬럼을 찾을 수 없습니다.');
      return {
        success: false,
        error: '청구DB에서 필요한 컬럼을 찾을 수 없습니다.'
      };
    }

    // 청구서 행 찾기
    var orderNumbers = [];
    for (var i = 1; i < invoiceData.length; i++) {
      if (invoiceData[i][invoiceIdCol] === invoiceId) {
        var orderNumbersJson = invoiceData[i][orderNumbersCol];

        // JSON 문자열 파싱
        if (orderNumbersJson && orderNumbersJson !== '') {
          try {
            orderNumbers = JSON.parse(orderNumbersJson);
          } catch (parseError) {
            Logger.log('[updateLedgerPaymentStatus] orderNumbers JSON 파싱 오류: ' + parseError.message);
          }
        }
        break;
      }
    }

    if (!orderNumbers || orderNumbers.length === 0) {
      Logger.log('[updateLedgerPaymentStatus] 청구서에 연결된 발주번호가 없습니다.');
      return {
        success: true,
        updatedCount: 0,
        message: '연결된 발주번호가 없어 거래원장을 업데이트하지 않았습니다.'
      };
    }

    Logger.log('[updateLedgerPaymentStatus] 발주번호 목록: ' + JSON.stringify(orderNumbers));

    // 2. 거래원장에서 해당 발주번호들의 결제 상태 업데이트
    var ledgerSheet = ss.getSheetByName('거래원장');
    if (!ledgerSheet) {
      Logger.log('[updateLedgerPaymentStatus] 거래원장 시트를 찾을 수 없습니다.');
      return {
        success: false,
        error: '거래원장 시트를 찾을 수 없습니다.'
      };
    }

    var ledgerData = ledgerSheet.getDataRange().getValues();
    var ledgerHeaders = ledgerData[0];
    var ledgerOrderNumCol = ledgerHeaders.indexOf('발주번호');
    var purchasePaymentCol = ledgerHeaders.indexOf('매입결제'); // 출금 시 업데이트
    var salesPaymentCol = ledgerHeaders.indexOf('매출결제');   // 입금 시 업데이트

    if (ledgerOrderNumCol === -1 || purchasePaymentCol === -1 || salesPaymentCol === -1) {
      Logger.log('[updateLedgerPaymentStatus] 거래원장에서 필요한 컬럼을 찾을 수 없습니다.');
      return {
        success: false,
        error: '거래원장에서 필요한 컬럼을 찾을 수 없습니다.'
      };
    }

    // 업데이트할 컬럼 결정
    var targetCol = (paymentType === '입금') ? salesPaymentCol : purchasePaymentCol;
    var targetColName = (paymentType === '입금') ? '매출결제' : '매입결제';

    var updatedCount = 0;
    var updatedRows = [];

    // 발주번호 목록에 있는 각 발주에 대해 거래원장 업데이트
    for (var j = 0; j < orderNumbers.length; j++) {
      var targetOrderNumber = orderNumbers[j];

      for (var k = 1; k < ledgerData.length; k++) {
        if (ledgerData[k][ledgerOrderNumCol] === targetOrderNumber) {
          // 상태 업데이트
          ledgerSheet.getRange(k + 1, targetCol + 1).setValue(status);
          updatedCount++;
          updatedRows.push(k + 1);
          Logger.log('[updateLedgerPaymentStatus] 업데이트: 행 ' + (k + 1) + ', 발주번호: ' + targetOrderNumber + ', ' + targetColName + ' = ' + status);
        }
      }
    }

    Logger.log('[updateLedgerPaymentStatus] ✅ 완료 - ' + updatedCount + '개 행 업데이트');

    return {
      success: true,
      updatedCount: updatedCount,
      message: updatedCount + '개 거래원장 행의 ' + targetColName + ' 상태를 "' + status + '"로 업데이트했습니다.',
      updatedRows: updatedRows
    };

  } catch (error) {
    Logger.log('[updateLedgerPaymentStatus] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '거래원장 업데이트 중 오류 발생: ' + error.message
    };
  }
}

/**
 * 입출금 기록 추가
 * @param {Object} params
 *   - date: 결제일 (YYYY-MM-DD)
 *   - type: 결제유형 (입금/출금)
 *   - company: 거래처명
 *   - amount: 금액
 *   - method: 결제수단 (현금/카드/계좌이체/기타)
 *   - docNumber: 문서번호 (선택)
 *   - orderNumber: 발주번호 (선택)
 *   - notes: 비고 (선택)
 * @return {Object} { success, paymentId, message, error }
 */
function addPaymentRecord(params) {
  try {
    // 필수 파라미터 검증
    if (!params.date || !params.type || !params.company || !params.amount || !params.method) {
      return {
        success: false,
        error: '필수 정보를 입력해주세요 (일자, 유형, 거래처, 금액, 결제수단)'
      };
    }

    // 결제유형 검증
    if (params.type !== '입금' && params.type !== '출금') {
      return {
        success: false,
        error: '결제유형은 "입금" 또는 "출금"이어야 합니다.'
      };
    }

    // 금액 검증
    var amount = Number(params.amount);
    if (isNaN(amount) || amount <= 0) {
      return {
        success: false,
        error: '올바른 금액을 입력해주세요.'
      };
    }

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName(PAYMENT_SHEET_NAME);

    if (!sheet) {
      return {
        success: false,
        error: '결제내역 시트를 찾을 수 없습니다. Phase 1 셋업을 먼저 실행하세요.'
      };
    }

    // 결제ID 생성
    var paymentId = generatePaymentId();

    // 현재 사용자 정보
    var now = new Date();
    var user = Session.getActiveUser().getEmail();

    // 날짜 파싱
    var paymentDate = new Date(params.date);

    // 행 데이터 구성
    var rowData = [
      paymentId,                      // 결제ID
      paymentDate,                    // 결제일
      params.type,                    // 결제유형
      params.company,                 // 거래처명
      amount,                         // 금액
      params.method,                  // 결제수단
      params.docNumber || '',         // 문서번호
      params.orderNumber || '',       // 발주번호
      params.notes || '',             // 비고
      false,                          // 삭제여부
      '',                             // 삭제일시
      '',                             // 삭제자
      now,                            // 입력일시
      user                            // 입력자
    ];

    // 시트에 추가 - A열(결제ID)에서 실제 데이터가 있는 마지막 행 찾기
    var lastRow = sheet.getLastRow();
    var idColumn = sheet.getRange(1, 1, lastRow, 1).getValues(); // A열만 읽기

    var lastDataRow = 1; // 헤더 행
    for (var i = idColumn.length - 1; i > 0; i--) {
      if (idColumn[i][0] && idColumn[i][0] !== '') {
        lastDataRow = i + 1;
        break;
      }
    }

    var nextRow = lastDataRow + 1;
    sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);

    Logger.log('[addPaymentRecord] ✅ 입출금 기록 추가 (' + nextRow + '행): ' + paymentId);

    // 발주 연동: 결제 상태 재계산 및 동기화
    if (params.orderNumber && params.orderNumber !== '') {
      var syncResult = syncOrderPaymentStatus(params.orderNumber, params.type);
      if (!syncResult.success) {
        Logger.log('[addPaymentRecord] ⚠️ 발주 동기화 실패: ' + syncResult.error);
        // 동기화 실패해도 입출금 추가는 성공으로 처리
      }
    }

    // 거래원장 연동: 청구서 기반 결제인 경우 거래원장의 결제 상태 업데이트
    if (params.docNumber && params.docNumber !== '') {
      var ledgerUpdateResult = updateLedgerPaymentStatus(params.docNumber, params.type, '결제완료');
      if (ledgerUpdateResult.success) {
        Logger.log('[addPaymentRecord] ✅ 거래원장 업데이트 성공: ' + ledgerUpdateResult.message);
      } else {
        Logger.log('[addPaymentRecord] ⚠️ 거래원장 업데이트 실패: ' + ledgerUpdateResult.error);
        // 거래원장 업데이트 실패해도 입출금 추가는 성공으로 처리
      }
    }

    return {
      success: true,
      paymentId: paymentId,
      message: '입출금 기록이 추가되었습니다.'
    };

  } catch (error) {
    Logger.log('[addPaymentRecord] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '입출금 기록 추가 중 오류 발생: ' + error.message
    };
  }
}

/**
 * 입출금 조회 (필터링)
 * @param {Object} params
 *   - type: 결제유형 (입금/출금/전체)
 *   - company: 거래처명 (부분 일치)
 *   - startDate: 시작일
 *   - endDate: 종료일
 *   - docNumber: 문서번호
 *   - includeDeleted: 삭제된 항목 포함 여부 (기본 false)
 * @return {Object} { success, payments: [], error }
 */
function getPaymentRecords(params) {
  try {
    params = params || {};

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName(PAYMENT_SHEET_NAME);

    if (!sheet) {
      return {
        success: false,
        error: '결제내역 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return {
        success: true,
        payments: []
      };
    }

    var header = data[0];
    var rows = data.slice(1);

    // 컬럼 인덱스
    var col = function(name) { return header.indexOf(name); };
    var cPaymentId = col('결제ID');
    var cDate = col('결제일');
    var cType = col('결제유형');
    var cCompany = col('거래처명');
    var cAmount = col('금액');
    var cMethod = col('결제수단');
    var cDocNumber = col('문서번호');
    var cOrderNumber = col('발주번호');
    var cNotes = col('비고');
    var cDeleted = col('삭제여부');
    var cInputDate = col('입력일시');
    var cInputUser = col('입력자');

    // 필터링
    var includeDeleted = params.includeDeleted || false;
    var typeFilter = params.type || '';
    var companyFilter = params.company || '';
    var docNumberFilter = params.docNumber || '';
    var startDate = params.startDate ? new Date(params.startDate) : null;
    var endDate = params.endDate ? new Date(params.endDate) : null;

    var results = [];

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];

      // 빈 행 스킵 (결제ID가 없으면 빈 행으로 간주)
      if (!row[cPaymentId] || row[cPaymentId] === '') {
        continue;
      }

      // 삭제 여부 체크
      if (!includeDeleted && row[cDeleted]) {
        continue;
      }

      // 결제유형 필터
      if (typeFilter && row[cType] !== typeFilter) {
        continue;
      }

      // 거래처명 필터 (부분 일치)
      if (companyFilter && String(row[cCompany]).indexOf(companyFilter) === -1) {
        continue;
      }

      // 문서번호 필터
      if (docNumberFilter && row[cDocNumber] !== docNumberFilter) {
        continue;
      }

      // 날짜 범위 필터
      var rowDate = row[cDate];
      if (rowDate && (startDate || endDate)) {
        var paymentDate = new Date(rowDate);
        if (startDate && paymentDate < startDate) continue;
        if (endDate && paymentDate > endDate) continue;
      }

      // 결과 추가
      var paymentRecord = {
        paymentId: row[cPaymentId],
        date: formatDateString(row[cDate]),
        type: row[cType],
        company: row[cCompany],
        amount: Number(row[cAmount]) || 0,
        method: row[cMethod],
        docNumber: row[cDocNumber] || '',
        orderNumber: row[cOrderNumber] || '',
        notes: row[cNotes] || '',
        deleted: row[cDeleted] || false,
        createdAt: formatDateString(row[cInputDate]),  // 프론트엔드와 일치
        inputUser: row[cInputUser]
      };

      // SPEC_01: 부분결제 - 청구서 정보 추가 (docNumber가 있는 경우)
      var docNumber = row[cDocNumber] || '';
      if (docNumber && docNumber !== '' && docNumber !== '-') {
        try {
          // 문서번호가 JSON 배열인 경우 첫 번째 항목 사용
          var invoiceId = docNumber;
          if (docNumber.startsWith('[')) {
            var docs = JSON.parse(docNumber);
            if (Array.isArray(docs) && docs.length > 0) {
              invoiceId = docs[0];
            }
          }

          Logger.log('[getPaymentRecords] 청구서 조회 시도: ' + invoiceId + ' (원본: ' + docNumber + ')');

          // 청구서 정보 조회
          var invoiceSheet = SpreadsheetApp.openById(PAYMENT_SS_ID).getSheetByName(INVOICE_SHEET_NAME);
          if (invoiceSheet) {
            var invoiceData = invoiceSheet.getDataRange().getValues();
            var invoiceHeader = invoiceData[0];

            // 헤더 정보 출력 (첫 10개 컬럼)
            var headerSample = [];
            for (var h = 0; h < Math.min(10, invoiceHeader.length); h++) {
              headerSample.push(h + ':"' + invoiceHeader[h] + '"');
            }
            Logger.log('[getPaymentRecords] 청구서 헤더: ' + headerSample.join(', '));

            var colInv = function(name) { return invoiceHeader.indexOf(name); };

            var cInvId = colInv('청구서ID');
            var cInvAmount = colInv('청구금액');
            var cInvStatus = colInv('청구상태');
            var cInvPaidAmount = colInv('결제완료금액');
            var cInvRemaining = colInv('미수금');

            Logger.log('[getPaymentRecords] 청구서 컬럼 - ID: ' + cInvId + ', 상태: ' + cInvStatus + ', 총 행: ' + invoiceData.length);

            // 청구서 찾기
            var found = false;
            for (var j = 1; j < invoiceData.length; j++) {
              var currentInvoiceId = String(invoiceData[j][cInvId]).trim();
              var searchInvoiceId = String(invoiceId).trim();

              if (currentInvoiceId === searchInvoiceId) {
                paymentRecord.invoiceAmount = Number(invoiceData[j][cInvAmount]) || 0;
                paymentRecord.invoiceStatus = invoiceData[j][cInvStatus] || '';
                paymentRecord.invoicePaidAmount = (cInvPaidAmount !== -1) ? (Number(invoiceData[j][cInvPaidAmount]) || 0) : 0;
                paymentRecord.invoiceRemainingBalance = (cInvRemaining !== -1) ? (Number(invoiceData[j][cInvRemaining]) || paymentRecord.invoiceAmount) : paymentRecord.invoiceAmount;
                Logger.log('[getPaymentRecords] ✅ 청구서 발견: ' + invoiceId + ', 상태: ' + paymentRecord.invoiceStatus + ', 미수금: ' + paymentRecord.invoiceRemainingBalance);
                found = true;
                break;
              }
            }

            if (!found) {
              Logger.log('[getPaymentRecords] ❌ 청구서 미발견: "' + invoiceId + '" (총 ' + (invoiceData.length - 1) + '건 검색)');
              // 첫 3개 청구서 ID 샘플 출력
              var sampleIds = [];
              for (var k = 1; k < Math.min(4, invoiceData.length); k++) {
                sampleIds.push('"' + invoiceData[k][cInvId] + '"');
              }
              Logger.log('[getPaymentRecords] 청구서 샘플: ' + sampleIds.join(', '));
            }
          }
        } catch (e) {
          // 청구서 조회 실패해도 결제 레코드는 유지
          Logger.log('[getPaymentRecords] 청구서 조회 실패: ' + e.message);
        }
      }

      results.push(paymentRecord);
    }

    Logger.log('[getPaymentRecords] 조회 완료: ' + results.length + '건');

    return {
      success: true,
      payments: results
    };

  } catch (error) {
    Logger.log('[getPaymentRecords] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '입출금 조회 중 오류 발생: ' + error.message
    };
  }
}

/**
 * 입출금 수정
 * @param {Object} params
 *   - paymentId: 결제ID (필수)
 *   - date, type, company, amount, method, docNumber, orderNumber, notes
 * @return {Object} { success, message, error }
 */
function updatePaymentRecord(params) {
  try {
    if (!params.paymentId) {
      return {
        success: false,
        error: '결제ID가 필요합니다.'
      };
    }

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName(PAYMENT_SHEET_NAME);

    if (!sheet) {
      return {
        success: false,
        error: '결제내역 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();
    var header = data[0];

    var col = function(name) { return header.indexOf(name); };
    var cPaymentId = col('결제ID');
    var cOrderNumber = col('발주번호');
    var cType = col('결제유형');

    // 해당 행 찾기
    var rowIndex = -1;
    var oldOrderNumber = '';
    var oldType = '';

    for (var i = 1; i < data.length; i++) {
      if (data[i][cPaymentId] === params.paymentId) {
        rowIndex = i + 1; // 1-based
        oldOrderNumber = data[i][cOrderNumber] || '';
        oldType = data[i][cType] || '';
        break;
      }
    }

    if (rowIndex === -1) {
      return {
        success: false,
        error: '해당 결제 기록을 찾을 수 없습니다.'
      };
    }

    // 업데이트할 필드
    if (params.date) {
      sheet.getRange(rowIndex, col('결제일') + 1).setValue(new Date(params.date));
    }
    if (params.type) {
      sheet.getRange(rowIndex, col('결제유형') + 1).setValue(params.type);
    }
    if (params.company) {
      sheet.getRange(rowIndex, col('거래처명') + 1).setValue(params.company);
    }
    if (params.amount !== undefined) {
      sheet.getRange(rowIndex, col('금액') + 1).setValue(Number(params.amount));
    }
    if (params.method) {
      sheet.getRange(rowIndex, col('결제수단') + 1).setValue(params.method);
    }
    if (params.docNumber !== undefined) {
      sheet.getRange(rowIndex, col('문서번호') + 1).setValue(params.docNumber);
    }
    // 발주번호는 수정 불가 (복잡도 때문에 제외)
    if (params.notes !== undefined) {
      sheet.getRange(rowIndex, col('비고') + 1).setValue(params.notes);
    }

    Logger.log('[updatePaymentRecord] ✅ 입출금 수정: ' + params.paymentId);

    // 발주 연동: 결제 상태 재계산 및 동기화
    var newType = params.type || oldType;

    if (oldOrderNumber && oldOrderNumber !== '') {
      var syncResult = syncOrderPaymentStatus(oldOrderNumber, newType);
      if (!syncResult.success) {
        Logger.log('[updatePaymentRecord] ⚠️ 발주 동기화 실패: ' + syncResult.error);
        // 동기화 실패해도 입출금 수정은 성공으로 처리
      }
    }

    // 거래원장 연동: 청구서 기반 결제인 경우 거래원장의 결제 상태 업데이트
    var newDocNumber = params.docNumber !== undefined ? params.docNumber : data[rowIndex - 1][col('문서번호')];
    if (newDocNumber && newDocNumber !== '') {
      var ledgerUpdateResult = updateLedgerPaymentStatus(newDocNumber, newType, '결제완료');
      if (ledgerUpdateResult.success) {
        Logger.log('[updatePaymentRecord] ✅ 거래원장 업데이트 성공: ' + ledgerUpdateResult.message);
      } else {
        Logger.log('[updatePaymentRecord] ⚠️ 거래원장 업데이트 실패: ' + ledgerUpdateResult.error);
        // 거래원장 업데이트 실패해도 입출금 수정은 성공으로 처리
      }
    }

    return {
      success: true,
      message: '입출금 기록이 수정되었습니다.'
    };

  } catch (error) {
    Logger.log('[updatePaymentRecord] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '입출금 수정 중 오류 발생: ' + error.message
    };
  }
}

/**
 * 입출금 삭제 (소프트 삭제)
 * @param {Object} params - { paymentId }
 * @return {Object} { success, message, error }
 */
function deletePaymentRecord(params) {
  try {
    if (!params.paymentId) {
      return {
        success: false,
        error: '결제ID가 필요합니다.'
      };
    }

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var paymentSheet = ss.getSheetByName(PAYMENT_SHEET_NAME);
    var invoiceSheet = ss.getSheetByName(INVOICE_SHEET_NAME);

    if (!paymentSheet) {
      return {
        success: false,
        error: '결제내역 시트를 찾을 수 없습니다.'
      };
    }

    // ========================================
    // 1. 결제 정보 조회
    // ========================================
    var paymentData = paymentSheet.getDataRange().getValues();
    var paymentHeader = paymentData[0];
    var col = function(name) { return paymentHeader.indexOf(name); };

    var paymentRow = null;
    var paymentRowIndex = -1;
    var docNumber = '';
    var paymentType = '';
    var orderNumber = '';
    var amount = 0;

    for (var i = 1; i < paymentData.length; i++) {
      if (paymentData[i][col('결제ID')] === params.paymentId) {
        paymentRow = paymentData[i];
        paymentRowIndex = i + 1;
        docNumber = paymentRow[col('문서번호')] || '';
        paymentType = paymentRow[col('결제유형')] || '';
        orderNumber = paymentRow[col('발주번호')] || '';
        amount = Number(paymentRow[col('금액')]) || 0;
        break;
      }
    }

    if (!paymentRow) {
      return {
        success: false,
        error: '해당 결제 내역을 찾을 수 없습니다.'
      };
    }

    Logger.log('[deletePaymentRecord] 결제 취소 시작: ' + params.paymentId);
    Logger.log('[deletePaymentRecord] 금액: ' + amount.toLocaleString() + '원');
    Logger.log('[deletePaymentRecord] 문서번호: ' + docNumber);

    // ========================================
    // 2. 청구서 상태 복원 (SPEC_02)
    // ========================================
    if (docNumber && invoiceSheet) {
      Logger.log('[deletePaymentRecord] 청구서 상태 복원 시작...');

      try {
        // 문서번호가 JSON 배열인지 확인 (복수 청구서)
        var invoiceIds = [];
        try {
          invoiceIds = JSON.parse(docNumber);
          if (!Array.isArray(invoiceIds)) {
            invoiceIds = [docNumber];
          }
        } catch (e) {
          invoiceIds = [docNumber];
        }

        var invoiceData = invoiceSheet.getDataRange().getValues();
        var invoiceHeader = invoiceData[0];

        var colInvoiceId = invoiceHeader.indexOf('청구ID');
        var colStatus = invoiceHeader.indexOf('청구상태');
        var colAmount = invoiceHeader.indexOf('청구금액');
        var colPaidAmount = invoiceHeader.indexOf('결제완료금액');
        var colRemainingBalance = invoiceHeader.indexOf('미수금');
        var colLastPaymentDate = invoiceHeader.indexOf('최종결제일');

        var supportsPartialPayment = (colPaidAmount !== -1 && colRemainingBalance !== -1);

        var restoredCount = 0;

        for (var j = 0; j < invoiceIds.length; j++) {
          var invoiceId = invoiceIds[j];

          for (var k = 1; k < invoiceData.length; k++) {
            if (invoiceData[k][colInvoiceId] === invoiceId) {
              var invoice = invoiceData[k];
              var invoiceRowIndex = k + 1;

              if (supportsPartialPayment) {
                // 부분 결제 지원: 결제완료금액 감소, 미수금 증가
                var 청구금액 = Number(invoice[colAmount]) || 0;
                var 현재결제완료금액 = Number(invoice[colPaidAmount]) || 0;
                var 신규결제완료금액 = Math.max(0, 현재결제완료금액 - amount);
                var 신규미수금 = 청구금액 - 신규결제완료금액;

                // 상태 결정
                var 신규상태 = 'ISSUED';
                if (신규미수금 === 0) {
                  신규상태 = 'PAID';
                } else if (신규결제완료금액 > 0) {
                  신규상태 = 'PAID_PARTIAL';
                }

                Logger.log('[deletePaymentRecord] 청구서 ' + invoiceId + ' 복원:');
                Logger.log('   - 결제완료금액: ' + 현재결제완료금액.toLocaleString() + ' → ' + 신규결제완료금액.toLocaleString());
                Logger.log('   - 미수금: ' + (청구금액 - 현재결제완료금액).toLocaleString() + ' → ' + 신규미수금.toLocaleString());
                Logger.log('   - 상태: ' + invoice[colStatus] + ' → ' + 신규상태);

                invoiceSheet.getRange(invoiceRowIndex, colStatus + 1).setValue(신규상태);
                invoiceSheet.getRange(invoiceRowIndex, colPaidAmount + 1).setValue(신규결제완료금액);
                invoiceSheet.getRange(invoiceRowIndex, colRemainingBalance + 1).setValue(신규미수금);

                // 최종결제일은 유지 (이전 결제 이력이 있을 수 있음)

                // 거래원장 상태 업데이트
                var ledgerStatus = (신규상태 === 'PAID') ? '결제완료' : (신규상태 === 'PAID_PARTIAL' ? '부분결제' : '미결제');
                updateLedgerPaymentStatus(invoiceId, paymentType, ledgerStatus);

              } else {
                // 부분 결제 미지원: 단순히 ISSUED로 복원
                invoiceSheet.getRange(invoiceRowIndex, colStatus + 1).setValue('ISSUED');
                Logger.log('[deletePaymentRecord] 청구서 ' + invoiceId + ' 상태 복원: ISSUED');

                updateLedgerPaymentStatus(invoiceId, paymentType, '미결제');
              }

              restoredCount++;
              break;
            }
          }
        }

        Logger.log('[deletePaymentRecord] ✅ 청구서 복원 완료: ' + restoredCount + '건');

      } catch (error) {
        Logger.log('[deletePaymentRecord] ⚠️ 청구서 복원 실패: ' + error.message);
        // 복원 실패해도 삭제는 진행
      }
    }

    // ========================================
    // 3. 거래원장 연동 (기존 코드 유지)
    // ========================================
    if (docNumber && docNumber !== '') {
      var ledgerUpdateResult = updateLedgerPaymentStatus(docNumber, paymentType, '미결제');
      if (ledgerUpdateResult.success) {
        Logger.log('[deletePaymentRecord] ✅ 거래원장 복원 성공: ' + ledgerUpdateResult.message);
      } else {
        Logger.log('[deletePaymentRecord] ⚠️ 거래원장 복원 실패: ' + ledgerUpdateResult.error);
      }
    }

    // ========================================
    // 4. 발주 연동 (기존 코드 유지)
    // ========================================
    if (orderNumber && orderNumber !== '') {
      var syncResult = syncOrderPaymentStatus(orderNumber, paymentType);
      if (!syncResult.success) {
        Logger.log('[deletePaymentRecord] ⚠️ 발주 동기화 실패: ' + syncResult.error);
      }
    }

    // ========================================
    // 5. 결제내역 Soft Delete
    // ========================================
    var result = softDeleteRecord(paymentSheet, params.paymentId, '결제ID');

    if (result.success) {
      Logger.log('[deletePaymentRecord] ✅ 결제 취소 완료: ' + params.paymentId);
    }

    return result;

  } catch (error) {
    Logger.log('[deletePaymentRecord] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '결제 취소 중 오류 발생: ' + error.message
    };
  }
}

/**
 * ============================================================
 * 환불 처리 (SPEC_02)
 * ============================================================
 * 마이너스 결제 기록 생성
 * @param {Object} params
 *   - originalPaymentId: 원결제 ID
 *   - refundAmount: 환불 금액
 *   - refundDate: 환불일 (선택, 기본값: 오늘)
 *   - refundReason: 환불 사유
 * @return {Object} { success, refundId, message, error }
 */
function createRefund(params) {
  try {
    if (!params.originalPaymentId || !params.refundAmount) {
      return {
        success: false,
        error: '원결제ID와 환불금액은 필수입니다.'
      };
    }

    var refundAmount = Number(params.refundAmount);
    if (isNaN(refundAmount) || refundAmount <= 0) {
      return {
        success: false,
        error: '올바른 환불 금액을 입력해주세요.'
      };
    }

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var paymentSheet = ss.getSheetByName(PAYMENT_SHEET_NAME);
    var invoiceSheet = ss.getSheetByName(INVOICE_SHEET_NAME);

    if (!paymentSheet) {
      return {
        success: false,
        error: '결제내역 시트를 찾을 수 없습니다.'
      };
    }

    // ========================================
    // 1. 원결제 정보 조회
    // ========================================
    var paymentData = paymentSheet.getDataRange().getValues();
    var paymentHeader = paymentData[0];
    var col = function(name) { return paymentHeader.indexOf(name); };

    var originalPayment = null;

    for (var i = 1; i < paymentData.length; i++) {
      if (paymentData[i][col('결제ID')] === params.originalPaymentId) {
        originalPayment = {
          결제ID: paymentData[i][col('결제ID')],
          결제일: paymentData[i][col('결제일')],
          결제유형: paymentData[i][col('결제유형')],
          거래처명: paymentData[i][col('거래처명')],
          금액: Number(paymentData[i][col('금액')]) || 0,
          결제수단: paymentData[i][col('결제수단')],
          문서번호: paymentData[i][col('문서번호')],
          발주번호: paymentData[i][col('발주번호')],
          비고: paymentData[i][col('비고')]
        };
        break;
      }
    }

    if (!originalPayment) {
      return {
        success: false,
        error: '원결제 내역을 찾을 수 없습니다: ' + params.originalPaymentId
      };
    }

    // 환불 금액 검증 (원결제 금액보다 클 수 없음)
    if (refundAmount > originalPayment.금액) {
      return {
        success: false,
        error: '환불 금액(' + refundAmount.toLocaleString() + '원)이 원결제 금액(' + originalPayment.금액.toLocaleString() + '원)을 초과할 수 없습니다.'
      };
    }

    Logger.log('[createRefund] 환불 처리 시작');
    Logger.log('[createRefund] 원결제ID: ' + params.originalPaymentId);
    Logger.log('[createRefund] 환불금액: ' + refundAmount.toLocaleString() + '원');

    // ========================================
    // 2. 환불 결제 기록 생성 (마이너스 금액)
    // ========================================
    var now = new Date();
    var refundDate = params.refundDate || now;
    var refundId = generatePaymentId(); // 새로운 결제 ID 생성
    var user = Session.getActiveUser().getEmail();

    // 환불 결제유형 (원결제의 반대)
    var 환불결제유형 = (originalPayment.결제유형 === '입금') ? '출금' : '입금';

    var refundRow = [];
    paymentHeader.forEach(function(h) {
      switch(h) {
        case '결제ID':
          refundRow.push(refundId);
          break;
        case '결제일':
          refundRow.push(refundDate);
          break;
        case '결제유형':
          refundRow.push(환불결제유형);  // 반대 유형
          break;
        case '거래처명':
          refundRow.push(originalPayment.거래처명);
          break;
        case '금액':
          refundRow.push(-refundAmount);  // ⭐ 마이너스 금액
          break;
        case '결제수단':
          refundRow.push(originalPayment.결제수단);
          break;
        case '문서번호':
          refundRow.push(originalPayment.문서번호);
          break;
        case '발주번호':
          refundRow.push(originalPayment.발주번호 || '');
          break;
        case '비고':
          var refundNote = '환불: ' + (params.refundReason || '사유 미입력');
          refundRow.push(refundNote);
          break;
        case '삭제여부':
          refundRow.push(false);
          break;
        case '삭제일시':
        case '삭제자':
          refundRow.push('');
          break;
        case '입력일시':
          refundRow.push(now);
          break;
        case '입력자':
          refundRow.push(user);
          break;
        case '원결제ID':  // SPEC_02 추가 컬럼
          refundRow.push(params.originalPaymentId);
          break;
        case '환불여부':  // SPEC_02 추가 컬럼
          refundRow.push(true);
          break;
        default:
          refundRow.push('');
          break;
      }
    });

    // 시트에 추가
    var lastRow = paymentSheet.getLastRow();
    var idColumn = paymentSheet.getRange(1, 1, lastRow, 1).getValues();
    var lastDataRow = 1;

    for (var i = idColumn.length - 1; i > 0; i--) {
      if (idColumn[i][0] && idColumn[i][0] !== '') {
        lastDataRow = i + 1;
        break;
      }
    }

    var nextRow = lastDataRow + 1;
    paymentSheet.getRange(nextRow, 1, 1, refundRow.length).setValues([refundRow]);

    Logger.log('[createRefund] ✅ 환불 기록 생성 완료 (' + nextRow + '행): ' + refundId);

    // ========================================
    // 3. 청구서 상태 업데이트 (결제완료금액 감소)
    // ========================================
    if (originalPayment.문서번호 && invoiceSheet) {
      Logger.log('[createRefund] 청구서 업데이트 시작...');

      try {
        var invoiceIds = [];
        try {
          invoiceIds = JSON.parse(originalPayment.문서번호);
          if (!Array.isArray(invoiceIds)) {
            invoiceIds = [originalPayment.문서번호];
          }
        } catch (e) {
          invoiceIds = [originalPayment.문서번호];
        }

        var invoiceData = invoiceSheet.getDataRange().getValues();
        var invoiceHeader = invoiceData[0];

        var colInvoiceId = invoiceHeader.indexOf('청구ID');
        var colStatus = invoiceHeader.indexOf('청구상태');
        var colAmount = invoiceHeader.indexOf('청구금액');
        var colPaidAmount = invoiceHeader.indexOf('결제완료금액');
        var colRemainingBalance = invoiceHeader.indexOf('미수금');

        var supportsPartialPayment = (colPaidAmount !== -1 && colRemainingBalance !== -1);

        if (supportsPartialPayment) {
          for (var j = 0; j < invoiceIds.length; j++) {
            var invoiceId = invoiceIds[j];

            for (var k = 1; k < invoiceData.length; k++) {
              if (invoiceData[k][colInvoiceId] === invoiceId) {
                var invoice = invoiceData[k];
                var invoiceRowIndex = k + 1;

                var 청구금액 = Number(invoice[colAmount]) || 0;
                var 현재결제완료금액 = Number(invoice[colPaidAmount]) || 0;
                var 신규결제완료금액 = Math.max(0, 현재결제완료금액 - refundAmount);
                var 신규미수금 = 청구금액 - 신규결제완료금액;

                var 신규상태 = 'ISSUED';
                if (신규미수금 === 0) {
                  신규상태 = 'PAID';
                } else if (신규결제완료금액 > 0) {
                  신규상태 = 'PAID_PARTIAL';
                }

                Logger.log('[createRefund] 청구서 ' + invoiceId + ' 업데이트:');
                Logger.log('   - 결제완료금액: ' + 현재결제완료금액.toLocaleString() + ' → ' + 신규결제완료금액.toLocaleString());
                Logger.log('   - 미수금: ' + (청구금액 - 현재결제완료금액).toLocaleString() + ' → ' + 신규미수금.toLocaleString());
                Logger.log('   - 상태: ' + invoice[colStatus] + ' → ' + 신규상태);

                invoiceSheet.getRange(invoiceRowIndex, colStatus + 1).setValue(신규상태);
                invoiceSheet.getRange(invoiceRowIndex, colPaidAmount + 1).setValue(신규결제완료금액);
                invoiceSheet.getRange(invoiceRowIndex, colRemainingBalance + 1).setValue(신규미수금);

                var ledgerStatus = (신규상태 === 'PAID') ? '결제완료' : (신규상태 === 'PAID_PARTIAL' ? '부분결제' : '미결제');
                updateLedgerPaymentStatus(invoiceId, originalPayment.결제유형, ledgerStatus);

                break;
              }
            }
          }

          Logger.log('[createRefund] ✅ 청구서 업데이트 완료');
        }

      } catch (error) {
        Logger.log('[createRefund] ⚠️ 청구서 업데이트 실패: ' + error.message);
      }
    }

    return {
      success: true,
      refundId: refundId,
      originalPaymentId: params.originalPaymentId,
      refundAmount: refundAmount,
      message: '환불 처리가 완료되었습니다. (환불ID: ' + refundId + ')'
    };

  } catch (error) {
    Logger.log('[createRefund] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '환불 처리 중 오류 발생: ' + error.message
    };
  }
}

/**
 * 입출금 요약 통계
 * @param {Object} params
 *   - startDate: 시작일
 *   - endDate: 종료일
 *   - company: 거래처명
 * @return {Object} { success, totalIncome, totalExpense, netProfit, error }
 */
function getPaymentSummary(params) {
  try {
    params = params || {};

    // 전체 데이터 조회 (삭제된 항목 제외)
    var result = getPaymentRecords({
      startDate: params.startDate,
      endDate: params.endDate,
      company: params.company,
      includeDeleted: false
    });

    if (!result.success) {
      return result;
    }

    var payments = result.payments || [];

    var totalIncome = 0;
    var totalExpense = 0;

    for (var i = 0; i < payments.length; i++) {
      var payment = payments[i];
      var amount = Number(payment.amount) || 0;

      if (payment.type === '입금') {
        totalIncome += amount;
      } else if (payment.type === '출금') {
        totalExpense += amount;
      }
    }

    var netProfit = totalIncome - totalExpense;

    Logger.log('[getPaymentSummary] 요약: 입금 ' + totalIncome + ', 출금 ' + totalExpense + ', 순이익 ' + netProfit);

    return {
      success: true,
      totalIncome: totalIncome,
      totalExpense: totalExpense,
      netProfit: netProfit,
      count: payments.length
    };

  } catch (error) {
    Logger.log('[getPaymentSummary] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '요약 통계 조회 중 오류 발생: ' + error.message
    };
  }
}

/**
 * 문서번호 자동완성 검색
 * @param {Object} params - { query }
 * @return {Object} { success, suggestions: [{ docNumber, company, date, amount }], error }
 */
function searchDocumentNumbers(params) {
  try {
    if (!params.query || params.query.length < 3) {
      return {
        success: true,
        suggestions: []
      };
    }

    var query = String(params.query).toUpperCase();

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName(INVOICE_SHEET_NAME);

    if (!sheet) {
      return {
        success: false,
        error: '청구DB 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return {
        success: true,
        suggestions: []
      };
    }

    var header = data[0];
    var rows = data.slice(1);

    var col = function(name) { return header.indexOf(name); };
    var cInvoiceId = col('청구ID');
    var cCompany = col('업체명');
    var cDate = col('청구일');
    var cAmount = col('청구금액');
    var cStatus = col('청구상태');

    var suggestions = [];

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var invoiceId = String(row[cInvoiceId] || '');

      // 문서번호로 검색 (대소문자 구분 없음)
      if (invoiceId.toUpperCase().indexOf(query) !== -1) {
        // CANCELLED 상태는 제외
        if (row[cStatus] === 'CANCELLED') {
          continue;
        }

        suggestions.push({
          docNumber: invoiceId,
          company: row[cCompany] || '',
          date: formatDateString(row[cDate]),
          amount: Number(row[cAmount]) || 0
        });

        // 최대 10개까지만
        if (suggestions.length >= 10) {
          break;
        }
      }
    }

    Logger.log('[searchDocumentNumbers] 검색 결과: ' + suggestions.length + '건');

    return {
      success: true,
      suggestions: suggestions
    };

  } catch (error) {
    Logger.log('[searchDocumentNumbers] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '문서번호 검색 중 오류 발생: ' + error.message
    };
  }
}

// ============================================================
// 2. 회사비용 관리 (5개 함수)
// ============================================================

/**
 * 비용 기록 추가
 * @param {Object} params
 *   - date: 비용일
 *   - category: 비용항목
 *   - amount: 금액
 *   - method: 결제수단
 *   - notes: 비고 (선택)
 * @return {Object} { success, expenseId, message, error }
 */
function addExpenseRecord(params) {
  try {
    // 필수 파라미터 검증
    if (!params.date || !params.category || !params.amount || !params.method) {
      return {
        success: false,
        error: '필수 정보를 입력해주세요 (일자, 항목, 금액, 결제수단)'
      };
    }

    // 금액 검증
    var amount = Number(params.amount);
    if (isNaN(amount) || amount <= 0) {
      return {
        success: false,
        error: '올바른 금액을 입력해주세요.'
      };
    }

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName(EXPENSE_SHEET_NAME);

    if (!sheet) {
      return {
        success: false,
        error: '회사비용 시트를 찾을 수 없습니다. Phase 1 셋업을 먼저 실행하세요.'
      };
    }

    // 비용ID 생성
    var expenseId = generateExpenseId();

    // 현재 사용자 정보
    var now = new Date();
    var user = Session.getActiveUser().getEmail();

    // 날짜 파싱
    var expenseDate = new Date(params.date);

    // 행 데이터 구성
    var rowData = [
      expenseId,                      // 비용ID
      expenseDate,                    // 비용일
      params.category,                // 비용항목
      amount,                         // 금액
      params.method,                  // 결제수단
      params.notes || '',             // 비고
      false,                          // 삭제여부
      '',                             // 삭제일시
      '',                             // 삭제자
      now,                            // 입력일시
      user                            // 입력자
    ];

    // 시트에 추가 - 실제 데이터가 있는 마지막 행 다음에 삽입
    var lastDataRow = 1; // 헤더 행
    var allData = sheet.getDataRange().getValues();

    // 역순으로 검색하여 비용ID가 있는 마지막 행 찾기
    for (var i = allData.length - 1; i > 0; i--) {
      if (allData[i][0] && allData[i][0] !== '') { // 비용ID 컬럼 (첫 번째 컬럼)
        lastDataRow = i + 1; // 배열 인덱스는 0부터, 행 번호는 1부터
        break;
      }
    }

    var nextRow = lastDataRow + 1;
    sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);

    Logger.log('[addExpenseRecord] ✅ 비용 기록 추가 (' + nextRow + '행): ' + expenseId);

    return {
      success: true,
      expenseId: expenseId,
      message: '비용 기록이 추가되었습니다.'
    };

  } catch (error) {
    Logger.log('[addExpenseRecord] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '비용 기록 추가 중 오류 발생: ' + error.message
    };
  }
}

/**
 * 비용 조회 (필터링)
 * @param {Object} params
 *   - category: 비용항목
 *   - startDate: 시작일
 *   - endDate: 종료일
 *   - includeDeleted: 삭제된 항목 포함 여부
 * @return {Object} { success, expenses: [], error }
 */
function getExpenseRecords(params) {
  try {
    params = params || {};

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName(EXPENSE_SHEET_NAME);

    if (!sheet) {
      return {
        success: false,
        error: '회사비용 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return {
        success: true,
        expenses: []
      };
    }

    var header = data[0];
    var rows = data.slice(1);

    // 컬럼 인덱스
    var col = function(name) { return header.indexOf(name); };
    var cExpenseId = col('비용ID');
    var cDate = col('비용일');
    var cCategory = col('비용항목');
    var cAmount = col('금액');
    var cMethod = col('결제수단');
    var cNotes = col('비고');
    var cDeleted = col('삭제여부');
    var cInputDate = col('입력일시');
    var cInputUser = col('입력자');

    // 필터링
    var includeDeleted = params.includeDeleted || false;
    var categoryFilter = params.category || '';
    var startDate = params.startDate ? new Date(params.startDate) : null;
    var endDate = params.endDate ? new Date(params.endDate) : null;

    var results = [];

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];

      // 빈 행 스킵 (비용ID가 없으면 빈 행으로 간주)
      if (!row[cExpenseId] || row[cExpenseId] === '') {
        continue;
      }

      // 삭제 여부 체크
      if (!includeDeleted && row[cDeleted]) {
        continue;
      }

      // 비용항목 필터
      if (categoryFilter && row[cCategory] !== categoryFilter) {
        continue;
      }

      // 날짜 범위 필터
      var rowDate = row[cDate];
      if (rowDate && (startDate || endDate)) {
        var expenseDate = new Date(rowDate);
        if (startDate && expenseDate < startDate) continue;
        if (endDate && expenseDate > endDate) continue;
      }

      // 결과 추가
      results.push({
        expenseId: row[cExpenseId],
        date: formatDateString(row[cDate]),
        category: row[cCategory],
        amount: Number(row[cAmount]) || 0,
        method: row[cMethod],
        notes: row[cNotes] || '',
        deleted: row[cDeleted] || false,
        inputDate: formatDateString(row[cInputDate]),
        inputUser: row[cInputUser]
      });
    }

    Logger.log('[getExpenseRecords] 조회 완료: ' + results.length + '건');

    return {
      success: true,
      expenses: results
    };

  } catch (error) {
    Logger.log('[getExpenseRecords] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '비용 조회 중 오류 발생: ' + error.message
    };
  }
}

/**
 * 비용 수정
 * @param {Object} params
 *   - expenseId: 비용ID (필수)
 *   - date, category, amount, method, notes
 * @return {Object} { success, message, error }
 */
function updateExpenseRecord(params) {
  try {
    if (!params.expenseId) {
      return {
        success: false,
        error: '비용ID가 필요합니다.'
      };
    }

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName(EXPENSE_SHEET_NAME);

    if (!sheet) {
      return {
        success: false,
        error: '회사비용 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();
    var header = data[0];

    var col = function(name) { return header.indexOf(name); };
    var cExpenseId = col('비용ID');

    // 해당 행 찾기
    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][cExpenseId] === params.expenseId) {
        rowIndex = i + 1; // 1-based
        break;
      }
    }

    if (rowIndex === -1) {
      return {
        success: false,
        error: '해당 비용 기록을 찾을 수 없습니다.'
      };
    }

    // 업데이트할 필드
    if (params.date) {
      sheet.getRange(rowIndex, col('비용일') + 1).setValue(new Date(params.date));
    }
    if (params.category) {
      sheet.getRange(rowIndex, col('비용항목') + 1).setValue(params.category);
    }
    if (params.amount !== undefined) {
      sheet.getRange(rowIndex, col('금액') + 1).setValue(Number(params.amount));
    }
    if (params.method) {
      sheet.getRange(rowIndex, col('결제수단') + 1).setValue(params.method);
    }
    if (params.notes !== undefined) {
      sheet.getRange(rowIndex, col('비고') + 1).setValue(params.notes);
    }

    Logger.log('[updateExpenseRecord] ✅ 비용 수정: ' + params.expenseId);

    return {
      success: true,
      message: '비용 기록이 수정되었습니다.'
    };

  } catch (error) {
    Logger.log('[updateExpenseRecord] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '비용 수정 중 오류 발생: ' + error.message
    };
  }
}

/**
 * 비용 삭제 (소프트 삭제)
 * @param {Object} params - { expenseId }
 * @return {Object} { success, message, error }
 */
function deleteExpenseRecord(params) {
  try {
    if (!params.expenseId) {
      return {
        success: false,
        error: '비용ID가 필요합니다.'
      };
    }

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName(EXPENSE_SHEET_NAME);

    if (!sheet) {
      return {
        success: false,
        error: '회사비용 시트를 찾을 수 없습니다.'
      };
    }

    var result = softDeleteRecord(sheet, params.expenseId, '비용ID');

    if (result.success) {
      Logger.log('[deleteExpenseRecord] ✅ 비용 삭제: ' + params.expenseId);
    }

    return result;

  } catch (error) {
    Logger.log('[deleteExpenseRecord] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '비용 삭제 중 오류 발생: ' + error.message
    };
  }
}

/**
 * 비용 요약 통계
 * @param {Object} params
 *   - startDate: 시작일
 *   - endDate: 종료일
 *   - category: 비용항목
 * @return {Object} { success, totalExpense, byCategory: {}, error }
 */
function getExpenseSummary(params) {
  try {
    params = params || {};

    // 전체 데이터 조회 (삭제된 항목 제외)
    var result = getExpenseRecords({
      startDate: params.startDate,
      endDate: params.endDate,
      category: params.category,
      includeDeleted: false
    });

    if (!result.success) {
      return result;
    }

    var expenses = result.expenses || [];

    var totalExpense = 0;
    var byCategory = {};

    for (var i = 0; i < expenses.length; i++) {
      var expense = expenses[i];
      var amount = Number(expense.amount) || 0;
      var category = expense.category || '기타';

      totalExpense += amount;

      if (!byCategory[category]) {
        byCategory[category] = 0;
      }
      byCategory[category] += amount;
    }

    Logger.log('[getExpenseSummary] 요약: 총 비용 ' + totalExpense + ', 항목수 ' + Object.keys(byCategory).length);

    return {
      success: true,
      totalExpense: totalExpense,
      byCategory: byCategory,
      count: expenses.length
    };

  } catch (error) {
    Logger.log('[getExpenseSummary] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '비용 요약 조회 중 오류 발생: ' + error.message
    };
  }
}

// ============================================================
// 3. 청구서 이력 관리 (2개 함수)
// ============================================================

/**
 * 청구서 취소 및 재발급
 * @param {Object} params
 *   - invoiceId: 취소할 청구서 ID (필수)
 *   - reason: 취소 사유
 *   - newAmount: 새 청구서 금액
 * @return {Object} { success, oldInvoiceId, newInvoiceId, message, error }
 */
function cancelAndReissueInvoice(params) {
  try {
    if (!params.invoiceId) {
      return {
        success: false,
        error: '청구서 ID가 필요합니다.'
      };
    }

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName(INVOICE_SHEET_NAME);

    if (!sheet) {
      return {
        success: false,
        error: '청구DB 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();
    var header = data[0];

    var col = function(name) { return header.indexOf(name); };
    var cInvoiceId = col('청구ID');
    var cType = col('청구유형');
    var cCompany = col('업체명');
    var cSettlementId = col('마감ID');
    var cDate = col('청구일');
    var cAmount = col('청구금액');
    var cStatus = col('청구상태');
    var cBillingType = col('청구타입');
    var cOrderNumbers = col('발주번호');
    var cNotes = col('비고');
    var cReplacement = col('대체청구서');
    var cOriginal = col('원본청구서');

    // 기존 청구서 찾기
    var oldRowIndex = -1;
    var oldRow = null;

    for (var i = 1; i < data.length; i++) {
      if (data[i][cInvoiceId] === params.invoiceId) {
        oldRowIndex = i + 1; // 1-based
        oldRow = data[i];
        break;
      }
    }

    if (oldRowIndex === -1) {
      return {
        success: false,
        error: '해당 청구서를 찾을 수 없습니다.'
      };
    }

    // 이미 취소된 청구서인지 확인
    if (oldRow[cStatus] === 'CANCELLED') {
      return {
        success: false,
        error: '이미 취소된 청구서입니다.'
      };
    }

    // 1. 기존 청구서 취소 처리
    sheet.getRange(oldRowIndex, cStatus + 1).setValue('CANCELLED');

    // 비고에 취소 사유 추가
    var oldNotes = oldRow[cNotes] || '';
    var cancelReason = params.reason || '확정수량 변경으로 취소';
    var newNotes = oldNotes ? (oldNotes + ' | ' + cancelReason) : cancelReason;
    sheet.getRange(oldRowIndex, cNotes + 1).setValue(newNotes);

    // 2. 새 청구서 생성
    var newInvoiceId = generateInvoiceId();

    var newAmount = params.newAmount || oldRow[cAmount];

    var now = new Date();
    var user = Session.getActiveUser().getEmail();

    var newRowData = [
      newInvoiceId,                             // 청구ID
      oldRow[cType],                            // 청구유형
      oldRow[cCompany],                         // 업체명
      oldRow[cSettlementId],                    // 마감ID
      now,                                      // 청구일 (새로 발급일)
      newAmount,                                // 청구금액 (수정된 금액)
      'ISSUED',                                 // 청구상태
      oldRow[cBillingType],                     // 청구타입
      oldRow[cOrderNumbers],                    // 발주번호
      '수정 청구서',                             // 비고
      now,                                      // 생성일시
      user,                                     // 생성자
      now,                                      // 발행일시
      user,                                     // 발행자
      '',                                       // 결제일시
      '',                                       // 대체청구서
      params.invoiceId                          // 원본청구서
    ];

    // 새 청구서 추가
    sheet.appendRow(newRowData);

    // 3. 기존 청구서의 "대체청구서" 필드 업데이트
    if (cReplacement !== -1) {
      sheet.getRange(oldRowIndex, cReplacement + 1).setValue(newInvoiceId);
    }

    Logger.log('[cancelAndReissueInvoice] ✅ 청구서 취소/재발급: ' + params.invoiceId + ' → ' + newInvoiceId);

    return {
      success: true,
      oldInvoiceId: params.invoiceId,
      newInvoiceId: newInvoiceId,
      message: '청구서가 취소되고 새로 발급되었습니다.'
    };

  } catch (error) {
    Logger.log('[cancelAndReissueInvoice] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '청구서 취소/재발급 중 오류 발생: ' + error.message
    };
  }
}

/**
 * 청구서 이력 조회 (원본-대체 관계 추적)
 * @param {Object} params - { invoiceId }
 * @return {Object} { success, history: [], error }
 */
function getInvoiceHistory(params) {
  try {
    if (!params.invoiceId) {
      return {
        success: false,
        error: '청구서 ID가 필요합니다.'
      };
    }

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName(INVOICE_SHEET_NAME);

    if (!sheet) {
      return {
        success: false,
        error: '청구DB 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();
    var header = data[0];

    var col = function(name) { return header.indexOf(name); };
    var cInvoiceId = col('청구ID');
    var cStatus = col('청구상태');
    var cDate = col('청구일');
    var cAmount = col('청구금액');
    var cReplacement = col('대체청구서');
    var cOriginal = col('원본청구서');

    var history = [];
    var currentId = params.invoiceId;
    var visited = {};

    // 재귀적으로 원본 청구서 추적 (최대 10개)
    while (currentId && !visited[currentId] && history.length < 10) {
      visited[currentId] = true;

      // 현재 청구서 찾기
      var found = false;
      for (var i = 1; i < data.length; i++) {
        if (data[i][cInvoiceId] === currentId) {
          var row = data[i];

          history.push({
            invoiceId: row[cInvoiceId],
            status: row[cStatus],
            date: formatDateString(row[cDate]),
            amount: Number(row[cAmount]) || 0,
            replacementInvoiceId: row[cReplacement] || '',
            originalInvoiceId: row[cOriginal] || '',
            relation: row[cOriginal] ? '재발급' : (row[cReplacement] ? '취소됨' : '현재')
          });

          // 원본 청구서가 있으면 계속 추적
          currentId = row[cOriginal] || '';
          found = true;
          break;
        }
      }

      if (!found) {
        break;
      }
    }

    // 역순 정렬 (오래된 것부터)
    history.reverse();

    Logger.log('[getInvoiceHistory] 이력 조회: ' + history.length + '건');

    return {
      success: true,
      history: history
    };

  } catch (error) {
    Logger.log('[getInvoiceHistory] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '청구서 이력 조회 중 오류 발생: ' + error.message
    };
  }
}

// ============================================================
// 4. 유틸리티 함수 (3개)
// ============================================================

/**
 * 결제ID 생성 (PAY-YYYYMMDD-001)
 */
function generatePaymentId() {
  var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
  var sheet = ss.getSheetByName(PAYMENT_SHEET_NAME);

  var today = new Date();
  var dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyyMMdd');

  var data = sheet.getDataRange().getValues();
  var count = 1;

  // 오늘 날짜의 결제 ID 개수 확인
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][0] || '');
    if (id.startsWith('PAY-' + dateStr)) {
      count++;
    }
  }

  var paddedCount = String(count).padStart(3, '0');
  var paymentId = 'PAY-' + dateStr + '-' + paddedCount;

  Logger.log('[generatePaymentId] 생성: ' + paymentId);

  return paymentId;
}

/**
 * 비용ID 생성 (EXP-YYYYMMDD-001)
 */
function generateExpenseId() {
  var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
  var sheet = ss.getSheetByName(EXPENSE_SHEET_NAME);

  var today = new Date();
  var dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyyMMdd');

  var data = sheet.getDataRange().getValues();
  var count = 1;

  // 오늘 날짜의 비용 ID 개수 확인
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][0] || '');
    if (id.startsWith('EXP-' + dateStr)) {
      count++;
    }
  }

  var paddedCount = String(count).padStart(3, '0');
  var expenseId = 'EXP-' + dateStr + '-' + paddedCount;

  Logger.log('[generateExpenseId] 생성: ' + expenseId);

  return expenseId;
}

/**
 * 청구서ID 생성 (INV-YYYYMMDD-001)
 * (cancelAndReissueInvoice에서 사용)
 */
function generateInvoiceId() {
  var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
  var sheet = ss.getSheetByName(INVOICE_SHEET_NAME);

  var today = new Date();
  var dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyyMMdd');

  var data = sheet.getDataRange().getValues();
  var count = 1;

  // 오늘 날짜의 청구서 ID 개수 확인
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][0] || '');
    if (id.startsWith('INV-' + dateStr)) {
      count++;
    }
  }

  var paddedCount = String(count).padStart(3, '0');
  var invoiceId = 'INV-' + dateStr + '-' + paddedCount;

  Logger.log('[generateInvoiceId] 생성: ' + invoiceId);

  return invoiceId;
}

/**
 * 소프트 삭제 처리 (공통)
 * @param {Sheet} sheet
 * @param {string} id
 * @param {string} idColumnName
 * @return {Object} { success, message, error }
 */
function softDeleteRecord(sheet, id, idColumnName) {
  try {
    var data = sheet.getDataRange().getValues();
    var header = data[0];

    var col = function(name) { return header.indexOf(name); };
    var cId = col(idColumnName);
    var cDeleted = col('삭제여부');
    var cDeletedAt = col('삭제일시');
    var cDeletedBy = col('삭제자');

    if (cId === -1 || cDeleted === -1) {
      return {
        success: false,
        error: '시트 구조가 올바르지 않습니다.'
      };
    }

    // 해당 행 찾기
    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][cId] === id) {
        rowIndex = i + 1; // 1-based
        break;
      }
    }

    if (rowIndex === -1) {
      return {
        success: false,
        error: '해당 기록을 찾을 수 없습니다.'
      };
    }

    // 소프트 삭제 처리
    var now = new Date();
    var user = Session.getActiveUser().getEmail();

    sheet.getRange(rowIndex, cDeleted + 1).setValue(true);

    if (cDeletedAt !== -1) {
      sheet.getRange(rowIndex, cDeletedAt + 1).setValue(now);
    }

    if (cDeletedBy !== -1) {
      sheet.getRange(rowIndex, cDeletedBy + 1).setValue(user);
    }

    Logger.log('[softDeleteRecord] ✅ 소프트 삭제: ' + id);

    return {
      success: true,
      message: '기록이 삭제되었습니다.'
    };

  } catch (error) {
    Logger.log('[softDeleteRecord] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '삭제 중 오류 발생: ' + error.message
    };
  }
}

/**
 * 날짜 포맷 함수
 */
function formatDateString(date) {
  if (!date) return '';
  if (typeof date === 'string') return date;

  var d = new Date(date);
  if (isNaN(d.getTime())) return '';

  var year = d.getFullYear();
  var month = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');

  return year + '-' + month + '-' + day;
}

// ============================================================
// 발주 연동 함수 (Payment-Order Sync)
// ============================================================

/**
 * 발주의 결제 상태 자동 계산
 * @param {string} orderId - 발주번호
 * @param {string} paymentType - '입금' 또는 '출금'
 * @return {string} '미결제' | '부분결제' | '결제완료'
 */
function calculatePaymentStatus(orderId, paymentType) {
  try {
    if (!orderId || !paymentType) {
      return '미결제';
    }

    // 1. 발주 정보 조회
    var orderResult = getOrderDetail(orderId);
    if (!orderResult.success || !orderResult.orderItems || orderResult.orderItems.length === 0) {
      Logger.log('[calculatePaymentStatus] 발주 없음: ' + orderId);
      return '미결제';
    }

    var order = orderResult.orderItems[0];
    var totalAmount = Number(order['확정금액']) || 0;

    if (totalAmount === 0) {
      Logger.log('[calculatePaymentStatus] 발주 금액 0: ' + orderId);
      return '미결제';
    }

    // 2. 해당 발주번호에 대한 모든 입출금 내역 조회
    var paymentsResult = getPaymentRecords({
      includeDeleted: false
    });

    if (!paymentsResult.success) {
      Logger.log('[calculatePaymentStatus] 입출금 조회 실패');
      return '미결제';
    }

    // 3. 해당 발주번호 + 결제유형에 맞는 결제 합계 계산
    var totalPaid = 0;
    var payments = paymentsResult.payments || [];

    for (var i = 0; i < payments.length; i++) {
      var payment = payments[i];
      if (payment.orderNumber === orderId && payment.type === paymentType) {
        totalPaid += Number(payment.amount) || 0;
      }
    }

    Logger.log('[calculatePaymentStatus] 발주: ' + orderId + ', 총액: ' + totalAmount + ', 결제액: ' + totalPaid);

    // 4. 상태 판단
    if (totalPaid === 0) {
      return '미결제';
    } else if (totalPaid < totalAmount) {
      return '부분결제';
    } else {
      return '결제완료';
    }

  } catch (error) {
    Logger.log('[calculatePaymentStatus] ❌ 오류: ' + error.message);
    return '미결제';
  }
}

/**
 * 입출금 내역과 발주DB 결제 상태 동기화
 * @param {string} orderNumber - 발주번호
 * @param {string} paymentType - '입금' 또는 '출금'
 * @return {Object} { success, message, error }
 */
function syncOrderPaymentStatus(orderNumber, paymentType) {
  try {
    if (!orderNumber || orderNumber === '') {
      return { success: true, message: '발주번호 없음 (동기화 불필요)' };
    }

    if (!paymentType || (paymentType !== '입금' && paymentType !== '출금')) {
      return {
        success: false,
        error: '결제유형이 올바르지 않습니다: ' + paymentType
      };
    }

    // 결제 상태 계산
    var status = calculatePaymentStatus(orderNumber, paymentType);

    // 발주DB 업데이트할 컬럼 결정
    var statusKey = paymentType === '입금' ? 'paySell' : 'payBuy';
    var statuses = {};
    statuses[statusKey] = status;

    // 발주 상태 업데이트
    var updateResult = updateOrderStatus(orderNumber, statuses);

    if (!updateResult.success) {
      Logger.log('[syncOrderPaymentStatus] ❌ 발주 상태 업데이트 실패: ' + updateResult.error);
      return {
        success: false,
        error: '발주 상태 업데이트 실패: ' + updateResult.error
      };
    }

    Logger.log('[syncOrderPaymentStatus] ✅ 발주 ' + orderNumber + ' - ' + statusKey + ': ' + status);

    return {
      success: true,
      message: '발주 상태 동기화 완료',
      orderNumber: orderNumber,
      statusKey: statusKey,
      status: status
    };

  } catch (error) {
    Logger.log('[syncOrderPaymentStatus] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '발주 동기화 중 오류: ' + error.message
    };
  }
}

// ============================================================
// 청구서 연동 기능 (결제 관리 리뉴얼)
// ============================================================

/**
 * 청구서 검색 (결제유형별 필터링)
 * @param {Object} params - { query, paymentType }
 * @return {Object} { success, invoices: [...] }
 */
function searchInvoices(params) {
  try {
    var query = String(params.query || '').toUpperCase();
    var paymentType = params.paymentType;  // '입금' or '출금'

    if (!paymentType) {
      return {
        success: false,
        error: '결제유형을 선택해주세요.'
      };
    }

    // 결제유형에 따라 청구서 타입 결정
    var invoiceType = paymentType === '입금' ? 'SALES' : 'PURCHASE';

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName(INVOICE_SHEET_NAME);

    if (!sheet) {
      return {
        success: false,
        error: '청구DB 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return {
        success: true,
        invoices: []
      };
    }

    var header = data[0];

    var col = function(name) { return header.indexOf(name); };
    var cInvoiceId = col('청구ID');
    var cType = col('청구유형');
    var cCompany = col('업체명');
    var cDate = col('청구일');
    var cAmount = col('청구금액');
    var cStatus = col('청구상태');
    var cOrderNumbers = col('orderNumbers');
    var cPaidAmount = col('결제완료금액');        // SPEC_01: 부분결제
    var cRemainingBalance = col('미수금');       // SPEC_01: 부분결제

    var invoices = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      // 청구서 타입 필터링
      if (row[cType] !== invoiceType) {
        continue;
      }

      // CANCELLED 제외
      if (row[cStatus] === 'CANCELLED') {
        continue;
      }

      // 검색어 매칭
      var invoiceId = String(row[cInvoiceId] || '');
      var company = String(row[cCompany] || '');

      if (query.length >= 3 &&
          invoiceId.toUpperCase().indexOf(query) === -1 &&
          company.toUpperCase().indexOf(query) === -1) {
        continue;
      }

      // orderNumbers에서 브랜드 목록 조회
      var orderNumbers = JSON.parse(row[cOrderNumbers] || '[]');
      var brands = getUniqueBrands(orderNumbers);

      // 부분결제 정보 계산
      var amount = Number(row[cAmount]) || 0;
      var paidAmount = (cPaidAmount !== -1) ? (Number(row[cPaidAmount]) || 0) : 0;
      var remainingBalance = (cRemainingBalance !== -1) ? (Number(row[cRemainingBalance]) || amount) : amount;

      invoices.push({
        invoiceId: invoiceId,
        type: row[cType],
        company: company,
        brands: brands.join(', '),
        date: formatDateString(row[cDate]),
        amount: amount,                           // 원래 청구금액
        paidAmount: paidAmount,                   // 기결제금액
        remainingBalance: remainingBalance,       // 미수금
        status: row[cStatus],
        orderCount: orderNumbers.length
      });

      if (invoices.length >= 10) break;
    }

    Logger.log('[searchInvoices] 검색 결과: ' + invoices.length + '건 (타입: ' + invoiceType + ')');

    return {
      success: true,
      invoices: invoices
    };

  } catch (error) {
    Logger.log('[searchInvoices] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '청구서 검색 중 오류: ' + error.message
    };
  }
}

/**
 * 발주번호 목록에서 고유 브랜드 추출
 * @param {Array} orderNumbers - 발주번호 배열
 * @return {Array} 브랜드 목록
 */
function getUniqueBrands(orderNumbers) {
  try {
    if (!orderNumbers || orderNumbers.length === 0) {
      return [];
    }

    var brands = [];
    var seen = {};

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName('거래원장');

    if (!sheet) {
      Logger.log('[getUniqueBrands] 경고: 거래원장 시트를 찾을 수 없습니다.');
      return [];
    }

    var data = sheet.getDataRange().getValues();
    var header = data[0];

    var colOrderNumber = header.indexOf('발주번호');
    var colBrand = header.indexOf('브랜드');

    if (colOrderNumber === -1 || colBrand === -1) {
      Logger.log('[getUniqueBrands] 경고: 필수 컬럼을 찾을 수 없습니다.');
      return [];
    }

    orderNumbers.forEach(function(orderId) {
      for (var i = 1; i < data.length; i++) {
        if (data[i][colOrderNumber] === orderId) {
          var brand = String(data[i][colBrand] || '').trim();
          if (brand && !seen[brand]) {
            brands.push(brand);
            seen[brand] = true;
          }
        }
      }
    });

    return brands;

  } catch (error) {
    Logger.log('[getUniqueBrands] ❌ 오류: ' + error.message);
    return [];
  }
}

/**
 * 청구서 상세 조회
 * @param {String} invoiceId - 청구서 ID
 * @return {Object} { success, invoice: {...} }
 */
function getInvoiceDetail(invoiceId) {
  try {
    if (!invoiceId) {
      return {
        success: false,
        error: '청구서 ID가 필요합니다.'
      };
    }

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName(INVOICE_SHEET_NAME);

    if (!sheet) {
      return {
        success: false,
        error: '청구DB 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();
    var header = data[0];

    var col = function(name) { return header.indexOf(name); };
    var cInvoiceId = col('청구ID');
    var cType = col('청구유형');
    var cCompany = col('업체명');
    var cDate = col('청구일');
    var cAmount = col('청구금액');
    var cStatus = col('청구상태');
    var cOrderNumbers = col('orderNumbers');
    var cBillingType = col('billingType');
    var cSettlementId = col('마감ID');
    var cNotes = col('비고');

    // 청구서 찾기
    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      if (row[cInvoiceId] === invoiceId) {
        var orderNumbers = JSON.parse(row[cOrderNumbers] || '[]');
        var orders = [];

        // 각 발주번호별 상세 정보 조회
        if (orderNumbers.length > 0) {
          orders = getOrdersDetailForInvoice(orderNumbers);
        }

        var invoice = {
          invoiceId: row[cInvoiceId],
          type: row[cType],
          company: row[cCompany],
          date: formatDateString(row[cDate]),
          amount: Number(row[cAmount]) || 0,
          status: row[cStatus],
          billingType: row[cBillingType] || 'DIRECT',
          settlementId: row[cSettlementId] || '',
          notes: row[cNotes] || '',
          orderNumbers: orderNumbers,
          orders: orders
        };

        Logger.log('[getInvoiceDetail] ✅ 청구서 조회 완료: ' + invoiceId);

        return {
          success: true,
          invoice: invoice
        };
      }
    }

    return {
      success: false,
      error: '청구서를 찾을 수 없습니다.'
    };

  } catch (error) {
    Logger.log('[getInvoiceDetail] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '청구서 조회 중 오류: ' + error.message
    };
  }
}

/**
 * 발주번호 목록에 대한 상세 정보 조회 (브랜드 단위)
 * @param {Array} orderNumbers - 발주번호 배열
 * @return {Array} 발주 상세 정보 배열
 */
function getOrdersDetailForInvoice(orderNumbers) {
  try {
    var orders = [];
    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName('거래원장');

    if (!sheet) {
      return [];
    }

    var data = sheet.getDataRange().getValues();
    var header = data[0];

    var col = function(name) { return header.indexOf(name); };
    var cOrderNumber = col('발주번호');
    var cOrderDate = col('발주일');
    var cBrand = col('브랜드');
    var cConfirmedQty = col('확정수량');
    var cSupplyPrice = col('공급가');

    // 발주번호별로 그룹핑 (브랜드 단위)
    var orderMap = {};

    orderNumbers.forEach(function(orderId) {
      for (var i = 1; i < data.length; i++) {
        var row = data[i];

        if (row[cOrderNumber] === orderId) {
          if (!orderMap[orderId]) {
            orderMap[orderId] = {
              orderNumber: orderId,
              orderDate: formatDateString(row[cOrderDate]),
              brands: [],
              totalAmount: 0
            };
          }

          var brand = String(row[cBrand] || '').trim();
          var confirmedQty = Number(row[cConfirmedQty]) || 0;
          var supplyPrice = Number(row[cSupplyPrice]) || 0;
          var amount = confirmedQty * supplyPrice;

          if (brand && orderMap[orderId].brands.indexOf(brand) === -1) {
            orderMap[orderId].brands.push(brand);
          }

          orderMap[orderId].totalAmount += amount;
        }
      }
    });

    // 배열로 변환
    for (var orderId in orderMap) {
      var order = orderMap[orderId];
      orders.push({
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        brand: order.brands.join(', '),
        amount: order.totalAmount
      });
    }

    return orders;

  } catch (error) {
    Logger.log('[getOrdersDetailForInvoice] ❌ 오류: ' + error.message);
    return [];
  }
}

/**
 * 임시 청구서 생성
 * @param {Object} params - { company, paymentType, amount, date }
 * @return {Object} { success, invoiceId, invoiceType }
 */
function createTempInvoice(params) {
  try {
    var company = params.company || '';
    var paymentType = params.paymentType;  // '입금' or '출금'
    var amount = params.amount || 0;
    var date = params.date || new Date();

    if (!company || !paymentType || !amount) {
      return {
        success: false,
        error: '필수 정보를 입력해주세요.'
      };
    }

    // 결제유형에 따라 청구서 타입 자동 결정
    var invoiceType = paymentType === '입금' ? 'SALES' : 'PURCHASE';

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName(INVOICE_SHEET_NAME);

    if (!sheet) {
      return {
        success: false,
        error: '청구DB 시트를 찾을 수 없습니다.'
      };
    }

    // 임시 청구서 ID 생성
    var now = new Date();
    var dateStr = formatYearMonth(now) + String(now.getDate()).padStart(2, '0');
    var data = sheet.getDataRange().getValues();
    var seq = 1;

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && String(data[i][0]).startsWith('INV-TEMP-' + dateStr)) {
        seq++;
      }
    }

    var invoiceId = 'INV-TEMP-' + dateStr + '-' + String(seq).padStart(3, '0');

    var user = Session.getActiveUser().getEmail();

    // 청구DB 구조에 맞게 데이터 구성
    var header = data[0];
    var rowData = [];

    // 각 컬럼 순서대로 값 설정
    header.forEach(function(colName) {
      switch(colName) {
        case '청구ID':
          rowData.push(invoiceId);
          break;
        case '청구유형':
          rowData.push(invoiceType);
          break;
        case '업체명':
          rowData.push(company);
          break;
        case '마감ID':
          rowData.push('');
          break;
        case '청구일':
          rowData.push(date);
          break;
        case '청구금액':
          rowData.push(amount);
          break;
        case '청구상태':
          rowData.push('DRAFT');
          break;
        case '비고':
          rowData.push('임시 생성 (정식 청구서 발행 예정)');
          break;
        case '생성일시':
          rowData.push(now);
          break;
        case '생성자':
          rowData.push(user);
          break;
        case '발행일시':
          rowData.push('');
          break;
        case '발행자':
          rowData.push('');
          break;
        case '결제일시':
          rowData.push('');
          break;
        case '대체청구서':
          rowData.push('');
          break;
        case '원본청구서':
          rowData.push('');
          break;
        case 'billingType':
          rowData.push('DIRECT');
          break;
        case 'orderNumbers':
          rowData.push('[]');
          break;
        default:
          rowData.push('');
      }
    });

    sheet.appendRow(rowData);

    Logger.log('[createTempInvoice] ✅ 임시 청구서 생성: ' + invoiceId + ' (' + invoiceType + ')');

    return {
      success: true,
      invoiceId: invoiceId,
      invoiceType: invoiceType,
      message: '임시 청구서가 생성되었습니다.'
    };

  } catch (error) {
    Logger.log('[createTempInvoice] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '임시 청구서 생성 중 오류: ' + error.message
    };
  }
}

/**
 * 청구서 상태 검증 (결제 입력 가능 여부)
 * @param {Object} invoice - 청구서 객체
 * @return {Object} { valid, error, warning }
 */
function validateInvoiceForPayment(invoice) {
  try {
    if (!invoice || !invoice.status) {
      return {
        valid: false,
        error: '청구서 정보가 올바르지 않습니다.'
      };
    }

    switch(invoice.status) {
      case 'CANCELLED':
        return {
          valid: false,
          error: '❌ 취소된 청구서입니다.\n다른 청구서를 선택해주세요.'
        };

      case 'PAID':
        return {
          valid: false,
          error: '❌ 이미 결제 완료된 청구서입니다.\n추가 결제가 필요한 경우 새 청구서를 발행해주세요.'
        };

      case 'DRAFT':
        return {
          valid: true,
          warning: '⚠️ 미발행 청구서입니다.\n청구서 발행 후 결제 입력을 권장합니다.'
        };

      case 'ISSUED':
        return {
          valid: true
        };

      default:
        return {
          valid: true
        };
    }

  } catch (error) {
    Logger.log('[validateInvoiceForPayment] ❌ 오류: ' + error.message);
    return {
      valid: false,
      error: '청구서 검증 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 다중 청구서 결제 저장
 * @param {Object} params - { date, type, company, amount, method, docNumbers, notes }
 * @return {Object} { success, paymentId, invoiceIds }
 */
function saveMultiplePayment(params) {
  try {
    var date = params.date || new Date();
    var type = params.type;  // '입금' or '출금'
    var company = params.company || '';
    var amount = Number(params.amount) || 0;
    var method = params.method || '계좌이체';
    var docNumbers = params.docNumbers || [];  // 청구서 ID 배열
    var notes = params.notes || '';

    if (!type || !company || !amount || docNumbers.length === 0) {
      return {
        success: false,
        error: '필수 정보를 입력해주세요.'
      };
    }

    Logger.log('[saveMultiplePayment] 다중 청구서 결제 저장 시작: ' + docNumbers.length + '건');

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);

    // 결제내역 시트
    var paymentSheet = ss.getSheetByName(PAYMENT_SHEET_NAME);
    if (!paymentSheet) {
      return {
        success: false,
        error: '결제내역 시트를 찾을 수 없습니다.'
      };
    }

    // 청구DB 시트
    var invoiceSheet = ss.getSheetByName(INVOICE_SHEET_NAME);
    if (!invoiceSheet) {
      return {
        success: false,
        error: '청구DB 시트를 찾을 수 없습니다.'
      };
    }

    // 결제ID 생성
    var now = new Date();
    var paymentId = generatePaymentId();

    var user = Session.getActiveUser().getEmail();

    // 결제내역 헤더
    var paymentData = paymentSheet.getDataRange().getValues();
    var paymentHeader = paymentData[0];

    // 동적으로 헤더 인덱스 찾기
    var colMap = {};
    paymentHeader.forEach(function(h, idx) {
      colMap[h] = idx;
    });

    // 결제내역 행 데이터 생성
    var paymentRow = [];
    paymentHeader.forEach(function(h) {
      switch(h) {
        case '결제ID':
          paymentRow.push(paymentId);
          break;
        case '결제일':
          paymentRow.push(date);
          break;
        case '결제유형':
          paymentRow.push(type);
          break;
        case '거래처명':
          paymentRow.push(company);
          break;
        case '금액':
          paymentRow.push(amount);
          break;
        case '결제수단':
          paymentRow.push(method);
          break;
        case '문서번호':
          // JSON 배열로 저장
          paymentRow.push(JSON.stringify(docNumbers));
          break;
        case '발주번호':
          paymentRow.push('');  // 다중 청구서 결제는 특정 발주번호 없음
          break;
        case '비고':
          paymentRow.push(notes);
          break;
        case '삭제여부':
          paymentRow.push(false);  // boolean false (기존 방식과 동일)
          break;
        case '삭제일시':
          paymentRow.push('');
          break;
        case '삭제자':
          paymentRow.push('');
          break;
        case '입력일시':
          paymentRow.push(now);
          break;
        case '입력자':
          paymentRow.push(user);
          break;
        default:
          paymentRow.push('');
          break;
      }
    });

    // 결제내역 추가 - A열(결제ID)에서 실제 데이터가 있는 마지막 행 찾기
    var lastRow = paymentSheet.getLastRow();
    var idColumn = paymentSheet.getRange(1, 1, lastRow, 1).getValues(); // A열만 읽기

    var lastDataRow = 1; // 헤더 행
    for (var i = idColumn.length - 1; i > 0; i--) {
      if (idColumn[i][0] && idColumn[i][0] !== '') {
        lastDataRow = i + 1;
        break;
      }
    }

    var nextRow = lastDataRow + 1;
    paymentSheet.getRange(nextRow, 1, 1, paymentRow.length).setValues([paymentRow]);
    Logger.log('[saveMultiplePayment] ✅ 결제내역 저장 완료 (' + nextRow + '행): ' + paymentId);

    // ========================================
    // 부분 결제 지원 로직 (SPEC_01)
    // ========================================

    var invoiceData = invoiceSheet.getDataRange().getValues();
    var invoiceHeader = invoiceData[0];

    var colInvoiceId = invoiceHeader.indexOf('청구ID');
    var colStatus = invoiceHeader.indexOf('청구상태');
    var colAmount = invoiceHeader.indexOf('청구금액');
    var colPaidAmount = invoiceHeader.indexOf('결제완료금액');
    var colRemainingBalance = invoiceHeader.indexOf('미수금');
    var colLastPaymentDate = invoiceHeader.indexOf('최종결제일');

    if (colInvoiceId === -1 || colStatus === -1 || colAmount === -1) {
      Logger.log('[saveMultiplePayment] ⚠️ 청구DB 필수 컬럼 찾기 실패');
      return {
        success: true,
        paymentId: paymentId,
        warning: '결제는 저장되었으나 청구서 상태 업데이트 실패'
      };
    }

    // 부분 결제 컬럼이 없으면 경고만 출력하고 기존 방식으로 동작
    var supportsPartialPayment = (colPaidAmount !== -1 && colRemainingBalance !== -1 && colLastPaymentDate !== -1);
    if (!supportsPartialPayment) {
      Logger.log('[saveMultiplePayment] ⚠️ 부분 결제 컬럼 없음 - 기존 방식으로 동작 (모두 PAID 처리)');
    }

    // 1. 청구서 정보 수집 및 검증
    var invoices = [];
    var totalInvoiceAmount = 0;
    var totalRemainingAmount = 0;

    for (var i = 1; i < invoiceData.length; i++) {
      var row = invoiceData[i];
      var invoiceId = row[colInvoiceId];

      if (docNumbers.indexOf(invoiceId) !== -1) {
        var 청구금액 = Number(row[colAmount]) || 0;
        var 현재결제완료금액 = supportsPartialPayment ? (Number(row[colPaidAmount]) || 0) : 0;
        var 현재미수금 = supportsPartialPayment ? (Number(row[colRemainingBalance]) || 청구금액) : 청구금액;

        invoices.push({
          invoiceId: invoiceId,
          rowIndex: i + 1,
          청구금액: 청구금액,
          현재결제완료금액: 현재결제완료금액,
          현재미수금: 현재미수금,
          현재상태: row[colStatus]
        });

        totalInvoiceAmount += 청구금액;
        totalRemainingAmount += 현재미수금;

        Logger.log('[saveMultiplePayment] 📋 청구서 ' + invoiceId + ': 청구 ' + 청구금액.toLocaleString() + '원, 미수금 ' + 현재미수금.toLocaleString() + '원');
      }
    }

    if (invoices.length === 0) {
      Logger.log('[saveMultiplePayment] ⚠️ 대상 청구서를 찾을 수 없습니다.');
      return {
        success: false,
        error: '대상 청구서를 찾을 수 없습니다.'
      };
    }

    Logger.log('[saveMultiplePayment] 💰 총 미수금: ' + totalRemainingAmount.toLocaleString() + '원');
    Logger.log('[saveMultiplePayment] 💳 결제 금액: ' + amount.toLocaleString() + '원');

    // 2. 금액 검증
    if (amount > totalRemainingAmount) {
      Logger.log('[saveMultiplePayment] ❌ 결제 금액이 미수금을 초과합니다.');
      return {
        success: false,
        error: '결제 금액(' + amount.toLocaleString() + '원)이 총 미수금(' + totalRemainingAmount.toLocaleString() + '원)을 초과할 수 없습니다.'
      };
    }

    // 3. 결제 금액 분배 (청구서별로 비례 배분)
    var remainingPayment = amount;
    var updatedCount = 0;
    var fullyPaidCount = 0;
    var partiallyPaidCount = 0;

    for (var j = 0; j < invoices.length; j++) {
      var invoice = invoices[j];

      if (remainingPayment <= 0) {
        break;
      }

      // 이 청구서에 배분할 금액 계산 (미수금과 남은 결제액 중 작은 값)
      var 배분금액 = Math.min(invoice.현재미수금, remainingPayment);

      if (배분금액 > 0) {
        var 신규결제완료금액 = invoice.현재결제완료금액 + 배분금액;
        var 신규미수금 = invoice.청구금액 - 신규결제완료금액;
        var 신규상태 = (신규미수금 === 0) ? 'PAID' : 'PAID_PARTIAL';

        Logger.log('[saveMultiplePayment] 📝 청구서 ' + invoice.invoiceId + ' 업데이트:');
        Logger.log('   - 배분 금액: ' + 배분금액.toLocaleString() + '원');
        Logger.log('   - 신규 결제완료금액: ' + 신규결제완료금액.toLocaleString() + '원');
        Logger.log('   - 신규 미수금: ' + 신규미수금.toLocaleString() + '원');
        Logger.log('   - 신규 상태: ' + 신규상태);

        // 청구서 업데이트
        invoiceSheet.getRange(invoice.rowIndex, colStatus + 1).setValue(신규상태);

        if (supportsPartialPayment) {
          invoiceSheet.getRange(invoice.rowIndex, colPaidAmount + 1).setValue(신규결제완료금액);
          invoiceSheet.getRange(invoice.rowIndex, colRemainingBalance + 1).setValue(신규미수금);
          invoiceSheet.getRange(invoice.rowIndex, colLastPaymentDate + 1).setValue(date);
        }

        // 거래원장 업데이트
        var ledgerStatus = (신규상태 === 'PAID') ? '결제완료' : '부분결제';
        var ledgerUpdateResult = updateLedgerPaymentStatus(invoice.invoiceId, type, ledgerStatus);
        if (ledgerUpdateResult.success) {
          Logger.log('[saveMultiplePayment] ✅ 거래원장 업데이트: ' + invoice.invoiceId + ' → ' + ledgerStatus);
        } else {
          Logger.log('[saveMultiplePayment] ⚠️ 거래원장 업데이트 실패: ' + ledgerUpdateResult.error);
        }

        remainingPayment -= 배분금액;
        updatedCount++;

        if (신규상태 === 'PAID') {
          fullyPaidCount++;
        } else {
          partiallyPaidCount++;
        }
      }
    }

    Logger.log('[saveMultiplePayment] ✅ 완료: 결제 1건, 청구서 ' + updatedCount + '건 업데이트');
    Logger.log('[saveMultiplePayment]    - 완납: ' + fullyPaidCount + '건');
    Logger.log('[saveMultiplePayment]    - 부분결제: ' + partiallyPaidCount + '건');

    var resultMessage = '결제가 저장되었습니다. ';
    if (fullyPaidCount > 0) {
      resultMessage += fullyPaidCount + '건 완납';
    }
    if (partiallyPaidCount > 0) {
      if (fullyPaidCount > 0) resultMessage += ', ';
      resultMessage += partiallyPaidCount + '건 부분결제';
    }

    return {
      success: true,
      paymentId: paymentId,
      invoiceIds: docNumbers,
      updatedCount: updatedCount,
      fullyPaidCount: fullyPaidCount,
      partiallyPaidCount: partiallyPaidCount,
      message: resultMessage
    };

  } catch (error) {
    Logger.log('[saveMultiplePayment] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '결제 저장 중 오류: ' + error.message
    };
  }
}
