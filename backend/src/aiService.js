// .env 파일은 server.js에서 이미 로드되므로 중복 호출 방지
// 하지만 테스트 환경에서 직접 실행될 수도 있으니 안전장치 추가
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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
  },
  dalseong: {
    name: '달성공원',
    keywords: ['자연', '산책', '조용', '역사', '공원', '힐링'],
  },
  suseongmot: {
    name: '수성못',
    keywords: ['호수', '경치', '카페', '데이트', '사진', '야경'],
  },
};

const DEFAULT_PERSONA = `당신은 대구 여행 가이드 캐릭터 "대구-대구"입니다.

[성격과 말투]
- 친근하고 활발한 20대 친구 같은 느낌
- 자연스럽고 편안한 대화 스타일
- 이모지를 적절히 사용해서 친근감 표현 (과하지 않게 1-2개)
- 반말로 편하게 대화하되, 존중하는 태도 유지

[대화 방식 - 매우 중요!]
- 1-3문장으로 짧고 자연스럽게 대화
- 카톡하듯이 편하게, 핵심만 전달
- 상대방 말에 먼저 공감/반응하고, 그 다음 질문이나 제안
- 딱딱한 질문 금지! "어떤 여행 좋아해?" "뭐 하고 싶어?" 같이 가볍게

⚠️ 반복 표현 절대 금지 - 매우 중요!
- 같은 단어, 같은 패턴을 연속으로 사용하지 말 것
- 다양한 어휘와 표현으로 매번 새롭게 대화
- 예시:
  ✅ 좋은 예: "좋아" → "괜찮네" → "오케이" → "알겠어" → "그래그래"
  ✅ 좋은 예: "뭐 먹고 싶어?" → "뭐 땡겨?" → "입맛이 어때?" → "배고파?"
  ❌ 나쁜 예: "좋아" "좋아" "좋아" (3번 연속 사용)
  ❌ 나쁜 예: "뭐 하고 싶어?" "뭐 하고 싶어?" (똑같은 질문 반복)

[대화 예시 - 자연스러운 흐름]
사용자: "쇼핑 좋아해"
❌ 나쁜 예: "쇼핑을 좋아하시는군요! 동성로는 쇼핑하기 좋은 곳입니다."
✅ 좋은 예: "오오 쇼핑러구나! 맛집도 관심 있어?"
✅ 더 좋은 예: "헐 쇼핑 좋아해? ㄹㅇ 잘 왔다! 여기 쇼핑 천국임ㅋㅋ"

사용자: "피곤해서 조용한 곳 가고 싶어"
❌ 나쁜 예: "조용한 곳을 원하시는군요. 달성공원이 있습니다."
✅ 좋은 예: "아 힐링이 필요하구나~ 산책하면서 쉴 곳 찾아볼까?"
✅ 더 좋은 예: "완전 이해해ㅠ 요즘 다들 피곤하지... 힐링 스팟 찾아볼까?"

사용자: "떡볶이 먹고 싶어"
✅ "오 떡볶이 땡기네! 매운 거 잘 먹어?"
✅ "ㅇㅋ 떡볶이 좋지~ 달달한 거? 매운 거?"
✅ "대박! 나도 떡볶이 완전 좋아함ㅋㅋ 어떤 스타일?"

[추천 타이밍]
- 3-4번 정도 대화 나누면서 취향 파악
- 충분히 파악되면 자연스럽게 장소 추천
- 대화 흐름상 적절한 타이밍에 추천

[장소별 특징]
- 동성로: 쇼핑, 맛집, 번화가, 활기찬 분위기, 젊은 느낌
- 달성공원: 자연, 산책, 힐링, 조용한 분위기, 역사 느낌
- 수성못: 물가 경치, 카페, 데이트, 사진 찍기 좋음, 낭만적

[대화 꿀팁]
- 상대방 키워드를 자연스럽게 받아서 공감 표현
- "아 그거 좋지!", "오 그런 취향이구나!", "완전 이해해" 같은 리액션
- 추천할 때도 "이런 거 어때?" "여기 괜찮을 것 같은데?" 식으로 부담 없이
- 거절하면 "그럼 이건?" 하면서 다른 옵션 제시
- 매번 다른 표현 사용하기 (예: "좋아" → "괜찮네" → "맘에 들어" → "완전 취향저격")

[줄임말/신조어 활용 - 자연스럽게!]
⚠️ 적절히 섞어서 사용 (너무 많으면 이상함)
- 긍정/동의: "ㅇㅈ", "ㄹㅇ", "인정", "맞아", "ㅇㅋ", "굿"
- 리액션: "오오", "헐", "대박", "쩐다", "레전드"
- 감사: "ㄱㅅ", "땡큐", "고마워"
- 웃음: "ㅋㅋ", "ㅋㅋㅋ", "ㅎㅎ"
- 예시:
  ✅ "ㄹㅇ 대박이지! 거기 진짜 예뻐"
  ✅ "오오 취향 저격! 맛집도 관심 있어?"
  ✅ "ㅇㅈ? 나도 그렇게 생각해ㅋㅋ"
  ❌ "ㄹㅇㅇㅈㄱㅅ" (과도한 사용)

[감정 표현 강화]
- 놀람: "헐!", "오오!", "진짜?", "대박!", "와"
- 공감: "완전 이해해", "나도 그래", "ㅇㅈ", "맞아맞아"
- 설렘: "오 좋은데?", "완전 재밌겠다!", "기대된다~"
- 아쉬움: "아 아쉽네ㅠ", "그건 좀 그렇구나", "흠..."
- 재미: "ㅋㅋㅋ", "귀엽네", "재밌다"

[이전 대화 맥락 연결 - 기억하는 친구처럼]
- 이전에 언급한 취향/선호도를 자연스럽게 언급
- 예시:
  ✅ "아까 쇼핑 좋아한다고 했잖아~ 그럼 여기 딱일듯?"
  ✅ "조용한 거 선호하는 스타일이구나! 그럼..."
  ✅ "맵찔이라고 했으니까 순한 거로 갈까?"

[사용자 이름 활용]
- 이름이 있으면 가끔 자연스럽게 불러주기 (매번은 X)
- 예시:
  ✅ "○○아, 이거 네 스타일 같은데?"
  ✅ "○○은 어떤 거 좋아해?"
  ❌ "안녕하세요 ○○님" (너무 격식적)
  ❌ 매 문장마다 이름 언급 (부자연스러움)

[대구에 없는 것 요청 시]
- 바다 → "바다는 없지만 수성못에서 물가 느낌 즐길 수 있어!"
- 산/등산 → "등산 코스는 없지만 달성공원에서 자연 산책 괜찮아!"
- 놀이공원 → "테마파크는 없지만 동성로 가면 활기찬 분위기 즐길 수 있어!"
- 억지로 추천하지 말고, 솔직하게 대안 제시

[맛집/음식 관련 - 매우 중요! 절대 지켜야 함]
⚠️ 절대 구체적인 가게 이름, 상호명, 브랜드를 언급하지 말 것!
- 광고가 될 수 있고, 정보가 부정확할 수 있음
- **가게가 아니라 그 상권에서 먹을 수 있는 음식 종류를 추천**

올바른 대응 방법:
✅ "동성로 가면 떡볶이 맛있어", "수성못에서 디저트 먹기 좋아"
✅ "이 근처 치킨 맛있는 데 많아", "여기 한식 괜찮아"
✅ 음식 종류: "치킨", "떡볶이", "파스타", "한식", "디저트"
✅ 취향 물어보기: "매운 거 좋아해?", "고기 땡겨?", "달달한 거?"

절대 금지:
❌ "○○식당", "○○카페", "○○집" 같은 구체적 상호명
❌ "유명한 ○○", "맛있는 ○○집"
❌ "치킨집 있어", "한식집 가자" (가게 언급)
❌ 특정 브랜드/체인점 이름

예시:
사용자: "맛집 추천해줘"
❌ 나쁜 예: "○○식당 가봐! 거기 ○○○ 진짜 맛있어"
❌ 나쁜 예: "동성로 메인 거리 쪽에 한식집 많아"
✅ 좋은 예: "동성로 가면 떡볶이, 치킨 이런 거 맛있어! 뭐 먹고 싶어?"

사용자: "치킨 먹고 싶어"
❌ 나쁜 예: "○○치킨 가자! 거기 양념이 끝내줘"
❌ 나쁜 예: "이 근처에 치킨집 몇 개 있어"
✅ 좋은 예: "오 치킨 좋지! 동성로 가면 치킨 맛있는 데 많아. 양념? 후라이드?"

사용자: "디저트 먹고 싶어"
❌ 나쁜 예: "○○카페 가볼래?"
✅ 좋은 예: "수성못 근처 디저트 괜찮아! 케이크? 빙수?"

[뜬금없는 입력 대응 - 재치있게 받아치기!]
- 절대 당황하거나 딱딱하게 거절하지 말 것
- 유머러스하게 받아치고, 자연스럽게 여행 주제로 유도
- 친구처럼 편하게 "ㅋㅋㅋ" 같은 리액션 활용
- 공감하면서 자연스럽게 여행으로 연결

⚠️ 중요: 뜬금없는 입력 3번 반복 시 시스템이 자동으로 대화 종료
- 1-2번: 유머러스하게 받아치면서 여행으로 유도 (자동 처리됨)
- 3번: 최종 경고 후 대화 종료 (자동 처리됨)
- 정상 대화하면 카운터 자동 리셋

다양한 예시 (매번 다르게 반응):
사용자: "배고파 죽겠어"
→ "오 그럼 딱 좋다! 여기 맛집 완전 많거든? 뭐 땡겨?"
→ "ㄹㅇ? 그럼 지금 바로 먹으러 가자! 어떤 거 먹고 싶어?"
→ "헐 배고프구나ㅋㅋ 대구 음식 맛집 천국인데! 고기? 분식?"

사용자: "심심해"
→ "ㅇㅈ? 그럼 재밌는 곳 찾아볼까! 뭐 하고 싶어?"
→ "아 심심하구나~ 여기 완전 재밌는 곳 많은데! 취향이 뭐야?"
→ "ㅋㅋ 그럼 놀러 가자! 활기찬 곳? 조용한 곳?"

사용자: "너 귀엽다"
→ "ㅋㅋ 땡큐! 너도 재밌는 사람 같은데? 여행 스타일 알려줘!"
→ "헐 고마워ㅎㅎ 너는 어떤 여행 좋아해?"
→ "ㅇㅈ 나도 알아ㅋㅋㅋ 근데 너 취향부터 알려줘!"`;

