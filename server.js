// Local & Container Server Entry Point
import app from './api/index.js';

const PORT = 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Mini Social Media Platform is running at http://0.0.0.0:${PORT}`);
});
