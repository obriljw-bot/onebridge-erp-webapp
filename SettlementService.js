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
const OB_BILLING_SHEET = '청구DB';
const OB_MONTHLY_CLOSING_SHEET = '월마감DB';

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

    // 기간은 필수
    if (!startDate || !endDate) {
      return {
        success: false,
        error: '마감 기간을 선택해주세요.'
      };
    }

    Logger.log('[aggregatePurchaseOrders] 매입처: ' + (supplier || '전체') + ', 기간: ' + startDate + ' ~ ' + endDate);

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

      // 매입처 필터 (매입처가 지정된 경우만)
      if (supplier && row[cSupplier] !== supplier) continue;

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

    // 기간은 필수
    if (!startDate || !endDate) {
      return {
        success: false,
        error: '마감 기간을 선택해주세요.'
      };
    }

    Logger.log('[aggregateSalesOrders] 발주처: ' + (buyer || '전체') + ', 기간: ' + startDate + ' ~ ' + endDate);

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

      // 발주처 필터 (발주처가 지정된 경우만)
      if (buyer && row[cBuyer] !== buyer) continue;

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

    // 마감상세DB에 품목별 상세 저장
    var detailSaved = saveSettlementDetails_(settlementId, items, 'PURCHASE');
    if (!detailSaved) {
      Logger.log('[savePurchaseSettlement] 경고: 마감상세 저장 실패');
    }

    // 확정 상태일 경우 거래원장 상태를 SETTLED로 업데이트
    if (status === 'CONFIRMED') {
      var orderNumbers = items.map(function(item) {
        return item.orderCode;
      });
      var ledgerUpdated = updateLedgerStatus_(orderNumbers, 'SETTLED');
      if (!ledgerUpdated) {
        Logger.log('[savePurchaseSettlement] 경고: 거래원장 상태 업데이트 실패');
      }
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

    // 마감상세DB에 품목별 상세 저장
    var detailSaved = saveSettlementDetails_(settlementId, items, 'SALES');
    if (!detailSaved) {
      Logger.log('[saveSalesSettlement] 경고: 마감상세 저장 실패');
    }

    // 확정 상태일 경우 거래원장 상태를 SETTLED로 업데이트
    if (status === 'CONFIRMED') {
      var orderNumbers = items.map(function(item) {
        return item.orderCode;
      });
      var ledgerUpdated = updateLedgerStatus_(orderNumbers, 'SETTLED');
      if (!ledgerUpdated) {
        Logger.log('[saveSalesSettlement] 경고: 거래원장 상태 업데이트 실패');
      }
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
 * 매출 마감 목록 조회
 */
function getSalesSettlements(params) {
  try {
    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_SALES_SETTLEMENT_SHEET);

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
        buyer: data[i][2],
        startDate: formatDateString(data[i][3]),
        endDate: formatDateString(data[i][4]),
        status: data[i][5],
        totalItems: data[i][6],
        totalOrderQty: data[i][7],
        totalConfirmedQty: data[i][8],
        totalSupplyAmount: data[i][9],
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
    Logger.log('[getSalesSettlements Error] ' + err.message);
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

/**
 * 청구서용 거래 데이터 집계
 * @param {Object} params - { company, startDate, endDate }
 * @returns {Object} 집계 결과
 */
function aggregateBillingData(params) {
  try {
    var company = params.company || '';
    var startDate = params.startDate || '';
    var endDate = params.endDate || '';

    if (!company) {
      return {
        success: false,
        error: '거래처를 입력해주세요.'
      };
    }

    if (!startDate || !endDate) {
      return {
        success: false,
        error: '기간을 선택해주세요.'
      };
    }

    Logger.log('[aggregateBillingData] 거래처: ' + company + ', 기간: ' + startDate + ' ~ ' + endDate);

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
    var totalAmount = 0;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      // 발주처 필터
      if (row[cBuyer] !== company) continue;

      // 날짜 필터
      var orderDate = parseDate(row[cOrderDate]);
      if (!orderDate || orderDate < start || orderDate > end) continue;

      var orderQty = Number(row[cOrderQty]) || 0;
      var confirmedQty = Number(row[cConfirmedQty]) || 0;
      var supplyPrice = Number(row[cSupplyPrice]) || 0;
      var supplyAmount = confirmedQty * supplyPrice;

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
        supplyAmount: supplyAmount
      });

      totalOrderQty += orderQty;
      totalConfirmedQty += confirmedQty;
      totalAmount += supplyAmount;
    }

    return {
      success: true,
      company: company,
      startDate: startDate,
      endDate: endDate,
      totalItems: items.length,
      totalOrderQty: totalOrderQty,
      totalConfirmedQty: totalConfirmedQty,
      totalAmount: totalAmount,
      items: items
    };

  } catch (err) {
    Logger.log('[aggregateBillingData Error] ' + err.message);
    return {
      success: false,
      error: '집계 중 오류 발생: ' + err.message
    };
  }
}


