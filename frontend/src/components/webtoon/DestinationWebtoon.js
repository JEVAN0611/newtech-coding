import React, { useEffect, useMemo, useRef, useState } from 'react';

// 스크롤형 분기 웹툰: 선택한 장소별 5컷을 아래로 스크롤하며 감상합니다.
// 모든 컷이 한 번 이상 화면에 노출되면 onComplete를 호출해 채팅으로 복귀합니다.
function DestinationWebtoon({ spot, onComplete }) {
  const basePath = `${process.env.PUBLIC_URL || ''}/assets/images/webtoon`;
  const cacheBuster = 'dal-cut-v2';
  const withCacheBust = (file) => {
    const encoded = encodeURIComponent(file);
    return `${basePath}/${encoded}?v=${cacheBuster}`;
  };
  const sequences = useMemo(() => ({
    '동성로': [
      { image: null, emoji: '🚇', text: '중앙로역에서 내렸어! 동성로 입구 앞이야.' },
      { image: null, emoji: '🛍️', text: '양쪽으로 상점이 쫙~ 쇼핑 천국이지!' },
      { image: null, emoji: '🍜', text: '골목 맛집들 냄새가 벌써 유혹하네!' },
      { image: null, emoji: '🎵', text: '버스킹 소리 들려? 분위기 점점 업된다!' },
      { image: null, emoji: '✨', text: '좋아, 이제 본격 탐험 시작하자!' }
    ],
    '달성공원': [
      {
        image: withCacheBust('뉴테크 달성공원1.jpg'),
        fallback: withCacheBust('dalseong-extra-1.jpg'),
        emoji: '🚇',
        text: '달성공원역 도착! 공원 입구가 바로 보여.'
      },
      {
        image: withCacheBust('뉴테크 달성공원2.jpg'),
        fallback: withCacheBust('dalseong-extra-2.jpg'),
        emoji: '🌳',
        text: '나무 그늘 아래 산책로, 공기부터 다르다~'
      },
      { image: null, emoji: '🐾', text: '작은 동물원도 들러볼까? 귀여움 과다 주의!' },
      { image: null, emoji: '🏛️', text: '향토역사관 한 바퀴, 대구의 옛 이야기.' },
      { image: null, emoji: '☕', text: '근처 카페로 슬슬 이동해볼까?' }
    ],
    '수성못': [
      { image: null, emoji: '🚇', text: '수성못역에서 나와서 호수로 쭉!' },
      { image: null, emoji: '🌅', text: '물결 반짝~ 산책하기 딱 좋은 바람.' },
      { image: null, emoji: '🛶', text: '보트 타는 사람들 보이네? 재밌겠다!' },
      { image: null, emoji: '📸', text: '뷰 맛집 포인트에서 한 컷 찰칵!' },
      { image: null, emoji: '🌌', text: '야경 시작! 카페거리로 가서 쉬자.' }
    ]
  }), [basePath, cacheBuster]);

  const panels = sequences[spot] || [];
  const [visiblePanels, setVisiblePanels] = useState([]);
  const completedRef = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      const nodes = document.querySelectorAll('.dest-webtoon-panel');
      const newlyVisible = [];
      nodes.forEach((node, idx) => {
        const rect = node.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        if (isVisible && !visiblePanels.includes(idx)) {
          newlyVisible.push(idx);
        }
      });
      if (newlyVisible.length) {
        setVisiblePanels(prev => [...prev, ...newlyVisible]);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [visiblePanels]);

  useEffect(() => {
    if (!completedRef.current && panels.length > 0 && visiblePanels.length >= panels.length) {
      completedRef.current = true;
      setTimeout(() => onComplete && onComplete(), 700);
    }
  }, [visiblePanels, panels.length, onComplete]);

  if (!panels.length) return null;

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto', padding: '0' }}>
      {panels.map((panel, index) => (
        <div
          key={`${spot}-${index}`}
          className="dest-webtoon-panel"
          style={{
            margin: '50px 0',
            minHeight: '420px',
            opacity: visiblePanels.includes(index) ? 1 : 0,
            transform: visiblePanels.includes(index) ? 'translateY(0)' : 'translateY(50px)',
            transition: 'all 0.8s ease-in-out',
            border: '3px solid #333',
            borderRadius: '10px',
            backgroundColor: '#f9f9f9',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
          }}
        >
          <div
            style={{
              width: '100%',
              height: '420px',
              borderRadius: '7px',
              position: 'relative',
              overflow: 'hidden',
              backgroundColor: panel.image ? '#000' : '#f9f9f9'
            }}
          >
            {panel.image ? (
              <>
                <img
                  src={panel.image}
                  onError={(event) => {
                    const target = event.currentTarget;
                    if (panel.fallback && target.dataset.fallback !== 'used') {
                      target.dataset.fallback = 'used';
                      target.src = panel.fallback;
                    }
                  }}
                  alt={`${spot} 웹툰 컷 ${index + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: 10,
                  right: 12,
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: '12px',
                  textShadow: '0 1px 3px rgba(0,0,0,0.6)'
                }}>
                  컷 {index + 1}/{panels.length}
                </div>
              </>
            ) : (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.92)'
              }}>
                <div style={{ fontSize: '56px', marginBottom: '14px' }}>{panel.emoji}</div>
                <p style={{
                  margin: 0,
                  color: '#555',
                  textAlign: 'center',
                  fontSize: '16px',
                  lineHeight: 1.5,
                  padding: '0 16px'
                }}>
                  {panel.text}
                </p>
                <div style={{
                  position: 'absolute',
                  bottom: 10,
                  right: 12,
                  color: '#999',
                  fontSize: '12px'
                }}>
                  컷 {index + 1}/{panels.length}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default DestinationWebtoon;
