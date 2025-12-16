# OneBridge ERP v2.4 구현 계획서

## 📋 문서 정보
- **버전**: v2.4.0
- **작성일**: 2025-12-16
- **목표**: 리팩터링 미완성 기능 완성 + 버그 수정
- **예상 기간**: 5-7일

---

## 🎯 목표

리팩터링(Phase 1-4)의 **미완성 기능을 완성**하고, **기존 작동 기능을 복구**합니다.

---

## 📊 현재 상태 평가

| Phase | 설계 품질 | 구현 완성도 | 실행 가능성 | 우선순위 |
|-------|-----------|-------------|-------------|----------|
| Phase 1-2 (2-Track 청구서) | ⭐⭐⭐⭐⭐ | 70% | ⭐⭐⭐⭐☆ | 🔴 최고 |
| Phase 3 (메뉴 통합) | ⭐⭐⭐⭐☆ | 40% | ⭐⭐⭐☆☆ | 🟡 중간 |
| Phase 4 (UI/UX 표준화) | ⭐⭐⭐⭐☆ | 10% | ⭐☆☆☆☆ | 🟢 낮음 |

---

# 1단계: 핵심 기능 복구 (Priority 1) 🔴

**목표**: 즉시 사용 가능한 상태로 복구
**기간**: 1-2일
**담당**: 최우선

---

## 1.1 거래원장 페이지 - 4개 상태 컬럼 구현

### 📍 현재 문제
- HTML 테이블: "상태" 컬럼 1개만 표시 (❌ 시트에 없는 컬럼)
- 실제 시트: "매입발주", "매입결제", "매출결제", "출고" 4개 컬럼 존재
- JavaScript: 잘못된 API 호출 (`updateTransactionStateApi` → 존재하지 않음)

### ✅ 수정 작업

#### 1.1.1 Page_TransactionLedger.html 수정
```html
<!-- 파일: Page_TransactionLedger.html -->
<!-- 수정 위치: 테이블 헤더 (96-109줄) -->

<thead>
  <tr>
    <th>발주일</th>
    <th>발주번호</th>
    <th>발주처</th>
    <th>브랜드</th>
    <th>품목코드</th>
    <th>제품명</th>
    <th class="num">발주수량</th>
    <th class="num">확정수량</th>
    <th class="num">공급가</th>
    <th class="num">공급액</th>
    <!-- ⭐ 4개 상태 컬럼 추가 -->
    <th>매입발주</th>
    <th>매입결제</th>
    <th>매출결제</th>
    <th>출고</th>
    <th>액션</th>
  </tr>
</thead>
```

**변경 포인트**:
- "상태" 컬럼 1개 삭제
- "매입발주", "매입결제", "매출결제", "출고" 4개 컬럼 추가

---

#### 1.1.2 CommonScripts.html 수정

**수정 위치**: `OB.initTransactionLedgerPage()` 함수의 `renderTable()` 내부

**AS-IS (현재 코드)**:
```javascript
// 상태 컬럼 1개만 렌더링 (잘못됨)
var statusTd = document.createElement('td');
var badge = document.createElement('span');
badge.className = 'ledger-status-badge';
badge.textContent = tx['상태'] || 'N/A';
statusTd.appendChild(badge);
tr.appendChild(statusTd);

// 잘못된 API 호출
var select = buildStatusSelect(tx['상태']);
btn.addEventListener('click', function() {
  google.script.run.updateTransactionStateApi({ rowIndex: tx._rowIndex, state: next });
});
```

