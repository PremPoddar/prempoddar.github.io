---
title: Campfire, a chat server that runs on your phone
description: A Ktor server on one phone, a browser chat for everyone else, and why it tells you plainly that it isn't encrypted.
date: 2026-11-03T12:00:00Z
kind: post
tags: [Android, Kotlin, Ktor, Web, Campfire]
related: [campfire]
---

[Campfire](/apps/campfire/) turns one phone into a chat room for everyone nearby. They join from whatever browser they have. Nobody installs anything.

## What it solves

A classroom, a workshop, a group on a trip. For an hour, everyone needs to share links, photos and files. The usual answer is a group chat, which means collecting twenty phone numbers, and then that group sticks around forever.

Campfire is for the hour. Start one, people join, and when you end it, everything is gone.

## What it does

- Start a Campfire and it shows a link and a QR code.
- Anyone on the same Wi-Fi, or on your hotspot, opens it in a browser, picks a name and is in.
- A public room that's always there, plus rooms anyone can start, with an optional password.
- Direct messages, replies, reactions, edits, polls, pins, voice notes and read receipts.
- Files of any size, with photos and videos playing inline.
- Link previews, fetched by the host phone so they show up even with no internet.
- Moderation: room creators can remove people, and the host can remove anyone.

No account, no internet, and nothing left behind.

## Built with

Kotlin on Android 10 and up, with a Ktor 3 server running on the phone on port 8080. Browsers connect over HTTP and WebSocket. The host's own chat is the same web client inside a WebView. The browser client is Preact and htm with no build step. Both are vendored and the font is bundled, so nothing loads from the internet.

## A server in your pocket

The design choice I'd keep for any project like this: all the chat rules live in one plain Kotlin class, `ChatState`. Rooms, passwords, admins, direct messages, edits, reactions, receipts, typing, polls and pins are all in there, with no networking. Each command goes in and a list of events comes out, along with who should get each one. That means every rule is unit tested without opening a single socket.

Around that sits a small `Hub` that runs commands one at a time under a lock and queues outgoing events per connection. Uploads stream straight to disk over HTTP, so someone sending a 2 GB video doesn't freeze the chat for everyone else. Videos are served with byte ranges so people can seek.

For working on the web client, there's a dev mode that starts a real Campfire on `localhost:8080` and serves the web files straight from disk, so you reload the page to see changes.

## The honest part: it isn't encrypted

Browsers only allow encryption and a lot of modern features on secure pages, and a local network can't get a trusted HTTPS certificate without scary warnings. So Campfire runs over plain HTTP. Someone watching the same Wi-Fi could read messages and room passwords, and direct messages pass through the host phone.

I didn't want to hide that behind a padlock icon. The app and the web chat both say it plainly, so people can decide what to send.

There are a few other guards. Link previews are fetched by the host, and it refuses any address on the local network, so a pasted link can't be used to poke at the router or other devices. Uploaded files are never served as web pages or scripts. Files live in the app's cache and are wiped when a Campfire starts and when it stops.

The source is [on GitHub](https://github.com/PremPoddar/Campfire) under Apache 2.0.
