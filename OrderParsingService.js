/**
 * OneBridge ERP - 발주파일 파싱 + 마스터 매칭 + 발주_통합DB 저장
 *
 * ⚠ Drive API 사용 안 함
 *  - 파일 파싱은 브라우저(SheetJS)에서 수행
 *  - 서버에는 2차원 배열 rows 만 전달
 *  - 여기서는 매칭 + 요약 + DB 저장만 담당
 */

// ====== 스프레드시트 ID / 시트명 상수 ======
const OB_ORDER_INPUT_SS_ID   = '11sjwW1NM4fskAQBYnWghbE6d2E0y_EpX-LocgUAevWY'; // (현재 사용 X, 필요 시 확장)
const OB_MASTER_DB_SS_ID     = '1vjAjykSQGK2DnFXvmQcH2zuI8WbOvAq_smqvW8u_bao';   // 마스터DB
const OB_ORDER_ALL_SS_ID     = '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs';   // 발주_통합DB

const OB_MASTER_PRODUCT_SHEET = '품목DB';   // 마스터DB 내 품목 시트명 (실제 시트명과 다르면 수정)
const OB_ORDER_MAIN_SHEET     = '거래원장'; // 발주_통합DB 내 메인 시트명

/* ============================================================
 * 메인: 발주파일 rows 파싱 + 마스터 매칭
 *  - 클라이언트에서 SheetJS로 읽은 rows(2차원 배열)를 받는다.
 *  - 1행: 헤더, 2행부터 데이터
 * ============================================================ */

/**
 * @param {Object[][]} rows - 2차원 배열 (첫 행: 헤더)
 * @returns {{
 *   totalRows: number,
 *   dataRows: number,
 *   parsedItems: number,
 *   matchedCount: number,
 *   unmatchedCount: number,
 *   totalAmount: number,
 *   items: Array<Object>
 * }}
 */
function processParsedOrderRows(rows) {
  if (!rows || rows.length === 0) {
    throw new Error('파싱할 데이터가 없습니다.');
  }

  // 1) 헤더 분석
  var header = rows[0];
  var dataRows = rows.slice(1);

  var colMap = detectOrderFileColumns_(header);

  // 2) 품목DB 인덱스(바코드 기준)
  var productIndex = buildProductIndex_();

  var items = [];
  var totalAmount = 0;
  var matchedCount = 0;
  var unmatchedCount = 0;

  for (var i = 0; i < dataRows.length; i++) {
    var row = dataRows[i];

    var brand = safeCell_(row[colMap.brand]);
    var name = safeCell_(row[colMap.productName]);
    var barcode = safeCell_(row[colMap.barcode]);
    var qty = toNumber_(row[colMap.orderQty]);

    // 완전 빈 행 or 수량 없는 행 스킵
    if (!brand && !name && !barcode && !qty) {
      continue;
    }
    if (!qty || qty <= 0) {
      continue;
    }

    var packQty       = colMap.packQty       >= 0 ? toNumber_(row[colMap.packQty])       : 0;
    var consumerPrice = colMap.consumerPrice >= 0 ? toNumber_(row[colMap.consumerPrice]) : 0;
    var supplyPrice   = colMap.supplyPrice   >= 0 ? toNumber_(row[colMap.supplyPrice])   : 0;
    var amount        = colMap.orderAmount   >= 0 ? toNumber_(row[colMap.orderAmount])   : 0;
    var inboundPlace  = colMap.inboundPlace  >= 0 ? safeCell_(row[colMap.inboundPlace])  : '';

    if (!amount && supplyPrice && qty) {
      amount = supplyPrice * qty;
    }

    totalAmount += amount || 0;

    // 마스터 매칭 (바코드 우선)
    var match = null;
    if (barcode) {
      match = productIndex.byBarcode[barcode] || null;
    }

    var matchStatus = match ? 'MATCHED' : 'UNMATCHED';
    if (match) matchedCount++; else unmatchedCount++;

    items.push({
      seq: i + 1,
      brand: brand,
      productName: name,
      barcode: barcode,
      orderQty: qty,
      packQty: packQty,
      consumerPrice: consumerPrice,
      supplyPrice: supplyPrice,
      orderAmount: amount,
      inboundPlace: inboundPlace,
      matchStatus: matchStatus,
      masterBrand: match ? match.brand : '',
      masterName: match ? match.name : ''
    });
  }

  return {
    totalRows: rows.length,
    dataRows: dataRows.length,
    parsedItems: items.length,
    matchedCount: matchedCount,
    unmatchedCount: unmatchedCount,
    totalAmount: totalAmount,
    items: items
  };
}