/**
 * ============================================================
 * 4. 청구서 관리 (Phase 2)
 * ============================================================
 */

/**
 * 청구서 생성
 * @param {Object} params - { settlementId, type, company, billingDate, amount, notes }
 * @returns {Object} 생성 결과
 */
function createBilling(params) {
  try {
    var settlementId = params.settlementId || '';
    var type = params.type || '';
    var company = params.company || '';
    var billingDate = params.billingDate || new Date();
    var amount = params.amount || 0;
    var notes = params.notes || '';

    if (!settlementId || !type || !company) {
      return {
        success: false,
        error: '필수 정보를 입력해주세요.'
      };
    }

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_BILLING_SHEET);

    if (!sheet) {
      sheet = ss.insertSheet(OB_BILLING_SHEET);
      sheet.appendRow([
        '청구ID', '청구유형', '업체명', '마감ID', '청구일', '청구상태',
        '청구금액', '입금액', '잔액', '비고', '생성일시', '생성자',
        '발행일시', '발행자', '결제일시'
      ]);
    }

    // 청구 ID 생성: BL-YYYYMMDD-순번
    var today = new Date();
    var dateStr = formatYearMonth(today) + String(today.getDate()).padStart(2, '0');
    var data = sheet.getDataRange().getValues();
    var count = 1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].startsWith('BL-' + dateStr)) {
        count++;
      }
    }
    var billingId = 'BL-' + dateStr + '-' + String(count).padStart(3, '0');

    var now = new Date();
    var user = Session.getActiveUser().getEmail();

    var rowData = [
      billingId,
      type,
      company,
      settlementId,
      billingDate,
      'DRAFT',
      amount,
      0,
      amount,
      notes,
      now,
      user,
      '',
      '',
      ''
    ];

    sheet.appendRow(rowData);
    Logger.log('[createBilling] 청구서 생성: ' + billingId);

    return {
      success: true,
      billingId: billingId,
      message: '청구서가 생성되었습니다.'
    };

  } catch (err) {
    Logger.log('[createBilling Error] ' + err.message);
    return {
      success: false,
      error: '청구서 생성 중 오류 발생: ' + err.message
    };
  }
}

/**
 * 청구서 목록 조회
 * @param {Object} params - { type, company, status, startDate, endDate }
 * @returns {Object} 조회 결과
 */
