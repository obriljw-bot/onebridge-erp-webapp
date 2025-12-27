# 결제 데이터 마이그레이션 가이드

## 📋 목적

결제 관리 리뉴얼 (발주번호 중심 → 청구서 중심)에 따른 기존 데이터 호환성 분석 및 마이그레이션 전략을 제시합니다.

---

## 🔄 변경 사항 요약

### BEFORE (리뉴얼 전)
```
결제내역 시트 구조:
- 결제ID
- 결제일
- 결제유형 (입금/출금)
- 거래처명
- 금액
- 결제수단
- 문서번호 (docNumber) ← 선택사항, 비어있을 수 있음
- 발주번호 (orderNumber) ← 단일 발주번호, 선택사항
- 비고
```

**문제점:**
1. `docNumber`가 비어있는 경우 많음
2. `orderNumber`는 단일 발주번호만 저장 가능
3. 발주번호를 통한 청구서 추적 불가능
4. 사용자가 발주번호를 수동 입력해야 함

### AFTER (리뉴얼 후)
```
결제내역 시트 구조:
- 결제ID
- 결제일
- 결제유형 (입금/출금)
- 거래처명
- 금액
- 결제수단
- 문서번호 (docNumber) ← 청구서ID (필수)
- 발주번호 (orderNumber) ← 사용하지 않음 (deprecated)
- 비고
```

**개선점:**
1. `docNumber`에 청구서ID 저장 (INV-YYYYMMDD-XXX 형식)
2. 청구서가 `orderNumbers[]` 배열로 여러 발주번호 보유
3. 4단계 모달 프로세스로 청구서 기반 입력
4. 청구서를 통한 발주번호 자동 추적

---

## 📊 기존 데이터 분석

### 데이터 패턴 분류

기존 결제 데이터는 다음 4가지 패턴으로 분류됩니다:

#### 패턴 1: docNumber가 청구서ID 형식
```javascript
{
  결제ID: "PAY-001",
  문서번호: "INV-20250101-001",  // ✅ 청구서ID 형식
  발주번호: ""
}
```
**상태:** ✅ 마이그레이션 불필요
**처리:** 현재 상태 유지

---

#### 패턴 2: docNumber가 비어있고 orderNumber가 있음
```javascript
{
  결제ID: "PAY-002",
  문서번호: "",  // ❌ 비어있음
  발주번호: "GMP-20250101-001"  // ✅ 발주번호 있음
}
```
**상태:** ⚠️ 마이그레이션 필요
**처리:** 발주번호 → 청구서ID 매핑

**마이그레이션 로직:**
1. `orderNumber`로 청구DB 시트에서 청구서 검색
2. 청구서의 `orderNumbers` 배열에 해당 발주번호가 포함된 청구서 찾기
3. 찾은 청구서의 `청구ID`를 `docNumber`에 업데이트

```javascript
// 예시 변환
BEFORE: { 문서번호: "", 발주번호: "GMP-001" }
AFTER:  { 문서번호: "INV-20250115-003", 발주번호: "GMP-001" }
```

---

#### 패턴 3: docNumber와 orderNumber 모두 비어있음
```javascript
{
  결제ID: "PAY-003",
  문서번호: "",  // ❌ 비어있음
  발주번호: ""   // ❌ 비어있음
}
```
**상태:** ⚠️ 수동 처리 필요
**처리:** 임시 청구서 생성 또는 수동 매핑

**옵션 1: 임시 청구서 자동 생성**
```javascript
// 임시 청구서 생성 (결제 정보 기반)
{
  청구ID: "INV-TEMP-20250115-001",
  청구유형: payment.type === '입금' ? 'SALES' : 'PURCHASE',
  업체명: payment.company,
  청구일: payment.date,
  청구금액: payment.amount,
  청구상태: "DRAFT",
  billingType: "DIRECT",
  orderNumbers: []
}
```

**옵션 2: 수동 매핑**
- 관리자가 UI에서 해당 결제를 확인하고 청구서 연결
- 배치 작업으로 여러 건 한번에 처리 가능

---

#### 패턴 4: docNumber가 청구서ID 아닌 다른 문서번호
```javascript
{
  결제ID: "PAY-004",
  문서번호: "CUSTOM-DOC-001",  // ❌ 청구서ID 아님
  발주번호: ""
}
```
**상태:** ⚠️ 검토 필요
**처리:** 케이스별 판단

- 청구서로 매핑 가능한 경우 → 패턴 2 처리
- 매핑 불가능한 경우 → 패턴 3 처리

---

## 🛠️ 마이그레이션 전략

### 전략 1: 점진적 마이그레이션 (권장)