/* ============================================================
 * 발주_통합DB(거래원장) 저장
 *  - 클라이언트에서 MATCHED 항목만 필터해서 넘겨준다.
 *  - 거래원장에 발주번호 규칙, 수식, 날짜 형식 적용
 * ============================================================ */

/**
 * 파싱된 발주 데이터를 거래원장에 저장
 * @param {Array} items - processParsedOrderRows에서 반환된 items (MATCHED만)
 */
function saveParsedOrdersToDB(items) {
  if (!items || items.length === 0) {
    return { 
      success: false,
      savedRows: 0,
      errors: ['저장할 데이터가 없습니다.']
    };
  }

  // ✅ 1단계: 모든 항목 사전 검증
  var errors = [];
  var validationResults = [];
  
  Logger.log('=== 1단계: 데이터 검증 시작 ===');
  
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var itemErrors = [];
    
    // 바코드 확인
    var barcode = safeCell_(item.barcode);
    if (!barcode) {
      itemErrors.push('바코드 없음');
    }
    
    // 품목DB에서 매입가 조회
    var buyPrice = 0;
    if (barcode) {
      buyPrice = getBuyPriceFromProductDB_(barcode);
      if (!buyPrice || buyPrice <= 0) {
        itemErrors.push('품목DB에 매입가 없음 (바코드: ' + barcode + ')');
      }
    }
    
    // 공급가 확인
    var supplyPrice = toNumber_(item.supplyPrice);
    if (!supplyPrice || supplyPrice <= 0) {
      itemErrors.push('공급가 없음');
    }
    
    // 수량 확인
    var qty = toNumber_(item.orderQty);
    if (!qty || qty <= 0) {
      itemErrors.push('발주수량 없음');
    }
    
    // 브랜드 확인
    var brand = safeCell_(item.brand);
    if (!brand) {
      itemErrors.push('브랜드 없음');
    }
    
    // 발주처 확인
    var customer = item.customer || '';
    if (!customer) {
      itemErrors.push('발주처 없음');
    }
    
    // 오류가 있으면 기록
    if (itemErrors.length > 0) {
      var errorMsg = '행 ' + (i + 1) + ' [' + (item.productName || '제품명없음') + ']: ' + itemErrors.join(', ');
      errors.push(errorMsg);
      Logger.log('❌ ' + errorMsg);
    }
    
    validationResults.push({
      item: item,
      buyPrice: buyPrice,
      supplyPrice: supplyPrice,
      qty: qty,
      brand: brand,
      customer: customer,
      hasError: itemErrors.length > 0
    });
  }
  
  // ✅ 오류가 하나라도 있으면 전체 입력 취소
  if (errors.length > 0) {
    Logger.log('❌❌❌ 검증 실패! 총 ' + errors.length + '건의 오류 발견');
    return {
      success: false,
      savedRows: 0,
      totalRows: items.length,
      errorCount: errors.length,
      errors: errors
    };
  }
  
  Logger.log('✅ 검증 완료! 모든 데이터 정상');
  Logger.log('=== 2단계: 데이터 저장 시작 ===');
  
  // ✅ 2단계: 검증 통과 - 실제 저장 시작
  var ss = SpreadsheetApp.openById(OB_ORDER_ALL_SS_ID);
  var sheet = ss.getSheetByName(OB_ORDER_MAIN_SHEET);
  if (!sheet) {
    return {
      success: false,
      savedRows: 0,
      errors: ['발주_통합DB에서 [' + OB_ORDER_MAIN_SHEET + '] 시트를 찾을 수 없습니다.']
    };
  }

  // 헤더(1행) 읽어서 컬럼 위치 매핑
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  function col(name) {
    var idx = header.indexOf(name);
    return idx >= 0 ? idx : -1;
  }

  var c = {
    orderDate:      col('발주일'),
    orderCode:      col('발주번호'),
    productCode:    col('품목코드'),
    brand:          col('브랜드'),
    supplier:       col('매입처'),
    buyer:          col('발주처'),
    vatType:        col('부가세구분'),
    productName:    col('제품명'),
    orderQty:       col('발주수량'),
    confirmQty:     col('확정수량'),
    buyPrice:       col('매입가'),
    supplyPrice:    col('공급가'),
    amountBuy:      col('매입액'),
    amountSupply:   col('공급액'),
    marginAmount:   col('마진액'),
    marginRate:     col('마진율'),
    payBuy:         col('매입결제'),
    paySell:        col('매출결제'),
    buyOrderFlag:   col('매입발주'),
    shipFlag:       col('출고'),
    shipDate:       col('출고일'),
    inboundPlace:   col('입고지'),
    memo:           col('비고'),
    billingDate:    col('청구일'),
    sheetRowNumber:      col('행번호'),
    createdAt:      col('생성일시'),
    updatedAt:      col('수정일시')
  };

  // 공통 값 생성
  var now = new Date();
  var todaySerial = now; // Excel 날짜 형식 (Date 객체)
  var dateStr = Utilities.formatDate(now, 'Asia/Seoul', 'yyyyMMdd');
  var timeStr = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');

  // 브랜드별 매입처 매핑 생성
  var brandToSupplierMap = buildBrandToSupplierMap_();
  
  // 거래처별/브랜드별 코드 매핑 생성
  var customerCodeMap = buildCustomerCodeMap_();
  var brandCodeMap = buildBrandCodeMap_();

  // 발주처별로 그룹핑
  var itemsByCustomer = {};
  for (var i = 0; i < validationResults.length; i++) {
    var result = validationResults[i];
    var customer = result.customer;
    if (!itemsByCustomer[customer]) {
      itemsByCustomer[customer] = [];
    }
    itemsByCustomer[customer].push({
      item: result.item,
      buyPrice: result.buyPrice,
      supplyPrice: result.supplyPrice,
      qty: result.qty,
      brand: result.brand
    });
  }

  var saved = 0;
  var startRow = sheet.getLastRow() + 1;

  // 발주처별로 처리
  for (var customer in itemsByCustomer) {
    var customerItems = itemsByCustomer[customer];
    var customerCode = customerCodeMap[customer] || 'CUS';
    
    var orderSeq = getNextOrderSeq_(sheet, dateStr, customer);
    
    for (var i = 0; i < customerItems.length; i++) {
      var data = customerItems[i];
      var item = data.item;
      
      var brandCode = brandCodeMap[data.brand] || data.brand.substring(0, 2).toUpperCase();
      var orderCode = dateStr + '-' + customerCode + '-' + brandCode + '-' + padZero(orderSeq, 3);
      
      var supplier = brandToSupplierMap[data.brand] || '';
      var buyer = customer;
      
      var row = new Array(header.length).fill('');
      var currentRow = startRow + saved;

      // 기본 정보
      if (c.orderDate      >= 0) row[c.orderDate]      = todaySerial;
      if (c.orderCode      >= 0) row[c.orderCode]      = orderCode;
      if (c.productCode    >= 0) row[c.productCode]    = item.barcode || '';
      if (c.brand          >= 0) row[c.brand]          = data.brand;
      if (c.supplier       >= 0) row[c.supplier]       = supplier;
      if (c.buyer          >= 0) row[c.buyer]          = buyer;
      if (c.vatType        >= 0) row[c.vatType]        = '부별';
      if (c.productName    >= 0) row[c.productName]    = item.productName || '';
      
      // 수량
      if (c.orderQty       >= 0) row[c.orderQty]       = data.qty;
      if (c.confirmQty     >= 0) row[c.confirmQty]     = data.qty;
      
      // 단가
      if (c.buyPrice       >= 0) row[c.buyPrice]       = data.buyPrice;
      if (c.supplyPrice    >= 0) row[c.supplyPrice]    = data.supplyPrice;
      
      // 금액 계산 - 수식으로 입력
      var sheetRowNum = currentRow;
      var buyPriceCol = getColumnLetter_(c.buyPrice);
      var supplyPriceCol = getColumnLetter_(c.supplyPrice);
      var orderQtyCol = getColumnLetter_(c.orderQty);
      var amountBuyCol = getColumnLetter_(c.amountBuy);
      var amountSupplyCol = getColumnLetter_(c.amountSupply);
      
      if (c.amountBuy      >= 0) {
        row[c.amountBuy] = '=' + buyPriceCol + sheetRowNum + '*' + orderQtyCol + sheetRowNum;
      }
      if (c.amountSupply   >= 0) {
        row[c.amountSupply] = '=' + supplyPriceCol + sheetRowNum + '*' + orderQtyCol + sheetRowNum;
      }
      if (c.marginAmount   >= 0) {
        row[c.marginAmount] = '=' + amountSupplyCol + sheetRowNum + '-' + amountBuyCol + sheetRowNum;
      }
      if (c.marginRate     >= 0) {
        var marginAmountCol = getColumnLetter_(c.marginAmount);
        row[c.marginRate] = '=IF(' + amountSupplyCol + sheetRowNum + '=0,0,' + 
                            marginAmountCol + sheetRowNum + '/' + amountSupplyCol + sheetRowNum + ')';
      }
      
      // 상태 정보
      if (c.payBuy         >= 0) row[c.payBuy]         = '미결제';
      if (c.paySell        >= 0) row[c.paySell]        = '미결제';
      if (c.buyOrderFlag   >= 0) row[c.buyOrderFlag]   = '미처리';
      if (c.shipFlag       >= 0) row[c.shipFlag]       = '미출고';
      if (c.shipDate       >= 0) row[c.shipDate]       = '';
      if (c.inboundPlace   >= 0) row[c.inboundPlace]   = buyer;
      if (c.memo           >= 0) row[c.memo]           = '';
      if (c.billingDate    >= 0) row[c.billingDate]    = '';
      
      // 메타 정보
      if (c.rowNumber      >= 0) row[c.rowNumber]      = '';
      if (c.createdAt      >= 0) row[c.createdAt]      = timeStr;
      if (c.updatedAt      >= 0) row[c.updatedAt]      = timeStr;

      sheet.appendRow(row);
      saved++;
      orderSeq++;
    }
  }
  
  Logger.log('✅✅✅ 저장 완료! 총 ' + saved + '건');

  return {
    success: true,
    savedRows: saved,
    totalRows: items.length,
    errorCount: 0,
    errors: []
  };
}