**TO-BE (수정 후 코드)**:
```javascript
// ⭐ 4개 상태 컬럼 렌더링
var statuses = ['매입발주', '매입결제', '매출결제', '출고'];
var statusKeys = ['buyOrder', 'payBuy', 'paySell', 'ship'];

statuses.forEach(function(statusName, idx) {
  var td = document.createElement('td');
  var select = document.createElement('select');
  select.className = 'status-select';
  select.dataset.statusKey = statusKeys[idx];
  select.dataset.orderCode = tx['발주번호'];

  // 상태 옵션 (실제 시트의 값에 맞춰 조정 필요)
  var options = ['미처리', '진행중', '완료', '취소'];
  options.forEach(function(opt) {
    var option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    if (tx[statusName] === opt) {
      option.selected = true;
    }
    select.appendChild(option);
  });

  td.appendChild(select);
  tr.appendChild(td);
});

// 액션 버튼
var actionTd = document.createElement('td');
var saveBtn = document.createElement('button');
saveBtn.textContent = '상태 저장';
saveBtn.className = 'ledger-btn primary';

saveBtn.addEventListener('click', function() {
  // ⭐ 올바른 API 호출
  var selects = tr.querySelectorAll('.status-select');
  var orderCode = selects[0].dataset.orderCode;
  var statuses = {};

  selects.forEach(function(select) {
    statuses[select.dataset.statusKey] = select.value;
  });

  OB.showLoading('상태 저장 중...');

  google.script.run
    .withSuccessHandler(function(result) {
      OB.hideLoading();
      if (result.success) {
        alert('상태가 저장되었습니다.');
        fetchTransactions(); // 새로고침
      } else {
        alert('저장 실패: ' + result.error);
      }
    })
    .withFailureHandler(function(error) {
      OB.hideLoading();
      alert('오류: ' + error.message);
    })
    .updateOrderStatus(orderCode, statuses);  // ⭐ 올바른 API
});

actionTd.appendChild(saveBtn);

// 청구서 버튼 (기존 유지)
var invoiceBtn = document.createElement('button');
invoiceBtn.textContent = '청구서';
invoiceBtn.className = 'ledger-btn secondary';
invoiceBtn.addEventListener('click', function() {
  OB.navigateToInvoice(tx['발주번호'], tx['발주처']);
});
actionTd.appendChild(invoiceBtn);

tr.appendChild(actionTd);
```

**파일**: `CommonScripts.html`
**함수**: `OB.initTransactionLedgerPage()` 내부 `renderTable()` 함수
**예상 라인**: 약 3840-3930줄

---

#### 1.1.3 테스트 체크리스트

- [ ] 거래원장 페이지 로드
- [ ] 4개 상태 컬럼이 올바르게 표시되는지 확인
- [ ] 각 드롭다운의 현재 값이 시트 데이터와 일치하는지 확인
- [ ] "상태 저장" 버튼 클릭 시 정상 동작
- [ ] 저장 후 페이지 새로고침 시 변경된 값 유지 확인
- [ ] "청구서" 버튼 동작 확인

---

## 1.2 청구서 생성 invoiceDate 오류 수정

### 📍 현재 문제
```
SyntaxError: Failed due to illegal value in property: invoiceDate
```

### 🔍 원인 분석

**가능성 1**: Date 객체 직렬화 실패
- `invoiceDate: params.invoiceDate || new Date()` 에서 Date 객체 그대로 사용

**가능성 2**: 날짜 형식 문제
- 청구DB에 저장 시 ISO 문자열이 아닌 Date 객체 저장 시도

### ✅ 수정 작업

#### 1.2.1 InvoiceService.js 수정

**수정 위치**: `createInvoiceFromSettlement()` 함수

**AS-IS**:
```javascript
var invoiceData = {
  invoiceId: generateInvoiceId(),
  company: params.company,
  type: params.type,
  amount: params.amount,
  invoiceDate: params.invoiceDate || new Date(),  // ❌ Date 객체
  billingType: billingType,
  settlementId: settlementId || '',
  orderNumbers: JSON.stringify(orderNumbers || []),
  status: 'DRAFT',
  createdAt: new Date().toISOString()  // ✅ ISO 문자열
};
```

**TO-BE**:
```javascript
var invoiceData = {
  invoiceId: generateInvoiceId(),
  company: params.company,
  type: params.type,
  amount: params.amount,
  invoiceDate: params.invoiceDate ? new Date(params.invoiceDate).toISOString() : new Date().toISOString(),  // ✅ ISO 문자열
  billingType: billingType,
  settlementId: settlementId || '',
  orderNumbers: JSON.stringify(orderNumbers || []),
  status: 'DRAFT',
  createdAt: new Date().toISOString()
};
```

**파일**: `InvoiceService.js`
**함수**: `createInvoiceFromSettlement()`
**예상 라인**: 청구DB 저장 부분

---

#### 1.2.2 테스트 체크리스트

- [ ] 거래원장 → "청구서" 버튼 클릭 (청구서 없는 경우)
- [ ] "즉시 생성하시겠습니까?" 확인창에서 "예" 클릭
- [ ] 청구서 생성 성공 메시지 확인
- [ ] 청구서관리 페이지에서 생성된 청구서 확인
- [ ] 청구DB 시트에서 invoiceDate 컬럼 확인 (ISO 형식)

---

## 1.3 마감관리 페이지 - 탭 전환 기능 구현

