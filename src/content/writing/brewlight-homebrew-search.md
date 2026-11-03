---
title: Searching 16,000 packages in 3 ms per keystroke
description: How Brewlight's search works, from byte buffers shaped so every kind of match is one memmem call, to a ranking packed into a single integer, to opening instantly by not asking brew.
date: 2026-11-03T12:03:00Z
kind: post
tags: [macOS, Swift, Search, Brewlight]
related: [brewlight]
---

[Brewlight](/apps/brewlight/) is a Mac app for Homebrew. Press ⌘K, type, and it searches every formula and app in the catalogue as you type, then installs the one you pick in one click. The search box is the whole idea, so most of this post is about making it fast and making the first result the right one.

## What it solves

Homebrew is excellent once you know the exact name of what you want. The parts around that are harder. `brew search` matches names, so you need to already know roughly what a package is called. Uninstalling an app leaves preferences, caches and support files behind. `brew doctor` assumes you know what its warnings mean.

<figure class="shot"><img src="/figures/brewlight-palette.jpg" alt="Brewlight's command palette searching for rip, with ripgrep as the top hit" loading="lazy" /><figcaption>Typing <code>rip</code>. The top hit is ripgrep, with install actions for related packages underneath.</figcaption></figure>

Brewlight puts all of that in one native window: a palette that searches packages and actions together, install, upgrade, pin and full removal with a list of every leftover file, services, taps, dependency trees, Brewfile import and export, plain-language explanations for `brew doctor`, and six languages. Every confirmation shows the exact `brew` command it's about to run.

## Built with

- **Swift 6**, with SwiftUI and AppKit, for macOS 26 and later.
- **XcodeGen** generates the Xcode project from a small config file.
- **Performance tests** that run against an optimised build and fail if an interaction goes over its time budget.
- A **`-demo` launch flag** that loads sample data, so the UI can be worked on without touching a real Homebrew install.

## Not asking brew

The first speed problem has nothing to do with search. Running `brew` takes a noticeable moment to start, so a front end that shells out for every list feels slow no matter how good the rest is.

Brewlight mostly doesn't ask. It reads Homebrew's own API cache and the Cellar and Caskroom folders directly, keeps all of that off the main thread, and saves a snapshot of what it knew last time. On launch it shows the snapshot immediately and refreshes in the background. You never look at a spinner, and if anything changed, the list just updates.

Measured in a release build against a real install with 16,462 packages:

| Interaction | Time |
|---|---|
| Search, per keystroke | about 3 ms |
| Click a package | 17 to 25 ms |
| Switch to Discover | about 64 ms |
| Launch | window at once, packages in about 0.3 s |

## One memmem per kind of match

A search has to answer several different questions for each package. Is the query the exact name? A prefix of the name? A prefix of one of the name's parts, like `node` in `node@20`? A whole word in the description? Answering those with string APIs means lots of small allocations on every keystroke, 16,000 times over.

So when the catalogue loads, every field is lowercased once into a byte buffer shaped so that each question becomes a single `memcmp` or `memmem` call:

<figure>
<div class="diagram"><svg viewBox="0 0 640 250" role="img" aria-label="How each field is stored so that a prefix match becomes a substring search">
<text x="10" y="28" class="bold">name parts</text>
<rect x="160" y="10" width="300" height="30" rx="6" class="box"/><text x="172" y="31" class="mono">-python-3.12</text>
<text x="480" y="31" class="mono small">find "-3"</text>
<text x="10" y="88" class="bold">description words</text>
<rect x="160" y="70" width="300" height="30" rx="6" class="box"/><text x="172" y="91" class="mono">␣fast␣grep␣alternative␣</text>
<text x="480" y="91" class="mono small">find "␣grep"</text>
<text x="10" y="148" class="bold">aliases</text>
<rect x="160" y="130" width="300" height="30" rx="6" class="box"/><text x="172" y="151" class="mono">\0python3\0python@3\0</text>
<text x="480" y="143" class="mono small">exact: "\0q\0"</text><text x="480" y="160" class="mono small">prefix: "\0q"</text>
<rect x="10" y="190" width="620" height="48" rx="8" class="note"/>
<text x="24" y="211" class="small">A separator in front of every part turns "starts with" into "contains".</text>
<text x="24" y="229" class="small">Search for the separator plus the query, and one call answers the question for every part at once.</text>
</svg></div>
<figcaption>Underscores, dots, <code>@</code> and spaces in names become dashes, and anything that isn't a letter or digit in a description becomes a space.</figcaption>
</figure>

