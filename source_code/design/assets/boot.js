(function () {
  "use strict";
  var S = window.Store, U = window.UI, A = window.App;
  var q = new URLSearchParams(location.search);
  var proto = document.querySelector(".proto");
  var pwBtn = document.querySelector("[data-pw]");

  function passwordForm(forced) {
    U.form({
      title: forced ? "Set your own password" : "Change password",
      sub: forced ? "You logged in with a temporary password. Choose a new one to continue. Nobody else will be able to see it." : "Use at least 10 characters, with letters and numbers.",
      fields: [
        { name: "current", label: forced ? "Temporary password" : "Current password", type: "password", required: true, full: true },
        { name: "new", label: "New password", type: "password", required: true, minlength: 10, full: true },
        { name: "confirm", label: "Type the new password again", type: "password", required: true, full: true }],
      submit: "Save password",
      onSubmit: function (v) {
        if (v.new !== v.confirm) throw new Error("The two new passwords don't match.");
        S.post("api/password", { current: v.current, new: v.new });
        S.reload();
        U.toast("Password changed");
        if (forced) setTimeout(function () { location.reload(); }, 300);
      }
    });
    if (forced) {
      var dlg = document.querySelector("dialog[open]");
      if (dlg) {
        dlg.querySelectorAll("[data-close]").forEach(function (b) { b.remove(); });
        dlg.addEventListener("cancel", function (e) { e.preventDefault(); });
      }
    }
  }

  if (S.mode === "api") {
    if (!S.loggedIn) { location.replace("home.html#login"); return; }
    if (proto) proto.remove();
    S.login();
    document.querySelector(".logout").addEventListener("click", function (e) {
      e.preventDefault(); S.logout(); location.href = "home.html";
    });
    if (pwBtn) { pwBtn.hidden = false; pwBtn.addEventListener("click", function () { passwordForm(false); }); }
    A.render();
    if (S.mustChangePassword) passwordForm(true);
    var last = Date.now();
    window.addEventListener("focus", function () {
      if (Date.now() - last < 30000 || document.querySelector("dialog[open]")) return;
      last = Date.now();
      if (S.reload()) A.refresh();
    });
    return;
  }

  var role = null, user = null;
  try { role = sessionStorage.getItem("moksha.role"); user = sessionStorage.getItem("moksha.user"); } catch (e) {}
  var p = q.get("role");
  if (p) { role = { staff: "front_desk" }[p] || p; user = null; }
  if (!user && !role && !p && !q.has("preview")) { location.replace("home.html#login"); return; }
  S.login(role || "front_desk", user);
  if (!q.has("preview") && proto) proto.remove();
  document.querySelector(".logout").addEventListener("click", function () {
    try { sessionStorage.removeItem("moksha.role"); sessionStorage.removeItem("moksha.user"); } catch (e) {}
  });
  document.querySelectorAll(".proto button").forEach(function (b) {
    b.addEventListener("click", function () {
      try { sessionStorage.setItem("moksha.role", b.dataset.r); sessionStorage.removeItem("moksha.user"); } catch (e) {}
      S.login(b.dataset.r);
      if (location.hash === "#/" || !location.hash) A.render(); else location.hash = "#/";
      U.toast("Now previewing as " + S.ROLE_LABEL[b.dataset.r]);
    });
  });
  A.render();
})();