function getBillings(params) {
  try {
    var type = params.type || '';
    var company = params.company || '';
    var status = params.status || '';
    var startDate = params.startDate || '';
    var endDate = params.endDate || '';

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_BILLING_SHEET);

    if (!sheet) {
      return {
        success: true,
        billings: []
      };
    }

    var data = sheet.getDataRange().getValues();
    var billings = [];

    var parseDate = function(d) {
      if (!d) return null;
      if (d instanceof Date) return d;
      return new Date(d);
    };

    var start = startDate ? parseDate(startDate) : null;
    var end = endDate ? parseDate(endDate) : null;

    for (var i = 1; i < data.length; i++) {
      // 타입 필터
      if (type && data[i][1] !== type) continue;

      // 거래처 필터
      if (company && data[i][2].indexOf(company) === -1) continue;

      // 상태 필터
      if (status && data[i][5] !== status) continue;

      // 날짜 필터
      if (start || end) {
        var billingDate = parseDate(data[i][4]);
        if (start && billingDate < start) continue;
        if (end && billingDate > end) continue;
      }

      billings.push({
        billingId: data[i][0],
        type: data[i][1],
        company: data[i][2],
        settlementId: data[i][3],
        billingDate: formatDateString(data[i][4]),
        status: data[i][5],
        amount: data[i][6],
        paidAmount: data[i][7],
        remainingAmount: data[i][8],
        notes: data[i][9],
        createdAt: formatDateString(data[i][10]),
        createdBy: data[i][11],
        issuedAt: formatDateString(data[i][12]),
        issuedBy: data[i][13],
        paidAt: formatDateString(data[i][14])
      });
    }

    return {
      success: true,
      billings: billings
    };

  } catch (err) {
    Logger.log('[getBillings Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * 청구서 상태 업데이트
 * @param {Object} params - { billingId, status }
 * @returns {Object} 업데이트 결과
 */
function updateBillingStatus(params) {
  try {
    var billingId = params.billingId || '';
    var status = params.status || '';

    if (!billingId || !status) {
      return {
        success: false,
        error: '청구ID와 상태를 입력해주세요.'
      };
    }

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_BILLING_SHEET);

    if (!sheet) {
      return {
        success: false,
        error: '청구DB 시트를 찾을 수 없습니다.'
      };
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
      return {
        success: false,
        error: '청구서를 찾을 수 없습니다.'
      };
    }

    var now = new Date();
    var user = Session.getActiveUser().getEmail();

    // 상태 업데이트
    sheet.getRange(rowIndex, 6).setValue(status);

    // ISSUED로 변경 시 발행 정보 기록
    if (status === 'ISSUED') {
      sheet.getRange(rowIndex, 13).setValue(now);
      sheet.getRange(rowIndex, 14).setValue(user);
    }

    // PAID로 변경 시 결제 일시 기록 및 잔액 처리
    if (status === 'PAID' || status === 'PAID_PARTIAL') {
      sheet.getRange(rowIndex, 15).setValue(now);

      // PAID 상태일 때는 입금액을 청구금액과 동일하게, 잔액을 0으로 설정
      if (status === 'PAID') {
        var totalAmount = Number(data[rowIndex - 1][6]) || 0;
        sheet.getRange(rowIndex, 8).setValue(totalAmount);
        sheet.getRange(rowIndex, 9).setValue(0);
      }
    }

    Logger.log('[updateBillingStatus] 청구서 상태 업데이트: ' + billingId + ' -> ' + status);

    return {
      success: true,
      message: '청구서 상태가 업데이트되었습니다.'
    };

  } catch (err) {
    Logger.log('[updateBillingStatus Error] ' + err.message);
    return {
      success: false,
      error: '상태 업데이트 중 오류 발생: ' + err.message
    };
  }
}

/**
 * ============================================================
 * 5. 월별 마감 관리 (Phase 2)
 * ============================================================
 */

/**
 * 월별 마감 실행
 * @param {Object} params - { yearMonth }
 * @returns {Object} 마감 결과
 */
function executeMonthlyClosing(params) {
  try {
    var yearMonth = params.yearMonth || '';

    if (!yearMonth) {
      return {
        success: false,
        error: '마감 월을 선택해주세요.'
      };
    }

    Logger.log('[executeMonthlyClosing] 월 마감 시작: ' + yearMonth);

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);

    // 1. 해당 월의 모든 마감 건수 및 금액 집계
    var purchaseSheet = ss.getSheetByName(OB_PURCHASE_SETTLEMENT_SHEET);
    var salesSheet = ss.getSheetByName(OB_SALES_SETTLEMENT_SHEET);

    var purchaseCount = 0;
    var purchaseAmount = 0;
    var salesCount = 0;
    var salesAmount = 0;

    // 매입 마감 집계
    if (purchaseSheet) {
      var pData = purchaseSheet.getDataRange().getValues();
      for (var i = 1; i < pData.length; i++) {
        var startDate = formatYearMonth(pData[i][3]);
        if (startDate === yearMonth && pData[i][5] === 'CONFIRMED') {
          purchaseCount++;
          purchaseAmount += Number(pData[i][9]) || 0;
          // 상태를 LOCKED로 변경
          purchaseSheet.getRange(i + 1, 6).setValue('LOCKED');
        }
      }
    }

    // 매출 마감 집계
    if (salesSheet) {
      var sData = salesSheet.getDataRange().getValues();
      for (var i = 1; i < sData.length; i++) {
        var startDate = formatYearMonth(sData[i][3]);
        if (startDate === yearMonth && sData[i][5] === 'CONFIRMED') {
          salesCount++;
          salesAmount += Number(sData[i][9]) || 0;
          // 상태를 LOCKED로 변경
          salesSheet.getRange(i + 1, 6).setValue('LOCKED');
        }
      }
    }

    // 2. 월마감DB에 기록
    var closingSheet = ss.getSheetByName(OB_MONTHLY_CLOSING_SHEET);

    if (!closingSheet) {
      closingSheet = ss.insertSheet(OB_MONTHLY_CLOSING_SHEET);
      closingSheet.appendRow([
        '월마감ID', '년월', '마감상태', '총매입건수', '총매입액',
        '총매출건수', '총매출액', '마감일시', '마감자', '해제일시', '해제자'
      ]);
    }

    // 기존 마감 확인
    var cData = closingSheet.getDataRange().getValues();
    var existingRowIndex = -1;
    for (var i = 1; i < cData.length; i++) {
      if (cData[i][0] === 'MC-' + yearMonth) {
        existingRowIndex = i + 1;
        break;
      }
    }

    var now = new Date();
    var user = Session.getActiveUser().getEmail();

    var rowData = [
      'MC-' + yearMonth,
      yearMonth,
      'CLOSED',
      purchaseCount,
      purchaseAmount,
      salesCount,
      salesAmount,
      now,
      user,
      '',
      ''
    ];

    if (existingRowIndex > 0) {
      closingSheet.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      closingSheet.appendRow(rowData);
    }

    Logger.log('[executeMonthlyClosing] 월 마감 완료: ' + yearMonth);

    return {
      success: true,
      yearMonth: yearMonth,
      purchaseCount: purchaseCount,
      purchaseAmount: purchaseAmount,
      salesCount: salesCount,
      salesAmount: salesAmount,
      message: yearMonth + ' 월 마감이 완료되었습니다.'
    };

  } catch (err) {
    Logger.log('[executeMonthlyClosing Error] ' + err.message);
    return {
      success: false,
      error: '월 마감 중 오류 발생: ' + err.message
    };
  }
}

