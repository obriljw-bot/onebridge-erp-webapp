# 🧪 확정수량 수정 기능 테스트 가이드

## 📋 목차
1. [구현 완료된 기능](#구현-완료된-기능)
2. [테스트 전 준비사항](#테스트-전-준비사항)
3. [백엔드 API 테스트](#백엔드-api-테스트)
4. [프론트엔드 통합 가이드](#프론트엔드-통합-가이드)
5. [전체 시나리오 테스트](#전체-시나리오-테스트)
6. [예상 결과](#예상-결과)

---

## 1. 구현 완료된 기능

### ✅ 백엔드 (완료)
```
📁 TransactionService.js (신규 생성)
   ├── updateConfirmedQuantities()  // 확정수량 업데이트 + 금액 재계산
   ├── updateTransactionState()      // 발주 상태 업데이트
   └── getTransactions()             // 거래원장 조회

📁 ApiService.js (업데이트)
   ├── updateConfirmedQuantitiesApi()
   ├── updateTransactionStateApi()
   └── getTransactionsApi()
```

### ⏳ 프론트엔드 (구현 필요)
```
📁 Page_OrderList.html
   └── 확정수량 입력 필드 추가 (모달 내)

📁 CommonScripts.html
   └── 확정수량 저장 이벤트 핸들러
```

---

## 2. 테스트 전 준비사항

### 2.1 Google Apps Script 프로젝트 설정

1. **Apps Script 에디터 열기**
   - Google Sheets → 확장 프로그램 → Apps Script

2. **파일 업로드**
   ```
   ✅ TransactionService.js 추가
   ✅ ApiService.js 업데이트
   ✅ InvoiceService.js 추가 (이전 작업)
   ✅ SettlementService.js 업데이트 (이전 작업)
   ```

3. **스프레드시트 ID 확인**
   ```javascript
   // TransactionService.js 상단 확인
   var OB_TRANSACTION_SS_ID = '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs';
   ```

### 2.2 거래원장 시트 구조 확인

**필수 컬럼**:
```
발주일, 발주번호, 발주처, 매입처, 브랜드, 제품명, 품목코드,
발주수량, 확정수량, 매입가, 공급가,
매입액, 공급액, 마진액, 마진율, 상태
```

**샘플 데이터**:
| 발주일 | 발주번호 | 발주처 | 매입처 | 브랜드 | 제품명 | 발주수량 | 확정수량 | 매입가 | 공급가 |
|--------|----------|--------|--------|--------|--------|----------|----------|--------|--------|
| 2025-12-01 | OL-20251201-001 | 올리브영 | ABC상사 | 브랜드A | 상품1 | 100 | 0 | 10000 | 15000 |
| 2025-12-01 | OL-20251201-001 | 올리브영 | ABC상사 | 브랜드A | 상품2 | 50 | 0 | 20000 | 25000 |

---

## 3. 백엔드 API 테스트

### 3.1 Apps Script 에디터에서 직접 테스트

**테스트 1: 확정수량 업데이트**

```javascript
function testUpdateConfirmedQuantities() {
  var params = {
    updates: [
      { rowIndex: 2, confirmedQty: 95 },  // 행 2: 100 → 95
      { rowIndex: 3, confirmedQty: 48 }   // 행 3: 50 → 48
    ]
  };

  var result = updateConfirmedQuantitiesApi(params);
  Logger.log('결과: ' + JSON.stringify(result));

  /*
  예상 결과:
  {
    success: true,
    updatedCount: 2,
    totalCount: 2,
    message: "2건 업데이트 완료"
  }
  */
}
```

**실행 방법**:
1. Apps Script 에디터에서 위 함수를 추가
2. 함수 선택 → 실행 (▶️)
3. 로그 확인 (View → Logs)

**검증**:
1. 거래원장 시트 열기
2. 행 2, 3의 확정수량이 95, 48로 변경되었는지 확인
3. 매입액, 공급액, 마진액, 마진율이 자동 재계산되었는지 확인

**예상 계산 (행 2)**:
```
발주수량: 100
확정수량: 95 (변경됨)
매입가: 10,000원
공급가: 15,000원

→ 매입액 = 95 × 10,000 = 950,000원
→ 공급액 = 95 × 15,000 = 1,425,000원
→ 마진액 = 1,425,000 - 950,000 = 475,000원
→ 마진율 = (475,000 / 950,000) × 100 = 50%
```

---

**테스트 2: 단건 업데이트**

```javascript
function testSingleUpdate() {
  var params = {
    updates: [
      { rowIndex: 2, confirmedQty: 100 }  // 원래 값으로 복원
    ]
  };

  var result = updateConfirmedQuantitiesApi(params);
  Logger.log(JSON.stringify(result));
}
```

---

**테스트 3: 에러 처리**

```javascript
function testErrorHandling() {
  // 1. 음수 확정수량
  var params1 = {
    updates: [{ rowIndex: 2, confirmedQty: -10 }]
  };
  var result1 = updateConfirmedQuantitiesApi(params1);
  Logger.log('음수 테스트: ' + JSON.stringify(result1));
  // 예상: errors 배열에 "확정수량은 0 이상이어야 합니다." 포함

  // 2. 잘못된 행 번호
  var params2 = {
    updates: [{ rowIndex: 999999, confirmedQty: 10 }]
  };
  var result2 = updateConfirmedQuantitiesApi(params2);
  Logger.log('잘못된 행: ' + JSON.stringify(result2));

  // 3. 빈 업데이트
  var params3 = { updates: [] };
  var result3 = updateConfirmedQuantitiesApi(params3);
  Logger.log('빈 업데이트: ' + JSON.stringify(result3));
  // 예상: success: false, error: "업데이트할 데이터가 없습니다."
}
```

---

## 4. 프론트엔드 통합 가이드

### 4.1 Page_OrderList.html 수정

**모달 본문에 확정수량 입력 필드 추가** (CommonScripts.html에서 동적 렌더링)

```javascript
// CommonScripts.html의 orderlist 섹션에 추가할 코드

// 발주 상세 모달 렌더링 함수 (기존 함수 확장)
function renderOrderDetailModal(orderCode) {
  // ... 기존 코드 ...

  var html = '<div class="orderlist-detail-section">';
  html += '<div class="orderlist-detail-section-title">📦 품목 상세 (확정수량 수정 가능)</div>';
  html += '<table class="orderlist-detail-table">';
  html += '<thead>';
  html += '<tr>';
  html += '<th>제품명</th>';
  html += '<th>품목코드</th>';
  html += '<th class="num">발주수량</th>';
  html += '<th class="num">확정수량</th>';  // ← 입력 가능
  html += '<th class="num">매입가</th>';
  html += '<th class="num">공급가</th>';
  html += '<th class="num">매입액</th>';
  html += '<th class="num">공급액</th>';
  html += '</tr>';
  html += '</thead>';
  html += '<tbody>';

  orderItems.forEach(function(item) {
    html += '<tr>';
    html += '<td>' + (item.productName || '') + '</td>';
    html += '<td>' + (item.productCode || '') + '</td>';
    html += '<td class="num">' + OB.formatNumber(item.orderQty || 0) + '</td>';

    // ✅ 확정수량 입력 필드
    html += '<td class="num">';
    html += '<input type="number" ';
    html += 'class="confirmed-qty-input" ';
    html += 'data-row-index="' + item._rowIndex + '" ';
    html += 'value="' + (item.confirmedQty || 0) + '" ';
    html += 'min="0" ';
    html += 'style="width:80px;text-align:right;padding:4px;" />';
    html += '</td>';

    html += '<td class="num">₩' + OB.formatNumber(item.buyPrice || 0) + '</td>';
    html += '<td class="num">₩' + OB.formatNumber(item.supplyPrice || 0) + '</td>';
    html += '<td class="num" id="purchase-amt-' + item._rowIndex + '">₩' + OB.formatNumber(item.purchaseAmount || 0) + '</td>';
    html += '<td class="num" id="supply-amt-' + item._rowIndex + '">₩' + OB.formatNumber(item.supplyAmount || 0) + '</td>';
    html += '</tr>';
  });

  html += '</tbody>';
  html += '</table>';
  html += '</div>';

  modalBody.innerHTML = html;
}
```

### 4.2 저장 버튼 이벤트 핸들러

```javascript
// CommonScripts.html의 orderlist 섹션에 추가

// 확정수량 저장 버튼 클릭
btnSaveStatus.addEventListener('click', function() {
  OB.showLoading('확정수량 저장 중...');

  // 모든 입력 필드 수집
  var inputs = document.querySelectorAll('.confirmed-qty-input');
  var updates = [];

  inputs.forEach(function(input) {
    var rowIndex = parseInt(input.dataset.rowIndex);
    var confirmedQty = parseInt(input.value) || 0;

    updates.push({
      rowIndex: rowIndex,
      confirmedQty: confirmedQty
    });
  });

  if (updates.length === 0) {
    OB.hideLoading();
    alert('저장할 데이터가 없습니다.');
    return;
  }

  // API 호출
  google.script.run
    .withSuccessHandler(function(response) {
      OB.hideLoading();

      if (response.success) {
        alert('✅ ' + response.message);

        // 모달 닫기
        modal.style.display = 'none';

        // 목록 새로고침
        btnSearch.click();
      } else {
        alert('❌ 저장 실패: ' + response.error);

        if (response.errors && response.errors.length > 0) {
          console.log('에러 상세:', response.errors);
        }
      }
    })
    .withFailureHandler(function(err) {
      OB.hideLoading();
      console.error('API 오류:', err);
      alert('❌ 저장 중 오류 발생: ' + err.message);
    })
    .updateConfirmedQuantitiesApi({ updates: updates });
});
```

---

## 5. 전체 시나리오 테스트

### 시나리오 1: 정상 플로우

**단계 1: 발주 목록 조회**
1. ERP 시스템 접속
2. "발주 내역" 메뉴 클릭
3. 조회 조건 입력 (기간, 발주처 등)
4. "조회" 버튼 클릭
5. 발주 목록이 테이블에 표시되는지 확인

**단계 2: 발주 상세 확인**
1. 발주 목록에서 특정 발주 행 클릭
2. 발주 상세 모달이 열리는지 확인
3. 품목별 발주수량, 확정수량이 표시되는지 확인

**단계 3: 확정수량 수정**
1. 확정수량 입력 필드에 새로운 값 입력
   - 예: 100 → 95
2. 여러 품목의 확정수량을 동시에 수정 가능
3. "💾 상태 저장" 버튼 클릭

**단계 4: 저장 결과 확인**
1. 성공 메시지 확인: "✅ N건 업데이트 완료"
2. 모달 자동 닫힘
3. 발주 목록 자동 새로고침

**단계 5: 금액 재계산 검증**
1. 같은 발주를 다시 클릭하여 상세 모달 열기
2. 확정수량이 변경되었는지 확인
3. 매입액, 공급액, 마진액이 자동 재계산되었는지 확인

---

### 시나리오 2: 에러 처리

**케이스 1: 음수 입력**
- 확정수량에 -10 입력
- 저장 버튼 클릭
- 에러 메시지 확인: "확정수량은 0 이상이어야 합니다."

**케이스 2: 필드 비우기**
- 확정수량 입력 필드를 비움
- 저장 시 0으로 처리되는지 확인

**케이스 3: 발주수량 초과**
- 확정수량을 발주수량보다 크게 입력 (예: 발주 100, 확정 150)
- 저장 가능 (경고 없음)
- 비즈니스 룰에 따라 검증 추가 가능

---

## 6. 예상 결과

### 6.1 성공 케이스

**입력**:
```
행 2: 확정수량 100 → 95
행 3: 확정수량 50 → 48
```

**결과**:
```json
{
  "success": true,
  "updatedCount": 2,
  "totalCount": 2,
  "message": "2건 업데이트 완료"
}
```

**거래원장 시트 변화**:
```
행 2:
  확정수량: 100 → 95
  매입액: 1,000,000 → 950,000 (자동 재계산)
  공급액: 1,500,000 → 1,425,000 (자동 재계산)
  마진액: 500,000 → 475,000 (자동 재계산)
  마진율: 50% → 50% (동일)

행 3:
  확정수량: 50 → 48
  매입액: 1,000,000 → 960,000
  공급액: 1,250,000 → 1,200,000
  마진액: 250,000 → 240,000
  마진율: 25% → 25%
```

### 6.2 실패 케이스

**입력**:
```
행 2: 확정수량 -10 (음수)
행 3: 확정수량 50 (정상)
```

**결과**:
```json
{
  "success": true,
  "updatedCount": 1,
  "totalCount": 2,
  "message": "1건 업데이트 완료 (1건 실패)",
  "errors": [
    "행 2: 확정수량은 0 이상이어야 합니다."
  ]
}
```

---

## 7. 체크리스트

### 백엔드 테스트
- [ ] TransactionService.js 업로드 완료
- [ ] updateConfirmedQuantities() 단독 테스트 성공
- [ ] 금액 자동 재계산 검증 완료
- [ ] 에러 처리 테스트 완료

### 프론트엔드 테스트
- [ ] Page_OrderList.html 모달에 입력 필드 추가
- [ ] 확정수량 입력 가능
- [ ] 저장 버튼 동작 확인
- [ ] 성공 메시지 표시
- [ ] 모달 자동 닫힘
- [ ] 목록 자동 새로고침

### 통합 테스트
- [ ] 발주 조회 → 상세 → 수정 → 저장 전체 플로우 성공
- [ ] 여러 품목 동시 수정 가능
- [ ] 금액 재계산 실시간 반영 (선택사항)
- [ ] 에러 처리 UI 표시

### 비즈니스 로직 검증
- [ ] 매입액 = 확정수량 × 매입가
- [ ] 공급액 = 확정수량 × 공급가
- [ ] 마진액 = 공급액 - 매입액
- [ ] 마진율 = (마진액 / 매입액) × 100

---

## 8. 트러블슈팅

### 문제 1: "updateConfirmedQuantities is not defined"
**원인**: TransactionService.js 파일이 업로드되지 않음
**해결**: Apps Script 프로젝트에 TransactionService.js 추가

### 문제 2: "확정수량 컬럼을 찾을 수 없습니다"
**원인**: 거래원장 시트에 "확정수량" 컬럼 없음
**해결**: 시트 구조 확인 및 컬럼 추가

### 문제 3: 금액이 재계산되지 않음
**원인**: 매입가, 공급가 컬럼이 없거나 값이 없음
**해결**: 시트 데이터 확인

### 문제 4: 입력 필드가 표시되지 않음
**원인**: CommonScripts.html 수정 누락
**해결**: 위 4.1 코드 추가

---

## 9. 다음 단계

✅ **현재 완료**:
- Phase 0: 확정수량 수정 백엔드
- Phase 1: InvoiceService 분리

🎯 **다음 작업**:
- Phase 0: 프론트엔드 UI 완성
- Phase 2: PaymentService 구현
- Phase 3: Adjustment Layer 고도화

---

**작성일**: 2025-12-05
**작성자**: Claude (OneBridge ERP Phase 0 구현)
