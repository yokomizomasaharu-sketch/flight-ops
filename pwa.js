/* FLIGHT OPS PWA 登録 */
(function () {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js', { scope: './' }).then(function (reg) {
      reg.addEventListener('updatefound', function () { });
    }).catch(function () { });
  });
})();
