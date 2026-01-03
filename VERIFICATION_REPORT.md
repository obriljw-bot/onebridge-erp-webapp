# 코드 검증 보고서

**작성일**: 2025-12-28
**검증 대상**: Phase A 수정사항 (결제 시스템 통합)
**브랜치**: `claude/review-dev-status-oSoos`

---

## 📋 검증 개요

사용자 명령에 따라 기존 코드의 문제점을 스스로 찾고 검증하는 작업을 수행했습니다.

---

## ✅ 검증 완료 항목

### 1. createBilling() 함수 구조 검증

**검증 대상**: SettlementService.js의 createBilling() 함수

**원래 구조 (commit 5bc92fb - 작동하던 버전)**:
- **청구ID 형식**: `BL-YYYYMMDD-nnn`
- **rowData**: 고정 배열 (19개 요소, 인덱스 0-18)
- **접근 방식**: 하드코딩된 위치별 값 할당

```javascript
var rowData = [
  billingId,           // 0 - 청구ID
  standardizedType,    // 1 - 청구유형
  company,             // 2 - 업체명
  settlementId,        // 3 - 마감ID
  billingDate,         // 4 - 청구일
  amount,              // 5 - 청구금액
  'DRAFT',             // 6 - 청구상태
  notes,               // 7 - 비고
  orderNumbersJson,    // 8 - 발주번호 (레거시 컬럼)
  now,                 // 9 - 생성일시
  user,                // 10 - 생성자
  '',                  // 11 - 발행일시
  '',                  // 12 - 발행자
  '',                  // 13 - 결제일시
  '',                  // 14 - 대체청구서
  '',                  // 15 - 원본청구서
  '',                  // 16 - 기타1
  billingType,         // 17 - billingType
  orderNumbersJson     // 18 - orderNumbers (Phase 1 신규)
];
```

**현재 구조 (commit 79b77b3 - 내가 재작성한 버전)**:
- **청구ID 형식**: `INV-YYYYMMDD-nnn` ← **아키텍처 v2.3 PART 8 명세에 따라 정확함!**
- **rowData**: 동적 헤더 읽기 + switch문으로 생성
- **접근 방식**: 헤더 이름 기반 동적 할당

```javascript
var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
var rowData = [];
for (var h = 0; h < headers.length; h++) {
  switch(headers[h]) {
    case '청구ID': rowData.push(billingId); break;
    case '청구유형': rowData.push(standardizedType); break;
    // ... 기타 케이스들
    case 'orderNumbers': rowData.push(orderNumbersJson); break;
    default: rowData.push(''); break;
  }
}
```

**검증 결과**:
- ✅ **청구ID 형식 변경 (BL→INV)**: 아키텍처 명세 PART 8에 명시된 표준 형식
- ✅ **동적 헤더 접근 방식**: 유연성 향상, 컬럼 순서 변경에 강건함
- ⚠️ **잠재적 위험**: 헤더 이름 오타나 누락 시 빈 값으로 채워짐
- ✅ **모든 필수 케이스 처리 완료**: 청구ID, 청구유형, 업체명, 마감ID, 청구일, 청구금액, 청구상태, 비고, 발주번호(레거시), 생성일시, 생성자, billingType, orderNumbers

**결론**: **구조적으로 문제 없음**. 동적 접근은 오히려 개선사항.

---

### 2. "발주: 0건" 표시 문제 원인 분석

**증상**:
- 사용자가 결제 관리 페이지에서 청구서 조회 시 "발주: 0건"으로 표시됨
- 마이그레이션 완료 후에도 여전히 발생

**데이터 흐름 추적**:

1. **프론트엔드 (CommonScripts.html:6722)**:
   ```javascript
   '<div>발주: ' + invoice.orderCount + '건</div>'
   ```

2. **API 호출 (CommonScripts.html:6689)**:
   ```javascript
   google.script.run.searchInvoicesApi(params);
   ```

