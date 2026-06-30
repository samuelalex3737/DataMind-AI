export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, dataset_summary } = req.body;
  
  if (!messages) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  let promptContext = "";
  if (dataset_summary) {
    promptContext = `
You are DataMind, a highly intelligent, conversational AI Data Analyst.
You are helping the user analyze their uploaded dataset.
Keep your responses UNDER 100 WORDS. Be concise and insightful.
DO NOT list raw data, just give the insights.
DATASET SUMMARY:
Shape: ${dataset_summary.shape.rows} rows, ${dataset_summary.shape.columns} cols.
Missing values: ${dataset_summary.missing_values.total_before}
Duplicates: ${dataset_summary.duplicates.found}
Columns: ${Object.keys(dataset_summary.dtypes).join(', ')}`;
  } else {
    promptContext = "You are DataMind, a highly intelligent AI Data Analyst. (No dataset uploaded yet).";
  }

  const systemMessage = { role: "system", content: promptContext };
  const apiMessages = [systemMessage, ...messages];

  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  try {
    let responseText = "";
    if (groqKey) {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3-70b-8192",
          messages: apiMessages,
          max_tokens: 300,
          temperature: 0.7
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      responseText = data.choices[0].message.content;
    } 
    else if (openaiKey) {
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
    else {
      // Fallback if no keys set
      responseText = "This is a safe fallback response since no GROQ_API_KEY or OPENAI_API_KEY is configured in Vercel.";
    }

    res.status(200).json({ response: responseText });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: error.message || "Error communicating with AI provider" });
  }
}
