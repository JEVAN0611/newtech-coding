import React, { useEffect, useMemo, useRef, useState } from "react";
import DestinationWebtoon from "../webtoon/DestinationWebtoon";
import "./ChatInterface.css";

const ASSET_BASE = `${process.env.PUBLIC_URL || ""}/assets/images/character`;
const CHARACTER_POSES = {
  blink: `${ASSET_BASE}/daegu-daegu-half.gif`,
  chinScratch: `${ASSET_BASE}/daegu-daegu-chin.gif`,
};
const DEFAULT_CHARACTER_GIF = CHARACTER_POSES.blink;
const CHARACTER_IMAGES = {
  default: DEFAULT_CHARACTER_GIF,
  happy: DEFAULT_CHARACTER_GIF,
  sad: DEFAULT_CHARACTER_GIF,
  thinking: DEFAULT_CHARACTER_GIF,
};
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
  const [isNameSubmitted, setIsNameSubmitted] = useState(false);
  const [recommendedSpot, setRecommendedSpot] = useState(null);
  const [branchSpot, setBranchSpot] = useState(null);
  const [branchFinished, setBranchFinished] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const videoRef = useRef(null);
  const poseTimeoutRef = useRef(null);
  const [postArrivalUserMsgs, setPostArrivalUserMsgs] = useState(0);
  const [arrivalAssistMsgs, setArrivalAssistMsgs] = useState(0);
  const [exploreSuggested, setExploreSuggested] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [allowRecommendations, setAllowRecommendations] = useState(true);
  const [terminated, setTerminated] = useState(false);
  const [characterEmotion, setCharacterEmotion] = useState("happy");
  const [characterPose, setCharacterPose] = useState("blink");
  const [userBubbleEntry, setUserBubbleEntry] = useState(null);
  const [userBubbleAnimation, setUserBubbleAnimation] = useState("idle");
  const [characterBubbleEntry, setCharacterBubbleEntry] = useState(null);
  const [characterBubbleAnimation, setCharacterBubbleAnimation] = useState("idle");
  const THINKING_DELAY_MS = 1000;
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
  const displayedCharacterSpeech = characterBubbleEntry?.message || null;

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

  const updateEmotionFromResponse = (payload) => {
    if (!payload) {
      setCharacterEmotion("sad");
      return;
    }

    if (payload.warning || payload.terminated || payload.success === false) {
      setCharacterEmotion("sad");
      return;
    }

    const stage = payload.stage;
    const hasRecommendation = Boolean(payload.recommendation);

    if (stage === "greeting" || stage === "preference") {
      setCharacterEmotion(hasRecommendation ? "happy" : "thinking");
      return;
    }

    if (stage === "recommendation" || stage === "arrived") {
      setCharacterEmotion("happy");
      return;
    }

    if (stage === "enroute") {
      setCharacterEmotion("thinking");
      return;
    }

    setCharacterEmotion("happy");
  };
  const VIDEO_MAP = {
    동성로: { type: "id", value: "XwEbpYYsv_Q" },
    수성못: { type: "id", value: "5L08R3GYcDI" },
    달성공원: { type: "id", value: "cui_U87t-20" },
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
  useEffect(() => {
    const needsDelay =
      characterSpeechEntry && characterSpeechEntry.id !== "character-thinking";
    handleBubbleTransition(
      characterSpeechEntry,
      characterBubbleEntry,
      setCharacterBubbleEntry,
      setCharacterBubbleAnimation,
      characterBubbleTimers,
      needsDelay ? RESPONSE_DELAY_MS : 0,
    );
  }, [characterSpeechEntry]);

  useEffect(() => {
    return () => {
      if (poseTimeoutRef.current) {
        clearTimeout(poseTimeoutRef.current);
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

      const finalize = () => {
        if (data.terminated || (data.response || "").includes("정책 위반으로 대화를 종료합니다")) {
          setTerminated(true);
          setCharacterEmotion("sad");
          resetPoseToDefault();
          setIsLoading(false);
          return;
        }

        appendAssistantMessage(data.response);

        const textFallbackSpot =
          SPOT_NAMES.find((name) => (data.response || "").includes(name)) ||
          null;
        const spot = data?.recommendation?.name || textFallbackSpot;
        if (allowRecommendations && !branchSpot && !branchFinished && spot) {
          setRecommendedSpot(spot);
        } else {
          setRecommendedSpot(null);
        }

        updateEmotionFromResponse(data);
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
    setIsLoading(true);
    setCharacterEmotion("thinking");
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
        const textFallbackSpot2 =
          SPOT_NAMES.find((name) => (data.response || "").includes(name)) ||
          null;
        const spot = data?.recommendation?.name || textFallbackSpot2;
        if (allowRecommendations && !branchSpot && !branchFinished && spot) {
          setRecommendedSpot(spot);
        } else {
          setRecommendedSpot(null);
        }

        updateEmotionFromResponse(data);
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
  const emotionImage =
    CHARACTER_IMAGES[characterEmotion] || CHARACTER_IMAGES.default;
  const poseImage = CHARACTER_POSES[characterPose];
  const characterImage =
    characterPose === "blink" || !poseImage ? emotionImage : poseImage;

  return (
    <div className="chat-interface">
      {/* 이름 입력 섹션 */}
      {!isNameSubmitted && (
        <div className="name-intro">
          <p className="name-intro__prompt">
            대구-대구: 이름이 뭐야? 😊
          </p>
          <div className="name-intro__notice">
            <div className="name-intro__notice-title">이용 안내</div>
            <div>- 실제 가게 상호명은 말하지 않아요 (상권으로 안내)</div>
            <div>- 비속어나 주제 일탈이 반복되면 대화가 종료돼요</div>
          </div>
          <div className="name-intro__form">
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="여기에 이름을 입력해주세요"
              onKeyPress={(e) => e.key === "Enter" && handleNameSubmit()}
            />
            <button
              onClick={handleNameSubmit}
              disabled={isLoading}
            >
              {isLoading ? "..." : "만나기"}
            </button>
          </div>
        </div>
      )}

      {/* 캐릭터 씬 */}
      {showScene && (
        <div className="scene-wrapper">
          <div className="scene-stage">
            <div className="scene-stage__character">
              <div
                className="character-portrait"
                role="img"
                aria-label="대구-대구"
                style={{
                  backgroundImage: `url("${characterImage}")`,
                }}
              />
            </div>

            <div className="scene-stage__conversation">
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
                <div
                  className={[
                    "speech-bubble",
                    "speech-bubble--character",
                    characterBubbleAnimation === "enter"
                      ? "speech-bubble--anim-enter-left"
                      : "",
                    characterBubbleAnimation === "exit"
                      ? "speech-bubble--anim-exit-right"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="speech-bubble__name">대구-대구</div>
                  <div>{displayedCharacterSpeech}</div>
                </div>
              )}
            </div>
          </div>

          {isLoading && !displayedCharacterSpeech && (
            <div className="scene-loading">대구-대구가 생각 중... 💭</div>
          )}
        </div>
      )}

      {branchSpot && !branchFinished && (
        <div
          style={{
            marginTop: "30px",
            padding: "16px",
            border: "2px solid #333",
            borderRadius: "12px",
            backgroundColor: "#fffef9",
          }}
        >
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
          <DestinationWebtoon
            spot={branchSpot}
            onComplete={handleBranchComplete}
          />
        </div>
      )}

      {/* 추천 버튼 (웹툰 진행 중에는 숨김) */}
      {allowRecommendations &&
        !branchSpot &&
        !branchFinished &&
        recommendedSpot && (
          <div
            style={{
              textAlign: "center",
              marginBottom: "15px",
              display: "flex",
              gap: "10px",
              justifyContent: "center",
            }}
          >
            <button
              onClick={handleGoToSpot}
              style={{
                padding: "8px 12px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              {`${recommendedSpot}로 가기`}
            </button>
            <button
              onClick={handleFindAnother}
              style={{
                padding: "8px 12px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              다른 곳 찾기
            </button>
          </div>
        )}

      {/* 탐험 제안 버튼 (도착 후, 제안 시 노출) */}
      {branchFinished && exploreSuggested && !showVideo && (
        <div style={{ textAlign: "center", margin: "10px 0 16px" }}>
          <button
            onClick={() => setShowVideo(true)}
            style={{
              padding: "10px 16px",
              backgroundColor: "#ff7a59",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {`${branchSpot || "여기"} 둘러보기`}
          </button>
        </div>
      )}

      {/* 메시지 입력 (분기 웹툰 완료 후에만 노출) */}
      {(!branchSpot || branchFinished) && isNameSubmitted && !terminated && (
        <div className="chat-input-panel">
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
    </div>
  );
}

export default ChatInterface;
