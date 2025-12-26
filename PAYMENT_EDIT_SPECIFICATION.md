# 입출금/회사비용 수정 기능 개발 명세서

**작성일:** 2025-12-26
**버전:** 1.0
**목적:** 결제관리 시스템의 수정 기능 구현 및 발주DB 연동

---

## 1. 개요

### 1.1. 요구사항 요약
- 입출금 내역 및 회사비용 내역을 인라인 편집 방식으로 수정
- 입출금 수정 시 연결된 발주번호의 매입결제/매출결제 상태를 자동 동기화
- 발주 금액과 결제 합계를 비교하여 결제 상태 자동 판단 (미결제/부분결제/결제완료)

### 1.2. 핵심 기능
1. **인라인 편집**: 테이블 행을 직접 편집 가능하게 구현
2. **발주 연동**: 입출금 수정 시 발주DB의 결제 상태 자동 업데이트
3. **결제 상태 자동 계산**: 발주 금액 대비 결제 합계로 상태 판단
4. **유효성 검사**: 추가 시와 동일한 필수값 및 형식 검증

---

## 2. 기존 코드 분석

### 2.1. 백엔드 함수 현황

#### ✅ 이미 구현된 함수
```javascript
// PaymentService.js:272
function updatePaymentRecord(params) {
  // 입출금 내역 수정 (발주 연동 로직 없음)
}

// PaymentService.js (추정 700번대)
function updateExpenseRecord(params) {
  // 회사비용 수정 (발주 연동 없음)
}

// ApiService.js:356
function updateOrderStatus(orderId, statuses) {
  // 발주 상태 업데이트 (payBuy, paySell 지원)
  // statuses = { payBuy: '결제완료', paySell: '부분결제' }
}

// ApiService.js:290
function getOrderDetail(orderId) {
  // 발주 상세 정보 조회
  // returns: { success, orderItems: [{ 발주번호, 확정금액, 매입결제, 매출결제, ... }] }
}
```

#### ❌ 프론트엔드 미구현
```javascript
// CommonScripts.html:5546
function editPayment(paymentId) {
  alert('입출금 내역 수정 기능은 향후 구현 예정입니다.\n결제ID: ' + paymentId);
  // TODO: 편집 모달 구현
}
```

### 2.2. 발주DB 구조

**시트:** `청구DB` (스프레드시트 ID: `1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs`)

**핵심 컬럼:**
| 컬럼명 | 설명 | 가능한 값 |
|--------|------|-----------|
| 발주번호 | 고유 발주 번호 | PO-YYYYMMDD-XXX |
| 확정금액 | 발주 총 금액 | 숫자 |
| 매입결제 | 매입처에 대한 결제 상태 | 미결제 / 부분결제 / 결제완료 |
| 매출결제 | 발주처로부터의 결제 상태 | 미결제 / 부분결제 / 결제완료 |

**매핑 규칙:**
- **결제유형 = 출금** → **매입결제** 컬럼 업데이트 (우리가 매입처에게 지불)
- **결제유형 = 입금** → **매출결제** 컬럼 업데이트 (발주처가 우리에게 지불)

---

## 3. 수정 가능 필드

### 3.1. 입출금 내역
| 필드명 | 수정 가능 | 비고 |
|--------|----------|------|
| 결제ID | ❌ | 변경 불가 (고유키) |
| 결제일 | ✅ | 날짜 형식 검증 |
| 결제유형 | ✅ | 입금/출금 (드롭다운) |
| 거래처명 | ✅ | 필수값 |
| 금액 | ✅ | 양수, 숫자 검증 |
| 결제수단 | ✅ | 드롭다운 |
| 문서번호 | ✅ | 선택 |
| **발주번호** | ❌ | **변경 불가** (발주 연동 복잡도 때문) |
| 비고 | ✅ | 선택 |
| 삭제여부 | ❌ | 삭제 기능으로만 처리 |
| 입력일시/자 | ❌ | 시스템 자동 관리 |

