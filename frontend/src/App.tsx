import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import { AuthProvider } from "./hooks/useAuth";
import Analytics from "./pages/Analytics";
import Analyze from "./pages/Analyze";
import Community from "./pages/Community";
import Landing from "./pages/Landing";
import Results from "./pages/Results";
import Species from "./pages/Species";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Landing />} />
                <Route path="/analyze" element={<Analyze />} />
                <Route path="/results/:fileId" element={<Results />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/species" element={<Species />} />
                <Route path="/community" element={<Community />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