/**
 * 월별 마감 해제
 * @param {Object} params - { yearMonth }
 * @returns {Object} 해제 결과
 */
function unlockMonthlyClosing(params) {
  try {
    var yearMonth = params.yearMonth || '';

    if (!yearMonth) {
      return {
        success: false,
        error: '해제할 월을 선택해주세요.'
      };
    }

    Logger.log('[unlockMonthlyClosing] 월 마감 해제 시작: ' + yearMonth);

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);

    // 1. 해당 월의 모든 마감을 CONFIRMED로 변경
    var purchaseSheet = ss.getSheetByName(OB_PURCHASE_SETTLEMENT_SHEET);
    var salesSheet = ss.getSheetByName(OB_SALES_SETTLEMENT_SHEET);

    // 매입 마감 해제
    if (purchaseSheet) {
      var pData = purchaseSheet.getDataRange().getValues();
      for (var i = 1; i < pData.length; i++) {
        var startDate = formatYearMonth(pData[i][3]);
        if (startDate === yearMonth && pData[i][5] === 'LOCKED') {
          purchaseSheet.getRange(i + 1, 6).setValue('CONFIRMED');
        }
      }
    }

    // 매출 마감 해제
    if (salesSheet) {
      var sData = salesSheet.getDataRange().getValues();
      for (var i = 1; i < sData.length; i++) {
        var startDate = formatYearMonth(sData[i][3]);
        if (startDate === yearMonth && sData[i][5] === 'LOCKED') {
          salesSheet.getRange(i + 1, 6).setValue('CONFIRMED');
        }
      }
    }

    // 2. 월마감DB 업데이트
    var closingSheet = ss.getSheetByName(OB_MONTHLY_CLOSING_SHEET);

    if (closingSheet) {
      var cData = closingSheet.getDataRange().getValues();
      for (var i = 1; i < cData.length; i++) {
        if (cData[i][0] === 'MC-' + yearMonth) {
          var now = new Date();
          var user = Session.getActiveUser().getEmail();
          closingSheet.getRange(i + 1, 3).setValue('OPEN');
          closingSheet.getRange(i + 1, 10).setValue(now);
          closingSheet.getRange(i + 1, 11).setValue(user);
          break;
        }
      }
    }

    Logger.log('[unlockMonthlyClosing] 월 마감 해제 완료: ' + yearMonth);

    return {
      success: true,
      yearMonth: yearMonth,
      message: yearMonth + ' 월 마감이 해제되었습니다.'
    };

  } catch (err) {
    Logger.log('[unlockMonthlyClosing Error] ' + err.message);
    return {
      success: false,
      error: '월 마감 해제 중 오류 발생: ' + err.message
    };
  }
}

