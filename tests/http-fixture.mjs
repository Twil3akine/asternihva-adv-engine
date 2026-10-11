import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
export async function serveFixture(directory) {
  const root = resolve(directory);
  const server = createServer(async (req,res) => {
    const pathname = decodeURIComponent(new URL(req.url,'http://local').pathname);
    const path = resolve(root,'.'+(pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root+sep)) { res.statusCode=403; res.end(); return; }
    try {
      res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'})[extname(path)] ?? 'application/octet-stream');
      res.end(await readFile(path));
    } catch { res.statusCode=404; res.end(); }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}
