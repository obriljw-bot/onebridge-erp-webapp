# 프론트엔드 통합 가이드

## 📋 현재 상황

결제관리 시스템의 **백엔드와 페이지는 모두 구현 완료**되었지만, 메인 앱에 통합되지 않아 접근할 수 없는 상태입니다.

### ✅ 완료된 작업
- `Page_PaymentManagement.html` (20KB) - 결제관리 페이지 UI
- `Page_InvoiceManagement.html` - 청구서 취소/재발급 모달 추가
- `Page_TransactionLedger.html` - 문서 정보 섹션 추가
- `CommonScripts.html` - 모든 JavaScript 함수 구현
- `PaymentService.js` - 백엔드 로직 완성
- `ApiService.js` - API 래퍼 완성

### ❌ 미완료 작업
- **네비게이션 메뉴에 링크 추가**
- **라우팅 설정 추가**
- **페이지 초기화 함수 등록**

---

## 🔧 통합 작업 (3단계)

### Step 1: 사이드바 메뉴에 링크 추가

**파일:** `Component_Sidebar.html`

**위치:** "회계 관리" 섹션 (35-57번째 줄)

**추가할 코드:**
```html
<div>
  <div class="ob-sidebar-section-title">회계 관리</div>
  <ul class="ob-nav-list">
    <li class="ob-nav-item">
      <a href="#" class="ob-nav-link" data-nav-page="settlement">
        <span class="ob-nav-icon">💰</span>
        <span>마감 관리</span>
      </a>
    </li>
    <li class="ob-nav-item">
      <a href="#" class="ob-nav-link" data-nav-page="billingManagement">
        <span class="ob-nav-icon">📑</span>
        <span>청구서 관리</span>
      </a>
    </li>
    <!-- ✨ 여기에 추가 ✨ -->
    <li class="ob-nav-item">
      <a href="#" class="ob-nav-link" data-nav-page="paymentManagement">
        <span class="ob-nav-icon">💳</span>
        <span>결제관리</span>
      </a>
    </li>
    <!-- ✨ 추가 끝 ✨ -->
    <li class="ob-nav-item">
      <a href="#" class="ob-nav-link" data-nav-page="monthlyClosing">
        <span class="ob-nav-icon">📅</span>
        <span>월별 마감</span>
      </a>
    </li>
  </ul>
</div>
```

---

### Step 2: 라우팅 설정 추가

**파일:** `Layout.html`

**위치:** 36-40번째 줄 사이

**추가할 코드:**
```html
<? } else if (page === 'invoiceManagement') { ?>
  <?!= include('Page_InvoiceManagement'); ?>
<!-- ✨ 여기에 추가 ✨ -->
<? } else if (page === 'paymentManagement') { ?>
  <?!= include('Page_PaymentManagement'); ?>
<!-- ✨ 추가 끝 ✨ -->
<? } else if (page === 'settings') { ?>
  <?!= include('Page_Settings'); ?>
```

**전체 컨텍스트:**
```html
<section id="app-main" class="ob-main-content">
  <? if (page === 'dashboard') { ?>
    <?!= include('Page_Dashboard'); ?>
  <? } else if (page === 'orderList') { ?>
    <?!= include('Page_OrderList'); ?>
  <? } else if (page === 'invoiceOutput') { ?>
    <?!= include('Page_InvoiceOutput'); ?>
  <? } else if (page === 'transactionLedger') { ?>
    <?!= include('Page_TransactionLedger'); ?>
  <? } else if (page === 'purchaseSettlement') { ?>
    <?!= include('Page_PurchaseSettlement'); ?>
  <? } else if (page === 'salesSettlement') { ?>
    <?!= include('Page_SalesSettlement'); ?>
  <? } else if (page === 'monthlyClosing') { ?>
    <?!= include('Page_MonthlyClosing'); ?>
  <? } else if (page === 'billingManagement') { ?>
    <?!= include('Page_BillingManagement'); ?>
  <? } else if (page === 'invoiceManagement') { ?>
    <?!= include('Page_InvoiceManagement'); ?>
  <? } else if (page === 'paymentManagement') { ?>
    <?!= include('Page_PaymentManagement'); ?>
  <? } else if (page === 'settings') { ?>
    <?!= include('Page_Settings'); ?>
  <? } else { ?>
    <?!= include('Page_OrderFile'); ?>
  <? } ?>
</section>
```

---

### Step 3: 페이지 초기화 함수 등록

**파일:** `CommonScripts.html`

**위치:** `OB.initCurrentPage` 함수 내부 (약 18-65번째 줄)

