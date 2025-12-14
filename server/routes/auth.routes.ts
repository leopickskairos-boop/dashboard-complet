// Authentication Routes Module
import { Router } from "express";
import { z } from "zod";
import {
  storage,
  requireAuth,
  hashPassword,
  comparePassword,
  generateToken,
  generateVerificationToken,
  getVerificationTokenExpiry,
  toPublicUser,
  stripe,
} from "./middleware";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../gmail-email";
import {
  insertUserSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@shared/schema";

const router = Router();

// Signup
router.post("/signup", async (req, res) => {
  try {
    const data = insertUserSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await storage.getUserByEmail(data.email);
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Un compte existe déjà avec cet email" });
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create Stripe Customer immediately (before user creation)
    let stripeCustomerId: string | undefined;
    try {
      const customer = await stripe.customers.create({
        email: data.email,
        metadata: {
          source: "speedai_signup",
        },
      });
      stripeCustomerId = customer.id;
    } catch (stripeError) {
      console.error("Failed to create Stripe customer:", stripeError);
    }

    // Calculate trial period (30 days from now)
    const countdownStart = new Date();
    const countdownEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create user with trial period
    const user = await storage.createUser({
      email: data.email,
      password: hashedPassword,
      stripeCustomerId,
      countdownStart,
      countdownEnd,
      accountStatus: "trial",
    });

    // Generate verification token
    const verificationToken = generateVerificationToken();
    const tokenExpiry = getVerificationTokenExpiry();
    await storage.setVerificationToken(
      user.id,
      verificationToken,
      tokenExpiry,
    );

    // Send verification email
    try {
      await sendVerificationEmail(user.email, verificationToken);
    } catch (emailError) {
      console.error("Failed to send verification email (non-critical):", emailError);
    }

    res.status(201).json({
      message: "Inscription réussie. Veuillez vérifier votre email. Vous bénéficiez de 30 jours d'essai gratuit.",
      userId: user.id,
      trialDays: 30,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Données invalides", errors: error.errors });
    }
    console.error("Signup error:", error);
    res.status(500).json({ message: "Erreur lors de l'inscription" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await storage.getUserByEmail(data.email);
    if (!user) {
      return res.status(401).json({ message: "Email ou mot de passe incorrect" });
    }

    const isValid = await comparePassword(data.password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Email ou mot de passe incorrect" });
    }

    const token = generateToken(user.id);

    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    if (process.env.NODE_ENV === "development") {
      console.log("[BACKEND LOGIN] User authenticated:", {
        userId: user.id,
        email: user.email,
        role: user.role,
        accountStatus: (user as any).accountStatus,
      });
    }

    res.json({
      message: "Connexion réussie",
      user: toPublicUser(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Données invalides" });
    }
    console.error("Login error:", error);
    res.status(500).json({ message: "Erreur lors de la connexion" });
  }
});

// Get current user
router.get("/me", requireAuth, async (req, res) => {
  const user = (req as any).user;

  if (process.env.NODE_ENV === "development") {
    console.log("[BACKEND /api/auth/me] Full user data:", {
      userId: user.id,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      subscriptionStatus: user.subscriptionStatus,
      plan: user.plan,
      subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
    });
  }

  res.json(toPublicUser(user));
});

// Logout
router.post("/logout", (req, res) => {
  res.clearCookie("auth_token");
  res.json({ message: "Déconnexion réussie" });
});

// Verify email
router.post("/verify-email", async (req, res) => {
  try {
    const verificationSchema = z.object({
      token: z.string().min(1, "Token requis"),
    });

    const { token } = verificationSchema.parse(req.body);

    const user = await storage.getUserByVerificationToken(token);
    if (!user) {
      return res.status(400).json({ message: "Token invalide ou expiré" });
    }

    if (user.verificationTokenExpiry) {
      const now = new Date();
      const expiry = new Date(user.verificationTokenExpiry);
      if (now > expiry) {
        return res.status(400).json({ message: "Token expiré" });
      }
    }

    await storage.verifyEmail(user.id);

    res.json({ message: "Email vérifié avec succès" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Données invalides" });
    }
    console.error("Verify email error:", error);
    res.status(500).json({ message: "Erreur lors de la vérification" });
  }
});

// Resend verification email
router.post("/resend-verification", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;

    if (user.isVerified) {
      return res.status(400).json({ message: "Email déjà vérifié" });
    }

    const verificationToken = generateVerificationToken();
    const tokenExpiry = getVerificationTokenExpiry();
    await storage.setVerificationToken(user.id, verificationToken, tokenExpiry);

    await sendVerificationEmail(user.email, verificationToken);

    res.json({ message: "Email de vérification renvoyé" });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ message: "Erreur lors de l'envoi" });
  }
});

// Forgot password
router.post("/forgot-password", async (req, res) => {
  try {
    const data = forgotPasswordSchema.parse(req.body);

    const user = await storage.getUserByEmail(data.email);

    if (!user) {
      return res.json({
        message: "Si cet email existe dans notre système, un lien de réinitialisation a été envoyé.",
      });
    }

    const resetToken = generateVerificationToken();
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 1);

    await storage.setResetPasswordToken(user.id, resetToken, tokenExpiry);

    try {
      await sendPasswordResetEmail(user.email, resetToken);
    } catch (emailError) {
      console.error("Failed to send password reset email (non-critical):", emailError);
    }

    res.json({
      message: "Si cet email existe dans notre système, un lien de réinitialisation a été envoyé.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Email invalide" });
    }
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Erreur lors de la demande de réinitialisation" });
  }
});

// Reset password
router.post("/reset-password", async (req, res) => {
  try {
    const data = resetPasswordSchema.parse(req.body);

    const user = await storage.getUserByResetPasswordToken(data.token);
    if (!user) {
      return res.status(400).json({ message: "Token invalide ou expiré" });
    }

    if (user.resetPasswordTokenExpiry) {
      const now = new Date();
      const expiry = new Date(user.resetPasswordTokenExpiry);
      if (now > expiry) {
        return res.status(400).json({
          message: "Token expiré. Veuillez demander un nouveau lien de réinitialisation.",
        });
      }
    }

    const hashedPassword = await hashPassword(data.password);
    await storage.resetPassword(user.id, hashedPassword);

    res.json({
      message: "Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Données invalides" });
    }
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Erreur lors de la réinitialisation du mot de passe" });
  }
});

export default router;
