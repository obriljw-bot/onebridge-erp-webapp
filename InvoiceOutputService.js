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
 *   - docType:    string     문서 유형 (예: 'INVOICE_VAT', 'ORDER_PURCHASE', 'INVOICE_NVAT')
 *   - printMode:  string     기본 출력 모드 ('full' | 'short' | 'auto')
 *   - modesByOrder: Object   발주번호별 개별 출력 모드 { orderCode: mode }
 *   - mergeBySupplier: boolean  매입처별 통합 출력 여부
 */
function generateInvoiceZip(params) {
  params = params || {};
  var orderCodes  = params.orderCodes  || [];
  var docType     = params.docType     || 'INVOICE_VAT';
  var printMode   = params.printMode   || 'auto';
  var modesByOrder = params.modesByOrder || {};
  var mergeBySupplier = params.mergeBySupplier || false;

  Logger.log('[generateInvoiceZip] 시작 - docType: ' + docType + ', orderCodes: ' + orderCodes.length + '건');

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
  var idxSupplier  = header.indexOf('매입처');
  var idxOrderDate = header.indexOf('발주일');

  if (idxOrderNo === -1) {
    return {
      success: false,
      error: '거래원장에 [발주번호] 컬럼이 없습니다.'
    };
  }

  var pdfBlobs = [];
  var tz       = Session.getScriptTimeZone();
  var ts       = Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmmss');

  // ========================================
  // 매입처별 통합 출력 모드
  // ========================================
  if (mergeBySupplier) {
    Logger.log('[generateInvoiceZip] 매입처별 통합 출력 모드 활성화');

    // 1. 발주번호별로 매입처와 발주일 매핑
    var orderInfoMap = {};
    orderCodes.forEach(function(orderCode) {
      var orderRows = rows.filter(function(r) {
        return String(r[idxOrderNo]) === String(orderCode);
      });
      if (orderRows.length > 0) {
        orderInfoMap[orderCode] = {
          supplier: String(orderRows[0][idxSupplier] || ''),
          orderDate: orderRows[0][idxOrderDate] || new Date()
        };
      }
    });

    // 2. 매입처별로 발주번호 그룹핑
    var supplierGroups = {};
    for (var orderCode in orderInfoMap) {
      var supplier = orderInfoMap[orderCode].supplier;
      if (!supplier) continue;

      if (!supplierGroups[supplier]) {
        supplierGroups[supplier] = {
          orderCodes: [],
          orderDate: orderInfoMap[orderCode].orderDate
        };
      }
      supplierGroups[supplier].orderCodes.push(orderCode);
    }

    // 3. 매입처별로 통합 PDF 생성
    for (var supplier in supplierGroups) {
      try {
        var group = supplierGroups[supplier];
        var groupOrderCodes = group.orderCodes;

        // 해당 매입처의 모든 발주 데이터 수집
        var allOrderRows = [];
        groupOrderCodes.forEach(function(orderCode) {
          var orderRows = rows.filter(function(r) {
            return String(r[idxOrderNo]) === String(orderCode);
          });
          allOrderRows = allOrderRows.concat(orderRows);
        });

        if (!allOrderRows.length) {
          Logger.log('[generateInvoiceZip] 매입처 ' + supplier + '에 해당하는 데이터 없음');
          continue;
        }

        var pdfBlob;
        var dateStr = formatDateYmd_(group.orderDate).replace(/-/g, '');
        var fileName = '';
        var docTypeLabel = '';

        switch (docType) {
          case 'INVOICE_VAT':
            // 거래명세서(부포) - VAT 포함
            pdfBlob = buildInvoiceVatPdfMerged(groupOrderCodes, allOrderRows, header, modesByOrder, printMode);
            fileName = '원브릿지_' + supplier + '_거래명세서(부포)_' + dateStr + '.pdf';
            docTypeLabel = '거래명세서(부포)';
            break;

          case 'INVOICE_NVAT':
            // 거래명세서(영세) - VAT 제외
            pdfBlob = buildInvoiceNvatPdfMerged(groupOrderCodes, allOrderRows, header, modesByOrder, printMode);
            fileName = '원브릿지_' + supplier + '_거래명세서(영세)_' + dateStr + '.pdf';
            docTypeLabel = '거래명세서(영세)';
            break;

          case 'ORDER_PURCHASE':
            // 발주서(매입) - 부별/부포
            pdfBlob = buildOrderPurchasePdfMerged(groupOrderCodes, allOrderRows, header, modesByOrder, printMode);
            fileName = '원브릿지_' + supplier + '_발주서(매입)_' + dateStr + '.pdf';
            docTypeLabel = '발주서(매입)';
            break;

          default:
            Logger.log('[generateInvoiceZip] 알 수 없는 문서 유형: ' + docType);
            pdfBlob = buildInvoiceVatPdfMerged(groupOrderCodes, allOrderRows, header, modesByOrder, printMode);
            fileName = '원브릿지_' + supplier + '_문서_' + dateStr + '.pdf';
            docTypeLabel = '문서';
            break;
        }

        if (pdfBlob) {
          pdfBlob.setName(fileName);
          pdfBlobs.push(pdfBlob);
          Logger.log('[generateInvoiceZip] 통합 PDF 생성 완료: ' + supplier + ' (' + groupOrderCodes.length + '개 발주)');
        }
      } catch (err) {
        Logger.log('[generateInvoiceZip] 통합 PDF 생성 실패 - ' + supplier + ': ' + err.message);
      }
    }

  } else {
    // ========================================
    // 기본 모드: 발주번호별 PDF 생성
    // ========================================
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
        var fileName = '';
        var firstRow = orderRows[0];
        var brandName = header.indexOf('브랜드') >= 0 ? (firstRow[header.indexOf('브랜드')] || '') : '';
        var orderDate = header.indexOf('발주일') >= 0 ? firstRow[header.indexOf('발주일')] : new Date();
        var dateStr = formatDateYmd_(orderDate).replace(/-/g, '');
        var partner = header.indexOf('매입처') >= 0 ? (firstRow[header.indexOf('매입처')] || '') : '';

        // 품목 수 계산 (Short 모드 판단용)
        var idxQtyConfirmed = header.indexOf('확정수량');
        var idxQtyOrder = header.indexOf('발주수량');
        var qtyCol = idxQtyConfirmed >= 0 ? idxQtyConfirmed : idxQtyOrder;
        var itemCount = 0;
        for (var j = 0; j < orderRows.length; j++) {
          if (Number(orderRows[j][qtyCol] || 0) > 0) itemCount++;
        }

        // 실제 출력 모드 결정
        var actualMode = mode;
        if (mode === 'auto') {
          actualMode = itemCount <= 10 ? 'full' : 'short';
        }

        var docTypeLabel = '';

        switch (docType) {
          case 'INVOICE_VAT':
            // 거래명세서(부포) - VAT 포함
            pdfBlob = buildInvoiceVatPdf(orderCode, orderRows, header, mode);
            fileName = '원브릿지_' + partner + '_거래명세서(부포)_' + brandName + '_' + dateStr + '.pdf';
            docTypeLabel = '거래명세서(부포)';
            break;

          case 'INVOICE_NVAT':
            // 거래명세서(영세) - VAT 제외
            pdfBlob = buildInvoiceNvatPdf(orderCode, orderRows, header, mode);
            fileName = '원브릿지_' + partner + '_거래명세서(영세)_' + brandName + '_' + dateStr + '.pdf';
            docTypeLabel = '거래명세서(영세)';
            break;

          case 'ORDER_PURCHASE':
            // 발주서(매입) - 부별/부포
            pdfBlob = buildOrderPurchasePdf(orderCode, orderRows, header, mode);
            fileName = '원브릿지_' + partner + '_발주서(매입)_' + brandName + '_' + dateStr + '.pdf';
            docTypeLabel = '발주서(매입)';
            break;

          default:
            pdfBlob = buildInvoiceVatPdf(orderCode, orderRows, header, mode);
            fileName = '원브릿지_' + partner + '_문서_' + brandName + '_' + dateStr + '.pdf';
            docTypeLabel = '문서';
            break;
        }

        if (pdfBlob) {
          pdfBlob.setName(fileName);
          pdfBlobs.push(pdfBlob);
        }
      } catch (err) {
        Logger.log('[generateInvoiceZip] PDF 생성 실패 - ' + orderCode + ': ' + err.message);
        // 실패한 발주는 건너뛰고 계속 진행
      }
    });
  }

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
  // 거래명세서(부포): 원브릿지 = 공급자(상단 좌측), 발주처 = 거래처(상단 우측)
  var companyInfo = findPartnerByName_('원브릿지');
  var partnerInfo = findPartnerByName_(buyerNm);

  var supplierBizNo   = companyInfo ? (companyInfo.bizNo || '')     : '';
  var supplierManager = companyInfo ? (companyInfo.manager || '')   : '';
  var buyerBizNo      = partnerInfo ? (partnerInfo.bizNo || '')     : '';
  var buyerPhone      = partnerInfo ? (partnerInfo.phone || '')     : '';
  var buyerAddress    = partnerInfo ? (partnerInfo.address || '')   : '';

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
  // 멀티페이지 분할 로직
  // ========================================
  var firstPageItems = [];
  var additionalPages = [];
  var FIRST_PAGE_LIMIT = 10;
  var ADDITIONAL_PAGE_LIMIT = 30;

  if (itemCount <= FIRST_PAGE_LIMIT) {
    // 10개 이하: 첫 페이지에 모두 표시
    firstPageItems = items;
  } else {
    // 10개 초과: 멀티페이지 분할
    firstPageItems = items.slice(0, FIRST_PAGE_LIMIT);
    var remainingItems = items.slice(FIRST_PAGE_LIMIT);

    // 추가 페이지들 생성 (페이지당 30개씩)
    for (var pageStart = 0; pageStart < remainingItems.length; pageStart += ADDITIONAL_PAGE_LIMIT) {
      var pageItems = remainingItems.slice(pageStart, pageStart + ADDITIONAL_PAGE_LIMIT);

      // rowNumber 추가 (첫 페이지 이후부터 번호 계속 이어짐)
      for (var k = 0; k < pageItems.length; k++) {
        pageItems[k].rowNumber = FIRST_PAGE_LIMIT + pageStart + k + 1;
      }

      additionalPages.push({ items: pageItems });
    }
  }

  if (!firstPageItems.length) {
    // 품목이 하나도 없으면 형식상 1행 빈 행만 생성
    firstPageItems.push({
      code: '', name: '', spec: '',
      qty: '', price: '', amount: '', note: ''
    });
  }

  var totalVat = totalAmount - totalSupply;
  if (totalVat < 0) totalVat = 0;

  var ctx = {
    stampBase64:    getStampBase64_(),
    logoBase64:     getLogoBase64_(),

    docTitle:       '(주)원브릿지 거래명세서',

    supplierName:   '원브릿지',
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

    items:          firstPageItems,
    additionalPages: additionalPages,
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
 * 발주서 (매입) PDF 1건 생성
 * - 거래원장 행 배열(orderRows)과 헤더를 기반으로 템플릿에 매핑
 * - 수량 기준: 발주수량
 * - 가격 기준: 매입가/매입액 (unitPrice/amount)
 * - VAT 계산: 부가세구분에 따라 부별/부포 처리
 */
function buildOrderPurchasePdf(orderCode, orderRows, header, printMode) {
  // 거래원장 인덱스 정의
  var idxDate          = header.indexOf('발주일');
  var idxBrand         = header.indexOf('브랜드');
  var idxSupplierName  = header.indexOf('매입처');
  var idxBuyerName     = header.indexOf('발주처');
  var idxVatType       = header.indexOf('부가세구분');
  var idxProductName   = header.indexOf('제품명');
  var idxProductCode   = header.indexOf('품목코드');
  var idxQtyOrder      = header.indexOf('발주수량');
  var idxUnitPrice     = header.indexOf('매입가');
  var idxAmount        = header.indexOf('매입액');

  if (idxDate === -1 || idxSupplierName === -1 || idxBuyerName === -1 || idxProductName === -1) {
    throw new Error('거래원장 헤더 구성이 예상과 다릅니다. (발주일/매입처/발주처/제품명 확인 필요)');
  }

  // 발주 기준 정보
  var firstRow   = orderRows[0];
  var orderDate  = firstRow[idxDate];
  var supplierNm = firstRow[idxSupplierName];
  var buyerNm    = firstRow[idxBuyerName];
  var vatType    = idxVatType >= 0 ? String(firstRow[idxVatType] || '부포') : '부포';

  // 거래처 상세 정보(거래처DB) 조회
  // 발주서(매입): 매입처 = 공급자(상단 좌측), 원브릿지 = 발주처(상단 우측)
  var partnerInfo = findPartnerByName_(supplierNm);
  var companyInfo = findPartnerByName_('원브릿지');

  var supplierBizNo   = partnerInfo ? (partnerInfo.bizNo || '')     : '';
  var supplierManager = partnerInfo ? (partnerInfo.manager || '')   : '';
  var supplierPhone   = partnerInfo ? (partnerInfo.phone || '')     : '';
  var supplierAddress = partnerInfo ? (partnerInfo.address || '')   : '';

  var buyerBizNo      = companyInfo ? (companyInfo.bizNo || '')     : '';
  var buyerPhone      = companyInfo ? (companyInfo.phone || '')     : '';
  var buyerAddress    = companyInfo ? (companyInfo.address || '')   : '';

  // 입고지 및 요청사항 정보
  var deliveryAddr    = partnerInfo ? (partnerInfo.deliveryAddr || '')   : '';
  var specialRequest  = partnerInfo ? (partnerInfo.specialRequest || '') : '';

  // 행 단위 품목 구성 (발주서는 발주수량 기준)
  var qtyCol = idxQtyOrder >= 0 ? idxQtyOrder : header.indexOf('확정수량');

  var items        = [];
  var totalAmount  = 0;
  var itemCount    = 0;
  var brandName    = firstRow[idxBrand] || '';

  for (var i = 0; i < orderRows.length; i++) {
    var r   = orderRows[i];
    var qty = Number(r[qtyCol] || 0);
    if (!qty) continue;  // 수량 0은 출력 제외

    // 발주서는 매입가/매입액 사용
    var unitPrice = Number(idxUnitPrice >= 0 ? (r[idxUnitPrice] || 0) : 0);
    var amount    = Number(idxAmount >= 0 ? (r[idxAmount] || 0) : (qty * unitPrice));

    totalAmount += amount;
    itemCount++;

    var code = idxProductCode >= 0 ? (r[idxProductCode] || '') : '';
    var name = r[idxProductName] || '';
    var spec = '';

    items.push({
      code:   String(code),
      name:   String(name),
      spec:   String(spec),
      qty:    formatNumber_(qty),
      price:  formatNumber_(unitPrice),
      amount: formatNumber_(amount),
      note:   ''
    });
  }

  // ========================================
  // 멀티페이지 분할 로직
  // ========================================
  var firstPageItems = [];
  var additionalPages = [];
  var FIRST_PAGE_LIMIT = 10;
  var ADDITIONAL_PAGE_LIMIT = 30;

  if (itemCount <= FIRST_PAGE_LIMIT) {
    // 10개 이하: 첫 페이지에 모두 표시
    firstPageItems = items;
  } else {
    // 10개 초과: 멀티페이지 분할
    firstPageItems = items.slice(0, FIRST_PAGE_LIMIT);
    var remainingItems = items.slice(FIRST_PAGE_LIMIT);

    // 추가 페이지들 생성 (페이지당 30개씩)
    for (var pageStart = 0; pageStart < remainingItems.length; pageStart += ADDITIONAL_PAGE_LIMIT) {
      var pageItems = remainingItems.slice(pageStart, pageStart + ADDITIONAL_PAGE_LIMIT);

      // rowNumber 추가 (첫 페이지 이후부터 번호 계속 이어짐)
      for (var k = 0; k < pageItems.length; k++) {
        pageItems[k].rowNumber = FIRST_PAGE_LIMIT + pageStart + k + 1;
      }

      additionalPages.push({ items: pageItems });
    }
  }

  if (!firstPageItems.length) {
    // 품목이 하나도 없으면 형식상 1행 빈 행만 생성
    firstPageItems.push({
      code: '', name: '', spec: '',
      qty: '', price: '', amount: '', note: ''
    });
  }

  // ========================================
  // VAT 계산 (부별/부포 분기)
  // ========================================
  var totalSupply = 0;
  var totalVat    = 0;

  if (vatType === '부별') {
    // 부별 (VAT separate): 총액을 1.1로 나누어 공급가액 계산
    totalSupply = Math.round(totalAmount / 1.1);
    totalVat = totalAmount - totalSupply;
  } else {
    // 부포 (VAT included): 총액 그대로, VAT는 10%
    totalSupply = totalAmount;
    totalVat = Math.round(totalSupply * 0.1);
    totalAmount = totalSupply + totalVat;
  }

  // 비고란 구성: 입고지, 담당자, 요청사항
  var remarkLines = [];
  if (vatType === '부별') {
    remarkLines.push('※ 부가세별도');
  } else {
    remarkLines.push('※ 부가세포함');
  }
  if (deliveryAddr) {
    remarkLines.push('입고지: ' + deliveryAddr);
  }
  if (supplierManager || supplierPhone) {
    var managerInfo = '담당자: ' + supplierManager;
    if (supplierPhone) managerInfo += ' (' + supplierPhone + ')';
    remarkLines.push(managerInfo);
  }
  if (specialRequest) {
    remarkLines.push('요청사항: ' + specialRequest);
  }

  var ctx = {
    stampBase64:    getStampBase64_(),
    logoBase64:     getLogoBase64_(),

    docTitle:       '(주)원브릿지 매입발주서',

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

    items:          firstPageItems,
    additionalPages: additionalPages,
    buyerOrderCode: '',
    remark:         remarkLines.join('\n')
  };

  // 발주서도 동일한 템플릿 사용 (Templates_Invoice_VAT)
  var tmpl = HtmlService.createTemplateFromFile('Templates_Invoice_VAT');

  // 템플릿 변수 주입
  Object.keys(ctx).forEach(function(k) {
    tmpl[k] = ctx[k];
  });

  var html = tmpl.evaluate().getContent();
  var blob = Utilities.newBlob(html, 'text/html', 'order_purchase_' + orderCode + '.html')
    .getAs('application/pdf');

  return blob;
}

/**
 * 거래명세서 (영세/해외) PDF 1건 생성
 * - 거래원장 행 배열(orderRows)과 헤더를 기반으로 템플릿에 매핑
 * - 수량 기준: 확정수량
 * - VAT 없음 (totalVat = 0)
 */
function buildInvoiceNvatPdf(orderCode, orderRows, header, printMode) {
  // 거래원장 인덱스 정의
  var idxDate          = header.indexOf('발주일');
  var idxBrand         = header.indexOf('브랜드');
  var idxSupplierName  = header.indexOf('매입처');
  var idxBuyerName     = header.indexOf('발주처');
  var idxProductName   = header.indexOf('제품명');
  var idxProductCode   = header.indexOf('품목코드');
  var idxQtyOrder      = header.indexOf('발주수량');
  var idxQtyConfirmed  = header.indexOf('확정수량');
  var idxSupplyPrice   = header.indexOf('공급가');
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
  // 거래명세서(영세): 원브릿지 = 공급자(상단 좌측), 발주처 = 거래처(상단 우측)
  var companyInfo = findPartnerByName_('원브릿지');
  var partnerInfo = findPartnerByName_(buyerNm);

  var supplierBizNo   = companyInfo ? (companyInfo.bizNo || '')     : '';
  var supplierManager = companyInfo ? (companyInfo.manager || '')   : '';
  var buyerBizNo      = partnerInfo ? (partnerInfo.bizNo || '')     : '';
  var buyerPhone      = partnerInfo ? (partnerInfo.phone || '')     : '';
  var buyerAddress    = partnerInfo ? (partnerInfo.address || '')   : '';

  // 행 단위 품목 구성
  var qtyCol = idxQtyConfirmed >= 0 ? idxQtyConfirmed : idxQtyOrder; // 거래명세서 → 확정수량 우선

  var items        = [];
  var totalSupply  = 0;
  var itemCount    = 0;
  var brandName    = firstRow[idxBrand] || '';

  for (var i = 0; i < orderRows.length; i++) {
    var r   = orderRows[i];
    var qty = Number(r[qtyCol] || 0);
    if (!qty) continue;  // 수량 0은 출력 제외

    var supplyPrice = Number(idxSupplyPrice >= 0 ? (r[idxSupplyPrice] || 0) : 0);
    var supply = Number(idxSupplyAmount >= 0 ? (r[idxSupplyAmount] || 0) : (qty * supplyPrice));

    totalSupply += supply;
    itemCount++;

    var code = idxProductCode >= 0 ? (r[idxProductCode] || '') : '';
    var name = r[idxProductName] || '';
    var spec = '';

    items.push({
      code:   String(code),
      name:   String(name),
      spec:   String(spec),
      qty:    formatNumber_(qty),
      price:  formatNumber_(supplyPrice),
      amount: formatNumber_(supply),
      note:   ''
    });
  }

  // ========================================
  // 멀티페이지 분할 로직
  // ========================================
  var firstPageItems = [];
  var additionalPages = [];
  var FIRST_PAGE_LIMIT = 10;
  var ADDITIONAL_PAGE_LIMIT = 30;

  if (itemCount <= FIRST_PAGE_LIMIT) {
    // 10개 이하: 첫 페이지에 모두 표시
    firstPageItems = items;
  } else {
    // 10개 초과: 멀티페이지 분할
    firstPageItems = items.slice(0, FIRST_PAGE_LIMIT);
    var remainingItems = items.slice(FIRST_PAGE_LIMIT);

    // 추가 페이지들 생성 (페이지당 30개씩)
    for (var pageStart = 0; pageStart < remainingItems.length; pageStart += ADDITIONAL_PAGE_LIMIT) {
      var pageItems = remainingItems.slice(pageStart, pageStart + ADDITIONAL_PAGE_LIMIT);

      // rowNumber 추가 (첫 페이지 이후부터 번호 계속 이어짐)
      for (var k = 0; k < pageItems.length; k++) {
        pageItems[k].rowNumber = FIRST_PAGE_LIMIT + pageStart + k + 1;
      }

      additionalPages.push({ items: pageItems });
    }
  }

  if (!firstPageItems.length) {
    // 품목이 하나도 없으면 형식상 1행 빈 행만 생성
    firstPageItems.push({
      code: '', name: '', spec: '',
      qty: '', price: '', amount: '', note: ''
    });
  }

  // 영세율: VAT = 0
  var totalVat = 0;
  var totalAmount = totalSupply;

  var ctx = {
    stampBase64:    getStampBase64_(),
    logoBase64:     getLogoBase64_(),

    docTitle:       '(주)원브릿지 거래명세서',

    supplierName:   '원브릿지',
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

    items:          firstPageItems,
    additionalPages: additionalPages,
    buyerOrderCode: '',
    remark:         '※ 영세율 적용'
  };

  var tmpl = HtmlService.createTemplateFromFile('Templates_Invoice_VAT');

  // 템플릿 변수 주입
  Object.keys(ctx).forEach(function(k) {
    tmpl[k] = ctx[k];
  });

  var html = tmpl.evaluate().getContent();
  var blob = Utilities.newBlob(html, 'text/html', 'invoice_nvat_' + orderCode + '.html')
    .getAs('application/pdf');

  return blob;
}

/**
 * 통합 거래명세서 (영세/해외) PDF 생성
 * - 여러 발주번호(브랜드)의 데이터를 하나의 PDF로 통합
 * - 브랜드별 출력방식 개별 적용
 * - VAT 없음 (totalVat = 0)
 * @param {string[]} orderCodes 통합할 발주번호 배열
 * @param {Array} allOrderRows 모든 발주의 행 데이터
 * @param {Array} header 거래원장 헤더
 * @param {Object} modesByOrder 발주번호별 출력방식
 * @param {string} defaultMode 기본 출력방식
 */
function buildInvoiceNvatPdfMerged(orderCodes, allOrderRows, header, modesByOrder, defaultMode) {
  // 거래원장 인덱스 정의
  var idxDate          = header.indexOf('발주일');
  var idxOrderNo       = header.indexOf('발주번호');
  var idxBrand         = header.indexOf('브랜드');
  var idxSupplierName  = header.indexOf('매입처');
  var idxBuyerName     = header.indexOf('발주처');
  var idxProductName   = header.indexOf('제품명');
  var idxProductCode   = header.indexOf('품목코드');
  var idxQtyOrder      = header.indexOf('발주수량');
  var idxQtyConfirmed  = header.indexOf('확정수량');
  var idxSupplyPrice   = header.indexOf('공급가');
  var idxSupplyAmount  = header.indexOf('공급액');

  if (idxDate === -1 || idxSupplierName === -1 || idxBuyerName === -1 || idxProductName === -1) {
    throw new Error('거래원장 헤더 구성이 예상과 다릅니다. (발주일/매입처/발주처/제품명 확인 필요)');
  }

  // 발주 기준 정보 (첫 번째 행 기준)
  var firstRow   = allOrderRows[0];
  var orderDate  = firstRow[idxDate];
  var supplierNm = firstRow[idxSupplierName];
  var buyerNm    = firstRow[idxBuyerName];

  // 거래처 상세 정보(거래처DB) 조회
  // 거래명세서(영세): 원브릿지 = 공급자(상단 좌측), 발주처 = 거래처(상단 우측)
  var companyInfo = findPartnerByName_('원브릿지');
  var partnerInfo = findPartnerByName_(buyerNm);

  var supplierBizNo   = companyInfo ? (companyInfo.bizNo || '')     : '';
  var supplierManager = companyInfo ? (companyInfo.manager || '')   : '';
  var buyerBizNo      = partnerInfo ? (partnerInfo.bizNo || '')     : '';
  var buyerPhone      = partnerInfo ? (partnerInfo.phone || '')     : '';
  var buyerAddress    = partnerInfo ? (partnerInfo.address || '')   : '';

  // ========================================
  // 발주번호(브랜드)별로 품목 그룹핑
  // ========================================
  var qtyCol = idxQtyConfirmed >= 0 ? idxQtyConfirmed : idxQtyOrder;

  var orderGroups = {};  // { orderCode: { brandName, items: [], mode, itemCount, totalSupply } }

  for (var i = 0; i < allOrderRows.length; i++) {
    var r = allOrderRows[i];
    var orderCode = String(r[idxOrderNo]);
    var brandName = String(r[idxBrand] || '');
    var qty = Number(r[qtyCol] || 0);

    if (!qty) continue;  // 수량 0은 제외

    if (!orderGroups[orderCode]) {
      orderGroups[orderCode] = {
        brandName: brandName,
        items: [],
        itemCount: 0,
        totalSupply: 0
      };
    }

    var supplyPrice = Number(idxSupplyPrice >= 0 ? (r[idxSupplyPrice] || 0) : 0);
    var supply = Number(idxSupplyAmount >= 0 ? (r[idxSupplyAmount] || 0) : (qty * supplyPrice));

    orderGroups[orderCode].totalSupply += supply;
    orderGroups[orderCode].itemCount++;

    var code = idxProductCode >= 0 ? (r[idxProductCode] || '') : '';
    var name = r[idxProductName] || '';

    orderGroups[orderCode].items.push({
      code:   String(code),
      name:   String(name),
      spec:   '',
      qty:    formatNumber_(qty),
      price:  formatNumber_(supplyPrice),
      amount: formatNumber_(supply),
      note:   ''
    });
  }

  // ========================================
  // 브랜드별 품목 리스트 통합
  // ========================================
  var allItems = [];
  var grandTotalSupply = 0;

  for (var orderCode in orderGroups) {
    var group = orderGroups[orderCode];
    // 모든 품목을 allItems에 추가
    allItems = allItems.concat(group.items);
    grandTotalSupply += group.totalSupply;
  }

  // ========================================
  // 멀티페이지 분할 로직
  // ========================================
  var firstPageItems = [];
  var additionalPages = [];
  var FIRST_PAGE_LIMIT = 10;
  var ADDITIONAL_PAGE_LIMIT = 30;
  var itemCount = allItems.length;

  if (itemCount <= FIRST_PAGE_LIMIT) {
    // 10개 이하: 첫 페이지에 모두 표시
    firstPageItems = allItems;
  } else {
    // 10개 초과: 멀티페이지 분할
    firstPageItems = allItems.slice(0, FIRST_PAGE_LIMIT);
    var remainingItems = allItems.slice(FIRST_PAGE_LIMIT);

    // 추가 페이지들 생성 (페이지당 30개씩)
    for (var pageStart = 0; pageStart < remainingItems.length; pageStart += ADDITIONAL_PAGE_LIMIT) {
      var pageItems = remainingItems.slice(pageStart, pageStart + ADDITIONAL_PAGE_LIMIT);

      // rowNumber 추가 (첫 페이지 이후부터 번호 계속 이어짐)
      for (var k = 0; k < pageItems.length; k++) {
        pageItems[k].rowNumber = FIRST_PAGE_LIMIT + pageStart + k + 1;
      }

      additionalPages.push({ items: pageItems });
    }
  }

  if (!firstPageItems.length) {
    // 품목이 하나도 없으면 형식상 1행 빈 행만 생성
    firstPageItems.push({
      code: '', name: '', spec: '',
      qty: '', price: '', amount: '', note: ''
    });
  }

  // 영세율: VAT = 0
  var totalVat = 0;
  var totalAmount = grandTotalSupply;

  // ========================================
  // 템플릿 컨텍스트 생성
  // ========================================
  var ctx = {
    stampBase64:    getStampBase64_(),
    logoBase64:     getLogoBase64_(),

    docTitle:       '(주)원브릿지 거래명세서',

    supplierName:   '원브릿지',
    supplierBizNo:  supplierBizNo,
    supplierManager:supplierManager,

    buyerName:      buyerNm,
    buyerBizNo:     buyerBizNo,
    buyerPhone:     buyerPhone,
    buyerAddress:   buyerAddress,

    dueDate:        formatDateYmd_(orderDate),
    orderCode:      orderCodes.join(', '),  // 여러 발주번호 표시

    totalSupply:    formatNumber_(grandTotalSupply),
    totalVat:       formatNumber_(totalVat),
    totalAmount:    formatNumber_(totalAmount),
    amountHangul:   numberToHangulKor_(Math.round(totalAmount)),

    items:          firstPageItems,
    additionalPages: additionalPages,
    buyerOrderCode: '',
    remark:         '※ 영세율 적용'
  };

  var tmpl = HtmlService.createTemplateFromFile('Templates_Invoice_VAT');

  // 템플릿 변수 주입
  Object.keys(ctx).forEach(function(k) {
    tmpl[k] = ctx[k];
  });

  var html = tmpl.evaluate().getContent();
  var blob = Utilities.newBlob(html, 'text/html', 'invoice_nvat_merged.html')
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

  var idxName           = header.indexOf('거래처명');
  var idxBizNo          = header.indexOf('사업자번호');
  var idxManager        = header.indexOf('담당자');
  var idxPhone          = header.indexOf('연락처');
  var idxAddress        = header.indexOf('주소');
  var idxDeliveryAddr   = header.indexOf('입고지');
  var idxSpecialRequest = header.indexOf('요청사항');

  if (idxName === -1) return null;

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[idxName]).trim() === String(name).trim()) {
      return {
        name:           r[idxName],
        bizNo:          idxBizNo          >= 0 ? r[idxBizNo]          : '',
        manager:        idxManager        >= 0 ? r[idxManager]        : '',
        phone:          idxPhone          >= 0 ? r[idxPhone]          : '',
        address:        idxAddress        >= 0 ? r[idxAddress]        : '',
        deliveryAddr:   idxDeliveryAddr   >= 0 ? r[idxDeliveryAddr]   : '',
        specialRequest: idxSpecialRequest >= 0 ? r[idxSpecialRequest] : ''
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
 * 로고 이미지 Base64 조회
 * - 우선 Script Properties에서 LOGO_BASE64 값을 읽고,
 *   없으면 빈 문자열 반환
 */
function getLogoBase64_() {
  try {
    var props = PropertiesService.getScriptProperties();
    var v = props.getProperty('LOGO_BASE64') || '';
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


/**
 * 통합 발주서 (매입) PDF 생성
 * - 여러 발주번호(브랜드)의 데이터를 하나의 PDF로 통합
 * - 브랜드별 출력방식 개별 적용
 * - VAT 계산: 부가세구분에 따라 부별/부포 처리
 * @param {string[]} orderCodes 통합할 발주번호 배열
 * @param {Array} allOrderRows 모든 발주의 행 데이터
 * @param {Array} header 거래원장 헤더
 * @param {Object} modesByOrder 발주번호별 출력방식
 * @param {string} defaultMode 기본 출력방식
 */
function buildOrderPurchasePdfMerged(orderCodes, allOrderRows, header, modesByOrder, defaultMode) {
  // 거래원장 인덱스 정의
  var idxDate          = header.indexOf('발주일');
  var idxOrderNo       = header.indexOf('발주번호');
  var idxBrand         = header.indexOf('브랜드');
  var idxSupplierName  = header.indexOf('매입처');
  var idxBuyerName     = header.indexOf('발주처');
  var idxVatType       = header.indexOf('부가세구분');
  var idxProductName   = header.indexOf('제품명');
  var idxProductCode   = header.indexOf('품목코드');
  var idxQtyOrder      = header.indexOf('발주수량');
  var idxUnitPrice     = header.indexOf('매입가');
  var idxAmount        = header.indexOf('매입액');

  if (idxDate === -1 || idxSupplierName === -1 || idxBuyerName === -1 || idxProductName === -1) {
    throw new Error('거래원장 헤더 구성이 예상과 다릅니다. (발주일/매입처/발주처/제품명 확인 필요)');
  }

  // 발주 기준 정보 (첫 번째 행 기준)
  var firstRow   = allOrderRows[0];
  var orderDate  = firstRow[idxDate];
  var supplierNm = firstRow[idxSupplierName];
  var buyerNm    = firstRow[idxBuyerName];
  var vatType    = idxVatType >= 0 ? String(firstRow[idxVatType] || '부포') : '부포';

  // 거래처 상세 정보(거래처DB) 조회
  // 발주서(매입): 매입처 = 공급자(상단 좌측), 원브릿지 = 발주처(상단 우측)
  var partnerInfo = findPartnerByName_(supplierNm);
  var companyInfo = findPartnerByName_('원브릿지');

  var supplierBizNo   = partnerInfo ? (partnerInfo.bizNo || '')     : '';
  var supplierManager = partnerInfo ? (partnerInfo.manager || '')   : '';
  var supplierPhone   = partnerInfo ? (partnerInfo.phone || '')     : '';
  var supplierAddress = partnerInfo ? (partnerInfo.address || '')   : '';

  var buyerBizNo      = companyInfo ? (companyInfo.bizNo || '')     : '';
  var buyerPhone      = companyInfo ? (companyInfo.phone || '')     : '';
  var buyerAddress    = companyInfo ? (companyInfo.address || '')   : '';

  // 입고지 및 요청사항 정보
  var deliveryAddr    = partnerInfo ? (partnerInfo.deliveryAddr || '')   : '';
  var specialRequest  = partnerInfo ? (partnerInfo.specialRequest || '') : '';

  // ========================================
  // 발주번호(브랜드)별로 품목 그룹핑
  // ========================================
  var qtyCol = idxQtyOrder >= 0 ? idxQtyOrder : header.indexOf('확정수량');

  var orderGroups = {};  // { orderCode: { brandName, items: [], mode, itemCount, totalAmount } }

  for (var i = 0; i < allOrderRows.length; i++) {
    var r = allOrderRows[i];
    var orderCode = String(r[idxOrderNo]);
    var brandName = String(r[idxBrand] || '');
    var qty = Number(r[qtyCol] || 0);

    if (!qty) continue;  // 수량 0은 제외

    if (!orderGroups[orderCode]) {
      orderGroups[orderCode] = {
        brandName: brandName,
        items: [],
        itemCount: 0,
        totalAmount: 0
      };
    }

    var unitPrice = Number(idxUnitPrice >= 0 ? (r[idxUnitPrice] || 0) : 0);
    var amount    = Number(idxAmount >= 0 ? (r[idxAmount] || 0) : (qty * unitPrice));

    orderGroups[orderCode].totalAmount += amount;
    orderGroups[orderCode].itemCount++;

    var code = idxProductCode >= 0 ? (r[idxProductCode] || '') : '';
    var name = r[idxProductName] || '';

    orderGroups[orderCode].items.push({
      code:   String(code),
      name:   String(name),
      spec:   '',
      qty:    formatNumber_(qty),
      price:  formatNumber_(unitPrice),
      amount: formatNumber_(amount),
      note:   ''
    });
  }

  // ========================================
  // 브랜드별 품목 리스트 통합
  // ========================================
  var allItems = [];
  var grandTotalAmount = 0;

  for (var orderCode in orderGroups) {
    var group = orderGroups[orderCode];
    // 모든 품목을 allItems에 추가
    allItems = allItems.concat(group.items);
    grandTotalAmount += group.totalAmount;
  }

  // ========================================
  // 멀티페이지 분할 로직
  // ========================================
  var firstPageItems = [];
  var additionalPages = [];
  var FIRST_PAGE_LIMIT = 10;
  var ADDITIONAL_PAGE_LIMIT = 30;
  var itemCount = allItems.length;

  if (itemCount <= FIRST_PAGE_LIMIT) {
    // 10개 이하: 첫 페이지에 모두 표시
    firstPageItems = allItems;
  } else {
    // 10개 초과: 멀티페이지 분할
    firstPageItems = allItems.slice(0, FIRST_PAGE_LIMIT);
    var remainingItems = allItems.slice(FIRST_PAGE_LIMIT);

    // 추가 페이지들 생성 (페이지당 30개씩)
    for (var pageStart = 0; pageStart < remainingItems.length; pageStart += ADDITIONAL_PAGE_LIMIT) {
      var pageItems = remainingItems.slice(pageStart, pageStart + ADDITIONAL_PAGE_LIMIT);

      // rowNumber 추가 (첫 페이지 이후부터 번호 계속 이어짐)
      for (var k = 0; k < pageItems.length; k++) {
        pageItems[k].rowNumber = FIRST_PAGE_LIMIT + pageStart + k + 1;
      }

      additionalPages.push({ items: pageItems });
    }
  }

  if (!firstPageItems.length) {
    // 품목이 하나도 없으면 형식상 1행 빈 행만 생성
    firstPageItems.push({
      code: '', name: '', spec: '',
      qty: '', price: '', amount: '', note: ''
    });
  }

  // ========================================
  // VAT 계산 (부별/부포 분기)
  // ========================================
  var totalSupply = 0;
  var totalVat    = 0;

  if (vatType === '부별') {
    // 부별 (VAT separate): 총액을 1.1로 나누어 공급가액 계산
    totalSupply = Math.round(grandTotalAmount / 1.1);
    totalVat = grandTotalAmount - totalSupply;
  } else {
    // 부포 (VAT included): 총액 그대로, VAT는 10%
    totalSupply = grandTotalAmount;
    totalVat = Math.round(totalSupply * 0.1);
    grandTotalAmount = totalSupply + totalVat;
  }

  // ========================================
  // 템플릿 컨텍스트 생성
  // ========================================
  // 비고란 구성: 입고지, 담당자, 요청사항
  var remarkLines = [];
  if (vatType === '부별') {
    remarkLines.push('※ 부가세별도');
  } else {
    remarkLines.push('※ 부가세포함');
  }
  if (deliveryAddr) {
    remarkLines.push('입고지: ' + deliveryAddr);
  }
  if (supplierManager || supplierPhone) {
    var managerInfo = '담당자: ' + supplierManager;
    if (supplierPhone) managerInfo += ' (' + supplierPhone + ')';
    remarkLines.push(managerInfo);
  }
  if (specialRequest) {
    remarkLines.push('요청사항: ' + specialRequest);
  }

  var ctx = {
    stampBase64:    getStampBase64_(),
    logoBase64:     getLogoBase64_(),

    docTitle:       '(주)원브릿지 매입발주서',

    supplierName:   supplierNm,
    supplierBizNo:  supplierBizNo,
    supplierManager:supplierManager,

    buyerName:      buyerNm,
    buyerBizNo:     buyerBizNo,
    buyerPhone:     buyerPhone,
    buyerAddress:   buyerAddress,

    dueDate:        formatDateYmd_(orderDate),
    orderCode:      orderCodes.join(', '),  // 여러 발주번호 표시

    totalSupply:    formatNumber_(totalSupply),
    totalVat:       formatNumber_(totalVat),
    totalAmount:    formatNumber_(grandTotalAmount),
    amountHangul:   numberToHangulKor_(Math.round(grandTotalAmount)),

    items:          firstPageItems,
    additionalPages: additionalPages,
    buyerOrderCode: '',
    remark:         remarkLines.join('\n')
  };

  var tmpl = HtmlService.createTemplateFromFile('Templates_Invoice_VAT');

  // 템플릿 변수 주입
  Object.keys(ctx).forEach(function(k) {
    tmpl[k] = ctx[k];
  });

  var html = tmpl.evaluate().getContent();
  var blob = Utilities.newBlob(html, 'text/html', 'order_purchase_merged.html')
    .getAs('application/pdf');

  return blob;
}

/**
 * 통합 거래명세서 (VAT 포함) PDF 생성
 * - 여러 발주번호(브랜드)의 데이터를 하나의 PDF로 통합
 * - 브랜드별 출력방식 개별 적용
 * @param {string[]} orderCodes 통합할 발주번호 배열
 * @param {Array} allOrderRows 모든 발주의 행 데이터
 * @param {Array} header 거래원장 헤더
 * @param {Object} modesByOrder 발주번호별 출력방식
 * @param {string} defaultMode 기본 출력방식
 */
function buildInvoiceVatPdfMerged(orderCodes, allOrderRows, header, modesByOrder, defaultMode) {
  // 거래원장 인덱스 정의
  var idxDate          = header.indexOf('발주일');
  var idxOrderNo       = header.indexOf('발주번호');
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

  // 발주 기준 정보 (첫 번째 행 기준)
  var firstRow   = allOrderRows[0];
  var orderDate  = firstRow[idxDate];
  var supplierNm = firstRow[idxSupplierName];
  var buyerNm    = firstRow[idxBuyerName];

  // 거래처 상세 정보(거래처DB) 조회
  // 거래명세서(부포): 원브릿지 = 공급자(상단 좌측), 발주처 = 거래처(상단 우측)
  var companyInfo = findPartnerByName_('원브릿지');
  var partnerInfo = findPartnerByName_(buyerNm);

  var supplierBizNo   = companyInfo ? (companyInfo.bizNo || '')     : '';
  var supplierManager = companyInfo ? (companyInfo.manager || '')   : '';
  var buyerBizNo      = partnerInfo ? (partnerInfo.bizNo || '')     : '';
  var buyerPhone      = partnerInfo ? (partnerInfo.phone || '')     : '';
  var buyerAddress    = partnerInfo ? (partnerInfo.address || '')   : '';

  // 납기일자
  var dueDate = orderDate;

  // ========================================
  // 발주번호(브랜드)별로 품목 그룹핑
  // ========================================
  var qtyCol = idxQtyConfirmed >= 0 ? idxQtyConfirmed : idxQtyOrder;

  var orderGroups = {};  // { orderCode: { brandName, items: [], mode, itemCount, totalSupply, totalAmount } }

  for (var i = 0; i < allOrderRows.length; i++) {
    var r = allOrderRows[i];
    var orderCode = String(r[idxOrderNo]);
    var brandName = String(r[idxBrand] || '');
    var qty = Number(r[qtyCol] || 0);

    if (!qty) continue;  // 수량 0은 제외

    if (!orderGroups[orderCode]) {
      orderGroups[orderCode] = {
        brandName: brandName,
        items: [],
        itemCount: 0,
        totalSupply: 0,
        totalAmount: 0
      };
    }

    var unitPrice   = Number(idxUnitPrice   >= 0 ? (r[idxUnitPrice]   || 0) : 0);
    var supplyPrice = Number(idxSupplyPrice >= 0 ? (r[idxSupplyPrice] || 0) : 0);
    var amount = Number(idxAmount >= 0 ? (r[idxAmount] || 0) : (qty * unitPrice));
    var supply = Number(idxSupplyAmount >= 0 ? (r[idxSupplyAmount] || 0) : (qty * supplyPrice));

    orderGroups[orderCode].totalAmount += amount;
    orderGroups[orderCode].totalSupply += supply;
    orderGroups[orderCode].itemCount++;

    var code = idxProductCode >= 0 ? (r[idxProductCode] || '') : '';
    var name = r[idxProductName] || '';

    orderGroups[orderCode].items.push({
      code:   String(code),
      name:   String(name),
      spec:   '',
      qty:    formatNumber_(qty),
      price:  formatNumber_(supplyPrice),
      amount: formatNumber_(supply),
      note:   ''
    });
  }

  // ========================================
  // 브랜드별 품목 리스트 통합
  // ========================================
  var allItems = [];
  var grandTotalSupply = 0;
  var grandTotalAmount = 0;

  for (var orderCode in orderGroups) {
    var group = orderGroups[orderCode];
    // 모든 품목을 allItems에 추가
    allItems = allItems.concat(group.items);
    grandTotalSupply += group.totalSupply;
    grandTotalAmount += group.totalAmount;
  }

  // ========================================
  // 멀티페이지 분할 로직
  // ========================================
  var firstPageItems = [];
  var additionalPages = [];
  var FIRST_PAGE_LIMIT = 10;
  var ADDITIONAL_PAGE_LIMIT = 30;
  var itemCount = allItems.length;

  if (itemCount <= FIRST_PAGE_LIMIT) {
    // 10개 이하: 첫 페이지에 모두 표시
    firstPageItems = allItems;
  } else {
    // 10개 초과: 멀티페이지 분할
    firstPageItems = allItems.slice(0, FIRST_PAGE_LIMIT);
    var remainingItems = allItems.slice(FIRST_PAGE_LIMIT);

    // 추가 페이지들 생성 (페이지당 30개씩)
    for (var pageStart = 0; pageStart < remainingItems.length; pageStart += ADDITIONAL_PAGE_LIMIT) {
      var pageItems = remainingItems.slice(pageStart, pageStart + ADDITIONAL_PAGE_LIMIT);

      // rowNumber 추가 (첫 페이지 이후부터 번호 계속 이어짐)
      for (var k = 0; k < pageItems.length; k++) {
        pageItems[k].rowNumber = FIRST_PAGE_LIMIT + pageStart + k + 1;
      }

      additionalPages.push({ items: pageItems });
    }
  }

  if (!firstPageItems.length) {
    // 품목이 하나도 없으면 형식상 1행 빈 행만 생성
    firstPageItems.push({
      code: '', name: '', spec: '',
      qty: '', price: '', amount: '', note: ''
    });
  }

  var totalVat = grandTotalAmount - grandTotalSupply;
  if (totalVat < 0) totalVat = 0;

  // ========================================
  // 템플릿 컨텍스트 생성
  // ========================================
  var ctx = {
    stampBase64:    getStampBase64_(),
    logoBase64:     getLogoBase64_(),

    docTitle:       '(주)원브릿지 거래명세서',

    supplierName:   '원브릿지',
    supplierBizNo:  supplierBizNo,
    supplierManager:supplierManager,

    buyerName:      buyerNm,
    buyerBizNo:     buyerBizNo,
    buyerPhone:     buyerPhone,
    buyerAddress:   buyerAddress,

    dueDate:        formatDateYmd_(orderDate),
    orderCode:      orderCodes.join(', '),  // 여러 발주번호 표시

    totalSupply:    formatNumber_(grandTotalSupply),
    totalVat:       formatNumber_(totalVat),
    totalAmount:    formatNumber_(grandTotalAmount),
    amountHangul:   numberToHangulKor_(Math.round(grandTotalAmount)),

    items:          firstPageItems,
    additionalPages: additionalPages,
    buyerOrderCode: '',
    remark:         ''
  };

  var tmpl = HtmlService.createTemplateFromFile('Templates_Invoice_VAT');

  // 템플릿 변수 주입
  Object.keys(ctx).forEach(function(k) {
    tmpl[k] = ctx[k];
  });

  var html = tmpl.evaluate().getContent();
  var blob = Utilities.newBlob(html, 'text/html', 'invoice_vat_merged.html')
    .getAs('application/pdf');

  return blob;
}
