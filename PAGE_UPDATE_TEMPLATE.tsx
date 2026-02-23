/**
 * PAGE UPDATE TEMPLATE
 * Use this as a reference to update all development pages
 * 
 * Pages to update:
 * 1. MarketAnalysisPage.tsx
 * 2. CompetitionPage.tsx
 * 3. SupplyPipelinePage.tsx
 * 4. DueDiligencePage.tsx
 * 5. ProjectTimelinePage.tsx
 */

// ============================================
// STEP 1: Add imports at the top
// ============================================

import { useDealDataStore } from '../stores/dealData.store';
import { useAutoSaveWithGuard } from '../hooks/useAutoSave';

// ============================================
// STEP 2: In your component, replace local state with store
// ============================================

export const YourPage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  
  // OLD WAY (remove this):
  // const [localData, setLocalData] = useState(null);
  
  // NEW WAY (use this):
  const {
    // Choose the right data for your page:
    marketAnalysis,           // For MarketAnalysisPage
    competitionData,          // For CompetitionPage
    supplyData,              // For SupplyPipelinePage
    dueDiligenceData,        // For DueDiligencePage
    timelineData,            // For ProjectTimelinePage
    
    // Choose the right update function:
    updateMarketAnalysis,     // For MarketAnalysisPage
    updateCompetitionData,    // For CompetitionPage
    updateSupplyData,         // For SupplyPipelinePage
    updateDueDiligenceData,   // For DueDiligencePage
    updateTimelineData,       // For ProjectTimelinePage
  } = useDealDataStore();
  
  // Enable auto-save
  const {
    hasUnsavedChanges,
    isSaving,
    error: saveError,
    manualSave,
  } = useAutoSaveWithGuard({
    dealId: dealId || '',
    interval: 5000,
    enabled: true,
    onSaveSuccess: () => {
      console.log('✅ Data auto-saved');
    },
    onSaveError: (error) => {
      console.error('❌ Auto-save failed:', error);
    },
  });
  
  // ============================================
  // STEP 3: Update your data handlers
  // ============================================
  
  // OLD WAY (remove):
  // const handleDataChange = (newData) => {
  //   setLocalData(newData);
  // };
  
  // NEW WAY (use this):
  const handleDataChange = (newData) => {
    // Choose the right update function for your page
    updateMarketAnalysis({
      ...marketAnalysis,
      ...newData,
      lastUpdated: new Date().toISOString(),
    });
    
    // OR for other pages:
    // updateCompetitionData({ ...competitionData, ...newData, lastUpdated: new Date().toISOString() });
    // updateSupplyData({ ...supplyData, ...newData, lastUpdated: new Date().toISOString() });
    // updateDueDiligenceData({ ...dueDiligenceData, ...newData, lastUpdated: new Date().toISOString() });
    // updateTimelineData({ ...timelineData, ...newData, lastUpdated: new Date().toISOString() });
  };
  
  // ============================================
  // STEP 4: Add save status indicators to header
  // ============================================
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Your existing header content */}
            </div>
            
            {/* ADD THIS: Save status indicators */}
            <div className="flex items-center gap-3">
              {/* Unsaved changes indicator */}
              {hasUnsavedChanges && (
                <span className="text-sm text-orange-600 flex items-center gap-1">
                  <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse" />
                  Unsaved changes
                </span>
              )}
              
              {/* Saving indicator */}
              {isSaving && (
                <span className="text-sm text-blue-600 flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                  Saving...
                </span>
              )}
              
              {/* Saved indicator */}
              {!hasUnsavedChanges && !isSaving && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-600 rounded-full" />
                  All changes saved
                </span>
              )}
              
              {/* Manual save button */}
              <button
                onClick={() => manualSave()}
                disabled={isSaving || !hasUnsavedChanges}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Your existing page content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* ... */}
      </div>
      
      {/* ADD THIS: Error message display */}
      {saveError && (
        <div className="fixed bottom-4 right-4 max-w-md p-4 bg-red-50 border border-red-200 rounded-lg shadow-lg">
          <p className="text-sm text-red-800">{saveError}</p>
          <button
            onClick={() => {
              // Error will auto-clear or you can add clearError function to store
            }}
            className="absolute top-2 right-2 text-red-600 hover:text-red-800"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================
// STEP 5: Update navigation handlers
// ============================================

// If you have custom navigation (back button, etc.), update it:
const handleNavigation = () => {
  if (hasUnsavedChanges) {
    const confirmLeave = window.confirm(
      'You have unsaved changes. Do you want to save before leaving?'
    );
    if (confirmLeave) {
      manualSave();
    }
  }
  navigate(`/deals/${dealId}`);
};

// ============================================
// COMPLETE EXAMPLES FOR EACH PAGE
// ============================================

// MARKET ANALYSIS PAGE
// --------------------
const MarketAnalysisPageExample = () => {
  const { marketAnalysis, updateMarketAnalysis } = useDealDataStore();
  
  const handleDemographicsUpdate = (demographics) => {
    updateMarketAnalysis({
      ...marketAnalysis,
      demographics,
      lastUpdated: new Date().toISOString(),
    });
  };
  
  const handleSupplyDemandUpdate = (supplyDemand) => {
    updateMarketAnalysis({
      ...marketAnalysis,
      supplyDemand,
      lastUpdated: new Date().toISOString(),
    });
  };
};

// COMPETITION PAGE
// ----------------
const CompetitionPageExample = () => {
  const { competitionData, updateCompetitionData } = useDealDataStore();
  
  const handleAddCompetitor = (competitor) => {
    const competitors = [...(competitionData?.competitors || []), competitor];
    updateCompetitionData({
      ...competitionData,
      competitors,
      lastUpdated: new Date().toISOString(),
    });
  };
  
  const handleRemoveCompetitor = (competitorId) => {
    const competitors = (competitionData?.competitors || []).filter(
      (c) => c.id !== competitorId
    );
    updateCompetitionData({
      ...competitionData,
      competitors,
      lastUpdated: new Date().toISOString(),
    });
  };
};

// SUPPLY PIPELINE PAGE
// --------------------
const SupplyPipelinePageExample = () => {
  const { supplyData, updateSupplyData } = useDealDataStore();
  
  const handleAddProject = (project) => {
    const projects = [...(supplyData?.projects || []), project];
    updateSupplyData({
      ...supplyData,
      projects,
      lastUpdated: new Date().toISOString(),
    });
  };
};

// DUE DILIGENCE PAGE
// ------------------
const DueDiligencePageExample = () => {
  const { dueDiligenceData, updateDueDiligenceData } = useDealDataStore();
  
  const handleAddDocument = (document) => {
    const documents = [...(dueDiligenceData?.documents || []), document];
    updateDueDiligenceData({
      ...dueDiligenceData,
      documents,
      lastUpdated: new Date().toISOString(),
    });
  };
  
  const handleAddFinding = (finding) => {
    const findings = { ...(dueDiligenceData?.findings || {}), ...finding };
    updateDueDiligenceData({
      ...dueDiligenceData,
      findings,
      lastUpdated: new Date().toISOString(),
    });
  };
};

// PROJECT TIMELINE PAGE
// ---------------------
const ProjectTimelinePageExample = () => {
  const { timelineData, updateTimelineData } = useDealDataStore();
  
  const handleAddMilestone = (milestone) => {
    const milestones = [...(timelineData?.milestones || []), milestone];
    updateTimelineData({
      ...timelineData,
      milestones,
      lastUpdated: new Date().toISOString(),
    });
  };
  
  const handleUpdateSchedule = (schedule) => {
    updateTimelineData({
      ...timelineData,
      schedule,
      lastUpdated: new Date().toISOString(),
    });
  };
};

// ============================================
// TESTING CHECKLIST
// ============================================

/**
 * After updating each page, test:
 * 
 * 1. ✓ Make changes on the page
 * 2. ✓ Wait 5 seconds - should see "Saving..." then "All changes saved"
 * 3. ✓ Navigate away and come back - data should persist
 * 4. ✓ Refresh page - data should still be there
 * 5. ✓ Click manual save button - should save immediately
 * 6. ✓ Try to close tab with unsaved changes - should see warning
 * 7. ✓ Check browser DevTools:
 *    - LocalStorage: 'deal-data-storage' key should have your data
 *    - Network tab: Should see POST to /api/v1/deals/:id/state
 * 8. ✓ Test offline: Disable network, make changes, should save to LocalStorage
 */

// ============================================
// COMMON PITFALLS
// ============================================

/**
 * 1. DON'T forget to call the update function when data changes
 *    BAD:  setLocalState(newData);
 *    GOOD: updateMarketAnalysis({ ...marketAnalysis, ...newData });
 * 
 * 2. DON'T mutate state directly
 *    BAD:  marketAnalysis.demographics = newDemographics;
 *    GOOD: updateMarketAnalysis({ ...marketAnalysis, demographics: newDemographics });
 * 
 * 3. DO include lastUpdated timestamp
 *    updateMarketAnalysis({
 *      ...marketAnalysis,
 *      ...newData,
 *      lastUpdated: new Date().toISOString(), // ← Important!
 *    });
 * 
 * 4. DO use the right update function for your page
 *    - MarketAnalysisPage → updateMarketAnalysis
 *    - CompetitionPage → updateCompetitionData
 *    - etc.
 */
