# OneBridge ERP - 거래명세서 출력 시스템 기술 아키텍처

## 📋 문서 정보

- **문서명**: 거래명세서 출력 시스템 기술 아키텍처
- **버전**: 2.0
- **작성일**: 2026-01-10
- **작성자**: Claude
- **관련 브랜치**: claude/erp-partial-payment-HtG35 → claude/erp-partial-payment-continue-Dgmz2

---

## 🎯 시스템 개요

### 1.1 목적
거래원장 데이터를 바탕으로 다양한 형식의 출력물(발주서, 거래명세서)을 자동 생성하는 시스템

### 1.2 주요 기능
1. **표준 문서 출력**: 발주서(매입), 거래명세서(부포/영세)
2. **멀티페이지 PDF**: 품목이 많을 경우 자동 페이지 분할
3. **전용 양식 출력**: 브랜드별 전용 템플릿 지원
4. **매입처별 통합**: 여러 발주를 하나의 문서로 통합
5. **다중 형식 지원**: PDF, Excel (XLSX)

### 1.3 지원 문서 유형

| 문서 유형 | 코드 | 출력 형식 | 용도 |
|----------|------|----------|------|
| 발주서(매입) | ORDER_PURCHASE | PDF, Excel | 매입처에 발주 내역 전달 |
| 거래명세서(부포) | INVOICE_VAT | PDF, Excel | 부가세 과세 거래 명세 |
| 거래명세서(영세) | INVOICE_NVAT | PDF, Excel | 영세율 거래 명세 |
| 롬앤/누즈 전용 | CUSTOM_ROMAND | Excel | 롬앤/누즈 전용 양식 |
| 종근당 전용 | CUSTOM_JONGGEUNDANG | Excel | 종근당 전용 양식 |
| 삐아계열 전용 | CUSTOM_BBIA | Excel | 삐아/어바웃톤/이글립스 전용 |

---

## 🏗️ 시스템 아키텍처

### 2.1 전체 구조

```
┌───────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Page_InvoiceOutput.html (View)                             │  │
│  │  - 문서 유형/형식/방식 선택 UI                               │  │
│  │  - 발주번호 체크박스 리스트                                  │  │
│  │  - 옵션 입력 (발주일, 납품일, 비고)                          │  │
│  │  - 출력 버튼                                                  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              ↕                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  CommonScripts.html (Controller)                            │  │
│  │  - 이벤트 핸들러                                             │  │
│  │  - 파라미터 수집/검증                                        │  │
│  │  - API 호출                                                   │  │
│  │  - 결과 처리 (ZIP 다운로드)                                 │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
                              ↕
┌───────────────────────────────────────────────────────────────────┐
│                        Application Layer                           │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  InvoiceOutputService.js (Service)                          │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │  generateInvoiceZip() - Main Entry Point            │   │  │
│  │  │  ├─ 파라미터 파싱                                    │   │  │
│  │  │  ├─ 출력 형식 분기                                   │   │  │
│  │  │  ├─ 매입처별 그룹핑 (옵션)                          │   │  │
│  │  │  └─ ZIP 파일 생성                                    │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                                                               │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │  PDF Generation Module                               │   │  │
│  │  │  - buildInvoiceVatPdf() : 단일 거래명세서(부포)    │   │  │
│  │  │  - buildOrderPurchasePdf() : 단일 발주서(매입)     │   │  │
│  │  │  - buildInvoiceNvatPdf() : 단일 거래명세서(영세)   │   │  │
│  │  │  - buildInvoiceVatPdfMerged() : 통합 거래명세서     │   │  │
│  │  │  - buildOrderPurchasePdfMerged() : 통합 발주서      │   │  │
│  │  │  - buildInvoiceNvatPdfMerged() : 통합 영세명세서    │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                                                               │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │  Excel Generation Module                             │   │  │
│  │  │  - generateExcelOutput_() : 표준 Excel 생성        │   │  │
│  │  │  - generateCustomTemplateExcel_() : 전용 양식 생성 │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                                                               │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │  Custom Template Module                              │   │  │
│  │  │  - buildRomandNudzExcel_()                          │   │  │
│  │  │  - buildJonggeundangExcel_()                        │   │  │
│  │  │  - buildBbiaGroupExcel_()                           │   │  │
│  │  │  - getCustomTemplateGroup_()                        │   │  │
│  │  │  - getCustomTemplateFileIds_()                      │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                                                               │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │  Utility Module                                      │   │  │
│  │  │  - findPartnerByName_() : 거래처 조회              │   │  │
│  │  │  - formatNumber_() : 숫자 포맷                      │   │  │
│  │  │  - formatDateYmd_() : 날짜 포맷                     │   │  │
│  │  │  - numberToHangulKor_() : 한글 금액 변환           │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
                              ↕
┌───────────────────────────────────────────────────────────────────┐
│                        Template Layer                              │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Templates_Invoice_VAT.html                                 │  │
│  │  - 멀티페이지 PDF 템플릿                                    │  │
│  │  - 페이지당 10행 자동 분할                                  │  │
│  │  - 반응형 레이아웃                                           │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Templates_Order_Purchase.html                              │  │
│  │  - 발주서 PDF 템플릿                                         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Templates_Invoice_NVAT.html                                │  │
│  │  - 영세율 거래명세서 PDF 템플릿                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
                              ↕
┌───────────────────────────────────────────────────────────────────┐
│                        Data Layer                                  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Google Sheets                                              │  │
│  │  - Transaction (거래원장)                                   │  │
│  │  - Partners (거래처DB)                                      │  │
│  │  - Items (품목DB)                                           │  │
│  │  - Settings (설정DB)                                        │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Google Drive                                               │  │
│  │  - 전용 양식 템플릿 (XLSX)                                 │  │
│  │  - 임시 출력 파일 (ZIP)                                    │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## 📊 데이터 흐름

### 3.1 전체 데이터 흐름

```
┌────────────────┐
│  사용자 입력   │
│  - 발주번호    │
│  - 문서 유형   │
│  - 출력 형식   │
│  - 출력 방식   │
│  - 옵션        │
└────────┬───────┘
         ↓
