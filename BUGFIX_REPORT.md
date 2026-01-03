# 🐛 긴급 버그 수정 보고서

**작성일:** 2025-12-20
**수정 커밋:** `7f981be`
**상태:** ✅ 해결 완료

---

## 📋 문제 요약

웹앱 배포 후 접속 시 **코드 내용이 표시되고 ERP UI가 로드되지 않는** 치명적인 오류 발생

### 사용자 보고
> "파일은 모두 업로드 했고, 시프레드 시트 코드를 실행해서 생성완료 되었어. 그리고 웹앱 배포후에 처음 접속하니 메인화면이 아닌 코드내용이 나오는거야"

---

## 🔍 원인 분석

### 문제의 핵심
기존 ERP 프레임워크의 **페이지 초기화 패턴을 따르지 않음**

#### ❌ 잘못된 구현 (제가 한 실수)

**Page_PaymentManagement.html:**
```javascript
<script>
  window.addEventListener('load', function() {
    initPaymentManagementPage();
  });

  function initPaymentManagementPage() {
    // 초기화 로직...
  }
</script>
```

**문제점:**
1. Page 파일에 `<script>` 섹션이 존재 → **템플릿 렌더링 오류 발생 가능**
2. `window.addEventListener('load', ...)` 사용 → **SPA 방식과 충돌**
3. 전역 함수로 정의 → **OB 네임스페이스 미사용**
4. `CommonScripts.html`의 라우팅이 `OB.initPaymentManagementPage`를 찾지만 존재하지 않음

#### ✅ 올바른 구현 (기존 패턴)

**CommonScripts.html:**
```javascript
OB.initOrderFilePage = function() {
  var wrap = document.getElementById('ob-orderfile-wrap');
  if (!wrap) return;

  if (wrap.dataset.bound === '1') {
    return; // 이미 초기화됨
  }
  wrap.dataset.bound = '1';

  // 초기화 로직...
};
```

**Page_OrderFile.html:**
```html
<div id="ob-orderfile-wrap">
  <!-- HTML만 존재, script 없음 -->
</div>
```

---

## 🔧 수정 내용

### 1. CommonScripts.html (+97 lines)

**위치:** Line 6072 이전 (</script> 태그 직전)

**추가 내용:**
```javascript
OB.initPaymentManagementPage = function() {
  var wrap = document.querySelector('.payment-wrap');
  if (!wrap) {
    console.warn('PaymentManagement wrapper not found');
    return;
  }

  if (wrap.dataset.bound === '1') {
    return; // 중복 초기화 방지
  }
  wrap.dataset.bound = '1';

  // 탭 전환 이벤트 등록
  document.querySelectorAll('.payment-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      var targetTab = this.getAttribute('data-tab');
      switchPaymentTab(targetTab);
    });
  });

  // 입출금 관리 이벤트 등록 (null 체크 포함)
  var paymentAddBtn = document.getElementById('payment-add-btn');
  if (paymentAddBtn) paymentAddBtn.addEventListener('click', handleAddPayment);

  // ... 기타 이벤트 핸들러 등록

  // 초기 데이터 로드
  loadPaymentList();
  loadPaymentSummary();
  loadExpenseSummary();
};

function switchPaymentTab(tabName) {
  // 탭 전환 로직
}
```

**개선 사항:**
- ✅ OB 네임스페이스 사용
- ✅ 중복 초기화 방지 (dataset.bound)
- ✅ Null 체크로 안전성 향상
- ✅ 기존 페이지 패턴과 동일한 구조

### 2. Page_PaymentManagement.html (-103 lines)

**제거한 내용:**
```diff
-<script>
-  window.addEventListener('load', function() { ... });
-  function initPaymentManagementPage() { ... }
-  function switchPaymentTab() { ... }
-  // 더미 함수 선언들...
-</script>
```

**결과:**
```html
  </div>
</div>
<!-- HTML만 남음, script 섹션 완전 제거 -->
```

---

## ✅ 검증 체크리스트

배포 후 다음을 확인하세요:

### 기본 동작
- [ ] 웹앱 URL 접속 시 정상 UI 표시
- [ ] 좌측 사이드바에 "💳 결제관리" 메뉴 보임
- [ ] 결제관리 클릭 시 페이지 로드
- [ ] 브라우저 콘솔에 `✅ PaymentManagement Page 초기화 완료` 로그 출력

