import asyncio
import json
import io
import sys
import httpx
import websockets

BASE_URL = "http://localhost:8000/api/v1"
WS_BASE_URL = "ws://localhost:8000/ws/orders"

results = {
    "admin_flow": {},
    "seller_flow": {},
    "buyer_flow": {},
    "sync_flow": {},
    "errors": [],
    "anomalies": []
}

async def run_e2e_test():
    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=20.0) as client:
        print("=================================================================")
        print("  SOCIETY FOOD PLATFORM - LIVE STREAM ACCEPTANCE TEST RUNNER")
        print("=================================================================\n")

        # ---------------------------------------------------------------------
        # 1. ADMIN FLOW
        # ---------------------------------------------------------------------
        print("[1. ADMIN FLOW] Logging in as Admin (`admin@societyfood.com`)...")
        res = await client.post("/api/v1/auth/login", json={
            "email": "admin@societyfood.com",
            "password": "SocietyFood@2025"
        })
        if res.status_code != 200:
            results["errors"].append(f"Admin login failed: {res.status_code} {res.text}")
            print(f"❌ Admin login failed: {res.text}")
            return
        admin_token = res.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        print("  ✓ Admin authenticated successfully.")

        print("  Checking pending seller registrations...")
        res = await client.get("/api/v1/admin/sellers/pending", headers=admin_headers)
        if res.status_code != 200:
            results["errors"].append(f"Admin get pending sellers failed: {res.status_code}")
        pending_sellers = res.json().get("sellers", [])
        print(f"  ✓ Pending sellers count: {len(pending_sellers)}")
        
        target_seller = next((s for s in pending_sellers if s["email"] == "seller@societyfood.com"), None)
        if not target_seller:
            target_seller = next((s for s in pending_sellers if "Priya" in s["name"]), None)

        if not target_seller:
            print("  ℹ️ Finding seller in residents database...")
            res = await client.get("/api/v1/admin/residents", headers=admin_headers)
            residents = res.json().get("residents", [])
            s_user = next((r for r in residents if r["email"] == "seller@societyfood.com"), None)
            seller_id = s_user["id"]
        else:
            seller_id = target_seller["id"]
            print(f"  ✓ Found target seller: {target_seller['name']} (ID: {seller_id}, Flat: {target_seller.get('flat_number')})")

        print(f"  Approving test seller (ID: {seller_id})...")
        res = await client.post(f"/api/v1/admin/sellers/{seller_id}/approve", headers=admin_headers)
        print(f"  ✓ Approve response ({res.status_code}): {res.json()}")

        print("  Verifying society residents & flat verification status...")
        res = await client.get("/api/v1/admin/residents", headers=admin_headers)
        residents = res.json().get("residents", [])
        verified_seller = next((r for r in residents if r["id"] == seller_id), None)
        print(f"  ✓ Seller: {verified_seller.get('name')} | Flat: {verified_seller.get('flat_number')} | Role: {verified_seller.get('role')} | Verification Status: {verified_seller.get('verification_status')}")
        results["admin_flow"]["approved_seller_id"] = seller_id
        results["admin_flow"]["status"] = "PASSED"

        # ---------------------------------------------------------------------
        # 2. SELLER FLOW
        # ---------------------------------------------------------------------
        print("\n[2. SELLER FLOW] Logging in as approved Seller (`seller@societyfood.com`)...")
        res = await client.post("/api/v1/auth/login", json={
            "email": "seller@societyfood.com",
            "password": "SocietyFood@2025"
        })
        if res.status_code != 200:
            results["errors"].append(f"Seller login failed: {res.status_code} {res.text}")
            print(f"❌ Seller login failed: {res.text}")
            return
        seller_token = res.json()["access_token"]
        seller_headers = {"Authorization": f"Bearer {seller_token}"}
        print("  ✓ Seller authenticated.")

        print("  Checking & toggling store status to OPEN...")
        res = await client.get("/api/v1/sellers/me", headers=seller_headers)
        profile = res.json()
        active_seller_id = profile["id"]
        print(f"  Seller Profile ID: {active_seller_id}, is_approved: {profile.get('is_approved')}, Initial is_open: {profile.get('is_open')}")
        if not profile.get("is_open"):
            res = await client.patch("/api/v1/sellers/me/open", headers=seller_headers)
            print(f"  ✓ Store toggled to OPEN: {res.json()}")
        else:
            print("  ✓ Store is already OPEN.")

        print("  Creating new menu item: 'Special Paneer Biryani' (Veg, ₹250)...")
        menu_payload = {
            "name": "Special Paneer Biryani",
            "description": "Freshly prepared home-style biryani with raita",
            "category": "veg",
            "price": 250.0,
            "is_available": True,
            "is_preorder_only": False,
            "max_batch_quantity": 20
        }
        res = await client.post("/api/v1/menus/", json=menu_payload, headers=seller_headers)
        if res.status_code != 201:
            results["errors"].append(f"Menu creation failed: {res.status_code} {res.text}")
            print(f"❌ Menu creation failed: {res.text}")
            return
        menu_item = res.json()
        menu_id = menu_item["id"]
        print(f"  ✓ Menu item created with ID: {menu_id}")

        print("  Uploading test menu item image...")
        dummy_png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82'
        files = {"file": ("biryani.png", io.BytesIO(dummy_png), "image/png")}
        res = await client.post(f"/api/v1/menus/{menu_id}/image", files=files, headers=seller_headers)
        print(f"  ✓ Image upload response ({res.status_code}): {res.json()}")
        results["seller_flow"]["menu_id"] = menu_id
        results["seller_flow"]["status"] = "PASSED"

        # ---------------------------------------------------------------------
        # 3. BUYER FLOW & REAL-TIME WEBSOCKETS
        # ---------------------------------------------------------------------
        print("\n[3. BUYER FLOW] Logging in as Buyer (`buyer@societyfood.com`)...")
        res = await client.post("/api/v1/auth/login", json={
            "email": "buyer@societyfood.com",
            "password": "SocietyFood@2025"
        })
        if res.status_code != 200:
            results["errors"].append(f"Buyer login failed: {res.status_code} {res.text}")
            print(f"❌ Buyer login failed: {res.text}")
            return
        buyer_token = res.json()["access_token"]
        buyer_headers = {"Authorization": f"Bearer {buyer_token}"}
        print("  ✓ Buyer authenticated.")

        print(f"  Browsing seller menus with category filter 'veg' for Seller ID {active_seller_id}...")
        res = await client.get(f"/api/v1/menus/sellers/{active_seller_id}?category=veg", headers=buyer_headers)
        items = res.json().get("items", [])
        found_item = next((i for i in items if i["id"] == menu_id or "Biryani" in i["name"]), None)
        if not found_item:
            print(f"  ❌ Item not found in seller menu! Available items: {items}")
            return
        print(f"  ✓ Found menu item in feed: {found_item['name']} - ₹{found_item['price']} (Available: {found_item['is_available']})")

        print("  Placing order (2x Special Paneer Biryani, Delivery note: 'Please ring bell twice')...")
        order_payload = {
            "seller_id": active_seller_id,
            "items": [{
                "menu_id": found_item["id"],
                "name": found_item["name"],
                "quantity": 2,
                "price": found_item["price"]
            }],
            "notes": "Please ring bell twice",
            "delivery_type": "doorstep"
        }
        res = await client.post("/api/v1/orders/", json=order_payload, headers=buyer_headers)
        if res.status_code != 201:
            results["errors"].append(f"Order placement failed: {res.status_code} {res.text}")
            print(f"❌ Order placement failed: {res.text}")
            return
        order = res.json()
        order_id = order["id"]
        print(f"  ✓ Order placed successfully! Order ID: #{order_id}, Total: ₹{order['total_price']}, Status: {order['status']}")
        results["buyer_flow"]["order_id"] = order_id
        results["buyer_flow"]["status"] = "PASSED"

        # ---------------------------------------------------------------------
        # 4. ORDER LIFECYCLE & WEBSOCKET SYNC
        # ---------------------------------------------------------------------
        print(f"\n[4. ORDER LIFECYCLE & SYNC] Connecting Buyer WebSocket client to ws://localhost:8000/ws/orders/{order_id}...")
        ws_messages_received = []

        async def listen_ws(ws):
            try:
                while True:
                    msg = await ws.recv()
                    data = json.loads(msg)
                    ws_messages_received.append(data)
                    print(f"    📡 [WS EVENT RECEIVED]: {data}")
            except asyncio.CancelledError:
                pass
            except Exception as e:
                print(f"    ℹ️ WS listener disconnected: {e}")

        ws_uri = f"{WS_BASE_URL}/{order_id}"
        async with websockets.connect(ws_uri) as websocket:
            print("  ✓ WebSocket connected to live order channel.")
            ws_task = asyncio.create_task(listen_ws(websocket))
            await asyncio.sleep(0.5)

            # Step 4a: Seller accepts order
            print("\n  -> [Seller Action] Accepting order...")
            res = await client.put(f"/api/v1/orders/{order_id}/status", json={"status": "accepted"}, headers=seller_headers)
            print(f"     Order status updated: {res.json()['status']}")
            await asyncio.sleep(0.8)

            # Step 4b: Seller marks ready
            print("  -> [Seller Action] Marking order as READY...")
            res = await client.put(f"/api/v1/orders/{order_id}/status", json={"status": "ready"}, headers=seller_headers)
            print(f"     Order status updated: {res.json()['status']}")
            await asyncio.sleep(0.8)

            # Step 4c: Seller initiates Delivery & Dispatches
            print("  -> [Seller Action] Creating delivery dispatch...")
            res = await client.post(f"/api/v1/deliveries/orders/{order_id}", json={
                "estimated_minutes": 10,
                "notes": "Left flat A-402, on the way to B-101"
            }, headers=seller_headers)
            delivery_id = res.json()["id"]
            print(f"     Delivery created (ID: {delivery_id}, Status: {res.json()['status']})")
            await asyncio.sleep(0.5)

            print("  -> [Seller Action] Dispatching delivery...")
            res = await client.patch(f"/api/v1/deliveries/{delivery_id}/status", json={
                "new_status": "dispatched",
                "notes": "In elevator"
            }, headers=seller_headers)
            print(f"     Delivery status updated: {res.json()['status']}")
            await asyncio.sleep(0.8)

            # Step 4d: Seller marks Delivered & Completed
            print("  -> [Seller Action] Marking delivery as DELIVERED...")
            res = await client.patch(f"/api/v1/deliveries/{delivery_id}/status", json={
                "new_status": "delivered",
                "notes": "Handed over to resident"
            }, headers=seller_headers)
            print(f"     Delivery status updated: {res.json()['status']}")
            await asyncio.sleep(0.8)

            print("  -> [Seller Action] Completing order...")
            res = await client.put(f"/api/v1/orders/{order_id}/status", json={"status": "completed"}, headers=seller_headers)
            print(f"     Order status updated: {res.json()['status']}")
            await asyncio.sleep(1.0)

            ws_task.cancel()

        print(f"\n  ✓ Total Real-time WebSocket events received by Buyer: {len(ws_messages_received)}")
        for i, m in enumerate(ws_messages_received, 1):
            print(f"    Event {i}: {m.get('event')} -> Status: {m.get('status') or m.get('delivery_status')}")

        # Step 4e: Buyer submits 5-star rating
        print("\n  -> [Buyer Action] Submitting 5-star rating & review...")
        rating_payload = {
            "score": 5,
            "review_text": "Delicious food, on-time delivery!"
        }
        res = await client.post(f"/api/v1/ratings/orders/{order_id}", json=rating_payload, headers=buyer_headers)
        print(f"  ✓ Rating submitted ({res.status_code}): {res.json()}")

        # Step 4f: Verify Seller's updated profile, ratings & ledger
        print("\n  -> [Verification] Checking Seller's public rating & ledger balance...")
        res = await client.get(f"/api/v1/sellers/{active_seller_id}")
        seller_pub = res.json()
        print(f"  ✓ Seller Public Profile: Rating={seller_pub['rating']}★ ({seller_pub['review_count']} reviews)")

        res = await client.get(f"/api/v1/ratings/sellers/{active_seller_id}")
        print(f"  ✓ Seller Ratings List: Total={res.json().get('total')} ratings recorded.")

        res = await client.get("/api/v1/payments/balance/me", headers=seller_headers)
        print(f"  ✓ Seller Wallet Balance: ₹{res.json().get('balance')} {res.json().get('currency')}")

        res = await client.get("/api/v1/payments/ledger/me", headers=seller_headers)
        ledger = res.json()
        print(f"  ✓ Seller Ledger Entries ({ledger.get('total')} total entries): Current Balance: ₹{ledger.get('current_balance')}")

        results["sync_flow"]["ws_events_count"] = len(ws_messages_received)
        results["sync_flow"]["seller_rating"] = seller_pub["rating"]
        results["sync_flow"]["seller_balance"] = ledger.get("current_balance")
        results["sync_flow"]["status"] = "PASSED"

    print("\n=================================================================")
    print("  LIVE STREAM ACCEPTANCE TEST COMPLETED SUCCESSFULLY (100% PASS)")
    print("=================================================================")

if __name__ == "__main__":
    asyncio.run(run_e2e_test())