┌────────────────────────────────────────────┐
│  CommonScripts.exportSelected()            │
│  ┌──────────────────────────────────────┐  │
│  │  1. 입력 검증                        │  │
│  │     - 발주번호 선택 여부             │  │
│  │     - 필수 입력 확인                 │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │  2. 파라미터 수집                    │  │
│  │     var params = {                   │  │
│  │       orderCodes: [...],             │  │
│  │       docType: 'INVOICE_VAT',        │  │
│  │       outputFormat: 'PDF',           │  │
│  │       printMode: 'auto',             │  │
│  │       modesByOrder: {},              │  │
│  │       mergeBySupplier: true,         │  │
│  │       docDate: '2026-01-10',         │  │
│  │       deliveryDate: '2026-01-15',    │  │
│  │       manualRemark: '특이사항...'    │  │
│  │     }                                 │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │  3. API 호출                         │  │
│  │     google.script.run                │  │
│  │       .generateInvoiceZip(params)    │  │
│  └──────────────────────────────────────┘  │
└────────┬───────────────────────────────────┘
         ↓
┌────────────────────────────────────────────┐
│  InvoiceOutputService.generateInvoiceZip() │
│  ┌──────────────────────────────────────┐  │
│  │  4. 거래원장 데이터 조회             │  │
│  │     - getTransactionByOrderCode()    │  │
│  │     - 발주번호별 품목/금액 정보      │  │
│  │     - 거래처 정보                    │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │  5. 매입처별 그룹핑 (옵션)           │  │
│  │     if (mergeBySupplier) {           │  │
│  │       orderInfoMap[code] = supplier  │  │
│  │       supplierGroups[supplier] = []  │  │
│  │     }                                 │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │  6. 출력 형식 분기                   │  │
│  │     ├─ PDF                           │  │
│  │     │   ├─ 단일: buildXxxPdf()      │  │
│  │     │   └─ 통합: buildXxxPdfMerged()│  │
│  │     └─ Excel                         │  │
│  │         ├─ 표준: generateExcelOutput_()│  │
│  │         └─ 전용: generateCustomTemplateExcel_()│  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │  7. 문서 생성                        │  │
│  │     - 템플릿 렌더링                  │  │
│  │     - Blob 객체 생성                 │  │
│  │     - 파일명 생성                    │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │  8. ZIP 압축                         │  │
│  │     var zip = Utilities.zip(blobs)   │  │
│  │     var base64 = Utilities.base64Encode(zip)│  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │  9. 결과 반환                        │  │
│  │     return {                         │  │
│  │       success: true,                 │  │
│  │       zipData: base64,               │  │
│  │       fileName: '출력물_날짜.zip'    │  │
│  │     }                                 │  │
│  └──────────────────────────────────────┘  │
└────────┬───────────────────────────────────┘
         ↓
┌────────────────────────────────────────────┐
│  CommonScripts (Success Handler)           │
│  ┌──────────────────────────────────────┐  │
│  │  10. ZIP 파일 다운로드               │  │
│  │      var blob = Utilities.newBlob(   │  │
│  │        Utilities.base64Decode(data), │  │
│  │        'application/zip',            │  │
│  │        fileName                      │  │
│  │      )                                │  │
│  │      var link = document.createElement('a')│  │
│  │      link.download = fileName        │  │
│  │      link.href = URL.createObjectURL(blob)│  │
│  │      link.click()                    │  │
│  └──────────────────────────────────────┘  │
└────────┬───────────────────────────────────┘
         ↓
┌────────────────┐
│  사용자 로컬   │
│  ZIP 파일 저장 │
└────────────────┘
```

### 3.2 PDF 생성 흐름 (단일 발주)

```
buildInvoiceVatPdf(orderCode, rows, params)
    ↓
┌──────────────────────────────────────┐
│ 1. 데이터 준비                       │
│    - 거래처 정보 추출                │
│    - 품목 리스트 정리                │
│    - 금액 계산 (공급가, VAT, 합계)  │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 2. 출력 방식 처리                    │
│    - auto → full (템플릿에서 분할)  │
│    - short → 브랜드별 품목 축약     │
│    - full → 전체 품목 표시          │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 3. 템플릿 데이터 바인딩              │
│    var templateData = {              │
│      orderCode: 'PO001',             │
│      orderDate: '2026-01-10',        │
│      supplierName: '원브릿지',       │
│      buyerName: '롬앤',               │
│      items: [...],                   │
│      totalSupplyPrice: 1000000,      │
│      totalVat: 100000,               │
│      totalAmount: 1100000,           │
│      remark: '특이사항...'           │
│    }                                  │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 4. 템플릿 렌더링                     │
│    var template = HtmlService        │
│      .createTemplateFromFile(        │
│        'Templates_Invoice_VAT'       │
│      );                               │
│    template.data = templateData;     │
│    var html = template.evaluate()    │
│      .getContent();                   │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 5. PDF 변환                          │
│    var blob = Utilities.newBlob(     │
│      html,                            │
│      'text/html',                     │
│      'temp.html'                      │
│    ).getAs('application/pdf');       │
│                                       │
│    blob.setName(                      │
│      `거래명세서_${orderCode}.pdf`   │
│    );                                 │
└──────────┬───────────────────────────┘
           ↓
       return blob