### 3.2. 회사비용
| 필드명 | 수정 가능 | 비고 |
|--------|----------|------|
| 비용ID | ❌ | 변경 불가 (고유키) |
| 비용일 | ✅ | 날짜 형식 검증 |
| 비용항목 | ✅ | 드롭다운 |
| 금액 | ✅ | 양수, 숫자 검증 |
| 결제수단 | ✅ | 드롭다운 |
| 비고 | ✅ | 선택 |
| 삭제여부 | ❌ | 삭제 기능으로만 처리 |

---

## 4. 발주 연동 로직 설계

### 4.1. 결제 상태 계산 알고리즘

```javascript
/**
 * 발주의 결제 상태 계산
 * @param {string} orderId - 발주번호
 * @param {string} paymentType - '입금' 또는 '출금'
 * @return {string} '미결제' | '부분결제' | '결제완료'
 */
function calculatePaymentStatus(orderId, paymentType) {
  // 1. 발주 정보 조회
  var orderResult = getOrderDetail(orderId);
  if (!orderResult.success || orderResult.orderItems.length === 0) {
    return '미결제'; // 발주 없으면 미결제로 처리
  }

  var order = orderResult.orderItems[0];
  var totalAmount = Number(order['확정금액']) || 0;

  if (totalAmount === 0) {
    return '미결제';
  }

  // 2. 해당 발주번호에 대한 모든 입출금 내역 조회
  var paymentsResult = getPaymentRecords({
    includeDeleted: false  // 삭제된 항목 제외
  });

  if (!paymentsResult.success) {
    return '미결제';
  }

  // 3. 해당 발주번호 + 결제유형에 맞는 결제 합계 계산
  var totalPaid = 0;
  paymentsResult.payments.forEach(function(payment) {
    if (payment.orderNumber === orderId && payment.type === paymentType) {
      totalPaid += Number(payment.amount) || 0;
    }
  });

  // 4. 상태 판단
  if (totalPaid === 0) {
    return '미결제';
  } else if (totalPaid < totalAmount) {
    return '부분결제';
  } else {
    return '결제완료';
  }
}
```

### 4.2. 발주 상태 업데이트 플로우

```
[입출금 수정 요청]
    ↓
[1. updatePaymentRecord 실행]
    ↓
[2. 수정 전 발주번호 확인]
    ↓
[3. 발주번호가 있는가?]
    ↓ YES
[4. 결제유형 확인]
    ├─ 입금 → 매출결제 상태 계산
    └─ 출금 → 매입결제 상태 계산
    ↓
[5. calculatePaymentStatus 호출]
    ↓
[6. updateOrderStatus 호출]
    ↓
[7. 발주DB 상태 업데이트]
    ↓
[성공 응답 + 목록 새로고침]
```

---

## 5. 백엔드 구현

### 5.1. PaymentService.js 수정

#### 5.1.1. 새 함수 추가: calculatePaymentStatus

```javascript
/**
 * 발주의 결제 상태 자동 계산
 * @param {string} orderId - 발주번호
 * @param {string} paymentType - '입금' 또는 '출금'
 * @return {string} '미결제' | '부분결제' | '결제완료'
 */
function calculatePaymentStatus(orderId, paymentType) {
  try {
    if (!orderId || !paymentType) {
      return '미결제';
    }

    // 1. 발주 정보 조회
    var orderResult = getOrderDetail(orderId);
    if (!orderResult.success || !orderResult.orderItems || orderResult.orderItems.length === 0) {
      Logger.log('[calculatePaymentStatus] 발주 없음: ' + orderId);
      return '미결제';
    }

    var order = orderResult.orderItems[0];
    var totalAmount = Number(order['확정금액']) || 0;

    if (totalAmount === 0) {
      Logger.log('[calculatePaymentStatus] 발주 금액 0: ' + orderId);
      return '미결제';
    }

    // 2. 해당 발주번호에 대한 모든 입출금 내역 조회
    var paymentsResult = getPaymentRecords({
      includeDeleted: false
    });

    if (!paymentsResult.success) {
      Logger.log('[calculatePaymentStatus] 입출금 조회 실패');
      return '미결제';
    }

    // 3. 해당 발주번호 + 결제유형에 맞는 결제 합계 계산
    var totalPaid = 0;
    var payments = paymentsResult.payments || [];

    for (var i = 0; i < payments.length; i++) {
      var payment = payments[i];
      if (payment.orderNumber === orderId && payment.type === paymentType) {
        totalPaid += Number(payment.amount) || 0;
      }
    }

    Logger.log('[calculatePaymentStatus] 발주: ' + orderId + ', 총액: ' + totalAmount + ', 결제액: ' + totalPaid);

    // 4. 상태 판단
    if (totalPaid === 0) {
      return '미결제';
    } else if (totalPaid < totalAmount) {
      return '부분결제';
    } else {
      return '결제완료';
    }

  } catch (error) {
    Logger.log('[calculatePaymentStatus] ❌ 오류: ' + error.message);
    return '미결제';
  }
}
```

