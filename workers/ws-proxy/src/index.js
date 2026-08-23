/* eslint-env cloudflare-workers */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = `${env.ORIGIN_HOST}:${env.ORIGIN_PORT}`;

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      try {
        // Connect to origin WebSocket via fetch with Upgrade header
        const originResp = await fetch(`http://${origin}${url.pathname}`, {
          headers: { Upgrade: 'websocket' },
        });

        const originWs = originResp.webSocket;
        if (!originWs) {
          return new Response('Origin did not accept WebSocket', { status: 502 });
        }

        // Accept client WebSocket with half-open for proxying
        server.accept({ allowHalfOpen: true });

        // Pipe messages: origin -> client
        originWs.addEventListener('message', (event) => {
          if (server.readyState === 1) server.send(event.data);
        });
        originWs.addEventListener('close', (event) => {
          if (server.readyState === 1) server.close(event.code, event.reason);
        });
        originWs.addEventListener('error', () => {
          if (server.readyState === 1) server.close(1011, 'Origin error');
        });

        // Pipe messages: client -> origin
        server.addEventListener('message', (event) => {
          if (originWs.readyState === 1) originWs.send(event.data);
        });
        server.addEventListener('close', (event) => {
          if (originWs.readyState === 1) originWs.close(event.code, event.reason);
        });
        server.addEventListener('error', () => {
          if (originWs.readyState === 1) originWs.close(1011, 'Client error');
        });

        return new Response(null, { status: 101, webSocket: client });
      } catch (err) {
        console.error('WebSocket proxy error:', err.message);
        return new Response(`Proxy error: ${err.message}`, { status: 502 });
      }
    }

    // Handle regular HTTP requests
    return fetch(`http://${origin}${url.pathname}${url.search}`, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
  },
};
