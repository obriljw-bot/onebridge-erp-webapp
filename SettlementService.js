/**
 * ============================================================
 * SettlementService.js - 회계 마감 비즈니스 로직
 * ============================================================
 * 매입/매출 마감 기능 구현
 * ============================================================
 */

// ====== 스프레드시트 ID / 시트명 상수 ======
const OB_SETTLEMENT_SS_ID = '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs'; // 발주_통합DB (기존)
const OB_ORDER_LEDGER_SHEET = '거래원장';
const OB_PURCHASE_SETTLEMENT_SHEET = '매입마감DB';
const OB_SALES_SETTLEMENT_SHEET = '매출마감DB';
const OB_SETTLEMENT_DETAIL_SHEET = '마감상세DB';

/**
 * ============================================================
 * 1. 매입/매출 데이터 집계
 * ============================================================
 */

/**
 * 매입처별 발주 데이터 집계
 * @param {Object} params - { supplier, startDate, endDate }
 * @returns {Object} 집계 결과
 */
function aggregatePurchaseOrders(params) {
  try {
    var supplier = params.supplier || '';
    var startDate = params.startDate || '';
    var endDate = params.endDate || '';

    if (!supplier) {
      return {
        success: false,
        error: '매입처를 선택해주세요.'
      };
    }

    if (!startDate || !endDate) {
      return {
        success: false,
        error: '마감 기간을 선택해주세요.'
      };
    }

    Logger.log('[aggregatePurchaseOrders] 매입처: ' + supplier + ', 기간: ' + startDate + ' ~ ' + endDate);

    // 거래원장에서 데이터 조회
    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_ORDER_LEDGER_SHEET);

    if (!sheet) {
      return {
        success: false,
        error: '거래원장 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();
    var header = data[0];

    // 컬럼 인덱스 찾기
    var col = function(name) { return header.indexOf(name); };
    var cOrderDate = col('발주일');
    var cOrderCode = col('발주번호');
    var cSupplier = col('매입처');
    var cBuyer = col('발주처');
    var cBrand = col('브랜드');
    var cProductName = col('제품명');
    var cProductCode = col('품목코드');
    var cOrderQty = col('발주수량');
    var cConfirmedQty = col('확정수량');
    var cBuyPrice = col('매입가');
    var cSupplyPrice = col('공급가');

    // 날짜 파싱 함수
    var parseDate = function(d) {
      if (!d) return null;
      if (d instanceof Date) return d;
      return new Date(d);
    };

    var start = parseDate(startDate);
    var end = parseDate(endDate);

    // 데이터 필터링 및 집계
    var items = [];
    var totalOrderQty = 0;
    var totalConfirmedQty = 0;
    var totalPurchaseAmount = 0;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      // 매입처 필터
      if (row[cSupplier] !== supplier) continue;

      // 날짜 필터
      var orderDate = parseDate(row[cOrderDate]);
      if (!orderDate || orderDate < start || orderDate > end) continue;

      var orderQty = Number(row[cOrderQty]) || 0;
      var confirmedQty = Number(row[cConfirmedQty]) || 0;
      var buyPrice = Number(row[cBuyPrice]) || 0;

      var purchaseAmount = confirmedQty * buyPrice;
      var diffQty = orderQty - confirmedQty;
      var diffAmount = diffQty * buyPrice;

      items.push({
        orderCode: row[cOrderCode],
        orderDate: formatDateString(row[cOrderDate]),
        buyer: row[cBuyer],
        brand: row[cBrand],
        productName: row[cProductName],
        productCode: row[cProductCode],
        orderQty: orderQty,
        confirmedQty: confirmedQty,
        buyPrice: buyPrice,
        supplyPrice: Number(row[cSupplyPrice]) || 0,
        purchaseAmount: purchaseAmount,
        diffQty: diffQty,
        diffAmount: diffAmount
      });

      totalOrderQty += orderQty;
      totalConfirmedQty += confirmedQty;
      totalPurchaseAmount += purchaseAmount;
    }

    var diffQty = totalOrderQty - totalConfirmedQty;

    return {
      success: true,
      supplier: supplier,
      startDate: startDate,
      endDate: endDate,
      totalItems: items.length,
      totalOrderQty: totalOrderQty,
      totalConfirmedQty: totalConfirmedQty,
      totalPurchaseAmount: totalPurchaseAmount,
      diffQty: diffQty,
      items: items
    };

  } catch (err) {
    Logger.log('[aggregatePurchaseOrders Error] ' + err.message);
    return {
      success: false,
      error: '집계 중 오류 발생: ' + err.message
    };
  }
}

