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
 * 마감 ID로부터 발주번호 목록 조회
 * @param {string} settlementId - 마감ID
 * @returns {Array} 발주번호 배열
 */
function getOrderNumbersFromSettlement(settlementId) {
  try {
    if (!settlementId || settlementId === '') {
      return [];
    }

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var detailSheet = ss.getSheetByName(OB_SETTLEMENT_DETAIL_SHEET);

    if (!detailSheet) {
      Logger.log('[getOrderNumbersFromSettlement] 마감상세DB 시트를 찾을 수 없습니다.');
      return [];
    }

    var data = detailSheet.getDataRange().getValues();
    var headers = data[0];

    // 컬럼 인덱스 찾기
    var settlementIdCol = headers.indexOf('마감ID');
    var orderNumberCol = headers.indexOf('발주번호');

    if (settlementIdCol === -1 || orderNumberCol === -1) {
      Logger.log('[getOrderNumbersFromSettlement] 필요한 컬럼을 찾을 수 없습니다.');
      return [];
    }

    // 해당 마감ID의 발주번호들 수집
    var orderNumbers = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][settlementIdCol] === settlementId) {
        var orderNumber = data[i][orderNumberCol];
        if (orderNumber && orderNumber !== '') {
          orderNumbers.push(orderNumber);
        }
      }
    }

    Logger.log('[getOrderNumbersFromSettlement] 마감ID: ' + settlementId + ', 발주번호 개수: ' + orderNumbers.length);
    return orderNumbers;

  } catch (err) {
    Logger.log('[getOrderNumbersFromSettlement Error] ' + err.message);
    return [];
  }
}

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

    // 필수 정보 검증 (settlementId는 선택사항 - 직접 청구서인 경우 없을 수 있음)
    if (!type || !company) {
      return {
        success: false,
        error: '필수 정보를 입력해주세요 (청구유형, 업체명).'
      };
    }

    // 청구유형 값 검증 - SALES/PURCHASE만 허용
    if (type !== 'SALES' && type !== 'PURCHASE') {
      return {
        success: false,
        error: '청구유형은 "SALES" 또는 "PURCHASE"만 허용됩니다. 현재 값: "' + type + '"'
      };
    }

    var standardizedType = type;

    // billingType 결정 (마감ID 기반 청구서는 "SETTLEMENT", 직접 생성은 "DIRECT")
    var billingType = (settlementId && settlementId !== '') ? 'SETTLEMENT' : 'DIRECT';

    // 발주번호 목록 결정
    var orderNumbers = [];
    if (params.orderNumbers && params.orderNumbers.length > 0) {
      // 1. 파라미터로 orderNumbers가 직접 전달된 경우 (직접 청구서)
      orderNumbers = params.orderNumbers;
      Logger.log('[createBilling] orderNumbers 직접 전달: ' + JSON.stringify(orderNumbers));
    } else if (settlementId && settlementId !== '') {
      // 2. settlementId로 orderNumbers 조회 (마감 기반 청구서)
      orderNumbers = getOrderNumbersFromSettlement(settlementId);
      Logger.log('[createBilling] settlementId로 orderNumbers 조회: ' + JSON.stringify(orderNumbers));
    }
    var orderNumbersJson = JSON.stringify(orderNumbers);

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_BILLING_SHEET);

    if (!sheet) {
      return {
        success: false,
        error: '청구DB 시트를 찾을 수 없습니다. SetupPaymentSheets.js를 먼저 실행하세요.'
      };
    }

    // 기존 헤더 읽기
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    Logger.log('[createBilling] 청구DB 헤더: ' + headers.join(', '));

    // 청구 ID 생성: INV-YYYYMMDD-순번
    var today = new Date();
    var year = today.getFullYear();
    var month = String(today.getMonth() + 1).padStart(2, '0');
    var day = String(today.getDate()).padStart(2, '0');
    var dateStr = year + month + day;

    var data = sheet.getDataRange().getValues();
    var count = 1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].startsWith('INV-' + dateStr)) {
        count++;
      }
    }
    var billingId = 'INV-' + dateStr + '-' + String(count).padStart(3, '0');

    var now = new Date();
    var user = Session.getActiveUser().getEmail();

    // 헤더에 맞춰 rowData 동적 구성
    var rowData = [];
    for (var h = 0; h < headers.length; h++) {
      var headerName = headers[h];

      switch(headerName) {
        case '청구ID':
          rowData.push(billingId);
          break;
        case '청구유형':
          rowData.push(standardizedType);
          break;
        case '업체명':
          rowData.push(company);
          break;
        case '마감ID':
          rowData.push(settlementId);
          break;
        case '청구일':
          rowData.push(billingDate);
          break;
        case '청구금액':
          rowData.push(amount);
          break;
        case '청구상태':
          rowData.push('DRAFT');
          break;
        case '청구타입':
          // H열 - 용도 불명, 일단 빈 값
          rowData.push('');
          break;
        case '비고':
          rowData.push(notes);
          break;
        case '발주번호':
          // 레거시 컬럼 - orderNumbers와 동일한 값
          rowData.push(orderNumbersJson);
          break;
        case '생성일시':
          rowData.push(now);
          break;
        case '생성자':
          rowData.push(user);
          break;
        case 'billingType':
          rowData.push(billingType);
          break;
        case 'orderNumbers':
          rowData.push(orderNumbersJson);
          break;
        default:
          // 발행일시, 발행자, 결제일시, 대체청구서, 원본청구서 등
          rowData.push('');
          break;
      }
    }

    Logger.log('[createBilling] rowData 길이: ' + rowData.length + ', 헤더 길이: ' + headers.length);

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
    var headers = data[0];
    var billings = [];

    // 헤더 기반 컬럼 인덱스 매핑
    var colMap = {};
    headers.forEach(function(h, idx) {
      colMap[h] = idx;
    });

    var parseDate = function(d) {
      if (!d) return null;
      if (d instanceof Date) return d;
      return new Date(d);
    };

    var start = startDate ? parseDate(startDate) : null;
    var end = endDate ? parseDate(endDate) : null;

    Logger.log('[getBillings] 필터 조건 - type: ' + type + ', company: ' + company + ', status: ' + status);
    Logger.log('[getBillings] 날짜 범위 - start: ' + startDate + ', end: ' + endDate);
    Logger.log('[getBillings] 데이터 행 수: ' + (data.length - 1));

    // 필수 컬럼 인덱스 (없으면 폴백)
    var idxBillingId = colMap['청구ID'] !== undefined ? colMap['청구ID'] : 0;
    var idxType = colMap['청구유형'] !== undefined ? colMap['청구유형'] : 1;
    var idxCompany = colMap['업체명'] !== undefined ? colMap['업체명'] : 2;
    var idxSettlementId = colMap['마감ID'] !== undefined ? colMap['마감ID'] : 3;
    var idxBillingDate = colMap['청구일'] !== undefined ? colMap['청구일'] : 4;
    var idxAmount = colMap['청구금액'] !== undefined ? colMap['청구금액'] : 5;
    var idxStatus = colMap['청구상태'] !== undefined ? colMap['청구상태'] : 6;
    var idxNotes = colMap['비고'] !== undefined ? colMap['비고'] : (colMap['notes'] || 9);
    var idxCreatedAt = colMap['생성일시'] !== undefined ? colMap['생성일시'] : (colMap['createdAt'] || 10);
    var idxCreatedBy = colMap['생성자'] !== undefined ? colMap['생성자'] : (colMap['createdBy'] || 11);
    var idxIssuedAt = colMap['발행일시'] !== undefined ? colMap['발행일시'] : (colMap['issuedAt'] || 12);
    var idxIssuedBy = colMap['발행자'] !== undefined ? colMap['발행자'] : (colMap['issuedBy'] || 13);
    var idxPaidAt = colMap['결제일시'] !== undefined ? colMap['결제일시'] : (colMap['paidAt'] || 14);

    // 신규 컬럼 (Phase 5)
    var idxOrderNumbers = colMap['orderNumbers'];
    var idxPaidAmount = colMap['결제완료금액'];
    var idxRemainingBalance = colMap['미수금'];
    var idxChangeHistory = colMap['변경이력'];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      // 빈 행 건너뛰기 (청구ID가 없는 행)
      if (!row[idxBillingId]) continue;

      // 타입 필터
      if (type && row[idxType] !== type) continue;

      // 거래처 필터
      if (company && String(row[idxCompany] || '').indexOf(company) === -1) continue;

      // 상태 필터
      if (status && row[idxStatus] !== status) continue;

      // 날짜 필터 (billingDate가 없거나 파싱 실패시 필터 통과)
      if (start || end) {
        var billingDate = parseDate(row[idxBillingDate]);
        if (billingDate) {
          if (start && billingDate < start) continue;
          if (end && billingDate > end) continue;
        }
        // billingDate가 없는 경우 필터 통과 (데이터 손실 방지)
      }

      var billing = {
        billingId: row[idxBillingId],
        type: row[idxType],
        company: row[idxCompany],
        settlementId: row[idxSettlementId],
        billingDate: formatDateString(row[idxBillingDate]),
        amount: Number(row[idxAmount]) || 0,
        status: row[idxStatus],
        notes: row[idxNotes] || '',
        createdAt: formatDateString(row[idxCreatedAt]),
        createdBy: row[idxCreatedBy] || '',
        issuedAt: formatDateString(row[idxIssuedAt]),
        issuedBy: row[idxIssuedBy] || '',
        paidAt: formatDateString(row[idxPaidAt])
      };

      // 신규 필드 추가 (Phase 5)
      if (idxOrderNumbers !== undefined) {
        billing.orderNumbers = row[idxOrderNumbers] || '[]';
      }
      if (idxPaidAmount !== undefined) {
        billing.paidAmount = Number(row[idxPaidAmount]) || 0;
      }
      if (idxRemainingBalance !== undefined) {
        billing.remainingBalance = Number(row[idxRemainingBalance]) || 0;
      }
      if (idxChangeHistory !== undefined) {
        billing.changeHistory = row[idxChangeHistory] || '[]';
      }

      billings.push(billing);
    }

    Logger.log('[getBillings] 조회 결과: ' + billings.length + '건');

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
    sheet.getRange(rowIndex, 7).setValue(status);

    // ISSUED로 변경 시 발행 정보 기록
    if (status === 'ISSUED') {
      sheet.getRange(rowIndex, 11).setValue(now);
      sheet.getRange(rowIndex, 12).setValue(user);
    }

    // PAID로 변경 시 결제 일시 기록
    if (status === 'PAID') {
      sheet.getRange(rowIndex, 13).setValue(now);
    }

    // PAID_PARTIAL (부분 결제) 상태는 addPaymentRecord에서 자동으로 설정됨
    // 수동으로 PAID_PARTIAL 상태로 변경할 경우에도 지원
    if (status === 'PAID_PARTIAL') {
      Logger.log('[updateBillingStatus] 부분 결제 상태로 변경됨. 결제완료금액과 미수금은 별도로 업데이트해야 합니다.');
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
 * 일괄 청구서 데이터 집계
 * @param {Object} params - { company, startDate, endDate }
 * @returns {Object} - 집계 결과
 */
function aggregateInvoiceData(params) {
  try {
    var company = params.company || '';
    var startDate = params.startDate || '';
    var endDate = params.endDate || '';

    Logger.log('[aggregateInvoiceData] 시작 - 거래처:' + company + ', 기간:' + startDate + '~' + endDate);

    if (!company) {
      return {
        success: false,
        error: '거래처를 입력해주세요.'
      };
    }

    // 거래원장 데이터 로드
    var sheet = getOrderMergedSheet();
    if (!sheet) {
      return {
        success: false,
        error: '거래원장 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return {
        success: false,
        error: '거래원장에 데이터가 없습니다.'
      };
    }

    var headers = data[0];
    var rows = data.slice(1);

    // 컬럼 인덱스 찾기
    var idx발주번호 = headers.indexOf('발주번호');
    var idx발주일 = headers.indexOf('발주일');
    var idx발주처 = headers.indexOf('발주처');
    var idx매입처 = headers.indexOf('매입처');
    var idx브랜드 = headers.indexOf('브랜드');
    var idx제품명 = headers.indexOf('제품명');
    var idx품목코드 = headers.indexOf('품목코드');
    var idx발주수량 = headers.indexOf('발주수량');
    var idx확정수량 = headers.indexOf('확정수량');
    var idx공급가 = headers.indexOf('공급가');

    Logger.log('[aggregateInvoiceData] 컬럼 인덱스 - 발주처:' + idx발주처 + ', 발주일:' + idx발주일);

    // 날짜 필터링을 위한 Date 객체 생성
    var filterStartDate = startDate ? new Date(startDate) : null;
    var filterEndDate = endDate ? new Date(endDate) : null;

    if (filterEndDate) {
      filterEndDate.setHours(23, 59, 59, 999); // 종료일 23:59:59까지 포함
    }

    // 필터링 및 집계
    var items = [];
    var totalItems = 0;
    var totalOrderQty = 0;
    var totalConfirmedQty = 0;
    var totalAmount = 0;

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];

      // 발주처 필터
      var 발주처 = String(row[idx발주처] || '');
      if (발주처.indexOf(company) === -1) continue;

      // 기간 필터
      var 발주일 = row[idx발주일];
      if (발주일) {
        var 발주일Date = 발주일 instanceof Date ? 발주일 : new Date(발주일);
        
        if (filterStartDate && 발주일Date < filterStartDate) continue;
        if (filterEndDate && 발주일Date > filterEndDate) continue;
      }

      // 데이터 추출
      var 발주수량 = Number(row[idx발주수량]) || 0;
      var 확정수량 = Number(row[idx확정수량]) || 0;
      var 공급가 = Number(row[idx공급가]) || 0;
      var 공급액 = 확정수량 * 공급가;

      items.push({
        orderCode: String(row[idx발주번호] || ''),
        orderDate: formatDateString(발주일),
        supplier: String(row[idx매입처] || ''),
        brand: String(row[idx브랜드] || ''),
        productName: String(row[idx제품명] || ''),
        productCode: String(row[idx품목코드] || ''),
        orderQty: 발주수량,
        confirmedQty: 확정수량,
        supplyPrice: 공급가,
        supplyAmount: 공급액
      });

      totalItems++;
      totalOrderQty += 발주수량;
      totalConfirmedQty += 확정수량;
      totalAmount += 공급액;
    }

    Logger.log('[aggregateInvoiceData] 완료 - 품목수:' + totalItems + ', 총 금액:' + totalAmount);

    return {
      success: true,
      items: items,
      totalItems: totalItems,
      totalOrderQty: totalOrderQty,
      totalConfirmedQty: totalConfirmedQty,
      totalAmount: totalAmount
    };

  } catch (error) {
    Logger.log('[aggregateInvoiceData] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * ============================================================
 * 청구서 금액 동기화 및 변경이력 관리
 * ============================================================
 */

/**
 * 발주번호 목록으로 거래원장에서 총 금액 계산
 * @param {string[]} orderNumbers - 발주번호 배열
 * @returns {Object} { success, totalAmount, details }
 */
function calculateAmountFromLedger(orderNumbers) {
  try {
    if (!orderNumbers || orderNumbers.length === 0) {
      return { success: false, error: '발주번호가 없습니다.', totalAmount: 0 };
    }

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_ORDER_LEDGER_SHEET);

    if (!sheet) {
      return { success: false, error: '거래원장 시트를 찾을 수 없습니다.', totalAmount: 0 };
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    var idx발주번호 = headers.indexOf('발주번호');
    var idx확정수량 = headers.indexOf('확정수량');
    var idx공급가 = headers.indexOf('공급가');

    if (idx발주번호 === -1 || idx확정수량 === -1 || idx공급가 === -1) {
      return { success: false, error: '필요한 컬럼을 찾을 수 없습니다.', totalAmount: 0 };
    }

    var totalAmount = 0;
    var details = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var 발주번호 = String(row[idx발주번호] || '');

      if (orderNumbers.indexOf(발주번호) !== -1) {
        var 확정수량 = Number(row[idx확정수량]) || 0;
        var 공급가 = Number(row[idx공급가]) || 0;
        var 공급액 = 확정수량 * 공급가;

        totalAmount += 공급액;
        details.push({
          orderNumber: 발주번호,
          confirmedQty: 확정수량,
          supplyPrice: 공급가,
          amount: 공급액
        });
      }
    }

    Logger.log('[calculateAmountFromLedger] 발주 ' + orderNumbers.length + '건, 총 금액: ' + totalAmount);

    return {
      success: true,
      totalAmount: totalAmount,
      details: details
    };

  } catch (error) {
    Logger.log('[calculateAmountFromLedger] ❌ 오류: ' + error.message);
    return { success: false, error: error.message, totalAmount: 0 };
  }
}

/**
 * 청구서 ID로 청구서 정보 조회
 * @param {string} billingId - 청구서 ID
 * @returns {Object|null} 청구서 정보 또는 null
 */
function getBillingById(billingId) {
  try {
    if (!billingId) return null;

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_BILLING_SHEET);

    if (!sheet) return null;

    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    var colMap = {};
    headers.forEach(function(h, idx) {
      colMap[h] = idx;
    });

    for (var i = 1; i < data.length; i++) {
      if (data[i][colMap['청구ID']] === billingId) {
        var billing = {
          rowIndex: i + 1,
          billingId: data[i][colMap['청구ID']],
          type: data[i][colMap['청구유형']],
          company: data[i][colMap['업체명']],
          billingDate: data[i][colMap['청구일']],
          amount: Number(data[i][colMap['청구금액']]) || 0,
          status: data[i][colMap['청구상태']],
          orderNumbers: data[i][colMap['orderNumbers']] || '[]',
          paidAmount: Number(data[i][colMap['결제완료금액']]) || 0,
          remainingBalance: Number(data[i][colMap['미수금']]) || 0,
          changeHistory: data[i][colMap['변경이력']] || '[]'
        };

        // orderNumbers JSON 파싱
        try {
          if (typeof billing.orderNumbers === 'string') {
            billing.orderNumbersArray = JSON.parse(billing.orderNumbers);
          } else {
            billing.orderNumbersArray = [];
          }
        } catch (e) {
          billing.orderNumbersArray = [];
        }

        return billing;
      }
    }

    return null;

  } catch (error) {
    Logger.log('[getBillingById] ❌ 오류: ' + error.message);
    return null;
  }
}

