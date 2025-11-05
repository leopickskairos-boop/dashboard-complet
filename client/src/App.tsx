import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Pages
import Landing from "@/pages/landing";
import Signup from "@/pages/signup";
import Login from "@/pages/login";
import VerifyEmailSent from "@/pages/verify-email-sent";
import VerifyEmail from "@/pages/verify-email";
import Subscribe from "@/pages/subscribe";
import PaymentSuccess from "@/pages/payment-success";
import Dashboard from "@/pages/dashboard";
import SubscriptionExpired from "@/pages/subscription-expired";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/login" component={Login} />
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
          <Dashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/subscription-expired" component={SubscriptionExpired} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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
