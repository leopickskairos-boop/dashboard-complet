// Short Links Routes - Public link resolver
import { Router } from "express";
import { storage } from "./middleware";

const router = Router();

// Public endpoint: Resolve short link
router.get("/:code", async (req, res) => {
  try {
    const { code } = req.params;
    
    // Try to find a review request with this short code
    const reviewRequest = await storage.getReviewRequestByShortCode(code);
    if (reviewRequest) {
      return res.json({
        type: "review",
        token: reviewRequest.trackingToken,
      });
    }
    
    // Try to find a guarantee session with this short code
    const guaranteeSession = await storage.getGuaranteeSessionByShortCode(code);
    if (guaranteeSession) {
      return res.json({
        type: "guarantee",
        sessionId: guaranteeSession.id,
      });
    }
    
    res.status(404).json({ message: "Lien invalide ou expiré" });
  } catch (error: any) {
    console.error("[ShortLink] Error resolving:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