**개념:**
기존 데이터는 그대로 두고, 신규 입력만 새로운 방식 사용. 기존 데이터는 필요시 수동으로 업데이트.

**장점:**
- ✅ 즉시 적용 가능
- ✅ 리스크 최소화
- ✅ 사용자가 점진적으로 적응

**단점:**
- ⚠️ 데이터 일관성 부족
- ⚠️ 리포트 작성 시 두 가지 패턴 모두 고려 필요

**구현:**
1. Phase 1, 2 배포 (모달 UI 활성화)
2. 신규 결제는 모달을 통해 청구서 기반 입력
3. 기존 결제 조회 시 경고 배너 표시
   ```
   ⚠️ 이 결제는 청구서와 연결되지 않았습니다.
   [청구서 연결하기] 버튼 클릭 시 모달 열림
   ```
4. 사용자가 필요할 때 수동으로 청구서 연결

---

### 전략 2: 일괄 마이그레이션

**개념:**
배치 스크립트를 실행하여 모든 기존 데이터를 한번에 마이그레이션.

**장점:**
- ✅ 데이터 일관성 확보
- ✅ 리포트 작성 간편

**단점:**
- ⚠️ 자동 매핑 실패 케이스 존재
- ⚠️ 실행 시간 소요
- ⚠️ 롤백 어려움

**구현:**
1. 백업 생성
2. 마이그레이션 스크립트 실행
   - 패턴 1: Skip (이미 완료)
   - 패턴 2: 발주번호 → 청구서ID 자동 매핑
   - 패턴 3: 임시 청구서 생성
   - 패턴 4: 검토 리스트에 추가
3. 검토 리스트 수동 처리
4. 검증 및 배포

---

### 전략 3: 하이브리드 (권장)

**개념:**
패턴 1, 2는 자동 마이그레이션, 패턴 3, 4는 점진적 처리.

**구현:**
1. **자동 처리 (패턴 1, 2)**
   - 청구서ID 형식 확인 → 유지
   - 발주번호 존재 → 청구서ID 자동 매핑

2. **수동 처리 (패턴 3, 4)**
   - UI에 경고 배너 표시
   - 사용자가 필요시 수동 연결

3. **마이그레이션 대시보드**
   ```
   📊 마이그레이션 현황
   ✅ 완료: 450건 (75%)
   ⏳ 대기: 100건 (17%) ← 패턴 3, 4
   ❌ 실패: 50건 (8%)   ← 수동 검토 필요

   [일괄 임시 청구서 생성] 버튼
   [실패 목록 다운로드] 버튼
   ```

---

## 💻 마이그레이션 스크립트

### 스크립트 1: 데이터 패턴 분석

```javascript
/**
 * 기존 결제 데이터 패턴 분석
 * @return {Object} 패턴별 통계
 */
function analyzePaymentDataPatterns() {
  var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
  var sheet = ss.getSheetByName(PAYMENT_SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var header = data[0];

  var col = function(name) { return header.indexOf(name); };
  var cDocNumber = col('문서번호');
  var cOrderNumber = col('발주번호');
  var cDeleted = col('삭제여부');

  var patterns = {
    pattern1: 0,  // docNumber가 INV- 형식
    pattern2: 0,  // docNumber 없고 orderNumber 있음
    pattern3: 0,  // 둘 다 없음
    pattern4: 0,  // docNumber가 다른 형식
    deleted: 0    // 삭제된 데이터
  };

  for (var i = 1; i < data.length; i++) {
    var row = data[i];

    // 삭제된 데이터 제외
    if (row[cDeleted] === true) {
      patterns.deleted++;
      continue;
    }

    var docNumber = String(row[cDocNumber] || '').trim();
    var orderNumber = String(row[cOrderNumber] || '').trim();

    if (docNumber.startsWith('INV-')) {
      patterns.pattern1++;
    } else if (!docNumber && orderNumber) {
      patterns.pattern2++;
    } else if (!docNumber && !orderNumber) {
      patterns.pattern3++;
    } else {
      patterns.pattern4++;
    }
  }

  Logger.log('=== 결제 데이터 패턴 분석 ===');
  Logger.log('패턴 1 (청구서ID 형식): ' + patterns.pattern1 + '건');
  Logger.log('패턴 2 (발주번호만 있음): ' + patterns.pattern2 + '건');
  Logger.log('패턴 3 (둘 다 없음): ' + patterns.pattern3 + '건');
  Logger.log('패턴 4 (다른 문서번호): ' + patterns.pattern4 + '건');
  Logger.log('삭제된 데이터: ' + patterns.deleted + '건');
  Logger.log('총계: ' + (patterns.pattern1 + patterns.pattern2 + patterns.pattern3 + patterns.pattern4) + '건');

  return patterns;
}
```

