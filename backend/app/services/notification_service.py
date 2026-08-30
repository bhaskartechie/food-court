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
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_email_configured() -> bool:
    """Return True only when SMTP credentials are present."""
    return bool(settings.SMTP_USERNAME and settings.SMTP_PASSWORD)


def _build_message(to_email: str, subject: str, body_html: str, body_text: str | None = None) -> MIMEMultipart:
    """Build a standard multipart/alternative MIME email with plain text and HTML."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = f"{settings.SENDER_NAME} <{settings.SENDER_EMAIL}>"
    msg["To"] = to_email

    # Plain text version (essential for spam filter passability)
    if not body_text:
        # Fallback text representation
        import re
        body_text = re.sub(r"<[^>]+>", " ", body_html).strip()

    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    msg.attach(MIMEText(body_html, "html", "utf-8"))
    return msg


async def _send(to_email: str, subject: str, body_html: str, body_text: str | None = None) -> None:
    """Send a single email via aiosmtplib. No-op if SMTP is not configured."""
    if not _is_email_configured():
        logger.debug("SMTP not configured — skipping email to %s: %s", to_email, subject)
        return

    # Sanitize SMTP password in case spaces were included
    smtp_password = settings.SMTP_PASSWORD.replace(" ", "") if settings.SMTP_PASSWORD else ""

    msg = _build_message(to_email, subject, body_html, body_text)
    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_SERVER,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USERNAME,
            password=smtp_password,
            sender=settings.SENDER_EMAIL,
            recipients=[to_email],
            start_tls=True,
        )
        logger.info("Email sent → %s | %s", to_email, subject)
    except Exception as exc:
        # Never let email errors break the main flow
        logger.error("Failed to send email to %s: %s", to_email, exc)


# ── OTP Authentication Notifications ──────────────────────────────────────────

async def send_otp_email(to_email: str, otp: str) -> None:
    """Send a 6-digit login OTP to a resident or chef (called via BackgroundTask)."""
    subject = f"🔐 {otp} is your Society Food verification code"
    body_text = f"Your Society Food verification code is: {otp}\n\nThis code is valid for {settings.OTP_EXPIRY_MINUTES} minutes.\nDo not share this code with anyone.\n\n— {settings.SENDER_NAME}"
    body_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9f9fb; margin: 0; padding: 24px; color: #1e1e24;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #eaeaea; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <!-- Header -->
        <div style="background-color: #FF6B35; padding: 28px 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Society Food</h1>
          <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Fresh Homemade Food in Your Community</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 32px 28px;">
          <h2 style="margin: 0 0 12px; font-size: 18px; color: #1e1e24;">Your Verification Code</h2>
          <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.5; color: #555566;">
            Use the following one-time password (OTP) to securely log in to your Society Food account.
          </p>
          
          <!-- OTP Box -->
          <div style="background: #FFF4EF; border: 2px dashed #FF6B35; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #E05A2B; display: inline-block;">
              {otp}
            </span>
          </div>

          <p style="margin: 20px 0 0; font-size: 13px; color: #888899; text-align: center;">
            ⏱️ This code is valid for <strong>{settings.OTP_EXPIRY_MINUTES} minutes</strong>. Do not share this code with anyone.
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #fafafc; padding: 18px 24px; border-top: 1px solid #eeeeee; text-align: center; font-size: 12px; color: #9999aa;">
          <p style="margin: 0;">If you did not request this code, you can safely ignore this email.</p>
          <p style="margin: 6px 0 0;">© {settings.SENDER_NAME}</p>
        </div>
      </div>
    </body>
    </html>
    """
    await _send(to_email, subject, body_html, body_text)



async def send_otp_whatsapp(phone: str, otp: str) -> None:
    """
    Deliver OTP via WhatsApp (called via BackgroundTask).
    Logs the dispatch; ready for Twilio/Meta WhatsApp Cloud API integration.
    """
    if not settings.ENABLE_OTP_WHATSAPP:
        logger.info("WhatsApp delivery disabled in config. Skipping WhatsApp OTP to %s", phone)
        return

    logger.info("WhatsApp OTP dispatched → %s (OTP: %s)", phone, otp)



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
