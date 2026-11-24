import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { useDataState } from './data/DataProvider';
import { Layout } from './components/Layout';
import { CardSkeletons, ErrorState, Spinner } from './components/Feedback';
import SearchPage from './pages/SearchPage';
import NotFoundPage from './pages/NotFoundPage';

const PlacePage = lazy(() => import('./pages/PlacePage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

function DataGate({ children }: { children: React.ReactNode }) {
  const { state, retry } = useDataState();
  if (state.status === 'loading')
    return (
      <div className="container" style={{ paddingTop: 32 }}>
        <CardSkeletons />
      </div>
    );
  if (state.status === 'error') return <ErrorState title="Couldn’t load attractions" message={state.error} onRetry={retry} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route
            index
            element={
              <DataGate>
                <SearchPage />
              </DataGate>
            }
          />
          <Route
            path="place/:placeId"
            element={
              <DataGate>
                <Suspense fallback={<Spinner />}>
                  <PlacePage />
                </Suspense>
              </DataGate>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}