#### 5.1.2. 새 함수 추가: syncOrderPaymentStatus

```javascript
/**
 * 입출금 내역과 발주DB 결제 상태 동기화
 * @param {string} orderNumber - 발주번호
 * @param {string} paymentType - '입금' 또는 '출금'
 * @return {Object} { success, message, error }
 */
function syncOrderPaymentStatus(orderNumber, paymentType) {
  try {
    if (!orderNumber || orderNumber === '') {
      return { success: true, message: '발주번호 없음 (동기화 불필요)' };
    }

    if (!paymentType || (paymentType !== '입금' && paymentType !== '출금')) {
      return {
        success: false,
        error: '결제유형이 올바르지 않습니다: ' + paymentType
      };
    }

    // 결제 상태 계산
    var status = calculatePaymentStatus(orderNumber, paymentType);

    // 발주DB 업데이트할 컬럼 결정
    var statusKey = paymentType === '입금' ? 'paySell' : 'payBuy';
    var statuses = {};
    statuses[statusKey] = status;

    // 발주 상태 업데이트
    var updateResult = updateOrderStatus(orderNumber, statuses);

    if (!updateResult.success) {
      Logger.log('[syncOrderPaymentStatus] ❌ 발주 상태 업데이트 실패: ' + updateResult.error);
      return {
        success: false,
        error: '발주 상태 업데이트 실패: ' + updateResult.error
      };
    }

    Logger.log('[syncOrderPaymentStatus] ✅ 발주 ' + orderNumber + ' - ' + statusKey + ': ' + status);

    return {
      success: true,
      message: '발주 상태 동기화 완료',
      orderNumber: orderNumber,
      statusKey: statusKey,
      status: status
    };

  } catch (error) {
    Logger.log('[syncOrderPaymentStatus] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '발주 동기화 중 오류: ' + error.message
    };
  }
}
```

#### 5.1.3. updatePaymentRecord 함수 수정

**기존 코드 위치:** PaymentService.js:272

**수정 내용:**
```javascript
function updatePaymentRecord(params) {
  try {
    if (!params.paymentId) {
      return {
        success: false,
        error: '결제ID가 필요합니다.'
      };
    }

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName(PAYMENT_SHEET_NAME);

    if (!sheet) {
      return {
        success: false,
        error: '결제내역 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();
    var header = data[0];

    var col = function(name) { return header.indexOf(name); };
    var cPaymentId = col('결제ID');
    var cOrderNumber = col('발주번호');  // ← 추가
    var cType = col('결제유형');          // ← 추가

    // 해당 행 찾기
    var rowIndex = -1;
    var oldOrderNumber = '';  // ← 추가
    var oldType = '';         // ← 추가

    for (var i = 1; i < data.length; i++) {
      if (data[i][cPaymentId] === params.paymentId) {
        rowIndex = i + 1; // 1-based
        oldOrderNumber = data[i][cOrderNumber] || '';  // ← 추가
        oldType = data[i][cType] || '';                // ← 추가
        break;
      }
    }

    if (rowIndex === -1) {
      return {
        success: false,
        error: '해당 결제 기록을 찾을 수 없습니다.'
      };
    }

    // 업데이트할 필드
    if (params.date) {
      sheet.getRange(rowIndex, col('결제일') + 1).setValue(new Date(params.date));
    }
    if (params.type) {
      sheet.getRange(rowIndex, col('결제유형') + 1).setValue(params.type);
    }
    if (params.company) {
      sheet.getRange(rowIndex, col('거래처명') + 1).setValue(params.company);
    }
    if (params.amount !== undefined) {
      sheet.getRange(rowIndex, col('금액') + 1).setValue(Number(params.amount));
    }
    if (params.method) {
      sheet.getRange(rowIndex, col('결제수단') + 1).setValue(params.method);
    }
    if (params.docNumber !== undefined) {
      sheet.getRange(rowIndex, col('문서번호') + 1).setValue(params.docNumber);
    }
    // 발주번호는 수정 불가 (사용자 요구사항)
    if (params.notes !== undefined) {
      sheet.getRange(rowIndex, col('비고') + 1).setValue(params.notes);
    }

    Logger.log('[updatePaymentRecord] ✅ 입출금 수정: ' + params.paymentId);

    // ========== 추가: 발주 연동 로직 ==========
    var newType = params.type || oldType;

    if (oldOrderNumber && oldOrderNumber !== '') {
      // 발주 상태 재계산 및 동기화
      var syncResult = syncOrderPaymentStatus(oldOrderNumber, newType);
      if (!syncResult.success) {
        Logger.log('[updatePaymentRecord] ⚠️ 발주 동기화 실패: ' + syncResult.error);
        // 동기화 실패해도 입출금 수정은 성공으로 처리
      }
    }
    // =========================================

    return {
      success: true,
      message: '입출금 기록이 수정되었습니다.'
    };

  } catch (error) {
    Logger.log('[updatePaymentRecord] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '입출금 수정 중 오류 발생: ' + error.message
    };
  }
}
```

