/**
 * 감정 분석 유틸리티
 * - 사용자 메시지 및 AI 응답에서 감정 추출
 */

/**
 * AI 응답에서 감정 분석
 * @param {string} message - AI 메시지
 * @param {string} stage - 현재 대화 단계
 * @param {string} userMessage - 사용자 메시지
 * @returns {string} - 감정 (happy, sad, angry, excited, surprised, thinking, confused, worry)
 */
function analyzeEmotion(message, stage, userMessage) {
  const msg = (message || '').toLowerCase();
  const userMsg = (userMessage || '').toLowerCase();

  // 무효한 입력에는 당황 표정
  if (!message || message.includes('?왜카노') || message.includes('어디 아프니')) {
    return 'confused';
  }

  // 1단계: 사용자 감정 분석 (공감 우선)
  const userEmotion = analyzeUserEmotion(userMsg);
  if (userEmotion) {
    return userEmotion;
  }

  // 2단계: AI 응답 내용 분석
  const aiEmotion = analyzeAIEmotion(msg);
  if (aiEmotion) {
    return aiEmotion;
  }

  // 3단계: 기본 단계별 감정
  return getDefaultEmotionByStage(stage);
}

/**
 * 사용자 메시지에서 감정 분석
 */
function analyzeUserEmotion(userMsg) {
  // 슬픔 감정
  const sadEmoticons = ['ㅠ', 'ㅜ', 'ㅡㅡ', '...', '흑'];
  const sadKeywords = ['슬퍼', '힘들어', '우울', '외로', '쓸쓸', '속상', '울고', '눈물'];
  if (hasAny(userMsg, sadEmoticons) || hasAny(userMsg, sadKeywords)) {
    return 'sad';
  }

  // 분노 감정
  const angryKeywords = ['화나', '짜증', '싫어', '별로', '안돼', '못해', '최악', '빡쳐'];
  if (hasAny(userMsg, angryKeywords)) {
    return 'angry';
  }

  // 걱정/불안 감정
  const worryKeywords = ['걱정', '불안', '무서워', '두려워', '떨려'];
  if (hasAny(userMsg, worryKeywords)) {
    return 'worry';
  }

  // 기쁨/신남 감정 (우선순위 높임)
  const excitedEmoticons = ['ㅋ', 'ㅎ'];
  const excitedKeywords = ['좋아', '최고', '굿', '완전', '너무', '신난다', '신나', '재밌', '재미', '좋다', '좋네', '끝내주', '짱'];
  if (hasRepeatedEmoticon(userMsg, excitedEmoticons) || hasAny(userMsg, excitedKeywords)) {
    return 'excited';
  }

  // 놀람 감정
  const surprisedEmoticons = ['!', '!!', '헉', '어머'];
  const surprisedKeywords = ['대박', '진짜?', '정말?', '놀라', '어머', '헐'];
  if (hasAny(userMsg, surprisedEmoticons) || hasAny(userMsg, surprisedKeywords)) {
    return 'surprised';
  }

  return null;
}

/**
 * AI 응답에서 감정 분석
 */
function analyzeAIEmotion(msg) {
  const angryKeywords = ['화나', '짜증', '싫어', '별로', '안돼', '못해', '최악', '빡쳐'];
  if (hasAny(msg, angryKeywords)) {
    return 'angry';
  }

  const sadKeywords = ['슬퍼', '힘들어', '우울', '외로', '쓸쓸', '속상', '울고', '눈물'];
  if (hasAny(msg, sadKeywords)) {
    return 'sad';
  }

  const worryKeywords = ['걱정', '불안', '무서워', '두려워', '떨려'];
  if (hasAny(msg, worryKeywords)) {
    return 'worry';
  }

  const surprisedKeywords = ['대박', '진짜?', '정말?', '놀라', '어머', '헐'];
  if (hasAny(msg, surprisedKeywords)) {
    return 'surprised';
  }

  const aiExcitedKeywords = ['어때', '가볼래', '가자'];
  if (hasAny(msg, aiExcitedKeywords)) {
    return 'excited';
  }

  // 생각중 감정 (질문에 답하는 중)
  if (msg.includes('?') || msg.includes('뭐') || msg.includes('어떤')) {
    return 'thinking';
  }

  // 기쁨 감정 (기본 긍정)
  const happyKeywords = ['좋', '감사', '고마워', '반가', '안녕', '즐거', '행복'];
  if (hasAny(msg, happyKeywords)) {
    return 'happy';
  }

  return null;
}

/**
 * 단계별 기본 감정
 */
function getDefaultEmotionByStage(stage) {
  const stageEmotions = {
    'greeting': 'happy',
    'preference': 'thinking',
    'recommendation': 'excited',
    'enroute': 'thinking',
    'arrived': 'happy'
  };

  return stageEmotions[stage] || 'happy';
}

/**
 * 배열의 요소가 문자열에 포함되어 있는지 확인
 */
function hasAny(text, keywords) {
  return keywords.some(keyword => text.includes(keyword));
}

/**
 * 반복된 이모티콘이 있는지 확인 (ㅋㅋ, ㅎㅎ 등)
 */
function hasRepeatedEmoticon(text, emoticons) {
  return emoticons.some(emo => text.includes(emo.repeat(2)));
}

module.exports = {
  analyzeEmotion,
  analyzeUserEmotion,
  analyzeAIEmotion,
  getDefaultEmotionByStage
};
