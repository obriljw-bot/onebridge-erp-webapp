/**
 * DashboardService.js
 * 대시보드 페이지에 표시할 집계 데이터를 제공하는 서비스
 * - 오늘 결제 예정 알림 (SPEC_04)
 * - 미수금/미지급금 현황 (SPEC_05)
 */

/**
 * 오늘 결제 예정 청구서 조회 (SPEC_04)
 * @returns {Object} - { 매입: {count, amount, invoices}, 매출: {count, amount, invoices} }
 */
function getTodayPaymentDue() {
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var sheet = ss.getSheetByName('청구DB');

    if (!sheet) {
      Logger.log('❌ 청구DB 시트를 찾을 수 없습니다.');
      return {
        success: false,
        error: '청구DB 시트를 찾을 수 없습니다.'
      };
    }

    var allData = sheet.getDataRange().getValues();
    var headers = allData[0];

    var 청구IDCol = headers.indexOf('청구ID');
    var 청구유형Col = headers.indexOf('청구유형');
    var 거래처명Col = headers.indexOf('거래처명');
    var 청구금액Col = headers.indexOf('청구금액');
    var 청구상태Col = headers.indexOf('청구상태');
    var 삭제여부Col = headers.indexOf('삭제여부');

    // 결제예정일 컬럼이 있으면 사용, 없으면 -1
    var 결제예정일Col = headers.indexOf('결제예정일');

    // 미수금 컬럼이 있으면 사용, 없으면 청구금액 사용
    var 미수금Col = headers.indexOf('미수금');

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var result = {
      매입: { count: 0, amount: 0, invoices: [] },
      매출: { count: 0, amount: 0, invoices: [] }
    };

    for (var i = 1; i < allData.length; i++) {
      var row = allData[i];

      // 삭제된 데이터 제외
      if (row[삭제여부Col] === true) continue;

      // 완납된 건 제외
      var 상태 = row[청구상태Col];
      if (상태 === 'PAID') continue;

      // 결제예정일 확인 (컬럼이 있는 경우만)
      if (결제예정일Col !== -1) {
        var 결제예정일 = row[결제예정일Col];

        if (결제예정일 instanceof Date) {
          var 예정일Copy = new Date(결제예정일);
          예정일Copy.setHours(0, 0, 0, 0);

          // 오늘이 결제예정일인 경우만
          if (예정일Copy.getTime() === today.getTime()) {
            var 청구유형 = row[청구유형Col];
            var 금액 = 미수금Col !== -1 ? (Number(row[미수금Col]) || Number(row[청구금액Col]) || 0) : (Number(row[청구금액Col]) || 0);

            if (청구유형 === '매입' || 청구유형 === '매출') {
              result[청구유형].count++;
              result[청구유형].amount += 금액;
              result[청구유형].invoices.push({
                청구ID: row[청구IDCol],
                거래처명: row[거래처명Col],
                금액: 금액
              });
            }
          }
        }
      }
    }

    return {
      success: true,
      data: result
    };

  } catch (error) {
    Logger.log('❌ getTodayPaymentDue 오류: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 미수금/미지급금 전체 현황 조회 (SPEC_05)
 * @returns {Object} - { 매입: {...}, 매출: {...} }
 */
function getReceivablePayableSummary() {
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var sheet = ss.getSheetByName('청구DB');

    if (!sheet) {
      Logger.log('❌ 청구DB 시트를 찾을 수 없습니다.');
      return {
        success: false,
        error: '청구DB 시트를 찾을 수 없습니다.'
      };
    }

    var allData = sheet.getDataRange().getValues();
    var headers = allData[0];

    var 청구유형Col = headers.indexOf('청구유형');
    var 청구금액Col = headers.indexOf('청구금액');
    var 청구상태Col = headers.indexOf('청구상태');
    var 삭제여부Col = headers.indexOf('삭제여부');

    // 미수금, 결제완료금액 컬럼이 있으면 사용
    var 미수금Col = headers.indexOf('미수금');
    var 결제완료금액Col = headers.indexOf('결제완료금액');
    var 결제예정일Col = headers.indexOf('결제예정일');

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var result = {
      매입: {
        총청구액: 0,
        총결제완료금액: 0,
        총미지급금: 0,
        정상건수: 0,
        연체건수: 0,
        연체금액: 0
      },
      매출: {
        총청구액: 0,
        총결제완료금액: 0,
        총미수금: 0,
        정상건수: 0,
        연체건수: 0,
        연체금액: 0
      }
    };

    for (var i = 1; i < allData.length; i++) {
      var row = allData[i];

      // 삭제된 데이터 제외
      if (row[삭제여부Col] === true) continue;

      // 완납된 건 제외
      var 상태 = row[청구상태Col];
      if (상태 === 'PAID') continue;

      var 청구유형 = row[청구유형Col];
      if (청구유형 !== '매입' && 청구유형 !== '매출') continue;

      var 청구금액 = Number(row[청구금액Col]) || 0;
      var 결제완료금액 = 결제완료금액Col !== -1 ? (Number(row[결제완료금액Col]) || 0) : 0;
      var 미수금 = 미수금Col !== -1 ? (Number(row[미수금Col]) || 청구금액) : 청구금액;

      // 집계
      if (청구유형 === '매입') {
        result.매입.총청구액 += 청구금액;
        result.매입.총결제완료금액 += 결제완료금액;
        result.매입.총미지급금 += 미수금;
      } else {
        result.매출.총청구액 += 청구금액;
        result.매출.총결제완료금액 += 결제완료금액;
        result.매출.총미수금 += 미수금;
      }

      // 연체 여부 확인 (결제예정일이 있는 경우만)
      var isOverdue = false;
      if (결제예정일Col !== -1) {
        var 결제예정일 = row[결제예정일Col];
        if (결제예정일 instanceof Date) {
          var 예정일Copy = new Date(결제예정일);
          예정일Copy.setHours(0, 0, 0, 0);

          if (예정일Copy < today) {
            isOverdue = true;
            if (청구유형 === '매입') {
              result.매입.연체건수++;
              result.매입.연체금액 += 미수금;
            } else {
              result.매출.연체건수++;
              result.매출.연체금액 += 미수금;
            }
          } else {
            if (청구유형 === '매입') {
              result.매입.정상건수++;
            } else {
              result.매출.정상건수++;
            }
          }
        } else {
          // 결제예정일이 없으면 정상으로 간주
          if (청구유형 === '매입') {
            result.매입.정상건수++;
          } else {
            result.매출.정상건수++;
          }
        }
      } else {
        // 결제예정일 컬럼이 없으면 모두 정상으로 간주
        if (청구유형 === '매입') {
          result.매입.정상건수++;
        } else {
          result.매출.정상건수++;
        }
      }
    }

    return {
      success: true,
      data: result
    };

  } catch (error) {
    Logger.log('❌ getReceivablePayableSummary 오류: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 대시보드 전체 데이터 한번에 조회
 * (페이지 로드 시 한 번의 호출로 모든 위젯 데이터 제공)
 * @returns {Object}
 */
function getDashboardData() {
  try {
    var paymentDue = getTodayPaymentDue();
    var receivablePayable = getReceivablePayableSummary();

    return {
      success: true,
      data: {
        paymentDue: paymentDue.success ? paymentDue.data : null,
        receivablePayable: receivablePayable.success ? receivablePayable.data : null
      }
    };

  } catch (error) {
    Logger.log('❌ getDashboardData 오류: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
