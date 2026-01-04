/**
 * ReceivableService.js
 * ============================================================
 * 미수금/미지급금 관리 서비스
 * SPEC_05: 거래처별 미수금 집계 및 에이징 리포트
 * ============================================================
 * 기능:
 * 1. 미수금 전체 현황 조회
 * 2. 거래처별 미수금 집계
 * 3. 에이징 리포트 생성 (30/60/90/90+ 일)
 * ============================================================
 */

// ====== 상수 정의 ======
var SS_ID = '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs'; // 발주_통합DB

/**
 * 미수금/미지급금 전체 현황 조회
 * @param {string} type - "매입" 또는 "매출"
 * @returns {Object} - 집계 결과
 */
function getReceivableSummary(type) {
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var sheet = ss.getSheetByName('청구DB');

    if (!sheet) {
      Logger.log('[getReceivableSummary] ❌ 청구DB 시트를 찾을 수 없습니다.');
      return { success: false, error: '청구DB 시트를 찾을 수 없습니다.' };
    }

    var allData = sheet.getDataRange().getValues();
    var headers = allData[0];

    var 청구유형Col = headers.indexOf('청구유형');
    var 청구금액Col = headers.indexOf('청구금액');
    var 청구상태Col = headers.indexOf('청구상태');
    var 미수금Col = headers.indexOf('미수금');
    var 결제예정일Col = headers.indexOf('결제예정일');
    var 삭제여부Col = headers.indexOf('삭제여부');

    var 총청구액 = 0;
    var 총결제완료금액 = 0;
    var 총미수금 = 0;
    var 정상건수 = 0;
    var 연체건수 = 0;

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    for (var i = 1; i < allData.length; i++) {
      var row = allData[i];

      // 삭제된 데이터 제외
      if (row[삭제여부Col] === true) continue;

      // 유형 필터
      if (row[청구유형Col] !== type) continue;

      // 완납된 건 제외
      var 상태 = row[청구상태Col];
      if (상태 === 'PAID') continue;

      var 청구금액 = Number(row[청구금액Col]) || 0;
      var 미수금 = Number(row[미수금Col]) || 청구금액;

      총청구액 += 청구금액;
      총결제완료금액 += (청구금액 - 미수금);
      총미수금 += 미수금;

      // 연체 여부 확인
      var 결제예정일 = row[결제예정일Col];
      if (결제예정일 instanceof Date) {
        var 예정일Copy = new Date(결제예정일);
        예정일Copy.setHours(0, 0, 0, 0);

        if (예정일Copy < today) {
          연체건수++;
        } else {
          정상건수++;
        }
      } else {
        정상건수++;
      }
    }

    Logger.log('[getReceivableSummary] ' + type + ' - 총미수금: ' + 총미수금.toLocaleString() + ', 정상: ' + 정상건수 + '건, 연체: ' + 연체건수 + '건');

    return {
      success: true,
      data: {
        총청구액: 총청구액,
        총결제완료금액: 총결제완료금액,
        총미수금: 총미수금,
        정상건수: 정상건수,
        연체건수: 연체건수
      }
    };

  } catch (error) {
    Logger.log('[getReceivableSummary] ❌ 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 거래처별 미수금 집계
 * @param {string} type - "매입" 또는 "매출"
 * @param {Object} filters - 필터 조건 (거래처명, 기간)
 * @returns {Object} - 거래처별 집계 배열
 */
function getReceivableByCompany(type, filters) {
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var sheet = ss.getSheetByName('청구DB');

    if (!sheet) {
      Logger.log('[getReceivableByCompany] ❌ 청구DB 시트를 찾을 수 없습니다.');
      return { success: false, error: '청구DB 시트를 찾을 수 없습니다.' };
    }

    var allData = sheet.getDataRange().getValues();
    var headers = allData[0];

    var 청구IDCol = headers.indexOf('청구ID');
    var 청구유형Col = headers.indexOf('청구유형');
    var 거래처명Col = headers.indexOf('거래처명');
    var 청구일Col = headers.indexOf('청구일');
    var 청구금액Col = headers.indexOf('청구금액');
    var 청구상태Col = headers.indexOf('청구상태');
    var 미수금Col = headers.indexOf('미수금');
    var 결제완료금액Col = headers.indexOf('결제완료금액');
    var 최종결제일Col = headers.indexOf('최종결제일');
    var 결제예정일Col = headers.indexOf('결제예정일');
    var 삭제여부Col = headers.indexOf('삭제여부');

    var companyMap = {}; // 거래처별 집계 객체

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    for (var i = 1; i < allData.length; i++) {
      var row = allData[i];

      // 삭제된 데이터 제외
      if (row[삭제여부Col] === true) continue;

      // 유형 필터
      if (row[청구유형Col] !== type) continue;

      // 완납된 건 제외
      var 상태 = row[청구상태Col];
      if (상태 === 'PAID') continue;

      var 거래처명 = row[거래처명Col];

      // 거래처 필터
      if (filters.companyName && 거래처명.indexOf(filters.companyName) === -1) continue;

      // 기간 필터
      if (filters.startDate || filters.endDate) {
        var 청구일 = row[청구일Col];
        if (청구일 instanceof Date) {
          var 청구일Str = Utilities.formatDate(청구일, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          if (filters.startDate && 청구일Str < filters.startDate) continue;
          if (filters.endDate && 청구일Str > filters.endDate) continue;
        }
      }

      // 거래처별 집계 초기화
      if (!companyMap[거래처명]) {
        companyMap[거래처명] = {
          거래처명: 거래처명,
          총청구액: 0,
          결제완료금액: 0,
          미수금: 0,
          청구서수: 0,
          정상건수: 0,
          연체건수: 0,
          최종결제일: null,
          청구서목록: []
        };
      }

      var 청구금액 = Number(row[청구금액Col]) || 0;
      var 미수금 = Number(row[미수금Col]) || 청구금액;
      var 결제완료금액 = Number(row[결제완료금액Col]) || 0;

      companyMap[거래처명].총청구액 += 청구금액;
      companyMap[거래처명].결제완료금액 += 결제완료금액;
      companyMap[거래처명].미수금 += 미수금;
      companyMap[거래처명].청구서수++;

      // 연체 여부 확인
      var 결제예정일 = row[결제예정일Col];
      var isOverdue = false;

      if (결제예정일 instanceof Date) {
        var 예정일Copy = new Date(결제예정일);
        예정일Copy.setHours(0, 0, 0, 0);

        if (예정일Copy < today) {
          companyMap[거래처명].연체건수++;
          isOverdue = true;
        } else {
          companyMap[거래처명].정상건수++;
        }
      } else {
        companyMap[거래처명].정상건수++;
      }

      // 최종결제일 업데이트
      var 최종결제일 = row[최종결제일Col];
      if (최종결제일 instanceof Date) {
        if (!companyMap[거래처명].최종결제일 || 최종결제일 > companyMap[거래처명].최종결제일) {
          companyMap[거래처명].최종결제일 = 최종결제일;
        }
      }

      // 청구서 목록에 추가
      companyMap[거래처명].청구서목록.push({
        청구ID: row[청구IDCol],
        청구일: row[청구일Col] instanceof Date ? Utilities.formatDate(row[청구일Col], Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
        청구금액: 청구금액,
        결제완료금액: 결제완료금액,
        미수금: 미수금,
        청구상태: 상태,
        결제예정일: 결제예정일 instanceof Date ? Utilities.formatDate(결제예정일, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
        연체여부: isOverdue
      });
    }

    // 객체를 배열로 변환
    var companyList = [];
    for (var key in companyMap) {
      var company = companyMap[key];

      // 최종결제일 포맷팅
      if (company.최종결제일 instanceof Date) {
        company.최종결제일 = Utilities.formatDate(company.최종결제일, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        company.최종결제일 = '-';
      }

      companyList.push(company);
    }

    // 미수금 내림차순 정렬
    companyList.sort(function(a, b) {
      return b.미수금 - a.미수금;
    });

    Logger.log('[getReceivableByCompany] ' + type + ' - 거래처 수: ' + companyList.length + '개');

    return {
      success: true,
      data: companyList
    };

  } catch (error) {
    Logger.log('[getReceivableByCompany] ❌ 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 에이징 리포트 생성
 * @param {string} type - "매입" 또는 "매출"
 * @returns {Object} - 에이징별 집계 결과
 */
function getAgingReport(type) {
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var sheet = ss.getSheetByName('청구DB');

    if (!sheet) {
      Logger.log('[getAgingReport] ❌ 청구DB 시트를 찾을 수 없습니다.');
      return { success: false, error: '청구DB 시트를 찾을 수 없습니다.' };
    }

    var allData = sheet.getDataRange().getValues();
    var headers = allData[0];

    var 청구유형Col = headers.indexOf('청구유형');
    var 청구일Col = headers.indexOf('청구일');
    var 청구금액Col = headers.indexOf('청구금액');
    var 청구상태Col = headers.indexOf('청구상태');
    var 미수금Col = headers.indexOf('미수금');
    var 삭제여부Col = headers.indexOf('삭제여부');

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var aging = {
      '0-30일': { 건수: 0, 금액: 0 },
      '31-60일': { 건수: 0, 금액: 0 },
      '61-90일': { 건수: 0, 금액: 0 },
      '90일 초과': { 건수: 0, 금액: 0 }
    };

    for (var i = 1; i < allData.length; i++) {
      var row = allData[i];

      // 삭제된 데이터 제외
      if (row[삭제여부Col] === true) continue;

      // 유형 필터
      if (row[청구유형Col] !== type) continue;

      // 완납된 건 제외
      var 상태 = row[청구상태Col];
      if (상태 === 'PAID') continue;

      var 청구일 = row[청구일Col];
      if (!(청구일 instanceof Date)) continue;

      var 미수금 = Number(row[미수금Col]) || Number(row[청구금액Col]) || 0;

      // 경과 일수 계산
      var 청구일Copy = new Date(청구일);
      청구일Copy.setHours(0, 0, 0, 0);

      var diffTime = today.getTime() - 청구일Copy.getTime();
      var diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // 에이징 분류
      if (diffDays <= 30) {
        aging['0-30일'].건수++;
        aging['0-30일'].금액 += 미수금;
      } else if (diffDays <= 60) {
        aging['31-60일'].건수++;
        aging['31-60일'].금액 += 미수금;
      } else if (diffDays <= 90) {
        aging['61-90일'].건수++;
        aging['61-90일'].금액 += 미수금;
      } else {
        aging['90일 초과'].건수++;
        aging['90일 초과'].금액 += 미수금;
      }
    }

    Logger.log('[getAgingReport] ' + type + ' - 에이징 리포트 생성 완료');

    return {
      success: true,
      data: aging
    };

  } catch (error) {
    Logger.log('[getAgingReport] ❌ 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}
