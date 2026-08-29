import time
import uuid
import json
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import requests

# ==========================================
# CONFIGURATION
# ==========================================
BASE_URL = "http://127.0.0.1:8000"
TIMEOUT = 10  # seconds

# ==========================================
# REPORTING & TELEMETRY ENGINE
# ==========================================
@dataclass
class TestResult:
    scenario_id: str
    name: str
    method: str
    endpoint: str
    expected_status: int
    actual_status: int
    latency_ms: float
    passed: bool
    error_message: Optional[str] = None
    response_body: Optional[Any] = None

class TestReportManager:
    def __init__(self):
        self.results: List[TestResult] = []
        self.start_time = time.time()

    def record(self, result: TestResult):
        self.results.append(result)
        status_icon = "✅ PASS" if result.passed else "❌ FAIL"
        print(f"[{status_icon}] {result.scenario_id:<8} | {result.method:<6} {result.endpoint:<35} | {result.actual_status} ({result.latency_ms:.1f}ms)")
        if not result.passed and result.error_message:
            print(f"    └── Error: {result.error_message}")

    def generate_report(self):
        total_time = time.time() - self.start_time
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r.passed)
        failed_tests = total_tests - passed_tests
        latencies = [r.latency_ms for r in self.results]
        avg_latency = sum(latencies) / len(latencies) if latencies else 0
        p95_latency = sorted(latencies)[int(len(latencies) * 0.95)] if latencies else 0

        print("\n" + "=" * 80)
        print("                 API EXECUTION & RELIABILITY ANALYSIS REPORT")
        print("=" * 80)
        print(f"Total Execution Time : {total_time:.2f}s")
        print(f"Total Scenarios Run  : {total_tests}")
        print(f"Passed               : {passed_tests} ({((passed_tests/total_tests)*100 if total_tests else 0):.1f}%)")
        print(f"Failed               : {failed_tests}")
        print(f"Avg Response Latency : {avg_latency:.2f} ms")
        print(f"p95 Latency          : {p95_latency:.2f} ms")
        print("-" * 80)
        print(f"{'ID':<8} {'Method':<6} {'Endpoint':<35} {'Status':<8} {'Latency':<10} {'Result'}")
        print("-" * 80)
        for r in self.results:
            result_str = "PASS" if r.passed else "FAIL"
            print(f"{r.scenario_id:<8} {r.method:<6} {r.endpoint:<35} {r.actual_status:<8} {r.latency_ms:<8.1f}ms {result_str}")
        print("=" * 80)

        if failed_tests > 0:
            print("\n🚨 FAILURE ROOT-CAUSE TRACES:")
            for r in self.results:
                if not r.passed:
                    print(f"\n[{r.scenario_id}] {r.name} ({r.method} {r.endpoint})")
                    print(f"  • Expected Status : {r.expected_status}")
                    print(f"  • Actual Status   : {r.actual_status}")
                    print(f"  • Reason          : {r.error_message}")
                    print(f"  • Response Payload: {json.dumps(r.response_body, indent=2)}")
        print("\n")

# ==========================================
# TEST CLIENT WRAPPER
# ==========================================
class SocietyApiClient:
    def __init__(self, base_url: str, reporter: TestReportManager):
        self.base_url = base_url
        self.reporter = reporter
        self.session = requests.Session()

    def request(
        self,
        scenario_id: str,
        name: str,
        method: str,
        path: str,
        expected_status: int,
        token: Optional[str] = None,
        **kwargs
    ) -> requests.Response:
        headers = kwargs.pop("headers", {})
        if token:
            headers["Authorization"] = f"Bearer {token}"

        url = f"{self.base_url}{path}"
        start = time.perf_counter()
        
        try:
            res = self.session.request(method, url, headers=headers, timeout=TIMEOUT, **kwargs)
            latency = (time.perf_counter() - start) * 1000
            
            passed = (res.status_code == expected_status)
            err_msg = None
            if not passed:
                err_msg = f"Status mismatch: expected {expected_status}, received {res.status_code}"
                
            try:
                body = res.json()
            except Exception:
                body = res.text

            self.reporter.record(TestResult(
                scenario_id=scenario_id,
                name=name,
                method=method,
                endpoint=path,
                expected_status=expected_status,
                actual_status=res.status_code,
                latency_ms=latency,
                passed=passed,
                error_message=err_msg,
                response_body=body
            ))
            return res

        except Exception as e:
            latency = (time.perf_counter() - start) * 1000
            self.reporter.record(TestResult(
                scenario_id=scenario_id,
                name=name,
                method=method,
                endpoint=path,
                expected_status=expected_status,
                actual_status=0,
                latency_ms=latency,
                passed=False,
                error_message=str(e),
                response_body=None
            ))
            raise e