Building those buffers is a single pass over each package:

```swift title="Core/Catalog/SearchIndex.swift"
let name = Self.lowerBytes(p.token)
var segs: [UInt8] = [UInt8(ascii: "-")]
for b in name { segs.append(b == 95 || b == 46 || b == 64 || b == 32 ? 45 : b) } // _ . @ space become -

var aliases: [UInt8] = [0]
for a in p.aliases + p.oldNames { aliases += Self.lowerBytes(a); aliases.append(0) }

var words: [UInt8] = [32]
for b in Self.lowerBytes(p.desc) {
    let alnum = (b >= 48 && b <= 57) || (b >= 97 && b <= 122) || b >= 128
    words.append(alnum ? b : 32)
}
words.append(32)
```

And the check itself is a thin wrapper over C's `memmem`, with no copying:

```swift title="Core/Catalog/SearchIndex.swift"
@inline(__always)
static func contains(_ s: [UInt8], _ p: [UInt8]) -> Bool {
    guard s.count >= p.count, !p.isEmpty else { return false }
    return s.withUnsafeBytes { sb in
        p.withUnsafeBytes { pb in memmem(sb.baseAddress!, s.count, pb.baseAddress!, p.count) != nil }
    }
}
```

## Ranking in tiers

Speed doesn't make search feel right. The obvious answer has to come first. Brewlight scores each package by the best kind of match it has, in fixed tiers, and lets popularity lift packages only within a tier:

```swift title="Core/Catalog/SearchIndex.swift"
static func score(_ e: Entry, q: [UInt8], dashQ: [UInt8], spaceQ: [UInt8], nulQ: [UInt8], nulQnul: [UInt8], popularity: Int) -> Int {
    if e.name == q { return 1000 }
    if e.display == q { return 980 }
    if contains(e.aliases, nulQnul) { return 950 }
    let bonus = popularityBonus(popularity)
    if hasPrefix(e.name, q) { return 720 + bonus - min(e.name.count - q.count, 20) }
    if contains(e.aliases, nulQ) { return 700 + bonus }
    if hasPrefix(e.display, q) { return 700 + bonus }
    if contains(e.segments, dashQ) { return 690 + bonus - min(e.name.count - q.count, 20) }
    if contains(e.name, q) { return 500 + bonus / 3 }
    if q.count >= 2 && contains(e.words, spaceQ) { return 300 + bonus / 3 }
    if q.count >= 3 && contains(e.host, q) { return 250 }
    if q.count >= 4 && contains(e.words, q) { return 200 }
    return 0
}
```

