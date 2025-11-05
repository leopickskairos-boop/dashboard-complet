# Design Guidelines - Plateforme IA Réceptionniste Vocale

## Design Approach

**Selected System**: Material Design principles adapted for SaaS/Dashboard context
**Rationale**: Information-dense productivity application requiring clear data hierarchy, standard UI patterns for authentication/payments, and professional trustworthiness. The platform balances utility (dashboard, stats) with conversion (signup, subscription).

**Key Design Principles**:
- Clean, professional SaaS aesthetic emphasizing trust and reliability
- Clear visual hierarchy for complex data (call logs, statistics)
- Streamlined authentication flows with minimal friction
- Dashboard-first mentality for logged-in experience

---

## Typography

**Font Families** (via Google Fonts CDN):
- Primary: Inter (headings, UI elements, buttons)
- Secondary: System UI stack for body text and data tables

**Type Scale**:
- Hero/Landing H1: text-5xl md:text-6xl font-bold (48-60px)
- Page Headers (H1): text-4xl font-bold (36px)
- Section Headers (H2): text-2xl font-semibold (24px)
- Card/Component Headers (H3): text-xl font-semibold (20px)
- Body Text: text-base (16px)
- Secondary/Meta: text-sm (14px)
- Captions/Labels: text-xs font-medium uppercase tracking-wide (12px)

**Hierarchy Rules**:
- All form labels: text-sm font-medium
- Button text: text-sm font-semibold
- Dashboard stats numbers: text-3xl font-bold
- Table headers: text-xs font-semibold uppercase tracking-wider

---

## Layout System

**Spacing Primitives** (Tailwind units):
- **Primary scale**: 4, 6, 8, 12, 16, 24
- **Component internal padding**: p-6 (cards), p-4 (form fields)
- **Section spacing**: py-16 md:py-24 (landing), py-12 (dashboard sections)
- **Element gaps**: gap-6 (cards grid), gap-4 (forms), gap-2 (inline elements)

**Container Widths**:
- Landing pages: max-w-7xl mx-auto px-6
- Auth forms (signup/login): max-w-md mx-auto
- Dashboard: max-w-screen-2xl mx-auto px-6
- Pricing page: max-w-5xl mx-auto

**Grid Systems**:
- Landing features: grid-cols-1 md:grid-cols-3 gap-8
- Dashboard cards: grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6
- Stats overview: grid-cols-2 md:grid-cols-4 gap-4

---

## Component Library

### Navigation
**Landing Header**:
- Fixed top, backdrop-blur-lg with subtle border-bottom
- Logo left, nav center, "Se connecter" + "Commencer" CTA buttons right
- Height: h-16, horizontal padding px-6

**Dashboard Sidebar** (desktop):
- Fixed left, w-64, full height
- Logo top (p-6), nav menu middle, user profile bottom
- Each nav item: px-4 py-3 rounded-lg with icon + label

**Dashboard Top Bar** (mobile):
- Hamburger menu, page title center, user avatar right
- Height: h-14

### Authentication Forms

**Form Container**:
- Centered card with rounded-xl, p-8
- Logo/heading at top, form middle, helper links bottom
- Width: w-full max-w-md

**Input Fields**:
- Full width with rounded-lg
- Label above (text-sm font-medium mb-2)
- Input height: h-12, px-4
- Error messages: text-sm mt-1

**Buttons**:
- Primary CTA: w-full h-12 rounded-lg font-semibold
- Secondary/Link: text-sm font-medium underline-offset-4

**Email Verification Page**:
- Centered content with icon (checkmark or envelope)
- Clear heading explaining next steps
- Prominent "Resend verification email" link

### Pricing/Subscription Page

**Layout**:
- Centered single pricing card (since one plan: 29€/mois)
- Card: max-w-sm, rounded-2xl, p-8, border-2 with shadow
- Checkmark list of features (gap-4)
- Prominent Stripe Checkout button at bottom

**Price Display**:
- Large number: text-5xl font-bold
- Currency + period: text-lg aligned baseline

### Dashboard Components

**Stats Cards**:
- Grid of 2-4 cards, each rounded-xl p-6
- Icon top-left, label text-sm, value text-3xl font-bold
- Optional trend indicator (↑ +12%)

**Call History Table**:
- Full width with rounded-lg border
- Sticky header row with text-xs font-semibold uppercase
- Row height: h-16, alternating subtle background treatment
- Columns: Date/Time, Caller ID, Duration, Status, Actions
- Pagination controls at bottom

**Call Summary Cards**:
- Individual call expandable cards
- Header: Caller info + timestamp + duration badge
- Body: AI-generated summary (collapsed/expanded state)
- Footer: Action buttons (Download, Share, etc.)

**Charts/Statistics**:
- Card container with header "Statistiques" + date range selector
- Simple bar/line charts showing call volume over time
- Use Chart.js or Recharts via CDN

### Empty States
- Large icon (80x80px) centered
- Heading "Aucun appel pour le moment"
- Descriptive text explaining next steps
- Optional CTA button

### Subscription Expired Page
- Centered alert card with warning icon
- Clear message "Votre abonnement a expiré"
- Prominent "Renouveler mon abonnement" button
- Link to contact support

---

## Landing Page Structure

**Hero Section** (h-screen or min-h-[600px]):
- Two-column layout: left = headline + subtitle + CTA buttons, right = hero image
- Headline emphasizes "IA Réceptionniste Vocale 24/7"
- Dual CTAs: "Commencer gratuitement" (primary) + "Voir démo" (secondary)
- Trust indicators below (e.g., "Aucune carte bancaire requise")

**Features Section** (py-24):
- 3-column grid showcasing key features
- Icon (from Heroicons) + title + 2-sentence description per card
- Features: AI vocale, Dashboard analytics, Intégrations

**Pricing Section** (py-24):
- Single centered pricing card (since one plan)
- "Tarification simple et transparente" heading
- Clear feature list with checkmarks
- CTA: "Commencer maintenant"

**Footer**:
- Multi-column: Company info, Product links, Legal links, Social
- Newsletter signup: "Restez informé" with email input + button
- Copyright and trust badges at bottom

---

## Images

**Hero Image**: 
- Placement: Right side of hero section (50% width on desktop)
- Description: Modern illustration or screenshot showing dashboard interface with call analytics, preferably isometric or 3D style showing phone + AI + data visualization
- Treatment: Add subtle shadow/glow effect

**Feature Section Icons**:
- Use Heroicons (outline style) at 48x48px
- Icons: phone, chart-bar, cog for respective features

No additional photography needed - keep focus on the product interface and clear data visualization.

---

## Responsive Behavior

**Breakpoints**:
- Mobile-first approach
- md: 768px (tablet)
- lg: 1024px (desktop)
- xl: 1280px (large desktop)

**Key Adaptations**:
- Hero: stack vertically on mobile (image below text)
- Dashboard: sidebar becomes top bar with hamburger on mobile
- Tables: horizontal scroll on mobile with sticky first column
- Stats grid: 2 cols mobile → 4 cols desktop
- Forms: full width mobile with px-4

---

## Animations & Interactions

**Minimal Animation Strategy**:
- Button hover: subtle scale (scale-105) + shadow increase
- Card hover: slight elevation change
- Page transitions: simple fade (200ms)
- Loading states: spinning icon for async actions
- Form validation: shake animation for errors

**NO**: Scroll-triggered animations, parallax effects, or complex transitions

---

This design creates a trustworthy, professional SaaS platform that prioritizes clarity for data-heavy content while maintaining an inviting conversion flow for new users.