const CACHE='trading-diary-v12-source-practice-20261112';
const ASSETS=['./','./index.html','./academy-preview.html','./style.css','./automated-diary.css','./js/automated-diary.js','./js/data.js','./js/storage.js','./js/statistics.js','./js/charts.js','./js/settings.js','./js/auth.js','./learning/course-v1.js','./js/learning-interactive.js','./js/admin.js','./js/currency.js','./js/supabase-config.js','./js/supabase.js','./js/import-center.js','./js/app.js','./manifest.json','./assets/logo.svg'];

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll([...ASSETS,'./learning-models.css','./learning-library.css','./learning/course-models.js','./learning/course-guides.js','./learning/course-extension.js','./learning/course-editorial.js','./learning/course-editorial-a.js','./learning/course-editorial-b.js','./learning/course-editorial-c.js','./js/learning-indicators.js','./js/learning-math.js','./js/learning-labs.js','./js/learning-labs-advanced.js','./js/learning-models.js','./js/learning-library.js','./academy-studio.css','./academy-studio-price.css','./academy-studio-indicators.css','./academy-studio-decisions.css','./learning/course-journey.js','./learning/course-workbook-review.js','./learning/course-book-review-b.js','./learning/course-book-review-a.js','./learning/course-book-review-c.js','./js/learning-attachment-labs.js','./js/academy-terminal-chart.js','./js/academy-studio-price.js','./js/academy-studio-indicators.js','./js/academy-studio-decisions.js','./js/academy-source-practice.js','./academy-source-practice.css','./js/academy-studio.js','./js/academy-studio-route.js'])).then(()=>self.skipWaiting())
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
