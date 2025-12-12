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
    case 'orderList':
      return 'Page_OrderList';
    case 'invoiceOutput':
      return 'Page_InvoiceOutput';
    case 'transactionLedger':
      return 'Page_TransactionLedger';
    case 'settlement':
      return 'Page_Settlement';
    case 'purchaseSettlement':
      return 'Page_PurchaseSettlement';
    case 'salesSettlement':
      return 'Page_SalesSettlement';
    case 'monthlyClosing':
      return 'Page_MonthlyClosing';
    case 'billingManagement':
      return 'Page_BillingManagement';
    case 'invoiceManagement':
      return 'Page_InvoiceManagement';
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