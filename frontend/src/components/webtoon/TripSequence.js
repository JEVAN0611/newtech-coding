import React, { useEffect, useState } from 'react';

function TripSequence({ spot, onComplete }) {
  const frames = ['🚶‍♂️', '🏃‍♂️', '🏁'];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(prev => {
        if (prev < frames.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          setTimeout(onComplete, 500);
          return prev;
        }
      });
    }, 700);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div style={{
      textAlign: 'center',
      padding: '40px',
      border: '3px solid #333',
      borderRadius: '10px',
      backgroundColor: '#f9f9f9',
      maxWidth: '500px',
      margin: '40px auto'
    }}>
      <div style={{ fontSize: '64px', marginBottom: '20px' }}>
        {frames[index]}
      </div>
      <p style={{ fontSize: '18px', color: '#333' }}>{spot}로 이동 중...</p>
    </div>
  );
}

export default TripSequence;
