# 📊 명세서 #5: 미수금/미지급금 관리 기능

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

#### 청구DB 시트 구조 (현재 19개 컬럼 → 부분결제 기능 후 22개)
```
1. 청구ID
2. 청구유형 (매입/매출)
3. 거래처명
4. 마감ID
5. 청구일
6. 청구금액
7. 청구상태 (DRAFT/ISSUED/PAID_PARTIAL/PAID)
8. 비고
9. 삭제여부
10. 최종수정일
11. 최종수정자
12. 생성일시
13. 생성자
14. 발행일시
15. 발행자
16. 결제일시
17. partialPaymentEnabled
18. remainingBalance
19. orderNumbers
20. 결제완료금액 (부분결제 기능 추가)
21. 미수금 (부분결제 기능 추가)
22. 최종결제일 (부분결제 기능 추가)
```

#### 결제내역 시트 구조 (14개 컬럼)
```
1. 결제ID
2. 결제일
3. 결제유형 (매입/매출)
4. 거래처명
5. 금액
6. 결제수단
7. 문서번호 (청구ID)
8. 적요
9. 비고
10. 삭제여부
11. 최종수정일
12. 최종수정자
13. 생성일
14. 생성자
```

**데이터 현황**:
- 청구DB: 16개 청구서
- 결제내역: 999개 결제내역

### 1.2 현재 시스템의 문제점

**❌ 없는 기능**:
1. **미수금/미지급금 집계 대시보드**: 거래처별, 기간별 집계 화면 없음
2. **연체 관리**: 결제예정일 초과 청구서 자동 표시 없음
3. **거래처별 미수금 현황**: 거래처별 미결제 총액 조회 불가
4. **에이징 리포트**: 30일/60일/90일 이상 미수금 분류 없음
5. **미수금 상세 내역**: 청구서별 분할 결제 이력 추적 어려움

**✅ 활용 가능한 기능**:
- 청구DB의 "미수금" 컬럼 (부분결제 기능 구현 후)
- 청구상태 필터링 (ISSUED, PAID_PARTIAL)
- 결제내역 조회

### 1.3 요구사항 정리

**비즈니스 요구사항**:
1. **대시보드**: 전체 미수금/미지급금 현황을 한눈에 파악
2. **거래처별 집계**: 거래처별 미수금 총액 및 청구서 목록
3. **연체 관리**: 결제예정일 초과 청구서 자동 강조 표시
4. **에이징 리포트**: 미수금을 30일/60일/90일/90일 초과로 분류
5. **상세 내역**: 청구서별 결제 이력 및 미수금 잔액 추적

**기술 요구사항**:
1. 신규 페이지 추가: "미수금 관리" (Page_ReceivableManagement.html)
2. 거래처별 집계 API
3. 에이징 분류 로직
4. 대시보드 위젯
5. 엑셀 다운로드 (에이징 리포트)

---

## 2. 기능 설계

### 2.1 페이지 구조

#### 2.1.1 신규 페이지: 미수금 관리

**파일명**: `Page_ReceivableManagement.html`