/**
 * 발주처별 발주 데이터 집계 (매출 마감용)
 * @param {Object} params - { buyer, startDate, endDate }
 * @returns {Object} 집계 결과
 */
function aggregateSalesOrders(params) {
  try {
    var buyer = params.buyer || '';
    var startDate = params.startDate || '';
    var endDate = params.endDate || '';

    if (!buyer) {
      return {
        success: false,
        error: '발주처를 선택해주세요.'
      };
    }

    if (!startDate || !endDate) {
      return {
        success: false,
        error: '마감 기간을 선택해주세요.'
      };
    }

    Logger.log('[aggregateSalesOrders] 발주처: ' + buyer + ', 기간: ' + startDate + ' ~ ' + endDate);

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_ORDER_LEDGER_SHEET);

    if (!sheet) {
      return {
        success: false,
        error: '거래원장 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();
    var header = data[0];

    var col = function(name) { return header.indexOf(name); };
    var cOrderDate = col('발주일');
    var cOrderCode = col('발주번호');
    var cSupplier = col('매입처');
    var cBuyer = col('발주처');
    var cBrand = col('브랜드');
    var cProductName = col('제품명');
    var cProductCode = col('품목코드');
    var cOrderQty = col('발주수량');
    var cConfirmedQty = col('확정수량');
    var cSupplyPrice = col('공급가');

    var parseDate = function(d) {
      if (!d) return null;
      if (d instanceof Date) return d;
      return new Date(d);
    };

    var start = parseDate(startDate);
    var end = parseDate(endDate);

    var items = [];
    var totalOrderQty = 0;
    var totalConfirmedQty = 0;
    var totalSupplyAmount = 0;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      // 발주처 필터
      if (row[cBuyer] !== buyer) continue;

      // 날짜 필터
      var orderDate = parseDate(row[cOrderDate]);
      if (!orderDate || orderDate < start || orderDate > end) continue;

      var orderQty = Number(row[cOrderQty]) || 0;
      var confirmedQty = Number(row[cConfirmedQty]) || 0;
      var supplyPrice = Number(row[cSupplyPrice]) || 0;

      var supplyAmount = confirmedQty * supplyPrice;
      var diffQty = orderQty - confirmedQty;
      var diffAmount = diffQty * supplyPrice;

      items.push({
        orderCode: row[cOrderCode],
        orderDate: formatDateString(row[cOrderDate]),
        supplier: row[cSupplier],
        brand: row[cBrand],
        productName: row[cProductName],
        productCode: row[cProductCode],
        orderQty: orderQty,
        confirmedQty: confirmedQty,
        supplyPrice: supplyPrice,
        supplyAmount: supplyAmount,
        diffQty: diffQty,
        diffAmount: diffAmount
      });

      totalOrderQty += orderQty;
      totalConfirmedQty += confirmedQty;
      totalSupplyAmount += supplyAmount;
    }

    var diffQty = totalOrderQty - totalConfirmedQty;

    return {
      success: true,
      buyer: buyer,
      startDate: startDate,
      endDate: endDate,
      totalItems: items.length,
      totalOrderQty: totalOrderQty,
      totalConfirmedQty: totalConfirmedQty,
      totalSupplyAmount: totalSupplyAmount,
      diffQty: diffQty,
      items: items
    };

  } catch (err) {
    Logger.log('[aggregateSalesOrders Error] ' + err.message);
    return {
      success: false,
      error: '집계 중 오류 발생: ' + err.message
    };
  }
}

