---
title: Campfire
platform: [android, web]
tagline: A chat room for everyone nearby
summary: One phone hosts a chat, everyone else joins from their browser by scanning a QR code.
order: 5
featured: false
icon: /apps/campfire/icon.svg
screenshots: [/apps/campfire/showcase.jpg]
accent: "#e0633a"
links:
  site: https://prempoddar.github.io/Campfire/
  github: https://github.com/PremPoddar/Campfire
related: [librechat]
---

## The problem

A classroom, a workshop, a group on a trip. Everyone needs to share links and files for an hour, and nobody wants to make a group and add twenty numbers.

## What I built

Start a Campfire on your phone and it shows a link and a QR code. Anyone on the same Wi-Fi or your hotspot opens it in any browser, picks a name and is chatting. No install, no account, no internet. There are rooms with optional passwords, direct messages, replies, reactions, polls, pins, voice notes, files of any size and read receipts. When you end it, every message and file is gone.

## The hard parts

**A server in your pocket.** The phone runs a Ktor server. All the chat rules live in one plain Kotlin class where each command returns the events to send and who gets them, so the rules are tested without any sockets. Uploads stream straight to disk so a big file never blocks the chat, and videos are served with byte ranges so they can seek.

**No internet at all.** The browser client has no build step. Preact and htm are vendored and the font is bundled, so nothing loads from outside the phone.

**Being upfront about security.** A local network can't get a trusted HTTPS certificate without warnings, so Campfire isn't encrypted. Someone on the same Wi-Fi could read messages. Instead of hiding that, the app and the web chat both say it plainly. Link previews are fetched by the host, and it refuses any local address so a link can't be used to poke at the router.