```

### 3.3 PDF 생성 흐름 (매입처별 통합)

```
buildInvoiceVatPdfMerged(orderCodes, allRows, params)
    ↓
┌──────────────────────────────────────┐
│ 1. 발주번호별 데이터 그룹핑          │
│    var orderGroups = {};             │
│    orderCodes.forEach(code => {      │
│      orderGroups[code] = allRows     │
│        .filter(r => r.orderCode === code);│
│    });                                │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 2. 품목 병합                         │
│    - 브랜드별로 품목 그룹핑          │
│    - 수량/금액 합산                  │
│    var mergedItems = [];             │
│    brandGroups.forEach(brand => {    │
│      mergedItems.push({              │
│        brandName: brand,             │
│        items: [...],                 │
│        totalQty: sum(qty),           │
│        totalAmount: sum(amount)      │
│      });                              │
│    });                                │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 3. 금액 총계 계산                    │
│    var totalSupplyPrice = 0;         │
│    var totalVat = 0;                 │
│    mergedItems.forEach(item => {     │
│      totalSupplyPrice += item.supplyPrice;│
│      totalVat += item.vat;           │
│    });                                │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 4. 템플릿 데이터 바인딩              │
│    var templateData = {              │
│      orderCodes: orderCodes.join(','),│
│      orderDate: params.docDate,      │
│      supplierName: '원브릿지',       │
│      buyerName: '롬앤',               │
│      items: mergedItems,             │
│      totalSupplyPrice: totalSupplyPrice,│
│      totalVat: totalVat,             │
│      totalAmount: totalSupplyPrice + totalVat,│
│      remark: '통합 출력'             │
│    }                                  │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 5. 템플릿 렌더링 → PDF 변환          │
│    (단일 발주와 동일)                │
└──────────┬───────────────────────────┘
           ↓
       return blob
```

### 3.4 Excel 생성 흐름 (표준 형식)

```
generateExcelOutput_(orderCode, rows, docType, params)
    ↓
┌──────────────────────────────────────┐
│ 1. SpreadsheetApp으로 새 시트 생성   │
│    var ss = SpreadsheetApp.create(   │
│      `${docType}_${orderCode}`       │
│    );                                 │
│    var sheet = ss.getActiveSheet();  │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 2. 헤더 작성                         │
│    sheet.appendRow([                 │
│      '거래명세서',                   │
│      '발주번호: ' + orderCode        │
│    ]);                                │
│    sheet.appendRow([]);              │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 3. 거래처 정보 작성                  │
│    sheet.appendRow([                 │
│      '공급자: ' + supplierName       │
│    ]);                                │
│    sheet.appendRow([                 │
│      '공급받는자: ' + buyerName      │
│    ]);                                │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 4. 품목 테이블 헤더                  │
│    if (docType === 'ORDER_PURCHASE') {│
│      sheet.appendRow([               │
│        'No', '품명', '발주수량',     │
│        '매입가', '매입액'            │
│      ]);                              │
│    } else {                           │
│      sheet.appendRow([               │
│        'No', '품명', '확정수량',     │
│        '공급가', '공급액', 'VAT', '합계'│
│      ]);                              │
│    }                                  │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 5. 품목 데이터 작성                  │
│    rows.forEach((row, idx) => {      │
│      if (docType === 'ORDER_PURCHASE') {│
│        sheet.appendRow([             │
│          idx + 1,                    │
│          row.itemName,               │
│          row.orderQty,               │
│          row.purchasePrice,          │
│          row.purchaseAmount          │
│        ]);                            │
│      } else {                         │
│        sheet.appendRow([             │
│          idx + 1,                    │
│          row.itemName,               │
│          row.confirmedQty,           │
│          row.supplyPrice,            │
│          row.supplyAmount,           │
│          row.vat,                    │
│          row.totalAmount             │
│        ]);                            │
│      }                                │
│    });                                │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 6. 합계 행 작성                      │
│    var lastRow = sheet.getLastRow(); │
│    if (docType === 'ORDER_PURCHASE') {│
│      sheet.appendRow([               │
│        '', '합계',                   │
│        `=SUM(C2:C${lastRow})`,       │
│        '',                            │
│        `=SUM(E2:E${lastRow})`        │
│      ]);                              │
│    } else {                           │
│      sheet.appendRow([               │
│        '', '합계',                   │
│        `=SUM(C2:C${lastRow})`,       │
│        '',                            │
│        `=SUM(E2:E${lastRow})`,       │
│        `=SUM(F2:F${lastRow})`,       │
│        `=SUM(G2:G${lastRow})`        │
│      ]);                              │
│    }                                  │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 7. 셀 포맷 적용                      │
│    // 숫자 열 포맷                   │
│    var numRange = sheet.getRange(    │
│      2, 3, lastRow, 5                │
│    );                                 │
│    numRange.setNumberFormat('#,##0');│
│                                       │
│    // 헤더 스타일                    │
│    var headerRange = sheet.getRange( │
│      1, 1, 1, 7                      │
│    );                                 │
│    headerRange.setFontWeight('bold');│
│    headerRange.setBackground('#f3f4f6');│
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 8. Excel 파일로 변환                 │
│    var blob = DriveApp                │
│      .getFileById(ss.getId())        │
│      .getAs('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');│
│                                       │
│    blob.setName(                      │
│      `${docType}_${orderCode}.xlsx`  │
│    );                                 │
│                                       │
│    // 임시 시트 삭제                 │
│    DriveApp.getFileById(ss.getId())  │
│      .setTrashed(true);              │
└──────────┬───────────────────────────┘
           ↓
       return blob
