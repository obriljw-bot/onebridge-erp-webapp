/**
 * ============================================================
 * AdjustmentService.gs - 조정 관리 서비스 (v2.2 NEW!)
 * ============================================================
 * 마감 후 발생한 모든 변동을 원본 수정 없이 관리하는 핵심 서비스
 *
 * 조정 유형:
 * - RETURN: 반품
 * - DAMAGE: 파손
 * - PRICE_ADJUSTMENT: 가격 조정
 * - QUANTITY_ADJUSTMENT: 수량 조정
 * ============================================================
 */

// ====== 스프레드시트 ID / 시트명 상수 ======
const OB_ADJUSTMENT_SS_ID = '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs'; // 발주_통합DB
const OB_ADJUSTMENT_SHEET = '조정DB';

/**
 * ============================================================
 * 조정DB 스키마
 * ============================================================
 * | 조정ID | 조정유형 | 원거래ID | 품목코드 | 조정수량 | 조정금액 |
 * | 사유 | 생성일시 | 생성자 | 승인상태 | 승인일시 | 승인자 |
 * ============================================================
 */

/**
 * ============================================================
 * 1. 반품 조정 생성
 * ============================================================
 */

/**
 * 반품 조정 생성
 * @param {Object} params - { orderCode, itemCode, returnQty, reason }
 * @returns {Object} 생성 결과
 */
function createReturnAdjustment(params) {
  try {
    var orderCode = params.orderCode || '';
    var itemCode = params.itemCode || '';
    var returnQty = params.returnQty || 0;
    var reason = params.reason || '';

    if (!orderCode || !itemCode) {
      return {
        success: false,
        error: '발주번호와 품목코드를 입력해주세요.'
      };
    }

    if (!returnQty || returnQty <= 0) {
      return {
        success: false,
        error: '반품 수량을 입력해주세요.'
      };
    }

    Logger.log('[createReturnAdjustment] 시작: ' + orderCode + ', ' + itemCode + ', 수량=' + returnQty);

    // 1. 원거래 확인 (거래원장에서 조회)
    var orderValidation = validateOriginalTransaction_(orderCode, itemCode);
    if (!orderValidation.success) {
      return orderValidation;
    }

    var originalTx = orderValidation.transaction;

    // 2. SETTLED 상태 확인
    if (originalTx.state !== 'SETTLED' && originalTx.state !== 'INVOICED' && originalTx.state !== 'PAID') {
      return {
        success: false,
        error: '마감된 거래만 조정할 수 있습니다. 현재 상태: ' + originalTx.state
      };
    }

    // 3. 조정 금액 계산
    var adjustmentAmount = -(returnQty * originalTx.buyPrice); // 반품은 음수

    // 4. 조정 ID 생성
    var adjustmentId = generateAdjustmentId_('RETURN');

    // 5. 조정DB에 저장
    var saveResult = saveAdjustmentToDb_({
      adjustmentId: adjustmentId,
      adjustmentType: 'RETURN',
      orderCode: orderCode,
      itemCode: itemCode,
      adjustmentQty: -returnQty, // 반품은 음수
      adjustmentAmount: adjustmentAmount,
      reason: reason,
      status: 'PENDING'
    });

    if (!saveResult.success) {
      return saveResult;
    }

    Logger.log('[createReturnAdjustment] 완료: ' + adjustmentId);

    return {
      success: true,
      adjustmentId: adjustmentId,
      adjustmentQty: -returnQty,
      adjustmentAmount: adjustmentAmount,
      message: '반품 조정이 생성되었습니다.'
    };

  } catch (err) {
    Logger.log('[createReturnAdjustment Error] ' + err.message);
    return {
      success: false,
      error: '반품 조정 생성 중 오류 발생: ' + err.message
    };
  }
}

/**
 * ============================================================
 * 2. 가격 조정 생성
 * ============================================================
 */

/**
 * 가격 조정 생성
 * @param {Object} params - { orderCode, itemCode, adjustmentAmount, reason }
 * @returns {Object} 생성 결과
 */
