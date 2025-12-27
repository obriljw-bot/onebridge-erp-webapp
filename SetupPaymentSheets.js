/**
 * SetupPaymentSheets.js
 * ============================================================
 * 결제관리 시스템 시트 셋업 스크립트
 * ============================================================
 * 실행 방법:
 * 1. Google Apps Script 편집기에서 이 파일 추가
 * 2. setupPaymentSheets() 함수 실행
 * 3. 권한 승인
 * 4. 실행 완료 후 로그 확인
 * ============================================================
 */

var PAYMENT_SS_ID = '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs'; // 발주_통합DB

/**
 * 메인 셋업 함수
 * Phase 1: 데이터 구조 생성
 */
function setupPaymentSheets() {
  try {
    Logger.log('[setupPaymentSheets] 시작...');

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);

    // 1. [결제내역] 시트 생성
    var paymentSheet = createPaymentSheet(ss);
    Logger.log('[setupPaymentSheets] ✅ 결제내역 시트 생성 완료: ' + paymentSheet.getName());

    // 2. [회사비용] 시트 생성
    var expenseSheet = createExpenseSheet(ss);
    Logger.log('[setupPaymentSheets] ✅ 회사비용 시트 생성 완료: ' + expenseSheet.getName());

    // 3. [청구DB] 시트 확장
    var invoiceSheet = extendInvoiceSheet(ss);
    Logger.log('[setupPaymentSheets] ✅ 청구DB 컬럼 확장 완료: ' + invoiceSheet.getName());

    // 4. 데이터 유효성 검사 설정
    setupDataValidation(paymentSheet, expenseSheet);
    Logger.log('[setupPaymentSheets] ✅ 데이터 유효성 검사 설정 완료');

    Logger.log('[setupPaymentSheets] 🎉 Phase 1 완료!');
    Logger.log('');
    Logger.log('생성된 시트:');
    Logger.log('  - 결제내역 (14개 컬럼)');
    Logger.log('  - 회사비용 (11개 컬럼)');
    Logger.log('  - 청구DB (2개 컬럼 추가)');

    return {
      success: true,
      message: 'Phase 1 데이터 구조 생성 완료'
    };

  } catch (error) {
    Logger.log('[setupPaymentSheets] ❌ 오류 발생: ' + error.message);
    Logger.log('[setupPaymentSheets] Stack trace: ' + error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 1. [결제내역] 시트 생성
 */
function createPaymentSheet(ss) {
  var sheetName = '결제내역';

  // 기존 시트 확인
  var existingSheet = ss.getSheetByName(sheetName);
  if (existingSheet) {
    Logger.log('[createPaymentSheet] 경고: 기존 시트 존재. 삭제 후 재생성합니다.');
    ss.deleteSheet(existingSheet);
  }

  // 새 시트 생성
  var sheet = ss.insertSheet(sheetName);

  // 헤더 행 작성 (14개 컬럼)
  var headers = [
    '결제ID',
    '결제일',
    '결제유형',
    '거래처명',
    '금액',
    '결제수단',
    '문서번호',
    '발주번호',
    '비고',
    '삭제여부',
    '삭제일시',
    '삭제자',
    '입력일시',
    '입력자'
  ];

  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);

  // 헤더 스타일
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#f1f5f9');
  headerRange.setHorizontalAlignment('center');

  // 컬럼 너비 조정
  sheet.setColumnWidth(1, 160);  // 결제ID
  sheet.setColumnWidth(2, 100);  // 결제일
  sheet.setColumnWidth(3, 80);   // 결제유형
  sheet.setColumnWidth(4, 120);  // 거래처명
  sheet.setColumnWidth(5, 100);  // 금액
  sheet.setColumnWidth(6, 90);   // 결제수단
  sheet.setColumnWidth(7, 160);  // 문서번호
  sheet.setColumnWidth(8, 160);  // 발주번호
  sheet.setColumnWidth(9, 200);  // 비고
  sheet.setColumnWidth(10, 80);  // 삭제여부
  sheet.setColumnWidth(11, 150); // 삭제일시
  sheet.setColumnWidth(12, 150); // 삭제자
  sheet.setColumnWidth(13, 150); // 입력일시
  sheet.setColumnWidth(14, 150); // 입력자

  // 행 고정 (헤더)
  sheet.setFrozenRows(1);

  Logger.log('[createPaymentSheet] 시트 생성 완료, 헤더 14개 컬럼');

  return sheet;
}

/**
 * 2. [회사비용] 시트 생성
 */
function createExpenseSheet(ss) {
  var sheetName = '회사비용';

  // 기존 시트 확인
  var existingSheet = ss.getSheetByName(sheetName);
  if (existingSheet) {
    Logger.log('[createExpenseSheet] 경고: 기존 시트 존재. 삭제 후 재생성합니다.');
    ss.deleteSheet(existingSheet);
  }

  // 새 시트 생성
  var sheet = ss.insertSheet(sheetName);

  // 헤더 행 작성 (11개 컬럼)
  var headers = [
    '비용ID',
    '비용일',
    '비용항목',
    '금액',
    '결제수단',
    '비고',
    '삭제여부',
    '삭제일시',
    '삭제자',
    '입력일시',
    '입력자'
  ];

  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);

  // 헤더 스타일
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#f1f5f9');
  headerRange.setHorizontalAlignment('center');

  // 컬럼 너비 조정
  sheet.setColumnWidth(1, 160);  // 비용ID
  sheet.setColumnWidth(2, 100);  // 비용일
  sheet.setColumnWidth(3, 100);  // 비용항목
  sheet.setColumnWidth(4, 100);  // 금액
  sheet.setColumnWidth(5, 90);   // 결제수단
  sheet.setColumnWidth(6, 200);  // 비고
  sheet.setColumnWidth(7, 80);   // 삭제여부
  sheet.setColumnWidth(8, 150);  // 삭제일시
  sheet.setColumnWidth(9, 150);  // 삭제자
  sheet.setColumnWidth(10, 150); // 입력일시
  sheet.setColumnWidth(11, 150); // 입력자

  // 행 고정 (헤더)
  sheet.setFrozenRows(1);

  Logger.log('[createExpenseSheet] 시트 생성 완료, 헤더 11개 컬럼');

  return sheet;
}

