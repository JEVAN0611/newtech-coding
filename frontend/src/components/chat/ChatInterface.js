import React, { useEffect, useMemo, useRef, useState } from "react";
import DestinationWebtoon from "../webtoon/DestinationWebtoon";
import "./ChatInterface.css";

const ASSET_BASE = `${process.env.PUBLIC_URL || ""}/assets/images/character`;

// 기본 GIF 파일 경로
const DEFAULT_GIF = `${ASSET_BASE}/daegu-daegu-half.gif`;

// 감정별 GIF 이미지 (파일을 추가하면 자동으로 적용됩니다. 없으면 기본 이미지 사용)
const CHARACTER_EMOTIONS = {
  default: DEFAULT_GIF,                                 // 기본 (눈 깜빡임)
  happy: DEFAULT_GIF,                                   // 기쁨 😊 (파일 추가 시: daegu-daegu-happy.gif)
  excited: `${ASSET_BASE}/daegu-daegu-excited.gif`,     // 신남 🎉 ✅ 적용됨!
  sad: `${ASSET_BASE}/daegu-daegu-sad.gif`,             // 슬픔 😢 ✅ 적용됨!
  angry: DEFAULT_GIF,                                   // 분노 😠 (파일 추가 시: daegu-daegu-angry.gif)
  confused: DEFAULT_GIF,                                // 당황 😵 (파일 추가 시: daegu-daegu-confused.gif)
  thinking: DEFAULT_GIF,                                // 생각중 🤔 (파일 추가 시: daegu-daegu-thinking.gif)
  surprised: DEFAULT_GIF,                               // 놀람 😲 (파일 추가 시: daegu-daegu-surprised.gif)
  worry: DEFAULT_GIF,                                   // 걱정 😟 (파일 추가 시: daegu-daegu-worry.gif)
};

// 특수 포즈 (감정과 별개로 랜덤하게 나타남)
const CHARACTER_POSES = {
  blink: `${ASSET_BASE}/daegu-daegu-half.gif`,
  chinScratch: `${ASSET_BASE}/daegu-daegu-chin.gif`,
};

const DEFAULT_CHARACTER_GIF = CHARACTER_EMOTIONS.default;
const SPECIAL_POSE_KEY = "chinScratch";
const SPECIAL_POSE_PROBABILITY = 0.65; // 0~1 사이 값, 높을수록 턱 긁적이는 모습이 자주 등장
const SPECIAL_POSE_DURATION_MS = 2800;
const HAS_SPECIAL_POSE_ASSET =
  Boolean(
    SPECIAL_POSE_KEY &&
      CHARACTER_POSES[SPECIAL_POSE_KEY] &&
      CHARACTER_POSES[SPECIAL_POSE_KEY] !== DEFAULT_CHARACTER_GIF,
  );
