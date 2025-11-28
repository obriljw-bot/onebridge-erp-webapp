/**
 * InvoiceOutputService.gs
 * ------------------------------------------------------------
 * OneBridge ERP - 출력 엔진 (거래명세서 / 발주서 PDF ZIP 생성)
 * ------------------------------------------------------------
 * - 거래원장(거래 통합DB) 데이터를 기반으로
 *   발주번호별 PDF를 생성하고 ZIP 파일로 묶어 Drive에 저장
 * - ApiService.handleApiRequest('generateInvoiceZip', params)
 *   에서 호출되는 엔진
 */

/**
 * 메인 엔드포인트
 * @param {Object} params
 *   - orderCodes: string[]   발주번호 배열
 *   - docType:    string     문서 유형 (예: 'INVOICE_VAT')
 *   - printMode:  string     기본 출력 모드 ('full' | 'short' | 'auto')
 *   - modesByOrder: Object   발주번호별 개별 출력 모드 { orderCode: mode }
 */
function generateInvoiceZip(params) {
  params = params || {};
  var orderCodes  = params.orderCodes  || [];
  var docType     = params.docType     || 'INVOICE_VAT';
  var printMode   = params.printMode   || 'auto';
  var modesByOrder = params.modesByOrder || {};

  if (!orderCodes.length) {
    return {
      success: false,
      error: '선택된 발주가 없습니다.'
    };
  }

  // 거래원장 시트 전체 데이터 로드
  var sheet = getOrderMergedSheet();
  var data  = sheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    return {
      success: false,
      error: '거래원장에 데이터가 없습니다.'
    };
  }

  var header = data[0];
  var rows   = data.slice(1);

  var idxOrderNo   = header.indexOf('발주번호');
  if (idxOrderNo === -1) {
    return {
      success: false,
      error: '거래원장에 [발주번호] 컬럼이 없습니다.'
    };
  }

  var pdfBlobs = [];
  var tz       = Session.getScriptTimeZone();
  var ts       = Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmmss');

    // 발주번호별로 PDF 생성
    orderCodes.forEach(function(orderCode) {
      if (!orderCode) return;

      try {
        var orderRows = rows.filter(function(r) {
          return String(r[idxOrderNo]) === String(orderCode);
        });

        if (!orderRows.length) {
          Logger.log('[generateInvoiceZip] 발주번호 ' + orderCode + '에 해당하는 데이터 없음');
          return;
        }

        // 발주별 개별 출력방식 적용
        var mode = modesByOrder[orderCode] || printMode || 'auto';

        var pdfBlob;

        switch (docType) {
          case 'INVOICE_VAT':
          default:
            pdfBlob = buildInvoiceVatPdf(orderCode, orderRows, header, mode);
            break;
        }

        if (pdfBlob) {
          pdfBlob.setName('거래명세서_VAT_' + orderCode + '.pdf');
          pdfBlobs.push(pdfBlob);
        }
      } catch (err) {
        Logger.log('[generateInvoiceZip] PDF 생성 실패 - ' + orderCode + ': ' + err.message);
        // 실패한 발주는 건너뛰고 계속 진행
      }
    });

  if (!pdfBlobs.length) {
    return {
      success: false,
      error: 'PDF를 생성할 유효한 발주 데이터가 없습니다.'
    };
  }

  var zipFileName = 'Invoices_' + ts + '.zip';
  var zipBlob     = Utilities.zip(pdfBlobs, zipFileName);
  var driveFile   = DriveApp.createFile(zipBlob);

  return {
    success: true,
    fileId: driveFile.getId(),
    fileName: driveFile.getName()
  };
}

/**
 * 거래명세서 (VAT 포함) PDF 1건 생성
 * - 거래원장 행 배열(orderRows)과 헤더를 기반으로 템플릿에 매핑
 * - 수량 기준: 확정수량
 */
