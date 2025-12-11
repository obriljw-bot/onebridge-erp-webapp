/**
 * ============================================================
 * InvoiceService.js - 청구서 관리 비즈니스 로직
 * ============================================================
 * Settlement 기반 청구서 생성, 조회, 상태 관리
 * ============================================================
 */

// ====== 스프레드시트 ID / 시트명 상수 ======
var OB_INVOICE_SS_ID = '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs'; // 발주_통합DB
var OB_INVOICE_LEDGER_SHEET = '거래원장';
var OB_INVOICE_SHEET = '청구DB';

/**
 * ============================================================
 * 1. 청구 데이터 집계
 * ============================================================
 */

/**
 * 청구 데이터 집계 (발주처별)
 * @param {Object} params - { company, startDate, endDate }
 * @returns {Object} 집계 결과
 */
function aggregateInvoiceData(params) {
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

    Logger.log('[aggregateInvoiceData] 거래처: ' + company + ', 기간: ' + startDate + ' ~ ' + endDate);

    var ss = SpreadsheetApp.openById(OB_INVOICE_SS_ID);
    var sheet = ss.getSheetByName(OB_INVOICE_LEDGER_SHEET);

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
    Logger.log('[aggregateInvoiceData Error] ' + err.message);
    return {
      success: false,
      error: '집계 중 오류 발생: ' + err.message
    };
  }
}

/**
 * ============================================================
 * 2. 청구서 생성
 * ============================================================
 */

/**
 * Settlement 기반 청구서 생성
 * @param {Object} params - { settlementId, type, company, invoiceDate, amount, notes }
 * @returns {Object} 생성 결과
 */
function createInvoiceFromSettlement(params) {
  try {
    var settlementId = params.settlementId || '';
    var orderNumbers = params.orderNumbers || [];
    var type = params.type || '';
    var company = params.company || '';
    var invoiceDate = params.invoiceDate || new Date();
    var amount = params.amount || 0;
    var notes = params.notes || '';

    // 2-Track 구조: settlementId 또는 orderNumbers 중 하나는 필수
    if (!settlementId && (!orderNumbers || orderNumbers.length === 0)) {
      return {
        success: false,
        error: '마감ID 또는 발주번호가 필요합니다.'
      };
    }

    if (!type || !company) {
      return {
        success: false,
        error: '필수 정보를 입력해주세요.'
      };
    }

    // billingType 결정: SETTLEMENT (마감 기반) 또는 DIRECT (직접 생성)
    var billingType = settlementId ? 'SETTLEMENT' : 'DIRECT';

    // DIRECT 타입이고 amount가 제공되지 않은 경우, orderNumbers로부터 금액 계산
    if (billingType === 'DIRECT' && amount === 0 && orderNumbers.length > 0) {
      var orderSs = SpreadsheetApp.openById(OB_INVOICE_SS_ID);
      var orderSheet = orderSs.getSheetByName(OB_INVOICE_LEDGER_SHEET);

      if (orderSheet) {
        var orderData = orderSheet.getDataRange().getValues();
        var header = orderData[0];
        var orderNumIdx = header.indexOf('발주번호');
        var supplyAmtIdx = header.indexOf('공급액');

        for (var i = 1; i < orderData.length; i++) {
          var orderNum = orderData[i][orderNumIdx];
          if (orderNumbers.indexOf(orderNum) !== -1) {
            amount += Number(orderData[i][supplyAmtIdx]) || 0;
          }
        }

        Logger.log('[createInvoiceFromSettlement] DIRECT 타입 금액 계산: ₩' + amount);
      }
    }

    var ss = SpreadsheetApp.openById(OB_INVOICE_SS_ID);
    var sheet = ss.getSheetByName(OB_INVOICE_SHEET);

    if (!sheet) {
      sheet = ss.insertSheet(OB_INVOICE_SHEET);
      sheet.appendRow([
        '청구ID', '청구유형', '업체명', '마감ID', '청구일', '청구금액',
        '청구상태', '청구타입', '발주번호', '비고', '생성일시', '생성자', '발행일시', '발행자', '결제일시'
      ]);
    }

    // 청구 ID 생성: INV-YYYYMMDD-순번
    var today = new Date();
    var dateStr = formatYearMonth(today) + String(today.getDate()).padStart(2, '0');
    var data = sheet.getDataRange().getValues();
    var count = 1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].startsWith('INV-' + dateStr)) {
        count++;
      }
    }
    var invoiceId = 'INV-' + dateStr + '-' + String(count).padStart(3, '0');

    var now = new Date();
    var user = Session.getActiveUser().getEmail();

    // orderNumbers 배열을 문자열로 변환 (JSON 형식)
    var orderNumbersStr = orderNumbers.length > 0 ? JSON.stringify(orderNumbers) : '';

    var rowData = [
      invoiceId,
      type,
      company,
      settlementId,
      invoiceDate,
      amount,
      'DRAFT',
      billingType,
      orderNumbersStr,
      notes,
      now,
      user,
      '',
      '',
      ''
    ];

    sheet.appendRow(rowData);
    Logger.log('[createInvoiceFromSettlement] 청구서 생성: ' + invoiceId + ' (타입: ' + billingType + ')');

    return {
      success: true,
      invoiceId: invoiceId,
      message: '청구서가 생성되었습니다.'
    };

  } catch (err) {
    Logger.log('[createInvoiceFromSettlement Error] ' + err.message);
    return {
      success: false,
      error: '청구서 생성 중 오류 발생: ' + err.message
    };
  }
}

