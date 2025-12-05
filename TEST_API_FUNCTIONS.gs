/**
 * Apps Script API 함수 진단 테스트
 * 각 함수가 정의되어 있고 호출 가능한지 확인
 */

function testAllApiFunctions() {
  var results = [];

  // 테스트할 함수 목록
  var functions = [
    'safeReturn',
    'ping',
    'getOrderList',
    'getOrderDetail',
    'updateOrderStatus',
    'deleteOrder',
    'getCustomers',
    'getProductsApi',
    'getPrintableOrders',
    'updateConfirmedQuantitiesApi',
    'updateTransactionStateApi',
    'getTransactionsApi',
    'aggregatePurchaseOrdersApi',
    'aggregateSalesOrdersApi',
    'savePurchaseSettlementApi',
    'saveSalesSettlementApi',
    'getPurchaseSettlementsApi',
    'getSalesSettlementsApi',
    'aggregateInvoiceDataApi',
    'createInvoiceFromSettlementApi',
    'getInvoicesApi',
    'updateInvoiceStatusApi'
  ];

  functions.forEach(function(funcName) {
    var status = {
      name: funcName,
      defined: false,
      callable: false,
      error: null
    };

    try {
      // 1. 함수가 정의되어 있는지 확인
      if (typeof this[funcName] === 'function') {
        status.defined = true;

        // 2. 간단한 호출 테스트 (파라미터 없이)
        try {
          var result = this[funcName]();
          status.callable = true;
          status.result = typeof result;
        } catch (callError) {
          status.callable = false;
          status.error = callError.message;
        }
      }
    } catch (e) {
      status.error = e.message;
    }

    results.push(status);
  });

  // 결과 출력
  Logger.log('========== API Functions Test ==========');
  results.forEach(function(r) {
    var icon = r.defined ? '✅' : '❌';
    Logger.log(icon + ' ' + r.name + ' - Defined: ' + r.defined + ', Callable: ' + r.callable);
    if (r.error) {
      Logger.log('   Error: ' + r.error);
    }
  });

  // 요약
  var definedCount = results.filter(function(r) { return r.defined; }).length;
  Logger.log('========================================');
  Logger.log('Total: ' + results.length + ', Defined: ' + definedCount + ', Undefined: ' + (results.length - definedCount));

  return results;
}

/**
 * getOrderDetail 특별 테스트
 */
function testGetOrderDetailSpecific() {
  Logger.log('===== getOrderDetail Specific Test =====');

  // 1. 함수 존재 확인
  Logger.log('1. Function exists: ' + (typeof getOrderDetail === 'function'));

  // 2. 실제 발주번호로 테스트
  var testOrderCode = '20251202-C001-DG-001';
  Logger.log('2. Testing with order code: ' + testOrderCode);

  var result = getOrderDetail(testOrderCode);
  Logger.log('3. Result: ' + JSON.stringify(result));

  // 3. 클라이언트 호출 시뮬레이션
  Logger.log('4. Return type: ' + typeof result);
  Logger.log('5. Is null? ' + (result === null));
  Logger.log('6. Is undefined? ' + (result === undefined));

  return result;
}
