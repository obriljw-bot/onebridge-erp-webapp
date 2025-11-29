# OneBridge ERP - 회계 마감 시스템 아키텍처

## 📌 개요
OneBridge ERP의 회계 마감 기능 확장 설계 문서입니다.

---

## 🎯 Phase 1: 매입/매출 마감 기능

### 데이터베이스 설계

#### 1. 매입마감DB 시트 (Purchase Settlement)
```
컬럼 구조:
- 마감ID          : TEXT (PK) "PS-202501-ABC상사"
- 마감유형        : TEXT "PURCHASE" (고정)
- 매입처          : TEXT "ABC상사"
- 마감기간시작    : DATE "2025-01-01"
- 마감기간종료    : DATE "2025-01-31"
- 마감상태        : TEXT "DRAFT" | "CONFIRMED" | "LOCKED"
- 총품목수        : NUMBER
- 총발주수량      : NUMBER
- 총확정수량      : NUMBER
- 총매입액        : NUMBER
- 차이금액        : NUMBER (발주수량-확정수량 차이)
- 비고            : TEXT
- 생성일시        : DATETIME
- 생성자          : TEXT
- 확정일시        : DATETIME
- 확정자          : TEXT
```

#### 2. 매출마감DB 시트 (Sales Settlement)
```
컬럼 구조:
- 마감ID          : TEXT (PK) "SS-202501-올리브영"
- 마감유형        : TEXT "SALES" (고정)
- 발주처          : TEXT "올리브영"
- 마감기간시작    : DATE "2025-01-01"
- 마감기간종료    : DATE "2025-01-31"
- 마감상태        : TEXT "DRAFT" | "CONFIRMED" | "LOCKED"
- 총품목수        : NUMBER
- 총발주수량      : NUMBER
- 총확정수량      : NUMBER
- 총공급액        : NUMBER
- 차이금액        : NUMBER
- 비고            : TEXT
- 생성일시        : DATETIME
- 생성자          : TEXT
- 확정일시        : DATETIME
- 확정자          : TEXT
```

#### 3. 마감상세DB 시트 (Settlement Details)
```
컬럼 구조:
- 마감ID          : TEXT (FK)
- 발주번호        : TEXT
- 발주일          : DATE
- 브랜드          : TEXT
- 제품명          : TEXT
- 품목코드        : TEXT
- 발주수량        : NUMBER
- 확정수량        : NUMBER
- 매입가          : NUMBER
- 공급가          : NUMBER
- 매입액          : NUMBER
- 공급액          : NUMBER
- 차이수량        : NUMBER (발주-확정)
- 차이금액        : NUMBER
```

---

## 🏗️ 시스템 아키텍처

### API 레이어 (ApiService.js)
```javascript
// 매입 마감
- savePurchaseSettlementApi(params)
- getPurchaseSettlementsApi(params)
- confirmPurchaseSettlementApi(settlementId)
- deletePurchaseSettlementApi(settlementId)

// 매출 마감
- saveSalesSettlementApi(params)
- getSalesSettlementsApi(params)
- confirmSalesSettlementApi(settlementId)
- deleteSalesSettlementApi(settlementId)

// 마감 상세
- getSettlementDetailApi(settlementId)
- exportSettlementExcelApi(settlementId)
```

### 비즈니스 로직 레이어 (SettlementService.js)
```javascript
// 마감 생성 및 조회
- createSettlement(type, params)
- getSettlements(type, params)
- getSettlementById(settlementId)

// 마감 데이터 집계
- aggregateOrders(type, params)
- calculateDifferences(orderData)

// 마감 확정 및 취소
- confirmSettlement(settlementId)
- cancelSettlement(settlementId)

// 엑셀 다운로드
- exportSettlementToExcel(settlementId)
```

### 프론트엔드 레이어

#### Page_PurchaseSettlement.html
- 매입처 선택
- 기간 선택
- 마감 데이터 조회
- 차이 확인 (발주수량 vs 확정수량)
- 임시저장 / 확정
- 엑셀 다운로드

#### Page_SalesSettlement.html
- 발주처 선택
- 기간 선택
- 마감 데이터 조회
- 차이 확인
- 임시저장 / 확정
- 엑셀 다운로드

