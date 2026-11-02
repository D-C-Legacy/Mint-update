const fs = require("node:fs"),
  path = require("node:path");
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
}
const files = walk("src/screens")
  .filter(
    (f) =>
      f.endsWith(".tsx") &&
      !f.endsWith("shared.tsx") &&
      !f.endsWith("Settings.tsx"),
  )
  .sort();
const hooks = walk("src/hooks")
  .filter((f) => path.basename(f).startsWith("use") && f.endsWith(".ts"))
  .sort();
const table = files
  .map(
    (file) =>
      "| " +
      path.basename(file, ".tsx") +
      " | [" +
      file +
      "](../" +
      file.replaceAll("\\", "/") +
      ") |",
  )
  .join("\n");
fs.writeFileSync(
  "docs/SCREEN_INVENTORY.md",
  "# Screen and hook inventory\n\n" +
    (files.length + 1) +
    " full-screen UI templates: " +
    files.length +
    " in `src/screens/` plus `src/Live.tsx`. The Settings dispatcher and marketplace card helpers are excluded. Shared templates serve multiple routes; sheet contents and wizard steps are not counted as additional screens.\n\nLaunch: Splash → three-page Onboarding → Welcome → Sign Up → OTP Verification → Live. Returning-session demo: Welcome → Sign In → Live. Settings → Log out returns to Welcome; Replay onboarding restarts the introduction. Demo OTP: `123456`.\n\n| Screen | File |\n|---|---|\n| Live | [src/Live.tsx](../src/Live.tsx) |\n" +
    table +
    "\n\n## Custom hooks\n\n" +
    hooks.length +
    " custom hooks in `src/hooks/`:\n\n" +
    hooks
      .map(
        (file) =>
          "- [" +
          path.basename(file, ".ts") +
          "](../" +
          file.replaceAll("\\", "/") +
          ")",
      )
      .join("\n") +
    "\n\n## Wizards and contextual flows\n\n- Onboarding: Shop live → Bid in real time → Follow sellers.\n- Sign up: five fields → terms acknowledgement → six-digit OTP verification.\n- Password reset: email → simulated reset success.\n- Create show: Details → Inventory → Auction rules → Shipping → Schedule → Preview; saved into session show list.\n- Checkout: Shipping address → Payment method → Review → Confirmation; saved into session orders.\n- Create/edit listing: sample photos, title, type, category, condition, description, pricing, quantity, shipping, draft/publish.\n- Live sheets: bid confirmation, custom bid, product details, expanded Chat/Questions/Bids, sharing, and state controls.\n- Settings: profile editor, payment/address forms, notification/privacy preferences, security/password change/verification, help/support, logout.\n\nAll behavior is local and simulated. No backend, real auth, payments, email, push, or streaming.\n",
);
console.log(
  files.length +
    1 +
    " full-screen templates; " +
    hooks.length +
    " custom hooks.",
);
