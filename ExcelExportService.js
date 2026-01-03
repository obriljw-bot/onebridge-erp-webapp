/**
 * ExcelExportService.js
 * 입출금 내역 및 회사비용을 엑셀(CSV)로 다운로드하는 서비스
 *
 * SPEC_03: 엑셀 다운로드 기능
 * - UTF-8 BOM 추가로 한글 깨짐 방지
 * - 필터 조건 기반 데이터 추출
 * - 자동 파일명 생성
 */

/**
 * 입출금 내역을 CSV로 변환
 * @param {Object} params - 필터 조건
 * @returns {string} - CSV 문자열
 */
function exportPaymentRecordsToCSV(params) {
  try {
    params = params || {};

    var ss = SpreadsheetApp.openById(SS_ID);
    var sheet = ss.getSheetByName('결제내역');

    if (!sheet) {
      throw new Error('결제내역 시트를 찾을 수 없습니다.');
    }

    // 1. 데이터 조회
    var allData = sheet.getDataRange().getValues();
    var headers = allData[0];

    var 결제일Col = headers.indexOf('결제일');
    var 결제유형Col = headers.indexOf('결제유형');
    var 거래처명Col = headers.indexOf('거래처명');
    var 삭제여부Col = headers.indexOf('삭제여부');
    var 금액Col = headers.indexOf('금액');

    // 2. 필터링
    var filteredData = [];
    for (var i = 1; i < allData.length; i++) {
      var row = allData[i];

      // 삭제된 데이터 제외
      if (row[삭제여부Col] === true) continue;

      // 날짜 필터
      if (params.startDate || params.endDate) {
        var 결제일 = row[결제일Col];
        if (결제일 instanceof Date) {
          var 결제일Str = Utilities.formatDate(결제일, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          if (params.startDate && 결제일Str < params.startDate) continue;
          if (params.endDate && 결제일Str > params.endDate) continue;
        } else {
          continue; // 날짜가 없으면 스킵
        }
      }

      // 유형 필터
      if (params.paymentType && row[결제유형Col] !== params.paymentType) continue;

      // 거래처 필터
      if (params.companyName && row[거래처명Col] && row[거래처명Col].indexOf(params.companyName) === -1) continue;

      filteredData.push(row);
    }

    Logger.log('[exportPaymentRecordsToCSV] 필터링된 데이터: ' + filteredData.length + '건');

    // 3. CSV 생성
    var csvRows = [];

    // 첫 행: 다운로드 조건
    var filterSummary = '기간: ' + (params.startDate || '전체') + ' ~ ' + (params.endDate || '전체');
    if (params.paymentType) {
      filterSummary += ' | 유형: ' + params.paymentType;
    }
    if (params.companyName) {
      filterSummary += ' | 거래처: ' + params.companyName;
    }
    csvRows.push(filterSummary);
    csvRows.push(''); // 빈 행

    // 헤더 (삭제 관련 컬럼 제외)
    var excelHeaders = [];
    var excludeColumns = ['삭제여부', '삭제일시', '삭제자', '원결제ID', '환불여부'];

    for (var i = 0; i < headers.length; i++) {
      if (excludeColumns.indexOf(headers[i]) === -1 && headers[i]) {
        excelHeaders.push(headers[i]);
      }
    }
    csvRows.push(excelHeaders.join(','));

    // 데이터 행
    var totalAmount = 0;

    for (var i = 0; i < filteredData.length; i++) {
      var row = filteredData[i];
      var csvCells = [];

      for (var j = 0; j < headers.length; j++) {
        if (excludeColumns.indexOf(headers[j]) !== -1 || !headers[j]) continue;

        var value = row[j];

        // 날짜 형식 변환
        if (value instanceof Date) {
          value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
        }

        // CSV 이스케이프 처리
        var cellValue = String(value || '');
        if (cellValue.indexOf(',') !== -1 || cellValue.indexOf('"') !== -1 || cellValue.indexOf('\n') !== -1) {
          cellValue = '"' + cellValue.replace(/"/g, '""') + '"';
        }

        csvCells.push(cellValue);
      }

      csvRows.push(csvCells.join(','));

      // 금액 합계
      totalAmount += (Number(row[금액Col]) || 0);
    }

    // 합계 행
    csvRows.push('');
    var summaryParts = [];
    for (var i = 0; i < excelHeaders.length; i++) {
      if (excelHeaders[i] === '금액') {
        summaryParts.push('합계: ' + totalAmount.toLocaleString() + '원');
      } else if (i === 0) {
        summaryParts.push('총 ' + filteredData.length + '건');
      } else {
        summaryParts.push('');
      }
    }
    csvRows.push(summaryParts.join(','));

    var csvContent = csvRows.join('\r\n');

    Logger.log('[exportPaymentRecordsToCSV] CSV 생성 완료: ' + csvContent.length + ' 바이트');

    return {
      success: true,
      csv: csvContent,
      recordCount: filteredData.length,
      totalAmount: totalAmount
    };

  } catch (error) {
    Logger.log('[exportPaymentRecordsToCSV] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 회사비용 내역을 CSV로 변환
 * @param {Object} params - 필터 조건
 * @returns {string} - CSV 문자열
 */
function exportExpenseRecordsToCSV(params) {
  try {
    params = params || {};

    var ss = SpreadsheetApp.openById(SS_ID);
    var sheet = ss.getSheetByName('회사비용');

    if (!sheet) {
      throw new Error('회사비용 시트를 찾을 수 없습니다.');
    }

    var allData = sheet.getDataRange().getValues();

    if (allData.length <= 1) {
      return {
        success: false,
        error: '회사비용 데이터가 없습니다.'
      };
    }

    var headers = allData[0];

    var 결제일Col = headers.indexOf('결제일');
    var 비용분류Col = headers.indexOf('비용분류');
    var 삭제여부Col = headers.indexOf('삭제여부');
    var 금액Col = headers.indexOf('금액');

    // 필터링
    var filteredData = [];
    for (var i = 1; i < allData.length; i++) {
      var row = allData[i];

      if (row[삭제여부Col] === true) continue;

      // 날짜 필터
      if (params.startDate || params.endDate) {
        var 결제일 = row[결제일Col];
        if (결제일 instanceof Date) {
          var 결제일Str = Utilities.formatDate(결제일, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          if (params.startDate && 결제일Str < params.startDate) continue;
          if (params.endDate && 결제일Str > params.endDate) continue;
        }
      }

      // 비용분류 필터
      if (params.category && row[비용분류Col] !== params.category) continue;

      filteredData.push(row);
    }

    Logger.log('[exportExpenseRecordsToCSV] 필터링된 데이터: ' + filteredData.length + '건');

    // CSV 생성
    var csvRows = [];

    var filterSummary = '기간: ' + (params.startDate || '전체') + ' ~ ' + (params.endDate || '전체');
    if (params.category) {
      filterSummary += ' | 분류: ' + params.category;
    }
    csvRows.push(filterSummary);
    csvRows.push('');

    // 헤더 (삭제여부 제외)
    var excelHeaders = [];
    for (var i = 0; i < headers.length; i++) {
      if (headers[i] !== '삭제여부' && headers[i]) {
        excelHeaders.push(headers[i]);
      }
    }
    csvRows.push(excelHeaders.join(','));

    // 데이터
    var totalAmount = 0;

    for (var i = 0; i < filteredData.length; i++) {
      var row = filteredData[i];
      var csvCells = [];

      for (var j = 0; j < headers.length; j++) {
        if (headers[j] === '삭제여부' || !headers[j]) continue;

        var value = row[j];
        if (value instanceof Date) {
          value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
        }

        var cellValue = String(value || '');
        if (cellValue.indexOf(',') !== -1 || cellValue.indexOf('"') !== -1 || cellValue.indexOf('\n') !== -1) {
          cellValue = '"' + cellValue.replace(/"/g, '""') + '"';
        }

        csvCells.push(cellValue);
      }

      csvRows.push(csvCells.join(','));
      totalAmount += (Number(row[금액Col]) || 0);
    }

    // 합계
    csvRows.push('');
    var summaryParts = [];
    for (var i = 0; i < excelHeaders.length; i++) {
      if (excelHeaders[i] === '금액') {
        summaryParts.push('합계: ' + totalAmount.toLocaleString() + '원');
      } else if (i === 0) {
        summaryParts.push('총 ' + filteredData.length + '건');
      } else {
        summaryParts.push('');
      }
    }
    csvRows.push(summaryParts.join(','));

    var csvContent = csvRows.join('\r\n');

    return {
      success: true,
      csv: csvContent,
      recordCount: filteredData.length,
      totalAmount: totalAmount
    };

  } catch (error) {
    Logger.log('[exportExpenseRecordsToCSV] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 파일명 생성 (영문 + 날짜)
 * @param {Object} params - 필터 조건
 * @param {string} prefix - 파일명 접두어 (영문)
 * @returns {string} - 파일명
 */
function generateExcelFileName(params, prefix) {
  var fileName = prefix;

  // 타임스탬프 추가 (고유성 보장)
  var now = new Date();
  var timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');

  // 날짜 범위 추가
  if (params.startDate && params.endDate) {
    fileName += '_' + params.startDate.replace(/-/g, '') + '_' + params.endDate.replace(/-/g, '');
  } else if (params.startDate) {
    fileName += '_from_' + params.startDate.replace(/-/g, '');
  } else if (params.endDate) {
    fileName += '_to_' + params.endDate.replace(/-/g, '');
  } else {
    fileName += '_all';
  }

  // 필터 조건 영문 변환
  if (params.paymentType) {
    var typeMap = {
      '입금': 'income',
      '출금': 'expense'
    };
    fileName += '_' + (typeMap[params.paymentType] || params.paymentType);
  }

  if (params.category) {
    // 한글 카테고리를 영문으로 매핑
    var categoryMap = {
      '인건비': 'labor',
      '임차료': 'rent',
      '통신비': 'telecom',
      '교통비': 'transport',
      '소모품비': 'supplies',
      '접대비': 'entertainment',
      '광고선전비': 'advertising',
      '식비': 'meals',
      '기타': 'etc'
    };
    fileName += '_' + (categoryMap[params.category] || params.category);
  }

  // 타임스탬프 추가
  fileName += '_' + timestamp;
  fileName += '.csv';

  return fileName;
}

/**
 * doGet 엔드포인트 - CSV 파일 다운로드
 */
function doGet(e) {
  try {
    var action = e.parameter.action;

    // 입출금 내역 다운로드
    if (action === 'downloadPayment') {
      var params = {
        startDate: e.parameter.startDate || '',
        endDate: e.parameter.endDate || '',
        paymentType: e.parameter.paymentType || '',
        companyName: e.parameter.companyName || ''
      };

      var result = exportPaymentRecordsToCSV(params);

      if (!result.success) {
        return ContentService.createTextOutput('오류: ' + result.error)
          .setMimeType(ContentService.MimeType.TEXT);
      }

      var fileName = generateExcelFileName(params, 'payment_records');

      // UTF-8 BOM 추가 (엑셀 한글 인식)
      var BOM = '\uFEFF';
      var csvWithBOM = BOM + result.csv;

      return ContentService.createTextOutput(csvWithBOM)
        .setMimeType(ContentService.MimeType.CSV)
        .downloadAsFile(fileName);
    }

    // 회사비용 다운로드
    if (action === 'downloadExpense') {
      var params = {
        startDate: e.parameter.startDate || '',
        endDate: e.parameter.endDate || '',
        category: e.parameter.category || ''
      };

      var result = exportExpenseRecordsToCSV(params);

      if (!result.success) {
        return ContentService.createTextOutput('오류: ' + result.error)
          .setMimeType(ContentService.MimeType.TEXT);
      }

      var fileName = generateExcelFileName(params, 'company_expenses');

      var BOM = '\uFEFF';
      var csvWithBOM = BOM + result.csv;

      return ContentService.createTextOutput(csvWithBOM)
        .setMimeType(ContentService.MimeType.CSV)
        .downloadAsFile(fileName);
    }

    return ContentService.createTextOutput('잘못된 요청입니다. action 파라미터를 확인하세요.')
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    Logger.log('[doGet] ❌ 오류: ' + error.message);
    return ContentService.createTextOutput('다운로드 중 오류 발생: ' + error.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}
