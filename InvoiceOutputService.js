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

  // 새로운 파라미터들
  var outputFormat = params.outputFormat || 'PDF';
  var docDate      = params.docDate      || '';
  var deliveryDate = params.deliveryDate || '';
  var manualRemark = params.manualRemark || '';

  Logger.log('[generateInvoiceZip] docType=' + docType + ', outputFormat=' + outputFormat + ', printMode=' + printMode);

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
  // Excel 출력 모드 처리
  // ========================================
  if (outputFormat === 'EXCEL') {
    Logger.log('[generateInvoiceZip] Excel 출력 모드');
    return generateExcelOutput_(orderCodes, rows, header, {
      docType: docType,
      printMode: printMode,
      modesByOrder: modesByOrder,
      mergeBySupplier: mergeBySupplier,
      docDate: docDate,
      deliveryDate: deliveryDate,
      manualRemark: manualRemark
    });
  }

  // ========================================
  // 매입처별 통합 출력 모드 (PDF)
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
        var needsExcel = false;

        // 통합 문서에서 Short 모드가 하나라도 있는지 확인
        for (var k = 0; k < groupOrderCodes.length; k++) {
          var oc = groupOrderCodes[k];
          var mode = modesByOrder[oc] || printMode || 'auto';
          var ocRows = rows.filter(function(r) { return String(r[idxOrderNo]) === String(oc); });

          var idxQtyConfirmedTemp = header.indexOf('확정수량');
          var idxQtyOrderTemp = header.indexOf('발주수량');
          var qtyColTemp = idxQtyConfirmedTemp >= 0 ? idxQtyConfirmedTemp : idxQtyOrderTemp;
          var itemCountTemp = 0;
          for (var m = 0; m < ocRows.length; m++) {
            if (Number(ocRows[m][qtyColTemp] || 0) > 0) itemCountTemp++;
          }

          var actualModeTemp = mode;
          if (mode === 'auto') {
            actualModeTemp = itemCountTemp <= 5 ? 'full' : 'short';
          }

          if (actualModeTemp === 'short' && itemCountTemp > 5) {
            needsExcel = true;
            break;
          }
        }

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

          // Short 모드가 하나라도 있으면 통합 세부목록 엑셀 생성
          if (needsExcel) {
            try {
              var excelFileName = '원브릿지_' + supplier + '_' + docTypeLabel + '_세부목록_' + dateStr;
              var excelBlob = generateDetailExcel_(allOrderRows, header, groupOrderCodes.join('_'), excelFileName);
              pdfBlobs.push(excelBlob);
              Logger.log('[generateInvoiceZip] 통합 세부목록 엑셀 생성 완료: ' + supplier);
            } catch (excelErr) {
              Logger.log('[generateInvoiceZip] 통합 세부목록 엑셀 생성 실패 - ' + supplier + ': ' + excelErr.message);
            }
          }
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
          actualMode = 'full'; // auto 모드: 항상 full (템플릿이 멀티페이지 처리)
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

          // Short 모드인 경우 세부목록 엑셀도 생성
          if (actualMode === 'short' && itemCount > 5) {
            try {
              var excelFileName = '원브릿지_' + partner + '_' + docTypeLabel + '_세부목록_' + brandName + '_' + dateStr;
              var excelBlob = generateDetailExcel_(orderRows, header, orderCode, excelFileName);
              pdfBlobs.push(excelBlob);
              Logger.log('[generateInvoiceZip] 세부목록 엑셀 생성 완료: ' + orderCode);
            } catch (excelErr) {
              Logger.log('[generateInvoiceZip] 세부목록 엑셀 생성 실패 - ' + orderCode + ': ' + excelErr.message);
            }
          }
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
  // 출력방식 로직 적용
  // ========================================
  var actualMode = printMode;

  // auto 모드: 품목수에 따라 자동 결정
  if (printMode === 'auto') {
    actualMode = 'full'; // auto 모드: 항상 full (템플릿이 멀티페이지 처리)
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
  // 출력방식 로직 적용
  // ========================================
  var actualMode = printMode;

  // auto 모드: 품목수에 따라 자동 결정
  if (printMode === 'auto') {
    actualMode = 'full'; // auto 모드: 항상 full (템플릿이 멀티페이지 처리)
  }

  // short 모드: 품목 리스트를 축약
  if (actualMode === 'short' && itemCount > 0) {
    var summaryText = brandName + ' 총 ' + itemCount + '건';
    items = [{
      code:   '',
      name:   summaryText,
      spec:   '',
      qty:    formatNumber_(itemCount),
      price:  '',
      amount: formatNumber_(totalAmount),
      note:   '(단축 출력)'
    }];
  }

  if (!items.length) {
    items.push({
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

    items:          items,
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
  // 출력방식 로직 적용
  // ========================================
  var actualMode = printMode;

  // auto 모드: 품목수에 따라 자동 결정
  if (printMode === 'auto') {
    actualMode = 'full'; // auto 모드: 항상 full (템플릿이 멀티페이지 처리)
  }

  // short 모드: 품목 리스트를 축약
  if (actualMode === 'short' && itemCount > 0) {
    var summaryText = brandName + ' 총 ' + itemCount + '건';
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
    items.push({
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

    items:          items,
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
  var supplierInfo = findPartnerByName_(supplierNm);
  var buyerInfo    = findPartnerByName_(buyerNm);

  var supplierBizNo   = supplierInfo ? (supplierInfo.bizNo || '')     : '';
  var supplierManager = supplierInfo ? (supplierInfo.manager || '')   : '';
  var buyerBizNo      = buyerInfo    ? (buyerInfo.bizNo || '')        : '';
  var buyerPhone      = buyerInfo    ? (buyerInfo.phone || '')        : '';
  var buyerAddress    = buyerInfo    ? (buyerInfo.address || '')      : '';

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
  // 브랜드별 출력방식 적용 + 전체 품목 리스트 생성
  // ========================================
  var allItems = [];
  var grandTotalSupply = 0;

  for (var orderCode in orderGroups) {
    var group = orderGroups[orderCode];
    var mode = modesByOrder[orderCode] || defaultMode || 'auto';

    // auto 모드: 품목수에 따라 결정
    var actualMode = mode;
    if (mode === 'auto') {
      actualMode = 'full'; // auto 모드: 항상 full (템플릿이 멀티페이지 처리)
    }

    // short 모드: 축약
    if (actualMode === 'short' && group.itemCount > 0) {
      var summaryText = group.brandName + ' 총 ' + group.itemCount + '건';
      allItems.push({
        code:   '',
        name:   summaryText,
        spec:   '',
        qty:    formatNumber_(group.itemCount),
        price:  '',
        amount: formatNumber_(group.totalSupply),
        note:   '(단축 출력)'
      });
    } else {
      // full 모드: 전체 품목 추가
      allItems = allItems.concat(group.items);
    }

    grandTotalSupply += group.totalSupply;
  }

  if (!allItems.length) {
    allItems.push({
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

    supplierName:   supplierNm,
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

    items:          allItems,
    buyerOrderCode: '',
    remark:         '(영세율)'
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
 * 세부목록 엑셀 생성 (Short 모드용)
 * - 품목 수가 많을 때 (>5개) PDF에는 요약만 표시하고 상세 내역은 엑셀로 출력
 * @param {Array} orderRows 발주 데이터 행 배열
 * @param {Array} header 거래원장 헤더
 * @param {string} orderCode 발주번호
 * @param {string} fileName 엑셀 파일명
 * @return {Blob} Excel 파일 Blob
 */
function generateDetailExcel_(orderRows, header, orderCode, fileName) {
  // 새로운 스프레드시트 생성
  var ss = SpreadsheetApp.create('세부목록_' + orderCode);
  var sheet = ss.getSheets()[0];
  sheet.setName('세부목록');

  // 거래원장 인덱스 정의
  var idxDate         = header.indexOf('발주일');
  var idxProductCode  = header.indexOf('품목코드');
  var idxBrand        = header.indexOf('브랜드');
  var idxProductName  = header.indexOf('제품명');
  var idxQtyConfirmed = header.indexOf('확정수량');
  var idxQtyOrder     = header.indexOf('발주수량');
  var idxSupplyPrice  = header.indexOf('공급가');
  var idxSupplyAmount = header.indexOf('공급액');
  var idxUnitPrice    = header.indexOf('매입가');
  var idxAmount       = header.indexOf('매입액');

  // 엑셀 헤더 작성
  var excelHeader = ['순번', '발주일', '품목코드', '브랜드', '품명', '수량', '단가', '금액'];
  sheet.getRange(1, 1, 1, excelHeader.length).setValues([excelHeader]);

  // 헤더 스타일 적용
  var headerRange = sheet.getRange(1, 1, 1, excelHeader.length);
  headerRange.setBackground('#4a5568');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');

  // 데이터 행 작성
  var qtyCol = idxQtyConfirmed >= 0 ? idxQtyConfirmed : idxQtyOrder;
  var priceCol = idxSupplyPrice >= 0 ? idxSupplyPrice : idxUnitPrice;
  var amountCol = idxSupplyAmount >= 0 ? idxSupplyAmount : idxAmount;

  var dataRows = [];
  var rowNum = 1;

  for (var i = 0; i < orderRows.length; i++) {
    var r = orderRows[i];
    var qty = Number(r[qtyCol] || 0);
    if (!qty) continue;  // 수량 0은 제외

    var orderDate = r[idxDate] ? formatDateYmd_(r[idxDate]) : '';
    var productCode = idxProductCode >= 0 ? (r[idxProductCode] || '') : '';
    var brand = r[idxBrand] || '';
    var productName = r[idxProductName] || '';
    var price = Number(r[priceCol] || 0);
    var amount = Number(r[amountCol] || 0);

    dataRows.push([
      rowNum,
      orderDate,
      productCode,
      brand,
      productName,
      qty,
      price,
      amount
    ]);

    rowNum++;
  }

  // 데이터 입력
  if (dataRows.length > 0) {
    sheet.getRange(2, 1, dataRows.length, excelHeader.length).setValues(dataRows);

    // 숫자 컬럼 포맷 적용
    sheet.getRange(2, 6, dataRows.length, 1).setNumberFormat('#,##0');  // 수량
    sheet.getRange(2, 7, dataRows.length, 1).setNumberFormat('#,##0');  // 단가
    sheet.getRange(2, 8, dataRows.length, 1).setNumberFormat('#,##0');  // 금액
  }

  // 열 너비 자동 조정
  for (var col = 1; col <= excelHeader.length; col++) {
    sheet.autoResizeColumn(col);
  }

  // Excel 파일로 내보내기
  var fileId = ss.getId();
  var file = DriveApp.getFileById(fileId);
  var blob = file.getAs('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  blob.setName(fileName + '.xlsx');

  // 임시 스프레드시트 삭제
  DriveApp.getFileById(fileId).setTrashed(true);

  return blob;
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
  // 브랜드별 출력방식 적용 + 전체 품목 리스트 생성
  // ========================================
  var allItems = [];
  var grandTotalAmount = 0;

  for (var orderCode in orderGroups) {
    var group = orderGroups[orderCode];
    var mode = modesByOrder[orderCode] || defaultMode || 'auto';

    // auto 모드: 품목수에 따라 결정
    var actualMode = mode;
    if (mode === 'auto') {
      actualMode = 'full'; // auto 모드: 항상 full (템플릿이 멀티페이지 처리)
    }

    // short 모드: 축약
    if (actualMode === 'short' && group.itemCount > 0) {
      var summaryText = group.brandName + ' 총 ' + group.itemCount + '건';
      allItems.push({
        code:   '',
        name:   summaryText,
        spec:   '',
        qty:    formatNumber_(group.itemCount),
        price:  '',
        amount: formatNumber_(group.totalAmount),
        note:   '(단축 출력)'
      });
    } else {
      // full 모드: 전체 품목 추가
      allItems = allItems.concat(group.items);
    }

    grandTotalAmount += group.totalAmount;
  }

  if (!allItems.length) {
    allItems.push({
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

    items:          allItems,
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
  // 브랜드별 출력방식 적용 + 전체 품목 리스트 생성
  // ========================================
  var allItems = [];
  var grandTotalSupply = 0;
  var grandTotalAmount = 0;

  for (var orderCode in orderGroups) {
    var group = orderGroups[orderCode];
    var mode = modesByOrder[orderCode] || defaultMode || 'auto';

    // auto 모드: 품목수에 따라 결정
    var actualMode = mode;
    if (mode === 'auto') {
      actualMode = 'full'; // auto 모드: 항상 full (템플릿이 멀티페이지 처리)
    }

    // short 모드: 축약
    if (actualMode === 'short' && group.itemCount > 0) {
      var summaryText = group.brandName + ' 총 ' + group.itemCount + '건';
      allItems.push({
        code:   '',
        name:   summaryText,
        spec:   '',
        qty:    formatNumber_(group.itemCount),
        price:  '',
        amount: formatNumber_(group.totalSupply),
        note:   '(단축 출력)'
      });
    } else {
      // full 모드: 전체 품목 추가
      allItems = allItems.concat(group.items);
    }

    grandTotalSupply += group.totalSupply;
    grandTotalAmount += group.totalAmount;
  }

  if (!allItems.length) {
    allItems.push({
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

    supplierName:   supplierNm,
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

    items:          allItems,
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

// ============================================================
// 전용 양식 출력 기능 (롬앤/누즈, 종근당, 삐아계열)
// ============================================================

/**
 * 전용 양식 브랜드 상수 정의
 */
var CUSTOM_TEMPLATE_BRANDS = {
  ROMAND_NUDZ: ['롬앤', '누즈', 'ROMAND', 'rom&nd'],
  JONGGEUNDANG: ['종근당', '종근당건강'],
  BBIA_GROUP: ['삐아', '어바웃톤', '이글립스', 'BBIA', 'ABOUTTONE', 'EGLIPS']
};

/**
 * 브랜드가 전용 양식 대상인지 확인
 */
function getCustomTemplateGroup_(brandName) {
  if (!brandName) return null;
  var normalized = String(brandName).trim().toUpperCase();

  for (var i = 0; i < CUSTOM_TEMPLATE_BRANDS.ROMAND_NUDZ.length; i++) {
    if (normalized.indexOf(CUSTOM_TEMPLATE_BRANDS.ROMAND_NUDZ[i].toUpperCase()) >= 0) return 'ROMAND_NUDZ';
  }
  for (var i = 0; i < CUSTOM_TEMPLATE_BRANDS.JONGGEUNDANG.length; i++) {
    if (normalized.indexOf(CUSTOM_TEMPLATE_BRANDS.JONGGEUNDANG[i].toUpperCase()) >= 0) return 'JONGGEUNDANG';
  }
  for (var i = 0; i < CUSTOM_TEMPLATE_BRANDS.BBIA_GROUP.length; i++) {
    if (normalized.indexOf(CUSTOM_TEMPLATE_BRANDS.BBIA_GROUP[i].toUpperCase()) >= 0) return 'BBIA_GROUP';
  }
  return null;
}

/**
 * 전용 양식 템플릿 파일 ID (Script Properties에서 관리)
 */
function getCustomTemplateFileIds_() {
  var props = PropertiesService.getScriptProperties();
  return {
    ROMAND_NUDZ: props.getProperty('TEMPLATE_ROMAND_NUDZ') || '',
    JONGGEUNDANG: props.getProperty('TEMPLATE_JONGGEUNDANG') || '',
    BBIA_GROUP: props.getProperty('TEMPLATE_BBIA_GROUP') || ''
  };
}

/**
 * 전용 양식 Excel 파일 생성 라우터
 */
function buildCustomTemplateExcel_(templateGroup, orderCode, orderRows, header, options) {
  var templateIds = getCustomTemplateFileIds_();
  var templateId = templateIds[templateGroup];
  if (!templateId) {
    Logger.log('[buildCustomTemplateExcel_] 템플릿 파일 ID 미설정: ' + templateGroup);
    return null;
  }

  switch (templateGroup) {
    case 'ROMAND_NUDZ':
      return buildRomandNudzExcel_(templateId, orderCode, orderRows, header, options);
    case 'JONGGEUNDANG':
      return buildJonggeundangExcel_(templateId, orderCode, orderRows, header, options);
    case 'BBIA_GROUP':
      return buildBbiaGroupExcel_(templateId, orderCode, orderRows, header, options);
    default:
      return null;
  }
}

/**
 * 롬앤/누즈 전용 양식 (시트: 롬앤(발주양식), 15행 시작)
 */
function buildRomandNudzExcel_(templateFileId, orderCode, orderRows, header, options) {
  Logger.log('[buildRomandNudzExcel_] 시작 - ' + orderCode);
  var templateFile = DriveApp.getFileById(templateFileId);
  var copiedFile = templateFile.makeCopy('롬앤발주_' + orderCode + '_' + Date.now());
  var ss = SpreadsheetApp.open(copiedFile);
  var sheet = ss.getSheetByName('롬앤(발주양식)');
  if (!sheet) { copiedFile.setTrashed(true); return null; }

  var idxBarcode = header.indexOf('바코드');
  var idxProductName = header.indexOf('제품명');
  var idxQty = header.indexOf('확정수량') >= 0 ? header.indexOf('확정수량') : header.indexOf('발주수량');

  var startRow = 15;
  for (var i = 0; i < orderRows.length; i++) {
    var r = orderRows[i];
    var qty = Number(r[idxQty] || 0);
    if (!qty) continue;

    var rowNum = startRow + i;
    sheet.getRange(rowNum, 2).setValue(r[idxBarcode] || '');
    sheet.getRange(rowNum, 3).setValue(r[idxProductName] || '');
    sheet.getRange(rowNum, 6).setValue('39%');
    sheet.getRange(rowNum, 9).setValue(qty);
  }

  SpreadsheetApp.flush();
  var blob = copiedFile.getBlob();
  copiedFile.setTrashed(true);
  return blob;
}

/**
 * 종근당 전용 양식 (시트: 2. 발주서, 5행 시작)
 */
function buildJonggeundangExcel_(templateFileId, orderCode, orderRows, header, options) {
  Logger.log('[buildJonggeundangExcel_] 시작 - ' + orderCode);
  var templateFile = DriveApp.getFileById(templateFileId);
  var copiedFile = templateFile.makeCopy('종근당발주_' + orderCode + '_' + Date.now());
  var ss = SpreadsheetApp.open(copiedFile);
  var sheet = ss.getSheetByName('2. 발주서');
  if (!sheet) { copiedFile.setTrashed(true); return null; }

  var idxProductCode = header.indexOf('품목코드');
  var idxProductName = header.indexOf('제품명');
  var idxSupplyPrice = header.indexOf('공급가');
  var idxQty = header.indexOf('확정수량') >= 0 ? header.indexOf('확정수량') : header.indexOf('발주수량');

  if (options.docDate) sheet.getRange('B5').setValue(options.docDate);

  var startRow = 5;
  for (var i = 0; i < orderRows.length; i++) {
    var r = orderRows[i];
    var qty = Number(r[idxQty] || 0);
    if (!qty) continue;

    var rowNum = startRow + i;
    sheet.getRange(rowNum, 5).setValue(r[idxProductCode] || '');
    sheet.getRange(rowNum, 6).setValue(r[idxProductName] || '');
    sheet.getRange(rowNum, 9).setValue(Number(r[idxSupplyPrice] || 0));
    sheet.getRange(rowNum, 10).setValue(qty);
  }

  SpreadsheetApp.flush();
  var blob = copiedFile.getBlob();
  copiedFile.setTrashed(true);
  return blob;
}

/**
 * 삐아계열 전용 양식 (시트: 브랜드별, 10행 시작, 바코드 매칭)
 */
function buildBbiaGroupExcel_(templateFileId, orderCode, orderRows, header, options) {
  Logger.log('[buildBbiaGroupExcel_] 시작 - ' + orderCode);
  var templateFile = DriveApp.getFileById(templateFileId);
  var copiedFile = templateFile.makeCopy('삐아계열발주_' + orderCode + '_' + Date.now());
  var ss = SpreadsheetApp.open(copiedFile);

  var idxBrand = header.indexOf('브랜드');
  var brandName = orderRows[0] && orderRows[0][idxBrand] || '삐아';

  var sheetName = brandName.indexOf('어바웃톤') >= 0 ? '어바웃톤' :
                  brandName.indexOf('이글립스') >= 0 ? '이글립스' : '삐아';

  var sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];

  var idxBarcode = header.indexOf('바코드');
  var idxQty = header.indexOf('확정수량') >= 0 ? header.indexOf('확정수량') : header.indexOf('발주수량');

  // B8: 날짜
  var dateStr = options.docDate || '';
  if (options.deliveryDate) dateStr += ' / 납품: ' + options.deliveryDate;
  sheet.getRange('B8').setValue(dateStr);

  // 바코드 → 수량 맵
  var qtyMap = {};
  for (var i = 0; i < orderRows.length; i++) {
    var barcode = String(orderRows[i][idxBarcode] || '').trim();
    var qty = Number(orderRows[i][idxQty] || 0);
    if (barcode && qty) qtyMap[barcode] = (qtyMap[barcode] || 0) + qty;
  }

  // 템플릿 바코드 매칭
  var templateData = sheet.getRange(10, 1, sheet.getLastRow() - 9, 8).getValues();
  for (var r = 0; r < templateData.length; r++) {
    var tBarcode = String(templateData[r][1] || templateData[r][0] || '').trim();
    if (tBarcode && qtyMap[tBarcode]) {
      sheet.getRange(10 + r, 8).setValue(qtyMap[tBarcode]);
    }
  }

  SpreadsheetApp.flush();
  var blob = copiedFile.getBlob();
  copiedFile.setTrashed(true);
  return blob;
}

// ========================================
// Excel 출력 모드 처리 함수
// ========================================
/**
 * Excel 형식으로 발주/거래명세서 데이터 출력
 * @param {string[]} orderCodes 발주번호 배열
 * @param {Array[]} rows 데이터 행
 * @param {string[]} header 헤더 배열
 * @param {Object} options 옵션
 * @return {Object} 결과 객체
 */
function generateExcelOutput_(orderCodes, rows, header, options) {
  var docType = options.docType || 'INVOICE_VAT';
  var mergeBySupplier = options.mergeBySupplier || false;
  var docDate = options.docDate || '';
  var manualRemark = options.manualRemark || '';

  var idxOrderNo = header.indexOf('발주번호');
  var idxSupplier = header.indexOf('매입처');
  var idxBuyer = header.indexOf('발주처');
  var idxBrand = header.indexOf('브랜드');
  var idxProductCode = header.indexOf('품목코드');
  var idxProductName = header.indexOf('품명');
  var idxSpec = header.indexOf('규격');
  var idxOrderDate = header.indexOf('발주일');
  var idxQtyOrder = header.indexOf('발주수량');
  var idxQtyConfirmed = header.indexOf('확정수량');
  var idxPurchasePrice = header.indexOf('매입가');
  var idxPurchaseAmt = header.indexOf('매입액');
  var idxSupplyPrice = header.indexOf('공급가');
  var idxSupplyAmt = header.indexOf('공급액');
  var idxVatType = header.indexOf('부가세구분');

  // 선택된 발주의 데이터 필터링
  var filteredRows = [];
  orderCodes.forEach(function(oc) {
    rows.forEach(function(row) {
      if (String(row[idxOrderNo]) === String(oc)) {
        filteredRows.push(row);
      }
    });
  });

  if (!filteredRows.length) {
    return { success: false, error: '출력할 데이터가 없습니다.' };
  }

  // ========================================
  // 전용 양식 Excel 출력 처리
  // ========================================
  if (docType.indexOf('CUSTOM_') === 0) {
    Logger.log('[generateExcelOutput_] 전용 양식 출력: ' + docType);
    return generateCustomTemplateExcel_(docType, orderCodes, filteredRows, header, options);
  }

  // 문서 유형에 따른 라벨
  var docTypeLabel = '';
  switch (docType) {
    case 'ORDER_PURCHASE': docTypeLabel = '발주서(매입)'; break;
    case 'INVOICE_VAT': docTypeLabel = '거래명세서(부포)'; break;
    case 'INVOICE_NVAT': docTypeLabel = '거래명세서(영세)'; break;
    default: docTypeLabel = '문서';
  }

  var tz = Session.getScriptTimeZone();
  var ts = Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmmss');
  var fileName = '원브릿지_' + docTypeLabel + '_' + ts;

  // 스프레드시트 생성
  var ss = SpreadsheetApp.create(fileName);
  var sheet = ss.getActiveSheet();
  sheet.setName('출력데이터');

  // 헤더 행 (문서유형에 따라 다름)
  var excelHeader, dataFunc;

  if (docType === 'ORDER_PURCHASE') {
    // 발주서: 매입가, 매입액 사용
    excelHeader = ['No', '발주번호', '발주일', '매입처', '브랜드', '품목코드', '품명', '규격', '발주수량', '매입단가', '매입금액', '비고'];
    dataFunc = function(row, idx) {
      var qty = Number(row[idxQtyOrder] || 0);
      var price = Number(row[idxPurchasePrice] || 0);
      var amt = Number(row[idxPurchaseAmt] || qty * price);
      return [
        idx + 1,
        row[idxOrderNo] || '',
        formatDateYmd_(row[idxOrderDate]),
        row[idxSupplier] || '',
        row[idxBrand] || '',
        row[idxProductCode] || '',
        row[idxProductName] || '',
        row[idxSpec] || '',
        qty,
        price,
        amt,
        ''
      ];
    };
  } else {
    // 거래명세서: 공급가, 공급액, VAT 포함
    var isVat = (docType === 'INVOICE_VAT');
    excelHeader = ['No', '발주번호', '발주일', '발주처', '브랜드', '품목코드', '품명', '규격', '확정수량', '공급단가', '공급가액', 'VAT', '합계', '비고'];
    dataFunc = function(row, idx) {
      var qty = Number(row[idxQtyConfirmed] || row[idxQtyOrder] || 0);
      var price = Number(row[idxSupplyPrice] || 0);
      var supplyAmt = Number(row[idxSupplyAmt] || qty * price);
      var vat = 0;
      if (isVat) {
        var vatType = String(row[idxVatType] || '').trim();
        if (vatType === '부별') {
          vat = Math.round(supplyAmt * 0.1);
        } else if (vatType === '부포') {
          vat = Math.round(supplyAmt / 11);
        }
      }
      var total = supplyAmt + vat;
      return [
        idx + 1,
        row[idxOrderNo] || '',
        formatDateYmd_(row[idxOrderDate]),
        row[idxBuyer] || '',
        row[idxBrand] || '',
        row[idxProductCode] || '',
        row[idxProductName] || '',
        row[idxSpec] || '',
        qty,
        price,
        supplyAmt,
        vat,
        total,
        ''
      ];
    };
  }

  // 헤더 쓰기
  sheet.getRange(1, 1, 1, excelHeader.length).setValues([excelHeader]);
  var headerRange = sheet.getRange(1, 1, 1, excelHeader.length);
  headerRange.setBackground('#334155');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');

  // 데이터 행 쓰기
  var dataRows = [];
  for (var i = 0; i < filteredRows.length; i++) {
    var qty = docType === 'ORDER_PURCHASE'
      ? Number(filteredRows[i][idxQtyOrder] || 0)
      : Number(filteredRows[i][idxQtyConfirmed] || filteredRows[i][idxQtyOrder] || 0);
    if (qty > 0) {
      dataRows.push(dataFunc(filteredRows[i], dataRows.length));
    }
  }

  if (dataRows.length > 0) {
    sheet.getRange(2, 1, dataRows.length, excelHeader.length).setValues(dataRows);

    // 숫자 열 서식
    var numCols = docType === 'ORDER_PURCHASE' ? [9, 10, 11] : [9, 10, 11, 12, 13];
    numCols.forEach(function(col) {
      sheet.getRange(2, col, dataRows.length, 1).setNumberFormat('#,##0');
    });
  }

  // 합계 행
  var sumRow = dataRows.length + 2;
  sheet.getRange(sumRow, 1).setValue('합계');
  sheet.getRange(sumRow, 1, 1, 8).merge();
  sheet.getRange(sumRow, 1).setFontWeight('bold').setBackground('#f1f5f9');

  if (docType === 'ORDER_PURCHASE') {
    if (dataRows.length > 0) {
      sheet.getRange(sumRow, 9).setFormula('=SUM(I2:I' + (sumRow - 1) + ')');
      sheet.getRange(sumRow, 11).setFormula('=SUM(K2:K' + (sumRow - 1) + ')');
    }
    sheet.getRange(sumRow, 9, 1, 3).setNumberFormat('#,##0').setFontWeight('bold').setBackground('#f1f5f9');
  } else {
    if (dataRows.length > 0) {
      sheet.getRange(sumRow, 9).setFormula('=SUM(I2:I' + (sumRow - 1) + ')');
      sheet.getRange(sumRow, 11).setFormula('=SUM(K2:K' + (sumRow - 1) + ')');
      sheet.getRange(sumRow, 12).setFormula('=SUM(L2:L' + (sumRow - 1) + ')');
      sheet.getRange(sumRow, 13).setFormula('=SUM(M2:M' + (sumRow - 1) + ')');
    }
    sheet.getRange(sumRow, 9, 1, 5).setNumberFormat('#,##0').setFontWeight('bold').setBackground('#f1f5f9');
  }

  // 비고 추가
  if (manualRemark) {
    var remarkRow = sumRow + 2;
    sheet.getRange(remarkRow, 1).setValue('비고: ' + manualRemark);
    sheet.getRange(remarkRow, 1, 1, excelHeader.length).merge();
  }

  // 열 너비 자동 조정
  for (var col = 1; col <= excelHeader.length; col++) {
    sheet.autoResizeColumn(col);
  }

  // Excel Blob 생성
  SpreadsheetApp.flush();
  var fileId = ss.getId();
  var file = DriveApp.getFileById(fileId);
  var excelBlob = file.getBlob();
  excelBlob.setName(fileName + '.xlsx');

  // 임시 스프레드시트 삭제
  file.setTrashed(true);

  // Drive에 Excel 파일 저장
  var savedFile = DriveApp.createFile(excelBlob);

  Logger.log('[generateExcelOutput_] Excel 생성 완료: ' + savedFile.getName());

  return {
    success: true,
    fileId: savedFile.getId(),
    fileName: savedFile.getName(),
    downloadUrl: savedFile.getDownloadUrl()
  };
}

// ========================================
// 전용 양식 Excel 출력 메인 함수
// ========================================
/**
 * 전용 양식 Excel 파일 생성 (docType 기반)
 * @param {string} docType CUSTOM_ROMAND, CUSTOM_JONGGEUNDANG, CUSTOM_BBIA
 * @param {string[]} orderCodes 발주번호 배열
 * @param {Array[]} rows 필터링된 데이터 행
 * @param {string[]} header 헤더 배열
 * @param {Object} options 옵션
 */
function generateCustomTemplateExcel_(docType, orderCodes, rows, header, options) {
  // docType -> templateGroup 변환
  var templateGroupMap = {
    'CUSTOM_ROMAND': 'ROMAND_NUDZ',
    'CUSTOM_JONGGEUNDANG': 'JONGGEUNDANG',
    'CUSTOM_BBIA': 'BBIA_GROUP'
  };
  var templateGroup = templateGroupMap[docType];
  if (!templateGroup) {
    return { success: false, error: '지원하지 않는 전용 양식입니다: ' + docType };
  }

  var templateLabelMap = {
    'CUSTOM_ROMAND': '롬앤누즈',
    'CUSTOM_JONGGEUNDANG': '종근당',
    'CUSTOM_BBIA': '삐아계열'
  };
  var templateLabel = templateLabelMap[docType] || '전용양식';

  Logger.log('[generateCustomTemplateExcel_] 전용 양식: ' + templateLabel + ', 발주: ' + orderCodes.length + '건');

  var idxOrderNo = header.indexOf('발주번호');
  var blobs = [];
  var tz = Session.getScriptTimeZone();
  var ts = Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmmss');

  // 발주번호별로 전용 양식 Excel 생성
  for (var i = 0; i < orderCodes.length; i++) {
    var orderCode = orderCodes[i];
    var orderRows = rows.filter(function(row) {
      return String(row[idxOrderNo]) === String(orderCode);
    });

    if (!orderRows.length) continue;

    try {
      var blob = buildCustomTemplateExcel_(templateGroup, orderCode, orderRows, header, options);
      if (blob) {
        blob.setName(templateLabel + '_' + orderCode + '_' + ts + '.xlsx');
        blobs.push(blob);
        Logger.log('[generateCustomTemplateExcel_] 생성 완료: ' + orderCode);
      }
    } catch (err) {
      Logger.log('[generateCustomTemplateExcel_] 생성 실패 - ' + orderCode + ': ' + err.message);
    }
  }

  if (!blobs.length) {
    return { success: false, error: '전용 양식 파일을 생성할 수 없습니다. 템플릿 설정을 확인하세요.' };
  }

  // 단일 파일인 경우 직접 저장
  if (blobs.length === 1) {
    var savedFile = DriveApp.createFile(blobs[0]);
    return {
      success: true,
      fileId: savedFile.getId(),
      fileName: savedFile.getName(),
      downloadUrl: savedFile.getDownloadUrl()
    };
  }

  // 여러 파일인 경우 ZIP으로 묶기
  var zipBlob = Utilities.zip(blobs, templateLabel + '_' + ts + '.zip');
  var driveFile = DriveApp.createFile(zipBlob);

  Logger.log('[generateCustomTemplateExcel_] ZIP 생성 완료: ' + driveFile.getName());

  return {
    success: true,
    fileId: driveFile.getId(),
    fileName: driveFile.getName(),
    downloadUrl: driveFile.getDownloadUrl()
  };
}