/**
 * ✅ 브랜드 → 매입처 매핑 생성
 */
function buildBrandToSupplierMap_() {
  var ss = SpreadsheetApp.openById(OB_MASTER_DB_SS_ID);
  var sheet = ss.getSheetByName('거래처DB');
  
  if (!sheet) {
    Logger.log('⚠️ 거래처DB 시트를 찾을 수 없습니다.');
    return {};
  }

  var data = sheet.getDataRange().getValues();
  if (data.length === 0) return {};

  var header = data[0];
  var brandIdx = header.indexOf('브랜드');
  var supplierIdx = header.indexOf('거래처명');

  if (brandIdx < 0 || supplierIdx < 0) {
    Logger.log('⚠️ 브랜드 또는 거래처명 컬럼을 찾을 수 없습니다.');
    Logger.log('헤더: ' + JSON.stringify(header));
    return {};
  }

  var map = {};

  for (var i = 1; i < data.length; i++) {
    var brandName = safeCell_(data[i][brandIdx]);
    var supplierName = safeCell_(data[i][supplierIdx]);

    if (brandName && supplierName) {
      map[brandName] = supplierName;
    }
  }

  return map;
}

/**
 * ✅ 거래처명 → 거래처코드 매핑 생성
 */
function buildCustomerCodeMap_() {
  var ss = SpreadsheetApp.openById(OB_MASTER_DB_SS_ID);
  var sheet = ss.getSheetByName('거래처DB');
  
  if (!sheet) return {};

  var data = sheet.getDataRange().getValues();
  if (data.length === 0) return {};

  var header = data[0];
  var codeIdx = header.indexOf('거래처코드');
  var nameIdx = header.indexOf('거래처명');

  if (codeIdx < 0 || nameIdx < 0) {
    Logger.log('⚠️ 거래처코드 또는 거래처명 컬럼을 찾을 수 없습니다.');
    return {};
  }

  var map = {};
  for (var i = 1; i < data.length; i++) {
    var code = safeCell_(data[i][codeIdx]);
    var name = safeCell_(data[i][nameIdx]);
    if (code && name) {
      map[name] = code;
    }
  }

  return map;
}