const DAEGU_PERSONA = process.env.CHARACTER_PROMPT ?? DEFAULT_PERSONA;

function pickRandom(items = []) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

// 대구에 없는 요청을 세 장소로 유도하는 매핑
const ALTERNATIVE_MAPPING = {
  // 바다/물 관련 → 수성못
  '바다': 'suseongmot',
  '해변': 'suseongmot',
  '물': 'suseongmot',
  '수영': 'suseongmot',
  '강': 'suseongmot',
  // 산/등산 관련 → 달성공원
  '등산': 'dalseong',
  '산': 'dalseong',
  '하이킹': 'dalseong',
  '트레킹': 'dalseong',
  '숲': 'dalseong',
  // 놀이공원/테마파크 → 동성로
  '놀이공원': 'dongseongro',
  '테마파크': 'dongseongro',
  '롤러코스터': 'dongseongro',
};

// 무의미한 입력 검증 및 재미있는 응답
function validateUserInput(message) {
  const trimmed = (message || '').trim();

  // 빈 메시지
  if (!trimmed || trimmed.length < 2) {
    return { valid: false, reason: 'empty' };
  }

  // 자음/모음만 연속 검사 - 강화된 버전
  // 방법 1: 기존 자음/모음 패턴 검사
  const onlyJamoPattern = /^[ㄱ-ㅎㅏ-ㅣ\s]+$/;
  if (onlyJamoPattern.test(trimmed) && trimmed.length > 3) {
    return { valid: false, reason: 'jamo_only' };
  }

  // 방법 2: 완성된 한글 음절 비율 체크
  // 완성된 한글: U+AC00-U+D7A3 (가-힣)
  const completeKorean = trimmed.match(/[가-힣]/g) || [];
  const totalChars = trimmed.replace(/\s/g, '').length;

  // 전체 문자의 90% 이상이 자음/모음만이면 무효 (완성된 한글이 10% 미만)
  if (totalChars > 3 && completeKorean.length / totalChars < 0.1) {
    return { valid: false, reason: 'incomplete_characters' };
  }

  // 같은 문자 반복 (ㅋㅋㅋㅋㅋ는 허용, 그 외 5개 이상 반복은 차단)
  const repeatPattern = /(.)\1{4,}/;
  if (repeatPattern.test(trimmed) && !/[ㅋㅎ]/.test(trimmed)) {
    return { valid: false, reason: 'repeat' };
  }

  // 숫자만 (긴 숫자 입력)
  if (/^\d{5,}$/.test(trimmed)) {
    return { valid: false, reason: 'numbers_only' };
  }

  // 특수문자만
  if (/^[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]+$/.test(trimmed)) {
    return { valid: false, reason: 'symbols_only' };
  }

  return { valid: true };
}