### 5.2. addPaymentRecord 함수도 수정 필요

**문제:** 현재 추가 시에는 발주 상태를 업데이트하지 않음

**수정 위치:** PaymentService.js:37 (addPaymentRecord 함수 끝부분)

```javascript
function addPaymentRecord(params) {
  // ... 기존 코드 ...

  var nextRow = lastDataRow + 1;
  sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);

  Logger.log('[addPaymentRecord] ✅ 입출금 기록 추가 (' + nextRow + '행): ' + paymentId);

  // ========== 추가: 발주 연동 로직 ==========
  if (params.orderNumber && params.orderNumber !== '') {
    var syncResult = syncOrderPaymentStatus(params.orderNumber, params.type);
    if (!syncResult.success) {
      Logger.log('[addPaymentRecord] ⚠️ 발주 동기화 실패: ' + syncResult.error);
    }
  }
  // =========================================

  return {
    success: true,
    paymentId: paymentId,
    message: '입출금 기록이 추가되었습니다.'
  };
}
```

---

## 6. 프론트엔드 구현

### 6.1. 인라인 편집 UI 설계

**방식:** 테이블 행을 더블클릭하면 편집 모드로 전환

**편집 모드 UI:**
```
일반 모드:    2025-12-26  |  입금  |  A거래처  |  10,000원  |  현금  | [수정] [삭제]
                ↓ 더블클릭
편집 모드:    [날짜입력] | [드롭다운] | [텍스트] | [숫자] | [드롭다운] | [저장] [취소]
```

### 6.2. CommonScripts.html 구현

#### 6.2.1. editPayment 함수 대체

**위치:** CommonScripts.html:5546

