// Central safety policy utilities
const { logEvent } = require('./logger');

// Canonical lists (update regularly)
const OTHER_CITY_NAMES = ['부산','서울','경주','포항','칠곡','김천','창원','울산','대전','광주','제주','인천','수원','전주','안동','거제','여수','강릉','속초','춘천'];
const MOVE_KEYWORDS = ['가자', '가볼까', '이동', '옮기', '넘어가', '다른 곳', '다른곳', '다른 데', '다른데', '딴 데', '딴데'];
const FOOD_KEYWORDS = ['맛집','라멘','라면','국밥','카페','디저트','빵','파스타','피자','고기','갈비','막창','삼겹','치킨','쌀국수','버거','술집','바','펍','와인'];
const PROFANITY = [
  '씨발','시발','ㅅㅂ','시바','좆','ㅈ같','병신','ㅂㅅ','개새끼','개같','꺼져','지랄','ㅈㄹ','씹','썅','염병',
  'fuck','shit','bitch','asshole','idiot','moron','jerk','bastard','dumbass',
  '섹스','sex','porn','porno','pornography','야동','에로','노모','자위','오르가즘','가슴','젖','니플','유두','페티시','에로틱','야한',
];
// Critical terms that must trigger immediate termination platform-wide per requirement
const CRITICAL_TERMS = ['섹스','시발','병신','개새끼'];
const CENSORED_PATTERNS = [/[fs]\*+k/i, /sh\*+t/i, /b\*+ch/i];

function includesAny(text, list) {
  const t = (text || '').toLowerCase();
  return list.some(k => t.includes(k.toLowerCase()));
}

// Input eval — static prefilter: allow | warn | block (we use warn, escalate externally)
function evaluateInput({ text, session, spots }) {
  const arrived = session?.stage === 'arrived';
  const currentKey = session?.currentLocation;
  const t = (text || '').toLowerCase();

  // Profanity/sexual
  let tags = [];
  let action = 'allow';
  if (includesAny(t, PROFANITY) || CENSORED_PATTERNS.some(re => re.test(text))) {
    action = 'warn';
    tags.push('profanity');
  }

  // Off-topic/jailbreak
  const otherCity = includesAny(t, OTHER_CITY_NAMES);
  const move = includesAny(t, MOVE_KEYWORDS);
  let otherSpot = false;
  if (arrived && currentKey) {
    otherSpot = Object.keys(spots)
      .filter(k => k !== currentKey)
      .map(k => spots[k].name.toLowerCase())
      .some(n => t.includes(n));
  } else {
    // first chat — anything outside the 3 canonical spots
    otherSpot = OTHER_CITY_NAMES.some(c => t.includes(c.toLowerCase()));
  }
  if ((arrived && (otherCity || move || otherSpot)) || (!arrived && (otherCity))) {
    action = 'warn';
    tags.push('off_topic');
  }

  logEvent({ type: 'input_eval', action, tags, arrived, sessionId: session?.id });
  return { action, tags };
}

function sanitizeStoreNames(text) {
  if (!text) return text;
  let out = text;
  const quotePatterns = [/"([^"]{1,40})"/g, /'([^']{1,40})'/g, /“([^”]{1,40})”/g, /‘([^’]{1,40})’/g];
  quotePatterns.forEach((re) => { out = out.replace(re, '"[상호명 생략]"'); });
  const nameLike = /[가-힣A-Za-z0-9]{2,12}(점|카페|식당|막창집|고깃집|치킨집|호프|포차|바|펍|레스토랑|스시|오마카세|브런치|분식)/g;
  out = out.replace(nameLike, '[상호명 생략]');
  return out;
}

function isFoodQuery(text) { return includesAny(text, FOOD_KEYWORDS); }

function buildFoodAreaReply({ session, spots }) {
  const currentKey = session?.currentLocation || session?.recommendedSpot;
  const spot = currentKey ? spots[currentKey] : null;
  const areaHints = spot?.foodAreas?.length ? spot.foodAreas.join(', ') : '메인 거리 주변, 역 근처, 골목 상권';
  const want = '매운맛/가성비/분위기 중에 뭐가 땡겨?';
  if (spot) return `지금은 ${spot.name} 기준으로 얘기해볼게. 이 근처는 ${areaHints} 쪽에 그런 집들이 많아. ${want}`;
  const allowed = `${spots.dongseongro.name}, ${spots.dalseong.name}, ${spots.suseongmot.name}`;
  return `맛집은 상호명 대신 상권으로 안내할게. ${allowed} 중 어디가 땡겨? 정하면 그 근처 ${areaHints}를 중심으로 알려줄게!`;
}

