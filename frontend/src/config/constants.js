// API 설정
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// 캐릭터 애셋 경로
export const ASSET_BASE = `${process.env.PUBLIC_URL || ""}/assets/images/character`;

// 캐릭터 감정 GIF
export const CHARACTER_EMOTIONS = {
  default: `${ASSET_BASE}/daegu-daegu-half.gif`,
  happy: `${ASSET_BASE}/daegu-daegu-half.gif`,
  excited: `${ASSET_BASE}/daegu-daegu-excited.gif`,
  sad: `${ASSET_BASE}/daegu-daegu-sad.gif`,
  angry: `${ASSET_BASE}/daegu-daegu-half.gif`,
  confused: `${ASSET_BASE}/daegu-daegu-half.gif`,
  thinking: `${ASSET_BASE}/daegu-daegu-half.gif`,
  surprised: `${ASSET_BASE}/daegu-daegu-half.gif`,
  worry: `${ASSET_BASE}/daegu-daegu-half.gif`,
};

// 캐릭터 포즈
export const CHARACTER_POSES = {
  blink: `${ASSET_BASE}/daegu-daegu-half.gif`,
  chinScratch: `${ASSET_BASE}/daegu-daegu-chin.gif`,
};

// 장소 매핑
export const SPOT_NAMES = ["동성로", "달성공원", "수성못"];
export const SPOT_ID_MAP = {
  동성로: "dongseongro",
  달성공원: "dalseong",
  수성못: "suseongmot",
};

// 유튜브 영상 매핑
export const VIDEO_MAP = {
  동성로: { type: "id", value: "XwEbpYYsv_Q" },
  수성못: { type: "id", value: "5L08R3GYcDI" },
  달성공원: { type: "id", value: "cui_U87t-20" },
};

// 애니메이션 타이밍 (ms)
export const TIMINGS = {
  BUBBLE_EXIT_DURATION: 220,
  BUBBLE_ENTER_DURATION: 320,
  RESPONSE_DELAY: 1000,
  THINKING_DELAY: 1000,
  TYPING_SPEED: 50,
  SPECIAL_POSE_DURATION: 2800,
  USER_EMOTION_PRIORITY_DURATION: 2500,
};

// 특수 포즈 설정
export const SPECIAL_POSE = {
  KEY: "chinScratch",
  PROBABILITY: 0.65, // 65% 확률로 발생
};

// 텍스트 상수
export const MESSAGES = {
  THINKING_TEXT: "대구-대구가 생각 중... 💭",
  DEFAULT_ERROR: "미안, 뭔가 문제가 생겼어! 다시 해볼래? 😅",
  PLACEHOLDER: "대구-대구에게 메시지를 보내세요...",
};

// 장소별 배경 패턴 이미지
export const PATTERN_IMAGES = {
  dongseongro: `${process.env.PUBLIC_URL}/assets/images/patterns/dongseongro.png`,
  dalseong: `${process.env.PUBLIC_URL}/assets/images/patterns/dalseong.png`,
  suseongmot: `${process.env.PUBLIC_URL}/assets/images/patterns/suseongmot.png`,
};

// 제안 최소 턴 수
export const SUGGESTION_THRESHOLDS = {
  USER_MIN: 3,
  ASSIST_MIN: 2,
};

// 디버그 모드
export const DEBUG_MODE = process.env.REACT_APP_DEBUG === 'true';
