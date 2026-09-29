(function () {
  'use strict';
  var button = document.getElementById('repair');
  var status = document.getElementById('status');
  var open = document.getElementById('open');
  function installed(worker) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { finish(new Error('timeout')); }, 30000);
      function finish(error) { clearTimeout(timer); worker.removeEventListener('statechange', check); error ? reject(error) : resolve(); }
      function check() {
        if (worker.state === 'installed' || worker.state === 'activated') finish();
        else if (worker.state === 'redundant') finish(new Error('install'));
      }
      worker.addEventListener('statechange', check);
      check();
    });
  }
  button.addEventListener('click', async function () {
    button.disabled = true;
    open.hidden = true;
    status.textContent = 'Yangilanish olinmoqda…';
    try {
      if (!('serviceWorker' in navigator)) throw new Error('unsupported');
      var registration = await navigator.serviceWorker.register('/sw.js', {scope:'/', updateViaCache:'none'});
      await registration.update();
      if (registration.installing) await installed(registration.installing);
      var waiting = registration.waiting;
      if (waiting) {
        await new Promise(function (resolve, reject) {
          var timer = setTimeout(function () { finish(new Error('timeout')); }, 30000);
          function finish(error) { clearTimeout(timer); waiting.removeEventListener('statechange', check); error ? reject(error) : resolve(); }
          function check() {
            if (waiting.state === 'activated') finish();
            else if (waiting.state === 'redundant') finish(new Error('activate'));
          }
          waiting.addEventListener('statechange', check);
          waiting.postMessage({type:'RAHMAT_RECOVER_UPDATE'});
          check();
        });
      }
      await navigator.serviceWorker.ready;
      status.textContent = 'Rahmat yangilandi. Endi ilovani ochishingiz mumkin.';
      button.hidden = true;
      open.hidden = false;
    } catch (_) {
      status.textContent = 'Yangilanishni olib bo‘lmadi. Internetni tekshirib, yana bosing. Qaydlaringiz o‘chirilmadi.';
      button.disabled = false;
    }
  });
}());
