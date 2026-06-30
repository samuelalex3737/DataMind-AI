import random
import csv
from datetime import datetime, timedelta

def gen_retail():
    with open('static/retail.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['Date', 'TransactionID', 'StoreID', 'CustomerID', 'Category', 'Item', 'Price', 'Quantity', 'TotalRevenue', 'PaymentMethod', 'Status'])
        
        start_date = datetime(2023, 1, 1)
        categories = {'Electronics': ['TV', 'Laptop', 'Phone', 'Tablet'], 'Home': ['Desk', 'Chair', 'Lamp', 'Sofa'], 'Apparel': ['Shirt', 'Pants', 'Jacket', 'Shoes']}
        payments = ['Credit Card', 'Cash', 'Digital Wallet', 'Debit Card']
        status = ['Completed', 'Completed', 'Completed', 'Refunded']
        
        for i in range(1, 550):
            d = start_date + timedelta(days=random.randint(0, 365))
            cat = random.choice(list(categories.keys()))
            item = random.choice(categories[cat])
            price = round(random.uniform(20.0, 1500.0), 2)
            qty = random.randint(1, 5)
            writer.writerow([
                d.strftime('%Y-%m-%d'), f'TRX-{10000+i}', f'STORE-{random.randint(1,5)}', f'CUST-{random.randint(100,999)}',
                cat, item, price, qty, round(price*qty, 2), random.choice(payments), random.choice(status)
            ])

def gen_ecommerce():
    with open('static/ecommerce.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['OrderDate', 'OrderID', 'CustomerID', 'DeviceType', 'Browser', 'TrafficSource', 'Category', 'Product', 'UnitPrice', 'Quantity', 'Discount', 'ShippingCost', 'TotalAmount', 'DeliveryStatus', 'Region'])
        
        start_date = datetime(2023, 1, 1)
        categories = {'Electronics': ['Smartwatch', 'Headphones', 'Speaker'], 'Accessories': ['Mouse', 'Keyboard', 'Webcam'], 'Apparel': ['T-Shirt', 'Hoodie', 'Jeans']}
        devices = ['Desktop', 'Mobile', 'Tablet']
        browsers = ['Chrome', 'Safari', 'Firefox', 'Edge']
        traffic = ['Organic', 'Direct', 'Paid Social', 'Affiliate']
        regions = ['North America', 'Europe', 'Asia', 'South America']
        status = ['Delivered', 'Delivered', 'Shipped', 'Cancelled']
        
        for i in range(1, 550):
            d = start_date + timedelta(days=random.randint(0, 365))
            cat = random.choice(list(categories.keys()))
            item = random.choice(categories[cat])
            price = round(random.uniform(10.0, 500.0), 2)
            qty = random.randint(1, 3)
            discount = round(random.uniform(0.0, 0.2), 2)
            ship = round(random.uniform(5.0, 25.0), 2)
            tot = round((price * qty * (1 - discount)) + ship, 2)
            
            writer.writerow([
                d.strftime('%Y-%m-%d'), f'ORD-{20000+i}', f'USR-{random.randint(1000,9999)}',
                random.choice(devices), random.choice(browsers), random.choice(traffic),
                cat, item, price, qty, discount, ship, tot, random.choice(status), random.choice(regions)
            ])

gen_retail()
gen_ecommerce()
print("Generated 550-row datasets for retail and ecommerce!")