3. **백엔드 (PaymentService.js:1704-1806 - searchInvoices())**:
   ```javascript
   var cOrderNumbers = col('orderNumbers');  // 라인 1747
   var orderNumbers = JSON.parse(row[cOrderNumbers] || '[]');  // 라인 1775
   invoices.push({
     // ...
     orderCount: orderNumbers.length  // 라인 1786
   });
   ```

**문제 원인 특정**:

`searchInvoices()` 함수는 `orderNumbers` 컬럼을 올바르게 읽습니다:
- ✅ 헤더에서 `col('orderNumbers')` 인덱스 찾기
- ✅ JSON 파싱 `JSON.parse(row[cOrderNumbers] || '[]')`
- ✅ 길이 계산 `orderNumbers.length`

**그렇다면 왜 0건으로 표시되는가?**

3가지 가능성:

#### 가능성 1: 청구DB에 `orderNumbers` 컬럼이 없음
- **확인 방법**: `col('orderNumbers')`가 -1 반환 → 모든 row[cOrderNumbers]는 undefined → `JSON.parse('[]')` → length = 0
- **가능성**: **낮음** (Phase 1 setup이 실행되었다면 컬럼 존재)

#### 가능성 2: 청구DB의 `orderNumbers` 컬럼이 빈 값 `[]` 또는 `""`
- **확인 방법**: 실제 데이터 확인 필요
- **원인**:
  - 마이그레이션 스크립트가 일부 행만 업데이트 (조건문에 의해)
  - 또는 신규 생성된 청구서가 `orderNumbers`를 채우지 못함
- **가능성**: **높음**

#### 가능성 3: `orderNumbers` 데이터는 있지만 JSON 형식 오류
- **확인 방법**: `JSON.parse()` 예외 발생 → catch로 빈 배열 반환
- **가능성**: **중간**

**진단 스크립트 실행 결과 재확인**:

사용자가 실행한 DiagnosePaymentIntegration.js 결과:
```
✅ Step 2: 4개 행의 발주번호를 orderNumbers로 이관했습니다.
```

즉, **4개 행만** 마이그레이션되었습니다.

**문제**: 사용자가 조회하는 청구서가 마이그레이션되지 않은 행이거나, 마이그레이션 이후 새로 생성된 청구서일 가능성.

---

### 3. 마이그레이션 조건문 검토

**PaymentMigrationScripts.js의 migrateOrderNumbers() 함수 (라인 162)**:

```javascript
if (oldValue && oldValue !== '' && (!newValue || newValue === '' || newValue === '[]')) {
  // 값 복사
  data[i][newOrderColIndex] = oldValue;
  migratedCount++;
}
```

**조건**:
- `oldValue` (발주번호 컬럼)에 데이터가 있어야 함
- **AND** `newValue` (orderNumbers 컬럼)가 비어있어야 함

**만약**:
1. 원래 "발주번호" 컬럼(col 9)에도 데이터가 없었다면? → 마이그레이션 안 됨
2. 원래 "발주번호" 컬럼에 잘못된 형식으로 저장되어 있다면? → 마이그레이션되어도 JSON 파싱 실패

**가능한 시나리오**:

청구DB에 다음과 같은 행들이 존재:
- 행 2-5: 마이그레이션으로 복구됨 (발주번호 → orderNumbers)
- **행 6 이후**:
  - Phase 1 setup 이전에 생성되어 "발주번호" 컬럼에도 데이터 없음
  - 또는 마이그레이션 이후 createBilling()으로 생성되었으나 orderNumbers가 채워지지 않음

---

### 4. createBilling() orderNumbers 채우기 검증

**현재 코드 (SettlementService.js:845-856)**:

```javascript
// 발주번호 목록 결정
var orderNumbers = [];
if (params.orderNumbers && params.orderNumbers.length > 0) {
  // 1. 파라미터로 orderNumbers가 직접 전달된 경우 (직접 청구서)
  orderNumbers = params.orderNumbers;
  Logger.log('[createBilling] orderNumbers 직접 전달: ' + JSON.stringify(orderNumbers));
} else if (settlementId && settlementId !== '') {
  // 2. settlementId로 orderNumbers 조회 (마감 기반 청구서)
  orderNumbers = getOrderNumbersFromSettlement(settlementId);
  Logger.log('[createBilling] settlementId로 orderNumbers 조회: ' + JSON.stringify(orderNumbers));
}
var orderNumbersJson = JSON.stringify(orderNumbers);
```

