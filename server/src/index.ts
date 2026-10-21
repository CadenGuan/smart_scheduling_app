import { app } from './app.js';
import { config } from './config.js';

app.listen(config.PORT, () => {
  console.log(`[Smart Scheduling Server] Running on http://localhost:${config.PORT}`);
});

