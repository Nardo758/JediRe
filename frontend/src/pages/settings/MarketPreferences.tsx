// MarketPreferences.tsx - User market tracking preferences
// Created: 2026-02-21
// Phase 3: Market Intelligence UI

import React, { useState, useEffect } from 'react';
import { Check, X, Settings, Plus, Trash2 } from 'lucide-react';
import type { UserMarketPreference, MarketCoverageStatus } from '../../types/marketIntelligence.types';

const MarketPreferences: React.FC = () => {
  const [preferences, setPreferences] = useState<UserMarketPreference[]>([]);
  const [availableMarkets, setAvailableMarkets] = useState<MarketCoverageStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prefsRes, marketsRes] = await Promise.all([
        fetch('/api/v1/markets/preferences', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch('/api/v1/markets/available', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);
      
      const prefsData = await prefsRes.json();
      setPreferences(prefsData);
      
      if (marketsRes.ok) {
        const marketsData = await marketsRes.json();
        setAvailableMarkets(marketsData);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    try {
      await fetch(`/api/v1/markets/preferences/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: !isActive })
      });
      loadData();
    } catch (error) {
      console.error('Error updating preference:', error);
    }
  };

  const updatePriority = async (id: number, priority: number) => {
    try {
      await fetch(`/api/v1/markets/preferences/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ priority })
      });
      loadData();
    } catch (error) {
      console.error('Error updating priority:', error);
    }
  };

  const removeMarket = async (id: number) => {
    if (!confirm('Remove this market from tracking?')) return;
    
    try {
      await fetch(`/api/v1/markets/preferences/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      loadData();
    } catch (error) {
      console.error('Error removing market:', error);
    }
  };

  if (loading) {
    return <div className="preferences-loading">Loading...</div>;
  }

  return (
    <div className="market-preferences">
      <header className="preferences-header">
        <h1>Market Preferences</h1>
        <p>Manage which markets you want to track</p>
      </header>

      <div className="preferences-content">
        {/* Tracked Markets Table */}
        <section className="tracked-markets">
          <h2>Tracked Markets</h2>
          <table>
            <thead>
              <tr>
                <th>Market</th>
                <th>Status</th>
                <th>Data Points</th>
                <th>Coverage</th>
                <th>Priority</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {preferences.map(pref => (
                <tr key={pref.id} className={!pref.is_active ? 'inactive-row' : ''}>
                  <td className="market-name">{pref.display_name}</td>
                  <td>
                    <span className={`status-badge ${pref.is_active ? 'active' : 'inactive'}`}>
                      {pref.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>-</td>
                  <td>-</td>
                  <td>
                    <select 
                      value={pref.priority}
                      onChange={(e) => updatePriority(pref.id, parseInt(e.target.value))}
                      className="priority-select"
                    >
                      {[1, 2, 3, 4, 5].map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button 
                      className="toggle-button"
                      onClick={() => toggleActive(pref.id, pref.is_active)}
                    >
                      {pref.is_active ? <Check size={18} /> : <X size={18} />}
                    </button>
                  </td>
                  <td>
                    <button 
                      className="remove-button"
                      onClick={() => removeMarket(pref.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {preferences.length === 0 && (
            <div className="empty-state">
              <p>No markets tracked yet</p>
              <button className="add-market-button">
                <Plus size={18} />
                Add Your First Market
              </button>
            </div>
          )}
        </section>

        {/* Notification Settings */}
        <section className="notification-settings">
          <h2>Notification Preferences</h2>
          <div className="settings-grid">
            <label className="setting-item">
              <input type="checkbox" defaultChecked />
              <span>New data points available</span>
            </label>
            <label className="setting-item">
              <input type="checkbox" defaultChecked />
              <span>Opportunity alerts</span>
            </label>
            <label className="setting-item">
              <input type="checkbox" defaultChecked />
              <span>Market updates</span>
            </label>
            <label className="setting-item">
              <input type="checkbox" />
              <span>Weekly digest email</span>
            </label>
          </div>
        </section>
      </div>

      <style jsx>{`
        .market-preferences {
          min-height: 100vh;
          background: #f8fafc;
        }

        .preferences-header {
          background: white;
          border-bottom: 1px solid #e2e8f0;
          padding: 24px;
        }

        .preferences-header h1 {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 8px 0;
        }

        .preferences-header p {
          font-size: 14px;
          color: #64748b;
          margin: 0;
        }

        .preferences-content {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .tracked-markets,
        .notification-settings {
          background: white;
          border-radius: 12px;
          padding: 24px;
        }

        h2 {
          font-size: 18px;
          font-weight: 600;
          color: #0f172a;
          margin: 0 0 16px 0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }

        th {
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        td {
          color: #0f172a;
        }

        .market-name {
          font-weight: 600;
        }

        .inactive-row {
          opacity: 0.5;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-badge.active {
          background: #dcfce7;
          color: #15803d;
        }

        .status-badge.inactive {
          background: #f1f5f9;
          color: #64748b;
        }

        .priority-select {
          padding: 6px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: white;
          cursor: pointer;
        }

        .toggle-button,
        .remove-button {
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .toggle-button {
          color: #22c55e;
        }

        .toggle-button:hover {
          background: #f0fdf4;
        }

        .remove-button {
          color: #ef4444;
        }

        .remove-button:hover {
          background: #fef2f2;
        }

        .empty-state {
          text-align: center;
          padding: 48px;
          color: #64748b;
        }

        .add-market-button {
          margin-top: 16px;
          padding: 10px 20px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .settings-grid {
          display: grid;
          gap: 16px;
        }

        .setting-item {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
        }

        .setting-item input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .setting-item span {
          font-size: 14px;
          color: #334155;
        }

        .preferences-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
      `}</style>
    </div>
  );
};

export default MarketPreferences;
