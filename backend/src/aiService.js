require('dotenv').config();

let OpenAIClientCtor = null;
try {
  const openaiModule = require('openai');
  OpenAIClientCtor = openaiModule.OpenAI || openaiModule;
} catch (error) {
  console.warn('openai 패키지를 찾을 수 없어 스크립트 응답 모드로 동작합니다.');
}
const policy = require('./safety/policy');
const SAFETY_ENABLED = process.env.ENABLE_SAFETY === 'true';
const OPENAI_READY = Boolean(OpenAIClientCtor && process.env.OPENAI_API_KEY);
if (!OPENAI_READY) {
  console.warn('OpenAI API 키가 없거나 SDK를 로드하지 못해 scripted fallback을 사용합니다.');
}

// Lazy init OpenAI to avoid crashing server on missing key
let openaiClient = null;
function getOpenAI() {
  if (!OpenAIClientCtor || !process.env.OPENAI_API_KEY) {
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAIClientCtor({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

// 대화 세션 저장소 (실서비스에선 Redis/DB 권장)
const conversationSessions = new Map();

// 플랫폼 전역 종료 플래그 (치명적 금지어 탐지 시 전체 종료)
const platformTermination = { active: false, reason: null, at: null };

// 대구 명소 정보
const DAEGU_SPOTS = {
  dongseongro: {
    name: '동성로',
    keywords: ['쇼핑', '맛집', '번화가', '젊은', '활발', '시내'],
    description: '대구의 메인 상권으로 쇼핑과 맛집이 가득한 곳',
    transport: '지하철 1호선 중앙로역 하차',
    highlights: ['CGV 대구', '동성로 먹거리', '교보문고'],
    food: ['막창', '찜갈비', '치킨'],
    foodAreas: ['메인 거리와 골목 상권', '지하철역 주변', '영화관/백화점 인근'],
  },
  dalseong: {
    name: '달성공원',
    keywords: ['자연', '산책', '조용', '역사', '공원', '힐링'],
    description: '대구의 역사가 담긴 공원으로 산책하기 좋은 곳',
    transport: '지하철 1호선 달성공원역 하차',
    highlights: ['동물원', '향토역사관', '산책로'],
    food: ['공원 근처 한정식', '전통차'],
    foodAreas: ['공원 입구 상권', '산책로 초입 로컬 식당가', '주차장 방향 상가'],
  },
  suseongmot: {
    name: '수성못',
    keywords: ['호수', '경치', '카페', '데이트', '사진', '야경'],
    description: '아름다운 호수와 함께하는 낭만적인 장소',
    transport: '지하철 2호선 수성못역 하차',
    highlights: ['호수 둘레길', '음악분수', '카페거리'],
    food: ['카페', '이탈리안', '호수뷰 레스토랑'],
    foodAreas: ['카페거리 일대', '호수변 산책로 초입', '주차장 쪽 상권'],
  },
};

const DEFAULT_PERSONA = '';
const DAEGU_PERSONA = process.env.CHARACTER_PROMPT ?? DEFAULT_PERSONA;

function pickRandom(items = []) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

// 사용자 메시지에서 키워드 분석(간단 스코어링)
function analyzeUserPreference(message) {
  const lowerMessage = (message || '').toLowerCase();
  const scores = { dongseongro: 0, dalseong: 0, suseongmot: 0 };
  Object.keys(DAEGU_SPOTS).forEach((spotKey) => {
    const spot = DAEGU_SPOTS[spotKey];
    spot.keywords.forEach((keyword) => {
      if (lowerMessage.includes(keyword)) scores[spotKey] += 1;
    });
  });
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore > 0) return Object.keys(scores).find((k) => scores[k] === maxScore);
  return null;
}

// 첫 대화(도착 전) 응답을 3곳으로 강제 정렬
const REGEX_ESCAPE_PATTERN = /[.*+?^${}()|[\]\\]/g;

function escapeRegExp(value = '') {
  return value.replace(REGEX_ESCAPE_PATTERN, '\$&');
}

function ensureNameGreeting(text, userName = '') {
  const trimmedName = (userName || '').trim();
  if (!trimmedName) return text;
  const original = (text || '').trim();
  if (!original) return `안녕 ${trimmedName}!`;

  const escapedName = escapeRegExp(trimmedName);
  const firstSentence = original.split(/[\n.!?]/)[0] || '';
  const hasNameInOpening = new RegExp(escapedName, 'i').test(firstSentence);
  if (hasNameInOpening) return text;

  if (/^안녕/i.test(original)) {
    const rest = original.replace(/^안녕[\s!~,]*?/i, '').trim();
    return rest ? `안녕 ${trimmedName}! ${rest}` : `안녕 ${trimmedName}!`;
  }

  return `안녕 ${trimmedName}! ${original}`.trim();
}

function buildSmallTalkMessage(userName = '', { greet = false } = {}) {
  const nameCue = userName ? `${userName}, ` : '';
  if (greet) {
    const base = `대구-대구야. 오늘 대구 날씨 완전 좋다~ ${nameCue}지금 기분은 힐링 여행? 아니면 신나는 코스가 끌려?`;
    return ensureNameGreeting(base, userName);
  }
  return `대구-대구가 ${nameCue}어떤 분위기를 찾는지 궁금해! 힐링 여행? 아니면 신나는 코스가 끌려?`;
}

function ensureRecommendationCallout(text, session, userName = '') {
  if (!session || session.stage === 'arrived') return text;
  const spotKey = session.recommendedSpot;
  if (!spotKey) return text;
  const spot = DAEGU_SPOTS[spotKey];
  if (!spot) return text;
  if (typeof text === 'string' && text.includes(spot.name)) {
    return text;
  }
  const nameCue = userName ? `${userName}, ` : '';
  const highlight = summarizeList(spot.highlights, 1);
  const food = summarizeList(spot.food, 1);
  const phrases = [
    `${nameCue}${spot.name} 한 번 가볼래? ${spot.description} 느낌이야.`,
    highlight ? `${nameCue}${spot.name} 가면 ${highlight}부터 둘러볼 수 있어.` : null,
    food ? `${nameCue}${spot.name}에서 ${food}도 챙겨보자.` : null,
  ].filter(Boolean);
  const addition = pickRandom(phrases);
  if (!addition) return text;
  return text ? `${text}\n\n${addition}` : addition;
}

const FALLBACK_SPOT_ROTATION = ['dongseongro', 'suseongmot', 'dalseong'];
const POSITIVE_INTENT_REGEX = /(가자|가볼까|가볼게|출발|출발|좋아|좋지|콜|고고|ㄱㄱ|레츠고|lets go|let's go|응|그래|ㅇㅋ|ok|오케이|함께가|가줄래|go)/i;
const CHANGE_SPOT_REGEX = /(다른\s?(곳|데)|다른거|말고|바꿔|싫어|별로|change|another)/i;

function cycleFallbackSpot(session) {
  if (typeof session.lastSuggestionIndex !== 'number') {
    session.lastSuggestionIndex = -1;
  }
  session.lastSuggestionIndex =
    (session.lastSuggestionIndex + 1) % FALLBACK_SPOT_ROTATION.length;
  return FALLBACK_SPOT_ROTATION[session.lastSuggestionIndex];
}

function resolveFallbackSpot(session, userMessage, forceRotate = false) {
  if (forceRotate) {
    return cycleFallbackSpot(session);
  }
  const prefKey = analyzeUserPreference(userMessage);
  if (prefKey) return prefKey;
  if (session.recommendedSpot && DAEGU_SPOTS[session.recommendedSpot]) {
    return session.recommendedSpot;
  }
  return cycleFallbackSpot(session);
}

function summarizeList(items = [], limit = 2) {
  return (items || []).slice(0, limit).join(', ');
}

function generateFallbackResponse() {
  return {
    message: '지금은 답변을 만들지 못했어. 잠시 후 다시 시도해 줄래?',
  };
}

function sanitizeFirstChatResponse(text, userName = '', { stage = 'preference', hasRecommendation = false, recommendedKey = null } = {}) {
  if (!SAFETY_ENABLED) {
    return (text || '').trim();
  }
  const raw = (text || '').trim();
  const allowed = [DAEGU_SPOTS.dongseongro.name, DAEGU_SPOTS.dalseong.name, DAEGU_SPOTS.suseongmot.name];
  const trimmedName = (userName || '').trim();
  const recommendedSpotName = recommendedKey ? DAEGU_SPOTS[recommendedKey]?.name : null;
  const nameCallout = trimmedName ? `${trimmedName}, ` : '';
  const recommendationFallback = recommendedSpotName
    ? `${nameCallout}${recommendedSpotName} 쪽이 딱 어울릴 것 같은데, 어떤 분위기로 둘러보고 싶어?`
    : `대구에서라면 ${allowed.join(', ')} 중에 어때? 너 취향 알려주면 셋 중 딱 맞는 곳으로 안내할게!`;
  const mentionsOtherCity = policy.lists.OTHER_CITY_NAMES.some((c) => raw.toLowerCase().includes(c.toLowerCase()));

  if (stage === 'greeting') {
    if (!raw || mentionsOtherCity || allowed.some((n) => raw.includes(n))) {
      return buildSmallTalkMessage(userName, { greet: true });
    }
    let sanitizedGreeting = ensureNameGreeting(raw, userName);
    if (!/[?]/.test(sanitizedGreeting)) {
      sanitizedGreeting = `${sanitizedGreeting} 어떤 여행이 끌려?`;
    }
    if (allowed.some((n) => sanitizedGreeting.includes(n))) {
      return buildSmallTalkMessage(userName, { greet: true });
    }
    return sanitizedGreeting;
  }

  let sanitized = raw;
  if (!sanitized) {
    sanitized = hasRecommendation ? recommendationFallback : buildSmallTalkMessage(userName, { greet: false });
  }

  if (mentionsOtherCity) {
    sanitized = hasRecommendation ? recommendationFallback : buildSmallTalkMessage(userName, { greet: false });
  }

  if (hasRecommendation) {
    const hasAllowed = allowed.some((n) => sanitized.includes(n));
    return hasAllowed ? sanitized : recommendationFallback;
  }

  if (stage === 'preference') {
    if (allowed.some((n) => sanitized.includes(n))) {
      sanitized = buildSmallTalkMessage(userName, { greet: false });
    }
    if (!/[?]/.test(sanitized)) {
      sanitized = `${sanitized} 어떤 여행이 끌려?`;
    }
  }

  return sanitized;
}

// 대화 컨텍스트 관리
function getOrCreateSession(sessionId, initialName = '') {
  const trimmedName = (initialName || '').trim();
  if (!conversationSessions.has(sessionId)) {
    conversationSessions.set(sessionId, {
      id: sessionId,
      messages: [],
      stage: 'greeting', // greeting -> preference -> recommendation -> enroute -> arrived
      recommendedSpot: null,
      currentLocation: null,
      strikeCount: 0,
      terminated: false,
      createdAt: new Date(),
      userName: trimmedName || null,
      lastSuggestionIndex: -1,
    });
  }
  const session = conversationSessions.get(sessionId);
  if (trimmedName && !session.userName) {
    session.userName = trimmedName;
  }
  return session;
}

// 세션 GC (24시간 초과 시 정리)
setInterval(() => {
  const now = new Date();
  conversationSessions.forEach((session, sessionId) => {
    const hoursDiff = (now - session.createdAt) / (1000 * 60 * 60);
    if (hoursDiff > 24) conversationSessions.delete(sessionId);
  });
}, 1000 * 60 * 60);

async function chatWithDaegu(userMessage, sessionId = 'default', userName = '') {
  try {
    // 전역 종료 상태면 즉시 종료 응답
    if (platformTermination.active) {
      return { success: true, message: '', sessionId, stage: 'terminated', terminated: true, endCut: true, silent: true };
    }

    const session = getOrCreateSession(sessionId, userName);
    if (session.terminated) {
      return { success: true, message: '대화가 이미 종료되었어. 다음에 다시 만나자!', sessionId, stage: session.stage, terminated: true, endCut: true };
    }

    // 욕설/부적절 언어(치명도 낮음) — 세션 종료
    if (SAFETY_ENABLED && policy.contains_profanity(userMessage)) {
      resetSession(sessionId);
      return { success: false, message: '정책 위반으로 대화를 종료합니다.', sessionId };
    }

    // 사용자 메시지를 세션에 저장
    session.messages.push({ role: 'user', content: userMessage, timestamp: new Date() });

    const normalizedUserMessage = (userMessage || '').toLowerCase();
    const wantsDifferent = CHANGE_SPOT_REGEX.test(normalizedUserMessage);

    // 간단 취향 분석으로 추천 후보 결정 (명확할 때만)
    const prefKey = analyzeUserPreference(userMessage);
    if (prefKey && !session.currentLocation) {
      session.recommendedSpot = prefKey; // 'dongseongro' | 'dalseong' | 'suseongmot'
    }

    if (
      !session.currentLocation &&
      (!session.recommendedSpot || wantsDifferent)
    ) {
      session.recommendedSpot = resolveFallbackSpot(session, userMessage, wantsDifferent);
    }
    if (session.stage === 'preference' && session.recommendedSpot) {
      session.stage = 'recommendation';
    }

    const userIntentGo = POSITIVE_INTENT_REGEX.test(userMessage);
    if (
      session.stage !== 'arrived' &&
      session.recommendedSpot &&
      userIntentGo
    ) {
      session.stage = 'enroute';
    } else if (
      session.stage === 'preference' &&
      session.recommendedSpot
    ) {
      session.stage = 'recommendation';
    }

    // Centralized safety pre-checks
    // 치명적 금지어 → 플랫폼 전역 종료
    if (SAFETY_ENABLED && policy.contains_critical_term(userMessage)) {
      const msg = '';
      session.terminated = true;
      platformTermination.active = true;
      platformTermination.reason = 'critical_term';
      platformTermination.at = new Date();
      conversationSessions.forEach((s) => {
        s.terminated = true;
      });
      require('./safety/logger').logEvent({ type: 'terminate', scope: 'platform', reason: 'critical_term', sessionId, user_input: userMessage, response: msg });
      return { success: true, message: msg, sessionId, stage: session.stage, terminated: true, endCut: true, silent: true };
    }

    // 시스템 프롬프트 구성
    let systemMessage = DAEGU_PERSONA;
    if (SAFETY_ENABLED) {
      const safetyHeader = policy.getSystemSafetyPrompt(session, DAEGU_SPOTS);
      systemMessage = `${systemMessage}\n\n${safetyHeader}`;
    }

    const effectiveUserName = (session.userName || userName || '').trim();
    if (effectiveUserName) {
      systemMessage += `\n\n[이름 호칭 규칙]\n- 사용자를 "${effectiveUserName}"(이)라고 부르기\n- 첫 응답은 반드시 ${effectiveUserName}에게 인사하며 이름을 불러주고, 간단한 안부 후 여행 취향을 물어보기\n- 이후에도 두세 턴에 한 번씩 자연스럽게 ${effectiveUserName} 이름을 언급하기`;
    }

    if (SAFETY_ENABLED && session.stage === 'greeting') {
      const preferenceLabel = effectiveUserName ? `${effectiveUserName}의` : '사용자의';
      systemMessage += `\n\n[초기 스몰토크]\n- 첫 응답은 대구-대구가 자신을 소개하고 분위기를 전하는 가벼운 Small talk로 시작하기\n- 첫 응답에서는 명소 이름이나 추천을 바로 언급하지 말고 ${preferenceLabel} 여행 취향과 기분을 먼저 물어보기\n- ${preferenceLabel} 취향을 들은 뒤 다음 턴에 어울리는 장소를 추천하기`;
    }

    // 도착 컨텍스트 보강
    if (SAFETY_ENABLED && session.stage === 'arrived' && session.currentLocation) {
      const spot = DAEGU_SPOTS[session.currentLocation];
      systemMessage += `\n\n현재 위치: ${spot.name} (도착)\n규칙:\n- 다른 장소로 이동 제안/수락 금지 (현재 장소 먼저 권유)\n- ${spot.name} 내부 즐길거리, 동선, 맛집, 사진스팟, 소요시간 위주로 대화 유지\n- 대구 전체나 타지역 전반의 정보 제공 금지 (현재 위치에 한정)\n- 현재 위치와 무관한 주제는 부드럽게 현재 장소 이야기로 되돌리기\n- 간단한 선택지(예: 산책 코스/맛집/포토스팟)를 제안\n- 실제 상호명(가게 이름)은 언급하지 말고, 상권/부근으로 안내`;
    }

    // 음식 관련 질의: 상권 중심으로 안내
    if (SAFETY_ENABLED && policy.isFoodQuery(userMessage)) {
      const currentKey = session.currentLocation || session.recommendedSpot;
      const spot = currentKey ? DAEGU_SPOTS[currentKey] : null;
      const areaHints = spot?.foodAreas?.length ? `예: ${spot.foodAreas.join(', ')}` : '예: 메인 거리 주변, 역 근처, 골목 상권';
      systemMessage += `\n\n[맛집/음식 가이드]\n- 실제 매장 이름은 말하지 말 것\n- 상권/부근 위주로 안내 (거리, 골목, 역 주변 등)\n- 한두 문장으로 간결히 안내하고, 필요시 사용자의 취향(매운맛/가성비/분위기) 재질문\n- 참고 힌트: ${areaHints}`;
    }

    // OpenAI API 호출
    const messages = [
      { role: 'system', content: systemMessage },
      ...session.messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    ];

    const client = getOpenAI();
    let aiMessage = '';
    let completionUsage = null;
    let fallbackUsed = false;

    if (client) {
      try {
        const completion = await client.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages,
          max_tokens: 250,
          temperature: 0.8,
        });
        completionUsage = completion.usage;
        aiMessage = completion.choices?.[0]?.message?.content || '';
      } catch (error) {
        console.error('OpenAI API 에러:', error);
        fallbackUsed = true;
      }
    } else {
      fallbackUsed = true;
    }

    if (fallbackUsed || !aiMessage) {
      const fallback = generateFallbackResponse();
      aiMessage =
        fallback?.message ||
        buildSmallTalkMessage(effectiveUserName, { greet: session.stage === 'greeting' });
      fallbackUsed = true;
    }

    // 도착 상태 출력 교정 및 전역 상호명 마스킹
    if (SAFETY_ENABLED) {
      aiMessage = policy.enforceOutput({ text: aiMessage, session, spots: DAEGU_SPOTS });
    }

    // 첫 대화(도착 전): 3곳 외 언급 방지 (안전 모드에서만 실행)
    if (SAFETY_ENABLED && session.stage !== 'arrived') {
      const sanitizeStage = session.stage;
      const recommendedKey = session.recommendedSpot || null;
      const hasRecommendation = Boolean(recommendedKey);
      aiMessage = sanitizeFirstChatResponse(aiMessage, effectiveUserName, { stage: sanitizeStage, hasRecommendation, recommendedKey });
    }

    aiMessage = ensureRecommendationCallout(aiMessage, session, effectiveUserName);

    // 과도한 주제 필터링 제거: 대화 흐름 방해 방지

    // AI 응답 저장
    session.messages.push({ role: 'assistant', content: aiMessage, timestamp: new Date() });

    if (session.stage === 'greeting') {
      session.stage = 'preference';
    }

    // 로깅
    if (SAFETY_ENABLED) {
      policy.log_event(userMessage, aiMessage, 'policy_check');
    }

    // 응답 구성
    const result = {
      success: true,
      message: aiMessage,
      sessionId,
      stage: session.stage,
      usage: completionUsage,
      terminated: session.terminated === true,
      strikes: session.strikeCount,
      fallback: fallbackUsed,
    };

    // 명소 추천이 있으면 부가 정보 포함
    if (session.recommendedSpot) {
      const spot = DAEGU_SPOTS[session.recommendedSpot];
      result.recommendation = {
        spot: session.recommendedSpot,
        name: spot.name,
        description: spot.description,
        transport: spot.transport,
        highlights: spot.highlights,
        food: spot.food,
      };
    }

    return result;
  } catch (error) {
    console.error('chatWithDaegu 에러:', error);
    const safeSession = getOrCreateSession(sessionId, userName);
    safeSession.stage = safeSession.stage || 'greeting';
    const fallback = generateFallbackResponse();
    const effectiveName = (safeSession.userName || userName || '').trim();
    let fallbackMessage =
      fallback?.message ||
      buildSmallTalkMessage(effectiveName, { greet: safeSession.stage === 'greeting' });
    if (SAFETY_ENABLED) {
      fallbackMessage = policy.enforceOutput({
        text: fallbackMessage,
        session: safeSession,
        spots: DAEGU_SPOTS,
      });
      if (safeSession.stage !== 'arrived') {
        const recommendedKey = safeSession.recommendedSpot || null;
        const hasRecommendation = Boolean(recommendedKey);
        fallbackMessage = sanitizeFirstChatResponse(fallbackMessage, effectiveName, {
          stage: safeSession.stage,
          hasRecommendation,
          recommendedKey,
        });
      }
    }
    fallbackMessage = ensureRecommendationCallout(fallbackMessage, safeSession, effectiveName);
    safeSession.messages.push({
      role: 'assistant',
      content: fallbackMessage,
      timestamp: new Date(),
    });
    if (SAFETY_ENABLED) {
      policy.log_event(userMessage, fallbackMessage, 'policy_fallback');
    }
    return {
      success: true,
      message: fallbackMessage,
      sessionId,
      stage: safeSession.stage,
      usage: null,
      terminated: safeSession.terminated === true,
      strikes: safeSession.strikeCount,
      fallback: true,
    };
  }
}

// 세션 초기화
function resetSession(sessionId) {
  conversationSessions.delete(sessionId);
  return { success: true, message: '새로운 대화를 시작합니다!' };
}

// 도착 상태 설정
function setArrival(sessionId, spotKey) {
  const session = getOrCreateSession(sessionId);
  if (!DAEGU_SPOTS[spotKey]) return { success: false, error: '잘못된 명소 ID' };
  session.currentLocation = spotKey;
  session.recommendedSpot = spotKey; // 컨텍스트 유지
  session.stage = 'arrived';
  return { success: true, session: { stage: session.stage, currentLocation: session.currentLocation, recommendedSpot: session.recommendedSpot } };
}

// 세션 정보 조회
function getSessionInfo(sessionId) {
  const session = conversationSessions.get(sessionId);
  if (!session) return { exists: false };
  return {
    exists: true,
    stage: session.stage,
    messageCount: session.messages.length,
    recommendedSpot: session.recommendedSpot,
    createdAt: session.createdAt,
  };
}

module.exports = {
  chatWithDaegu,
  resetSession,
  getSessionInfo,
  DAEGU_SPOTS,
  setArrival,
};
