/**
 * HTML include helper
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getPageContent(page) {
  var templateName = getPageTemplateName_(page);
  var t = HtmlService.createTemplateFromFile(templateName);
  t.page = page;
  return t.evaluate().getContent();
}

function getPageTemplateName_(page) {
  switch (page) {
    case 'orderFile':
      return 'Page_OrderFile';
    case 'dashboard':
      return 'Page_Dashboard';
    case 'orderList':          // orders → orderList로 통일
      return 'Page_OrderList';
    case 'invoiceOutput':      // 🔥 핵심 수정 (invoice → invoiceOutput)
      return 'Page_InvoiceOutput';
    case 'settings':
      return 'Page_Settings';
    default:
      return 'Page_OrderFile';
  }
}

function initCurrentPage(page) {
  if (page === "invoiceOutput" &&
      typeof OB.initInvoiceOutputPage === "function") {
    OB.initInvoiceOutputPage();
  }
}