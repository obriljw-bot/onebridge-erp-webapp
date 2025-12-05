# 🎯 GPT 작업 명세서: Master Data 관리 페이지 구현

## 📋 목차
1. [프로젝트 개요](#1-프로젝트-개요)
2. [코드 스타일 & 컨벤션](#2-코드-스타일--컨벤션)
3. [구현할 파일 목록](#3-구현할-파일-목록)
4. [데이터베이스 구조](#4-데이터베이스-구조)
5. [API 명세](#5-api-명세)
6. [서비스 레이어 구현](#6-서비스-레이어-구현)
7. [프론트엔드 구현](#7-프론트엔드-구현)
8. [기존 코드 연결 포인트](#8-기존-코드-연결-포인트)
9. [테스트 방법](#9-테스트-방법)
10. [코드 제출 방법](#10-코드-제출-방법)

---

## 1. 프로젝트 개요

### 1.1 목표
OneBridge ERP의 **기초데이터 관리 페이지** 구현:
- 거래처 관리 (CRUD)
- 품목 관리 (CRUD)
- 브랜드 관리 (CRUD)

### 1.2 기술 스택
- **Backend**: Google Apps Script (JavaScript ES5 스타일)
- **Frontend**: Vanilla JavaScript (ES5+), HTML, CSS
- **Database**: Google Sheets
- **아키텍처**: SSR + Partial SPA

### 1.3 핵심 원칙
```
⚠️ CRITICAL RULES - 반드시 준수할 것!

1. SPA 아키텍처 준수
   ❌ Page_*.html에 <script> 태그 금지
   ✅ 모든 JavaScript는 CommonScripts.html에 작성

2. API 래퍼 패턴
   ✅ 모든 클라이언트 호출 함수는 safeReturn() 사용

3. 네이밍 컨벤션
   - 함수명: camelCase
   - 상수: UPPER_SNAKE_CASE
   - 파일명: PascalCase (서비스), kebab-case (페이지)

4. ES5 호환성
   - var 사용 (let/const 금지)
   - 화살표 함수 금지 (function() {} 사용)
   - Array.map/filter 등은 사용 가능
```

---

## 2. 코드 스타일 & 컨벤션

### 2.1 JavaScript 스타일

```javascript
// ✅ 좋은 예
function getMasterDataApi(params) {
  var result = getMasterData(params);
  return safeReturn(result);
}

function getMasterData(params) {
  try {
    var type = params.type || 'supplier';
    var data = [];

    // 로직 구현

    return {
      success: true,
      data: data,
      total: data.length
    };
  } catch (err) {
    Logger.log('[getMasterData Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

// ❌ 나쁜 예
const getData = (params) => {  // ❌ const, 화살표 함수 금지
  let data = [];                // ❌ let 금지
  return data;                  // ❌ safeReturn 없음
};
```

### 2.2 HTML/CSS 스타일

```html
<!-- ✅ 좋은 예: Page_MasterData.html -->
<style>
.masterdata-wrap{padding:20px;}
.masterdata-header h1{
  font-size:24px;
  font-weight:700;
  color:#1e293b;
}
</style>

<div class="masterdata-wrap">
  <div class="masterdata-header">
    <h1>기초데이터 관리</h1>
    <p>거래처, 품목, 브랜드 정보를 관리합니다.</p>
  </div>
  <!-- ❌ <script> 태그 금지! -->
</div>
```

### 2.3 에러 처리 패턴

```javascript
// 모든 함수는 { success, data, error } 형식 반환
function someFunction(params) {
  try {
    // ... 로직
    return {
      success: true,
      data: result
    };
  } catch (err) {
    Logger.log('[someFunction Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}
```

---

## 3. 구현할 파일 목록

### 3.1 새로 생성할 파일
```
📁 /
├── MasterDataService.js        (신규) - 비즈니스 로직
└── Page_MasterData.html        (신규) - UI
```

### 3.2 수정할 기존 파일
```
📁 /
├── ApiService.js               (수정) - API 래퍼 추가
├── CommonScripts.html          (수정) - 초기화 함수 추가
├── Component_Sidebar.html      (수정) - 메뉴 항목 추가
└── WebApp.js                   (수정 - 선택사항)
```

---

## 4. 데이터베이스 구조

### 4.1 스프레드시트 정보
```javascript
// DBService.js에 정의된 상수
var ERP_CONFIG = {
  BASE_DATA_SHEET_ID: '1vjAjykSQGK2DnFXvmQcH2zuI8WbOvAq_smqvW8u_bao'
};
```

### 4.2 거래처DB 시트 구조
```
스프레드시트 ID: 1vjAjykSQGK2DnFXvmQcH2zuI8WbOvAq_smqvW8u_bao
시트명: 거래처DB

컬럼 구조 (예상):
- A: 거래처코드
- B: 거래처명
- C: 브랜드명
- D: 브랜드코드
- E: 사업자번호
- F: 대표자명
- G: 연락처
- H: 이메일
- I: 주소
- J: 주거래처 (예: "발주처", "매입처", "발주처,매입처")
- K: 비고

⚠️ 주의: 실제 컬럼 구조는 시트를 직접 확인하여 정확히 파악할 것!
```

### 4.3 품목DB 시트 구조
```
시트명: 품목DB

컬럼 구조 (예상):
- A: 품목코드 (바코드)
- B: 제품명
- C: 브랜드
- D: 카테고리
- E: 매입가
- F: 공급가
- G: 소비자가
- H: 재고수량
- I: 안전재고
- J: 단위
- K: 비고

⚠️ 주의: 실제 컬럼 구조는 시트를 직접 확인하여 정확히 파악할 것!
```

### 4.4 브랜드DB 시트 구조
```
시트명: 브랜드DB (존재하지 않을 수 있음)

만약 없다면, 거래처DB의 브랜드 정보를 활용하거나
새로 생성할 수 있습니다.

컬럼 구조 (제안):
- A: 브랜드코드
- B: 브랜드명
- C: 주거래처 (매입처명)
- D: 비고
```

---

## 5. API 명세

### 5.1 추가할 API 함수 (ApiService.js)

```javascript
/**
 * ============================================================
 * Master Data 관리 API (클라이언트용 래퍼)
 * ============================================================
 */

/**
 * 기초데이터 목록 조회
 * @param {Object} params - { type: 'supplier'|'product'|'brand' }
 */
function getMasterDataListApi(params) {
  var result = getMasterDataList(params);
  return safeReturn(result);
}

/**
 * 기초데이터 단건 조회
 * @param {Object} params - { type: 'supplier'|'product'|'brand', id: '...' }
 */
function getMasterDataItemApi(params) {
  var result = getMasterDataItem(params);
  return safeReturn(result);
}

/**
 * 기초데이터 생성
 * @param {Object} params - { type: '...', data: {...} }
 */
function createMasterDataApi(params) {
  var result = createMasterData(params);
  return safeReturn(result);
}

/**
 * 기초데이터 수정
 * @param {Object} params - { type: '...', id: '...', data: {...} }
 */
function updateMasterDataApi(params) {
  var result = updateMasterData(params);
  return safeReturn(result);
}

/**
 * 기초데이터 삭제
 * @param {Object} params - { type: '...', id: '...' }
 */
function deleteMasterDataApi(params) {
  var result = deleteMasterData(params);
  return safeReturn(result);
}
```

### 5.2 API 호출 예시 (프론트엔드)

```javascript
// 거래처 목록 조회
google.script.run
  .withSuccessHandler(function(response) {
    if (response.success) {
      console.log('거래처 목록:', response.data);
    }
  })
  .withFailureHandler(function(err) {
    console.error('API 오류:', err);
  })
  .getMasterDataListApi({ type: 'supplier' });

// 품목 생성
google.script.run
  .withSuccessHandler(function(response) {
    if (response.success) {
      alert('품목이 생성되었습니다.');
    }
  })
  .createMasterDataApi({
    type: 'product',
    data: {
      품목코드: 'P12345',
      제품명: '테스트 상품',
      브랜드: '테스트브랜드',
      매입가: 10000,
      공급가: 15000
    }
  });
```

---

## 6. 서비스 레이어 구현

### 6.1 MasterDataService.js 전체 구조

```javascript
/**
 * ============================================================
 * MasterDataService.js - 기초데이터 관리 비즈니스 로직
 * ============================================================
 * 거래처, 품목, 브랜드 CRUD 기능 구현
 * ============================================================
 */

// ====== 스프레드시트 ID / 시트명 상수 ======
var OB_MASTER_DATA_SS_ID = '1vjAjykSQGK2DnFXvmQcH2zuI8WbOvAq_smqvW8u_bao';
var OB_SUPPLIER_SHEET = '거래처DB';
var OB_PRODUCT_SHEET = '품목DB';
var OB_BRAND_SHEET = '브랜드DB';  // 없으면 생성 또는 거래처DB 활용

/**
 * ============================================================
 * 1. 기초데이터 조회
 * ============================================================
 */

/**
 * 기초데이터 목록 조회
 * @param {Object} params - { type: 'supplier'|'product'|'brand' }
 * @returns {Object} { success, data, total }
 */
function getMasterDataList(params) {
  try {
    var type = params.type || 'supplier';
    var sheetName = getSheetNameByType(type);

    var ss = SpreadsheetApp.openById(OB_MASTER_DATA_SS_ID);
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return {
        success: false,
        error: '시트를 찾을 수 없습니다: ' + sheetName
      };
    }

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return {
        success: true,
        data: [],
        total: 0
      };
    }

    var header = data[0];
    var rows = data.slice(1);

    // 배열을 객체로 변환
    var items = rows.map(function(row) {
      var obj = { _rowIndex: rows.indexOf(row) + 2 }; // 시트 행 번호
      header.forEach(function(col, idx) {
        obj[col] = row[idx];
      });
      return obj;
    });

    return {
      success: true,
      data: items,
      total: items.length
    };

  } catch (err) {
    Logger.log('[getMasterDataList Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * 기초데이터 단건 조회
 * @param {Object} params - { type: '...', id: '...' }
 * @returns {Object} { success, data }
 */
function getMasterDataItem(params) {
  try {
    var type = params.type;
    var id = params.id;

    var listResult = getMasterDataList({ type: type });
    if (!listResult.success) {
      return listResult;
    }

    // ID는 첫 번째 컬럼 (거래처코드, 품목코드 등)
    var item = listResult.data.find(function(item) {
      var firstKey = Object.keys(item)[1]; // _rowIndex 제외
      return String(item[firstKey]) === String(id);
    });

    if (!item) {
      return {
        success: false,
        error: '데이터를 찾을 수 없습니다: ' + id
      };
    }

    return {
      success: true,
      data: item
    };

  } catch (err) {
    Logger.log('[getMasterDataItem Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * ============================================================
 * 2. 기초데이터 생성
 * ============================================================
 */

/**
 * 기초데이터 생성
 * @param {Object} params - { type: '...', data: {...} }
 * @returns {Object} { success }
 */
function createMasterData(params) {
  try {
    var type = params.type;
    var data = params.data;

    var sheetName = getSheetNameByType(type);
    var ss = SpreadsheetApp.openById(OB_MASTER_DATA_SS_ID);
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return {
        success: false,
        error: '시트를 찾을 수 없습니다: ' + sheetName
      };
    }

    var sheetData = sheet.getDataRange().getValues();
    var header = sheetData[0];

    // 헤더 순서대로 값 배열 생성
    var newRow = header.map(function(col) {
      return data[col] || '';
    });

    // 마지막 행에 추가
    sheet.appendRow(newRow);

    return {
      success: true,
      message: '데이터가 생성되었습니다.'
    };

  } catch (err) {
    Logger.log('[createMasterData Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * ============================================================
 * 3. 기초데이터 수정
 * ============================================================
 */

/**
 * 기초데이터 수정
 * @param {Object} params - { type: '...', id: '...', data: {...} }
 * @returns {Object} { success }
 */
function updateMasterData(params) {
  try {
    var type = params.type;
    var id = params.id;
    var data = params.data;

    var sheetName = getSheetNameByType(type);
    var ss = SpreadsheetApp.openById(OB_MASTER_DATA_SS_ID);
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return {
        success: false,
        error: '시트를 찾을 수 없습니다: ' + sheetName
      };
    }

    var sheetData = sheet.getDataRange().getValues();
    var header = sheetData[0];
    var rows = sheetData.slice(1);

    // ID로 행 찾기 (첫 번째 컬럼)
    var targetRowIndex = -1;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === String(id)) {
        targetRowIndex = i + 2; // 시트 행 번호 (1-based + header)
        break;
      }
    }

    if (targetRowIndex === -1) {
      return {
        success: false,
        error: '데이터를 찾을 수 없습니다: ' + id
      };
    }

    // 각 컬럼별로 업데이트
    header.forEach(function(col, idx) {
      if (data.hasOwnProperty(col)) {
        sheet.getRange(targetRowIndex, idx + 1).setValue(data[col]);
      }
    });

    return {
      success: true,
      message: '데이터가 수정되었습니다.'
    };

  } catch (err) {
    Logger.log('[updateMasterData Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * ============================================================
 * 4. 기초데이터 삭제
 * ============================================================
 */

/**
 * 기초데이터 삭제
 * @param {Object} params - { type: '...', id: '...' }
 * @returns {Object} { success }
 */
function deleteMasterData(params) {
  try {
    var type = params.type;
    var id = params.id;

    var sheetName = getSheetNameByType(type);
    var ss = SpreadsheetApp.openById(OB_MASTER_DATA_SS_ID);
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return {
        success: false,
        error: '시트를 찾을 수 없습니다: ' + sheetName
      };
    }

    var sheetData = sheet.getDataRange().getValues();
    var rows = sheetData.slice(1);

    // ID로 행 찾기
    var targetRowIndex = -1;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === String(id)) {
        targetRowIndex = i + 2;
        break;
      }
    }

    if (targetRowIndex === -1) {
      return {
        success: false,
        error: '데이터를 찾을 수 없습니다: ' + id
      };
    }

    sheet.deleteRow(targetRowIndex);

    return {
      success: true,
      message: '데이터가 삭제되었습니다.'
    };

  } catch (err) {
    Logger.log('[deleteMasterData Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * ============================================================
 * 5. 유틸리티 함수
 * ============================================================
 */

/**
 * 타입에 따른 시트명 반환
 */
function getSheetNameByType(type) {
  switch(type) {
    case 'supplier':
      return OB_SUPPLIER_SHEET;
    case 'product':
      return OB_PRODUCT_SHEET;
    case 'brand':
      return OB_BRAND_SHEET;
    default:
      return OB_SUPPLIER_SHEET;
  }
}
```

---

## 7. 프론트엔드 구현

### 7.1 Page_MasterData.html 전체 구조

```html
<style>
/* ===== 기본 레이아웃 ===== */
.masterdata-wrap{
  padding:20px;
  max-width:1400px;
  margin:0 auto;
}

/* 페이지 헤더 */
.masterdata-header{
  margin-bottom:20px;
}
.masterdata-header h1{
  font-size:24px;
  font-weight:700;
  color:#1e293b;
  margin:0 0 8px 0;
}
.masterdata-header p{
  color:#64748b;
  margin:0;
  font-size:14px;
}

/* ===== 탭 메뉴 ===== */
.masterdata-tabs{
  display:flex;
  gap:8px;
  border-bottom:2px solid #e5e7eb;
  margin-bottom:20px;
}
.masterdata-tab{
  padding:12px 24px;
  background:transparent;
  border:none;
  cursor:pointer;
  font-size:14px;
  font-weight:500;
  color:#64748b;
  border-bottom:2px solid transparent;
  margin-bottom:-2px;
  transition:all 0.2s;
}
.masterdata-tab:hover{
  color:#1e293b;
}
.masterdata-tab.active{
  color:#2563eb;
  border-bottom-color:#2563eb;
}

/* ===== 탭 콘텐츠 ===== */
.masterdata-tab-content{
  display:none;
}
.masterdata-tab-content.active{
  display:block;
}

/* ===== 액션 바 ===== */
.masterdata-actions{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:16px;
}

.masterdata-search{
  display:flex;
  gap:8px;
}
.masterdata-search input{
  padding:8px 12px;
  border:1px solid #d1d5db;
  border-radius:6px;
  font-size:14px;
  min-width:250px;
}

.masterdata-btn{
  padding:8px 16px;
  border:none;
  border-radius:6px;
  cursor:pointer;
  font-size:14px;
  font-weight:500;
  transition:all 0.2s;
}
.masterdata-btn.primary{
  background:#2563eb;
  color:white;
}
.masterdata-btn.primary:hover{
  background:#1d4ed8;
}
.masterdata-btn.secondary{
  background:#e5e7eb;
  color:#1e293b;
}
.masterdata-btn.secondary:hover{
  background:#d1d5db;
}
.masterdata-btn.danger{
  background:#dc2626;
  color:white;
}
.masterdata-btn.danger:hover{
  background:#b91c1c;
}
.masterdata-btn.small{
  padding:4px 8px;
  font-size:12px;
}

/* ===== 테이블 ===== */
.masterdata-table-wrap{
  overflow:auto;
  max-height:600px;
  background:white;
  border-radius:8px;
  box-shadow:0 1px 4px rgba(0,0,0,0.1);
}
.masterdata-table{
  width:100%;
  border-collapse:collapse;
  font-size:13px;
}
.masterdata-table th,
.masterdata-table td{
  padding:12px;
  border-bottom:1px solid #e2e8f0;
  text-align:left;
}
.masterdata-table th{
  background:#f1f5f9;
  font-weight:600;
  position:sticky;
  top:0;
  z-index:10;
}
.masterdata-table td.num{
  text-align:right;
}
.masterdata-table td.center{
  text-align:center;
}
.masterdata-table tbody tr:hover{
  background:#f8fafc;
}

.masterdata-empty{
  text-align:center;
  padding:60px 20px;
  color:#64748b;
}

/* ===== 모달 ===== */
.masterdata-modal{
  display:none;
  position:fixed;
  top:0;
  left:0;
  width:100%;
  height:100%;
  background:rgba(0,0,0,0.5);
  z-index:1000;
  align-items:center;
  justify-content:center;
}
.masterdata-modal.show{
  display:flex;
}
.masterdata-modal-content{
  background:white;
  border-radius:8px;
  padding:24px;
  max-width:600px;
  width:90%;
  max-height:80vh;
  overflow-y:auto;
}
.masterdata-modal-header{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:20px;
}
.masterdata-modal-header h2{
  font-size:20px;
  font-weight:700;
  margin:0;
}
.masterdata-modal-close{
  background:none;
  border:none;
  font-size:24px;
  cursor:pointer;
  color:#64748b;
}
.masterdata-modal-close:hover{
  color:#1e293b;
}
.masterdata-modal-body{
  margin-bottom:20px;
}
.masterdata-modal-footer{
  display:flex;
  gap:8px;
  justify-content:flex-end;
}

/* ===== 폼 ===== */
.masterdata-form-group{
  margin-bottom:16px;
}
.masterdata-form-group label{
  display:block;
  font-size:13px;
  font-weight:500;
  color:#475569;
  margin-bottom:4px;
}
.masterdata-form-group input,
.masterdata-form-group select,
.masterdata-form-group textarea{
  width:100%;
  padding:8px 12px;
  border:1px solid #d1d5db;
  border-radius:6px;
  font-size:14px;
  box-sizing:border-box;
}
.masterdata-form-group textarea{
  resize:vertical;
  min-height:80px;
}
.masterdata-form-group input:focus,
.masterdata-form-group select:focus,
.masterdata-form-group textarea:focus{
  outline:none;
  border-color:#2563eb;
}
</style>

<div class="masterdata-wrap">
  <!-- 페이지 헤더 -->
  <div class="masterdata-header">
    <h1>기초데이터 관리</h1>
    <p>거래처, 품목, 브랜드 정보를 관리합니다.</p>
  </div>

  <!-- 탭 메뉴 -->
  <div class="masterdata-tabs">
    <button class="masterdata-tab active" data-tab="supplier">거래처 관리</button>
    <button class="masterdata-tab" data-tab="product">품목 관리</button>
    <button class="masterdata-tab" data-tab="brand">브랜드 관리</button>
  </div>

  <!-- 탭 콘텐츠: 거래처 -->
  <div class="masterdata-tab-content active" data-tab-content="supplier">
    <div class="masterdata-actions">
      <div class="masterdata-search">
        <input type="text" id="supplier-search" placeholder="거래처명 검색...">
        <button class="masterdata-btn secondary" onclick="OB.searchMasterData('supplier')">검색</button>
      </div>
      <button class="masterdata-btn primary" onclick="OB.openMasterDataModal('supplier', 'create')">
        + 거래처 추가
      </button>
    </div>
    <div class="masterdata-table-wrap">
      <table class="masterdata-table">
        <thead>
          <tr>
            <th>거래처코드</th>
            <th>거래처명</th>
            <th>브랜드명</th>
            <th>사업자번호</th>
            <th>대표자명</th>
            <th>연락처</th>
            <th>주거래처</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody id="supplier-table-body">
          <!-- 동적 생성 -->
        </tbody>
      </table>
    </div>
  </div>

  <!-- 탭 콘텐츠: 품목 -->
  <div class="masterdata-tab-content" data-tab-content="product">
    <div class="masterdata-actions">
      <div class="masterdata-search">
        <input type="text" id="product-search" placeholder="품목명 검색...">
        <button class="masterdata-btn secondary" onclick="OB.searchMasterData('product')">검색</button>
      </div>
      <button class="masterdata-btn primary" onclick="OB.openMasterDataModal('product', 'create')">
        + 품목 추가
      </button>
    </div>
    <div class="masterdata-table-wrap">
      <table class="masterdata-table">
        <thead>
          <tr>
            <th>품목코드</th>
            <th>제품명</th>
            <th>브랜드</th>
            <th>매입가</th>
            <th>공급가</th>
            <th>소비자가</th>
            <th>재고수량</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody id="product-table-body">
          <!-- 동적 생성 -->
        </tbody>
      </table>
    </div>
  </div>

  <!-- 탭 콘텐츠: 브랜드 -->
  <div class="masterdata-tab-content" data-tab-content="brand">
    <div class="masterdata-actions">
      <div class="masterdata-search">
        <input type="text" id="brand-search" placeholder="브랜드명 검색...">
        <button class="masterdata-btn secondary" onclick="OB.searchMasterData('brand')">검색</button>
      </div>
      <button class="masterdata-btn primary" onclick="OB.openMasterDataModal('brand', 'create')">
        + 브랜드 추가
      </button>
    </div>
    <div class="masterdata-table-wrap">
      <table class="masterdata-table">
        <thead>
          <tr>
            <th>브랜드코드</th>
            <th>브랜드명</th>
            <th>주거래처</th>
            <th>비고</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody id="brand-table-body">
          <!-- 동적 생성 -->
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- 모달 (생성/수정 공용) -->
<div class="masterdata-modal" id="masterdata-modal">
  <div class="masterdata-modal-content">
    <div class="masterdata-modal-header">
      <h2 id="modal-title">데이터 추가</h2>
      <button class="masterdata-modal-close" onclick="OB.closeMasterDataModal()">×</button>
    </div>
    <div class="masterdata-modal-body">
      <form id="masterdata-form">
        <!-- 동적 생성 -->
      </form>
    </div>
    <div class="masterdata-modal-footer">
      <button class="masterdata-btn secondary" onclick="OB.closeMasterDataModal()">취소</button>
      <button class="masterdata-btn primary" onclick="OB.saveMasterData()">저장</button>
    </div>
  </div>
</div>
```

### 7.2 CommonScripts.html에 추가할 코드

```javascript
/**
 * ===========================================================
 * Master Data 페이지 초기화 함수
 * ===========================================================
 */
OB.masterDataState = {
  currentTab: 'supplier',
  currentMode: 'create', // 'create' or 'edit'
  currentId: null,
  allData: {
    supplier: [],
    product: [],
    brand: []
  },
  filteredData: {
    supplier: [],
    product: [],
    brand: []
  }
};

/**
 * Master Data 페이지 초기화
 */
OB.initMasterDataPage = function() {
  console.log('✅ Master Data 페이지 초기화');

  // 탭 전환 이벤트
  var tabs = document.querySelectorAll('.masterdata-tab');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      var tabName = tab.getAttribute('data-tab');
      OB.switchMasterDataTab(tabName);
    });
  });

  // 초기 데이터 로드
  OB.loadMasterData('supplier');
};

/**
 * 탭 전환
 */
OB.switchMasterDataTab = function(tabName) {
  console.log('탭 전환:', tabName);

  // 탭 버튼 활성화
  var tabs = document.querySelectorAll('.masterdata-tab');
  tabs.forEach(function(tab) {
    if (tab.getAttribute('data-tab') === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // 탭 콘텐츠 활성화
  var contents = document.querySelectorAll('.masterdata-tab-content');
  contents.forEach(function(content) {
    if (content.getAttribute('data-tab-content') === tabName) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  OB.masterDataState.currentTab = tabName;

  // 데이터 로드
  if (OB.masterDataState.allData[tabName].length === 0) {
    OB.loadMasterData(tabName);
  }
};

/**
 * 데이터 로드
 */
OB.loadMasterData = function(type) {
  OB.showLoading('데이터 조회 중...');

  google.script.run
    .withSuccessHandler(function(response) {
      OB.hideLoading();

      if (response.success) {
        OB.masterDataState.allData[type] = response.data;
        OB.masterDataState.filteredData[type] = response.data;
        OB.renderMasterDataTable(type);
      } else {
        alert('데이터 조회 실패: ' + response.error);
      }
    })
    .withFailureHandler(function(err) {
      OB.hideLoading();
      console.error('데이터 조회 오류:', err);
      alert('데이터 조회 중 오류가 발생했습니다.');
    })
    .getMasterDataListApi({ type: type });
};

/**
 * 테이블 렌더링
 */
OB.renderMasterDataTable = function(type) {
  var tbody = document.getElementById(type + '-table-body');
  if (!tbody) return;

  var data = OB.masterDataState.filteredData[type];

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="masterdata-empty">데이터가 없습니다.</td></tr>';
    return;
  }

  var html = '';

  data.forEach(function(item) {
    if (type === 'supplier') {
      html += '<tr>';
      html += '<td>' + (item['거래처코드'] || '') + '</td>';
      html += '<td>' + (item['거래처명'] || '') + '</td>';
      html += '<td>' + (item['브랜드명'] || '') + '</td>';
      html += '<td>' + (item['사업자번호'] || '') + '</td>';
      html += '<td>' + (item['대표자명'] || '') + '</td>';
      html += '<td>' + (item['연락처'] || '') + '</td>';
      html += '<td>' + (item['주거래처'] || '') + '</td>';
      html += '<td class="center">';
      html += '<button class="masterdata-btn small secondary" onclick="OB.openMasterDataModal(\'supplier\', \'edit\', \'' + item['거래처코드'] + '\')">수정</button> ';
      html += '<button class="masterdata-btn small danger" onclick="OB.deleteMasterDataItem(\'supplier\', \'' + item['거래처코드'] + '\')">삭제</button>';
      html += '</td>';
      html += '</tr>';
    } else if (type === 'product') {
      html += '<tr>';
      html += '<td>' + (item['품목코드'] || '') + '</td>';
      html += '<td>' + (item['제품명'] || '') + '</td>';
      html += '<td>' + (item['브랜드'] || '') + '</td>';
      html += '<td class="num">' + OB.formatNumber(item['매입가'] || 0) + '</td>';
      html += '<td class="num">' + OB.formatNumber(item['공급가'] || 0) + '</td>';
      html += '<td class="num">' + OB.formatNumber(item['소비자가'] || 0) + '</td>';
      html += '<td class="num">' + OB.formatNumber(item['재고수량'] || 0) + '</td>';
      html += '<td class="center">';
      html += '<button class="masterdata-btn small secondary" onclick="OB.openMasterDataModal(\'product\', \'edit\', \'' + item['품목코드'] + '\')">수정</button> ';
      html += '<button class="masterdata-btn small danger" onclick="OB.deleteMasterDataItem(\'product\', \'' + item['품목코드'] + '\')">삭제</button>';
      html += '</td>';
      html += '</tr>';
    } else if (type === 'brand') {
      html += '<tr>';
      html += '<td>' + (item['브랜드코드'] || '') + '</td>';
      html += '<td>' + (item['브랜드명'] || '') + '</td>';
      html += '<td>' + (item['주거래처'] || '') + '</td>';
      html += '<td>' + (item['비고'] || '') + '</td>';
      html += '<td class="center">';
      html += '<button class="masterdata-btn small secondary" onclick="OB.openMasterDataModal(\'brand\', \'edit\', \'' + item['브랜드코드'] + '\')">수정</button> ';
      html += '<button class="masterdata-btn small danger" onclick="OB.deleteMasterDataItem(\'brand\', \'' + item['브랜드코드'] + '\')">삭제</button>';
      html += '</td>';
      html += '</tr>';
    }
  });

  tbody.innerHTML = html;
};

/**
 * 검색
 */
OB.searchMasterData = function(type) {
  var searchInput = document.getElementById(type + '-search');
  if (!searchInput) return;

  var keyword = searchInput.value.toLowerCase();
  var allData = OB.masterDataState.allData[type];

  if (!keyword) {
    OB.masterDataState.filteredData[type] = allData;
  } else {
    OB.masterDataState.filteredData[type] = allData.filter(function(item) {
      // 모든 값을 문자열로 변환해서 검색
      return Object.values(item).some(function(val) {
        return String(val).toLowerCase().indexOf(keyword) >= 0;
      });
    });
  }

  OB.renderMasterDataTable(type);
};

/**
 * 모달 열기
 */
OB.openMasterDataModal = function(type, mode, id) {
  OB.masterDataState.currentMode = mode;
  OB.masterDataState.currentId = id || null;

  var modal = document.getElementById('masterdata-modal');
  var title = document.getElementById('modal-title');
  var form = document.getElementById('masterdata-form');

  if (!modal || !title || !form) return;

  // 타이틀 설정
  var typeNames = {
    supplier: '거래처',
    product: '품목',
    brand: '브랜드'
  };
  title.textContent = (mode === 'create' ? typeNames[type] + ' 추가' : typeNames[type] + ' 수정');

  // 폼 생성
  form.innerHTML = OB.generateMasterDataForm(type, mode, id);

  modal.classList.add('show');
};

/**
 * 모달 닫기
 */
OB.closeMasterDataModal = function() {
  var modal = document.getElementById('masterdata-modal');
  if (modal) {
    modal.classList.remove('show');
  }
};

/**
 * 폼 생성
 */
OB.generateMasterDataForm = function(type, mode, id) {
  var html = '';
  var data = null;

  // 수정 모드인 경우 기존 데이터 가져오기
  if (mode === 'edit' && id) {
    var allData = OB.masterDataState.allData[type];
    data = allData.find(function(item) {
      var firstKey = Object.keys(item).filter(function(k) { return k !== '_rowIndex'; })[0];
      return String(item[firstKey]) === String(id);
    });
  }

  if (type === 'supplier') {
    html += '<div class="masterdata-form-group">';
    html += '<label>거래처코드 *</label>';
    html += '<input type="text" id="form-거래처코드" value="' + (data ? data['거래처코드'] || '' : '') + '" ' + (mode === 'edit' ? 'readonly' : '') + '>';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>거래처명 *</label>';
    html += '<input type="text" id="form-거래처명" value="' + (data ? data['거래처명'] || '' : '') + '">';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>브랜드명</label>';
    html += '<input type="text" id="form-브랜드명" value="' + (data ? data['브랜드명'] || '' : '') + '">';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>브랜드코드</label>';
    html += '<input type="text" id="form-브랜드코드" value="' + (data ? data['브랜드코드'] || '' : '') + '">';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>사업자번호</label>';
    html += '<input type="text" id="form-사업자번호" value="' + (data ? data['사업자번호'] || '' : '') + '">';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>대표자명</label>';
    html += '<input type="text" id="form-대표자명" value="' + (data ? data['대표자명'] || '' : '') + '">';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>연락처</label>';
    html += '<input type="text" id="form-연락처" value="' + (data ? data['연락처'] || '' : '') + '">';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>이메일</label>';
    html += '<input type="email" id="form-이메일" value="' + (data ? data['이메일'] || '' : '') + '">';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>주소</label>';
    html += '<input type="text" id="form-주소" value="' + (data ? data['주소'] || '' : '') + '">';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>주거래처</label>';
    html += '<select id="form-주거래처">';
    html += '<option value="">선택</option>';
    html += '<option value="발주처"' + (data && data['주거래처'] === '발주처' ? ' selected' : '') + '>발주처</option>';
    html += '<option value="매입처"' + (data && data['주거래처'] === '매입처' ? ' selected' : '') + '>매입처</option>';
    html += '<option value="발주처,매입처"' + (data && data['주거래처'] === '발주처,매입처' ? ' selected' : '') + '>발주처,매입처</option>';
    html += '</select>';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>비고</label>';
    html += '<textarea id="form-비고">' + (data ? data['비고'] || '' : '') + '</textarea>';
    html += '</div>';

  } else if (type === 'product') {
    html += '<div class="masterdata-form-group">';
    html += '<label>품목코드 *</label>';
    html += '<input type="text" id="form-품목코드" value="' + (data ? data['품목코드'] || '' : '') + '" ' + (mode === 'edit' ? 'readonly' : '') + '>';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>제품명 *</label>';
    html += '<input type="text" id="form-제품명" value="' + (data ? data['제품명'] || '' : '') + '">';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>브랜드</label>';
    html += '<input type="text" id="form-브랜드" value="' + (data ? data['브랜드'] || '' : '') + '">';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>카테고리</label>';
    html += '<input type="text" id="form-카테고리" value="' + (data ? data['카테고리'] || '' : '') + '">';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>매입가</label>';
    html += '<input type="number" id="form-매입가" value="' + (data ? data['매입가'] || '' : '') + '">';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>공급가</label>';
    html += '<input type="number" id="form-공급가" value="' + (data ? data['공급가'] || '' : '') + '">';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>소비자가</label>';
    html += '<input type="number" id="form-소비자가" value="' + (data ? data['소비자가'] || '' : '') + '">';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>재고수량</label>';
    html += '<input type="number" id="form-재고수량" value="' + (data ? data['재고수량'] || '' : '') + '">';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>안전재고</label>';
    html += '<input type="number" id="form-안전재고" value="' + (data ? data['안전재고'] || '' : '') + '">';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>단위</label>';
    html += '<input type="text" id="form-단위" value="' + (data ? data['단위'] || '' : '') + '">';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>비고</label>';
    html += '<textarea id="form-비고">' + (data ? data['비고'] || '' : '') + '</textarea>';
    html += '</div>';

  } else if (type === 'brand') {
    html += '<div class="masterdata-form-group">';
    html += '<label>브랜드코드 *</label>';
    html += '<input type="text" id="form-브랜드코드" value="' + (data ? data['브랜드코드'] || '' : '') + '" ' + (mode === 'edit' ? 'readonly' : '') + '>';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>브랜드명 *</label>';
    html += '<input type="text" id="form-브랜드명" value="' + (data ? data['브랜드명'] || '' : '') + '">';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>주거래처</label>';
    html += '<input type="text" id="form-주거래처" value="' + (data ? data['주거래처'] || '' : '') + '">';
    html += '</div>';

    html += '<div class="masterdata-form-group">';
    html += '<label>비고</label>';
    html += '<textarea id="form-비고">' + (data ? data['비고'] || '' : '') + '</textarea>';
    html += '</div>';
  }

  return html;
};

/**
 * 저장
 */
OB.saveMasterData = function() {
  var type = OB.masterDataState.currentTab;
  var mode = OB.masterDataState.currentMode;
  var id = OB.masterDataState.currentId;

  // 폼 데이터 수집
  var formData = {};
  var form = document.getElementById('masterdata-form');
  if (!form) return;

  var inputs = form.querySelectorAll('input, select, textarea');
  inputs.forEach(function(input) {
    var fieldName = input.id.replace('form-', '');
    formData[fieldName] = input.value;
  });

  // 유효성 검사
  if (type === 'supplier' && !formData['거래처코드']) {
    alert('거래처코드를 입력해주세요.');
    return;
  }
  if (type === 'product' && !formData['품목코드']) {
    alert('품목코드를 입력해주세요.');
    return;
  }
  if (type === 'brand' && !formData['브랜드코드']) {
    alert('브랜드코드를 입력해주세요.');
    return;
  }

  OB.showLoading('저장 중...');

  var apiFunction = mode === 'create' ? 'createMasterDataApi' : 'updateMasterDataApi';
  var params = {
    type: type,
    data: formData
  };

  if (mode === 'edit') {
    params.id = id;
  }

  google.script.run
    .withSuccessHandler(function(response) {
      OB.hideLoading();

      if (response.success) {
        alert(mode === 'create' ? '생성되었습니다.' : '수정되었습니다.');
        OB.closeMasterDataModal();
        OB.loadMasterData(type);
      } else {
        alert('저장 실패: ' + response.error);
      }
    })
    .withFailureHandler(function(err) {
      OB.hideLoading();
      console.error('저장 오류:', err);
      alert('저장 중 오류가 발생했습니다.');
    })
    [apiFunction](params);
};

/**
 * 삭제
 */
OB.deleteMasterDataItem = function(type, id) {
  if (!confirm('정말 삭제하시겠습니까?')) {
    return;
  }

  OB.showLoading('삭제 중...');

  google.script.run
    .withSuccessHandler(function(response) {
      OB.hideLoading();

      if (response.success) {
        alert('삭제되었습니다.');
        OB.loadMasterData(type);
      } else {
        alert('삭제 실패: ' + response.error);
      }
    })
    .withFailureHandler(function(err) {
      OB.hideLoading();
      console.error('삭제 오류:', err);
      alert('삭제 중 오류가 발생했습니다.');
    })
    .deleteMasterDataApi({
      type: type,
      id: id
    });
};
```

---

## 8. 기존 코드 연결 포인트

### 8.1 ApiService.js 수정

```javascript
// ApiService.js 파일 끝에 추가

/**
 * ============================================================
 * Master Data 관리 API (클라이언트용 래퍼)
 * ============================================================
 */

function getMasterDataListApi(params) {
  var result = getMasterDataList(params);
  return safeReturn(result);
}

function getMasterDataItemApi(params) {
  var result = getMasterDataItem(params);
  return safeReturn(result);
}

function createMasterDataApi(params) {
  var result = createMasterData(params);
  return safeReturn(result);
}

function updateMasterDataApi(params) {
  var result = updateMasterData(params);
  return safeReturn(result);
}

function deleteMasterDataApi(params) {
  var result = deleteMasterData(params);
  return safeReturn(result);
}
```

### 8.2 CommonScripts.html 수정

```javascript
// CommonScripts.html의 OB.initCurrentPage 함수에 추가

switch(page) {
  case 'orderFile':
    initFuncName = 'initOrderFilePage';
    break;
  // ... 기존 케이스들 ...
  case 'masterData':  // ✅ 추가
    initFuncName = 'initMasterDataPage';
    break;
}
```

### 8.3 Component_Sidebar.html 수정

```html
<!-- "설정" 섹션 아래에 추가 -->
<div>
  <div class="ob-sidebar-section-title">설정</div>
  <ul class="ob-nav-list">
    <li class="ob-nav-item">
      <a href="#" class="ob-nav-link" data-nav-page="masterData">
        <span class="ob-nav-icon">🗂️</span>
        <span>기초데이터 관리</span>
      </a>
    </li>
    <li class="ob-nav-item">
      <a href="#" class="ob-nav-link" data-nav-page="settings">
        <span class="ob-nav-icon">⚙️</span>
        <span>시스템 설정</span>
      </a>
    </li>
  </ul>
</div>
```

### 8.4 WebApp.js 수정 (선택사항)

```javascript
// getPageContent 함수에 케이스 추가 (이미 동적 처리되어 있으면 불필요)
function getPageContent(page) {
  switch(page) {
    case 'masterData':
      return HtmlService.createHtmlOutputFromFile('Page_MasterData').getContent();
    // ... 기존 케이스들 ...
  }
}
```

---

## 9. 테스트 방법

### 9.1 로컬 테스트 체크리스트

```
□ 파일 업로드 확인
  □ MasterDataService.js
  □ Page_MasterData.html
  □ ApiService.js (수정본)
  □ CommonScripts.html (수정본)
  □ Component_Sidebar.html (수정본)

□ 기능 테스트
  □ 사이드바 메뉴에서 "기초데이터 관리" 클릭
  □ 거래처 탭에서 목록 조회
  □ 거래처 추가 모달 열기 및 저장
  □ 거래처 수정
  □ 거래처 삭제
  □ 품목 탭 전환 및 CRUD 테스트
  □ 브랜드 탭 CRUD 테스트
  □ 검색 기능 테스트

□ 에러 핸들링
  □ 필수 필드 누락 시 경고
  □ 네트워크 오류 시 메시지 표시
```

### 9.2 디버깅 팁

```javascript
// Apps Script 에디터에서 로그 확인
Logger.log('테스트 데이터:', JSON.stringify(data));

// 브라우저 콘솔에서 확인
console.log('OB.masterDataState:', OB.masterDataState);
```

---

## 10. 코드 제출 방법

### 10.1 파일 제출 형식

#### 방법 1: 개별 파일로 제출 (권장)

```
📁 masterdata-implementation/
├── MasterDataService.js          (신규 파일 전체)
├── Page_MasterData.html          (신규 파일 전체)
├── ApiService.js.patch           (추가할 코드만)
├── CommonScripts.html.patch      (추가할 코드만)
└── Component_Sidebar.html.patch  (추가할 코드만)
```

**예시: ApiService.js.patch**
```javascript
// ============================================================
// ✅ ApiService.js 파일 끝에 아래 코드를 추가하세요
// ============================================================

/**
 * ============================================================
 * Master Data 관리 API (클라이언트용 래퍼)
 * ============================================================
 */

function getMasterDataListApi(params) {
  var result = getMasterDataList(params);
  return safeReturn(result);
}

// ... 나머지 함수들 ...
```

#### 방법 2: 단일 마크다운 파일로 제출

```markdown
# Master Data 구현 코드

## 1. MasterDataService.js (신규)
[전체 코드]

## 2. Page_MasterData.html (신규)
[전체 코드]

## 3. ApiService.js (수정)
### 추가할 위치: 파일 끝
[추가 코드]

## 4. CommonScripts.html (수정)
### 수정 위치 1: initCurrentPage 함수
[수정 코드]

### 추가 위치 2: 파일 끝
[추가 코드]

## 5. Component_Sidebar.html (수정)
### 추가 위치: "설정" 섹션
[추가 코드]
```

### 10.2 Claude에게 코드 전달하기

```
제목: Master Data 관리 페이지 구현 완료

안녕하세요, GPT가 작성한 Master Data 관리 페이지 코드입니다.

아래 파일들을 확인하고 프로젝트에 통합해주세요:

1. 신규 파일 (2개)
   - MasterDataService.js
   - Page_MasterData.html

2. 수정 파일 (3개)
   - ApiService.js (API 래퍼 추가)
   - CommonScripts.html (초기화 함수 추가)
   - Component_Sidebar.html (메뉴 추가)

각 파일의 코드는 아래에 있습니다:

---
[코드 붙여넣기]
---

테스트 결과:
□ 거래처 CRUD: 정상 작동
□ 품목 CRUD: 정상 작동
□ 브랜드 CRUD: 정상 작동
□ 검색 기능: 정상 작동

알려진 이슈:
- 없음 (또는 발견된 문제 기술)
```

### 10.3 Git 브랜치로 제출 (가장 권장)

```bash
# GPT가 작업한 코드를 별도 브랜치에 커밋
# Claude가 리뷰 후 메인 브랜치에 머지

# Claude에게 전달할 메시지:
"master-data 구현이 완료되었습니다.
브랜치: feature/master-data-management
커밋 해시: abc123

리뷰 후 머지해주세요."
```

---

## 11. 주의사항 및 FAQ

### 11.1 주의사항

```
⚠️ 실제 시트 구조 확인 필수!
- 본 명세서의 컬럼 구조는 '예상'입니다.
- 반드시 실제 Google Sheets에서 헤더를 확인하세요.
- SpreadsheetApp.openById()로 시트를 열어
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log(header); 로 컬럼명을 확인하세요.

⚠️ 브랜드DB 시트 존재 여부 확인!
- '브랜드DB' 시트가 없을 수 있습니다.
- 없다면 거래처DB에서 브랜드 정보를 추출하거나
- 새로 생성하는 로직을 추가하세요.

⚠️ 코드 스타일 준수!
- var만 사용 (let/const 금지)
- function() {} 사용 (화살표 함수 금지)
- safeReturn() 반드시 사용
```

### 11.2 FAQ

**Q: 시트 컬럼이 명세서와 다르면?**
A: 실제 시트의 헤더를 Logger.log로 확인 후, 코드에서 컬럼명을 수정하세요.

**Q: 브랜드DB 시트가 없으면?**
A: 두 가지 옵션:
   1) 거래처DB에서 브랜드 정보만 필터링
   2) 새 시트 생성 (추천)

**Q: 에러가 발생하면?**
A: Apps Script 에디터의 "실행 로그"를 확인하고, 에러 메시지와 함께 Claude에게 문의하세요.

**Q: ID가 중복되면?**
A: createMasterData 함수에 중복 체크 로직 추가:
```javascript
// ID 중복 체크
var existing = getMasterDataList({ type: type });
if (existing.data.some(function(item) {
  return item[idColumn] === data[idColumn];
})) {
  return {
    success: false,
    error: 'ID가 이미 존재합니다.'
  };
}
```

---

## 12. 체크리스트

구현 완료 후 아래 항목을 체크하세요:

```
구현 완료:
□ MasterDataService.js 작성
□ Page_MasterData.html 작성
□ ApiService.js 수정
□ CommonScripts.html 수정
□ Component_Sidebar.html 수정

기능 테스트:
□ 거래처 목록 조회
□ 거래처 생성
□ 거래처 수정
□ 거래처 삭제
□ 거래처 검색
□ 품목 CRUD (위와 동일)
□ 브랜드 CRUD (위와 동일)
□ 탭 전환
□ 모달 열기/닫기

코드 품질:
□ ES5 문법 준수 (var, function)
□ safeReturn 적용
□ 에러 처리 구현
□ Logger.log 추가
□ 주석 작성

문서화:
□ 구현 내용 정리
□ 알려진 이슈 기록
□ 테스트 결과 기록
```

---

## 13. 참고 자료

### 13.1 기존 코드 참고
- `SettlementService.js` - 시트 CRUD 패턴
- `Page_BillingManagement.html` - UI/UX 스타일
- `CommonScripts.html` - 페이지 초기화 패턴

### 13.2 Google Apps Script 문서
- [SpreadsheetApp](https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet-app)
- [Sheet](https://developers.google.com/apps-script/reference/spreadsheet/sheet)

---

**작업 시작 전에 이 명세서를 꼼꼼히 읽어주세요!**
**질문이 있으면 언제든지 Claude에게 문의하세요.**

행운을 빕니다! 🚀
