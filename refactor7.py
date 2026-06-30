import re

with open('static/app.js', 'r', encoding='utf-8') as f:
    data = f.read()

wi_run_old = r"""  try \{
    const res = await fetch\(`\$\{API\}/api/whatif`, \{[\s\S]*?body: JSON\.stringify\(\{[\s\S]*?\}\)
    \}\);
    const data = await res\.json\(\);"""

wi_run_new = """  try {
    const data = { success: false, error: 'What-If analysis requires the advanced Python backend.' };"""

data = re.sub(wi_run_old, wi_run_new, data)

with open('static/app.js', 'w', encoding='utf-8') as f:
    f.write(data)
print("Removed whatif fetch!")
