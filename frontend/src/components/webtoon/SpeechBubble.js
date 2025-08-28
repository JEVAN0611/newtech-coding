import React from 'react';

function SpeechBubble({ 
  text, 
  speaker = "대구-대구", 
  position = "left",
  bubbleType = "speech" // "speech" 또는 "thought"
}) {
  const isLeft = position === "left";
  
  return (
    <div style={{
      display: 'flex',
      justifyContent: isLeft ? 'flex-start' : 'flex-end',
      margin: '10px 0',
      alignItems: 'flex-end'
    }}>
      {/* 말풍선 */}
      <div style={{
        backgroundColor: bubbleType === 'thought' ? '#fff3e0' : 'white',
        border: '2px solid #333',
        borderRadius: bubbleType === 'thought' ? '50px' : '20px',
        padding: '15px 20px',
        maxWidth: '70%',
        position: 'relative',
        boxShadow: '2px 2px 5px rgba(0,0,0,0.1)',
        fontSize: '16px',
        lineHeight: '1.4'
      }}>
        {/* 말풍선 꼬리 */}
        <div style={{
          position: 'absolute',
          bottom: '-8px',
          left: isLeft ? '30px' : 'auto',
          right: isLeft ? 'auto' : '30px',
          width: '0',
          height: '0',
          borderLeft: '10px solid transparent',
          borderRight: '10px solid transparent',
          borderTop: '10px solid #333'
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: '-5px',
          left: isLeft ? '32px' : 'auto',
          right: isLeft ? 'auto' : '32px',
          width: '0',
          height: '0',
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: `8px solid ${bubbleType === 'thought' ? '#fff3e0' : 'white'}`
        }}></div>
        
        {/* 화자 이름 */}
        <div style={{
          fontSize: '12px',
          fontWeight: 'bold',
          color: '#666',
          marginBottom: '5px'
        }}>
          {speaker}
        </div>
        
        {/* 대사 */}
        <div style={{ color: '#333' }}>
          {text}
        </div>
      </div>
    </div>
  );
}

export default SpeechBubble;