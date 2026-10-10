import test from 'node:test';
import assert from 'node:assert/strict';
import { DecodedImageCache, SpriteRenderer } from '../dist/index.js';
class Element {
  dataset = {}; children = []; style = { setProperty() {}, removeProperty() {} };
  append(child) { this.children.push(child); child.parent = this; }
  remove() { if(this.parent) this.parent.children = this.parent.children.filter(x=>x!==this); }
  setAttribute() {}
}
function setup(t) {
  const old = globalThis.document, loads = [], images = [];
  globalThis.document = { createElement() {
    const image = new Element();
    image.decode = () => { loads.push(image.src); return image.src === 'broken' ? Promise.reject(Error('failed')) : Promise.resolve(); };
    images.push(image); return image;
  } };
  t.after(()=>{globalThis.document=old;}); return {loads,images};
}
test('image cache reuses concurrent loads and counts cache hits', async t => {
  const h=setup(t), cache=new DecodedImageCache();
  const [a,b]=await Promise.all([cache.acquire('a'),cache.acquire('a')]);
  assert.deepEqual(h.loads,['a']); assert.equal(a.image,b.image);
  assert.equal(cache.stats.pinnedImages,1);
  a.release(); a.release(); assert.equal(cache.stats.pinnedImages,1);
  b.release(); assert.equal(cache.stats.pinnedImages,0); assert.equal(cache.stats.hits,1);
});
test('LRU evicts old unleased images and reloads them on a later request', async t => {
  const h=setup(t),cache=new DecodedImageCache({maxDecodedImages:2});
  for(const source of ['a','b','a','c']) (await cache.acquire(source)).release();
  assert.equal(cache.stats.decodedImages,2); assert.equal(cache.stats.evictions,1);
  assert.equal(h.images.find(x=>x.src==='b'),undefined);
  (await cache.acquire('b')).release(); assert.deepEqual(h.loads,['a','b','c','b']);
});
test('displayed and crossfade leases can exceed the bound until they are released',async t=>{
  setup(t);const cache=new DecodedImageCache({maxDecodedImages:1});
  const outgoing=await cache.acquire('outgoing'),incoming=await cache.acquire('incoming');
  assert.equal(cache.stats.decodedImages,2);assert.equal(outgoing.image.src,'outgoing');
  outgoing.release();assert.equal(cache.stats.decodedImages,1);assert.equal(incoming.image.src,'incoming');
  incoming.release();cache.clearUnused();assert.equal(cache.stats.decodedImages,0);
});
test('failed assets are retryable and never consume decoded cache capacity',async t=>{
  const h=setup(t),cache=new DecodedImageCache();
  assert.equal(await cache.acquire('broken'),undefined);assert.equal(await cache.acquire('broken'),undefined);
  assert.deepEqual(h.loads,['broken','broken']);assert.equal(cache.stats.decodedImages,0);
});
test('shared renderer cache preserves independent visible characters during eviction',async t=>{
  const h=setup(t),cache=new DecodedImageCache({maxDecodedImages:2}),renderer=new SpriteRenderer({imageCache:cache,crossfadeDuration:0});
  const hosts=[new Element(),new Element()];
  const create=(id,index)=>renderer.create(hosts[index],{id,name:id,renderer:'sprite',assets:{expressions:{normal:id+'-normal',smile:id+'-smile'}}});
  const a=create('a',0),b=create('b',1);await Promise.all([a.show(),b.show()]);
  await a.setExpression('smile');assert.equal(cache.stats.decodedImages,2);
  assert.equal(hosts[1].children[0].children[0].children[0].src,'b-normal');
  await b.setExpression('normal');assert.deepEqual(h.loads,['a-normal','b-normal','a-smile']);
  a.destroy();b.destroy();assert.equal(cache.stats.pinnedImages,0);
});
test('cache capacity rejects invalid bounds',()=>{
  for(const maxDecodedImages of [0,-1,1.5,NaN]) assert.throws(()=>new DecodedImageCache({maxDecodedImages}));
});
