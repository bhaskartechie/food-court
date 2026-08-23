"""
Notification service — email alerts for key order and delivery events.

Uses aiosmtplib (async SMTP) via FastAPI BackgroundTasks so email sends
never block the HTTP response. If SMTP credentials are not configured,
all functions are no-ops (safe for local dev without email).

Triggered from:
  order_service  → send_order_placed_email    (new order → seller)
  order_service  → send_order_status_email    (status change → buyer)
  delivery_service → send_delivery_dispatched_email  (dispatched → buyer)
  delivery_service → send_delivery_delivered_email   (delivered → buyer)
"""

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_email_configured() -> bool:
    """Return True only when SMTP credentials are present."""
    return bool(settings.SMTP_USERNAME and settings.SMTP_PASSWORD)


def _build_message(to_email: str, subject: str, body_html: str) -> MIMEMultipart:
    """Build a MIME email message."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.SENDER_NAME} <{settings.SENDER_EMAIL}>"
    msg["To"] = to_email
    msg.attach(MIMEText(body_html, "html"))
    return msg


async def _send(to_email: str, subject: str, body_html: str) -> None:
    """Send a single email via aiosmtplib. No-op if SMTP is not configured."""
    if not _is_email_configured():
        logger.debug("SMTP not configured — skipping email to %s: %s", to_email, subject)
        return

    msg = _build_message(to_email, subject, body_html)
    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_SERVER,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USERNAME,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info("Email sent → %s | %s", to_email, subject)
    except Exception as exc:
        # Never let email errors break the main flow
        logger.error("Failed to send email to %s: %s", to_email, exc)


# ── Order Notifications ───────────────────────────────────────────────────────

async def send_order_placed_email(
    seller_email: str,
    seller_name: str,
    order_id: int,
    buyer_name: str,
    items_summary: str,
    total_price: float,
) -> None:
    """Notify seller that a new order has been placed (called via BackgroundTask)."""
    subject = f"🍽️ New Order #{order_id} — Society Food"
    body = f"""
    <html><body style="font-family:Arial,sans-serif;color:#333;">
      <h2 style="color:#FF6B35;">New Order Received! 🎉</h2>
      <p>Hi <strong>{seller_name}</strong>,</p>
      <p>You have a new order from <strong>{buyer_name}</strong>.</p>
      <table style="border-collapse:collapse;width:100%;">
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Order #</strong></td>
            <td style="padding:8px;border:1px solid #ddd;">{order_id}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Items</strong></td>
            <td style="padding:8px;border:1px solid #ddd;">{items_summary}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Total</strong></td>
            <td style="padding:8px;border:1px solid #ddd;">₹{total_price:.2f}</td></tr>
      </table>
      <p>Please log in to accept or reject this order.</p>
      <p style="color:#888;font-size:12px;">— {settings.SENDER_NAME}</p>
    </body></html>
    """
    await _send(seller_email, subject, body)


async def send_order_status_email(
    buyer_email: str,
    buyer_name: str,
    order_id: int,
    new_status: str,
    seller_name: str,
    seller_flat: str | None = None,
) -> None:
    """Notify buyer when their order status changes (called via BackgroundTask)."""
    status_labels = {
        "accepted":  ("✅ Order Accepted", "Your order has been accepted and is being prepared."),
        "ready":     ("🍱 Food is Ready!", f"Your food is ready for pickup at Flat {seller_flat or 'the seller'}."),
        "completed": ("🎉 Order Completed", "Your order has been marked as completed. Enjoy your meal!"),
        "cancelled": ("❌ Order Cancelled", "Unfortunately your order has been cancelled by the seller."),
    }
    label, message = status_labels.get(
        new_status,
        (f"Order #{order_id} Update", f"Your order status changed to: {new_status}")
    )
    subject = f"{label} — Order #{order_id}"
    body = f"""
    <html><body style="font-family:Arial,sans-serif;color:#333;">
      <h2 style="color:#FF6B35;">{label}</h2>
      <p>Hi <strong>{buyer_name}</strong>,</p>
      <p>{message}</p>
      <p><strong>Order #:</strong> {order_id} &nbsp;|&nbsp; <strong>Seller:</strong> {seller_name}</p>
      <p style="color:#888;font-size:12px;">— {settings.SENDER_NAME}</p>
    </body></html>
    """
    await _send(buyer_email, subject, body)


# ── Delivery Notifications ────────────────────────────────────────────────────

async def send_delivery_dispatched_email(
    buyer_email: str,
    buyer_name: str,
    order_id: int,
    seller_name: str,
    estimated_minutes: int | None,
    notes: str | None,
) -> None:
    """Notify buyer that the seller has dispatched their delivery (called via BackgroundTask)."""
    eta_text = f"Estimated arrival: ~{estimated_minutes} minutes." if estimated_minutes else ""
    notes_text = f"<p><strong>Seller note:</strong> {notes}</p>" if notes else ""
    subject = f"🚶 Food on the Way! — Order #{order_id}"
    body = f"""
    <html><body style="font-family:Arial,sans-serif;color:#333;">
      <h2 style="color:#FF6B35;">Your Food is On the Way! 🚶</h2>
      <p>Hi <strong>{buyer_name}</strong>,</p>
      <p><strong>{seller_name}</strong> has picked up your food and is heading to your door.</p>
      <p>{eta_text}</p>
      {notes_text}
      <p><strong>Order #:</strong> {order_id}</p>
      <p style="color:#888;font-size:12px;">— {settings.SENDER_NAME}</p>
    </body></html>
    """
    await _send(buyer_email, subject, body)


async def send_delivery_delivered_email(
    buyer_email: str,
    buyer_name: str,
    order_id: int,
    seller_name: str,
) -> None:
    """Notify buyer that their food has been delivered (called via BackgroundTask)."""
    subject = f"🎉 Food Delivered! — Order #{order_id}"
    body = f"""
    <html><body style="font-family:Arial,sans-serif;color:#333;">
      <h2 style="color:#FF6B35;">Your Food Has Been Delivered! 🎉</h2>
      <p>Hi <strong>{buyer_name}</strong>,</p>
      <p>Your order from <strong>{seller_name}</strong> has been delivered to your door.</p>
      <p>Enjoy your meal! Don't forget to rate your experience.</p>
      <p><strong>Order #:</strong> {order_id}</p>
      <p style="color:#888;font-size:12px;">— {settings.SENDER_NAME}</p>
    </body></html>
    """
    await _send(buyer_email, subject, body)
