const ids = ["fullName","email","phone","city","linkedin","portfolio","currentTitle","education"];

chrome.storage.local.get("vipHunterProfile", ({ vipHunterProfile = {} }) => {
  ids.forEach((id) => {
    const input = document.getElementById(id);
    if (input && vipHunterProfile[id]) input.value = vipHunterProfile[id];
  });
});

document.getElementById("save").addEventListener("click", async () => {
  const profile = Object.fromEntries(ids.map((id) => [id, document.getElementById(id).value.trim()]));
  await chrome.storage.local.set({ vipHunterProfile: profile });
  const status = document.getElementById("status");
  status.textContent = "Saved";
  setTimeout(() => { status.textContent = ""; }, 1800);
});