---

### 스크립트 2: 패턴 2 자동 마이그레이션

```javascript
/**
 * 패턴 2 (발주번호만 있는 경우) 자동 마이그레이션
 * @return {Object} { success, updated, failed, errors }
 */
function migratePattern2Payments() {
  var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
  var paymentSheet = ss.getSheetByName(PAYMENT_SHEET_NAME);
  var invoiceSheet = ss.getSheetByName(INVOICE_SHEET_NAME);

  var paymentData = paymentSheet.getDataRange().getValues();
  var invoiceData = invoiceSheet.getDataRange().getValues();

  var paymentHeader = paymentData[0];
  var invoiceHeader = invoiceData[0];

  var pCol = function(name) { return paymentHeader.indexOf(name); };
  var iCol = function(name) { return invoiceHeader.indexOf(name); };

  var pDocNumber = pCol('문서번호');
  var pOrderNumber = pCol('발주번호');
  var pDeleted = pCol('삭제여부');

  var iInvoiceId = iCol('청구ID');
  var iOrderNumbers = iCol('orderNumbers');

  var updated = 0;
  var failed = 0;
  var errors = [];

  for (var i = 1; i < paymentData.length; i++) {
    var row = paymentData[i];

    // 삭제된 데이터 제외
    if (row[pDeleted] === true) continue;

    var docNumber = String(row[pDocNumber] || '').trim();
    var orderNumber = String(row[pOrderNumber] || '').trim();

    // 패턴 2 확인
    if (!docNumber && orderNumber) {
      // 청구서에서 해당 발주번호 검색
      var invoiceId = findInvoiceByOrderNumber(invoiceData, invoiceHeader, orderNumber);

      if (invoiceId) {
        // docNumber 업데이트
        paymentSheet.getRange(i + 1, pDocNumber + 1).setValue(invoiceId);
        updated++;
        Logger.log('[마이그레이션] ✅ 업데이트: 결제ID=' + row[0] + ', 발주번호=' + orderNumber + ' → 청구ID=' + invoiceId);
      } else {
        failed++;
        errors.push({
          paymentId: row[0],
          orderNumber: orderNumber,
          reason: '해당 발주번호를 포함하는 청구서를 찾을 수 없음'
        });
        Logger.log('[마이그레이션] ❌ 실패: 결제ID=' + row[0] + ', 발주번호=' + orderNumber);
      }
    }
  }

  return {
    success: true,
    updated: updated,
    failed: failed,
    errors: errors
  };
}

/**
 * 발주번호로 청구서 검색
 */
function findInvoiceByOrderNumber(invoiceData, invoiceHeader, orderNumber) {
  var iCol = function(name) { return invoiceHeader.indexOf(name); };
  var iInvoiceId = iCol('청구ID');
  var iOrderNumbers = iCol('orderNumbers');

  for (var i = 1; i < invoiceData.length; i++) {
    var row = invoiceData[i];
    var orderNumbers = JSON.parse(row[iOrderNumbers] || '[]');

    if (orderNumbers.indexOf(orderNumber) !== -1) {
      return row[iInvoiceId];
    }
  }

  return null;
}
```

---

### 스크립트 3: 패턴 3 임시 청구서 생성

```javascript
/**
 * 패턴 3 (둘 다 없는 경우) 임시 청구서 일괄 생성
 * @return {Object} { success, created, errors }
 */
function createTempInvoicesForPattern3() {
  var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
  var paymentSheet = ss.getSheetByName(PAYMENT_SHEET_NAME);
  var paymentData = paymentSheet.getDataRange().getValues();
  var paymentHeader = paymentData[0];

  var pCol = function(name) { return paymentHeader.indexOf(name); };
  var pPaymentId = pCol('결제ID');
  var pType = pCol('결제유형');
  var pCompany = pCol('거래처명');
  var pAmount = pCol('금액');
  var pDate = pCol('결제일');
  var pDocNumber = pCol('문서번호');
  var pOrderNumber = pCol('발주번호');
  var pDeleted = pCol('삭제여부');

  var created = 0;
  var errors = [];

  for (var i = 1; i < paymentData.length; i++) {
    var row = paymentData[i];

    // 삭제된 데이터 제외
    if (row[pDeleted] === true) continue;

    var docNumber = String(row[pDocNumber] || '').trim();
    var orderNumber = String(row[pOrderNumber] || '').trim();

    // 패턴 3 확인
    if (!docNumber && !orderNumber) {
      try {
        // 임시 청구서 생성
        var params = {
          company: row[pCompany],
          paymentType: row[pType],
          amount: row[pAmount],
          date: row[pDate]
        };

        var result = createTempInvoice(params);

        if (result.success) {
          // docNumber 업데이트
          paymentSheet.getRange(i + 1, pDocNumber + 1).setValue(result.invoiceId);
          created++;
          Logger.log('[임시 청구서] ✅ 생성: 결제ID=' + row[pPaymentId] + ' → 청구ID=' + result.invoiceId);
        } else {
          errors.push({
            paymentId: row[pPaymentId],
            reason: result.error
          });
        }
      } catch (error) {
        errors.push({
          paymentId: row[pPaymentId],
          reason: error.message
        });
      }
    }
  }

  return {
    success: true,
    created: created,
    errors: errors
  };
}
```