/**
 * ✅ 브랜드명 → 브랜드코드 매핑 생성
 */
function buildBrandCodeMap_() {
  var ss = SpreadsheetApp.openById(OB_MASTER_DB_SS_ID);
  var sheet = ss.getSheetByName('거래처DB');
  
  if (!sheet) return {};

  var data = sheet.getDataRange().getValues();
  if (data.length === 0) return {};

  var header = data[0];
  var brandIdx = header.indexOf('브랜드');
  var brandCodeIdx = header.indexOf('브랜드코드');

  if (brandIdx < 0 || brandCodeIdx < 0) {
    Logger.log('⚠️ 브랜드 또는 브랜드코드 컬럼을 찾을 수 없습니다.');
    return {};
  }

  var map = {};
  for (var i = 1; i < data.length; i++) {
    var brand = safeCell_(data[i][brandIdx]);
    var code = safeCell_(data[i][brandCodeIdx]);
    if (brand && code) {
      map[brand] = code;
    }
  }

  return map;
}

/**
 * ✅ 오늘 날짜 + 발주처 기준 다음 순번 조회
 */
function getNextOrderSeq_(sheet, dateStr, customer) {
  var data = sheet.getDataRange().getValues();
  var header = data[0];
  
  var orderCodeIdx = header.indexOf('발주번호');
  if (orderCodeIdx < 0) return 1;
  
  var maxSeq = 0;
  var prefix = dateStr + '-';
  
  for (var i = 1; i < data.length; i++) {
    var orderCode = safeCell_(data[i][orderCodeIdx]);
    if (orderCode.indexOf(prefix) === 0) {
      // 발주번호에서 마지막 순번 추출
      var parts = orderCode.split('-');
      if (parts.length >= 4) {
        var seq = parseInt(parts[3]) || 0;
        if (seq > maxSeq) maxSeq = seq;
      }
    }
  }
  
  return maxSeq + 1;
}

