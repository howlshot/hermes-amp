(function () {
  "use strict";

  var registry = window.__HERMES_PLUGINS__;
  if (!registry) return;

  registry.register("example", function HiddenExample() {
    return null;
  });
})();
