# 결제 데이터 미저장 문제 디버깅 가이드

**작성일:** 2025-12-26
**문제:** 결제관리 페이지에서 입출금 내역 추가 시 "추가 완료" 메시지는 나오지만 실제 스프레드시트에 데이터가 저장되지 않음

---

## 1. 코드 검증 결과

### ✅ 전체 코드 경로 정상

```
사용자 클릭
  ↓
[Page_PaymentManagement.html:132]
  <button id="payment-add-btn">추가</button>
  ↓
[CommonScripts.html:6105]
  paymentAddBtn.addEventListener('click', handleAddPayment)
  ↓
[CommonScripts.html:5281-5346]
  function handleAddPayment() {
    // 유효성 검사
    // params 구성
    google.script.run
      .withSuccessHandler(성공 핸들러)
      .addPaymentRecordApi(params);  // ← 5345번 줄
  }
  ↓
[ApiService.js:946-949]
  function addPaymentRecordApi(params) {
    var result = addPaymentRecord(params);
    return safeReturn(result);
  }
  ↓
[PaymentService.js:37-120]
  function addPaymentRecord(params) {
    // 유효성 검증
    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName(PAYMENT_SHEET_NAME);
    // 데이터 구성
    sheet.appendRow(rowData);  // ← 103번 줄: DB 저장
    Logger.log('[addPaymentRecord] ✅ 입출금 기록 추가: ' + paymentId);  // ← 105번 줄
    return { success: true, paymentId: paymentId, ... };
  }
```

**결론:** 모든 코드가 정상적으로 작성되어 있습니다.

---

## 2. 문제 증상 분석

### 증상
- ✅ 사용자가 "추가 완료" 메시지를 봄
- ❌ Apps Script 로그에 `[addPaymentRecord] ✅` 메시지가 없음
- ❌ 스프레드시트 "결제내역" 시트에 데이터가 없음
- ✅ 조회 로그는 정상: `[getPaymentRecords] 조회 완료: 1002건`

### 논리적 모순
만약 `addPaymentRecord`가 실행되어 `success: true`를 반환했다면:
1. 103번 줄의 `sheet.appendRow(rowData)`가 실행되어야 함
2. 105번 줄의 `Logger.log('[addPaymentRecord] ✅...')`가 실행되어야 함
3. 스프레드시트에 데이터가 추가되어야 함

→ **결론: `addPaymentRecord` 함수가 실제로 호출되지 않았을 가능성이 높음**

---

## 3. 가능한 원인 6가지

### 원인 1: 웹앱 배포 문제 ⭐⭐⭐⭐⭐ (가장 가능성 높음)
**설명:** Google Apps Script 프로젝트에서 코드를 수정한 후 "새 배포" 또는 "배포 업데이트"를 하지 않으면 이전 버전의 웹앱이 실행됩니다.

**검증 방법:**
1. Apps Script 편집기에서 `배포 > 배포 관리` 클릭
2. 현재 웹앱 배포의 "버전" 확인
3. 마지막 배포 시간이 코드 수정 시간보다 이전이면 → 배포 문제 확인
4. **해결:** `새 배포` 또는 기존 배포 `편집 > 버전 → 새 버전 생성` → 웹앱 재배포

---

### 원인 2: 브라우저 캐시 ⭐⭐⭐⭐
**설명:** 브라우저가 이전 버전의 HTML/JavaScript를 캐시하고 있을 수 있습니다.

**검증 방법:**
1. 브라우저 개발자 도구 열기 (F12)
2. `Network` 탭 → `Disable cache` 체크
3. 페이지 강제 새로고침: `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac)
4. 또는 시크릿 모드(Incognito)로 웹앱 열기

---

### 원인 3: 스프레드시트 ID 불일치 ⭐⭐⭐
**설명:** 사용자가 보고 있는 스프레드시트가 코드에서 사용하는 스프레드시트와 다를 수 있습니다.

**검증 방법:**
1. 현재 보고 있는 스프레드시트 URL 확인
2. URL에서 ID 추출: `https://docs.google.com/spreadsheets/d/{이 부분이 ID}/edit`
3. PaymentService.js:15의 PAYMENT_SS_ID와 비교:
   ```javascript
   var PAYMENT_SS_ID = '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs';
   ```
