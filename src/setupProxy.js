const path = require("path");

module.exports = function (app) {
  const workletFile = path.join(__dirname, "../public/libopenmpt.worklet.js");

  const serveWorklet = (req, res) => {
    // Force correct JS MIME so browser won't block with nosniff
    res.setHeader("Content-Type", "application/javascript");
    // Make sure we don't let CRA fallback to index.html for this path
    res.sendFile(workletFile, (err) => {
      if (err) {
        console.error("Failed to send libopenmpt.worklet.js:", err);
        if (!res.headersSent) res.status(500).send("worklet serve error");
      }
    });
  };

  app.get("/libopenmpt.worklet.js", serveWorklet);
  app.get("/libopenmpt.js", serveWorklet);
  app.get("/libopenmpt-worklet.js", serveWorklet);
  app.get("/libopenmpt-worklet", serveWorklet);

  // regex route for any /static/media/libopenmpt.worklet* (covers hashed file names)
  app.get(/^\/static\/media\/libopenmpt\.worklet.*$/, serveWorklet);
};