```

### 3.5 전용 양식 Excel 생성 흐름 (삐아계열 예시)

```
buildBbiaGroupExcel_(orderCode, rows, params)
    ↓
┌──────────────────────────────────────┐
│ 1. 브랜드 판별                       │
│    var brandName = rows[0].brand;    │
│    var sheetName;                    │
│    if (brandName === '삐아') {       │
│      sheetName = '삐아';             │
│    } else if (brandName === '어바웃톤') {│
│      sheetName = '어바웃톤';         │
│    } else if (brandName === '이글립스') {│
│      sheetName = '이글립스';         │
│    }                                  │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 2. 템플릿 파일 복사                  │
│    var templateId = getCustomTemplateFileIds_('BBIA');│
│    var template = DriveApp           │
│      .getFileById(templateId);       │
│    var copy = template.makeCopy(     │
│      `삐아_${orderCode}_${today}`    │
│    );                                 │
│    var ss = SpreadsheetApp.open(copy);│
│    var sheet = ss.getSheetByName(sheetName);│
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 3. 날짜/발주번호 입력                │
│    sheet.getRange('B2').setValue(    │
│      params.docDate                  │
│    );                                 │
│    sheet.getRange('D2').setValue(    │
│      params.deliveryDate             │
│    );                                 │
│    sheet.getRange('F2').setValue(    │
│      orderCode                       │
│    );                                 │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 4. 품목 매칭 (바코드 기반)           │
│    var templateRows = sheet          │
│      .getRange(5, 1, 100, 10)        │
│      .getValues();                    │
│                                       │
│    rows.forEach(row => {             │
│      var barcode = row.barcode;      │
│      var matchIdx = templateRows     │
│        .findIndex(tr => tr[1] === barcode);│
│                                       │
│      if (matchIdx >= 0) {            │
│        var targetRow = 5 + matchIdx; │
│        sheet.getRange(targetRow, 9)  │
│          .setValue(row.orderQty);    │
│      }                                │
│    });                                │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 5. Excel 파일로 변환                 │
│    var blob = DriveApp                │
│      .getFileById(copy.getId())      │
│      .getAs('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');│
│                                       │
│    blob.setName(                      │
│      `삐아_${orderCode}.xlsx`        │
│    );                                 │
│                                       │
│    // 임시 파일 삭제                 │
│    copy.setTrashed(true);            │
└──────────┬───────────────────────────┘
           ↓
       return blob
```

---

## 🔧 핵심 함수 명세

### 4.1 generateInvoiceZip()

**파일**: InvoiceOutputService.js
**용도**: 출력 시스템의 메인 엔트리 포인트

```javascript
/**
 * 거래명세서/발주서 ZIP 파일 생성
 *
 * @param {Object} params - 출력 파라미터
 * @param {string[]} params.orderCodes - 발주번호 배열
 * @param {string} params.docType - 문서 유형 (ORDER_PURCHASE, INVOICE_VAT, INVOICE_NVAT, CUSTOM_*)
 * @param {string} params.outputFormat - 출력 형식 (PDF, EXCEL)
 * @param {string} params.printMode - 출력 방식 (auto, full, short)
 * @param {Object} params.modesByOrder - 발주별 개별 출력방식 맵
 * @param {boolean} params.mergeBySupplier - 매입처별 통합 여부
 * @param {string} params.docDate - 발주일/출고일
 * @param {string} params.deliveryDate - 납품일 (삐아계열 전용)
 * @param {string} params.manualRemark - 수동 비고
 *
 * @return {Object} - { success: boolean, zipData: string, fileName: string }
 */
