import { useEffect, useState } from 'react';
import { Colors } from '../constants/Colors';
import { useCraicCoins } from '../contexts/CraicCoinsContext';

interface EventItem {
  name: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  county: string;
  url: string;
  description: string;
  host: string;
  tags: string[];
}

interface EventsData {
  events: EventItem[];
}

const VISITED_KEY = 'craic-visited-events';

function getVisitedEvents(): string[] {
  try {
    const raw = localStorage.getItem(VISITED_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* */ }
  return [];
}

function markEventVisited(id: string) {
  const visited = getVisitedEvents();
  if (!visited.includes(id)) {
    visited.push(id);
    localStorage.setItem(VISITED_KEY, JSON.stringify(visited));
  }
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [filter, setFilter] = useState('');
  const [visitedEvents, setVisitedEvents] = useState<string[]>(getVisitedEvents());
  const [coinPopup, setCoinPopup] = useState<{ name: string; amount: number } | null>(null);
  const { addCoins } = useCraicCoins();

  useEffect(() => {
    fetch('/events.json')
      .then((r) => r.json())
      .then((data: EventsData) => setEvents(data.events || []))
      .catch((err) => console.error('Failed to load events', err));
  }, []);

  const filtered = events.filter((ev) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      ev.name?.toLowerCase().includes(q) ||
      ev.county?.toLowerCase().includes(q) ||
      ev.venue?.toLowerCase().includes(q) ||
      ev.host?.toLowerCase().includes(q)
    );
  });

  // Group by date
  const grouped: Record<string, EventItem[]> = {};
  filtered.forEach((ev) => {
    const key = ev.date || 'TBD';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ev);
  });

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch {
      return dateStr;
    }
  };

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  const eventId = (ev: EventItem, i: number) => `${ev.name}-${ev.date}-${i}`;

  const handleSimulateVisit = (ev: EventItem, i: number) => {
    const id = eventId(ev, i);
    if (visitedEvents.includes(id)) return;

    addCoins(id, ev.name, 5);
    markEventVisited(id);
    setVisitedEvents(getVisitedEvents());

    setCoinPopup({ name: ev.name, amount: 5 });
    if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
    setTimeout(() => setCoinPopup(null), 2500);
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', backgroundColor: Colors.background, position: 'relative' }}>
      <style>{`
        @keyframes coin-fly { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-80px) scale(1.5); opacity: 0; } }
      `}</style>

      {/* Coin popup animation */}
      {coinPopup && (
        <div style={{
          position: 'fixed', top: '40%', left: '50%', transform: 'translateX(-50%)',
          zIndex: 2000, animation: 'coin-fly 2.5s ease forwards', pointerEvents: 'none',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 4 }}>☘️</div>
          <div style={{
            backgroundColor: Colors.success, color: '#fff', borderRadius: 16,
            padding: '8px 20px', fontSize: 20, fontWeight: 900, whiteSpace: 'nowrap',
            boxShadow: '0 4px 20px rgba(46, 160, 67, 0.5)',
          }}>+{coinPopup.amount} CraicCoins!</div>
          <div style={{ color: Colors.text, fontSize: 13, marginTop: 4, fontWeight: 600 }}>{coinPopup.name}</div>
        </div>
      )}

      <div className="irish-bar" />

      {/* Header */}
      <div style={{ textAlign: 'center', padding: '24px 20px 0' }}>
        <div style={{ fontSize: 42, marginBottom: 6 }}>🎉</div>
        <h1 style={{ color: Colors.text, fontSize: 24, fontWeight: 800, margin: 0 }}>Events</h1>
        <p style={{ color: Colors.accent, fontSize: 13, fontStyle: 'italic', marginTop: 4 }}>
          {events.length} events across Ireland
        </p>
      </div>

      {/* Search */}
      <div style={{ padding: '16px 20px 0' }}>
        <input
          type="text"
          placeholder="Search events, venues, counties..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            backgroundColor: Colors.surface, border: `1px solid ${Colors.border}`,
            borderRadius: 12, padding: '12px 16px', color: Colors.text,
            fontSize: 14, outline: 'none',
          }}
        />
      </div>

      {/* Events list */}
      <div style={{ padding: '12px 20px' }}>
        {Object.entries(grouped).map(([date, dateEvents]) => (
          <div key={date} style={{ marginBottom: 20 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
            }}>
              <div style={{
                color: isToday(date) ? Colors.success : Colors.accent,
                fontSize: 14, fontWeight: 800,
              }}>
                {formatDate(date)}
              </div>
              {isToday(date) && (
                <span style={{
                  backgroundColor: Colors.success + '20', color: Colors.success,
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                }}>TODAY</span>
              )}
            </div>

            {dateEvents.map((ev, i) => {
              const id = eventId(ev, i);
              const visited = visitedEvents.includes(id);
              return (
                <div
                  key={id}
                  style={{
                    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
                    marginBottom: 8, border: `1px solid ${visited ? Colors.success + '60' : Colors.border}`,
                  }}
                >
                  <a
                    href={ev.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center',
                      textDecoration: 'none', gap: 12,
                    }}
                  >
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      backgroundColor: visited ? Colors.success + '30' : Colors.primary + '30',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, flexShrink: 0,
                    }}>{visited ? '✅' : '📅'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: Colors.text, fontSize: 14, fontWeight: 700,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{ev.name}</div>
                      <div style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 3 }}>
                        {ev.time?.replace(' UTC', '')} · {ev.venue || ev.county}
                      </div>
                      {ev.host && (
                        <div style={{
                          color: Colors.textMuted, fontSize: 11, marginTop: 2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>by {ev.host}</div>
                      )}
                    </div>
                    <span style={{ color: Colors.accent, fontSize: 16, fontWeight: 700, flexShrink: 0 }}>→</span>
                  </a>
                  <button
                    onClick={() => handleSimulateVisit(ev, i)}
                    disabled={visited}
                    style={{
                      marginTop: 10, width: '100%',
                      backgroundColor: visited ? Colors.surface : Colors.accent,
                      borderRadius: 10, padding: '8px 14px',
                      border: visited ? `1px solid ${Colors.success}40` : 'none',
                      cursor: visited ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{visited ? '✅' : '📍'}</span>
                    <span style={{
                      color: visited ? Colors.success : Colors.background,
                      fontSize: 13, fontWeight: 700,
                    }}>{visited ? 'Visited · +5 CraicCoins claimed' : 'Simulate Visit · +5 ☘️'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>🔍</span>
            <div style={{ color: Colors.textSecondary, fontSize: 14 }}>No events found</div>
          </div>
        )}
      </div>

      <div style={{ height: 100 }} />
    </div>
  );
}
