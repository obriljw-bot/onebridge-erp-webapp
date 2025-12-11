/**
 * ============================================================
 * TransactionService.js - 거래 원장 관리 비즈니스 로직
 * ============================================================
 * 발주, 확정수량 수정, 금액 자동 재계산, 상태 관리
 * ============================================================
 */

// ====== 스프레드시트 ID / 시트명 상수 ======
var OB_TRANSACTION_SS_ID = '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs'; // 발주_통합DB
var OB_TRANSACTION_LEDGER_SHEET = '거래원장';

/**
 * ============================================================
 * 1. 확정수량 업데이트 및 금액 자동 재계산
 * ============================================================
 */

/**
 * 확정수량 업데이트 및 관련 금액 자동 재계산
 * @param {Object} params - { updates: [{ rowIndex, confirmedQty }] }
 * @returns {Object} 업데이트 결과
 */
function updateConfirmedQuantities(params) {
  try {
    var updates = params.updates || [];

    if (!updates || updates.length === 0) {
      return {
        success: false,
        error: '업데이트할 데이터가 없습니다.'
      };
    }

    Logger.log('[updateConfirmedQuantities] 업데이트 시작: ' + updates.length + '건');

    var ss = SpreadsheetApp.openById(OB_TRANSACTION_SS_ID);
    var sheet = ss.getSheetByName(OB_TRANSACTION_LEDGER_SHEET);

    if (!sheet) {
      return {
        success: false,
        error: '거래원장 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();
    var header = data[0];

    // 컬럼 인덱스 찾기
    var colConfirmedQty = header.indexOf('확정수량');
    var colBuyPrice = header.indexOf('매입가');
    var colSupplyPrice = header.indexOf('공급가');
    var colPurchaseAmount = header.indexOf('매입액');
    var colSupplyAmount = header.indexOf('공급액');
    var colMarginAmount = header.indexOf('마진액');
    var colMarginRate = header.indexOf('마진율');

    if (colConfirmedQty === -1) {
      return {
        success: false,
        error: '확정수량 컬럼을 찾을 수 없습니다.'
      };
    }

    var updatedCount = 0;
    var errors = [];

    // 각 업데이트 처리
    for (var i = 0; i < updates.length; i++) {
      var update = updates[i];
      var rowIndex = update.rowIndex; // 시트 행 번호 (1-based)
      var confirmedQty = Number(update.confirmedQty) || 0;

      if (!rowIndex || rowIndex < 2) {
        errors.push('유효하지 않은 행 번호: ' + rowIndex);
        continue;
      }

      if (confirmedQty < 0) {
        errors.push('행 ' + rowIndex + ': 확정수량은 0 이상이어야 합니다.');
        continue;
      }

      try {
        // 현재 행 데이터 읽기
        var rowData = sheet.getRange(rowIndex, 1, 1, header.length).getValues()[0];

        var buyPrice = Number(rowData[colBuyPrice]) || 0;
        var supplyPrice = Number(rowData[colSupplyPrice]) || 0;

        // 금액 재계산
        var purchaseAmount = confirmedQty * buyPrice;
        var supplyAmount = confirmedQty * supplyPrice;
        var marginAmount = supplyAmount - purchaseAmount;
        var marginRate = purchaseAmount > 0 ? (marginAmount / purchaseAmount) * 100 : 0;

        // 확정수량 업데이트
        sheet.getRange(rowIndex, colConfirmedQty + 1).setValue(confirmedQty);

        // 파생 금액 업데이트
        if (colPurchaseAmount !== -1) {
          sheet.getRange(rowIndex, colPurchaseAmount + 1).setValue(purchaseAmount);
        }
        if (colSupplyAmount !== -1) {
          sheet.getRange(rowIndex, colSupplyAmount + 1).setValue(supplyAmount);
        }
        if (colMarginAmount !== -1) {
          sheet.getRange(rowIndex, colMarginAmount + 1).setValue(marginAmount);
        }
        if (colMarginRate !== -1) {
          sheet.getRange(rowIndex, colMarginRate + 1).setValue(marginRate);
        }

        updatedCount++;
        Logger.log('[updateConfirmedQuantities] 행 ' + rowIndex + ': 확정수량=' + confirmedQty +
                   ', 매입액=' + purchaseAmount + ', 공급액=' + supplyAmount);

      } catch (rowErr) {
        errors.push('행 ' + rowIndex + ' 처리 오류: ' + rowErr.message);
        Logger.log('[updateConfirmedQuantities Error] 행 ' + rowIndex + ': ' + rowErr.message);
      }
    }

    var result = {
      success: true,
      updatedCount: updatedCount,
      totalCount: updates.length,
      message: updatedCount + '건 업데이트 완료'
    };

    if (errors.length > 0) {
      result.errors = errors;
      result.message += ' (' + errors.length + '건 실패)';
    }

    return result;

  } catch (err) {
    Logger.log('[updateConfirmedQuantities Error] ' + err.message);
    return {
      success: false,
      error: '확정수량 업데이트 중 오류 발생: ' + err.message
    };
  }
}

/**
 * ============================================================
 * 2. 발주 상태 관리
 * ============================================================
 */

/**
 * 발주 상태 업데이트
 * @param {Object} params - { rowIndex, state }
 * @returns {Object} 업데이트 결과
 */
function updateTransactionState(params) {
  try {
    var rowIndex = params.rowIndex;
    var state = params.state;

    if (!rowIndex || !state) {
      return {
        success: false,
        error: '행 번호와 상태를 입력해주세요.'
      };
    }

    var ss = SpreadsheetApp.openById(OB_TRANSACTION_SS_ID);
    var sheet = ss.getSheetByName(OB_TRANSACTION_LEDGER_SHEET);

    if (!sheet) {
      return {
        success: false,
        error: '거래원장 시트를 찾을 수 없습니다.'
      };
    }

    var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var colState = header.indexOf('상태');

    if (colState === -1) {
      return {
        success: false,
        error: '상태 컬럼을 찾을 수 없습니다.'
      };
    }

    // 상태 업데이트
    sheet.getRange(rowIndex, colState + 1).setValue(state);

    Logger.log('[updateTransactionState] 행 ' + rowIndex + ': 상태=' + state);

    return {
      success: true,
      message: '상태가 업데이트되었습니다.'
    };

  } catch (err) {
    Logger.log('[updateTransactionState Error] ' + err.message);
    return {
      success: false,
      error: '상태 업데이트 중 오류 발생: ' + err.message
    };
  }
}

/**
 * ============================================================
 * 3. 거래 조회
 * ============================================================
 */

/**
 * 거래원장 데이터 조회
 * @param {Object} params - { filter, orderCode, startDate, endDate }
 * @returns {Object} 조회 결과
 */
function getTransactions(params) {
  try {
    params = params || {};

    var ss = SpreadsheetApp.openById(OB_TRANSACTION_SS_ID);
    var sheet = ss.getSheetByName(OB_TRANSACTION_LEDGER_SHEET);

    if (!sheet) {
      return {
        success: false,
        error: '거래원장 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return {
        success: true,
        transactions: [],
        total: 0
      };
    }

    var header = data[0];
    var rows = data.slice(1);

    // 배열을 객체로 변환
    var transactions = rows.map(function(row, idx) {
      var obj = { _rowIndex: idx + 2 }; // 시트 행 번호
      header.forEach(function(col, colIdx) {
        obj[col] = row[colIdx];
      });
      return obj;
    });

    // 필터링 (필요시 추가)
    if (params.orderCode) {
      transactions = transactions.filter(function(t) {
        return String(t['발주번호']).indexOf(params.orderCode) >= 0;
      });
    }

    return {
      success: true,
      transactions: transactions,
      total: transactions.length
    };

  } catch (err) {
    Logger.log('[getTransactions Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}