/**
 * ✅ 컬럼 번호 → 엑셀 컬럼 문자 (0→A, 25→Z, 26→AA)
 */
function getColumnLetter_(colIndex) {
  if (colIndex < 0) return '';
  
  var letter = '';
  var temp = colIndex + 1; // 1-based
  
  while (temp > 0) {
    var remainder = (temp - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  
  return letter;
}

/**
 * ✅ 숫자를 N자리 문자열로 (001, 002, ...)
 */
function padZero(num, width) {
  var str = String(num);
  while (str.length < width) {
    str = '0' + str;
  }
  return str;
}

/* ============================================================
 * 품목DB 인덱스 생성 (바코드 기준)
 * ============================================================ */

function buildProductIndex_() {
  var ss = SpreadsheetApp.openById(OB_MASTER_DB_SS_ID);
  var sheet = ss.getSheetByName(OB_MASTER_PRODUCT_SHEET);
  if (!sheet) {
    throw new Error('마스터DB에서 [' + OB_MASTER_PRODUCT_SHEET + '] 시트를 찾을 수 없습니다.');
  }

  var values = sheet.getDataRange().getValues();
  var header = values[0];
  var rows = values.slice(1);

  var colBarcode = header.indexOf('바코드');
  if (colBarcode === -1) colBarcode = header.indexOf('품목코드');
  var colName  = header.indexOf('제품명');
  var colBrand = header.indexOf('브랜드');

  if (colBarcode === -1) {
    throw new Error('품목DB에 바코드/품목코드 컬럼이 없습니다. (헤더: ' + JSON.stringify(header) + ')');
  }

  var byBarcode = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var bc = safeCell_(r[colBarcode]);
    if (!bc) continue;

    byBarcode[bc] = {
      name:  colName  >= 0 ? safeCell_(r[colName])  : '',
      brand: colBrand >= 0 ? safeCell_(r[colBrand]) : ''
    };
  }

  return {
    header: header,
    rows: rows,
    byBarcode: byBarcode
  };
}

/* ============================================================
 * 발주파일 헤더 → 컬럼 인덱스 매핑
 * ✅ 줄바꿈 문자(\r\n, \n) 제거 처리
 * ============================================================ */

/**
 * 발주파일 헤더(1행)를 받아서 각 컬럼의 인덱스를 추론한다.
 * - 브랜드, 제품명, 바코드, 수량, 공급단가, 금액, 입고지 등
 */
function detectOrderFileColumns_(header) {
  // ✅ 헤더 배열을 정규화 (줄바꿈, 공백 제거)
  var normalizedHeader = header.map(function(col) {
    if (typeof col === 'string') {
      return col.replace(/[\r\n]/g, '').trim();
    }
    return String(col);
  });
  
  function findIndex(candidates) {
    for (var i = 0; i < candidates.length; i++) {
      var idx = normalizedHeader.indexOf(candidates[i]);
      if (idx >= 0) return idx;
    }
    return -1;
  }

  return {
    brand:         findIndex(['브랜드', '브랜드명']),
    productName:   findIndex(['제품명', '상품명', '품목명']),
    barcode:       findIndex(['바코드', '품목코드', '상품코드']),
    packQty:       findIndex(['입수량', '입수']),
    consumerPrice: findIndex(['소비자가', '소비자가격']),
    supplyPrice:   findIndex(['공급가(VAT포함)', '공급가 (VAT포함)', '공급가', '공급단가']),
    orderQty:      findIndex(['발주수량', '수량', '주문수량']),
    orderAmount:   findIndex(['발주금액', '합계', '공급가합계', '주문금액', '금액']),
    inboundPlace:  findIndex(['입고지', '입고처', '납품처'])
  };
}

/* ============================================================
 * Helper
 * ============================================================ */

function safeCell_(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function toNumber_(v) {
  if (v === null || v === undefined || v === '') return 0;
  var s = typeof v === 'string' ? v.replace(/,/g, '') : v;
  var n = Number(s);
  return isNaN(n) ? 0 : n;
}

/**
 * 발주처(거래처) 목록 조회
 * 거래처DB에서 '주거래처' 컬럼이 '발주처'인 거래처만 반환
 * @returns {Object} {success: boolean, data: Array<string>, error: string}
 */
function getCustomers() {
  try {
    var ss = SpreadsheetApp.openById(OB_MASTER_DB_SS_ID);
    var sheet = ss.getSheetByName('거래처DB');
    
    if (!sheet) {
      Logger.log('[getCustomers] ⚠️ 거래처DB 시트를 찾을 수 없습니다.');
      return {
        success: false,
        error: '거래처DB 시트를 찾을 수 없습니다.',
        data: []
      };
    }
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return {
        success: true,
        data: [],
        error: ''
      };
    }
    
    var header = data[0];
    
    // 컬럼 인덱스 찾기
    var nameIdx = header.indexOf('거래처명');      // B열
    var mainTypeIdx = header.indexOf('주거래처');   // J열
    
    if (nameIdx < 0) {
      Logger.log('[getCustomers] ⚠️ 거래처명 컬럼을 찾을 수 없습니다.');
      return {
        success: false,
        error: '거래처명 컬럼을 찾을 수 없습니다.',
        data: []
      };
    }
    
    var customers = [];
    var seen = {}; // 중복 제거용
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var name = safeCell_(row[nameIdx]);
      
      // 주거래처 컬럼이 있는 경우
      if (mainTypeIdx >= 0) {
        var mainType = safeCell_(row[mainTypeIdx]);
        
        // '발주처'가 포함된 거래처만 선택
        if (mainType && mainType.indexOf('발주처') >= 0) {
          if (name && !seen[name]) {
            customers.push(name);
            seen[name] = true;
          }
        }
      } else {
        // 주거래처 컬럼이 없으면 모든 거래처 반환
        if (name && !seen[name]) {
          customers.push(name);
          seen[name] = true;
        }
      }
    }
    
    Logger.log('[getCustomers] 발주처 목록: ' + JSON.stringify(customers));
    Logger.log('[getCustomers] 총 ' + customers.length + '개');
    
    return {
      success: true,
      data: customers.sort(), // 가나다순 정렬
      error: ''
    };
    
  } catch (e) {
    Logger.log('[getCustomers Error] ' + e.toString());
    return {
      success: false,
      error: e.toString(),
      data: []
    };
  }
}