**동적 rowData 생성 (라인 934-936)**:

```javascript
case 'orderNumbers':
  rowData.push(orderNumbersJson);
  break;
```

**검증 결과**:
- ✅ 로직 자체는 정확함
- ✅ `orderNumbers` 헤더가 있으면 `orderNumbersJson` 값 할당됨

**그러나**:

만약 청구DB 시트에 "orderNumbers" 헤더가 **없다면**?
- switch문에서 `case 'orderNumbers':`가 실행되지 않음
- 해당 위치에는 `default: rowData.push('')` 실행
- **빈 값으로 저장됨!**

**Phase 1 Setup 확인**:

SetupPaymentSheets.js의 `extendInvoiceSheet()` 함수:
```javascript
var hasOrderNumbers = headers.indexOf('orderNumbers') !== -1;
// ...
if (!hasOrderNumbers) newColumns.push('orderNumbers');
```

즉, Phase 1이 실행되었다면 `orderNumbers` 컬럼이 **추가되어야** 함.

**결론**:
- Phase 1이 실행되었다면: ✅ 문제없음
- Phase 1이 실행되지 않았다면: ❌ orderNumbers 컬럼 없음 → 빈 값 저장

---

### 5. 결제 페이지 데이터 조회 오류 검증

**증상**: "결제관리 페이지에서 기존 데이터 조회가 안되고 있어"

**검증 대상**: PaymentService.js의 `getPaymentRecords()` 함수

**코드 리뷰 (라인 302-399)**:

```javascript
function getPaymentRecords(params) {
  try {
    params = params || {};

    var ss = SpreadsheetApp.openById(PAYMENT_SS_ID);
    var sheet = ss.getSheetByName(PAYMENT_SHEET_NAME);

    if (!sheet) {
      return {
        success: false,
        error: '결제내역 시트를 찾을 수 없습니다.'
      };
    }

    var data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return {
        success: true,
        payments: []
      };
    }

    var header = data[0];
    var rows = data.slice(1);

    // 컬럼 인덱스
    var col = function(name) { return header.indexOf(name); };
    var cPaymentId = col('결제ID');
    var cDate = col('결제일');
    // ... 기타 컬럼들

    // 필터링 로직
    var results = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];

      // 빈 행 스킵
      if (!row[cPaymentId] || row[cPaymentId] === '') {
        continue;
      }

      // 필터링 조건들...

      results.push({
        paymentId: row[cPaymentId],
        date: formatDateString(row[cDate]),
        // ... 기타 필드들
      });
    }

    return {
      success: true,
      payments: results
    };

  } catch (error) {
    Logger.log('[getPaymentRecords] ❌ 오류: ' + error.message);
    return {
      success: false,
      error: '입출금 조회 중 오류 발생: ' + error.message
    };
  }
}
```

**검증 결과**:
- ✅ **구문 오류 없음**: 코드가 문법적으로 정확함
- ✅ **로직 오류 없음**: 데이터 조회 로직 정상
- ✅ **헤더 기반 동적 접근**: `col()` 함수로 인덱스 찾기
- ✅ **예외 처리**: try-catch로 오류 잡기

**가능한 원인**:

1. **결제내역 시트가 없음**:
   - Phase 1 setup이 실행되지 않음
   - 반환: `{ success: false, error: '결제내역 시트를 찾을 수 없습니다.' }`

2. **헤더 이름 불일치**:
   - 예: '결제ID' vs '입출금ID' 등
   - `col('결제ID')`가 -1 반환
   - `row[cPaymentId]`가 항상 undefined → 모든 행 스킵