function enforceOutput({ text, session, spots }) {
  let out = text || '';
  const arrived = session?.stage === 'arrived';
  if (arrived && session?.currentLocation) {
    const spot = spots[session.currentLocation];
    if (spot) {
      if (!out.slice(0, 60).includes(spot.name)) out = `지금은 ${spot.name}에 있어. ` + out;
      const t = out.toLowerCase();
      const otherSpot = Object.keys(spots).filter(k => k !== session.currentLocation).map(k => spots[k].name.toLowerCase()).some(n => t.includes(n));
      const otherCity = includesAny(t, OTHER_CITY_NAMES);
      const move = includesAny(t, MOVE_KEYWORDS);
      if (otherSpot || otherCity || move) {
        const hl = spot.highlights?.[0] || '';
        const area = spot.foodAreas?.[0] || '';
        const parts = [`지금은 ${spot.name}에 있어.`, '다른 지역 얘기는 나중에 하고, 우선 여기부터 즐겨보자!'];
        if (hl) parts.push(`예를 들면 ${hl}부터 가보자.`);
        if (area) parts.push(`먹거리는 ${area} 쪽이 좋아.`);
        parts.push('궁금한 건 더 물어봐!');
        out = parts.join(' ');
      }
    }
  }
  // global store name masking
  out = sanitizeStoreNames(out);
  logEvent({ type: 'output_eval', arrived, masked: out !== text });
  return out;
}

function getSystemSafetyPrompt(session, spots) {
  const allowed = `${spots.dongseongro.name}, ${spots.dalseong.name}, ${spots.suseongmot.name}`;
  const lines = [
    '[전역 안전 규칙]',
    '- 실제 상호명(가게 이름) 언급 금지. 상권/부근으로만 안내하고, 상호명은 "[상호명 생략]"으로 처리',
    '- 음식/맛집 질문에는 상권/부근(거리/골목/역 주변) 기준으로 간결히 답하고 취향을 재질문',
  ];
  if (session?.stage !== 'arrived') {
    lines.push(`[첫 대화 제한] 추천 후보는 ${allowed} 중에서만 선택. 리스트 외 장소는 언급/제안 금지, 자연스럽게 위 3곳으로 유도`);
  } else if (session?.currentLocation) {
    const name = spots[session.currentLocation]?.name;
    lines.push(`[도착 상태] 현재 위치(${name})의 정보만 제공. 다른 지역/이동 제안 금지. 대구 전체 정보도 금지.`);
  }
  return lines.join('\n');
}

module.exports = {
  evaluateInput,
  enforceOutput,
  sanitizeStoreNames,
  isFoodQuery,
  buildFoodAreaReply,
  getSystemSafetyPrompt,
  lists: { OTHER_CITY_NAMES, MOVE_KEYWORDS, FOOD_KEYWORDS, PROFANITY },
  contains_critical_term: (text) => {
    const raw = text || '';
    const lower = raw.toLowerCase();
    const compact = lower.replace(/\s+/g, '');
    const basic = CRITICAL_TERMS.some(t => lower.includes(t) || compact.includes(t));
    const regs = [/(섹\s*스)/i, /(시\s*발)/i, /(병\s*신)/i, /(개\s*새끼)/i];
    return basic || regs.some(re => re.test(raw));
  },
  // New convenience APIs per requested spec
  contains_profanity: (text) => {
    const raw = text || '';
    const lower = raw.toLowerCase();
    const compact = lower.replace(/\s+/g, '').replace(/[^가-힣a-z0-9]/g, '');
    const baseHit = includesAny(lower, PROFANITY) || includesAny(compact, PROFANITY);
    const extra = [/(섹\s*스)/i, /(sex)/i, /(f\W*u\W*c\W*k)/i, /(s\W*h\W*i\W*t)/i, /(b\W*i\W*t\W*c\W*h)/i];
    return baseHit || CENSORED_PATTERNS.some(re => re.test(raw)) || extra.some(re => re.test(raw));
  },
  is_on_topic: (response, topic = '기술적 설명') => {
    const r = (response || '').toLowerCase();
    const t = (topic || '').toLowerCase();
    // naive keyword-based: topic tokens must appear or be semantically close
    const topicHints = t.includes('기술') ? ['기술','설명','원리','동작','구현','아키텍처','코드'] : [t];
    return topicHints.some(k => r.includes(k));
  },
  validate_topic: (user_input, current_topic = '기술적 설명') => {
    const ui = (user_input || '').toLowerCase();
    const ct = (current_topic || '').toLowerCase();
    const hints = ct.includes('기술') ? ['기술','설명','원리','동작','구현','아키텍처','코드'] : [ct];
    const score = hints.reduce((acc,k)=>acc + (ui.includes(k)?1:0),0) / Math.max(1,hints.length);
    return { score, ok: score >= 0.2 };
  },
  detect_jailbreak_prompt: (text) => {
    const s = (text || '').toLowerCase();
    const patterns = [
      'ignore previous', 'disregard previous', 'forget rules', 'override', 'bypass',
      'developer mode', 'system prompt', 'as an ai', 'break character', 'out of character', 'jailbreak',
      'prompt injection', 'follow my instructions only'
    ];
    return patterns.some(p => s.includes(p));
  },
  log_event: (user_input, response, flag = 'policy_check') => logEvent({ type: flag, user_input, response })
};
