// backend/routes.js (개선 버전)
const express = require("express");
const {
  chatWithDaegu,
  resetSession,
  getSessionInfo,
  DAEGU_SPOTS,
} = require("./src/aiService");
const router = express.Router();

// AI 채팅 엔드포인트 (개선된 버전)
router.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId, userName } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "메시지가 필요합니다",
      });
    }

    // 세션 ID가 없으면 생성
    const currentSessionId =
      sessionId ||
      `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const aiResponse = await chatWithDaegu(
      message.trim(),
      currentSessionId,
      userName
    );

    if (aiResponse.success) {
      res.json({
        success: true,
        response: aiResponse.message,
        sessionId: aiResponse.sessionId,
        stage: aiResponse.stage,
        character: "대구-대구",
        recommendation: aiResponse.recommendation || null,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        success: false,
        response: aiResponse.fallback,
        sessionId: aiResponse.sessionId,
        character: "대구-대구",
        error: "AI 응답 처리 실패",
      });
    }
  } catch (error) {
    console.error("채팅 API 에러:", error);
    res.status(500).json({
      success: false,
      error: "서버 오류가 발생했습니다",
      response: "미안, 뭔가 문제가 생겼어! 다시 해볼래?",
    });
  }
});

// 새 대화 시작
router.post("/api/chat/new", (req, res) => {
  const newSessionId = `session_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  res.json({
    success: true,
    sessionId: newSessionId,
    message: "안녕! 나는 대구-대구야! 대구역에 도착했구나? 오늘 뭐 하고 싶어?",
    character: "대구-대구",
    stage: "greeting",
  });
});

// 대화 초기화
router.delete("/api/chat/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = resetSession(sessionId);

    res.json({
      success: true,
      message: "대화가 초기화되었습니다",
      sessionId: sessionId,
    });
  } catch (error) {
    console.error("세션 초기화 에러:", error);
    res.status(500).json({
      success: false,
      error: "세션 초기화 실패",
    });
  }
});

// 세션 정보 조회
router.get("/api/chat/:sessionId/info", (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionInfo = getSessionInfo(sessionId);

    res.json({
      success: true,
      session: sessionInfo,
    });
  } catch (error) {
    console.error("세션 정보 조회 에러:", error);
    res.status(500).json({
      success: false,
      error: "세션 정보 조회 실패",
    });
  }
});

// 대구 명소 정보 API
router.get("/api/spots", (req, res) => {
  res.json({
    success: true,
    spots: DAEGU_SPOTS,
  });
});

// 특정 명소 정보 조회
router.get("/api/spots/:spotId", (req, res) => {
  try {
    const { spotId } = req.params;
    const spot = DAEGU_SPOTS[spotId];

    if (!spot) {
      return res.status(404).json({
        success: false,
        error: "명소를 찾을 수 없습니다",
      });
    }

    res.json({
      success: true,
      spot: {
        id: spotId,
        ...spot,
      },
    });
  } catch (error) {
    console.error("명소 정보 조회 에러:", error);
    res.status(500).json({
      success: false,
      error: "명소 정보 조회 실패",
    });
  }
});

// 명소 "방문하기" (웹툰 전환점)
router.post("/api/spots/:spotId/visit", async (req, res) => {
  try {
    const { spotId } = req.params;
    const { sessionId } = req.body;

    const spot = DAEGU_SPOTS[spotId];
    if (!spot) {
      return res.status(404).json({
        success: false,
        error: "명소를 찾을 수 없습니다",
      });
    }

    // 방문 확정 메시지
    const visitMessage = `좋아! ${spot.name}으로 가자! 🚇`;

    // AI에게 방문 확정 알림
    const aiResponse = await chatWithDaegu(
      `${spot.name}에 가기로 했어요!`,
      sessionId
    );

    res.json({
      success: true,
      message: visitMessage,
      aiResponse: aiResponse.message,
      spot: {
        id: spotId,
        ...spot,
      },
      nextAction: "webtoon_transition", // 웹툰으로 전환 신호
    });
  } catch (error) {
    console.error("명소 방문 처리 에러:", error);
    res.status(500).json({
      success: false,
      error: "명소 방문 처리 실패",
    });
  }
});

module.exports = router;
