import { useEffect, useState } from 'react';
import './App.css';
import WebtoonViewer from './components/webtoon/WebtoonViewer';
import heroTitle from './assets/images/hero-title.png';
import sponsorImage from './assets/images/sponsor-image.png';
import { warmUpServer } from './services/api';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [serverStatus, setServerStatus] = useState('warming');

  // 앱 시작 시 서버 워밍업 (백그라운드에서 조용히 실행)
  useEffect(() => {
    const initServer = async () => {
      console.log('🔥 서버 워밍업 시작...');

      const isHealthy = await warmUpServer();
      setServerStatus(isHealthy ? 'ready' : 'error');

      if (isHealthy) {
        console.log('✅ 서버 준비 완료!');
      } else {
        console.log('❌ 서버 응답 없음');
      }
    };

    initServer();
  }, []);

  useEffect(() => {
    // 서버가 준비되면 로딩 종료
    if (serverStatus === 'ready') {
      const timer = setTimeout(() => setIsLoading(false), 800);
      return () => clearTimeout(timer);
    }
  }, [serverStatus]);

  useEffect(() => {
    if (isLoading) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isLoading]);

  // 스크롤 함수
  const scrollToWebtoon = () => {
    const webtoonSection = document.querySelector('main');
    if (webtoonSection) {
      webtoonSection.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start' 
      });
    }
  };

  return (
    <div className={`App${isLoading ? ' is-loading' : ''}`}>
      {isLoading && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <img
            src={heroTitle}
            alt="대구-대구 타이틀"
            className="loading-hero"
          />
          <div className="loading-spinner" aria-hidden="true" />
          <p className="loading-text">대구-대구로 입장하고 있어요...</p>
          <p className="loading-subtext">잠시만 기다려주세요!</p>
        </div>
      )}
      <div className="App-content" aria-hidden={isLoading}>
        <header className="App-header">
          {/* 중앙 부양 타이틀 이미지 */}
          <img
            src={heroTitle}
            alt="타이틀"
            className="hero-title"
          />
          
          {/* 클릭 가능한 스크롤 유도 섹션 (타이틀 아래로 더 내림) */}
          <div
            className="scroll-indicator"
            onClick={scrollToWebtoon}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                scrollToWebtoon();
              }
            }}
          >
            <p>아래로 스크롤해서 대구-대구와 만나보세요!</p>
            <div className="scroll-arrow">↓</div>
            <p style={{
              fontSize: '12px',
              opacity: '0.7',
              marginTop: '10px'
            }}>
              클릭해보세요!
            </p>
          </div>

          {/* 스폰서 이미지 */}
          <img
            src={sponsorImage}
            alt="스폰서"
            style={{
              width: '400px',
              position: 'absolute',
              bottom: '40px',
              zIndex: 10,
              filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 1)) drop-shadow(0 0 20px rgba(255, 255, 255, 1)) drop-shadow(0 0 30px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 50px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 70px rgba(255, 255, 255, 0.7)) drop-shadow(0 0 100px rgba(255, 255, 255, 0.6)) drop-shadow(0 0 130px rgba(255, 255, 255, 0.5))'
            }}
          />
        </header>
        
        <main>
          <WebtoonViewer />
        </main>
      </div>
    </div>
  );
}

export default App;