/**
 * 3. [청구DB] 시트 확장
 */
function extendInvoiceSheet(ss) {
  var sheetName = '청구DB';

  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    Logger.log('[extendInvoiceSheet] 경고: 청구DB 시트를 찾을 수 없습니다.');
    Logger.log('[extendInvoiceSheet] 청구DB 시트를 먼저 생성하세요.');
    throw new Error('청구DB 시트를 찾을 수 없습니다.');
  }

  // 기존 헤더 확인
  var headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  var headers = headerRange.getValues()[0];

  Logger.log('[extendInvoiceSheet] 기존 컬럼 수: ' + headers.length);

  // 필요한 컬럼 확인
  var hasReplacement = headers.indexOf('대체청구서') !== -1;
  var hasOriginal = headers.indexOf('원본청구서') !== -1;
  var hasBillingType = headers.indexOf('billingType') !== -1;
  var hasOrderNumbers = headers.indexOf('orderNumbers') !== -1;

  // 이미 모든 컬럼이 있는지 확인
  if (hasReplacement && hasOriginal && hasBillingType && hasOrderNumbers) {
    Logger.log('[extendInvoiceSheet] 이미 모든 컬럼이 존재합니다. 건너뜁니다.');
    return sheet;
  }

  // 추가할 컬럼 목록
  var newColumns = [];
  if (!hasReplacement) newColumns.push('대체청구서');
  if (!hasOriginal) newColumns.push('원본청구서');
  if (!hasBillingType) newColumns.push('billingType');
  if (!hasOrderNumbers) newColumns.push('orderNumbers');

  if (newColumns.length > 0) {
    var startCol = headers.length + 1;
    var newHeaderRange = sheet.getRange(1, startCol, 1, newColumns.length);
    newHeaderRange.setValues([newColumns]);

    // 헤더 스타일 적용
    newHeaderRange.setFontWeight('bold');
    newHeaderRange.setBackground('#f1f5f9');
    newHeaderRange.setHorizontalAlignment('center');

    // 컬럼 너비 조정
    for (var i = 0; i < newColumns.length; i++) {
      sheet.setColumnWidth(startCol + i, 160);
    }

    Logger.log('[extendInvoiceSheet] 컬럼 추가 완료: ' + newColumns.join(', '));
  }

  return sheet;
}

