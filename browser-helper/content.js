(() => {
  const norm = (value = "") => String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const legalPattern = /\b(gender|race|ethnicity|veteran|disability|sexual orientation|pronoun|equal employment|eeo|diversity|privacy consent|terms and conditions|certify|certification|declaration|background check|drug test)\b/i;
  const successPattern = /thank you for applying|thanks for applying|application submitted|application received|successfully submitted|we have received your application/i;
  let submitAttempted = false;
  let resultSent = false;

  function visible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function fieldText(el) {
    const pieces = [
      el.name,
      el.id,
      el.placeholder,
      el.getAttribute("aria-label"),
      el.getAttribute("data-qa"),
      el.autocomplete,
    ];

    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) pieces.push(label.textContent);
    }

    const parentLabel = el.closest("label");
    if (parentLabel) pieces.push(parentLabel.textContent);

    const group = el.closest("fieldset, .application-field, .field, .form-group, [class*='field'], [class*='question']");
    if (group) pieces.push(group.textContent?.slice(0, 260));

    return norm(pieces.filter(Boolean).join(" "));
  }

  function valueFor(text, profile) {
    const rules = [
      [/\b(first name|given name)\b/, () => profile.fullName?.split(/\s+/)[0] || ""],
      [/\b(last name|surname|family name)\b/, () => profile.fullName?.split(/\s+/).slice(1).join(" ") || ""],
      [/\b(full name|your name|candidate name)\b/, () => profile.fullName || ""],
      [/\b(email|email address)\b/, () => profile.email || ""],
      [/\b(phone|mobile|telephone|contact number)\b/, () => profile.phone || ""],
      [/\b(country)\b/, () => profile.country || ""],
      [/\b(city|current city|current location)\b/, () => profile.city || ""],
      [/linkedin/, () => profile.linkedin || ""],
      [/\b(portfolio|website|personal website)\b/, () => profile.portfolio || ""],
      [/\b(current title|job title|current role|latest role)\b/, () => profile.currentTitle || ""],
      [/\b(education|qualification|academic)\b/, () => profile.education || ""],
      [/\b(years? of (professional )?experience|total experience|experience in years)\b/, () => profile.yearsExperience || ""],
      [/\b(notice period|availability to join|when can you start)\b/, () => profile.noticePeriod || ""],
      [/\b(expected salary|salary expectation|expected compensation|ctc expectation)\b/, () => profile.expectedSalary || ""],
    ];

    for (const [pattern, getValue] of rules) {
      if (pattern.test(text)) return getValue();
    }
    return "";
  }

  function answerFor(text, profile) {
    if (/authorized.*work|legally authorized|work authorization/.test(text)) return profile.workAuthorization || "";
    if (/sponsorship|visa sponsor|require.*sponsor/.test(text)) return profile.sponsorship || "";
    if (/\bcountry\b/.test(text)) return profile.country || "";
    return valueFor(text, profile);
  }

  function setNativeValue(el, value) {
    if (!value || el.disabled || el.readOnly || !visible(el)) return false;
    if (["hidden", "file", "checkbox", "radio", "button", "submit", "reset"].includes(el.type)) return false;
    if (String(el.value || "").trim()) return false;

    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    descriptor?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function setSelectValue(el, answer) {
    if (!answer || el.disabled || !visible(el) || el.value) return false;
    const wanted = norm(answer);
    const option = [...el.options].find((opt) => {
      const text = norm(`${opt.textContent || ""} ${opt.value || ""}`);
      return text === wanted || text.includes(wanted) || wanted.includes(text);
    });
    if (!option || !option.value) return false;
    el.value = option.value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function setRadioValue(el, answer) {
    if (!answer || el.disabled || !visible(el) || el.checked) return false;
    const wanted = norm(answer);
    const text = fieldText(el);
    const ownLabel = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : el.closest("label")?.textContent;
    const choice = norm(ownLabel || el.value || "");
    if (!(choice === wanted || choice.includes(wanted))) return false;

    const group = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name || "")}"]`);
    if ([...group].some((radio) => radio.checked)) return false;
    if (legalPattern.test(text)) return false;

    el.click();
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function resumeFile(saved) {
    if (!saved?.base64) return null;
    try {
      const binary = atob(saved.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new File([bytes], saved.name || "resume.pdf", { type: saved.type || "application/pdf" });
    } catch {
      return null;
    }
  }

  function uploadResume(saved) {
    const file = resumeFile(saved);
    if (!file) return 0;
    let count = 0;

    document.querySelectorAll('input[type="file"]').forEach((el) => {
      if (!visible(el) || el.disabled || el.files?.length) return;
      const text = fieldText(el);
      if (!/resume|curriculum vitae|\bcv\b/.test(text)) return;
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        el.files = dt.files;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        count += 1;
      } catch {}
    });
    return count;
  }

  function fill(profile, savedResume) {
    let count = 0;

    document.querySelectorAll("input, textarea").forEach((el) => {
      if (el.type === "radio") {
        if (setRadioValue(el, answerFor(fieldText(el), profile))) count += 1;
        return;
      }
      const text = fieldText(el);
      const value = valueFor(text, profile);
      if (setNativeValue(el, value)) count += 1;
    });

    document.querySelectorAll("select").forEach((el) => {
      if (setSelectValue(el, answerFor(fieldText(el), profile))) count += 1;
    });

    count += uploadResume(savedResume);
    return count;
  }

  function toast(message, kind = "ok", sticky = false) {
    let box = document.getElementById("vip-hunter-helper-toast");
    if (!box) {
      box = document.createElement("div");
      box.id = "vip-hunter-helper-toast";
      Object.assign(box.style, {
        position: "fixed",
        right: "18px",
        bottom: "18px",
        zIndex: "2147483647",
        color: "white",
        padding: "12px 14px",
        borderRadius: "10px",
        boxShadow: "0 10px 35px rgba(0,0,0,.2)",
        font: "600 12px system-ui, sans-serif",
        maxWidth: "360px",
        lineHeight: "1.45",
      });
      document.body.appendChild(box);
    }
    box.style.background = kind === "warn" ? "#7a4a08" : kind === "success" ? "#12663d" : "#153c2b";
    box.textContent = message;
    if (!sticky) setTimeout(() => box?.remove(), 7000);
  }

  function pageHasSuccess() {
    const text = document.body?.innerText || "";
    return successPattern.test(text) || /thank|success|confirmation/i.test(location.pathname);
  }

  function applicationFieldCount() {
    return [...document.querySelectorAll("input, textarea, select")].filter((el) => visible(el) && !["hidden", "button", "submit", "reset"].includes(el.type)).length;
  }

  function clickApplicationOpener() {
    if (applicationFieldCount() >= 3) return false;
    if (sessionStorage.getItem("vipHunterApplyOpened") === "1") return false;

    const candidates = [...document.querySelectorAll("a, button")].filter(visible);
    const target = candidates.find((el) => /^(apply|apply now|apply for this job|i'?m interested|interested)$/i.test((el.textContent || "").trim()));
    if (!target) return false;

    sessionStorage.setItem("vipHunterApplyOpened", "1");
    target.click();
    return true;
  }

  function requiredBlockers() {
    const blockers = [];

    const bodyText = norm((document.body?.innerText || "").slice(0, 30000));
    if (document.querySelector('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], .g-recaptcha, .h-captcha, [id*="captcha" i], [class*="captcha" i]') || /\bcaptcha\b/.test(bodyText)) {
      blockers.push("CAPTCHA detected");
    }

    if (document.querySelector('input[type="password"]') && [...document.querySelectorAll('input[type="password"]')].some(visible)) {
      blockers.push("login/password required");
    }

    if (/one time password|verification code|enter otp|\botp\b/.test(bodyText)) blockers.push("OTP/verification required");

    const required = [...document.querySelectorAll("input[required], textarea[required], select[required], [aria-required='true']")].filter(visible);
    for (const el of required) {
      const text = fieldText(el);
      if (legalPattern.test(text)) {
        blockers.push("legal/demographic declaration requires review");
        continue;
      }

      if (el.type === "checkbox") {
        if (!el.checked) blockers.push(`required checkbox: ${text.slice(0, 70) || "review required"}`);
        continue;
      }

      if (el.type === "radio") {
        const name = el.name;
        if (name && !document.querySelector(`input[type="radio"][name="${CSS.escape(name)}"]:checked`)) blockers.push(`required choice: ${text.slice(0, 70) || "review required"}`);
        continue;
      }

      if (el.type === "file") {
        if (!el.files?.length) blockers.push(`required file: ${text.slice(0, 70) || "upload required"}`);
        continue;
      }

      if (el instanceof HTMLSelectElement) {
        if (!el.value) blockers.push(`required selection: ${text.slice(0, 70) || "review required"}`);
        continue;
      }

      if (!String(el.value || "").trim()) blockers.push(`required field: ${text.slice(0, 70) || "review required"}`);
    }

    return [...new Set(blockers)];
  }

  function submitButton() {
    const candidates = [...document.querySelectorAll('button[type="submit"], input[type="submit"], button')].filter(visible);
    return candidates.find((el) => /submit application|submit|send application|complete application|apply now|apply/i.test((el.textContent || el.value || "").trim())) || null;
  }

  function sendResult(status, reason) {
    if (resultSent && status !== "submitted") return;
    resultSent = status === "submitted" || resultSent;
    chrome.runtime.sendMessage({ type: "VIP_APPLY_RESULT", status, reason }).catch?.(() => {});
  }

  async function monitorSubmission() {
    for (let i = 0; i < 25; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (pageHasSuccess()) {
        toast("VIP-Hunter submitted this application successfully.", "success", true);
        sendResult("submitted", "Application submitted successfully.");
        return;
      }
    }

    const blockers = requiredBlockers();
    const reason = blockers.length ? blockers[0] : "Submission did not confirm automatically. Review this application before continuing.";
    toast(`VIP-Hunter paused: ${reason}`, "warn", true);
    sendResult("action_required", reason);
  }

  async function run(profile, settings, savedResume) {
    if (pageHasSuccess()) {
      sendResult("submitted", "Application submitted successfully.");
      return;
    }

    if (clickApplicationOpener()) {
      toast("VIP-Hunter opened the application form. Preparing fields…");
      setTimeout(() => run(profile, settings, savedResume), 1800);
      return;
    }

    const count = fill(profile, savedResume);
    if (count) toast(`VIP-Hunter filled ${count} field${count === 1 ? "" : "s"}${savedResume?.name ? " and checked the saved resume" : ""}.`);

    if (settings.autoSubmit === false || submitAttempted) return;

    await new Promise((resolve) => setTimeout(resolve, 900));
    fill(profile, savedResume);

    const blockers = requiredBlockers();
    if (blockers.length) {
      const reason = blockers.slice(0, 2).join("; ");
      toast(`VIP-Hunter paused: ${reason}`, "warn", true);
      sendResult("action_required", reason);
      return;
    }

    const button = submitButton();
    if (!button) {
      const reason = "No safe final submit button was detected.";
      toast(`VIP-Hunter paused: ${reason}`, "warn", true);
      sendResult("action_required", reason);
      return;
    }

    submitAttempted = true;
    toast("VIP-Hunter is submitting this completed application…", "ok", true);
    button.click();
    monitorSubmission();
  }

  chrome.storage.local.get(["vipHunterProfile", "vipHunterSettings", "vipHunterResume"], ({ vipHunterProfile, vipHunterSettings = {}, vipHunterResume }) => {
    if (!vipHunterProfile) {
      toast("VIP-Hunter needs your verified profile in Extension options before Auto Apply can run.", "warn", true);
      sendResult("action_required", "Extension profile is not configured.");
      return;
    }

    const settings = { autoSubmit: vipHunterSettings.autoSubmit !== false };
    setTimeout(() => run(vipHunterProfile, settings, vipHunterResume), 900);
    setTimeout(() => fill(vipHunterProfile, vipHunterResume), 2600);
  });
})();