#### CommonScripts.html
```javascript
OB.initPurchaseSettlementPage()
OB.initSalesSettlementPage()

// 공통 상태 관리
OB.purchaseSettlementState = {
  settlements: [],
  currentSettlement: null,
  selectedSupplier: '',
  startDate: '',
  endDate: ''
}

OB.salesSettlementState = {
  settlements: [],
  currentSettlement: null,
  selectedBuyer: '',
  startDate: '',
  endDate: ''
}
```

---

## 📊 데이터 흐름

### 매입 마감 프로세스
```
1. 사용자 입력
   ↓ (매입처, 기간 선택)
2. 거래원장 데이터 집계
   ↓ (발주번호별 그룹핑)
3. 차이 계산
   ↓ (발주수량 - 확정수량)
4. 임시저장
   ↓ (매입마감DB에 DRAFT 상태로 저장)
5. 검토 및 수정
   ↓
6. 확정
   ↓ (상태를 CONFIRMED로 변경)
7. 엑셀 다운로드
   ↓ (업체 전달용)
```

### 매출 마감 프로세스
```
동일한 흐름, 발주처(매출처) 기준
```

---

## 🎨 UI/UX 설계

### 매입 마감 페이지 레이아웃
```
┌─────────────────────────────────────────┐
│ 🔍 매입처별 마감                         │
├─────────────────────────────────────────┤
│ 매입처: [드롭다운]   기간: [시작] ~ [종료] │
│ [조회] [초기화]                          │
├─────────────────────────────────────────┤
│ 📊 마감 요약                             │
│ - 총 품목수: 150개                       │
│ - 총 발주수량: 5,000개                   │
│ - 총 확정수량: 4,950개                   │
│ - 차이수량: -50개 ⚠️                    │
│ - 총 매입액: ₩10,000,000                │
├─────────────────────────────────────────┤
│ 📋 상세 내역                             │
│ [발주번호][발주일][브랜드][품목][수량]... │
│ ...                                     │
├─────────────────────────────────────────┤
│ [임시저장] [확정] [엑셀 다운로드]         │
└─────────────────────────────────────────┘
```

---

## 🔐 권한 및 상태 관리

### 마감 상태 전이
```
DRAFT (임시저장)
  ↓ confirmSettlement()
CONFIRMED (확정)
  ↓ lockMonth() (월별 마감 확정 시)
LOCKED (잠금)
  ↓ unlockMonth() (관리자만)
CONFIRMED
```

### 편집 권한
- DRAFT: 수정 가능
- CONFIRMED: 읽기 전용
- LOCKED: 읽기 전용 (월별 마감 확정된 경우)

---

## 📦 배포 계획

### Phase 1-1: 매입 마감 (2-3일)
- [ ] 데이터베이스 시트 생성
- [ ] SettlementService.js 구현
- [ ] ApiService.js API 추가
- [ ] Page_PurchaseSettlement.html 구현
- [ ] CommonScripts.html 초기화 함수 추가
- [ ] 사이드바 메뉴 추가

### Phase 1-2: 매출 마감 (1-2일)
- [ ] Page_SalesSettlement.html 구현
- [ ] 매출 마감 API 추가
- [ ] CommonScripts.html 초기화 함수 추가

### Phase 1-3: 테스트 및 검증 (1일)
- [ ] 기능 테스트
- [ ] 데이터 정합성 검증
- [ ] UI/UX 개선

---

## 🔄 기존 시스템과의 통합

### 재사용 가능한 컴포넌트
- ✅ `OB.showLoading()` / `OB.hideLoading()`
- ✅ `OB.formatDate()`
- ✅ `OB.formatNumber()`
- ✅ 페이지네이션 로직
- ✅ 정렬 기능
- ✅ 엑셀 다운로드 (CSV)

### 데이터 소스
- ✅ 거래원장 시트 (기존)
- ✅ `getPrintableOrdersApi()` 활용

---

## 📝 참고사항

### SPA 아키텍처 준수
- ❌ Page_*.html에 `<script>` 태그 금지
- ✅ 모든 JavaScript는 CommonScripts.html에 작성
- ✅ `OB.init*Page()` 패턴 사용
- ✅ API 래퍼는 `safeReturn()` 적용

### 코드 컨벤션
- 함수명: camelCase
- 상수: UPPER_SNAKE_CASE
- 파일명: PascalCase (서비스), kebab-case (페이지)
- 주석: JSDoc 스타일

---

## 🚀 다음 단계 (Phase 2)

- 청구 관리 기능
- 월별 마감 확정 기능
- 대시보드 통계 추가

---

*Last Updated: 2025-11-29*
