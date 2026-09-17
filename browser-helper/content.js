(() => {
  const norm = (value = "") => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  function fieldText(el) {
    const pieces = [
      el.name,
      el.id,
      el.placeholder,
      el.getAttribute("aria-label"),
      el.autocomplete,
    ];

    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) pieces.push(label.textContent);
    }

    const parentLabel = el.closest("label");
    if (parentLabel) pieces.push(parentLabel.textContent);

    const group = el.closest(".application-field, .field, .form-group, [class*='field']");
    if (group) pieces.push(group.textContent?.slice(0, 180));

    return norm(pieces.filter(Boolean).join(" "));
  }

  function valueFor(text, profile) {
    const rules = [
      [/\b(first name|given name)\b/, () => profile.fullName?.split(/\s+/)[0] || ""],
      [/\b(last name|surname|family name)\b/, () => profile.fullName?.split(/\s+/).slice(1).join(" ") || ""],
      [/\b(full name|your name|candidate name|name)\b/, () => profile.fullName || ""],
      [/\b(email|email address)\b/, () => profile.email || ""],
      [/\b(phone|mobile|telephone|contact number)\b/, () => profile.phone || ""],
      [/\b(city|current city|location)\b/, () => profile.city || ""],
      [/linkedin/, () => profile.linkedin || ""],
      [/\b(portfolio|website|personal website)\b/, () => profile.portfolio || ""],
      [/\b(current title|job title|current role|latest role)\b/, () => profile.currentTitle || ""],
      [/\b(education|qualification|academic)\b/, () => profile.education || ""],
    ];

    for (const [pattern, getValue] of rules) {
      if (pattern.test(text)) return getValue();
    }
    return "";
  }

  function setNativeValue(el, value) {
    if (!value || el.disabled || el.readOnly) return false;
    if (el.type === "hidden" || el.type === "file" || el.type === "checkbox" || el.type === "radio") return false;
    if (el.value?.trim()) return false;

    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    descriptor?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function fill(profile) {
    let count = 0;
    document.querySelectorAll("input, textarea").forEach((el) => {
      const text = fieldText(el);
      const value = valueFor(text, profile);
      if (setNativeValue(el, value)) count += 1;
    });

    if (!document.getElementById("vip-hunter-helper-toast")) {
      const toast = document.createElement("div");
      toast.id = "vip-hunter-helper-toast";
      toast.textContent = count
        ? `VIP-Hunter filled ${count} field${count === 1 ? "" : "s"}. Review everything before submitting.`
        : "VIP-Hunter found no safe fields to fill on this page.";
      Object.assign(toast.style, {
        position: "fixed",
        right: "18px",
        bottom: "18px",
        zIndex: "2147483647",
        background: "#153c2b",
        color: "white",
        padding: "12px 14px",
        borderRadius: "10px",
        boxShadow: "0 10px 35px rgba(0,0,0,.2)",
        font: "600 12px system-ui, sans-serif",
        maxWidth: "320px",
      });
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 7000);
    }
  }

  chrome.storage.local.get("vipHunterProfile", ({ vipHunterProfile }) => {
    if (!vipHunterProfile) return;
    setTimeout(() => fill(vipHunterProfile), 900);
    setTimeout(() => fill(vipHunterProfile), 2600);
  });
})();
