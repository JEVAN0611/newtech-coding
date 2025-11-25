import { API_BASE_URL } from '../config/constants';

/**
 * API 호출 래퍼 함수
 */
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `API 에러: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`API 호출 실패 [${endpoint}]:`, error);
    throw error;
  }
}

/**
 * 채팅 메시지 전송
 */
export async function sendChatMessage(message, sessionId, userName = '') {
  return fetchAPI('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, sessionId, userName }),
  });
}

/**
 * 새 대화 시작
 */
export async function startNewChat() {
  return fetchAPI('/api/chat/new', {
    method: 'POST',
  });
}

/**
 * 세션 초기화
 */
export async function resetChatSession(sessionId) {
  return fetchAPI(`/api/chat/${sessionId}`, {
    method: 'DELETE',
  });
}

/**
 * 세션 정보 조회
 */
export async function getSessionInfo(sessionId) {
  return fetchAPI(`/api/chat/${sessionId}/info`);
}

/**
 * 모든 명소 정보 조회
 */
export async function getAllSpots() {
  return fetchAPI('/api/spots');
}

/**
 * 특정 명소 정보 조회
 */
export async function getSpotInfo(spotId) {
  return fetchAPI(`/api/spots/${spotId}`);
}

/**
 * 명소 방문 처리
 */
export async function visitSpot(spotId, sessionId) {
  return fetchAPI(`/api/spots/${spotId}/visit`, {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

/**
 * 명소 도착 처리
 */
export async function arriveAtSpot(spotId, sessionId) {
  return fetchAPI(`/api/spots/${spotId}/arrive`, {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}