/**
 * 4. 데이터 유효성 검사 설정
 */
function setupDataValidation(paymentSheet, expenseSheet) {
  Logger.log('[setupDataValidation] 데이터 유효성 검사 설정 시작...');

  // ===== [결제내역] 시트 =====

  // 결제유형 드롭다운 (C열, 3번째 컬럼)
  var paymentTypeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['입금', '출금'], true)
    .setAllowInvalid(false)
    .setHelpText('입금 또는 출금을 선택하세요')
    .build();

  paymentSheet.getRange('C2:C1000').setDataValidation(paymentTypeRule);
  Logger.log('[setupDataValidation] ✅ 결제유형 드롭다운 설정 (C열)');

  // 결제수단 드롭다운 (F열, 6번째 컬럼)
  var paymentMethodRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['현금', '카드', '계좌이체', '기타'], true)
    .setAllowInvalid(false)
    .setHelpText('결제수단을 선택하세요')
    .build();

  paymentSheet.getRange('F2:F1000').setDataValidation(paymentMethodRule);
  Logger.log('[setupDataValidation] ✅ 결제수단 드롭다운 설정 (F열)');

  // 삭제여부 체크박스 (J열, 10번째 컬럼)
  var deleteCheckboxRule = SpreadsheetApp.newDataValidation()
    .requireCheckbox()
    .setAllowInvalid(false)
    .build();

  paymentSheet.getRange('J2:J1000').setDataValidation(deleteCheckboxRule);
  Logger.log('[setupDataValidation] ✅ 삭제여부 체크박스 설정 (J열)');

  // ===== [회사비용] 시트 =====

  // 비용항목 드롭다운 (C열, 3번째 컬럼)
  var expenseCategoryRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['인건비', '임차료', '통신비', '교통비', '소모품비', '접대비', '광고선전비', '식비', '기타'], true)
    .setAllowInvalid(false)
    .setHelpText('비용항목을 선택하세요')
    .build();

  expenseSheet.getRange('C2:C1000').setDataValidation(expenseCategoryRule);
  Logger.log('[setupDataValidation] ✅ 비용항목 드롭다운 설정 (C열)');

  // 결제수단 드롭다운 (E열, 5번째 컬럼)
  expenseSheet.getRange('E2:E1000').setDataValidation(paymentMethodRule);
  Logger.log('[setupDataValidation] ✅ 결제수단 드롭다운 설정 (E열)');

  // 삭제여부 체크박스 (G열, 7번째 컬럼)
  expenseSheet.getRange('G2:G1000').setDataValidation(deleteCheckboxRule);
  Logger.log('[setupDataValidation] ✅ 삭제여부 체크박스 설정 (G열)');

  Logger.log('[setupDataValidation] 모든 유효성 검사 설정 완료');
}

/**
 * 테스트용: 샘플 데이터 추가
 * (선택사항 - 필요시 실행)
 */
function addSampleData() {
  try {
    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);

    // 결제내역 샘플
    var paymentSheet = ss.getSheetByName('결제내역');
    if (paymentSheet) {
      paymentSheet.appendRow([
        'PAY-20251219-001',
        '2025-12-19',
        '입금',
        'A거래처',
        500000,
        '계좌이체',
        'INV-20251219-003',
        'GMP-20251201-001',
        '1차 부분 결제',
        false,
        '',
        '',
        new Date(),
        Session.getActiveUser().getEmail()
      ]);
      Logger.log('[addSampleData] ✅ 결제내역 샘플 데이터 추가');
    }

    // 회사비용 샘플
    var expenseSheet = ss.getSheetByName('회사비용');
    if (expenseSheet) {
      expenseSheet.appendRow([
        'EXP-20251219-001',
        '2025-12-19',
        '통신비',
        50000,
        '카드',
        '사무실 인터넷 요금',
        false,
        '',
        '',
        new Date(),
        Session.getActiveUser().getEmail()
      ]);
      Logger.log('[addSampleData] ✅ 회사비용 샘플 데이터 추가');
    }

    Logger.log('[addSampleData] 샘플 데이터 추가 완료');

  } catch (error) {
    Logger.log('[addSampleData] 오류: ' + error.message);
  }
}
