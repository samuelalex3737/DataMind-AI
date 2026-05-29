# 🧠 DataMind AI — Intelligent Data Analyst

An AI-powered data analysis dashboard that automatically performs EDA, generates 20+ chart types, provides AI-driven insights, forecasting, and an interactive chat analyst.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Set Your Groq API Key
**Windows (PowerShell):**
```powershell
$env:GROQ_API_KEY = "your_groq_api_key_here"
```

**Windows (CMD):**
```cmd
set GROQ_API_KEY=your_groq_api_key_here
```

**Mac/Linux:**
```bash
export GROQ_API_KEY="your_groq_api_key_here"
```

### 3. Run the Application
```bash
python app.py
```

### 4. Open in Browser
Navigate to: **http://localhost:5000**

## 📊 Features

- **CSV Upload** — Drag-and-drop any CSV file
- **Simulated Datasets** — Pre-built Retail Sales and E-Commerce datasets
- **Automated EDA** — Missing values, duplicates, outliers, correlations
- **20+ Chart Types** — Line, bar, pie, heatmap, waterfall, radar, BCG, RFM, and more
- **AI Chat Analyst** — Ask questions about your data in natural language
- **Forecasting** — Time series forecasting with confidence intervals
- **Key Insights** — AI-generated actionable business insights
- **What-If Analysis** — Scenario simulation with adjustable parameters

## 🛠️ Tech Stack

- **Backend**: Python, Flask
- **Frontend**: HTML, CSS, JavaScript (single-page app)
- **AI**: Groq API (LLaMA 3.3 70B)
- **Charts**: Matplotlib, Seaborn
- **ML**: scikit-learn (KMeans), mlxtend (Apriori)
- **Forecasting**: statsmodels (Exponential Smoothing)

## 📁 Project Structure

```
├── app.py              # Flask backend
├── datasets.py         # Simulated dataset generators
├── eda.py              # EDA pipeline
├── charts.py           # Chart orchestrator
├── charts_core.py      # Core chart functions (12 types)
├── charts_advanced.py  # Advanced chart functions (11 types)
├── ai_analyst.py       # Groq API integration
├── templates/
│   └── index.html      # Frontend SPA
├── requirements.txt    # Dependencies
└── README.md           # This file
```
