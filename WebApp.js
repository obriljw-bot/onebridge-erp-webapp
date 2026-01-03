function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


function doGet(e) {
  // SPEC_03: 엑셀 다운로드 요청 처리
  if (e && e.parameter && e.parameter.action) {
    var action = e.parameter.action;

    Logger.log('✅ [2026-01-03 NEW CODE] action=' + action);

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
        return ContentService.createTextOutput('[NEW-2026-01-03] 오류: ' + result.error).setMimeType(ContentService.MimeType.TEXT);
      }

      var fileName = generateExcelFileName(params, 'payment_records');
      Logger.log('✅ [2026-01-03] 생성된 파일명: ' + fileName);

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
        return ContentService.createTextOutput('오류: ' + result.error).setMimeType(ContentService.MimeType.TEXT);
      }

      var fileName = generateExcelFileName(params, 'company_expenses');

      var BOM = '\uFEFF';
      var csvWithBOM = BOM + result.csv;

      return ContentService.createTextOutput(csvWithBOM)
        .setMimeType(ContentService.MimeType.CSV)
        .downloadAsFile(fileName);
    }
  }

  // 일반 페이지 요청 처리
  var page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'orderFile';

  var template = HtmlService.createTemplateFromFile('Layout');
  template.page = page;

  return template
    .evaluate()
    .setTitle('OneBridge ERP')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
