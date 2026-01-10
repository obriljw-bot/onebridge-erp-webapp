# InvoiceOutputService.js 상세 분석 보고서

> **파일 위치**: `/tmp/previous_branch/InvoiceOutputService.js`
> **분석 목적**: 이전 브랜치의 청구서/발주서 출력 엔진 완전 분석
> **총 라인 수**: 2224 라인

---

## 목차

1. [함수 목록 및 시그니처](#1-함수-목록-및-시그니처)
2. [함수별 상세 동작 흐름](#2-함수별-상세-동작-흐름)
3. [데이터 의존성](#3-데이터-의존성)
4. [전용 양식 관련 로직](#4-전용-양식-관련-로직)
5. [PDF/Excel 생성 로직](#5-pdfexcel-생성-로직)
6. [매입처별 통합 로직](#6-매입처별-통합-로직)

---

## 1. 함수 목록 및 시그니처

### 1.1 메인 엔드포인트

#### `generateInvoiceZip(params)`
**목적**: 청구서/발주서 PDF/Excel 생성 메인 엔트리포인트

**파라미터**:
- `params.orderCodes` (string[]): 발주번호 배열
- `params.docType` (string): 문서 유형 (`INVOICE_VAT`, `ORDER_PURCHASE`, `INVOICE_NVAT`)
- `params.printMode` (string): 출력 모드 (`full`, `short`, `auto`)
- `params.modesByOrder` (Object): 발주번호별 개별 출력 모드 맵
- `params.mergeBySupplier` (boolean): 매입처별 통합 출력 여부
- `params.outputFormat` (string): 출력 형식 (`PDF`, `EXCEL`)
- `params.docDate` (string): 문서 날짜
- `params.deliveryDate` (string): 납기일자
- `params.manualRemark` (string): 수동 비고

**반환값**:
```javascript
{
  success: boolean,
  fileId: string,      // Drive 파일 ID
  fileName: string,    // 파일명
  error?: string       // 에러 메시지 (실패 시)
}
```

---

### 1.2 PDF 생성 함수 (개별 발주)

#### `buildInvoiceVatPdf(orderCode, orderRows, header, printMode)`
**목적**: 거래명세서(부포) PDF 1건 생성

**파라미터**:
- `orderCode` (string): 발주번호
- `orderRows` (Array): 해당 발주의 거래원장 행 배열
- `header` (Array): 거래원장 헤더
- `printMode` (string): 출력 모드 (`full`, `short`, `auto`)

**반환값**: `Blob` (PDF 파일)

**주요 특징**:
- 수량 기준: **확정수량** 우선, 없으면 발주수량
- 가격 기준: **공급가/공급액**
- VAT 계산: `totalVat = totalAmount - totalSupply`
- 템플릿: `Templates_Invoice_VAT`

---

#### `buildOrderPurchasePdf(orderCode, orderRows, header, printMode)`
**목적**: 발주서(매입) PDF 1건 생성

**파라미터**: `buildInvoiceVatPdf`와 동일

**반환값**: `Blob` (PDF 파일)

**주요 특징**:
- 수량 기준: **발주수량** 우선
- 가격 기준: **매입가/매입액**
- VAT 계산:
  - **부별**: `totalSupply = totalAmount / 1.1`, `totalVat = totalAmount - totalSupply`
  - **부포**: `totalSupply = totalAmount`, `totalVat = totalSupply * 0.1`, `totalAmount = totalSupply + totalVat`
- 비고란: 부가세구분, 입고지, 담당자, 요청사항 포함
- 템플릿: `Templates_Invoice_VAT` (동일 템플릿 사용)

---

#### `buildInvoiceNvatPdf(orderCode, orderRows, header, printMode)`
**목적**: 거래명세서(영세) PDF 1건 생성

**파라미터**: `buildInvoiceVatPdf`와 동일

**반환값**: `Blob` (PDF 파일)

**주요 특징**:
- 수량 기준: **확정수량** 우선
- 가격 기준: **공급가/공급액**
- VAT 계산: `totalVat = 0` (영세율)
- 비고란: "※ 영세율 적용"
- 템플릿: `Templates_Invoice_VAT`

---

### 1.3 PDF 생성 함수 (통합 출력)

#### `buildInvoiceVatPdfMerged(orderCodes, allOrderRows, header, modesByOrder, defaultMode)`
**목적**: 여러 발주번호를 하나의 거래명세서(부포) PDF로 통합

**파라미터**:
- `orderCodes` (string[]): 통합할 발주번호 배열
- `allOrderRows` (Array): 모든 발주의 행 데이터
- `header` (Array): 거래원장 헤더
- `modesByOrder` (Object): 발주번호별 출력방식 맵
- `defaultMode` (string): 기본 출력방식

**반환값**: `Blob` (PDF 파일)

**처리 흐름**:
1. 발주번호(브랜드)별로 품목 그룹핑
2. 각 브랜드별로 출력방식(`full`/`short`) 적용
3. 전체 품목 리스트 병합
4. 통합 금액 계산
5. PDF 생성

---

#### `buildInvoiceNvatPdfMerged(orderCodes, allOrderRows, header, modesByOrder, defaultMode)`
**목적**: 여러 발주번호를 하나의 거래명세서(영세) PDF로 통합

**파라미터**: `buildInvoiceVatPdfMerged`와 동일

**반환값**: `Blob` (PDF 파일)

**특징**: VAT = 0, 비고란 "(영세율)"

---

#### `buildOrderPurchasePdfMerged(orderCodes, allOrderRows, header, modesByOrder, defaultMode)`
**목적**: 여러 발주번호를 하나의 발주서(매입) PDF로 통합

**파라미터**: `buildInvoiceVatPdfMerged`와 동일

**반환값**: `Blob` (PDF 파일)

**특징**: 부별/부포 VAT 계산, 비고란 포함

---

### 1.4 헬퍼 함수

#### `findPartnerByName_(name)`
**목적**: 거래처DB에서 거래처명으로 1건 조회

**파라미터**:
- `name` (string): 거래처명

**반환값**:
```javascript
{
  name: string,
  bizNo: string,           // 사업자번호
  manager: string,         // 담당자
  phone: string,           // 연락처
  address: string,         // 주소
  deliveryAddr: string,    // 입고지
  specialRequest: string   // 요청사항
} | null
```

**동작**:
1. `getSuppliers()` 호출하여 거래처DB 전체 로드
2. 거래처명이 일치하는 행 검색
3. 필요한 컬럼 값 추출하여 객체 반환

---

#### `getStampBase64_()`
**목적**: 인감 이미지 Base64 문자열 조회

**파라미터**: 없음

**반환값**: `string` (Base64 인코딩된 이미지)

**동작**:
- `PropertiesService.getScriptProperties().getProperty('STAMP_BASE64')` 조회
- 없으면 빈 문자열 반환

---

#### `getLogoBase64_()`
**목적**: 로고 이미지 Base64 문자열 조회

**파라미터**: 없음

**반환값**: `string` (Base64 인코딩된 이미지)

**동작**:
- `PropertiesService.getScriptProperties().getProperty('LOGO_BASE64')` 조회
- 없으면 빈 문자열 반환

---

#### `formatNumber_(n)`
**목적**: 숫자를 천단위 콤마 형식으로 변환

**파라미터**:
- `n` (number): 숫자

**반환값**: `string` (예: "1,000,000")

**동작**:
- `n.toLocaleString('ko-KR')` 사용
- null, undefined, NaN은 빈 문자열 반환

---

#### `formatDateYmd_(d)`
**목적**: 날짜를 'yyyy-MM-dd' 형식으로 변환

**파라미터**:
- `d` (Date | string): 날짜 객체 또는 문자열

**반환값**: `string` (예: "2025-01-10")

**동작**:
- Date 객체인 경우: `Utilities.formatDate()` 사용
- 문자열인 경우: 그대로 반환

---

#### `numberToHangulKor_(num)`
**목적**: 정수 금액을 한글 금액으로 변환

**파라미터**:
- `num` (number): 금액 (정수)

**반환값**: `string` (예: "구십구만 원")

**동작 알고리즘**:
1. 0이면 "영원" 반환
2. 만, 억, 조 단위로 분해
3. 각 단위 내에서 십, 백, 천 단위 처리
4. 1이 십/백/천 앞에 올 경우 "일" 생략 (예: "십만" not "일십만")

**예시**:
- `990000` → "구십구만 원"
- `1234567` → "백이십삼만사천오백육십칠 원"

---

#### `generateDetailExcel_(orderRows, header, orderCode, fileName)`
**목적**: Short 모드용 세부목록 엑셀 생성

**파라미터**:
- `orderRows` (Array): 발주 데이터 행 배열
- `header` (Array): 거래원장 헤더
- `orderCode` (string): 발주번호
- `fileName` (string): 엑셀 파일명

**반환값**: `Blob` (Excel 파일)

**동작 흐름**:
1. 새 스프레드시트 생성 (`SpreadsheetApp.create`)
2. 헤더 작성: `['순번', '발주일', '품목코드', '브랜드', '품명', '수량', '단가', '금액']`
3. 헤더 스타일 적용 (배경색 `#4a5568`, 흰색 글자)
4. 데이터 행 작성 (수량 > 0인 품목만)
5. 숫자 컬럼 포맷 적용 (`#,##0`)
6. 열 너비 자동 조정
7. Excel 파일로 내보내기 (`getAs('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')`)
8. 임시 스프레드시트 삭제

---

### 1.5 전용 양식 관련 함수

#### `getCustomTemplateGroup_(brandName)`
**목적**: 브랜드명이 전용 양식 대상인지 확인

**파라미터**:
- `brandName` (string): 브랜드명

**반환값**: `'ROMAND_NUDZ' | 'JONGGEUNDANG' | 'BBIA_GROUP' | null`

**로직**:
```javascript
ROMAND_NUDZ: ['롬앤', '누즈', 'ROMAND', 'rom&nd']
JONGGEUNDANG: ['종근당', '종근당건강']
BBIA_GROUP: ['삐아', '어바웃톤', '이글립스', 'BBIA', 'ABOUTTONE', 'EGLIPS']
```
- 브랜드명을 대문자로 변환 후 키워드 포함 여부 체크

---

#### `getCustomTemplateFileIds_()`
**목적**: 전용 양식 템플릿 파일 ID 조회

**파라미터**: 없음

**반환값**:
```javascript
{
  ROMAND_NUDZ: string,
  JONGGEUNDANG: string,
  BBIA_GROUP: string
}
```

**동작**:
- Script Properties에서 조회:
  - `TEMPLATE_ROMAND_NUDZ`
  - `TEMPLATE_JONGGEUNDANG`
  - `TEMPLATE_BBIA_GROUP`

---

#### `buildCustomTemplateExcel_(templateGroup, orderCode, orderRows, header, options)`
**목적**: 전용 양식 Excel 파일 생성 라우터

**파라미터**:
- `templateGroup` (string): `ROMAND_NUDZ`, `JONGGEUNDANG`, `BBIA_GROUP`
- `orderCode` (string): 발주번호
- `orderRows` (Array): 발주 데이터
- `header` (Array): 헤더
- `options` (Object): 옵션 (docDate, deliveryDate 등)

**반환값**: `Blob` (Excel 파일) | `null`

**동작**: `templateGroup`에 따라 해당 함수로 라우팅

---

#### `buildRomandNudzExcel_(templateFileId, orderCode, orderRows, header, options)`
**목적**: 롬앤/누즈 전용 양식 Excel 생성

**파라미터**:
- `templateFileId` (string): 템플릿 파일 ID
- 나머지: `buildCustomTemplateExcel_`와 동일

**반환값**: `Blob` (Excel 파일)

**템플릿 구조**:
- 시트명: `롬앤(발주양식)`
- 시작 행: **15행**
- 컬럼 매핑:
  - 2열(B): 바코드
  - 3열(C): 제품명
  - 6열(F): "39%" (고정값)
  - 9열(I): 수량

**XLSX → Google Sheets 변환 로직**:
1. 템플릿 파일 MIME 타입 확인
2. XLSX 파일인 경우:
   ```javascript
   var blob = templateFile.getBlob();
   var resource = {
     title: '롬앤발주_' + orderCode + '_' + Date.now(),
     mimeType: MimeType.GOOGLE_SHEETS
   };
   copiedFile = Drive.Files.insert(resource, blob, { convert: true });
   ```
3. Google Sheets인 경우: `makeCopy()` 사용
4. 데이터 입력 후 Excel Blob로 변환
5. 임시 파일 삭제

---

#### `buildJonggeundangExcel_(templateFileId, orderCode, orderRows, header, options)`
**목적**: 종근당 전용 양식 Excel 생성

**파라미터**: `buildRomandNudzExcel_`와 동일

**반환값**: `Blob` (Excel 파일)

**템플릿 구조**:
- 시트명: `2. 발주서`
- 시작 행: **5행**
- 컬럼 매핑:
  - B5: 발주일 (options.docDate)
  - 5열(E): 품목코드
  - 6열(F): 제품명
  - 9열(I): 공급가
  - 10열(J): 수량

**특징**: XLSX 변환 로직 동일

---

#### `buildBbiaGroupExcel_(templateFileId, orderCode, orderRows, header, options)`
**목적**: 삐아계열 전용 양식 Excel 생성

**파라미터**: `buildRomandNudzExcel_`와 동일

**반환값**: `Blob` (Excel 파일)

**템플릿 구조**:
- 시트명: 브랜드별 (`삐아`, `어바웃톤`, `이글립스`)
- 시작 행: **10행**
- 컬럼 매핑:
  - B8: 날짜 (docDate + deliveryDate)
  - **바코드 매칭 방식**: 템플릿에 있는 바코드와 발주 데이터의 바코드를 비교하여 수량 입력

**바코드 매칭 로직**:
```javascript
// 1. 발주 데이터에서 바코드 → 수량 맵 생성
var qtyMap = {};
for (var i = 0; i < orderRows.length; i++) {
  var barcode = String(orderRows[i][idxBarcode] || '').trim();
  var qty = Number(orderRows[i][idxQty] || 0);
  if (barcode && qty) qtyMap[barcode] = (qtyMap[barcode] || 0) + qty;
}

// 2. 템플릿 10행부터 마지막 행까지 바코드 읽기
var templateData = sheet.getRange(10, 1, sheet.getLastRow() - 9, 8).getValues();
for (var r = 0; r < templateData.length; r++) {
  var tBarcode = String(templateData[r][1] || templateData[r][0] || '').trim();
  if (tBarcode && qtyMap[tBarcode]) {
    // 3. 매칭되면 8열(H)에 수량 입력
    sheet.getRange(10 + r, 8).setValue(qtyMap[tBarcode]);
  }
}
```

**특징**: 템플릿에 미리 품목이 등록되어 있고, 바코드로 매칭하여 수량만 입력

---

### 1.6 Excel 출력 함수

#### `generateExcelOutput_(orderCodes, rows, header, options)`
**목적**: 일반 Excel 형식으로 발주/거래명세서 데이터 출력

**파라미터**:
- `orderCodes` (string[]): 발주번호 배열
- `rows` (Array): 거래원장 전체 행
- `header` (Array): 거래원장 헤더
- `options` (Object):
  - `docType`: 문서 유형
  - `mergeBySupplier`: 매입처별 통합 여부
  - `docDate`: 문서 날짜
  - `manualRemark`: 수동 비고

**반환값**:
```javascript
{
  success: boolean,
  fileId: string,
  fileName: string,
  downloadUrl: string,
  error?: string
}
```

**동작 흐름**:
1. 선택된 발주의 데이터 필터링
2. 전용 양식 체크 (`docType.indexOf('CUSTOM_') === 0`)
3. 문서 유형별 헤더 및 데이터 함수 정의:
   - **발주서**: `['No', '발주번호', '발주일', '매입처', '브랜드', '품목코드', '품명', '규격', '발주수량', '매입단가', '매입금액', '비고']`
   - **거래명세서**: `['No', '발주번호', '발주일', '발주처', '브랜드', '품목코드', '품명', '규격', '확정수량', '공급단가', '공급가액', 'VAT', '합계', '비고']`
4. 헤더 스타일 적용 (배경색 `#334155`, 흰색 글자)
5. 데이터 행 작성 (수량 > 0만)
6. 합계 행 추가 (SUM 수식)
7. 비고 추가 (있을 경우)
8. Excel 파일 생성 및 Drive에 저장
9. 임시 스프레드시트 삭제

**VAT 계산 (거래명세서)**:
```javascript
var vat = 0;
if (isVat) {
  var vatType = String(row[idxVatType] || '').trim();
  if (vatType === '부별') {
    vat = Math.round(supplyAmt * 0.1);
  } else if (vatType === '부포') {
    vat = Math.round(supplyAmt / 11);
  }
}
```

---

#### `generateCustomTemplateExcel_(docType, orderCodes, rows, header, options)`
**목적**: 전용 양식 Excel 파일 생성 메인 함수

**파라미터**:
- `docType` (string): `CUSTOM_ROMAND`, `CUSTOM_JONGGEUNDANG`, `CUSTOM_BBIA`
- 나머지: `generateExcelOutput_`와 동일

**반환값**: `generateExcelOutput_`와 동일

**동작 흐름**:
1. docType → templateGroup 변환:
   ```javascript
   'CUSTOM_ROMAND' → 'ROMAND_NUDZ'
   'CUSTOM_JONGGEUNDANG' → 'JONGGEUNDANG'
   'CUSTOM_BBIA' → 'BBIA_GROUP'
   ```
2. 발주번호별로 전용 양식 Excel 생성 (반복)
3. 단일 파일: 직접 Drive에 저장
4. 여러 파일: ZIP으로 묶어서 저장

---

## 2. 함수별 상세 동작 흐름

### 2.1 `generateInvoiceZip()` 메인 플로우

```
[시작]
  ↓
[파라미터 추출]
  - orderCodes, docType, printMode, modesByOrder
  - mergeBySupplier, outputFormat, docDate, deliveryDate, manualRemark
  ↓
[입력 검증]
  - orderCodes.length === 0 ? → 에러 반환
  ↓
[거래원장 시트 로드]
  - getOrderMergedSheet() 호출
  - 전체 데이터 로드: data = sheet.getDataRange().getValues()
  - header = data[0], rows = data.slice(1)
  ↓
[컬럼 인덱스 확인]
  - idxOrderNo = header.indexOf('발주번호')
  - idxSupplier = header.indexOf('매입처')
  - idxOrderDate = header.indexOf('발주일')
  - idxOrderNo === -1 ? → 에러 반환
  ↓
[출력 형식 분기]
  ├─ outputFormat === 'EXCEL' ?
  │    ├─ YES → generateExcelOutput_() 호출 → 종료
  │    └─ NO → 계속
  ↓
[매입처별 통합 모드 분기]
  ├─ mergeBySupplier === true ?
  │    ├─ YES → [매입처별 통합 출력 로직]
  │    │         ├─ 1. 발주번호별로 매입처와 발주일 매핑
  │    │         │    orderInfoMap = { orderCode: { supplier, orderDate } }
  │    │         ├─ 2. 매입처별로 발주번호 그룹핑
  │    │         │    supplierGroups = { supplier: { orderCodes: [], orderDate } }
  │    │         ├─ 3. 매입처별로 통합 PDF 생성 (for 루프)
  │    │         │    ├─ 해당 매입처의 모든 발주 데이터 수집
  │    │         │    ├─ Short 모드 체크 (하나라도 있으면 needsExcel = true)
  │    │         │    ├─ docType별 PDF 생성:
  │    │         │    │    ├─ INVOICE_VAT → buildInvoiceVatPdfMerged()
  │    │         │    │    ├─ INVOICE_NVAT → buildInvoiceNvatPdfMerged()
  │    │         │    │    └─ ORDER_PURCHASE → buildOrderPurchasePdfMerged()
  │    │         │    ├─ PDF 파일명 설정: '원브릿지_{supplier}_{docTypeLabel}_{dateStr}.pdf'
  │    │         │    ├─ pdfBlobs.push(pdfBlob)
  │    │         │    └─ needsExcel ? → generateDetailExcel_() 호출 → pdfBlobs.push()
  │    │         └─ 종료
  │    └─ NO → 계속
  ↓
[기본 모드: 발주번호별 PDF 생성]
  - orderCodes.forEach(orderCode):
      ├─ 해당 발주의 데이터 필터링: orderRows = rows.filter(...)
      ├─ 발주별 출력방식 결정: mode = modesByOrder[orderCode] || printMode || 'auto'
      ├─ 품목 수 계산 (Short 모드 판단용)
      ├─ 실제 출력 모드 결정:
      │    └─ mode === 'auto' ? → actualMode = 'full'
      ├─ docType별 PDF 생성:
      │    ├─ INVOICE_VAT → buildInvoiceVatPdf()
      │    ├─ INVOICE_NVAT → buildInvoiceNvatPdf()
      │    └─ ORDER_PURCHASE → buildOrderPurchasePdf()
      ├─ PDF 파일명 설정: '원브릿지_{partner}_{docTypeLabel}_{brandName}_{dateStr}.pdf'
      ├─ pdfBlobs.push(pdfBlob)
      └─ actualMode === 'short' && itemCount > 5 ?
           └─ generateDetailExcel_() 호출 → pdfBlobs.push()
  ↓
[PDF 블롭 확인]
  - pdfBlobs.length === 0 ? → 에러 반환
  ↓
[ZIP 파일 생성]
  - zipFileName = 'Invoices_{timestamp}.zip'
  - zipBlob = Utilities.zip(pdfBlobs, zipFileName)
  - driveFile = DriveApp.createFile(zipBlob)
  ↓
[성공 반환]
  - { success: true, fileId: driveFile.getId(), fileName: driveFile.getName() }
  ↓
[종료]
```

---

### 2.2 `buildInvoiceVatPdf()` 동작 흐름

```
[시작]
  ↓
[거래원장 인덱스 정의]
  - idxDate, idxBrand, idxSupplierName, idxBuyerName, idxVatType
  - idxProductName, idxProductCode, idxQtyOrder, idxQtyConfirmed
  - idxUnitPrice, idxSupplyPrice, idxAmount, idxSupplyAmount
  ↓
[필수 컬럼 확인]
  - idxDate, idxSupplierName, idxBuyerName, idxProductName 중 하나라도 -1 ?
    → throw Error('거래원장 헤더 구성이 예상과 다릅니다.')
  ↓
[발주 기준 정보 추출]
  - firstRow = orderRows[0]
  - orderDate = firstRow[idxDate]
  - supplierNm = firstRow[idxSupplierName]
  - buyerNm = firstRow[idxBuyerName]
  ↓
[거래처 상세 정보 조회]
  - companyInfo = findPartnerByName_('원브릿지')  // 공급자
  - partnerInfo = findPartnerByName_(buyerNm)     // 거래처
  - supplierBizNo, supplierManager, buyerBizNo, buyerPhone, buyerAddress 추출
  ↓
[품목 리스트 생성]
  - qtyCol = idxQtyConfirmed >= 0 ? idxQtyConfirmed : idxQtyOrder
  - items = [], totalSupply = 0, totalAmount = 0, itemCount = 0
  - for (orderRows):
      ├─ qty = Number(r[qtyCol])
      ├─ qty === 0 ? → continue (수량 0은 제외)
      ├─ unitPrice = Number(r[idxUnitPrice])
      ├─ supplyPrice = Number(r[idxSupplyPrice])
      ├─ amount = Number(r[idxAmount] || qty * unitPrice)
      ├─ supply = Number(r[idxSupplyAmount] || qty * supplyPrice)
      ├─ totalAmount += amount
      ├─ totalSupply += supply
      ├─ itemCount++
      └─ items.push({ code, name, spec, qty, price: supplyPrice, amount: supply })
  ↓
[출력방식 로직 적용]
  - actualMode = printMode
  - printMode === 'auto' ? → actualMode = 'full'
  - actualMode === 'short' && itemCount > 0 ?
      └─ items = [{ name: '{brandName} 외 {itemCount-1}건', qty: itemCount, amount: totalSupply, note: '(단축 출력)' }]
  - items.length === 0 ?
      └─ items.push({ 빈 행 })
  ↓
[VAT 계산]
  - totalVat = totalAmount - totalSupply
  - totalVat < 0 ? → totalVat = 0
  ↓
[템플릿 컨텍스트 생성]
  - ctx = {
      stampBase64: getStampBase64_(),
      logoBase64: getLogoBase64_(),
      docTitle: '(주)원브릿지 거래명세서',
      supplierName: '원브릿지',
      supplierBizNo, supplierManager,
      buyerName: buyerNm,
      buyerBizNo, buyerPhone, buyerAddress,
      dueDate: formatDateYmd_(orderDate),
      orderCode,
      totalSupply: formatNumber_(totalSupply),
      totalVat: formatNumber_(totalVat),
      totalAmount: formatNumber_(totalAmount),
      amountHangul: numberToHangulKor_(totalAmount),
      items,
      buyerOrderCode: '',
      remark: ''
    }
  ↓
[템플릿 로드 및 변수 주입]
  - tmpl = HtmlService.createTemplateFromFile('Templates_Invoice_VAT')
  - Object.keys(ctx).forEach(k => tmpl[k] = ctx[k])
  ↓
[HTML → PDF 변환]
  - html = tmpl.evaluate().getContent()
  - blob = Utilities.newBlob(html, 'text/html', 'invoice_vat_{orderCode}.html')
             .getAs('application/pdf')
  ↓
[반환]
  - return blob
  ↓
[종료]
```

---

### 2.3 `buildOrderPurchasePdf()` 동작 흐름

```
[시작]
  ↓
[거래원장 인덱스 정의]
  - (buildInvoiceVatPdf와 유사, 단 idxVatType 추가 사용)
  ↓
[발주 기준 정보 추출]
  - firstRow = orderRows[0]
  - orderDate, supplierNm, buyerNm, vatType 추출
  - vatType = idxVatType >= 0 ? String(firstRow[idxVatType] || '부포') : '부포'
  ↓
[거래처 상세 정보 조회]
  - partnerInfo = findPartnerByName_(supplierNm)  // 매입처 = 공급자
  - companyInfo = findPartnerByName_('원브릿지') // 원브릿지 = 발주처
  - supplierBizNo, supplierManager, supplierPhone, supplierAddress
  - buyerBizNo, buyerPhone, buyerAddress
  - deliveryAddr, specialRequest 추출
  ↓
[품목 리스트 생성]
  - qtyCol = idxQtyOrder >= 0 ? idxQtyOrder : idxQtyConfirmed
  - items = [], totalAmount = 0, itemCount = 0
  - for (orderRows):
      ├─ qty = Number(r[qtyCol])
      ├─ qty === 0 ? → continue
      ├─ unitPrice = Number(r[idxUnitPrice])
      ├─ amount = Number(r[idxAmount] || qty * unitPrice)
      ├─ totalAmount += amount
      ├─ itemCount++
      └─ items.push({ code, name, spec, qty, price: unitPrice, amount })
  ↓
[출력방식 로직 적용]
  - actualMode = printMode
  - printMode === 'auto' ? → actualMode = 'full'
  - actualMode === 'short' && itemCount > 0 ?
      └─ items = [{ name: '{brandName} 총 {itemCount}건', qty: itemCount, amount: totalAmount, note: '(단축 출력)' }]
  - items.length === 0 ? → items.push({ 빈 행 })
  ↓
[VAT 계산 (부별/부포 분기)]
  - vatType === '부별' ?
      ├─ totalSupply = Math.round(totalAmount / 1.1)
      └─ totalVat = totalAmount - totalSupply
  - else (부포):
      ├─ totalSupply = totalAmount
      ├─ totalVat = Math.round(totalSupply * 0.1)
      └─ totalAmount = totalSupply + totalVat
  ↓
[비고란 구성]
  - remarkLines = []
  - vatType === '부별' ? → remarkLines.push('※ 부가세별도')
  - else → remarkLines.push('※ 부가세포함')
  - deliveryAddr 있으면 → remarkLines.push('입고지: ' + deliveryAddr)
  - supplierManager || supplierPhone 있으면 → remarkLines.push('담당자: ...')
  - specialRequest 있으면 → remarkLines.push('요청사항: ' + specialRequest)
  ↓
[템플릿 컨텍스트 생성]
  - ctx = {
      stampBase64, logoBase64,
      docTitle: '(주)원브릿지 매입발주서',
      supplierName: supplierNm,
      supplierBizNo, supplierManager,
      buyerName: buyerNm,
      buyerBizNo, buyerPhone, buyerAddress,
      dueDate, orderCode,
      totalSupply, totalVat, totalAmount, amountHangul,
      items,
      buyerOrderCode: '',
      remark: remarkLines.join('\n')
    }
  ↓
[템플릿 로드 및 PDF 생성]
  - tmpl = HtmlService.createTemplateFromFile('Templates_Invoice_VAT')  // 동일 템플릿
  - (변수 주입)
  - html → PDF 변환
  ↓
[반환]
  - return blob
  ↓
[종료]
```

---

### 2.4 `buildInvoiceVatPdfMerged()` 동작 흐름

```
[시작]
  ↓
[거래원장 인덱스 정의]
  - idxDate, idxOrderNo, idxBrand, idxSupplierName, idxBuyerName, idxVatType
  - idxProductName, idxProductCode, idxQtyOrder, idxQtyConfirmed
  - idxUnitPrice, idxSupplyPrice, idxAmount, idxSupplyAmount
  ↓
[발주 기준 정보 추출 (첫 번째 행)]
  - firstRow = allOrderRows[0]
  - orderDate, supplierNm, buyerNm 추출
  ↓
[거래처 상세 정보 조회]
  - companyInfo = findPartnerByName_('원브릿지')
  - partnerInfo = findPartnerByName_(buyerNm)
  - supplierBizNo, supplierManager, buyerBizNo, buyerPhone, buyerAddress 추출
  ↓
[발주번호(브랜드)별로 품목 그룹핑]
  - qtyCol = idxQtyConfirmed >= 0 ? idxQtyConfirmed : idxQtyOrder
  - orderGroups = {}  // { orderCode: { brandName, items, itemCount, totalSupply, totalAmount } }
  - for (allOrderRows):
      ├─ orderCode = String(r[idxOrderNo])
      ├─ brandName = String(r[idxBrand])
      ├─ qty = Number(r[qtyCol])
      ├─ qty === 0 ? → continue
      ├─ orderGroups[orderCode] 없으면 초기화
      ├─ unitPrice, supplyPrice, amount, supply 계산
      ├─ orderGroups[orderCode].totalAmount += amount
      ├─ orderGroups[orderCode].totalSupply += supply
      ├─ orderGroups[orderCode].itemCount++
      └─ orderGroups[orderCode].items.push({ code, name, spec, qty, price: supplyPrice, amount: supply })
  ↓
[브랜드별 출력방식 적용 + 전체 품목 리스트 생성]
  - allItems = [], grandTotalSupply = 0, grandTotalAmount = 0
  - for (orderCode in orderGroups):
      ├─ group = orderGroups[orderCode]
      ├─ mode = modesByOrder[orderCode] || defaultMode || 'auto'
      ├─ actualMode = mode === 'auto' ? 'full' : mode
      ├─ actualMode === 'short' && group.itemCount > 0 ?
      │    └─ allItems.push({ name: '{brandName} 총 {itemCount}건', qty: itemCount, amount: totalSupply, note: '(단축 출력)' })
      │ else:
      │    └─ allItems = allItems.concat(group.items)  // full 모드
      ├─ grandTotalSupply += group.totalSupply
      └─ grandTotalAmount += group.totalAmount
  - allItems.length === 0 ? → allItems.push({ 빈 행 })
  ↓
[VAT 계산]
  - totalVat = grandTotalAmount - grandTotalSupply
  - totalVat < 0 ? → totalVat = 0
  ↓
[템플릿 컨텍스트 생성]
  - ctx = {
      stampBase64, logoBase64,
      supplierName: supplierNm,
      supplierBizNo, supplierManager,
      buyerName: buyerNm,
      buyerBizNo, buyerPhone, buyerAddress,
      dueDate,
      orderCode: orderCodes.join(', '),  // 여러 발주번호 표시
      totalSupply: formatNumber_(grandTotalSupply),
      totalVat: formatNumber_(totalVat),
      totalAmount: formatNumber_(grandTotalAmount),
      amountHangul,
      items: allItems,
      buyerOrderCode: '',
      remark: ''
    }
  ↓
[템플릿 로드 및 PDF 생성]
  - tmpl = HtmlService.createTemplateFromFile('Templates_Invoice_VAT')
  - (변수 주입)
  - html → PDF 변환
  ↓
[반환]
  - return blob
  ↓
[종료]
```

**특징**:
- 여러 발주번호의 품목을 브랜드별로 그룹핑
- 각 브랜드별로 `full`/`short` 출력방식 개별 적용
- 최종적으로 하나의 PDF로 병합

---

### 2.5 `generateDetailExcel_()` 동작 흐름

```
[시작]
  ↓
[새 스프레드시트 생성]
  - ss = SpreadsheetApp.create('세부목록_' + orderCode)
  - sheet = ss.getSheets()[0]
  - sheet.setName('세부목록')
  ↓
[거래원장 인덱스 정의]
  - idxDate, idxProductCode, idxBrand, idxProductName
  - idxQtyConfirmed, idxQtyOrder, idxSupplyPrice, idxSupplyAmount
  - idxUnitPrice, idxAmount
  ↓
[엑셀 헤더 작성]
  - excelHeader = ['순번', '발주일', '품목코드', '브랜드', '품명', '수량', '단가', '금액']
  - sheet.getRange(1, 1, 1, 8).setValues([excelHeader])
  ↓
[헤더 스타일 적용]
  - 배경색: #4a5568
  - 글자색: #ffffff
  - 굵게, 중앙 정렬
  ↓
[데이터 행 작성]
  - qtyCol = idxQtyConfirmed >= 0 ? idxQtyConfirmed : idxQtyOrder
  - priceCol = idxSupplyPrice >= 0 ? idxSupplyPrice : idxUnitPrice
  - amountCol = idxSupplyAmount >= 0 ? idxSupplyAmount : idxAmount
  - dataRows = [], rowNum = 1
  - for (orderRows):
      ├─ qty = Number(r[qtyCol])
      ├─ qty === 0 ? → continue
      ├─ dataRows.push([rowNum, orderDate, productCode, brand, productName, qty, price, amount])
      └─ rowNum++
  ↓
[데이터 입력]
  - sheet.getRange(2, 1, dataRows.length, 8).setValues(dataRows)
  ↓
[숫자 컬럼 포맷 적용]
  - 6열(수량): #,##0
  - 7열(단가): #,##0
  - 8열(금액): #,##0
  ↓
[열 너비 자동 조정]
  - for (col = 1 to 8): sheet.autoResizeColumn(col)
  ↓
[Excel 파일로 내보내기]
  - fileId = ss.getId()
  - file = DriveApp.getFileById(fileId)
  - blob = file.getAs('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  - blob.setName(fileName + '.xlsx')
  ↓
[임시 스프레드시트 삭제]
  - DriveApp.getFileById(fileId).setTrashed(true)
  ↓
[반환]
  - return blob
  ↓
[종료]
```

---

## 3. 데이터 의존성

### 3.1 Google Sheets 시트 참조

#### 거래원장 (거래 통합DB)
- **시트 접근**: `getOrderMergedSheet()`
- **필수 컬럼**:
  - `발주번호` (필수)
  - `발주일` (필수)
  - `매입처` (필수)
  - `발주처` (필수)
  - `제품명` (필수)
  - `브랜드`
  - `품목코드`
  - `발주수량`
  - `확정수량`
  - `매입가`
  - `공급가`
  - `매입액`
  - `공급액`
  - `부가세구분` (발주서에서 사용)
  - `바코드` (전용 양식에서 사용)
  - `규격` (Excel 출력에서 사용)

#### 거래처DB
- **시트 접근**: `getSuppliers()`
- **필수 컬럼**:
  - `거래처명` (필수)
  - `사업자번호`
  - `담당자`
  - `연락처`
  - `주소`
  - `입고지` (발주서에서 사용)
  - `요청사항` (발주서에서 사용)

---

### 3.2 전역 변수 사용

#### Script Properties
- `STAMP_BASE64`: 인감 이미지 Base64 (PDF 템플릿에서 사용)
- `LOGO_BASE64`: 로고 이미지 Base64 (PDF 템플릿에서 사용)
- `TEMPLATE_ROMAND_NUDZ`: 롬앤/누즈 전용 양식 템플릿 파일 ID
- `TEMPLATE_JONGGEUNDANG`: 종근당 전용 양식 템플릿 파일 ID
- `TEMPLATE_BBIA_GROUP`: 삐아계열 전용 양식 템플릿 파일 ID

---

### 3.3 다른 Service 함수 호출

#### SheetService (추정)
- `getOrderMergedSheet()`: 거래원장 시트 반환
- `getSuppliers()`: 거래처DB 데이터 반환 (`{ header: [], rows: [] }` 형식)

#### HtmlService (Google Apps Script 내장)
- `HtmlService.createTemplateFromFile('Templates_Invoice_VAT')`: HTML 템플릿 로드

#### Utilities (Google Apps Script 내장)
- `Utilities.formatDate()`: 날짜 포맷
- `Utilities.formatString()`: 문자열 포맷
- `Utilities.newBlob()`: Blob 생성
- `Utilities.zip()`: ZIP 파일 생성

#### DriveApp (Google Apps Script 내장)
- `DriveApp.createFile()`: Drive 파일 생성
- `DriveApp.getFileById()`: 파일 ID로 파일 조회

#### SpreadsheetApp (Google Apps Script 내장)
- `SpreadsheetApp.create()`: 스프레드시트 생성
- `SpreadsheetApp.open()`: 스프레드시트 열기
- `SpreadsheetApp.flush()`: 변경사항 즉시 적용

#### Drive API (Advanced Google Services)
- `Drive.Files.insert()`: XLSX → Google Sheets 변환

---

### 3.4 Google Drive 파일 참조

#### PDF 템플릿
- **파일명**: `Templates_Invoice_VAT` (HTML 파일)
- **사용처**: 모든 PDF 생성 함수에서 공통 사용
- **템플릿 변수**:
  - `stampBase64`, `logoBase64`
  - `docTitle`, `supplierName`, `supplierBizNo`, `supplierManager`
  - `buyerName`, `buyerBizNo`, `buyerPhone`, `buyerAddress`
  - `dueDate`, `orderCode`, `buyerOrderCode`
  - `totalSupply`, `totalVat`, `totalAmount`, `amountHangul`
  - `items` (배열): `{ code, name, spec, qty, price, amount, note }`
  - `remark`

#### 전용 양식 템플릿 (XLSX)
- **롬앤/누즈**: `TEMPLATE_ROMAND_NUDZ` ID
- **종근당**: `TEMPLATE_JONGGEUNDANG` ID
- **삐아계열**: `TEMPLATE_BBIA_GROUP` ID

---

## 4. 전용 양식 관련 로직

### 4.1 브랜드 그룹 매핑

```javascript
ROMAND_NUDZ: ['롬앤', '누즈', 'ROMAND', 'rom&nd']
JONGGEUNDANG: ['종근당', '종근당건강']
BBIA_GROUP: ['삐아', '어바웃톤', '이글립스', 'BBIA', 'ABOUTTONE', 'EGLIPS']
```

**확인 방법**: `getCustomTemplateGroup_(brandName)`
- 브랜드명을 대문자로 변환 후 키워드 포함 여부 체크
- 예: `brandName = "롬앤2024"` → `ROMAND_NUDZ` 그룹

---

### 4.2 템플릿 파일 ID 관리 방법

**저장 위치**: `PropertiesService.getScriptProperties()`

**설정 방법** (추정):
```javascript
var props = PropertiesService.getScriptProperties();
props.setProperty('TEMPLATE_ROMAND_NUDZ', '1abc...XYZ');
props.setProperty('TEMPLATE_JONGGEUNDANG', '2def...UVW');
props.setProperty('TEMPLATE_BBIA_GROUP', '3ghi...RST');
```

**조회 방법**: `getCustomTemplateFileIds_()`

---

### 4.3 `buildRomandNudzExcel_()` 상세 분석

#### 템플릿 구조
- **시트명**: `롬앤(발주양식)`
- **시작 행**: 15행
- **컬럼 구조**:
  - 2열(B): 바코드
  - 3열(C): 제품명
  - 6열(F): "39%" (고정값)
  - 9열(I): 수량

#### 처리 흐름
1. **템플릿 파일 복사**:
   ```javascript
   var templateFile = DriveApp.getFileById(templateFileId);
   var mimeType = templateFile.getMimeType();
   ```

2. **XLSX → Google Sheets 변환** (XLSX 파일인 경우):
   ```javascript
   if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
     var blob = templateFile.getBlob();
     var resource = {
       title: '롬앤발주_' + orderCode + '_' + Date.now(),
       mimeType: MimeType.GOOGLE_SHEETS
     };
     copiedFile = Drive.Files.insert(resource, blob, { convert: true });
     copiedFile = DriveApp.getFileById(copiedFile.id);
   }
   ```

3. **데이터 입력**:
   ```javascript
   var startRow = 15;
   for (var i = 0; i < orderRows.length; i++) {
     var r = orderRows[i];
     var qty = Number(r[idxQty] || 0);
     if (!qty) continue;

     var rowNum = startRow + i;
     sheet.getRange(rowNum, 2).setValue(r[idxBarcode] || '');
     sheet.getRange(rowNum, 3).setValue(r[idxProductName] || '');
     sheet.getRange(rowNum, 6).setValue('39%');
     sheet.getRange(rowNum, 9).setValue(qty);
   }
   ```

4. **Excel Blob 생성**:
   ```javascript
   SpreadsheetApp.flush();
   var blob = copiedFile.getBlob();
   copiedFile.setTrashed(true);
   return blob;
   ```

---

### 4.4 `buildJonggeundangExcel_()` 상세 분석

#### 템플릿 구조
- **시트명**: `2. 발주서`
- **시작 행**: 5행
- **컬럼 구조**:
  - B5: 발주일
  - 5열(E): 품목코드
  - 6열(F): 제품명
  - 9열(I): 공급가
  - 10열(J): 수량

#### 처리 흐름
1. **템플릿 파일 복사** (XLSX 변환 로직 동일)

2. **발주일 입력**:
   ```javascript
   if (options.docDate) sheet.getRange('B5').setValue(options.docDate);
   ```

3. **데이터 입력**:
   ```javascript
   var startRow = 5;
   for (var i = 0; i < orderRows.length; i++) {
     var r = orderRows[i];
     var qty = Number(r[idxQty] || 0);
     if (!qty) continue;

     var rowNum = startRow + i;
     sheet.getRange(rowNum, 5).setValue(r[idxProductCode] || '');
     sheet.getRange(rowNum, 6).setValue(r[idxProductName] || '');
     sheet.getRange(rowNum, 9).setValue(Number(r[idxSupplyPrice] || 0));
     sheet.getRange(rowNum, 10).setValue(qty);
   }
   ```

4. **Excel Blob 생성** (동일)

---

### 4.5 `buildBbiaGroupExcel_()` 상세 분석

#### 템플릿 구조
- **시트명**: 브랜드별 (`삐아`, `어바웃톤`, `이글립스`)
- **시작 행**: 10행
- **컬럼 구조**:
  - B8: 날짜 (발주일 + 납품일)
  - 1~2열(A~B): 바코드 (템플릿에 미리 등록)
  - 8열(H): 수량 (입력)

#### 시트명 결정 로직
```javascript
var idxBrand = header.indexOf('브랜드');
var brandName = orderRows[0] && orderRows[0][idxBrand] || '삐아';

var sheetName = brandName.indexOf('어바웃톤') >= 0 ? '어바웃톤' :
                brandName.indexOf('이글립스') >= 0 ? '이글립스' : '삐아';

var sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
```

#### 바코드 매칭 로직
1. **발주 데이터에서 바코드 → 수량 맵 생성**:
   ```javascript
   var qtyMap = {};
   for (var i = 0; i < orderRows.length; i++) {
     var barcode = String(orderRows[i][idxBarcode] || '').trim();
     var qty = Number(orderRows[i][idxQty] || 0);
     if (barcode && qty) qtyMap[barcode] = (qtyMap[barcode] || 0) + qty;
   }
   ```

2. **템플릿 바코드 매칭**:
   ```javascript
   var templateData = sheet.getRange(10, 1, sheet.getLastRow() - 9, 8).getValues();
   for (var r = 0; r < templateData.length; r++) {
     var tBarcode = String(templateData[r][1] || templateData[r][0] || '').trim();
     if (tBarcode && qtyMap[tBarcode]) {
       sheet.getRange(10 + r, 8).setValue(qtyMap[tBarcode]);
     }
   }
   ```

**특징**:
- 템플릿에 품목이 미리 등록되어 있음
- 바코드 컬럼이 1열(A) 또는 2열(B)에 있을 수 있음
- 발주 데이터의 바코드와 매칭하여 수량만 입력

---

### 4.6 XLSX → Google Sheets 변환 로직

**공통 패턴**:
```javascript
var templateFile = DriveApp.getFileById(templateFileId);
var mimeType = templateFile.getMimeType();
var copiedFile;

if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  // XLSX 파일인 경우 Google Sheets로 변환
  Logger.log('[함수명] XLSX 파일 감지 - Google Sheets로 변환');
  var blob = templateFile.getBlob();
  var resource = {
    title: '파일명_' + orderCode + '_' + Date.now(),
    mimeType: MimeType.GOOGLE_SHEETS
  };
  copiedFile = Drive.Files.insert(resource, blob, { convert: true });
  copiedFile = DriveApp.getFileById(copiedFile.id);
} else {
  // 이미 Google Sheets인 경우 단순 복사
  copiedFile = templateFile.makeCopy('파일명_' + orderCode + '_' + Date.now());
}
```

**주요 포인트**:
- `Drive.Files.insert(resource, blob, { convert: true })` 사용
- Advanced Google Services의 Drive API 필요
- 변환 후 임시 Google Sheets 파일 생성
- 데이터 입력 후 `.getBlob()`으로 Excel Blob 추출
- 임시 파일 삭제

---

## 5. PDF/Excel 생성 로직

### 5.1 `buildInvoiceVatPdf()` 처리 흐름

```
[입력값 검증]
  ↓
[필수 컬럼 인덱스 확인]
  - 발주일, 매입처, 발주처, 제품명
  ↓
[거래처 정보 조회]
  - 원브릿지 (공급자)
  - 발주처 (거래처)
  ↓
[품목 리스트 생성]
  - 수량: 확정수량 우선
  - 가격: 공급가/공급액
  - totalSupply, totalAmount 계산
  ↓
[출력방식 적용]
  - auto → full
  - short → 품목 축약
  ↓
[VAT 계산]
  - totalVat = totalAmount - totalSupply
  ↓
[템플릿 컨텍스트 생성]
  ↓
[HTML → PDF 변환]
  - HtmlService.createTemplateFromFile('Templates_Invoice_VAT')
  - Utilities.newBlob().getAs('application/pdf')
  ↓
[반환]
```

**멀티페이지 처리**: 템플릿 내부에서 처리 (CSS `page-break-after`)

---

### 5.2 `buildOrderPurchasePdf()` 처리 흐름

```
[입력값 검증]
  ↓
[필수 컬럼 인덱스 확인]
  ↓
[거래처 정보 조회]
  - 매입처 (공급자)
  - 원브릿지 (발주처)
  ↓
[품목 리스트 생성]
  - 수량: 발주수량 우선
  - 가격: 매입가/매입액
  - totalAmount 계산
  ↓
[출력방식 적용]
  - auto → full
  - short → 품목 축약
  ↓
[VAT 계산 (부별/부포 분기)]
  - 부별: totalSupply = totalAmount / 1.1
  - 부포: totalVat = totalSupply * 0.1
  ↓
[비고란 구성]
  - 부가세구분, 입고지, 담당자, 요청사항
  ↓
[템플릿 컨텍스트 생성]
  ↓
[HTML → PDF 변환]
  - 동일 템플릿 (Templates_Invoice_VAT) 사용
  ↓
[반환]
```

**공통 템플릿 사용**: `Templates_Invoice_VAT`를 거래명세서, 발주서 모두에서 사용

---

### 5.3 `generateExcelOutput_()` 처리 흐름

```
[데이터 필터링]
  - orderCodes에 해당하는 행만 추출
  ↓
[전용 양식 체크]
  - docType.indexOf('CUSTOM_') === 0 ?
    → generateCustomTemplateExcel_() 호출 → 종료
  ↓
[문서 유형별 헤더 및 데이터 함수 정의]
  - ORDER_PURCHASE: 매입가, 매입액
  - INVOICE_VAT/NVAT: 공급가, 공급액, VAT
  ↓
[스프레드시트 생성]
  - SpreadsheetApp.create(fileName)
  ↓
[헤더 작성 및 스타일 적용]
  - 배경색: #334155
  - 글자색: #ffffff
  ↓
[데이터 행 작성]
  - 수량 > 0만 포함
  - 숫자 컬럼 포맷: #,##0
  ↓
[합계 행 추가]
  - SUM 수식 사용
  - 배경색: #f1f5f9
  ↓
[비고 추가]
  - manualRemark 있으면 추가
  ↓
[Excel Blob 생성]
  - file.getAs('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  ↓
[Drive에 저장]
  - DriveApp.createFile(excelBlob)
  ↓
[임시 스프레드시트 삭제]
  ↓
[반환]
  - { success, fileId, fileName, downloadUrl }
```

---

### 5.4 멀티페이지 처리 방식

**PDF 템플릿 내부 처리 (추정)**:
- HTML 템플릿 `Templates_Invoice_VAT`에 CSS `@media print` 규칙 포함
- `page-break-after: always` 또는 `page-break-inside: avoid` 사용
- 품목 리스트가 긴 경우 자동으로 페이지 분할

**코드에서의 처리**:
- `auto` 모드: 항상 `full` 모드로 처리
- `full` 모드: 모든 품목을 템플릿에 전달 → 템플릿이 자동 분할
- `short` 모드: 1개 항목으로 축약 → 1페이지

---

## 6. 매입처별 통합 로직

### 6.1 그룹핑 알고리즘

**목적**: 여러 발주번호를 매입처별로 그룹핑하여 통합 PDF 생성

**단계**:

#### Step 1: 발주번호별로 매입처와 발주일 매핑
```javascript
var orderInfoMap = {};
orderCodes.forEach(function(orderCode) {
  var orderRows = rows.filter(function(r) {
    return String(r[idxOrderNo]) === String(orderCode);
  });
  if (orderRows.length > 0) {
    orderInfoMap[orderCode] = {
      supplier: String(orderRows[0][idxSupplier] || ''),
      orderDate: orderRows[0][idxOrderDate] || new Date()
    };
  }
});

// 결과: { 'PO001': { supplier: 'A사', orderDate: ... }, 'PO002': { supplier: 'A사', ... } }
```

#### Step 2: 매입처별로 발주번호 그룹핑
```javascript
var supplierGroups = {};
for (var orderCode in orderInfoMap) {
  var supplier = orderInfoMap[orderCode].supplier;
  if (!supplier) continue;

  if (!supplierGroups[supplier]) {
    supplierGroups[supplier] = {
      orderCodes: [],
      orderDate: orderInfoMap[orderCode].orderDate
    };
  }
  supplierGroups[supplier].orderCodes.push(orderCode);
}

// 결과: { 'A사': { orderCodes: ['PO001', 'PO002'], orderDate: ... }, 'B사': { ... } }
```

#### Step 3: 매입처별로 통합 PDF 생성
```javascript
for (var supplier in supplierGroups) {
  var group = supplierGroups[supplier];
  var groupOrderCodes = group.orderCodes;

  // 해당 매입처의 모든 발주 데이터 수집
  var allOrderRows = [];
  groupOrderCodes.forEach(function(orderCode) {
    var orderRows = rows.filter(function(r) {
      return String(r[idxOrderNo]) === String(orderCode);
    });
    allOrderRows = allOrderRows.concat(orderRows);
  });

  // 통합 PDF 생성
  var pdfBlob = buildInvoiceVatPdfMerged(groupOrderCodes, allOrderRows, header, modesByOrder, printMode);
  // ...
}
```

---

### 6.2 품목 병합 로직

**`buildInvoiceVatPdfMerged()` 내부**:

```javascript
var orderGroups = {};  // { orderCode: { brandName, items, itemCount, totalSupply, totalAmount } }

for (var i = 0; i < allOrderRows.length; i++) {
  var r = allOrderRows[i];
  var orderCode = String(r[idxOrderNo]);
  var brandName = String(r[idxBrand] || '');
  var qty = Number(r[qtyCol] || 0);

  if (!qty) continue;

  if (!orderGroups[orderCode]) {
    orderGroups[orderCode] = {
      brandName: brandName,
      items: [],
      itemCount: 0,
      totalSupply: 0,
      totalAmount: 0
    };
  }

  // 품목 추가
  orderGroups[orderCode].items.push({ code, name, spec, qty, price, amount });
  orderGroups[orderCode].totalSupply += supply;
  orderGroups[orderCode].totalAmount += amount;
  orderGroups[orderCode].itemCount++;
}
```

**발주번호(브랜드)별로 품목 그룹핑** → 각 그룹별로 출력방식 적용 → 전체 병합

---

### 6.3 Merged 함수들의 처리 방식

#### `buildInvoiceVatPdfMerged()`
1. 발주번호별로 품목 그룹핑
2. 각 발주번호별 출력방식 적용 (`full` or `short`)
3. 전체 품목 리스트 병합 (`allItems = allItems.concat(...)`)
4. 통합 금액 계산 (`grandTotalSupply`, `grandTotalAmount`)
5. 단일 PDF 생성

#### `buildInvoiceNvatPdfMerged()`
- 동일 로직, VAT = 0

#### `buildOrderPurchasePdfMerged()`
- 동일 로직, 부별/부포 VAT 계산

**핵심 차이점**:
- **개별 함수** (`buildInvoiceVatPdf`): 1개 발주번호 → 1개 PDF
- **Merged 함수** (`buildInvoiceVatPdfMerged`): N개 발주번호 → 1개 통합 PDF

---

## 플로우차트

### 메인 플로우 (`generateInvoiceZip`)

```
                    ┌─────────────────────────┐
                    │  generateInvoiceZip()  │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │  파라미터 추출 및 검증   │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │  거래원장 데이터 로드    │
                    │  getOrderMergedSheet()  │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │ outputFormat === EXCEL? │
                    └───┬─────────────────┬───┘
                       YES                NO
                        │                 │
            ┌───────────▼──────┐          │
            │ generateExcel    │          │
            │ Output_()        │          │
            └──────────────────┘          │
                                          │
                            ┌─────────────▼────────────┐
                            │ mergeBySupplier === true?│
                            └───┬──────────────────┬───┘
                               YES                NO
                                │                 │
                ┌───────────────▼───────┐         │
                │ 매입처별 그룹핑        │         │
                │ supplierGroups 생성   │         │
                └───────────┬───────────┘         │
                            │                     │
                ┌───────────▼───────────┐         │
                │ 매입처별 통합 PDF 생성 │         │
                │ (for loop)            │         │
                │  - buildXxxPdfMerged()│         │
                │  - needsExcel 체크    │         │
                │  - 세부목록 엑셀 생성  │         │
                └───────────┬───────────┘         │
                            │                     │
                            │         ┌───────────▼────────────┐
                            │         │ 발주번호별 PDF 생성     │
                            │         │ (forEach loop)         │
                            │         │  - buildXxxPdf()       │
                            │         │  - short 모드 체크     │
                            │         │  - 세부목록 엑셀 생성   │
                            │         └───────────┬────────────┘
                            │                     │
                            └──────────┬──────────┘
                                       │
                            ┌──────────▼──────────┐
                            │ PDF 블롭 확인       │
                            │ pdfBlobs.length > 0?│
                            └──────────┬──────────┘
                                      YES
                                       │
                            ┌──────────▼──────────┐
                            │ ZIP 파일 생성        │
                            │ Utilities.zip()     │
                            └──────────┬──────────┘
                                       │
                            ┌──────────▼──────────┐
                            │ Drive에 저장         │
                            │ DriveApp.createFile()│
                            └──────────┬──────────┘
                                       │
                            ┌──────────▼──────────┐
                            │ 성공 반환            │
                            │ { success, fileId } │
                            └─────────────────────┘
```

---

### PDF 생성 플로우 (`buildInvoiceVatPdf`)

```
                ┌──────────────────────────┐
                │ buildInvoiceVatPdf()     │
                └────────────┬─────────────┘
                             │
                ┌────────────▼─────────────┐
                │ 컬럼 인덱스 확인          │
                │ (발주일, 매입처, ...)    │
                └────────────┬─────────────┘
                             │
                ┌────────────▼─────────────┐
                │ 거래처 정보 조회          │
                │ findPartnerByName_()     │
                │  - 원브릿지 (공급자)     │
                │  - 발주처 (거래처)       │
                └────────────┬─────────────┘
                             │
                ┌────────────▼─────────────┐
                │ 품목 리스트 생성          │
                │ (for orderRows)          │
                │  - 확정수량 우선         │
                │  - 공급가/공급액         │
                │  - totalSupply 계산      │
                └────────────┬─────────────┘
                             │
                ┌────────────▼─────────────┐
                │ 출력방식 적용             │
                │  - auto → full           │
                │  - short → 축약          │
                └────────────┬─────────────┘
                             │
                ┌────────────▼─────────────┐
                │ VAT 계산                 │
                │ totalVat = amount-supply │
                └────────────┬─────────────┘
                             │
                ┌────────────▼─────────────┐
                │ 템플릿 컨텍스트 생성      │
                │ (ctx 객체)               │
                └────────────┬─────────────┘
                             │
                ┌────────────▼─────────────┐
                │ HTML 템플릿 로드          │
                │ Templates_Invoice_VAT    │
                └────────────┬─────────────┘
                             │
                ┌────────────▼─────────────┐
                │ 변수 주입                 │
                │ tmpl[k] = ctx[k]         │
                └────────────┬─────────────┘
                             │
                ┌────────────▼─────────────┐
                │ HTML → PDF 변환          │
                │ .getAs('application/pdf')│
                └────────────┬─────────────┘
                             │
                ┌────────────▼─────────────┐
                │ Blob 반환                │
                └──────────────────────────┘
```

---

### 통합 PDF 생성 플로우 (`buildInvoiceVatPdfMerged`)

```
            ┌───────────────────────────────┐
            │ buildInvoiceVatPdfMerged()    │
            └────────────┬──────────────────┘
                         │
            ┌────────────▼──────────────────┐
            │ 거래처 정보 조회 (첫 번째 행)  │
            └────────────┬──────────────────┘
                         │
            ┌────────────▼──────────────────┐
            │ 발주번호별 품목 그룹핑         │
            │ orderGroups = {               │
            │   orderCode: {                │
            │     brandName, items,         │
            │     itemCount, totalSupply    │
            │   }                           │
            │ }                             │
            └────────────┬──────────────────┘
                         │
            ┌────────────▼──────────────────┐
            │ 브랜드별 출력방식 적용         │
            │ (for orderCode in orderGroups)│
            │  - mode 확인                  │
            │  - short → 축약               │
            │  - full → 전체 품목           │
            │  - allItems에 병합            │
            └────────────┬──────────────────┘
                         │
            ┌────────────▼──────────────────┐
            │ 통합 금액 계산                 │
            │ grandTotalSupply              │
            │ grandTotalAmount              │
            └────────────┬──────────────────┘
                         │
            ┌────────────▼──────────────────┐
            │ VAT 계산                      │
            │ totalVat = amount - supply    │
            └────────────┬──────────────────┘
                         │
            ┌────────────▼──────────────────┐
            │ 템플릿 컨텍스트 생성           │
            │ orderCode: orderCodes.join(', ')│
            └────────────┬──────────────────┘
                         │
            ┌────────────▼──────────────────┐
            │ HTML → PDF 변환               │
            └────────────┬──────────────────┘
                         │
            ┌────────────▼──────────────────┐
            │ Blob 반환                     │
            └───────────────────────────────┘
```

---

### 전용 양식 Excel 생성 플로우 (`buildRomandNudzExcel_`)

```
        ┌────────────────────────────────┐
        │ buildRomandNudzExcel_()        │
        └──────────────┬─────────────────┘
                       │
        ┌──────────────▼─────────────────┐
        │ 템플릿 파일 조회                │
        │ DriveApp.getFileById()         │
        └──────────────┬─────────────────┘
                       │
        ┌──────────────▼─────────────────┐
        │ MIME 타입 확인                  │
        └───┬──────────────────┬─────────┘
           XLSX              Sheets
            │                 │
  ┌─────────▼────────┐        │
  │ XLSX → Sheets 변환│        │
  │ Drive.Files.insert│        │
  │ { convert: true } │        │
  └─────────┬────────┘        │
            │                 │
            │     ┌───────────▼────────┐
            │     │ makeCopy()         │
            │     └───────────┬────────┘
            └─────────────────┘
                       │
        ┌──────────────▼─────────────────┐
        │ 스프레드시트 열기               │
        │ SpreadsheetApp.open()          │
        └──────────────┬─────────────────┘
                       │
        ┌──────────────▼─────────────────┐
        │ 시트 선택                       │
        │ getSheetByName('롬앤(발주양식)')│
        └──────────────┬─────────────────┘
                       │
        ┌──────────────▼─────────────────┐
        │ 데이터 입력 (15행부터)          │
        │  - 2열: 바코드                 │
        │  - 3열: 제품명                 │
        │  - 6열: "39%"                  │
        │  - 9열: 수량                   │
        └──────────────┬─────────────────┘
                       │
        ┌──────────────▼─────────────────┐
        │ SpreadsheetApp.flush()         │
        └──────────────┬─────────────────┘
                       │
        ┌──────────────▼─────────────────┐
        │ Excel Blob 생성                │
        │ copiedFile.getBlob()           │
        └──────────────┬─────────────────┘
                       │
        ┌──────────────▼─────────────────┐
        │ 임시 파일 삭제                  │
        │ copiedFile.setTrashed(true)    │
        └──────────────┬─────────────────┘
                       │
        ┌──────────────▼─────────────────┐
        │ Blob 반환                      │
        └────────────────────────────────┘
```

---

## 요약

### 핵심 기능
1. **PDF 생성**: 거래명세서(부포/영세), 발주서(매입)
2. **Excel 생성**: 일반 양식, 전용 양식 (롬앤/누즈, 종근당, 삐아계열)
3. **통합 출력**: 매입처별 통합, 발주번호별 개별
4. **출력 모드**: `full`, `short`, `auto`
5. **세부목록**: Short 모드 시 별도 Excel 생성

### 주요 특징
- **단일 템플릿**: 모든 PDF가 `Templates_Invoice_VAT` 템플릿 사용
- **유연한 VAT 계산**: 부별/부포 자동 처리
- **전용 양식 지원**: XLSX 템플릿 → Google Sheets 변환 → 데이터 입력 → Excel 출력
- **매입처별 통합**: 여러 발주를 하나의 PDF로 병합
- **브랜드별 출력방식**: 통합 문서에서도 브랜드별로 `full`/`short` 개별 적용

### 데이터 흐름
```
거래원장 (Sheets)
  ↓
generateInvoiceZip()
  ↓
├─ PDF 모드 → buildXxxPdf() → Templates_Invoice_VAT → PDF Blob
├─ Excel 모드 → generateExcelOutput_() → Excel Blob
└─ 전용 양식 → buildCustomTemplateExcel_() → XLSX 템플릿 변환 → Excel Blob
  ↓
ZIP 파일 생성
  ↓
Google Drive 저장
```

---

**분석 완료 일시**: 2026-01-10
**총 함수 수**: 21개
**총 라인 수**: 2224 라인