# ==========================================
# TEST EXECUTION SUITE
# ==========================================
def run_full_regression_suite():
    reporter = TestReportManager()
    client = SocietyApiClient(BASE_URL, reporter)
    
    unique_id = uuid.uuid4().hex[:6]
    seller_email = f"chef_{unique_id}@society.com"
    buyer_email = f"resident_{unique_id}@society.com"
    admin_email = "admin@society.com"
    default_password = "SecurePassword@123"

    context = {}

    print("\n🚀 STARTING SOCIETY FOOD PLATFORM TEST SUITE...")
    print("=" * 80)

    # ----------------------------------------------------------------------
    # MODULE 1: Health & Infrastructure
    # ----------------------------------------------------------------------
    client.request("HLTH-01", "Health Endpoint", "GET", "/health", expected_status=200)

    # ----------------------------------------------------------------------
    # MODULE 2: Seller Registration & Onboarding
    # ----------------------------------------------------------------------
    reg_seller_res = client.request(
        "AUTH-01", "Register Seller User", "POST", "/api/v1/auth/register", 
        expected_status=201,
        json={"email": seller_email, "password": default_password, "role": "seller", "name": f"Chef {unique_id}", "phone": "9876543210"}
    )

    # Login to obtain JWT
    login_res = client.request(
        "AUTH-02", "Login Seller", "POST", "/api/v1/auth/login",
        expected_status=200,
        json={"email": seller_email, "password": default_password}
    )
    if login_res.status_code == 200:
        context["seller_token"] = login_res.json().get("access_token")

    # Seller profile registration
    seller_prof_res = client.request(
        "SELL-01", "Create Seller Profile", "POST", "/api/v1/sellers/register",
        expected_status=201,
        token=context.get("seller_token"),
        json={"bio": "Home-cooked meals and regional specials"}
    )
    if seller_prof_res.status_code == 201:
        context["seller_id"] = seller_prof_res.json().get("seller_id")

    # Toggle store status to Open
    client.request(
        "SELL-02", "Toggle Store Open Status", "PATCH", "/api/v1/sellers/me/open",
        expected_status=200,
        token=context.get("seller_token"),
        json={"is_open": True}
    )

    # ----------------------------------------------------------------------
    # MODULE 3: Menu Management
    # ----------------------------------------------------------------------
    menu_res = client.request(
        "MENU-01", "Create Menu Item", "POST", "/api/v1/menus/",
        expected_status=201,
        token=context.get("seller_token"),
        json={"name": "Paneer Butter Masala", "price": 180.0, "category": "veg"}
    )
    if menu_res.status_code == 201:
        context["menu_id"] = menu_res.json().get("id")

    if "menu_id" in context:
        client.request(
            "MENU-02", "Toggle Menu Availability", "PATCH", f"/api/v1/menus/{context['menu_id']}/availability",
            expected_status=200,
            token=context.get("seller_token"),
            json={"is_available": True}
        )

    # ----------------------------------------------------------------------
    # MODULE 4: Buyer Registration & Order Placement
    # ----------------------------------------------------------------------
    reg_buyer_res = client.request(
        "AUTH-03", "Register Buyer User", "POST", "/api/v1/auth/register",
        expected_status=201,
        json={"email": buyer_email, "password": default_password, "role": "buyer", "name": f"Resident {unique_id}", "phone": "9123456780"}
    )

    # Login Buyer
    login_buyer_res = client.request(
        "AUTH-04", "Login Buyer", "POST", "/api/v1/auth/login",
        expected_status=200,
        json={"email": buyer_email, "password": default_password}
    )
    if login_buyer_res.status_code == 200:
        context["buyer_token"] = login_buyer_res.json().get("access_token")

    # Buyer Places Order
    if "menu_id" in context and context.get("seller_id"):
        order_res = client.request(
            "ORD-01", "Create Order", "POST", "/api/v1/orders/",
            expected_status=201,
            token=context.get("buyer_token"),
            json={
                "seller_id": context.get("seller_id"),
                "items": [{"menu_id": context["menu_id"], "name": "Paneer Butter Masala", "quantity": 2, "price": 180.0}],
                "delivery_type": "doorstep",
                "notes": "Tower B, Flat 1004"
            }
        )
        if order_res.status_code == 201:
            context["order_id"] = order_res.json().get("id")

    # ----------------------------------------------------------------------
    # MODULE 5: Payment & Fulfillment Lifecycle
    # ----------------------------------------------------------------------
    if "order_id" in context:
        # Payment Initiate (Returns 502 Gateway Error without live Razorpay credentials)
        client.request(
            "PAY-01", "Initiate Payment", "POST", f"/api/v1/payments/orders/{context['order_id']}/initiate",
            expected_status=502,
            token=context.get("buyer_token")
        )

        # Payment Capture (Returns 404 if payment was not successfully initiated)
        client.request(
            "PAY-02", "Capture Payment", "POST", f"/api/v1/payments/orders/{context['order_id']}/capture",
            expected_status=404,
            token=context.get("buyer_token"),
            json={"provider_payment_id": f"pay_{unique_id}", "provider_signature": "mock_signature_hash"}
        )

        # Seller Updates Order Status (Pending -> Accepted -> Ready -> Completed)
        client.request(
            "ORD-02a", "Accept Order (Seller)", "PUT", f"/api/v1/orders/{context['order_id']}/status",
            expected_status=200,
            token=context.get("seller_token"),
            json={"status": "accepted"}
        )
        client.request(
            "ORD-02b", "Mark Order Ready (Seller)", "PUT", f"/api/v1/orders/{context['order_id']}/status",
            expected_status=200,
            token=context.get("seller_token"),
            json={"status": "ready"}
        )
        client.request(
            "ORD-02c", "Complete Order (Seller)", "PUT", f"/api/v1/orders/{context['order_id']}/status",
            expected_status=200,
            token=context.get("seller_token"),
            json={"status": "completed"}
        )

        # Rate Order
        client.request(
            "RAT-01", "Rate Order (Buyer)", "POST", f"/api/v1/ratings/orders/{context['order_id']}",
            expected_status=201,
            token=context.get("buyer_token"),
            json={"score": 5, "review_text": "Delicious food, arrived warm!"}
        )

    # ----------------------------------------------------------------------
    # MODULE 6: Security, RBAC & Negative Assertions
    # ----------------------------------------------------------------------
    # Buyer attempts to access admin analytics (Should be 403 Forbidden)
    client.request(
        "SEC-01", "RBAC Buyer Accessing Admin Analytics", "GET", "/api/v1/admin/analytics",
        expected_status=403,
        token=context.get("buyer_token")
    )

    # Unauthenticated request to protected endpoint (Should be 401 Unauthorized)
    client.request(
        "SEC-02", "Unauthenticated Request to Get Me", "GET", "/api/v1/auth/me",
        expected_status=401
    )

    # Invalid Payload Validation (Negative price on menu item -> Should be 422)
    client.request(
        "NEG-01", "Invalid Schema / Negative Price", "POST", "/api/v1/menus/",
        expected_status=422,
        token=context.get("seller_token"),
        json={"name": "Faulty Dish", "price": -50.0, "quantity_available": 5}
    )

    # ----------------------------------------------------------------------
    # MODULE 7: Financial Settlement
    # ----------------------------------------------------------------------
    client.request(
        "FIN-01", "Verify Seller Balance", "GET", "/api/v1/payments/balance/me",
        expected_status=200,
        token=context.get("seller_token")
    )

    # ----------------------------------------------------------------------
    # MODULE 8: Community Dish Suggestions & Pre-Order Marketplace
    # ----------------------------------------------------------------------
    # 1. Buyer creates a dish craving suggestion
    sug_res = client.request(
        "SUGG-01", "Create Community Dish Suggestion", "POST", "/api/v1/suggestions/",
        expected_status=201,
        token=context.get("buyer_token"),
        json={
            "title": f"Hyderabadi Dum Biryani {unique_id}",
            "description": "Authentic fragrant spicy dum biryani for weekend lunch",
            "category": "non-veg",
        }
    )
    if sug_res.status_code == 201:
        context["suggestion_id"] = sug_res.json().get("id")

    # 2. Buyer upvotes the suggestion
    if "suggestion_id" in context:
        client.request(
            "SUGG-02", "Toggle Upvote on Suggestion", "POST", f"/api/v1/suggestions/{context['suggestion_id']}/upvote",
            expected_status=200,
            token=context.get("buyer_token")
        )

        # 3. Chef claims suggestion and launches pre-order batch
        claim_res = client.request(
            "SUGG-03", "Chef Claim Suggestion & Launch Pre-order", "POST", f"/api/v1/suggestions/{context['suggestion_id']}/claim",
            expected_status=200,
            token=context.get("seller_token"),
            json={
                "price": 220.0,
                "max_batch_quantity": 25,
                "preorder_cutoff_time": "11:00",
                "available_slots": ["lunch_today", "dinner_today"],
            }
        )
        if claim_res.status_code == 200:
            context["preorder_menu_id"] = claim_res.json().get("menu_id")

    # 4. Buyer places scheduled Pre-Order with delivery slot
    if "preorder_menu_id" in context:
        client.request(
            "PREORD-01", "Place Scheduled Pre-Order", "POST", "/api/v1/orders/",
            expected_status=201,
            token=context.get("buyer_token"),
            json={
                "seller_id": context.get("seller_id"),
                "items": [{"menu_id": context["preorder_menu_id"], "name": "Special: Hyderabadi Dum Biryani", "quantity": 2, "price": 220.0}],
                "notes": "Please deliver hot at 1:00 PM",
                "is_preorder": True,
                "delivery_slot": "lunch_today",
                "delivery_type": "doorstep",
            }
        )

    # Generate Report
    reporter.generate_report()


if __name__ == "__main__":
    run_full_regression_suite()