**추가할 코드:**
```javascript
switch(page) {
  case 'orderFile':
    initFuncName = 'initOrderFilePage';
    break;
  case 'dashboard':
    initFuncName = 'initDashboardPage';
    break;
  // ... 기존 코드 ...
  case 'invoiceManagement':
    initFuncName = 'initInvoiceManagementPage';
    break;
  // ✨ 여기에 추가 ✨
  case 'paymentManagement':
    initFuncName = 'initPaymentManagementPage';
    break;
  // ✨ 추가 끝 ✨
  case 'settings':
    initFuncName = 'initSettingsPage';
    break;
}
```

**참고:** `initPaymentManagementPage` 함수는 이미 `Page_PaymentManagement.html`의 `<script>` 섹션에 `initPaymentManagementPage`로 정의되어 있습니다.

---

## 🚀 배포 후 확인 사항

통합 완료 후 다음을 확인하세요:

### 1. 네비게이션 테스트
- [ ] 좌측 사이드바에 "💳 결제관리" 메뉴가 보이는가?
- [ ] 클릭시 페이지가 로드되는가?
- [ ] URL이 `?page=paymentManagement`로 변경되는가?

### 2. 페이지 로딩 테스트
- [ ] 입출금 관리 탭이 표시되는가?
- [ ] 회사비용 관리 탭이 표시되는가?
- [ ] 오늘 날짜가 기본값으로 설정되는가?

### 3. 기능 테스트
- [ ] 입출금 추가 버튼이 동작하는가?
- [ ] 필터 조회가 동작하는가?
- [ ] 통계 카드가 표시되는가?

### 4. 다른 페이지 통합 확인
- [ ] 거래원장에서 상세보기 클릭시 결제 내역이 표시되는가?
- [ ] 청구서 관리에서 취소/재발급 버튼이 표시되는가?
- [ ] 청구서 이력 조회가 동작하는가?

---

## 📝 빠른 통합 스크립트

아래 명령어를 순서대로 실행하면 자동으로 통합됩니다:

### 통합 작업 자동화 (수동 실행 필요)

1. **Component_Sidebar.html 수정**
   - 52번째 줄 뒤에 결제관리 메뉴 추가

2. **Layout.html 수정**
   - 37번째 줄 뒤에 paymentManagement 라우팅 추가

3. **CommonScripts.html 수정**
   - switch 문에 paymentManagement case 추가

---

## 🎨 UI/UX 개선 사항 (선택)

통합 후 추가로 개선할 수 있는 사항:

### 1. 메뉴 아이콘 변경
현재: 💳
대안: 💰, 💵, 💸, 🏦, 💴

### 2. 메뉴 위치 조정
현재는 "청구서 관리"와 "월별 마감" 사이에 배치했습니다.
필요시 순서 변경 가능:
- 마감 관리
- 청구서 관리
- **결제관리** ← 현재 위치
- 월별 마감

### 3. 권한 설정 (추후)
특정 사용자만 접근 가능하도록 설정:
```javascript
// Component_Sidebar.html
<? if (hasPermission('payment_management')) { ?>
  <li class="ob-nav-item">
    <a href="#" class="ob-nav-link" data-nav-page="paymentManagement">
      <span class="ob-nav-icon">💳</span>
      <span>결제관리</span>
    </a>
  </li>
<? } ?>
```

---

## 🐛 문제 해결

### 문제 1: 페이지가 로드되지 않음
**원인:** 라우팅 설정 누락
**해결:** Layout.html에 paymentManagement 케이스 추가 확인

### 문제 2: 메뉴 클릭해도 반응 없음
**원인:** data-nav-page 속성 오타
**해결:** `data-nav-page="paymentManagement"` 정확히 입력 확인

### 문제 3: JavaScript 에러 발생
**원인:** 초기화 함수 미등록
**해결:** CommonScripts.html의 switch 문에 case 추가 확인

### 문제 4: API 호출 실패
**원인:** PaymentService.js가 Apps Script에 업로드되지 않음
**해결:** Apps Script 에디터에서 PaymentService.js 파일 존재 확인

---

## 📊 통합 완료 체크리스트

- [ ] Component_Sidebar.html 수정 완료
- [ ] Layout.html 수정 완료
- [ ] CommonScripts.html 수정 완료
- [ ] Apps Script에 PaymentService.js 업로드 확인
- [ ] 웹앱 재배포 (새 배포 버전 생성)
- [ ] 브라우저 캐시 클리어
- [ ] 메뉴에서 "결제관리" 확인
- [ ] 페이지 로딩 확인
- [ ] 기본 기능 테스트 (추가/조회)
- [ ] 통계 표시 확인
- [ ] 필터링 동작 확인

---

## 🚦 다음 단계

통합 완료 후:
1. **TESTING_CHECKLIST.md** 참고하여 전체 기능 테스트
2. 버그 발견시 수정
3. 사용자 매뉴얼 작성 (선택)
4. 프로덕션 배포

---

**작성일:** 2025-12-20
**버전:** 1.0
**상태:** 통합 대기중