/**
 * ============================================================
 * 3. 청구서 조회
 * ============================================================
 */

/**
 * 발주번호에 대한 청구서 존재 여부 확인
 * @param {Object} params - { orderNumber }
 * @returns {Object} { exists: boolean, invoices: [...] }
 */
function checkInvoiceExists(params) {
  try {
    var orderNumber = params.orderNumber || '';

    if (!orderNumber) {
      return {
        success: false,
        error: '발주번호가 필요합니다.'
      };
    }

    var ss = SpreadsheetApp.openById(OB_INVOICE_SS_ID);
    var sheet = ss.getSheetByName(OB_INVOICE_SHEET);

    if (!sheet) {
      return {
        success: true,
        exists: false,
        invoices: []
      };
    }

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return {
        success: true,
        exists: false,
        invoices: []
      };
    }

    var header = data[0];
    var orderNumbersIdx = header.indexOf('발주번호');
    var invoiceIdIdx = header.indexOf('청구ID');
    var companyIdx = header.indexOf('업체명');
    var typeIdx = header.indexOf('청구유형');
    var amountIdx = header.indexOf('청구금액');
    var statusIdx = header.indexOf('청구상태');
    var billingTypeIdx = header.indexOf('청구타입');

    var matchingInvoices = [];

    for (var i = 1; i < data.length; i++) {
      var orderNumbersStr = String(data[i][orderNumbersIdx] || '');

      // JSON 배열 파싱
      var orderNumbers = [];
      try {
        if (orderNumbersStr) {
          orderNumbers = JSON.parse(orderNumbersStr);
        }
      } catch (e) {
        // 파싱 실패시 빈 배열
      }

      // 발주번호가 포함되어 있는지 확인
      if (orderNumbers.indexOf(orderNumber) !== -1) {
        matchingInvoices.push({
          invoiceId: data[i][invoiceIdIdx],
          company: data[i][companyIdx],
          type: data[i][typeIdx],
          amount: data[i][amountIdx],
          status: data[i][statusIdx],
          billingType: data[i][billingTypeIdx]
        });
      }
    }

    return {
      success: true,
      exists: matchingInvoices.length > 0,
      invoices: matchingInvoices
    };

  } catch (err) {
    Logger.log('[checkInvoiceExists Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * 청구서 목록 조회
 * @param {Object} params - { type, company, status, startDate, endDate }
 * @returns {Object} 조회 결과
 */
function getInvoices(params) {
  try {
    var type = params.type || '';
    var company = params.company || '';
    var status = params.status || '';
    var startDate = params.startDate || '';
    var endDate = params.endDate || '';

    var ss = SpreadsheetApp.openById(OB_INVOICE_SS_ID);
    var sheet = ss.getSheetByName(OB_INVOICE_SHEET);

    if (!sheet) {
      return {
        success: true,
        invoices: []
      };
    }

    var data = sheet.getDataRange().getValues();
    var invoices = [];

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
      if (status && data[i][6] !== status) continue;

      // 날짜 필터
      if (start || end) {
        var invoiceDate = parseDate(data[i][4]);
        if (start && invoiceDate < start) continue;
        if (end && invoiceDate > end) continue;
      }

      invoices.push({
        invoiceId: data[i][0],
        type: data[i][1],
        company: data[i][2],
        settlementId: data[i][3],
        invoiceDate: formatDateString(data[i][4]),
        amount: data[i][5],
        status: data[i][6],
        notes: data[i][7],
        createdAt: formatDateString(data[i][8]),
        createdBy: data[i][9],
        issuedAt: formatDateString(data[i][10]),
        issuedBy: data[i][11],
        paidAt: formatDateString(data[i][12])
      });
    }

    return {
      success: true,
      invoices: invoices
    };

  } catch (err) {
    Logger.log('[getInvoices Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * ============================================================
 * 4. 청구서 상태 관리
 * ============================================================
 */

/**
 * 청구서 상태 업데이트
 * @param {Object} params - { invoiceId, status }
 * @returns {Object} 업데이트 결과
 */
function updateInvoiceStatus(params) {
  try {
    var invoiceId = params.invoiceId || '';
    var status = params.status || '';

    if (!invoiceId || !status) {
      return {
        success: false,
        error: '청구ID와 상태를 입력해주세요.'
      };
    }

    var ss = SpreadsheetApp.openById(OB_INVOICE_SS_ID);
    var sheet = ss.getSheetByName(OB_INVOICE_SHEET);

    if (!sheet) {
      return {
        success: false,
        error: '청구DB 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === invoiceId) {
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

    Logger.log('[updateInvoiceStatus] 청구서 상태 업데이트: ' + invoiceId + ' -> ' + status);

    return {
      success: true,
      message: '청구서 상태가 업데이트되었습니다.'
    };

  } catch (err) {
    Logger.log('[updateInvoiceStatus Error] ' + err.message);
    return {
      success: false,
      error: '상태 업데이트 중 오류 발생: ' + err.message
    };
  }
}

/**
 * ============================================================
 * 5. 유틸리티 함수
 * ============================================================
 */

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

/**
 * 년월 포맷 함수 (YYYYMM)
 */
function formatYearMonth(date) {
  if (!date) return '';

  var d = new Date(date);
  var year = d.getFullYear();
  var month = String(d.getMonth() + 1).padStart(2, '0');

  return String(year) + month;
}

/**
 * ============================================================
 * 6. 청구서 재출력
 * ============================================================
 * 기존 청구서를 기반으로 PDF를 다시 생성합니다.
 * @param {Object} params - { invoiceId, billingId, settlementId, type }
 * @returns {Object} { success, fileId, fileName, error }
 */
function reprintInvoice(params) {
  try {
    var invoiceId = params && (params.invoiceId || params.billingId) ? (params.invoiceId || params.billingId) : '';
    var settlementId = params && params.settlementId ? params.settlementId : '';
    var type = params && params.type ? params.type : '';

    if (!invoiceId && !settlementId) {
      return {
        success: false,
        error: '인보이스 ID 또는 마감 ID가 필요합니다.'
      };
    }

    // 마감 상세 조회
    var detail;

    if (settlementId) {
      detail = getSettlementDetail({ settlementId: settlementId, type: type });
    } else {
      // invoiceId로 먼저 인보이스 정보 조회
      var invoices = getInvoices({ invoiceId: invoiceId });

      if (!invoices.success || !invoices.invoices || !invoices.invoices.length) {
        return {
          success: false,
          error: '해당 인보이스를 찾을 수 없습니다.'
        };
      }

      var inv = invoices.invoices[0];
      detail = getSettlementDetail({ settlementId: inv.settlementId, type: inv.type });
    }

    if (!detail || !detail.success) {
      return {
        success: false,
        error: detail ? detail.error : '마감 상세 조회에 실패했습니다.'
      };
    }

    // PDF 생성
    var zipResult = generateInvoiceZip({
      settlementId: detail.settlement.settlementId,
      type: detail.settlement.type,
      partner: detail.settlement.partner,
      items: detail.items
    });

    if (!zipResult || !zipResult.success) {
      return {
        success: false,
        error: zipResult ? zipResult.error : 'PDF 생성에 실패했습니다.'
      };
    }

    Logger.log('[reprintInvoice] 청구서 재출력 완료: ' + (invoiceId || settlementId));

    return {
      success: true,
      fileId: zipResult.fileId,
      fileName: zipResult.fileName,
      message: '청구서 재출력이 완료되었습니다.'
    };

  } catch (err) {
    Logger.log('[reprintInvoice Error] ' + err.message);
    return {
      success: false,
      error: '청구서 재출력 중 오류 발생: ' + err.message
    };
  }
}