### 📍 현재 문제
- Page_Settlement.html: 매입/매출 탭 HTML만 존재
- JavaScript 탭 전환 로직 없음
- 각 탭의 데이터 로딩 함수 미연결

### ✅ 수정 작업

#### 1.3.1 Page_Settlement.html 확인

현재 탭 구조가 있는지 확인하고, 없으면 추가:

```html
<div class="settlement-tabs">
  <button class="settlement-tab active" data-tab="purchase">매입 마감</button>
  <button class="settlement-tab" data-tab="sales">매출 마감</button>
</div>

<div class="settlement-tab-content active" id="purchase-tab">
  <!-- 매입 마감 내용 -->
</div>

<div class="settlement-tab-content" id="sales-tab">
  <!-- 매출 마감 내용 -->
</div>
```

---

#### 1.3.2 CommonScripts.html 수정

**수정 위치**: `OB.initPurchaseSettlementPage()` 또는 새로운 `OB.initSettlementPage()` 함수 생성

```javascript
OB.initSettlementPage = function() {
  console.log('🔧 Settlement 페이지 초기화 시작');

  var tabs = document.querySelectorAll('.settlement-tab');
  var tabContents = document.querySelectorAll('.settlement-tab-content');

  // 탭 전환 이벤트
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      var targetTab = tab.dataset.tab;

      // 모든 탭 비활성화
      tabs.forEach(function(t) {
        t.classList.remove('active');
      });
      tabContents.forEach(function(tc) {
        tc.classList.remove('active');
      });

      // 선택된 탭 활성화
      tab.classList.add('active');
      var targetContent = document.getElementById(targetTab + '-tab');
      if (targetContent) {
        targetContent.classList.add('active');
      }

      // 탭별 초기화 함수 호출
      if (targetTab === 'purchase') {
        initPurchaseTab();
      } else if (targetTab === 'sales') {
        initSalesTab();
      }
    });
  });

  // 초기 탭 로드
  initPurchaseTab();

  console.log('✅ Settlement 페이지 초기화 완료');
};

function initPurchaseTab() {
  console.log('📋 매입 마감 탭 초기화');
  // 기존 OB.initPurchaseSettlementPage() 로직 호출
  // 또는 매입 마감 데이터 로딩
}

function initSalesTab() {
  console.log('📋 매출 마감 탭 초기화');
  // 기존 OB.initSalesSettlementPage() 로직 호출
  // 또는 매출 마감 데이터 로딩
}
```

---

#### 1.3.3 UiService.js 라우팅 업데이트

```javascript
case 'settlement':
  return 'Page_Settlement';  // 통합 Settlement 페이지
```

**확인**: `OB.initCurrentPage()` 에서 `settlement` 페이지 로드 시 `OB.initSettlementPage()` 호출되도록 설정

---

#### 1.3.4 테스트 체크리스트

- [ ] 사이드바에서 "마감 관리" 메뉴 클릭
- [ ] Page_Settlement.html 로드 확인
- [ ] "매입 마감" 탭 활성화 확인
- [ ] "매출 마감" 탭 클릭 시 전환 확인
- [ ] 각 탭에서 데이터 조회 기능 동작 확인

---

## 1.4 청구서관리 페이지 - 초기화 함수 연결

### 📍 현재 문제
- `initInvoiceManagementPage()` 함수 정의됨
- 페이지 로드 시 초기화 함수 미실행 또는 API 호출 오류

### ✅ 수정 작업

#### 1.4.1 디버깅

```javascript
// CommonScripts.html - OB.initInvoiceManagementPage() 시작 부분에 추가
console.log('🔧 InvoiceManagement 페이지 초기화 시작');

// 각 API 호출 전후에 로그 추가
console.log('📋 청구서 목록 조회 중...');
google.script.run
  .withSuccessHandler(function(result) {
    console.log('✅ 청구서 조회 성공:', result);
    // ...
  })
  .withFailureHandler(function(error) {
    console.error('❌ 청구서 조회 실패:', error);
    // ...
  })
  .getInvoicesApi({});
```

#### 1.4.2 테스트 체크리스트

- [ ] 청구서관리 페이지 접속
- [ ] 콘솔에서 초기화 로그 확인
- [ ] 청구서 목록 조회 성공 확인
- [ ] 필터 기능 동작 확인
- [ ] 상태 변경 기능 동작 확인

---

# 2단계: Phase 1-2 완성 (Priority 2) 🟡