4. **일치하지 않으면:** 잘못된 스프레드시트를 보고 있음 → 올바른 스프레드시트 열기

---

### 원인 4: 시트 필터 ⭐⭐⭐
**설명:** 스프레드시트에 필터가 적용되어 있어 새로 추가된 데이터가 숨겨졌을 수 있습니다.

**검증 방법:**
1. "결제내역" 시트에서 필터 아이콘 확인 (컬럼 헤더에 깔때기 모양)
2. **해결:**
   - 메뉴: `데이터 > 필터 해제`
   - 또는: 필터 아이콘 클릭 → `모두 선택` 체크
3. 시트 맨 아래로 스크롤하여 최근 추가된 데이터 확인

---

### 원인 5: 잘못된 탭에서 작업 ⭐⭐
**설명:** 사용자가 "회사비용" 탭에서 데이터를 추가했는데 "결제내역" 시트를 확인하고 있을 수 있습니다.

**검증 방법:**
1. 웹앱에서 현재 활성화된 탭 확인
   - "입출금 관리" 탭: 데이터가 "결제내역" 시트에 저장됨
   - "회사비용 관리" 탭: 데이터가 "회사비용" 시트에 저장됨
2. **확인 메시지 차이:**
   - 입출금: `"입출금 내역이 추가되었습니다.\n결제ID: PAY-xxxxx"`
   - 회사비용: `"회사비용이 추가되었습니다.\n비용ID: EXP-xxxxx"`
3. 사용자가 본 메시지와 확인 중인 시트가 일치하는지 확인

---

### 원인 6: Apps Script 실행 로그 타이밍 ⭐
**설명:** 사용자가 확인한 로그가 데이터 추가 작업 이전의 로그일 수 있습니다.

**검증 방법:**
1. Apps Script 편집기 → `실행 로그` 또는 `로그` 메뉴
2. **중요:** 시간순 정렬 확인 (최신이 맨 위)
3. "추가" 버튼 클릭 직후 즉시 로그 새로고침
4. 가장 최근 실행 기록에서 `[addPaymentRecord]` 검색

---

## 4. 체계적 디버깅 절차

### Step 1: 브라우저 콘솔 확인
**목적:** 클라이언트 사이드 오류 확인

1. 웹앱에서 F12 → `Console` 탭
2. 콘솔 내용 전체 캡처
3. 추가 버튼 클릭
4. 콘솔에 출력되는 모든 메시지 확인
   - 에러 메시지 (빨간색)
   - `[ERROR]` 로그
   - API 호출 관련 메시지

**기대 결과:**
- `[PaymentManagement] 페이지 초기화 시작`
- `✅ PaymentManagement Page 초기화 완료`
- 클릭 시 에러가 없어야 함

---

### Step 2: Apps Script 실행 로그 확인
**목적:** 서버 사이드 함수 실행 여부 확인

1. Apps Script 편집기 열기
2. `실행 로그` 또는 상단 메뉴 `보기 > 로그`
3. 추가 버튼 클릭
4. 즉시 로그 새로고침 (F5)
5. 다음 로그 검색:
   ```
   [addPaymentRecord] ✅ 입출금 기록 추가: PAY-xxxxx
   ```

**Case A - 로그가 있으면:**
→ 함수는 실행됨 → 스프레드시트 확인 (원인 3, 4)

**Case B - 로그가 없으면:**
→ 함수가 실행되지 않음 → 배포 또는 캐시 문제 (원인 1, 2)

---

### Step 3: 스프레드시트 확인
**목적:** 데이터가 실제로 저장되었는지 확인

1. 스프레드시트 URL 확인: ID가 `1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs`인지
2. "결제내역" 시트 열기
3. 필터 해제: `데이터 > 필터 해제`
4. 시트 맨 아래로 스크롤 (Ctrl+End)
5. 최근 추가된 행 확인

**확인 사항:**
- 컬럼 구조: 결제ID | 결제일 | 결제유형 | 거래처명 | 금액 | 결제수단 | ...
- 최근 데이터의 "입력일시" 컬럼 확인

