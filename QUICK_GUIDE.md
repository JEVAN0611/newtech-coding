# 🚀 대구-대구 프로젝트 실행 가이드

## ✅ 개선 완료 (실용성 중심)

### 변경사항 요약
- ✅ CORS 완전 개방 (모든 도메인 허용)
- ✅ Rate Limiting 완화 (개발 모드에서는 비활성화)
- ✅ 로거 제거 (기존 console.log 사용)
- ✅ 환경 변수 관리 개선
- ✅ 유틸리티 모듈 추가 (선택적 사용 가능)

---

## 📦 실행 방법

### 1. 환경 설정 (최초 1회)

```bash
# Backend 환경 변수 설정
cd backend
cp .env.example .env
# .env 파일을 열어서 OPENAI_API_KEY를 실제 값으로 변경

# Frontend 환경 변수 (이미 생성됨)
cd ../frontend
cat .env  # 확인만
```

### 2. 서버 실행

```bash
# Backend 서버 시작 (터미널 1)
cd backend
npm start

# Frontend 서버 시작 (터미널 2)
cd frontend
npm start
```

### 3. 접속

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

---

## 🔧 주요 개선사항

### 보안 설정 완화 (개발/테스트 편의성)

#### CORS
```javascript
// 이전: 특정 도메인만 허용
// 현재: 모든 도메인 허용
app.use(cors());
```

#### Rate Limiting
```javascript
// 개발 모드: 완전히 비활성화
// 프로덕션 모드: 1분당 1000개 요청 허용
```

### 에러 처리
```javascript
// 간단한 console.error 사용
catch (error) {
  console.error("API 에러:", error);
  res.status(500).json({ error: "..." });
}
```

---

## 📂 새로 추가된 파일 (선택적 사용)

### Backend 유틸리티
```
backend/src/utils/
├── logger.js           # 파일 로깅 (선택사항)
├── sessionManager.js   # 세션 관리 헬퍼 (선택사항)
└── emotionAnalyzer.js  # 감정 분석 헬퍼 (선택사항)
```

### Frontend 구조 개선
```
frontend/src/
├── config/constants.js  # 상수 중앙 관리 (선택사항)
└── services/api.js      # API 호출 래퍼 (선택사항)
```

**참고**: 이 파일들은 향후 확장성을 위해 준비된 것이며, 현재는 기존 코드가 그대로 동작합니다.

---

## 🐛 문제 해결

### 포트 3001이 이미 사용 중
```bash
# macOS/Linux
lsof -ti:3001 | xargs kill -9

# Windows
netstat -ano | findstr :3001
taskkill /PID [PID번호] /F
```

### OpenAI API 키 오류
```bash
# .env 파일 확인
cat backend/.env

# OPENAI_API_KEY가 올바른지 확인
# OPENAI_API_KEY=sk-proj-...
```

### CORS 에러
- 이미 모든 도메인이 허용되어 있으므로 발생하지 않아야 함
- 여전히 발생하면 브라우저 캐시 삭제 후 재시도

### Rate Limit 에러
- 개발 모드에서는 발생하지 않음
- NODE_ENV=development가 설정되어 있는지 확인

---

## 📊 현재 설정

| 항목 | 설정 |
|------|------|
| **CORS** | 모든 도메인 허용 |
| **Rate Limiting** | 개발 모드: 비활성화<br>프로덕션: 1분/1000요청 |
| **로깅** | console.log/error |
| **환경** | development (기본값) |
| **포트** | Backend: 3001<br>Frontend: 3000 |

---

## 💡 팁

### 개발 중 빠른 재시작
```bash
# Backend
cd backend
npm start

# 변경사항 저장 시 수동으로 재시작 필요
# (nodemon 설치하면 자동 재시작 가능)
```

### 로그 확인
```bash
# Backend 콘솔에서 실시간 확인
# 또는 선택적으로 파일 로그 사용 가능
tail -f backend/logs/combined.log  # (logger 사용 시)
```

### API 테스트
```bash
# 서버 상태 확인
curl http://localhost:3001/api/test

# 채팅 테스트
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"안녕"}'
```

---

## 🎯 핵심 변경사항 요약

### ✅ 개발 편의성 개선
- CORS 제한 제거
- Rate Limiting 완화/비활성화
- 복잡한 로거 제거 → 간단한 console 사용

### ✅ 코드 구조 개선 (선택사항)
- 유틸리티 모듈 추가 (향후 확장용)
- 상수 중앙 관리
- API 서비스 레이어

### ✅ 환경 관리
- .env 파일 템플릿 제공
- .gitignore 강화
- 환경별 설정 분리

---

## 📝 추가 작업이 필요한 경우

### Frontend 의존성 보안 업데이트 (선택사항)
```bash
cd frontend
npm audit fix
```

### 기존 코드는 모두 정상 동작
- aiService.js: 그대로 유지
- ChatInterface.js: 그대로 유지
- 모든 기존 기능: 정상 작동

---

**업데이트**: 2025년 11월 18일
**목적**: 개발/테스트 편의성 향상, 오류 최소화