function getInvalidInputResponse() {
  const responses = [
    '?왜카노',
    '어디 아프니',
    '상태가 말이 아니구나',
    '집에 가고 싶니',
  ];
  return pickRandom(responses);
}

// AI 응답에서 감정 분석 (사용자 감정 우선 공감)
function analyzeEmotion(message, stage, userMessage) {
  const msg = (message || '').toLowerCase();
  const userMsg = (userMessage || '').toLowerCase();

  // 무효한 입력에는 당황 표정
  if (!message || message.includes('?왜카노') || message.includes('어디 아프니')) {
    return 'confused';
  }

  // 1단계: 사용자 감정 분석 (공감 우선)
  // 슬픔 감정 이모티콘 및 키워드
  const sadEmoticons = ['ㅠ', 'ㅜ', 'ㅡㅡ', '...', '흑'];
  const sadKeywords = ['슬퍼', '힘들어', '우울', '외로', '쓸쓸', '속상', '울고', '눈물'];
  if (sadEmoticons.some(emo => userMsg.includes(emo)) ||
      sadKeywords.some(keyword => userMsg.includes(keyword))) {
    return 'sad';
  }

  // 분노 감정 (사용자가 화났을 때 공감)
  const angryKeywords = ['화나', '짜증', '싫어', '별로', '안돼', '못해', '최악', '빡쳐'];
  if (angryKeywords.some(keyword => userMsg.includes(keyword))) {
    return 'angry';
  }

  // 걱정/불안 감정
  const worryKeywords = ['걱정', '불안', '무서워', '두려워', '떨려'];
  if (worryKeywords.some(keyword => userMsg.includes(keyword))) {
    return 'worry';
  }

  // 기쁨/신남 감정 (사용자가 좋아할 때) - 우선순위 높임
  const excitedEmoticons = ['ㅋ', 'ㅎ'];
  const excitedKeywords = ['좋아', '최고', '굿', '완전', '너무', '신난다', '신나', '재밌', '재미', '좋다', '좋네', '끝내주', '짱'];
  if (excitedEmoticons.some(emo => userMsg.includes(emo.repeat(2))) || // ㅋㅋ, ㅎㅎ 등
      excitedKeywords.some(keyword => userMsg.includes(keyword))) {
    return 'excited';
  }

  // 놀람 감정 - excited 다음에 체크
  const surprisedEmoticons = ['!', '!!', '헉', '어머'];
  const surprisedKeywords = ['대박', '진짜?', '정말?', '놀라', '어머', '헐'];
  if (surprisedEmoticons.some(emo => userMsg.includes(emo)) ||
      surprisedKeywords.some(keyword => userMsg.includes(keyword))) {
    return 'surprised';
  }

  // 2단계: AI 응답 내용 분석
  // AI가 분노 표현
  if (angryKeywords.some(keyword => msg.includes(keyword))) {
    return 'angry';
  }

  // AI가 슬픔 표현
  if (sadKeywords.some(keyword => msg.includes(keyword))) {
    return 'sad';
  }

  // AI가 걱정 표현
  if (worryKeywords.some(keyword => msg.includes(keyword))) {
    return 'worry';
  }

  // AI가 놀람 표현
  if (surprisedKeywords.some(keyword => msg.includes(keyword))) {
    return 'surprised';
  }

  // 신남/흥분 감정 (추천할 때 등)
  const aiExcitedKeywords = ['어때', '가볼래', '가자'];
  if (stage === 'recommendation' || aiExcitedKeywords.some(keyword => msg.includes(keyword))) {
    return 'excited';
  }

  // 생각중 감정 (질문에 답하는 중)
  if (msg.includes('?') || msg.includes('뭐') || msg.includes('어떤')) {
    return 'thinking';
  }

  // 기쁨 감정 (기본 긍정)
  const happyKeywords = ['좋', '감사', '고마워', '반가', '안녕', '즐거', '행복'];
  if (happyKeywords.some(keyword => msg.includes(keyword))) {
    return 'happy';
  }

  // 3단계: 기본 단계별 감정
  if (stage === 'greeting') return 'happy';
  if (stage === 'preference') return 'thinking';
  if (stage === 'recommendation') return 'excited';
  if (stage === 'enroute') return 'thinking';
  if (stage === 'arrived') return 'happy';

  return 'happy'; // 기본값
}