function createPriceAdjustment(params) {
  try {
    var orderCode = params.orderCode || '';
    var itemCode = params.itemCode || '';
    var adjustmentAmount = params.adjustmentAmount || 0;
    var reason = params.reason || '';

    if (!orderCode || !itemCode) {
      return {
        success: false,
        error: '발주번호와 품목코드를 입력해주세요.'
      };
    }

    if (adjustmentAmount === 0) {
      return {
        success: false,
        error: '조정 금액을 입력해주세요.'
      };
    }

    Logger.log('[createPriceAdjustment] 시작: ' + orderCode + ', ' + itemCode + ', 금액=' + adjustmentAmount);

    // 1. 원거래 확인
    var orderValidation = validateOriginalTransaction_(orderCode, itemCode);
    if (!orderValidation.success) {
      return orderValidation;
    }

    var originalTx = orderValidation.transaction;

    // 2. SETTLED 상태 확인
    if (originalTx.state !== 'SETTLED' && originalTx.state !== 'INVOICED' && originalTx.state !== 'PAID') {
      return {
        success: false,
        error: '마감된 거래만 조정할 수 있습니다. 현재 상태: ' + originalTx.state
      };
    }

    // 3. 조정 ID 생성
    var adjustmentId = generateAdjustmentId_('PRICE_ADJ');

    // 4. 조정DB에 저장
    var saveResult = saveAdjustmentToDb_({
      adjustmentId: adjustmentId,
      adjustmentType: 'PRICE_ADJUSTMENT',
      orderCode: orderCode,
      itemCode: itemCode,
      adjustmentQty: 0,
      adjustmentAmount: adjustmentAmount,
      reason: reason,
      status: 'PENDING'
    });

    if (!saveResult.success) {
      return saveResult;
    }

    Logger.log('[createPriceAdjustment] 완료: ' + adjustmentId);

    return {
      success: true,
      adjustmentId: adjustmentId,
      adjustmentAmount: adjustmentAmount,
      message: '가격 조정이 생성되었습니다.'
    };

  } catch (err) {
    Logger.log('[createPriceAdjustment Error] ' + err.message);
    return {
      success: false,
      error: '가격 조정 생성 중 오류 발생: ' + err.message
    };
  }
}

/**
 * ============================================================
 * 3. 조정 조회 및 승인
 * ============================================================
 */

/**
 * 조정 목록 조회
 * @param {Object} filter - { type, status, startDate, endDate }
 * @returns {Object} 조회 결과
 */
