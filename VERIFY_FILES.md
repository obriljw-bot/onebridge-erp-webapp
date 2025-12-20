# 파일 검증 체크리스트

Apps Script에 업로드된 파일이 올바른지 확인하세요.

## 1. Page_PaymentManagement.html 검증

**마지막 3줄이 이렇게 끝나야 합니다:**

```html
  </div>

</div>
```

**❌ 이렇게 끝나면 안됩니다:**
```html
</script>
```

---

## 2. CommonScripts.html 검증

**6072번째 줄 근처에 이 코드가 있어야 합니다:**

```javascript
// ===========================================================
// ✅ PaymentManagement 페이지 초기화 함수
// ===========================================================
OB.initPaymentManagementPage = function() {
```

**검색 방법:** Ctrl+F → "initPaymentManagementPage" 검색

---

## 3. CommonScripts.html의 switch 문 검증

**62번째 줄 근처에 이 코드가 있어야 합니다:**

```javascript
case 'paymentManagement':
  initFuncName = 'initPaymentManagementPage';
  break;
```

**검색 방법:** Ctrl+F → "case 'paymentManagement'" 검색

---

## 4. Layout.html 검증

**38-39번째 줄에 이 코드가 있어야 합니다:**

```html
<? } else if (page === 'paymentManagement') { ?>
  <?!= include('Page_PaymentManagement'); ?>
```

**검색 방법:** Ctrl+F → "paymentManagement" 검색

---

## 5. Component_Sidebar.html 검증

**이 메뉴 항목이 있어야 합니다:**

```html
<li class="ob-nav-item">
  <a href="#" class="ob-nav-link" data-nav-page="paymentManagement">
    <span class="ob-nav-icon">💳</span>
    <span>결제관리</span>
  </a>
</li>
```

**검색 방법:** Ctrl+F → "결제관리" 검색

---

## 확인 완료 후

모든 항목이 맞다면:

1. **Apps Script 에디터에서 Ctrl+S로 모든 파일 저장**
2. **배포 → 배포 관리 → ✏️ 수정 → 새 버전 → 배포**
3. **시크릿 모드로 웹앱 URL 접속**

그래도 문제가 있다면 → **Apps Script 실행 로그** 확인 필요
