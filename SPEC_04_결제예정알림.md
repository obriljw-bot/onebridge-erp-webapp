# 🔔 명세서 #4: 결제 예정 알림 기능

**작성일**: 2026-01-03
**버전**: 1.0
**대상 시스템**: 원브릿지 ERP - 결제관리시스템

---

## 📋 목차

1. [현황 분석](#1-현황-분석)
2. [기능 설계](#2-기능-설계)
3. [백엔드 로직](#3-백엔드-로직)
4. [프론트엔드 UI](#4-프론트엔드-ui)
5. [데이터 플로우](#5-데이터-플로우)
6. [구현 계획](#6-구현-계획)
7. [일정](#7-일정)
8. [리스크 및 대응](#8-리스크-및-대응)
9. [참고자료](#9-참고자료)

---

## 1. 현황 분석

### 1.1 진단 스크립트 결과 기반 현황

#### 청구DB 시트 구조 (19개 컬럼)
```
1. 청구ID
2. 청구유형 (매입/매출)
3. 거래처명
4. 마감ID
5. 청구일
6. 청구금액
7. 청구상태 (DRAFT/ISSUED/PAID)
8. 비고
9. 삭제여부
10. 최종수정일
11. 최종수정자
12. 생성일시
13. 생성자
14. 발행일시
15. 발행자
16. 결제일시
17. partialPaymentEnabled (부분결제 활성화 여부)
18. remainingBalance (미수금)
19. orderNumbers (발주번호 배열 JSON)
```

**데이터 현황**: 16개 청구서 (활성 데이터)

#### 현재 시스템의 문제점

**❌ 없는 기능**:
1. **결제 예정일 컬럼 부재**: 청구DB에 "결제 예정일" 또는 "납기일" 컬럼이 없음
2. **알림 시스템 전무**: 예정일 D-7, D-3, D-day 알림 없음
3. **대시보드 위젯 없음**: 결제 예정 건수 및 금액 표시 없음
4. **이메일/슬랙 알림 없음**: 외부 알림 채널 미연동

**✅ 활용 가능한 기능**:
- 청구DB 조회 기능
- 청구상태 필터링
- Google Apps Script Trigger (시간 기반 트리거)

### 1.2 요구사항 정리

**비즈니스 요구사항**:
1. 매입 청구서의 결제 예정일 D-7, D-3, D-day에 담당자에게 알림
2. 매출 청구서의 입금 예정일 D-3, D-day에 영업팀에게 알림
3. 결제관리 페이지 상단에 "오늘 결제 예정" 위젯 표시
4. 미결제 청구서 목록에 D-day까지 남은 일수 표시

**기술 요구사항**:
1. 청구DB에 "결제예정일" 컬럼 추가
2. Google Apps Script의 시간 기반 트리거로 매일 아침 9시 알림 체크
3. 알림 대상자 설정 (담당자 이메일)
4. 알림 채널: 이메일 (우선) + 웹 알림 배지

---

## 2. 기능 설계

### 2.1 데이터베이스 스키마 변경

#### 청구DB 시트 컬럼 확장: 19개 → 21개

**추가 컬럼**:

| 순번 | 컬럼명 | 데이터 타입 | 설명 | 예시 값 |
|------|--------|------------|------|---------|
| 20 | 결제예정일 | Date | 청구서 결제/입금 예정일 | 2026-01-15 |
| 21 | 알림담당자 | String | 알림 수신 이메일 주소 | "finance@company.com" |

**마이그레이션 스크립트** (SetupPaymentSheets.js에 추가):

```javascript
/**
 * 청구DB에 결제예정일, 알림담당자 컬럼 추가
 */
function migrateInvoiceSheetForAlerts() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName('청구DB');

  if (!sheet) {
    Logger.log('❌ 청구DB 시트를 찾을 수 없습니다.');
    return;
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var currentColCount = headers.length;

  // 이미 추가되어 있는지 확인
  if (headers.indexOf('결제예정일') !== -1) {
    Logger.log('⚠️ 이미 "결제예정일" 컬럼이 존재합니다.');
    return;
  }

  // 20번째 컬럼: 결제예정일
  sheet.getRange(1, currentColCount + 1).setValue('결제예정일');
  sheet.getRange(1, currentColCount + 1).setBackground('#fef3c7').setFontWeight('bold');

  // 21번째 컬럼: 알림담당자
  sheet.getRange(1, currentColCount + 2).setValue('알림담당자');
  sheet.getRange(1, currentColCount + 2).setBackground('#fef3c7').setFontWeight('bold');

  Logger.log('✅ 청구DB 컬럼 추가 완료: 19개 → 21개');
}
```

### 2.2 알림 시나리오

#### 시나리오 A: 매입 청구서 결제 예정일 알림

```
[매일 아침 9시 - 시간 기반 트리거]
1. 시스템이 청구DB에서 상태가 "ISSUED" 또는 "PAID_PARTIAL"인 매입 청구서 조회
2. 각 청구서의 "결제예정일"을 확인
3. D-7, D-3, D-day 해당 건을 필터링
4. 알림담당자에게 이메일 발송:
   - 제목: "[결제 알림] D-3 결제 예정 청구서 3건"
   - 본문: 청구ID, 거래처명, 금액, 예정일 목록
5. 웹 알림 배지 업데이트 (알림 건수)
```

**이메일 예시**:
```
제목: [결제 알림] D-3 결제 예정 청구서 3건

안녕하세요,

3일 후 결제 예정인 청구서가 3건 있습니다:

1. 청구ID: INV-2026-0012
   거래처: 삼성전자
   금액: 5,000,000원
   예정일: 2026-01-06

2. 청구ID: INV-2026-0015
   거래처: LG전자
   금액: 3,000,000원
   예정일: 2026-01-06

3. 청구ID: INV-2026-0018
   거래처: SK하이닉스
   금액: 2,500,000원
   예정일: 2026-01-06

총 결제 예정 금액: 10,500,000원

[청구서 보기]
https://script.google.com/...

감사합니다.
원브릿지 ERP
```

#### 시나리오 B: 매출 청구서 입금 예정일 알림

```
[매일 아침 9시]
1. 매출 청구서 중 "ISSUED" 상태 조회
2. D-3, D-day 필터링
3. 영업팀 담당자에게 이메일 발송
4. 웹 알림 배지 업데이트
```

#### 시나리오 C: 웹 대시보드 위젯

```
[사용자가 결제관리 페이지 접속]
1. 페이지 로드 시 API 호출: getUpcomingPayments()
2. 오늘 결제 예정 건수 및 금액 조회
3. 상단 위젯에 표시:
   - "오늘 결제 예정: 5건 (12,000,000원)"
   - 클릭 시 해당 청구서 목록으로 이동
```

### 2.3 알림 설정 관리

**알림 설정 테이블** (새 시트: "알림설정"):

| 알림ID | 알림유형 | 대상유형 | 트리거일 | 활성여부 | 수신자이메일 |
|--------|---------|---------|---------|---------|------------|
| ALERT-001 | 매입결제 | 매입 | D-7 | TRUE | finance@company.com |
| ALERT-002 | 매입결제 | 매입 | D-3 | TRUE | finance@company.com |
| ALERT-003 | 매입결제 | 매입 | D-day | TRUE | finance@company.com |
| ALERT-004 | 매출입금 | 매출 | D-3 | TRUE | sales@company.com |
| ALERT-005 | 매출입금 | 매출 | D-day | TRUE | sales@company.com |

---

## 3. 백엔드 로직

### 3.1 신규 서비스 파일: AlertService.js

#### 3.1.1 알림 설정 초기화

```javascript
/**
 * 알림설정 시트 생성 및 초기 데이터 입력
 */
function setupAlertSettings() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName('알림설정');

  if (sheet) {
    Logger.log('⚠️ 알림설정 시트가 이미 존재합니다.');
    return;
  }

  sheet = ss.insertSheet('알림설정');

  // 헤더
  var headers = [
    '알림ID',
    '알림유형',
    '대상유형',
    '트리거일',
    '활성여부',
    '수신자이메일',
    '생성일'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#dbeafe')
    .setFontWeight('bold');

  // 초기 데이터
  var initialData = [
    ['ALERT-001', '매입결제', '매입', 'D-7', true, 'finance@company.com', new Date()],
    ['ALERT-002', '매입결제', '매입', 'D-3', true, 'finance@company.com', new Date()],
    ['ALERT-003', '매입결제', '매입', 'D-day', true, 'finance@company.com', new Date()],
    ['ALERT-004', '매출입금', '매출', 'D-3', true, 'sales@company.com', new Date()],
    ['ALERT-005', '매출입금', '매출', 'D-day', true, 'sales@company.com', new Date()]
  ];

  sheet.getRange(2, 1, initialData.length, headers.length).setValues(initialData);

  Logger.log('✅ 알림설정 시트 생성 완료');
}
```

#### 3.1.2 결제 예정 청구서 조회

```javascript
/**
 * 결제 예정 청구서 조회
 * @param {number} daysOffset - 0: D-day, 3: D-3, 7: D-7
 * @param {string} invoiceType - "매입" 또는 "매출"
 * @returns {Array} - 해당 청구서 배열
 */
function getUpcomingInvoices(daysOffset, invoiceType) {
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var sheet = ss.getSheetByName('청구DB');

    if (!sheet) {
      Logger.log('❌ 청구DB 시트를 찾을 수 없습니다.');
      return [];
    }

    var allData = sheet.getDataRange().getValues();
    var headers = allData[0];

    var 청구IDCol = headers.indexOf('청구ID');
    var 청구유형Col = headers.indexOf('청구유형');
    var 거래처명Col = headers.indexOf('거래처명');
    var 청구금액Col = headers.indexOf('청구금액');
    var 청구상태Col = headers.indexOf('청구상태');
    var 결제예정일Col = headers.indexOf('결제예정일');
    var 삭제여부Col = headers.indexOf('삭제여부');
    var 미수금Col = headers.indexOf('미수금');

    // 목표 날짜 계산
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysOffset);

    var upcomingInvoices = [];

    for (var i = 1; i < allData.length; i++) {
      var row = allData[i];

      // 삭제된 데이터 제외
      if (row[삭제여부Col] === true) continue;

      // 유형 필터
      if (row[청구유형Col] !== invoiceType) continue;

      // 상태 필터: ISSUED 또는 PAID_PARTIAL만 (완납된 건 제외)
      var 상태 = row[청구상태Col];
      if (상태 !== 'ISSUED' && 상태 !== 'PAID_PARTIAL') continue;

      // 결제예정일 확인
      var 결제예정일 = row[결제예정일Col];
      if (!(결제예정일 instanceof Date)) continue;

      // 날짜 비교 (년월일만)
      var 예정일Copy = new Date(결제예정일);
      예정일Copy.setHours(0, 0, 0, 0);

      if (예정일Copy.getTime() === targetDate.getTime()) {
        upcomingInvoices.push({
          청구ID: row[청구IDCol],
          청구유형: row[청구유형Col],
          거래처명: row[거래처명Col],
          청구금액: row[청구금액Col],
          미수금: row[미수금Col] || row[청구금액Col],
          청구상태: 상태,
          결제예정일: Utilities.formatDate(결제예정일, Session.getScriptTimeZone(), 'yyyy-MM-dd')
        });
      }
    }

    return upcomingInvoices;

  } catch (error) {
    Logger.log('❌ getUpcomingInvoices 오류: ' + error.message);
    return [];
  }
}
```

#### 3.1.3 알림 이메일 발송

```javascript
/**
 * 결제 예정 알림 이메일 발송
 * @param {string} recipientEmail - 수신자 이메일
 * @param {Array} invoices - 청구서 배열
 * @param {number} daysOffset - D-day 오프셋
 * @param {string} invoiceType - "매입" 또는 "매출"
 */
function sendPaymentAlertEmail(recipientEmail, invoices, daysOffset, invoiceType) {
  if (!invoices || invoices.length === 0) {
    Logger.log('⚠️ 발송할 청구서가 없습니다.');
    return;
  }

  var dDayLabel = '';
  if (daysOffset === 0) {
    dDayLabel = 'D-day (오늘)';
  } else {
    dDayLabel = 'D-' + daysOffset;
  }

  var typeLabel = invoiceType === '매입' ? '결제' : '입금';

  // 이메일 제목
  var subject = '[' + typeLabel + ' 알림] ' + dDayLabel + ' ' + typeLabel + ' 예정 청구서 ' + invoices.length + '건';

  // 이메일 본문
  var body = '';
  body += '안녕하세요,\n\n';

  if (daysOffset === 0) {
    body += '오늘 ' + typeLabel + ' 예정인 청구서가 ' + invoices.length + '건 있습니다:\n\n';
  } else {
    body += daysOffset + '일 후 ' + typeLabel + ' 예정인 청구서가 ' + invoices.length + '건 있습니다:\n\n';
  }

  var totalAmount = 0;

  for (var i = 0; i < invoices.length; i++) {
    var invoice = invoices[i];
    var amount = Number(invoice.미수금) || 0;
    totalAmount += amount;

    body += (i + 1) + '. 청구ID: ' + invoice.청구ID + '\n';
    body += '   거래처: ' + invoice.거래처명 + '\n';
    body += '   금액: ' + amount.toLocaleString() + '원\n';
    body += '   예정일: ' + invoice.결제예정일 + '\n\n';
  }

  body += '총 ' + typeLabel + ' 예정 금액: ' + totalAmount.toLocaleString() + '원\n\n';

  body += '[청구서 보기]\n';
  body += 'https://script.google.com/macros/s/' + ScriptApp.getScriptId() + '/exec\n\n';

  body += '감사합니다.\n';
  body += '원브릿지 ERP';

  // 이메일 발송
  try {
    MailApp.sendEmail({
      to: recipientEmail,
      subject: subject,
      body: body
    });

    Logger.log('✅ 알림 이메일 발송 완료: ' + recipientEmail + ' (' + invoices.length + '건)');

  } catch (error) {
    Logger.log('❌ 이메일 발송 오류: ' + error.message);
  }
}
```

#### 3.1.4 매일 실행되는 알림 체크 함수 (트리거)

```javascript
/**
 * 매일 아침 9시 실행되는 알림 체크 함수
 * (시간 기반 트리거로 등록 필요)
 */
function dailyPaymentAlertCheck() {
  Logger.log('========================================');
  Logger.log('결제 예정 알림 체크 시작: ' + new Date());
  Logger.log('========================================');

  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var alertSheet = ss.getSheetByName('알림설정');

    if (!alertSheet) {
      Logger.log('⚠️ 알림설정 시트가 없습니다. setupAlertSettings() 실행 필요');
      return;
    }

    var alertData = alertSheet.getDataRange().getValues();
    var alertHeaders = alertData[0];

    var 활성여부Col = alertHeaders.indexOf('활성여부');
    var 대상유형Col = alertHeaders.indexOf('대상유형');
    var 트리거일Col = alertHeaders.indexOf('트리거일');
    var 수신자이메일Col = alertHeaders.indexOf('수신자이메일');

    // 각 알림 설정 순회
    for (var i = 1; i < alertData.length; i++) {
      var alert = alertData[i];

      // 비활성화된 알림 스킵
      if (alert[활성여부Col] !== true) continue;

      var 대상유형 = alert[대상유형Col]; // "매입" 또는 "매출"
      var 트리거일 = alert[트리거일Col]; // "D-7", "D-3", "D-day"
      var 수신자이메일 = alert[수신자이메일Col];

      // 트리거일을 숫자로 변환
      var daysOffset = 0;
      if (트리거일 === 'D-day') {
        daysOffset = 0;
      } else if (트리거일.indexOf('D-') === 0) {
        daysOffset = parseInt(트리거일.replace('D-', ''));
      } else {
        continue;
      }

      // 해당 조건의 청구서 조회
      var invoices = getUpcomingInvoices(daysOffset, 대상유형);

      if (invoices.length > 0) {
        Logger.log('[알림 발송] ' + 대상유형 + ' ' + 트리거일 + ': ' + invoices.length + '건');
        sendPaymentAlertEmail(수신자이메일, invoices, daysOffset, 대상유형);
      } else {
        Logger.log('[알림 없음] ' + 대상유형 + ' ' + 트리거일 + ': 0건');
      }
    }

    Logger.log('========================================');
    Logger.log('알림 체크 완료');
    Logger.log('========================================');

  } catch (error) {
    Logger.log('❌ dailyPaymentAlertCheck 오류: ' + error.message);
  }
}
```

#### 3.1.5 시간 기반 트리거 설정

```javascript
/**
 * 매일 아침 9시 알림 체크 트리거 설정
 */
function setupDailyAlertTrigger() {
  // 기존 트리거 삭제
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'dailyPaymentAlertCheck') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('기존 트리거 삭제: ' + triggers[i].getUniqueId());
    }
  }

  // 새 트리거 생성: 매일 오전 9-10시 사이
  ScriptApp.newTrigger('dailyPaymentAlertCheck')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  Logger.log('✅ 매일 오전 9시 알림 트리거 설정 완료');
}
```

### 3.2 API 엔드포인트 추가 (ApiService.js)

```javascript
/**
 * API: 오늘 결제 예정 청구서 조회 (웹 대시보드용)
 */
function api_getTodayUpcomingPayments() {
  var 매입청구서 = getUpcomingInvoices(0, '매입');
  var 매출청구서 = getUpcomingInvoices(0, '매출');

  var totalPurchaseAmount = 0;
  for (var i = 0; i < 매입청구서.length; i++) {
    totalPurchaseAmount += (Number(매입청구서[i].미수금) || 0);
  }

  var totalSalesAmount = 0;
  for (var i = 0; i < 매출청구서.length; i++) {
    totalSalesAmount += (Number(매출청구서[i].미수금) || 0);
  }

  return safeReturn({
    success: true,
    data: {
      매입: {
        count: 매입청구서.length,
        amount: totalPurchaseAmount,
        invoices: 매입청구서
      },
      매출: {
        count: 매출청구서.length,
        amount: totalSalesAmount,
        invoices: 매출청구서
      }
    }
  });
}

/**
 * API: D-7, D-3, D-day 결제 예정 청구서 조회 (페이지별)
 */
function api_getUpcomingPaymentsByDays(params) {
  var daysOffset = params.daysOffset || 0; // 0, 3, 7
  var invoiceType = params.invoiceType || '매입'; // "매입" 또는 "매출"

  var invoices = getUpcomingInvoices(daysOffset, invoiceType);

  return safeReturn({
    success: true,
    data: invoices
  });
}
```

---

## 4. 프론트엔드 UI

### 4.1 결제관리 페이지 상단 위젯 추가

#### 4.1.1 HTML 구조 (Page_PaymentManagement.html)

**위치**: 페이지 헤더 바로 아래

```html
<div class="payment-wrap">
  <!-- 페이지 헤더 -->
  <div class="payment-header">
    <h1>💰 결제 관리</h1>
    <p>입출금 내역을 관리하고 결제를 등록합니다</p>
  </div>

  <!-- ⭐ 신규 추가: 오늘 결제 예정 위젯 -->
  <div class="payment-alert-widget" id="payment-alert-widget" style="display:none;">
    <div class="payment-alert-card purchase">
      <div class="payment-alert-icon">💳</div>
      <div class="payment-alert-content">
        <div class="payment-alert-label">오늘 결제 예정 (매입)</div>
        <div class="payment-alert-value" id="alert-purchase-count">0건</div>
        <div class="payment-alert-amount" id="alert-purchase-amount">₩0</div>
      </div>
      <button class="payment-alert-btn" id="alert-purchase-view-btn">
        상세보기 →
      </button>
    </div>

    <div class="payment-alert-card sales">
      <div class="payment-alert-icon">💰</div>
      <div class="payment-alert-content">
        <div class="payment-alert-label">오늘 입금 예정 (매출)</div>
        <div class="payment-alert-value" id="alert-sales-count">0건</div>
        <div class="payment-alert-amount" id="alert-sales-amount">₩0</div>
      </div>
      <button class="payment-alert-btn" id="alert-sales-view-btn">
        상세보기 →
      </button>
    </div>
  </div>

  <!-- 기존 탭 영역 -->
  <div class="payment-tabs">
    ...
  </div>
</div>
```

#### 4.1.2 CSS 스타일

```css
/* 결제 예정 알림 위젯 */
.payment-alert-widget {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.payment-alert-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 16px;
  border-left: 4px solid #2563eb;
}

.payment-alert-card.purchase {
  border-left-color: #dc2626;
}

.payment-alert-card.sales {
  border-left-color: #10b981;
}

.payment-alert-icon {
  font-size: 36px;
}

.payment-alert-content {
  flex: 1;
}

.payment-alert-label {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 4px;
}

.payment-alert-value {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 4px;
}

.payment-alert-amount {
  font-size: 16px;
  font-weight: 600;
  color: #2563eb;
}

.payment-alert-card.purchase .payment-alert-amount {
  color: #dc2626;
}

.payment-alert-card.sales .payment-alert-amount {
  color: #10b981;
}

.payment-alert-btn {
  padding: 8px 16px;
  background: #f1f5f9;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #475569;
  transition: all 0.2s;
}

.payment-alert-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
}
```

### 4.2 청구서 목록 테이블에 D-day 표시

#### 4.2.1 청구서 관리 페이지 수정 (Page_BillingManagement.html)

**테이블 헤더에 "D-day" 컬럼 추가**:

```html
<table class="billing-table">
  <thead>
    <tr>
      <th>청구ID</th>
      <th>유형</th>
      <th>거래처</th>
      <th>청구일</th>
      <th class="num">청구금액</th>
      <th class="center">상태</th>
      <th>결제예정일</th>
      <th class="center">D-day</th> <!-- ⭐ 신규 추가 -->
      <th>비고</th>
      <th class="center">액션</th>
    </tr>
  </thead>
  <tbody id="billing-mgmt-tbody">
    <!-- 데이터 렌더링 -->
  </tbody>
</table>
```

#### 4.2.2 JavaScript 렌더링 로직 (CommonScripts.html)

```javascript
/**
 * 청구서 목록 렌더링 (D-day 컬럼 포함)
 */
function renderBillingTable(invoices) {
  var tbody = document.getElementById('billing-mgmt-tbody');
  tbody.innerHTML = '';

  if (invoices.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="billing-empty">조회된 청구서가 없습니다.</td></tr>';
    return;
  }

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  for (var i = 0; i < invoices.length; i++) {
    var inv = invoices[i];

    var tr = document.createElement('tr');

    // D-day 계산
    var dDayText = '-';
    var dDayClass = '';

    if (inv.결제예정일 && inv.청구상태 !== 'PAID') {
      var 예정일 = new Date(inv.결제예정일);
      예정일.setHours(0, 0, 0, 0);

      var diffTime = 예정일.getTime() - today.getTime();
      var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        dDayText = 'D+' + Math.abs(diffDays) + ' (연체)';
        dDayClass = 'overdue';
      } else if (diffDays === 0) {
        dDayText = 'D-day';
        dDayClass = 'today';
      } else {
        dDayText = 'D-' + diffDays;
        if (diffDays <= 3) {
          dDayClass = 'urgent';
        } else if (diffDays <= 7) {
          dDayClass = 'warning';
        }
      }
    }

    tr.innerHTML = `
      <td>${inv.청구ID}</td>
      <td>${inv.청구유형}</td>
      <td>${inv.거래처명}</td>
      <td>${inv.청구일}</td>
      <td class="num">${Number(inv.청구금액).toLocaleString()}원</td>
      <td class="center">
        <span class="billing-status-badge ${inv.청구상태}">${inv.청구상태}</span>
      </td>
      <td>${inv.결제예정일 || '-'}</td>
      <td class="center">
        <span class="dday-badge ${dDayClass}">${dDayText}</span>
      </td>
      <td>${inv.비고 || ''}</td>
      <td class="center">
        <button class="billing-btn small" onclick="viewBillingDetail('${inv.청구ID}')">
          상세
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  }
}
```

**CSS 추가**:

```css
/* D-day 뱃지 */
.dday-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.dday-badge.overdue {
  background: #fecaca;
  color: #dc2626;
}

.dday-badge.today {
  background: #fed7aa;
  color: #ea580c;
}

.dday-badge.urgent {
  background: #fef3c7;
  color: #f59e0b;
}

.dday-badge.warning {
  background: #dbeafe;
  color: #2563eb;
}
```

### 4.3 알림 배지 (선택사항)

**페이지 탭에 알림 개수 표시**:

```html
<div class="payment-tabs">
  <button class="payment-tab active" id="payment-tab-1">
    💰 입출금 관리
    <span class="payment-tab-badge" id="payment-badge-count" style="display:none;">0</span>
  </button>
  <button class="payment-tab" id="payment-tab-2">
    🏢 회사비용 관리
  </button>
</div>
```

```css
.payment-tab-badge {
  background: #dc2626;
  color: white;
  border-radius: 12px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  margin-left: 6px;
}
```

---

## 5. 데이터 플로우

### 5.1 매일 알림 체크 플로우

```
[Google Apps Script - 시간 기반 트리거]
  ↓ 매일 오전 9시 실행
[AlertService.js - dailyPaymentAlertCheck()]
  ↓ 알림설정 시트 조회
[알림설정 시트]
  ↓ 활성화된 알림 필터링
[AlertService.js - getUpcomingInvoices()]
  ↓ 청구DB에서 D-7, D-3, D-day 청구서 조회
[청구DB]
  ↓ 필터링된 청구서 반환
[AlertService.js - sendPaymentAlertEmail()]
  ↓ 이메일 생성 및 발송
[Gmail API / MailApp]
  ↓ 수신자에게 이메일 전송
[담당자 이메일]
  ✅ 알림 수신
```

### 5.2 웹 대시보드 위젯 로드 플로우

```
[사용자]
  ↓ 결제관리 페이지 접속
[CommonScripts.html - initPaymentPage()]
  ↓ API 호출: api_getTodayUpcomingPayments()
[ApiService.js]
  ↓ AlertService.getUpcomingInvoices(0, '매입')
  ↓ AlertService.getUpcomingInvoices(0, '매출')
[청구DB]
  ↓ 오늘 결제 예정 청구서 조회
[ApiService.js]
  ↓ JSON 응답 반환
[CommonScripts.html]
  ↓ 위젯 렌더링
[사용자]
  ✅ "오늘 결제 예정: 5건 (12,000,000원)" 확인
```

### 5.3 청구서 생성 시 결제예정일 입력 플로우

```
[사용자]
  ↓ 청구서 발행 모달에서 "결제예정일" 입력
[CommonScripts.html - createBilling()]
  ↓ API 호출: api_createBilling({ ..., 결제예정일: '2026-01-15' })
[SettlementService.js - createBilling()]
  ↓ 청구DB에 데이터 추가 (20번째 컬럼: 결제예정일)
[청구DB]
  ✅ 청구서 생성 완료
```

---

## 6. 구현 계획

### 6.1 Day 1: 데이터베이스 스키마 확장 (2시간)

**작업 내역**:
1. SetupPaymentSheets.js에 `migrateInvoiceSheetForAlerts()` 추가
2. 스크립트 실행하여 청구DB에 "결제예정일", "알림담당자" 컬럼 추가
3. 알림설정 시트 생성: `setupAlertSettings()`
4. 기존 청구서 데이터에 결제예정일 샘플 데이터 입력 (테스트용)

**검증**:
```javascript
function testMigration() {
  migrateInvoiceSheetForAlerts();
  setupAlertSettings();

  // 청구DB 확인
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName('청구DB');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  Logger.log('총 컬럼 수: ' + headers.length); // 21개 확인
  Logger.log('20번째 컬럼: ' + headers[19]); // "결제예정일"
  Logger.log('21번째 컬럼: ' + headers[20]); // "알림담당자"
}
```

### 6.2 Day 2: 백엔드 로직 개발 (4시간)

**작업 내역**:
1. AlertService.js 파일 생성
2. `getUpcomingInvoices()` 함수 구현
3. `sendPaymentAlertEmail()` 함수 구현
4. `dailyPaymentAlertCheck()` 함수 구현
5. ApiService.js에 `api_getTodayUpcomingPayments()` 추가
6. 단위 테스트 실행

**검증**:
```javascript
function testAlertService() {
  // D-day 청구서 조회 테스트
  var invoices = getUpcomingInvoices(0, '매입');
  Logger.log('D-day 매입 청구서: ' + invoices.length + '건');

  // 이메일 발송 테스트
  if (invoices.length > 0) {
    sendPaymentAlertEmail('test@example.com', invoices, 0, '매입');
  }
}
```

### 6.3 Day 3: 시간 기반 트리거 설정 (1시간)

**작업 내역**:
1. `setupDailyAlertTrigger()` 함수 실행
2. Apps Script 트리거 페이지에서 트리거 등록 확인
3. 수동으로 `dailyPaymentAlertCheck()` 실행하여 테스트
4. 실제 이메일 수신 확인

### 6.4 Day 4: 프론트엔드 UI 개발 (3시간)

**작업 내역**:
1. Page_PaymentManagement.html에 위젯 추가
2. CSS 스타일 작성
3. CommonScripts.html에 위젯 로드 로직 추가
4. Page_BillingManagement.html 테이블에 D-day 컬럼 추가
5. 렌더링 로직 수정

**검증**:
- 페이지 로드 시 위젯 정상 표시 확인
- 청구서 목록에 D-day 표시 확인

### 6.5 Day 5: 통합 테스트 및 최적화 (2시간)

**테스트 케이스**:
1. **정상 케이스**:
   - 결제예정일이 오늘인 청구서 → 알림 발송 확인
   - D-3, D-7 청구서 → 알림 발송 확인
   - 웹 위젯 정상 표시
2. **엣지 케이스**:
   - 결제예정일이 없는 청구서 → 알림 대상 제외
   - 이미 결제 완료된 청구서 → 알림 대상 제외
3. **오류 케이스**:
   - 잘못된 이메일 주소 → 오류 로깅

---

## 7. 일정

| Day | 작업 내용 | 담당 | 시간 |
|-----|----------|------|------|
| Day 1 | 데이터베이스 스키마 확장 | 개발자 | 2h |
| Day 2 | 백엔드 로직 개발 | 개발자 | 4h |
| Day 3 | 시간 기반 트리거 설정 | 개발자 | 1h |
| Day 4 | 프론트엔드 UI 개발 | 개발자 | 3h |
| Day 5 | 통합 테스트 및 최적화 | 개발자 + QA | 2h |
| **Total** | | | **12h (1.5일)** |

---

## 8. 리스크 및 대응

### 8.1 기술 리스크

| 리스크 | 발생 가능성 | 영향도 | 대응 방안 |
|--------|------------|--------|----------|
| 트리거 실행 실패 | 낮 | 높음 | 트리거 실행 이력 로깅, 오류 발생 시 관리자에게 알림 |
| 이메일 발송 한도 초과 | 중 | 중 | MailApp 일일 한도(100통) 확인, 초과 시 슬랙 알림으로 대체 |
| 결제예정일 미입력 | 높음 | 중 | 청구서 발행 시 필수 입력 검증 추가 |
| 대량 청구서 처리 시 성능 저하 | 낮 | 낮 | 청구서 1000건 이하 환경에서는 문제 없음 |

### 8.2 비즈니스 리스크

| 리스크 | 대응 방안 |
|--------|----------|
| 사용자가 알림 이메일을 확인하지 않음 | 웹 대시보드 위젯 강조 표시, 슬랙 알림 추가 고려 |
| 결제예정일을 잘못 입력 | 청구서 수정 기능 제공, 이력 관리 |

---

## 9. 참고자료

### 9.1 Google Apps Script 공식 문서
- [Time-driven Triggers](https://developers.google.com/apps-script/guides/triggers/installable#time-driven_triggers)
- [MailApp.sendEmail](https://developers.google.com/apps-script/reference/mail/mail-app#sendemailmessage)
- [ScriptApp.newTrigger](https://developers.google.com/apps-script/reference/script/script-app#newtriggerhandlerfunction)

### 9.2 기존 코드 참고
- `SetupPaymentSheets.js`: 시트 마이그레이션 패턴
- `PaymentService.js`: 데이터 조회 로직
- `SettlementService.js`: 청구서 생성 로직

---

**문서 끝**
