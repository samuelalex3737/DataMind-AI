"""
DataMind AI — Simulated Dataset Generators
Produces two realistic, slightly messy 500-row datasets for demo purposes.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta


def generate_retail_dataset() -> pd.DataFrame:
    """Generate a 500-row Retail Sales dataset with realistic, slightly messy data."""
    np.random.seed(42)
    n = 500

    # Date range: 2 years of sales
    start_date = datetime(2023, 1, 1)
    dates = [start_date + timedelta(days=np.random.randint(0, 730)) for _ in range(n)]

    products = [
        "Laptop", "Wireless Mouse", "Keyboard", "Monitor", "USB Cable",
        "Headphones", "Webcam", "Desk Lamp", "Phone Case", "Charger",
        "Tablet", "Smartwatch", "Speaker", "Power Bank", "Router"
    ]

    categories_map = {
        "Laptop": "Electronics", "Wireless Mouse": "Accessories",
        "Keyboard": "Accessories", "Monitor": "Electronics",
        "USB Cable": "Accessories", "Headphones": "Audio",
        "Webcam": "Electronics", "Desk Lamp": "Office",
        "Phone Case": "Accessories", "Charger": "Accessories",
        "Tablet": "Electronics", "Smartwatch": "Wearables",
        "Speaker": "Audio", "Power Bank": "Accessories",
        "Router": "Electronics"
    }

    regions = ["North", "South", "East", "West", "Central"]
    genders = ["Male", "Female", "Other"]

    product_choices = np.random.choice(products, n)
    categories = [categories_map[p] for p in product_choices]
    region_choices = np.random.choice(regions, n)
    units = np.random.randint(1, 50, n)

    # Realistic price ranges per product
    price_map = {
        "Laptop": (600, 1500), "Wireless Mouse": (15, 60),
        "Keyboard": (25, 150), "Monitor": (200, 800),
        "USB Cable": (5, 20), "Headphones": (30, 300),
        "Webcam": (40, 150), "Desk Lamp": (20, 80),
        "Phone Case": (8, 40), "Charger": (10, 50),
        "Tablet": (200, 900), "Smartwatch": (100, 500),
        "Speaker": (50, 250), "Power Bank": (15, 70),
        "Router": (30, 200)
    }

    unit_prices = [round(np.random.uniform(*price_map[p]), 2) for p in product_choices]
    revenue = [round(u * p, 2) for u, p in zip(units, unit_prices)]

    customer_ids = [f"CUST-{np.random.randint(1000, 2000)}" for _ in range(n)]
    customer_ages = np.random.randint(18, 72, n).astype(float)
    customer_genders = np.random.choice(genders, n)
    return_flags = np.random.choice([0, 1], n, p=[0.88, 0.12])

    df = pd.DataFrame({
        "Date": dates,
        "Product": product_choices,
        "Category": categories,
        "Region": region_choices,
        "Units_Sold": units,
        "Unit_Price": unit_prices,
        "Revenue": revenue,
        "Customer_ID": customer_ids,
        "Customer_Age": customer_ages,
        "Customer_Gender": customer_genders,
        "Return_Flag": return_flags
    })

    # --- Inject messiness ---

    # 1. Nulls (~5%)
    null_indices_age = np.random.choice(n, size=20, replace=False)
    df.loc[null_indices_age, "Customer_Age"] = np.nan

    null_indices_price = np.random.choice(n, size=10, replace=False)
    df.loc[null_indices_price, "Unit_Price"] = np.nan

    null_indices_region = np.random.choice(n, size=8, replace=False)
    df.loc[null_indices_region, "Region"] = np.nan

    null_indices_gender = np.random.choice(n, size=7, replace=False)
    df.loc[null_indices_gender, "Customer_Gender"] = np.nan

    null_indices_date = np.random.choice(n, size=5, replace=False)
    df.loc[null_indices_date, "Date"] = pd.NaT

    # 2. Duplicates (~2%)
    dup_indices = np.random.choice(n, size=12, replace=False)
    duplicates = df.iloc[dup_indices].copy()
    df = pd.concat([df, duplicates], ignore_index=True)

    # 3. Inconsistent capitalisation
    messy_indices = np.random.choice(len(df), size=40, replace=False)
    case_funcs = [str.upper, str.lower, str.swapcase]
    for idx in messy_indices:
        func = np.random.choice(case_funcs)
        if pd.notna(df.at[idx, "Product"]):
            df.at[idx, "Product"] = func(df.at[idx, "Product"])
        if pd.notna(df.at[idx, "Region"]):
            df.at[idx, "Region"] = func(df.at[idx, "Region"])
        if pd.notna(df.at[idx, "Category"]):
            df.at[idx, "Category"] = func(df.at[idx, "Category"])

    # Shuffle rows
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)

    return df


def generate_ecommerce_dataset() -> pd.DataFrame:
    """Generate a 500-row E-Commerce Orders dataset with realistic, slightly messy data."""
    np.random.seed(99)
    n = 500

    start_date = datetime(2023, 1, 1)
    order_dates = [start_date + timedelta(days=np.random.randint(0, 730)) for _ in range(n)]
    ship_dates = [od + timedelta(days=np.random.randint(1, 10)) for od in order_dates]

    segments = ["Consumer", "Corporate", "Home Office"]
    countries = ["United States", "United Kingdom", "Canada", "Germany", "Australia"]

    cities_map = {
        "United States": ["New York", "Los Angeles", "Chicago", "Houston", "Seattle", "Miami"],
        "United Kingdom": ["London", "Manchester", "Birmingham", "Leeds"],
        "Canada": ["Toronto", "Vancouver", "Montreal", "Ottawa"],
        "Germany": ["Berlin", "Munich", "Hamburg", "Frankfurt"],
        "Australia": ["Sydney", "Melbourne", "Brisbane", "Perth"]
    }

    categories_structure = {
        "Technology": {
            "sub_categories": ["Phones", "Laptops", "Accessories", "Tablets"],
            "products": {
                "Phones": ["iPhone 15", "Galaxy S24", "Pixel 8", "OnePlus 12"],
                "Laptops": ["MacBook Pro", "Dell XPS 15", "ThinkPad X1", "HP Spectre"],
                "Accessories": ["AirPods Pro", "Magic Mouse", "USB-C Hub", "Laptop Stand"],
                "Tablets": ["iPad Air", "Galaxy Tab S9", "Surface Pro", "Kindle Fire"]
            },
            "price_range": (50, 2000)
        },
        "Furniture": {
            "sub_categories": ["Chairs", "Tables", "Bookcases", "Storage"],
            "products": {
                "Chairs": ["Ergonomic Office Chair", "Gaming Chair", "Mesh Task Chair", "Executive Chair"],
                "Tables": ["Standing Desk", "Conference Table", "Corner Desk", "Folding Table"],
                "Bookcases": ["5-Shelf Bookcase", "Floating Shelves", "Glass Bookcase", "Cube Organizer"],
                "Storage": ["Filing Cabinet", "Storage Ottoman", "Drawer Unit", "Wardrobe"]
            },
            "price_range": (30, 1200)
        },
        "Office Supplies": {
            "sub_categories": ["Paper", "Binders", "Art Supplies", "Envelopes"],
            "products": {
                "Paper": ["Copy Paper A4", "Cardstock", "Photo Paper", "Sticky Notes"],
                "Binders": ["3-Ring Binder", "Report Cover", "Presentation Folder", "Clip Board"],
                "Art Supplies": ["Marker Set", "Sketch Pad", "Colored Pencils", "Paint Set"],
                "Envelopes": ["Manila Envelope", "Padded Mailer", "Window Envelope", "Bubble Wrap Roll"]
            },
            "price_range": (2, 80)
        }
    }

    rows = []
    for i in range(n):
        order_id = f"ORD-{10000 + i}"
        segment = np.random.choice(segments)
        country = np.random.choice(countries)
        city = np.random.choice(cities_map[country])
        category = np.random.choice(list(categories_structure.keys()))
        cat_info = categories_structure[category]
        sub_cat = np.random.choice(cat_info["sub_categories"])
        product_name = np.random.choice(cat_info["products"][sub_cat])

        low, high = cat_info["price_range"]
        quantity = np.random.randint(1, 12)
        unit_sale = round(np.random.uniform(low, high), 2)
        sales = round(unit_sale * quantity, 2)
        discount = round(np.random.choice([0, 0, 0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3]), 2)
        profit = round(sales * np.random.uniform(-0.15, 0.45) * (1 - discount), 2)
        shipping_cost = round(np.random.uniform(3, 50), 2)

        cust_id = f"CID-{np.random.randint(100, 500)}"

        rows.append({
            "Order_ID": order_id,
            "Order_Date": order_dates[i],
            "Ship_Date": ship_dates[i],
            "Customer_ID": cust_id,
            "Segment": segment,
            "Country": country,
            "City": city,
            "Category": category,
            "Sub_Category": sub_cat,
            "Product_Name": product_name,
            "Sales": sales,
            "Quantity": quantity,
            "Discount": discount,
            "Profit": profit,
            "Shipping_Cost": shipping_cost
        })

    df = pd.DataFrame(rows)

    # --- Inject messiness ---

    # 1. Nulls (~5%)
    null_sales = np.random.choice(n, size=15, replace=False)
    df.loc[null_sales, "Sales"] = np.nan

    null_profit = np.random.choice(n, size=12, replace=False)
    df.loc[null_profit, "Profit"] = np.nan

    null_ship = np.random.choice(n, size=10, replace=False)
    df.loc[null_ship, "Ship_Date"] = pd.NaT

    null_segment = np.random.choice(n, size=8, replace=False)
    df.loc[null_segment, "Segment"] = np.nan

    null_city = np.random.choice(n, size=7, replace=False)
    df.loc[null_city, "City"] = np.nan

    null_discount = np.random.choice(n, size=6, replace=False)
    df.loc[null_discount, "Discount"] = np.nan

    # 2. Duplicates
    dup_indices = np.random.choice(n, size=10, replace=False)
    duplicates = df.iloc[dup_indices].copy()
    df = pd.concat([df, duplicates], ignore_index=True)

    # 3. Inconsistent capitalisation
    messy_indices = np.random.choice(len(df), size=35, replace=False)
    case_funcs = [str.upper, str.lower, str.swapcase]
    for idx in messy_indices:
        func = np.random.choice(case_funcs)
        if pd.notna(df.at[idx, "Segment"]):
            df.at[idx, "Segment"] = func(df.at[idx, "Segment"])
        if pd.notna(df.at[idx, "Category"]):
            df.at[idx, "Category"] = func(df.at[idx, "Category"])
        if pd.notna(df.at[idx, "City"]):
            df.at[idx, "City"] = func(df.at[idx, "City"])
        if pd.notna(df.at[idx, "Country"]):
            df.at[idx, "Country"] = func(df.at[idx, "Country"])

    # Shuffle
    df = df.sample(frac=1, random_state=99).reset_index(drop=True)

    return df
