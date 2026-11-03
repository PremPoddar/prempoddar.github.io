---
title: Brewlight, a search box for all of Homebrew
description: A native Mac app that searches about 16,000 Homebrew packages in 3 ms per keystroke, mostly by not asking brew.
date: 2026-11-03T12:03:00Z
kind: post
tags: [macOS, Swift, Brewlight]
related: [brewlight]
---

[Brewlight](/apps/brewlight/) is a Mac app for Homebrew. Press ⌘K, type, and it searches every formula and app in the catalogue as you type, then installs the one you pick in one click.

## What it solves

Homebrew is excellent once you know the exact name of what you want. The parts around that are harder:

- **Finding things.** `brew search` matches names, so you need to already know roughly what the package is called.
- **Removing apps properly.** Uninstalling a cask leaves preferences, caches and support files behind.
- **Understanding warnings.** `brew doctor` output assumes you already know what it means.
- **Seeing the state of your Mac.** What's outdated, what's pinned, what depends on what.

Brewlight puts all of that in one window.

## What it does

- A command palette that searches packages and actions together, with filters like `is:outdated`, `type:cask`, `cat:fonts` or `tap:hashicorp`. You can also type plain words, like "an app to edit videos", and they become filters.
- Install, upgrade, pin and remove. Pinned packages and skipped versions stay put during Upgrade All.
- Full removal. It lists every leftover file with its size and moves the ones you tick to the Trash.
- Services, taps, dependency trees, disk usage, Brewfile import and export, and a full history.
- Plain-language explanations for `brew doctor` warnings.
- Six languages: English, German, Spanish, French, Japanese and Simplified Chinese.

Every confirmation shows the exact `brew` command it's about to run. Nothing happens behind your back.

## Built with

Swift 6, native to macOS 26. The project is generated with XcodeGen, and there's a `-demo` launch flag that loads sample data so you can work on the UI without touching a real Homebrew install. The test suite includes performance tests that run against an optimised build and fail if an interaction goes over its time budget.

## The hard part: being fast

A Homebrew front end that shells out to `brew` for everything feels slow, because `brew` itself takes a while to start. So Brewlight mostly doesn't ask it. It reads Homebrew's own API cache and the Cellar and Caskroom folders directly, and keeps all of that work off the main thread.

Measured in a release build against a real install with 16,462 packages:

| Interaction | Time |
|---|---|
| Search, per keystroke | about 3 ms |
| Click a package | 17 to 25 ms |
| Switch to Discover | about 64 ms |
| Launch | window at once, packages in about 0.3 s |

Launching fast comes from a simple rule: show what you knew last time immediately, then refresh in the background. You never look at a spinner, and if the catalogue changed, the list just updates.

## Search that feels like Spotlight

Speed alone doesn't make search feel right. It matches names and descriptions on every keystroke and puts the obvious answer first as a top hit. Actions like "reinstall" or "copy the install command" sit in the same list as the packages, so you can do most things without leaving the keyboard. <kbd>Return</kbd> opens a package, <kbd>⌘</kbd><kbd>Return</kbd> installs it and <kbd>Tab</kbd> shows more actions.

## Try it

```bash
brew install --cask brewlight
```

It needs macOS 26 or later, and if Homebrew isn't installed yet it walks you through that first. Brewlight is independent and not affiliated with Homebrew. The source is [on GitHub](https://github.com/PremPoddar/Brewlight).