/**
 * ✅ 품목DB에서 바코드로 매입가 조회
 */
function getBuyPriceFromProductDB_(barcode) {
  var ss = SpreadsheetApp.openById(OB_MASTER_DB_SS_ID);
  var sheet = ss.getSheetByName(OB_MASTER_PRODUCT_SHEET);
  
  if (!sheet) {
    Logger.log('⚠️ 품목DB 시트를 찾을 수 없습니다.');
    return 0;
  }

  var data = sheet.getDataRange().getValues();
  if (data.length === 0) return 0;

  var header = data[0];
  var barcodeIdx = header.indexOf('바코드');
  var buyPriceIdx = header.indexOf('매입가');

  if (barcodeIdx < 0 || buyPriceIdx < 0) {
    Logger.log('⚠️ 품목DB에서 바코드 또는 매입가 컬럼을 찾을 수 없습니다.');
    return 0;
  }

  // 바코드 문자열 정규화
  var searchBarcode = String(barcode).trim();

  for (var i = 1; i < data.length; i++) {
    var bc = String(data[i][barcodeIdx]).trim();
    if (bc === searchBarcode) {
      var price = toNumber_(data[i][buyPriceIdx]);
      Logger.log('✅ 바코드 ' + searchBarcode + ' 매입가 찾음: ' + price);
      return price;
    }
  }

  Logger.log('⚠️ 바코드 ' + searchBarcode + ' 매입가 못 찾음');
  return 0;
}
/**
 * ✅ 오늘 날짜 + 발주처 기준 중복 발주 체크
 * @param {string} customer - 발주처명
 * @param {string} dateStr - 날짜 문자열 (YYYY-MM-DD)
 * @returns {Object} {success: boolean, hasDuplicate: boolean, orders: Array}
 */