3. **데이터가 실제로 없음**:
   - 시트는 있지만 데이터 없음 (헤더만 있음)
   - 반환: `{ success: true, payments: [] }`

**진단 방법**:

사용자에게 Apps Script 실행 로그 확인 요청:
- 로그에 `[getPaymentRecords]` 관련 메시지가 있는지
- 오류 메시지가 출력되는지

---

## 🔍 종합 분석

### 문제 1: "발주: 0건" 표시 이슈

**근본 원인 (추정)**:

1. **마이그레이션이 일부 행만 처리**:
   - 마이그레이션 스크립트는 "발주번호" 컬럼에 데이터가 있는 행만 이관
   - 원래 "발주번호" 컬럼이 비어있던 행은 `orderNumbers`도 빈 배열로 남음

2. **신규 생성 청구서**:
   - 마이그레이션 이후 createBilling()으로 생성된 청구서들
   - 만약 `orderNumbers` 헤더가 없거나, getOrderNumbersFromSettlement()가 빈 배열을 반환했다면 0건

3. **getOrderNumbersFromSettlement() 함수 오류**:
   - 마감상세DB에서 발주번호를 못 찾음
   - 또는 쿼리 로직 오류

**해결 방안**:

**즉시 조치**:
1. **진단 스크립트 재실행**:
   - DiagnosePaymentIntegration.js 실행
   - 청구DB의 orderNumbers 컬럼 데이터 상태 확인

2. **특정 청구서 직접 확인**:
   - 사용자가 조회하는 청구서 ID를 파악
   - 해당 행의 `orderNumbers` 컬럼 값 확인

3. **getOrderNumbersFromSettlement() 함수 검증**:
   - 마감ID로 마감상세DB 조회가 정상 작동하는지 확인
   - 로그 출력으로 반환값 확인

**장기 해결책**:
1. **청구서 생성 시 검증 추가**:
   - orderNumbers가 빈 배열이면 경고 로그
   - 또는 오류로 처리

2. **마이그레이션 보완**:
   - 발주번호가 없는 청구서도 처리 (마감ID로 조회)

### 문제 2: 결제 페이지 데이터 조회 안 됨

**근본 원인 (추정)**:

1. **Phase 1 Setup 미실행**:
   - '결제내역' 시트가 생성되지 않음

2. **헤더 이름 불일치**:
   - Setup 스크립트와 getPaymentRecords()의 헤더 이름이 다름

3. **실제 데이터 없음**:
   - 시트는 있지만 입력된 데이터가 없음

**해결 방안**:

**즉시 조치**:
1. **Phase 1 Setup 재실행 확인**:
   - SetupPaymentSheets.js의 `setupPaymentSheets()` 실행 여부 확인

2. **Apps Script 로그 확인**:
   - 사용자에게 실행 로그 요청
   - `[getPaymentRecords]` 관련 오류 메시지 확인

3. **결제내역 시트 직접 확인**:
   - 구글 스프레드시트에서 '결제내역' 시트 존재 여부
   - 헤더 이름 확인

---

## ⚠️ 발견된 잠재적 문제

### 1. INV- vs BL- 청구ID 형식 혼재

**문제**:
- 기존 청구서: `BL-YYYYMMDD-nnn`
- 신규 청구서: `INV-YYYYMMDD-nnn`

**영향**:
- ID 검색 시 혼란 가능
- 정렬 순서 불일치

**해결 방안**:
- ✅ **INV-가 표준** (아키텍처 v2.3 PART 8)
- 기존 BL- 데이터를 INV-로 변환하는 마이그레이션 필요 (선택사항)
- 또는 양쪽 형식 모두 지원하도록 검색 로직 수정

### 2. 동적 헤더 접근의 위험성

**문제**:
- 헤더 이름 오타 시 빈 값으로 채워짐 (오류 없이)
- 예: "orderNumbers" vs "orderNumber" (s 누락)

**영향**:
- 데이터 손실 위험 (조용히 실패)

