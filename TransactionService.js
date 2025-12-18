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
 * @param {Object} params - { updates: [{ orderNumber, itemCode, confirmedQty }] }
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
    var colOrderNum = header.indexOf('발주번호');
    var colItemCode = header.indexOf('품목코드');
    var colConfirmedQty = header.indexOf('확정수량');
    var colBuyPrice = header.indexOf('매입가');
    var colSupplyPrice = header.indexOf('공급가');
    var colPurchaseAmount = header.indexOf('매입액');
    var colSupplyAmount = header.indexOf('공급액');
    var colMarginAmount = header.indexOf('마진액');
    var colMarginRate = header.indexOf('마진율');

    if (colOrderNum === -1 || colItemCode === -1 || colConfirmedQty === -1) {
      return {
        success: false,
        error: '필수 컬럼을 찾을 수 없습니다. (발주번호, 품목코드, 확정수량)'
      };
    }

    var updatedCount = 0;
    var errors = [];

    // 각 업데이트 처리
    for (var i = 0; i < updates.length; i++) {
      var update = updates[i];
      var orderNumber = update.orderNumber;
      var itemCode = update.itemCode;
      var confirmedQty = Number(update.confirmedQty) || 0;

      if (!orderNumber || !itemCode) {
        errors.push((i + 1) + '번째 항목: 발주번호와 품목코드가 필요합니다.');
        continue;
      }

      if (confirmedQty < 0) {
        errors.push(orderNumber + '/' + itemCode + ': 확정수량은 0 이상이어야 합니다.');
        continue;
      }

      try {
        // 발주번호 + 품목코드로 정확한 행 찾기
        var rowIndex = null;
        var matchCount = 0;

        for (var j = 1; j < data.length; j++) {
          if (data[j][colOrderNum] === orderNumber && data[j][colItemCode] === itemCode) {
            rowIndex = j + 1; // 1-based
            matchCount++;
          }
        }

        // 안전성 검증: 정확히 1개만 매칭되어야 함
        if (matchCount === 0) {
          errors.push(orderNumber + '/' + itemCode + ': 해당하는 데이터를 찾을 수 없습니다.');
          Logger.log('[updateConfirmedQuantities] NOT FOUND: ' + orderNumber + '/' + itemCode);
          continue;
        }

        if (matchCount > 1) {
          errors.push(orderNumber + '/' + itemCode + ': 중복된 데이터가 ' + matchCount + '건 존재합니다. 데이터 정합성 오류.');
          Logger.log('[updateConfirmedQuantities] DUPLICATE: ' + orderNumber + '/' + itemCode + ' (' + matchCount + '건)');
          continue;
        }

        // 현재 행 데이터 읽기
        var rowData = sheet.getRange(rowIndex, 1, 1, header.length).getValues()[0];

        var buyPrice = Number(rowData[colBuyPrice]) || 0;
        var supplyPrice = Number(rowData[colSupplyPrice]) || 0;

        // 금액 재계산
        var purchaseAmount = confirmedQty * buyPrice;
        var supplyAmount = confirmedQty * supplyPrice;
        var marginAmount = supplyAmount - purchaseAmount;
        var marginRate = supplyAmount > 0 ? (marginAmount / supplyAmount) * 100 : 0;

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
        Logger.log('[updateConfirmedQuantities] 성공: ' + orderNumber + '/' + itemCode +
                   ' (행 ' + rowIndex + ') 확정수량=' + confirmedQty +
                   ', 매입액=' + purchaseAmount + ', 공급액=' + supplyAmount);

      } catch (rowErr) {
        errors.push(orderNumber + '/' + itemCode + ' 처리 오류: ' + rowErr.message);
        Logger.log('[updateConfirmedQuantities Error] ' + orderNumber + '/' + itemCode + ': ' + rowErr.message);
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
 * 발주 상태 업데이트 (4개 상태 컬럼 - 단일 발주)
 * @param {String} orderId - 발주번호
 * @param {Object} statuses - { buyOrder, payBuy, paySell, ship }
 * @returns {Object} 업데이트 결과
 */
function updateOrderStatus(orderId, statuses) {
  try {
    if (!orderId) {
      return {
        success: false,
        error: '발주번호가 필요합니다.'
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

    var data = sheet.getDataRange().getValues();
    var header = data[0];

    // 컬럼 인덱스 찾기
    var colOrderNum = header.indexOf('발주번호');
    var colBuyOrder = header.indexOf('매입발주');
    var colPayBuy = header.indexOf('매입결제');
    var colPaySell = header.indexOf('매출결제');
    var colShip = header.indexOf('출고');

    if (colOrderNum === -1) {
      return {
        success: false,
        error: '발주번호 컬럼을 찾을 수 없습니다.'
      };
    }

    // 발주번호에 해당하는 모든 행 찾기 및 업데이트
    var updatedCount = 0;
    for (var i = 1; i < data.length; i++) {
      if (data[i][colOrderNum] === orderId) {
        var rowIndex = i + 1; // 1-based

        // 상태 업데이트 (값이 있는 것만)
        if (statuses.buyOrder && colBuyOrder !== -1) {
          sheet.getRange(rowIndex, colBuyOrder + 1).setValue(statuses.buyOrder);
        }
        if (statuses.payBuy && colPayBuy !== -1) {
          sheet.getRange(rowIndex, colPayBuy + 1).setValue(statuses.payBuy);
        }
        if (statuses.paySell && colPaySell !== -1) {
          sheet.getRange(rowIndex, colPaySell + 1).setValue(statuses.paySell);
        }
        if (statuses.ship && colShip !== -1) {
          sheet.getRange(rowIndex, colShip + 1).setValue(statuses.ship);
        }

        updatedCount++;
      }
    }

    if (updatedCount === 0) {
      return {
        success: false,
        error: '발주번호 ' + orderId + '에 해당하는 데이터를 찾을 수 없습니다.'
      };
    }

    Logger.log('[updateOrderStatus] 발주번호 ' + orderId + ': ' + updatedCount + '건 업데이트');

    return {
      success: true,
      updatedCount: updatedCount,
      message: updatedCount + '건 업데이트 완료'
    };

  } catch (err) {
    Logger.log('[updateOrderStatus Error] ' + err.message);
    return {
      success: false,
      error: '상태 업데이트 중 오류 발생: ' + err.message
    };
  }
}

/**
 * 발주 상태 일괄 업데이트 (여러 발주)
 * @param {Object} params - { orderNumbers: [], statuses: { buyOrder, payBuy, paySell, ship } }
 * @returns {Object} 업데이트 결과
 */
function updateBulkOrderStatus(params) {
  try {
    var orderNumbers = params.orderNumbers || [];
    var statuses = params.statuses || {};

    if (!orderNumbers || orderNumbers.length === 0) {
      return {
        success: false,
        error: '발주번호 목록이 필요합니다.'
      };
    }

    // 변경할 상태가 하나라도 있는지 확인
    var hasChange = statuses.buyOrder || statuses.payBuy || statuses.paySell || statuses.ship;
    if (!hasChange) {
      return {
        success: false,
        error: '변경할 상태를 하나 이상 선택해주세요.'
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

    var data = sheet.getDataRange().getValues();
    var header = data[0];

    // 컬럼 인덱스 찾기
    var colOrderNum = header.indexOf('발주번호');
    var colBuyOrder = header.indexOf('매입발주');
    var colPayBuy = header.indexOf('매입결제');
    var colPaySell = header.indexOf('매출결제');
    var colShip = header.indexOf('출고');

    if (colOrderNum === -1) {
      return {
        success: false,
        error: '발주번호 컬럼을 찾을 수 없습니다.'
      };
    }

    Logger.log('[updateBulkOrderStatus] 시작: ' + orderNumbers.length + '개 발주');

    // orderNumbers를 Set으로 변환 (빠른 검색)
    var orderSet = {};
    orderNumbers.forEach(function(num) {
      orderSet[num] = true;
    });

    // 일괄 업데이트할 데이터 수집
    var updates = [];
    for (var i = 1; i < data.length; i++) {
      var orderNum = data[i][colOrderNum];
      if (orderSet[orderNum]) {
        var rowIndex = i + 1; // 1-based

        if (statuses.buyOrder && colBuyOrder !== -1) {
          updates.push({ row: rowIndex, col: colBuyOrder + 1, value: statuses.buyOrder });
        }
        if (statuses.payBuy && colPayBuy !== -1) {
          updates.push({ row: rowIndex, col: colPayBuy + 1, value: statuses.payBuy });
        }
        if (statuses.paySell && colPaySell !== -1) {
          updates.push({ row: rowIndex, col: colPaySell + 1, value: statuses.paySell });
        }
        if (statuses.ship && colShip !== -1) {
          updates.push({ row: rowIndex, col: colShip + 1, value: statuses.ship });
        }
      }
    }

    // 일괄 업데이트 실행
    updates.forEach(function(update) {
      sheet.getRange(update.row, update.col).setValue(update.value);
    });

    var affectedOrders = orderNumbers.length;
    var totalUpdates = updates.length;

    Logger.log('[updateBulkOrderStatus] 완료: ' + affectedOrders + '개 발주, ' + totalUpdates + '개 셀 업데이트');

    return {
      success: true,
      affectedOrders: affectedOrders,
      totalUpdates: totalUpdates,
      message: affectedOrders + '개 발주의 상태가 업데이트되었습니다.'
    };

  } catch (err) {
    Logger.log('[updateBulkOrderStatus Error] ' + err.message);
    return {
      success: false,
      error: '일괄 상태 업데이트 중 오류 발생: ' + err.message
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