function buildInvoiceVatPdf(orderCode, orderRows, header, printMode) {
  // 거래원장 인덱스 정의
  var idxDate          = header.indexOf('발주일');
  var idxBrand         = header.indexOf('브랜드');
  var idxSupplierName  = header.indexOf('매입처');
  var idxBuyerName     = header.indexOf('발주처');
  var idxVatType       = header.indexOf('부가세구분');
  var idxProductName   = header.indexOf('제품명');
  var idxProductCode   = header.indexOf('품목코드');
  var idxQtyOrder      = header.indexOf('발주수량');
  var idxQtyConfirmed  = header.indexOf('확정수량');
  var idxUnitPrice     = header.indexOf('매입가');
  var idxSupplyPrice   = header.indexOf('공급가');
  var idxAmount        = header.indexOf('매입액');
  var idxSupplyAmount  = header.indexOf('공급액');

  if (idxDate === -1 || idxSupplierName === -1 || idxBuyerName === -1 || idxProductName === -1) {
    throw new Error('거래원장 헤더 구성이 예상과 다릅니다. (발주일/매입처/발주처/제품명 확인 필요)');
  }

  // 발주 기준 정보
  var firstRow   = orderRows[0];
  var orderDate  = firstRow[idxDate];
  var supplierNm = firstRow[idxSupplierName];
  var buyerNm    = firstRow[idxBuyerName];

  // 거래처 상세 정보(거래처DB) 조회
  var supplierInfo = findPartnerByName_(supplierNm);
  var buyerInfo    = findPartnerByName_(buyerNm);

  var supplierBizNo   = supplierInfo ? (supplierInfo.bizNo || '')     : '';
  var supplierManager = supplierInfo ? (supplierInfo.manager || '')   : '';
  var buyerBizNo      = buyerInfo    ? (buyerInfo.bizNo || '')        : '';
  var buyerPhone      = buyerInfo    ? (buyerInfo.phone || '')        : '';
  var buyerAddress    = buyerInfo    ? (buyerInfo.address || '')      : '';

  // 납기일자: 일단 발주일 기반으로 사용 (추후 별도 컬럼 매핑 가능)
  var dueDate = orderDate;

  // 행 단위 품목 구성
    var qtyCol = idxQtyConfirmed >= 0 ? idxQtyConfirmed : idxQtyOrder; // 거래명세서 → 확정수량 우선

    var items        = [];
    var totalSupply  = 0;
    var totalAmount  = 0;
    var itemCount    = 0;
    var brandName    = firstRow[idxBrand] || '';

    for (var i = 0; i < orderRows.length; i++) {
      var r   = orderRows[i];
      var qty = Number(r[qtyCol] || 0);
      if (!qty) continue;  // 수량 0은 출력 제외

      // ✅ 수정: 거래원장에서 직접 값을 읽음
      var unitPrice   = Number(idxUnitPrice   >= 0 ? (r[idxUnitPrice]   || 0) : 0);
      var supplyPrice = Number(idxSupplyPrice >= 0 ? (r[idxSupplyPrice] || 0) : 0);

      // 매입액 = 거래원장의 "매입액" 컬럼 (이미 수식으로 계산되어 있음)
      var amount = Number(idxAmount >= 0 ? (r[idxAmount] || 0) : (qty * unitPrice));

      // 공급액 = 거래원장의 "공급액" 컬럼 (이미 수식으로 계산되어 있음)
      var supply = Number(idxSupplyAmount >= 0 ? (r[idxSupplyAmount] || 0) : (qty * supplyPrice));

      // ✅ 수정: 총합계는 공급액 기준
      totalAmount += amount;
      totalSupply += supply;
      itemCount++;

      var code = idxProductCode >= 0 ? (r[idxProductCode] || '') : '';
      var name = r[idxProductName] || '';
      var spec = ''; // 거래원장에는 규격 컬럼이 별도 없으므로 일단 공란 처리

      items.push({
        code:   String(code),
        name:   String(name),
        spec:   String(spec),
        qty:    formatNumber_(qty),
        price:  formatNumber_(supplyPrice),  // ✅ 수정: 거래명세서는 공급가 표시
        amount: formatNumber_(supply),        // ✅ 수정: 거래명세서는 공급액 표시
        note:   ''
      });
    }

  // ========================================
  // 출력방식 로직 적용
  // ========================================
  var actualMode = printMode;

  // auto 모드: 품목수에 따라 자동 결정
  if (printMode === 'auto') {
    actualMode = itemCount <= 5 ? 'full' : 'short';
  }

  // short 모드: 품목 리스트를 축약
  if (actualMode === 'short' && itemCount > 0) {
    var summaryText = brandName + ' 외 ' + (itemCount - 1) + '건';
    items = [{
      code:   '',
      name:   summaryText,
      spec:   '',
      qty:    formatNumber_(itemCount),
      price:  '',
      amount: formatNumber_(totalSupply),
      note:   '(단축 출력)'
    }];
  }

  if (!items.length) {
    // 품목이 하나도 없으면 형식상 1행 빈 행만 생성
    items.push({
      code: '', name: '', spec: '',
      qty: '', price: '', amount: '', note: ''
    });
  }

  var totalVat = totalAmount - totalSupply;
  if (totalVat < 0) totalVat = 0;

  var ctx = {
    stampBase64:    getStampBase64_(),

    supplierName:   supplierNm,
    supplierBizNo:  supplierBizNo,
    supplierManager:supplierManager,

    buyerName:      buyerNm,
    buyerBizNo:     buyerBizNo,
    buyerPhone:     buyerPhone,
    buyerAddress:   buyerAddress,

    dueDate:        formatDateYmd_(orderDate),
    orderCode:      orderCode,

    totalSupply:    formatNumber_(totalSupply),
    totalVat:       formatNumber_(totalVat),
    totalAmount:    formatNumber_(totalAmount),
    amountHangul:   numberToHangulKor_(Math.round(totalAmount)),

    items:          items,
    buyerOrderCode: '',
    remark:         ''
  };

  var tmpl = HtmlService.createTemplateFromFile('Templates_Invoice_VAT');

  // 템플릿 변수 주입
  Object.keys(ctx).forEach(function(k) {
    tmpl[k] = ctx[k];
  });

  var html = tmpl.evaluate().getContent();
  var blob = Utilities.newBlob(html, 'text/html', 'invoice_vat_' + orderCode + '.html')
    .getAs('application/pdf');

  return blob;
}