```javascript
/**
 * 입출금 내역 수정 - 인라인 편집 모드 활성화
 * @param {string} paymentId - 결제ID
 */
function editPayment(paymentId) {
  var row = document.querySelector('tr[data-payment-id="' + paymentId + '"]');
  if (!row) {
    alert('해당 결제 내역을 찾을 수 없습니다.');
    return;
  }

  // 이미 편집 중인지 확인
  if (row.classList.contains('editing')) {
    return;
  }

  // 다른 편집 중인 행이 있으면 취소
  var editingRows = document.querySelectorAll('.payment-list tbody tr.editing');
  editingRows.forEach(function(r) {
    cancelEditPayment(r.dataset.paymentId);
  });

  // 편집 모드로 전환
  row.classList.add('editing');

  // 원본 데이터 저장 (취소 시 복원용)
  row.dataset.original = JSON.stringify({
    date: row.cells[1].textContent,
    type: row.cells[2].querySelector('.payment-badge').textContent,
    company: row.cells[3].textContent,
    amount: row.cells[4].textContent.replace(/[₩,]/g, '').trim(),
    method: row.cells[5].textContent,
    docNumber: row.cells[6].textContent,
    orderNumber: row.cells[7].textContent,
    notes: row.cells[8].textContent
  });

  // 각 셀을 입력 폼으로 변환
  var cells = row.cells;

  // 결제일 (1번 셀)
  cells[1].innerHTML = '<input type="date" class="edit-input" value="' + cells[1].textContent + '" />';

  // 결제유형 (2번 셀)
  var currentType = cells[2].querySelector('.payment-badge').textContent;
  cells[2].innerHTML =
    '<select class="edit-select">' +
    '<option value="입금"' + (currentType === '입금' ? ' selected' : '') + '>입금</option>' +
    '<option value="출금"' + (currentType === '출금' ? ' selected' : '') + '>출금</option>' +
    '</select>';

  // 거래처명 (3번 셀)
  cells[3].innerHTML = '<input type="text" class="edit-input" value="' + cells[3].textContent + '" />';

  // 금액 (4번 셀)
  var amount = cells[4].textContent.replace(/[₩,]/g, '').trim();
  cells[4].innerHTML = '<input type="number" class="edit-input" value="' + amount + '" min="1" />';

  // 결제수단 (5번 셀)
  var currentMethod = cells[5].textContent;
  cells[5].innerHTML =
    '<select class="edit-select">' +
    '<option value="현금"' + (currentMethod === '현금' ? ' selected' : '') + '>현금</option>' +
    '<option value="카드"' + (currentMethod === '카드' ? ' selected' : '') + '>카드</option>' +
    '<option value="계좌이체"' + (currentMethod === '계좌이체' ? ' selected' : '') + '>계좌이체</option>' +
    '<option value="기타"' + (currentMethod === '기타' ? ' selected' : '') + '>기타</option>' +
    '</select>';

  // 문서번호 (6번 셀)
  cells[6].innerHTML = '<input type="text" class="edit-input" value="' + cells[6].textContent + '" />';

  // 발주번호 (7번 셀) - 수정 불가, 읽기 전용 표시
  cells[7].innerHTML = '<span style="color:#9ca3af;">' + cells[7].textContent + ' (수정불가)</span>';

  // 비고 (8번 셀)
  cells[8].innerHTML = '<input type="text" class="edit-input" value="' + cells[8].textContent + '" />';

  // 액션 버튼 (10번 셀)
  cells[10].innerHTML =
    '<button class="payment-btn payment-btn-small success" onclick="savePaymentEdit(\'' + paymentId + '\')">저장</button> ' +
    '<button class="payment-btn payment-btn-small" onclick="cancelEditPayment(\'' + paymentId + '\')">취소</button>';
}

/**
 * 입출금 수정 저장
 */
function savePaymentEdit(paymentId) {
  var row = document.querySelector('tr[data-payment-id="' + paymentId + '"]');
  if (!row) return;

  var cells = row.cells;

  // 입력값 수집
  var date = cells[1].querySelector('input').value;
  var type = cells[2].querySelector('select').value;
  var company = cells[3].querySelector('input').value.trim();
  var amount = parseFloat(cells[4].querySelector('input').value);
  var method = cells[5].querySelector('select').value;
  var docNumber = cells[6].querySelector('input').value.trim();
  var notes = cells[8].querySelector('input').value.trim();

  // 유효성 검사
  if (!date) {
    alert('결제일을 입력하세요.');
    cells[1].querySelector('input').focus();
    return;
  }
  if (!type) {
    alert('결제유형을 선택하세요.');
    cells[2].querySelector('select').focus();
    return;
  }
  if (!company) {
    alert('거래처명을 입력하세요.');
    cells[3].querySelector('input').focus();
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    alert('올바른 금액을 입력하세요.');
    cells[4].querySelector('input').focus();
    return;
  }
  if (!method) {
    alert('결제수단을 선택하세요.');
    cells[5].querySelector('select').focus();
    return;
  }

  var params = {
    paymentId: paymentId,
    date: date,
    type: type,
    company: company,
    amount: amount,
    method: method,
    docNumber: docNumber || '',
    notes: notes || ''
  };

  OB.showLoading('입출금 내역 수정 중...');

  google.script.run
    .withSuccessHandler(function(result) {
      OB.hideLoading();

      if (!result || !result.success) {
        alert('입출금 내역 수정 실패: ' + (result ? result.error : '알 수 없는 오류'));
        return;
      }

      alert('입출금 내역이 수정되었습니다.');

      // 편집 모드 해제 및 목록 새로고침
      row.classList.remove('editing');
      loadPaymentList();
      loadPaymentSummary();
    })
    .withFailureHandler(function(error) {
      OB.hideLoading();
      console.error('[ERROR] Update payment failed:', error);
      alert('입출금 내역 수정 실패: ' + error.message);
    })
    .updatePaymentRecordApi(params);
}

/**
 * 입출금 수정 취소
 */
function cancelEditPayment(paymentId) {
  var row = document.querySelector('tr[data-payment-id="' + paymentId + '"]');
  if (!row || !row.classList.contains('editing')) return;

  // 원본 데이터 복원
  if (row.dataset.original) {
    var original = JSON.parse(row.dataset.original);
    var cells = row.cells;

    cells[1].textContent = original.date;
    cells[2].innerHTML = '<span class="payment-badge ' +
      (original.type === '입금' ? 'income' : 'expense') + '">' +
      original.type + '</span>';
    cells[3].textContent = original.company;
    cells[4].innerHTML = '₩' + OB.formatNumber(original.amount);
    cells[5].textContent = original.method;
    cells[6].textContent = original.docNumber || '-';
    cells[7].textContent = original.orderNumber || '-';
    cells[8].textContent = original.notes || '-';
    cells[10].innerHTML =
      '<button class="payment-btn payment-btn-small warning" onclick="editPayment(\'' + paymentId + '\')">수정</button> ' +
      '<button class="payment-btn payment-btn-small danger" onclick="deletePayment(\'' + paymentId + '\')">삭제</button>';

    delete row.dataset.original;
  }

  row.classList.remove('editing');
}
```

