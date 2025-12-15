/**
 * ============================================================
 * DiagnosticTool.js - Apps Script 환경 진단
 * ============================================================
 * const 선언 충돌 문제를 진단하기 위한 유틸리티
 * ============================================================
 */

/**
 * 1. 모든 전역 변수 목록 확인
 */
function diagnoseGlobalVariables() {
  Logger.log('========================================');
  Logger.log('=== 전역 변수 진단 ===');
  Logger.log('========================================\n');

  var globals = [
    'OB_ORDER_INPUT_SS_ID',
    'OB_MASTER_DB_SS_ID',
    'OB_ORDER_ALL_SS_ID',
    'OB_MASTER_PRODUCT_SHEET',
    'OB_ORDER_MAIN_SHEET',
    'OB_SETTLEMENT_SS_ID',
    'OB_ORDER_LEDGER_SHEET',
    'OB_PURCHASE_SETTLEMENT_SHEET',
    'OB_SALES_SETTLEMENT_SHEET',
    'OB_SETTLEMENT_DETAIL_SHEET',
    'OB_BILLING_SHEET',
    'OB_MONTHLY_CLOSING_SHEET',
    'OB_TRANSACTION_SS_ID',
    'OB_TRANSACTION_LEDGER_SHEET',
    'OB_INVOICE_SS_ID',
    'OB_INVOICE_LEDGER_SHEET',
    'OB_INVOICE_SHEET'
  ];

  globals.forEach(function(varName) {
    try {
      var value = this[varName];
      if (value !== undefined) {
        Logger.log('✅ ' + varName + ' = ' + value);
      } else {
        Logger.log('❌ ' + varName + ' = undefined');
      }
    } catch (e) {
      Logger.log('⚠️ ' + varName + ' - 오류: ' + e.message);
    }
  });

  Logger.log('\n========================================');
}

/**
 * 2. 파일별 변수 선언 체크
 * (실제로는 Apps Script에서 파일을 구분할 수 없지만,
 *  각 Service의 첫 함수를 호출해서 존재 여부 확인)
 */
function diagnoseServiceFiles() {
  Logger.log('========================================');
  Logger.log('=== Service 파일 존재 확인 ===');
  Logger.log('========================================\n');

  var services = [
    { name: 'DBService', func: 'getBaseDataSpreadsheet' },
    { name: 'OrderParsingService', func: 'processParsedOrderRows' },
    { name: 'TransactionService', func: 'getTransactions' },
    { name: 'InvoiceService', func: 'aggregateInvoiceData' },
    { name: 'SettlementService', func: 'aggregatePurchaseData' },
    { name: 'InvoiceOutputService', func: 'generateInvoiceZip' },
    { name: 'ApiService', func: 'handleApiRequest' },
    { name: 'UiService', func: 'getPageContent' }
  ];

  services.forEach(function(service) {
    try {
      var funcExists = typeof this[service.func] === 'function';
      if (funcExists) {
        Logger.log('✅ ' + service.name + ' - ' + service.func + '() 존재');
      } else {
        Logger.log('❌ ' + service.name + ' - ' + service.func + '() 없음');
      }
    } catch (e) {
      Logger.log('⚠️ ' + service.name + ' - 오류: ' + e.message);
    }
  });

  Logger.log('\n========================================');
}

/**
 * 3. 변수 타입 체크 (const인지 var인지는 알 수 없지만 존재 여부 확인)
 */
function diagnoseVariableDeclarations() {
  Logger.log('========================================');
  Logger.log('=== 변수 선언 타입 진단 ===');
  Logger.log('========================================\n');

  // Apps Script에서는 const vs var를 구분할 수 없지만
  // 변수가 중복 선언되었는지는 확인 가능

  var testVars = {
    'OB_ORDER_INPUT_SS_ID': OB_ORDER_INPUT_SS_ID,
    'OB_MASTER_DB_SS_ID': OB_MASTER_DB_SS_ID,
    'OB_ORDER_ALL_SS_ID': OB_ORDER_ALL_SS_ID
  };

  for (var varName in testVars) {
    Logger.log(varName + ':');
    Logger.log('  값: ' + testVars[varName]);
    Logger.log('  타입: ' + typeof testVars[varName]);
    Logger.log('  존재: ' + (testVars[varName] !== undefined));
  }

  Logger.log('\n========================================');
}

/**
 * 4. 전체 진단 실행
 */
function runFullDiagnostic() {
  Logger.log('\n');
  Logger.log('╔════════════════════════════════════════╗');
  Logger.log('║  OneBridge ERP 진단 도구 v1.0         ║');
  Logger.log('╚════════════════════════════════════════╝');
  Logger.log('\n');

  try {
    diagnoseGlobalVariables();
  } catch (e) {
    Logger.log('⚠️ 전역 변수 진단 실패: ' + e.message);
    Logger.log('스택: ' + e.stack);
  }

  Logger.log('\n');

  try {
    diagnoseServiceFiles();
  } catch (e) {
    Logger.log('⚠️ Service 파일 진단 실패: ' + e.message);
    Logger.log('스택: ' + e.stack);
  }

  Logger.log('\n');

  try {
    diagnoseVariableDeclarations();
  } catch (e) {
    Logger.log('⚠️ 변수 선언 진단 실패: ' + e.message);
    Logger.log('스택: ' + e.stack);
  }

  Logger.log('\n');
  Logger.log('╔════════════════════════════════════════╗');
  Logger.log('║  진단 완료                             ║');
  Logger.log('╚════════════════════════════════════════╝');
}

/**
 * 5. 간단 테스트 - const 중복 선언 시뮬레이션
 */
function testConstRedeclaration() {
  Logger.log('========================================');
  Logger.log('=== const 중복 선언 테스트 ===');
  Logger.log('========================================\n');

  try {
    // 이미 OB_ORDER_INPUT_SS_ID가 선언되어 있으면
    // 이 테스트에서 다시 선언하려고 할 때 오류 발생
    Logger.log('현재 OB_ORDER_INPUT_SS_ID = ' + OB_ORDER_INPUT_SS_ID);

    // Apps Script는 var 재선언은 허용, const 재선언은 불허
    Logger.log('\n만약 const로 선언되어 있다면, 스크립트 로드 시점에 이미 오류 발생');
    Logger.log('var로 선언되어 있다면, 정상 실행됨');

  } catch (e) {
    Logger.log('⚠️ 오류 발생: ' + e.message);
    Logger.log('오류 위치: ' + e.fileName + ':' + e.lineNumber);
    Logger.log('스택: ' + e.stack);
  }

  Logger.log('\n========================================');
}