/**
 * ============================================================
 * 2. 마감 저장 및 조회
 * ============================================================
 */

/**
 * 매입 마감 저장
 * @param {Object} params - 마감 데이터
 * @returns {Object} 저장 결과
 */
function savePurchaseSettlement(params) {
  try {
    var supplier = params.supplier || '';
    var startDate = params.startDate || '';
    var endDate = params.endDate || '';
    var status = params.status || 'DRAFT';
    var notes = params.notes || '';
    var items = params.items || [];

    if (!supplier || !startDate || !endDate) {
      return {
        success: false,
        error: '필수 정보를 입력해주세요.'
      };
    }

    // 마감 ID 생성
    var settlementId = 'PS-' + formatYearMonth(startDate) + '-' + supplier;

    // 집계 데이터 계산
    var totalItems = items.length;
    var totalOrderQty = 0;
    var totalConfirmedQty = 0;
    var totalPurchaseAmount = 0;

    items.forEach(function(item) {
      totalOrderQty += item.orderQty || 0;
      totalConfirmedQty += item.confirmedQty || 0;
      totalPurchaseAmount += item.purchaseAmount || 0;
    });

    var diffQty = totalOrderQty - totalConfirmedQty;

    var now = new Date();
    var user = Session.getActiveUser().getEmail();

    // 매입마감DB 시트에 저장
    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_PURCHASE_SETTLEMENT_SHEET);

    if (!sheet) {
      // 시트가 없으면 생성
      sheet = ss.insertSheet(OB_PURCHASE_SETTLEMENT_SHEET);
      sheet.appendRow([
        '마감ID', '마감유형', '매입처', '마감기간시작', '마감기간종료',
        '마감상태', '총품목수', '총발주수량', '총확정수량', '총매입액',
        '차이수량', '비고', '생성일시', '생성자', '확정일시', '확정자'
      ]);
    }

    // 기존 마감 확인
    var data = sheet.getDataRange().getValues();
    var existingRowIndex = -1;

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === settlementId) {
        existingRowIndex = i + 1; // 시트 행 번호 (1-based)
        break;
      }
    }

    var rowData = [
      settlementId,
      'PURCHASE',
      supplier,
      startDate,
      endDate,
      status,
      totalItems,
      totalOrderQty,
      totalConfirmedQty,
      totalPurchaseAmount,
      diffQty,
      notes,
      now,
      user,
      status === 'CONFIRMED' ? now : '',
      status === 'CONFIRMED' ? user : ''
    ];

    if (existingRowIndex > 0) {
      // 기존 마감 업데이트
      sheet.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
      Logger.log('[savePurchaseSettlement] 마감 업데이트: ' + settlementId);
    } else {
      // 새 마감 추가
      sheet.appendRow(rowData);
      Logger.log('[savePurchaseSettlement] 새 마감 생성: ' + settlementId);
    }

    return {
      success: true,
      settlementId: settlementId,
      message: status === 'DRAFT' ? '임시저장 완료' : '마감 확정 완료'
    };

  } catch (err) {
    Logger.log('[savePurchaseSettlement Error] ' + err.message);
    return {
      success: false,
      error: '저장 중 오류 발생: ' + err.message
    };
  }
}

/**
 * 매출 마감 저장
 * @param {Object} params - 마감 데이터
 * @returns {Object} 저장 결과
 */