#### 6.2.2. 회사비용 수정 함수 (동일 패턴)

```javascript
function editExpense(expenseId) {
  // editPayment와 동일한 패턴으로 구현
  // 차이점: 결제유형 대신 비용항목 드롭다운
}

function saveExpenseEdit(expenseId) {
  // savePaymentEdit와 동일한 패턴
  // API: updateExpenseRecordApi
}

function cancelEditExpense(expenseId) {
  // cancelEditPayment와 동일한 패턴
}
```

### 6.3. renderPaymentList 함수 수정

**위치:** CommonScripts.html (추정 5407번 줄)

**수정 내용:** 각 행에 `data-payment-id` 속성 추가

```javascript
function renderPaymentList(payments) {
  var tbody = document.getElementById('payment-list-tbody');

  if (!payments || payments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="payment-empty">조회된 입출금 내역이 없습니다.</td></tr>';
    return;
  }

  var rows = payments.map(function(payment) {
    var isDeleted = payment.deleted === true || payment.deleted === 'TRUE';
    var badgeClass = payment.type === '입금' ? 'income' : 'expense';
    if (isDeleted) badgeClass = 'deleted';

    var actionButtons = '';
    if (!isDeleted) {
      actionButtons =
        '<button class="payment-btn payment-btn-small warning" onclick="editPayment(\'' + payment.paymentId + '\')">수정</button>' +
        '<button class="payment-btn payment-btn-small danger" onclick="deletePayment(\'' + payment.paymentId + '\')">삭제</button>';
    } else {
      actionButtons = '<span style="color:#9ca3af; font-size:11px;">삭제됨</span>';
    }

    return '<tr data-payment-id="' + payment.paymentId + '">' +  // ← 추가
      '<td>' + (payment.paymentId || '') + '</td>' +
      '<td>' + (payment.date || '') + '</td>' +
      '<td><span class="payment-badge ' + badgeClass + '">' + (payment.type || '') + '</span></td>' +
      '<td>' + (payment.company || '') + '</td>' +
      '<td class="num">₩' + OB.formatNumber(payment.amount || 0) + '</td>' +
      '<td>' + (payment.method || '') + '</td>' +
      '<td>' + (payment.docNumber || '-') + '</td>' +
      '<td>' + (payment.orderNumber || '-') + '</td>' +
      '<td>' + (payment.notes || '-') + '</td>' +
      '<td>' + (payment.createdAt || '') + '</td>' +
      '<td class="actions">' + actionButtons + '</td>' +
    '</tr>';
  }).join('');

  tbody.innerHTML = rows;
}
```

