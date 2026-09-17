const profileIds = [
  "fullName",
  "email",
  "phone",
  "city",
  "country",
  "yearsExperience",
  "linkedin",
  "portfolio",
  "currentTitle",
  "education",
  "workAuthorization",
  "sponsorship",
  "noticePeriod",
  "expectedSalary",
];

function readFileAsData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Could not read resume"));
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve({
        name: file.name,
        type: file.type || "application/pdf",
        size: file.size,
        base64: value.includes(",") ? value.split(",")[1] : value,
      });
    };
    reader.readAsDataURL(file);
  });
}

chrome.storage.local.get(["vipHunterProfile", "vipHunterSettings", "vipHunterResume"], ({ vipHunterProfile = {}, vipHunterSettings = {}, vipHunterResume }) => {
  profileIds.forEach((id) => {
    const input = document.getElementById(id);
    if (input && vipHunterProfile[id] != null) input.value = vipHunterProfile[id];
  });

  document.getElementById("autoSubmit").checked = vipHunterSettings.autoSubmit !== false;

  const resumeStatus = document.getElementById("resumeStatus");
  if (vipHunterResume?.name) resumeStatus.textContent = `Stored resume: ${vipHunterResume.name}`;
});

document.getElementById("save").addEventListener("click", async () => {
  const status = document.getElementById("status");
  status.classList.remove("danger");
  status.textContent = "Saving…";

  try {
    const profile = Object.fromEntries(
      profileIds.map((id) => [id, document.getElementById(id).value.trim()]),
    );

    const settings = {
      autoSubmit: document.getElementById("autoSubmit").checked,
    };

    const resumeInput = document.getElementById("resume");
    const file = resumeInput.files?.[0];
    const payload = { vipHunterProfile: profile, vipHunterSettings: settings };

    if (file) {
      if (file.size > 5 * 1024 * 1024) throw new Error("Resume must be 5 MB or smaller.");
      if (!/pdf/i.test(file.type) && !/\.pdf$/i.test(file.name)) throw new Error("Please choose a PDF resume.");
      payload.vipHunterResume = await readFileAsData(file);
    }

    await chrome.storage.local.set(payload);

    if (payload.vipHunterResume) {
      document.getElementById("resumeStatus").textContent = `Stored resume: ${payload.vipHunterResume.name}`;
      resumeInput.value = "";
    }

    status.textContent = settings.autoSubmit ? "Saved · Auto Apply ON" : "Saved · Review-only mode";
    setTimeout(() => { status.textContent = ""; }, 2800);
  } catch (error) {
    status.classList.add("danger");
    status.textContent = error?.message || "Could not save settings";
  }
});