**목표**: 2-Track 청구서 시스템 완전 작동
**기간**: 2-3일
**전제**: 1단계 완료

---

## 2.1 Phase 1-2 통합 테스트

### 2.1.1 Track A (Fast Path) 시나리오

```
1. 거래원장 페이지 접속
2. 발주번호 선택 (청구서 없는 경우)
3. "청구서" 버튼 클릭
4. "청구서가 없습니다. 즉시 생성하시겠습니까?" → "예"
5. 청구서 생성 성공 메시지
6. 청구서관리 페이지로 자동 이동
7. 생성된 청구서 확인 (billingType: DIRECT)
```

### 2.1.2 Track B (Batch) 시나리오

```
1. 마감관리 페이지 접속
2. 매입/매출 마감 실행
3. 청구서관리 페이지 접속
4. 마감 기반 청구서 생성
5. 생성된 청구서 확인 (billingType: SETTLEMENT)
```

### 2.1.3 컨텍스트 네비게이션 시나리오

```
1. 거래원장 페이지 접속
2. 발주번호 선택 (청구서 이미 존재)
3. "청구서" 버튼 클릭
4. "기존 청구서가 있습니다: [청구서ID]" 메시지
5. 청구서관리 페이지로 자동 이동 + 자동 필터링
6. 해당 발주번호의 청구서만 표시 확인
```

---

## 2.2 Phase 1-2 최종 검증

- [ ] Track A 청구서 생성 10회 테스트
- [ ] Track B 청구서 생성 10회 테스트
- [ ] 청구DB에 billingType 컬럼 값 확인
- [ ] orderNumbers JSON 배열 파싱 테스트
- [ ] 컨텍스트 네비게이션 자동 필터링 확인

---

# 3단계: Phase 3-4 완성 (Priority 3) 🟢

**목표**: UI/UX 표준화 + 거래번호 집계
**기간**: 3-4일
**전제**: 1-2단계 완료

---

## 3.1 Phase 3 완성: 메뉴 통합

### 3.1.1 Component_Sidebar.html 검증
- [ ] 메뉴 7개로 축소 확인
- [ ] 불필요한 메뉴 제거 확인

### 3.1.2 레거시 페이지 라우팅
```javascript
// UiService.js
case 'purchaseSettlement':
  return 'Page_Settlement';  // Settlement 탭 페이지로 리다이렉트
case 'salesSettlement':
  return 'Page_Settlement';  // Settlement 탭 페이지로 리다이렉트
```

---

## 3.2 Phase 4 완성: UI/UX 표준화

### 3.2.1 formatCurrency() 실제 적용

**적용 대상 페이지**:
- Page_TransactionLedger.html
- Page_InvoiceManagement.html
- Page_Settlement.html
- Page_BillingManagement.html

**수정 예시**:
```javascript
// AS-IS
td.textContent = '₩' + Number(amount).toLocaleString('ko-KR');

// TO-BE
td.textContent = OB.formatCurrency(amount);
```

---

### 3.2.2 getStatusBadge() 실제 적용

**적용 대상**:
- 거래원장의 4개 상태 컬럼
- 청구서 상태 (DRAFT/ISSUED/PAID)
- 마감 상태

**수정 예시**:
```javascript
// AS-IS
badge.textContent = status;
badge.className = 'status-badge';

// TO-BE
var badge = document.createElement('span');
badge.innerHTML = OB.getStatusBadge(status, 'transaction');
```

---

### 3.2.3 .ob-table 클래스 적용

**적용 방법**:
```html
<!-- AS-IS -->
<table class="ledger-table">

<!-- TO-BE -->
<table class="ob-table">
```

**적용 대상**:
- Page_TransactionLedger.html
- Page_InvoiceManagement.html
- Page_Settlement.html
- Page_BillingManagement.html

---

### 3.2.4 정렬 아이콘 기능 구현

**수정 위치**: CommonScripts.html