/**
 * 월별 마감 목록 조회
 * @returns {Object} 조회 결과
 */
function getMonthlyClosings() {
  try {
    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_MONTHLY_CLOSING_SHEET);

    if (!sheet) {
      return {
        success: true,
        closings: []
      };
    }

    var data = sheet.getDataRange().getValues();
    var closings = [];

    for (var i = 1; i < data.length; i++) {
      closings.push({
        closingId: data[i][0],
        yearMonth: data[i][1],
        status: data[i][2],
        purchaseCount: data[i][3],
        purchaseAmount: data[i][4],
        salesCount: data[i][5],
        salesAmount: data[i][6],
        closedAt: formatDateString(data[i][7]),
        closedBy: data[i][8],
        unlockedAt: formatDateString(data[i][9]),
        unlockedBy: data[i][10]
      });
    }

    return {
      success: true,
      closings: closings
    };

  } catch (err) {
    Logger.log('[getMonthlyClosings Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * 마감 상세 조회
 * @param {Object} params - { settlementId }
 * @returns {Object} 조회 결과
 */
function getSettlementDetail(params) {
  try {
    var settlementId = params.settlementId || '';

    if (!settlementId) {
      return {
        success: false,
        error: '마감ID를 입력해주세요.'
      };
    }

    Logger.log('[getSettlementDetail] 마감 상세 조회: ' + settlementId);

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_SETTLEMENT_DETAIL_SHEET);

    if (!sheet) {
      return {
        success: true,
        items: []
      };
    }

    var data = sheet.getDataRange().getValues();
    var items = [];

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === settlementId) {
        items.push({
          settlementId: data[i][0],
          orderCode: data[i][1],
          orderDate: formatDateString(data[i][2]),
          productCode: data[i][3],
          productName: data[i][4],
          brand: data[i][5],
          supplier: data[i][6],
          buyer: data[i][7],
          orderQty: data[i][8],
          confirmedQty: data[i][9],
          diffQty: data[i][10],
          buyPrice: data[i][11],
          supplyPrice: data[i][12],
          purchaseAmount: data[i][13],
          supplyAmount: data[i][14],
          marginAmount: data[i][15],
          marginRate: data[i][16],
          savedAt: formatDateString(data[i][17])
        });
      }
    }

    return {
      success: true,
      items: items
    };

  } catch (err) {
    Logger.log('[getSettlementDetail Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * ============================================================
 * 6. 내부 헬퍼 함수
 * ============================================================
 */

/**
 * 마감 상세 정보를 마감상세DB에 저장 (내부 함수)
 * @param {string} settlementId - 마감ID
 * @param {Array} items - 품목 배열
 * @param {string} type - 마감 유형 ('PURCHASE' 또는 'SALES')
 * @returns {boolean} 성공 여부
 */
function saveSettlementDetails_(settlementId, items, type) {
  try {
    Logger.log('[saveSettlementDetails_] 시작: ' + settlementId + ', 품목수: ' + items.length);

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_SETTLEMENT_DETAIL_SHEET);

    if (!sheet) {
      // 시트가 없으면 생성
      sheet = ss.insertSheet(OB_SETTLEMENT_DETAIL_SHEET);
      sheet.appendRow([
        '마감ID', '발주번호', '발주일', '품목코드', '제품명', '브랜드',
        '매입처', '발주처', '발주수량', '확정수량', '차이수량',
        '매입가', '공급가', '매입액', '공급액', '마진액', '마진율', '저장일시'
      ]);
    }

    // 기존 해당 마감ID의 상세 데이터 삭제
    var data = sheet.getDataRange().getValues();
    var rowsToDelete = [];

    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === settlementId) {
        rowsToDelete.push(i + 1); // 시트 행 번호 (1-based)
      }
    }

    // 역순으로 삭제 (인덱스 변경 방지)
    for (var j = 0; j < rowsToDelete.length; j++) {
      sheet.deleteRow(rowsToDelete[j]);
    }

    Logger.log('[saveSettlementDetails_] 기존 데이터 ' + rowsToDelete.length + '건 삭제');

    // 새 데이터 추가
    var now = new Date();
    var rowsToAdd = [];

    for (var k = 0; k < items.length; k++) {
      var item = items[k];

      // 매입/매출에 따라 필드명 다름
      var buyPrice = Number(item.buyPrice) || 0;
      var supplyPrice = Number(item.supplyPrice) || 0;
      var confirmedQty = Number(item.confirmedQty) || 0;

      var purchaseAmount = confirmedQty * buyPrice;
      var supplyAmount = confirmedQty * supplyPrice;
      var marginAmount = supplyAmount - purchaseAmount;
      var marginRate = purchaseAmount > 0 ? (marginAmount / purchaseAmount) * 100 : 0;

      rowsToAdd.push([
        settlementId,
        item.orderCode || '',
        item.orderDate || '',
        item.productCode || '',
        item.productName || '',
        item.brand || '',
        item.supplier || '',
        item.buyer || '',
        Number(item.orderQty) || 0,
        confirmedQty,
        Number(item.diffQty) || 0,
        buyPrice,
        supplyPrice,
        purchaseAmount,
        supplyAmount,
        marginAmount,
        marginRate,
        now
      ]);
    }

    if (rowsToAdd.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, 18).setValues(rowsToAdd);
      Logger.log('[saveSettlementDetails_] 새 데이터 ' + rowsToAdd.length + '건 저장 완료');
    }

    return true;

  } catch (err) {
    Logger.log('[saveSettlementDetails_ Error] ' + err.message);
    return false;
  }
}