function checkTodayDuplicateOrder(customer, dateStr) {
  try {
    var ss = SpreadsheetApp.openById(OB_ORDER_ALL_SS_ID);
    var sheet = ss.getSheetByName(OB_ORDER_MAIN_SHEET);
    
    if (!sheet) {
      Logger.log('⚠️ 거래원장 시트를 찾을 수 없습니다.');
      return {
        success: true,
        hasDuplicate: false,
        orders: []
      };
    }
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return {
        success: true,
        hasDuplicate: false,
        orders: []
      };
    }
    
    var header = data[0];
    var dateIdx = header.indexOf('발주일');
    var buyerIdx = header.indexOf('발주처');
    var orderCodeIdx = header.indexOf('발주번호');
    var brandIdx = header.indexOf('브랜드');
    var amountIdx = header.indexOf('공급액');
    
    if (dateIdx < 0 || buyerIdx < 0) {
      Logger.log('⚠️ 필수 컬럼을 찾을 수 없습니다.');
      return {
        success: true,
        hasDuplicate: false,
        orders: []
      };
    }
    
    // 오늘 날짜를 Date 객체로 변환
    var targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);
    
    // 중복 발주 찾기
    var duplicateOrders = {};
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var orderDate = row[dateIdx];
      var buyer = safeCell_(row[buyerIdx]);
      
      if (!orderDate || !buyer) continue;
      
      // 날짜 비교
      var rowDate = new Date(orderDate);
      rowDate.setHours(0, 0, 0, 0);
      
      if (rowDate.getTime() === targetDate.getTime() && buyer === customer) {
        var orderCode = safeCell_(row[orderCodeIdx]);
        var brand = safeCell_(row[brandIdx]);
        var amount = toNumber_(row[amountIdx]);
        
        if (!duplicateOrders[orderCode]) {
          duplicateOrders[orderCode] = {
            orderCode: orderCode,
            brands: [],
            itemCount: 0,
            totalAmount: 0
          };
        }
        
        if (brand && duplicateOrders[orderCode].brands.indexOf(brand) === -1) {
          duplicateOrders[orderCode].brands.push(brand);
        }
        duplicateOrders[orderCode].itemCount++;
        duplicateOrders[orderCode].totalAmount += amount;
      }
    }
    
    var orders = [];
    for (var code in duplicateOrders) {
      var order = duplicateOrders[code];
      order.brands = order.brands.join(', ');
      orders.push(order);
    }
    
    Logger.log('중복 발주 체크 완료: ' + orders.length + '건');
    
    return {
      success: true,
      hasDuplicate: orders.length > 0,
      orders: orders
    };
    
  } catch (e) {
    Logger.log('[checkTodayDuplicateOrder Error] ' + e.toString());
    return {
      success: false,
      error: e.toString(),
      hasDuplicate: false,
      orders: []
    };
  }
}