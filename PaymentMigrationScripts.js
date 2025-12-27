/**
 * PaymentMigrationScripts.js
 *
 * 결제 시스템 통합 마이그레이션 스크립트
 *
 * 목적:
 * - 청구DB의 레거시 데이터를 Phase 1/2 표준 스키마로 마이그레이션
 * - 청구유형 값 표준화 ("매출"/"매입" → "SALES"/"PURCHASE")
 * - 발주번호 컬럼 중복 제거 (col 9 → col 19)
 * - billingType 컬럼 채우기 (마감ID 기반)
 *
 * 실행 순서:
 * 1. migrateBillingTypes() - 청구유형 표준화
 * 2. migrateOrderNumbers() - 발주번호 컬럼 마이그레이션
 * 3. migrateBillingType() - billingType 채우기
 *
 * 작성일: 2025-12-27
 * Phase A: 긴급 수정
 */

/**
 * 마이그레이션 1: 청구유형 값 표준화
 *
 * 문제:
 * - 청구DB의 "청구유형" 컬럼에 "매출"/"매입" (한글)과 "SALES"/"PURCHASE" (영문)이 혼재
 * - 진단 결과: 50% "SALES", 50% "매출"로 혼재 확인
 *
 * 해결:
 * - 모든 "매출" → "SALES"로 변환
 * - 모든 "매입" → "PURCHASE"로 변환
 *
 * @returns {Object} 마이그레이션 결과 { success, updated, total }
 */
