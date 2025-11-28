/**
 * OneBridge ERP v2 — DB Service (Extended)
 * 스프레드시트 3개 기반:
 * - 기초데이터 (마스터DB)
 * - 발주입력 (단건 입력)
 * - 발주 통합DB (거래원장)
 */

var ERP_CONFIG = {

  // 1) 기초데이터 스프레드시트 (매입처DB, 브랜드DB, 품목DB)
  BASE_DATA_SHEET_ID: '1vjAjykSQGK2DnFXvmQcH2zuI8WbOvAq_smqvW8u_bao',

  // 2) 발주입력 스프레드시트 (파싱 결과가 저장됨)
  ORDER_INPUT_SHEET_ID: '11sjwW1NM4fskAQBYnWghbE6d2E0y_EpX-LocgUAevWY',

  // 3) 발주 통합DB (최종 거래원장)
  ORDER_MERGED_SHEET_ID: '1oz4M6nc_R0vORnV0bl6uPbw_z8EDomo2ko-NF-usyxs'
};


/* ===========================================================
   Spreadsheet Handlers
   =========================================================== */

function getBaseDataSpreadsheet() {
  return SpreadsheetApp.openById(ERP_CONFIG.BASE_DATA_SHEET_ID);
}

function getOrderInputSpreadsheet() {
  return SpreadsheetApp.openById(ERP_CONFIG.ORDER_INPUT_SHEET_ID);
}

function getOrderMergedSpreadsheet() {
  return SpreadsheetApp.openById(ERP_CONFIG.ORDER_MERGED_SHEET_ID);
}


/* ===========================================================
   Individual Sheets
   =========================================================== */

// === 마스터DB 내부 시트 ===
function getSupplierSheet() {        // 거래처DB
  return getBaseDataSpreadsheet().getSheetByName('거래처DB');
}

function getProductSheet() {         // 품목DB
  return getBaseDataSpreadsheet().getSheetByName('품목DB');
}

// === 발주입력 ===
function getOrderInputSheet() {      // 업로드 후 자동 입력 저장
  return getOrderInputSpreadsheet().getSheetByName('입력시트');
}

function getOrderUploadSheet() {     // 업로드 원본
  return getOrderInputSpreadsheet().getSheetByName('발주업로드');
}

// === 발주 통합DB ===
function getOrderMergedSheet() {     // 거래원장
  return getOrderMergedSpreadsheet().getSheetByName('거래원장');
}


/* ===========================================================
   Utility: 시트 값 읽기
   =========================================================== */

function getSheetData_(sheet) {
  var data = sheet.getDataRange().getValues();
  var header = data.shift();
  return { header: header, rows: data };
}

/* ===========================================================
   Core Functions (중요)
   =========================================================== */

/** 거래처 목록 가져오기 */
function getSuppliers() {
  return getSheetData_(getSupplierSheet());
}

/** 품목 목록 가져오기 */
function getProducts() {
  return getSheetData_(getProductSheet());
}

/** 바코드 또는 상품명으로 품목 검색 */
function findProductByBarcode(barcode) {
  var data = getProducts();
  var idx = data.header.indexOf('품목코드');
  if (idx < 0) return null;

  for (var i = 0; i < data.rows.length; i++) {
    if (String(data.rows[i][idx]).trim() === String(barcode).trim()) {
      return data.rows[i];
    }
  }
  return null;
}

/** 브랜드코드로 거래처 찾기 */
function findSupplierByBrandCode(brandCode) {
  var data = getSuppliers();
  var col = data.header.indexOf('브랜드코드');
  if (col < 0) return null;

  for (var i = 0; i < data.rows.length; i++) {
    if (String(data.rows[i][col]).trim() === String(brandCode).trim()) {
      return data.rows[i];
    }
  }
  return null;
}

/** 발주 통합DB에 신규 발주 데이터 추가 */
function appendOrderMerged(rows) {
  var sheet = getOrderMergedSheet();
  sheet.getRange(sheet.getLastRow()+1, 1, rows.length, rows[0].length).setValues(rows);
  return true;
}

