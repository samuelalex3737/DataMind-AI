
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

- **CSV Upload** — Drag-and-drop any CSV file with instant preview before analysis begins
- **Sample Datasets** — Pre-built Retail Sales (512 rows, 11 columns) and E-Commerce Orders (556 rows, 15 columns)
- **Automated EDA** — Missing value imputation, duplicate removal, outlier detection via IQR, text normalisation, and an overall Data Quality Score
- **Intelligent Chart Selection** — 20+ Plotly.js chart types generated only when meaningful for the dataset including bar, line, pie, heatmap, waterfall, radar, BCG matrix, RFM segmentation, Apriori market basket, cohort retention, sunburst, treemap, and more
- **AI Chart Insights** — 1-2 sentence AI-generated insight under every chart explaining what it means in plain English
- **AI Chat Analyst** — Domain-locked conversational analyst with full awareness of your charts, forecast, insights, and recommendations
- **Key Insights** — 5-8 AI-generated actionable findings specific to your dataset with real data values referenced
- **Business Recommendations** — 3-5 specific, data-backed recommendations presented as styled cards
- **Forecasting** — Time series trend projection with confidence interval shading and AI commentary
- **What-If Scenario Analysis** — Adjust numeric variables with a slider and see projected impact calculated from real dataset correlations
- **Smart Date Filter** — Filter all charts by date ranges constrained to your dataset's actual min and max dates only
- **Dark / Light Mode** — Theme toggle with localStorage persistence across page reloads
- **Export** — Download your cleaned dataset as CSV, Excel (.xlsx), or a full JSON analysis report
- **Start Over** — Reset the entire session cleanly without a page refresh
- **Security** — Rate limiting on AI endpoint, input sanitisation, prompt injection defence, XSS protection, and CSV upload validation

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Data Engine | PapaParse (CSV parsing), client-side EDA pipeline |
| Charts | Plotly.js (20+ interactive chart types) |
| Machine Learning | Custom JS K-Means clustering (RFM), Custom JS Apriori algorithm (Market Basket) |
| AI Provider | Groq API (LLaMA 3.3 70B) / OpenAI GPT — dual provider with automatic switching |
| Backend | Vercel Serverless Functions (AI proxy only) |
| Deployment | Vercel |

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/samuelalex3737/DataMind-AI
cd DataMind-AI
```

### 2. Set your API key in Vercel
In your Vercel dashboard go to **Settings → Environment Variables** and add one of the following:

```
GROQ_API_KEY = your_groq_api_key_here
```
or
```
OPENAI_API_KEY = your_openai_api_key_here
```

The app automatically detects which key is set and switches providers accordingly.

### 3. Deploy to Vercel
```bash
vercel deploy
```
Or connect your GitHub repository directly to Vercel for automatic deployments on every push to main.

### 4. Run locally
```bash
vercel dev
```
Navigate to **http://localhost:3000**

---

## 📁 Project Structure

```
├── api/
│   └── chat.js              # Serverless AI proxy with rate limiting and sanitisation
├── static/
│   ├── app.js               # Main application logic and UI orchestration
│   ├── data_engine.js       # Client-side EDA pipeline
│   ├── charts_engine.js     # 20+ Plotly.js chart generators with relevance selection
│   └── style.css            # Full styling including dark and light themes
├── public/
│   └── index.html           # Single-page application entry point
├── assets/                  # Screenshots used in this README
└── vercel.json              # Vercel deployment configuration
```

---

## 🔒 Security

- **Rate Limiting** — Maximum 20 requests per IP per 10 minutes on the AI endpoint
- **Input Sanitisation** — All chat messages are HTML-stripped and length-capped at 500 characters before reaching the AI
- **Prompt Injection Defence** — Common injection phrases are detected and blocked server-side
- **XSS Protection** — All user content is sanitised before DOM insertion
- **CSV Validation** — File size capped at 50MB, rows capped at 100,000, columns capped at 100, structure validated before analysis begins

---

## 👤 Author

**Samuel Alex** — [LinkedIn](https://linkedin.com/in/samuel-alex-47496a289) · [GitHub](https://github.com/samuelalex3737)