/**
 * 거래원장의 발주 상태를 업데이트 (내부 함수)
 * @param {Array} orderNumbers - 발주번호 배열
 * @param {string} newStatus - 새 상태 ('SETTLED', 'INVOICED', 'PAID' 등)
 * @returns {boolean} 성공 여부
 */
function updateLedgerStatus_(orderNumbers, newStatus) {
  try {
    if (!orderNumbers || orderNumbers.length === 0) {
      Logger.log('[updateLedgerStatus_] 발주번호가 없습니다.');
      return true; // 빈 배열은 성공으로 처리
    }

    Logger.log('[updateLedgerStatus_] 시작: ' + orderNumbers.length + '건, 상태: ' + newStatus);

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_ORDER_LEDGER_SHEET);

    if (!sheet) {
      Logger.log('[updateLedgerStatus_] 거래원장 시트를 찾을 수 없습니다.');
      return false;
    }

    var data = sheet.getDataRange().getValues();
    var header = data[0];

    // 발주번호 컬럼과 상태 컬럼 찾기
    var orderCodeCol = -1;
    var statusCol = -1;

    for (var i = 0; i < header.length; i++) {
      if (header[i] === '발주번호') orderCodeCol = i;
      if (header[i] === '상태') statusCol = i;
    }

    if (orderCodeCol === -1 || statusCol === -1) {
      Logger.log('[updateLedgerStatus_] 필수 컬럼을 찾을 수 없습니다.');
      return false;
    }

    // 발주번호를 객체로 변환 (빠른 검색용)
    var orderMap = {};
    for (var j = 0; j < orderNumbers.length; j++) {
      orderMap[orderNumbers[j]] = true;
    }

    // 상태 업데이트
    var updateCount = 0;
    for (var k = 1; k < data.length; k++) {
      var orderCode = data[k][orderCodeCol];
      if (orderMap[orderCode]) {
        sheet.getRange(k + 1, statusCol + 1).setValue(newStatus);
        updateCount++;
      }
    }

    Logger.log('[updateLedgerStatus_] 완료: ' + updateCount + '건 업데이트');
    return true;

  } catch (err) {
    Logger.log('[updateLedgerStatus_ Error] ' + err.message);
    return false;
  }
}