/**
 * 거래처DB에서 거래처명으로 1건 조회
 * @param {string} name
 * @return {Object|null}
 */
function findPartnerByName_(name) {
  if (!name) return null;

  var data = getSuppliers();
  if (!data || !data.rows || !data.rows.length) return null;

  var header = data.header;
  var rows   = data.rows;

  var idxName    = header.indexOf('거래처명');
  var idxBizNo   = header.indexOf('사업자번호');
  var idxManager = header.indexOf('담당자');
  var idxPhone   = header.indexOf('연락처');
  var idxAddress = header.indexOf('주소');

  if (idxName === -1) return null;

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[idxName]).trim() === String(name).trim()) {
      return {
        name:    r[idxName],
        bizNo:   idxBizNo   >= 0 ? r[idxBizNo]   : '',
        manager: idxManager >= 0 ? r[idxManager] : '',
        phone:   idxPhone   >= 0 ? r[idxPhone]   : '',
        address: idxAddress >= 0 ? r[idxAddress] : ''
      };
    }
  }
  return null;
}

/**
 * 인감 이미지 Base64 조회
 * - 우선 Script Properties에서 STAMP_BASE64 값을 읽고,
 *   없으면 빈 문자열 반환
 */
function getStampBase64_() {
  try {
    var props = PropertiesService.getScriptProperties();
    var v = props.getProperty('STAMP_BASE64') || '';
    return v;
  } catch (e) {
    return '';
  }
}

/**
 * 숫자 → '#,##0' 형식 문자열
 */
function formatNumber_(n) {
  if (n === null || n === undefined || n === '' || isNaN(n)) return '';
  return Utilities.formatString('%s', n.toLocaleString('ko-KR'));
}

/**
 * 날짜 → 'yyyy-MM-dd' 형식 문자열
 */
function formatDateYmd_(d) {
  if (!d) return '';
  if (Object.prototype.toString.call(d) === '[object Date]') {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  // 문자열인 경우 최대한 그대로 사용
  return String(d);
}

/**
 * 정수 금액 → 한글금액 (예: 990000 → '구십구만 원')
 * - 단순 버전이지만 일반적인 금액 범위(수억~수천억)까지 대응
 */
function numberToHangulKor_(num) {
  num = Number(num || 0);
  if (num === 0) return '영원';

  var units  = ['', '만', '억', '조'];
  var nums   = ['영','일','이','삼','사','오','육','칠','팔','구'];
  var smalls = ['', '십', '백', '천'];

  var result = '';
  var unitIndex = 0;

  while (num > 0 && unitIndex < units.length) {
    var part = num % 10000;
    if (part > 0) {
      var partStr = '';
      var digitPos = 0;
      while (part > 0) {
        var digit = part % 10;
        if (digit > 0) {
          var digitStr = '';
          if (!(digit === 1 && digitPos > 0)) {
            digitStr = nums[digit];
          }
          partStr = digitStr + smalls[digitPos] + partStr;
        }
        part = Math.floor(part / 10);
        digitPos++;
      }
      result = partStr + units[unitIndex] + result;
    }
    num = Math.floor(num / 10000);
    unitIndex++;
  }

  return result + ' 원';
}
