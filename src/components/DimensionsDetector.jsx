// Used for detection of screen dimensions + beta sign in the corner

import React from "react";

const ViewportWidthIndicator = () => {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "0",
        left: "0",
        zIndex: 500000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        opacity: "0.88",
      }}
    >
      <div
        style={{
          width: 0,
          height: 0,
          borderTop: "98px solid transparent",
          borderLeft: "98px solid rgba(255, 4, 0, 0.34)",
          position: "relative",
          boxShadow: "-11px 10px 18px 4px rgba(12,249,230,0.2)",
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "56px",
          left: "4px",
          transform: "rotate(45deg)",
          fontSize: "14px",
          color: "#1ff",
          whiteSpace: "nowrap",
          textShadow: "4px 2px 7px rgba(0,0,0,1)",
          zIndex: 2,
        }}
      >
        NEW BETA!
      </div>
    </div>
  );
};

const App = () => {
  return (
    <div>
      <ViewportWidthIndicator />
    </div>
  );
};

export default App;

// Dimension detector

// import React, { useState, useEffect } from "react";

// const ViewportWidthIndicator = () => {
//   const [width, setWidth] = useState(window.innerWidth); // Init width
//   const [height, setHeight] = useState(window.innerHeight); // Init height

//   // Getting window size
//   useEffect(() => {
//     const handleResize = () => {
//       const newWidth = window.innerWidth;
//       const newHeight = window.innerHeight;

//       if (newWidth !== width) {
//         setWidth(newWidth);
//       }

//       if (newHeight !== height) {
//         setHeight(newHeight);
//       }
//     };

//     window.addEventListener("resize", handleResize);

//     return () => {
//       window.removeEventListener("resize", handleResize);
//     };
//   }, []); // Empty array of dependacies equals single exectution upon deploying component

//   return (
//     <div
//       style={{
//         position: "fixed",
//         bottom: "0",
//         left: "214px",
//         transform: "translate(-50%, 0)",
//         padding: "10px",
//         opacity: "64%",
//         fontSize: "15px",
//         color: "#FF0000",
//         backgroundColor: "#FFF",
//         outline: "2px solid red",
//         textAlign: "center",
//         boxShadow: "0 0 5px rgba(0, 0, 0, 0.2)",
//         zIndex: 2100000,
//       }}
//     >
//       Debugging viewport width: {width} px / height: {height} px
//     </div>
//   );
// };

// const App = () => {
//   return (
//     <div>
//       <ViewportWidthIndicator />
//     </div>
//   );
// };

// export default App;
