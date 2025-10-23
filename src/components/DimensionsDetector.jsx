import React, { useState, useEffect } from "react";

const ViewportWidthIndicator = () => {
  const [width, setWidth] = useState(window.innerWidth); // Init width
  const [height, setHeight] = useState(window.innerHeight); // Init height

  // Getting window size
  useEffect(() => {
    const handleResize = () => {
      //   setWidth(window.innerWidth);
      //   setHeight(window.innerHeight); // do not work with height dynamic change
      // };
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;

      if (newWidth !== width) {
        setWidth(newWidth);
      }

      if (newHeight !== height) {
        setHeight(newHeight);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []); // Empty array of dependacies equals single exectution upon deploying component

  return (
    <div
      style={{
        position: "fixed",
        bottom: "0",
        left: "214px",
        transform: "translate(-50%, 0)",
        padding: "10px",
        opacity: "64%",
        fontSize: "15px",
        color: "#FF0000",
        backgroundColor: "#FFF",
        outline: "2px solid red",
        textAlign: "center",
        boxShadow: "0 0 5px rgba(0, 0, 0, 0.2)",
        zIndex: 2100000,
      }}
    >
      Debugging viewport width: {width} px / height: {height} px
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
