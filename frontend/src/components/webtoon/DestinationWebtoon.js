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
      {
        image: withCacheBust('dongseongro-1.png'),
        emoji: '🚇',
        text: '중앙로역에서 내렸어! 동성로 입구 앞이야.'
      },
      {
        image: withCacheBust('dongseongro-2.png'),
        emoji: '🛍️',
        text: '양쪽으로 상점이 쫙~ 쇼핑 천국이지!'
      },
      {
        image: withCacheBust('dongseongro-3.png'),
        emoji: '🍜',
        text: '골목 맛집들 냄새가 벌써 유혹하네!'
      },
      {
        image: withCacheBust('dongseongro-4.png'),
        emoji: '🎵',
        text: '버스킹 소리 들려? 분위기 점점 업된다!'
      },
      {
        image: withCacheBust('dongseongro-5.png'),
        emoji: '✨',
        text: '좋아, 이제 본격 탐험 시작하자!'
      }
    ],
    '달성공원': [
      {
        image: withCacheBust('dalseong-1.jpg'),
        fallback: withCacheBust('dalseong-extra-1.jpg'),
        emoji: '🚇',
        text: '달성공원역 도착! 공원 입구가 바로 보여.'
      },
      {
        image: withCacheBust('dalseong-2.jpg'),
        fallback: withCacheBust('dalseong-extra-2.jpg'),
        emoji: '🌳',
        text: '나무 그늘 아래 산책로, 공기부터 다르다~'
      },
      {
        image: withCacheBust('dalseong-3.png'),
        emoji: '🐾',
        text: '작은 동물원도 들러볼까? 귀여움 과다 주의!'
      },
      {
        image: withCacheBust('dalseong-4.png'),
        emoji: '🏛️',
        text: '향토역사관 한 바퀴, 대구의 옛 이야기.'
      },
      {
        image: withCacheBust('dalseong-5.png'),
        emoji: '☕',
        text: '근처 카페로 슬슬 이동해볼까?'
      }
    ],
    '수성못': [
      {
        image: withCacheBust('suseongmot-1.png'),
        emoji: '🚇',
        text: '수성못역에서 나와서 호수로 쭉!'
      },
      {
        image: withCacheBust('suseongmot-2.png'),
        emoji: '🌅',
        text: '물결 반짝~ 산책하기 딱 좋은 바람.'
      },
      {
        image: withCacheBust('suseongmot-3.png'),
        emoji: '🛶',
        text: '보트 타는 사람들 보이네? 재밌겠다!'
      },
      {
        image: withCacheBust('suseongmot-4.png'),
        emoji: '📸',
        text: '뷰 맛집 포인트에서 한 컷 찰칵!'
      },
      {
        image: withCacheBust('suseongmot-5.png'),
        emoji: '🌌',
        text: '야경 시작! 카페거리로 가서 쉬자.'
      }
    ],
    '엔딩': [
      {
        image: withCacheBust('ending-1.png'),
        fallback: withCacheBust('ending-1.png'),
        emoji: '🌆',
        text: '오늘 대구 여행 어땠어?'
      },
      {
        image: withCacheBust('ending-2.png'),
        fallback: withCacheBust('ending-2.png'),
        emoji: '💭',
        text: '함께해서 정말 즐거웠어!'
      },
      {
        image: withCacheBust('ending-3.png'),
        fallback: withCacheBust('ending-3.png'),
        emoji: '✨',
        text: '안녕~ 또 보자!'
      }
    ]
  }), [basePath, cacheBuster]);

  const panels = sequences[spot] || [];
  const [visiblePanels, setVisiblePanels] = useState([0]); // 첫 번째 패널 즉시 표시
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
    // DOM 렌더링 및 스크롤 완료 후 visibility 체크
    const timeoutId = setTimeout(handleScroll, 300);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, [visiblePanels]);

  // 패널들을 순차적으로 자동 표시 (스크롤 없이도 작동)
  useEffect(() => {
    const timeouts = [];
    panels.forEach((_, idx) => {
      const timeout = setTimeout(() => {
        setVisiblePanels(prev => {
          if (!prev.includes(idx)) {
            return [...prev, idx];
          }
          return prev;
        });
      }, idx * 600); // 각 패널을 0.6초 간격으로 표시
      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [panels.length]);

  useEffect(() => {
    if (!completedRef.current && panels.length > 0 && visiblePanels.length >= panels.length) {
      completedRef.current = true;
      setTimeout(() => onComplete && onComplete(), 700);
    }
  }, [visiblePanels, panels.length, onComplete]);

  if (!panels.length) return null;

  return (
    <div style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      {panels.map((panel, index) => (
        <div
          key={`${spot}-${index}`}
          className="dest-webtoon-panel"
          style={{
            margin: '25px 0',
            width: '600px',
            height: '400px',
            opacity: visiblePanels.includes(index) ? 1 : 0,
            transform: visiblePanels.includes(index) ? 'translateY(0)' : 'translateY(50px)',
            transition: 'all 0.8s ease-in-out',
            border: '6px solid #333',
            borderRadius: '10px',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '7px',
              position: 'relative',
              overflow: 'hidden',
              backgroundColor: '#ffffff'
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
                    objectFit: 'cover',
                    display: 'block'
                  }}
                />
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
                backgroundColor: '#ffffff'
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
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default DestinationWebtoon;