function getAdjustments(filter) {
  try {
    filter = filter || {};
    var type = filter.type || '';
    var status = filter.status || '';
    var startDate = filter.startDate || '';
    var endDate = filter.endDate || '';

    var ss = SpreadsheetApp.openById(OB_ADJUSTMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_ADJUSTMENT_SHEET);

    if (!sheet) {
      // 조정DB 시트가 없으면 빈 배열 반환
      return {
        success: true,
        adjustments: []
      };
    }

    var data = sheet.getDataRange().getValues();
    var header = data[0];

    var col = function(name) { return header.indexOf(name); };
    var cAdjustmentId = col('조정ID');
    var cType = col('조정유형');
    var cOrderCode = col('원거래ID');
    var cItemCode = col('품목코드');
    var cQty = col('조정수량');
    var cAmount = col('조정금액');
    var cReason = col('사유');
    var cCreatedAt = col('생성일시');
    var cCreatedBy = col('생성자');
    var cStatus = col('승인상태');
    var cApprovedAt = col('승인일시');
    var cApprovedBy = col('승인자');

    var adjustments = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      // 필터 적용
      if (type && row[cType] !== type) continue;
      if (status && row[cStatus] !== status) continue;

      // 날짜 필터 (생성일시 기준)
      if (startDate || endDate) {
        var createdDate = row[cCreatedAt];
        if (createdDate) {
          var dateObj = new Date(createdDate);
          if (startDate && dateObj < new Date(startDate)) continue;
          if (endDate && dateObj > new Date(endDate)) continue;
        }
      }

      adjustments.push({
        adjustmentId: row[cAdjustmentId],
        type: row[cType],
        orderCode: row[cOrderCode],
        itemCode: row[cItemCode],
        adjustmentQty: row[cQty],
        adjustmentAmount: row[cAmount],
        reason: row[cReason],
        createdAt: formatDateString_(row[cCreatedAt]),
        createdBy: row[cCreatedBy],
        status: row[cStatus],
        approvedAt: formatDateString_(row[cApprovedAt]),
        approvedBy: row[cApprovedBy]
      });
    }

    return {
      success: true,
      adjustments: adjustments
    };

  } catch (err) {
    Logger.log('[getAdjustments Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * 조정 승인
 * @param {string} adjustmentId - 조정 ID
 * @returns {Object} 승인 결과
 */
function approveAdjustment(adjustmentId) {
  try {
    if (!adjustmentId) {
      return {
        success: false,
        error: '조정 ID를 입력해주세요.'
      };
    }

    Logger.log('[approveAdjustment] 시작: ' + adjustmentId);

    var ss = SpreadsheetApp.openById(OB_ADJUSTMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_ADJUSTMENT_SHEET);

    if (!sheet) {
      return {
        success: false,
        error: '조정DB 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();
    var header = data[0];

    var col = function(name) { return header.indexOf(name); };
    var cAdjustmentId = col('조정ID');
    var cStatus = col('승인상태');
    var cApprovedAt = col('승인일시');
    var cApprovedBy = col('승인자');

    var rowIndex = -1;

    for (var i = 1; i < data.length; i++) {
      if (data[i][cAdjustmentId] === adjustmentId) {
        rowIndex = i + 1; // 1-based
        break;
      }
    }

    if (rowIndex === -1) {
      return {
        success: false,
        error: '조정 데이터를 찾을 수 없습니다.'
      };
    }

    var now = new Date();
    var user = Session.getActiveUser().getEmail();

    // 승인 상태 업데이트
    sheet.getRange(rowIndex, cStatus + 1).setValue('APPROVED');
    sheet.getRange(rowIndex, cApprovedAt + 1).setValue(now);
    sheet.getRange(rowIndex, cApprovedBy + 1).setValue(user);

    Logger.log('[approveAdjustment] 완료: ' + adjustmentId);

    return {
      success: true,
      adjustmentId: adjustmentId,
      message: '조정이 승인되었습니다.'
    };

  } catch (err) {
    Logger.log('[approveAdjustment Error] ' + err.message);
    return {
      success: false,
      error: '조정 승인 중 오류 발생: ' + err.message
    };
  }
}

/**
 * 조정 거부
 * @param {Object} params - { adjustmentId, reason }
 * @returns {Object} 거부 결과
 */
function rejectAdjustment(params) {
  try {
    var adjustmentId = params.adjustmentId || '';
    var reason = params.reason || '';

    if (!adjustmentId) {
      return {
        success: false,
        error: '조정 ID를 입력해주세요.'
      };
    }

    Logger.log('[rejectAdjustment] 시작: ' + adjustmentId);

    var ss = SpreadsheetApp.openById(OB_ADJUSTMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_ADJUSTMENT_SHEET);

    if (!sheet) {
      return {
        success: false,
        error: '조정DB 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();
    var header = data[0];

    var col = function(name) { return header.indexOf(name); };
    var cAdjustmentId = col('조정ID');
    var cStatus = col('승인상태');
    var cReason = col('사유');

    var rowIndex = -1;

    for (var i = 1; i < data.length; i++) {
      if (data[i][cAdjustmentId] === adjustmentId) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      return {
        success: false,
        error: '조정 데이터를 찾을 수 없습니다.'
      };
    }

    // 거부 상태 업데이트
    sheet.getRange(rowIndex, cStatus + 1).setValue('REJECTED');

    // 거부 사유 추가 (기존 사유 뒤에)
    var currentReason = sheet.getRange(rowIndex, cReason + 1).getValue();
    var newReason = currentReason + (reason ? ' [거부사유: ' + reason + ']' : ' [거부됨]');
    sheet.getRange(rowIndex, cReason + 1).setValue(newReason);

    Logger.log('[rejectAdjustment] 완료: ' + adjustmentId);

    return {
      success: true,
      adjustmentId: adjustmentId,
      message: '조정이 거부되었습니다.'
    };

  } catch (err) {
    Logger.log('[rejectAdjustment Error] ' + err.message);
    return {
      success: false,
      error: '조정 거부 중 오류 발생: ' + err.message
    };
  }
}

/**
 * ============================================================
 * 4. 헬퍼 함수
 * ============================================================
 */

/**
 * 원거래 검증
 * @param {string} orderCode - 발주번호
 * @param {string} itemCode - 품목코드
 * @returns {Object} 검증 결과
 */
function validateOriginalTransaction_(orderCode, itemCode) {
  try {
    // 거래원장에서 원거래 찾기
    var ss = SpreadsheetApp.openById(OB_ADJUSTMENT_SS_ID);
    var sheet = ss.getSheetByName('거래원장');

    if (!sheet) {
      return {
        success: false,
        error: '거래원장 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();
    var header = data[0];

    var col = function(name) { return header.indexOf(name); };
    var cOrderCode = col('발주번호');
    var cItemCode = col('품목코드');
    var cState = col('거래상태');
    var cBuyPrice = col('매입가');
    var cSupplyPrice = col('공급가');
    var cConfirmedQty = col('확정수량');

    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      if (row[cOrderCode] === orderCode && row[cItemCode] === itemCode) {
        return {
          success: true,
          transaction: {
            orderCode: row[cOrderCode],
            itemCode: row[cItemCode],
            state: row[cState] || 'CONFIRMED_OPEN',
            buyPrice: row[cBuyPrice] || 0,
            supplyPrice: row[cSupplyPrice] || 0,
            confirmedQty: row[cConfirmedQty] || 0
          }
        };
      }
    }

    return {
      success: false,
      error: '원거래를 찾을 수 없습니다. 발주번호: ' + orderCode + ', 품목코드: ' + itemCode
    };

  } catch (err) {
    Logger.log('[validateOriginalTransaction_ Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * 조정 ID 생성
 * @param {string} prefix - 접두사 (RETURN, PRICE_ADJ, etc.)
 * @returns {string} 조정 ID
 */
function generateAdjustmentId_(prefix) {
  var now = new Date();
  var dateStr = Utilities.formatDate(now, 'Asia/Seoul', 'yyyyMMdd');

  var ss = SpreadsheetApp.openById(OB_ADJUSTMENT_SS_ID);
  var sheet = ss.getSheetByName(OB_ADJUSTMENT_SHEET);

  var seq = 1;

  if (sheet && sheet.getLastRow() > 1) {
    var data = sheet.getDataRange().getValues();
    var count = 0;

    for (var i = 1; i < data.length; i++) {
      var id = data[i][0];
      if (id && id.startsWith('ADJ-' + dateStr)) {
        count++;
      }
    }

    seq = count + 1;
  }

  return 'ADJ-' + dateStr + '-' + String(seq).padStart(3, '0');
}

/**
 * 조정 데이터 저장
 * @param {Object} adjustment - 조정 데이터
 * @returns {Object} 저장 결과
 */
function saveAdjustmentToDb_(adjustment) {
  try {
    var ss = SpreadsheetApp.openById(OB_ADJUSTMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_ADJUSTMENT_SHEET);

    // 시트가 없으면 생성
    if (!sheet) {
      sheet = ss.insertSheet(OB_ADJUSTMENT_SHEET);
      sheet.appendRow([
        '조정ID', '조정유형', '원거래ID', '품목코드', '조정수량', '조정금액',
        '사유', '생성일시', '생성자', '승인상태', '승인일시', '승인자'
      ]);
    }

    var now = new Date();
    var user = Session.getActiveUser().getEmail();

    var rowData = [
      adjustment.adjustmentId,
      adjustment.adjustmentType,
      adjustment.orderCode,
      adjustment.itemCode,
      adjustment.adjustmentQty,
      adjustment.adjustmentAmount,
      adjustment.reason,
      now,
      user,
      adjustment.status || 'PENDING',
      '',
      ''
    ];

    sheet.appendRow(rowData);

    Logger.log('[saveAdjustmentToDb_] 저장 완료: ' + adjustment.adjustmentId);

    return {
      success: true
    };

  } catch (err) {
    Logger.log('[saveAdjustmentToDb_ Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * 날짜 포맷팅
 * @param {Date|string} date - 날짜
 * @returns {string} 포맷팅된 날짜
 */
function formatDateString_(date) {
  if (!date) return '';
  if (typeof date === 'string') return date;

  var d = new Date(date);
  if (isNaN(d.getTime())) return '';

  return Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
}
