# 🚀 Railway 배포 가이드

대구 여행 가이드 웹툰 프로젝트를 Railway에 배포하는 방법입니다.

---

## 📋 사전 준비

1. **OpenAI API 키** 준비
   - https://platform.openai.com/api-keys
   - GPT-3.5-turbo 사용 가능한 키 필요

2. **GitHub 계정** 준비
   - 코드를 GitHub 저장소에 푸시해야 함

3. **Railway 계정** 생성
   - https://railway.app
   - GitHub 계정으로 가입 가능

---

## 🎯 배포 순서

### 1단계: GitHub에 코드 푸시

```bash
# Git 상태 확인
git status

# 모든 변경사항 추가
git add .

# 커밋
git commit -m "feat: Railway 배포 설정 추가"

# 푸시 (원격 저장소가 없으면 먼저 생성)
git push origin main
```

---

### 2단계: Railway 프로젝트 생성

1. **Railway 접속**: https://railway.app
2. **New Project** 클릭
3. **Deploy from GitHub repo** 선택
4. 저장소 선택 (없으면 GitHub 연동 필요)

---

### 3단계: 백엔드 서비스 배포

#### 3-1. 서비스 추가
- **New** → **Empty Service** 클릭
- 서비스 이름: `backend`

#### 3-2. 설정
- **Settings** → **Source**
- **Root Directory**: `backend`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

#### 3-3. 환경변수 설정
**Settings** → **Variables**에서 다음 추가:

```env
NODE_ENV=production
PORT=3001
OPENAI_API_KEY=여기에_OpenAI_API_키_입력
ENABLE_SAFETY=true
ALLOWED_ORIGINS=https://프론트엔드주소.railway.app
```

> **중요**: `ALLOWED_ORIGINS`는 프론트엔드 배포 후 나온 URL로 업데이트

#### 3-4. 배포 확인
- **Deployments** 탭에서 배포 로그 확인
- 배포 완료 후 **Settings** → **Domains**에서 URL 복사
  - 예: `https://backend-production-xxxx.up.railway.app`

---

### 4단계: 프론트엔드 서비스 배포

#### 4-1. 서비스 추가
- **New** → **Empty Service** 클릭
- 서비스 이름: `frontend`

#### 4-2. 설정
- **Settings** → **Source**
- **Root Directory**: `frontend`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npx serve -s build -l $PORT`

#### 4-3. 환경변수 설정
**Settings** → **Variables**에서 다음 추가:

```env
REACT_APP_API_URL=https://백엔드주소.railway.app
NODE_ENV=production
```

> **중요**: `REACT_APP_API_URL`은 백엔드 URL로 설정

#### 4-4. 배포 확인
- **Deployments** 탭에서 배포 로그 확인
- 배포 완료 후 **Settings** → **Domains**에서 URL 복사
  - 예: `https://frontend-production-xxxx.up.railway.app`

---

### 5단계: CORS 설정 업데이트

프론트엔드 URL이 확정되면:

1. **백엔드 서비스** → **Variables**
2. `ALLOWED_ORIGINS` 값 업데이트:
   ```
   https://프론트엔드주소.railway.app
   ```
3. 저장 후 자동 재배포 대기

---

## ✅ 배포 완료 확인

### 백엔드 테스트
```bash
curl https://백엔드주소.railway.app/api/test
```

**예상 응답:**
```json
{
  "message": "대구 웹툰 API 서버 작동중! 🎭",
  "character": "대구-대구가 인사해요!"
}
```

### 프론트엔드 테스트
1. 브라우저에서 프론트엔드 URL 접속
2. 대구-대구와 대화 시도
3. 장소 추천 → 웹툰 전환 확인

---

## 🔧 문제 해결

### 1. 백엔드 배포 실패
- **원인**: OpenAI API 키 오류
- **해결**: Variables에서 `OPENAI_API_KEY` 확인

### 2. CORS 에러
- **원인**: `ALLOWED_ORIGINS` 설정 오류
- **해결**: 프론트엔드 전체 URL 입력 (https:// 포함)

### 3. 프론트엔드 빈 화면
- **원인**: `REACT_APP_API_URL` 설정 오류
- **해결**: 백엔드 전체 URL 입력 후 재배포

### 4. 대화 기록 사라짐
- **원인**: 서버 재시작 (메모리 기반 세션)
- **해결**: 정상 동작 (향후 Redis로 개선 가능)

---

## 💰 비용 안내

### Railway 무료 플랜
- **월 $5 크레딧** 제공
- 소규모 프로젝트에 충분
- 크레딧 소진 시 자동 중지

### 예상 사용량
- **백엔드**: ~$3-4/월
- **프론트엔드**: ~$1/월
- **총 예상**: ~$5/월 (무료 범위 내)

---

## 📚 추가 정보

### 로그 확인
- Railway Dashboard → 서비스 선택 → **Logs** 탭

### 재배포
- 코드 변경 후 GitHub 푸시 → 자동 재배포
- 수동 재배포: **Deployments** → **Redeploy**

### 환경변수 변경
- **Variables** 탭에서 수정 → 자동 재배포

---

## 🎉 완료!

이제 웹사이트가 24시간 운영됩니다!

- **프론트엔드**: https://프론트엔드주소.railway.app
- **백엔드**: https://백엔드주소.railway.app

친구들과 공유해보세요! 🚀
