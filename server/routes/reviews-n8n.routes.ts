// N8N Reviews API Routes - For automated workflows
import { Router, Request, Response } from "express";
import { storage, getFrontendUrl } from "./middleware";
import { sendEmail } from "../gmail-email";

const router = Router();

// Helper: Validate N8N Master API Key
const validateN8NMasterKey = (req: Request): boolean => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const apiKey = authHeader.split(' ')[1];
  const N8N_MASTER_KEY = process.env.N8N_MASTER_API_KEY;
  return N8N_MASTER_KEY !== undefined && apiKey === N8N_MASTER_KEY;
};

// 1. POST /api/n8n/reviews/create-request - Create a review request from N8N
router.post("/create-request", async (req, res) => {
  try {
    if (!validateN8NMasterKey(req)) {
      return res.status(401).json({ success: false, error: "Invalid API key" });
    }

    const { 
      client_email, 
      customer_name, 
      customer_email, 
      customer_phone, 
      reservation_id, 
      reservation_date, 
      reservation_time, 
      send_method = 'email' 
    } = req.body;

    // Validate required fields
    if (!client_email) {
      return res.status(400).json({ success: false, error: "client_email is required" });
    }
    if (!customer_name && !customer_email && !customer_phone) {
      return res.status(400).json({ success: false, error: "At least customer_name, customer_email or customer_phone is required" });
    }

    // Find user by email
    const user = await storage.getUserByEmail(client_email);
    if (!user) {
      return res.status(404).json({ success: false, error: "Client not found" });
    }

    // Check if review system is enabled
    const config = await storage.getReviewConfig(user.id);
    if (!config || !config.enabled) {
      return res.json({
        success: true,
        created: false,
        reason: "reviews_disabled"
      });
    }

    // Get default incentive if exists
    const incentives = await storage.getReviewIncentives(user.id);
    const defaultIncentive = incentives.find(i => i.isDefault && i.isActive);

    // Generate tracking token and short code
    const trackingToken = `rv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const shortCode = `r${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;

    // Parse reservation date
    let parsedReservationDate = null;
    if (reservation_date) {
      parsedReservationDate = new Date(reservation_date);
    }

    // Create the review request
    const newRequest = await storage.createReviewRequest({
      userId: user.id,
      customerName: customer_name || null,
      customerEmail: customer_email || null,
      customerPhone: customer_phone || null,
      reservationId: reservation_id || null,
      reservationDate: parsedReservationDate,
      reservationTime: reservation_time || null,
      sendMethod: send_method,
      trackingToken,
      shortCode,
      incentiveId: defaultIncentive?.id || null,
      status: 'pending',
    });

    console.log(`✅ [N8N Reviews] Request created for ${user.email}: ${newRequest.id}`);

    res.json({
      success: true,
      request_id: newRequest.id,
      tracking_token: trackingToken,
      status: "pending",
      incentive: defaultIncentive ? {
        id: defaultIncentive.id,
        display_message: defaultIncentive.displayMessage
      } : null
    });

  } catch (error: any) {
    console.error("[N8N Reviews] Error creating request:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// 2. POST /api/n8n/reviews/send-request - Send email/SMS for a review request
router.post("/send-request", async (req, res) => {
  try {
    if (!validateN8NMasterKey(req)) {
      return res.status(401).json({ success: false, error: "Invalid API key" });
    }

    const { request_id } = req.body;

    if (!request_id) {
      return res.status(400).json({ success: false, error: "request_id is required" });
    }

    // Get the request (admin method - no userId required for N8N)
    const request = await storage.getReviewRequestByIdAdmin(request_id);
    if (!request) {
      return res.status(404).json({ success: false, error: "Request not found" });
    }

    // Get user config
    const config = await storage.getReviewConfig(request.userId);
    if (!config) {
      return res.status(404).json({ success: false, error: "Review config not found" });
    }

    // Get user for email sending
    const user = await storage.getUser(request.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Get incentive if exists
    let incentive = null;
    if (request.incentiveId) {
      incentive = await storage.getReviewIncentiveById(request.incentiveId, request.userId);
    }

    const frontendUrl = getFrontendUrl();
    const reviewLink = `${frontendUrl}/review/${request.trackingToken}`;

    let emailSent = false;
    let smsSent = false;

    // Prepare incentive text
    const incentiveTextEmail = incentive?.displayMessage 
      ? `<div style="background-color:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:16px;text-align:center;margin:16px 0;">
          <span style="font-size:24px;">🎁</span>
          <p style="margin:8px 0 0;font-size:15px;color:#92400e;font-weight:600;">${incentive.displayMessage}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#b45309;">Valable ${incentive.validityDays} jours</p>
        </div>` 
      : '';

    const incentiveTextSms = incentive?.displayMessage 
      ? `\n\n🎁 ${incentive.displayMessage}` 
      : '';

    // Send email if customer has email and method is email or both
    if (request.customerEmail && (request.sendMethod === 'email' || request.sendMethod === 'both')) {
      const companyName = config.companyName || "notre établissement";
      
      const emailContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;margin:0;padding:0;background-color:#f5f5f5;">
          <table style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;">
            <tr><td style="background:linear-gradient(135deg,#1a1c1f 0%,#2d2f33 100%);padding:32px;text-align:center;">
              <h1 style="color:#C8B88A;margin:0;font-size:24px;">Votre avis compte !</h1>
            </td></tr>
            <tr><td style="padding:24px;">
              <p style="margin:0 0 16px;font-size:16px;color:#374151;">Bonjour ${request.customerName || 'cher client'},</p>
              <p style="margin:0 0 16px;font-size:16px;color:#374151;">Nous espérons que vous avez passé un agréable moment chez ${companyName}.</p>
              <p style="margin:0 0 24px;font-size:16px;color:#374151;">Votre avis nous aiderait énormément à nous améliorer et à faire connaître notre établissement.</p>
              ${incentiveTextEmail}
              <div style="text-align:center;margin:24px 0;">
                <a href="${reviewLink}" style="display:inline-block;background-color:#C8B88A;color:#000000;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">
                  ⭐ Laisser mon avis
                </a>
              </div>
              <p style="margin:24px 0 0;font-size:14px;color:#6b7280;text-align:center;">Merci infiniment pour votre confiance !</p>
            </td></tr>
          </table>
        </body>
        </html>
      `;

      try {
        await sendEmail({
          to: request.customerEmail,
          subject: config.emailSubject || `Votre avis sur ${companyName} nous intéresse !`,
          html: emailContent,
          text: `Bonjour ${request.customerName}, merci de votre visite chez ${companyName} !${incentiveTextSms}\n\nPartagez votre expérience avec nous : ${reviewLink}`,
        });
        emailSent = true;
        console.log(`✅ [N8N Reviews] Email sent to ${request.customerEmail}`);
      } catch (emailError) {
        console.error("[N8N Reviews] Error sending email:", emailError);
      }
    }

    // Prepare SMS data for N8N to send (N8N handles actual SMS sending via Twilio)
    let smsData = null;
    let smsPrepared = false;
    if (request.customerPhone && (request.sendMethod === 'sms' || request.sendMethod === 'both')) {
      const companyName = config.companyName || "notre établissement";
      
      // Build SMS message with global replacement for all placeholders
      const smsMessage = config.smsMessage 
        ? config.smsMessage
            .replaceAll('{nom}', request.customerName || 'Client')
            .replaceAll('{entreprise}', companyName)
            .replaceAll('{lien}', reviewLink)
        : `Bonjour ${request.customerName || ''}, merci pour votre visite chez ${companyName} ! Partagez votre avis : ${reviewLink}${incentiveTextSms}`;
      
      // Return SMS data for N8N to send
      if (config.smsEnabled) {
        smsData = {
          to: request.customerPhone,
          message: smsMessage,
          customer_name: request.customerName,
          company_name: companyName,
          review_link: reviewLink,
          incentive: incentive?.displayMessage || null
        };
        smsPrepared = true;
        smsSent = true; // Indicates N8N should send SMS
        console.log(`📱 [N8N Reviews] SMS data prepared for ${request.customerPhone} - N8N will handle sending`);
      } else {
        console.log("[N8N Reviews] SMS disabled in config, skipping SMS data preparation");
      }
    }

    // Update request status
    await storage.updateReviewRequest(request.id, {
      sentAt: new Date(),
      status: 'sent',
    });

    // Response includes both sms_sent (for N8N compatibility) and sms_data (new payload)
    res.json({
      success: true,
      email_sent: emailSent,
      sms_sent: smsSent, // Keep for N8N workflow compatibility
      sms_enabled: config.smsEnabled || false,
      sms_data: smsData, // New: full SMS payload for N8N to use with Twilio node
      tracking_url: reviewLink
    });

  } catch (error: any) {
    console.error("[N8N Reviews] Error sending request:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// 3. GET /api/n8n/reviews/pending-requests - Get pending requests ready to send
router.get("/pending-requests", async (req, res) => {
  try {
    if (!validateN8NMasterKey(req)) {
      return res.status(401).json({ success: false, error: "Invalid API key" });
    }

    const maxAgeHours = parseInt(req.query.max_age_hours as string) || 48;
    const maxAge = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    const readyOnly = req.query.ready_only === 'true';

    // Get all pending requests created within max_age
    const pendingRequests = await storage.getPendingReviewRequests(maxAge);

    // For each request, determine if it's ready to send based on user config
    const requestsWithTiming = await Promise.all(
      pendingRequests.map(async (request: typeof pendingRequests[0]) => {
        const config = await storage.getReviewConfig(request.userId);
        
        let shouldSendAt = new Date(request.createdAt);
        let readyToSend = false;

        if (config) {
          // Calculate when to send based on timing mode
          if (config.timingMode === 'fixed_delay') {
            shouldSendAt = new Date(request.createdAt.getTime() + config.fixedDelayHours * 60 * 60 * 1000);
          } else if (config.timingMode === 'fixed_time' && config.fixedTime) {
            const [hours, minutes] = config.fixedTime.split(':').map(Number);
            shouldSendAt = new Date(request.createdAt);
            shouldSendAt.setHours(hours, minutes, 0, 0);
            if (shouldSendAt <= request.createdAt) {
              shouldSendAt.setDate(shouldSendAt.getDate() + 1);
            }
          } else {
            // Smart mode defaults to 24 hours
            shouldSendAt = new Date(request.createdAt.getTime() + 24 * 60 * 60 * 1000);
          }

          // Check if within send window
          const now = new Date();
          if (now >= shouldSendAt) {
            if (config.sendWindowStart && config.sendWindowEnd) {
              const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
              readyToSend = currentTime >= config.sendWindowStart && currentTime <= config.sendWindowEnd;
            } else {
              readyToSend = true;
            }

            // Check weekend avoidance
            if (config.avoidWeekends && (now.getDay() === 0 || now.getDay() === 6)) {
              readyToSend = false;
            }
          }
        }

        return {
          id: request.id,
          user_id: request.userId,
          customer_name: request.customerName,
          customer_email: request.customerEmail,
          customer_phone: request.customerPhone,
          tracking_token: request.trackingToken,
          send_method: request.sendMethod,
          created_at: request.createdAt.toISOString(),
          should_send_at: shouldSendAt.toISOString(),
          ready_to_send: readyToSend
        };
      })
    );

    // Filter to only ready requests if requested
    const filteredRequests = readyOnly 
      ? requestsWithTiming.filter(r => r.ready_to_send)
      : requestsWithTiming;

    res.json({
      success: true,
      requests: filteredRequests
    });

  } catch (error: any) {
    console.error("[N8N Reviews] Error getting pending requests:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// 4. POST /api/n8n/reviews/mark-sent - Mark requests as sent
router.post("/mark-sent", async (req, res) => {
  try {
    if (!validateN8NMasterKey(req)) {
      return res.status(401).json({ success: false, error: "Invalid API key" });
    }

    const { request_ids } = req.body;

    if (!Array.isArray(request_ids) || request_ids.length === 0) {
      return res.status(400).json({ success: false, error: "request_ids array is required" });
    }

    let updated = 0;
    for (const id of request_ids) {
      try {
        await storage.updateReviewRequest(id, {
          sentAt: new Date(),
          status: 'sent',
        });
        updated++;
      } catch (err) {
        console.error(`[N8N Reviews] Error marking request ${id} as sent:`, err);
      }
    }

    console.log(`✅ [N8N Reviews] Marked ${updated} requests as sent`);

    res.json({
      success: true,
      updated
    });

  } catch (error: any) {
    console.error("[N8N Reviews] Error marking requests as sent:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router;
