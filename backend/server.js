/**
 * Root Server Entrypoint Proxy.
 * Forwards execution to src/server.js so that both `node server.js`
 * and `node src/server.js` work seamlessly.
 */

import './src/server.js';
