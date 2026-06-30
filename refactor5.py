import re

with open('static/app.js', 'r', encoding='utf-8') as f:
    data = f.read()

# 1. Replace api/chat with /api/chat
data = data.replace('fetch(`api/chat`', 'fetch(`/api/chat`')

# 2. Replace generateDataset
gen_old = r"""async function generateDataset\(type\) \{[\s\S]*?\} catch \(e\) \{[\s\S]*?\}
\}"""
gen_new = """async function generateDataset(type) {
  showToast('Sample dataset generation is not available in the Vercel lightweight version. Please upload your own CSV.', 'info');
}"""
data = re.sub(gen_old, gen_new, data)

with open('static/app.js', 'w', encoding='utf-8') as f:
    f.write(data)
print("Fixed API paths and sample generation!")