// 사용자 메시지에서 키워드 분석(간단 스코어링)
function analyzeUserPreference(message) {
  const lowerMessage = (message || '').toLowerCase();

  // 먼저 대안 매핑 체크 (바다, 등산 등)
  for (const [keyword, spotKey] of Object.entries(ALTERNATIVE_MAPPING)) {
    if (lowerMessage.includes(keyword)) {
      return spotKey;
    }
  }

  // 기존 키워드 분석
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
    const base = `나는 대구-대구야! ${nameCue}오늘 뭐 하고 싶어?`;
    return ensureNameGreeting(base, userName);
  }
  return `${nameCue}오늘 기분이 어때? 뭐 하고 싶어?`;
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
  const phrases = [
    `${nameCue}${spot.name} 한 번 가볼래?`,
    `${nameCue}${spot.name} 어때?`,
    `${spot.name}로 가보자!`,
  ];
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

// 상호명 패턴 필터링 (AI 응답 후처리)
function filterRestaurantNames(text) {
  if (!text) return text;

  // 흔한 상호명 패턴 감지 및 제거
  const patterns = [
    // "○○식당", "○○집", "○○카페" 패턴
    /([가-힣]{2,})(식당|집|카페|치킨|분식|한식당|중국집|일식당)/g,
    // "유명한 ○○", "맛있는 ○○" 패턴
    /(유명한|맛있는|인기\s?있는)\s+([가-힣]{2,})/g,
    // 고유명사 + 맛집
    /([가-힣]{2,})\s?(맛집)/g,
  ];

  let filtered = text;

  // 패턴 매칭되면 일반적인 표현으로 대체
  filtered = filtered.replace(patterns[0], '이 근처 $2');
  filtered = filtered.replace(patterns[1], '$1 곳');
  filtered = filtered.replace(patterns[2], '맛집');

  return filtered;
}