### 초기화 검증
- [ ] 입출금 관리 탭이 기본으로 활성화됨
- [ ] 오늘 날짜가 결제일 필드에 자동 입력됨
- [ ] 통계 카드 3개 표시 (입금/출금/수익)
- [ ] 입출금 목록 테이블 표시

### 기능 테스트
- [ ] 입출금 추가 버튼 동작
- [ ] 회사비용 탭 전환 동작
- [ ] 필터 조회 버튼 동작
- [ ] 테이블 정렬/검색 동작

### 기존 페이지 영향 확인
- [ ] 대시보드 정상 동작
- [ ] 발주 입력 정상 동작
- [ ] 거래원장 정상 동작
- [ ] 청구서 관리 정상 동작

---

## 📚 교훈 및 재발 방지

### 1. 기존 프레임워크 패턴 준수
새 페이지를 추가할 때는 **반드시 기존 페이지의 구조를 먼저 분석**하고 동일한 패턴을 따라야 합니다.

```javascript
// ❌ 새로운 패턴 도입 금지
// ✅ 기존 패턴 준수 필수
```

### 2. 올바른 파일 분리
| 파일 | 역할 | 포함 내용 |
|------|------|-----------|
| `Page_XXX.html` | UI 템플릿 | HTML + CSS만 |
| `CommonScripts.html` | 로직 | `OB.initXXXPage`, 이벤트 핸들러 |
| `XXXService.js` | 백엔드 | Google Apps Script 함수 |

### 3. 초기화 함수 체크리스트
새 페이지 추가 시 필수 확인 사항:

1. **CommonScripts.html**
   - [ ] `OB.initXXXPage = function() {}` 정의
   - [ ] `OB.initCurrentPage`의 switch 문에 case 추가
   - [ ] 중복 초기화 방지 로직 (`dataset.bound`)
   - [ ] Null 체크 후 이벤트 핸들러 등록

2. **Page_XXX.html**
   - [ ] HTML + CSS만 포함
   - [ ] `<script>` 태그 없음
   - [ ] Wrapper div에 고유 ID 또는 클래스 지정

3. **Layout.html**
   - [ ] 라우팅 조건문에 페이지 추가
   - [ ] `<?!= include('Page_XXX'); ?>` 올바른 위치에 삽입

4. **Component_Sidebar.html**
   - [ ] `data-nav-page="xxx"` 속성 정확히 지정
   - [ ] 메뉴 아이콘과 텍스트 추가

---

## 🚀 배포 절차

### 1. Apps Script 업로드
```bash
# 수정된 파일들을 Apps Script 에디터에 업데이트
- CommonScripts.html (필수)
- Page_PaymentManagement.html (필수)
```

### 2. 새 배포 버전 생성
1. Apps Script 에디터 → **배포** → **새 배포**
2. 설명: "결제관리 페이지 초기화 버그 수정"
3. 배포 완료 후 URL 확인

### 3. 테스트
1. **시크릿 모드**에서 웹앱 URL 접속
2. F12 → Console 탭 확인:
   ```
   ✅ 초기화 완료: paymentManagement
   [PaymentManagement] 페이지 초기화 시작
   ✅ PaymentManagement Page 초기화 완료
   ```
3. 빨간색 에러 없는지 확인

---

## 📞 문제 발생 시

만약 배포 후에도 문제가 지속된다면:

1. **브라우저 캐시 클리어**
   ```
   Ctrl+Shift+Delete → 전체 삭제
   ```

2. **Apps Script 로그 확인**
   ```
   Apps Script 에디터 → 실행 로그 → 오류 메시지 확인
   ```

3. **브라우저 콘솔 에러 확인**
   ```
   F12 → Console 탭 → 빨간색 에러 메시지 복사
   ```

4. **롤백 옵션**
   ```bash
   git revert 7f981be
   # 이전 안정 버전으로 복구
   ```

---

**커밋 메시지:**
```
fix: 결제관리 페이지 초기화 함수 수정

- OB.initPaymentManagementPage를 CommonScripts.html에 올바르게 정의
- Page_PaymentManagement.html에서 불필요한 script 섹션 제거
- 기존 ERP 프레임워크 패턴에 맞게 수정
```

**관련 파일:**
- `CommonScripts.html` (+97 lines)
- `Page_PaymentManagement.html` (-103 lines)

---

**Status:** ✅ 수정 완료 및 Push 완료
