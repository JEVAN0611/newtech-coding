const express = require("express");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");

// .env 파일 경로를 명시적으로 지정 (현재 파일 위치 기준)
require("dotenv").config({ path: path.join(__dirname, ".env") });

// 환경 변수 로드 확인
const NODE_ENV = process.env.NODE_ENV || 'development';
if (!process.env.OPENAI_API_KEY) {
  console.error("⚠️  경고: OPENAI_API_KEY가 로드되지 않았습니다!");
  console.error("   .env 파일 위치:", path.join(__dirname, ".env"));
} else {
  // 프로덕션에서는 키 존재 여부만 확인 (보안)
  if (NODE_ENV === 'development') {
    console.log("✅ OpenAI API 키 로드 성공");
  }
}

const routes = require("./routes");

const app = express();
const PORT = process.env.PORT || 3001;

// CORS 설정
const corsOptions = {
  origin: function (origin, callback) {
    // 개발 모드에서는 모든 origin 허용
    if (NODE_ENV === 'development') {
      callback(null, true);
      return;
    }

    // 프로덕션: 환경변수에서 허용된 도메인 가져오기
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : [];

    // origin이 없는 경우 (모바일 앱, Postman 등) 허용
    if (!origin) {
      callback(null, true);
      return;
    }

    // 허용된 도메인 체크
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`❌ CORS 차단: ${origin}`);
      callback(new Error('CORS 정책에 의해 차단되었습니다.'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// JSON 파싱 (크기 제한)
app.use(express.json({ limit: '10mb' }));

// Rate Limiting (매우 완화된 설정 - 개발/테스트용)
// 개발 모드에서는 비활성화, 프로덕션에서도 넉넉하게 설정
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1분
  max: 1000, // 최대 1000개 요청
  message: {
    success: false,
    error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
  },
  skip: () => NODE_ENV === 'development', // 개발 모드에서는 스킵
});

// 프로덕션에서만 Rate Limiting 적용
if (NODE_ENV === 'production') {
  app.use('/api/', apiLimiter);
}

app.use(routes);

// 테스트 API (기존 유지)
app.get("/api/test", (req, res) => {
  res.json({
    message: "대구 웹툰 API 서버 작동중! 🎭",
    character: "대구-대구가 인사해요!",
  });
});

// Health Check 엔드포인트 (Keep-alive용)
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 에러 핸들러
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "요청한 페이지를 찾을 수 없습니다."
  });
});

// 전역 에러 핸들러 (간단 버전)
app.use((err, req, res, next) => {
  console.error('서버 에러:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "서버 오류가 발생했습니다."
  });
});

app.listen(PORT, () => {
  console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행중입니다`);
  console.log(`📝 환경: ${NODE_ENV}`);
});
