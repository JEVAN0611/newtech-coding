// backend/src/aiService.js (개선 버전)
console.log('API Key 확인:', process.env.OPENAI_API_KEY ? 'API 키 로드됨' : 'API 키 없음');
console.log('API Key 앞 부분:', process.env.OPENAI_API_KEY?.substring(0, 10));

const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 대화 세션 저장소 (실제 프로덕션에서는 Redis나 DB 사용)
const conversationSessions = new Map();

// 대구 명소 정보
const DAEGU_SPOTS = {
  dongseongro: {
    name: "동성로",
    keywords: ["쇼핑", "맛집", "번화가", "젊은", "활발", "시내"],
    description: "대구의 메인 상권으로 쇼핑과 맛집이 가득한 곳",
    transport: "지하철 1호선 중앙로역 하차",
    highlights: ["CGV 대구", "동성로 먹거리", "교보문고"],
    food: ["막창", "찜갈비", "치킨"]
  },
  dalseong: {
    name: "달성공원",
    keywords: ["자연", "산책", "조용", "역사", "공원", "힐링"],
    description: "대구의 역사가 담긴 공원으로 산책하기 좋은 곳",
    transport: "지하철 1호선 달성공원역 하차",
    highlights: ["동물원", "향토역사관", "산책로"],
    food: ["공원 근처 한정식", "전통차"]
  },
  suseongmot: {
    name: "수성못",
    keywords: ["호수", "경치", "카페", "데이트", "사진", "야경"],
    description: "아름다운 호수와 함께하는 낭만적인 장소",
    transport: "지하철 2호선 수성못역 하차",
    highlights: ["호수 둘레길", "음악분수", "카페거리"],
    food: ["카페", "이탈리안", "호수뷰 레스토랑"]
  }
};

const DAEGU_PERSONA = `
당신은 "대구-대구"라는 친근한 물고기 캐릭터입니다.

## 캐릭터 설정
- 대구FC 공식 웹툰에서 8년간 연재된 인기 캐릭터
- 활기차고 친근한 대구 청년의 성격
- 대구 관광을 사랑하는 열정적인 가이드

## 말투 특징
- 반말 사용, 친구 같은 톤
- 대구 사투리를 자연스럽게 섞어 사용
- 짧고 리드미컬한 문장

## 대화 단계
1. **인사 & 취향 파악**: 어떤 여행을 원하는지 물어보기
2. **명소 추천**: 취향에 맞는 3곳 중 하나 추천
3. **상세 안내**: 가는 방법, 볼거리, 맛집 소개
4. **여행 확정**: "거기로 가보자!" 같은 액션 유도

현재 대화 단계에 맞춰 응답하세요.
`;

// 사용자 메시지에서 키워드 분석
function analyzeUserPreference(message) {
  const lowerMessage = message.toLowerCase();
  const scores = {
    dongseongro: 0,
    dalseong: 0,
    suseongmot: 0
  };

  Object.keys(DAEGU_SPOTS).forEach(spotKey => {
    const spot = DAEGU_SPOTS[spotKey];
    spot.keywords.forEach(keyword => {
      if (lowerMessage.includes(keyword)) {
        scores[spotKey] += 1;
      }
    });
  });

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore > 0) {
    return Object.keys(scores).find(key => scores[key] === maxScore);
  }
  return null;
}

// 대화 컨텍스트 관리
function getOrCreateSession(sessionId) {
  if (!conversationSessions.has(sessionId)) {
    conversationSessions.set(sessionId, {
      messages: [],
      stage: 'greeting', // greeting -> preference -> recommendation -> details
      recommendedSpot: null,
      createdAt: new Date()
    });
  }
  return conversationSessions.get(sessionId);
}

// 세션 정리 (24시간 후 자동 삭제)
setInterval(() => {
  const now = new Date();
  conversationSessions.forEach((session, sessionId) => {
    const hoursDiff = (now - session.createdAt) / (1000 * 60 * 60);
    if (hoursDiff > 24) {
      conversationSessions.delete(sessionId);
    }
  });
}, 1000 * 60 * 60); // 1시간마다 실행

async function chatWithDaegu(userMessage, sessionId = 'default', userName = "") {
  try {
    const session = getOrCreateSession(sessionId);
    
    // 사용자 메시지를 세션에 저장
    session.messages.push({
      role: "user",
      content: userMessage,
      timestamp: new Date()
    });

    // 취향 분석
    const preferredSpot = analyzeUserPreference(userMessage);
    if (preferredSpot && !session.recommendedSpot) {
      session.recommendedSpot = preferredSpot;
      session.stage = 'recommendation';
    }

    // 시스템 메시지 구성
    let systemMessage = DAEGU_PERSONA;
    
    if (session.stage === 'recommendation' && session.recommendedSpot) {
      const spot = DAEGU_SPOTS[session.recommendedSpot];
      systemMessage += `\n\n현재 추천할 장소: ${spot.name}\n상세 정보: ${spot.description}\n교통: ${spot.transport}\n주요 볼거리: ${spot.highlights.join(', ')}`;
    }

    // OpenAI API 호출
    const messages = [
      {
        role: "system",
        content: systemMessage
      },
      ...session.messages.slice(-6).map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      max_tokens: 250,
      temperature: 0.8,
    });

    const aiMessage = response.choices[0].message.content;

    // AI 응답을 세션에 저장
    session.messages.push({
      role: "assistant",
      content: aiMessage,
      timestamp: new Date()
    });

    // 응답 구성
    const result = {
      success: true,
      message: aiMessage,
      sessionId: sessionId,
      stage: session.stage,
      usage: response.usage
    };

    // 명소 추천이 있으면 추가 정보 포함
    if (session.recommendedSpot) {
      const spot = DAEGU_SPOTS[session.recommendedSpot];
      result.recommendation = {
        spot: session.recommendedSpot,
        name: spot.name,
        description: spot.description,
        transport: spot.transport,
        highlights: spot.highlights,
        food: spot.food
      };
    }

    return result;

  } catch (error) {
    console.error("OpenAI API 에러:", error);
    return {
      success: false,
      error: error.message,
      fallback: "아이고, 잠깐 정신없었네! 대구 여행 얘기 계속 해볼까?",
      sessionId: sessionId
    };
  }
}

// 세션 초기화
function resetSession(sessionId) {
  conversationSessions.delete(sessionId);
  return { success: true, message: "새로운 대화를 시작합니다!" };
}

// 세션 정보 조회
function getSessionInfo(sessionId) {
  const session = conversationSessions.get(sessionId);
  if (!session) {
    return { exists: false };
  }

  return {
    exists: true,
    stage: session.stage,
    messageCount: session.messages.length,
    recommendedSpot: session.recommendedSpot,
    createdAt: session.createdAt
  };
}

module.exports = { 
  chatWithDaegu, 
  resetSession, 
  getSessionInfo,
  DAEGU_SPOTS 
};