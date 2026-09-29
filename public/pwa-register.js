(function () {
  'use strict';
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  var lastUpdateCheck = 0;
  var registration;
  function announce(type) {
    window.dispatchEvent(new CustomEvent(type));
  }
  function watch(candidate) {
    if (!candidate) return;
    candidate.addEventListener('statechange', function () {
      if (candidate.state === 'installed') {
        announce(navigator.serviceWorker.controller ? 'rahmat:update-ready' : 'rahmat:offline-ready');
      }
    });
  }
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(function (value) {
        registration = value;
        lastUpdateCheck = Date.now();
        if (value.waiting) announce('rahmat:update-ready');
        watch(value.installing);
        value.addEventListener('updatefound', function () { watch(value.installing); });
      })
      .catch(function () { announce('rahmat:offline-unavailable'); });
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || !registration || Date.now() - lastUpdateCheck < 60 * 60 * 1000) return;
    lastUpdateCheck = Date.now();
    registration.update().catch(function () {});
  });
  // Updates wait until all Rahmat windows close. Never reload an active counter.
}());
