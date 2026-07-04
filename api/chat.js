module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, dataset_summary } = req.body;
  
  if (!messages) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  // If no dataset is loaded, return a fixed response without calling any AI provider
  if (!dataset_summary || !dataset_summary.shape) {
    return res.status(200).json({
      response: "Hello! I'm DataMind, created by Samuel Alex. Please upload a CSV or select a sample dataset and I'll be ready to help you understand your data!"
    });
  }

  // Build summary stats string for context
  let statsContext = '';
  if (dataset_summary.summary_stats) {
    const statEntries = Object.entries(dataset_summary.summary_stats);
    if (statEntries.length > 0) {
      statsContext = '\nKey Statistics:\n' + statEntries.slice(0, 8).map(([col, s]) => 
        `  ${col}: mean=${s.mean?.toFixed(2)}, min=${s.min}, max=${s.max}, std=${s.std?.toFixed(2)}`
      ).join('\n');
    }
  }

  let promptContext = `You are DataMind, an AI data analyst created by Samuel Alex.
Your sole purpose is to help users understand the specific dataset that has been loaded into DataMind AI.

Strict rules you must always follow:
- You ONLY answer questions about the currently loaded dataset provided in the context below
- If the user asks anything unrelated to their dataset (general knowledge, other topics, coding, etc.), respond with: "I'm DataMind — I'm only able to help you understand your current dataset. Try asking me about your data's trends, patterns, or insights!"
- Never reference or discuss any other dataset from a previous session
- Never make up data — only reference values that actually exist in the dataset context provided
- Always speak in plain English — assume the user has no data or technical background
- Keep responses concise and friendly — under 120 words unless the user asks for more detail
- Never reveal that you are powered by Groq, OpenAI, or any LLM — you are DataMind
- When asked about date ranges, use the actual min/max dates from the dataset
- When asked about best-performing categories or products, calculate from the actual numbers provided

DATASET CONTEXT:
Shape: ${dataset_summary.shape.rows} rows, ${dataset_summary.shape.columns} columns.
Columns: ${Object.keys(dataset_summary.dtypes || {}).join(', ')}
Column Types: ${Object.entries(dataset_summary.dtypes || {}).map(([k,v]) => `${k}(${v})`).join(', ')}
Missing values (before cleaning): ${dataset_summary.missing_values?.total_before || 0}
Missing values (after cleaning): ${dataset_summary.missing_values?.total_after || 0}
Duplicates removed: ${dataset_summary.duplicates?.removed || 0}
Rows after cleaning: ${dataset_summary.duplicates?.rows_after || dataset_summary.shape?.rows}${statsContext}`;

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
          max_tokens: 300,
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
          max_tokens: 300,
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
