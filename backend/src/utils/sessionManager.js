/**
 * 세션 관리 유틸리티
 * - 메모리 기반 세션 저장소
 * - 향후 Redis로 쉽게 전환 가능한 인터페이스 제공
 */

// 세션 저장소 (In-Memory)
const sessions = new Map();

// 세션 유효 시간 (24시간, ms)
const SESSION_TTL = 24 * 60 * 60 * 1000;

/**
 * 새 세션 생성
 */
function createSession(sessionId, initialData = {}) {
  const session = {
    id: sessionId,
    messages: [],
    stage: 'greeting',
    recommendedSpot: null,
    currentLocation: null,
    strikeCount: 0,
    terminated: false,
    userName: null,
    conversationTurns: 0,
    lastSuggestionIndex: -1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...initialData
  };

  sessions.set(sessionId, session);
  return session;
}

/**
 * 세션 조회 (없으면 생성)
 */
function getOrCreateSession(sessionId, userName = '') {
  if (!sessions.has(sessionId)) {
    return createSession(sessionId, { userName: userName.trim() || null });
  }

  const session = sessions.get(sessionId);

  // 이름이 없었는데 새로 들어온 경우 업데이트
  if (userName && !session.userName) {
    session.userName = userName.trim();
  }

  session.updatedAt = new Date();
  return session;
}

/**
 * 세션 조회 (없으면 null 반환)
 */
function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

/**
 * 세션 업데이트
 */
function updateSession(sessionId, updates) {
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }

  Object.assign(session, updates, { updatedAt: new Date() });
  return session;
}

/**
 * 세션 삭제
 */
function deleteSession(sessionId) {
  return sessions.delete(sessionId);
}

/**
 * 모든 세션 조회
 */
function getAllSessions() {
  return Array.from(sessions.values());
}

/**
 * 만료된 세션 정리 (24시간 초과)
 */
function cleanupExpiredSessions() {
  const now = new Date();
  let cleanedCount = 0;

  sessions.forEach((session, sessionId) => {
    const age = now - session.createdAt;
    if (age > SESSION_TTL) {
      sessions.delete(sessionId);
      cleanedCount++;
    }
  });

  if (cleanedCount > 0) {
    console.log(`[세션 정리] ${cleanedCount}개의 만료된 세션을 삭제했습니다.`);
  }

  return cleanedCount;
}

/**
 * 세션 메시지 추가
 */
function addMessage(sessionId, role, content) {
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }

  session.messages.push({
    role,
    content,
    timestamp: new Date()
  });

  // 메시지 히스토리 제한 (최대 20개)
  if (session.messages.length > 20) {
    session.messages = session.messages.slice(-20);
  }

  session.updatedAt = new Date();
  return session;
}

/**
 * 세션 통계 조회
 */
function getStats() {
  return {
    totalSessions: sessions.size,
    activeSessions: getAllSessions().filter(s => !s.terminated).length,
    terminatedSessions: getAllSessions().filter(s => s.terminated).length,
  };
}

// 1시간마다 만료된 세션 자동 정리
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

module.exports = {
  createSession,
  getOrCreateSession,
  getSession,
  updateSession,
  deleteSession,
  getAllSessions,
  cleanupExpiredSessions,
  addMessage,
  getStats,
};