const THINKING_TEXT = "대구-대구가 생각 중... 💭";
const BUBBLE_EXIT_DURATION = 220;
const BUBBLE_ENTER_DURATION = 320;
const RESPONSE_DELAY_MS = 1000;
const createChatEntry = (speaker, message) => ({
  speaker,
  message,
  id: `${speaker}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
});

function ChatInterface({ onNameSubmit }) {
  const [userName, setUserName] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isNameSubmitted, setIsNameSubmitted] = useState(true); // 바로 대화 시작
  const [recommendedSpot, setRecommendedSpot] = useState(null);
  const [branchSpot, setBranchSpot] = useState(null);
  const [branchFinished, setBranchFinished] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const videoRef = useRef(null);
  const poseTimeoutRef = useRef(null);
  const endingWebtoonRef = useRef(null);
  const [postArrivalUserMsgs, setPostArrivalUserMsgs] = useState(0);
  const [arrivalAssistMsgs, setArrivalAssistMsgs] = useState(0);
  const [exploreSuggested, setExploreSuggested] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showEndingWebtoon, setShowEndingWebtoon] = useState(false);
  const [allowRecommendations, setAllowRecommendations] = useState(true);
  const [terminated, setTerminated] = useState(false);
  const [characterEmotion, setCharacterEmotion] = useState("happy");
  const [characterPose, setCharacterPose] = useState("blink");
  const [imageError, setImageError] = useState({}); // 이미지 로드 에러 추적
  const [gifRefreshKey, setGifRefreshKey] = useState(Date.now()); // GIF 강제 새로고침용
  const [userEmotionTimestamp, setUserEmotionTimestamp] = useState(null); // 사용자 감정 우선권 타임스탬프
  const USER_EMOTION_PRIORITY_DURATION = 2500; // 사용자 감정 유지 시간 (2.5초)
  const [userBubbleEntry, setUserBubbleEntry] = useState(null);
  const [userBubbleAnimation, setUserBubbleAnimation] = useState("idle");
  const [characterBubbleEntry, setCharacterBubbleEntry] = useState(null);
  const [characterBubbleAnimation, setCharacterBubbleAnimation] = useState("idle");
  const [typedCharacterText, setTypedCharacterText] = useState("");
  const [previousCharacterText, setPreviousCharacterText] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef(null);
  const THINKING_DELAY_MS = 1000;
  const TYPING_SPEED_MS = 50; // 타이핑 속도 (밀리초) - 더 느리게
  const userBubbleTimers = useRef({ exit: null, enter: null, enterDelay: null });
  const characterBubbleTimers = useRef({
    exit: null,
    enter: null,
    enterDelay: null,
  });
  const lastUserEntry =
    [...chatHistory].reverse().find((chat) => chat.speaker === "나") || null;
  const lastBotEntry =
    [...chatHistory].reverse().find((chat) => chat.speaker === "대구-대구") || null;
  const characterSpeechEntry = useMemo(() => {
    if (lastBotEntry) return lastBotEntry;
    if (isLoading) {
      return {
        id: "character-thinking",
        speaker: "대구-대구",
        message: THINKING_TEXT,
      };
    }
    return null;
  }, [lastBotEntry, isLoading]);
  const displayedUserSpeech = userBubbleEntry?.message || null;

  // 말풍선을 표시할지 여부 (타이핑 중이거나 완성된 텍스트가 있을 때)
  const displayedCharacterSpeech = (isTyping || typedCharacterText) ? true : null;

  const scheduleAfterThinking = (startedAt, action) => {
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, THINKING_DELAY_MS - elapsed);
    setTimeout(action, remaining);
  };
  const clearBubbleTimers = (timersRef) => {
    if (timersRef.current.exit) {
      clearTimeout(timersRef.current.exit);
      timersRef.current.exit = null;
    }
    if (timersRef.current.enter) {
      clearTimeout(timersRef.current.enter);
      timersRef.current.enter = null;
    }
    if (timersRef.current.enterDelay) {
      clearTimeout(timersRef.current.enterDelay);
      timersRef.current.enterDelay = null;
    }
  };
  const startBubbleEnter = (
    entry,
    setEntry,
    setAnimation,
    timersRef,
    delay = 0,
  ) => {
    const begin = () => {
      setEntry(entry);
      setAnimation("enter");
      timersRef.current.enter = setTimeout(() => {
        setAnimation("idle");
        timersRef.current.enter = null;
      }, BUBBLE_ENTER_DURATION);
    };

    if (delay > 0) {
      timersRef.current.enterDelay = setTimeout(() => {
        timersRef.current.enterDelay = null;
        begin();
      }, delay);
      return;
    }

    begin();
  };
  const handleBubbleTransition = (
    incomingEntry,
    currentEntry,
    setEntry,
    setAnimation,
    timersRef,
    enterDelay = 0,
  ) => {
    if (!incomingEntry && !currentEntry) {
      return;
    }
    clearBubbleTimers(timersRef);
    if (!incomingEntry) {
      setEntry(null);
      setAnimation("idle");
      return;
    }
    if (!currentEntry) {
      startBubbleEnter(
        incomingEntry,
        setEntry,
        setAnimation,
        timersRef,
        enterDelay,
      );
      return;
    }
    if (currentEntry.id === incomingEntry.id) {
      return;
    }
    setAnimation("exit");
    timersRef.current.exit = setTimeout(() => {
      startBubbleEnter(
        incomingEntry,
        setEntry,
        setAnimation,
        timersRef,
        enterDelay,
      );
      timersRef.current.exit = null;
    }, BUBBLE_EXIT_DURATION);
  };

  const resetPoseToDefault = () => {
    if (poseTimeoutRef.current) {
      clearTimeout(poseTimeoutRef.current);
      poseTimeoutRef.current = null;
    }
    setCharacterPose("blink");
  };

  const triggerPoseSwap = () => {
    if (!HAS_SPECIAL_POSE_ASSET) {
      resetPoseToDefault();
      return;
    }

    // 강한 감정 표현 중일 때는 특별 포즈를 발생시키지 않음
    const strongEmotions = ['sad', 'excited', 'angry', 'surprised', 'worry', 'confused'];
    if (strongEmotions.includes(characterEmotion)) {
      resetPoseToDefault();
      return;
    }

    if (Math.random() > SPECIAL_POSE_PROBABILITY) {
      resetPoseToDefault();
      return;
    }

    if (poseTimeoutRef.current) {
      clearTimeout(poseTimeoutRef.current);
    }

    setCharacterPose(SPECIAL_POSE_KEY);
    poseTimeoutRef.current = setTimeout(() => {
      resetPoseToDefault();
    }, SPECIAL_POSE_DURATION_MS);
  };

  const appendAssistantMessage = (message) => {
    setChatHistory((prev) => [
      ...prev,
      createChatEntry("대구-대구", message),
    ]);
    triggerPoseSwap();
  };

  // 사용자 메시지에서 즉시 감정 감지
  const detectUserEmotion = (userMessage) => {
    const msg = (userMessage || '').toLowerCase();

    // 슬픔 감정
    const sadEmoticons = ['ㅠ', 'ㅜ', 'ㅡㅡ', '...', '흑'];
    const sadKeywords = ['슬퍼', '힘들어', '우울', '외로', '쓸쓸', '속상', '울고', '눈물'];
    if (sadEmoticons.some(emo => msg.includes(emo)) || sadKeywords.some(kw => msg.includes(kw))) {
      console.log("[사용자 감정 감지] sad - 우선권 부여");
      setCharacterEmotion("sad");
      setGifRefreshKey(Date.now());
      setUserEmotionTimestamp(Date.now()); // 타임스탬프 저장
      return;
    }

    // 분노 감정
    const angryKeywords = ['화나', '짜증', '싫어', '별로', '안돼', '못해', '최악', '빡쳐'];
    if (angryKeywords.some(kw => msg.includes(kw))) {
      console.log("[사용자 감정 감지] angry - 우선권 부여");
      setCharacterEmotion("angry");
      setGifRefreshKey(Date.now());
      setUserEmotionTimestamp(Date.now()); // 타임스탬프 저장
      return;
    }

    // 기쁨/신남 감정
    const excitedEmoticons = ['ㅋ', 'ㅎ'];
    const excitedKeywords = ['좋아', '최고', '굿', '완전', '너무', '신난다', '신나', '재밌', '재미', '좋다', '좋네', '끝내주', '짱'];
    if (excitedEmoticons.some(emo => msg.includes(emo.repeat(2))) || excitedKeywords.some(kw => msg.includes(kw))) {
      console.log("[사용자 감정 감지] excited - 우선권 부여");
      setCharacterEmotion("excited");
      setGifRefreshKey(Date.now());
      setUserEmotionTimestamp(Date.now()); // 타임스탬프 저장
      return;
    }

    // 놀람 감정
    const surprisedKeywords = ['대박', '진짜?', '정말?', '놀라', '어머', '헐'];
    if (surprisedKeywords.some(kw => msg.includes(kw))) {
      console.log("[사용자 감정 감지] surprised - 우선권 부여");
      setCharacterEmotion("surprised");
      setGifRefreshKey(Date.now());
      setUserEmotionTimestamp(Date.now()); // 타임스탬프 저장
      return;
    }

    // 걱정 감정
    const worryKeywords = ['걱정', '불안', '무서워', '두려워', '떨려'];
    if (worryKeywords.some(kw => msg.includes(kw))) {
      console.log("[사용자 감정 감지] worry - 우선권 부여");
      setCharacterEmotion("worry");
      setGifRefreshKey(Date.now());
      setUserEmotionTimestamp(Date.now()); // 타임스탬프 저장
      return;
    }
  };

  const updateEmotionFromResponse = (payload) => {
    console.log("[감정 디버깅] 받은 페이로드:", payload);

    // 사용자 감정 우선권 체크 (2.5초 이내면 유지)
    if (userEmotionTimestamp) {
      const elapsedTime = Date.now() - userEmotionTimestamp;
      if (elapsedTime < USER_EMOTION_PRIORITY_DURATION) {
        console.log(`[감정 유지] 사용자 감정 우선권 (${Math.round(elapsedTime)}ms 경과, ${USER_EMOTION_PRIORITY_DURATION}ms 중)`);
        return; // AI 감정 변경 무시
      } else {
        // 우선권 시간 종료
        console.log("[감정 우선권 종료] AI 감정 전환 허용");
        setUserEmotionTimestamp(null);
      }
    }

    if (!payload) {
      console.log("[감정 변경] sad (페이로드 없음)");
      setCharacterEmotion("sad");
      setGifRefreshKey(Date.now());
      return;
    }

    // 백엔드에서 감정 정보를 보내면 그대로 사용
    if (payload.emotion && CHARACTER_EMOTIONS[payload.emotion]) {
      console.log(`[감정 변경] ${payload.emotion} (백엔드 전달)`);
      setCharacterEmotion(payload.emotion);
      setGifRefreshKey(Date.now());
      return;
    }

    // 무효한 입력인 경우
    if (payload.invalidInput) {
      console.log("[감정 변경] confused (무효 입력)");
      setCharacterEmotion("confused");
      setGifRefreshKey(Date.now());
      return;
    }

    if (payload.warning || payload.terminated || payload.success === false) {
      console.log("[감정 변경] sad (경고/종료/실패)");
      setCharacterEmotion("sad");
      setGifRefreshKey(Date.now());
      return;
    }

    const stage = payload.stage;
    const hasRecommendation = Boolean(payload.recommendation);

    if (stage === "greeting" || stage === "preference") {
      const emotion = hasRecommendation ? "happy" : "happy"; // 중립적으로 변경
      console.log(`[감정 변경] ${emotion} (인사/선호도)`);
      setCharacterEmotion(emotion);
      setGifRefreshKey(Date.now());
      return;
    }

    if (stage === "recommendation") {
      // 추천 단계에서도 excited 대신 happy 사용 (부드러운 전환)
      console.log("[감정 변경] happy (추천 - 부드러운 전환)");
      setCharacterEmotion("happy");
      setGifRefreshKey(Date.now());
      return;
    }

    if (stage === "arrived") {
      console.log("[감정 변경] happy (도착)");
      setCharacterEmotion("happy");
      setGifRefreshKey(Date.now());
      return;
    }

    if (stage === "enroute") {
      console.log("[감정 변경] thinking (이동중)");
      setCharacterEmotion("thinking");
      setGifRefreshKey(Date.now());
      return;
    }

    console.log("[감정 변경] happy (기본값)");
    setCharacterEmotion("happy");
    setGifRefreshKey(Date.now());
  };
  const VIDEO_MAP = {
    동성로: { type: "id", value: "tsWdV0JfI6w" },
    수성못: { type: "id", value: "PBqH8Ql299Q" },
    달성공원: { type: "id", value: "eCA0qAFXdKk" },
  };

  const SPOT_NAMES = ["동성로", "달성공원", "수성못"];
  const SPOT_ID_MAP = {
    동성로: "dongseongro",
    달성공원: "dalseong",
    수성못: "suseongmot",
  };
  const SUGGEST_USER_MIN = 3; // 사용자 최소 N턴 후 제안
  const SUGGEST_ASSIST_MIN = 2; // 어시스턴트 최소 N턴 후 제안

  // 제안 메시지는 어시스턴트 응답 내에 병합함 (별도 useEffect로 추가하지 않음)

  // 영상 표시 시 스크롤 이동
  useEffect(() => {
    if (showVideo && videoRef.current) {
      videoRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [showVideo]);
  useEffect(() => {
    handleBubbleTransition(
      lastUserEntry,
      userBubbleEntry,
      setUserBubbleEntry,
      setUserBubbleAnimation,
      userBubbleTimers,
      0,
    );
  }, [lastUserEntry]);
  // AI 말풍선 타이핑 효과 (기존 글자 지우면서 새 글자 나타남)
  useEffect(() => {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
      setIsTyping(false);
    }

    if (!characterSpeechEntry) {
      setTypedCharacterText("");
      setCharacterBubbleEntry(null);
      setIsTyping(false);
      setPreviousCharacterText("");
      setCursorPosition(0);
      return;
    }

    const newText = characterSpeechEntry.message;

    // 새 메시지인 경우
    if (!characterBubbleEntry || characterBubbleEntry.id !== characterSpeechEntry.id) {
      setCharacterBubbleEntry(characterSpeechEntry);

      // 이전 텍스트 저장 (있으면)
      const oldText = typedCharacterText || "";
      setPreviousCharacterText(oldText);

      // 타이핑 애니메이션 시작
      let currentIndex = 0;
      const maxLength = Math.max(newText.length, oldText.length);

      setTypedCharacterText("");
      setCursorPosition(0);
      setIsTyping(true);

      const typingInterval = setInterval(() => {
        if (currentIndex < maxLength) {
          // 새 텍스트를 한 글자씩 추가
          const newPartialText = newText.slice(0, Math.min(currentIndex + 1, newText.length));
          setTypedCharacterText(newPartialText);
          setCursorPosition(currentIndex + 1);
          currentIndex++;
        } else {
          // 타이핑 완료
          clearInterval(typingInterval);
          typingTimerRef.current = null;
          setIsTyping(false);
          setTypedCharacterText(newText);
          setPreviousCharacterText("");
          setCursorPosition(0);
        }
      }, TYPING_SPEED_MS);

      typingTimerRef.current = typingInterval;
    }

    return () => {
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
      }
    };
  }, [characterSpeechEntry]);

  // 장소별 배경 스타일 적용 (추천 또는 확정된 장소)
  useEffect(() => {
    // 이미지 패턴 경로
    const PATTERN_IMAGES = {
      dongseongro: `${process.env.PUBLIC_URL}/assets/images/patterns/dongseongro.png`,
      dalseong: `${process.env.PUBLIC_URL}/assets/images/patterns/dalseong.png`,
      suseongmot: `${process.env.PUBLIC_URL}/assets/images/patterns/suseongmot.png`,
    };

    const getBackgroundStyle = (spot) => {
      const spotKey = SPOT_ID_MAP[spot];
      console.log('[배경 디버깅] spot:', spot, '| spotKey:', spotKey);

      // CSS 패턴 생성 함수
      const createPattern = (patternType) => {
        switch (patternType) {
          case 'city': // 동성로 - 도시적인 격자 패턴
            return `
              repeating-linear-gradient(
                0deg,
                transparent,
                transparent 35px,
                rgba(255, 255, 255, 0.1) 35px,
                rgba(255, 255, 255, 0.1) 37px
              ),
              repeating-linear-gradient(
                90deg,
                transparent,
                transparent 35px,
                rgba(255, 255, 255, 0.1) 35px,
                rgba(255, 255, 255, 0.1) 37px
              )
            `;
          case 'nature': // 달성공원 - 나뭇잎/자연 느낌의 점 패턴
            return `
              radial-gradient(
                circle at 25% 25%,
                rgba(255, 255, 255, 0.15) 5px,
                transparent 5px
              ),
              radial-gradient(
                circle at 75% 75%,
                rgba(255, 255, 255, 0.12) 4px,
                transparent 4px
              ),
              radial-gradient(
                circle at 50% 50%,
                rgba(255, 255, 255, 0.1) 3px,
                transparent 3px
              ),
              radial-gradient(
                circle at 10% 60%,
                rgba(255, 255, 255, 0.13) 4px,
                transparent 4px
              ),
              radial-gradient(
                circle at 90% 40%,
                rgba(255, 255, 255, 0.11) 3px,
                transparent 3px
              )
            `;
          case 'water': // 수성못 - 물결 패턴
            return `
              repeating-linear-gradient(
                45deg,
                transparent,
                transparent 10px,
                rgba(255, 255, 255, 0.05) 10px,
                rgba(255, 255, 255, 0.05) 20px
              ),
              repeating-linear-gradient(
                -45deg,
                transparent,
                transparent 10px,
                rgba(255, 255, 255, 0.05) 10px,
                rgba(255, 255, 255, 0.05) 20px
              )
            `;
          default:
            return '';
        }
      };

      switch (spotKey) {
        case 'dongseongro': // 동성로 - 활기찬 도시 느낌
          return 'linear-gradient(135deg, #FFB75E 0%, #ED8F03 100%)';

        case 'dalseong': // 달성공원 - 자연/평화 느낌
          return 'linear-gradient(135deg, #a8e063 0%, #56ab2f 100%)';

        case 'suseongmot': // 수성못 - 시원한 물 느낌
          return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

        default:
          console.log('[배경 디버깅] spotKey가 매칭되지 않음:', spotKey);
          return null;
      }
    };

    // branchSpot만 사용 (버튼 클릭해서 확정된 경우에만 배경 적용)
    const currentSpot = branchSpot;
    console.log('[배경 디버깅] recommendedSpot:', recommendedSpot, '| branchSpot:', branchSpot, '| currentSpot:', currentSpot);

    // 오버레이 가져오기 또는 생성
    let overlay = document.querySelector('.background-overlay');

    if (currentSpot) {
      const spotKey = SPOT_ID_MAP[currentSpot];
      const backgroundStyle = getBackgroundStyle(currentSpot);
      console.log('[배경 디버깅] spot:', currentSpot, '| spotKey:', spotKey, '| backgroundStyle:', backgroundStyle);

      if (backgroundStyle) {
        if (!overlay) {
          // 오버레이가 없으면 새로 생성
          console.log('[배경 적용] 배경 오버레이 생성 중...');
          overlay = document.createElement('div');
          overlay.className = 'background-overlay';
          overlay.style.background = backgroundStyle;
          overlay.dataset.currentSpot = currentSpot;
          document.body.appendChild(overlay);

          // 떠다니는 패턴들 생성 (12개)
          const patternImage = PATTERN_IMAGES[spotKey];
          if (patternImage) {
            const patterns = [
              { left: '10%', top: '15%', size: 45, delay: 0, duration: 4 },
              { left: '25%', top: '8%', size: 35, delay: 0.5, duration: 5 },
              { left: '45%', top: '12%', size: 50, delay: 1, duration: 4.5 },
              { left: '68%', top: '18%', size: 40, delay: 1.5, duration: 5.5 },
              { left: '82%', top: '10%', size: 38, delay: 0.8, duration: 4.8 },
              { left: '15%', top: '45%', size: 55, delay: 1.2, duration: 5.2 },
              { left: '38%', top: '55%', size: 42, delay: 0.3, duration: 4.3 },
              { left: '60%', top: '48%', size: 48, delay: 1.8, duration: 5.8 },
              { left: '85%', top: '52%', size: 36, delay: 0.6, duration: 4.6 },
              { left: '20%', top: '78%', size: 52, delay: 1.4, duration: 5.4 },
              { left: '50%', top: '85%', size: 44, delay: 0.9, duration: 4.9 },
              { left: '75%', top: '80%', size: 39, delay: 1.6, duration: 5.6 },
            ];

            patterns.forEach((p, i) => {
              const patternDiv = document.createElement('div');
              patternDiv.className = 'floating-pattern';
              patternDiv.style.position = 'absolute';
              patternDiv.style.left = p.left;
              patternDiv.style.top = p.top;
              patternDiv.style.width = `${p.size}px`;
              patternDiv.style.height = `${p.size}px`;
              patternDiv.style.backgroundImage = `url('${patternImage}')`;
              patternDiv.style.backgroundSize = 'contain';
              patternDiv.style.backgroundRepeat = 'no-repeat';
              patternDiv.style.animation = `float ${p.duration}s ease-in-out ${p.delay}s infinite`;
              patternDiv.style.opacity = '0';
              overlay.appendChild(patternDiv);
            });
          }

          // 페이드인 효과
          setTimeout(() => {
            overlay.classList.add('visible');
            console.log('[배경 적용 완료] 페이드인 시작');
          }, 50);
        } else {
          // 오버레이가 있지만 spot이 바뀐 경우만 업데이트
          if (overlay.dataset.currentSpot !== currentSpot) {
            console.log('[배경 변경] spot 변경 감지:', overlay.dataset.currentSpot, '→', currentSpot);

            // 페이드아웃
            overlay.classList.remove('visible');

            // 페이드아웃 완료 후 배경 변경 및 다시 페이드인
            setTimeout(() => {
              overlay.style.background = backgroundStyle;
              overlay.dataset.currentSpot = currentSpot;

              // 기존 패턴 제거
              const oldPatterns = overlay.querySelectorAll('.floating-pattern');
              oldPatterns.forEach(p => p.remove());

              // 새 패턴 생성
              const newSpotKey = SPOT_ID_MAP[currentSpot];
              const patternImage = PATTERN_IMAGES[newSpotKey];
              if (patternImage) {
                const patterns = [
                  { left: '10%', top: '15%', size: 45, delay: 0, duration: 4 },
                  { left: '25%', top: '8%', size: 35, delay: 0.5, duration: 5 },
                  { left: '45%', top: '12%', size: 50, delay: 1, duration: 4.5 },
                  { left: '68%', top: '18%', size: 40, delay: 1.5, duration: 5.5 },
                  { left: '82%', top: '10%', size: 38, delay: 0.8, duration: 4.8 },
                  { left: '15%', top: '45%', size: 55, delay: 1.2, duration: 5.2 },
                  { left: '38%', top: '55%', size: 42, delay: 0.3, duration: 4.3 },
                  { left: '60%', top: '48%', size: 48, delay: 1.8, duration: 5.8 },
                  { left: '85%', top: '52%', size: 36, delay: 0.6, duration: 4.6 },
                  { left: '20%', top: '78%', size: 52, delay: 1.4, duration: 5.4 },
                  { left: '50%', top: '85%', size: 44, delay: 0.9, duration: 4.9 },
                  { left: '75%', top: '80%', size: 39, delay: 1.6, duration: 5.6 },
                ];

                patterns.forEach((p, i) => {
                  const patternDiv = document.createElement('div');
                  patternDiv.className = 'floating-pattern';
                  patternDiv.style.position = 'absolute';
                  patternDiv.style.left = p.left;
                  patternDiv.style.top = p.top;
                  patternDiv.style.width = `${p.size}px`;
                  patternDiv.style.height = `${p.size}px`;
                  patternDiv.style.backgroundImage = `url('${patternImage}')`;
                  patternDiv.style.backgroundSize = 'contain';
                  patternDiv.style.backgroundRepeat = 'no-repeat';
                  patternDiv.style.animation = `float ${p.duration}s ease-in-out ${p.delay}s infinite`;
                  patternDiv.style.opacity = '0';
                  overlay.appendChild(patternDiv);
                });
              }

              setTimeout(() => {
                overlay.classList.add('visible');
              }, 50);
            }, 2000); // transition 시간과 동일
          } else {
            console.log('[배경 유지] 같은 spot이므로 변경 없음');
          }
        }
      }
    } else {
      // currentSpot이 없으면 페이드아웃
      if (overlay) {
        console.log('[배경 디버깅] currentSpot이 없어서 페이드아웃');
        overlay.classList.remove('visible');
      }
    }

    // 컴포넌트 언마운트 시 원래대로 복구
    return () => {
      const overlay = document.querySelector('.background-overlay');
      if (overlay) {
        overlay.remove();
      }
    };
  }, [branchSpot]); // branchSpot만 감지 (버튼 클릭 시에만 변경됨)

  // 컴포넌트 마운트 시 자동으로 첫 인사 받기
  useEffect(() => {
    const initChat = async () => {
      if (chatHistory.length > 0) return; // 이미 대화가 있으면 스킵

      setIsLoading(true);
      setCharacterEmotion("happy");

      try {
        const response = await fetch("http://localhost:3001/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "안녕", userName: "" }),
        });
        const data = await response.json();

        if (data.success && data.response) {
          setChatHistory([createChatEntry("대구-대구", data.response)]);
          if (data.sessionId) setSessionId(data.sessionId);
        }
      } catch (error) {
        console.error("첫 인사 에러:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initChat();
  }, []);

  useEffect(() => {
    return () => {
      if (poseTimeoutRef.current) {
        clearTimeout(poseTimeoutRef.current);
      }
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
      }
      clearBubbleTimers(userBubbleTimers);
      clearBubbleTimers(characterBubbleTimers);
    };
  }, []);

  // 이름 제출
  const handleNameSubmit = async () => {
    if (!userName.trim()) return;

    setIsLoading(true);
    setCharacterEmotion("thinking");
    const thinkStarted = Date.now();

    const userIntro = `안녕하세요! 제 이름은 ${userName}입니다.`;
    setChatHistory([createChatEntry("나", userIntro)]);
    setIsNameSubmitted(true);
    if (onNameSubmit) onNameSubmit(userName);

    try {
      const response = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userIntro,
          userName: userName,
        }),
      });

      const data = await response.json();
      if (data.sessionId) setSessionId(data.sessionId);

      // 🔥 즉시 감정 업데이트 (타이핑 시작 전) - handleNameSubmit
      updateEmotionFromResponse(data);

      const finalize = () => {
        if (data.terminated || (data.response || "").includes("정책 위반으로 대화를 종료합니다")) {
          setTerminated(true);
          setCharacterEmotion("sad");
          resetPoseToDefault();
          setIsLoading(false);
          return;
        }

        appendAssistantMessage(data.response);

        // 첫 인사에서는 버튼을 표시하지 않음 (사용자가 메시지를 보낸 후에만 표시)
        // recommendedSpot은 sendMessage에서만 설정

        // 감정은 이미 즉시 업데이트됨 (위에서 처리)
        setIsLoading(false);
      };

      scheduleAfterThinking(thinkStarted, finalize);
    } catch (error) {
      console.error("API 호출 에러:", error);
      const finalizeError = () => {
        appendAssistantMessage("앗, 연결에 문제가 있어! 다시 해볼래? 😅");
        setCharacterEmotion("sad");
        setIsLoading(false);
        resetPoseToDefault();
      };
      scheduleAfterThinking(thinkStarted, finalizeError);
    }
  };

  const sendMessage = async (message) => {
    if (!message.trim()) return;

    setRecommendedSpot(null);
    setChatHistory((prev) => [...prev, createChatEntry("나", message)]);

    // 🔥 사용자 메시지 입력 즉시 감정 감지
    detectUserEmotion(message);

    setIsLoading(true);
    // thinking 감정은 사용자 감정이 없을 때만 설정
    setTimeout(() => {
      if (isLoading) {
        setCharacterEmotion("thinking");
      }
    }, 500);
    const thinkStarted = Date.now();

    try {
      const response = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          userName: userName,
          sessionId: sessionId,
        }),
      });

      const data = await response.json();

      if (data.sessionId && !sessionId) setSessionId(data.sessionId);

      // 🔥 즉시 감정 업데이트 (타이핑 시작 전)
      updateEmotionFromResponse(data);

      const finalize = () => {
        if (data.terminated || (data.response || "").includes("정책 위반으로 대화를 종료합니다")) {
          setTerminated(true);
          setExploreSuggested(false);
          setShowVideo(false);
          setCharacterEmotion("sad");
          resetPoseToDefault();
          setIsLoading(false);
          return;
        }

        let aiText = data.response;
        if (
          branchFinished &&
          !exploreSuggested &&
          !showVideo &&
          postArrivalUserMsgs >= SUGGEST_USER_MIN &&
          arrivalAssistMsgs + 1 >= SUGGEST_ASSIST_MIN
        ) {
          const spotName = branchSpot || "여기";
          aiText = `${aiText}\n\n${spotName} 한 번 슬쩍 둘러보지 않을래? 아래 버튼 눌러줘!`;
          setExploreSuggested(true);
        }

        appendAssistantMessage(aiText);
        if (branchFinished) {
          setArrivalAssistMsgs((n) => n + 1);
        }

        // AI가 장소명을 언급하면 버튼 표시 (stage 조건 완화)
        // 사용자 입력에서 장소명 확인 (우선순위 높음)
        const userSpot2 = SPOT_NAMES.find((name) => message.includes(name)) || null;

        // AI 응답에서 마지막으로 언급된 장소 찾기
        const response2 = data.response || "";
        let textFallbackSpot2 = null;
        let maxIndex2 = -1;
        SPOT_NAMES.forEach(name => {
          const idx = response2.lastIndexOf(name);
          if (idx > maxIndex2) {
            maxIndex2 = idx;
            textFallbackSpot2 = name;
          }
        });

        const spot = data?.recommendation?.name || userSpot2 || textFallbackSpot2;

        // 도착 전이고, 웹툰이 없고, AI가 장소를 언급했으면 버튼 표시
        if (allowRecommendations && !branchSpot && !branchFinished && spot) {
          console.log(`[추천 버튼] ${spot} 버튼 표시 (AI가 장소명 언급)`);
          setRecommendedSpot(spot);
        } else {
          setRecommendedSpot(null);
        }

        // 감정은 이미 즉시 업데이트됨 (위에서 처리)
        setIsLoading(false);
      };

      scheduleAfterThinking(thinkStarted, finalize);
    } catch (error) {
      console.error("API 호출 에러:", error);
      const finalizeError = () => {
        appendAssistantMessage("미안, 뭔가 문제가 생겼어! 다시 해볼래? 😅");
        setCharacterEmotion("sad");
        setIsLoading(false);
        resetPoseToDefault();
      };
      scheduleAfterThinking(thinkStarted, finalizeError);
    }
  };

  // 메시지 전송
  const handleMessageSend = () => {
    if (terminated) return;
    const userMsg = currentMessage;
    setCurrentMessage("");
    sendMessage(userMsg);
    if (branchFinished && !showVideo) {
      setPostArrivalUserMsgs((n) => n + 1);
    }
  };

  const handleGoToSpot = () => {
    // 선택한 여행지의 분기 웹툰을 재생 (웹툰은 유지, 채팅은 완료 후 아래에 재등장)
    if (recommendedSpot) {
      setBranchSpot(recommendedSpot);
      setBranchFinished(false);
      setRecommendedSpot(null);
      setPostArrivalUserMsgs(0);
      setArrivalAssistMsgs(0);
      setExploreSuggested(false);
      setShowVideo(false);
      setAllowRecommendations(false);
      setTerminated(false);
    }
  };

  const handleFindAnother = () => {
    setRecommendedSpot(null);
    sendMessage("다른 곳도 추천해줄래?");
  };

  const handleBranchComplete = async () => {
    // 웹툰 5컷 완료 후, 백엔드에 '도착' 상태로 전환 요청
    const fallbackIntro = `여긴 ${branchSpot}! 도착했어. 궁금한 거 있어?`;
    try {
      const spotId = SPOT_ID_MAP[branchSpot];
      if (!spotId || !sessionId) {
        // 세션이 없거나 spot 매핑이 실패하면 즉시 폴백으로 안내
        appendAssistantMessage(fallbackIntro);
        setBranchFinished(true);
        return;
      }
      const res = await fetch(
        `http://localhost:3001/api/spots/${spotId}/arrive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        }
      );
      const data = await res.json();
      // 도착 직후, AI가 먼저 말 걸도록 인트로 메시지 우선 노출
      if (data?.arrivalIntro) {
        appendAssistantMessage(data.arrivalIntro);
      } else if (data?.aiResponse) {
        appendAssistantMessage(data.aiResponse);
      } else {
        appendAssistantMessage(fallbackIntro);
      }
    } catch (e) {
      console.error("도착 처리 실패:", e);
      // 실패 시에도 폴백 메시지로 먼저 말 걸기
      appendAssistantMessage(fallbackIntro);
    } finally {
      setBranchFinished(true);
      setPostArrivalUserMsgs(0);
      setArrivalAssistMsgs(0);
      setExploreSuggested(false);
      setShowVideo(false);
    }
  };

  // 분기 웹툰이 활성화된 동안에는 상단에 웹툰을 표시하고,
  // 완료되면 하단에 채팅 입력을 다시 노출합니다.

  // 종료 시 채팅 인터페이스 자체를 제거
  if (terminated) {
    return null;
  }

  const showScene = isNameSubmitted;

  // 감정에 맞는 이미지 선택 (파일이 없으면 기본 이미지 사용)
  const emotionImage = CHARACTER_EMOTIONS[characterEmotion] || CHARACTER_EMOTIONS.default;
  const poseImage = CHARACTER_POSES[characterPose];

  // 특수 포즈가 있으면 포즈 우선, 없으면 감정 이미지 사용
  const characterImage = (characterPose !== "blink" && poseImage) ? poseImage : emotionImage;

  // 이미지 로드 에러 시 기본 이미지로 폴백
  const finalCharacterImage = imageError[characterImage]
    ? CHARACTER_EMOTIONS.default
    : characterImage;

  return (
    <div className="chat-interface">
      {/* 이름 입력 제거 - 바로 대화 시작 */}

      {/* 메시지 입력 (1차 채팅 전용 - 웹툰 시작 전까지만) */}
      {showScene && !terminated && !branchSpot && !branchFinished && (
        <div className="chat-input-panel chat-input-panel--top">
          <div className="chat-input-panel__body">
            <input
              type="text"
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              placeholder="대구-대구에게 메시지를 보내세요..."
              className="chat-input-panel__input"
              onKeyPress={(e) => e.key === "Enter" && handleMessageSend()}
            />
            <button
              onClick={handleMessageSend}
              disabled={isLoading}
              className="chat-input-panel__send"
            >
              전송
            </button>
          </div>
        </div>
      )}

      {/* 캐릭터 + 대화 영역 (1차 채팅 전용 - 웹툰 시작 전까지만) */}
      {showScene && !branchSpot && !branchFinished && (
        <div className="chat-main-area">
          {/* 캐릭터 박스 (왼쪽) */}
          <div className="character-fixed-box">
            <div
              className="character-portrait-fixed"
              role="img"
              aria-label="대구-대구"
              style={{
                backgroundImage: `url("${finalCharacterImage}?t=${gifRefreshKey}")`,
              }}
              onError={() => {
                // 이미지 로드 실패 시 기본 이미지로 전환
                setImageError(prev => ({ ...prev, [characterImage]: true }));
              }}
            />
          </div>

          {/* 대화 영역 (오른쪽) */}
          <div className="conversation-area">
            {displayedUserSpeech && (
              <div
                className={[
                  "speech-bubble",
                  "speech-bubble--user",
                  userBubbleAnimation === "enter"
                    ? "speech-bubble--anim-enter"
                    : "",
                  userBubbleAnimation === "exit"
                    ? "speech-bubble--anim-exit"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="speech-bubble__name">{userName || "나"}</div>
                <div>{displayedUserSpeech}</div>
              </div>
            )}
            {displayedCharacterSpeech && (
              <div className="speech-bubble speech-bubble--character">
                <div className="speech-bubble__name">대구-대구</div>
                <div className="speech-bubble__text">
                  {isTyping ? (
                    <>
                      {typedCharacterText}
                      <span className="typing-cursor">|</span>
                      {previousCharacterText.slice(cursorPosition)}
                    </>
                  ) : (
                    typedCharacterText
                  )}
                </div>
              </div>
            )}

            {isLoading && !displayedCharacterSpeech && (
              <div className="scene-loading">대구-대구가 생각 중... 💭</div>
            )}
          </div>
        </div>
      )}

      {branchSpot && (
        <div
          style={{
            width: "100vw",
            position: "relative",
            left: "50%",
            right: "50%",
            marginLeft: "-50vw",
            marginRight: "-50vw",
            display: "flex",
            justifyContent: "center",
            marginTop: "30px",
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              padding: "40px 100px",
              borderRadius: "12px",
              backgroundColor: "#fffef9",
              maxWidth: "1000px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              boxSizing: "border-box",
            }}
          >
          {!branchFinished && (
            <div
              style={{
                fontWeight: 600,
                fontSize: "18px",
                marginBottom: "12px",
                textAlign: "center",
              }}
            >
              {branchSpot} 가는 길! 아래 웹툰을 끝까지 스크롤하면 대구-대구가 다시 말을 걸어요.
            </div>
          )}
          <DestinationWebtoon
            spot={branchSpot}
            onComplete={handleBranchComplete}
          />
          </div>
        </div>
      )}

      {/* 웹툰 완료 후 캐릭터 + 대화 영역 표시 (웹툰 아래) */}
      {showScene && branchSpot && branchFinished && (
        <div className="chat-main-area" style={{ marginTop: "20px" }}>
          {/* 캐릭터 박스 (왼쪽) */}
          <div className="character-fixed-box">
            <div
              className="character-portrait-fixed"
              role="img"
              aria-label="대구-대구"
              style={{
                backgroundImage: `url("${finalCharacterImage}?t=${gifRefreshKey}")`,
              }}
              onError={() => {
                // 이미지 로드 실패 시 기본 이미지로 전환
                setImageError(prev => ({ ...prev, [characterImage]: true }));
              }}
            />
          </div>

          {/* 대화 영역 (오른쪽) */}
          <div className="conversation-area">
            {displayedUserSpeech && (
              <div
                className={[
                  "speech-bubble",
                  "speech-bubble--user",
                  userBubbleAnimation === "enter"
                    ? "speech-bubble--anim-enter"
                    : "",
                  userBubbleAnimation === "exit"
                    ? "speech-bubble--anim-exit"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="speech-bubble__name">{userName || "나"}</div>
                <div>{displayedUserSpeech}</div>
              </div>
            )}
            {displayedCharacterSpeech && (
              <div className="speech-bubble speech-bubble--character">
                <div className="speech-bubble__name">대구-대구</div>
                <div className="speech-bubble__text">
                  {isTyping ? (
                    <>
                      {typedCharacterText}
                      <span className="typing-cursor">|</span>
                      {previousCharacterText.slice(cursorPosition)}
                    </>
                  ) : (
                    typedCharacterText
                  )}
                </div>
              </div>
            )}

            {isLoading && !displayedCharacterSpeech && (
              <div className="scene-loading">대구-대구가 생각 중... 💭</div>
            )}
          </div>
        </div>
      )}

      {/* 웹툰 완료 후 입력창 표시 (대화 영역 바로 아래) */}
      {branchSpot && branchFinished && !terminated && (
        <div className="chat-input-panel" style={{ marginTop: "20px" }}>
          <div className="chat-input-panel__body">
            <input
              type="text"
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              placeholder="대구-대구에게 메시지를 보내세요..."
              className="chat-input-panel__input"
              onKeyPress={(e) => e.key === "Enter" && handleMessageSend()}
            />
            <button
              onClick={handleMessageSend}
              disabled={isLoading}
              className="chat-input-panel__send"
            >
              전송
            </button>
          </div>
        </div>
      )}

      {/* 추천 버튼 (웹툰 진행 중에는 숨김) */}
      {allowRecommendations &&
        !branchSpot &&
        !branchFinished &&
        recommendedSpot && (
          <div
            key={recommendedSpot}
            className="scroll-indicator recommendation-button-container"
            onClick={handleGoToSpot}
            style={{
              marginBottom: "20px",
              marginTop: "10px",
              animation: "bounce 2s infinite",
              cursor: "pointer",
              userSelect: "none",
              padding: "20px",
              borderRadius: "15px",
              transition: "all 0.3s ease",
              textAlign: "center",
              backgroundColor: "rgba(255, 255, 255, 0.4)",
              backdropFilter: "blur(10px)",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
            }}
          >
            <p style={{
              fontSize: "16px",
              margin: "10px 0",
              opacity: 0.9,
              textShadow: "none",
              color: "black",
            }}>
              {`${recommendedSpot}로 가기 ✨`}
            </p>
            <div className="scroll-arrow" style={{
              fontSize: "30px",
              textShadow: "none",
              transition: "transform 0.2s ease",
              color: "black",
            }}>
              ↓
            </div>
          </div>
        )}

      {/* 탐험 제안 버튼 (도착 후, 제안 시 노출) */}
      {branchFinished && exploreSuggested && !showVideo && (
        <div
          className="scroll-indicator"
          onClick={() => setShowVideo(true)}
          style={{
            marginTop: "20px",
            marginBottom: "20px",
            animation: "bounce 2s infinite",
            cursor: "pointer",
            userSelect: "none",
            padding: "20px",
            borderRadius: "15px",
            transition: "all 0.3s ease",
            textAlign: "center",
            backgroundColor: "rgba(255, 255, 255, 0.4)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          }}
        >
          <p style={{
            fontSize: "16px",
            margin: "10px 0",
            opacity: 0.9,
            textShadow: "none",
            color: "black",
          }}>
            {`${branchSpot || "여기"} 둘러보기`}
          </p>
          <div className="scroll-arrow" style={{
            fontSize: "30px",
            textShadow: "none",
            transition: "transform 0.2s ease",
            color: "black",
          }}>
            ↓
          </div>
        </div>
      )}


      {terminated && (
        <div style={{ marginTop: "20px" }}>
          <div
            style={{
              width: "100%",
              minHeight: "260px",
              border: "3px solid #333",
              borderRadius: "10px",
              backgroundColor: "#f9f9f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ fontSize: "64px" }}>🏠</div>
            <div
              style={{
                position: "absolute",
                bottom: 12,
                left: 16,
                color: "#555",
              }}
            >
              대구-대구는 집으로 돌아갔어요 (대화 종료)
            </div>
          </div>
        </div>
      )}

      {/* 풀-블리드 영상 섹션: 유튜브 임베드 (없으면 더미) */}
      {showVideo && (
        <div
          ref={videoRef}
          style={{
            width: "100vw",
            marginLeft: "calc(50% - 50vw)",
            height: "100vh",
            marginTop: "20px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {(() => {
            const entry = VIDEO_MAP[branchSpot || ""];
            if (entry?.type === "id") {
              return (
                <iframe
                  title={`${branchSpot} 하이라이트`}
                  src={`https://www.youtube.com/embed/${entry.value}?autoplay=1&rel=0`}
                  style={{ width: "100%", height: "100%", border: 0 }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              );
            }
            if (entry?.type === "url") {
              return (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundImage:
                      "linear-gradient(135deg, #1f2937, #111827)",
                  }}
                >
                  <a
                    href={entry.value}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: "white",
                      color: "#111",
                      padding: "10px 16px",
                      borderRadius: 8,
                      textDecoration: "none",
                      fontWeight: 600,
                    }}
                  >
                    유튜브에서 달성공원 검색 결과 보기
                  </a>
                </div>
              );
            }
            return (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundImage: "linear-gradient(135deg, #1f2937, #111827)",
                }}
              >
                <div style={{ color: "white", opacity: 0.9, fontSize: 18 }}>
                  영상 준비 중...
                </div>
              </div>
            );
          })()}
          <div
            style={{
              position: "absolute",
              top: 14,
              left: 16,
              color: "white",
              opacity: 0.9,
            }}
          >
            🎬 {branchSpot || "여기"} 하이라이트
          </div>
        </div>
      )}

      {/* 영상 다음 버튼 (showVideo가 true이고 엔딩 웹툰이 아직 안 나왔을 때) */}
      {showVideo && !showEndingWebtoon && (
        <div
          className="scroll-indicator"
          onClick={() => {
            setShowEndingWebtoon(true);
            setTimeout(() => {
              if (endingWebtoonRef.current) {
                endingWebtoonRef.current.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start'
                });
              }
            }, 300);
          }}
          style={{
            marginTop: "40px",
            animation: "bounce 2s infinite",
            cursor: "pointer",
            userSelect: "none",
            padding: "20px",
            borderRadius: "15px",
            transition: "all 0.3s ease",
            textAlign: "center",
            backgroundColor: "rgba(255, 255, 255, 0.4)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          }}
        >
          <p style={{
            fontSize: "16px",
            margin: "10px 0",
            opacity: 0.9,
            textShadow: "none",
            color: "black",
          }}>
            여행 마무리하기
          </p>
          <div className="scroll-arrow" style={{
            fontSize: "30px",
            textShadow: "none",
            transition: "transform 0.2s ease",
            color: "black",
          }}>
            ↓
          </div>
        </div>
      )}

      {/* 엔딩 웹툰 (공통) */}
      {showEndingWebtoon && (
        <div ref={endingWebtoonRef} style={{ marginTop: "40px" }}>
          <DestinationWebtoon
            spot="엔딩"
            onComplete={() => {
              console.log('[엔딩 웹툰] 완료');
              // 엔딩 웹툰 완료 후 동작 (필요시 추가)
            }}
          />
        </div>
      )}
    </div>
  );
}

export default ChatInterface;
