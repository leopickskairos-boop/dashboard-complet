import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";

// Pages
import Landing from "@/pages/landing";
import Signup from "@/pages/signup";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import VerifyEmailSent from "@/pages/verify-email-sent";
import VerifyEmail from "@/pages/verify-email";
import Subscribe from "@/pages/subscribe";
import PaymentSuccess from "@/pages/payment-success";
import Dashboard from "@/pages/dashboard";
import Notifications from "@/pages/notifications";
import Account from "@/pages/account";
import Admin from "@/pages/admin";
import SubscriptionExpired from "@/pages/subscription-expired";
import TrialExpired from "@/pages/trial-expired";
import NotFound from "@/pages/not-found";

// Guarantee CB Pages
import GuaranteeSettings from "@/pages/guarantee/GuaranteeSettings";
import GuaranteeReservations from "@/pages/guarantee/GuaranteeReservations";
import GuaranteeHistory from "@/pages/guarantee/GuaranteeHistory";
import GuaranteePage from "@/pages/guarantee/GuaranteePage";
import GuaranteeConfirmation from "@/pages/guarantee/GuaranteeConfirmation";
import GuaranteeCancellation from "@/pages/guarantee/GuaranteeCancellation";

// Reviews & Reputation Pages
import ReviewsSettings from "@/pages/reviews/ReviewsSettings";
import ReviewsCampaigns from "@/pages/reviews/ReviewsCampaigns";
import ReviewsList from "@/pages/reviews/ReviewsList";
import ReviewsStats from "@/pages/reviews/ReviewsStats";
import ReviewPage from "@/pages/reviews/ReviewPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/verify-email-sent" component={VerifyEmailSent} />
      <Route path="/verify-email" component={VerifyEmail} />
      
      {/* Protected: requires verified email */}
      <Route path="/subscribe">
        <ProtectedRoute requireVerified={true}>
          <Subscribe />
        </ProtectedRoute>
      </Route>

      <Route path="/payment-success">
        <ProtectedRoute requireVerified={true}>
          <PaymentSuccess />
        </ProtectedRoute>
      </Route>

      {/* Protected: requires verified email + active subscription */}
      <Route path="/dashboard">
        <ProtectedRoute requireVerified={true} requireSubscription={true}>
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/notifications">
        <ProtectedRoute requireVerified={true} requireSubscription={true}>
          <DashboardLayout>
            <Notifications />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/account">
        <ProtectedRoute requireVerified={true} requireSubscription={true}>
          <DashboardLayout>
            <Account />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* Admin: requires auth only (no email verification or subscription required for admins) */}
      <Route path="/admin">
        <ProtectedRoute requireVerified={false} requireSubscription={false}>
          <DashboardLayout>
            <Admin />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/subscription-expired" component={SubscriptionExpired} />
      <Route path="/trial-expired" component={TrialExpired} />

      {/* Guarantee CB - Protected dashboard pages */}
      <Route path="/settings/guarantee">
        <ProtectedRoute requireVerified={true} requireSubscription={true}>
          <DashboardLayout>
            <GuaranteeSettings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/guarantee/reservations">
        <ProtectedRoute requireVerified={true} requireSubscription={true}>
          <DashboardLayout>
            <GuaranteeReservations />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/guarantee/history">
        <ProtectedRoute requireVerified={true} requireSubscription={true}>
          <DashboardLayout>
            <GuaranteeHistory />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* Guarantee CB - Public pages (no auth required) */}
      <Route path="/g/:sessionId" component={GuaranteePage} />
      <Route path="/guarantee/confirmation" component={GuaranteeConfirmation} />
      <Route path="/guarantee/annulation" component={GuaranteeCancellation} />

      {/* Reviews & Reputation - Protected dashboard pages */}
      <Route path="/reviews/settings">
        <ProtectedRoute requireVerified={true} requireSubscription={true}>
          <DashboardLayout>
            <ReviewsSettings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/reviews/campaigns">
        <ProtectedRoute requireVerified={true} requireSubscription={true}>
          <DashboardLayout>
            <ReviewsCampaigns />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/reviews/stats">
        <ProtectedRoute requireVerified={true} requireSubscription={true}>
          <DashboardLayout>
            <ReviewsStats />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/reviews">
        <ProtectedRoute requireVerified={true} requireSubscription={true}>
          <DashboardLayout>
            <ReviewsList />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* Reviews - Public page (no auth required) */}
      <Route path="/review/:token" component={ReviewPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Force dark mode globally
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
