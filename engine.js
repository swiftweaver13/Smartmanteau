/*
 * Smartmanteau phonology-aware portmanteau engine
 * Deterministic, offline, and dependency-free.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.SmartmanteauEngine = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULTS = Object.freeze({
    vowels: "a, e, i, o, u, y",
    vowelClusters: "aa, ae, ai, ay, au, aw, ea, ee, ei, eu, ey, ia, ie, io, oa, oe, oi, oo, ou, oy, ua, ue, ui",
    consonantClusters: "bl, br, ch, cl, cr, dr, fl, fr, gh, gl, gr, kn, ph, pl, pr, qu, sc, sch, sh, sk, sl, sm, sn, sp, spl, spr, st, str, sw, th, tr, tw, wh, wr",
    allowedShapes: "V, CV, VC, CVC, VCC, CCV, CCVC, CVV, CVVC, CVCV, CVCC, CCVCC, CCVVC",
    equivalenceGroups: "Long E = ee/ea/e/i\nO family = o/au/aw\nF sound = f/ph\nK sound = k/c/qu",
    soundClasses: "Nasal = m/n/ng\nLiquid = l/r\nGlide = w/y",
    priority: "flow",
    balance: "moderate",
    prioritizeStress: true,
    allowManipulation: true,
    allowDeletion: true,
    allowMetathesis: true,
    allowEquivalentSounds: true,
    allowCompression: true,
    maxPerSection: 24
  });

  function normalizeName(value) {
    if (!value) return "";
    return String(value)
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replace(/[^\p{L}]/gu, "");
  }

  function displayName(value) {
    const clean = String(value || "").trim();
    if (!clean) return "";
    return clean.charAt(0).toLocaleUpperCase() + clean.slice(1);
  }

  function titleCase(value) {
    const clean = String(value || "");
    return clean ? clean.charAt(0).toLocaleUpperCase() + clean.slice(1) : "";
  }

  function unique(items) {
    return Array.from(new Set(items.filter(Boolean)));
  }

  function parseList(value) {
    return unique(
      String(value || "")
        .split(/[\n,;]+/)
        .map((item) => normalizeName(item))
        .filter(Boolean)
    );
  }

  function parseShapes(value) {
    return unique(
      String(value || "")
        .toLocaleUpperCase()
        .split(/[\s,;]+/)
        .map((item) => item.replace(/[^CV]/g, ""))
        .filter(Boolean)
    );
  }

  function parseNamedGroups(value) {
    const groups = [];
    String(value || "")
      .split(/[\n;]+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line, index) => {
        const pieces = line.split("=");
        const label = pieces.length > 1 ? pieces.shift().trim() : `Group ${index + 1}`;
        const body = pieces.length ? pieces.join("=") : line;
        const members = unique(
          body
            .replace(/[\[\](){}]/g, "")
            .split(/[\/,|]+/)
            .map((item) => normalizeName(item))
            .filter(Boolean)
        );
        if (members.length >= 2) groups.push({ label, members });
      });
    return groups;
  }

  function buildPhonology(rawSettings) {
    const settings = Object.assign({}, DEFAULTS, rawSettings || {});
    const vowels = parseList(settings.vowels);
    const vowelClusters = parseList(settings.vowelClusters);
    const consonantClusters = parseList(settings.consonantClusters);
    const equivalenceGroups = parseNamedGroups(settings.equivalenceGroups);
    const soundClasses = parseNamedGroups(settings.soundClasses);
    const allowedShapes = parseShapes(settings.allowedShapes);

    const clusterUnits = unique(
      vowelClusters
        .concat(consonantClusters)
        .concat(equivalenceGroups.flatMap((group) => group.members))
        .concat(soundClasses.flatMap((group) => group.members))
    ).sort((a, b) => b.length - a.length || a.localeCompare(b));

    const groupByMember = new Map();
    equivalenceGroups.forEach((group) => {
      group.members.forEach((member) => {
        if (!groupByMember.has(member)) groupByMember.set(member, []);
        groupByMember.get(member).push(group);
      });
    });

    const classByMember = new Map();
    soundClasses.forEach((group) => {
      group.members.forEach((member) => {
        if (!classByMember.has(member)) classByMember.set(member, []);
        classByMember.get(member).push(group);
      });
    });

    return {
      settings,
      vowels,
      vowelClusters,
      consonantClusters,
      equivalenceGroups,
      soundClasses,
      allowedShapes: allowedShapes.length ? allowedShapes : parseShapes(DEFAULTS.allowedShapes),
      clusterUnits,
      groupByMember,
      classByMember
    };
  }

  function tokenize(text, phonology) {
    const source = normalizeName(text);
    const tokens = [];
    let index = 0;
    while (index < source.length) {
      let unit = "";
      for (const candidate of phonology.clusterUnits) {
        if (candidate && source.startsWith(candidate, index)) {
          unit = candidate;
          break;
        }
      }
      if (!unit) unit = source[index];
      const start = index;
      index += unit.length;
      tokens.push({
        text: unit,
        start,
        end: index,
        type: unitType(unit, phonology)
      });
    }
    return tokens;
  }

  function unitType(unit, phonology) {
    if (phonology.vowelClusters.includes(unit)) return "V";
    if (phonology.consonantClusters.includes(unit)) return "C";
    const first = Array.from(unit)[0] || "";
    return phonology.vowels.includes(first) ? "V" : "C";
  }

  function areEquivalent(a, b, phonology) {
    if (a === b) return true;
    const aGroups = phonology.groupByMember.get(a) || [];
    return aGroups.some((group) => group.members.includes(b));
  }

  function shareSoundClass(a, b, phonology) {
    if (a === b) return true;
    const classes = phonology.classByMember.get(a) || [];
    return classes.some((group) => group.members.includes(b));
  }

  function groupForPair(a, b, phonology) {
    const groups = phonology.groupByMember.get(a) || [];
    return groups.find((group) => group.members.includes(b)) || null;
  }

  function syllabifyText(text, phonology) {
    const source = normalizeName(text);
    const tokens = tokenize(source, phonology);
    const vowelIndexes = [];
    tokens.forEach((token, index) => {
      if (token.type === "V") vowelIndexes.push(index);
    });

    if (!tokens.length) return [];
    if (!vowelIndexes.length) {
      return [{ text: source, start: 0, end: source.length, pattern: tokens.map((token) => token.type).join("") }];
    }

    const syllables = [];
    let startToken = 0;
    vowelIndexes.forEach((vowelIndex, vowelPosition) => {
      const nextVowelIndex = vowelIndexes[vowelPosition + 1];
      const endToken = nextVowelIndex == null ? tokens.length : nextVowelIndex;
      const slice = tokens.slice(startToken, endToken);
      if (slice.length) {
        syllables.push({
          text: source.slice(slice[0].start, slice[slice.length - 1].end),
          start: slice[0].start,
          end: slice[slice.length - 1].end,
          pattern: slice.map((token) => token.type).join("")
        });
      }
      startToken = endToken;
    });

    if (startToken < tokens.length) {
      const trailing = tokens.slice(startToken);
      if (syllables.length) {
        const last = syllables[syllables.length - 1];
        last.text += source.slice(trailing[0].start, trailing[trailing.length - 1].end);
        last.end = trailing[trailing.length - 1].end;
        last.pattern += trailing.map((token) => token.type).join("");
      }
    }

    return syllables;
  }

  function parseGuide(word, guide, stressInput, phonology) {
    const normalizedWord = normalizeName(word);
    const warnings = [];
    let syllables = [];
    const guideParts = String(guide || "")
      .split(/[-·.\s]+/)
      .map((part) => normalizeName(part))
      .filter(Boolean);

    if (guideParts.length && guideParts.join("") === normalizedWord) {
      let cursor = 0;
      syllables = guideParts.map((part) => {
        const start = cursor;
        cursor += part.length;
        return {
          text: part,
          start,
          end: cursor,
          pattern: tokenize(part, phonology).map((token) => token.type).join("")
        };
      });
    } else {
      if (guideParts.length) {
        warnings.push(`The syllable guide for ${displayName(word)} did not match its spelling, so Smartmanteau used an automatic split.`);
      }
      syllables = syllabifyText(normalizedWord, phonology);
    }

    const parsedStress = Number.parseInt(stressInput, 10);
    const stressIndex = Number.isFinite(parsedStress)
      ? Math.max(0, Math.min(syllables.length - 1, parsedStress - 1))
      : 0;

    return { syllables, stressIndex, warnings };
  }

  function createWordModel(id, rawWord, guide, stressInput, phonology) {
    const normalized = normalizeName(rawWord);
    const parsed = parseGuide(rawWord, guide, stressInput, phonology);
    return {
      id,
      raw: String(rawWord || "").trim(),
      display: displayName(rawWord),
      normalized,
      syllables: parsed.syllables,
      stressIndex: parsed.stressIndex,
      stressedSyllable: parsed.syllables[parsed.stressIndex] || null,
      warnings: parsed.warnings,
      tokens: tokenize(normalized, phonology)
    };
  }

  function findSyllableIndex(position, model) {
    return model.syllables.findIndex((syllable) => position >= syllable.start && position < syllable.end);
  }

  function addVariant(collection, seen, text, operations, note) {
    const normalized = normalizeName(text);
    if (normalized.length < 2 || seen.has(normalized)) return;
    seen.add(normalized);
    collection.push({ text: normalized, operations: unique(operations), note: note || "" });
  }

  function buildVariants(model, phonology, options) {
    const variants = [];
    const seen = new Set();
    addVariant(variants, seen, model.normalized, [], "Original spelling");

    if (!options.allowManipulation) return variants;

    if (options.allowDeletion) {
      model.syllables.forEach((syllable, index) => {
        if (index === model.stressIndex) return;
        const withoutSyllable = model.normalized.slice(0, syllable.start) + model.normalized.slice(syllable.end);
        addVariant(variants, seen, withoutSyllable, ["drop-unstressed"], `Dropped unstressed “${syllable.text}”`);

        const syllableTokens = tokenize(syllable.text, phonology);
        syllableTokens.forEach((token) => {
          if (token.type !== "V") return;
          const absoluteStart = syllable.start + token.start;
          const withoutNucleus = model.normalized.slice(0, absoluteStart) + model.normalized.slice(absoluteStart + token.text.length);
          addVariant(variants, seen, withoutNucleus, ["drop-unstressed"], `Dropped an unstressed vowel sound from “${syllable.text}”`);
        });
      });

      const weakUnits = new Set(["a", "e", "i", "o", "u", "y", "h", "w", "m", "n", "l", "r"]);
      const tokens = tokenize(model.normalized, phonology);
      tokens.forEach((token, tokenIndex) => {
        if (tokenIndex === 0 || tokenIndex === tokens.length - 1) return;
        const syllableIndex = findSyllableIndex(token.start, model);
        const isUnstressed = syllableIndex >= 0 && syllableIndex !== model.stressIndex;
        const isWeak = weakUnits.has(token.text) || ["Nasal", "Liquid", "Glide"].some((label) => {
          const classes = phonology.classByMember.get(token.text) || [];
          return classes.some((group) => group.label.toLocaleLowerCase().includes(label.toLocaleLowerCase()));
        });
        if (!isUnstressed && !isWeak) return;
        const withoutUnit = model.normalized.slice(0, token.start) + model.normalized.slice(token.end);
        const flow = flowInfo(withoutUnit, phonology);
        if (flow.severe) return;
        addVariant(
          variants,
          seen,
          withoutUnit,
          [isUnstressed ? "drop-unstressed" : "drop-light"],
          isUnstressed ? `Dropped an unstressed “${token.text}”` : `Dropped the light sound “${token.text}”`
        );
      });
    }

    const baseForMetathesis = variants.slice(0, 1);
    if (options.allowMetathesis) {
      baseForMetathesis.forEach((variant) => {
        const tokens = tokenize(variant.text, phonology);
        for (let index = 0; index < tokens.length - 1; index += 1) {
          const first = tokens[index];
          const second = tokens[index + 1];
          const mixedTypes = first.type !== second.type;
          const classFriendly = shareSoundClass(first.text, second.text, phonology);
          const liquidOrNasal = [first.text, second.text].some((unit) => {
            const classes = phonology.classByMember.get(unit) || [];
            return classes.some((group) => /liquid|nasal/i.test(group.label));
          });
          if (!(classFriendly || (mixedTypes && liquidOrNasal))) continue;
          const swapped =
            variant.text.slice(0, first.start) +
            second.text +
            first.text +
            variant.text.slice(second.end);
          if (flowInfo(swapped, phonology).severe) continue;
          addVariant(
            variants,
            seen,
            swapped,
            variant.operations.concat("metathesis"),
            `Reordered “${first.text}${second.text}” as “${second.text}${first.text}”`
          );
          if (variants.length >= 14) break;
        }
      });
    }

    return variants.slice(0, 18);
  }

  function maxRunFromShapes(shapes, type) {
    let max = 1;
    shapes.forEach((shape) => {
      const matches = shape.match(new RegExp(`${type}+`, "g")) || [];
      matches.forEach((match) => {
        max = Math.max(max, match.length);
      });
    });
    return max;
  }

  function flowInfo(text, phonology) {
    const tokens = tokenize(text, phonology);
    const types = tokens.map((token) => token.type);
    const maxAllowedC = maxRunFromShapes(phonology.allowedShapes, "C");
    const maxAllowedV = maxRunFromShapes(phonology.allowedShapes, "V");
    let maxC = 0;
    let maxV = 0;
    let currentType = "";
    let currentRun = 0;
    types.forEach((type) => {
      if (type === currentType) currentRun += 1;
      else {
        currentType = type;
        currentRun = 1;
      }
      if (type === "C") maxC = Math.max(maxC, currentRun);
      if (type === "V") maxV = Math.max(maxV, currentRun);
    });
    const hasVowel = types.includes("V");
    const tripleRepeat = /(.)\1\1/iu.test(normalizeName(text));
    const severe = !hasVowel || maxC > maxAllowedC + 1 || maxV > maxAllowedV + 1;
    const smooth = hasVowel && maxC <= maxAllowedC && maxV <= maxAllowedV && !tripleRepeat;
    return { smooth, severe, hasVowel, maxC, maxV, maxAllowedC, maxAllowedV, tripleRepeat };
  }

  function compatibleTokenLcs(part, source, phonology) {
    const a = tokenize(part, phonology);
    const b = tokenize(source, phonology);
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        if (areEquivalent(a[i - 1].text, b[j - 1].text, phonology)) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    return { matched: dp[a.length][b.length], total: Math.max(1, b.length) };
  }

  function characterMultisetCoverage(part, source) {
    const partChars = Array.from(normalizeName(part));
    const sourceChars = Array.from(normalizeName(source));
    const counts = new Map();
    sourceChars.forEach((character) => counts.set(character, (counts.get(character) || 0) + 1));
    let matched = 0;
    partChars.forEach((character) => {
      const available = counts.get(character) || 0;
      if (available > 0) {
        matched += 1;
        counts.set(character, available - 1);
      }
    });
    return { matched, total: Math.max(1, sourceChars.length) };
  }

  function sourceCoverage(part, source, phonology) {
    const tokenData = compatibleTokenLcs(part, source, phonology);
    const characterData = characterMultisetCoverage(part, source);
    const tokenRatio = tokenData.matched / tokenData.total;
    const characterRatio = characterData.matched / characterData.total;
    if (characterRatio >= tokenRatio) {
      return {
        matched: characterData.matched,
        total: characterData.total,
        ratio: characterRatio,
        method: "characters"
      };
    }
    return {
      matched: tokenData.matched,
      total: tokenData.total,
      ratio: tokenRatio,
      method: "compatible-sounds"
    };
  }

  function findCompatibleSequence(haystackText, needleText, phonology) {
    const haystack = tokenize(haystackText, phonology);
    const needle = tokenize(needleText, phonology);
    if (!needle.length || needle.length > haystack.length) return null;
    for (let start = 0; start <= haystack.length - needle.length; start += 1) {
      let matches = true;
      for (let offset = 0; offset < needle.length; offset += 1) {
        if (!areEquivalent(haystack[start + offset].text, needle[offset].text, phonology)) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return {
          tokenStart: start,
          tokenEnd: start + needle.length,
          charStart: haystack[start].start,
          charEnd: haystack[start + needle.length - 1].end,
          haystack,
          needle
        };
      }
    }
    return null;
  }

  function stressStatus(model, candidateText, phonology) {
    if (!model.stressedSyllable) return { kept: false, stable: false, label: "" };
    const match = findCompatibleSequence(candidateText, model.stressedSyllable.text, phonology);
    if (!match) return { kept: false, stable: false, label: model.stressedSyllable.text };

    const nextToken = match.haystack[match.tokenEnd];
    const lastNeedle = match.needle[match.needle.length - 1];
    const previousToken = match.haystack[match.tokenStart - 1];
    let stable = true;

    if (lastNeedle && lastNeedle.type === "C" && nextToken && nextToken.type === "V") stable = false;
    if (previousToken && previousToken.type === "V" && match.needle[0] && match.needle[0].type === "C") stable = false;

    return { kept: true, stable, label: model.stressedSyllable.text };
  }

  function compressRepeatedLetters(text) {
    return normalizeName(text).replace(/(.)\1{2,}/giu, "$1$1");
  }

  function exactBoundaryOverlap(left, right) {
    const max = Math.min(left.length, right.length, 6);
    for (let length = max; length >= 1; length -= 1) {
      if (left.slice(-length) === right.slice(0, length)) return length;
    }
    return 0;
  }

  function compatibleBoundaryOverlap(left, right, phonology) {
    const leftTokens = tokenize(left, phonology);
    const rightTokens = tokenize(right, phonology);
    const max = Math.min(leftTokens.length, rightTokens.length, 4);
    for (let length = max; length >= 1; length -= 1) {
      let okay = true;
      let usedEquivalent = false;
      for (let offset = 0; offset < length; offset += 1) {
        const a = leftTokens[leftTokens.length - length + offset];
        const b = rightTokens[offset];
        if (!areEquivalent(a.text, b.text, phonology)) {
          okay = false;
          break;
        }
        if (a.text !== b.text) usedEquivalent = true;
      }
      if (okay) {
        return {
          length,
          leftTokens,
          rightTokens,
          rightCharEnd: rightTokens[length - 1].end,
          usedEquivalent
        };
      }
    }
    return null;
  }

  function candidateKey(text) {
    return normalizeName(text);
  }

  function operationCost(operations) {
    const ops = new Set(unique(operations));
    let total = 0;
    if (ops.has("drop-unstressed")) total += 1;
    if (ops.has("drop-light")) total += 1.25;
    if (ops.has("metathesis")) total += 1.5;
    if (ops.has("nucleus-bridge")) total += 1;
    else if (ops.has("sound-equivalent")) total += 1;
    if (ops.has("compression") && !ops.has("overlap")) total += 0.25;
    return total;
  }

  function addCandidate(map, candidate, phonology) {
    let text = normalizeName(candidate.text);
    if (candidate.operations.includes("compression")) text = compressRepeatedLetters(text);
    if (text.length < 2 || text.length > 48) return;
    const flow = flowInfo(text, phonology);
    if (flow.severe) return;
    const key = candidateKey(text);
    const next = Object.assign({}, candidate, { text, operations: unique(candidate.operations) });
    const existing = map.get(key);
    if (!existing) {
      map.set(key, next);
      return;
    }
    const existingCost = operationCost(existing.operations);
    const nextCost = operationCost(next.operations);
    const existingPartMinimum = Math.min(normalizeName(existing.aPart).length, normalizeName(existing.bPart).length);
    const nextPartMinimum = Math.min(normalizeName(next.aPart).length, normalizeName(next.bPart).length);
    const existingPartTotal = normalizeName(existing.aPart).length + normalizeName(existing.bPart).length;
    const nextPartTotal = normalizeName(next.aPart).length + normalizeName(next.bPart).length;
    const existingPathQuality = existingPartMinimum * 2 + existingPartTotal * 0.08 - existingCost * 1.2;
    const nextPathQuality = nextPartMinimum * 2 + nextPartTotal * 0.08 - nextCost * 1.2;
    const chooseNext =
      nextPathQuality > existingPathQuality ||
      (nextPathQuality === existingPathQuality && nextCost < existingCost);
    if (chooseNext) map.set(key, next);
  }

  function mappedParts(order, leftPart, rightPart) {
    return order === "AB"
      ? { aPart: leftPart, bPart: rightPart }
      : { aPart: rightPart, bPart: leftPart };
  }

  function generateSplices(map, leftVariants, rightVariants, order, phonology, options) {
    leftVariants.forEach((leftVariant) => {
      rightVariants.forEach((rightVariant) => {
        for (let leftCut = 1; leftCut <= leftVariant.text.length; leftCut += 1) {
          const leftPart = leftVariant.text.slice(0, leftCut);
          for (let rightCut = 0; rightCut < rightVariant.text.length; rightCut += 1) {
            const rightPart = rightVariant.text.slice(rightCut);
            if (!rightPart) continue;
            const parts = mappedParts(order, leftPart, rightPart);
            const baseOperations = unique(leftVariant.operations.concat(rightVariant.operations));
            addCandidate(
              map,
              {
                text: leftPart + rightPart,
                aPart: parts.aPart,
                bPart: parts.bPart,
                order,
                operations: baseOperations.concat("literal-splice"),
                notes: [leftVariant.note, rightVariant.note].filter(Boolean).join("; ")
              },
              phonology
            );

            if (options.allowCompression) {
              const exactOverlap = exactBoundaryOverlap(leftPart, rightPart);
              if (exactOverlap > 0) {
                addCandidate(
                  map,
                  {
                    text: leftPart + rightPart.slice(exactOverlap),
                    aPart: parts.aPart,
                    bPart: parts.bPart,
                    order,
                    operations: baseOperations.concat(["overlap", "compression"]),
                    notes: `Shared “${rightPart.slice(0, exactOverlap)}” at the join`
                  },
                  phonology
                );
              }

              const compatible = options.allowEquivalentSounds
                ? compatibleBoundaryOverlap(leftPart, rightPart, phonology)
                : null;
              if (compatible && (compatible.usedEquivalent || exactOverlap === 0)) {
                addCandidate(
                  map,
                  {
                    text: leftPart + rightPart.slice(compatible.rightCharEnd),
                    aPart: parts.aPart,
                    bPart: parts.bPart,
                    order,
                    operations: baseOperations.concat([
                      "overlap",
                      compatible.usedEquivalent ? "sound-equivalent" : "compression"
                    ]),
                    notes: compatible.usedEquivalent ? "Joined compatible sound-group members" : "Compressed a shared boundary"
                  },
                  phonology
                );
              }

              const compressedText = compressRepeatedLetters(leftPart + rightPart);
              if (compressedText !== leftPart + rightPart) {
                addCandidate(
                  map,
                  {
                    text: compressedText,
                    aPart: parts.aPart,
                    bPart: parts.bPart,
                    order,
                    operations: baseOperations.concat("compression"),
                    notes: "Compressed repeated letters"
                  },
                  phonology
                );
              }
            }
          }
        }
      });
    });
  }

  function generateSharedLinks(map, leftVariants, rightVariants, order, phonology, options) {
    if (!options.allowCompression) return;
    leftVariants.slice(0, 9).forEach((leftVariant) => {
      rightVariants.slice(0, 9).forEach((rightVariant) => {
        const leftTokens = tokenize(leftVariant.text, phonology);
        const rightTokens = tokenize(rightVariant.text, phonology);
        leftTokens.forEach((leftToken) => {
          rightTokens.forEach((rightToken) => {
            const exact = leftToken.text === rightToken.text;
            const equivalent = options.allowEquivalentSounds && areEquivalent(leftToken.text, rightToken.text, phonology);
            if (!exact && !equivalent) return;
            const leftPart = leftVariant.text.slice(0, leftToken.end);
            const rightPart = rightVariant.text.slice(rightToken.end);
            if (!leftPart || !rightPart) return;
            const parts = mappedParts(order, leftPart, rightVariant.text.slice(rightToken.start));
            addCandidate(
              map,
              {
                text: leftPart + rightPart,
                aPart: parts.aPart,
                bPart: parts.bPart,
                order,
                operations: unique(
                  leftVariant.operations
                    .concat(rightVariant.operations)
                    .concat(["shared-link", exact ? "overlap" : "sound-equivalent"])
                ),
                notes: exact
                  ? `Used “${leftToken.text}” as a shared link`
                  : `Linked “${leftToken.text}” with compatible “${rightToken.text}”`
              },
              phonology
            );
          });
        });
      });
    });
  }

  function vowelTokens(variant, phonology) {
    return tokenize(variant.text, phonology).filter((token) => token.type === "V");
  }

  function generateNucleusBridges(map, leftVariants, rightVariants, order, phonology, options) {
    if (!options.allowManipulation || !options.allowEquivalentSounds) return;
    leftVariants.slice(0, 10).forEach((leftVariant) => {
      rightVariants.slice(0, 10).forEach((rightVariant) => {
        const leftVowels = vowelTokens(leftVariant, phonology).slice(0, 3);
        const rightVowels = vowelTokens(rightVariant, phonology).slice(0, 3);
        leftVowels.forEach((leftVowel) => {
          rightVowels.forEach((rightVowel) => {
            const group = groupForPair(leftVowel.text, rightVowel.text, phonology);
            if (!group) return;
            const leftOnset = leftVariant.text.slice(0, leftVowel.start);
            const rightTail = rightVariant.text.slice(rightVowel.end);
            if (!leftOnset || !rightTail) return;
            const representations = unique([leftVowel.text, rightVowel.text].concat(group.members)).slice(0, 5);
            representations.forEach((representation) => {
              const leftPiece = leftOnset + representation;
              const rightPiece = representation + rightTail;
              const parts = mappedParts(order, leftPiece, rightPiece);
              addCandidate(
                map,
                {
                  text: leftOnset + representation + rightTail,
                  aPart: parts.aPart,
                  bPart: parts.bPart,
                  order,
                  operations: unique(
                    leftVariant.operations
                      .concat(rightVariant.operations)
                      .concat(["nucleus-bridge", "sound-equivalent"])
                  ),
                  notes: `Bridged the ${group.label || "sound"} group with “${representation}”`
                },
                phonology
              );
            });
          });
        });
      });
    });
  }

  function operationLabels(operations) {
    const labels = {
      "literal-splice": "Literal splice",
      overlap: "Shared overlap",
      "shared-link": "Shared sound link",
      "drop-unstressed": "Dropped unstressed material",
      "drop-light": "Dropped a light sound",
      metathesis: "Metathesis",
      "sound-equivalent": "Compatible sound spelling",
      compression: "Compressed boundary",
      "nucleus-bridge": "Vowel-nucleus bridge"
    };
    return unique(operations.map((operation) => labels[operation] || operation));
  }

  function balanceThreshold(level) {
    if (level === "strong") return 0.25;
    if (level === "loose") return 0.7;
    return 0.45;
  }

  function evaluateCandidate(candidate, modelA, modelB, phonology, options) {
    const coverageAData = sourceCoverage(candidate.aPart, modelA.normalized, phonology);
    const coverageBData = sourceCoverage(candidate.bPart, modelB.normalized, phonology);
    const coverageA = coverageAData.ratio;
    const coverageB = coverageBData.ratio;
    const minimumMatched = Math.min(coverageAData.matched, coverageBData.matched);
    const difference = Math.abs(coverageA - coverageB);
    const balanced = difference <= balanceThreshold(options.balance);
    const recognizableA = coverageA >= 0.34 || coverageAData.matched >= 3;
    const recognizableB = coverageB >= 0.34 || coverageBData.matched >= 3;
    const recognizable = recognizableA && recognizableB;
    const stressA = stressStatus(modelA, candidate.text, phonology);
    const stressB = stressStatus(modelB, candidate.text, phonology);
    const stressStable = stressA.stable || stressB.stable;
    const stressKept = stressA.kept || stressB.kept;
    const flow = flowInfo(candidate.text, phonology);
    const candidateTokens = tokenize(candidate.text, phonology).length;
    const averageTokens = (modelA.tokens.length + modelB.tokens.length) / 2;
    const minSourceLength = Math.min(modelA.normalized.length, modelB.normalized.length);
    const maxSourceLength = Math.max(modelA.normalized.length, modelB.normalized.length);
    const maxCompactLength = maxSourceLength + Math.max(1, Math.ceil(minSourceLength * 0.35));
    const compact = candidate.text.length <= maxCompactLength;
    const compressionTarget = modelA.normalized.length + modelB.normalized.length -
      (modelA.normalized.length + modelB.normalized.length >= 8 ? 3 : 2);
    const actuallyBlended = candidate.text.length <= compressionTarget;
    const tinyContribution = minimumMatched <= 1 || Math.min(coverageA, coverageB) < 0.18;
    const almostOriginal = candidate.text === modelA.normalized || candidate.text === modelB.normalized;
    const bothSourcesPresent = coverageAData.matched > 0 && coverageBData.matched > 0;
    const manipulationCost = operationCost(candidate.operations);

    const concerns = [];
    if (!flow.smooth) concerns.push("flow");
    if (!actuallyBlended) concerns.push("not-compressed");
    if (!balanced) concerns.push("balance");
    if (!recognizable) concerns.push("recognition");
    if (options.prioritizeStress && !stressStable) concerns.push("stress");
    if (!compact) concerns.push("compactness");
    if (tinyContribution) concerns.push("tiny-contribution");
    if (almostOriginal) concerns.push("almost-original");
    if (manipulationCost > 2.5) concerns.push("heavy-manipulation");

    const priorityPass = {
      flow: flow.smooth,
      balance: balanced,
      stress: stressStable,
      recognition: recognizable,
      compact: compact
    }[options.priority] !== false;

    let tierWeight = concerns.length;
    if (!priorityPass) tierWeight += 2;
    if (tinyContribution) tierWeight += 2;
    if (!bothSourcesPresent) tierWeight += 4;
    if (flow.severe) tierWeight += 4;
    if (!actuallyBlended) tierWeight += 2;

    let category = "other";
    if (
      flow.smooth &&
      actuallyBlended &&
      compact &&
      recognizable &&
      balanced &&
      !tinyContribution &&
      manipulationCost <= 2.5 &&
      !candidate.operations.includes("metathesis") &&
      (!options.prioritizeStress || stressStable)
    ) category = "best";
    else if (
      tierWeight <= 6 &&
      !flow.severe &&
      compact &&
      actuallyBlended &&
      bothSourcesPresent
    ) category = "good";

    const roughSyllables = syllabifyText(candidate.text, phonology).map((syllable) => syllable.text);
    const reasons = [];
    if (balanced) reasons.push("Both source names have a reasonably balanced presence.");
    else if (coverageA > coverageB) reasons.push(`This blend leans more toward ${modelA.display}.`);
    else reasons.push(`This blend leans more toward ${modelB.display}.`);
    if (stressStable) {
      const kept = stressA.stable ? stressA.label : stressB.label;
      reasons.push(`It keeps “${kept}” in a stable stressed-looking position.`);
    } else if (stressKept) {
      reasons.push("A source stress chunk survives, but the new boundary may shift how the result is emphasized.");
    } else {
      reasons.push("Neither original stressed chunk survives intact.");
    }
    if (flow.smooth) reasons.push("Its consonant and vowel runs fit the allowed syllable-shape limits.");
    else reasons.push("Its sound pattern is legal, but less smooth under the current syllable-shape settings.");
    if (candidate.operations.includes("sound-equivalent")) reasons.push("It uses one of your compatible sound groups only at the join.");
    if (candidate.operations.includes("metathesis")) reasons.push("It rearranges nearby sounds instead of changing them randomly.");
    if (candidate.operations.includes("drop-unstressed") || candidate.operations.includes("drop-light")) {
      reasons.push("It removes material through the manipulation options you enabled.");
    }

    const priorityOrder = {
      flow: [flow.smooth, balanced, stressStable, recognizable, compact],
      balance: [balanced, recognizable, flow.smooth, stressStable, compact],
      stress: [stressStable, flow.smooth, balanced, recognizable, compact],
      recognition: [recognizable, balanced, stressStable, flow.smooth, compact],
      compact: [compact, flow.smooth, balanced, recognizable, stressStable]
    }[options.priority] || [flow.smooth, balanced, stressStable, recognizable, compact];

    const sortVector = [];
    sortVector.push(priorityPass ? 0 : 1);
    sortVector.push(flow.smooth ? 0 : 1);
    sortVector.push(actuallyBlended ? 0 : 1);
    sortVector.push(compact ? 0 : 1);
    sortVector.push(tinyContribution ? 1 : 0);
    sortVector.push(manipulationCost);
    sortVector.push(recognizable ? 0 : 1);
    sortVector.push(balanced ? 0 : 1);
    if (options.prioritizeStress) sortVector.push(stressStable ? 0 : 1);
    sortVector.push(-Math.min(coverageA, coverageB));
    sortVector.push(-(coverageA + coverageB));
    sortVector.push(difference);
    sortVector.push(tierWeight);
    sortVector.push(Math.abs(candidateTokens - averageTokens));
    sortVector.push(candidate.text.length);
    sortVector.push(candidate.text);

    return Object.assign({}, candidate, {
      display: titleCase(candidate.text),
      category,
      coverageA,
      coverageB,
      matchedA: coverageAData.matched,
      matchedB: coverageBData.matched,
      balanced,
      recognizable,
      stressA,
      stressB,
      stressStable,
      flow,
      compact,
      actuallyBlended,
      manipulationCost,
      concerns,
      roughSyllables,
      operationLabels: operationLabels(candidate.operations),
      reasons,
      sortVector
    });
  }

  function compareVectors(a, b) {
    const length = Math.max(a.length, b.length);
    for (let index = 0; index < length; index += 1) {
      const av = a[index];
      const bv = b[index];
      if (av === bv) continue;
      if (typeof av === "string" || typeof bv === "string") return String(av).localeCompare(String(bv));
      return (av || 0) - (bv || 0);
    }
    return 0;
  }

  function rebalanceSections(evaluated) {
    const best = evaluated.filter((item) => item.category === "best");
    const good = evaluated.filter((item) => item.category === "good");
    const other = evaluated.filter((item) => item.category === "other");

    while (best.length < 6 && good.length) {
      const promoted = good.shift();
      promoted.category = "best";
      best.push(promoted);
    }
    while (good.length < 10 && other.length) {
      const promoted = other.shift();
      promoted.category = "good";
      good.push(promoted);
    }

    return { best, good, other };
  }

  function generate(input) {
    const options = Object.assign({}, DEFAULTS, input && input.settings ? input.settings : {});
    const phonology = buildPhonology(options);
    const modelA = createWordModel("A", input.wordA, input.guideA, input.stressA, phonology);
    const modelB = createWordModel("B", input.wordB, input.guideB, input.stressB, phonology);

    const warnings = modelA.warnings.concat(modelB.warnings);
    if (!modelA.normalized || !modelB.normalized) {
      return {
        words: { a: modelA, b: modelB },
        warnings: warnings.concat("Enter two words or names before generating."),
        best: [],
        good: [],
        other: [],
        totalGenerated: 0
      };
    }

    const variantsA = buildVariants(modelA, phonology, options);
    const variantsB = buildVariants(modelB, phonology, options);
    const map = new Map();

    generateSplices(map, variantsA, variantsB, "AB", phonology, options);
    generateSplices(map, variantsB, variantsA, "BA", phonology, options);
    generateSharedLinks(map, variantsA, variantsB, "AB", phonology, options);
    generateSharedLinks(map, variantsB, variantsA, "BA", phonology, options);
    generateNucleusBridges(map, variantsA, variantsB, "AB", phonology, options);
    generateNucleusBridges(map, variantsB, variantsA, "BA", phonology, options);

    const evaluated = Array.from(map.values())
      .map((candidate) => evaluateCandidate(candidate, modelA, modelB, phonology, options))
      .filter((candidate) => candidate.matchedA > 0 && candidate.matchedB > 0 && candidate.flow.hasVowel)
      .sort((a, b) => compareVectors(a.sortVector, b.sortVector));

    const sections = rebalanceSections(evaluated);

    return {
      words: { a: modelA, b: modelB },
      warnings,
      best: sections.best,
      good: sections.good,
      other: sections.other,
      totalGenerated: evaluated.length,
      variants: { a: variantsA.length, b: variantsB.length },
      phonology
    };
  }

  return {
    DEFAULTS,
    normalizeName,
    parseList,
    parseShapes,
    parseNamedGroups,
    buildPhonology,
    tokenize,
    syllabifyText,
    generate
  };
});