**레이아웃**:
```
┌─────────────────────────────────────────────────┐
│ 📊 미수금/미지급금 관리                            │
├─────────────────────────────────────────────────┤
│ [탭1: 미수금 (매출)]  [탭2: 미지급금 (매입)]       │
├─────────────────────────────────────────────────┤
│ 📈 요약 카드                                      │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│ │총미수금│ │정상  │ │연체  │ │에이징│           │
│ └──────┘ └──────┘ └──────┘ └──────┘           │
├─────────────────────────────────────────────────┤
│ 🔍 검색 필터                                      │
│ [거래처] [기간] [상태] [조회] [초기화] [엑셀다운로드]│
├─────────────────────────────────────────────────┤
│ 📋 거래처별 미수금 집계 테이블                      │
│ ┌─────────────────────────────────────────────┐ │
│ │거래처│총청구액│결제완료│미수금│연체│최종결제일││ │
│ ├─────────────────────────────────────────────┤ │
│ │삼성전자│10,000,000│5,000,000│5,000,000│2건│...││
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ 📄 청구서 상세 목록 (거래처 클릭 시 확장)            │
│ ┌─────────────────────────────────────────────┐ │
│ │청구ID│청구일│금액│결제완료│미수금│D-day│상태│││ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 2.2 미수금 집계 로직

#### 2.2.1 거래처별 미수금 집계

**입력**: 청구DB 전체 데이터
**출력**: 거래처별 집계 객체

```javascript
{
  "삼성전자": {
    거래처명: "삼성전자",
    총청구액: 10000000,
    결제완료금액: 5000000,
    미수금: 5000000,
    청구서수: 3,
    정상건수: 1,
    연체건수: 2,
    최종결제일: "2026-01-02",
    청구서목록: [...]
  },
  "LG전자": {
    ...
  }
}
```

#### 2.2.2 에이징 분류

**기준**: 청구일로부터 경과 일수

| 에이징 구간 | 조건 | 설명 |
|-----------|------|------|
| 0-30일 | 청구일 ~ 30일 | 정상 미수금 |
| 31-60일 | 31일 ~ 60일 | 주의 필요 |
| 61-90일 | 61일 ~ 90일 | 관리 필요 |
| 90일 초과 | 91일 이상 | 고위험 연체 |

**에이징 집계 결과**:
```javascript
{
  "0-30일": {
    건수: 5,
    금액: 8000000
  },
  "31-60일": {
    건수: 2,
    금액: 3000000
  },
  "61-90일": {
    건수: 1,
    금액: 1500000
  },
  "90일 초과": {
    건수: 1,
    금액: 500000
  }
}
```

### 2.3 연체 판정 로직

**연체 조건**:
1. 청구상태가 "ISSUED" 또는 "PAID_PARTIAL"
2. 결제예정일이 과거 (오늘 날짜보다 이전)

**연체 일수 계산**:
```
연체일수 = 오늘 날짜 - 결제예정일
```

---

## 3. 백엔드 로직

### 3.1 신규 서비스 파일: ReceivableService.js

#### 3.1.1 미수금 전체 현황 조회

```javascript
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
    Logger.log('❌ getReceivableSummary 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}
```

#### 3.1.2 거래처별 미수금 집계

```javascript
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

    return {
      success: true,
      data: companyList
    };

  } catch (error) {
    Logger.log('❌ getReceivableByCompany 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}
```

#### 3.1.3 에이징 리포트 생성

```javascript
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

    return {
      success: true,
      data: aging
    };

  } catch (error) {
    Logger.log('❌ getAgingReport 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}
```

### 3.2 API 엔드포인트 추가 (ApiService.js)

```javascript
/**
 * API: 미수금 전체 현황 조회
 */
function api_getReceivableSummary(params) {
  var type = params.type || '매출';
  return getReceivableSummary(type);
}

/**
 * API: 거래처별 미수금 집계
 */
function api_getReceivableByCompany(params) {
  var type = params.type || '매출';
  var filters = {
    companyName: params.companyName || '',
    startDate: params.startDate || '',
    endDate: params.endDate || ''
  };

  return getReceivableByCompany(type, filters);
}

/**
 * API: 에이징 리포트 조회
 */
function api_getAgingReport(params) {
  var type = params.type || '매출';
  return getAgingReport(type);
}
```

---

## 4. 프론트엔드 UI

### 4.1 신규 페이지: Page_ReceivableManagement.html

#### 4.1.1 HTML 구조

```html
<style>
.receivable-wrap{padding:20px;}

/* 페이지 헤더 */
.receivable-header{margin-bottom:20px;}
.receivable-header h1{font-size:24px;font-weight:700;color:#1e293b;margin:0 0 8px 0;}
.receivable-header p{color:#64748b;margin:0;font-size:14px;}

/* 탭 */
.receivable-tabs{
  display:flex;
  gap:8px;
  margin-bottom:20px;
  border-bottom:2px solid #e2e8f0;
}
.receivable-tab{
  padding:12px 24px;
  background:transparent;
  border:none;
  border-bottom:2px solid transparent;
  cursor:pointer;
  font-size:14px;
  font-weight:500;
  color:#64748b;
  margin-bottom:-2px;
  transition:all 0.2s;
}
.receivable-tab.active{
  color:#2563eb;
  border-bottom-color:#2563eb;
}

/* 요약 카드 */
.receivable-summary{
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));
  gap:12px;
  margin-bottom:16px;
}
.receivable-summary-card{
  background:white;
  padding:16px;
  border-radius:8px;
  box-shadow:0 1px 4px rgba(0,0,0,0.1);
}
.receivable-summary-card-label{font-size:12px;color:#64748b;margin-bottom:4px;}
.receivable-summary-card-value{font-size:20px;font-weight:700;color:#1e293b;}
.receivable-summary-card-value.primary{color:#2563eb;}
.receivable-summary-card-value.danger{color:#dc2626;}

/* 검색 바 */
.receivable-search{
  display:flex;
  gap:12px;
  flex-wrap:wrap;
  background:white;
  padding:16px;
  border-radius:8px;
  box-shadow:0 1px 4px rgba(0,0,0,0.1);
  margin-bottom:16px;
  align-items:flex-end;
}
.receivable-search-field{display:flex;flex-direction:column;gap:4px;}
.receivable-search-field label{font-size:13px;font-weight:500;color:#475569;}
.receivable-search-field input,
.receivable-search-field select{
  padding:8px 12px;
  border:1px solid #d1d5db;
  border-radius:6px;
  font-size:14px;
  min-width:150px;
}

.receivable-btn{
  padding:8px 16px;
  border:none;
  border-radius:6px;
  cursor:pointer;
  font-size:14px;
  font-weight:500;
  transition:all 0.2s;
}
.receivable-btn.primary{background:#2563eb;color:white;}
.receivable-btn.primary:hover{background:#1d4ed8;}
.receivable-btn.secondary{background:#e5e7eb;color:#1e293b;}
.receivable-btn.secondary:hover{background:#d1d5db;}
.receivable-btn.success{background:#10b981;color:white;}
.receivable-btn.success:hover{background:#059669;}

/* 테이블 */
.receivable-table-wrap{
  overflow:auto;
  max-height:600px;
  background:white;
  border-radius:8px;
  box-shadow:0 1px 4px rgba(0,0,0,0.1);
  margin-bottom:16px;
}
.receivable-table{
  width:100%;
  border-collapse:collapse;
  font-size:13px;
}
.receivable-table th,
.receivable-table td{
  padding:10px;
  border-bottom:1px solid #e2e8f0;
  text-align:left;
}
.receivable-table th{
  background:#f1f5f9;
  font-weight:600;
  position:sticky;
  top:0;
  z-index:10;
}
.receivable-table td.num{text-align:right;}
.receivable-table td.center{text-align:center;}

.receivable-table tbody tr:hover{background:#f9fafb;cursor:pointer;}

/* 확장된 청구서 목록 */
.receivable-detail-row{background:#fafafa;}
.receivable-detail-table{
  width:100%;
  margin:10px 0;
  font-size:12px;
}
.receivable-detail-table th{background:#e5e7eb;padding:6px;font-size:11px;}
.receivable-detail-table td{padding:6px;}

/* 연체 표시 */
.overdue-badge{
  background:#fee2e2;
  color:#dc2626;
  padding:2px 6px;
  border-radius:4px;
  font-size:10px;
  font-weight:600;
}
</style>

<div class="receivable-wrap">
  <!-- 페이지 헤더 -->
  <div class="receivable-header">
    <h1>📊 미수금/미지급금 관리</h1>
    <p>거래처별 미수금 현황 및 에이징 리포트</p>
  </div>

  <!-- 탭 -->
  <div class="receivable-tabs">
    <button class="receivable-tab active" id="receivable-tab-receivable">
      💰 미수금 (매출)
    </button>
    <button class="receivable-tab" id="receivable-tab-payable">
      💳 미지급금 (매입)
    </button>
  </div>

  <!-- 요약 카드 -->
  <div class="receivable-summary" id="receivable-summary">
    <div class="receivable-summary-card">
      <div class="receivable-summary-card-label">총 미수금</div>
      <div class="receivable-summary-card-value primary" id="summary-total">₩0</div>
    </div>

    <div class="receivable-summary-card">
      <div class="receivable-summary-card-label">정상 (예정일 미도래)</div>
      <div class="receivable-summary-card-value" id="summary-normal">0건</div>
    </div>

    <div class="receivable-summary-card">
      <div class="receivable-summary-card-label">연체</div>
      <div class="receivable-summary-card-value danger" id="summary-overdue">0건</div>
    </div>

    <div class="receivable-summary-card">
      <div class="receivable-summary-card-label">에이징 (90일 초과)</div>
      <div class="receivable-summary-card-value danger" id="summary-aging">₩0</div>
    </div>
  </div>

  <!-- 검색 바 -->
  <div class="receivable-search">
    <div class="receivable-search-field">
      <label>거래처</label>
      <input type="text" id="receivable-company-filter" placeholder="거래처명 입력">
    </div>

    <div class="receivable-search-field">
      <label>청구일 시작</label>
      <input type="date" id="receivable-start-date">
    </div>

    <div class="receivable-search-field">
      <label>청구일 종료</label>
      <input type="date" id="receivable-end-date">
    </div>

    <button class="receivable-btn primary" id="receivable-search-btn">
      🔍 조회
    </button>

    <button class="receivable-btn secondary" id="receivable-reset-btn">
      초기화
    </button>

    <button class="receivable-btn success" id="receivable-excel-btn" style="margin-left: auto;">
      📥 엑셀 다운로드
    </button>
  </div>

  <!-- 거래처별 미수금 테이블 -->
  <div class="receivable-table-wrap">
    <table class="receivable-table">
      <thead>
        <tr>
          <th>거래처</th>
          <th class="num">총 청구액</th>
          <th class="num">결제 완료</th>
          <th class="num">미수금</th>
          <th class="center">청구서 수</th>
          <th class="center">정상</th>
          <th class="center">연체</th>
          <th>최종 결제일</th>
          <th class="center">상세</th>
        </tr>
      </thead>
      <tbody id="receivable-tbody">
        <tr>
          <td colspan="9" style="text-align:center;padding:60px 20px;color:#64748b;">
            조회 버튼을 눌러 데이터를 확인하세요
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

#### 4.1.2 JavaScript 이벤트 핸들러 (CommonScripts.html에 추가)

```javascript
/**
 * 미수금 페이지 초기화
 */
function initReceivablePage() {
  var currentType = '매출'; // 현재 탭 (미수금/미지급금)

  // 탭 전환
  document.getElementById('receivable-tab-receivable').addEventListener('click', function() {
    currentType = '매출';
    document.querySelectorAll('.receivable-tab').forEach(function(tab) {
      tab.classList.remove('active');
    });
    this.classList.add('active');
    loadReceivableData();
  });

  document.getElementById('receivable-tab-payable').addEventListener('click', function() {
    currentType = '매입';
    document.querySelectorAll('.receivable-tab').forEach(function(tab) {
      tab.classList.remove('active');
    });
    this.classList.add('active');
    loadReceivableData();
  });

  // 조회 버튼
  document.getElementById('receivable-search-btn').addEventListener('click', function() {
    loadReceivableData();
  });

  // 초기화 버튼
  document.getElementById('receivable-reset-btn').addEventListener('click', function() {
    document.getElementById('receivable-company-filter').value = '';
    document.getElementById('receivable-start-date').value = '';
    document.getElementById('receivable-end-date').value = '';
  });

  // 엑셀 다운로드
  document.getElementById('receivable-excel-btn').addEventListener('click', function() {
    // TODO: 엑셀 다운로드 로직
    showToast('엑셀 다운로드 기능은 추후 구현됩니다.');
  });

  // 데이터 로드 함수
  function loadReceivableData() {
    var companyName = document.getElementById('receivable-company-filter').value;
    var startDate = document.getElementById('receivable-start-date').value;
    var endDate = document.getElementById('receivable-end-date').value;

    // 요약 데이터 로드
    google.script.run
      .withSuccessHandler(function(result) {
        if (result && result.success) {
          var data = result.data;
          document.getElementById('summary-total').textContent = '₩' + data.총미수금.toLocaleString();
          document.getElementById('summary-normal').textContent = data.정상건수 + '건';
          document.getElementById('summary-overdue').textContent = data.연체건수 + '건';
        }
      })
      .api_getReceivableSummary({ type: currentType });

    // 에이징 리포트 로드
    google.script.run
      .withSuccessHandler(function(result) {
        if (result && result.success) {
          var aging = result.data;
          document.getElementById('summary-aging').textContent = '₩' + aging['90일 초과'].금액.toLocaleString();
        }
      })
      .api_getAgingReport({ type: currentType });

    // 거래처별 데이터 로드
    google.script.run
      .withSuccessHandler(function(result) {
        if (result && result.success) {
          renderReceivableTable(result.data);
        } else {
          showToast('❌ ' + (result.error || '조회 실패'));
        }
      })
      .withFailureHandler(function(error) {
        showToast('❌ 오류: ' + error.message);
      })
      .api_getReceivableByCompany({
        type: currentType,
        companyName: companyName,
        startDate: startDate,
        endDate: endDate
      });
  }

  // 테이블 렌더링
  function renderReceivableTable(companies) {
    var tbody = document.getElementById('receivable-tbody');
    tbody.innerHTML = '';

    if (companies.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:60px 20px;color:#64748b;">조회된 데이터가 없습니다.</td></tr>';
      return;
    }

    for (var i = 0; i < companies.length; i++) {
      var company = companies[i];

      var tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${company.거래처명}</td>
        <td class="num">₩${company.총청구액.toLocaleString()}</td>
        <td class="num">₩${company.결제완료금액.toLocaleString()}</td>
        <td class="num">₩${company.미수금.toLocaleString()}</td>
        <td class="center">${company.청구서수}건</td>
        <td class="center">${company.정상건수}건</td>
        <td class="center">
          ${company.연체건수 > 0 ? '<span class="overdue-badge">' + company.연체건수 + '건</span>' : '0건'}
        </td>
        <td>${company.최종결제일}</td>
        <td class="center">
          <button class="receivable-btn small" onclick="toggleReceivableDetail(${i})">
            펼치기
          </button>
        </td>
      `;

      tbody.appendChild(tr);

      // 상세 행 추가 (숨김 상태)
      var detailTr = document.createElement('tr');
      detailTr.id = 'receivable-detail-' + i;
      detailTr.className = 'receivable-detail-row';
      detailTr.style.display = 'none';

      var detailHtml = '<td colspan="9"><table class="receivable-detail-table">';
      detailHtml += '<thead><tr><th>청구ID</th><th>청구일</th><th class="num">청구금액</th><th class="num">결제완료</th><th class="num">미수금</th><th>결제예정일</th><th class="center">상태</th></tr></thead>';
      detailHtml += '<tbody>';

      for (var j = 0; j < company.청구서목록.length; j++) {
        var inv = company.청구서목록[j];
        detailHtml += '<tr>';
        detailHtml += '<td>' + inv.청구ID + '</td>';
        detailHtml += '<td>' + inv.청구일 + '</td>';
        detailHtml += '<td class="num">₩' + inv.청구금액.toLocaleString() + '</td>';
        detailHtml += '<td class="num">₩' + inv.결제완료금액.toLocaleString() + '</td>';
        detailHtml += '<td class="num">₩' + inv.미수금.toLocaleString() + '</td>';
        detailHtml += '<td>' + (inv.결제예정일 || '-') + '</td>';
        detailHtml += '<td class="center">';
        if (inv.연체여부) {
          detailHtml += '<span class="overdue-badge">연체</span>';
        } else {
          detailHtml += inv.청구상태;
        }
        detailHtml += '</td>';
        detailHtml += '</tr>';
      }

      detailHtml += '</tbody></table></td>';
      detailTr.innerHTML = detailHtml;

      tbody.appendChild(detailTr);
    }
  }

  // 페이지 로드 시 초기 데이터 로드
  loadReceivableData();
}

/**
 * 거래처 상세 펼치기/접기
 */
function toggleReceivableDetail(index) {
  var detailRow = document.getElementById('receivable-detail-' + index);
  if (detailRow.style.display === 'none') {
    detailRow.style.display = 'table-row';
  } else {
    detailRow.style.display = 'none';
  }
}

// 페이지 라우팅에 추가
if (currentPage === 'receivable') {
  initReceivablePage();
}
```

### 4.2 메인 메뉴에 추가

**CommonScripts.html - 네비게이션 메뉴**:

```html
<div class="sidebar-menu">
  <button class="sidebar-menu-item" data-page="payment">💰 결제 관리</button>
  <button class="sidebar-menu-item" data-page="billing">📋 청구서 관리</button>
  <button class="sidebar-menu-item" data-page="receivable">📊 미수금 관리</button> <!-- ⭐ 신규 추가 -->
  <button class="sidebar-menu-item" data-page="ledger">📖 거래원장</button>
  <button class="sidebar-menu-item" data-page="settlement">📁 마감 관리</button>
</div>
```

---

## 5. 데이터 플로우

### 5.1 미수금 페이지 로드 플로우

```
[사용자]
  ↓ "📊 미수금 관리" 메뉴 클릭
[CommonScripts.html - initReceivablePage()]
  ↓ 3개 API 병렬 호출
[API 1] api_getReceivableSummary({ type: '매출' })
  ↓ 청구DB 조회 → 총미수금, 정상건수, 연체건수 계산
[API 2] api_getAgingReport({ type: '매출' })
  ↓ 청구DB 조회 → 에이징 분류 (0-30일, 31-60일, 61-90일, 90일 초과)
[API 3] api_getReceivableByCompany({ type: '매출' })
  ↓ 청구DB 조회 → 거래처별 집계
[CommonScripts.html]
  ↓ 요약 카드 렌더링
  ↓ 거래처별 테이블 렌더링
[사용자]
  ✅ 미수금 현황 확인
```

### 5.2 거래처 상세 펼치기 플로우

```
[사용자]
  ↓ 거래처 행의 "펼치기" 버튼 클릭
[CommonScripts.html - toggleReceivableDetail()]
  ↓ 해당 거래처의 상세 행 표시 (이미 로드된 데이터)
[사용자]
  ✅ 청구서별 미수금 상세 내역 확인
```

### 5.3 부분 결제 후 미수금 업데이트 플로우

```
[사용자]
  ↓ 결제관리 페이지에서 부분 결제 등록
[PaymentService.js - saveMultiplePayment()]
  ↓ 결제내역 추가
  ↓ 청구DB의 "결제완료금액", "미수금" 업데이트
[청구DB]
  ✅ 미수금 감소
[사용자]
  ↓ 미수금 관리 페이지 새로고침
[ReceivableService.js - getReceivableByCompany()]
  ↓ 업데이트된 미수금 반영
[사용자]
  ✅ 최신 미수금 현황 확인
```

---

## 6. 구현 계획

### 6.1 Day 1: 백엔드 서비스 개발 (4시간)

**작업 내역**:
1. ReceivableService.js 파일 생성
2. `getReceivableSummary()` 함수 구현
3. `getReceivableByCompany()` 함수 구현
4. `getAgingReport()` 함수 구현
5. ApiService.js에 API 엔드포인트 추가
6. 단위 테스트

**검증**:
```javascript
function testReceivableService() {
  // 요약 데이터
  var summary = getReceivableSummary('매출');
  Logger.log(summary);

  // 거래처별 집계
  var companies = getReceivableByCompany('매출', {});
  Logger.log('거래처 수: ' + companies.data.length);

  // 에이징 리포트
  var aging = getAgingReport('매출');
  Logger.log(aging);
}
```

### 6.2 Day 2-3: 프론트엔드 UI 개발 (6시간)

**작업 내역**:
1. Page_ReceivableManagement.html 파일 생성
2. HTML 구조 작성
3. CSS 스타일 작성
4. CommonScripts.html에 `initReceivablePage()` 함수 추가
5. 테이블 렌더링 로직 구현
6. 탭 전환 및 검색 기능 구현

**검증**:
- 페이지 로드 시 요약 카드 정상 표시
- 거래처별 테이블 렌더링 확인
- 상세 펼치기/접기 기능 확인

### 6.3 Day 4: 메뉴 연동 및 테스트 (2시간)

**작업 내역**:
1. 메인 메뉴에 "미수금 관리" 추가
2. 페이지 라우팅 설정
3. 통합 테스트 (부분 결제 → 미수금 업데이트 확인)

**테스트 케이스**:
1. **정상 케이스**:
   - 미수금이 있는 거래처 조회
   - 에이징 리포트 확인
   - 거래처 상세 펼치기
2. **엣지 케이스**:
   - 미수금 0원인 거래처 (완납)
   - 청구서 없는 거래처
3. **오류 케이스**:
   - 청구DB 시트 없을 때

### 6.4 Day 5: 최적화 및 문서화 (1시간)

**작업 내역**:
- 성능 최적화 (대량 데이터 처리 시)
- 사용자 가이드 작성

---

## 7. 일정

| Day | 작업 내용 | 담당 | 시간 |
|-----|----------|------|------|
| Day 1 | 백엔드 서비스 개발 | 개발자 | 4h |
| Day 2-3 | 프론트엔드 UI 개발 | 개발자 | 6h |
| Day 4 | 메뉴 연동 및 테스트 | 개발자 + QA | 2h |
| Day 5 | 최적화 및 문서화 | 개발자 | 1h |
| **Total** | | | **13h (1.6일)** |

---

## 8. 리스크 및 대응

### 8.1 기술 리스크

| 리스크 | 발생 가능성 | 영향도 | 대응 방안 |
|--------|------------|--------|----------|
| 대량 청구서 조회 시 성능 저하 | 중 | 중 | 페이지네이션 또는 청크 로딩 구현 |
| 부분 결제 기능 미구현 시 미수금 계산 불가 | 높음 | 높음 | 부분 결제 기능 우선 구현 필수 |
| 에이징 기준일 혼동 | 낮 | 중 | 청구일 기준 명확히 문서화 |

### 8.2 비즈니스 리스크

| 리스크 | 대응 방안 |
|--------|----------|
| 사용자가 에이징 개념을 이해하지 못함 | 페이지 상단에 에이징 설명 추가 |
| 연체 청구서 관리 프로세스 부재 | 연체 알림 기능과 연동 (명세서 #4) |

---

## 9. 참고자료

### 9.1 회계 용어

- **미수금 (Accounts Receivable)**: 매출 청구서 발행 후 아직 입금되지 않은 금액
- **미지급금 (Accounts Payable)**: 매입 청구서 수령 후 아직 결제하지 않은 금액
- **에이징 (Aging)**: 미수금/미지급금을 경과 기간별로 분류한 리포트
- **연체 (Overdue)**: 결제예정일을 초과한 미결제 금액

### 9.2 기존 코드 참고

- `PaymentService.js`: 결제내역 조회
- `SettlementService.js`: 청구서 조회
- `SPEC_01_부분결제기능.md`: 미수금 컬럼 설계

---

**문서 끝**
