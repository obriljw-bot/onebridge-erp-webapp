# 🎯 GPT 작업 명세서: Settlement 마감 실행 기능 완성

## 📋 목차
1. [프로젝트 개요](#1-프로젝트-개요)
2. [현재 상태 분석](#2-현재-상태-분석)
3. [코드 스타일 & 컨벤션](#3-코드-스타일--컨벤션)
4. [구현할 파일 목록](#4-구현할-파일-목록)
5. [데이터베이스 구조](#5-데이터베이스-구조)
6. [API 명세](#6-api-명세)
7. [서비스 레이어 수정](#7-서비스-레이어-수정)
8. [프론트엔드 구현](#8-프론트엔드-구현)
9. [기존 코드 연결 포인트](#9-기존-코드-연결-포인트)
10. [상태 다이어그램](#10-상태-다이어그램)
11. [에러 처리 시나리오](#11-에러-처리-시나리오)
12. [테스트 체크리스트](#12-테스트-체크리스트)
13. [주의사항 및 함정](#13-주의사항-및-함정)
14. [코드 제출 방법](#14-코드-제출-방법)

---

## 1. 프로젝트 개요

### 1.1 목표

**Settlement(마감) 실행 기능을 완성**하여, 사용자가 매입/매출 데이터를 집계하고 확정 마감할 수 있도록 구현합니다.

### 1.2 핵심 기능

```
사용자 시나리오:

1️⃣ 매입 마감 페이지 접속
2️⃣ 매입처/기간 선택 → "조회" 버튼 클릭
3️⃣ 거래원장에서 데이터 자동 집계 및 표시
4️⃣ 집계 결과 확인 후 선택:
   - "임시저장" (DRAFT) → 나중에 다시 확인 가능
   - "확정" (CONFIRMED) → 마감 실행
5️⃣ 확정 시:
   - 마감DB에 저장
   - 마감상세DB에 품목별 상세 저장
   - 거래원장 상태를 SETTLED로 변경
   - 성공 메시지 표시
6️⃣ "마감 내역" 탭에서 과거 마감 조회 가능
```

### 1.3 기술 스택

- **Backend**: Google Apps Script (JavaScript ES5 스타일)
- **Frontend**: Vanilla JavaScript (ES5+), HTML, CSS
- **Database**: Google Sheets
- **아키텍처**: SSR + Partial SPA

### 1.4 작업 범위

✅ **구현할 것**:
- ApiService.js에 API 래퍼 함수 추가
- SettlementService.js에 거래원장 상태 업데이트 로직 추가
- SettlementService.js에 마감상세DB 저장 로직 추가
- CommonScripts.html에 initPurchaseSettlementPage 함수 구현
- CommonScripts.html에 initSalesSettlementPage 함수 구현

❌ **구현하지 않을 것**:
- Page_PurchaseSettlement.html (이미 완성됨)
- Page_SalesSettlement.html (이미 완성됨)
- SettlementService.js의 기본 집계 로직 (이미 완성됨)
- DBService.js 수정 (필요 없음)

---

## 2. 현재 상태 분석

### 2.1 이미 구현된 것 ✅

#### SettlementService.js
```javascript
// 이미 완성된 함수들:
✅ aggregatePurchaseOrders(params)     // 매입 데이터 집계
✅ aggregateSalesOrders(params)        // 매출 데이터 집계
✅ savePurchaseSettlement(params)      // 매입 마감 저장
✅ saveSalesSettlement(params)         // 매출 마감 저장
✅ getPurchaseSettlements(params)      // 매입 마감 목록
✅ getSalesSettlements(params)         // 매출 마감 목록
✅ getSettlementDetail(params)         // 마감 상세 조회
```

#### Page_PurchaseSettlement.html & Page_SalesSettlement.html
```
✅ HTML 구조 완성
✅ CSS 스타일 완성
✅ 탭 네비게이션 (신규 마감 / 마감 내역)
✅ 검색 바 UI
✅ 요약 카드 UI
✅ 테이블 UI
✅ 액션 버튼 UI (임시저장, 확정, 엑셀 다운로드)
```

### 2.2 미구현 또는 불완전한 것 ❌

#### ApiService.js
```javascript
❌ aggregatePurchaseOrdersApi()       // 래퍼 함수 없음
❌ aggregateSalesOrdersApi()          // 래퍼 함수 없음
❌ savePurchaseSettlementApi()        // 래퍼 함수 없음
❌ saveSalesSettlementApi()           // 래퍼 함수 없음
❌ getPurchaseSettlementsApi()        // 래퍼 함수 없음
❌ getSalesSettlementsApi()           // 래퍼 함수 없음
```

#### SettlementService.js
```javascript
⚠️ savePurchaseSettlement() 함수 내부:
   - 마감DB 저장 ✅
   - 마감상세DB 저장 ❌ (추가 필요)
   - 거래원장 상태 업데이트 ❌ (추가 필요)

⚠️ saveSalesSettlement() 함수 내부:
   - 마감DB 저장 ✅
   - 마감상세DB 저장 ❌ (추가 필요)
   - 거래원장 상태 업데이트 ❌ (추가 필요)
```

#### CommonScripts.html
```javascript
❌ OB.initPurchaseSettlementPage()    // 함수 없음 또는 불완전
❌ OB.initSalesSettlementPage()       // 함수 없음 또는 불완전
```

### 2.3 작업 우선순위

1. **ApiService.js** 수정 (가장 쉬움, 10분)
2. **SettlementService.js** 수정 (중요, 30분)
3. **CommonScripts.html** 구현 (가장 복잡, 1-2시간)

---

## 3. 코드 스타일 & 컨벤션

### 3.1 JavaScript 스타일

```javascript
⚠️ CRITICAL RULES - 반드시 준수!

1. ES5 호환성
   - var 사용 (let/const 금지)
   - function() {} 사용 (화살표 함수 금지)
   - Array.forEach, Array.map, Array.filter는 사용 가능

2. API 래퍼 패턴
   - 모든 클라이언트 호출 함수는 safeReturn() 사용
   - 함수명: xxxApi 패턴

3. 네이밍 컨벤션
   - 함수명: camelCase
   - 상수: UPPER_SNAKE_CASE
   - 변수: camelCase

4. 에러 처리
   - try-catch 필수
   - Logger.log로 디버그 로그
   - { success, data, error } 형식 반환
```

### 3.2 코드 예시

```javascript
// ✅ 좋은 예
function someFeatureApi(params) {
  var result = someFeature(params);
  return safeReturn(result);
}

function someFeature(params) {
  try {
    var data = params.data || {};

    // 로직 구현

    return {
      success: true,
      data: result
    };
  } catch (err) {
    Logger.log('[someFeature Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

// ❌ 나쁜 예
const getData = (params) => {  // ❌ const, 화살표 함수
  let data = [];               // ❌ let
  return data;                 // ❌ safeReturn 없음
};
```

---

## 4. 구현할 파일 목록

### 4.1 수정할 파일

```
📂 Backend
├── ApiService.js          ⭐⭐⭐ (API 래퍼 함수 6개 추가)
└── SettlementService.js   ⭐⭐⭐ (거래원장 상태 업데이트 + 마감상세DB 저장 로직 추가)

📂 Frontend
└── CommonScripts.html     ⭐⭐⭐ (initPurchaseSettlementPage, initSalesSettlementPage 함수 구현)
```

### 4.2 수정하지 않을 파일

```
✅ 그대로 유지:
- DBService.js
- Page_PurchaseSettlement.html
- Page_SalesSettlement.html
- Component_Sidebar.html
- Layout.html
```

---

## 5. 데이터베이스 구조

### 5.1 스프레드시트 정보

```javascript
// SettlementService.js에 이미 정의됨
const OB_SETTLEMENT_SS_ID = '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs';
const OB_ORDER_LEDGER_SHEET = '거래원장';
const OB_PURCHASE_SETTLEMENT_SHEET = '매입마감DB';
const OB_SALES_SETTLEMENT_SHEET = '매출마감DB';
const OB_SETTLEMENT_DETAIL_SHEET = '마감상세DB';
```

### 5.2 거래원장 시트 구조

```
시트명: 거래원장
스프레드시트 ID: 1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs

컬럼 구조:
A: 발주일
B: 발주번호
C: 품목코드
D: 브랜드
E: 매입처
F: 발주처
G: 부가세구분
H: 제품명
I: 발주수량
J: 확정수량
K: 매입가
L: 공급가
M: 매입액 (수식: =J*K)
N: 공급액 (수식: =J*L)
O: 마진액 (수식: =N-M)
P: 마진율 (수식: =O/N)
Q: 생성일시
R: 수정일시
S: 상태 ⭐ (추가 필요: DRAFT / CONFIRMED / SETTLED / INVOICED / PAID)
```

**⚠️ 중요**:
- 거래원장에 "상태" 컬럼이 없을 수 있습니다.
- 없으면 헤더 행에 "상태" 추가하고, 기존 데이터는 "CONFIRMED"로 초기화

### 5.3 매입마감DB 시트 구조

```
시트명: 매입마감DB
위치: 발주통합DB 스프레드시트 내부

컬럼 구조:
A: 마감ID (예: PS-202512-미미라인명동점)
B: 마감유형 (PURCHASE)
C: 매입처
D: 마감기간시작
E: 마감기간종료
F: 마감상태 (DRAFT / CONFIRMED / LOCKED)
G: 총품목수
H: 총발주수량
I: 총확정수량
J: 총매입액
K: 차이수량
L: 비고
M: 생성일시
N: 생성자
O: 확정일시
P: 확정자

⚠️ 시트가 없으면 자동 생성됨 (savePurchaseSettlement 함수에서 처리)
```

### 5.4 매출마감DB 시트 구조

```
시트명: 매출마감DB
위치: 발주통합DB 스프레드시트 내부

컬럼 구조:
A: 마감ID (예: SS-202512-올리브영)
B: 마감유형 (SALES)
C: 발주처
D: 마감기간시작
E: 마감기간종료
F: 마감상태 (DRAFT / CONFIRMED / LOCKED)
G: 총품목수
H: 총발주수량
I: 총확정수량
J: 총공급액
K: 차이수량
L: 비고
M: 생성일시
N: 생성자
O: 확정일시
P: 확정자

⚠️ 시트가 없으면 자동 생성됨 (saveSalesSettlement 함수에서 처리)
```

### 5.5 마감상세DB 시트 구조 ⭐ NEW

```
시트명: 마감상세DB
위치: 발주통합DB 스프레드시트 내부
목적: 마감 시점의 거래 상세 내역을 스냅샷으로 저장

컬럼 구조:
A: 마감ID (매입마감DB 또는 매출마감DB의 마감ID)
B: 발주번호
C: 발주일
D: 품목코드
E: 제품명
F: 브랜드
G: 매입처
H: 발주처
I: 발주수량
J: 확정수량
K: 차이수량
L: 매입가
M: 공급가
N: 매입액
O: 공급액
P: 마진액
Q: 마진율
R: 저장일시

⚠️ 이 시트는 자동 생성 필요!
```

---

## 6. API 명세

### 6.1 ApiService.js에 추가할 함수들

#### 6.1.1 aggregatePurchaseOrdersApi

```javascript
/**
 * 매입 데이터 집계 (클라이언트용 래퍼)
 * @param {Object} params - { supplier, startDate, endDate }
 * @returns {Object} 직렬화된 집계 결과
 */
function aggregatePurchaseOrdersApi(params) {
  var result = aggregatePurchaseOrders(params);
  return safeReturn(result);
}
```

**호출 예시** (클라이언트):
```javascript
google.script.run
  .withSuccessHandler(function(response) {
    if (response.success) {
      console.log('집계 완료:', response.totalItems, '품목');
      console.log('총 매입액:', response.totalPurchaseAmount);
    }
  })
  .aggregatePurchaseOrdersApi({
    supplier: '미미라인 명동점',
    startDate: '2025-12-01',
    endDate: '2025-12-31'
  });
```

#### 6.1.2 aggregateSalesOrdersApi

```javascript
/**
 * 매출 데이터 집계 (클라이언트용 래퍼)
 * @param {Object} params - { buyer, startDate, endDate }
 * @returns {Object} 직렬화된 집계 결과
 */
function aggregateSalesOrdersApi(params) {
  var result = aggregateSalesOrders(params);
  return safeReturn(result);
}
```

#### 6.1.3 savePurchaseSettlementApi

```javascript
/**
 * 매입 마감 저장 (클라이언트용 래퍼)
 * @param {Object} params - { supplier, startDate, endDate, status, notes, items }
 * @returns {Object} 저장 결과
 */
function savePurchaseSettlementApi(params) {
  var result = savePurchaseSettlement(params);
  return safeReturn(result);
}
```

**호출 예시** (클라이언트):
```javascript
google.script.run
  .withSuccessHandler(function(response) {
    if (response.success) {
      alert(response.message); // "임시저장 완료" 또는 "마감 확정 완료"
    }
  })
  .savePurchaseSettlementApi({
    supplier: '미미라인 명동점',
    startDate: '2025-12-01',
    endDate: '2025-12-31',
    status: 'CONFIRMED', // 또는 'DRAFT'
    notes: '',
    items: [...]  // 집계 결과의 items 배열
  });
```

#### 6.1.4 saveSalesSettlementApi

```javascript
/**
 * 매출 마감 저장 (클라이언트용 래퍼)
 * @param {Object} params - { buyer, startDate, endDate, status, notes, items }
 * @returns {Object} 저장 결과
 */
function saveSalesSettlementApi(params) {
  var result = saveSalesSettlement(params);
  return safeReturn(result);
}
```

#### 6.1.5 getPurchaseSettlementsApi

```javascript
/**
 * 매입 마감 목록 조회 (클라이언트용 래퍼)
 * @param {Object} params - 필터 조건 (현재 미사용)
 * @returns {Object} 마감 목록
 */
function getPurchaseSettlementsApi(params) {
  var result = getPurchaseSettlements(params);
  return safeReturn(result);
}
```

#### 6.1.6 getSalesSettlementsApi

```javascript
/**
 * 매출 마감 목록 조회 (클라이언트용 래퍼)
 * @param {Object} params - 필터 조건 (현재 미사용)
 * @returns {Object} 마감 목록
 */
function getSalesSettlementsApi(params) {
  var result = getSalesSettlements(params);
  return safeReturn(result);
}
```

---

## 7. 서비스 레이어 수정

### 7.1 SettlementService.js 수정 사항

#### 7.1.1 savePurchaseSettlement 함수 수정

**위치**: SettlementService.js, 285번째 줄

**현재 코드 (일부)**:
```javascript
function savePurchaseSettlement(params) {
  try {
    // ... 기존 로직 ...

    // 매입마감DB에 저장 (이미 구현됨)
    if (existingRowIndex > 0) {
      sheet.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    return {
      success: true,
      settlementId: settlementId,
      message: status === 'DRAFT' ? '임시저장 완료' : '마감 확정 완료'
    };

  } catch (err) {
    // ...
  }
}
```

**추가할 코드**:

```javascript
function savePurchaseSettlement(params) {
  try {
    var supplier = params.supplier || '';
    var startDate = params.startDate || '';
    var endDate = params.endDate || '';
    var status = params.status || 'DRAFT';
    var notes = params.notes || '';
    var items = params.items || [];

    if (!supplier || !startDate || !endDate) {
      return {
        success: false,
        error: '필수 정보를 입력해주세요.'
      };
    }

    // 마감 ID 생성
    var settlementId = 'PS-' + formatYearMonth(startDate) + '-' + supplier;

    // 집계 데이터 계산
    var totalItems = items.length;
    var totalOrderQty = 0;
    var totalConfirmedQty = 0;
    var totalPurchaseAmount = 0;

    items.forEach(function(item) {
      totalOrderQty += item.orderQty || 0;
      totalConfirmedQty += item.confirmedQty || 0;
      totalPurchaseAmount += item.purchaseAmount || 0;
    });

    var diffQty = totalOrderQty - totalConfirmedQty;

    var now = new Date();
    var user = Session.getActiveUser().getEmail();

    // 매입마감DB 시트에 저장
    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_PURCHASE_SETTLEMENT_SHEET);

    if (!sheet) {
      // 시트가 없으면 생성
      sheet = ss.insertSheet(OB_PURCHASE_SETTLEMENT_SHEET);
      sheet.appendRow([
        '마감ID', '마감유형', '매입처', '마감기간시작', '마감기간종료',
        '마감상태', '총품목수', '총발주수량', '총확정수량', '총매입액',
        '차이수량', '비고', '생성일시', '생성자', '확정일시', '확정자'
      ]);
    }

    // 기존 마감 확인
    var data = sheet.getDataRange().getValues();
    var existingRowIndex = -1;

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === settlementId) {
        existingRowIndex = i + 1;
        break;
      }
    }

    var rowData = [
      settlementId,
      'PURCHASE',
      supplier,
      startDate,
      endDate,
      status,
      totalItems,
      totalOrderQty,
      totalConfirmedQty,
      totalPurchaseAmount,
      diffQty,
      notes,
      now,
      user,
      status === 'CONFIRMED' ? now : '',
      status === 'CONFIRMED' ? user : ''
    ];

    if (existingRowIndex > 0) {
      sheet.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
      Logger.log('[savePurchaseSettlement] 마감 업데이트: ' + settlementId);
    } else {
      sheet.appendRow(rowData);
      Logger.log('[savePurchaseSettlement] 새 마감 생성: ' + settlementId);
    }

    // ============================================================
    // ⭐ 추가 로직 1: 마감상세DB 저장 (확정 시에만)
    // ============================================================
    if (status === 'CONFIRMED' && items.length > 0) {
      saveSettlementDetails_(settlementId, items, 'PURCHASE');
    }

    // ============================================================
    // ⭐ 추가 로직 2: 거래원장 상태 업데이트 (확정 시에만)
    // ============================================================
    if (status === 'CONFIRMED') {
      updateLedgerStatus_(supplier, startDate, endDate, 'SETTLED', 'PURCHASE');
    }

    return {
      success: true,
      settlementId: settlementId,
      message: status === 'DRAFT' ? '임시저장 완료' : '마감 확정 완료'
    };

  } catch (err) {
    Logger.log('[savePurchaseSettlement Error] ' + err.message);
    return {
      success: false,
      error: '저장 중 오류 발생: ' + err.message
    };
  }
}
```

#### 7.1.2 saveSalesSettlement 함수 수정

**위치**: SettlementService.js, 395번째 줄

**추가할 코드**: savePurchaseSettlement와 동일한 패턴으로 수정

```javascript
function saveSalesSettlement(params) {
  try {
    var buyer = params.buyer || '';
    var startDate = params.startDate || '';
    var endDate = params.endDate || '';
    var status = params.status || 'DRAFT';
    var notes = params.notes || '';
    var items = params.items || [];

    if (!buyer || !startDate || !endDate) {
      return {
        success: false,
        error: '필수 정보를 입력해주세요.'
      };
    }

    var settlementId = 'SS-' + formatYearMonth(startDate) + '-' + buyer;

    var totalItems = items.length;
    var totalOrderQty = 0;
    var totalConfirmedQty = 0;
    var totalSupplyAmount = 0;

    items.forEach(function(item) {
      totalOrderQty += item.orderQty || 0;
      totalConfirmedQty += item.confirmedQty || 0;
      totalSupplyAmount += item.supplyAmount || 0;
    });

    var diffQty = totalOrderQty - totalConfirmedQty;

    var now = new Date();
    var user = Session.getActiveUser().getEmail();

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_SALES_SETTLEMENT_SHEET);

    if (!sheet) {
      sheet = ss.insertSheet(OB_SALES_SETTLEMENT_SHEET);
      sheet.appendRow([
        '마감ID', '마감유형', '발주처', '마감기간시작', '마감기간종료',
        '마감상태', '총품목수', '총발주수량', '총확정수량', '총공급액',
        '차이수량', '비고', '생성일시', '생성자', '확정일시', '확정자'
      ]);
    }

    var data = sheet.getDataRange().getValues();
    var existingRowIndex = -1;

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === settlementId) {
        existingRowIndex = i + 1;
        break;
      }
    }

    var rowData = [
      settlementId,
      'SALES',
      buyer,
      startDate,
      endDate,
      status,
      totalItems,
      totalOrderQty,
      totalConfirmedQty,
      totalSupplyAmount,
      diffQty,
      notes,
      now,
      user,
      status === 'CONFIRMED' ? now : '',
      status === 'CONFIRMED' ? user : ''
    ];

    if (existingRowIndex > 0) {
      sheet.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
      Logger.log('[saveSalesSettlement] 마감 업데이트: ' + settlementId);
    } else {
      sheet.appendRow(rowData);
      Logger.log('[saveSalesSettlement] 새 마감 생성: ' + settlementId);
    }

    // ============================================================
    // ⭐ 추가 로직 1: 마감상세DB 저장 (확정 시에만)
    // ============================================================
    if (status === 'CONFIRMED' && items.length > 0) {
      saveSettlementDetails_(settlementId, items, 'SALES');
    }

    // ============================================================
    // ⭐ 추가 로직 2: 거래원장 상태 업데이트 (확정 시에만)
    // ============================================================
    if (status === 'CONFIRMED') {
      updateLedgerStatus_(buyer, startDate, endDate, 'SETTLED', 'SALES');
    }

    return {
      success: true,
      settlementId: settlementId,
      message: status === 'DRAFT' ? '임시저장 완료' : '마감 확정 완료'
    };

  } catch (err) {
    Logger.log('[saveSalesSettlement Error] ' + err.message);
    return {
      success: false,
      error: '저장 중 오류 발생: ' + err.message
    };
  }
}
```

#### 7.1.3 신규 헬퍼 함수 추가

**위치**: SettlementService.js 파일 끝 (1000번째 줄 이후)

##### 함수 1: saveSettlementDetails_

```javascript
/**
 * ============================================================
 * 마감상세DB에 상세 내역 저장
 * ============================================================
 * @param {string} settlementId - 마감ID
 * @param {Array} items - 집계 결과 items 배열
 * @param {string} type - 'PURCHASE' 또는 'SALES'
 * @private
 */
function saveSettlementDetails_(settlementId, items, type) {
  try {
    Logger.log('[saveSettlementDetails_] 시작: ' + settlementId + ', 품목수: ' + items.length);

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_SETTLEMENT_DETAIL_SHEET);

    // 시트가 없으면 생성
    if (!sheet) {
      sheet = ss.insertSheet(OB_SETTLEMENT_DETAIL_SHEET);
      sheet.appendRow([
        '마감ID', '발주번호', '발주일', '품목코드', '제품명', '브랜드',
        '매입처', '발주처', '발주수량', '확정수량', '차이수량',
        '매입가', '공급가', '매입액', '공급액', '마진액', '마진율', '저장일시'
      ]);
      Logger.log('[saveSettlementDetails_] 마감상세DB 시트 생성됨');
    }

    // 기존 마감 상세 삭제 (재저장 시)
    var data = sheet.getDataRange().getValues();
    var rowsToDelete = [];

    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === settlementId) {
        rowsToDelete.push(i + 1); // 시트 행 번호 (1-based)
      }
    }

    // 역순으로 삭제 (인덱스 문제 방지)
    rowsToDelete.forEach(function(rowIndex) {
      sheet.deleteRow(rowIndex);
    });

    if (rowsToDelete.length > 0) {
      Logger.log('[saveSettlementDetails_] 기존 상세 ' + rowsToDelete.length + '건 삭제됨');
    }

    // 새 상세 내역 추가
    var now = new Date();
    var detailRows = [];

    items.forEach(function(item) {
      var purchaseAmount = item.purchaseAmount || (item.confirmedQty * item.buyPrice) || 0;
      var supplyAmount = item.supplyAmount || (item.confirmedQty * item.supplyPrice) || 0;
      var marginAmount = supplyAmount - purchaseAmount;
      var marginRate = purchaseAmount > 0 ? (marginAmount / purchaseAmount) : 0;

      var row = [
        settlementId,
        item.orderCode || '',
        item.orderDate || '',
        item.productCode || '',
        item.productName || '',
        item.brand || '',
        type === 'PURCHASE' ? '' : (item.supplier || ''),  // 매출 마감일 때만
        type === 'PURCHASE' ? (item.buyer || '') : '',      // 매입 마감일 때만
        item.orderQty || 0,
        item.confirmedQty || 0,
        item.diffQty || 0,
        item.buyPrice || 0,
        item.supplyPrice || 0,
        purchaseAmount,
        supplyAmount,
        marginAmount,
        marginRate,
        now
      ];

      detailRows.push(row);
    });

    // 배치로 한 번에 추가 (성능 최적화)
    if (detailRows.length > 0) {
      var startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, detailRows.length, detailRows[0].length).setValues(detailRows);
      Logger.log('[saveSettlementDetails_] 새 상세 ' + detailRows.length + '건 저장 완료');
    }

    return true;

  } catch (err) {
    Logger.log('[saveSettlementDetails_ Error] ' + err.message);
    return false;
  }
}
```

##### 함수 2: updateLedgerStatus_

```javascript
/**
 * ============================================================
 * 거래원장 상태 업데이트
 * ============================================================
 * 마감 확정 시 해당 기간의 거래원장 상태를 SETTLED로 변경
 * @param {string} partner - 매입처 또는 발주처
 * @param {string} startDate - 시작일
 * @param {string} endDate - 종료일
 * @param {string} newStatus - 변경할 상태 (예: 'SETTLED')
 * @param {string} type - 'PURCHASE' 또는 'SALES'
 * @private
 */
function updateLedgerStatus_(partner, startDate, endDate, newStatus, type) {
  try {
    Logger.log('[updateLedgerStatus_] 시작: ' + partner + ', ' + startDate + ' ~ ' + endDate + ', 상태: ' + newStatus);

    var ss = SpreadsheetApp.openById(OB_SETTLEMENT_SS_ID);
    var sheet = ss.getSheetByName(OB_ORDER_LEDGER_SHEET);

    if (!sheet) {
      Logger.log('[updateLedgerStatus_] 거래원장 시트를 찾을 수 없음');
      return false;
    }

    var data = sheet.getDataRange().getValues();
    var header = data[0];

    // 컬럼 인덱스
    var colOrderDate = header.indexOf('발주일');
    var colSupplier = header.indexOf('매입처');
    var colBuyer = header.indexOf('발주처');
    var colStatus = header.indexOf('상태');

    // 상태 컬럼이 없으면 추가
    if (colStatus < 0) {
      Logger.log('[updateLedgerStatus_] 상태 컬럼 없음 → 헤더에 추가');
      sheet.getRange(1, header.length + 1).setValue('상태');
      colStatus = header.length;

      // 기존 데이터는 'CONFIRMED'로 초기화
      var statusValues = [];
      for (var i = 1; i < data.length; i++) {
        statusValues.push(['CONFIRMED']);
      }
      if (statusValues.length > 0) {
        sheet.getRange(2, colStatus + 1, statusValues.length, 1).setValues(statusValues);
        Logger.log('[updateLedgerStatus_] 기존 ' + statusValues.length + '건을 CONFIRMED로 초기화');
      }

      // 헤더 다시 읽기
      data = sheet.getDataRange().getValues();
      header = data[0];
      colStatus = header.indexOf('상태');
    }

    // 날짜 파싱
    var parseDate = function(d) {
      if (!d) return null;
      if (d instanceof Date) return d;
      return new Date(d);
    };

    var start = parseDate(startDate);
    var end = parseDate(endDate);

    // 조건에 맞는 행 업데이트
    var updatedCount = 0;
    var partnerCol = type === 'PURCHASE' ? colSupplier : colBuyer;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      // 거래처 필터
      if (row[partnerCol] !== partner) continue;

      // 날짜 필터
      var orderDate = parseDate(row[colOrderDate]);
      if (!orderDate || orderDate < start || orderDate > end) continue;

      // 상태 업데이트
      sheet.getRange(i + 1, colStatus + 1).setValue(newStatus);
      updatedCount++;
    }

    Logger.log('[updateLedgerStatus_] 거래원장 상태 업데이트 완료: ' + updatedCount + '건');
    return true;

  } catch (err) {
    Logger.log('[updateLedgerStatus_ Error] ' + err.message);
    return false;
  }
}
```

---

## 8. 프론트엔드 구현

### 8.1 CommonScripts.html 추가 코드

**위치**: CommonScripts.html 파일 끝 (다른 initXxxPage 함수들 아래)

#### 8.1.1 OB.initPurchaseSettlementPage 함수

```javascript
/**
 * ===========================================================
 * 매입 마감 페이지 초기화 함수
 * ===========================================================
 */
OB.initPurchaseSettlementPage = function() {
  console.log('🔧 initPurchaseSettlementPage 시작');

  // 중복 초기화 방지
  var mainWrap = document.querySelector('.settlement-wrap');
  if (!mainWrap) {
    console.error('❌ settlement-wrap 요소를 찾을 수 없음');
    return;
  }

  if (mainWrap.dataset.bound === '1') {
    console.log('⭕ 이미 초기화됨');
    return;
  }
  mainWrap.dataset.bound = '1';

  // =========================================================
  // 전역 상태
  // =========================================================
  OB.purchaseSettlementState = {
    currentTab: 'new',
    aggregatedData: null,
    settlements: []
  };

  // =========================================================
  // 탭 전환 이벤트
  // =========================================================
  var tabs = document.querySelectorAll('.settlement-tab');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      var tabName = tab.getAttribute('data-tab');

      // 탭 버튼 활성화
      tabs.forEach(function(t) {
        t.classList.remove('active');
      });
      tab.classList.add('active');

      // 탭 콘텐츠 활성화
      document.getElementById('purchase-settlement-tab-new').classList.toggle('active', tabName === 'new');
      document.getElementById('purchase-settlement-tab-history').classList.toggle('active', tabName === 'history');

      OB.purchaseSettlementState.currentTab = tabName;
    });
  });

  // =========================================================
  // 조회 버튼
  // =========================================================
  var searchBtn = document.getElementById('purchase-settlement-search-btn');
  if (searchBtn) {
    searchBtn.addEventListener('click', function() {
      var supplier = document.getElementById('purchase-settlement-supplier').value.trim();
      var startDate = document.getElementById('purchase-settlement-start-date').value;
      var endDate = document.getElementById('purchase-settlement-end-date').value;

      if (!startDate || !endDate) {
        alert('마감 기간을 선택해주세요.');
        return;
      }

      console.log('📋 매입 마감 조회:', { supplier: supplier || '전체', startDate: startDate, endDate: endDate });

      OB.showLoading('데이터 집계 중...');

      google.script.run
        .withSuccessHandler(function(response) {
          OB.hideLoading();

          if (response.success) {
            OB.purchaseSettlementState.aggregatedData = response;
            renderPurchaseAggregateResult(response);
          } else {
            alert('집계 실패: ' + response.error);
          }
        })
        .withFailureHandler(function(err) {
          OB.hideLoading();
          console.error('집계 오류:', err);
          alert('집계 중 오류가 발생했습니다.');
        })
        .aggregatePurchaseOrdersApi({
          supplier: supplier,
          startDate: startDate,
          endDate: endDate
        });
    });
  }

  // =========================================================
  // 초기화 버튼
  // =========================================================
  var resetBtn = document.getElementById('purchase-settlement-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      document.getElementById('purchase-settlement-supplier').value = '';
      document.getElementById('purchase-settlement-start-date').value = '';
      document.getElementById('purchase-settlement-end-date').value = '';

      // 결과 초기화
      document.getElementById('purchase-settlement-summary').style.display = 'none';
      document.getElementById('purchase-settlement-actions').style.display = 'none';
      document.getElementById('purchase-settlement-tbody').innerHTML =
        '<tr><td colspan="11" class="settlement-empty">' +
        '<div class="settlement-empty-icon">📋</div>' +
        '<div class="settlement-empty-text">매입처와 기간을 선택하여 조회하세요</div>' +
        '</td></tr>';

      OB.purchaseSettlementState.aggregatedData = null;
    });
  }

  // =========================================================
  // 임시저장 버튼
  // =========================================================
  var saveDraftBtn = document.getElementById('purchase-settlement-save-draft-btn');
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', function() {
      savePurchaseSettlement('DRAFT');
    });
  }

  // =========================================================
  // 확정 버튼
  // =========================================================
  var confirmBtn = document.getElementById('purchase-settlement-confirm-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', function() {
      if (!confirm('마감을 확정하시겠습니까?\n\n확정 후에는 거래원장 상태가 SETTLED로 변경되며,\n수정이 불가능합니다.')) {
        return;
      }

      savePurchaseSettlement('CONFIRMED');
    });
  }

  // =========================================================
  // 엑셀 다운로드 버튼
  // =========================================================
  var exportBtn = document.getElementById('purchase-settlement-export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      var data = OB.purchaseSettlementState.aggregatedData;
      if (!data || !data.items) {
        alert('다운로드할 데이터가 없습니다.');
        return;
      }

      exportToCSV(data.items, '매입마감_' + data.supplier + '_' + data.startDate + '.csv');
    });
  }

  // =========================================================
  // 마감 내역 조회 버튼
  // =========================================================
  var loadHistoryBtn = document.getElementById('purchase-settlement-load-history-btn');
  if (loadHistoryBtn) {
    loadHistoryBtn.addEventListener('click', function() {
      OB.showLoading('마감 내역 조회 중...');

      google.script.run
        .withSuccessHandler(function(response) {
          OB.hideLoading();

          if (response.success) {
            OB.purchaseSettlementState.settlements = response.settlements || [];
            renderPurchaseHistoryTable(response.settlements);
          } else {
            alert('조회 실패: ' + response.error);
          }
        })
        .withFailureHandler(function(err) {
          OB.hideLoading();
          console.error('조회 오류:', err);
          alert('조회 중 오류가 발생했습니다.');
        })
        .getPurchaseSettlementsApi({});
    });
  }

  // =========================================================
  // 내부 함수: 집계 결과 렌더링
  // =========================================================
  function renderPurchaseAggregateResult(data) {
    // 요약 카드 표시
    document.getElementById('purchase-settlement-summary').style.display = 'grid';
    document.getElementById('purchase-settlement-total-items').textContent = data.totalItems || 0;
    document.getElementById('purchase-settlement-total-order-qty').textContent = OB.formatNumber(data.totalOrderQty || 0);
    document.getElementById('purchase-settlement-total-confirmed-qty').textContent = OB.formatNumber(data.totalConfirmedQty || 0);
    document.getElementById('purchase-settlement-diff-qty').textContent = OB.formatNumber(data.diffQty || 0);
    document.getElementById('purchase-settlement-total-amount').textContent = '₩' + OB.formatNumber(data.totalPurchaseAmount || 0);

    // 테이블 렌더링
    var tbody = document.getElementById('purchase-settlement-tbody');
    if (!tbody) return;

    if (!data.items || data.items.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="11" class="settlement-empty">' +
        '<div class="settlement-empty-icon">📋</div>' +
        '<div class="settlement-empty-text">데이터가 없습니다</div>' +
        '</td></tr>';
      document.getElementById('purchase-settlement-actions').style.display = 'none';
      return;
    }

    var html = '';
    data.items.forEach(function(item) {
      html += '<tr>';
      html += '<td>' + (item.orderCode || '') + '</td>';
      html += '<td>' + (item.orderDate || '') + '</td>';
      html += '<td>' + (item.buyer || '') + '</td>';
      html += '<td>' + (item.brand || '') + '</td>';
      html += '<td>' + (item.productName || '') + '</td>';
      html += '<td>' + (item.productCode || '') + '</td>';
      html += '<td class="num">' + OB.formatNumber(item.orderQty || 0) + '</td>';
      html += '<td class="num">' + OB.formatNumber(item.confirmedQty || 0) + '</td>';
      html += '<td class="num diff">' + OB.formatNumber(item.diffQty || 0) + '</td>';
      html += '<td class="num">₩' + OB.formatNumber(item.buyPrice || 0) + '</td>';
      html += '<td class="num">₩' + OB.formatNumber(item.purchaseAmount || 0) + '</td>';
      html += '</tr>';
    });

    tbody.innerHTML = html;

    // 액션 버튼 표시
    document.getElementById('purchase-settlement-actions').style.display = 'flex';
  }

  // =========================================================
  // 내부 함수: 마감 내역 테이블 렌더링
  // =========================================================
  function renderPurchaseHistoryTable(settlements) {
    var tbody = document.getElementById('purchase-settlement-history-tbody');
    if (!tbody) return;

    if (!settlements || settlements.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="settlement-empty">' +
        '<div class="settlement-empty-icon">📋</div>' +
        '<div class="settlement-empty-text">마감 내역이 없습니다</div>' +
        '</td></tr>';
      return;
    }

    var html = '';
    settlements.forEach(function(s) {
      html += '<tr>';
      html += '<td>' + s.settlementId + '</td>';
      html += '<td>' + (s.createdAt || '') + '</td>';
      html += '<td>' + s.supplier + '</td>';
      html += '<td>' + s.startDate + ' ~ ' + s.endDate + '</td>';
      html += '<td class="num">' + s.totalItems + '</td>';
      html += '<td class="num">₩' + OB.formatNumber(s.totalPurchaseAmount) + '</td>';
      html += '<td>';

      if (s.status === 'DRAFT') {
        html += '<span class="settlement-status-badge draft">임시저장</span>';
      } else if (s.status === 'CONFIRMED') {
        html += '<span class="settlement-status-badge confirmed">확정</span>';
      }

      html += '</td>';
      html += '<td>';
      html += '<button class="settlement-btn secondary" onclick="OB.viewSettlementDetail(\'' + s.settlementId + '\', \'PURCHASE\')">상세보기</button>';
      html += '</td>';
      html += '</tr>';
    });

    tbody.innerHTML = html;
  }

  // =========================================================
  // 내부 함수: 마감 저장
  // =========================================================
  function savePurchaseSettlement(status) {
    var data = OB.purchaseSettlementState.aggregatedData;
    if (!data) {
      alert('집계 데이터가 없습니다.');
      return;
    }

    var supplier = document.getElementById('purchase-settlement-supplier').value.trim();
    var startDate = document.getElementById('purchase-settlement-start-date').value;
    var endDate = document.getElementById('purchase-settlement-end-date').value;

    OB.showLoading(status === 'DRAFT' ? '임시저장 중...' : '마감 확정 중...');

    google.script.run
      .withSuccessHandler(function(response) {
        OB.hideLoading();

        if (response.success) {
          alert(response.message);

          // 확정 시 초기화
          if (status === 'CONFIRMED') {
            document.getElementById('purchase-settlement-reset-btn').click();
          }
        } else {
          alert('저장 실패: ' + response.error);
        }
      })
      .withFailureHandler(function(err) {
        OB.hideLoading();
        console.error('저장 오류:', err);
        alert('저장 중 오류가 발생했습니다.');
      })
      .savePurchaseSettlementApi({
        supplier: supplier,
        startDate: startDate,
        endDate: endDate,
        status: status,
        notes: '',
        items: data.items
      });
  }

  // =========================================================
  // 내부 함수: CSV 다운로드
  // =========================================================
  function exportToCSV(items, filename) {
    var csv = '발주번호,발주일,발주처,브랜드,제품명,품목코드,발주수량,확정수량,차이,매입가,매입액\n';

    items.forEach(function(item) {
      csv += [
        item.orderCode || '',
        item.orderDate || '',
        item.buyer || '',
        item.brand || '',
        item.productName || '',
        item.productCode || '',
        item.orderQty || 0,
        item.confirmedQty || 0,
        item.diffQty || 0,
        item.buyPrice || 0,
        item.purchaseAmount || 0
      ].join(',') + '\n';
    });

    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  console.log('✅ initPurchaseSettlementPage 완료');
};
```

#### 8.1.2 OB.initSalesSettlementPage 함수

```javascript
/**
 * ===========================================================
 * 매출 마감 페이지 초기화 함수
 * ===========================================================
 */
OB.initSalesSettlementPage = function() {
  console.log('🔧 initSalesSettlementPage 시작');

  // 중복 초기화 방지
  var mainWrap = document.querySelector('.settlement-wrap');
  if (!mainWrap) {
    console.error('❌ settlement-wrap 요소를 찾을 수 없음');
    return;
  }

  if (mainWrap.dataset.bound === '1') {
    console.log('⭕ 이미 초기화됨');
    return;
  }
  mainWrap.dataset.bound = '1';

  // =========================================================
  // 전역 상태
  // =========================================================
  OB.salesSettlementState = {
    currentTab: 'new',
    aggregatedData: null,
    settlements: []
  };

  // =========================================================
  // 탭 전환 이벤트
  // =========================================================
  var tabs = document.querySelectorAll('.settlement-tab');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      var tabName = tab.getAttribute('data-tab');

      tabs.forEach(function(t) {
        t.classList.remove('active');
      });
      tab.classList.add('active');

      document.getElementById('sales-settlement-tab-new').classList.toggle('active', tabName === 'new');
      document.getElementById('sales-settlement-tab-history').classList.toggle('active', tabName === 'history');

      OB.salesSettlementState.currentTab = tabName;
    });
  });

  // =========================================================
  // 조회 버튼
  // =========================================================
  var searchBtn = document.getElementById('sales-settlement-search-btn');
  if (searchBtn) {
    searchBtn.addEventListener('click', function() {
      var buyer = document.getElementById('sales-settlement-buyer').value.trim();
      var startDate = document.getElementById('sales-settlement-start-date').value;
      var endDate = document.getElementById('sales-settlement-end-date').value;

      if (!startDate || !endDate) {
        alert('마감 기간을 선택해주세요.');
        return;
      }

      console.log('📋 매출 마감 조회:', { buyer: buyer || '전체', startDate: startDate, endDate: endDate });

      OB.showLoading('데이터 집계 중...');

      google.script.run
        .withSuccessHandler(function(response) {
          OB.hideLoading();

          if (response.success) {
            OB.salesSettlementState.aggregatedData = response;
            renderSalesAggregateResult(response);
          } else {
            alert('집계 실패: ' + response.error);
          }
        })
        .withFailureHandler(function(err) {
          OB.hideLoading();
          console.error('집계 오류:', err);
          alert('집계 중 오류가 발생했습니다.');
        })
        .aggregateSalesOrdersApi({
          buyer: buyer,
          startDate: startDate,
          endDate: endDate
        });
    });
  }

  // =========================================================
  // 초기화 버튼
  // =========================================================
  var resetBtn = document.getElementById('sales-settlement-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      document.getElementById('sales-settlement-buyer').value = '';
      document.getElementById('sales-settlement-start-date').value = '';
      document.getElementById('sales-settlement-end-date').value = '';

      document.getElementById('sales-settlement-summary').style.display = 'none';
      document.getElementById('sales-settlement-actions').style.display = 'none';
      document.getElementById('sales-settlement-tbody').innerHTML =
        '<tr><td colspan="11" class="settlement-empty">' +
        '<div class="settlement-empty-icon">📋</div>' +
        '<div class="settlement-empty-text">발주처와 기간을 선택하여 조회하세요</div>' +
        '</td></tr>';

      OB.salesSettlementState.aggregatedData = null;
    });
  }

  // =========================================================
  // 임시저장 버튼
  // =========================================================
  var saveDraftBtn = document.getElementById('sales-settlement-save-draft-btn');
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', function() {
      saveSalesSettlement('DRAFT');
    });
  }

  // =========================================================
  // 확정 버튼
  // =========================================================
  var confirmBtn = document.getElementById('sales-settlement-confirm-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', function() {
      if (!confirm('마감을 확정하시겠습니까?\n\n확정 후에는 거래원장 상태가 SETTLED로 변경되며,\n수정이 불가능합니다.')) {
        return;
      }

      saveSalesSettlement('CONFIRMED');
    });
  }

  // =========================================================
  // 엑셀 다운로드 버튼
  // =========================================================
  var exportBtn = document.getElementById('sales-settlement-export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      var data = OB.salesSettlementState.aggregatedData;
      if (!data || !data.items) {
        alert('다운로드할 데이터가 없습니다.');
        return;
      }

      exportToCSV(data.items, '매출마감_' + data.buyer + '_' + data.startDate + '.csv');
    });
  }

  // =========================================================
  // 마감 내역 조회 버튼
  // =========================================================
  var loadHistoryBtn = document.getElementById('sales-settlement-load-history-btn');
  if (loadHistoryBtn) {
    loadHistoryBtn.addEventListener('click', function() {
      OB.showLoading('마감 내역 조회 중...');

      google.script.run
        .withSuccessHandler(function(response) {
          OB.hideLoading();

          if (response.success) {
            OB.salesSettlementState.settlements = response.settlements || [];
            renderSalesHistoryTable(response.settlements);
          } else {
            alert('조회 실패: ' + response.error);
          }
        })
        .withFailureHandler(function(err) {
          OB.hideLoading();
          console.error('조회 오류:', err);
          alert('조회 중 오류가 발생했습니다.');
        })
        .getSalesSettlementsApi({});
    });
  }

  // =========================================================
  // 내부 함수: 집계 결과 렌더링
  // =========================================================
  function renderSalesAggregateResult(data) {
    document.getElementById('sales-settlement-summary').style.display = 'grid';
    document.getElementById('sales-settlement-total-items').textContent = data.totalItems || 0;
    document.getElementById('sales-settlement-total-order-qty').textContent = OB.formatNumber(data.totalOrderQty || 0);
    document.getElementById('sales-settlement-total-confirmed-qty').textContent = OB.formatNumber(data.totalConfirmedQty || 0);
    document.getElementById('sales-settlement-diff-qty').textContent = OB.formatNumber(data.diffQty || 0);
    document.getElementById('sales-settlement-total-amount').textContent = '₩' + OB.formatNumber(data.totalSupplyAmount || 0);

    var tbody = document.getElementById('sales-settlement-tbody');
    if (!tbody) return;

    if (!data.items || data.items.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="11" class="settlement-empty">' +
        '<div class="settlement-empty-icon">📋</div>' +
        '<div class="settlement-empty-text">데이터가 없습니다</div>' +
        '</td></tr>';
      document.getElementById('sales-settlement-actions').style.display = 'none';
      return;
    }

    var html = '';
    data.items.forEach(function(item) {
      html += '<tr>';
      html += '<td>' + (item.orderCode || '') + '</td>';
      html += '<td>' + (item.orderDate || '') + '</td>';
      html += '<td>' + (item.supplier || '') + '</td>';
      html += '<td>' + (item.brand || '') + '</td>';
      html += '<td>' + (item.productName || '') + '</td>';
      html += '<td>' + (item.productCode || '') + '</td>';
      html += '<td class="num">' + OB.formatNumber(item.orderQty || 0) + '</td>';
      html += '<td class="num">' + OB.formatNumber(item.confirmedQty || 0) + '</td>';
      html += '<td class="num diff">' + OB.formatNumber(item.diffQty || 0) + '</td>';
      html += '<td class="num">₩' + OB.formatNumber(item.supplyPrice || 0) + '</td>';
      html += '<td class="num">₩' + OB.formatNumber(item.supplyAmount || 0) + '</td>';
      html += '</tr>';
    });

    tbody.innerHTML = html;
    document.getElementById('sales-settlement-actions').style.display = 'flex';
  }

  // =========================================================
  // 내부 함수: 마감 내역 테이블 렌더링
  // =========================================================
  function renderSalesHistoryTable(settlements) {
    var tbody = document.getElementById('sales-settlement-history-tbody');
    if (!tbody) return;

    if (!settlements || settlements.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="settlement-empty">' +
        '<div class="settlement-empty-icon">📋</div>' +
        '<div class="settlement-empty-text">마감 내역이 없습니다</div>' +
        '</td></tr>';
      return;
    }

    var html = '';
    settlements.forEach(function(s) {
      html += '<tr>';
      html += '<td>' + s.settlementId + '</td>';
      html += '<td>' + (s.createdAt || '') + '</td>';
      html += '<td>' + s.buyer + '</td>';
      html += '<td>' + s.startDate + ' ~ ' + s.endDate + '</td>';
      html += '<td class="num">' + s.totalItems + '</td>';
      html += '<td class="num">₩' + OB.formatNumber(s.totalSupplyAmount) + '</td>';
      html += '<td>';

      if (s.status === 'DRAFT') {
        html += '<span class="settlement-status-badge draft">임시저장</span>';
      } else if (s.status === 'CONFIRMED') {
        html += '<span class="settlement-status-badge confirmed">확정</span>';
      }

      html += '</td>';
      html += '<td>';
      html += '<button class="settlement-btn secondary" onclick="OB.viewSettlementDetail(\'' + s.settlementId + '\', \'SALES\')">상세보기</button>';
      html += '</td>';
      html += '</tr>';
    });

    tbody.innerHTML = html;
  }

  // =========================================================
  // 내부 함수: 마감 저장
  // =========================================================
  function saveSalesSettlement(status) {
    var data = OB.salesSettlementState.aggregatedData;
    if (!data) {
      alert('집계 데이터가 없습니다.');
      return;
    }

    var buyer = document.getElementById('sales-settlement-buyer').value.trim();
    var startDate = document.getElementById('sales-settlement-start-date').value;
    var endDate = document.getElementById('sales-settlement-end-date').value;

    OB.showLoading(status === 'DRAFT' ? '임시저장 중...' : '마감 확정 중...');

    google.script.run
      .withSuccessHandler(function(response) {
        OB.hideLoading();

        if (response.success) {
          alert(response.message);

          if (status === 'CONFIRMED') {
            document.getElementById('sales-settlement-reset-btn').click();
          }
        } else {
          alert('저장 실패: ' + response.error);
        }
      })
      .withFailureHandler(function(err) {
        OB.hideLoading();
        console.error('저장 오류:', err);
        alert('저장 중 오류가 발생했습니다.');
      })
      .saveSalesSettlementApi({
        buyer: buyer,
        startDate: startDate,
        endDate: endDate,
        status: status,
        notes: '',
        items: data.items
      });
  }

  // =========================================================
  // 내부 함수: CSV 다운로드
  // =========================================================
  function exportToCSV(items, filename) {
    var csv = '발주번호,발주일,매입처,브랜드,제품명,품목코드,발주수량,확정수량,차이,공급가,공급액\n';

    items.forEach(function(item) {
      csv += [
        item.orderCode || '',
        item.orderDate || '',
        item.supplier || '',
        item.brand || '',
        item.productName || '',
        item.productCode || '',
        item.orderQty || 0,
        item.confirmedQty || 0,
        item.diffQty || 0,
        item.supplyPrice || 0,
        item.supplyAmount || 0
      ].join(',') + '\n';
    });

    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  console.log('✅ initSalesSettlementPage 완료');
};
```

---

## 9. 기존 코드 연결 포인트

### 9.1 ApiService.js 수정

**위치**: ApiService.js 파일 끝

```javascript
// ============================================================
// Settlement 관련 API (클라이언트용 래퍼)
// ============================================================

function aggregatePurchaseOrdersApi(params) {
  var result = aggregatePurchaseOrders(params);
  return safeReturn(result);
}

function aggregateSalesOrdersApi(params) {
  var result = aggregateSalesOrders(params);
  return safeReturn(result);
}

function savePurchaseSettlementApi(params) {
  var result = savePurchaseSettlement(params);
  return safeReturn(result);
}

function saveSalesSettlementApi(params) {
  var result = saveSalesSettlement(params);
  return safeReturn(result);
}

function getPurchaseSettlementsApi(params) {
  var result = getPurchaseSettlements(params);
  return safeReturn(result);
}

function getSalesSettlementsApi(params) {
  var result = getSalesSettlements(params);
  return safeReturn(result);
}
```

### 9.2 Page_SalesSettlement.html 수정

**현재 Page_PurchaseSettlement.html과 거의 동일하지만 ID만 다름**

모든 ID를 `purchase-`에서 `sales-`로 변경:
- `purchase-settlement-buyer` → `sales-settlement-buyer`
- `purchase-settlement-start-date` → `sales-settlement-start-date`
- 등등...

**⚠️ 주의**: Page_SalesSettlement.html 파일이 없거나 불완전하면, Page_PurchaseSettlement.html을 복사해서 모든 `purchase` 문자열을 `sales`로 전체 치환하세요!

---

## 10. 상태 다이어그램

### 10.1 마감 상태 흐름

```
┌─────────────┐
│   (없음)    │ 초기 상태
└──────┬──────┘
       │ 사용자: 임시저장 클릭
       ↓
┌─────────────┐
│    DRAFT    │ 임시저장 상태
└──────┬──────┘   - 마감DB에 저장됨
       │          - 마감상세DB 저장 안됨
       │          - 거래원장 상태 변경 안됨
       │
       │ 사용자: 확정 클릭
       ↓
┌─────────────┐
│  CONFIRMED  │ 확정 상태
└──────┬──────┘   - 마감DB 업데이트
       │          - 마감상세DB 저장됨 ⭐
       │          - 거래원장 상태 → SETTLED ⭐
       │
       │ 월별 마감 실행
       ↓
┌─────────────┐
│   LOCKED    │ 잠금 상태
└─────────────┘   - 월별 마감 완료
                  - 수정 불가
```

### 10.2 거래원장 상태 흐름

```
┌─────────────┐
│    DRAFT    │ 발주 입력 직후
└──────┬──────┘
       │
       │ 확정수량 수정 완료
       ↓
┌─────────────┐
│  CONFIRMED  │ 확정 완료
└──────┬──────┘
       │
       │ Settlement 확정 실행
       ↓
┌─────────────┐
│   SETTLED   │ 마감 완료 ⭐
└──────┬──────┘   - 수정 불가
       │          - 청구서 생성 가능
       │
       │ 청구서 생성
       ↓
┌─────────────┐
│  INVOICED   │ 청구서 발행
└──────┬──────┘
       │
       │ 결제 완료
       ↓
┌─────────────┐
│    PAID     │ 결제 완료
└─────────────┘
```

---

## 11. 에러 처리 시나리오

### 11.1 필수 입력 누락

**시나리오**: 사용자가 기간을 선택하지 않고 조회 버튼 클릭

**처리**:
```javascript
if (!startDate || !endDate) {
  alert('마감 기간을 선택해주세요.');
  return;
}
```

### 11.2 집계 데이터 없음

**시나리오**: 조회 결과가 0건

**처리**:
```javascript
if (!data.items || data.items.length === 0) {
  tbody.innerHTML =
    '<tr><td colspan="11" class="settlement-empty">' +
    '<div class="settlement-empty-icon">📋</div>' +
    '<div class="settlement-empty-text">데이터가 없습니다</div>' +
    '</td></tr>';
  document.getElementById('purchase-settlement-actions').style.display = 'none';
  return;
}
```

### 11.3 서버 오류

**시나리오**: API 호출 실패

**처리**:
```javascript
.withFailureHandler(function(err) {
  OB.hideLoading();
  console.error('집계 오류:', err);
  alert('집계 중 오류가 발생했습니다.');
})
```

### 11.4 거래원장 상태 컬럼 없음

**시나리오**: 거래원장 시트에 "상태" 컬럼이 없음

**처리**: updateLedgerStatus_ 함수에서 자동 생성
```javascript
if (colStatus < 0) {
  Logger.log('[updateLedgerStatus_] 상태 컬럼 없음 → 헤더에 추가');
  sheet.getRange(1, header.length + 1).setValue('상태');
  colStatus = header.length;

  // 기존 데이터는 'CONFIRMED'로 초기화
  // ...
}
```

### 11.5 중복 마감

**시나리오**: 같은 매입처, 같은 기간에 대해 마감 재실행

**처리**: 기존 마감 업데이트 (덮어쓰기)
```javascript
if (existingRowIndex > 0) {
  sheet.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
  Logger.log('[savePurchaseSettlement] 마감 업데이트: ' + settlementId);
} else {
  sheet.appendRow(rowData);
  Logger.log('[savePurchaseSettlement] 새 마감 생성: ' + settlementId);
}
```

---

## 12. 테스트 체크리스트

### 12.1 기본 기능 테스트

```
□ 1. 매입 마감 페이지 접속
  □ 페이지가 정상적으로 로드됨
  □ 콘솔에 "✅ initPurchaseSettlementPage 완료" 로그 확인

□ 2. 매입 데이터 집계
  □ 매입처 입력 (예: "미미라인 명동점")
  □ 기간 선택 (예: 2025-12-01 ~ 2025-12-31)
  □ "조회" 버튼 클릭
  □ 로딩 표시됨
  □ 요약 카드에 집계 결과 표시됨
  □ 테이블에 품목별 상세 표시됨
  □ 액션 버튼 (임시저장, 확정, 엑셀 다운로드) 표시됨

□ 3. 임시저장
  □ "임시저장" 버튼 클릭
  □ "임시저장 완료" 메시지 표시
  □ 매입마감DB 시트에 DRAFT 상태로 저장 확인
  □ 거래원장 상태 변경 안됨 확인 (그대로 유지)
  □ 마감상세DB에 저장 안됨 확인

□ 4. 마감 확정
  □ 다시 조회
  □ "확정" 버튼 클릭
  □ 확인 다이얼로그 표시
  □ "확인" 클릭
  □ "마감 확정 완료" 메시지 표시
  □ 매입마감DB 시트에 CONFIRMED 상태로 업데이트 확인
  □ 마감상세DB 시트에 품목별 상세 저장 확인
  □ 거래원장 시트에서 해당 거래들의 상태가 SETTLED로 변경 확인
  □ 화면 초기화됨 (조회 폼이 비워짐)

□ 5. 마감 내역 조회
  □ "마감 내역" 탭 클릭
  □ "마감 내역 조회" 버튼 클릭
  □ 테이블에 마감 목록 표시됨
  □ 마감ID, 매입처, 기간, 총액, 상태 확인
  □ "상세보기" 버튼 클릭
  □ 마감 상세 모달 표시됨 (OB.viewSettlementDetail 함수 호출)

□ 6. 엑셀 다운로드
  □ 조회 후 "엑셀 다운로드" 버튼 클릭
  □ CSV 파일 다운로드됨
  □ 파일 열어서 데이터 확인

□ 7. 매출 마감 페이지
  □ 매출 마감 페이지 접속
  □ 위 1-6 과정 반복 (발주처 기준으로)
  □ 모든 기능 정상 작동 확인
```

### 12.2 에러 케이스 테스트

```
□ 1. 필수 입력 누락
  □ 기간 없이 조회 → "마감 기간을 선택해주세요" 메시지

□ 2. 집계 결과 없음
  □ 데이터 없는 기간 조회 → "데이터가 없습니다" 표시

□ 3. 중복 마감
  □ 같은 조건으로 두 번 확정 → 기존 마감 업데이트 확인

□ 4. 거래원장 상태 컬럼 없음
  □ 상태 컬럼 삭제 후 마감 확정 → 자동으로 컬럼 생성 확인
```

### 12.3 데이터 검증

```
□ 1. 매입마감DB 시트
  □ 마감ID 형식: PS-202512-미미라인명동점
  □ 마감유형: PURCHASE
  □ 상태: DRAFT 또는 CONFIRMED
  □ 총품목수, 총매입액 등 집계 값 정확

□ 2. 마감상세DB 시트
  □ 시트 존재 확인
  □ 마감ID와 발주번호, 품목별 상세 데이터 저장 확인
  □ 확정 시에만 저장됨 (DRAFT 시 저장 안됨)

□ 3. 거래원장 시트
  □ 상태 컬럼 존재 확인
  □ 마감 확정한 거래들이 SETTLED 상태로 변경 확인
  □ 다른 거래들은 영향 받지 않음 확인
```

---

## 13. 주의사항 및 함정

### 13.1 🔴 반드시 주의할 것

#### 1. var 사용 (let/const 금지)
```javascript
// ❌ 잘못된 코드
const supplier = params.supplier;
let items = [];

// ✅ 올바른 코드
var supplier = params.supplier;
var items = [];
```

#### 2. 화살표 함수 금지
```javascript
// ❌ 잘못된 코드
items.forEach((item) => {
  console.log(item);
});

// ✅ 올바른 코드
items.forEach(function(item) {
  console.log(item);
});
```

#### 3. safeReturn 필수
```javascript
// ❌ 잘못된 코드
function someApi(params) {
  var result = someLogic(params);
  return result;  // Date 객체 포함 시 null 반환됨!
}

// ✅ 올바른 코드
function someApi(params) {
  var result = someLogic(params);
  return safeReturn(result);
}
```

#### 4. Page_SalesSettlement.html ID 변경
```html
<!-- ❌ 잘못: purchase- ID 그대로 -->
<input id="purchase-settlement-buyer">

<!-- ✅ 올바름: sales- ID로 변경 -->
<input id="sales-settlement-buyer">
```

#### 5. 거래원장 상태 컬럼 체크
```javascript
// 반드시 컬럼 존재 여부 확인 후 사용
var colStatus = header.indexOf('상태');
if (colStatus < 0) {
  // 컬럼 생성 로직
}
```

### 13.2 ⚠️ 자주 하는 실수

#### 1. getElementById 반환값 체크 안함
```javascript
// ❌ 위험한 코드
var btn = document.getElementById('some-btn');
btn.addEventListener('click', ...);  // btn이 null이면 에러!

// ✅ 안전한 코드
var btn = document.getElementById('some-btn');
if (btn) {
  btn.addEventListener('click', ...);
}
```

#### 2. 중복 초기화 방지 안함
```javascript
// ❌ 중복 초기화 발생 가능
OB.initPurchaseSettlementPage = function() {
  // 이벤트 리스너 추가
};

// ✅ 중복 초기화 방지
OB.initPurchaseSettlementPage = function() {
  if (mainWrap.dataset.bound === '1') {
    return;
  }
  mainWrap.dataset.bound = '1';
  // 이벤트 리스너 추가
};
```

#### 3. 날짜 형식 불일치
```javascript
// 거래원장의 발주일은 Date 객체일 수도, 문자열일 수도 있음
var parseDate = function(d) {
  if (!d) return null;
  if (d instanceof Date) return d;
  return new Date(d);
};
```

### 13.3 🐛 디버깅 팁

#### 1. 콘솔 로그 활용
```javascript
console.log('📋 매입 마감 조회:', { supplier: supplier, startDate: startDate });
Logger.log('[savePurchaseSettlement] 마감 생성: ' + settlementId);
```

#### 2. Apps Script 에디터에서 직접 실행
```javascript
// 함수 직접 실행해서 로그 확인
function testAggregation() {
  var result = aggregatePurchaseOrders({
    supplier: '미미라인 명동점',
    startDate: '2025-12-01',
    endDate: '2025-12-31'
  });

  Logger.log('결과: ' + JSON.stringify(result));
}
```

#### 3. 시트 확인
- 매입마감DB 시트: 마감 저장 확인
- 마감상세DB 시트: 상세 저장 확인
- 거래원장 시트: 상태 업데이트 확인

---

## 14. 코드 제출 방법

### 14.1 제출 파일

```
📁 settlement-execution-implementation/
├── ApiService.js.patch           (추가할 코드만)
├── SettlementService.js.patch    (수정 및 추가 코드)
├── CommonScripts.html.patch      (추가할 코드만)
└── Page_SalesSettlement.html     (전체 파일, Page_PurchaseSettlement.html 기반)
```

### 14.2 제출 형식

#### ApiService.js.patch
```javascript
// ============================================================
// ✅ ApiService.js 파일 끝에 아래 코드를 추가하세요
// ============================================================

/**
 * Settlement 관련 API (클라이언트용 래퍼)
 */
function aggregatePurchaseOrdersApi(params) {
  var result = aggregatePurchaseOrders(params);
  return safeReturn(result);
}

// ... 나머지 함수들
```

#### SettlementService.js.patch
```javascript
// ============================================================
// ✅ SettlementService.js 수정 사항
// ============================================================

// 1. savePurchaseSettlement 함수 수정
// 위치: 285번째 줄 근처, 기존 return 문 위에 추가
// 추가할 코드:

    // 마감상세DB 저장 (확정 시에만)
    if (status === 'CONFIRMED' && items.length > 0) {
      saveSettlementDetails_(settlementId, items, 'PURCHASE');
    }

    // 거래원장 상태 업데이트 (확정 시에만)
    if (status === 'CONFIRMED') {
      updateLedgerStatus_(supplier, startDate, endDate, 'SETTLED', 'PURCHASE');
    }

// 2. saveSalesSettlement 함수 수정
// 위치: 395번째 줄 근처, 기존 return 문 위에 추가
// (위와 동일한 패턴)

// 3. 새 함수 추가
// 위치: 파일 끝 (1000번째 줄 이후)

function saveSettlementDetails_(settlementId, items, type) {
  // ... 전체 코드
}

function updateLedgerStatus_(partner, startDate, endDate, newStatus, type) {
  // ... 전체 코드
}
```

#### CommonScripts.html.patch
```javascript
// ============================================================
// ✅ CommonScripts.html 파일 끝에 아래 코드를 추가하세요
// ============================================================

/**
 * 매입 마감 페이지 초기화 함수
 */
OB.initPurchaseSettlementPage = function() {
  // ... 전체 코드 (약 500줄)
};

/**
 * 매출 마감 페이지 초기화 함수
 */
OB.initSalesSettlementPage = function() {
  // ... 전체 코드 (약 500줄)
};
```

### 14.3 Claude에게 전달하기

```
제목: Settlement 마감 실행 기능 구현 완료

안녕하세요!

Settlement 마감 실행 기능을 구현했습니다.

[수정한 파일]
1. ApiService.js - API 래퍼 6개 추가
2. SettlementService.js - 마감상세 저장 + 거래원장 상태 업데이트 로직 추가
3. CommonScripts.html - initPurchaseSettlementPage, initSalesSettlementPage 함수 추가
4. Page_SalesSettlement.html - Page_PurchaseSettlement.html 기반으로 생성

[테스트 결과]
✅ 매입 마감 조회 정상 작동
✅ 임시저장 정상 작동
✅ 확정 정상 작동 (마감DB, 마감상세DB, 거래원장 상태 모두 업데이트 확인)
✅ 마감 내역 조회 정상 작동
✅ 엑셀 다운로드 정상 작동
✅ 매출 마감 동일하게 정상 작동

[알려진 이슈]
- 없음

코드 검토 부탁드립니다!
```

---

## 15. 최종 체크리스트

작업 완료 후 반드시 확인:

```
코드 품질:
□ ES5 문법 준수 (var, function)
□ safeReturn 적용
□ 에러 처리 구현 (try-catch)
□ Logger.log 추가
□ 주석 작성

기능 테스트:
□ 매입 마감 조회
□ 매입 마감 임시저장
□ 매입 마감 확정
□ 매입 마감 내역 조회
□ 매출 마감 (위와 동일)
□ 엑셀 다운로드

데이터 검증:
□ 매입마감DB 저장 확인
□ 마감상세DB 저장 확인
□ 거래원장 상태 업데이트 확인

문서화:
□ 구현 내용 정리
□ 테스트 결과 기록
□ 알려진 이슈 기록
```

---

**작업 시작 전에 이 명세서를 처음부터 끝까지 읽어주세요!**

**질문이 있으면 Claude에게 문의하세요.**

**행운을 빕니다! 🚀**
