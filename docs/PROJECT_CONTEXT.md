# HolaLocal - Project Context

## Project Overview

HolaLocal is a mobile-first local services marketplace designed primarily for the Costa del Sol and Gibraltar regions.

The goal of the app is to help residents find trusted local services without relying on Facebook groups, word of mouth, or internet searches.

Users can search for local businesses and communicate directly through the app.

The platform focuses heavily on trust, privacy, simplicity, and multilingual communication.

---

## Brand

App Name: HolaLocal

Tagline:

"Local Services • Real People • Trusted"

Developer:

PIXORA

HolaLocal should feel like an independent brand while being owned and maintained by PIXORA.

---

## Target Users

### Customers

Residents looking for local services such as:

* Cleaners
* Plumbers
* Electricians
* Builders
* Gardeners
* Painters
* Handymen
* Pet services
* Home maintenance services

### Businesses

Local businesses and self-employed professionals wishing to advertise their services.

---

## Key Principles

* Simple and easy to use.
* Privacy focused.
* No anonymous messaging.
* Minimal personal data collection.
* No selling of user data.
* Mobile-first design.
* Clean, modern UI.
* Community-focused experience.

---

## User Flow

### Browsing

Users can browse the app without creating an account.

Users can:

* Search businesses.
* Browse categories.
* View business profiles.
* View reviews.
* View photos.

No login required.

### Messaging

Users must create an account before messaging a business.

Anonymous messaging is not permitted.

Users should always know who they are communicating with.

---

## Authentication

Firebase Authentication.

Initial authentication methods:

* Email and Password only.

Future methods:

* Google Sign In.
* Apple Sign In.

---

## Backend

Backend Platform:

Firebase

Services used:

* Firebase Authentication
* Cloud Firestore
* Firebase Storage
* Firebase Analytics

Future services:

* Firebase Cloud Messaging
* Google Translate API
* Stripe or RevenueCat subscriptions

---

## Firebase Configuration

```dotenv
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
VITE_SITE_URL=https://holalocal.es
```

---

## Initial Firestore Collections

users

businesses

categories

conversations

messages

---

## Technology Stack

Frontend:

* React
* Vite
* Capacitor

Backend:

* Firebase

Styling:

* Modern mobile-first responsive design.
* Clean, premium appearance.
* Minimalist UI.

---

## MVP Features

### Public

* Browse categories.
* Search businesses.
* View business profiles.

### Authenticated Users

* Register/Login.
* Message businesses.
* Save favourites.

### Businesses

* Register business profile.
* Upload logo and photos.
* Manage profile.
* Receive customer messages.

---

## Future Features

* Automatic translation.
* Reviews and ratings.
* Verified business badges.
* Push notifications.
* Business analytics.
* Subscription billing.
* Website version.
* Advanced filtering.
* Service request marketplace.

---

## Development Rules

* Use reusable React components.
* Keep components small and modular.
* No duplicated code.
* Prefer composition over large components.
* Use clean folder structure.
* Use Firebase SDK v12+.
* Follow modern React best practices.
* Mobile-first UI.
* All forms should include validation.
* Accessibility should be considered throughout.
