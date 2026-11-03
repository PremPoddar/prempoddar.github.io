---
title: Keeping a Mac awake with the lid closed, without leaving it broken
description: Why lid-closed mode needs root, and everything CaffeinateCat does so it never leaves your Mac unable to sleep.
date: 2026-11-03T12:06:00Z
kind: post
tags: [macOS, Swift, CaffeinateCat]
related: [caffeinatecat]
---

Keeping a Mac awake with the lid open is a solved problem. Keeping it awake with the lid shut, on battery, is not, and the reason why is the interesting part of [CaffeinateCat](/apps/caffeinatecat/).

## What it solves

Sometimes a Mac has to keep going while you're away from it: a build, a local server, a long download. The obvious fix is to change the sleep settings and remember to change them back, which nobody does. And if you want to close the lid and put the laptop in a bag while it works, on battery, macOS doesn't offer that at all.

CaffeinateCat is a menu bar app with two switches. **Keep Screen Awake** stops idle sleep. **Keep Awake on Lid Close** does the same and also keeps the Mac running with the lid shut, even unplugged. Both can run for a set time or until you turn them off.

## Built with

Swift 5, as a handful of source files with no Xcode project. It runs on macOS 12 and up. The only dependency is Sparkle for automatic updates, and `build.sh` downloads a pinned, checksum-verified copy, then builds, signs and optionally notarizes the app. A plain `swiftc -O -o CaffeinateCat *.swift` also works and simply has no updater.

## The easy mode

If all you want is "don't fall asleep while I'm away from the keyboard", macOS gives you a polite API for it. You ask `ProcessInfo` to begin an activity that holds off idle sleep, and optionally display sleep, and you end the activity when you're done:

```swift
let activity = ProcessInfo.processInfo.beginActivity(
    options: [.idleSystemSleepDisabled, .idleDisplaySleepDisabled],
    reason: "Keep Screen Awake"
)
// later
ProcessInfo.processInfo.endActivity(activity)
```

No permissions, no prompts. If the app crashes, the system drops the activity for you. This is CaffeinateCat's **Keep Screen Awake** mode.

The catch: closing the lid is not "idle". It's a different kind of sleep, and these assertions don't stop it.

## The hard mode

On Apple Silicon, the one reliable way I found to keep a Mac running with the lid shut on battery is to set the `SleepDisabled` flag:

```sh
pmset -a disablesleep 1
```

That works. It also needs root, and it persists across reboots. So if an app turns it on and then dies without turning it off, your Mac stays unable to sleep until someone notices. Most of the app's code exists to stop that from happening.

## Asking for root once, for two commands

I didn't want the app to ask for a password every time, and I really didn't want it to run as root. So the first time you turn on lid-closed mode, CaffeinateCat installs a sudoers rule at `/etc/sudoers.d/caffeinatecat` that allows exactly two commands without a password:

```
pmset -a disablesleep 1
pmset -a disablesleep 0
```

Nothing else. You get one native admin prompt (Touch ID works), and after that the switch just works.

The install itself is careful too. The rule is written, checked with `visudo` and moved into place entirely by the privileged shell, into a root-owned temp file. Nothing is staged somewhere a normal user could swap it out between the check and the install.

## Never leaving the flag behind

This is the list of ways CaffeinateCat makes sure sleep comes back:

1. **Turning it off or quitting** runs `disablesleep 0`, then reads the value back from `pmset -g` to confirm it actually changed.
2. **Signals.** `SIGTERM`, `SIGINT` and `SIGHUP` restore it before exit.
3. **A watchdog.** While lid mode is on, a tiny separate process in its own process group waits for the app to exit and restores sleep itself. A crash, Force Quit or `kill -9` on the app can't take the watchdog with it.
4. **Next launch.** If the app ever dies holding the flag anyway (power loss, kernel panic), it notices when it starts and restores it. If that fails, it tells you the one command to run yourself.
5. **Every 30 seconds and after every wake**, it checks the flag is still what it should be and the watchdog is still alive.

It's a lot of machinery for one boolean. But the failure mode is "your laptop never sleeps again and slowly cooks in your bag", so I think it's earned.

## Small things that made it nicer

- The menu bar icon is a coffee cup that doubles as a battery gauge. It's orange while it's keeping the Mac awake, grey when it's off, and it steams in lid-closed mode.
- Timers run on a clock that keeps going while the Mac sleeps, so a 2 hour timer that spans a sleep still ends on time.
- It turns itself off as the battery passes 20% and again at 10%, so a Mac in a bag can't run itself flat.

The code is a handful of Swift files and it's [on GitHub](https://github.com/PremPoddar/CaffeinateCat) under Apache 2.0. If you know a cleaner way to stay awake with the lid shut on Apple Silicon, I'd genuinely like to hear it.