/**
 * 청구서 금액 동기화 (거래원장 기준)
 * @param {string} billingId - 청구서 ID
 * @param {number} newAmount - 새 금액 (거래원장 계산값)
 * @returns {Object} { success, updated, changeLog }
 */
function syncBillingAmount(billingId, newAmount) {
  try {
    Logger.log('[syncBillingAmount] 시작 - billingId: ' + billingId + ', newAmount: ' + newAmount);

    if (!billingId) {
      return { success: false, error: '청구서 ID가 없습니다.', updated: false };
    }

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_BILLING_SHEET);

    if (!sheet) {
      return { success: false, error: '청구DB 시트를 찾을 수 없습니다.', updated: false };
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    var colMap = {};
    headers.forEach(function(h, idx) {
      colMap[h] = idx;
    });

    // 필수 컬럼 확인
    if (colMap['청구ID'] === undefined || colMap['청구금액'] === undefined) {
      return { success: false, error: '필수 컬럼을 찾을 수 없습니다.', updated: false };
    }

    // 청구서 행 찾기
    var billingRowIndex = -1;
    var currentAmount = 0;
    var currentPaidAmount = 0;
    var currentHistory = '[]';

    for (var i = 1; i < data.length; i++) {
      if (data[i][colMap['청구ID']] === billingId) {
        billingRowIndex = i + 1; // 1-based row index
        currentAmount = Number(data[i][colMap['청구금액']]) || 0;
        currentPaidAmount = Number(data[i][colMap['결제완료금액']]) || 0;
        if (colMap['변경이력'] !== undefined) {
          currentHistory = data[i][colMap['변경이력']] || '[]';
        }
        break;
      }
    }

    if (billingRowIndex === -1) {
      return { success: false, error: '청구서를 찾을 수 없습니다.', updated: false };
    }

    // 금액 비교
    if (currentAmount === newAmount) {
      Logger.log('[syncBillingAmount] 금액 동일 - 업데이트 불필요');
      return { success: true, updated: false, message: '금액이 동일하여 업데이트하지 않았습니다.' };
    }

    // 변경이력 추가
    var historyArray = [];
    try {
      historyArray = JSON.parse(currentHistory);
      if (!Array.isArray(historyArray)) historyArray = [];
    } catch (e) {
      historyArray = [];
    }

    var now = new Date();
    var user = Session.getActiveUser().getEmail() || 'system';

    historyArray.push({
      date: Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      before: currentAmount,
      after: newAmount,
      by: user
    });

    // 미수금 재계산
    var newRemainingBalance = Math.max(0, newAmount - currentPaidAmount);

    // 청구DB 업데이트
    sheet.getRange(billingRowIndex, colMap['청구금액'] + 1).setValue(newAmount);

    if (colMap['미수금'] !== undefined) {
      sheet.getRange(billingRowIndex, colMap['미수금'] + 1).setValue(newRemainingBalance);
    }

    if (colMap['변경이력'] !== undefined) {
      sheet.getRange(billingRowIndex, colMap['변경이력'] + 1).setValue(JSON.stringify(historyArray));
    }

    Logger.log('[syncBillingAmount] ✅ 금액 동기화 완료: ' + currentAmount + ' → ' + newAmount);

    return {
      success: true,
      updated: true,
      changeLog: {
        before: currentAmount,
        after: newAmount,
        newRemainingBalance: newRemainingBalance,
        date: Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
      }
    };

  } catch (error) {
    Logger.log('[syncBillingAmount] ❌ 오류: ' + error.message);
    return { success: false, error: error.message, updated: false };
  }
}

