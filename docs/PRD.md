# GroupTrack (Working Title)

## Product Requirements Document (MVP)

### Vision

A lightweight web app that helps groups moving together know whether everyone is ahead, behind, waiting, or has arrived—without endless phone calls or permanent location sharing.

The goal is simple:

> Never lose your group again.

---

## Problem Statement

When people travel together in multiple cars, motorbikes, or on foot, groups often split up.

People end up asking:

* "Have they overtaken us?"
* "Are they still behind?"
* "Did they stop somewhere?"
* "Should we wait?"
* "Have they arrived?"

Existing solutions are either:

* Too complex,
* Designed for permanent family tracking,
* Require app installation,
* Or expose more location information than necessary.

There is a need for a simple, temporary solution built specifically for group movement.

---

## Product Principles

The product must be:

* Extremely simple.
* Usable without downloading an app.
* Joinable through a link.
* Privacy-friendly.
* Focused on status rather than maps.
* Ready to use within seconds.

If a feature doesn't directly help answer:

> "Where is everyone relative to the group?"

it should not be included.

---

## Target Users

### Primary Users

* Friends travelling together.
* Multiple cars going to the same destination.
* Families moving in groups.
* Convoys.

### Secondary Users

* Tour guides.
* School excursions.
* Hiking groups.
* Wedding attendees.
* Festival groups.

---

## Core User Story

As someone travelling with others,
I want to quickly create a temporary group,
So that everyone can know whether the others are ahead, behind, waiting, or have arrived without repeatedly calling each other.

---

## MVP Scope

### Create a Trip

A user can:

* Open the website.
* Tap "Start Trip".
* Enter:
  * Trip name (optional).
  * Destination name (optional).
* Generate a shareable link.

Time to complete: Less than 15 seconds.

### Join a Trip

Participants can:

* Open the shared link.
* Enter their name.
* Allow location access.
* Join immediately.

No account required.

### Group Status Screen

The main screen shows:

**Group Summary** — Example:

Road Trip to Kumasi — 4 Members

* Ibrahim – Ahead
* Kojo – Behind
* Ama – With Group
* Sarah – Arrived

---

## Status Types

The system automatically determines status.

* **With Group** — User is within a defined distance of most members. Example: within 100 metres.
* **Ahead** — User has passed the group's average position.
* **Behind** — User is trailing behind the group.
* **Stopped** — User has not moved for a certain period. Example: no movement for 5 minutes.
* **Arrived** — User reaches the destination area. Only shown if a destination was specified.

---

## Map

A simple map is included.

Purpose: Provide reassurance.

Requirements:

* Show member pins.
* Show destination pin if available.

No route planning. No turn-by-turn navigation. No traffic information.

The map is secondary to statuses.

---

## Notifications

Users receive browser notifications such as:

* "Kojo has arrived."
* "Ama is now behind the group."
* "Everyone has arrived."
* "2 members are waiting."

Notifications are optional.

---

## Trip Lifecycle

Trips are temporary. Default duration: 8 hours.

After expiration:

* Location updates stop.
* Data is deleted.
* Links become inactive.

Trip creator may also manually end the trip.

---

## Privacy

Privacy is a key selling point.

Requirements:

* No permanent location history.
* No accounts required.
* Trips automatically expire.
* Location only shared within active trips.
* Users can leave anytime.
* Data deleted after trip expiration.

---

## Technical Requirements

### Platform

Responsive web application. Supported: mobile browsers, desktop browsers. Optimised for mobile. No native apps initially.

### Frontend

Recommended Stack: Next.js, TypeScript, Tailwind CSS, shadcn/ui, PWA support.

### Backend

Recommended: Supabase. Use for temporary trip records, realtime participant updates, presence tracking.

### Realtime Updates

Location update interval: every 20–30 seconds. Additional updates triggered when user changes significantly in position. Balances battery life, network usage, responsiveness.

---

## Data Model

**Trip**

* id
* shareCode
* name
* destinationName
* destinationLatitude
* destinationLongitude
* creatorId
* expiresAt
* createdAt

**Participant**

* id
* tripId
* displayName
* latitude
* longitude
* status
* lastSeenAt

---

## User Flow

**Trip Creator:** Open Website → Start Trip → (Optional) Add Destination → Share Link → Watch Group Status → End Trip

**Participant:** Open Link → Enter Name → Allow Location → Join Trip → View Group Status → Leave Trip

---

## Success Metrics

The MVP succeeds if users can:

* Create a trip in under 15 seconds.
* Join in under 20 seconds.
* Understand the group's status without explanation.
* Reduce "Where are you?" calls.
* Use the product repeatedly for real journeys.

---

## Features Explicitly Excluded From MVP

Do NOT build: user accounts, friend systems, chat, media sharing, payment systems, social feeds, route navigation, historical trip playback, driver analytics, gamification.

---

## Future Opportunities (Post-MVP)

Native mobile apps, offline recovery, ETA calculations, convoy mode, group chat, voice alerts, recurring groups, family mode, event organiser dashboard. Only after validating the core experience.

---

## One-Sentence Product Definition

GroupTrack is a temporary location-sharing web app that tells groups whether everyone is ahead, behind, waiting, or has arrived—without downloads, accounts, or endless phone calls.
