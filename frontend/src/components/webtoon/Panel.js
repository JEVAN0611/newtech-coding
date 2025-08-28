import React from "react";

function Panel({
  backgroundImage,
  children,
  height = "300px",
  backgroundColor = "#f8f9fa",
}) {
  return (
    <div
      style={{
        height: height,
        backgroundColor: backgroundColor,
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
        border: "3px solid #333",
        borderRadius: "10px",
        margin: "10px 0",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
        boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
      }}
    >
      {children}
    </div>
  );
}

export default Panel;