function migrateBillingTypes() {
  Logger.log('=== [마이그레이션 1] 청구유형 값 표준화 시작 ===');

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var invoiceSheet = ss.getSheetByName('청구DB');

    if (!invoiceSheet) {
      throw new Error('청구DB 시트를 찾을 수 없습니다.');
    }

    var data = invoiceSheet.getDataRange().getValues();
    var headers = data[0];

    // "청구유형" 컬럼 찾기 (B열, index 1)
    var typeColIndex = headers.indexOf('청구유형');
    if (typeColIndex === -1) {
      throw new Error('청구유형 컬럼을 찾을 수 없습니다.');
    }

    Logger.log('청구유형 컬럼 인덱스: ' + typeColIndex + ' (B열)');

    var updatedCount = 0;
    var totalRows = data.length - 1; // 헤더 제외

    // 데이터 행 순회 (헤더 제외)
    for (var i = 1; i < data.length; i++) {
      var currentType = data[i][typeColIndex];
      var newType = currentType;

      // 값 표준화
      if (currentType === '매출') {
        newType = 'SALES';
      } else if (currentType === '매입') {
        newType = 'PURCHASE';
      }

      // 변경이 필요한 경우
      if (newType !== currentType) {
        data[i][typeColIndex] = newType;
        updatedCount++;
        Logger.log('행 ' + (i + 1) + ': "' + currentType + '" → "' + newType + '"로 변경');
      }
    }

    // 변경사항이 있는 경우 시트 업데이트
    if (updatedCount > 0) {
      invoiceSheet.getRange(1, 1, data.length, headers.length).setValues(data);
      Logger.log('✓ ' + updatedCount + '개 행 업데이트 완료');
    } else {
      Logger.log('✓ 변경이 필요한 데이터가 없습니다.');
    }

    Logger.log('=== [마이그레이션 1] 완료 ===');
    Logger.log('총 행 수: ' + totalRows);
    Logger.log('변경된 행 수: ' + updatedCount);

    return {
      success: true,
      updated: updatedCount,
      total: totalRows,
      message: updatedCount + '개 행의 청구유형을 표준화했습니다.'
    };

  } catch (error) {
    Logger.log('❌ 오류 발생: ' + error.message);
    Logger.log(error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 마이그레이션 2: 발주번호 컬럼 데이터 이관
 *
 * 문제:
 * - 청구DB에 "발주번호" 컬럼 (col 9)과 "orderNumbers" 컬럼 (col 19)이 중복 존재
 * - 기존 데이터는 col 9에 JSON 배열 형식으로 저장: ["20251202-C001-DG-001"]
 * - Phase 1에서 추가한 col 19 "orderNumbers"는 비어있음
 *
 * 해결:
 * - col 9의 데이터를 col 19로 복사
 * - JSON 배열 형식 유지
 *
 * @returns {Object} 마이그레이션 결과 { success, migrated, total }
 */
function migrateOrderNumbers() {
  Logger.log('=== [마이그레이션 2] 발주번호 컬럼 데이터 이관 시작 ===');

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var invoiceSheet = ss.getSheetByName('청구DB');

    if (!invoiceSheet) {
      throw new Error('청구DB 시트를 찾을 수 없습니다.');
    }

    var data = invoiceSheet.getDataRange().getValues();
    var headers = data[0];

    // 컬럼 인덱스 찾기
    var oldOrderColIndex = headers.indexOf('발주번호'); // col 9
    var newOrderColIndex = headers.indexOf('orderNumbers'); // col 19

    if (oldOrderColIndex === -1) {
      throw new Error('발주번호 컬럼을 찾을 수 없습니다.');
    }
    if (newOrderColIndex === -1) {
      throw new Error('orderNumbers 컬럼을 찾을 수 없습니다.');
    }

    Logger.log('발주번호 컬럼 인덱스: ' + oldOrderColIndex);
    Logger.log('orderNumbers 컬럼 인덱스: ' + newOrderColIndex);

    var migratedCount = 0;
    var totalRows = data.length - 1; // 헤더 제외

    // 데이터 행 순회 (헤더 제외)
    for (var i = 1; i < data.length; i++) {
      var oldValue = data[i][oldOrderColIndex];
      var newValue = data[i][newOrderColIndex];

      // 기존 컬럼에 데이터가 있고, 새 컬럼이 비어있는 경우
      if (oldValue && oldValue !== '' && (!newValue || newValue === '' || newValue === '[]')) {
        // 값 복사
        data[i][newOrderColIndex] = oldValue;
        migratedCount++;

        Logger.log('행 ' + (i + 1) + ': 발주번호 → orderNumbers 이관');
        Logger.log('  값: ' + oldValue);
      }
    }

    // 변경사항이 있는 경우 시트 업데이트
    if (migratedCount > 0) {
      invoiceSheet.getRange(1, 1, data.length, headers.length).setValues(data);
      Logger.log('✓ ' + migratedCount + '개 행 마이그레이션 완료');
    } else {
      Logger.log('✓ 이관이 필요한 데이터가 없습니다.');
    }

    Logger.log('=== [마이그레이션 2] 완료 ===');
    Logger.log('총 행 수: ' + totalRows);
    Logger.log('이관된 행 수: ' + migratedCount);

    return {
      success: true,
      migrated: migratedCount,
      total: totalRows,
      message: migratedCount + '개 행의 발주번호를 orderNumbers로 이관했습니다.'
    };

  } catch (error) {
    Logger.log('❌ 오류 발생: ' + error.message);
    Logger.log(error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 마이그레이션 3: billingType 컬럼 채우기
 *
 * 문제:
 * - Phase 1에서 추가한 "billingType" 컬럼 (col 18)이 비어있음
 * - 청구서 생성 경로에 따라 "SETTLEMENT" 또는 "DIRECT" 값 필요
 *
 * 해결:
 * - 마감ID 컬럼 확인
 *   - 마감ID가 있으면 → "SETTLEMENT" (정산 기반 청구서)
 *   - 마감ID가 없으면 → "DIRECT" (직접 생성 청구서)
 *
 * @returns {Object} 마이그레이션 결과 { success, filled, total, settlement, direct }
 */
function migrateBillingType() {
  Logger.log('=== [마이그레이션 3] billingType 컬럼 채우기 시작 ===');

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var invoiceSheet = ss.getSheetByName('청구DB');

    if (!invoiceSheet) {
      throw new Error('청구DB 시트를 찾을 수 없습니다.');
    }

    var data = invoiceSheet.getDataRange().getValues();
    var headers = data[0];

    // 컬럼 인덱스 찾기
    var settlementIdColIndex = headers.indexOf('마감ID'); // col 3
    var billingTypeColIndex = headers.indexOf('billingType'); // col 18

    if (settlementIdColIndex === -1) {
      throw new Error('마감ID 컬럼을 찾을 수 없습니다.');
    }
    if (billingTypeColIndex === -1) {
      throw new Error('billingType 컬럼을 찾을 수 없습니다.');
    }

    Logger.log('마감ID 컬럼 인덱스: ' + settlementIdColIndex);
    Logger.log('billingType 컬럼 인덱스: ' + billingTypeColIndex);

    var filledCount = 0;
    var settlementCount = 0;
    var directCount = 0;
    var totalRows = data.length - 1; // 헤더 제외

    // 데이터 행 순회 (헤더 제외)
    for (var i = 1; i < data.length; i++) {
      var settlementId = data[i][settlementIdColIndex];
      var currentBillingType = data[i][billingTypeColIndex];

      // billingType이 비어있는 경우만 처리
      if (!currentBillingType || currentBillingType === '') {
        var newBillingType;

        // 마감ID 존재 여부에 따라 결정
        if (settlementId && settlementId !== '') {
          newBillingType = 'SETTLEMENT';
          settlementCount++;
        } else {
          newBillingType = 'DIRECT';
          directCount++;
        }

        data[i][billingTypeColIndex] = newBillingType;
        filledCount++;

        Logger.log('행 ' + (i + 1) + ': billingType = "' + newBillingType + '" 설정');
      }
    }

    // 변경사항이 있는 경우 시트 업데이트
    if (filledCount > 0) {
      invoiceSheet.getRange(1, 1, data.length, headers.length).setValues(data);
      Logger.log('✓ ' + filledCount + '개 행 업데이트 완료');
    } else {
      Logger.log('✓ 채울 데이터가 없습니다.');
    }

    Logger.log('=== [마이그레이션 3] 완료 ===');
    Logger.log('총 행 수: ' + totalRows);
    Logger.log('채운 행 수: ' + filledCount);
    Logger.log('  - SETTLEMENT: ' + settlementCount);
    Logger.log('  - DIRECT: ' + directCount);

    return {
      success: true,
      filled: filledCount,
      total: totalRows,
      settlement: settlementCount,
      direct: directCount,
      message: filledCount + '개 행의 billingType을 채웠습니다. (SETTLEMENT: ' + settlementCount + ', DIRECT: ' + directCount + ')'
    };

  } catch (error) {
    Logger.log('❌ 오류 발생: ' + error.message);
    Logger.log(error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 전체 마이그레이션 실행 (순차 실행)
 *
 * 실행 순서:
 * 1. migrateBillingTypes() - 청구유형 표준화
 * 2. migrateOrderNumbers() - 발주번호 컬럼 마이그레이션
 * 3. migrateBillingType() - billingType 채우기
 *
 * @returns {Object} 전체 마이그레이션 결과
 */
function runAllPaymentMigrations() {
  Logger.log('========================================');
  Logger.log('결제 시스템 통합 마이그레이션 전체 실행 시작');
  Logger.log('========================================');

  var results = {
    step1: null,
    step2: null,
    step3: null,
    success: true
  };

  // Step 1: 청구유형 표준화
  Logger.log('\n[Step 1/3] 청구유형 표준화...');
  results.step1 = migrateBillingTypes();
  if (!results.step1.success) {
    Logger.log('❌ Step 1 실패: ' + results.step1.error);
    results.success = false;
    return results;
  }
  Logger.log('✓ Step 1 완료: ' + results.step1.message);

  // Step 2: 발주번호 컬럼 마이그레이션
  Logger.log('\n[Step 2/3] 발주번호 컬럼 마이그레이션...');
  results.step2 = migrateOrderNumbers();
  if (!results.step2.success) {
    Logger.log('❌ Step 2 실패: ' + results.step2.error);
    results.success = false;
    return results;
  }
  Logger.log('✓ Step 2 완료: ' + results.step2.message);

  // Step 3: billingType 채우기
  Logger.log('\n[Step 3/3] billingType 채우기...');
  results.step3 = migrateBillingType();
  if (!results.step3.success) {
    Logger.log('❌ Step 3 실패: ' + results.step3.error);
    results.success = false;
    return results;
  }
  Logger.log('✓ Step 3 완료: ' + results.step3.message);

  Logger.log('\n========================================');
  Logger.log('✅ 전체 마이그레이션 완료!');
  Logger.log('========================================');
  Logger.log('Step 1: ' + results.step1.message);
  Logger.log('Step 2: ' + results.step2.message);
  Logger.log('Step 3: ' + results.step3.message);

  return results;
}
