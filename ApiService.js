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
 * ============================================================
 * 발주 상태 업데이트
 * ============================================================
 */
function updateOrderStatus(orderId, status) {
  try {
    if (!orderId || !status) {
      return {
        success: false,
        error: '발주번호와 상태가 필요합니다.'
      };
    }
    
    var sheet = getOrderMergedSheet();
    var data = sheet.getDataRange().getValues();
    
    var header = data[0];
    var colOrderCode = header.indexOf('발주번호');
    var colStatus = header.indexOf('출고'); // 또는 다른 상태 컬럼
    
    if (colStatus < 0) {
      return {
        success: false,
        error: '상태 컬럼을 찾을 수 없습니다.'
      };
    }
    
    var updated = 0;
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][colOrderCode] === orderId) {
        sheet.getRange(i + 1, colStatus + 1).setValue(status);
        updated++;
      }
    }
    
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
 * 거래처 목록 (발주처 + 매입처)
 * ============================================================
 */
function getCustomers() {
  try {
    var data = getSuppliers();
    
    var customers = data.rows.map(function(row) {
      var obj = {};
      data.header.forEach(function(h, idx) {
        obj[h] = row[idx];
      });
      return obj;
    });
    
    return {
      success: true,
      customers: customers
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
          totalAmount: 0
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
 * ============================================================
 * 청구서 관리 API (Phase 2)
 * ============================================================
 */

/**
 * 청구서 생성
 */
function createBillingApi(params) {
  var result = createBilling(params);
  return safeReturn(result);
}

/**
 * 청구서 목록 조회
 */
function getBillingsApi(params) {
  var result = getBillings(params);
  return safeReturn(result);
}

/**
 * 청구서 상태 업데이트
 */
function updateBillingStatusApi(params) {
  var result = updateBillingStatus(params);
  return safeReturn(result);
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