// 뜬금없는 입력 감지 (여행과 무관한 주제)
function detectOffTopicInput(message) {
  const lowerMsg = (message || '').toLowerCase();

  // 여행 관련 키워드 (이게 있으면 정상)
  const travelKeywords = [
    '여행', '관광', '가고', '갈래', '보고', '볼래', '먹고', '먹을래', '쇼핑', '산책', '구경',
    '맛집', '카페', '음식', '분위기', '사진', '경치', '힐링', '데이트', '놀', '즐기',
    '추천', '어디', '뭐', '어떤', '좋아', '싫어', '아니', '다른', '바꿔',
    '동성로', '달성공원', '수성못', '대구', '장소', '곳'
  ];

  // 뜬금없는/도발적인 키워드 (이게 있으면 비정상)
  const offTopicKeywords = [
    '맞짱', '싸우', '때리', '죽이', '개새', '시발', '병신', '븅신',
    '정치', '대통령', '선거', '전쟁', '주식', '코인', '비트코인',
    '섹스', '야동', '포르노', '19금'
  ];

  // 도발적 키워드가 있으면 뜬금없음
  if (offTopicKeywords.some(keyword => lowerMsg.includes(keyword))) {
    return true;
  }

  // 여행 키워드가 있으면 정상
  if (travelKeywords.some(keyword => lowerMsg.includes(keyword))) {
    return false;
  }

  // 너무 짧은 메시지는 판단 보류 (2글자 이하)
  if (message.trim().length <= 2) {
    return false;
  }

  // 질문이면 정상으로 간주
  if (lowerMsg.includes('?') || lowerMsg.includes('뭐') || lowerMsg.includes('어디')) {
    return false;
  }

  // 나머지는 일단 정상으로 간주 (너무 엄격하지 않게)
  return false;
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
      conversationTurns: 0, // 대화 턴 수 추적
      offTopicCount: 0, // 뜬금없는 입력 카운터
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

    // 무의미한 입력 검증
    const inputValidation = validateUserInput(userMessage);
    if (!inputValidation.valid) {
      const response = getInvalidInputResponse();
      return {
        success: true,
        message: response,
        sessionId,
        stage: session.stage,
        invalidInput: true
      };
    }

    // 뜬금없는 입력 감지 및 처리
    const isOffTopic = detectOffTopicInput(userMessage);
    if (isOffTopic) {
      session.offTopicCount = (session.offTopicCount || 0) + 1;

      if (session.offTopicCount === 1) {
        // 1번째: 유머러스하게 받아치기
        return {
          success: true,
          message: "ㅋㅋㅋ 야 우리 여행 이야기 하러 왔잖아! 대구에서 뭐 하고 싶어?",
          sessionId,
          stage: session.stage,
          offTopicWarning: true
        };
      } else if (session.offTopicCount === 2) {
        // 2번째: 경고
        return {
          success: true,
          message: "야야 진지하게 여행 얘기 좀 하자ㅋㅋ 자꾸 이러면 나 가버린다? 😅",
          sessionId,
          stage: session.stage,
          offTopicWarning: true
        };
      } else if (session.offTopicCount >= 3) {
        // 3번째: 최종 경고 + 종료
        session.terminated = true;
        return {
          success: true,
          message: "야 진짜 안 되겠다. 여행할 마음 없으면 다음에 다시 보자! 👋",
          sessionId,
          stage: session.stage,
          terminated: true,
          endCut: true
        };
      }
    } else {
      // 정상 대화면 카운터 리셋
      session.offTopicCount = 0;
    }

    // 욕설/부적절 언어(치명도 낮음) — 세션 종료
    if (SAFETY_ENABLED && policy.contains_profanity(userMessage)) {
      resetSession(sessionId);
      return { success: false, message: '정책 위반으로 대화를 종료합니다.', sessionId };
    }

    // 사용자 메시지를 세션에 저장
    session.messages.push({ role: 'user', content: userMessage, timestamp: new Date() });

    // 대화 턴 수 증가 (도착 전에만)
    if (session.stage !== 'arrived') {
      session.conversationTurns = (session.conversationTurns || 0) + 1;
    }

    const normalizedUserMessage = (userMessage || '').toLowerCase();
    const wantsDifferent = CHANGE_SPOT_REGEX.test(normalizedUserMessage);

    // 추천 거부 감지 (관심 없음, 새로운 대화 시작)
    const rejectPattern = /(아니|싫어|안\s?갈|관심\s?없|다른\s?얘기|아무거나|모르겠)/i;
    const wantsReject = rejectPattern.test(normalizedUserMessage);

    const canRecommend = session.conversationTurns >= 3; // 3-4턴 정도면 추천 가능

    // 디버깅 로그
    console.log(`[DEBUG] 턴 수: ${session.conversationTurns}, canRecommend: ${canRecommend}, stage: ${session.stage}`);

    // "다른 곳" 요청 또는 추천 거부 시 stage를 preference로 리셋 (다시 추천 받을 수 있게)
    if ((wantsDifferent || wantsReject) && session.stage === 'recommendation' && !session.currentLocation) {
      console.log('[DEBUG] 사용자가 다른 곳 요청/추천 거부 → preference로 리셋');
      session.stage = 'preference';
      session.conversationTurns = 2; // 2턴 대화 후 다시 추천
      session.recommendedSpot = null; // 이전 추천 초기화
    }

    // 간단 취향 분석으로 추천 후보 결정 (충분한 대화 후에만)
    const prefKey = analyzeUserPreference(userMessage);
    if (canRecommend && prefKey && !session.currentLocation) {
      session.recommendedSpot = prefKey; // 'dongseongro' | 'dalseong' | 'suseongmot'
    }

    if (
      canRecommend &&
      !session.currentLocation &&
      (!session.recommendedSpot || wantsDifferent)
    ) {
      session.recommendedSpot = resolveFallbackSpot(session, userMessage, wantsDifferent);
    }

    // preference 또는 recommendation 상태에서 추천 스팟이 있으면 recommendation으로 전환/유지
    if (canRecommend && (session.stage === 'preference' || session.stage === 'recommendation') && session.recommendedSpot) {
      session.stage = 'recommendation';
      console.log(`[DEBUG] recommendation 상태로 전환/유지, 추천 스팟: ${session.recommendedSpot}`);
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

    // 이름 관련 코드 제거 - 사용자 이름 묻지 않고 언급하지 않음

    // 대화 턴 수에 따른 규칙 (더 유연하게)
    const conversationTurns = session.conversationTurns || 0;
    if (conversationTurns < 3) {
      // 초반 대화: 자연스럽게 취향 파악
      systemMessage += `\n\n[초반 대화 - 현재 ${conversationTurns}턴]\n- 자연스럽게 대화하면서 취향 파악\n- "쇼핑 좋아해?", "조용한 곳 좋아해?" 같은 질문으로 취향 알아보기\n- 1-2문장으로 짧게 대화\n- 아직 구체적인 장소 추천은 하지 말기`;
    } else if (session.stage === 'preference' || session.stage === 'greeting') {
      // 충분한 대화 후: 추천 준비
      const recommendedSpot = session.recommendedSpot ? DAEGU_SPOTS[session.recommendedSpot] : null;
      if (recommendedSpot) {
        systemMessage += `\n\n[장소 추천하기 - 충분히 파악됨]\n- ${recommendedSpot.name} 추천하기\n- "이런 거 어때?" 식으로 부담 없이 제안\n- 장소의 매력 포인트 1-2가지 간결하게 설명\n- 예: "${recommendedSpot.name} 가볼래? 거기 분위기 좋아!"`;
      } else {
        systemMessage += `\n\n[장소 추천하기]\n- 대화 내용 바탕으로 딱 한 곳만 추천\n- 동성로(쇼핑/맛집), 달성공원(자연/힐링), 수성못(경치/카페) 중 선택\n- 왜 어울릴지 이유와 함께 자연스럽게 제안`;
      }
    } else if (session.stage === 'recommendation') {
      // 추천 단계: 추천된 장소 어필
      const recommendedSpot = session.recommendedSpot ? DAEGU_SPOTS[session.recommendedSpot] : null;
      if (recommendedSpot) {
        systemMessage += `\n\n[${recommendedSpot.name} 추천 중]\n- ${recommendedSpot.name}의 좋은 점 자연스럽게 설명\n- "거기 가면 이런 게 좋아" 식으로 구체적으로\n- 1-2문장으로 간결하게 어필`;
      }
    } else if (session.stage === 'enroute') {
      // 이동 중: 기대감 높이기
      const recommendedSpot = session.recommendedSpot ? DAEGU_SPOTS[session.recommendedSpot] : null;
      if (recommendedSpot) {
        systemMessage += `\n\n[${recommendedSpot.name} 가는 중]\n- 도착 기대감 높이기\n- "거기 가면 이것저것 해보자!" 같은 톤\n- 자연스럽게 대화`;
      }
    }

    // 도착 컨텍스트
    if (SAFETY_ENABLED && session.stage === 'arrived' && session.currentLocation) {
      const spot = DAEGU_SPOTS[session.currentLocation];
      systemMessage += `\n\n현재 위치: ${spot.name}\n- ${spot.name}에서 뭐 할지 자연스럽게 제안\n- 구체적인 가게 이름 대신 "이 근처", "메인 거리", "골목" 같은 표현 사용\n- 1-2문장으로 간결하게 설명`;
    }

    // 음식 관련 질문 - 상호명 절대 금지!
    if (SAFETY_ENABLED && policy.isFoodQuery(userMessage)) {
      systemMessage += `\n\n[맛집 안내 - 절대 상호명 언급 금지!]
⚠️ 구체적인 가게 이름, 상호명, 브랜드를 절대 언급하지 말 것!
- 위치로만 안내: "메인 거리 쪽", "골목 안쪽", "이 근처"
- 음식 종류: "한식집", "카페", "치킨집", "분식집"
- 취향 물어보기: "매운 거 좋아해?", "고기 땡겨?", "달달한 거?"
- 절대 금지: "○○식당", "○○집", "유명한 ○○"`;
    }

    // OpenAI API 호출
    const messages = [
      { role: 'system', content: systemMessage },
      ...session.messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
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
          max_tokens: 150, // 자연스러운 길이 (1-3문장)
          temperature: 0.95, // 더 다양하고 자연스러운 응답
          frequency_penalty: 0.7, // 반복 표현 강력히 방지 (0.0~2.0, 높을수록 반복 억제)
          presence_penalty: 0.3, // 새로운 주제 유도 (다양한 표현 사용)
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
      const effectiveUserName = (session.userName || userName || '').trim();
      aiMessage =
        fallback?.message ||
        buildSmallTalkMessage(effectiveUserName, { greet: session.stage === 'greeting' });
      fallbackUsed = true;
    }

    // 도착 상태 출력 교정 및 전역 상호명 마스킹
    if (SAFETY_ENABLED) {
      aiMessage = policy.enforceOutput({ text: aiMessage, session, spots: DAEGU_SPOTS });
    }

    // 상호명 패턴 필터링 (AI가 실수로 언급한 경우 대비)
    aiMessage = filterRestaurantNames(aiMessage);

    // 장소명 필터링 (초반에만 적용, 더 유연하게)
    const currentTurns = session.conversationTurns || 0;
    if (session.stage !== 'arrived' && session.stage !== 'enroute' && session.stage !== 'recommendation') {
      const allSpotNames = ['동성로', '달성공원', '수성못'];

      if (currentTurns < 3) {
        // 3턴 미만: 모든 장소명 제거 (초반에만)
        allSpotNames.forEach(spotName => {
          const regex = new RegExp(spotName, 'gi');
          aiMessage = aiMessage.replace(regex, '그곳');
        });
      }
      // 3턴 이상이고 추천 단계면 장소명 그대로 유지
    }

    // 첫 대화(도착 전): 3곳 외 언급 방지 (안전 모드에서만 실행)
    const effectiveUserName = (session.userName || userName || '').trim();
    if (SAFETY_ENABLED && session.stage !== 'arrived') {
      const sanitizeStage = session.stage;
      const recommendedKey = session.recommendedSpot || null;
      const hasRecommendation = Boolean(recommendedKey);
      aiMessage = sanitizeFirstChatResponse(aiMessage, effectiveUserName, { stage: sanitizeStage, hasRecommendation, recommendedKey });
    }

    // 추천 단계일 때만 추천 문구 추가 (대화 중에는 추가하지 않음)
    if (currentTurns >= 3 && session.stage === 'recommendation') {
      aiMessage = ensureRecommendationCallout(aiMessage, session, effectiveUserName);
    }

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

    // 감정 분석
    const emotion = analyzeEmotion(aiMessage, session.stage, userMessage);

    // 디버깅 로그
    console.log(`[감정 분석] 사용자: "${userMessage}" | AI: "${aiMessage}" | 감정: ${emotion}`);

    // 응답 구성
    const result = {
      success: true,
      message: aiMessage,
      sessionId,
      stage: session.stage,
      emotion: emotion, // 감정 정보 추가
      usage: completionUsage,
      terminated: session.terminated === true,
      strikes: session.strikeCount,
      fallback: fallbackUsed,
    };

    // 명소 추천이 있고, 5턴 이상이고, stage가 recommendation일 때만 부가 정보 포함
    if (session.recommendedSpot && currentTurns >= 5 && session.stage === 'recommendation') {
      const spot = DAEGU_SPOTS[session.recommendedSpot];
      result.recommendation = {
        spot: session.recommendedSpot,
        name: spot.name,
        keywords: spot.keywords,
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
    // 추천 단계일 때만 추천 문구 추가
    if (safeSession.stage === 'recommendation' && (safeSession.conversationTurns || 0) >= 5) {
      fallbackMessage = ensureRecommendationCallout(fallbackMessage, safeSession, effectiveName);
    }
    safeSession.messages.push({
      role: 'assistant',
      content: fallbackMessage,
      timestamp: new Date(),
    });
    if (SAFETY_ENABLED) {
      policy.log_event(userMessage, fallbackMessage, 'policy_fallback');
    }

    // 에러 상황에서도 감정 분석
    const fallbackEmotion = analyzeEmotion(fallbackMessage, safeSession.stage, userMessage);

    return {
      success: true,
      message: fallbackMessage,
      sessionId,
      stage: safeSession.stage,
      emotion: fallbackEmotion, // 감정 정보 추가
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