### 6.4. CSS 추가 (Page_PaymentManagement.html 또는 별도 스타일)

```css
/* 인라인 편집 스타일 */
.payment-list tbody tr.editing {
  background-color: #fef3c7;
}

.edit-input, .edit-select {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 13px;
}

.edit-input:focus, .edit-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}
```

---

## 7. 추가 개선 아이디어

### 7.1. 발주 금액 정보 표시
수정 중인 행에 현재 발주의 총 금액과 결제 진행 상황 표시:
```
발주번호: PO-20251226-001 (총액: 1,000,000원 / 결제: 500,000원 / 잔액: 500,000원)
```

### 7.2. 결제 상태 실시간 미리보기
금액 수정 중 현재 입력값 기준으로 결제 상태가 어떻게 변경될지 미리 표시:
```
현재 상태: 부분결제  →  수정 후: 결제완료
```

### 7.3. 발주번호 여러 개 처리
발주번호가 쉼표로 구분된 경우 (예: `PO-001, PO-002`):
```javascript
function syncMultipleOrders(orderNumbers, paymentType) {
  if (!orderNumbers) return;

  var orders = orderNumbers.split(',').map(function(o) { return o.trim(); });
  orders.forEach(function(orderId) {
    if (orderId) {
      syncOrderPaymentStatus(orderId, paymentType);
    }
  });
}
```

### 7.4. 삭제된 입출금 복원 시 발주 상태 재계산
deletePaymentRecord 함수 (소프트 삭제)에서도 발주 상태 업데이트:
```javascript
// PaymentService.js - deletePaymentRecord 함수에 추가
var orderNumber = data[i][cOrderNumber];
var type = data[i][cType];

if (orderNumber && orderNumber !== '') {
  syncOrderPaymentStatus(orderNumber, type);
}
```

### 7.5. 트랜잭션 안전성 강화
입출금 수정과 발주 상태 업데이트를 원자적으로 처리:
- 발주 상태 업데이트 실패 시 입출금 수정도 롤백
- 또는: 발주 연동 실패를 경고로만 표시하고 입출금 수정은 성공으로 처리 (현재 방식)

**권장:** 현재 방식 유지 (발주 연동 실패해도 입출금 수정은 성공)
- 이유: 발주DB 문제로 입출금 데이터 수정이 막히면 안 됨

---

## 8. 구현 우선순위

### Phase 1: 핵심 기능 (필수)
1. ✅ calculatePaymentStatus 함수 구현
2. ✅ syncOrderPaymentStatus 함수 구현
3. ✅ updatePaymentRecord 수정 (발주 연동)
4. ✅ addPaymentRecord 수정 (발주 연동)
5. ✅ editPayment / savePaymentEdit / cancelEditPayment 구현
6. ✅ renderPaymentList 수정 (data-payment-id 추가)
7. ✅ 회사비용 수정 함수 (editExpense, saveExpenseEdit, cancelExpenseEdit)

### Phase 2: 개선 기능 (권장)
1. ⭐ CSS 스타일 개선 (편집 모드 UX)
2. ⭐ 삭제 기능에도 발주 연동 추가
3. ⭐ 발주 금액 정보 표시
4. ⭐ 결제 상태 미리보기

### Phase 3: 고급 기능 (선택)
1. 발주번호 여러 개 처리
2. 트랜잭션 롤백 로직
3. 발주 상태 변경 이력 로그

---

## 9. 테스트 시나리오

### 9.1. 입출금 수정 - 발주 연동 테스트

**시나리오 1: 부분결제 → 결제완료**
```
발주: PO-20251226-001, 총액: 100,000원, 매출결제: 부분결제
기존 입금: 50,000원
수정: 50,000원 → 100,000원
예상 결과: 매출결제 = 결제완료
```

**시나리오 2: 결제완료 → 부분결제**
```
발주: PO-20251226-001, 총액: 100,000원, 매출결제: 결제완료
기존 입금: 100,000원
수정: 100,000원 → 50,000원
예상 결과: 매출결제 = 부분결제
```

