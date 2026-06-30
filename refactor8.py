import re

with open('static/app.js', 'r', encoding='utf-8') as f:
    data = f.read()

gen_old = r"""async function generateDataset\(type\) \{[\s\S]*?\}"""
gen_new = """async function generateDataset(type) {
  showSpinner('Loading sample dataset...');
  try {
    const response = await fetch('static/sample.csv');
    const text = await response.text();
    const file = new File([text], 'ecommerce_sample.csv', { type: 'text/csv' });
    await uploadFile(file);
  } catch (e) {
    showToast('Failed to load sample dataset', 'error');
    hideSpinner();
  }
}"""

data = re.sub(gen_old, gen_new, data)

with open('static/app.js', 'w', encoding='utf-8') as f:
    f.write(data)
print("Updated generateDataset to use static sample.csv!")
