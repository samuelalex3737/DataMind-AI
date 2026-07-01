import random
import csv
from datetime import datetime, timedelta

random.seed(42)

def gen_ecommerce_baskets():
    n = 600
    start_date = datetime(2023, 1, 1)
    
    segments = ["Consumer", "Corporate", "Home Office"]
    countries = ["United States", "United Kingdom", "Canada"]
    cities_map = {
        "United States": ["New York", "Los Angeles"],
        "United Kingdom": ["London", "Manchester"],
        "Canada": ["Toronto", "Vancouver"]
    }
    
    # We define specific profiles to guarantee Apriori co-occurrences
    # Profile 1: The WFH Setup (Laptop + Monitor + Mouse) -> strong association
    # Profile 2: The Gamer (Gaming Chair + Keyboard + Headset) -> strong association
    # Profile 3: The Office (Paper + Pens + Binders) -> strong association
    
    profiles = [
        {"name": "WFH", "items": [
            ("Technology", "Laptops", "Dell XPS 15", 1500),
            ("Technology", "Accessories", "27in 4K Monitor", 300),
            ("Technology", "Accessories", "Wireless Mouse", 50)
        ], "prob": 0.25},
        
        {"name": "Gamer", "items": [
            ("Furniture", "Chairs", "Gaming Chair", 250),
            ("Technology", "Accessories", "Mechanical Keyboard", 120),
            ("Technology", "Accessories", "Gaming Headset", 90)
        ], "prob": 0.20},
        
        {"name": "Office", "items": [
            ("Office Supplies", "Paper", "Copy Paper A4", 15),
            ("Office Supplies", "Art Supplies", "Ballpoint Pens", 8),
            ("Office Supplies", "Binders", "3-Ring Binder", 12)
        ], "prob": 0.25},
        
        {"name": "Random1", "items": [("Technology", "Phones", "iPhone 15", 1000)], "prob": 0.15},
        {"name": "Random2", "items": [("Furniture", "Tables", "Standing Desk", 400)], "prob": 0.15}
    ]
    
    rows = []
    
    # Generate ~250 distinct customers/orders (each order is a basket)
    for i in range(250):
        order_date = start_date + timedelta(days=random.randint(0, 729))
        ship_date = order_date + timedelta(days=random.randint(1, 10))
        segment = random.choice(segments)
        country = random.choice(countries)
        city = random.choice(cities_map[country])
        
        # We'll use Customer_ID and Order_ID synonymously here for baskets
        cust_id = f"CID-{1000 + i}"
        order_id = f"ORD-{10000 + i}"
        
        # Pick a profile
        r = random.random()
        cumulative = 0
        chosen_profile = None
        for p in profiles:
            cumulative += p["prob"]
            if r <= cumulative:
                chosen_profile = p
                break
                
        # Generate the rows for this basket
        # Sometimes they don't buy the FULL profile, so we randomly drop 1 item occasionally, 
        # but keep it mostly intact to ensure high support/confidence.
        basket_items = chosen_profile["items"]
        for item in basket_items:
            # 90% chance to actually buy this item from the profile
            if random.random() < 0.90:
                cat, sub_cat, product, base_price = item
                quantity = random.randint(1, 3)
                sales = round(base_price * quantity, 2)
                discount = round(random.choice([0, 0, 0.1, 0.2]), 2)
                profit = round(sales * random.uniform(0.05, 0.3) * (1 - discount), 2)
                shipping_cost = round(random.uniform(5, 20), 2)
                
                rows.append([
                    order_id, order_date.strftime('%Y-%m-%d'), ship_date.strftime('%Y-%m-%d'),
                    cust_id, segment, country, city, cat, sub_cat, product,
                    sales, quantity, discount, profit, shipping_cost
                ])
                
    with open('static/ecommerce.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Order_ID', 'Order_Date', 'Ship_Date', 'Customer_ID', 'Segment', 'Country', 'City', 'Category', 'Sub_Category', 'Product_Name', 'Sales', 'Quantity', 'Discount', 'Profit', 'Shipping_Cost'])
        writer.writerows(rows)
    
    print(f"E-commerce regenerated: {len(rows)} rows, 15 columns. (Basket profiles injected)")

gen_ecommerce_baskets()
