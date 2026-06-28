# 🛒 DruvCart — Full-Stack E-Commerce Platform

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-HTML5%20%7C%20Tailwind%20CSS%20%7C%20JS%20(ES6+)-blue?style=for-the-badge" alt="Frontend Tech">
  <img src="https://img.shields.io/badge/Backend-Node.js%20%7C%20Express.js-green?style=for-the-badge" alt="Backend Tech">
  <img src="https://img.shields.io/badge/Storage-Local%20Storage-orange?style=for-the-badge" alt="Storage Tech">
</p>

---

**DruvCart** is a sleek, responsive, and fully interactive full-stack e-commerce web application. It seamlessly bridges a dynamic user interface built with **Tailwind CSS** and a highly lightweight, efficient **Node.js + Express** backend. Experience a complete, modern shopping journey outfitted with local storage persistence, automated live order tracking, and a built-in virtual assistant.

---

## 🌟 Key Features

* 🔐 **User Authentication** — Secure, intuitive Login and Sign-Up flows tailored to personalize individual user sessions.
* 🛍️ **Dynamic Product Catalog** — Effortlessly browse, discover, and organize products using multi-tier category filters and instant live sorting.
* 💾 **Persistent Shopping Cart** — Fully reliable client-side cart management leveraging `localStorage` so items remain intact across page reloads.
* 💳 **Multi-Step Guided Checkout** — A streamlined, high-conversion pipeline handling **Shipping** $\rightarrow$ **Payment** $\rightarrow$ **Review** dynamically.
* ⏱️ **Real-Time Order Tracking** — Check shipping updates instantly with a client-side polling mechanism updating progress automatically every 60 seconds.
* ❌ **Instant Order Cancellation** — Retain full control over your shopping data with swift, immediate cancellation capabilities built directly into the profile workspace.
* 🤖 **Smart Chatbot Assistant** — Interactive support agent designed to resolve immediate inquiries regarding product availability and general catalog assistance.

---

## 🛠️ Tech Stack

| Layer | Technologies Implemented |
| :--- | :--- |
| 🎨 **Frontend** | HTML5 • CSS3 • Tailwind CSS • JavaScript (ES6+) |
| ⚙️ **Backend** | Node.js • Express.js Framework |
| 💾 **Data Management** | Client-Side Browser `localStorage` |

---

## 🗂️ Project Structure

The codebase adheres to a clean, decoupled directory design making debugging and extending features exceptionally straightforward:

```text
DruvCart-Website/
├── index.html       # Primary frontend layout and landing view
├── server.js        # Node.js backend runner utilizing Express routing
├── css/
│   └── styles.css   # Main stylesheet bundle managing Tailwind configurations
├── js/
│   ├── script.js    # Core application controller handling frontend event logic
│   └── data.js      # Central mock database containing catalog items
└── package.json     # Node Package Manager manifests & script configuration files

## ⚙️ Getting Started
Follow this simple guide to deploy and operate an environment setup locally on your machine.

📋 Prerequisites
Ensure you have the following installed ahead of time:

Node.js — v14.0.0 or higher

npm — Bundled automatically alongside your Node setup.

🚀 Installation & Local Execution
Clone the Project Core Files:

Bash
git clone [https://github.com/RithishPK/DruvCart-Website.git](https://github.com/RithishPK/DruvCart-Website.git)
cd DruvCart-Website
Acquire Node Module Packages:

Bash
npm install
Initialize the Backend Runtime Environment:

Bash
node server.js
Launch Application in Sandbox:
Fire up any modern web browser and navigate directly to:

👉 http://localhost:3000

👤 Author
Rithish PK — @RithishPK