<figure>
<div class="diagram"><svg viewBox="0 0 640 270" role="img" aria-label="Score tiers from exact name match at 1000 down to fuzzy match at 100">
<rect x="10" y="10" width="600" height="24" rx="5" class="accent"/><text x="20" y="27" class="bold small">exact name</text><text x="600" y="27" text-anchor="end" class="mono small">1000</text>
<rect x="10" y="38" width="588" height="24" rx="5" class="accent" opacity="0.85"/><text x="20" y="55" class="small">exact display name, exact alias</text><text x="588" y="55" text-anchor="end" class="mono small">950 to 980</text>
<rect x="10" y="66" width="520" height="24" rx="5" class="accent" opacity="0.7"/><text x="20" y="83" class="small">name or alias starts with it, or one part of the name does</text><text x="520" y="83" text-anchor="end" class="mono small">690 to 870</text>
<rect x="10" y="94" width="300" height="24" rx="5" class="accent-soft"/><text x="20" y="111" class="small">name contains it</text><text x="300" y="111" text-anchor="end" class="mono small">500+</text>
<rect x="10" y="122" width="240" height="24" rx="5" class="accent-soft"/><text x="20" y="139" class="small">a description word starts with it</text><text x="262" y="139" class="mono small">300+</text>
<rect x="10" y="150" width="150" height="24" rx="5" class="soft"/><text x="20" y="167" class="small">homepage domain</text><text x="172" y="167" class="mono small">250</text>
<rect x="10" y="178" width="120" height="24" rx="5" class="soft"/><text x="20" y="195" class="small">description</text><text x="142" y="195" class="mono small">200</text>
<rect x="10" y="206" width="60" height="24" rx="5" class="soft"/><text x="20" y="223" class="small">fuzzy</text><text x="82" y="223" class="mono small">100</text>
<text x="630" y="230" text-anchor="end" class="hand">popularity only reorders inside a tier</text>
<text x="630" y="254" text-anchor="end" class="hand">(up to 150 points, on a log scale)</text>
</svg></div>
<figcaption>A popular package that merely contains your query never outranks one whose name starts with it.</figcaption>
</figure>

Popularity is `log10(installs) × 25`, capped at 150, so a million installs is worth about 150 points. That's enough to put `node` above an obscure `node-something` within the prefix tier, but never enough to jump a tier.

The sort is one more small trick. Instead of a comparator that checks score, then popularity, then name length, each hit gets one 64-bit key with all three packed in, and the sort compares integers:

```swift title="Core/Catalog/SearchIndex.swift"
var keyed = hits.map { h -> (key: Int64, hit: Hit) in
    let pop = Int64(min(h.index < popularity.count ? popularity[h.index] : 0, (1 << 30) - 1))
    let len = Int64(min(entries[h.index].name.count, 255))
    return ((Int64(h.score) << 40) | (pop << 8) | (255 - len), h)
}
keyed.sort { $0.key > $1.key }
```

Fuzzy matching, where the letters only need to appear in order, is the most expensive check, so it only runs when the direct matches are thin: fewer than 20 hits and a query of at least two letters.

## Filters in the same box

The palette also understands filters, so `type:cask is:outdated` or `cat:fonts mono` work in the same field you type names into. Parsing is deliberately simple: split on spaces, peel off anything that looks like a filter, and search with what's left:

```swift title="Core/Catalog/SearchIndex.swift"
for token in raw.split(separator: " ") {
    let t = String(token)
    let lower = t.lowercased()
    if lower.hasPrefix("tag:") { tags.append(String(t.dropFirst(4))) }
    else if lower.hasPrefix("tap:") { taps.append(String(lower.dropFirst(4))) }
    else if lower.hasPrefix("cat:") { categories.append(String(lower.dropFirst(4))) }
    else if lower == "is:outdated" { isOutdated = true }
    else if lower == "type:cask" { kind = .cask }
    // ...
    else { words.append(t) }
}
```

With several words, packages that match more of them rank first, and an exact match of the whole phrase ranks above everything else. A sentence like "an app to edit videos" is turned into filters before searching.

<figure class="shot"><img src="/figures/brewlight-detail.jpg" alt="Brewlight's installed list with node selected, showing its version, size, dependencies and the exact brew command" loading="lazy" /><figcaption>A package's details, including the exact <code>brew</code> command behind each button.</figcaption></figure>

## Where it stops

It needs macOS 26, which leaves out a lot of Macs that run Homebrew perfectly well. And because it reads Homebrew's files directly, a big change in how Homebrew lays those out would need an update to Brewlight.

```bash
brew install --cask brewlight
```

Brewlight is independent and not affiliated with Homebrew. The source is [on GitHub](https://github.com/PremPoddar/Brewlight).