/**
 * 청구서 금액을 거래원장 기준으로 재계산하여 동기화
 * - SALES 유형: 공급액 기준
 * - PURCHASE 유형: 매입가 기준
 * @param {string} billingId - 청구서 ID
 * @returns {Object} { success, updated, changeLog }
 */
function syncBillingAmountFromLedger(billingId) {
  try {
    Logger.log('[syncBillingAmountFromLedger] 시작 - billingId: ' + billingId);

    if (!billingId) {
      return { success: false, error: '청구서 ID가 없습니다.' };
    }

    // 1. 청구서 정보 조회
    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_BILLING_SHEET);

    if (!sheet) {
      return { success: false, error: '청구DB 시트를 찾을 수 없습니다.' };
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    var colMap = {};
    headers.forEach(function(h, idx) {
      colMap[h] = idx;
    });

    // 청구서 행 찾기
    var billingRow = null;
    for (var i = 1; i < data.length; i++) {
      if (data[i][colMap['청구ID']] === billingId) {
        billingRow = data[i];
        break;
      }
    }

    if (!billingRow) {
      return { success: false, error: '청구서를 찾을 수 없습니다: ' + billingId };
    }

    var billingType = billingRow[colMap['청구유형']] || 'SALES';
    var billingStatus = billingRow[colMap['청구상태']] || '';
    var orderNumbersStr = billingRow[colMap['orderNumbers']] || '';

    // 2. LOCKED 상태 체크
    if (billingStatus === 'LOCKED') {
      return { success: false, error: '마감된 청구서는 금액을 수정할 수 없습니다.' };
    }

    // 3. 발주번호 파싱
    var orderNumbers = [];
    if (orderNumbersStr) {
      try {
        orderNumbers = JSON.parse(orderNumbersStr);
        if (!Array.isArray(orderNumbers)) orderNumbers = [];
      } catch (e) {
        orderNumbers = orderNumbersStr.split(',').map(function(s) { return s.trim(); });
      }
    }

    if (orderNumbers.length === 0) {
      return { success: false, error: '연결된 발주번호가 없습니다.' };
    }

    // 4. 금액 재계산 (유형에 따라)
    var calcResult;
    if (billingType === 'PURCHASE') {
      calcResult = calculatePurchaseAmountFromLedger(orderNumbers);
    } else {
      calcResult = calculateAmountFromLedger(orderNumbers);
    }

    if (!calcResult.success) {
      return { success: false, error: calcResult.error };
    }

    var newAmount = calcResult.totalAmount || 0;

    // 5. 금액 동기화
    var syncResult = syncBillingAmount(billingId, newAmount);

    Logger.log('[syncBillingAmountFromLedger] 완료 - 유형: ' + billingType + ', 새 금액: ' + newAmount);

    return syncResult;

  } catch (error) {
    Logger.log('[syncBillingAmountFromLedger] ❌ 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 발주번호로 연결된 청구서 ID 조회
 * @param {string[]} orderNumbers - 발주번호 배열
 * @returns {string|null} 청구서 ID 또는 null
 */
function findBillingByOrderNumbers(orderNumbers) {
  try {
    if (!orderNumbers || orderNumbers.length === 0) return null;

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_BILLING_SHEET);

    if (!sheet) return null;

    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    var colBillingId = headers.indexOf('청구ID');
    var colOrderNumbers = headers.indexOf('orderNumbers');
    var colStatus = headers.indexOf('청구상태');

    if (colBillingId === -1 || colOrderNumbers === -1) return null;

    // 발주번호 정렬하여 비교
    var sortedInput = orderNumbers.slice().sort().join(',');

    for (var i = 1; i < data.length; i++) {
      var status = data[i][colStatus] || '';
      // 취소된 청구서는 제외
      if (status === 'CANCELLED') continue;

      var storedOrderNumbers = data[i][colOrderNumbers] || '[]';
      try {
        var parsedNumbers = JSON.parse(storedOrderNumbers);
        if (Array.isArray(parsedNumbers)) {
          var sortedStored = parsedNumbers.slice().sort().join(',');
          if (sortedInput === sortedStored) {
            return data[i][colBillingId];
          }
        }
      } catch (e) {
        continue;
      }
    }

    return null;

  } catch (error) {
    Logger.log('[findBillingByOrderNumbers] ❌ 오류: ' + error.message);
    return null;
  }
}

/**
 * ============================================================
 * 지급요청서 (PURCHASE) 관련 함수
 * ============================================================
 */

/**
 * 거래원장에서 매입가 기준 금액 계산
 * @param {string[]} orderNumbers - 발주번호 배열
 * @returns {Object} { success, totalAmount, details }
 */
function calculatePurchaseAmountFromLedger(orderNumbers) {
  try {
    if (!orderNumbers || orderNumbers.length === 0) {
      return { success: false, error: '발주번호가 없습니다.', totalAmount: 0 };
    }

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_ORDER_LEDGER_SHEET);

    if (!sheet) {
      return { success: false, error: '거래원장 시트를 찾을 수 없습니다.', totalAmount: 0 };
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    var idx발주번호 = headers.indexOf('발주번호');
    var idx확정수량 = headers.indexOf('확정수량');
    var idx매입가 = headers.indexOf('매입가');
    var idx품목코드 = headers.indexOf('품목코드');
    var idx제품명 = headers.indexOf('제품명');
    var idx매입처 = headers.indexOf('매입처');

    if (idx발주번호 === -1 || idx확정수량 === -1 || idx매입가 === -1) {
      return { success: false, error: '필요한 컬럼을 찾을 수 없습니다.', totalAmount: 0 };
    }

    var totalAmount = 0;
    var totalQty = 0;
    var details = [];
    var supplier = '';

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var 발주번호 = String(row[idx발주번호] || '');

      if (orderNumbers.indexOf(발주번호) !== -1) {
        var 확정수량 = Number(row[idx확정수량]) || 0;
        var 매입가 = Number(row[idx매입가]) || 0;
        var 매입액 = 확정수량 * 매입가;

        totalAmount += 매입액;
        totalQty += 확정수량;

        if (!supplier && row[idx매입처]) {
          supplier = row[idx매입처];
        }

        details.push({
          orderNumber: 발주번호,
          productCode: row[idx품목코드] || '',
          productName: row[idx제품명] || '',
          confirmedQty: 확정수량,
          buyPrice: 매입가,
          amount: 매입액
        });
      }
    }

    Logger.log('[calculatePurchaseAmountFromLedger] 발주 ' + orderNumbers.length + '건, 총 매입액: ' + totalAmount);

    return {
      success: true,
      totalAmount: totalAmount,
      totalQty: totalQty,
      itemCount: details.length,
      supplier: supplier,
      details: details
    };

  } catch (error) {
    Logger.log('[calculatePurchaseAmountFromLedger] ❌ 오류: ' + error.message);
    return { success: false, error: error.message, totalAmount: 0 };
  }
}

/**
 * 지급요청서 생성
 * @param {Object} params - { supplier, orderNumbers, requestDate, notes }
 * @returns {Object} 생성 결과
 */
function createPaymentRequest(params) {
  try {
    var supplier = params.supplier || '';
    var orderNumbers = params.orderNumbers || [];
    var requestDate = params.requestDate || new Date();
    var notes = params.notes || '';

    if (!supplier) {
      return { success: false, error: '매입처를 입력해주세요.' };
    }

    if (!orderNumbers || orderNumbers.length === 0) {
      return { success: false, error: '발주번호를 선택해주세요.' };
    }

    // 1. 매입가 기준 금액 계산
    var calcResult = calculatePurchaseAmountFromLedger(orderNumbers);
    if (!calcResult.success) {
      return { success: false, error: calcResult.error };
    }

    // 2. 청구DB에 저장 (PURCHASE 유형, REQUESTED 상태)
    var billingResult = createBilling({
      type: 'PURCHASE',
      company: supplier,
      orderNumbers: orderNumbers,
      amount: calcResult.totalAmount,
      billingDate: requestDate,
      notes: notes
    });

    if (!billingResult.success) {
      return { success: false, error: billingResult.error };
    }

    // 3. 상태를 REQUESTED로 변경
    var statusResult = updateBillingStatus({
      billingId: billingResult.billingId,
      status: 'REQUESTED'
    });

    Logger.log('[createPaymentRequest] ✅ 지급요청서 생성: ' + billingResult.billingId);

    return {
      success: true,
      billingId: billingResult.billingId,
      totalAmount: calcResult.totalAmount,
      totalQty: calcResult.totalQty,
      itemCount: calcResult.itemCount,
      message: '지급요청서가 생성되었습니다.'
    };

  } catch (error) {
    Logger.log('[createPaymentRequest] ❌ 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * ============================================================
 * 월마감 로직 변경 (청구DB 대상, 발생주의)
 * ============================================================
 */

/**
 * 해당 월의 청구서/지급요청서 조회
 * @param {string} yearMonth - YYYYMM 형식
 * @returns {Array} 청구서 목록
 */
function getBillingsForMonth(yearMonth) {
  try {
    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_BILLING_SHEET);

    if (!sheet) {
      return [];
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    var colMap = {};
    headers.forEach(function(h, idx) {
      colMap[h] = idx;
    });

    var billings = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var billingId = row[colMap['청구ID']];
      if (!billingId) continue;

      // 청구일 기준으로 해당 월 필터링
      var billingDate = row[colMap['청구일']];
      if (!billingDate) continue;

      var rowYearMonth = formatYearMonth(billingDate);
      if (rowYearMonth !== yearMonth) continue;

      billings.push({
        rowIndex: i + 1,
        billingId: billingId,
        type: row[colMap['청구유형']] || '',
        company: row[colMap['업체명']] || '',
        billingDate: billingDate,
        amount: Number(row[colMap['청구금액']]) || 0,
        status: row[colMap['청구상태']] || '',
        paidAmount: Number(row[colMap['결제완료금액']]) || 0,
        remainingBalance: Number(row[colMap['미수금']]) || 0,
        orderNumbers: row[colMap['orderNumbers']] || '[]'
      });
    }

    Logger.log('[getBillingsForMonth] ' + yearMonth + ' 청구서 ' + billings.length + '건 조회');
    return billings;

  } catch (error) {
    Logger.log('[getBillingsForMonth] ❌ 오류: ' + error.message);
    return [];
  }
}

/**
 * 기간 범위의 청구서/지급요청서 조회 (V3)
 * @param {Object} params - { startMonth, endMonth, company }
 * @returns {Object} { success, billings, status }
 */
function getBillingsForPeriod(params) {
  try {
    var startMonth = params.startMonth; // YYYYMM
    var endMonth = params.endMonth; // YYYYMM
    var companyFilter = (params.company || '').trim();

    Logger.log('[getBillingsForPeriod] 기간 조회: ' + startMonth + ' ~ ' + endMonth + ', 거래처: ' + (companyFilter || '전체'));

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_BILLING_SHEET);

    if (!sheet) {
      return { success: false, error: '청구DB 시트를 찾을 수 없습니다.' };
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    var colMap = {};
    headers.forEach(function(h, idx) {
      colMap[h] = idx;
    });

    var billings = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var billingId = row[colMap['청구ID']];
      if (!billingId) continue;

      // 청구일 기준 기간 필터링
      var billingDate = row[colMap['청구일']];
      if (!billingDate) continue;

      var rowYearMonth = formatYearMonth(billingDate);
      if (rowYearMonth < startMonth || rowYearMonth > endMonth) continue;

      // 거래처 필터
      var company = row[colMap['업체명']] || '';
      if (companyFilter && company.indexOf(companyFilter) === -1) continue;

      // DRAFT 제외 (발생주의)
      var status = row[colMap['청구상태']] || '';
      if (status === 'DRAFT') continue;

      billings.push({
        rowIndex: i + 1,
        billingId: billingId,
        type: row[colMap['청구유형']] || 'SALES',
        company: company,
        billingDate: billingDate,
        amount: Number(row[colMap['청구금액']]) || 0,
        status: status,
        paidAmount: Number(row[colMap['결제완료금액']]) || 0,
        remainingBalance: Number(row[colMap['미수금']]) || 0,
        orderNumbers: row[colMap['orderNumbers']] || '[]',
        previousStatus: row[colMap['이전상태']] || ''
      });
    }

    // 단일 월인 경우 마감 상태 확인
    var closingStatus = 'OPEN';
    if (startMonth === endMonth) {
      var closingSheet = ss.getSheetByName(OB_MONTHLY_CLOSING_SHEET);
      if (closingSheet) {
        var closingData = closingSheet.getDataRange().getValues();
        for (var j = 1; j < closingData.length; j++) {
          if (closingData[j][0] === startMonth) {
            closingStatus = closingData[j][1] || 'OPEN';
            break;
          }
        }
      }
    }

    Logger.log('[getBillingsForPeriod] 조회 완료: ' + billings.length + '건');

    return {
      success: true,
      billings: billings,
      status: closingStatus,
      startMonth: startMonth,
      endMonth: endMonth
    };

  } catch (error) {
    Logger.log('[getBillingsForPeriod] ❌ 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 해당 월 청구서들 LOCKED 처리
 * @param {string} yearMonth - YYYYMM 형식
 * @returns {Object} 처리 결과
 */
function lockBillingsForMonth(yearMonth) {
  try {
    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_BILLING_SHEET);

    if (!sheet) {
      return { success: false, error: '청구DB 시트를 찾을 수 없습니다.' };
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    var colMap = {};
    headers.forEach(function(h, idx) {
      colMap[h] = idx;
    });

    var idxStatus = colMap['청구상태'];
    var idxBillingDate = colMap['청구일'];
    var idxPrevStatus = colMap['이전상태'];

    // 이전상태 컬럼이 없으면 추가
    if (idxPrevStatus === undefined) {
      var lastCol = headers.length + 1;
      sheet.getRange(1, lastCol).setValue('이전상태');
      idxPrevStatus = lastCol - 1;
    }

    var lockedCount = 0;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var billingId = row[colMap['청구ID']];
      if (!billingId) continue;

      var billingDate = row[colMap['청구일']];
      if (!billingDate) continue;

      var rowYearMonth = formatYearMonth(billingDate);
      if (rowYearMonth !== yearMonth) continue;

      var currentStatus = row[idxStatus] || '';

      // DRAFT는 제외, 이미 LOCKED면 스킵
      if (currentStatus === 'DRAFT' || currentStatus === 'LOCKED') continue;

      // 이전 상태 저장 후 LOCKED로 변경
      sheet.getRange(i + 1, idxPrevStatus + 1).setValue(currentStatus);
      sheet.getRange(i + 1, idxStatus + 1).setValue('LOCKED');
      lockedCount++;
    }

    Logger.log('[lockBillingsForMonth] ' + yearMonth + ' ' + lockedCount + '건 LOCKED 처리');

    return {
      success: true,
      lockedCount: lockedCount
    };

  } catch (error) {
    Logger.log('[lockBillingsForMonth] ❌ 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 해당 월 청구서들 LOCKED 해제
 * @param {string} yearMonth - YYYYMM 형식
 * @returns {Object} 처리 결과
 */
function unlockBillingsForMonth(yearMonth) {
  try {
    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_BILLING_SHEET);

    if (!sheet) {
      return { success: false, error: '청구DB 시트를 찾을 수 없습니다.' };
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    var colMap = {};
    headers.forEach(function(h, idx) {
      colMap[h] = idx;
    });

    var idxStatus = colMap['청구상태'];
    var idxBillingDate = colMap['청구일'];
    var idxType = colMap['청구유형'];
    var idxPrevStatus = colMap['이전상태'];

    var unlockedCount = 0;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var billingId = row[colMap['청구ID']];
      if (!billingId) continue;

      var billingDate = row[colMap['청구일']];
      if (!billingDate) continue;

      var rowYearMonth = formatYearMonth(billingDate);
      if (rowYearMonth !== yearMonth) continue;

      var currentStatus = row[idxStatus] || '';

      // LOCKED 상태만 해제
      if (currentStatus !== 'LOCKED') continue;

      // 이전 상태로 복원 (없으면 유형에 따라 기본값)
      var prevStatus = '';
      if (idxPrevStatus !== undefined) {
        prevStatus = row[idxPrevStatus] || '';
      }

      if (!prevStatus) {
        var type = row[idxType] || '';
        prevStatus = (type === 'PURCHASE') ? 'REQUESTED' : 'ISSUED';
      }

      sheet.getRange(i + 1, idxStatus + 1).setValue(prevStatus);
      unlockedCount++;
    }

    Logger.log('[unlockBillingsForMonth] ' + yearMonth + ' ' + unlockedCount + '건 LOCKED 해제');

    return {
      success: true,
      unlockedCount: unlockedCount
    };

  } catch (error) {
    Logger.log('[unlockBillingsForMonth] ❌ 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 월마감 실행 (청구DB 대상, 발생주의)
 * @param {Object} params - { yearMonth }
 * @returns {Object} 마감 결과
 */
function executeMonthlyClosingV2(params) {
  try {
    var yearMonth = params.yearMonth || '';

    if (!yearMonth) {
      return { success: false, error: '마감 월을 선택해주세요.' };
    }

    Logger.log('[executeMonthlyClosingV2] 월 마감 시작: ' + yearMonth);

    // 1. 해당 월 청구서/지급요청서 조회
    var billings = getBillingsForMonth(yearMonth);

    // 2. 집계 (발생주의: DRAFT 제외)
    var salesData = {
      count: 0,
      totalAmount: 0,
      paidAmount: 0,
      unpaidAmount: 0
    };

    var purchaseData = {
      count: 0,
      totalAmount: 0,
      paidAmount: 0,
      unpaidAmount: 0
    };

    billings.forEach(function(b) {
      // DRAFT 제외
      if (b.status === 'DRAFT') return;

      if (b.type === 'SALES') {
        // ISSUED, PAID, PAID_PARTIAL
        salesData.count++;
        salesData.totalAmount += b.amount;
        salesData.paidAmount += b.paidAmount;
        salesData.unpaidAmount += b.remainingBalance;

      } else if (b.type === 'PURCHASE') {
        // REQUESTED, PAID, PAID_PARTIAL
        purchaseData.count++;
        purchaseData.totalAmount += b.amount;
        purchaseData.paidAmount += b.paidAmount;
        purchaseData.unpaidAmount += b.remainingBalance;
      }
    });

    // 3. 해당 청구서들 LOCKED 처리
    var lockResult = lockBillingsForMonth(yearMonth);

    // 4. 월마감DB에 기록
    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var closingSheet = ss.getSheetByName(OB_MONTHLY_CLOSING_SHEET);

    if (!closingSheet) {
      closingSheet = ss.insertSheet(OB_MONTHLY_CLOSING_SHEET);
      closingSheet.appendRow([
        '월마감ID', '년월', '마감상태',
        '총매입건수', '총매입액', '매입결제완료액', '매입미지급금',
        '총매출건수', '총매출액', '매출결제완료액', '매출미수금',
        '마감일시', '마감자', '해제일시', '해제자'
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
      purchaseData.count,
      purchaseData.totalAmount,
      purchaseData.paidAmount,
      purchaseData.unpaidAmount,
      salesData.count,
      salesData.totalAmount,
      salesData.paidAmount,
      salesData.unpaidAmount,
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

    Logger.log('[executeMonthlyClosingV2] ✅ 월 마감 완료: ' + yearMonth);

    return {
      success: true,
      yearMonth: yearMonth,
      salesCount: salesData.count,
      salesAmount: salesData.totalAmount,
      salesPaidAmount: salesData.paidAmount,
      salesUnpaidAmount: salesData.unpaidAmount,
      purchaseCount: purchaseData.count,
      purchaseAmount: purchaseData.totalAmount,
      purchasePaidAmount: purchaseData.paidAmount,
      purchaseUnpaidAmount: purchaseData.unpaidAmount,
      lockedCount: lockResult.lockedCount || 0,
      message: yearMonth + ' 월 마감이 완료되었습니다.'
    };

  } catch (error) {
    Logger.log('[executeMonthlyClosingV2] ❌ 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 월마감 해제 (청구DB 대상)
 * @param {Object} params - { yearMonth }
 * @returns {Object} 해제 결과
 */
function unlockMonthlyClosingV2(params) {
  try {
    var yearMonth = params.yearMonth || '';

    if (!yearMonth) {
      return { success: false, error: '해제할 월을 선택해주세요.' };
    }

    Logger.log('[unlockMonthlyClosingV2] 월 마감 해제 시작: ' + yearMonth);

    // 1. 해당 월 청구서들 LOCKED 해제
    var unlockResult = unlockBillingsForMonth(yearMonth);

    // 2. 월마감DB 상태 변경
    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var closingSheet = ss.getSheetByName(OB_MONTHLY_CLOSING_SHEET);

    if (closingSheet) {
      var cData = closingSheet.getDataRange().getValues();
      for (var i = 1; i < cData.length; i++) {
        if (cData[i][0] === 'MC-' + yearMonth) {
          var now = new Date();
          var user = Session.getActiveUser().getEmail();
          closingSheet.getRange(i + 1, 3).setValue('OPEN');
          closingSheet.getRange(i + 1, 14).setValue(now);
          closingSheet.getRange(i + 1, 15).setValue(user);
          break;
        }
      }
    }

    Logger.log('[unlockMonthlyClosingV2] ✅ 월 마감 해제 완료: ' + yearMonth);

    return {
      success: true,
      yearMonth: yearMonth,
      unlockedCount: unlockResult.unlockedCount || 0,
      message: yearMonth + ' 월 마감이 해제되었습니다.'
    };

  } catch (error) {
    Logger.log('[unlockMonthlyClosingV2] ❌ 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 월마감 상세 조회 (청구DB 기반)
 * @param {Object} params - { yearMonth }
 * @returns {Object} 상세 정보
 */
function getMonthlyClosingDetail(params) {
  try {
    var yearMonth = params.yearMonth || '';

    if (!yearMonth) {
      return { success: false, error: '조회할 월을 선택해주세요.' };
    }

    // 1. 월마감DB에서 기본 정보 조회
    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var closingSheet = ss.getSheetByName(OB_MONTHLY_CLOSING_SHEET);

    var closingInfo = null;

    if (closingSheet) {
      var cData = closingSheet.getDataRange().getValues();
      var cHeaders = cData[0];

      for (var i = 1; i < cData.length; i++) {
        if (cData[i][0] === 'MC-' + yearMonth) {
          closingInfo = {
            closingId: cData[i][0],
            yearMonth: cData[i][1],
            status: cData[i][2],
            purchaseCount: cData[i][3],
            purchaseAmount: cData[i][4],
            purchasePaidAmount: cData[i][5],
            purchaseUnpaidAmount: cData[i][6],
            salesCount: cData[i][7],
            salesAmount: cData[i][8],
            salesPaidAmount: cData[i][9],
            salesUnpaidAmount: cData[i][10],
            closedAt: formatDateString(cData[i][11]),
            closedBy: cData[i][12],
            unlockedAt: formatDateString(cData[i][13]),
            unlockedBy: cData[i][14]
          };
          break;
        }
      }
    }

    // 2. 청구DB에서 실시간 집계 (마감 전 상태 확인용)
    var billings = getBillingsForMonth(yearMonth);

    var salesData = { count: 0, totalAmount: 0, paidAmount: 0, unpaidAmount: 0 };
    var purchaseData = { count: 0, totalAmount: 0, paidAmount: 0, unpaidAmount: 0 };

    billings.forEach(function(b) {
      if (b.status === 'DRAFT') return;

      if (b.type === 'SALES') {
        salesData.count++;
        salesData.totalAmount += b.amount;
        salesData.paidAmount += b.paidAmount;
        salesData.unpaidAmount += b.remainingBalance;
      } else if (b.type === 'PURCHASE') {
        purchaseData.count++;
        purchaseData.totalAmount += b.amount;
        purchaseData.paidAmount += b.paidAmount;
        purchaseData.unpaidAmount += b.remainingBalance;
      }
    });

    // 마감 상태 판단
    var hasLockedBillings = billings.some(function(b) { return b.status === 'LOCKED'; });
    var currentStatus = closingInfo ? closingInfo.status : (hasLockedBillings ? 'CLOSED' : 'OPEN');

    return {
      success: true,
      yearMonth: yearMonth,
      status: currentStatus,
      closingInfo: closingInfo,
      realtime: {
        sales: salesData,
        purchase: purchaseData
      },
      billings: billings
    };

  } catch (error) {
    Logger.log('[getMonthlyClosingDetail] ❌ 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 월마감 엑셀 데이터 조회 (상세 출력용)
 * @param {Object} params - { yearMonth, type: 'summary' | 'detail' }
 * @returns {Object} 엑셀 데이터
 */
function getMonthlyClosingExcelData(params) {
  try {
    var yearMonth = params.yearMonth || '';
    var startMonth = params.startMonth || yearMonth;
    var endMonth = params.endMonth || yearMonth;
    var type = params.type || 'summary';
    var companyFilter = params.company || '';

    if (!startMonth) {
      return { success: false, error: '조회할 월을 선택해주세요.' };
    }

    // 기간 범위 청구서 조회
    var allBillings = [];
    if (startMonth === endMonth) {
      allBillings = getBillingsForMonth(startMonth);
    } else {
      var periodResult = getBillingsForPeriod({
        startMonth: startMonth,
        endMonth: endMonth,
        company: companyFilter
      });
      if (periodResult.success) {
        allBillings = periodResult.billings;
      }
    }

    // 거래처 필터 적용 (단일월 조회 시)
    var billings = allBillings;
    if (companyFilter && startMonth === endMonth) {
      billings = allBillings.filter(function(b) {
        return (b.company || '').indexOf(companyFilter) !== -1;
      });
    }

    if (type === 'summary') {
      // 요약 출력
      var salesData = { count: 0, totalAmount: 0, paidAmount: 0, unpaidAmount: 0 };
      var purchaseData = { count: 0, totalAmount: 0, paidAmount: 0, unpaidAmount: 0 };

      billings.forEach(function(b) {
        if (b.status === 'DRAFT') return;

        if (b.type === 'SALES') {
          salesData.count++;
          salesData.totalAmount += b.amount;
          salesData.paidAmount += b.paidAmount;
          salesData.unpaidAmount += b.remainingBalance;
        } else if (b.type === 'PURCHASE') {
          purchaseData.count++;
          purchaseData.totalAmount += b.amount;
          purchaseData.paidAmount += b.paidAmount;
          purchaseData.unpaidAmount += b.remainingBalance;
        }
      });

      return {
        success: true,
        type: 'summary',
        yearMonth: yearMonth,
        headers: ['구분', '건수', '금액', '결제완료', '미결제'],
        rows: [
          ['매출 (청구서)', salesData.count, salesData.totalAmount, salesData.paidAmount, salesData.unpaidAmount],
          ['매입 (지급요청서)', purchaseData.count, purchaseData.totalAmount, purchaseData.paidAmount, purchaseData.unpaidAmount],
          ['손익', '', salesData.totalAmount - purchaseData.totalAmount, salesData.paidAmount - purchaseData.paidAmount, salesData.unpaidAmount - purchaseData.unpaidAmount]
        ]
      };

    } else {
      // 상세 출력 - 발주건별 품목 상세
      var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
      var ledgerSheet = ss.getSheetByName(OB_ORDER_LEDGER_SHEET);

      if (!ledgerSheet) {
        return { success: false, error: '거래원장 시트를 찾을 수 없습니다.' };
      }

      var ledgerData = ledgerSheet.getDataRange().getValues();
      var ledgerHeaders = ledgerData[0];

      var idx = {};
      ledgerHeaders.forEach(function(h, i) { idx[h] = i; });

      var rows = [];

      billings.forEach(function(b) {
        if (b.status === 'DRAFT') return;

        var orderNumbers = [];
        try {
          orderNumbers = JSON.parse(b.orderNumbers);
        } catch (e) {
          orderNumbers = [];
        }

        // 거래원장에서 해당 발주번호 상세 조회
        for (var i = 1; i < ledgerData.length; i++) {
          var row = ledgerData[i];
          var 발주번호 = String(row[idx['발주번호']] || '');

          if (orderNumbers.indexOf(발주번호) !== -1) {
            var 단가 = (b.type === 'PURCHASE')
              ? (Number(row[idx['매입가']]) || 0)
              : (Number(row[idx['공급가']]) || 0);
            var 확정수량 = Number(row[idx['확정수량']]) || 0;

            rows.push({
              billingId: b.billingId,
              type: b.type === 'SALES' ? '매출' : '매입',
              company: b.company,
              orderNumber: 발주번호,
              orderDate: formatDateString(row[idx['발주일']]),
              productCode: row[idx['품목코드']] || '',
              productName: row[idx['제품명']] || '',
              confirmedQty: 확정수량,
              unitPrice: 단가,
              amount: 확정수량 * 단가
            });
          }
        }
      });

      return {
        success: true,
        type: 'detail',
        yearMonth: yearMonth,
        headers: ['문서ID', '유형', '거래처', '발주번호', '발주일', '품목코드', '품목명', '확정수량', '단가', '금액'],
        rows: rows.map(function(r) {
          return [r.billingId, r.type, r.company, r.orderNumber, r.orderDate, r.productCode, r.productName, r.confirmedQty, r.unitPrice, r.amount];
        })
      };
    }

  } catch (error) {
    Logger.log('[getMonthlyClosingExcelData] ❌ 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}