**시나리오 3: 결제유형 변경 (입금 → 출금)**
```
발주: PO-20251226-001, 매출결제: 결제완료, 매입결제: 미결제
기존: 입금 100,000원
수정: 입금 → 출금
예상 결과: 매출결제 = 미결제, 매입결제 = 부분결제 (금액에 따라)
```

**시나리오 4: 발주번호 없는 경우**
```
발주번호: (없음)
수정: 금액 변경
예상 결과: 정상 수정, 발주 연동 없음
```

### 9.2. 회사비용 수정 테스트
```
비용 항목 변경: 통신비 → 접대비
금액 변경: 50,000원 → 100,000원
예상 결과: 정상 수정
```

---

## 10. 롤아웃 계획

### 10.1. 개발 단계
1. PaymentService.js 백엔드 함수 구현 (calculatePaymentStatus, syncOrderPaymentStatus, updatePaymentRecord 수정)
2. addPaymentRecord 발주 연동 추가
3. 프론트엔드 인라인 편집 함수 구현
4. CSS 스타일 추가
5. 로컬 테스트 (testWhereDataWent 패턴)

### 10.2. 배포
1. Apps Script 프로젝트에 업로드
2. 웹앱 새 버전 배포
3. 브라우저 시크릿 모드에서 테스트

### 10.3. 검증
1. 입출금 수정 기능 테스트 (9.1 시나리오)
2. 발주DB 매입결제/매출결제 상태 확인
3. 회사비용 수정 기능 테스트
4. 삭제 항목 수정 불가 확인

---

## 11. 주의사항 및 제약사항

### 11.1. 발주번호 수정 불가
- **이유:** 발주번호를 변경하면 이전 발주와 새 발주 양쪽 모두 상태를 재계산해야 함
- **복잡도:** 높음
- **결정:** 발주번호는 수정 불가로 처리, 필요 시 삭제 후 재등록

### 11.2. 동시 편집 방지
- 한 번에 하나의 행만 편집 가능
- 다른 행 편집 시도 시 기존 편집 자동 취소

### 11.3. 삭제된 항목 수정 불가
- 삭제된 항목은 수정 버튼 비활성화
- 필요 시 복원 기능 별도 구현

### 11.4. 발주 연동 실패 처리
- 발주 상태 업데이트 실패해도 입출금 수정은 성공으로 처리
- 로그에 경고 기록, 사용자에게는 알리지 않음
- **이유:** 입출금 데이터 무결성이 발주 연동보다 우선

---

## 12. 예상 파일 수정 내역

| 파일명 | 수정 내용 | 라인 수 |
|--------|-----------|---------|
| PaymentService.js | calculatePaymentStatus 추가 | +70 |
| PaymentService.js | syncOrderPaymentStatus 추가 | +60 |
| PaymentService.js | updatePaymentRecord 수정 | +15 |
| PaymentService.js | addPaymentRecord 수정 | +8 |
| PaymentService.js | updateExpenseRecord 확인 (수정 불필요) | 0 |
| CommonScripts.html | editPayment 대체 | +120 |
| CommonScripts.html | savePaymentEdit 추가 | +80 |
| CommonScripts.html | cancelEditPayment 추가 | +40 |
| CommonScripts.html | editExpense/save/cancel 추가 | +200 |
| CommonScripts.html | renderPaymentList 수정 | +2 |
| Page_PaymentManagement.html | CSS 추가 (선택) | +20 |

**총 추가/수정 라인:** 약 615줄

---

## 13. 결론

본 명세서는 사용자 요구사항과 기존 코드베이스를 분석하여 작성되었습니다.

**핵심 가치:**
1. **인라인 편집 UX**: 모달 없이 빠른 수정
2. **자동 발주 연동**: 입출금 수정 시 발주 상태 자동 동기화
3. **스마트 결제 상태 계산**: 금액 기반 자동 판단
4. **데이터 무결성 우선**: 발주 연동 실패해도 입출금 데이터는 보호

**구현 시작 준비 완료.**

---

**작성자:** Claude Code
**문서 버전:** 1.0
**마지막 업데이트:** 2025-12-26
