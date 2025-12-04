# OneBridge ERP v2 – Service Architecture (Backend & Frontend)

## 0. 목표 & 전체 방향

### 0.1 목표

원브릿지 ERP는 유통사가 운영하는 다음 전체 프로세스를 **단일 시스템**으로 일관되게 처리하도록 설계된다:

- 발주
- 확정
- 입고 / 출고
- 마감(정산)
- 청구
- 결제
- 회계
- 조정(Adjustment)

핵심 방향은 단순한 “기록 ERP”가 아니라  
**시스템이 계산·검증·제안·알림까지 수행하는 지능형 ERP 구축**이다.

### 0.2 기술 스택

- **Frontend / WebApp**
  - Google Apps Script (HTMLService, SSR + Partial SPA)
  - Vanilla JS, Tailwind-like CSS

- **Backend / Service Layer**
  - Google Apps Script 서비스 모듈
  - Google Sheets (운영 DB)
  - (Optional) MySQL `onebridge_erp` 스키마

- **Integration**
  - Gmail / Google Drive
  - 은행 CSV 업로드 매칭

---

## 1. 도메인 레이어 구조 (Logical Data Layers)

1. **Transaction Layer (거래원장)**  
2. **Settlement Layer (마감)**  
3. **Invoice Layer (청구)**  
4. **Payment Layer (입출금)**  
5. **Adjustment Layer (조정)**  
6. **Inventory Layer (재고)**  
7. **Master Data Layer (마스터)**  

---

## 2. 백엔드 아키텍처

(이하 생략 — 실제 대화 내용 기준 전체 아키텍처 문서 포함)