function generateInvoiceZip(params) {
  try {
    // 1. 파라미터 파싱
    var orderCodes = params.orderCodes || [];
    var docType = params.docType || 'INVOICE_VAT';
    var outputFormat = params.outputFormat || 'PDF';
    var printMode = params.printMode || 'auto';
    var modesByOrder = params.modesByOrder || {};
    var mergeBySupplier = params.mergeBySupplier || false;
    var docDate = params.docDate || '';
    var deliveryDate = params.deliveryDate || '';
    var manualRemark = params.manualRemark || '';

    // 2. 거래원장 데이터 조회
    var allRows = getTransactionsByOrderCodes(orderCodes);

    // 3. 출력 형식 분기
    var blobs = [];

    if (outputFormat === 'PDF') {
      blobs = generatePdfBlobs(/* ... */);
    } else if (outputFormat === 'EXCEL') {
      if (docType.startsWith('CUSTOM_')) {
        blobs = generateCustomTemplateExcel_(/* ... */);
      } else {
        blobs = generateExcelBlobs(/* ... */);
      }
    }

    // 4. ZIP 압축
    var zipBlob = Utilities.zip(blobs, `출력물_${today}.zip`);
    var base64 = Utilities.base64Encode(zipBlob.getBytes());

    // 5. 결과 반환
    return {
      success: true,
      zipData: base64,
      fileName: zipBlob.getName()
    };

  } catch (error) {
    Logger.log('generateInvoiceZip 오류: ' + error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

### 4.2 buildInvoiceVatPdf()

**파일**: InvoiceOutputService.js
**용도**: 거래명세서(부포) PDF 생성 (단일 발주)

```javascript
/**
 * 거래명세서(부포) PDF 생성
 *
 * @param {string} orderCode - 발주번호
 * @param {Array} rows - 품목 데이터 배열
 * @param {Object} params - 출력 파라미터
 * @return {Blob} - PDF Blob 객체
 */
function buildInvoiceVatPdf(orderCode, rows, params) {
  // 1. 데이터 준비
  var supplierName = '원브릿지';
  var buyerName = rows[0].partner || '';
  var orderDate = params.docDate || rows[0].orderDate || '';

  // 2. 출력 방식 처리
  var actualMode = params.printMode === 'auto' ? 'full' : params.printMode;
  var items = rows;

  if (actualMode === 'short' && rows.length > 0) {
    var brandName = rows[0].brand || '기타';
    items = [{
      name: brandName + ' 외 ' + (rows.length - 1) + '건',
      qty: rows.length,
      supplyPrice: 0,
      supplyAmount: sumBy(rows, 'supplyAmount'),
      vat: sumBy(rows, 'vat'),
      totalAmount: sumBy(rows, 'totalAmount')
    }];
  }

  // 3. 금액 계산
  var totalSupplyPrice = sumBy(items, 'supplyAmount');
  var totalVat = sumBy(items, 'vat');
  var totalAmount = totalSupplyPrice + totalVat;

  // 4. 템플릿 데이터 바인딩
  var template = HtmlService.createTemplateFromFile('Templates_Invoice_VAT');
  template.orderCode = orderCode;
  template.orderDate = orderDate;
  template.supplierName = supplierName;
  template.buyerName = buyerName;
  template.items = items;
  template.totalSupplyPrice = totalSupplyPrice;
  template.totalVat = totalVat;
  template.totalAmount = totalAmount;
  template.remark = params.manualRemark || '';

  // 5. PDF 변환
  var html = template.evaluate().getContent();
  var blob = Utilities.newBlob(html, 'text/html', 'temp.html')
    .getAs('application/pdf');
  blob.setName(`거래명세서_${orderCode}.pdf`);

  return blob;
}
```

### 4.3 generateCustomTemplateExcel_()

**파일**: InvoiceOutputService.js
**용도**: 전용 양식 Excel 생성 통합 처리

```javascript
/**
 * 전용 양식 Excel 생성
 *
 * @param {string[]} orderCodes - 발주번호 배열
 * @param {Array} allRows - 전체 품목 데이터
 * @param {string} docType - 문서 유형 (CUSTOM_*)
 * @param {Object} params - 출력 파라미터
 * @return {Blob[]} - Excel Blob 배열
 */
function generateCustomTemplateExcel_(orderCodes, allRows, docType, params) {
  var blobs = [];

  orderCodes.forEach(function(orderCode) {
    var rows = allRows.filter(function(r) {
      return r.orderCode === orderCode;
    });

    if (rows.length === 0) return;

    var blob;

    switch (docType) {
      case 'CUSTOM_ROMAND':
        blob = buildRomandNudzExcel_(orderCode, rows, params);
        break;
      case 'CUSTOM_JONGGEUNDANG':
        blob = buildJonggeundangExcel_(orderCode, rows, params);
        break;
      case 'CUSTOM_BBIA':
        blob = buildBbiaGroupExcel_(orderCode, rows, params);
        break;
      default:
        Logger.log('알 수 없는 전용 양식 유형: ' + docType);
        return;
    }

    if (blob) {
      blobs.push(blob);
    }
  });

  return blobs;
}
```

### 4.4 exportSelected() (Frontend)

**파일**: CommonScripts.html
**용도**: 출력 버튼 클릭 시 실행되는 통합 출력 함수

```javascript
/**
 * 선택된 발주번호 출력
 */
OB.exportSelected = function() {
  // 1. 체크된 발주번호 수집
  var checkboxes = document.querySelectorAll('input[name="invoice-order-check"]:checked');
  var selected = Array.from(checkboxes).map(function(cb) {
    return cb.value;
  });

  if (selected.length === 0) {
    alert('출력할 발주번호를 선택해주세요.');
    return;
  }

  // 2. 파라미터 수집
  var docType = document.getElementById('inv-doc-type').value;
  var outputFormat = document.getElementById('inv-output-format').value;
  var defaultMode = document.getElementById('inv-default-mode').value;
  var mergeBySupplier = document.getElementById('inv-merge-by-supplier').checked;
  var docDate = document.getElementById('inv-doc-date').value;
  var deliveryDate = document.getElementById('inv-delivery-date').value;
  var manualRemarkCheck = document.getElementById('inv-manual-remark-check').checked;
  var manualRemarkText = manualRemarkCheck ? document.getElementById('inv-manual-remark-text').value : '';

  // 3. 발주별 개별 출력방식 맵 생성
  var modes = {};
  selected.forEach(function(orderCode) {
    var modeSelect = document.querySelector(`select[data-order="${orderCode}"]`);
    if (modeSelect) {
      modes[orderCode] = modeSelect.value;
    }
  });

  // 4. 파라미터 객체 생성
  var params = {
    orderCodes: selected,
    docType: docType,
    outputFormat: outputFormat,
    printMode: defaultMode,
    modesByOrder: modes,
    mergeBySupplier: mergeBySupplier,
    docDate: docDate,
    deliveryDate: deliveryDate,
    manualRemark: manualRemarkText
  };

  // 5. API 호출
  OB.showLoading('출력 파일 생성 중...');

  google.script.run
    .withSuccessHandler(function(result) {
      OB.hideLoading();

      if (result.success) {
        // ZIP 파일 다운로드
        var zipBytes = Utilities.base64Decode(result.zipData);
        var blob = new Blob([zipBytes], { type: 'application/zip' });
        var link = document.createElement('a');
        link.download = result.fileName;
        link.href = URL.createObjectURL(blob);
        link.click();

        alert('출력 완료!');
      } else {
        alert('출력 실패: ' + result.error);
      }
    })
    .withFailureHandler(function(err) {
      OB.hideLoading();
      console.error(err);
      alert('출력 실패: ' + err.message);
    })
    .generateInvoiceZip(params);
};
```

---

## 📱 템플릿 구조

### 5.1 Templates_Invoice_VAT.html (멀티페이지 PDF)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    /* 페이지 설정 */
    @page {
      size: A4;
      margin: 10mm;
    }

    /* 페이지 컨테이너 */
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 10mm;
      box-sizing: border-box;
      page-break-after: always;
    }

    .page:last-child {
      page-break-after: auto;
    }

    /* 헤더 */
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      color: white;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    /* 거래처 정보 */
    .party-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .party-box {
      width: 48%;
      border: 1px solid #e5e7eb;
      padding: 10px;
      border-radius: 4px;
    }

    /* 금액 요약 */
    .amount-summary {
      display: flex;
      justify-content: flex-end;
      gap: 20px;
      margin-bottom: 20px;
    }

    .amount-box {
      background: #fef3c7;
      border: 2px solid #f59e0b;
      padding: 10px 20px;
      border-radius: 4px;
      text-align: center;
    }

    /* 품목 테이블 */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }

    .items-table th {
      background: #f3f4f6;
      padding: 8px;
      border: 1px solid #d1d5db;
      font-weight: bold;
    }

    .items-table td {
      padding: 6px 8px;
      border: 1px solid #e5e7eb;
    }

    .items-table tbody tr:nth-child(even) {
      background: #f9fafb;
    }

    .items-table tbody tr:hover {
      background: #fef3c7;
    }

    /* 연속 페이지 헤더 */
    .continuation-header {
      background: #f3f4f6;
      padding: 10px;
      border-left: 4px solid #f97316;
      margin-bottom: 20px;
      font-weight: bold;
    }

    /* 비고 */
    .remark {
      border: 1px solid #e5e7eb;
      padding: 10px;
      min-height: 60px;
      background: #fafafa;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <?
    // 템플릿 데이터
    var ITEMS_PER_PAGE = 10;
    var totalItems = items.length;
    var totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    // 첫 페이지
  ?>
  <div class="page">
    <!-- 헤더 -->
    <div class="header">
      <h1 style="margin: 0;">거래명세서 (부가세 과세)</h1>
      <div style="margin-top: 10px;">
        <span>발주번호: <?= orderCode ?></span>
        <span style="margin-left: 20px;">발주일: <?= orderDate ?></span>
      </div>
    </div>

    <!-- 거래처 정보 -->
    <div class="party-info">
      <div class="party-box">
        <h3>공급자</h3>
        <p><?= supplierName ?></p>
      </div>
      <div class="party-box">
        <h3>공급받는자</h3>
        <p><?= buyerName ?></p>
      </div>
    </div>

    <!-- 금액 요약 -->
    <div class="amount-summary">
      <div class="amount-box">
        <div>공급가액</div>
        <div style="font-size: 18px; font-weight: bold;"><?= formatNumber(totalSupplyPrice) ?>원</div>
      </div>
      <div class="amount-box">
        <div>부가세</div>
        <div style="font-size: 18px; font-weight: bold;"><?= formatNumber(totalVat) ?>원</div>
      </div>
      <div class="amount-box" style="background: #fed7aa; border-color: #f97316;">
        <div>합계</div>
        <div style="font-size: 20px; font-weight: bold; color: #ea580c;"><?= formatNumber(totalAmount) ?>원</div>
      </div>
    </div>

    <!-- 품목 테이블 (첫 10행) -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 5%;">No</th>
          <th style="width: 35%;">품명</th>
          <th style="width: 10%;">수량</th>
          <th style="width: 15%;">공급가</th>
          <th style="width: 15%;">공급액</th>
          <th style="width: 10%;">VAT</th>
          <th style="width: 10%;">합계</th>
        </tr>
      </thead>
      <tbody>
        <? for (var i = 0; i < Math.min(ITEMS_PER_PAGE, totalItems); i++) { ?>
          <tr>
            <td style="text-align: center;"><?= i + 1 ?></td>
            <td><?= items[i].name ?></td>
            <td style="text-align: right;"><?= formatNumber(items[i].qty) ?></td>
            <td style="text-align: right;"><?= formatNumber(items[i].supplyPrice) ?></td>
            <td style="text-align: right;"><?= formatNumber(items[i].supplyAmount) ?></td>
            <td style="text-align: right;"><?= formatNumber(items[i].vat) ?></td>
            <td style="text-align: right;"><?= formatNumber(items[i].totalAmount) ?></td>
          </tr>
        <? } ?>
      </tbody>
    </table>

    <!-- 비고 (첫 페이지 또는 단일 페이지) -->
    <? if (totalPages === 1) { ?>
      <div class="remark">
        <strong>비고:</strong> <?= remark ?>
      </div>
    <? } ?>
  </div>

  <!-- 연속 페이지 (11행 이상) -->
  <? if (totalPages > 1) { ?>
    <? for (var page = 2; page <= totalPages; page++) { ?>
      <div class="page">
        <!-- 연속 페이지 헤더 -->
        <div class="continuation-header">
          거래명세서 (계속) | 발주번호: <?= orderCode ?> | 페이지 <?= page ?> / <?= totalPages ?>
        </div>

        <!-- 품목 테이블 -->
        <div style="margin-bottom: 10px;">
          <strong>품목 내역 (<?= (page - 1) * ITEMS_PER_PAGE + 1 ?>~<?= Math.min(page * ITEMS_PER_PAGE, totalItems) ?> / 총 <?= totalItems ?>건)</strong>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 5%;">No</th>
              <th style="width: 35%;">품명</th>
              <th style="width: 10%;">수량</th>
              <th style="width: 15%;">공급가</th>
              <th style="width: 15%;">공급액</th>
              <th style="width: 10%;">VAT</th>
              <th style="width: 10%;">합계</th>
            </tr>
          </thead>
          <tbody>
            <?
              var startIdx = (page - 1) * ITEMS_PER_PAGE;
              var endIdx = Math.min(page * ITEMS_PER_PAGE, totalItems);
              for (var i = startIdx; i < endIdx; i++) {
            ?>
              <tr>
                <td style="text-align: center;"><?= i + 1 ?></td>
                <td><?= items[i].name ?></td>
                <td style="text-align: right;"><?= formatNumber(items[i].qty) ?></td>
                <td style="text-align: right;"><?= formatNumber(items[i].supplyPrice) ?></td>
                <td style="text-align: right;"><?= formatNumber(items[i].supplyAmount) ?></td>
                <td style="text-align: right;"><?= formatNumber(items[i].vat) ?></td>
                <td style="text-align: right;"><?= formatNumber(items[i].totalAmount) ?></td>
              </tr>
            <? } ?>
          </tbody>
        </table>

        <!-- 비고 (마지막 페이지에만) -->
        <? if (page === totalPages) { ?>
          <div class="remark">
            <strong>비고:</strong> <?= remark ?>
          </div>
        <? } ?>
      </div>
    <? } ?>
  <? } ?>
</body>
</html>
```

---

## 🗄️ 데이터베이스 스키마

### 6.1 Transaction (거래원장)

| 컬럼명 | 타입 | 설명 | 예시 |
|--------|------|------|------|
| OrderCode | String | 발주번호 | PO001 |
| OrderDate | Date | 발주일 | 2026-01-10 |
| Partner | String | 거래처명 | 롬앤 |
| Brand | String | 브랜드명 | 롬앤 |
| ItemCode | String | 품목코드 | ITEM001 |
| ItemName | String | 품명 | 립스틱 |
| Barcode | String | 바코드 | 8801234567890 |
| OrderQty | Number | 발주수량 | 100 |
| ConfirmedQty | Number | 확정수량 | 95 |
| PurchasePrice | Number | 매입가 | 5000 |
| PurchaseAmount | Number | 매입액 | 475000 |
| SupplyPrice | Number | 공급가 | 7000 |
| SupplyAmount | Number | 공급액 | 665000 |
| VAT | Number | 부가세 | 66500 |
| TotalAmount | Number | 합계 | 731500 |
| State | String | 상태 | CONFIRMED_OPEN |

### 6.2 Partners (거래처DB)

| 컬럼명 | 타입 | 설명 | 예시 |
|--------|------|------|------|
| PartnerID | String | 거래처 ID | PART001 |
| PartnerName | String | 거래처명 | 롬앤 |
| PartnerType | String | 유형 | BUYER (또는 SUPPLIER) |
| BusinessNumber | String | 사업자번호 | 123-45-67890 |
| Address | String | 주소 | 서울시 강남구... |
| Phone | String | 전화번호 | 02-1234-5678 |
| Email | String | 이메일 | romand@example.com |
| PaymentTerms | String | 결제조건 | 30일 |
| AccountNumber | String | 계좌번호 | 123-456-789012 |

### 6.3 Settings (설정DB)

| 컬럼명 | 타입 | 설명 | 예시 |
|--------|------|------|------|
| SettingKey | String | 설정 키 | TEMPLATE_ROMAND |
| SettingValue | String | 설정 값 | 1a2b3c4d5e6f (Drive File ID) |
| Description | String | 설명 | 롬앤/누즈 전용 양식 템플릿 파일 ID |
| Category | String | 카테고리 | CUSTOM_TEMPLATE |

---

## 🔒 보안 및 권한

### 7.1 접근 제어
- **WebApp**: 조직 내부 도메인만 접근 가능
- **함수 실행**: Apps Script 권한 기반 제어
- **민감 정보**: 환경 변수 또는 Properties Service 사용

### 7.2 데이터 검증
```javascript
// 입력값 검증 예시
function validateParams(params) {
  if (!params.orderCodes || params.orderCodes.length === 0) {
    throw new Error('발주번호가 선택되지 않았습니다.');
  }

  var validDocTypes = [
    'ORDER_PURCHASE', 'INVOICE_VAT', 'INVOICE_NVAT',
    'CUSTOM_ROMAND', 'CUSTOM_JONGGEUNDANG', 'CUSTOM_BBIA'
  ];
  if (!validDocTypes.includes(params.docType)) {
    throw new Error('유효하지 않은 문서 유형입니다.');
  }

  var validFormats = ['PDF', 'EXCEL'];
  if (!validFormats.includes(params.outputFormat)) {
    throw new Error('유효하지 않은 출력 형식입니다.');
  }

  return true;
}
```

### 7.3 에러 로깅
```javascript
function logError(context, error) {
  var timestamp = new Date();
  var user = Session.getActiveUser().getEmail();
  var message = `[${timestamp}] [${user}] [${context}] ${error.message}`;

  Logger.log(message);

  // 선택적으로 Sheets에 로그 저장
  var logSheet = getSheetByName('ErrorLog');
  logSheet.appendRow([timestamp, user, context, error.message, error.stack]);
}
```

---

## 📈 성능 최적화

### 8.1 배치 처리
```javascript
// ❌ 비효율적
for (var i = 0; i < 100; i++) {
  sheet.getRange(i + 1, 1).setValue(data[i]);
}

// ✅ 효율적
sheet.getRange(1, 1, data.length, 1).setValues(data.map(d => [d]));
```

### 8.2 캐싱 전략
```javascript
// 거래처 정보 캐싱
var partnerCache = {};

function findPartnerByName_(name) {
  if (partnerCache[name]) {
    return partnerCache[name];
  }

  var sheet = getSheetByName('Partners');
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === name) {
      partnerCache[name] = {
        id: data[i][0],
        name: data[i][1],
        businessNumber: data[i][3],
        // ...
      };
      return partnerCache[name];
    }
  }

  return null;
}
```

### 8.3 임시 파일 정리
```javascript
function cleanupTempFiles() {
  var folder = DriveApp.getRootFolder();
  var files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
  var oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  while (files.hasNext()) {
    var file = files.next();
    if (file.getName().startsWith('temp_') && file.getDateCreated() < oneDayAgo) {
      file.setTrashed(true);
    }
  }
}
```

---

## 🧪 테스트 시나리오

### 9.1 단위 테스트

```javascript
function testBuildInvoiceVatPdf() {
  var testData = {
    orderCode: 'TEST001',
    rows: [
      {
        itemName: '테스트 품목 1',
        qty: 10,
        supplyPrice: 1000,
        supplyAmount: 10000,
        vat: 1000,
        totalAmount: 11000
      },
      {
        itemName: '테스트 품목 2',
        qty: 20,
        supplyPrice: 2000,
        supplyAmount: 40000,
        vat: 4000,
        totalAmount: 44000
      }
    ],
    params: {
      docDate: '2026-01-10',
      printMode: 'full',
      manualRemark: '테스트 비고'
    }
  };

  var blob = buildInvoiceVatPdf(testData.orderCode, testData.rows, testData.params);

  Logger.log('PDF 생성 성공: ' + blob.getName());
  Logger.log('파일 크기: ' + blob.getBytes().length + ' bytes');

  // 결과 검증
  if (blob.getName().includes('TEST001')) {
    Logger.log('✅ 테스트 통과');
  } else {
    Logger.log('❌ 테스트 실패');
  }
}
```

### 9.2 통합 테스트

```javascript
function testGenerateInvoiceZip() {
  var testParams = {
    orderCodes: ['TEST001', 'TEST002'],
    docType: 'INVOICE_VAT',
    outputFormat: 'PDF',
    printMode: 'full',
    modesByOrder: {},
    mergeBySupplier: false,
    docDate: '2026-01-10',
    deliveryDate: '',
    manualRemark: '통합 테스트'
  };

  var result = generateInvoiceZip(testParams);

  if (result.success) {
    Logger.log('✅ ZIP 생성 성공');
    Logger.log('파일명: ' + result.fileName);
    Logger.log('Base64 길이: ' + result.zipData.length);
  } else {
    Logger.log('❌ ZIP 생성 실패: ' + result.error);
  }
}
```

---

## 📚 참고 문서

- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [Google Drive API](https://developers.google.com/drive/api)
- [HtmlService](https://developers.google.com/apps-script/reference/html)
- [Utilities Service](https://developers.google.com/apps-script/reference/utilities)

---

**문서 버전**: 2.0
**최종 수정일**: 2026-01-10
**작성자**: Claude