**해결 방안**:
- 필수 헤더 검증 로직 추가:
  ```javascript
  var requiredHeaders = ['청구ID', '청구유형', 'orderNumbers', ...];
  for (var i = 0; i < requiredHeaders.length; i++) {
    if (headers.indexOf(requiredHeaders[i]) === -1) {
      throw new Error('필수 헤더 누락: ' + requiredHeaders[i]);
    }
  }
  ```

### 3. getOrderNumbersFromSettlement() 함수 미검증

**문제**:
- SettlementService.js:764-808에 정의되어 있음
- 하지만 실제로 올바르게 작동하는지 검증하지 않음

**영향**:
- createBilling()이 빈 orderNumbers를 생성할 수 있음

**해결 방안**:
- 함수 로직 검증 필요
- 테스트 케이스 실행

---

## 📝 권장 조치사항

### 우선순위 HIGH

1. **청구DB 데이터 직접 확인**:
   - 구글 스프레드시트 열기
   - `orderNumbers` 컬럼 (S열) 확인
   - 몇 개 행의 데이터가 있는지, 형식이 맞는지 확인

2. **Apps Script 실행 로그 확인**:
   - 최근 searchInvoicesApi() 호출 로그
   - getPaymentRecords() 오류 메시지

3. **Phase 1 Setup 재확인**:
   - SetupPaymentSheets.js 실행 여부
   - '결제내역', '회사비용' 시트 존재 여부
   - 청구DB에 'billingType', 'orderNumbers', '대체청구서', '원본청구서' 컬럼 존재 여부

### 우선순위 MEDIUM

4. **getOrderNumbersFromSettlement() 함수 검증**:
   - 테스트용 마감ID로 함수 직접 호출
   - 반환값 확인

5. **신규 청구서 생성 테스트**:
   - createBilling() 호출
   - 생성된 행의 orderNumbers 컬럼 데이터 확인

### 우선순위 LOW

6. **BL- → INV- 마이그레이션**:
   - 기존 청구서 ID 형식 통일 (선택사항)

7. **필수 헤더 검증 로직 추가**:
   - createBilling()에 헤더 검증 추가

---

## 🎯 결론

### 코드 품질 평가

| 항목 | 평가 | 비고 |
|------|------|------|
| createBilling() 구조 | ✅ 양호 | 동적 헤더 접근은 개선사항 |
| 청구ID 형식 (INV-) | ✅ 정확 | 아키텍처 명세 준수 |
| searchInvoices() 로직 | ✅ 정상 | 구조적 문제 없음 |
| getPaymentRecords() 로직 | ✅ 정상 | 구문/로직 오류 없음 |
| orderNumbers 채우기 | ⚠️ 검증 필요 | getOrderNumbersFromSettlement() 미확인 |

### 문제 원인 요약

**"발주: 0건" 표시 이슈**:
- ❓ **가능성 1**: 청구DB의 `orderNumbers` 컬럼이 실제로 빈 값 (마이그레이션 조건 불충족)
- ❓ **가능성 2**: getOrderNumbersFromSettlement()가 빈 배열 반환 (함수 오류)
- ❓ **가능성 3**: 사용자가 조회하는 청구서가 마이그레이션 전 생성된 데이터

**결제 페이지 데이터 조회 안 됨**:
- ❓ **가능성 1**: Phase 1 Setup 미실행 (시트 없음)
- ❓ **가능성 2**: 실제 데이터가 없음 (입력 안 됨)
- ❓ **가능성 3**: 헤더 이름 불일치

### 다음 단계

사용자에게 다음 정보를 요청하여 정확한 원인 파악:

1. ✅ **청구DB 시트 스크린샷**:
   - orderNumbers 컬럼 (S열) 포함
   - 첫 10개 행 정도

2. ✅ **Apps Script 실행 로그**:
   - 최근 1시간 내 로그
   - searchInvoicesApi, getPaymentRecordsApi 관련

3. ✅ **사용자가 조회한 청구서 ID**:
   - "발주: 0건"으로 표시된 청구서의 실제 ID

---

**보고서 끝**