```javascript
// 테이블 헤더에 정렬 기능 추가
function makeSortable(table) {
  var headers = table.querySelectorAll('th.sortable');

  headers.forEach(function(header, index) {
    header.addEventListener('click', function() {
      sortTable(table, index, header);
    });
  });
}

function sortTable(table, columnIndex, header) {
  var tbody = table.querySelector('tbody');
  var rows = Array.from(tbody.querySelectorAll('tr'));

  // 정렬 방향 토글
  var isAsc = header.classList.contains('sort-asc');

  // 모든 헤더 정렬 클래스 제거
  table.querySelectorAll('th').forEach(function(th) {
    th.classList.remove('sort-asc', 'sort-desc');
  });

  // 현재 헤더에 정렬 클래스 추가
  header.classList.add(isAsc ? 'sort-desc' : 'sort-asc');

  // 정렬
  rows.sort(function(a, b) {
    var aText = a.cells[columnIndex].textContent.trim();
    var bText = b.cells[columnIndex].textContent.trim();

    // 숫자 정렬
    if (!isNaN(aText) && !isNaN(bText)) {
      return isAsc ? bText - aText : aText - bText;
    }

    // 문자열 정렬
    return isAsc
      ? bText.localeCompare(aText)
      : aText.localeCompare(bText);
  });

  // 정렬된 행 다시 추가
  rows.forEach(function(row) {
    tbody.appendChild(row);
  });
}
```

**HTML 수정**:
```html
<th class="sortable">발주일</th>
<th class="sortable num">공급액</th>
```

---

### 3.2.5 거래번호 단위 집계 + 모달 (최종 목표)

**구현 방식**:
1. 거래원장 페이지에 "집계 보기" / "상세 보기" 토글 추가
2. 집계 모드: 발주번호별로 그룹핑해서 표시
3. 행 클릭 → 모달 오픈 → 품목별 상세 리스트
4. 모달에서 4개 상태 일괄 변경 가능

**구현 코드**: v2.4 아키텍처 문서 Part 6C 참조

---

# 📌 구현 순서 요약

## 1일차
- [x] v2.4 아키텍처 문서 업데이트
- [x] 구현 계획 수립
- [ ] 거래원장 4개 상태 컬럼 구현 (HTML + JS)

## 2일차
- [ ] 거래원장 4개 상태 컬럼 테스트
- [ ] 청구서 생성 invoiceDate 오류 수정
- [ ] 청구서 생성 테스트

## 3일차
- [ ] 마감관리 탭 전환 기능 구현
- [ ] 청구서관리 페이지 디버깅
- [ ] 1단계 전체 테스트

## 4일차
- [ ] Phase 1-2 통합 테스트 (Track A/B)
- [ ] 컨텍스트 네비게이션 테스트
- [ ] 2단계 전체 검증

## 5일차
- [ ] formatCurrency() 실제 적용 (4개 페이지)
- [ ] getStatusBadge() 실제 적용
- [ ] .ob-table 클래스 적용

## 6일차
- [ ] 정렬 아이콘 기능 구현
- [ ] 3단계 테스트

## 7일차
- [ ] 거래번호 집계 + 모달 구현
- [ ] 전체 통합 테스트
- [ ] 버그 수정 및 마무리

---

# ✅ 완료 기준

## 1단계 완료 기준
- [ ] 거래원장 4개 상태 컬럼 표시 및 변경 정상 동작
- [ ] 청구서 생성 오류 없이 성공
- [ ] 마감관리 탭 전환 정상 동작
- [ ] 청구서관리 페이지 조회 정상 동작

## 2단계 완료 기준
- [ ] Track A 청구서 생성 10회 성공
- [ ] Track B 청구서 생성 10회 성공
- [ ] 컨텍스트 네비게이션 자동 필터링 동작

## 3단계 완료 기준
- [ ] 모든 금액이 formatCurrency() 포맷 적용
- [ ] 모든 상태가 getStatusBadge() 배지 표시
- [ ] 모든 테이블이 .ob-table 스타일 적용
- [ ] 정렬 아이콘 동작 (최소 2개 페이지)
- [ ] 거래번호 집계 모달 동작

---

# 🚨 주의사항

1. **단계별 완료 후 다음 단계 진행**
   - 1단계 완료 전에 2단계 시작 금지
   - 각 단계 테스트 완료 후 커밋

2. **기존 작동 기능 보존**
   - 발주입력 페이지 기능 변경 금지
   - 기존 마감 기능 변경 금지
   - API 함수 시그니처 변경 금지

3. **코드 리뷰**
   - 각 단계 완료 시 사용자 확인 필수
   - 버그 발견 시 즉시 수정
   - 테스트 체크리스트 100% 완료 확인

4. **문서 업데이트**
   - 변경사항을 v2.4 아키텍처 문서에 반영
   - Known Issues 섹션 업데이트
   - 변경 이력 작성

---

**구현 계획서 끝**

> 이 문서는 v2.4 개발의 **실행 가이드**입니다.
> 모든 작업은 이 문서의 순서와 체크리스트를 따라 진행합니다.
