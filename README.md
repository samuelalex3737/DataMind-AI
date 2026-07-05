# 🧠 DataMind AI — Intelligent Data Analyst

> AI-powered data analysis platform — upload any CSV and get instant EDA,
> 20+ interactive charts, AI-generated insights, forecasting, and a 
> natural language chat analyst. No coding required.

🚀 **Live Demo:** https://data-mind-ai-seven.vercel.app

![Homepage](assets/1.png)
![Dashboard](assets/2.png)
![Charts](assets/3.png)
![EDA Report](assets/4.png)
![AI Chat](assets/5.png)

---

## ✨ Features

- **CSV Upload** — Drag-and-drop any CSV file with instant preview before analysis
- **Sample Datasets** — Pre-built Retail Sales (512 rows, 11 cols) and E-Commerce Orders (556 rows, 15 cols)
- **Automated EDA** — Missing value imputation, duplicate removal, outlier detection via IQR, text normalisation, and Data Quality Score
- **Intelligent Chart Selection** — 20+ Plotly.js chart types generated only when relevant to the dataset (bar, line, pie, heatmap, waterfall, radar, BCG matrix, RFM, Apriori, cohort retention, sunburst, treemap, and more)
- **AI Chart Insights** — 1-2 sentence AI-generated insight under every chart explaining what it means in plain English
- **AI Chat Analyst** — Domain-locked conversational analyst with full awareness of your charts, forecast, and insights
- **Key Insights** — 5-8 AI-generated actionable findings specific to your dataset
- **Business Recommendations** — 3-5 specific, data-backed recommendations
- **Forecasting** — JS trend projection with confidence interval shading
- **What-If Scenario Analysis** — Adjust variables with a slider and see projected impact using real dataset correlations
- **Smart Date Filter** — Filter charts by date ranges constrained to your dataset's actual dates
- **Dark/Light Mode** — Theme toggle with localStorage persistence
- **Export** — Download cleaned dataset as CSV, Excel, or JSON report
- **Security** — Rate limiting, input sanitisation, prompt injection defence, XSS protection, CSV validation

---

## 🛠️ Tech Stack

- **Frontend:** HTML, CSS, Vanilla JavaScript (single-page app)
- **Data Engine:** Danfo.js / PapaParse (client-side EDA pipeline)
- **Charts:** Plotly.js (20+ interactive chart types)
- **ML:** Custom JS K-Means (RFM), Custom JS Apriori (Market Basket)
- **AI:** Groq API (LLaMA 3.3 70B) / OpenAI GPT — dual provider support
- **Backend:** Vercel Serverless Functions (AI proxy only)
- **Deployment:** Vercel

---

## 🚀 Quick Start

### 1. Clone the repo
```bash
git clone https://github.com/samuelalex3737/DataMind-AI
cd DataMind-AI
```

### 2. Set your API key in Vercel
In your Vercel dashboard under **Settings → Environment Variables**, add:
```
GROQ_API_KEY = your_groq_api_key_here
```
or
```
OPENAI_API_KEY = your_openai_api_key_here
```
The app automatically switches between providers based on which key is set.

### 3. Deploy
```bash
vercel deploy
```
Or connect the GitHub repo directly to Vercel for automatic deployments on every push.

### 4. Run locally
```bash
vercel dev
```
Navigate to **http://localhost:3000**

---

## 📁 Project Structure

```
├── api/
│   └── chat.js              # Serverless AI proxy (rate limited, sanitised)
├── static/
│   ├── app.js               # Main application logic
│   ├── data_engine.js       # Client-side EDA pipeline
│   ├── charts_engine.js     # 20+ Plotly.js chart generators
│   └── style.css            # Full styling + dark/light themes
├── public/
│   └── index.html           # Single-page application
├── assets/                  # Screenshots for README
└── vercel.json              # Vercel deployment config
```

---

## 👤 Author

**Samuel Alex** — [LinkedIn](https://linkedin.com/in/samuel-alex-47496a289) · [GitHub](https://github.com/samuelalex3737)
```
