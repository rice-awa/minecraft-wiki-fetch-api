import { useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { QuickLinks } from './components/QuickLinks';
import { HealthCard } from './components/HealthCard';
import { SearchCard } from './components/SearchCard';
import { PageCard } from './components/PageCard';
import { BatchCard } from './components/BatchCard';
import { ToastProvider } from './components/Toast';

function App() {
  // Auto-run health check on load for visual feedback
  useEffect(() => {
    // Trigger health check after a short delay
    const timer = setTimeout(() => {
      const healthButton = document.querySelector('[data-test="health-check"]') as HTMLButtonElement;
      if (healthButton) healthButton.click();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ToastProvider>
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        <QuickLinks />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Health & Search */}
          <div className="lg:col-span-7 space-y-8">
            <HealthCard />
            <SearchCard />
          </div>

          {/* Right Column: Page & Batch */}
          <div className="lg:col-span-5 space-y-8">
            <PageCard />
            <BatchCard />
          </div>
        </div>
      </main>
      <Footer />
    </ToastProvider>
  );
}

export default App;
