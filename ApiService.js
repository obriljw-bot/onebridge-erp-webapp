/**
 * ============================================================
 * ApiService.gs - OneBridge ERP API 레이어
 * ============================================================
 * 클라이언트에서 호출하는 모든 API 엔드포인트를 관리
 * ============================================================
 */

/**
 * ============================================================
 * 클라이언트 반환용 직렬화 함수 (필수)
 * ============================================================
 * Date 객체, undefined 등을 JSON 호환 형식으로 변환
 * 모든 클라이언트 호출 함수에서 반드시 사용할 것
 */
function safeReturn(data) {
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (e) {
    Logger.log('[safeReturn Error] ' + e.message);
    return { success: false, error: '데이터 직렬화 실패: ' + e.message };
  }
}

/**
 * 테스트용 ping
 */
function ping() {
  return {
    status: 'ok',
    now: new Date().toISOString(),  // ✅ Date 객체 → 문자열로 수정
    app: 'OneBridge ERP v2 (SSR Hybrid SPA)',
    version: '2.0.0'
  };
}

/**
 * ============================================================
 * API 라우터 (선택적 사용)
 * ============================================================
 */
function handleApiRequest(endpoint, params) {
  try {
    switch(endpoint) {
      case 'getDashboard':
        return getDashboardStats(params);
      
      case 'getOrders':
        return getOrderList(params);
      
      case 'getOrderDetail':
        return getOrderDetail(params.orderId);
      
      case 'updateOrder':
        return updateOrderStatus(params.orderId, params.status);
      
      case 'deleteOrder':
        return deleteOrder(params.orderId);

      // ✅ [수정] 출력용 데이터 조회 - Api 래퍼 사용
      case 'getPrintableOrders':
        return getPrintableOrdersApi(params);

      // ✅ [수정] PDF ZIP 생성 - Api 래퍼 사용
      case 'generateInvoiceZip': 
        return generateInvoiceZipApi(params);
      
      default:
        return { 
          success: false, 
          error: 'Unknown endpoint: ' + endpoint 
        };
    }
  } catch (err) {
    Logger.log('[API Error] ' + endpoint + ': ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * ============================================================
 * 클라이언트용 API 래퍼 함수 (safeReturn 적용)
 * ============================================================
 */

/**
 * 출력용 발주 조회 (클라이언트용 래퍼)
 */
function getPrintableOrdersApi(params) {
  var result = getPrintableOrders(params);
  return safeReturn(result);
}

/**
 * PDF ZIP 생성 (클라이언트용 래퍼)
 */
function generateInvoiceZipApi(params) {
  var result = generateInvoiceZip(params);
  return safeReturn(result);
}


/**
 * ============================================================
 * 대시보드 통계
 * ============================================================
 */
function getDashboardStats(params) {
  try {
    var sheet = getOrderMergedSheet();
    var data = sheet.getDataRange().getValues();
    
    if (data.length === 0) {
      return {
        success: true,
        stats: {
          totalOrders: 0,
          todayOrders: 0,
          weekOrders: 0,
          monthOrders: 0,
          totalAmount: 0,
          todayAmount: 0,
          weekAmount: 0,
          monthAmount: 0
        }
      };
    }
    
    var header = data[0];
    var rows = data.slice(1);
    
    // 컬럼 인덱스 찾기
    var colDate = header.indexOf('발주일');
    var colAmount = header.indexOf('공급액');
    
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    
    var weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    var monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    var stats = {
      totalOrders: rows.length,
      todayOrders: 0,
      weekOrders: 0,
      monthOrders: 0,
      totalAmount: 0,
      todayAmount: 0,
      weekAmount: 0,
      monthAmount: 0
    };
    
    rows.forEach(function(row) {
      var dateVal = row[colDate];
      var amountVal = parseFloat(row[colAmount]) || 0;
      
      stats.totalAmount += amountVal;
      
      if (dateVal) {
        var orderDate = new Date(dateVal);
        orderDate.setHours(0, 0, 0, 0);
        
        if (orderDate.getTime() === today.getTime()) {
          stats.todayOrders++;
          stats.todayAmount += amountVal;
        }
        
        if (orderDate >= weekAgo) {
          stats.weekOrders++;
          stats.weekAmount += amountVal;
        }
        
        if (orderDate >= monthAgo) {
          stats.monthOrders++;
          stats.monthAmount += amountVal;
        }
      }
    });
    
    return {
      success: true,
      stats: stats
    };
    
  } catch (err) {
    Logger.log('[getDashboardStats Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * ============================================================
 * 발주 목록 조회 (필터링 지원)
 * ============================================================
 */
function getOrderList(params) {
  try {
    params = params || {};
    
    var sheet = getOrderMergedSheet();
    var data = sheet.getDataRange().getValues();
    
    if (data.length === 0) {
      return {
        success: true,
        orders: []
      };
    }
    
    var header = data[0];
    var rows = data.slice(1);
    
    // 컬럼 인덱스
    var cols = {};
    header.forEach(function(h, idx) {
      cols[h] = idx;
    });
    
    // 필터 적용
    var filtered = rows.filter(function(row) {
      // 날짜 필터
      if (params.startDate) {
        var orderDate = new Date(row[cols['발주일']]);
        var startDate = new Date(params.startDate);
        if (orderDate < startDate) return false;
      }
      
      if (params.endDate) {
        var orderDate = new Date(row[cols['발주일']]);
        var endDate = new Date(params.endDate);
        if (orderDate > endDate) return false;
      }
      
      // 발주처 필터
      if (params.buyer) {
        if (row[cols['발주처']] !== params.buyer) return false;
      }
      
      // 브랜드 필터
      if (params.brand) {
        if (row[cols['브랜드']] !== params.brand) return false;
      }
      
      // 매입처 필터
      if (params.supplier) {
        if (row[cols['매입처']] !== params.supplier) return false;
      }
      
      return true;
    });
    
    // 배열을 객체로 변환
    var orders = filtered.map(function(row) {
      var obj = {};
      header.forEach(function(h, idx) {
        obj[h] = row[idx];
      });
      return obj;
    });
    
    return {
      success: true,
      orders: orders,
      total: orders.length
    };
    
  } catch (err) {
    Logger.log('[getOrderList Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * ============================================================
 * 발주 상세 조회
 * ============================================================
 */
function getOrderDetail(orderId) {
  try {
    if (!orderId) {
      return {
        success: false,
        error: '발주번호가 필요합니다.'
      };
    }
    
    var sheet = getOrderMergedSheet();
    var data = sheet.getDataRange().getValues();
    
    var header = data[0];
    var rows = data.slice(1);
    
    var colOrderCode = header.indexOf('발주번호');
    
    // 발주번호로 검색
    var matchedRows = [];
    rows.forEach(function(row, idx) {
      if (row[colOrderCode] === orderId) {
        var obj = { _rowIndex: idx + 2 }; // 시트 행 번호 (1-based + header)
        header.forEach(function(h, i) {
          obj[h] = row[i];
        });
        matchedRows.push(obj);
      }
    });
    
    if (matchedRows.length === 0) {
      return {
        success: false,
        error: '해당 발주를 찾을 수 없습니다.'
      };
    }
    
    return {
      success: true,
      orderItems: matchedRows
    };
    
  } catch (err) {
    Logger.log('[getOrderDetail Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * 발주 상세 조회 (클라이언트용 래퍼)
 */
function getOrderDetailApi(orderId) {
  var result = getOrderDetail(orderId);
  return safeReturn(result);
}

/**
 * ============================================================
 * 발주 상태 업데이트 (4개 상태 모두 지원)
 * ============================================================
 * @param {string} orderId - 발주번호
 * @param {Object|string} statuses - 상태 객체 또는 단일 출고상태
 *   { buyOrder: '발주완료', payBuy: '결제완료', paySell: '미결제', ship: '미출고' }
 */
function updateOrderStatus(orderId, statuses) {
  try {
    if (!orderId) {
      return {
        success: false,
        error: '발주번호가 필요합니다.'
      };
    }

    // 하위 호환: 문자열로 전달된 경우 출고 상태로 처리
    if (typeof statuses === 'string') {
      statuses = { ship: statuses };
    }

    if (!statuses || Object.keys(statuses).length === 0) {
      return {
        success: false,
        error: '업데이트할 상태가 없습니다.'
      };
    }

    var sheet = getOrderMergedSheet();
    var data = sheet.getDataRange().getValues();

    var header = data[0];
    var colOrderCode = header.indexOf('발주번호');

    // 상태 컬럼 매핑
    var colMap = {
      buyOrder: header.indexOf('매입발주'),
      payBuy: header.indexOf('매입결제'),
      paySell: header.indexOf('매출결제'),
      ship: header.indexOf('출고')
    };

    var updated = 0;

    for (var i = 1; i < data.length; i++) {
      if (data[i][colOrderCode] === orderId) {
        // 각 상태 업데이트
        for (var key in statuses) {
          if (statuses.hasOwnProperty(key) && colMap[key] >= 0) {
            sheet.getRange(i + 1, colMap[key] + 1).setValue(statuses[key]);
          }
        }
        updated++;
      }
    }

    Logger.log('[updateOrderStatus] 발주번호: ' + orderId + ', 업데이트: ' + updated + '건, 상태: ' + JSON.stringify(statuses));

    return {
      success: true,
      updated: updated
    };

  } catch (err) {
    Logger.log('[updateOrderStatus Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * ============================================================
 * 발주 삭제 (실제로는 상태 변경)
 * ============================================================
 */
function deleteOrder(orderId) {
  try {
    if (!orderId) {
      return {
        success: false,
        error: '발주번호가 필요합니다.'
      };
    }
    
    var sheet = getOrderMergedSheet();
    var data = sheet.getDataRange().getValues();
    
    var header = data[0];
    var colOrderCode = header.indexOf('발주번호');
    
    var rowsToDelete = [];
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][colOrderCode] === orderId) {
        rowsToDelete.push(i + 1); // 시트 행 번호 (1-based)
      }
    }
    
    if (rowsToDelete.length === 0) {
      return {
        success: false,
        error: '해당 발주를 찾을 수 없습니다.'
      };
    }
    
    // 역순으로 삭제 (뒤에서부터 삭제해야 인덱스가 안 꼬임)
    rowsToDelete.sort(function(a, b) { return b - a; });
    
    rowsToDelete.forEach(function(rowNum) {
      sheet.deleteRow(rowNum);
    });
    
    return {
      success: true,
      deleted: rowsToDelete.length
    };
    
  } catch (err) {
    Logger.log('[deleteOrder Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * ============================================================
 * 거래처 목록 (발주처 필터링)
 * ============================================================
 * 거래처DB에서 '주거래처' 컬럼이 '발주처'인 거래처만 반환
 * @returns {Object} {success, data: Array<string>, customers: Array<string>}
 */
function getCustomers() {
  try {
    var data = getSuppliers();

    var header = data.header || [];
    var rows = data.rows || [];

    var nameIdx = header.indexOf('거래처명');
    var mainTypeIdx = header.indexOf('주거래처');

    if (nameIdx < 0) {
      return {
        success: false,
        error: '거래처명 컬럼을 찾을 수 없습니다.',
        data: []
      };
    }

    var seen = {};
    var customers = [];

    rows.forEach(function(row) {
      var name = String(row[nameIdx] || '').trim();
      var mainType = mainTypeIdx >= 0 ? String(row[mainTypeIdx] || '').trim() : '';

      // '발주처'가 포함된 거래처만 선택 (컬럼이 없으면 전체 허용)
      var isOrderPartner = mainTypeIdx < 0 || mainType.indexOf('발주처') >= 0;

      if (name && isOrderPartner && !seen[name]) {
        customers.push(name);
        seen[name] = true;
      }
    });

    return {
      success: true,
      data: customers,
      customers: customers,
      header: header,
      rows: rows
    };

  } catch (err) {
    Logger.log('[getCustomers Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * ============================================================
 * 품목 목록
 * ============================================================
 */
function getProductsApi() {
  try {
    var data = getProducts();
    
    var products = data.rows.map(function(row) {
      var obj = {};
      data.header.forEach(function(h, idx) {
        obj[h] = row[idx];
      });
      return obj;
    });
    
    return {
      success: true,
      products: products
    };
    
  } catch (err) {
    Logger.log('[getProductsApi Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * ============================================================
 * 출력용 발주 데이터 조회 (내부 로직)
 * ============================================================
 */
function getPrintableOrders(params) {
  try {
    params = params || {};

    var sheet = getOrderMergedSheet();
    var data = sheet.getDataRange().getValues();

    if (!data || data.length <= 1) {
      return {
        success: true,
        orders: [],
        totalCount: 0,
        params: params
      };
    }

    var header = data[0];
    var rows = data.slice(1);

    // 컬럼 인덱스 매핑
    var idx = {};
    for (var i = 0; i < header.length; i++) {
      idx[header[i]] = i;
    }

    function col(name) {
      return idx.hasOwnProperty(name) ? idx[name] : -1;
    }

    var cOrderDate = col('발주일');
    var cOrderCode = col('발주번호');
    var cSupplier  = col('매입처');
    var cBrand     = col('브랜드');
    var cBuyer     = col('발주처');
    var cPurchaseAmount = col('매입액');
    var cSupplyAmount   = col('공급액');
    // 상태 컬럼
    var cBuyOrder = col('매입발주');
    var cPayBuy   = col('매입결제');
    var cPaySell  = col('매출결제');
    var cShip     = col('출고');

    // ---- 필터링 ----
    var filtered = rows.filter(function (row) {

      // 발주번호
      if (params.orderCode) {
        if (!String(row[cOrderCode]).includes(params.orderCode)) return false;
      }

      // 기간
      if (params.startDate && cOrderDate >= 0) {
        var d = new Date(row[cOrderDate]);
        var sd = new Date(params.startDate);
        if (d < sd) return false;
      }
      if (params.endDate && cOrderDate >= 0) {
        var d = new Date(row[cOrderDate]);
        var ed = new Date(params.endDate);
        if (d > ed) return false;
      }

      // 매입처
      if (params.supplier) {
        if (!String(row[cSupplier]).includes(params.supplier)) return false;
      }

      return true;
    });

    // 발주번호별로 그룹핑
    var orderGroups = {};
    
    for (var i = 0; i < filtered.length; i++) {
      var row = filtered[i];
      var orderCode = String(row[cOrderCode]);
      
      if (!orderGroups[orderCode]) {
        orderGroups[orderCode] = {
          orderDate: row[cOrderDate],
          orderCode: orderCode,
          brand: row[cBrand] || '',
          supplier: row[cSupplier] || '',
          buyer: row[cBuyer] || '',
          itemCount: 0,
          totalPurchaseAmount: 0,
          totalAmount: 0,
          // 상태 정보
          buyOrder: cBuyOrder >= 0 ? (row[cBuyOrder] || '') : '',
          payBuy: cPayBuy >= 0 ? (row[cPayBuy] || '') : '',
          paySell: cPaySell >= 0 ? (row[cPaySell] || '') : '',
          ship: cShip >= 0 ? (row[cShip] || '') : ''
        };
      }
      
      // 품목 수 증가
      orderGroups[orderCode].itemCount++;
      
      // 매입액 합계
      if (cPurchaseAmount >= 0) {
        orderGroups[orderCode].totalPurchaseAmount += Number(row[cPurchaseAmount] || 0);
      }
      
      // 공급액 합계
      if (cSupplyAmount >= 0) {
        orderGroups[orderCode].totalAmount += Number(row[cSupplyAmount] || 0);
      }
    }

    // 객체를 배열로 변환
    var results = [];
    for (var code in orderGroups) {
      results.push(orderGroups[code]);
    }

    return {
      success: true,
      totalCount: results.length,
      orders: results,
      params: params
    };

  } catch (err) {
    Logger.log('[getPrintableOrders Error] ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * ============================================================
 * Transaction API (거래원장 관리)
 * ============================================================
 */

/**
 * 확정수량 업데이트 및 금액 자동 재계산
 */
function updateConfirmedQuantitiesApi(params) {
  var result = updateConfirmedQuantities(params);
  return safeReturn(result);
}

/**
 * 발주 상태 업데이트
 */
function updateTransactionStateApi(params) {
  var result = updateTransactionState(params);
  return safeReturn(result);
}

/**
 * 거래원장 조회
 */
function getTransactionsApi(params) {
  var result = getTransactions(params);
  return safeReturn(result);
}

/**
 * ============================================================
 * 회계 마감 API (클라이언트용 래퍼)
 * ============================================================
 */

/**
 * 매입 데이터 집계
 */
function aggregatePurchaseOrdersApi(params) {
  var result = aggregatePurchaseOrders(params);
  return safeReturn(result);
}

/**
 * 매출 데이터 집계
 */
function aggregateSalesOrdersApi(params) {
  var result = aggregateSalesOrders(params);
  return safeReturn(result);
}

/**
 * 매입 마감 저장
 */
function savePurchaseSettlementApi(params) {
  var result = savePurchaseSettlement(params);
  return safeReturn(result);
}

/**
 * 매출 마감 저장
 */
function saveSalesSettlementApi(params) {
  var result = saveSalesSettlement(params);
  return safeReturn(result);
}

/**
 * 매입 마감 목록 조회
 */
function getPurchaseSettlementsApi(params) {
  var result = getPurchaseSettlements(params);
  return safeReturn(result);
}

/**
 * 매출 마감 목록 조회
 */
function getSalesSettlementsApi(params) {
  var result = getSalesSettlements(params);
  return safeReturn(result);
}

/**
 * 마감 상세 조회
 */
function getSettlementDetailApi(params) {
  var result = getSettlementDetail(params);
  return safeReturn(result);
}

/**
 * ============================================================
 * 청구서 관리 API (InvoiceService)
 * ============================================================
 */

/**
 * 청구서용 데이터 집계
 */
function aggregateInvoiceDataApi(params) {
  var result = aggregateInvoiceData(params);
  return safeReturn(result);
}

/**
 * Settlement 기반 청구서 생성 (Track B)
 */
function createInvoiceFromSettlementApi(params) {
  var result = createInvoiceFromSettlement(params);
  return safeReturn(result);
}

/**
 * 발주번호 기반 직접 청구서 생성 (Track A - Fast Path)
 * @param {Object} params - { orderNumbers, type, company, invoiceDate, notes }
 */
function createDirectBillingApi(params) {
  var result = createInvoiceFromSettlement(params);
  return safeReturn(result);
}

/**
 * 발주번호에 대한 청구서 존재 여부 확인
 */
function checkInvoiceExistsApi(params) {
  var result = checkInvoiceExists(params);
  return safeReturn(result);
}

/**
 * 청구서 목록 조회
 */
function getInvoicesApi(params) {
  var result = getInvoices(params);
  return safeReturn(result);
}

/**
 * 청구서 상태 업데이트
 */
function updateInvoiceStatusApi(params) {
  var result = updateInvoiceStatus(params);
  return safeReturn(result);
}

/**
 * 청구서 재출력 (PDF 재생성)
 */
function reprintInvoiceApi(params) {
  var result = reprintInvoice(params);
  return safeReturn(result);
}

/**
 * ============================================================
 * 하위 호환성을 위한 Deprecated API (곧 제거 예정)
 * ============================================================
 */

/**
 * @deprecated aggregateInvoiceDataApi 사용 권장
 */
function aggregateBillingDataApi(params) {
  return aggregateInvoiceDataApi(params);
}

/**
 * @deprecated createInvoiceFromSettlementApi 사용 권장
 */
function createBillingApi(params) {
  return createInvoiceFromSettlementApi(params);
}

/**
 * @deprecated getInvoicesApi 사용 권장
 */
function getBillingsApi(params) {
  return getInvoicesApi(params);
}

/**
 * @deprecated updateInvoiceStatusApi 사용 권장
 */
function updateBillingStatusApi(params) {
  return updateInvoiceStatusApi(params);
}

/**
 * ============================================================
 * 월별 마감 API (Phase 2)
 * ============================================================
 */

/**
 * 월별 마감 실행
 */
function executeMonthlyClosingApi(params) {
  var result = executeMonthlyClosing(params);
  return safeReturn(result);
}

/**
 * 월별 마감 해제
 */
function unlockMonthlyClosingApi(params) {
  var result = unlockMonthlyClosing(params);
  return safeReturn(result);
}

/**
 * 월별 마감 목록 조회
 */
function getMonthlyClosingsApi() {
  var result = getMonthlyClosings();
  return safeReturn(result);
}