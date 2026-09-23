references from other sources:

Based on the Instagram post and the newly provided visual assets, here is the updated summary and comprehensive breakdown of the web design details:

### **Post Summary**

The post by **[@great_web_designs](https://www.instagram.com/great_web_designs/)** showcases a clean, modern mobile UI/UX design concept for a coffee ordering application. It provides both screen mockups and a brief style guide to inspire web developers and designers, referencing tools and languages like Figma, HTML5, CSS, and Bootstrap 4.

### **Updated Web Design Details**

**1. Home Screen (Left side of `image.jpg`)**

* **Header:** Features a personalized greeting ("Good morning, Johan"), a location indicator ("Lagos, Nigeria"), a user avatar, and a notification bell icon.
* **Search & Navigation:** A prominent search bar ("Search Coffee...") paired with a beige filter button.
* **Categories:** Pill-shaped toggle buttons for filtering drink types: **Cappuccino** (currently active in dark green), **Cold Brew**, and **Espresso**.
* **Product Cards:** Clean, white cards displaying high-quality top-down images of the drinks. They include star ratings (4.2, 4.4), titles with subtitles ("with choclate", "with cream milk"), pricing ($5.22, $6.12), and circular dark green "+" buttons for quick cart additions.
* **Promotions:** A "Special offers" section at the bottom highlighting a discount on ice cream-flavored cappuccinos.
* **Bottom Navigation:** Minimalist line icons for **Home** (active), **Favorites**, **Cart**, and **Profile**.

**2. Product Details Screen (Right side of `image.jpg`)**

* **Hero Section:** A large, immersive, top-down image of the selected coffee with latte art. It includes a back arrow and a heart (favorite) icon overlaid at the top.
* **Item Information:** Title ("Cappuccino") and subtitle ("With Choclate") overlaid on the image, along with a 4.2-star rating badge.
* **Attributes:** Informational tags indicating the contents and roast: "Coffee", "Choclate", and "Medium roasted".
* **Customization:** A "Coffee Size" selector with pill-shaped options for **Small** (active in dark green), **Medium**, and **Large**.
* **Description:** An "About" paragraph detailing the drink's ingredients and texture.
* **Call to Action (CTA):** A fixed bottom bar featuring a large, dark green **"Add to cart"** button seamlessly integrated with the total price ($ 5.22).

**3. Design System & Style Guide (Detailed in `image_2.jpg`)**

* **Typography:** The primary font family used throughout the interface is **Poppins**.
* **Color Palette:** The design relies on five core colors:
* **Dark Green:** Used as the primary accent color for active states, CTA buttons, and icons.
* **White:** Used for backgrounds, product cards, and primary text inside dark buttons.
* **Beige / Soft Peach:** Used for secondary accents, backgrounds, and the filter button.
* **Light Gray:** Used for inactive UI elements and secondary text.
* **Black / Dark Charcoal:** Used for primary typography (headings, titles).


* **Resources:** The designer utilized **icons8** and **iconly v2.3** for the application's iconography.



## 🛡️ Senior Cybersecurity Review: Society Food Platform
As a Senior Cybersecurity Analyst, I have conducted an architectural threat modeling assessment of your codebase footprint. Because this platform manages transactional order data, handles community residency validation (flat numbers), and acts as a localized peer-to-peer marketplace, its primary threat vectors are identity spoofing, database injection, and localized data leaks.
Your tech stack (FastAPI + React PWA + PostgreSQL) offers excellent native security defaults, but deploying a marketplace into production requires tight compliance checks. Below is the security audit, critical checks, and a mitigation roadmap.
------------------------------
## 1. High-Risk Threat Vectors & Architectural Concerns## Vulnerability 1: OTP Authentication & Session Management

* The Risk: Your stack uses OTP (Email/WhatsApp) instead of standard passwords. If the generation mechanism lacks proper rate-limiting or uses a predictable seed (math.random() instead of secrets), attackers can brute-force OTP tokens to hijack seller or buyer accounts.
* The Impact: Unauthorized access to order balances, flat listings, and buyer history.

## Vulnerability 2: Multi-Tenant Authorization Bypass (BOLA)

* The Risk: The platform isolates data based on residential society and flat verification. In FastAPI, if your route path decorators look like /api/orders/{order_id}/ready without strict logical validation checks matching the current_user.society_id against the target order record, a user can guess numeric order IDs (Broken Object Level Authorization).
* The Impact: A resident in one flat viewing or modifying orders belonging to another resident.

## Vulnerability 3: Deployment Secrets & Environmental Hazards

* The Risk: The repository exposes files like .env.example, docker-compose.yml, and setup.cfg. If real credentials are accidentally committed during local testing or if the Docker environment relies on root privilege contexts (user: root inside containers), an exploit in FastAPI could compromise the entire cloud host.
* The Impact: Full database exfiltration and host compromise.

------------------------------
## 2. The Analyst's Security Review Checklist
Implement this mandatory pre-flight checklist before inviting real users to the platform:
## 🛑 Backend & API Security (FastAPI)

* Cryptographic OTP Generation: Ensure utils/otp.py uses Python's secrets.SystemRandom to generate non-sequential, cryptographically secure 6-digit integers.
* OTP Expiry & Destruction: Enforce a strict 3-to-5-minute lifetime window for OTP validation tokens. Purge the token from the cache/database immediately after the first validation attempt (successful or failed) to block reuse.
* Strict Route Guards: Audit api/routes/ to ensure every transactional endpoint calls a dependency verifying both authentication status and explicitly matching context permissions (e.g., ensuring a seller can only update menus tied to their verified identifier).
* Input Sanitization (Pydantic): Validate all user inputs against strict regular expressions inside your Pydantic schemas (e.g., enforcing clean phone formats, filtering text boxes against script cross-site injection).

## 🌐 Frontend Security (React PWA)

* Secure Storage Vectors: Never store authentication payloads or tokens inside browser localStorage or sessionStorage where they are vulnerable to Cross-Site Scripting (XSS). Use secure, HttpOnly, SameSite=Strict, and Secure tracking cookies.
* PWA Asset Isolation: Ensure your service worker scripts handle network request caching safely. Restrict static assets caching to exclude structural API endpoints that dump personal records or resident directories.
* Content Security Policy (CSP): Configure production headers to restrict script execution contexts, ensuring the app only loads components originating from your frontend domain and your verified backend API url.

## 🗄️ Infrastructure & Database (PostgreSQL / Docker)

* Docker Runtime Hardening: Modify your Dockerfile configurations to drop root user contexts. Create a dedicated application runner profile inside the container (RUN useradd -m appuser && USER appuser).
* SQL Injection Safeguards: Ensure all interactive database calls route exclusively through SQLAlchemy's parameterized object-relational mapping patterns. Never combine text strings to execute manual query executions.
* Environment Variable Isolation: Enforce zero-hardcoded secrets policy across the repository pipeline. Verify .gitignore actively masks true configuration blocks from matching repository logs.

------------------------------
## 3. Execution Security Roadmap (Implementation Plan)
To systematically address these security vectors without halting feature development, execute your hardening updates in these three prioritized stages:

[ Phase 1: Authentication & Core Data ] ➔ [ Phase 2: System Integration ] ➔ [ Phase 3: Infrastructure Hardening ]

## Phase 1: Identity & Authorization Lockdown (Days 1–3)

   1. Refactor OTP Framework: Open backend/app/utils/otp.py and replace any variable randomizations with standard cryptographic structures.
   2. Inject Rate Limiting: Apply an API rate-limiter middleware (such as slowapi) to your registration and verification entry routes. Cap generation requests at a maximum of 3 attempts per phone number/email every 15 minutes.
   3. Lock Down API Endpoint Parameter Assertions: Review backend/app/api/routes/orders.py and sellers.py. Inject a resource ownership evaluation query pattern directly into the endpoint's execution pipeline before serving data payloads.

## Phase 2: Transport & Client Session Protection (Days 4–5)

   1. Transition Token Management: Convert your JWT/session issuance routine to use secure web cookies rather than plain JSON text strings returned directly to client application layers.
   2. Review Client Data Hygiene: Audit frontend/src/services/api.js to ensure cached server responses are safely scrubbed upon logout events.
   3. Implement Strict Content Security Headers: Embed production security header configurations directly into your Render static app deployment profile or your server gateway script layers.

## Phase 3: Containerization & Database Hardening (Days 6–7)

   1. Hardening Container Configurations: Revise the target build steps in backend/Dockerfile to transition operation privileges away from standard system administration profiles.
   2. Database Isolation Checks: Audit production database configuration paths. Confirm that external network parameters reject inbound traffic from anywhere outside your explicit backend hosting infrastructure blocks.
   3. Run Automation Checks: Integrate automated source scanners into your development loops. Run bandit -r backend/ to locate hidden flaws across your Python functions, and check frontend dependecy logs using npm audit.



develop a similar readme https://github.com/TheOrionGD/FinTrack-Pro/blob/main/README.md
```
 __________.__        ___________                     __     __________               
 \_   _____/|__| ____ \__    ___/___________    ____ |  | __ \______   \_______  ____  
  |    __)  |  |/    \  |    |  \_  __ \__  \ _/ ___\|  |/ /  |     ___/\_  __ \/  _ \ 
  |     \   |  |   |  \ |    |   |  | \// __ \\  \___|    <   |    |     |  | \(  <_> )
  \___  /   |__|___|  / |____|   |__|  (____  /\___  >__|_ \  |____|     |__|   \____/ 
      \/            \/                      \/     \/     \/                           
```

# FinTrack Pro
> A high-performance, local-first financial visualizer and budgeting platform built for secure wealth management.

---

[![Licence: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Version: 1.2.0](https://img.shields.io/badge/Version-1.2.0-indigo.svg)](#)
[![Security: Local-First](https://img.shields.io/badge/Security-Local--First-emerald.svg)](#)
[![Performance: 99/100](https://img.shields.io/badge/Performance-99%2F100-success.svg)](#)
[![Responsive: CSS Grid & Flex](https://img.shields.io/badge/Responsive-Mobile--Friendly-violet.svg)](#)

---

## The Developers Story

### Project Inspiration
FinTrack Pro was born out of a growing frustration with modern financial applications. Most personal finance tools are overly complex, force users to link sensitive bank credentials, upload data to remote cloud servers, and subject users to targeted ads and data monetize strategies. The inspiration for this project came from a simple, elegant question: *Why can't personal budgeting be secure, visually beautiful, and run entirely within the user's browser sandbox without dependencies?* We wanted to build a workspace that gave absolute sovereignty back to the individual over their expense logging.

The initial concept was simple: a lightweight browser-based spreadsheet tracker. However, as the design matured, it became clear that consumers expect the responsiveness and visual fidelity of a premium finance desktop application. This realization inspired us to create a highly optimized client dashboard that is local-first, privacy-respecting, and visually stunning. We wanted to demonstrate that native web technologies, when leveraged properly, could replace subscription-based tools.

### Meet the Developer
This system was engineered by a solo creator focused on local-first web engineering and frontend architectures. With a strong interest in minimal-dependency, high-efficiency JavaScript systems, the developer set out to prove that premium user experiences and robust features do not require massive servers, database clusters, or modern complex frameworks like React or Vue.

The developer believes in the "Vanilla Web" movement. By masterfully applying semantic HTML5, CSS custom variables, and basic DOM lifecycle hooks, the developer managed to keep the application payload under 50KB while yielding performance metrics that rival frameworks ten times the size. Throughout development, the creator prioritized modular organization, ensuring stylesheet layouts and behavioral modules remained decoupled for maintenance scalability.

### The Challenge
Building a feature-rich analytics system without a remote backend poses unique structural challenges:
1. **State Preservation**: How do we preserve user data reliably across browser restarts without a MySQL or PostgreSQL backend? The solution lay in the HTML5 Web Storage API, wrapping serialize/deserialize operations in strict try-catch handlers to catch database integrity faults.
2. **Computational Rendering**: How do we calculate and render live charts, metrics, and progress breakdowns instantly using only basic DOM manipulations? We had to create a centralized state rendering engine that performs batch redraws to avoid DOM thrashing.
3. **Local Report Generation**: How do we export high-fidelity reports and data sheets locally, preserving styling without server-side rendering engines? We had to design clean layout hooks that interface with client-side canvas generators.

Each limitation was turned into an engineering opportunity to build high-performance, local code modules that run smoothly on everything from low-end mobile devices to modern desktop environments.

### Design Philosophy
The design system of FinTrack Pro is guided by three principles:
1. **Glassmorphism Aesthetic**: Give the interface depth and visual premium quality using blurred backdrops, glowing boundaries, and organic color gradients. We utilize CSS backdrop-filters and transparent alpha layers to mimic physical frosted glass panels.
2. **High-Contrast Dark Theme**: Minimize eye strain while maintaining a sophisticated, workspace-oriented color scheme (slate, indigo, emerald, rose). Every color was picked using HSL variables to maintain contrast and legibility under all conditions.
3. **Dynamic Feedback**: Ensure every user action (adding, editing, deleting, or searching) is met with immediate visual transitions and updates. We leverage CSS transitions on hover and focus to make the dashboard feel alive and interactive.

The visual architecture is built to mirror professional workstation dashboards, utilizing grid components to position KPI analytics at the top, categorization progress indicators in the middle, and database operations tables below.

### Engineering Journey
The journey began with simple code structures: modularizing internal styles and scripting components out of monolithic HTML files. When style guidelines became clear, we defined a uniform layout theme. Next was establishing a state management model. We designed a pure state lifecycle that automatically updates visual DOM components (table rows, indicators, badges) whenever the underlying transaction arrays modify.

After the initial CRUD lifecycle was stable, we focused on analytics. We engineered dynamic CSS progress bars that read in-memory state values and render relative spend distributions. Finally, the export features (CSV serialization and HTML Canvas report rendering) were added, wrapping up the features set for a premium local tool.

### Security-First Thinking
In personal finance, privacy is paramount. FinTrack Pro does not connect to external servers to sync expense logs. There are no tracking scripts, analytics trackers, or network calls sending data out of the system. By restricting the app's perimeter entirely to the client's device, we establish a robust security boundary that protects users against database breaches and corporate data scraping.

By design, the application is immune to common backend web vulnerabilities such as SQL Injection (SQLi), Cross-Site Request Forgery (CSRF), and server-side remote code execution. Because data is parsed strictly as JSON arrays and formatted as escaped string nodes prior to DOM insertion, standard cross-site scripting risks are minimized.

### Building the Consent Workflow
Even local storage requires transparency. When users operate FinTrack Pro, they remain in total control of their data. The consent workflow is built directly into the local architecture: data is stored on the device only when the user submits an item, and can be cleared instantly via manual button action or browser cache management. No silent background tracking occurs.

Before storing any settings in `localStorage`, the application assumes standard default states. It does not perform active cookies profiling or hidden storage calls. The application operates strictly as a utility tool, ensuring that the user is the sole owner and controller of the financial records.

### User Experience Decisions
Every layout component was heavily debated:
- **Clickable Header Headers**: Instead of complex filter forms, clicking table columns allows users to sort data in ascending/descending modes. This keeps the workspace uncluttered.
- **Pill Badges**: Category identification uses high-contrast pill labels to visually catalog lists.
- **Inline Editing**: Instead of opening confusing modals, clicking "Edit" updates the main submission form, ensuring a smooth, single-page workflow.
- **Floating Footer**: The brand footer is locked at the bottom viewport, providing quick contact references and giving a unified desktop frame to the layout.

### Technical Challenges & Solutions
One of the primary technical roadblocks was generating high-fidelity PNG image downloads of the dashboard table. Standard browser screenshot tools render the entire viewport, including forms and interactive buttons.
- **Solution**: We structured a temporary layout state toggle in `js/tracker.js`. When the capture trigger fires, the script dynamically conceals the input form, filter bar, and action buttons, runs `html2canvas` on the targeted area with custom scaling rules, prompts the download, and restores the display state in under 1500ms.
- **Result**: The user obtains a clean, professional financial document that contains only the metrics grid and transaction tables, ready to be attached to reports.

### Collaboration Story
During development, peer reviews guided the evolution of the project. Early feedback pointed out that rigid formatting (e.g. hardcoded USD symbols) restricted international utility. This prompted the addition of the dynamic multi-currency converter, allowing users to toggle symbols instantly while re-scaling active metrics.

A secondary feedback loop highlighted that layout container shifts occurred on small screens. The team resolved this by moving the layout from a rigid CSS Flexbox structure to a combined CSS Grid and Flexbox responsive model. This keeps the metric grids aligned on mobile viewports.

### Lessons Learned
This project reinforced that Vanilla CSS3 and modern ES6+ JavaScript are incredibly robust. By avoiding heavy external dependencies and build scripts, we achieved near-instantaneous page load times, highly predictable rendering cycles, and simplified maintenance paths.

We also learned the value of the "local-first" development paradigm. By shifting data calculation and storage completely onto the client-side thread, we eliminated backend cloud hosting fees, removed database management tasks, and built a system that works offline.

### Future Vision
The roadmap for FinTrack Pro includes:
- **Encrypted Local Storage**: Encrypting LocalStorage contents using user-supplied passwords.
- **Multi-Account/Ledger Support**: Swapping between multiple ledger profiles stored in browser databases.
- **Dynamic Charting Canvas**: Incorporating modular SVG line charts showing monthly expense trajectory curves.
- **Data Synchronization Sync**: Optional end-to-end encrypted peer-to-peer sync protocols using WebRTC.

### Behind the Name
The name *FinTrack Pro* reflects the design goal: **Fin**ancial **Track**ing made **Pro**fessional. The "Pro" designates the elevated dark glassmorphic design system and responsive layout grid typical of premium productivity suites.

### Message from the Developers
> "We hope FinTrack Pro empowers you to take control of your financial destiny. By keeping your data local, we keep your details safe. Happy budgeting!"

---

## Table of Contents
1. [System Specifications](#system-specifications)
2. [Architectural Overview](#architectural-overview)
3. [Folder Structure](#folder-structure)
4. [Installation & Setup](#installation--setup)
5. [User Interface Design System](#user-interface-design-system)
6. [Core Features Walkthrough](#core-features-walkthrough)
7. [CSS Class & Visual Token Reference](#css-class--visual-token-reference)
8. [API & State Lifecycle Documentation](#api--state-lifecycle-documentation)
9. [Data Security & Privacy Principles](#data-security--privacy-principles)
10. [Performance & Scalability Optimization](#performance--scalability-optimization)
11. [Testing & Quality Assurance Matrix](#testing--quality-assurance-matrix)
12. [Troubleshooting & Support Registry](#troubleshooting--support-registry)
13. [Frequently Asked Questions (FAQ)](#frequently-asked-questions-faq)
14. [Licensing & Contribution Details](#licensing--contribution-details)

---

## System Specifications

### Technical Component Table
FinTrack Pro relies on a modern frontend compilation pipeline running natively inside standard web browser rendering engines.

| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| Markup | HTML5 | Living Standard | Semantic document structure and input fields |
| Styling | CSS3 | Custom Level 3 | Premium dark glassmorphic UI layout |
| Logic | JavaScript | ES6+ | State management and dynamic rendering engine |
| Rendering | html2canvas | 1.4.1 | Visual snapshot report exporter |
| Storage | Web Storage API | LocalStorage | Client persistence layer (zero-cloud) |

### Performance Targets
- **LightHouse Performance Rating**: 99% (Average test run)
- **First Contentful Paint (FCP)**: < 0.2 seconds
- **Cumulative Layout Shift (CLS)**: 0.00
- **Time to Interactive (TTI)**: < 0.25 seconds
- **Dependency Overhead**: < 20KB compiled payload

---

## Architectural Overview

FinTrack Pro operates under a strictly client-managed sandbox model. This model isolates code execution to the client device.

### System Data Pipeline
This layout details how user entries travel from input selectors through validation, array storage, and storage persistence layers.

```mermaid
graph TD
    A[User UI Interactions] --> B[Application Logic js/tracker.js]
    B --> C{State Actions}
    C -->|Add/Edit/Delete| D[In-Memory Expense State Array]
    D --> E[Sync to LocalStorage]
    D --> F[Trigger Render Lifecycle]
    F --> G[Update KPI Metric Cards]
    F --> H[Update Category Progress Bars]
    F --> I[Repopulate Data Table]
    C -->|Search/Filter/Sort| J[Filter State Array]
    J --> F
    C -->|Change Currency| K[Update Active Currency state]
    K --> F
    C -->|Download Report| L[Conceal UI Buttons & Form]
    L --> M[Capture targeted HTML Canvas]
    M --> N[Download FinTrack-Report.png]
    N --> O[Restore UI Display]
```

### Stateful Transition Diagram
This lifecycle loop defines the active state configurations during runtime updates:

```mermaid
stateDiagram-v2
    [*] --> Idle: Init Data from Storage
    Idle --> FormSubmit: Submit Expense Event
    FormSubmit --> StateValidation: Validate Inputs
    StateValidation --> StateUpdate: Push to Expenses Array
    StateUpdate --> StorageSync: Serialize & Write LocalStorage
    StorageSync --> RenderEngine: Invoke Render()
    RenderEngine --> DOMRedraw: Batch Update UI Elements
    DOMRedraw --> Idle
    Idle --> FilterTrigger: Input Search or Dropdown
    FilterTrigger --> RenderEngine: Filter Array Subset
    Idle --> ColumnClick: Sort Table Header
    ColumnClick --> SortState: Toggle Sort Column/Direction
    SortState --> RenderEngine: Apply In-Place Sort Array
```

### Action Sequence Detail
The timeline sequence of operations from the submit button click to layout update:

```mermaid
sequenceDiagram
    autonumber
    User->>Form: Submit new expense item
    Form->>JS Engine: Dispatch submit event
    JS Engine->>State Array: Push expense object {id, name, amount, date, category}
    JS Engine->>LocalStorage: Write updated state array string
    JS Engine->>JS Engine: Re-sort state based on active column header
    JS Engine->>UI DOM: Empty table rows
    JS Engine->>UI DOM: Render filtered and sorted expense rows
    JS Engine->>UI DOM: Recalculate and render KPI totals (Spent, Remaining)
    JS Engine->>UI DOM: Update Category Progress percentage bars
```

---

## Folder Structure

The code layout separates design layers from client-side logic to keep files clean and manageable.

### Complete Root Blueprint
```
FinTrack-Pro/
│
├── css/
│   ├── login.css            # Stylesheet for LOGIN.html layout (glassmorphism details)
│   └── tracker.css          # Stylesheet for tracker.html dashboard layout
│
├── js/
│   ├── login.js             # Logic for LOGIN.html page validation and toggles
│   └── tracker.js           # Core state controller, DOM compiler, and reporting engine
│
├── LOGIN.html               # Entry gate and account sign-in interface
├── tracker.html             # Main tracker application dashboard page
├── logo.png                 # App logo file (used as favicon and visual branding)
└── README.md                # System documentation manual (this file)
```

### Structural Description

#### `LOGIN.html`
This is the application entry point. It displays the credentials input panel and contains hooks for basic sign-in validation. It links directly to `css/login.css` and imports `js/login.js`.

#### `css/login.css`
Contains styling for the sign-in page. It establishes the central gradient, configures keyframe animations for gradient shifting, sets glass container styling using transparency indicators, and defines password input visibility styles.

#### `js/login.js`
Listens for submission events on the sign-in form. It intercepts native browser reload behavior, validates user entry fields, handles password eye toggles, and routes the browser instance to `tracker.html`.

#### `tracker.html`
The central cockpit workspace of the application. It includes semantic HTML structure layout frames for the KPI panels, progress budget trackers, submission forms, search/filter tools, and data tables.

#### `css/tracker.css`
Contains the styles for the dashboard interface. It configures CSS custom variables, sets grid layout structures for the metrics cards and form inputs, defines dynamic color codes for transaction categories, and manages animations for budget warning triggers.

#### `js/tracker.js`
The heart of the application. It initializes variables, manages state arrays, parses/serializes Web Storage logs, handles dynamic category tracking, sorts columns, filters lists, and controls visual document rendering (PDF-like PNG capturing).

---

## Installation & Setup

FinTrack Pro is a static HTML5 web application. It runs directly inside modern web browsers without server compilation steps.

### Detailed Deployment Methods

#### Method 1: Desktop Execution
1. Download the code files bundle as a ZIP archive or clone via Git.
2. Unpack the files into a local folder on your computer.
3. Locate the [LOGIN.html](file:///e:/GitHub-Repos/FinTrack-Pro/LOGIN.html) entry script.
4. Double-click the file to open it directly in Google Chrome, Mozilla Firefox, Microsoft Edge, or Apple Safari.

#### Method 2: Serving Locally (HTTP Daemon)
If you require a local server environment (e.g. for testing network constraints, CORS options, or remote access):
- **NodeJS Engine**:
  ```bash
  npm install -g serve
  serve -s FinTrack-Pro
  ```
- **Python CLI Tool**:
  ```bash
  cd FinTrack-Pro
  python -m http.server 8080
  ```
- **PHP CLI Utility**:
  ```bash
  cd FinTrack-Pro
  php -S localhost:8080
  ```

#### Method 3: Cloud Hosting Deployment (Zero Backend Config)
Because the app is compiled static code, it can be hosted on free cloud hosting services:
- **GitHub Pages**:
  - Push the repository code onto a public branch.
  - Enable Pages in repository settings pointing to root.
- **Vercel / Netlify**:
  - Connect your repository to the service.
  - Deploy with zero build commands.

---

## User Interface Design System

The application uses custom CSS variables to establish a consistent, premium design theme.

### Component Layout Map
This layout blueprint shows the spacing configuration of the dashboard layout.

```
+-------------------------------------------------------------------------------+
|                                 FinTrack Pro                                  |
+-------------------------------------------------------------------------------+
|  +--------------------+  +--------------------+  +--------------------+  ...  |
|  |    Total Spent     |  |  Logged Expenses   |  |  Remaining Budget  |       |
|  |      $1,250.00     |  |         14         |  |   $750.00 (OK)     |       |
|  +--------------------+  +--------------------+  +--------------------+  ...  |
+-------------------------------------------------------------------------------+
|  Spending Breakdown (Progress Bars Panel)                                     |
|  Food          [||||||||||||||||||||||||||||                     ] $450.00     |
|  Transport     [||||||||||||                                     ] $120.00     |
+-------------------------------------------------------------------------------+
|  [Form Inputs: Name, Amount, Date, Category]                       [Add Btn]  |
+-------------------------------------------------------------------------------+
|  [Search Input]              [Filter Cat Selector]        [Currency Selector] |
+-------------------------------------------------------------------------------+
|  EXPENSE TABLE (Interactive, click headers to sort)                           |
|  Name (sort)   |   Amount (sort)   |   Date (sort)   |  Category  |  Actions   |
|  --------------|-------------------|-----------------|------------|----------  |
|  Dinner        |   $25.50          |   2025-06-05    |  Food      |  Edit/Del  |
+-------------------------------------------------------------------------------+
|                     [Download PNG]     [Export CSV]                           |
+-------------------------------------------------------------------------------+
```

### Theme Colors Reference
Design system values are defined in `css/tracker.css`:

```css
:root {
    --bg-primary: #0b0f19;
    --bg-gradient: linear-gradient(135deg, #0b0f19 0%, #111827 50%, #1e1b4b 100%);
    --accent-indigo: #6366f1;
    --accent-violet: #8b5cf6;
    --accent-pink: #ec4899;
    --accent-emerald: #10b981;
    --accent-rose: #f43f5e;
    
    --text-main: #f3f4f6;
    --text-muted: #9ca3af;
    
    --glass-bg: rgba(17, 24, 39, 0.6);
    --glass-border: rgba(255, 255, 255, 0.08);
    --card-bg: rgba(255, 255, 255, 0.03);
    
    --input-bg: rgba(255, 255, 255, 0.03);
    --input-border: rgba(255, 255, 255, 0.1);
    --input-focus-border: #818cf8;
    
    --transition-smooth: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## Core Features Walkthrough

### 1. Credentials Gate
The entry portal [LOGIN.html](file:///e:/GitHub-Repos/FinTrack-Pro/LOGIN.html) welcomes users with a glassmorphic form:
- **Visibility Toggle**: Click the padlock (`&#128274;`) to toggle password visibility.
- **Form Validation**: Form interceptors validate inputs before forwarding the session.

### 2. Live KPI Grid
Four metric cards display active dashboard values:
- **Total Spent**: Displays overall expenditure dynamically.
- **Logged Items**: Tracks total entries.
- **Remaining Budget**: Compares total spent against the set budget limit.
- **Top Category**: Highlights the highest spending category dynamically.

### 3. Spending Breakdown Panel
- Automatically aggregates expenses by category: **Food**, **Transport**, **Entertainment**, and **Other**.
- Renders progress tracks showing relative expenditure percentages. Fills animate dynamically using CSS transitions.

### 4. Interactive Column Sorting
- Clicking the table headers (**Name**, **Amount**, or **Date**) automatically re-sorts the data array in ascending or descending order.
- The UI renders dynamic sorting direction indicators (`↓` or `↑`).

### 5. Multi-Currency Support
- An dropdown menu located in the filter bar lets users switch display currencies on the fly:
  - **USD** (`$`)
  - **EUR** (`€`)
  - **GBP** (`£`)
  - **INR** (`₹`)
  - **JPY** (`¥`)
- Selection updates all table fields, progress bar values, and KPI metric cards.

### 6. CSV & Image Exporters
- **Export CSV**: Formats transaction logs into a clean comma-separated value sheet (`FinTrack-Expenses.csv`) and triggers local downloading.
- **Download Report Image**: Conceals inputs, menus, and buttons dynamically, renders the dashboard targeted layout to a canvas, exports a high-resolution PNG (`FinTrack-Report.png`), and restores the page layout.

---

## CSS Class & Visual Token Reference

The custom style design system utilizes explicit visual definitions in [tracker.css](file:///e:/GitHub-Repos/FinTrack-Pro/css/tracker.css) and [login.css](file:///e:/GitHub-Repos/FinTrack-Pro/css/login.css):

### `.metrics-grid`
- **Purpose**: Arranges the four analytical metrics cards in a single responsive row.
- **Implementation**:
  ```css
  .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 30px;
  }
  ```

### `.metric-card`
- **Purpose**: Displays KPI variables. It uses transparency alpha levels and blur filters to provide glass depth.
- **Implementation**:
  ```css
  .metric-card {
      background: var(--card-bg);
      border: 1px solid var(--glass-border);
      border-radius: 16px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: var(--transition-smooth);
  }
  ```

### `.metric-card.budget-alert`
- **Purpose**: Changes colors and animates the Remaining Budget card if spending exceeds limits.
- **Implementation**:
  ```css
  .metric-card.budget-alert {
      border-color: rgba(244, 63, 94, 0.4);
      background: rgba(244, 63, 94, 0.08);
      box-shadow: 0 0 20px rgba(244, 63, 94, 0.15);
      animation: alertPulse 2s infinite ease-in-out;
  }
  ```

### `.progress-track` and `.progress-fill`
- **Purpose**: Establishes progress bars container logic. Fills dynamically scale and display theme color gradients.
- **Implementation**:
  ```css
  .progress-track {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 4px;
      overflow: hidden;
  }
  .progress-fill {
      height: 100%;
      width: 0%;
      border-radius: 4px;
      transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }
  ```

---

## API & State Lifecycle Documentation

FinTrack Pro is a client-managed state machine. The DOM structure reflects active state arrays.

### State Interface Spec
```typescript
interface ExpenseItem {
    id: number;       // Unix epoch timestamp (unique database index ID)
    name: string;     // Short transaction name string
    amount: number;   // Floating point double value representation
    date: string;     // ISO format calendar value string (YYYY-MM-DD)
    category: string; // "Food" | "Transport" | "Entertainment" | "Other"
}
```

### Persistent Data Contracts
State is synchronized to the client's local storage under three namespace keys:
- `fintrack_expenses`: A serialized JSON string of the `ExpenseItem[]` array.
- `fintrack_budget`: A string representing the active monthly budget limit (default: `1000.00`).
- `fintrack_currency`: A string representing the active currency code (default: `USD`).

---

### Logic Handlers & Functions

#### 1. Add Transaction
```javascript
// Captures values, creates state object, syncs database, updates UI
const name = document.getElementById("expense-name").value;
const amount = document.getElementById("expense-amount").value;
const date = document.getElementById("expense-date").value;
const category = document.getElementById("expense-category").value;

const newExpense = {
    id: Date.now(),
    name: name,
    amount: parseFloat(amount),
    date: date,
    category: category
};
expenses.push(newExpense);
saveExpenses(); // LocalStorage setItem
render();       // DOM update trigger
```

#### 2. Dynamic Table Sorting Engine
```javascript
// Applies sort ordering on memory state array based on target column
filteredExpenses.sort((a, b) => {
    let valA = a[sortColumn];
    let valB = b[sortColumn];

    if (sortColumn === "amount") {
        valA = parseFloat(valA);
        valB = parseFloat(valB);
    } else if (sortColumn === "date") {
        valA = new Date(valA);
        valB = new Date(valB);
    } else {
        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
    }

    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
});
```

#### 3. CSV Converter Block
```javascript
// Iterates and builds comma-separated spreadsheet data string
const csvRows = ["Name,Amount,Date,Category"];
expenses.forEach(item => {
    // Escapes quote marks in item description strings
    const escapedName = `"${item.name.replace(/"/g, '""')}"`;
    csvRows.push(`${escapedName},${item.amount.toFixed(2)},${item.date},${item.category}`);
});
const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
const encodedUri = encodeURI(csvContent);
```

#### 4. HTML Canvas Capturer
```javascript
// Temporarily conceals UI controls during canvas rendering
if (formElement) formElement.style.display = "none";
if (filterElement) filterElement.style.display = "none";
if (downloadSec) downloadSec.style.display = "none";

html2canvas(captureArea, {
    backgroundColor: "#0b0f19",
    scale: 2
}).then((canvas) => {
    // Triggers local download of the generated report image
    const link = document.createElement("a");
    link.download = "FinTrack-Report.png";
    link.href = canvas.toDataURL();
    link.click();
    
    // Restores display states
    if (formElement) formElement.style.display = "";
    if (filterElement) filterElement.style.display = "";
});
```

---

## Data Security & Privacy Principles

### Local-First Data Architecture
By storing data in the browser sandbox rather than remote databases, FinTrack Pro implements a secure boundary design:
- **No Remote Network Trapping**: All calculations run locally in the browser sandbox. No API keys are needed, and no third-party trackers are integrated.
- **Physical Sovereignty**: Your data remains on your physical disk. If you clear your browser's site cache or delete local storage keys, your ledger data is wiped completely.
- **CSV Data Control**: You can backup all transaction records at any time using the Export CSV feature.

### Data Security Matrix
The table below maps potential vulnerability entrypoints to client-side mitigations:

| Attack Vector | Vulnerability Description | Mitigation Strategy |
| :--- | :--- | :--- |
| **SQL Injection (SQLi)** | Corrupted DB commands executed via input forms | There is no SQL database. Inputs are captured as native JavaScript strings, preventing command execution. |
| **CSRF / Session Hijack** | Malicious sites intercepting user session tokens | The app does not issue or transport authentication session cookies, making CSRF attacks impossible. |
| **Cloud Database Leaks** | Unsecured servers exposed to internet crawling | Data is stored locally in the browser storage container. Attackers cannot access data without local access to the device. |
| **Cross-Site Scripting (XSS)** | Injection of scripts via transaction description fields | User inputs are escaped before rendering. The app uses template literals to update `textContent` safely. |

### Browser Security Sandbox
The Web Storage API operates within a strict Origin policy boundary configured by the client's browser.
- Data stored by FinTrack Pro is only accessible to documents sharing the exact same origin path scheme (protocol, host, and port).
- The storage system uses an allocated quota (typically 5MB-10MB depending on the web engine), which is isolated from other sites.
- Because the page does not initiate dynamic iframe imports or execute remote scripts, external origins cannot access the active session cache.

---

## Performance & Scalability Optimization

FinTrack Pro is optimized to run efficiently on low-spec hardware and mobile platforms.

### Performance Milestones
- **Vanilla Architecture**: Running native code removes runtime compiler overhead.
- **Dynamic Batch Rendering**: Rendering operations empty and rebuild the table structure in a single thread execution step.
- **State Array Performance**: In-memory sorting processes thousands of records instantly.

### Performance Profile
```
[Page Load] ──> [0.05s: DOM Ready] ──> [0.08s: Read LocalStorage] ──> [0.12s: Rendering Complete]
```

### Memory Footprint Analysis
- **Dynamic Data Structures**: Transaction entries are stored in a lightweight array of JS primitives. A ledger containing 5,000 expense records consumes less than 1.5MB of in-memory heap space.
- **DOM Recycling**: By clearing and rebuild rendering nodes only on array changes, we minimize cumulative memory garbage collection thrashing in client threads.
- **Debounced Searching**: Search and filter updates evaluate text strings instantly as you type, matching characters in real-time.

---

## Testing & Quality Assurance Matrix

The verification plan outlines manual testing pathways for all application features.

| Test ID | Test Category | Target Component | Action Flow | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **TC-001** | UI Transition | Sign-in gate | Submit LOGIN.html credentials form | Transition to tracker.html without page reload errors. |
| **TC-002** | Form Logic | Expense Form | Add item with negative amount or empty values | HTML5 validation prevents submission; positive float is enforced. |
| **TC-003** | Local Sync | LocalStorage | Log three items, reload browser tab | Table displays the logged items correctly on refresh. |
| **TC-004** | KPI Calculations | KPI metrics | Edit an expense amount from 50 to 100 | Total Spent and Remaining Budget cards update instantly. |
| **TC-005** | UI Alerts | Budget Alert | Set budget limit to 100, add expense of 150 | Budget card turns red with a subtle alert animation. |
| **TC-006** | Data Sorting | Table Header | Click on Amount column header twice | Rows display in ascending order, then reverse to descending. |
| **TC-007** | Currency Update | Currency Menu | Select INR (₹) from the dropdown | Currency symbols update to "₹" in table cells, KPIs, and graphs. |
| **TC-008** | CSV Exporter | Exporter tool | Click "Export CSV" with empty table state | Prompts warning message: "No expenses recorded to export." |

### Manual Test Run Instructions

#### Running TC-001: Sign-in Gate Authentication Routing
1. Double-click [LOGIN.html](file:///e:/GitHub-Repos/FinTrack-Pro/LOGIN.html) to open the sign-in form.
2. Leave both the Username and Password fields empty, then click the **Sign In** button.
3. Observe that browser-native tooltip prompts appear, signaling that form inputs are required.
4. Input a random test username (e.g. `godfrey`) and password (e.g. `admin123`).
5. Click **Sign In**.
6. Verify that the browser relocates to the dashboard directory `tracker.html` immediately.

#### Running TC-002: Form Validation Boundary Validation
1. Navigate to `tracker.html`.
2. Fill the Expense Name with `Dinner Out`.
3. Try entering a negative numeric value (e.g., `-25.00`) inside the Amount box.
4. Note that browser form inputs prevent submission or display error warnings.
5. Provide a valid date (e.g. `2025-06-05`) and choose a category (e.g. `Food`).
6. Click **Add Expense**. Check that the item renders successfully with a value of `$25.00`.

#### Running TC-003: Local Database Sync Validation
1. Open the [tracker.html](file:///e:/GitHub-Repos/FinTrack-Pro/tracker.html) dashboard in a fresh browser window.
2. Enter the following records using the submission form:
   - Item: `Coffee`, Amount: `4.50`, Date: `2025-06-01`, Category: `Food`
   - Item: `Gas`, Amount: `40.00`, Date: `2025-06-02`, Category: `Transport`
3. Click "Add Expense" to save each entry. Verify they display correctly in the table.
4. Reload the browser page using `Ctrl + R` (or `Cmd + R` on macOS).
5. Verify that the table automatically repopulates both rows and metric totals match.

#### Running TC-004: Expense Modifications & UI Re-Calculation
1. With data rows logged in the tracker table, select the **Edit** action button of the first row.
2. Verify that the selected item is removed from the table list and that its original values are populated back into the entry form inputs.
3. Observe that the Total Spent KPI card and progress visualizers decrease accordingly.
4. Change the Amount from its original value to `100.00`.
5. Click **Add Expense**.
6. Confirm the updated values show up in the table, and total metrics reflect the updated amount.

#### Running TC-005: Budget Alert Threshold Validation
1. Open the [tracker.html](file:///e:/GitHub-Repos/FinTrack-Pro/tracker.html) dashboard.
2. Locate the "Monthly Budget" input field in the Spending Breakdown panel.
3. Enter `100.00` as the budget limit.
4. Submit a new expense: Name: `Conference Pass`, Amount: `120.00`, Category: `Entertainment`.
5. Check the "Remaining Budget" KPI card at the top.
6. Verify the card displays `-120.00` (plus active currency symbol) and flashes red.

#### Running TC-006: Column Header Sorting Verification
1. Open the [tracker.html](file:///e:/GitHub-Repos/FinTrack-Pro/tracker.html) dashboard.
2. Log three expenses:
   - Expense A: Name: `Uber`, Amount: `12.50`, Date: `2025-06-01`
   - Expense B: Name: `Target Store`, Amount: `85.00`, Date: `2025-06-03`
   - Expense C: Name: `Lunch`, Amount: `35.20`, Date: `2025-06-02`
3. Click once on the **Amount** column header.
4. Verify the rows list: `Uber ($12.50)`, `Lunch ($35.20)`, then `Target Store ($85.00)`.
5. Click again on the **Amount** column header.
6. Verify the order reverses: `Target Store ($85.00)`, `Lunch ($35.20)`, then `Uber ($12.50)`.

#### Running TC-007: Currency Update Propagation
1. Open the [tracker.html](file:///e:/GitHub-Repos/FinTrack-Pro/tracker.html) dashboard.
2. Add an item: Name: `Subscription`, Amount: `10.00`, Category: `Other`.
3. Locate the currency select dropdown in the filter bar.
4. Select `EUR (€)`.
5. Verify the **Total Spent** KPI reads `€10.00`, the progress bar breakdown values show `€10.00`, and the table cell displays `€10.00`.
6. Reload the tab and verify the currency preference remains set to `EUR (€)`.

#### Running TC-008: Exporting Validation
1. Clear all rows from your database using the delete actions.
2. Click the **Export CSV Spreadsheet** button.
3. Check that an alert pops up saying: `"No expenses recorded to export."`
4. Log at least one record. Click the CSV button again.
5. Verify the browser triggers a download for `FinTrack-Expenses.csv`.

---

## Troubleshooting & Support Registry

If you experience unexpected behavior, consult this registry of known behaviors and quick solutions:

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **Expense logs disappeared** | Browser storage cache cleared, or app opened in incognito tab | Incognito sessions use volatile in-memory storage. Avoid using incognito tabs for long-term budget tracking. |
| **Image download fails** | Browser block on downloads, or blocking extension active | Grant file download permissions to the local page path. |
| **Report capture is pixelated** | Display scaling mismatch on high-DPI screens | The script scales html2canvas exports to 2x resolution to ensure report images remain crisp. |
| **Date shows formatting errors** | Invalid local machine date settings | The browser date picker uses your system timezone. Check your OS configuration. |

---

## Frequently Asked Questions (FAQ)

### Is my financial data secure on FinTrack Pro?
**Yes.** All transaction logs, budget settings, and currency preferences are saved directly to your browser's sandbox using LocalStorage. The app makes no server connections, meaning your data never leaves your device.

### Can I run this offline?
**Yes.** You can clone this repository, turn off your internet connection, and double-click `LOGIN.html` to run the application offline. The only external dependency is the CDN library `html2canvas` for visual reporting, which is cached by the browser after your first visit.

### How do I back up my database?
Simply click **Export CSV Spreadsheet** at the bottom of the dashboard. This exports all transactions into a standard format readable by Excel or Google Sheets.

### How do I wipe all logged expenses?
You can clear your entries by clicking **Delete** on each row, or by clearing your browser's storage cache for the page.

### Can I import a CSV file back into the tracker?
The application is designed for local logging and reporting. Native CSV import support is on our roadmap, but currently, you can modify storage entries directly via developer tool consoles if you need to bulk import array data.

### Will the browser delete my storage data automatically?
Under ordinary circumstances, no. Browsers preserve LocalStorage data indefinitely. However, if your computer's system disk space runs low, some browsers may clear cached website storage keys. We recommend exporting a CSV backup regularly.

### Does the application support mobile operating systems?
**Yes.** FinTrack Pro is fully responsive and supports both Android and iOS devices. You can save the page as an app icon to your phone's home screen using standard browser configuration settings for full-screen web applications.

### Can I use multiple currency selectors at the same time?
No. The converter formats all metrics, allocations, and data columns based on a single selected active base currency. This ensures calculations remain uniform.

### How does editing an expense work?
When you click **Edit** on a row, the application retrieves the original values from the state array, inserts them back into the form fields, and deletes the row from the table. This allows you to edit details and re-submit the item to update records.

### How does the app determine the "Top Category"?
The rendering thread loops through your transaction list, aggregates amounts by category, and compares sums. The category with the highest sum is rendered as the "Top Category".

### How can I adjust column order?
The table structure uses standard CSS grid alignment mapping. You can edit the column tags in `tracker.html` if you want to rearrange their layout positions.

### Can I customize the categories?
Yes. To add or modify categories, edit the dropdown option tags inside `<select id="expense-category">` in `tracker.html` and update the category sums dictionary structure in `js/tracker.js`.

### What happens if I set a budget of zero?
If the budget is set to zero, any logged expense will exceed the budget limit. This triggers the red warning animation state on the "Remaining Budget" KPI card immediately.

### Why is the image capture report restricted to specific sections?
The canvas exporter conceals interactive forms, search filters, and action buttons to ensure the output looks like a professional financial statement rather than a screenshot of an interactive web page.

### How do I sync data between my phone and computer?
Since data is kept entirely local, you must export your ledger as a CSV file on one device and transfer the file. An encrypted peer-to-peer sync protocol is planned for a future release.

### Does the app support recurring expenses?
Not currently. You must log each expense item manually. Recurring schedule templates are planned for future versions.

### How many transactions can the local storage database hold?
The browser storage limit (5MB) can store approximately 30,000 to 50,000 individual transaction rows before reaching capacity. If you approach this limit, we recommend exporting old data to CSV and clearing the active cache.

---

## Licensing & Contribution Details

### License
This project is licensed under the **MIT License**. For more information, see the license terms below.

```
Copyright (c) 2025 Godfrey T R

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Contributions
Contributions to FinTrack Pro are welcome! Please follow these guidelines:
1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/NewFeature`
3. Commit your changes: `git commit -m "Add NewFeature"`
4. Push to the branch: `git push origin feature/NewFeature`
5. Open a Pull Request.
   
*Note: Make sure to format all files cleanly and externalize any styling or logic components.*