---

## 📋 마이그레이션 체크리스트

### 사전 준비
- [ ] 현재 데이터 백업 (결제내역 시트 전체 복사)
- [ ] 청구DB 시트에 billingType, orderNumbers 컬럼 추가 완료 확인
- [ ] Phase 1, 2 코드 배포 완료 확인

### 분석 단계
- [ ] `analyzePaymentDataPatterns()` 실행
- [ ] 패턴별 건수 확인 및 기록
- [ ] 패턴 4 데이터 수동 검토 (케이스별 판단)

### 마이그레이션 실행
- [ ] **패턴 1**: 자동 통과 (작업 불필요)
- [ ] **패턴 2**: `migratePattern2Payments()` 실행
  - [ ] 업데이트 건수 확인
  - [ ] 실패 건수 및 오류 목록 검토
- [ ] **패턴 3**: 사용자와 협의 후 처리 방식 결정
  - Option A: `createTempInvoicesForPattern3()` 실행
  - Option B: 수동 매핑 (점진적 처리)
- [ ] **패턴 4**: 수동 검토 및 처리

### 검증 단계
- [ ] 샘플 데이터 10건 무작위 선택하여 수동 검증
- [ ] 모달 UI에서 결제 조회 테스트
- [ ] 통계 및 리포트 정확성 확인

### 사후 처리
- [ ] 마이그레이션 결과 문서 작성
- [ ] 실패 건수 및 수동 처리 필요 건수 기록
- [ ] 사용자 교육 자료 업데이트

---

## ⚠️ 주의사항

### 1. 백업 필수
마이그레이션 실행 전 반드시 데이터를 백업하세요. Google Sheets에서 시트 전체를 복사하여 별도 파일로 저장하는 것을 권장합니다.

### 2. 점진적 실행
한번에 모든 패턴을 마이그레이션하지 말고, 패턴 2부터 시작하여 결과를 확인한 후 다음 단계로 진행하세요.

### 3. 롤백 계획
문제 발생 시 즉시 백업으로 복원할 수 있도록 준비하세요.

### 4. 사용자 통지
마이그레이션 작업 시 사용자에게 사전 통지하고, 작업 시간 동안 시스템 사용을 제한하세요.

---

## 📊 예상 마이그레이션 결과

### 시나리오: 총 600건의 결제 데이터

| 패턴 | 건수 | 처리 방법 | 자동화 | 예상 결과 |
|------|------|-----------|--------|-----------|
| 패턴 1 | 200건 (33%) | 유지 | ✅ | 200건 완료 |
| 패턴 2 | 250건 (42%) | 자동 매핑 | ✅ | 230건 성공, 20건 실패 |
| 패턴 3 | 120건 (20%) | 임시 청구서 생성 | ✅ | 120건 완료 |
| 패턴 4 | 30건 (5%) | 수동 검토 | ❌ | 수동 처리 필요 |

**예상 자동화율:** 92% (550/600건)
**수동 처리 필요:** 50건 (패턴 2 실패 20건 + 패턴 4 30건)

---

## 🎯 권장 사항

1. **하이브리드 전략 사용**
   - 패턴 1, 2: 자동 마이그레이션
   - 패턴 3, 4: 점진적 처리 또는 일괄 임시 청구서 생성

2. **마이그레이션 대시보드 구현**
   - 진행 상황 실시간 모니터링
   - 실패 건수 및 이유 표시
   - 수동 처리 필요 건수 알림

3. **사용자 교육**
   - 새로운 모달 UI 사용법 안내
   - 기존 데이터 청구서 연결 방법 교육
   - FAQ 및 문제 해결 가이드 제공

---

## 📞 문의

마이그레이션 관련 문의사항이 있으시면 개발팀에 연락주세요.

---

**문서 버전:** 1.0
**작성일:** 2025-01-15
**작성자:** Claude (OneBridge ERP Development Team)
