#!/usr/bin/env python3

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid

async def create_test_order():
    """Create a test order directly in MongoDB for Stripe checkout testing"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.oryno_webapp
    
    # Get customer user ID
    customer = await db.users.find_one({"email": "customer@test.com"})
    if not customer:
        print("❌ Customer user not found")
        return None
    
    customer_user_id = customer.get("_id")
    print(f"✅ Customer user ID: {customer_user_id}")
    
    # Create test order
    import time
    timestamp = str(int(time.time()))
    test_order_id = f"TEST-STRIPE-{timestamp}"
    
    order = {
        "_id": test_order_id,
        "user_id": customer_user_id,
        "total_amount": 30000.0,
        "currency": "XAF",
        "payment_status": "pending",
        "service_name": "Test Booking",
        "service_category": "hotel",
        "status": "pending",
        "items": [
            {
                "name": "Test Hotel Room",
                "quantity": 1,
                "price": 30000.0
            }
        ],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Insert order
    await db.orders.insert_one(order)
    print(f"✅ Test order created with ID: {test_order_id}")
    
    client.close()
    return test_order_id

if __name__ == "__main__":
    order_id = asyncio.run(create_test_order())
    print(f"Order ID: {order_id}")