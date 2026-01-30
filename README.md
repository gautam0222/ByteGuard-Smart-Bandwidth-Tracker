# 🛡️ ByteGuard -- Smart Bandwidth Tracker

> Take full control of your internet usage.\
> Monitor. Analyze. Optimize. Protect.

------------------------------------------------------------------------

## 🚀 Overview

**ByteGuard** is a powerful browser extension that helps you track,
manage, and optimize your bandwidth usage in real-time.

Whether you're on limited mobile data, using a hotspot, or simply want
better visibility into your browsing habits --- ByteGuard gives you full
control.

Built with modern Chrome Extension APIs (Manifest V3), ByteGuard is
lightweight, fast, privacy-first, and completely open-source.

------------------------------------------------------------------------

## ✨ Features

### 📊 Real-Time Usage Tracking

-   Track bandwidth per tab and per domain
-   Monitor daily and monthly usage
-   View live updates directly in the popup

### 🎯 Smart Budget Management

-   Set daily and monthly data limits
-   Get alerts at 80%, 90%, and 100%
-   Prevent unexpected overages

### 🛡️ Low-Data Mode

-   Instantly block images and media
-   Save up to 70--90% bandwidth
-   Auto-enable when nearing budget limits

### 📈 Advanced Analytics Dashboard

-   Daily usage trend charts
-   Top data-consuming websites
-   Budget progress visualization
-   Hourly usage patterns
-   Smart insights & recommendations

### 🚫 Domain Blocking

-   Block specific data-heavy sites
-   Override content-heavy domains
-   Manage blocked domains easily

### 🌐 Network Tools

-   Live connection status display
-   Download speed testing
-   Ping measurement
-   Network performance overview

### 💾 Export & Backup

-   Export full backup (JSON)
-   Export usage data (CSV)
-   Generate weekly HTML summary reports
-   Import backups anytime

### 🎨 Modern UI

-   Clean gradient design
-   Light/Dark mode
-   Smooth animations
-   Responsive layout

------------------------------------------------------------------------

## 🔐 Privacy First

ByteGuard does **NOT**: - Collect personal data - Send data to external
servers - Track browsing history externally - Store anything outside
your device

All data remains locally stored using `chrome.storage.local`.

------------------------------------------------------------------------

## 🧠 How It Works

ByteGuard uses:

-   `chrome.webRequest` API to monitor completed requests
-   `chrome.declarativeNetRequest` for content blocking
-   `chrome.storage.local` for persistent data
-   `chrome.notifications` for alerts
-   `chrome.alarms` for daily resets

Bandwidth is calculated from `Content-Length` headers of network
responses.

------------------------------------------------------------------------

## 🛠️ Installation

### Load Unpacked (Developer Mode)

1.  Clone the repository:

    ``` bash
    git clone https://github.com/gautam0222/ByteGuard-Smart-Bandwidth-Tracker.git
    ```

2.  Open your browser:

    -   Go to `edge://extensions/` or `chrome://extensions/`
    -   Enable **Developer Mode**
    -   Click **Load Unpacked**
    -   Select the `src` folder

Done 🎉

------------------------------------------------------------------------

## ⚙️ Project Structure

    src/
    │
    ├── background/
    │   ├── service-worker.js
    │   ├── data-tracker.js
    │   ├── lowDataManager.js
    │
    ├── popup/
    │   ├── popup.html
    │   ├── popup.css
    │   ├── popup.js
    │
    ├── charts/
    │   ├── charts.html
    │   ├── charts.js
    │   ├── charts.css
    │
    ├── options/
    │   ├── options.html
    │   ├── options.js
    │   ├── options.css
    │
    ├── utils/
    │   ├── storage.js
    │   ├── helpers.js
    │   ├── exportImportManager.js
    │
    └── manifest.json

------------------------------------------------------------------------

## 🧩 Architecture

ByteGuard follows modular ES Module architecture:

-   Service Worker handles background logic
-   UI layers separated (Popup / Charts / Options)
-   Shared utilities in `/utils`
-   Clean separation of concerns
-   Fully Manifest V3 compliant

------------------------------------------------------------------------

## 📦 Tech Stack

-   JavaScript (ES Modules)
-   Chrome Extension Manifest V3
-   Chart.js
-   CSS3 (modern UI)
-   Browser APIs

------------------------------------------------------------------------

## 📈 Future Roadmap

-   Cloud sync support
-   AI-based usage recommendations
-   Per-category bandwidth tracking
-   Mobile browser support
-   Store publishing (Chrome Web Store / Edge Add-ons)

------------------------------------------------------------------------

## 🤝 Contributing

Contributions are welcome!

1.  Fork the repo
2.  Create a new branch
3.  Commit your changes
4.  Open a Pull Request

------------------------------------------------------------------------

## ⭐ Support

If you like this project:

-   Star the repository ⭐
-   Share it with others
-   Provide feedback
-   Contribute improvements

------------------------------------------------------------------------

## 📄 License

MIT License

------------------------------------------------------------------------

## 👨‍💻 Author

**Gautam Sukhani**\
GitHub: https://github.com/gautam0222

------------------------------------------------------------------------

## 💡 Why ByteGuard?

In a world where data is money, visibility is power.

ByteGuard gives you:

✔ Control\
✔ Transparency\
✔ Optimization\
✔ Protection

------------------------------------------------------------------------

> Built with passion for performance and privacy.