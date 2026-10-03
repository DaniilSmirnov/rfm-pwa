import './ResultsScreen.css';
import React from 'react';
import CrewResults from '../../components/CrewResults/CrewResults.jsx';
import EmptyScreenState from '../../components/EmptyScreenState/EmptyScreenState.jsx';

export default function ResultsScreen({
  app,
  crewResultsOpen,
  onOpenCrewResults,
  onCloseCrewResults,
  onOpenRaces,
}) {
  const pkg = app.currentPackage;
  return (
    <section className="results-tab-screen app-screen-results">
      {app.packages?.length > 0 && pkg ? (
        <CrewResults
          pkg={pkg}
          open={crewResultsOpen}
          onOpen={onOpenCrewResults}
          onClose={onCloseCrewResults}
          standalone
        />
      ) : (
        <EmptyScreenState
          className="results-empty-state"
          description="Скачай Rally Pack в разделе управления гонками, чтобы открыть результаты."
          onAction={onOpenRaces}
        />
      )}
    </section>
  );
}