function saveSalesSettlement(params) {
  try {
    var buyer = params.buyer || '';
    var startDate = params.startDate || '';
    var endDate = params.endDate || '';
    var status = params.status || 'DRAFT';
    var notes = params.notes || '';
    var items = params.items || [];

    if (!buyer || !startDate || !endDate) {
      return {
        success: false,
        error: '필수 정보를 입력해주세요.'
      };
    }

    var settlementId = 'SS-' + formatYearMonth(startDate) + '-' + buyer;

    var totalItems = items.length;
    var totalOrderQty = 0;
    var totalConfirmedQty = 0;
    var totalSupplyAmount = 0;

    items.forEach(function(item) {
      totalOrderQty += item.orderQty || 0;
      totalConfirmedQty += item.confirmedQty || 0;
      totalSupplyAmount += item.supplyAmount || 0;
    });

    var diffQty = totalOrderQty - totalConfirmedQty;

    var now = new Date();
    var user = Session.getActiveUser().getEmail();

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_SALES_SETTLEMENT_SHEET);

    if (!sheet) {
      sheet = ss.insertSheet(OB_SALES_SETTLEMENT_SHEET);
      sheet.appendRow([
        '마감ID', '마감유형', '발주처', '마감기간시작', '마감기간종료',
        '마감상태', '총품목수', '총발주수량', '총확정수량', '총공급액',
        '차이수량', '비고', '생성일시', '생성자', '확정일시', '확정자'
      ]);
    }

    var data = sheet.getDataRange().getValues();
    var existingRowIndex = -1;

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === settlementId) {
        existingRowIndex = i + 1;
        break;
      }
    }

    var rowData = [
      settlementId,
      'SALES',
      buyer,
      startDate,
      endDate,
      status,
      totalItems,
      totalOrderQty,
      totalConfirmedQty,
      totalSupplyAmount,
      diffQty,
      notes,
      now,
      user,
      status === 'CONFIRMED' ? now : '',
      status === 'CONFIRMED' ? user : ''
    ];

    if (existingRowIndex > 0) {
      sheet.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
      Logger.log('[saveSalesSettlement] 마감 업데이트: ' + settlementId);
    } else {
      sheet.appendRow(rowData);
      Logger.log('[saveSalesSettlement] 새 마감 생성: ' + settlementId);
    }

    return {
      success: true,
      settlementId: settlementId,
      message: status === 'DRAFT' ? '임시저장 완료' : '마감 확정 완료'
    };

  } catch (err) {
    Logger.log('[saveSalesSettlement Error] ' + err.message);
    return {
      success: false,
      error: '저장 중 오류 발생: ' + err.message
    };
  }
}

/**
 * 매입 마감 목록 조회
 */
function getPurchaseSettlements(params) {
  try {
    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_PURCHASE_SETTLEMENT_SHEET);

    if (!sheet) {
      return {
        success: true,
        settlements: []
      };
    }

    var data = sheet.getDataRange().getValues();
    var settlements = [];

    for (var i = 1; i < data.length; i++) {
      settlements.push({
        settlementId: data[i][0],
        type: data[i][1],
        supplier: data[i][2],
        startDate: formatDateString(data[i][3]),
        endDate: formatDateString(data[i][4]),
        status: data[i][5],
        totalItems: data[i][6],
        totalOrderQty: data[i][7],
        totalConfirmedQty: data[i][8],
        totalPurchaseAmount: data[i][9],
        diffQty: data[i][10],
        notes: data[i][11],
        createdAt: formatDateString(data[i][12]),
        createdBy: data[i][13]
      });
    }

    return {
      success: true,
      settlements: settlements
    };

  } catch (err) {
    Logger.log('[getPurchaseSettlements Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * ============================================================
 * 3. 유틸리티 함수
 * ============================================================
 */

/**
 * 날짜를 YYYY-MM-DD 형식 문자열로 변환
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

/**
 * 날짜를 YYYYMM 형식으로 변환
 */
function formatYearMonth(date) {
  if (!date) return '';
  var d = new Date(date);
  if (isNaN(d.getTime())) return '';

  var year = d.getFullYear();
  var month = String(d.getMonth() + 1).padStart(2, '0');

  return year + month;
}
