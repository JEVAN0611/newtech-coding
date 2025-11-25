const fs = require('fs');
const path = require('path');

// 로그 레벨 정의
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// 환경 변수에서 로그 레벨 가져오기
const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

// 로그 디렉토리 생성
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 로그 파일 경로
const errorLogPath = path.join(logDir, 'error.log');
const combinedLogPath = path.join(logDir, 'combined.log');

/**
 * 타임스탬프 생성
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * 로그 메시지 포맷팅
 */
function formatMessage(level, message, meta = {}) {
  const timestamp = getTimestamp();
  const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message} ${metaStr}\n`;
}

/**
 * 파일에 로그 작성
 */
function writeToFile(filePath, message) {
  try {
    fs.appendFileSync(filePath, message);
  } catch (error) {
    console.error('로그 파일 쓰기 실패:', error);
  }
}

/**
 * 로그 출력 함수
 */
function log(level, message, meta = {}) {
  if (LOG_LEVELS[level] > currentLogLevel) {
    return; // 현재 로그 레벨보다 낮으면 무시
  }

  const formattedMessage = formatMessage(level, message, meta);

  // 콘솔 출력 (개발 환경에서만)
  if (process.env.NODE_ENV !== 'production') {
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](formattedMessage.trim());
  }

  // 파일 기록
  writeToFile(combinedLogPath, formattedMessage);
  if (level === 'error') {
    writeToFile(errorLogPath, formattedMessage);
  }
}

/**
 * 에러 객체를 로그용으로 직렬화
 */
function serializeError(error) {
  return {
    message: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code
  };
}

// Logger 객체
const logger = {
  error: (message, meta = {}) => {
    // Error 객체인 경우 직렬화
    if (meta instanceof Error) {
      meta = serializeError(meta);
    }
    log('error', message, meta);
  },

  warn: (message, meta = {}) => {
    log('warn', message, meta);
  },

  info: (message, meta = {}) => {
    log('info', message, meta);
  },

  debug: (message, meta = {}) => {
    log('debug', message, meta);
  },

  // Express 에러 핸들러용 미들웨어
  errorHandler: (err, req, res, next) => {
    logger.error('Express 에러 발생', {
      error: serializeError(err),
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // 클라이언트에게는 간단한 메시지만 전송
    res.status(err.status || 500).json({
      success: false,
      error: process.env.NODE_ENV === 'production'
        ? '서버 오류가 발생했습니다.'
        : err.message
    });
  }
};

module.exports = logger;
