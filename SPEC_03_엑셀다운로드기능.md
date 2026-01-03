# 📊 명세서 #3: 입출금 내역 엑셀 다운로드 기능

**작성일**: 2026-01-03
**버전**: 1.0
**대상 시스템**: 원브릿지 ERP - 결제관리시스템

---

## 📋 목차

1. [현황 분석](#1-현황-분석)
2. [기능 설계](#2-기능-설계)
3. [백엔드 로직](#3-백엔드-로직)
4. [프론트엔드 UI](#4-프론트엔드-ui)
5. [데이터 플로우](#5-데이터-플로우)
6. [구현 계획](#6-구현-계획)
7. [일정](#7-일정)
8. [리스크 및 대응](#8-리스크-및-대응)
9. [참고자료](#9-참고자료)

---

## 1. 현황 분석

### 1.1 진단 스크립트 결과 기반 현황

#### 결제내역 시트 구조 (14개 컬럼)
```
1. 결제ID
2. 결제일
3. 결제유형 (매입/매출)
4. 거래처명
5. 금액
6. 결제수단 (현금/카드/계좌이체/어음)
7. 문서번호 (청구ID)
8. 적요
9. 비고
10. 삭제여부
11. 최종수정일
12. 최종수정자
13. 생성일
14. 생성자
```

**데이터 현황**: 999개 결제내역 (활성 데이터 기준)

#### 회사비용 시트 구조 (11개 컬럼)
```
1. 비용ID
2. 결제일
3. 비용분류
4. 금액
5. 결제수단
6. 거래처
7. 적요
8. 삭제여부
9. 최종수정일
10. 최종수정자
11. 생성일
```

**데이터 현황**: 현재 데이터 없음 (신규 기능으로 추후 사용 예정)

### 1.2 기존 시스템의 제약사항

**❌ 현재 없는 기능**:
- 엑셀 다운로드 기능 전무
- 데이터 필터링 후 내보내기 불가
- 회계 감사용 리포트 생성 불가
- 기간별/거래처별 집계 리포트 없음

**✅ 기존에 있는 기능**:
- 결제내역 조회 (날짜, 유형, 거래처 필터링)
- 검색 기능 (Page_PaymentManagement.html의 검색 바)
- 삭제여부 필터링 (활성 데이터만 표시)

### 1.3 요구사항 정리

**비즈니스 요구사항**:
1. 월별 입출금 내역을 엑셀로 다운로드하여 회계팀에 공유
2. 거래처별 결제내역을 엑셀로 추출하여 정산 자료로 활용
3. 특정 기간의 매입/매출 현황을 엑셀로 분석
4. 감사 대비 전체 결제내역 아카이빙

**기술 요구사항**:
1. Google Apps Script의 `Utilities.newBlob()` 활용한 엑셀 생성
2. 현재 적용된 필터 조건 그대로 엑셀 다운로드
3. 엑셀 파일명 자동 생성 (날짜, 필터 조건 포함)
4. UTF-8 인코딩 보장 (한글 깨짐 방지)
5. 컬럼 헤더 자동 추가
6. 금액 컬럼 숫자 형식 적용

---

## 2. 기능 설계

### 2.1 다운로드 시나리오

#### 시나리오 A: 입출금 내역 다운로드
```
[결제관리 페이지 - 입출금 관리 탭]
1. 사용자가 필터 조건 설정 (기간, 유형, 거래처)
2. "조회" 버튼 클릭하여 테이블에 결과 표시
3. "엑셀 다운로드" 버튼 클릭
4. 시스템이 현재 조회된 데이터를 엑셀로 변환
5. 파일명: "입출금내역_20260101_20260131_매입.xlsx" 형식으로 자동 생성
6. 브라우저에서 파일 다운로드
```

#### 시나리오 B: 회사비용 내역 다운로드
```
[결제관리 페이지 - 회사비용 관리 탭]
1. 사용자가 필터 조건 설정 (기간, 비용분류)
2. "조회" 버튼 클릭
3. "엑셀 다운로드" 버튼 클릭
4. 회사비용 데이터를 엑셀로 변환
5. 파일명: "회사비용_20260101_20260131.xlsx"
6. 브라우저에서 파일 다운로드
```

### 2.2 엑셀 파일 구조

#### 입출금 내역 엑셀 컬럼 (13개 - 삭제여부 제외)
```
1. 결제ID
2. 결제일
3. 결제유형
4. 거래처명
5. 금액 (숫자 형식, 천 단위 구분)
6. 결제수단
7. 문서번호
8. 적요
9. 비고
10. 최종수정일
11. 최종수정자
12. 생성일
13. 생성자
```

**추가 기능**:
- 첫 행: 다운로드 조건 요약 (예: "기간: 2026-01-01 ~ 2026-01-31 | 유형: 매입")
- 두 번째 행: 컬럼 헤더 (굵게, 배경색)
- 세 번째 행부터: 데이터
- 마지막 행: 합계 (금액 컬럼 SUM)

#### 회사비용 엑셀 컬럼 (10개 - 삭제여부 제외)
```
1. 비용ID
2. 결제일
3. 비용분류
4. 금액
5. 결제수단
6. 거래처
7. 적요
8. 최종수정일
9. 최종수정자
10. 생성일
```

### 2.3 파일명 규칙

```javascript
// 패턴: {유형}_{시작일}_{종료일}_{추가조건}.xlsx
// 예시:
"입출금내역_20260101_20260131_매입.xlsx"
"입출금내역_20260101_20260131_전체.xlsx"
"입출금내역_20260115_20260115_삼성전자.xlsx"
"회사비용_202601_전체.xlsx"
```

**규칙**:
1. 날짜 형식: YYYYMMDD (하이픈 제거)
2. 유형 조건: "매입", "매출", "전체"
3. 거래처명은 최대 10자까지만 포함
4. 특수문자 제거 (파일명 호환성)

---

## 3. 백엔드 로직

### 3.1 신규 서비스 파일: ExcelExportService.js

#### 3.1.1 입출금 내역 엑셀 생성 함수

```javascript
/**
 * 입출금 내역을 엑셀 파일로 변환하여 다운로드
 * @param {Object} params - 필터 조건
 * @param {string} params.startDate - 시작일 (YYYY-MM-DD)
 * @param {string} params.endDate - 종료일 (YYYY-MM-DD)
 * @param {string} params.paymentType - 결제유형 ("매입"/"매출"/"")
 * @param {string} params.companyName - 거래처명 (선택)
 * @returns {Object} - {success, blob, fileName, error}
 */
function exportPaymentRecordsToExcel(params) {
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var sheet = ss.getSheetByName('결제내역');

    if (!sheet) {
      return { success: false, error: '결제내역 시트를 찾을 수 없습니다.' };
    }

    // 1. 데이터 조회 (필터 적용)
    var allData = sheet.getDataRange().getValues();
    var headers = allData[0];

    // 컬럼 인덱스 찾기
    var 결제일Col = headers.indexOf('결제일');
    var 결제유형Col = headers.indexOf('결제유형');
    var 거래처명Col = headers.indexOf('거래처명');
    var 삭제여부Col = headers.indexOf('삭제여부');

    // 2. 필터링
    var filteredData = [];
    for (var i = 1; i < allData.length; i++) {
      var row = allData[i];

      // 삭제된 데이터 제외
      if (row[삭제여부Col] === true) continue;

      // 날짜 필터
      var 결제일 = row[결제일Col];
      if (결제일 instanceof Date) {
        var 결제일Str = Utilities.formatDate(결제일, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        if (params.startDate && 결제일Str < params.startDate) continue;
        if (params.endDate && 결제일Str > params.endDate) continue;
      }

      // 유형 필터
      if (params.paymentType && row[결제유형Col] !== params.paymentType) continue;

      // 거래처 필터
      if (params.companyName && row[거래처명Col].indexOf(params.companyName) === -1) continue;

      filteredData.push(row);
    }

    if (filteredData.length === 0) {
      return { success: false, error: '조회된 데이터가 없습니다.' };
    }

    // 3. 엑셀 데이터 생성
    var excelData = [];

    // 첫 행: 다운로드 조건 요약
    var filterSummary = '기간: ' + (params.startDate || '전체') + ' ~ ' + (params.endDate || '전체');
    if (params.paymentType) {
      filterSummary += ' | 유형: ' + params.paymentType;
    }
    if (params.companyName) {
      filterSummary += ' | 거래처: ' + params.companyName;
    }
    excelData.push([filterSummary]);
    excelData.push([]); // 빈 행

    // 헤더 추가 (삭제여부 제외)
    var excelHeaders = [];
    for (var i = 0; i < headers.length; i++) {
      if (headers[i] !== '삭제여부') {
        excelHeaders.push(headers[i]);
      }
    }
    excelData.push(excelHeaders);

    // 데이터 추가
    var totalAmount = 0;
    var 금액Col = headers.indexOf('금액');

    for (var i = 0; i < filteredData.length; i++) {
      var row = filteredData[i];
      var excelRow = [];

      for (var j = 0; j < row.length; j++) {
        if (headers[j] === '삭제여부') continue;

        var value = row[j];

        // 날짜 형식 변환
        if (value instanceof Date) {
          value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
        }

        excelRow.push(value);
      }

      excelData.push(excelRow);

      // 금액 합계 계산
      var amount = Number(row[금액Col]) || 0;
      totalAmount += amount;
    }

    // 합계 행 추가
    var summaryRow = [];
    for (var i = 0; i < excelHeaders.length; i++) {
      if (excelHeaders[i] === '금액') {
        summaryRow.push('합계: ' + totalAmount.toLocaleString() + '원');
      } else if (i === 0) {
        summaryRow.push('총 ' + filteredData.length + '건');
      } else {
        summaryRow.push('');
      }
    }
    excelData.push([]);
    excelData.push(summaryRow);

    // 4. CSV 문자열 생성 (엑셀 호환)
    var csvContent = '';
    for (var i = 0; i < excelData.length; i++) {
      var row = excelData[i];
      var csvRow = [];

      for (var j = 0; j < row.length; j++) {
        var cell = String(row[j] || '');
        // CSV 이스케이프 처리
        if (cell.indexOf(',') !== -1 || cell.indexOf('"') !== -1 || cell.indexOf('\n') !== -1) {
          cell = '"' + cell.replace(/"/g, '""') + '"';
        }
        csvRow.push(cell);
      }

      csvContent += csvRow.join(',') + '\r\n';
    }

    // 5. Blob 생성 (UTF-8 BOM 추가 - 엑셀 한글 깨짐 방지)
    var BOM = '\uFEFF';
    var blob = Utilities.newBlob(BOM + csvContent, 'text/csv', 'temp.csv');

    // 6. 파일명 생성
    var fileName = generateFileName(params, '입출금내역');

    return {
      success: true,
      blob: blob,
      fileName: fileName,
      recordCount: filteredData.length,
      totalAmount: totalAmount
    };

  } catch (error) {
    Logger.log('엑셀 생성 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}
```

#### 3.1.2 회사비용 엑셀 생성 함수

```javascript
/**
 * 회사비용 내역을 엑셀 파일로 변환
 * @param {Object} params - 필터 조건
 * @returns {Object} - {success, blob, fileName, error}
 */
function exportExpenseRecordsToExcel(params) {
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var sheet = ss.getSheetByName('회사비용');

    if (!sheet) {
      return { success: false, error: '회사비용 시트를 찾을 수 없습니다.' };
    }

    var allData = sheet.getDataRange().getValues();
    var headers = allData[0];

    var 결제일Col = headers.indexOf('결제일');
    var 비용분류Col = headers.indexOf('비용분류');
    var 삭제여부Col = headers.indexOf('삭제여부');

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

    if (filteredData.length === 0) {
      return { success: false, error: '조회된 데이터가 없습니다.' };
    }

    // 엑셀 데이터 생성 (입출금 내역과 동일한 로직)
    var excelData = [];

    var filterSummary = '기간: ' + (params.startDate || '전체') + ' ~ ' + (params.endDate || '전체');
    if (params.category) {
      filterSummary += ' | 분류: ' + params.category;
    }
    excelData.push([filterSummary]);
    excelData.push([]);

    // 헤더 (삭제여부 제외)
    var excelHeaders = [];
    for (var i = 0; i < headers.length; i++) {
      if (headers[i] !== '삭제여부') {
        excelHeaders.push(headers[i]);
      }
    }
    excelData.push(excelHeaders);

    // 데이터
    var totalAmount = 0;
    var 금액Col = headers.indexOf('금액');

    for (var i = 0; i < filteredData.length; i++) {
      var row = filteredData[i];
      var excelRow = [];

      for (var j = 0; j < row.length; j++) {
        if (headers[j] === '삭제여부') continue;

        var value = row[j];
        if (value instanceof Date) {
          value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
        }
        excelRow.push(value);
      }

      excelData.push(excelRow);
      totalAmount += (Number(row[금액Col]) || 0);
    }

    // 합계 행
    var summaryRow = [];
    for (var i = 0; i < excelHeaders.length; i++) {
      if (excelHeaders[i] === '금액') {
        summaryRow.push('합계: ' + totalAmount.toLocaleString() + '원');
      } else if (i === 0) {
        summaryRow.push('총 ' + filteredData.length + '건');
      } else {
        summaryRow.push('');
      }
    }
    excelData.push([]);
    excelData.push(summaryRow);

    // CSV 생성
    var csvContent = '';
    for (var i = 0; i < excelData.length; i++) {
      var row = excelData[i];
      var csvRow = [];

      for (var j = 0; j < row.length; j++) {
        var cell = String(row[j] || '');
        if (cell.indexOf(',') !== -1 || cell.indexOf('"') !== -1 || cell.indexOf('\n') !== -1) {
          cell = '"' + cell.replace(/"/g, '""') + '"';
        }
        csvRow.push(cell);
      }

      csvContent += csvRow.join(',') + '\r\n';
    }

    var BOM = '\uFEFF';
    var blob = Utilities.newBlob(BOM + csvContent, 'text/csv', 'temp.csv');

    var fileName = generateFileName(params, '회사비용');

    return {
      success: true,
      blob: blob,
      fileName: fileName,
      recordCount: filteredData.length,
      totalAmount: totalAmount
    };

  } catch (error) {
    Logger.log('회사비용 엑셀 생성 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}
```

#### 3.1.3 파일명 생성 유틸리티

```javascript
/**
 * 엑셀 파일명 자동 생성
 * @param {Object} params - 필터 조건
 * @param {string} prefix - 파일명 접두어 ("입출금내역" / "회사비용")
 * @returns {string} - 생성된 파일명
 */
function generateFileName(params, prefix) {
  var fileName = prefix;

  // 날짜 추가
  if (params.startDate) {
    fileName += '_' + params.startDate.replace(/-/g, '');
  }
  if (params.endDate) {
    fileName += '_' + params.endDate.replace(/-/g, '');
  }

  // 조건 추가
  if (params.paymentType) {
    fileName += '_' + params.paymentType;
  } else if (params.category) {
    fileName += '_' + params.category;
  } else {
    fileName += '_전체';
  }

  // 거래처명 추가 (최대 10자)
  if (params.companyName) {
    var companyShort = params.companyName.substring(0, 10);
    // 특수문자 제거
    companyShort = companyShort.replace(/[<>:"/\\|?*]/g, '');
    fileName += '_' + companyShort;
  }

  fileName += '.csv';

  return fileName;
}
```

### 3.2 API 엔드포인트 추가 (ApiService.js)

```javascript
/**
 * API: 입출금 내역 엑셀 다운로드
 */
function api_exportPaymentRecordsToExcel(params) {
  var result = exportPaymentRecordsToExcel(params);

  if (!result.success) {
    return safeReturn(result);
  }

  // Blob은 직접 반환할 수 없으므로, 임시 파일로 저장 후 URL 반환
  // 또는 클라이언트에서 google.script.run 사용
  return safeReturn({
    success: true,
    message: '엑셀 파일이 생성되었습니다.',
    recordCount: result.recordCount,
    totalAmount: result.totalAmount,
    fileName: result.fileName
  });
}

/**
 * API: 회사비용 엑셀 다운로드
 */
function api_exportExpenseRecordsToExcel(params) {
  var result = exportExpenseRecordsToExcel(params);

  if (!result.success) {
    return safeReturn(result);
  }

  return safeReturn({
    success: true,
    message: '엑셀 파일이 생성되었습니다.',
    recordCount: result.recordCount,
    totalAmount: result.totalAmount,
    fileName: result.fileName
  });
}
```

---

## 4. 프론트엔드 UI

### 4.1 Page_PaymentManagement.html 수정

#### 4.1.1 입출금 관리 탭에 다운로드 버튼 추가

**위치**: 검색 바 우측 상단

```html
<!-- 기존 검색 바 영역 -->
<div class="payment-search">
  <div class="payment-search-field">
    <label>시작일</label>
    <input type="date" id="payment-start-date">
  </div>

  <div class="payment-search-field">
    <label>종료일</label>
    <input type="date" id="payment-end-date">
  </div>

  <div class="payment-search-field">
    <label>결제유형</label>
    <select id="payment-type-filter">
      <option value="">전체</option>
      <option value="매입">매입</option>
      <option value="매출">매출</option>
    </select>
  </div>

  <div class="payment-search-field">
    <label>거래처</label>
    <input type="text" id="payment-company-filter" placeholder="거래처명 입력">
  </div>

  <button class="payment-btn primary" id="payment-search-btn">
    🔍 조회
  </button>

  <button class="payment-btn secondary" id="payment-reset-btn">
    초기화
  </button>

  <!-- ⭐ 신규 추가: 엑셀 다운로드 버튼 -->
  <button class="payment-btn success" id="payment-excel-download-btn" style="margin-left: auto;">
    📥 엑셀 다운로드
  </button>
</div>
```

**CSS 추가**:
```css
.payment-btn.success {
  background: #10b981;
  color: white;
}
.payment-btn.success:hover {
  background: #059669;
}
.payment-btn.success:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}
```

#### 4.1.2 회사비용 관리 탭에 다운로드 버튼 추가

```html
<div class="expense-search">
  <!-- 기존 검색 필터들 -->

  <!-- ⭐ 신규 추가 -->
  <button class="expense-btn success" id="expense-excel-download-btn" style="margin-left: auto;">
    📥 엑셀 다운로드
  </button>
</div>
```

### 4.2 JavaScript 이벤트 핸들러 (CommonScripts.html)

#### 4.2.1 입출금 내역 다운로드 핸들러

```javascript
/**
 * 입출금 내역 엑셀 다운로드
 */
function handlePaymentExcelDownload() {
  var startDate = document.getElementById('payment-start-date').value;
  var endDate = document.getElementById('payment-end-date').value;
  var paymentType = document.getElementById('payment-type-filter').value;
  var companyName = document.getElementById('payment-company-filter').value;

  // 버튼 비활성화
  var btn = document.getElementById('payment-excel-download-btn');
  btn.disabled = true;
  btn.textContent = '⏳ 생성 중...';

  var params = {
    startDate: startDate,
    endDate: endDate,
    paymentType: paymentType,
    companyName: companyName
  };

  // Google Apps Script 함수 호출 (파일 다운로드)
  google.script.run
    .withSuccessHandler(function(result) {
      btn.disabled = false;
      btn.textContent = '📥 엑셀 다운로드';

      if (result && result.success) {
        showToast('✅ 엑셀 파일이 다운로드되었습니다. (' + result.recordCount + '건)');
      } else {
        showToast('❌ ' + (result.error || '다운로드 실패'));
      }
    })
    .withFailureHandler(function(error) {
      btn.disabled = false;
      btn.textContent = '📥 엑셀 다운로드';
      showToast('❌ 오류: ' + error.message);
    })
    .withUserObject(params)
    .exportPaymentRecordsToExcelAndDownload(params);
}

// 이벤트 리스너 등록
document.getElementById('payment-excel-download-btn').addEventListener('click', handlePaymentExcelDownload);
```

#### 4.2.2 서버사이드 다운로드 트리거 함수

**ExcelExportService.js에 추가**:

```javascript
/**
 * 클라이언트에서 호출하여 엑셀 파일 다운로드 트리거
 */
function exportPaymentRecordsToExcelAndDownload(params) {
  var result = exportPaymentRecordsToExcel(params);

  if (!result.success) {
    return result;
  }

  // 사용자에게 파일 다운로드 제공
  var htmlOutput = HtmlService.createHtmlOutput(
    '<script>' +
    'var blob = Utilities.newBlob(' + JSON.stringify(result.blob.getDataAsString()) + ', "text/csv");' +
    'var url = URL.createObjectURL(new Blob([blob], {type: "text/csv"}));' +
    'var a = document.createElement("a");' +
    'a.href = url;' +
    'a.download = "' + result.fileName + '";' +
    'a.click();' +
    'google.script.host.close();' +
    '</script>'
  );

  SpreadsheetApp.getUi().showModelessDialog(htmlOutput, '다운로드 중...');

  return {
    success: true,
    recordCount: result.recordCount,
    totalAmount: result.totalAmount,
    fileName: result.fileName
  };
}
```

**⚠️ 중요**: Google Apps Script의 제약으로 인해 직접 파일 다운로드는 불가능합니다.
**해결 방법**:
1. **방법 A**: `ContentService`를 이용한 CSV 다운로드 (doGet 엔드포인트)
2. **방법 B**: Google Drive에 임시 파일 생성 후 공유 링크 제공
3. **방법 C**: 클라이언트에서 데이터를 받아 JavaScript로 Blob 생성

**권장: 방법 A (ContentService 활용)**

#### 4.2.3 ContentService 방식 구현

**ExcelExportService.js**:

```javascript
/**
 * doGet 엔드포인트: 엑셀 다운로드 URL 제공
 * URL: https://script.google.com/macros/s/{SCRIPT_ID}/exec?action=downloadPayment&startDate=...
 */
function doGet(e) {
  var action = e.parameter.action;

  if (action === 'downloadPayment') {
    var params = {
      startDate: e.parameter.startDate || '',
      endDate: e.parameter.endDate || '',
      paymentType: e.parameter.paymentType || '',
      companyName: e.parameter.companyName || ''
    };

    var result = exportPaymentRecordsToExcel(params);

    if (!result.success) {
      return ContentService.createTextOutput('오류: ' + result.error);
    }

    return ContentService.createTextOutput(result.blob.getDataAsString())
      .setMimeType(ContentService.MimeType.CSV)
      .downloadAsFile(result.fileName);
  }

  if (action === 'downloadExpense') {
    var params = {
      startDate: e.parameter.startDate || '',
      endDate: e.parameter.endDate || '',
      category: e.parameter.category || ''
    };

    var result = exportExpenseRecordsToExcel(params);

    if (!result.success) {
      return ContentService.createTextOutput('오류: ' + result.error);
    }

    return ContentService.createTextOutput(result.blob.getDataAsString())
      .setMimeType(ContentService.MimeType.CSV)
      .downloadAsFile(result.fileName);
  }

  return ContentService.createTextOutput('잘못된 요청입니다.');
}
```

**프론트엔드 수정** (CommonScripts.html):

```javascript
function handlePaymentExcelDownload() {
  var startDate = document.getElementById('payment-start-date').value;
  var endDate = document.getElementById('payment-end-date').value;
  var paymentType = document.getElementById('payment-type-filter').value;
  var companyName = document.getElementById('payment-company-filter').value;

  // Web App URL (배포 후 설정 필요)
  var SCRIPT_URL = 'https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec';

  var params = new URLSearchParams({
    action: 'downloadPayment',
    startDate: startDate,
    endDate: endDate,
    paymentType: paymentType,
    companyName: companyName
  });

  var downloadUrl = SCRIPT_URL + '?' + params.toString();

  // 새 탭에서 다운로드
  window.open(downloadUrl, '_blank');

  showToast('✅ 엑셀 다운로드가 시작되었습니다.');
}
```

### 4.3 UI/UX 개선사항

#### 다운로드 전 확인 모달 (선택사항)

```html
<!-- 다운로드 확인 모달 -->
<div class="payment-modal" id="download-confirm-modal">
  <div class="payment-modal-content" style="max-width: 400px;">
    <div class="payment-modal-header">
      <h2>📥 엑셀 다운로드</h2>
      <button class="payment-modal-close" id="download-modal-close-btn">×</button>
    </div>

    <div class="payment-modal-body">
      <p>다음 조건으로 엑셀 파일을 다운로드합니다:</p>
      <ul style="margin: 16px 0; padding-left: 20px;">
        <li id="download-summary-period">기간: -</li>
        <li id="download-summary-type">유형: -</li>
        <li id="download-summary-company">거래처: -</li>
        <li id="download-summary-count" style="font-weight: 600;">예상 데이터: - 건</li>
      </ul>
    </div>

    <div class="payment-modal-footer">
      <button class="payment-btn secondary" id="download-cancel-btn">취소</button>
      <button class="payment-btn primary" id="download-confirm-btn">다운로드</button>
    </div>
  </div>
</div>
```

---

## 5. 데이터 플로우

### 5.1 입출금 내역 다운로드 플로우

```
[사용자]
  ↓ 1. 필터 조건 입력 및 "조회" 버튼 클릭
[프론트엔드 - CommonScripts.html]
  ↓ 2. API 호출: searchPaymentRecords()
[백엔드 - PaymentService.js]
  ↓ 3. 결제내역 시트 조회 및 필터링
[프론트엔드]
  ↓ 4. 테이블에 결과 표시
[사용자]
  ↓ 5. "엑셀 다운로드" 버튼 클릭
[프론트엔드 - CommonScripts.html]
  ↓ 6. doGet URL 생성 및 window.open()
[백엔드 - ExcelExportService.js - doGet()]
  ↓ 7. exportPaymentRecordsToExcel() 호출
  ↓ 8. 결제내역 시트 재조회 (동일 필터 적용)
  ↓ 9. CSV 데이터 생성 (UTF-8 BOM 추가)
  ↓ 10. ContentService로 파일 응답
[브라우저]
  ↓ 11. 파일 다운로드 시작
[사용자]
  ✅ 12. 엑셀 파일 저장
```

### 5.2 회사비용 다운로드 플로우

```
[사용자]
  ↓ 1. "회사비용 관리" 탭 선택
  ↓ 2. 필터 조건 입력 및 "조회"
[프론트엔드]
  ↓ 3. API 호출: searchExpenseRecords()
[백엔드 - ExpenseService.js]
  ↓ 4. 회사비용 시트 조회
[프론트엔드]
  ↓ 5. 테이블에 결과 표시
[사용자]
  ↓ 6. "엑셀 다운로드" 버튼 클릭
[프론트엔드]
  ↓ 7. doGet URL 생성 (action=downloadExpense)
[백엔드 - ExcelExportService.js]
  ↓ 8. exportExpenseRecordsToExcel() 호출
  ↓ 9. CSV 생성 및 ContentService 응답
[브라우저]
  ✅ 10. 파일 다운로드
```

### 5.3 에러 처리 플로우

```
[백엔드] 데이터 조회 실패
  ↓ return { success: false, error: '시트를 찾을 수 없습니다.' }
[프론트엔드] withFailureHandler() 트리거
  ↓ showToast('❌ 오류: ...')
[사용자] 에러 메시지 확인
```

---

## 6. 구현 계획

### 6.1 Day 1: 백엔드 개발 (3시간)

**작업 내역**:
1. ExcelExportService.js 파일 생성
2. `exportPaymentRecordsToExcel()` 함수 구현
   - 데이터 필터링 로직
   - CSV 생성 로직
   - UTF-8 BOM 처리
3. `exportExpenseRecordsToExcel()` 함수 구현
4. `generateFileName()` 유틸리티 구현
5. 단위 테스트 (Logger.log로 결과 확인)

**검증**:
```javascript
// 테스트 함수
function testExportPaymentRecords() {
  var params = {
    startDate: '2025-01-01',
    endDate: '2025-01-31',
    paymentType: '매입',
    companyName: ''
  };

  var result = exportPaymentRecordsToExcel(params);
  Logger.log(result);

  // 예상 결과:
  // {
  //   success: true,
  //   blob: {...},
  //   fileName: '입출금내역_20250101_20250131_매입.csv',
  //   recordCount: 123,
  //   totalAmount: 15000000
  // }
}
```

### 6.2 Day 2: doGet 엔드포인트 및 배포 (2시간)

**작업 내역**:
1. `doGet()` 함수 구현
2. Apps Script 웹 앱으로 배포
   - 배포 > 새 배포 > 웹 앱
   - 실행 계정: "나"
   - 액세스 권한: "모든 사용자"
3. 배포 URL 확인 및 프론트엔드 설정에 반영

**배포 URL 예시**:
```
https://script.google.com/macros/s/AKfycbz.../exec
```

### 6.3 Day 3: 프론트엔드 개발 (3시간)

**작업 내역**:
1. Page_PaymentManagement.html에 버튼 추가
   - 입출금 관리 탭: "📥 엑셀 다운로드"
   - 회사비용 관리 탭: "📥 엑셀 다운로드"
2. CSS 스타일 추가 (.payment-btn.success)
3. CommonScripts.html에 핸들러 추가
   - `handlePaymentExcelDownload()`
   - `handleExpenseExcelDownload()`
4. 이벤트 리스너 등록

**검증**:
- 조회 후 다운로드 버튼 클릭 시 파일 다운로드 확인
- 파일명 형식 확인
- 엑셀에서 한글 깨짐 없는지 확인

### 6.4 Day 4: 테스트 및 최적화 (2시간)

**테스트 케이스**:
1. **정상 케이스**:
   - 전체 기간 다운로드
   - 특정 기간 다운로드
   - 유형 필터 적용 다운로드
   - 거래처 필터 적용 다운로드
2. **엣지 케이스**:
   - 데이터 0건일 때
   - 매우 많은 데이터 (1000건 이상)
   - 특수문자 포함된 거래처명
3. **오류 케이스**:
   - 시트 없을 때
   - 권한 없을 때

**최적화**:
- 대용량 데이터 처리 시 청크 분할
- 다운로드 중 로딩 인디케이터 개선

---

## 7. 일정

| Day | 작업 내용 | 담당 | 시간 |
|-----|----------|------|------|
| Day 1 | 백엔드 서비스 개발 | 개발자 | 3h |
| Day 2 | doGet 엔드포인트 및 배포 | 개발자 | 2h |
| Day 3 | 프론트엔드 UI 개발 | 개발자 | 3h |
| Day 4 | 테스트 및 최적화 | 개발자 + QA | 2h |
| **Total** | | | **10h (1.25일)** |

---

## 8. 리스크 및 대응

### 8.1 기술 리스크

| 리스크 | 발생 가능성 | 영향도 | 대응 방안 |
|--------|------------|--------|----------|
| Google Apps Script 6분 실행 시간 제한 | 중 | 높음 | 데이터 1000건 이상 시 청크 분할 또는 Drive 저장 방식으로 전환 |
| 엑셀에서 한글 깨짐 | 중 | 높음 | UTF-8 BOM 추가로 해결 (구현 완료) |
| 대용량 CSV 메모리 부족 | 낮 | 중 | 스트리밍 방식 또는 Drive API 활용 |
| doGet URL CORS 이슈 | 낮 | 중 | 웹 앱 배포 설정 확인 ("모든 사용자" 액세스) |

### 8.2 비즈니스 리스크

| 리스크 | 대응 방안 |
|--------|----------|
| 사용자가 민감한 데이터를 무분별하게 다운로드 | 다운로드 이력 로깅 (향후 기능) |
| 잘못된 필터로 인한 부정확한 데이터 추출 | 다운로드 전 확인 모달 추가 |

---

## 9. 참고자료

### 9.1 Google Apps Script 공식 문서
- [ContentService](https://developers.google.com/apps-script/reference/content/content-service)
- [Utilities.newBlob()](https://developers.google.com/apps-script/reference/utilities/utilities#newblob)
- [Web Apps](https://developers.google.com/apps-script/guides/web)

### 9.2 CSV 형식 스펙
- [RFC 4180 - CSV Format](https://datatracker.ietf.org/doc/html/rfc4180)
- UTF-8 BOM: `\uFEFF` (Excel 한글 인식용)

### 9.3 기존 코드 참고
- `PaymentService.js`: 결제내역 조회 로직
- `ExpenseService.js`: 회사비용 조회 로직 (향후 구현)
- `Page_PaymentManagement.html`: 검색 필터 UI

---

## 10. 부록

### 10.1 샘플 엑셀 파일 구조

```
입출금내역_20260101_20260131_매입.csv

[행 1] 기간: 2026-01-01 ~ 2026-01-31 | 유형: 매입
[행 2] (빈 행)
[행 3] 결제ID,결제일,결제유형,거래처명,금액,결제수단,문서번호,적요,비고,최종수정일,최종수정자,생성일,생성자
[행 4] PAY-20260102-001,2026-01-02,매입,삼성전자,5000000,계좌이체,INV-2025-0012,,,2026-01-02 14:30:00,김철수,2026-01-02 14:30:00,김철수
[행 5] PAY-20260105-002,2026-01-05,매입,LG전자,3000000,카드,INV-2025-0015,,,2026-01-05 09:15:00,김철수,2026-01-05 09:15:00,김철수
...
[행 N] (빈 행)
[행 N+1] 총 125건,,,,합계: 8000000원,,,,,,,,
```

### 10.2 파일명 생성 로직 예시

| 조건 | 생성되는 파일명 |
|------|----------------|
| 2026-01-01 ~ 2026-01-31, 매입 | `입출금내역_20260101_20260131_매입.csv` |
| 2026-01-01 ~ 2026-01-31, 전체 | `입출금내역_20260101_20260131_전체.csv` |
| 전체 기간, 매출, 삼성전자 | `입출금내역_전체_매출_삼성전자.csv` |
| 회사비용, 2026-01 | `회사비용_20260101_20260131_전체.csv` |

---

**문서 끝**
