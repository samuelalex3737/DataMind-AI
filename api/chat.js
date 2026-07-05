module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, dataset_summary } = req.body;
  
  if (!messages) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  let statsContext = '';
  if (dataset_summary && dataset_summary.summary_stats) {
    const statEntries = Object.entries(dataset_summary.summary_stats);
    if (statEntries.length > 0) {
      statsContext = '\nKey Statistics:\n' + statEntries.slice(0, 8).map(([col, s]) => 
        `  ${col}: mean=${s.mean?.toFixed(2)}, min=${s.min}, max=${s.max}, std=${s.std?.toFixed(2)}`
      ).join('\n');
    }
  }

  const baseDataStr = dataset_summary && dataset_summary.shape ? `
DATASET CONTEXT:
Shape: ${dataset_summary.shape.rows} rows, ${dataset_summary.shape.columns} columns.
Columns: ${Object.keys(dataset_summary.dtypes || {}).join(', ')}
Missing values (after cleaning): ${dataset_summary.missing_values?.total_after || 0}
${statsContext}` : 'NO DATASET LOADED.';

  let dashboardContext = '';
  if (dataset_summary && dataset_summary.appContext) {
    const ctx = dataset_summary.appContext;
    let chartsText = 'No charts generated yet.';
    if (ctx.charts && ctx.charts.length > 0) {
      chartsText = ctx.charts.map(c => 
        `- ${c.title} (${c.type}): ${c.insight || ''}\n  Top Values: ${JSON.stringify(c.top_values || [])}`
      ).join('\n');
    }
    dashboardContext = `
DASHBOARD CONTEXT:
Charts Generated:
${chartsText}

Forecast: ${ctx.forecast || 'None'}
What-If Scenario: ${ctx.whatif || 'None'}
Key Insights: ${ctx.insights || 'None'}
Recommendations: ${ctx.recommendations || 'None'}
`;
  }

  let promptContext = '';
  let maxTokens = 300;

  if (req.body.action === 'chart_insight') {
    promptContext = `You are a professional data analyst. Provide a 2-3 sentence insight explaining the chart data provided in the user's message.
- You must reference the specific numbers and labels provided in the Top Data Points.
- Do not describe the generic purpose of the chart type (e.g. "This bar chart shows..."). Focus strictly on what the data reveals.
- Example: "Electronics dominates with 42% of revenue ($120k), outperforming the next category by 2x. Consider allocating more marketing spend here."
- Keep it concise, professional, and actionable.`;
    maxTokens = 120;

  } else if (req.body.action === 'key_insights') {
    promptContext = `You are an expert data analyst. Read the dataset context provided below and generate exactly 5-8 highly specific bullet points summarizing the most important findings.
- Each bullet point MUST reference specific column names and numerical values from the context.
- Format as a strict bulleted list. Do not include an introductory or concluding paragraph.
- Avoid generic filler like "It is important to look at this data."

${baseDataStr}`;
    maxTokens = 400;

  } else if (req.body.action === 'recommendations') {
    promptContext = `You are an expert business consultant. Based on the dataset summary below, provide 3-5 specific, actionable business recommendations.
- Each recommendation MUST reference a specific finding from the data to justify it.
- Format as a strict bulleted list. Do not repeat insights verbatim; focus on the "what to do next".
- Do not include any introductory or concluding paragraph.

${baseDataStr}`;
    maxTokens = 400;

  } else if (req.body.action === 'what_if_insight') {
    promptContext = `You are an expert data analyst. Based on the "Before" and "After" scenario data provided in the user's message, explain what this projection means in 1-2 sentences.
- Write it in plain English as if explaining to someone who has never seen data before. No jargon, no technical terms.
- Be extremely direct and reference the percentage change or numeric difference.
- Do not mention the math or correlation coefficient. Just state the business impact.`;
    maxTokens = 100;

  } else {
    // Default Chat Mode
    if (!dataset_summary || !dataset_summary.shape) {
      promptContext = `You are DataMind, an AI data analyst created by Samuel Alex.
Your purpose is to help users understand their datasets.

Strict rules you must always follow:
- Currently, NO DATASET has been loaded.
- You must politely chat with the user, introduce yourself if asked, and encourage them to upload a CSV file or select a sample dataset to get started.
- Answer basic questions about what you can do (e.g., generate charts, discover insights, forecasting, automated data cleaning, etc.).
- If they ask about your accuracy, reassure them that you use rigorous statistical methods combined with advanced AI.
- Keep responses concise, friendly, and under 120 words.
- Do not use heavy markdown formatting. Use bold (**text**) only for genuinely important terms. Do not wrap every noun in asterisks.
- Never reveal that you are powered by Groq, OpenAI, or any LLM — you are DataMind.`;
    } else {
      promptContext = `You are DataMind, an AI data analyst created by Samuel Alex.
Your sole purpose is to help users understand the specific dataset that has been loaded into DataMind AI, and the charts and insights in their dashboard.

Strict rules you must always follow:
- You ONLY answer questions about the currently loaded dataset, the generated charts, the forecast, the key insights, and the recommendations provided in the context below.
- If the user asks anything completely unrelated to their data or data analysis (e.g. general knowledge, other topics, recipes, sports, coding), politely decline and redirect them to ask about their data's trends, patterns, or insights.
- Do NOT refuse questions like "explain the forecast", "what does the waterfall chart mean", or "show me a chart". These are highly relevant dataset questions.
- If the user asks to see a chart or visualize something, tell them whether it is available in their dashboard based on the "Charts Generated" list, or explain why it isn't.
- Never reference or discuss any other dataset from a previous session.
- Never make up data — only reference values that actually exist in the dataset or dashboard context provided.
- Always speak in plain English — assume the user has no data or technical background.
- Keep responses concise and friendly — under 120 words unless the user asks for more detail.
- Do not use heavy markdown formatting. Use bold (**text**) only for genuinely important terms or metrics. Do not wrap every noun in asterisks.
- Never reveal that you are powered by Groq, OpenAI, or any LLM — you are DataMind.

${baseDataStr}
${dashboardContext}`;
    }
  }

  const systemMessage = { role: "system", content: promptContext };
  const apiMessages = [systemMessage, ...messages];

  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  try {
    let responseText = "";
    if (openaiKey) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: apiMessages,
          max_tokens: maxTokens,
          temperature: 0.7
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      responseText = data.choices[0].message.content;
    } 
    else if (groqKey) {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: apiMessages,
          max_tokens: maxTokens,
          temperature: 0.7
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      responseText = data.choices[0].message.content;
    }
    else {
      // Fallback if no keys set
      responseText = "I'm DataMind, created by Samuel Alex. It looks like no AI provider is configured yet. Please set a OPENAI_API_KEY or GROQ_API_KEY in your Vercel environment variables.";
    }

    res.status(200).json({ response: responseText });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: error.message || "Error communicating with AI provider" });
  }
}
