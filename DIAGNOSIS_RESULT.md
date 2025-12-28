# 청구DB orderNumbers 진단 결과

**진단 일시**: 2025-12-28 11:01 AM
**진단 스크립트**: CheckInvoiceDBStructure.js

---

## 🔍 발견 사항

### 청구DB 구조
- **총 컬럼 수**: 19개
- **orderNumbers 위치**: S열 (col 19) ✅
- **발주번호 (레거시) 위치**: I열 (col 9) ✅
- **billingType 위치**: R열 (col 18) ✅

### 데이터 상태
- **총 청구서**: 6개 행
- **orderNumbers 채워짐**: 4개 (66.7%) ✅
- **orderNumbers 비어있음**: 2개 (33.3%) ❌

### 비어있는 행
1. **행 6**: `INV-20251228-001` (오늘 생성)
   - 발주번호: `["20251202-C001-AL-009"]` ✅ 있음
   - billingType: (공란) ❌
   - orderNumbers: (공란) ❌

2. **행 7**: (상세 로그 없음, 추정)

---

## 🎯 근본 원인

### 문제 1: 마이그레이션이 일부만 실행됨
- 마이그레이션 스크립트 실행 결과: "4개 행 이관"
- 하지만 총 6개 행 존재
- **2개 행이 마이그레이션되지 않음**

### 문제 2: 최근 생성 청구서가 orderNumbers를 채우지 못함
- `INV-20251228-001`은 오늘 생성
- 마이그레이션 이후 createBilling()으로 생성된 것으로 추정
- 하지만 orderNumbers와 billingType이 비어있음

### 가능한 원인:
1. **createBilling()이 제대로 작동하지 않음**:
   - params.orderNumbers가 전달되지 않았거나
   - 동적 헤더 switch문에서 누락되었거나

2. **프론트엔드에서 orderNumbers를 전달하지 않음**:
   - createDirectBillingApi() 호출 시 params.orderNumbers 누락

---

## ✅ 해결 방법

### 즉시 조치: ForcePopulateOrderNumbers 실행

스크립트가 자동으로:
1. 레거시 "발주번호" 컬럼에서 데이터 복사 → orderNumbers
2. billingType 설정 (DIRECT or SETTLEMENT)
3. 이미 채워진 행은 스킵

**예상 결과**:
- 2개 비어있는 행이 복구됨
- 모든 청구서에서 "발주: N건" 정상 표시

---

## 📊 샘플 데이터 분석

### 정상 행 (행 2):
```
청구ID: INV-20251216-001
청구유형: SALES
발주번호: ["20251202-C001-DG-001"]
billingType: DIRECT
orderNumbers: ["20251202-C001-DG-001"]
```
✅ 모든 필드 정상

### 문제 행 (행 6):
```
청구ID: INV-20251228-001
청구유형: SALES
발주번호: ["20251202-C001-AL-009"]
billingType: (공란)
orderNumbers: (공란)
```
❌ orderNumbers와 billingType 누락

---

## 🔧 장기 해결책

### 1. createBilling() 함수 검증 필요
- orderNumbers가 항상 채워지는지 확인
- 로그에서 `[createBilling] orderNumbers 직접 전달` 또는 `[createBilling] settlementId로 orderNumbers 조회` 메시지 확인

### 2. 프론트엔드 호출 확인
- CommonScripts.html에서 createDirectBillingApi() 호출 시
- params.orderNumbers가 제대로 전달되는지 확인

### 3. 필수 필드 검증 추가
- createBilling()에서 orderNumbers가 비어있으면 경고 또는 오류

---

## 📝 다음 단계

1. ✅ **ForcePopulateOrderNumbers.js 실행** ← 지금 바로!
2. 청구DB S열 (orderNumbers) 데이터 확인
3. 결제 페이지에서 청구서 조회 테스트
4. "발주: N건" 정상 표시 확인

---

**진단 완료**
