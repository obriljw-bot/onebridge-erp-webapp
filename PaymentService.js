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

    // 시트에 추가 - 실제 데이터가 있는 마지막 행 다음에 삽입
    var lastDataRow = 1; // 헤더 행
    var allData = sheet.getDataRange().getValues();

    // 역순으로 검색하여 결제ID가 있는 마지막 행 찾기
    for (var i = allData.length - 1; i > 0; i--) {
      if (allData[i][0] && allData[i][0] !== '') { // 결제ID 컬럼 (첫 번째 컬럼)
        lastDataRow = i + 1; // 배열 인덱스는 0부터, 행 번호는 1부터
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
      results.push({
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
        inputDate: formatDateString(row[cInputDate]),
        inputUser: row[cInputUser]
      });
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
    var sheet = ss.getSheetByName(PAYMENT_SHEET_NAME);

    if (!sheet) {
      return {
        success: false,
        error: '결제내역 시트를 찾을 수 없습니다.'
      };
    }

    var result = softDeleteRecord(sheet, params.paymentId, '결제ID');

    if (result.success) {
      Logger.log('[deletePaymentRecord] ✅ 입출금 삭제: ' + params.paymentId);
    }

    return result;

  } catch (error) {
    Logger.log('[deletePaymentRecord] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '입출금 삭제 중 오류 발생: ' + error.message
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
