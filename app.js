(function () {
  "use strict";

  const Engine = window.SmartmanteauEngine;
  if (!Engine) {
    document.body.innerHTML = "<p>Smartmanteau could not load its local engine file.</p>";
    return;
  }

  const STORAGE_KEY = "smartmanteau-settings-v1";
  const form = document.getElementById("generator-form");
  const resultsRegion = document.getElementById("results");
  const resultsSummary = document.getElementById("results-summary");
  const warningBox = document.getElementById("warning-box");
  const liveRegion = document.getElementById("live-region");
  const themeToggle = document.getElementById("theme-toggle");
  const manipulationToggle = document.getElementById("allow-manipulation");
  const manipulationOptions = document.getElementById("manipulation-options");
  const copyAllButton = document.getElementById("copy-all");
  const generateButton = document.getElementById("generate-button");
  const resultSearch = document.getElementById("result-search");
  const processFilter = document.getElementById("process-filter");
  const filterSummary = document.getElementById("filter-summary");
  const PAGE_SIZE = 24;
  let currentData = null;
  const visibleLimits = { best: PAGE_SIZE, good: PAGE_SIZE, other: PAGE_SIZE };
  const visibleItems = { best: [], good: [], other: [] };

  const resultContainers = {
    best: document.getElementById("best-results"),
    good: document.getElementById("good-results"),
    other: document.getElementById("other-results")
  };

  const resultCountElements = {
    best: document.getElementById("best-count"),
    good: document.getElementById("good-count"),
    other: document.getElementById("other-count")
  };

  const showMoreButtons = {
    best: document.getElementById("show-more-best"),
    good: document.getElementById("show-more-good"),
    other: document.getElementById("show-more-other")
  };

  const settingsFields = [
    "priority",
    "balance",
    "prioritize-stress",
    "allow-manipulation",
    "allow-deletion",
    "allow-metathesis",
    "allow-equivalent",
    "allow-compression",
    "vowels",
    "vowel-clusters",
    "consonant-clusters",
    "allowed-shapes",
    "equivalence-groups",
    "sound-classes"
  ];

  const examples = {
    jonathan: {
      wordA: "Jonathan",
      guideA: "Jon-a-than",
      stressA: 1,
      wordB: "Doris",
      guideB: "Dor-is",
      stressB: 1
    },
    sierra: {
      wordA: "Sierra",
      guideA: "Si-er-ra",
      stressA: 2,
      wordB: "Everett",
      guideB: "Ev-er-ett",
      stressB: 1
    },
    joe: {
      wordA: "Joe",
      guideA: "Joe",
      stressA: 1,
      wordB: "George",
      guideB: "George",
      stressB: 1
    },
    nocturne: {
      wordA: "Nocturne",
      guideA: "Noc-turne",
      stressA: 1,
      wordB: "Daylia",
      guideB: "Day-li-a",
      stressB: 1,
      extraGroup: "Story bridge = o/au/aw/ay"
    }
  };

  function setStarterPhonology() {
    document.getElementById("vowels").value = Engine.DEFAULTS.vowels;
    document.getElementById("vowel-clusters").value = Engine.DEFAULTS.vowelClusters;
    document.getElementById("consonant-clusters").value = Engine.DEFAULTS.consonantClusters;
    document.getElementById("allowed-shapes").value = Engine.DEFAULTS.allowedShapes;
    document.getElementById("equivalence-groups").value = Engine.DEFAULTS.equivalenceGroups;
    document.getElementById("sound-classes").value = Engine.DEFAULTS.soundClasses;
  }

  function setTheme(theme) {
    const normalized = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = normalized;
    const isDark = normalized === "dark";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.textContent = isDark ? "Use light mode" : "Use dark mode";
  }

  function savePreferences() {
    const data = {};
    settingsFields.forEach((id) => {
      const field = document.getElementById(id);
      data[id] = field.type === "checkbox" ? field.checked : field.value;
    });
    data.theme = document.documentElement.dataset.theme;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      // Local storage is optional; the app still works without it.
    }
  }

  function loadPreferences() {
    setStarterPhonology();
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (error) {
      saved = null;
    }

    if (saved) {
      settingsFields.forEach((id) => {
        const field = document.getElementById(id);
        if (!(id in saved)) return;
        if (field.type === "checkbox") field.checked = Boolean(saved[id]);
        else field.value = String(saved[id]);
      });
      setTheme(saved.theme);
    } else {
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    }
    updateManipulationState();
  }

  function updateManipulationState() {
    const enabled = manipulationToggle.checked;
    manipulationOptions.querySelectorAll("input").forEach((input) => {
      input.disabled = !enabled;
    });
    manipulationOptions.setAttribute("aria-disabled", String(!enabled));
  }

  function getSettings() {
    return {
      vowels: document.getElementById("vowels").value,
      vowelClusters: document.getElementById("vowel-clusters").value,
      consonantClusters: document.getElementById("consonant-clusters").value,
      allowedShapes: document.getElementById("allowed-shapes").value,
      equivalenceGroups: document.getElementById("equivalence-groups").value,
      soundClasses: document.getElementById("sound-classes").value,
      priority: document.getElementById("priority").value,
      balance: document.getElementById("balance").value,
      prioritizeStress: document.getElementById("prioritize-stress").checked,
      allowManipulation: manipulationToggle.checked,
      allowDeletion: document.getElementById("allow-deletion").checked,
      allowMetathesis: document.getElementById("allow-metathesis").checked,
      allowEquivalentSounds: document.getElementById("allow-equivalent").checked,
      allowCompression: document.getElementById("allow-compression").checked,
      maxPerSection: 24
    };
  }

  function getInput() {
    return {
      wordA: document.getElementById("word-a").value,
      guideA: document.getElementById("guide-a").value,
      stressA: document.getElementById("stress-a").value,
      wordB: document.getElementById("word-b").value,
      guideB: document.getElementById("guide-b").value,
      stressB: document.getElementById("stress-b").value,
      settings: getSettings()
    };
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderEmpty(container, message) {
    container.innerHTML = `<p class="empty-message">${escapeHtml(message)}</p>`;
  }

  function resultText(result, words) {
    return [
      result.display,
      `Rough split: ${result.roughSyllables.join("-") || result.display}`,
      `${words.a.display}: ${result.aPart || "—"}`,
      `${words.b.display}: ${result.bPart || "—"}`,
      `Processes: ${result.operationLabels.join(", ")}`,
      `Why: ${result.reasons.join(" ")}`
    ].join("\n");
  }

  function createResultCard(result, words) {
    const article = document.createElement("article");
    article.className = "result-card";

    const badges = result.operationLabels
      .map((label) => `<span class="badge">${escapeHtml(label)}</span>`)
      .join("");
    const reasons = result.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("");

    article.innerHTML = `
      <h4 class="result-word">${escapeHtml(result.display)}</h4>
      <p class="rough-split" aria-label="Rough syllable split">${escapeHtml(result.roughSyllables.join("-") || result.display)}</p>
      <div class="source-parts">
        <span><strong>${escapeHtml(words.a.display)}:</strong> ${escapeHtml(result.aPart || "—")}</span>
        <span><strong>${escapeHtml(words.b.display)}:</strong> ${escapeHtml(result.bPart || "—")}</span>
      </div>
      <div class="badge-list" aria-label="Generation processes">${badges}</div>
      <details class="why-details">
        <summary>Why it landed here</summary>
        <ul>${reasons}</ul>
      </details>
      <div class="card-actions">
        <button class="copy-button" type="button">Copy this result</button>
      </div>
    `;

    const copyButton = article.querySelector(".copy-button");
    copyButton.addEventListener("click", async () => {
      const copied = await copyText(resultText(result, words));
      copyButton.textContent = copied ? "Copied" : "Copy failed";
      liveRegion.textContent = copied ? `${result.display} copied.` : `Could not copy ${result.display}.`;
      window.setTimeout(() => {
        copyButton.textContent = "Copy this result";
      }, 1600);
    });

    return article;
  }

  function matchesProcess(result, process) {
    const operations = new Set(result.operations || []);
    if (process === "all") return true;
    if (process === "literal") {
      return ![
        "drop-unstressed",
        "drop-light",
        "metathesis",
        "sound-equivalent",
        "nucleus-bridge"
      ].some((operation) => operations.has(operation));
    }
    if (process === "overlap") {
      return operations.has("overlap") || operations.has("shared-link") || operations.has("compression");
    }
    if (process === "deletion") {
      return operations.has("drop-unstressed") || operations.has("drop-light");
    }
    if (process === "metathesis") return operations.has("metathesis");
    if (process === "sound") return operations.has("sound-equivalent") || operations.has("nucleus-bridge");
    return true;
  }

  function filteredCategoryItems(category) {
    if (!currentData) return [];
    const query = Engine.normalizeName(resultSearch.value);
    const process = processFilter.value;
    return currentData[category].filter((result) => {
      const matchesText = !query || Engine.normalizeName(result.display).includes(query);
      return matchesText && matchesProcess(result, process);
    });
  }

  function updateCopyData() {
    if (!currentData) {
      copyAllButton.dataset.copyText = "";
      return;
    }
    copyAllButton.dataset.copyText = [
      "Best outcomes",
      ...visibleItems.best.map((item) => item.display),
      "",
      "Good outcomes",
      ...visibleItems.good.map((item) => item.display),
      "",
      "Other legal blends",
      ...visibleItems.other.map((item) => item.display)
    ].join("\n");
  }

  function renderCategory(category) {
    const container = resultContainers[category];
    const matches = filteredCategoryItems(category);
    const limit = visibleLimits[category];
    const shown = matches.slice(0, limit);
    visibleItems[category] = shown;
    container.innerHTML = "";

    if (!shown.length) {
      renderEmpty(container, "No blends in this section match the current result filters.");
    } else {
      shown.forEach((result) => container.appendChild(createResultCard(result, currentData.words)));
    }

    resultCountElements[category].textContent = `Showing ${shown.length.toLocaleString()} of ${matches.length.toLocaleString()}`;
    const remaining = Math.max(0, matches.length - shown.length);
    showMoreButtons[category].hidden = remaining === 0;
    showMoreButtons[category].textContent = remaining > PAGE_SIZE
      ? `Show ${PAGE_SIZE} more`
      : `Show ${remaining} more`;
  }

  function renderFilteredResults(announce) {
    if (!currentData) return;
    renderCategory("best");
    renderCategory("good");
    renderCategory("other");
    updateCopyData();

    const matchCounts = ["best", "good", "other"].map((category) => filteredCategoryItems(category).length);
    const totalMatches = matchCounts.reduce((sum, count) => sum + count, 0);
    const shownCount = visibleItems.best.length + visibleItems.good.length + visibleItems.other.length;
    const queryText = resultSearch.value.trim();
    const processText = processFilter.options[processFilter.selectedIndex].textContent;
    const filterParts = [];
    if (queryText) filterParts.push(`name contains “${queryText}”`);
    if (processFilter.value !== "all") filterParts.push(processText.toLocaleLowerCase());
    filterSummary.textContent = filterParts.length
      ? `${totalMatches.toLocaleString()} matches for ${filterParts.join(" and ")}; ${shownCount.toLocaleString()} are currently visible.`
      : `${totalMatches.toLocaleString()} generated blends are available; ${shownCount.toLocaleString()} are currently visible.`;

    if (announce) {
      liveRegion.textContent = `${totalMatches.toLocaleString()} results match the current filters. ${shownCount.toLocaleString()} are visible.`;
    }
  }

  function resetVisibleLimits() {
    visibleLimits.best = PAGE_SIZE;
    visibleLimits.good = PAGE_SIZE;
    visibleLimits.other = PAGE_SIZE;
  }

  function renderResults(data) {
    currentData = data;
    resultsRegion.hidden = false;
    resultSearch.value = "";
    processFilter.value = "all";
    resetVisibleLimits();
    resultsSummary.textContent = `${data.totalGenerated.toLocaleString()} legal blends were generated for ${data.words.a.display} + ${data.words.b.display}. Use the search and generation-path filter to explore them without loading every card at once.`;

    if (data.warnings.length) {
      warningBox.hidden = false;
      warningBox.textContent = data.warnings.join(" ");
    } else {
      warningBox.hidden = true;
      warningBox.textContent = "";
    }

    renderFilteredResults(false);
    const visibleCount = visibleItems.best.length + visibleItems.good.length + visibleItems.other.length;
    liveRegion.textContent = `Generated ${data.totalGenerated.toLocaleString()} legal blends. ${visibleCount.toLocaleString()} are visible.`;
    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultsRegion.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }

  function clearResults() {
    currentData = null;
    resultsRegion.hidden = true;
    resultsSummary.textContent = "";
    filterSummary.textContent = "";
    warningBox.hidden = true;
    resultSearch.value = "";
    processFilter.value = "all";
    Object.values(resultContainers).forEach((container) => {
      container.innerHTML = "";
    });
    Object.values(resultCountElements).forEach((element) => {
      element.textContent = "";
    });
    Object.values(showMoreButtons).forEach((button) => {
      button.hidden = true;
    });
    copyAllButton.dataset.copyText = "";
    liveRegion.textContent = "Results cleared.";
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const okay = document.execCommand("copy");
        textarea.remove();
        if (!okay) throw new Error("Copy command failed");
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (generateButton.disabled) return;
    const input = getInput();
    if (!Engine.normalizeName(input.wordA) || !Engine.normalizeName(input.wordB)) {
      liveRegion.textContent = "Enter both words before generating.";
      if (!Engine.normalizeName(input.wordA)) document.getElementById("word-a").focus();
      else document.getElementById("word-b").focus();
      return;
    }

    savePreferences();
    const originalLabel = generateButton.textContent;
    generateButton.disabled = true;
    generateButton.textContent = "Generating…";
    liveRegion.textContent = "Generating portmanteaus.";

    window.setTimeout(() => {
      try {
        const data = Engine.generate(input);
        renderResults(data);
      } catch (error) {
        resultsRegion.hidden = false;
        warningBox.hidden = false;
        warningBox.textContent = "Smartmanteau could not finish this combination. Check the custom phonology fields and try again.";
        liveRegion.textContent = "Generation failed. Check the custom phonology settings.";
        console.error(error);
      } finally {
        generateButton.disabled = false;
        generateButton.textContent = originalLabel;
      }
    }, 20);
  });

  document.getElementById("clear-button").addEventListener("click", clearResults);

  resultSearch.addEventListener("input", () => {
    resetVisibleLimits();
    renderFilteredResults(true);
  });

  processFilter.addEventListener("change", () => {
    resetVisibleLimits();
    renderFilteredResults(true);
  });

  document.getElementById("reset-result-filters").addEventListener("click", () => {
    resultSearch.value = "";
    processFilter.value = "all";
    resetVisibleLimits();
    renderFilteredResults(true);
    resultSearch.focus();
  });

  Object.entries(showMoreButtons).forEach(([category, button]) => {
    button.addEventListener("click", () => {
      visibleLimits[category] += PAGE_SIZE;
      renderFilteredResults(false);
      liveRegion.textContent = `Showing more ${category} outcomes.`;
    });
  });

  themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
    savePreferences();
  });

  manipulationToggle.addEventListener("change", () => {
    updateManipulationState();
    savePreferences();
  });

  settingsFields.forEach((id) => {
    document.getElementById(id).addEventListener("change", savePreferences);
  });

  document.getElementById("reset-phonology").addEventListener("click", () => {
    setStarterPhonology();
    savePreferences();
    liveRegion.textContent = "Starter phonology restored.";
  });

  document.querySelectorAll(".example-button").forEach((button) => {
    button.addEventListener("click", () => {
      const example = examples[button.dataset.example];
      if (!example) return;
      document.getElementById("word-a").value = example.wordA;
      document.getElementById("guide-a").value = example.guideA;
      document.getElementById("stress-a").value = example.stressA;
      document.getElementById("word-b").value = example.wordB;
      document.getElementById("guide-b").value = example.guideB;
      document.getElementById("stress-b").value = example.stressB;
      if (example.extraGroup) {
        const field = document.getElementById("equivalence-groups");
        if (!field.value.includes(example.extraGroup)) field.value = `${field.value.trim()}\n${example.extraGroup}`.trim();
      }
      savePreferences();
      liveRegion.textContent = `${example.wordA} and ${example.wordB} loaded.`;
      document.getElementById("word-a").focus();
    });
  });

  copyAllButton.addEventListener("click", async () => {
    const copied = await copyText(copyAllButton.dataset.copyText || "");
    copyAllButton.textContent = copied ? "Copied visible results" : "Copy failed";
    liveRegion.textContent = copied ? "Visible results copied." : "Could not copy the visible results.";
    window.setTimeout(() => {
      copyAllButton.textContent = "Copy visible results";
    }, 1600);
  });

  loadPreferences();
})();
