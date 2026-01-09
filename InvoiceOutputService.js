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
  var outputFormat = params.outputFormat || 'PDF';  // PDF 또는 EXCEL
  var docDate      = params.docDate      || '';     // 발주일/출고일
  var deliveryDate = params.deliveryDate || '';     // 납품일 (삐아계열용)
  var manualRemark = params.manualRemark || '';     // 비고 수동입력

  Logger.log('[generateInvoiceZip] docType=' + docType + ', outputFormat=' + outputFormat + ', printMode=' + printMode);
  if (manualRemark) {
    Logger.log('[generateInvoiceZip] 비고 수동입력: ' + manualRemark);
  }

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

        switch (docType) {
          case 'INVOICE_VAT':
          default:
            // 통합 PDF 생성 (브랜드별 출력방식 적용)
            pdfBlob = buildInvoiceVatPdfMerged(groupOrderCodes, allOrderRows, header, modesByOrder, printMode);
            break;
        }

        if (pdfBlob) {
          pdfBlob.setName('거래명세서_VAT_' + supplier + '_' + dateStr + '.pdf');
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

        var fileBlob;

        // 추가 옵션 전달
        var options = {
          docDate: docDate,
          deliveryDate: deliveryDate,
          manualRemark: manualRemark
        };

        // Excel 출력인 경우 전용 양식 체크
        if (outputFormat === 'EXCEL') {
          var idxBrand = header.indexOf('브랜드');
          var brandName = orderRows[0] && orderRows[0][idxBrand] || '';
          var templateGroup = getCustomTemplateGroup_(brandName);

          if (templateGroup) {
            // 전용 양식 브랜드: Excel 템플릿 사용
            Logger.log('[generateInvoiceZip] 전용 양식 적용 - 브랜드: ' + brandName + ', 그룹: ' + templateGroup);
            fileBlob = buildCustomTemplateExcel_(templateGroup, orderCode, orderRows, header, options);

            if (fileBlob) {
              fileBlob.setName('발주서_' + brandName + '_' + orderCode + '.xlsx');
              pdfBlobs.push(fileBlob);
            }
            return;  // 전용 양식 처리 완료
          }
        }

        // 일반 PDF 출력 또는 전용 양식 아닌 Excel (PDF로 대체)
        switch (docType) {
          case 'INVOICE_VAT':
          default:
            fileBlob = buildInvoiceVatPdf(orderCode, orderRows, header, mode, options);
            break;
        }

        if (fileBlob) {
          fileBlob.setName('거래명세서_VAT_' + orderCode + '.pdf');
          pdfBlobs.push(fileBlob);
        }
      } catch (err) {
        Logger.log('[generateInvoiceZip] 파일 생성 실패 - ' + orderCode + ': ' + err.message);
        // 실패한 발주는 건너뛰고 계속 진행
      }
    });
  }

  if (!pdfBlobs.length) {
    return {
      success: false,
      error: '출력 파일을 생성할 유효한 발주 데이터가 없습니다.'
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
 * @param {string} orderCode - 발주번호
 * @param {Array} orderRows - 거래원장 행 배열
 * @param {Array} header - 거래원장 헤더
 * @param {string} printMode - 출력 모드 (auto/full/short)
 * @param {Object} options - 추가 옵션 {docDate, deliveryDate, manualRemark}
 */
function buildInvoiceVatPdf(orderCode, orderRows, header, printMode, options) {
  options = options || {};
  var docDate = options.docDate || '';
  var deliveryDate = options.deliveryDate || '';
  var manualRemark = options.manualRemark || '';

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
  // 출력방식 로직 적용 (10행 기준)
  // ========================================
  var ITEMS_THRESHOLD = 10;  // 멀티페이지 기준 행수
  var actualMode = printMode;

  // auto 모드: 품목수에 따라 자동 결정 (10개 이하면 full, 초과면 short+멀티페이지)
  if (printMode === 'auto') {
    actualMode = itemCount <= ITEMS_THRESHOLD ? 'full' : 'short';
  }

  // short 모드: 품목 리스트를 축약 (1페이지 요약용)
  var shortItems = [];
  if (actualMode === 'short' && itemCount > 0) {
    var summaryText = brandName + ' 외 ' + (itemCount - 1) + '건';
    shortItems = [{
      code:   '',
      name:   summaryText,
      spec:   '',
      qty:    formatNumber_(itemCount),
      price:  '',
      amount: formatNumber_(totalSupply),
      note:   ''
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

  // ========================================
  // 멀티페이지 PDF 생성 로직
  // ========================================
  var ITEMS_PER_DETAIL_PAGE = 15;  // 상세페이지 당 품목 수
  var needsMultiPage = (actualMode === 'short' && itemCount > ITEMS_THRESHOLD);

  // 상세 페이지 수 계산
  var detailPageCount = needsMultiPage ? Math.ceil(items.length / ITEMS_PER_DETAIL_PAGE) : 0;
  var totalPages = needsMultiPage ? (1 + detailPageCount) : 1;

  // 날짜 처리: UI에서 지정한 docDate가 있으면 사용, 없으면 발주일 사용
  var displayDate = docDate ? formatDateYmd_(new Date(docDate)) : formatDateYmd_(orderDate);

  // 기본 컨텍스트 (공통)
  var baseCtx = {
    stampBase64:    getStampBase64_(),

    supplierName:   supplierNm,
    supplierBizNo:  supplierBizNo,
    supplierManager:supplierManager,

    buyerName:      buyerNm,
    buyerBizNo:     buyerBizNo,
    buyerPhone:     buyerPhone,
    buyerAddress:   buyerAddress,

    dueDate:        displayDate,
    orderCode:      orderCode,
    deliveryDate:   deliveryDate ? formatDateYmd_(new Date(deliveryDate)) : '',

    totalSupply:    formatNumber_(totalSupply),
    totalVat:       formatNumber_(totalVat),
    totalAmount:    formatNumber_(totalAmount),
    amountHangul:   numberToHangulKor_(Math.round(totalAmount)),

    buyerOrderCode: '',
    remark:         manualRemark || ''
  };

  // ========================================
  // 페이지 데이터 구성
  // ========================================
  var pages = [];

  if (needsMultiPage) {
    // 멀티페이지: 1페이지 요약 + 2페이지~ 상세

    // 1페이지: 요약 (short)
    pages.push({
      items: shortItems,
      pageNumber: 1,
      isFirstPage: true,
      isDetailPage: false,
      showFullHeader: true
    });

    // 2페이지~: 상세 품목 목록
    for (var p = 0; p < detailPageCount; p++) {
      var startIdx = p * ITEMS_PER_DETAIL_PAGE;
      var endIdx = Math.min(startIdx + ITEMS_PER_DETAIL_PAGE, items.length);
      var pageItems = items.slice(startIdx, endIdx);

      pages.push({
        items: pageItems,
        pageNumber: p + 2,  // 2, 3, 4...
        isFirstPage: false,
        isDetailPage: true,
        showFullHeader: false  // 상세 페이지는 테이블 헤더만
      });
    }
  } else {
    // 단일페이지
    pages.push({
      items: (actualMode === 'short' && shortItems.length > 0) ? shortItems : items,
      pageNumber: 1,
      isFirstPage: true,
      isDetailPage: false,
      showFullHeader: true
    });
  }

  // 최종 컨텍스트 구성
  var ctx = JSON.parse(JSON.stringify(baseCtx));
  ctx.pages = pages;
  ctx.totalPages = totalPages;
  ctx.isMultiPage = needsMultiPage;

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
  var supplierInfo = findPartnerByName_(supplierNm);
  var buyerInfo    = findPartnerByName_(buyerNm);

  var supplierBizNo   = supplierInfo ? (supplierInfo.bizNo || '')     : '';
  var supplierManager = supplierInfo ? (supplierInfo.manager || '')   : '';
  var buyerBizNo      = buyerInfo    ? (buyerInfo.bizNo || '')        : '';
  var buyerPhone      = buyerInfo    ? (buyerInfo.phone || '')        : '';
  var buyerAddress    = buyerInfo    ? (buyerInfo.address || '')      : '';

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
      actualMode = group.itemCount <= 5 ? 'full' : 'short';
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
  // 롬앤/누즈 (같은 회사, 공유 템플릿)
  ROMAND_NUDZ: ['롬앤', '누즈', 'ROMAND', 'ROMAND & CO', 'rom&nd'],

  // 종근당
  JONGGEUNDANG: ['종근당', '종근당건강'],

  // 삐아계열 (같은 회사, 공유 템플릿)
  BBIA_GROUP: ['삐아', '어바웃톤', '이글립스', 'BBIA', 'ABOUTTONE', 'EGLIPS']
};

/**
 * 전용 양식 템플릿 파일 ID (Google Drive)
 * 실제 파일 ID로 교체 필요 - Script Properties에서 관리
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
 * 브랜드가 전용 양식 대상인지 확인
 * @param {string} brandName - 브랜드명
 * @return {string|null} 템플릿 그룹 키 (ROMAND_NUDZ, JONGGEUNDANG, BBIA_GROUP) 또는 null
 */
function getCustomTemplateGroup_(brandName) {
  if (!brandName) return null;

  var normalizedBrand = String(brandName).trim().toUpperCase();

  // 롬앤/누즈
  for (var i = 0; i < CUSTOM_TEMPLATE_BRANDS.ROMAND_NUDZ.length; i++) {
    if (normalizedBrand.indexOf(CUSTOM_TEMPLATE_BRANDS.ROMAND_NUDZ[i].toUpperCase()) >= 0) {
      return 'ROMAND_NUDZ';
    }
  }

  // 종근당
  for (var i = 0; i < CUSTOM_TEMPLATE_BRANDS.JONGGEUNDANG.length; i++) {
    if (normalizedBrand.indexOf(CUSTOM_TEMPLATE_BRANDS.JONGGEUNDANG[i].toUpperCase()) >= 0) {
      return 'JONGGEUNDANG';
    }
  }

  // 삐아계열
  for (var i = 0; i < CUSTOM_TEMPLATE_BRANDS.BBIA_GROUP.length; i++) {
    if (normalizedBrand.indexOf(CUSTOM_TEMPLATE_BRANDS.BBIA_GROUP[i].toUpperCase()) >= 0) {
      return 'BBIA_GROUP';
    }
  }

  return null;
}

/**
 * 전용 양식 Excel 파일 생성 (메인 라우터)
 * @param {string} templateGroup - 템플릿 그룹 키
 * @param {string} orderCode - 발주번호
 * @param {Array} orderRows - 발주 데이터 행 배열
 * @param {Array} header - 거래원장 헤더
 * @param {Object} options - 추가 옵션 {docDate, deliveryDate}
 * @return {Blob|null} Excel 파일 Blob 또는 null
 */
function buildCustomTemplateExcel_(templateGroup, orderCode, orderRows, header, options) {
  options = options || {};

  var templateIds = getCustomTemplateFileIds_();
  var templateId = templateIds[templateGroup];

  if (!templateId) {
    Logger.log('[buildCustomTemplateExcel_] 템플릿 파일 ID 미설정: ' + templateGroup);
    return null;
  }

  try {
    switch (templateGroup) {
      case 'ROMAND_NUDZ':
        return buildRomandNudzExcel_(templateId, orderCode, orderRows, header, options);
      case 'JONGGEUNDANG':
        return buildJonggeundangExcel_(templateId, orderCode, orderRows, header, options);
      case 'BBIA_GROUP':
        return buildBbiaGroupExcel_(templateId, orderCode, orderRows, header, options);
      default:
        Logger.log('[buildCustomTemplateExcel_] 지원하지 않는 템플릿 그룹: ' + templateGroup);
        return null;
    }
  } catch (e) {
    Logger.log('[buildCustomTemplateExcel_] 오류: ' + e.message);
    return null;
  }
}

/**
 * 롬앤/누즈 전용 양식 Excel 생성
 * - 시트: 롬앤(발주양식)
 * - 데이터 시작: 15행
 * - 컬럼: A=자체코드, B=바코드, C=제품명, E=소비자가, F="39%", G=공급가, I=수량, J=금액
 */
function buildRomandNudzExcel_(templateFileId, orderCode, orderRows, header, options) {
  Logger.log('[buildRomandNudzExcel_] 시작 - 발주번호: ' + orderCode);

  // 템플릿 파일 복사
  var templateFile = DriveApp.getFileById(templateFileId);
  var copiedFile = templateFile.makeCopy('롬앤발주_' + orderCode + '_' + new Date().getTime());
  var ss = SpreadsheetApp.open(copiedFile);
  var sheet = ss.getSheetByName('롬앤(발주양식)');

  if (!sheet) {
    Logger.log('[buildRomandNudzExcel_] 시트 "롬앤(발주양식)" 찾을 수 없음');
    DriveApp.getFileById(copiedFile.getId()).setTrashed(true);
    return null;
  }

  // 헤더 인덱스
  var idxBarcode     = header.indexOf('바코드');
  var idxProductName = header.indexOf('제품명');
  var idxQtyConfirmed = header.indexOf('확정수량');
  var idxQtyOrder    = header.indexOf('발주수량');
  var qtyIdx = idxQtyConfirmed >= 0 ? idxQtyConfirmed : idxQtyOrder;

  // 품목DB에서 추가 정보 조회용 (자체코드, 소비자가, 공급가)
  var productDb = getProducts();
  var productHeader = productDb.header;
  var productRows = productDb.rows;

  var pIdxBarcode     = productHeader.indexOf('바코드');
  var pIdxSelfCode    = productHeader.indexOf('자체코드');     // J열
  var pIdxRetailPrice = productHeader.indexOf('소비자가');     // F열
  var pIdxSupplyPrice = productHeader.indexOf('공급가');       // H열

  // 바코드 → 품목정보 맵 생성
  var productMap = {};
  for (var i = 0; i < productRows.length; i++) {
    var barcode = String(productRows[i][pIdxBarcode] || '').trim();
    if (barcode) {
      productMap[barcode] = {
        selfCode: pIdxSelfCode >= 0 ? productRows[i][pIdxSelfCode] : '',
        retailPrice: pIdxRetailPrice >= 0 ? Number(productRows[i][pIdxRetailPrice] || 0) : 0,
        supplyPrice: pIdxSupplyPrice >= 0 ? Number(productRows[i][pIdxSupplyPrice] || 0) : 0
      };
    }
  }

  // 데이터 입력 시작: 15행
  var startRow = 15;

  for (var i = 0; i < orderRows.length; i++) {
    var row = orderRows[i];
    var barcode = String(row[idxBarcode] || '').trim();
    var productName = row[idxProductName] || '';
    var qty = Number(row[qtyIdx] || 0);

    if (!qty) continue;  // 수량 0은 건너뜀

    var productInfo = productMap[barcode] || {};
    var selfCode = productInfo.selfCode || '';
    var retailPrice = productInfo.retailPrice || 0;
    var supplyPrice = productInfo.supplyPrice || 0;
    var amount = qty * supplyPrice;

    var rowNum = startRow + i;

    sheet.getRange(rowNum, 1).setValue(selfCode);       // A열: 자체코드
    sheet.getRange(rowNum, 2).setValue(barcode);        // B열: 바코드
    sheet.getRange(rowNum, 3).setValue(productName);    // C열: 제품명
    sheet.getRange(rowNum, 5).setValue(retailPrice);    // E열: 소비자가
    sheet.getRange(rowNum, 6).setValue('39%');          // F열: 39% 고정
    sheet.getRange(rowNum, 7).setValue(supplyPrice);    // G열: 공급가
    sheet.getRange(rowNum, 9).setValue(qty);            // I열: 수량
    sheet.getRange(rowNum, 10).setFormula('=G' + rowNum + '*I' + rowNum);  // J열: 금액
  }

  SpreadsheetApp.flush();

  // Excel Blob으로 변환
  var blob = copiedFile.getBlob();

  // 임시 파일 삭제
  DriveApp.getFileById(copiedFile.getId()).setTrashed(true);

  Logger.log('[buildRomandNudzExcel_] 완료');
  return blob;
}

/**
 * 종근당 전용 양식 Excel 생성
 * - 시트: 2. 발주서
 * - 데이터 시작: 5행
 * - 컬럼: B5=날짜, E=품목코드, F=제품명, I=공급가, J=수량, L=입고지, M=담당자
 */
function buildJonggeundangExcel_(templateFileId, orderCode, orderRows, header, options) {
  Logger.log('[buildJonggeundangExcel_] 시작 - 발주번호: ' + orderCode);

  // 템플릿 파일 복사
  var templateFile = DriveApp.getFileById(templateFileId);
  var copiedFile = templateFile.makeCopy('종근당발주_' + orderCode + '_' + new Date().getTime());
  var ss = SpreadsheetApp.open(copiedFile);
  var sheet = ss.getSheetByName('2. 발주서');

  if (!sheet) {
    Logger.log('[buildJonggeundangExcel_] 시트 "2. 발주서" 찾을 수 없음');
    DriveApp.getFileById(copiedFile.getId()).setTrashed(true);
    return null;
  }

  // 헤더 인덱스
  var idxProductCode = header.indexOf('품목코드');
  var idxProductName = header.indexOf('제품명');
  var idxSupplyPrice = header.indexOf('공급가');
  var idxQtyConfirmed = header.indexOf('확정수량');
  var idxQtyOrder    = header.indexOf('발주수량');
  var idxSupplier    = header.indexOf('매입처');
  var qtyIdx = idxQtyConfirmed >= 0 ? idxQtyConfirmed : idxQtyOrder;

  // 거래처DB에서 입고지/담당자 조회
  var supplierName = orderRows[0] && orderRows[0][idxSupplier] || '';
  var supplierInfo = findPartnerByName_(supplierName);
  var warehouse = supplierInfo ? (supplierInfo.warehouse || '') : '';
  var manager = supplierInfo ? (supplierInfo.manager || '') : '';

  // 날짜 입력 (B5)
  var docDate = options.docDate || new Date();
  sheet.getRange('B5').setValue(formatDateYmd_(new Date(docDate)));

  // 데이터 입력 시작: 5행
  var startRow = 5;

  for (var i = 0; i < orderRows.length; i++) {
    var row = orderRows[i];
    var productCode = row[idxProductCode] || '';
    var productName = row[idxProductName] || '';
    var supplyPrice = Number(idxSupplyPrice >= 0 ? (row[idxSupplyPrice] || 0) : 0);
    var qty = Number(row[qtyIdx] || 0);

    if (!qty) continue;

    var rowNum = startRow + i;

    sheet.getRange(rowNum, 5).setValue(productCode);     // E열: 품목코드
    sheet.getRange(rowNum, 6).setValue(productName);     // F열: 제품명
    sheet.getRange(rowNum, 9).setValue(supplyPrice);     // I열: 공급가
    sheet.getRange(rowNum, 10).setValue(qty);            // J열: 수량
    sheet.getRange(rowNum, 11).setFormula('=I' + rowNum + '*J' + rowNum);  // K열: 금액
    sheet.getRange(rowNum, 12).setValue(warehouse);      // L열: 입고지
    sheet.getRange(rowNum, 13).setValue(manager);        // M열: 담당자
  }

  SpreadsheetApp.flush();

  // Excel Blob으로 변환
  var blob = copiedFile.getBlob();

  // 임시 파일 삭제
  DriveApp.getFileById(copiedFile.getId()).setTrashed(true);

  Logger.log('[buildJonggeundangExcel_] 완료');
  return blob;
}

/**
 * 삐아계열 전용 양식 Excel 생성
 * - 시트: 브랜드명별 (삐아, 어바웃톤, 이글립스)
 * - 데이터 시작: 10행
 * - 바코드 매칭 방식: H열에 수량만 입력
 * - B8: 발주일 + 납품일
 */
function buildBbiaGroupExcel_(templateFileId, orderCode, orderRows, header, options) {
  Logger.log('[buildBbiaGroupExcel_] 시작 - 발주번호: ' + orderCode);

  // 템플릿 파일 복사
  var templateFile = DriveApp.getFileById(templateFileId);
  var copiedFile = templateFile.makeCopy('삐아계열발주_' + orderCode + '_' + new Date().getTime());
  var ss = SpreadsheetApp.open(copiedFile);

  // 브랜드 확인
  var idxBrand = header.indexOf('브랜드');
  var brandName = orderRows[0] && orderRows[0][idxBrand] || '삐아';

  // 브랜드명에 따른 시트 선택
  var sheetName = brandName;
  if (brandName.toUpperCase().indexOf('BBIA') >= 0 || brandName.indexOf('삐아') >= 0) {
    sheetName = '삐아';
  } else if (brandName.toUpperCase().indexOf('ABOUTTONE') >= 0 || brandName.indexOf('어바웃톤') >= 0) {
    sheetName = '어바웃톤';
  } else if (brandName.toUpperCase().indexOf('EGLIPS') >= 0 || brandName.indexOf('이글립스') >= 0) {
    sheetName = '이글립스';
  }

  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    Logger.log('[buildBbiaGroupExcel_] 시트 "' + sheetName + '" 찾을 수 없음, 첫번째 시트 사용');
    sheet = ss.getSheets()[0];
  }

  // 헤더 인덱스
  var idxBarcode = header.indexOf('바코드');
  var idxQtyConfirmed = header.indexOf('확정수량');
  var idxQtyOrder = header.indexOf('발주수량');
  var qtyIdx = idxQtyConfirmed >= 0 ? idxQtyConfirmed : idxQtyOrder;

  // B8: 발주일 + 납품일 입력
  var docDate = options.docDate || new Date();
  var deliveryDate = options.deliveryDate || '';
  var dateStr = formatDateYmd_(new Date(docDate));
  if (deliveryDate) {
    dateStr += ' / 납품: ' + formatDateYmd_(new Date(deliveryDate));
  }
  sheet.getRange('B8').setValue(dateStr);

  // 기존 템플릿의 바코드 읽기 (A열 또는 B열)
  // 바코드 매칭 방식: 템플릿의 바코드와 발주 데이터 바코드 매칭하여 수량 입력
  var dataRange = sheet.getRange(10, 1, sheet.getLastRow() - 9, 8);  // A10부터 H열까지
  var templateData = dataRange.getValues();

  // 발주 데이터를 바코드 맵으로 변환
  var qtyByBarcode = {};
  for (var i = 0; i < orderRows.length; i++) {
    var barcode = String(orderRows[i][idxBarcode] || '').trim();
    var qty = Number(orderRows[i][qtyIdx] || 0);
    if (barcode && qty) {
      qtyByBarcode[barcode] = (qtyByBarcode[barcode] || 0) + qty;
    }
  }

  // 템플릿의 각 행에서 바코드 매칭하여 수량 입력
  for (var r = 0; r < templateData.length; r++) {
    var templateBarcode = String(templateData[r][1] || templateData[r][0] || '').trim();  // B열 또는 A열
    if (templateBarcode && qtyByBarcode[templateBarcode]) {
      sheet.getRange(10 + r, 8).setValue(qtyByBarcode[templateBarcode]);  // H열에 수량 입력
    }
  }

  SpreadsheetApp.flush();

  // Excel Blob으로 변환
  var blob = copiedFile.getBlob();

  // 임시 파일 삭제
  DriveApp.getFileById(copiedFile.getId()).setTrashed(true);

  Logger.log('[buildBbiaGroupExcel_] 완료');
  return blob;
}

/**
 * 품목DB 조회 (캐시 활용)
 */
function getProducts() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('productData');

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      // 캐시 파싱 실패시 새로 조회
    }
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('품목DB');

  if (!sheet) {
    return { header: [], rows: [] };
  }

  var data = sheet.getDataRange().getValues();
  var result = {
    header: data[0] || [],
    rows: data.slice(1) || []
  };

  // 6시간 캐시
  try {
    cache.put('productData', JSON.stringify(result), 21600);
  } catch (e) {
    // 캐시 저장 실패 무시
  }

  return result;
}
