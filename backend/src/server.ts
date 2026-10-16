import { app } from './app';
import { config } from './config';

app.listen(config.port, () => {
  console.log(`TaskFlow API running on http://localhost:${config.port}`);
  console.log(`API docs at http://localhost:${config.port}/api/docs`);
});