---

### Step 4: 웹앱 재배포
**목적:** 최신 코드가 웹앱에 반영되도록 보장

1. Apps Script 편집기 → `배포 > 배포 관리`
2. 현재 웹앱 배포 선택 → `편집` 버튼
3. "새 버전 설명" 입력: `결제 데이터 저장 디버깅`
4. `버전` → `새 버전 생성` 선택
5. `배포` 클릭
6. **중요:** 웹앱 URL이 변경되지 않았는지 확인
7. 브라우저 시크릿 모드에서 웹앱 다시 열기
8. 재테스트

---

## 5. 즉시 확인 가능한 테스트

### 최소 재현 테스트
```
1. 웹앱 열기 (시크릿 모드 권장)
2. F12 → Console 탭 열기
3. "입출금 관리" 탭 확인
4. 폼 입력:
   - 결제일: 2025-12-26
   - 결제유형: 입금
   - 거래처명: 테스트거래처
   - 금액: 10000
   - 결제수단: 현금
5. "추가" 버튼 클릭
6. 즉시 확인:
   a) 브라우저 콘솔에 에러가 있는지
   b) alert 메시지 정확한 내용
   c) Apps Script 실행 로그
   d) 스프레드시트 시트 맨 아래 행
```

---

## 6. 디버깅 로그 수집 요청

다음 정보를 수집하여 전달해주세요:

### A. Alert 메시지
- 정확한 메시지 내용 (스크린샷 또는 복사)
- 결제ID 또는 비용ID 포함 여부

### B. 브라우저 콘솔 (F12)
```javascript
// Console 탭 전체 내용
// 특히 다음 항목:
- [PaymentManagement] 관련 로그
- [ERROR] 로그
- 빨간색 에러 메시지
```

### C. Apps Script 실행 로그
```
// 실행 로그 > 가장 최근 3개 실행 기록
// 각 실행의:
- 실행 시간
- 함수명
- 로그 내용
```

### D. 스프레드시트 정보
```
- 현재 보고 있는 스프레드시트 URL
- "결제내역" 시트의 마지막 행 번호
- 필터 적용 여부 (Y/N)
- 마지막 데이터의 "결제ID" 값
```

### E. 배포 정보
```
Apps Script > 배포 > 배포 관리
- 현재 배포 버전
- 마지막 배포 시간
```

---

## 7. 임시 해결책

문제가 계속되면 다음 임시 해결책 시도:

### 방법 1: 직접 Apps Script 실행
```javascript
// Apps Script 편집기에서 직접 실행하여 테스트
function testAddPayment() {
  var params = {
    date: '2025-12-26',
    type: '입금',
    company: '테스트거래처',
    amount: 10000,
    method: '현금',
    docNumber: '',
    orderNumber: '',
    notes: '테스트'
  };

  var result = addPaymentRecord(params);
  Logger.log('결과: ' + JSON.stringify(result));

  // 스프레드시트 확인
  var ss = SpreadsheetApp.openById('1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs');
  var sheet = ss.getSheetByName('결제내역');
  var lastRow = sheet.getLastRow();
  Logger.log('마지막 행: ' + lastRow);
  Logger.log('마지막 데이터: ' + JSON.stringify(sheet.getRange(lastRow, 1, 1, 14).getValues()));
}
```

실행 결과를 확인하여:
- 함수가 정상 작동하는지
- 스프레드시트에 데이터가 추가되는지
- 로그가 정상 출력되는지 확인

---

## 8. 결론

**현재 상황:**
- 코드는 완벽하게 작성되어 있음
- 문제는 실행 환경 또는 배포 관련 이슈일 가능성이 높음

**최우선 확인 사항:**
1. 웹앱 재배포 (새 버전 생성)
2. 브라우저 캐시 클리어 (시크릿 모드)
3. 스프레드시트 ID 확인
4. 시트 필터 해제

**다음 단계:**
위 디버깅 절차를 순서대로 수행하고 각 단계의 결과를 수집하여 전달해주시면 정확한 원인을 파악할 수 있습니다.

---

**작성자:** Claude Code
**문서 버전:** 1.0
**마지막 업데이트:** 2025-12-26
