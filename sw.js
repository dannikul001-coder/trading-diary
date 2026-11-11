const CACHE='trading-diary-v7-1-guided-academy-20261111';
const ASSETS=['./','./index.html','./style.css','./automated-diary.css','./js/automated-diary.js','./js/data.js','./js/storage.js','./js/statistics.js','./js/charts.js','./js/settings.js','./js/auth.js','./learning/course-v1.js','./js/learning-interactive.js','./js/admin.js','./js/currency.js','./js/supabase-config.js','./js/supabase.js','./js/import-center.js','./js/app.js','./manifest.json','./assets/logo.svg'];

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll([...ASSETS,'./learning-models.css','./learning/course-models.js','./learning/course-guides.js','./js/learning-models.js'])).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim())
));

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;

  const url=new URL(event.request.url);

  // Never cache Supabase/API responses. Cloud data must always be fresh.
  if(url.origin!==self.location.origin)return;

  event.respondWith(
    fetch(event.request)
      .then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        return response;
      })
      .catch(()=>caches.match(event.request).then(cached=>cached||caches.match('./index.html')))
  );
});
